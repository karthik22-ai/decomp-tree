import * as math from 'mathjs';
import type { KPIData, DateRange } from '../types';

export class KPICalculator {
  private kpis: Record<string, KPIData>;
  private dateRange: DateRange;
  private results: Record<string, number[]>;
  private computedNodes: Set<string> = new Set();
  private computingNodes: Set<string> = new Set();
  private computedTotals: Set<string> = new Set();
  private computingTotals: Set<string> = new Set();
  private impactedKpis: Set<string> = new Set();

  constructor(kpis: Record<string, KPIData>, dateRange: DateRange) {
    this.kpis = kpis;
    this.dateRange = dateRange;
    this.results = {};

    // Validate dateRange. monthsCount is critical for array initialization.
    const mCount = Math.max(0, Math.floor(dateRange?.monthsCount || 0));
    const safeMonthsCount = Number.isSafeInteger(mCount) && mCount < 240 ? mCount : 12; // Default to 12 if invalid

    // Initialize results
    Object.keys(kpis).forEach(id => {
      this.results[id] = new Array(safeMonthsCount + 1).fill(0);
    });
    
    if (!this.dateRange.monthsCount) {
      this.dateRange.monthsCount = safeMonthsCount;
    }
  }

  public calculate(): { results: Record<string, number[]>; impactedKpis: string[] } {
    this.computedNodes.clear();
    this.computingNodes.clear();
    this.impactedKpis.clear();

    // 1. Compute monthly values for all nodes (Top-Down with Bottom-Up recursion)
    Object.keys(this.kpis).forEach(id => {
      this.computeNode(id);
    });

    // 2. Compute FY Totals (or Date Range Totals)
    this.computedTotals.clear();
    this.computingTotals.clear();
    Object.keys(this.kpis).forEach(id => {
      this.computeTotal(id);
    });

    return {
      results: this.results,
      impactedKpis: Array.from(this.impactedKpis),
    };
  }

  /**
   * Helper to perform a deep copy of KPIs and apply a change, then recalculate.
   * This is used for "Optimistic" updates in the UI.
   */
  public static applyChange(
    kpis: Record<string, KPIData>,
    dateRange: DateRange,
    id: string,
    change: { type: 'MONTHLY' | 'OVERALL' | 'SIMULATION', key?: string, value: any }
  ): { nextKpis: Record<string, KPIData>, nextResults: Record<string, number[]> } {
    const nextKpis = JSON.parse(JSON.stringify(kpis));
    const calc = new KPICalculator(nextKpis, dateRange);

    if (change.type === 'MONTHLY' && change.key) {
      const monthIdx = calc.getMonthIdx(change.key);
      const valNum = typeof change.value === 'number' ? change.value : parseFloat(change.value) || 0;
      
      // Update override
      if (!nextKpis[id].monthlyOverrides) nextKpis[id].monthlyOverrides = {};
      if (change.value === undefined || change.value === '') {
        delete nextKpis[id].monthlyOverrides[change.key];
      } else {
        nextKpis[id].monthlyOverrides[change.key] = valNum;
      }

      // Propagate up and down
      if (monthIdx !== -1) {
        // Initial compute to get current value
        calc.computeNode(id);
        // Distribution down
        calc.distributeTopDown(id, monthIdx, valNum);
        // Note: Propagation up is handled by the calculate() call later
      }
    } else if (change.type === 'SIMULATION') {
      nextKpis[id].simulationValue = change.value;
    } else if (change.type === 'OVERALL') {
      if (!nextKpis[id].overallOverride) {
        nextKpis[id].overallOverride = {};
      }
      
      const year = change.key;
      if (year) {
        if (change.value === undefined || change.value === '') {
          delete nextKpis[id].overallOverride[year];
        } else {
          nextKpis[id].overallOverride[year] = typeof change.value === 'number' ? change.value : parseFloat(change.value) || 0;
        }
      }
      
      // Need a fresh calculator instance since we mutated nextKpis
      const newCalc = new KPICalculator(nextKpis, dateRange);
      const { results } = newCalc.calculate();
      return { nextKpis, nextResults: results };
    }

    const { results } = calc.calculate();
    return { nextKpis, nextResults: results };
  }

