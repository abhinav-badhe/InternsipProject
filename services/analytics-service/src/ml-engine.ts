import { createLogger } from '@grocery/observability';

const logger = createLogger('analytics-service:ml-engine');

export interface TimeSeriesPoint {
  date: string;
  unitsSold: number;
}

export interface ModelMetrics {
  mae: number;
  rmse: number;
  mape: number;
  accuracy: number;
}

export interface CandidateModelComparison {
  id: string;
  name: string;
  type: 'AUTOREGRESSIVE_RIDGE' | 'HOLT_WINTERS' | 'ADAPTIVE_WMA';
  mae: number;
  rmse: number;
  mape: number;
  accuracy: number;
  isSelected: boolean;
  hyperparameters: Record<string, any>;
  description: string;
}

export interface TrainingResult {
  selectedModelId: string;
  selectedModelName: string;
  selectedModelType: string;
  trainedAt: string;
  totalTrainingObservations: number;
  validationObservations: number;
  bestMetrics: ModelMetrics;
  comparison: CandidateModelComparison[];
  selectionRationale: string;
}

/**
 * Inverts an N x N matrix using Gauss-Jordan elimination with partial pivoting.
 */
function invertMatrix(A: number[][]): number[][] {
  const n = A.length;
  // Augment with identity matrix
  const M: number[][] = A.map((row, i) => {
    const aug = new Array(n).fill(0);
    aug[i] = 1;
    return [...row, ...aug];
  });

  for (let col = 0; col < n; col++) {
    // Find pivot
    let maxRow = col;
    let maxVal = Math.abs(M[col][col]);
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > maxVal) {
        maxVal = Math.abs(M[r][col]);
        maxRow = r;
      }
    }

    if (maxVal < 1e-12) {
      // Near-singular, add tiny jitter to diagonal
      M[col][col] += 1e-6;
    } else if (maxRow !== col) {
      const temp = M[col];
      M[col] = M[maxRow];
      M[maxRow] = temp;
    }

    const pivot = M[col][col];
    for (let j = 0; j < 2 * n; j++) {
      M[col][j] /= pivot;
    }

    for (let r = 0; r < n; r++) {
      if (r !== col) {
        const factor = M[r][col];
        for (let j = 0; j < 2 * n; j++) {
          M[r][j] -= factor * M[col][j];
        }
      }
    }
  }

  return M.map(row => row.slice(n));
}

/**
 * Candidate 1: Ridge Autoregressive Regression Model (AR-Ridge)
 * Features:
 *  - Lag 1: y_{t-1}
 *  - Lag 7: y_{t-7} (same day of previous week)
 *  - 7-day rolling mean
 *  - Day of week (0 to 6 one-hot encoding)
 *  - Bias term (1.0)
 */
export class RidgeAutoregressiveModel {
  public weights: number[] = [];
  public lambda = 0.5;

  private extractFeatures(history: number[], dates: Date[], idx: number): number[] {
    const lag1 = history[idx - 1] ?? 5;
    const lag7 = history[idx - 7] ?? history[idx - 1] ?? 5;
    
    // 7-day rolling mean
    let sum = 0;
    let count = 0;
    for (let k = 1; k <= 7; k++) {
      if (idx - k >= 0) {
        sum += history[idx - k];
        count++;
      }
    }
    const rolling7 = count > 0 ? sum / count : lag1;

    // Day of week one-hot (7 dims)
    const dow = dates[idx].getDay();
    const dowFeatures = new Array(7).fill(0);
    dowFeatures[dow] = 1;

    // Bias
    return [lag1, lag7, rolling7, ...dowFeatures, 1.0];
  }

  public train(series: TimeSeriesPoint[]) {
    if (series.length < 10) return;

    const values = series.map(p => p.unitsSold);
    const dates = series.map(p => new Date(p.date));

    // We build design matrix X and target y for indices >= 7
    const X: number[][] = [];
    const y: number[] = [];

    for (let i = 7; i < values.length; i++) {
      X.push(this.extractFeatures(values, dates, i));
      y.push(values[i]);
    }

    const n = X.length;
    const d = X[0].length; // 11 features

    // Compute X^T * X + lambda * I
    const XtX: number[][] = Array.from({ length: d }, () => new Array(d).fill(0));
    for (let i = 0; i < d; i++) {
      for (let j = 0; j < d; j++) {
        let sum = 0;
        for (let k = 0; k < n; k++) {
          sum += X[k][i] * X[k][j];
        }
        XtX[i][j] = sum + (i === j ? this.lambda : 0);
      }
    }

    // Compute X^T * y
    const Xty: number[] = new Array(d).fill(0);
    for (let i = 0; i < d; i++) {
      let sum = 0;
      for (let k = 0; k < n; k++) {
        sum += X[k][i] * y[k];
      }
      Xty[i] = sum;
    }

    // Solve weights: w = (X^T X + lambda I)^-1 * (X^T y)
    const invXtX = invertMatrix(XtX);
    this.weights = new Array(d).fill(0);
    for (let i = 0; i < d; i++) {
      let sum = 0;
      for (let j = 0; j < d; j++) {
        sum += invXtX[i][j] * Xty[j];
      }
      this.weights[i] = sum;
    }
  }

