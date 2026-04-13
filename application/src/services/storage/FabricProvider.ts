import type { Project } from '../../types';
import type { IStorageProvider } from './IStorageProvider';

const FABRIC_API_BASE = 'https://api.fabric.microsoft.com/v1';

export class FabricProvider implements IStorageProvider {
  private workspaceId: string;
  private warehouseId: string;
  private getAccessToken: () => Promise<string>;

  constructor(workspaceId: string, warehouseId: string, getAccessToken: () => Promise<string>) {
    this.workspaceId = workspaceId;
    this.warehouseId = warehouseId;
    this.getAccessToken = getAccessToken;
  }

  private async executeQuery(sql: string): Promise<any> {
    const token = await this.getAccessToken();
    if (!token) throw new Error('No access token available for Fabric.');

    const url = `${FABRIC_API_BASE}/workspaces/${this.workspaceId}/warehouses/${this.warehouseId}/executeQueries`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        queries: [{ query: sql }]
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Fabric API Error: ${error.message || response.statusText}`);
    }

    return response.json();
  }

  async getProjects(): Promise<Project[]> {
    const sql = "SELECT id, name, lastAccessed, createdAt FROM projects ORDER BY lastAccessed DESC";
    const result = await this.executeQuery(sql);
    return result?.results?.[0]?.rows || [];
  }

  async loadProject(projectId: string): Promise<any> {
    const sql = `SELECT state FROM projects WHERE id = '${projectId}'`;
    const result = await this.executeQuery(sql);
    const row = result?.results?.[0]?.rows?.[0];
    return row ? JSON.parse(row.state) : null;
  }

  async saveProject(projectId: string, name: string, state: any): Promise<void> {
    const jsonState = JSON.stringify(state).replace(/'/g, "''"); // SQL Escape
    const sql = `
      IF EXISTS (SELECT 1 FROM projects WHERE id = '${projectId}')
        UPDATE projects SET state = '${jsonState}', name = '${name}', lastAccessed = GETDATE() WHERE id = '${projectId}'
      ELSE
        INSERT INTO projects (id, name, state, createdAt, lastAccessed) 
        VALUES ('${projectId}', '${name}', '${jsonState}', GETDATE(), GETDATE())
    `;
    await this.executeQuery(sql);
  }

  async deleteProject(projectId: string): Promise<void> {
    const sql = `DELETE FROM projects WHERE id = '${projectId}'`;
    await this.executeQuery(sql);
  }

  getProviderName(): string {
    return 'Microsoft Fabric';
  }
}