  private isMutable(id: string, monthIdx: number): boolean {
    const kpi = this.kpis[id];
    if (!kpi) return false;
    if (kpi.isLocked) return false;

    const startMonth = this.dateRange.startMonth || 0;
    const startYear = this.dateRange.startYear || 2024;
    const currentMonth = (startMonth + monthIdx) % 12;
    const currentYear = startYear + Math.floor((startMonth + monthIdx) / 12);
    const monthKey = `${currentYear}-${currentMonth}`;

    if (kpi.lockedMonths && kpi.lockedMonths[monthKey]) return false;
    return true;
  }

  private getMonthIdx(monthKey: string): number {
    const [y, m] = monthKey.split('-').map(Number);
    const startM = this.dateRange.startMonth || 0;
    const startY = this.dateRange.startYear || 2024;
    
    // total months from a base point
    const baseMonths = startY * 12 + startM;
    const targetMonths = y * 12 + m;
    const diff = targetMonths - baseMonths;
    
    return (diff >= 0 && diff < (this.dateRange.monthsCount || 0)) ? diff : -1;
  }

  /**
   * Distributes a target value from a parent node to its children for a specific month.
   */
  public distributeTopDown(parentId: string, monthIdx: number, targetValue: number) {
    const kpi = this.kpis[parentId];
    if (!kpi || !kpi.children || kpi.children.length === 0) return;

    const childIds = kpi.children;
    const formula = kpi.formula || 'SUM';
    
    if (!['SUM', 'AVERAGE', 'PRODUCT', 'NONE'].includes(formula)) return;

    const mutableChildren = childIds.filter(cid => this.isMutable(cid, monthIdx));
    if (mutableChildren.length === 0) return;

    // Must have current values for children to distribute proportionally
    childIds.forEach(cid => this.computeNode(cid));
    
    const currentValues = childIds.map(cid => this.results[cid][monthIdx]);
    const currentTotal = formula === 'PRODUCT' 
      ? currentValues.reduce((a, b) => a * b, 1)
      : currentValues.reduce((a, b) => a + b, 0);

    const diff = targetValue - currentTotal;
    if (Math.abs(diff) < 1e-9 && formula !== 'PRODUCT') return;

    if (formula === 'SUM' || formula === 'NONE' || formula === 'AVERAGE') {
      const effectiveTarget = formula === 'AVERAGE' ? targetValue * childIds.length : targetValue;
      
      const currentMutableSum = mutableChildren.reduce((a, cid) => a + this.results[cid][monthIdx], 0);
      const currentOverallSum = currentValues.reduce((a, b) => a + b, 0);
      const effectiveDiff = effectiveTarget - currentOverallSum;

      mutableChildren.forEach(cid => {
        let childDelta = 0;
        if (Math.abs(currentMutableSum) > 1e-9) {
          const proportion = this.results[cid][monthIdx] / currentMutableSum;
          childDelta = effectiveDiff * proportion;
        } else {
          childDelta = effectiveDiff / mutableChildren.length;
        }
        
        const newVal = this.results[cid][monthIdx] + childDelta;
        this.setOverride(cid, monthIdx, newVal);
        this.distributeTopDown(cid, monthIdx, newVal);
      });
    } else if (formula === 'PRODUCT') {
      if (Math.abs(currentTotal) < 1e-9 && Math.abs(targetValue) > 1e-9) {
          // current is 0, target is non-zero
          const nonMutVals = childIds.filter(cid => !mutableChildren.includes(cid)).map(cid => this.results[cid][monthIdx]);
          const nonMutProd = nonMutVals.length > 0 ? nonMutVals.reduce((a, b) => a * b, 1) : 1.0;
          
          if (Math.abs(nonMutProd) < 1e-9) return; // Impossible
          
          const targetMutProd = targetValue / nonMutProd;
          if (targetMutProd < 0 && mutableChildren.length % 2 === 0) return; // Impossible root

          const sign = targetMutProd < 0 ? -1 : 1;
          const root = sign * Math.pow(Math.abs(targetMutProd), 1.0 / mutableChildren.length);
          mutableChildren.forEach(cid => {
              this.setOverride(cid, monthIdx, root);
              this.distributeTopDown(cid, monthIdx, root);
          });
          return;
      }
      
      const ratio = Math.abs(currentTotal) > 1e-9 ? targetValue / currentTotal : 1;
      if (Math.abs(ratio - 1) < 1e-9) return;
      if (ratio < 0 && mutableChildren.length % 2 === 0) return;

      const sign = ratio < 0 ? -1 : 1;
      const factor = sign * Math.pow(Math.abs(ratio), 1.0 / mutableChildren.length);
      mutableChildren.forEach(cid => {
        const newVal = this.results[cid][monthIdx] * factor;
        this.setOverride(cid, monthIdx, newVal);
        this.distributeTopDown(cid, monthIdx, newVal);
      });
    }
  }

