import { Database } from './db.js';
import crypto from 'node:crypto';
import { createLogger } from '@grocery/observability';

const logger = createLogger('analytics-service:forecaster');

export interface ForecastResult {
  sku: string;
  forecastDate: string;
  predictedDemandUnits: number;
  confidenceInterval: {
    lower: number;
    upper: number;
  };
  metadata: {
    modelVersion: string;
    trainingWindowDays: number;
    dataFreshness: string;
    authoritativeSource: string;
    advisoryOnly: boolean;
  };
}

export interface StockoutRiskAssessment {
  sku: string;
  currentAuthoritativeStock: number;
  dailyBurnRate: number;
  daysOfSupply: number;
  supplierLeadTimeDays: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'CRITICAL';
  recommendedReorderUnits: number;
  metadata: {
    modelVersion: string;
    dataFreshness: string;
    advisoryOnly: boolean;
  };
}

export class ForecasterService {
  public static readonly MODEL_VERSION = 'v1.0.0-baseline-ma7';

  /**
   * Acceptance Scenario 15: Computes demand forecast with strictly tagged model metadata
   */
  public async computeSkuForecast(
    sku: string,
    horizonDays = 7,
    trainingWindowDays = 30
  ): Promise<ForecastResult> {
    // 1. Fetch historical daily demand
    const historyRes = await Database.query(
      `SELECT date, units_sold
       FROM daily_sku_demand
       WHERE sku = $1
       ORDER BY date DESC
       LIMIT $2`,
      [sku, trainingWindowDays]
    );

    const history: Array<{ date: string; units_sold: number }> = historyRes.rows;
    const now = new Date();
    const dataFreshness = history.length > 0 ? history[0].date : now.toISOString();

    // 2. Compute 7-day Moving Average
    let averageDailyDemand = 5.0; // default conservative fallback if no history
    if (history.length > 0) {
      const sum = history.reduce((acc, row) => acc + Number(row.units_sold), 0);
      averageDailyDemand = Number((sum / history.length).toFixed(2));
    }

    const predictedUnits = Number((averageDailyDemand * horizonDays).toFixed(2));
    const stdDev = Math.max(1, averageDailyDemand * 0.2); // 20% variance estimate

    const forecastDate = new Date(now.getTime() + horizonDays * 86400000)
      .toISOString()
      .split('T')[0];

    const result: ForecastResult = {
      sku,
      forecastDate,
      predictedDemandUnits: predictedUnits,
      confidenceInterval: {
        lower: Math.max(0, Number((predictedUnits - 1.96 * stdDev).toFixed(2))),
        upper: Number((predictedUnits + 1.96 * stdDev).toFixed(2)),
      },
      metadata: {
        modelVersion: ForecasterService.MODEL_VERSION,
        trainingWindowDays,
        dataFreshness: new Date(dataFreshness).toISOString(),
        authoritativeSource: 'PostgreSQL inventory-service (stock_balances)',
        advisoryOnly: true,
      },
    };

    // Store prediction in database
    await Database.query(
      `INSERT INTO forecast_predictions (
        id, sku, forecast_date, predicted_demand_units,
        confidence_interval_lower, confidence_interval_upper,
        model_version, training_window_days, data_freshness_timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (sku, forecast_date, model_version)
      DO UPDATE SET
        predicted_demand_units = EXCLUDED.predicted_demand_units,
        data_freshness_timestamp = EXCLUDED.data_freshness_timestamp`,
      [
        crypto.randomUUID(),
        sku,
        forecastDate,
        result.predictedDemandUnits,
        result.confidenceInterval.lower,
        result.confidenceInterval.upper,
        result.metadata.modelVersion,
        trainingWindowDays,
        result.metadata.dataFreshness,
      ]
    );

    logger.info('Generated demand forecast', {
      sku,
      predictedDemandUnits: result.predictedDemandUnits,
      modelVersion: ForecasterService.MODEL_VERSION,
    });

    return result;
  }

  /**
   * Acceptance Scenario 15: Calculates stockout risk based on live authoritative stock
   * and supplier lead time.
   */
  public async assessStockoutRisk(params: {
    sku: string;
    currentAuthoritativeStock: number;
    supplierLeadTimeDays: number;
    safetyStockDays?: number;
  }): Promise<StockoutRiskAssessment> {
    const safetyDays = params.safetyStockDays ?? 3;

    // 1. Fetch 7-day average daily sales
    const res = await Database.query(
      `SELECT AVG(units_sold) as avg_sales, MAX(date) as latest_date
       FROM daily_sku_demand
       WHERE sku = $1 AND date >= CURRENT_DATE - INTERVAL '14 days'`,
      [params.sku]
    );

    const dailyBurnRate = Number(res.rows[0]?.avg_sales || 10.0);
    const dataFreshness = res.rows[0]?.latest_date || new Date().toISOString();

    // 2. Days of supply calculation
    const daysOfSupply =
      dailyBurnRate > 0
        ? Number((params.currentAuthoritativeStock / dailyBurnRate).toFixed(2))
        : 999;

    // 3. Risk Level Determination
    let riskLevel: 'LOW' | 'MEDIUM' | 'CRITICAL' = 'LOW';
    let recommendedReorderUnits = 0;

    if (daysOfSupply <= params.supplierLeadTimeDays) {
      riskLevel = 'CRITICAL';
      const targetDays = params.supplierLeadTimeDays + safetyDays;
      const deficitDays = targetDays - daysOfSupply;
      recommendedReorderUnits = Math.ceil(deficitDays * dailyBurnRate);
    } else if (daysOfSupply <= params.supplierLeadTimeDays * 1.5) {
      riskLevel = 'MEDIUM';
      recommendedReorderUnits = Math.ceil(safetyDays * dailyBurnRate);
    }

    const assessment: StockoutRiskAssessment = {
      sku: params.sku,
      currentAuthoritativeStock: params.currentAuthoritativeStock,
      dailyBurnRate,
      daysOfSupply,
      supplierLeadTimeDays: params.supplierLeadTimeDays,
      riskLevel,
      recommendedReorderUnits,
      metadata: {
        modelVersion: ForecasterService.MODEL_VERSION,
        dataFreshness: new Date(dataFreshness).toISOString(),
        advisoryOnly: true,
      },
    };

    if (riskLevel === 'CRITICAL' || riskLevel === 'MEDIUM') {
      await Database.query(
        `INSERT INTO stockout_risk_alerts (
          id, sku, current_authoritative_stock, daily_burn_rate,
          days_of_supply, supplier_lead_time_days, risk_level,
          recommended_reorder_units, model_version, data_freshness_timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          crypto.randomUUID(),
          params.sku,
          params.currentAuthoritativeStock,
          dailyBurnRate,
          daysOfSupply,
          params.supplierLeadTimeDays,
          riskLevel,
          recommendedReorderUnits,
          ForecasterService.MODEL_VERSION,
          assessment.metadata.dataFreshness,
        ]
      );

      logger.warn('Stockout risk alert triggered', {
        sku: params.sku,
        riskLevel,
        daysOfSupply,
        recommendedReorderUnits,
      });
    }

    return assessment;
  }
}
