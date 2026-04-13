import type { KPIData, DateRange, Project } from '../types';
import { KPICalculator } from '../logic/KPICalculator';
import { generateForecast, ForecastMethod } from '../logic/Forecaster';
import { promoteByHierarchy, parseFile } from '../logic/Importer';
import type { IStorageProvider } from './storage/IStorageProvider';
import { LocalProvider } from './storage/LocalProvider';
import { FabricProvider } from './storage/FabricProvider';

export interface CalculationResponse {
  results: Record<string, number[]>;
  impactedKpis: string[];
}

export interface ImportResponse {
  kpis: Record<string, KPIData>;
  dateRange: DateRange;
  raw_rows?: (string | number | null)[][];
  sheets?: Record<string, (string | number | null)[][]>;
}

export interface ForecastResponse {
  forecast: number[];
}

/**
 * Strategy selection for Storage
 */
const workspaceId = import.meta.env.VITE_FABRIC_WORKSPACE_ID;
const warehouseId = import.meta.env.VITE_FABRIC_WAREHOUSE_ID;
const clientId = import.meta.env.VITE_AZURE_CLIENT_ID;

// Mock function to satisfy FabricProvider until MSAL is fully integrated
const getAccessTokenPlaceholder = async () => localStorage.getItem('fabric_access_token') || '';

const storageProvider: IStorageProvider = (workspaceId && warehouseId && clientId)
  ? new FabricProvider(workspaceId, warehouseId, getAccessTokenPlaceholder)
  : new LocalProvider();

if (!(storageProvider instanceof FabricProvider)) {
  console.info("Using Local Storage mode. Fabric Cloud IDs missing in .env");
}

/**
 * apiService acts as the primary interface for the UI.
 * It routes requests to local logic or the selected Storage Provider.
 */
export const apiService = {
  getProviderName(): string {
    return storageProvider.getProviderName();
  },

  isLocalMode(): boolean {
    return storageProvider instanceof LocalProvider;
  },

  async getAccessToken(): Promise<string> {
    return getAccessTokenPlaceholder();
  },

  async calculate(kpis: Record<string, KPIData>, dateRange: DateRange): Promise<CalculationResponse> {
    const calculator = new KPICalculator(kpis, dateRange);
    return calculator.calculate();
  },

  async importFile(file: File, monthsCount: number = 12): Promise<ImportResponse> {
    const { sheets, firstSheetData } = await parseFile(file);
    const defaultMappings: Record<string, string> = {
      "0": "L1", "1": "L2", "2": "Time", "3": "Value"
    };
    const result = promoteByHierarchy(firstSheetData, monthsCount, defaultMappings);
    return { ...result, raw_rows: firstSheetData, sheets };
  },

  async getForecast(historicalData: number[], horizon: number = 12, method: string = 'LINEAR_TREND', growthRate: number = 0): Promise<ForecastResponse> {
    const forecast = generateForecast(historicalData, horizon, method as ForecastMethod, growthRate);
    return { forecast };
  },

  // Project Management delegated to Provider
  async getProjects(): Promise<Project[]> {
    return storageProvider.getProjects();
  },

  async createProject(id: string, name: string): Promise<any> {
    await storageProvider.saveProject(id, name, { kpis: {} });
    return { id, name };
  },

  async getProjectState(projectId: string): Promise<any> {
    return storageProvider.loadProject(projectId);
  },

  async saveProjectState(projectId: string, state: any): Promise<void> {
    const name = state.projectName || 'Untitled Project';
    await storageProvider.saveProject(projectId, name, state);
  },

  async deleteProject(projectId: string): Promise<void> {
    await storageProvider.deleteProject(projectId);
  },
  
  async promoteSheet(rows: any[][], mappings: Record<string, string>, monthsCount: number = 12, startMonth: number = 0, startYear: number = 2024): Promise<any> {
    return promoteByHierarchy(rows, monthsCount, mappings, startMonth, startYear);
  }
};
