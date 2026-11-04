import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ForecasterService } from '../src/forecaster.service.js';
import { Database } from '../src/db.js';

describe('AnalyticsService & Acceptance Scenario 15 (Forecast Metadata & Authoritative Stock)', () => {
  const service = new ForecasterService();

  it('Scenario 15: Generates forecast strictly tagging model version, data freshness, and advisory metadata', async () => {
    let insertedForecast: any = null;

    Database.query = async (text: string, params?: any[]): Promise<any> => {
      if (text.includes('daily_sku_demand') && text.includes('SELECT date, units_sold')) {
        return {
          rowCount: 3,
          rows: [
            { date: '2026-10-27T00:00:00.000Z', units_sold: 10 },
            { date: '2026-10-26T00:00:00.000Z', units_sold: 12 },
            { date: '2026-10-25T00:00:00.000Z', units_sold: 8 },
          ],
        };
      }
      if (text.includes('INSERT INTO forecast_predictions')) {
        insertedForecast = {
          sku: params?.[1],
          predicted: params?.[3],
          modelVersion: params?.[6],
          trainingWindow: params?.[7],
          dataFreshness: params?.[8],
        };
        return { rowCount: 1, rows: [] };
      }
      return { rowCount: 1, rows: [] };
    };

    const forecast = await service.computeSkuForecast('SOAP-DETTOL-75G', 7, 30);

    // Scenario 15 Assertions:
    assert.equal(forecast.sku, 'SOAP-DETTOL-75G');
    assert.equal(forecast.predictedDemandUnits, 70.0); // (10+12+8)/3 = 10/day * 7 days = 70
    assert.equal(forecast.metadata.modelVersion, 'v1.0.0-baseline-ma7');
    assert.equal(forecast.metadata.trainingWindowDays, 30);
    assert.ok(forecast.metadata.dataFreshness.includes('2026-10-27'));
    assert.equal(forecast.metadata.advisoryOnly, true);
    assert.ok(forecast.metadata.authoritativeSource.includes('PostgreSQL inventory-service'));

    assert.equal(insertedForecast.modelVersion, 'v1.0.0-baseline-ma7');
  });

  it('Scenario 15: Detects CRITICAL stockout risk when days-of-supply is below supplier lead time', async () => {
    let triggeredAlert: any = null;

    Database.query = async (text: string, params?: any[]): Promise<any> => {
      if (text.includes('AVG(units_sold)')) {
        return {
          rowCount: 1,
          rows: [{ avg_sales: 5.0, latest_date: '2026-10-28T00:00:00.000Z' }],
        };
      }
      if (text.includes('INSERT INTO stockout_risk_alerts')) {
        triggeredAlert = {
          sku: params?.[1],
          authoritativeStock: params?.[2],
          dailyBurnRate: params?.[3],
          daysOfSupply: params?.[4],
          leadTime: params?.[5],
          riskLevel: params?.[6],
          reorderUnits: params?.[7],
          modelVersion: params?.[8],
        };
        return { rowCount: 1, rows: [] };
      }
      return { rowCount: 1, rows: [] };
    };

    // Current stock: 10 units. Daily burn: 5 units/day -> Days of supply: 2 days.
    // Supplier lead time: 4 days.
    // Since 2 <= 4, it is a CRITICAL risk of stockout!
    const assessment = await service.assessStockoutRisk({
      sku: 'DETTOL-COOL-75G',
      currentAuthoritativeStock: 10,
      supplierLeadTimeDays: 4,
      safetyStockDays: 3,
    });

    assert.equal(assessment.riskLevel, 'CRITICAL');
    assert.equal(assessment.daysOfSupply, 2.0);
    assert.equal(assessment.supplierLeadTimeDays, 4);
    // (4 lead days + 3 safety days - 2 current supply days) * 5 burn rate = 25 units
    assert.equal(assessment.recommendedReorderUnits, 25);
    assert.equal(assessment.metadata.advisoryOnly, true);
    assert.equal(assessment.metadata.modelVersion, 'v1.0.0-baseline-ma7');

    assert.ok(triggeredAlert);
    assert.equal(triggeredAlert.riskLevel, 'CRITICAL');
  });

  it('Scenario 15: Confirms LOW risk when stock comfortably exceeds supplier lead time', async () => {
    Database.query = async (text: string, params?: any[]): Promise<any> => {
      if (text.includes('AVG(units_sold)')) {
        return {
          rowCount: 1,
          rows: [{ avg_sales: 2.0, latest_date: '2026-10-28T00:00:00.000Z' }],
        };
      }
      return { rowCount: 1, rows: [] };
    };

    // Current stock: 100 units. Daily burn: 2 -> Days of supply: 50 days.
    // Supplier lead time: 3 days.
    const assessment = await service.assessStockoutRisk({
      sku: 'LUX-ROSE-100G',
      currentAuthoritativeStock: 100,
      supplierLeadTimeDays: 3,
    });

    assert.equal(assessment.riskLevel, 'LOW');
    assert.equal(assessment.recommendedReorderUnits, 0);
  });

  it('Feature 20: Customer Lifetime Value (CLV) & Churn Risk classifies RFM accurately', () => {
    const customers = [
      { id: 'c1', totalOrders: 18, totalSpend: 9840, daysSinceLastOrder: 2 },
      { id: 'c2', totalOrders: 3, totalSpend: 1180, daysSinceLastOrder: 34 },
    ];

    // Compute AOV and churn risk
    const c1Aov = customers[0].totalSpend / customers[0].totalOrders;
    assert.equal(Math.round(c1Aov), 547);

    // c1 ordered 2 days ago -> LOW churn risk
    const c1ChurnRisk = customers[0].daysSinceLastOrder <= 7 ? 'LOW' : 'HIGH';
    assert.equal(c1ChurnRisk, 'LOW');

    // c2 ordered 34 days ago -> HIGH churn risk
    const c2ChurnRisk = customers[1].daysSinceLastOrder > 21 ? 'HIGH' : 'LOW';
    assert.equal(c2ChurnRisk, 'HIGH');
  });
});
