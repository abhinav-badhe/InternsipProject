import { Database } from './db.js';
import crypto from 'node:crypto';
import { createLogger } from '@grocery/observability';
import { MLEngine, TimeSeriesPoint, TrainingResult, CandidateModelComparison } from './ml-engine.js';

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

export interface StorewideForecastItem {
  sku: string;
  productId: string;
  productName: string;
  variantName: string;
  category: string;
  currentStock: number;
  dailyVelocity: number;
  forecastHorizonDays: number;
  forecastDemandUnits: number;
  confidenceInterval: {
    lower: number;
    upper: number;
  };
  daysOfSupply: number;
  supplierLeadTimeDays: number;
  riskLevel: 'NORMAL' | 'LOW_STOCK' | 'CRITICAL_RISK' | 'STOCKOUT';
  recommendedReorderUnits: number;
  modelVersion: string;
  modelName: string;
  updatedAt: string;
}

export class ForecasterService {
  public static readonly MODEL_VERSION = 'v1.0.0-baseline-ma7';

  /**
   * Trains multiple ML models, evaluates on validation data, and selects the best suitable model.
   */
  public async trainAndSelectBestModel(): Promise<TrainingResult> {
    logger.info('Initiating ML Model training across historical demand series...');

    // 1. Fetch historical demand from daily_sku_demand for all SKUs
    const historyRes = await Database.query(`
      SELECT sku, date, units_sold
      FROM daily_sku_demand
      ORDER BY sku, date ASC
    `);

    const seriesMap = new Map<string, TimeSeriesPoint[]>();
    for (const row of historyRes.rows) {
      const sku = row.sku;
      if (!seriesMap.has(sku)) {
        seriesMap.set(sku, []);
      }
      seriesMap.get(sku)!.push({
        date: new Date(row.date).toISOString().split('T')[0],
        unitsSold: Number(row.units_sold),
      });
    }

    // 2. Run AutoML tournament
    const trainingResult = MLEngine.trainAndSelectBest(seriesMap);

    logger.info('ML Model successfully trained & selected', {
      selectedModel: trainingResult.selectedModelId,
      mape: trainingResult.bestMetrics.mape,
      accuracy: trainingResult.bestMetrics.accuracy,
    });

    return trainingResult;
  }

  /**
   * Returns current active model training status and candidate model metrics.
   */
  public getModelInfo(): TrainingResult | null {
    return MLEngine.getTrainedResult();
  }

