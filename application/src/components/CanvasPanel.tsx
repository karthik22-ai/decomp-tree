import React, { useState } from 'react';
import { Panel } from 'reactflow';
import { 
    Layers, Sliders, Search, Edit2, TrendingUp, Lock, Trash2, Plus, X 
} from 'lucide-react';
import type { Scenario, AppState } from '../types';

interface CanvasPanelProps {
    isPresentationMode: boolean;
    setIsPresentationMode: (val: boolean) => void;
    isScenarioOpen: boolean;
    setIsScenarioOpen: (val: boolean) => void;
    selectedScenarioIds: string[];
    scenarios: Record<string, Scenario>;
    scenarioFilterSearch: string;
    setScenarioFilterSearch: (val: string) => void;
    baselineScenarioId: string;
    onScenarioSelect: (id: string) => void;
    onScenarioAdd: (name: string) => void;
    onScenarioDelete: (id: string, e?: any) => void;
    onMakeBaseScenario: (id: string) => void;
    onAddRoot: () => void;
    setAppState: React.Dispatch<React.SetStateAction<AppState>>;
}

export const CanvasPanel: React.FC<CanvasPanelProps> = ({
    isPresentationMode,
    setIsPresentationMode,
    isScenarioOpen,
    setIsScenarioOpen,
    selectedScenarioIds,
    scenarios,
    scenarioFilterSearch,
    setScenarioFilterSearch,
    baselineScenarioId,
    onScenarioSelect,
    onScenarioAdd,
    onScenarioDelete,
    onMakeBaseScenario,
    onAddRoot,
    setAppState
}) => {
    const [newScenarioName, setNewScenarioName] = useState('');
    const [showAddScenario, setShowAddScenario] = useState(false);
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renamingName, setRenamingName] = useState('');

    const handleAddScenario = () => {
        if (newScenarioName.trim()) {
            onScenarioAdd(newScenarioName.trim());
            setNewScenarioName('');
            setShowAddScenario(false);
        }
    };

    const handleRenameConfirm = (id: string) => {
        if (renamingName.trim() && scenarios[id]?.name !== renamingName.trim()) {
            setAppState((prev: any) => ({
                ...prev,
                scenarios: {
                    ...prev.scenarios,
                    [id]: { ...prev.scenarios[id], name: renamingName.trim() }
                }
            }));
        }
        setRenamingId(null);
    };

    if (isPresentationMode) {
        return (
            <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-white/80 backdrop-blur-sm px-4 py-2 rounded-full shadow-sm border border-slate-200">
                <span className="font-semibold text-slate-700">Presentation Mode</span>
                <span className="text-xs text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">Press ESC</span>
                <button
                    onClick={() => setIsPresentationMode(false)}
                    className="ml-2 bg-slate-700 hover:bg-slate-800 text-white text-xs px-3 py-1.5 rounded-full transition-colors font-medium shadow-sm flex items-center gap-1"
                >
                    <X size={14} /> Exit
                </button>
            </div>
        );
    }

    return (
        <>
            <Panel position="top-right" className="canvas-panel">
                <div className="scenario-controls-mini">
                    <Layers size={14} />
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <div
                            onClick={() => setIsScenarioOpen(!isScenarioOpen)}
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                border: '1px solid #e2e8f0', borderRadius: '4px', padding: '2px 8px',
                                backgroundColor: 'white', minWidth: '140px', cursor: 'pointer',
                                fontSize: '12px', color: '#334155', fontWeight: 500, height: '24px'
                            }}
                        >
                            <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '100px' }}>
                                {selectedScenarioIds.length} Selected
                            </span>
                            <Sliders size={12} style={{ marginLeft: 4, color: '#64748b' }} />
                        </div>

                        {isScenarioOpen && (
                            <>
                                <div onClick={() => setIsScenarioOpen(false)} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 998 }} />
                                <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '4px', width: 200, background: 'white', border: '1px solid #e2e8f0', borderRadius: 6, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', zIndex: 999, padding: 8 }}>
                                    <div style={{ position: 'relative', marginBottom: 8 }}>
                                        <Search size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                        <input
                                            autoFocus
                                            placeholder="Search scenarios..."
                                            value={scenarioFilterSearch}
                                            onChange={(e) => setScenarioFilterSearch(e.target.value)}
                                            style={{ width: '100%', padding: '4px 8px 4px 24px', borderRadius: 4, border: '1px solid #e2e8f0', fontSize: 11, outline: 'none' }}
                                        />
                                    </div>
                                    <div style={{ maxHeight: 150, overflowY: 'auto' }}>
                                        {Object.values(scenarios)
                                            .filter((s: Scenario) => s.name.toLowerCase().includes(scenarioFilterSearch.toLowerCase()))
                                            .map((s: Scenario) => {
                                                const isSelected = selectedScenarioIds.includes(s.id);
                                                return (
                                                    <div
                                                        key={s.id}
                                                        onClick={() => {
                                                            if (isSelected) {
                                                                const next = selectedScenarioIds.filter((id: string) => id !== s.id);
                                                                if (next.length > 0) {
                                                                    setAppState((prev: any) => ({ ...prev, spreadsheetSelectedScenarios: next }));
                                                                    onScenarioSelect(next[next.length - 1]);
                                                                }
                                                            } else {
                                                                const next = [...selectedScenarioIds, s.id];
                                                                setAppState((prev: any) => ({ ...prev, spreadsheetSelectedScenarios: next }));
                                                                onScenarioSelect(s.id);
                                                            }
                                                        }}
                                                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px', cursor: 'pointer', fontSize: 12, borderRadius: 3, backgroundColor: isSelected ? '#f8fafc' : 'transparent' }}
                                                    >
                                                        <div style={{ width: 12, height: 12, borderRadius: '50%', border: isSelected ? '3.5px solid #3b82f6' : '1px solid #cbd5e1', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                        </div>
                                                        {renamingId === s.id ? (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }} onClick={e => e.stopPropagation()}>
                                                                <input
                                                                    autoFocus
                                                                    value={renamingName}
                                                                    onChange={(e) => setRenamingName(e.target.value)}
                                                                    onBlur={() => handleRenameConfirm(s.id)}
                                                                    onKeyDown={(e) => e.key === 'Enter' && handleRenameConfirm(s.id)}
                                                                    style={{ flex: 1, padding: '2px 4px', border: '1px solid #3b82f6', borderRadius: 2, fontSize: 11 }}
                                                                />
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <span style={{ color: isSelected ? '#3b82f6' : '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{s.name}</span>
                                                                <Edit2
                                                                    size={12}
                                                                    style={{ cursor: 'pointer', opacity: 0.5, color: '#64748b' }}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setRenamingId(s.id);
                                                                        setRenamingName(s.name);
                                                                    }}
                                                                />
                                                            </>
                                                        )}
                                                        {s.id !== 'base' && (
                                                            <div 
                                                                title="Promote to Base"
                                                                onClick={(e) => { e.stopPropagation(); onMakeBaseScenario(s.id); }}
                                                                style={{ cursor: 'pointer', opacity: 0.5, color: '#3b82f6', display: 'flex', alignItems: 'center' }}
                                                                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                                                                onMouseLeave={e => e.currentTarget.style.opacity = '0.5'}
                                                            >
                                                                 <TrendingUp size={12} />
                                                            </div>
                                                        )}
                                                        {s.isPromoted && (

                                                            <span title="Original Data (Read-Only)" style={{ fontSize: '9px', background: '#fff7ed', color: '#c2410c', padding: '1px 4px', borderRadius: '4px', border: '1px solid #ffedd5', fontWeight: 600, flexShrink: 0, display: 'flex', alignItems: 'center', gap: '2px' }}>
                                                                <Lock size={10} /> ORIGINAL
                                                            </span>
                                                        )}
                                                        {s.id !== 'base' && !s.isPromoted && renamingId !== s.id && (
                                                            <Trash2
                                                                size={14}
                                                                color="#ef4444"
                                                                style={{ cursor: 'pointer', opacity: 0.6, marginLeft: 'auto' }}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (onScenarioDelete) onScenarioDelete(s.id, e);
                                                                }}
                                                                onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                                                                onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
                                                            />
                                                        )}
                                                    </div>
                                                );
                                            })}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="v-divider" style={{ width: 1, height: 16, backgroundColor: '#e2e8f0', margin: '0 4px' }} />

                    <select
                        value={baselineScenarioId}
                        onChange={(e) => setAppState((prev: any) => ({ ...prev, baselineScenarioId: e.target.value }))}
                        className="scenario-select-mini"
                        style={{ borderColor: '#64748b' }}
                        title="Comparison Scenario"
                    >
                        {Object.values(scenarios).map((s: Scenario) => (
                            <option key={s.id} value={s.id}>Comparison: {s.name}</option>
                        ))}
                    </select>

                    <div className="v-divider" style={{ width: 1, height: 16, backgroundColor: '#e2e8f0', margin: '0 4px' }} />

                    {!showAddScenario ? (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <button className="icon-btn-sm" onClick={() => setShowAddScenario(true)} title="Save As New Scenario">
                                <Plus size={14} />
                            </button>
                        </div>
                    ) : (
                        <div className="mini-popover">
                            <input
                                autoFocus
                                className="mini-input"
                                value={newScenarioName}
                                onChange={(e) => setNewScenarioName(e.target.value)}
                                placeholder="New Scenario..."
                                onKeyDown={(e) => e.key === 'Enter' && handleAddScenario()}
                            />
                            <button className="mini-save-btn" onClick={handleAddScenario}>Save</button>
                        </div>
                    )}
                </div>

            </Panel>
            <Panel position="top-left" className="canvas-panel">
                <button className="add-root-btn" onClick={onAddRoot}>
                    <Plus size={16} /> Add Root KPI
                </button>
            </Panel>
        </>
    );
};
