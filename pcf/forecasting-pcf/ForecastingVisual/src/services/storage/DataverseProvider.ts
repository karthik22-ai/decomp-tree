import { IStorageProvider } from './IStorageProvider';
import type { Project } from '../../types';

/**
 * DataverseProvider integrates the forecasting application with the 
 * Microsoft Dataverse WebAPI using the PCF context.
 */
export class DataverseProvider implements IStorageProvider {
  private context: ComponentFramework.Context<any>;
  private entityName = "crxxx_forecasting_project"; // Replace crxxx with your prefix

  constructor(context: ComponentFramework.Context<any>) {
    this.context = context;
  }

  getProviderName(): string {
    return "Dataverse";
  }

  /**
   * Fetches all project records from the Dataverse table.
   */
  async getProjects(): Promise<Project[]> {
    try {
      const results = await this.context.webAPI.retrieveMultipleRecords(
        this.entityName,
        "?$select=crxxx_name,crxxx_projectid,crxxx_lastaccessed,createdon"
      );

      return results.entities.map(e => ({
        id: e.crxxx_projectid,
        name: e.crxxx_name,
        lastAccessed: e.crxxx_lastaccessed || e.createdon,
        createdAt: e.createdon
      }));
    } catch (error) {
      console.error("Dataverse: Failed to fetch projects", error);
      return [];
    }
  }

  /**
   * Loads the project state from the crxxx_state field (JSON blob).
   */
  async loadProject(projectId: string): Promise<any> {
    try {
      const query = `?$filter=crxxx_projectid eq '${projectId}'&$select=crxxx_state,crxxx_name`;
      const results = await this.context.webAPI.retrieveMultipleRecords(this.entityName, query);

      if (results.entities.length > 0) {
        const entity = results.entities[0];
        if (entity.crxxx_state) {
          return JSON.parse(entity.crxxx_state);
        }
      }
      return { kpis: {} };
    } catch (error) {
      console.error(`Dataverse: Failed to load project ${projectId}`, error);
      throw error;
    }
  }

  /**
   * Saves the project state as a JSON string in Dataverse.
   */
  async saveProject(projectId: string, name: string, state: any): Promise<void> {
    try {
      // 1. Check if record exists
      const query = `?$filter=crxxx_projectid eq '${projectId}'&$select=crxxx_name`;
      const existing = await this.context.webAPI.retrieveMultipleRecords(this.entityName, query);

      const data = {
        "crxxx_name": name,
        "crxxx_state": JSON.stringify(state),
        "crxxx_lastaccessed": new Date().toISOString(),
        "crxxx_projectid": projectId
      };

      if (existing.entities.length > 0) {
        // Update existing
        const recordId = existing.entities[0][`${this.entityName}id`];
        await this.context.webAPI.updateRecord(this.entityName, recordId, data);
      } else {
        // Create new
        await this.context.webAPI.createRecord(this.entityName, data);
      }
    } catch (error) {
      console.error(`Dataverse: Failed to save project ${projectId}`, error);
      throw error;
    }
  }

  /**
   * Deletes a project record from Dataverse.
   */
  async deleteProject(projectId: string): Promise<void> {
    try {
      const query = `?$filter=crxxx_projectid eq '${projectId}'`;
      const existing = await this.context.webAPI.retrieveMultipleRecords(this.entityName, query);

      if (existing.entities.length > 0) {
        const recordId = existing.entities[0][`${this.entityName}id`];
        await this.context.webAPI.deleteRecord(this.entityName, recordId);
      }
    } catch (error) {
      console.error(`Dataverse: Failed to delete project ${projectId}`, error);
      throw error;
    }
  }
}
