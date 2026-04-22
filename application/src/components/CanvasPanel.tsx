import React, { useState } from 'react';
import { Panel } from 'reactflow';
import { 
    Layers, Plus, X 
} from 'lucide-react';
import type { Scenario, AppState } from '../types';
import ScenarioSelector from './ScenarioSelector';

interface CanvasPanelProps {
    isPresentationMode: boolean;
    setIsPresentationMode: (val: boolean) => void;
    isScenarioOpen: boolean;
    setIsScenarioOpen: (val: boolean) => void;
    activeScenarioId: string;
    selectedScenarioIds: string[];
    scenarios: Record<string, Scenario>;
    scenarioFilterSearch: string;
    setScenarioFilterSearch: (val: string) => void;
    baselineScenarioId: string;
    onScenarioSelect: (id: string) => void;
    onScenarioAdd: (name: string) => void;
    onScenarioDelete: (id: string, e?: any) => void;
    onRenameScenario: (id: string, name: string) => void;
    onToggleLock: (id: string) => void;
    setAppState: React.Dispatch<React.SetStateAction<AppState>>;
}

export const CanvasPanel: React.FC<CanvasPanelProps> = ({
    isPresentationMode,
    setIsPresentationMode,
    isScenarioOpen,
    setIsScenarioOpen,
    activeScenarioId,
    selectedScenarioIds,
    scenarios,
    baselineScenarioId,
    onScenarioSelect,
    onScenarioAdd,
    onScenarioDelete,
    onRenameScenario,
    onMakeBaseScenario,
    onAddRoot,
    onToggleLock,
    setAppState
}) => {

    const handleScenarioRename = (id: string, newName: string) => {
        onRenameScenario(id, newName);
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
            <Panel position="top-left" className="canvas-panel">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'flex-start' }}>
                    <button className="add-root-btn" onClick={onAddRoot}>
                        <Plus size={16} /> Add Root KPI
                    </button>
                    
                    <div className="scenario-controls-mini">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Layers size={14} color="#64748b" />
                            <ScenarioSelector
                                scenarios={scenarios}
                                selectedIds={[activeScenarioId]}
                                onSelect={onScenarioSelect}
                                onAdd={onScenarioAdd}
                                onDelete={onScenarioDelete}
                                onRename={handleScenarioRename}
                                onMakeBase={onMakeBaseScenario}
                                onToggleLock={onToggleLock}
                                mode="single"
                                className="active-scenario-selector"
                                placeholder="Active Scenario"
                            />
                        </div>

                        <div className="v-divider" style={{ width: 1, height: 20, backgroundColor: '#e2e8f0' }} />

                        <ScenarioSelector
                            scenarios={scenarios}
                            selectedIds={[baselineScenarioId]}
                            onSelect={(id) => setAppState((prev: any) => ({ ...prev, baselineScenarioId: id }))}
                            mode="single"
                            className="baseline-scenario-selector"
                            placeholder="Compare vs..."
                            showActions={false}
                        />
                    </div>
                </div>
            </Panel>
            <Panel position="top-right" className="canvas-panel">
                {/* Space reserved for future top-right controls */}
            </Panel>
        </>
    );
};