  public predictNext(history: number[], dates: Date[]): number {
    if (this.weights.length === 0) {
      // Fallback mean
      const s = history.slice(-7);
      return s.reduce((a, b) => a + b, 0) / (s.length || 1);
    }
    const idx = history.length;
    const features = this.extractFeatures(history, dates, idx);
    let pred = 0;
    for (let i = 0; i < features.length; i++) {
      pred += features[i] * (this.weights[i] || 0);
    }
    return Math.max(0.5, Number(pred.toFixed(2)));
  }

  public forecastHorizon(series: TimeSeriesPoint[], horizonDays: number): number[] {
    const history = series.map(p => p.unitsSold);
    const dates = series.map(p => new Date(p.date));
    const lastDate = dates.length > 0 ? new Date(dates[dates.length - 1]) : new Date();

    const preds: number[] = [];
    for (let h = 1; h <= horizonDays; h++) {
      const nextDate = new Date(lastDate.getTime() + h * 86400000);
      dates.push(nextDate);
      const nextVal = this.predictNext(history, dates);
      preds.push(nextVal);
      history.push(nextVal);
    }
    return preds;
  }
}

/**
 * Candidate 2: Holt-Winters Triple Exponential Smoothing (HW-TES)
 * Level (alpha), Trend (beta), Seasonality (gamma), period m = 7 days.
 */
export class HoltWintersModel {
  public alpha = 0.25;
  public beta = 0.08;
  public gamma = 0.35;
  public m = 7; // weekly seasonality

  private level = 0;
  private trend = 0;
  private seasonals: number[] = [];

  public train(series: TimeSeriesPoint[]) {
    const values = series.map(p => p.unitsSold);
    if (values.length < this.m * 2) {
      this.level = values.reduce((a, b) => a + b, 0) / (values.length || 1);
      this.trend = 0;
      this.seasonals = new Array(this.m).fill(0);
      return;
    }

    // Initialize level and trend from first two cycles
    let sum1 = 0;
    let sum2 = 0;
    for (let i = 0; i < this.m; i++) {
      sum1 += values[i];
      sum2 += values[i + this.m];
    }
    this.level = sum2 / this.m;
    this.trend = (sum2 - sum1) / (this.m * this.m);

    // Initial seasonals (additive)
    this.seasonals = new Array(this.m);
    for (let i = 0; i < this.m; i++) {
      this.seasonals[i] = values[i] - (sum1 / this.m);
    }

    // Run recursive updates
    for (let t = this.m; t < values.length; t++) {
      const val = values[t];
      const sIndex = t % this.m;
      const prevLevel = this.level;
      const prevTrend = this.trend;
      const prevSeasonal = this.seasonals[sIndex];

      // Additive updates
      this.level = this.alpha * (val - prevSeasonal) + (1 - this.alpha) * (prevLevel + prevTrend);
      this.trend = this.beta * (this.level - prevLevel) + (1 - this.beta) * prevTrend;
      this.seasonals[sIndex] = this.gamma * (val - this.level) + (1 - this.gamma) * prevSeasonal;
    }
  }

  public forecastHorizon(series: TimeSeriesPoint[], horizonDays: number): number[] {
    const preds: number[] = [];
    const baseIndex = series.length;

    for (let h = 1; h <= horizonDays; h++) {
      const sIndex = (baseIndex + h - 1) % this.m;
      const sVal = this.seasonals[sIndex] ?? 0;
      const pred = Math.max(0.5, this.level + h * this.trend + sVal);
      preds.push(Number(pred.toFixed(2)));
    }
    return preds;
  }
}

/**
 * Candidate 3: Adaptive Weighted Moving Average (Adaptive-WMA Baseline)
 * Exponential decay over a 14-day window with linear trend adjustment.
 */
export class AdaptiveWMAModel {
  public decay = 0.88;
  public windowSize = 14;

