import type { Project } from '../../types';
import type { IStorageProvider } from './IStorageProvider';

const PROJECTS_KEY = 'vdm_projects_list';
const PROJECT_PREFIX = 'vdm_project_';

export class LocalProvider implements IStorageProvider {
  async getProjects(): Promise<Project[]> {
    const raw = localStorage.getItem(PROJECTS_KEY);
    return raw ? JSON.parse(raw) : [];
  }

  async loadProject(projectId: string): Promise<any> {
    const raw = localStorage.getItem(`${PROJECT_PREFIX}${projectId}`);
    return raw ? JSON.parse(raw) : null;
  }

  async saveProject(projectId: string, name: string, state: any): Promise<void> {
    // 1. Update project list
    const projects = await this.getProjects();
    const existingIdx = projects.findIndex(p => p.id === projectId);
    
    const projectInfo: Project = {
      id: projectId,
      name: name,
      lastAccessed: new Date().toISOString(),
      createdAt: existingIdx >= 0 ? projects[existingIdx].createdAt : new Date().toISOString()
    };

    if (existingIdx >= 0) {
      projects[existingIdx] = projectInfo;
    } else {
      projects.push(projectInfo);
    }
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));

    // 2. Save actual state
    localStorage.setItem(`${PROJECT_PREFIX}${projectId}`, JSON.stringify(state));
  }

  async deleteProject(projectId: string): Promise<void> {
    // 1. Remove from list
    const projects = await this.getProjects();
    const updated = projects.filter(p => p.id !== projectId);
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(updated));

    // 2. Remove state
    localStorage.removeItem(`${PROJECT_PREFIX}${projectId}`);
  }

  getProviderName(): string {
    return 'Local Storage';
  }
}