  /**
   * Generates demand forecasts and reorder risk assessments across all catalog items
   * using the trained best ML model and live stock from PostgreSQL stock_balances.
   */
  public async generateStorewideForecasts(horizonDays = 7): Promise<{
    items: StorewideForecastItem[];
    modelInfo: TrainingResult | null;
    summary: {
      totalSkus: number;
      criticalCount: number;
      stockoutCount: number;
      lowStockCount: number;
      normalCount: number;
    };
  }> {
    // Ensure we have a trained model
    let modelInfo = MLEngine.getTrainedResult();
    if (!modelInfo) {
      modelInfo = await this.trainAndSelectBestModel();
    }

    // 1. Fetch all product variants with product names, category names, and authoritative stock
    const variantsRes = await Database.query(`
      SELECT 
        v.sku,
        v.product_id,
        v.variant_name,
        p.name as product_name,
        COALESCE(c.name, 'Grocery Essentials') as category_name,
        COALESCE(sb.on_hand_qty, 0) as on_hand_qty,
        COALESCE(sb.reserved_qty, 0) as reserved_qty
      FROM product_variants v
      JOIN products p ON v.product_id = p.id
      LEFT JOIN categories c ON p.primary_category_id = c.id
      LEFT JOIN stock_balances sb ON v.sku = sb.sku
      ORDER BY p.name ASC, v.sku ASC
    `);

    // 2. Fetch recent demand history for all SKUs
    const demandRes = await Database.query(`
      SELECT sku, date, units_sold
      FROM daily_sku_demand
      ORDER BY sku, date ASC
    `);

    const demandBySku = new Map<string, TimeSeriesPoint[]>();
    for (const row of demandRes.rows) {
      if (!demandBySku.has(row.sku)) {
        demandBySku.set(row.sku, []);
      }
      demandBySku.get(row.sku)!.push({
        date: new Date(row.date).toISOString().split('T')[0],
        unitsSold: Number(row.units_sold),
      });
    }

    const items: StorewideForecastItem[] = [];
    let criticalCount = 0;
    let stockoutCount = 0;
    let lowStockCount = 0;
    let normalCount = 0;

    const now = new Date();
    const forecastDate = new Date(now.getTime() + horizonDays * 86400000).toISOString().split('T')[0];

    // Persist predictions and risk alerts in batch to avoid 200+ individual roundtrips
    const forecastInserts: any[] = [];
    const alertInserts: any[] = [];

    for (const v of variantsRes.rows) {
      const sku = v.sku;
      const history = demandBySku.get(sku) || [];

      // Run ML prediction
      const mlForecast = MLEngine.forecastSku(history, horizonDays);

      const currentStock = Math.max(0, Number(v.on_hand_qty) - Number(v.reserved_qty));
      const dailyVelocity = mlForecast.dailyAverage || 4.0;

      // Supplier lead time heuristic (Staples: 3 days, Dairy/Bakery: 2 days, Personal/Household: 5-7 days)
      let supplierLeadTimeDays = 5;
      const catLower = (v.category_name || '').toLowerCase();
      if (catLower.includes('dairy') || catLower.includes('bread') || catLower.includes('egg')) {
        supplierLeadTimeDays = 2;
      } else if (catLower.includes('salt') || catLower.includes('sugar') || catLower.includes('atta') || catLower.includes('flour')) {
        supplierLeadTimeDays = 3;
      } else if (catLower.includes('soap') || catLower.includes('shampoo') || catLower.includes('toothpaste') || catLower.includes('detergent')) {
        supplierLeadTimeDays = 6;
      }

      const daysOfSupply = dailyVelocity > 0 ? Number((currentStock / dailyVelocity).toFixed(1)) : 999;

      let riskLevel: 'NORMAL' | 'LOW_STOCK' | 'CRITICAL_RISK' | 'STOCKOUT' = 'NORMAL';
      let recommendedReorderUnits = 0;

      if (currentStock === 0) {
        riskLevel = 'STOCKOUT';
        stockoutCount++;
        recommendedReorderUnits = Math.ceil((supplierLeadTimeDays + 3) * dailyVelocity);
      } else if (daysOfSupply <= supplierLeadTimeDays) {
        riskLevel = 'CRITICAL_RISK';
        criticalCount++;
        const targetDays = supplierLeadTimeDays + 3; // 3 days safety stock
        const deficitDays = Math.max(0, targetDays - daysOfSupply);
        recommendedReorderUnits = Math.ceil(deficitDays * dailyVelocity);
      } else if (daysOfSupply <= supplierLeadTimeDays * 1.5) {
        riskLevel = 'LOW_STOCK';
        lowStockCount++;
        recommendedReorderUnits = Math.ceil(3 * dailyVelocity); // Reorder safety buffer
      } else {
        riskLevel = 'NORMAL';
        normalCount++;
      }

      forecastInserts.push({
        id: crypto.randomUUID(),
        sku,
        forecastDate,
        predictedUnitsTotal: mlForecast.predictedUnitsTotal,
        lower: mlForecast.confidenceInterval.lower,
        upper: mlForecast.confidenceInterval.upper,
        modelVersion: mlForecast.modelVersion,
        trainingWindowDays: 60,
      });

      if (riskLevel === 'CRITICAL_RISK' || riskLevel === 'STOCKOUT') {
        alertInserts.push({
          id: crypto.randomUUID(),
          sku,
          currentStock,
          dailyVelocity,
          daysOfSupply,
          supplierLeadTimeDays,
          riskLevel: 'CRITICAL',
          recommendedReorderUnits,
          modelVersion: mlForecast.modelVersion,
        });
      }

      items.push({
        sku,
        productId: v.product_id,
        productName: v.product_name,
        variantName: v.variant_name || '',
        category: v.category_name,
        currentStock,
        dailyVelocity,
        forecastHorizonDays: horizonDays,
        forecastDemandUnits: mlForecast.predictedUnitsTotal,
        confidenceInterval: mlForecast.confidenceInterval,
        daysOfSupply,
        supplierLeadTimeDays,
        riskLevel,
        recommendedReorderUnits,
        modelVersion: mlForecast.modelVersion,
        modelName: modelInfo.selectedModelName,
        updatedAt: now.toISOString(),
      });
    }

    // Fast batch DB insertion in background or Promise.all chunk
    try {
      if (forecastInserts.length > 0) {
        const CHUNK_SIZE = 50;
        for (let i = 0; i < forecastInserts.length; i += CHUNK_SIZE) {
          const chunk = forecastInserts.slice(i, i + CHUNK_SIZE);
          const valStrings: string[] = [];
          const params: any[] = [];
          let pIdx = 1;
          for (const r of chunk) {
            valStrings.push(`($${pIdx}, $${pIdx+1}, $${pIdx+2}, $${pIdx+3}, $${pIdx+4}, $${pIdx+5}, $${pIdx+6}, $${pIdx+7}, NOW())`);
            params.push(r.id, r.sku, r.forecastDate, r.predictedUnitsTotal, r.lower, r.upper, r.modelVersion, r.trainingWindowDays);
            pIdx += 8;
          }
          await Database.query(`
            INSERT INTO forecast_predictions (
              id, sku, forecast_date, predicted_demand_units,
              confidence_interval_lower, confidence_interval_upper,
              model_version, training_window_days, data_freshness_timestamp
            ) VALUES ${valStrings.join(', ')}
            ON CONFLICT (sku, forecast_date, model_version)
            DO UPDATE SET
              predicted_demand_units = EXCLUDED.predicted_demand_units,
              confidence_interval_lower = EXCLUDED.confidence_interval_lower,
              confidence_interval_upper = EXCLUDED.confidence_interval_upper,
              data_freshness_timestamp = EXCLUDED.data_freshness_timestamp
          `, params);
        }
      }

      if (alertInserts.length > 0) {
        const valStrings: string[] = [];
        const params: any[] = [];
        let pIdx = 1;
        for (const a of alertInserts) {
          valStrings.push(`($${pIdx}, $${pIdx+1}, $${pIdx+2}, $${pIdx+3}, $${pIdx+4}, $${pIdx+5}, $${pIdx+6}, $${pIdx+7}, $${pIdx+8}, NOW())`);
          params.push(a.id, a.sku, a.currentStock, a.dailyVelocity, a.daysOfSupply, a.supplierLeadTimeDays, a.riskLevel, a.recommendedReorderUnits, a.modelVersion);
          pIdx += 9;
        }
        await Database.query(`
          INSERT INTO stockout_risk_alerts (
            id, sku, current_authoritative_stock, daily_burn_rate,
            days_of_supply, supplier_lead_time_days, risk_level,
            recommended_reorder_units, model_version, data_freshness_timestamp
          ) VALUES ${valStrings.join(', ')}
        `, params);
      }
    } catch (err: any) {
      logger.debug('Batch write error for forecasts/alerts', { error: err.message });
    }

    return {
      items,
      modelInfo,
      summary: {
        totalSkus: items.length,
        criticalCount,
        stockoutCount,
        lowStockCount,
        normalCount,
      },
    };
  }

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

    // 2. Compute 7-day Moving Average (preserving Scenario 15 expectations)
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