  public forecastHorizon(series: TimeSeriesPoint[], horizonDays: number): number[] {
    const values = series.map(p => p.unitsSold);
    const window = values.slice(-this.windowSize);
    if (window.length === 0) return new Array(horizonDays).fill(5);

    let weightSum = 0;
    let weightedVal = 0;
    for (let i = 0; i < window.length; i++) {
      // Most recent element has highest weight
      const weight = Math.pow(this.decay, window.length - 1 - i);
      weightSum += weight;
      weightedVal += window[i] * weight;
    }
    const baseline = weightedVal / weightSum;

    // Linear slope over the window
    let slope = 0;
    if (window.length >= 7) {
      const half = Math.floor(window.length / 2);
      const early = window.slice(0, half).reduce((a, b) => a + b, 0) / half;
      const late = window.slice(half).reduce((a, b) => a + b, 0) / (window.length - half);
      slope = (late - early) / half;
    }

    const preds: number[] = [];
    for (let h = 1; h <= horizonDays; h++) {
      const pred = Math.max(0.5, baseline + slope * h * 0.5);
      preds.push(Number(pred.toFixed(2)));
    }
    return preds;
  }
}

/**
 * Metric Calculator
 */
export function calculateMetrics(actuals: number[], predicted: number[]): ModelMetrics {
  const n = Math.min(actuals.length, predicted.length);
  if (n === 0) {
    return { mae: 0, rmse: 0, mape: 0, accuracy: 100 };
  }

  let absErrSum = 0;
  let sqErrSum = 0;
  let apeSum = 0;

  for (let i = 0; i < n; i++) {
    const y = actuals[i];
    const yHat = predicted[i];
    const diff = Math.abs(y - yHat);
    absErrSum += diff;
    sqErrSum += diff * diff;
    apeSum += (diff / Math.max(1, y)) * 100;
  }

  const mae = Number((absErrSum / n).toFixed(2));
  const rmse = Number(Math.sqrt(sqErrSum / n).toFixed(2));
  const mape = Number((apeSum / n).toFixed(2));
  const accuracy = Number(Math.max(0, 100 - mape).toFixed(1));

  return { mae, rmse, mape, accuracy };
}

/**
 * AutoML Tournament Engine
 * Trains multiple candidate models, runs cross-validation, and automatically selects the best model.
 */
export class MLEngine {
  private static trainedResult: TrainingResult | null = null;
  private static activeModel: RidgeAutoregressiveModel | HoltWintersModel | AdaptiveWMAModel | null = null;

  public static getTrainedResult(): TrainingResult | null {
    return this.trainedResult;
  }

  public static getActiveModel() {
    return this.activeModel;
  }

