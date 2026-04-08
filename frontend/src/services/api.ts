// @ts-nocheck
import type { KPIData, DateRange } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://forecasting-api-mnbykul6lq-uc.a.run.app';
console.log("USING API BASE URL:", API_BASE_URL);

export interface CalculationResponse {
  results: Record<string, number[]>;
  impactedKpis: string[];
}

export interface ImportResponse {
  kpis: Record<string, KPIData>;
  raw_rows?: any[][];
  sheets?: Record<string, any[][]>;
}

export interface ForecastResponse {
  forecast: number[];
}

export const apiService = {
  async calculate(kpis: Record<string, KPIData>, dateRange: DateRange): Promise<CalculationResponse> {
    const response = await fetch(`${API_BASE_URL}/calculate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ kpis, dateRange }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Calculation failed');
    }

    return response.json();
  },

  async importFile(file: File, monthsCount: number = 12): Promise<ImportResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('monthsCount', monthsCount.toString());

    const response = await fetch(`${API_BASE_URL}/import`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Import failed');
    }

    return response.json();
  },

  async getForecast(historicalData: number[], horizon: number = 12, method: string = 'LINEAR_TREND', growthRate: number = 0): Promise<ForecastResponse> {
    const response = await fetch(`${API_BASE_URL}/forecast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ historicalData, horizon, method, growthRate }),
    });


    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Forecasting failed');
    }

    return response.json();
  },

  // Project Management (Python Backend Segment)
  async getProjects(): Promise<any[]> {
    const response = await fetch(`${API_BASE_URL}/projects/`);
    if (!response.ok) throw new Error('Failed to fetch projects');
    return response.json();
  },

  async createProject(id: string, name: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/projects/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name }),
    });
    if (!response.ok) throw new Error('Failed to create project');
    return response.json();
  },

  async getProjectState(projectId: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/projects/${projectId}`);
    if (!response.ok) throw new Error('Project not found');
    return response.json();
  },

  async saveProjectState(projectId: string, state: any): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/projects/${projectId}/state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
    });
    if (!response.ok) throw new Error('Failed to save state');
  },

  async deleteProject(projectId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/projects/${projectId}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete project');
  },

  async importToProject(projectId: string, file: File, monthsCount: number = 12): Promise<ImportResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('monthsCount', monthsCount.toString());

    const response = await fetch(`${API_BASE_URL}/projects/${projectId}/import`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) throw new Error('Import failed');
    return response.json();
  },
  
  async promoteSheet(rows: any[][], mappings: Record<string, string>, monthsCount: number = 12, startMonth: number = 0, startYear: number = 2024): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/promote-sheet`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ rows, mappings, monthsCount, startMonth, startYear }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Promotion failed');
    }

    return response.json();
  }
};

