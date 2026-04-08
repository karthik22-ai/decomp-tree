import React, { useState, useEffect } from 'react';
import { Plus, Database, FileSpreadsheet, FolderOpen, ArrowRight, Trash2 } from 'lucide-react';
import { apiService } from '../services/api';
import type { Project } from '../types';

interface ProjectSelectorProps {
    onSelectProject: (projectId: string, isSample?: boolean) => void;
}

export const ProjectSelector: React.FC<ProjectSelectorProps> = ({ onSelectProject }) => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [newProjectName, setNewProjectName] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    const fetchProjects = async () => {
        try {
            const data = await apiService.getProjects();
            setProjects(data);
        } catch (e) {
            console.error('Failed to load projects', e);
        }
    };

    useEffect(() => { fetchProjects(); }, []);

    const handleCreateBlank = async () => {
        if (!newProjectName.trim()) return;
        try {
            const id = `proj-${Date.now()}`;
            await apiService.createProject(id, newProjectName.trim());
            onSelectProject(id, false);
        } catch (e) {
            alert('Failed to create project');
        }
    };

    const handleCreateSample = async () => {
        try {
            const id = `proj-${Date.now()}`;
            await apiService.createProject(id, `Sample Project ${projects.length + 1}`);
            onSelectProject(id, true);
        } catch (e) {
            alert('Failed to load sample');
        }
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm('Are you sure you want to delete this project?')) {
            try {
                await apiService.deleteProject(id);
                fetchProjects();
            } catch (e) {
                alert('Failed to delete project');
            }
        }
    };

    return (
        <div style={{ height: '100vh', overflowY: 'auto', background: '#f8fafc', padding: '40px 20px', fontFamily: 'system-ui, sans-serif' }}>
            <div style={{ maxWidth: 1000, margin: '0 auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 40 }}>
                    <Database size={32} style={{ color: '#3b82f6' }} />
                    <h1 style={{ fontSize: 24, margin: 0, color: '#0f172a' }}>Value Driver Model</h1>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24, marginBottom: 48 }}>

                    {/* Blank Project Card */}
                    <div style={{
                        background: 'white', padding: 24, borderRadius: 12, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                        border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                            <div style={{ padding: 10, background: '#eff6ff', borderRadius: 8, color: '#3b82f6' }}>
                                <Plus size={24} />
                            </div>
                            <h2 style={{ fontSize: 18, margin: 0, color: '#1e293b' }}>Blank Project</h2>
                        </div>
                        <p style={{ color: '#64748b', fontSize: 14, marginBottom: 24, flex: 1 }}>
                            Start with an empty canvas. Perfect for uploading your own Excel or CSV data.
                        </p>

                        {isCreating ? (
                            <div style={{ display: 'flex', gap: 8 }}>
                                <input
                                    autoFocus
                                    placeholder="Project Name..."
                                    value={newProjectName}
                                    onChange={e => setNewProjectName(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleCreateBlank()}
                                    style={{ flex: 1, padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 6 }}
                                />
                                <button
                                    onClick={handleCreateBlank}
                                    style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '0 16px', borderRadius: 6, cursor: 'pointer' }}
                                >
                                    Create
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setIsCreating(true)}
                                style={{
                                    width: '100%', padding: '12px', background: '#3b82f6', color: 'white',
                                    border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 500, cursor: 'pointer'
                                }}
                            >
                                Create Blank Project
                            </button>
                        )}
                    </div>

                    {/* Sample Project Card */}
                    <div style={{
                        background: 'white', padding: 24, borderRadius: 12, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                        border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                            <div style={{ padding: 10, background: '#f0fdf4', borderRadius: 8, color: '#22c55e' }}>
                                <FileSpreadsheet size={24} />
                            </div>
                            <h2 style={{ fontSize: 18, margin: 0, color: '#1e293b' }}>Sample Project</h2>
                        </div>
                        <p style={{ color: '#64748b', fontSize: 14, marginBottom: 24, flex: 1 }}>
                            Explore a fully built scenario with standard KPI structures, formulas, and connections ready to use.
                        </p>
                        <button
                            onClick={handleCreateSample}
                            style={{
                                width: '100%', padding: '12px', background: '#f8fafc', color: '#475569',
                                border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 14, fontWeight: 500, cursor: 'pointer',
                                display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8
                            }}
                        >
                            Load Sample
                            <ArrowRight size={16} />
                        </button>
                    </div>
                </div>

                <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <FolderOpen size={20} style={{ color: '#64748b' }} />
                    <h2 style={{ fontSize: 18, margin: 0, color: '#334155' }}>Recent Projects</h2>
                </div>

                {projects.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 48, background: 'white', borderRadius: 12, border: '1px dashed #cbd5e1' }}>
                        <p style={{ color: '#94a3b8', margin: 0 }}>No projects found. Create one above to get started.</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                        {projects.sort((a, b) => new Date(b.lastAccessed).getTime() - new Date(a.lastAccessed).getTime()).map(project => (
                            <div
                                key={project.id}
                                onClick={() => {
                                    onSelectProject(project.id, false);
                                }}
                                style={{
                                    background: 'white', padding: '16px 20px', borderRadius: 8, border: '1px solid #e2e8f0',
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer',
                                    transition: 'all 0.2s ease', WebkitTapHighlightColor: 'transparent'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.borderColor = '#3b82f6';
                                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.borderColor = '#e2e8f0';
                                    e.currentTarget.style.boxShadow = 'none';
                                }}
                            >
                                <div>
                                    <h3 style={{ margin: '0 0 4px 0', fontSize: 16, color: '#1e293b' }}>{project.name}</h3>
                                    <span style={{ fontSize: 12, color: '#94a3b8' }}>Last opened: {new Date(project.lastAccessed).toLocaleDateString()}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                    <button
                                        onClick={(e) => handleDelete(project.id, e)}
                                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4, opacity: 0.6 }}
                                        title="Delete Project"
                                        onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                                        onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                    <ArrowRight size={20} style={{ color: '#cbd5e1' }} />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