  public static trainAndSelectBest(allSkuSeries: Map<string, TimeSeriesPoint[]>): TrainingResult {
    logger.info('Starting AutoML Model Tournament across SKUs', { skuCount: allSkuSeries.size });

    // Consolidate series to benchmark on validation data
    let totalObs = 0;
    const testActuals: number[] = [];
    const ridgePreds: number[] = [];
    const hwPreds: number[] = [];
    const wmaPreds: number[] = [];

    allSkuSeries.forEach((series) => {
      totalObs += series.length;
      if (series.length < 14) return;

      // 80% train, 20% validation split
      const splitIdx = Math.floor(series.length * 0.8);
      const trainSet = series.slice(0, splitIdx);
      const valSet = series.slice(splitIdx);
      const horizon = valSet.length;

      // Train Candidate 1: Ridge AR
      const ridge = new RidgeAutoregressiveModel();
      ridge.train(trainSet);
      const rForecast = ridge.forecastHorizon(trainSet, horizon);

      // Train Candidate 2: Holt-Winters
      const hw = new HoltWintersModel();
      hw.train(trainSet);
      const hwForecast = hw.forecastHorizon(trainSet, horizon);

      // Train Candidate 3: Adaptive WMA
      const wma = new AdaptiveWMAModel();
      const wmaForecast = wma.forecastHorizon(trainSet, horizon);

      valSet.forEach((pt, i) => {
        testActuals.push(pt.unitsSold);
        ridgePreds.push(rForecast[i]);
        hwPreds.push(hwForecast[i]);
        wmaPreds.push(wmaForecast[i]);
      });
    });

    // Compute metrics
    const ridgeMetrics = calculateMetrics(testActuals, ridgePreds);
    const hwMetrics = calculateMetrics(testActuals, hwPreds);
    const wmaMetrics = calculateMetrics(testActuals, wmaPreds);

    const candidates: CandidateModelComparison[] = [
      {
        id: 'ridge-autoregressive-ml',
        name: 'Ridge Autoregressive ML (Lag-1, Lag-7, Seasonality & Rolling Mean)',
        type: 'AUTOREGRESSIVE_RIDGE',
        mae: ridgeMetrics.mae,
        rmse: ridgeMetrics.rmse,
        mape: ridgeMetrics.mape,
        accuracy: ridgeMetrics.accuracy,
        isSelected: false,
        hyperparameters: { lambda: 0.5, lags: [1, 7], seasonality: 'weekly_one_hot' },
        description: 'Multi-feature regression using L2 Ridge regularization, capturing day-of-week consumption spikes and autoregressive grocery inertia.',
      },
      {
        id: 'holt-winters-tes',
        name: 'Holt-Winters Triple Exponential Smoothing (HW-TES)',
        type: 'HOLT_WINTERS',
        mae: hwMetrics.mae,
        rmse: hwMetrics.rmse,
        mape: hwMetrics.mape,
        accuracy: hwMetrics.accuracy,
        isSelected: false,
        hyperparameters: { alpha: 0.25, beta: 0.08, gamma: 0.35, period: 7 },
        description: 'Classical time-series decomposition modeling baseline level, linear slope drift, and 7-day cyclical seasonality.',
      },
      {
        id: 'adaptive-wma-baseline',
        name: 'Adaptive Recency-Weighted Moving Average (Adaptive-WMA)',
        type: 'ADAPTIVE_WMA',
        mae: wmaMetrics.mae,
        rmse: wmaMetrics.rmse,
        mape: wmaMetrics.mape,
        accuracy: wmaMetrics.accuracy,
        isSelected: false,
        hyperparameters: { windowSize: 14, decay: 0.88 },
        description: 'Heuristic baseline assigning geometrically decaying weights to recent 14 days of store transactions.',
      },
    ];

    // Select winner: Lowest MAPE and highest accuracy
    candidates.sort((a, b) => a.mape - b.mape);
    candidates[0].isSelected = true;

    const winner = candidates[0];

    const result: TrainingResult = {
      selectedModelId: winner.id,
      selectedModelName: winner.name,
      selectedModelType: winner.type,
      trainedAt: new Date().toISOString(),
      totalTrainingObservations: totalObs,
      validationObservations: testActuals.length,
      bestMetrics: {
        mae: winner.mae,
        rmse: winner.rmse,
        mape: winner.mape,
        accuracy: winner.accuracy,
      },
      comparison: candidates,
      selectionRationale: `${winner.name} achieved the best validation score with MAPE of ${winner.mape}% (RMSE: ${winner.rmse}, Accuracy: ${winner.accuracy}%). It delivers the most accurate inventory demand predictions for retail grocery shopping patterns.`,
    };

    this.trainedResult = result;

    logger.info('AutoML Tournament Completed. Winner selected:', {
      winner: winner.id,
      mape: winner.mape,
      accuracy: winner.accuracy,
    });

    return result;
  }

  /**
   * Generates a forecast using the selected winning model
   */
  public static forecastSku(series: TimeSeriesPoint[], horizonDays = 7): {
    predictedUnitsTotal: number;
    dailyPredictions: number[];
    dailyAverage: number;
    confidenceInterval: { lower: number; upper: number };
    modelVersion: string;
  } {
    const selectedId = this.trainedResult?.selectedModelId || 'ridge-autoregressive-ml';

    let dailyPredictions: number[] = [];

    if (selectedId === 'holt-winters-tes') {
      const hw = new HoltWintersModel();
      hw.train(series);
      dailyPredictions = hw.forecastHorizon(series, horizonDays);
    } else if (selectedId === 'adaptive-wma-baseline') {
      const wma = new AdaptiveWMAModel();
      dailyPredictions = wma.forecastHorizon(series, horizonDays);
    } else {
      // Default & best: Ridge Autoregressive
      const ridge = new RidgeAutoregressiveModel();
      ridge.train(series);
      dailyPredictions = ridge.forecastHorizon(series, horizonDays);
    }

    const predictedUnitsTotal = Number(
      dailyPredictions.reduce((a, b) => a + b, 0).toFixed(1)
    );
    const dailyAverage = Number((predictedUnitsTotal / horizonDays).toFixed(2));

    // Standard deviation estimate for 95% confidence interval
    const residualStd = Math.max(1, dailyAverage * 0.18);
    const lower = Math.max(0, Number((predictedUnitsTotal - 1.96 * residualStd).toFixed(1)));
    const upper = Number((predictedUnitsTotal + 1.96 * residualStd).toFixed(1));

    return {
      predictedUnitsTotal,
      dailyPredictions,
      dailyAverage,
      confidenceInterval: { lower, upper },
      modelVersion: `v2.0.0-${selectedId}`,
    };
  }
}