  private setOverride(id: string, monthIdx: number, value: number) {
    const kpi = this.kpis[id];
    if (!kpi) return;

    const startMonth = this.dateRange.startMonth || 0;
    const startYear = this.dateRange.startYear || 2024;
    const currentMonth = (startMonth + monthIdx) % 12;
    const currentYear = startYear + Math.floor((startMonth + monthIdx) / 12);
    const monthKey = `${currentYear}-${currentMonth}`;

    if (!kpi.monthlyOverrides) kpi.monthlyOverrides = {};
    kpi.monthlyOverrides[monthKey] = Number(value.toFixed(4));
    this.results[id][monthIdx] = value;
  }

  private evalFormula(formula: string, monthIdx: number, depth: number = 0, isTotal: boolean = false): number {
    if (depth > 20) return 0;
    let expr = formula.startsWith('=') ? formula.substring(1) : formula;

    const sortedKPIs = Object.values(this.kpis).sort((a, b) => b.label.length - a.label.length);

    for (const kpi of sortedKPIs) {
      const pattern = new RegExp(`\\b(${kpi.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}|${kpi.id})\\b`, 'gi');
      if (pattern.test(expr)) {
        if (isTotal) {
          if (!this.computedTotals.has(kpi.id)) {
            this.computeTotal(kpi.id, depth + 1);
          }
        } else {
          if (!this.computedNodes.has(kpi.id)) {
            this.computeNode(kpi.id, monthIdx, depth + 1);
          }
        }
        const val = this.results[kpi.id][monthIdx];
        expr = expr.replace(pattern, val.toString());
      }
    }

    try {
      return Number(math.evaluate(expr));
    } catch (e) {
      return 0;
    }
  }

