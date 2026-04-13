// Unused imports removed

export const ForecastMethod = {
  LINEAR_TREND: 'LINEAR_TREND',
  MOVING_AVERAGE: 'MOVING_AVERAGE',
  FLAT_GROWTH: 'FLAT_GROWTH',
  SEASONAL_NAIVE: 'SEASONAL_NAIVE',
} as const;

export type ForecastMethod = (typeof ForecastMethod)[keyof typeof ForecastMethod];

export function generateForecast(
  historicalData: number[],
  horizon: number = 12,
  method: ForecastMethod = ForecastMethod.LINEAR_TREND,
  growthRate: number = 0.0
): number[] {
  if (!historicalData || historicalData.length === 0) {
    return new Array(horizon).fill(0.0);
  }

  const lastVal = historicalData[historicalData.length - 1];

  switch (method) {
    case ForecastMethod.FLAT_GROWTH: {
      if (growthRate === 0) {
        return new Array(horizon).fill(lastVal);
      }
      // Compound growth: future = last_val * (1 + monthly_growth)^n
      const monthlyGrowth = Math.pow(1 + growthRate, 1 / 12) - 1;
      return Array.from({ length: horizon }, (_, i) => lastVal * Math.pow(1 + monthlyGrowth, i + 1));
    }

    case ForecastMethod.MOVING_AVERAGE: {
      const windowSize = Math.min(3, historicalData.length);
      const window = historicalData.slice(-windowSize);
      const avg = window.reduce((a, b) => a + b, 0) / windowSize;
      return new Array(horizon).fill(avg);
    }

    case ForecastMethod.LINEAR_TREND: {
      if (historicalData.length < 2) {
        return new Array(horizon).fill(lastVal);
      }

      // Simple linear regression: y = mx + c
      const n = historicalData.length;
      const x = Array.from({ length: n }, (_, i) => i);
      const y = historicalData;

      const sumX = x.reduce((a, b) => a + b, 0);
      const sumY = y.reduce((a, b) => a + b, 0);
      const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
      const sumXX = x.reduce((sum, val) => sum + val * val, 0);

      const m = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
      const c = (sumY - m * sumX) / n;

      return Array.from({ length: horizon }, (_, i) => m * (n + i) + c);
    }

    case ForecastMethod.SEASONAL_NAIVE: {
      const cycle = 12;
      return Array.from({ length: horizon }, (_, i) => {
        const prevIdx = historicalData.length - cycle + (i % cycle);
        return prevIdx >= 0 ? historicalData[prevIdx] : lastVal;
      });
    }

    default:
      return new Array(horizon).fill(lastVal);
  }
}
