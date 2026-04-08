// @ts-nocheck
export type FormulaType = 'SUM' | 'PRODUCT' | 'NONE' | 'AVERAGE' | 'CUSTOM';
export type ForecastMethod = 'LINEAR_TREND' | 'MOVING_AVERAGE' | 'FLAT_GROWTH' | 'SEASONAL_NAIVE';



export interface TimeSeriesValue {
  month: string;
  actual: number;
  forecast?: number;
  simulated?: number;
}

export interface SemanticAttributes {
  businessOwner?: string;
  dataSource?: string;
  lastUpdated?: string;
  tags?: string[];
}

export interface KPIData {
  id: string;
  label: string;
  data: TimeSeriesValue[];
  unit: string;
  formula: FormulaType;
  customFormula?: string;
  children: string[];
  parentId?: string;
  isExpanded: boolean;
  simulationValue?: number;
  simulationType?: 'PERCENT' | 'ABSOLUTE';
  color?: string;
  desiredTrend?: 'INCREASE' | 'DECREASE';
  semantic?: SemanticAttributes;
  monthlyOverrides?: Record<string, number | string>; // Key: "YYYY-MM"
  overallOverride?: Record<string, number>; // Key: "YYYY"
  isLocked?: boolean; // If true, inputs are disabled
  lockedMonths?: Record<string, boolean>; // Key: "YYYY-MM"
  pageId?: string; // ID of the page this KPI belongs to
  isScenarioNode?: boolean; // True if this node represents a scenario split
  comment?: string; // User comment for this KPI node
  monthlyComments?: Record<string, string>; // Key: "YYYY-MM"
}

export interface Scenario {
  id: string;
  name: string;
  kpis: Record<string, KPIData>;
  createdAt: string;
  isPromoted?: boolean; // If true, this is an original scenario from raw data
}

export interface Project {
  id: string;
  name: string;
  lastAccessed: string;
  createdAt: string;
}

export interface Page {
  id: string;
  name: string;
}

export interface DateRange {
  startMonth: number; // 0-11
  startYear: number;
  endMonth: number;   // 0-11
  endYear: number;
}

export interface LogEntry {
  id: string;
  timestamp: string; // ISO string for better formatting
  action: string;
  details: string;
  oldValue?: string | number;
  newValue?: string | number;
  kpiId?: string;
  impactedKpis?: string[]; // IDs of KPIs that were recalculated
}

export interface AppState {
  scenarios: Record<string, Scenario>;
  activeScenarioId: string;
  baselineScenarioId: string; // Scenario to compare against
  spreadsheetSelectedScenarios?: string[];
  dateRange: DateRange;
  activityLog: LogEntry[];
  lockMonthIdx?: number;
  isSyncEnabled: boolean;
  valueDisplayType?: 'absolute' | 'variance';
  pages?: Page[];
  activePageId?: string;
  baseScenarioLocked?: boolean;
  rawImportData?: any[][];
  sheets?: Record<string, any[][]>;
  columnMappings?: Record<string, string>;
  showCharts?: boolean;
  dateRangeMode?: 'MTD' | 'YTD';
}

export interface SimulationState {
  kpis: Record<string, KPIData>;
  rootId: string;
}