  private computeNode(id: string, specificMonth?: number, depth: number = 0) {
    if (depth > 50 || this.computingNodes.has(id)) return;
    const kpi = this.kpis[id];
    if (!kpi) return;

    this.computingNodes.add(id);

    // Bottom-Up: Ensure children are computed first
    if (kpi.children && kpi.children.length > 0) {
      kpi.children.forEach(cid => this.computeNode(cid, specificMonth, depth + 1));
    }

    const mCount = this.dateRange.monthsCount || 0;
    const monthsToCompute = specificMonth !== undefined ? [specificMonth] : Array.from({ length: mCount }, (_, i) => i);
    const mutableMonthsCount = Array.from({ length: mCount }, (_, i) => i).filter(i => this.isMutable(id, i)).length;

    monthsToCompute.forEach(m => {
      const startMonth = this.dateRange.startMonth || 0;
      const startYear = this.dateRange.startYear || 2024;
      const currentMonth = (startMonth + m) % 12;
      const currentYear = startYear + Math.floor((startMonth + m) / 12);
      const monthKey = `${currentYear}-${currentMonth}`;

      const override = kpi.monthlyOverrides?.[monthKey];

      if (override !== undefined && override !== null && override !== '') {
        this.results[id][m] = typeof override === 'number' ? override : parseFloat(override) || 0;
      } else {
        if (kpi.children && kpi.children.length > 0) {
          const childVals = kpi.children.map(cid => this.results[cid][m]);
          if (kpi.formula === 'SUM' || kpi.formula === 'NONE' || !kpi.formula) {
            this.results[id][m] = childVals.reduce((a, b) => a + b, 0);
          } else if (kpi.formula === 'AVERAGE') {
            this.results[id][m] = childVals.length > 0 ? childVals.reduce((a, b) => a + b, 0) / childVals.length : 0;
          } else if (kpi.formula === 'PRODUCT') {
            this.results[id][m] = childVals.reduce((a, b) => a * b, 1);
          }
        } else if (kpi.data && Array.isArray(kpi.data)) {
          // Robust mapping of monthly data by Month and Year tokens
          const historyEntry = kpi.data.find((d: any) => {
            const dMonth = typeof d.month === 'string' ? parseInt(d.month, 10) : d.month;
            const dYear = typeof d.year === 'string' ? parseInt(d.year, 10) : d.year;
            return dMonth === currentMonth && (dYear === undefined || dYear === currentYear);
          });
          this.results[id][m] = historyEntry?.actual || 0;
        }

        if (kpi.formula === 'CUSTOM' && kpi.customFormula) {
          this.results[id][m] = this.evalFormula(kpi.customFormula, m, depth);
        }
      }

      // Simulation Adjustment (Scenario changes)
      const simVal = kpi.simulationValue || 0;
      if (simVal !== 0 && this.isMutable(id, m)) {
        if (kpi.simulationType === 'PERCENT') {
          this.results[id][m] *= (1 + simVal / 100);
        } else {
          if (mutableMonthsCount > 0) {
            this.results[id][m] += (simVal / mutableMonthsCount);
          }
        }
      }
    });

    // Apply Overall Override Scaling (Year-specific) stable version
    const overallDict = kpi.overallOverride;
    if (overallDict && typeof overallDict === 'object' && specificMonth === undefined) {
      const startMonth = this.dateRange.startMonth || 0;
      const startYear = this.dateRange.startYear || 2024;
      
      for (const [yearStr, targetTotal] of Object.entries(overallDict)) {
        if (targetTotal === null || targetTotal === undefined) continue;
        
        const targetYr = parseInt(yearStr, 10);
        if (isNaN(targetYr)) continue;
        
        // Find all month indices that belong to this year
        const yearMonthsIndices = monthsToCompute.filter(m => {
           const y = startYear + Math.floor((startMonth + m) / 12);
           return y === targetYr;
        });
        
        if (yearMonthsIndices.length === 0) continue;
        
        const currentYearSum = yearMonthsIndices.reduce((sum, idx) => sum + this.results[id][idx], 0);
        
        if (Math.abs(currentYearSum) > 1e-9) {
          const ratio = Number(targetTotal) / currentYearSum;
          if (Math.abs(ratio - 1.0) > 1e-9) {
            yearMonthsIndices.forEach(idx => {
              this.results[id][idx] *= ratio;
              this.distributeTopDown(id, idx, this.results[id][idx]);
            });
            this.impactedKpis.add(id);
          }
        } else {
          // Fallback: distribute evenly
          const evenVal = Number(targetTotal) / yearMonthsIndices.length;
          yearMonthsIndices.forEach(idx => {
            this.results[id][idx] = evenVal;
            this.distributeTopDown(id, idx, this.results[id][idx]);
          });
          this.impactedKpis.add(id);
        }
      }
    }

    if (specificMonth === undefined) {
      // Check for impact (any changes compared to pre-override values not easily done here without copying array,
      // but impactedKpis is already mostly populated by distributeTopDown and overall override)
      this.computedNodes.add(id);
    }
    this.computingNodes.delete(id);
  }

  private computeTotal(id: string, depth: number = 0) {
    if (depth > 50 || this.computingTotals.has(id)) return;
    if (this.computedTotals.has(id)) return;

    const kpi = this.kpis[id];
    if (!kpi) return;

    this.computingTotals.add(id);

    const mCount = this.dateRange.monthsCount || 0;
    const formula = kpi.formula || 'SUM';

    if (formula === 'CUSTOM' && kpi.customFormula) {
      this.results[id][mCount] = this.evalFormula(kpi.customFormula, mCount, depth, true);
    } else {
      if (kpi.children && kpi.children.length > 0) {
        // Ensure children totals are computed
        kpi.children.forEach(cid => this.computeTotal(cid, depth + 1));
        const childTotals = kpi.children.map(cid => this.results[cid][mCount]);

        if (formula === 'AVERAGE') {
          this.results[id][mCount] = childTotals.length > 0 ? childTotals.reduce((a, b) => a + b, 0) / childTotals.length : 0;
        } else if (formula === 'PRODUCT') {
          this.results[id][mCount] = childTotals.reduce((a, b) => a * b, 1);
        } else {
          // Default to SUM
          this.results[id][mCount] = childTotals.reduce((a, b) => a + b, 0);
        }
      } else {
        // Base KPI - aggregation of its own monthly values
        const yearValues = this.results[id].slice(0, mCount);
        if (formula === 'AVERAGE') {
          this.results[id][mCount] = yearValues.length > 0 ? yearValues.reduce((a, b) => a + b, 0) / yearValues.length : 0;
        } else if (formula === 'PRODUCT') {
          this.results[id][mCount] = yearValues.reduce((a, b) => a * b, 1);
        } else {
          this.results[id][mCount] = yearValues.reduce((a, b) => a + b, 0);
        }
      }
    }

    this.computedTotals.add(id);
    this.computingTotals.delete(id);
  }

}

