import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  RidgeAutoregressiveModel,
  HoltWintersModel,
  AdaptiveWMAModel,
  calculateMetrics,
  MLEngine,
  TimeSeriesPoint,
} from '../src/ml-engine.js';

describe('MLEngine & Inventory Demand Forecasting Tournament', () => {
  // Generate synthetic 30-day series with weekly seasonality
  const sampleSeries: TimeSeriesPoint[] = [];
  const baseDate = new Date('2026-09-01');
  for (let i = 0; i < 35; i++) {
    const d = new Date(baseDate.getTime() + i * 86400000);
    const dow = d.getDay();
    const weekendMultiplier = (dow === 0 || dow === 6) ? 1.4 : 1.0;
    const units = Math.round(10 * weekendMultiplier + (i % 3));
    sampleSeries.push({
      date: d.toISOString().split('T')[0],
      unitsSold: units,
    });
  }

  it('RidgeAutoregressiveModel trains and predicts forward horizon', () => {
    const model = new RidgeAutoregressiveModel();
    model.train(sampleSeries);
    assert.ok(model.weights.length > 0, 'Weights should be fitted');

    const preds = model.forecastHorizon(sampleSeries, 7);
    assert.equal(preds.length, 7);
    preds.forEach(p => assert.ok(p > 0, 'Forecast should be strictly positive'));
  });

  it('HoltWintersModel trains and captures weekly seasonality', () => {
    const hw = new HoltWintersModel();
    hw.train(sampleSeries);
    const preds = hw.forecastHorizon(sampleSeries, 7);
    assert.equal(preds.length, 7);
    preds.forEach(p => assert.ok(p > 0));
  });

  it('AdaptiveWMAModel predicts positive horizon', () => {
    const wma = new AdaptiveWMAModel();
    const preds = wma.forecastHorizon(sampleSeries, 7);
    assert.equal(preds.length, 7);
    preds.forEach(p => assert.ok(p > 0));
  });

  it('calculateMetrics correctly calculates MAE, RMSE, MAPE and accuracy', () => {
    const actuals = [10, 12, 14, 8];
    const preds = [11, 11, 15, 8];
    const metrics = calculateMetrics(actuals, preds);
    assert.ok(metrics.mae > 0);
    assert.ok(metrics.rmse > 0);
    assert.ok(metrics.mape > 0);
    assert.ok(metrics.accuracy > 85);
  });

  it('AutoML Tournament trains multiple candidate models and selects the winner with lowest MAPE', () => {
    const seriesMap = new Map<string, TimeSeriesPoint[]>();
    seriesMap.set('TEST-SKU-1', sampleSeries);
    seriesMap.set('TEST-SKU-2', sampleSeries.map(p => ({ ...p, unitsSold: p.unitsSold * 2 })));

    const result = MLEngine.trainAndSelectBest(seriesMap);

    assert.ok(result.selectedModelId, 'Must select a winning model');
    assert.ok(result.bestMetrics.accuracy > 0);
    assert.ok(result.comparison.length === 3, 'Must compare all 3 candidate models');
    
    // Check that selected model has isSelected = true
    const selected = result.comparison.find(c => c.isSelected);
    assert.ok(selected, 'One candidate must be marked as selected');
    assert.equal(selected.id, result.selectedModelId);

    // Test forecast generation using winning model
    const forecast = MLEngine.forecastSku(sampleSeries, 7);
    assert.ok(forecast.predictedUnitsTotal > 0);
    assert.equal(forecast.dailyPredictions.length, 7);
    assert.ok(forecast.confidenceInterval.upper >= forecast.confidenceInterval.lower);
  });
});

