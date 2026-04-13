import type { Project } from '../../types';

export interface IStorageProvider {
  /**
   * Retrieves a list of all available projects.
   */
  getProjects(): Promise<Project[]>;

  /**
   * Loads the full state of a specific project.
   */
  loadProject(projectId: string): Promise<any>;

  /**
   * Saves or updates a project's state.
   */
  saveProject(projectId: string, name: string, state: any): Promise<void>;

  /**
   * Deletes a project.
   */
  deleteProject(projectId: string): Promise<void>;

  /**
   * Returns a friendly name for the storage backend.
   */
  getProviderName(): string;
}
