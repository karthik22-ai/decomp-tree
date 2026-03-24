import { useState, useCallback, useMemo, useEffect } from 'react';
import ReactFlow, {
    Background,
    Controls,
    Panel,
    useNodesState,
    useEdgesState,
    type Connection,
    ReactFlowProvider,
    useReactFlow,
    MiniMap
} from 'reactflow';
import type { Edge, Node } from 'reactflow';
import { Routes, Route, useNavigate } from 'react-router-dom';
import 'reactflow/dist/style.css';
import { Plus, X, Trash2, Layers, TrendingUp, ChevronDown, Search } from 'lucide-react';
import { initialKPIs } from '../data';
import { WelcomeScreen } from './WelcomeScreen';
import { RawDataView } from './RawDataView';
import { apiService } from '../services/api';
import type { AppState, KPIData, FormulaType, ForecastMethod, Scenario, LogEntry } from '../types';
import dagre from 'dagre';
import KPINode from './KPINode';
import MainLayout from './MainLayout';
import SpreadsheetView from './SpreadsheetView';
import LogView from './LogView';

import ComparisonView from './ComparisonView';
import { getMonthsInRange } from '../utils/dateRange';




const SimulationCanvasInner = ({
    kpis,
    setKpis,
    calculatedValues,
    baseValues,
    monthLabels,
    onToggleExpand,
    onSimulationChange,
    onSimulationTypeToggle,
    onAddChild,
    onSettings,
    onResetKPI,
    onFullYearOverrideChange,
    onSplitToPage,
    isScenarioMode,
    onAddRoot,
    onDeleteKPI,
    scenarios,
    // activeScenarioId, // unused but kept in interface just in case
    onScenarioSelect,
    onScenarioAdd,
    onScenarioDelete,
    valueDisplayType,
    baselineScenarioId,
    setAppState,
    onDisconnect,
    isPresentationMode,
    setIsPresentationMode,
    showCharts,
    calculatedScenarioValues,
    selectedScenarioIds,
    isScenarioOpen,
    setIsScenarioOpen,
    scenarioFilterSearch,
    setScenarioFilterSearch
}: any) => {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    const [newScenarioName, setNewScenarioName] = useState('');
    const [showAddScenario, setShowAddScenario] = useState(false);
    
    const { } = useReactFlow();

    const nodeTypes = useMemo(() => ({ kpiNode: KPINode }), []);
    const edgeTypes = useMemo(() => ({}), []);


    const handleAddScenario = () => {
        if (newScenarioName.trim()) {
            onScenarioAdd(newScenarioName.trim());
            setNewScenarioName('');
            setShowAddScenario(false);
        }
    };

    // fitView prop on ReactFlow handles the initial load. 
    // Manual fitView in useEffect can be annoying if it triggers on every KPI update.
    // So we remove it to allow users to zoom/pan freely.


    const onConnect = useCallback((params: Connection) => {
        const { source, target } = params;
        if (!source || !target || source === target) return;

        setKpis((prev: any) => {
            const next = { ...prev };
            
            if (!next[source] || !next[target]) return prev;

            const targetNode = { ...next[target] };
            const oldParentId = targetNode.parentId;
            
            if (oldParentId && next[oldParentId]) {
                const oldParentNode = { ...next[oldParentId] };
                oldParentNode.children = oldParentNode.children.filter((id: string) => id !== target);
                next[oldParentId] = oldParentNode;
            }
            
            const sourceNode = { ...next[source] };
            sourceNode.children = [...new Set([...(sourceNode.children || []), target])];
            
            targetNode.parentId = source;
            if (targetNode.formula === 'NONE') {
                targetNode.formula = 'SUM'; 
            }
            
            next[source] = sourceNode;
            next[target] = targetNode;
            
            return next;
        }, true);
    }, [setKpis]);

    const onNodesDelete = useCallback((nodesToDelete: Node[]) => {
        if (nodesToDelete.length > 1) {
            if (!confirm(`Delete ${nodesToDelete.length} KPIs and their branches?`)) return;
            nodesToDelete.forEach(node => {
                onDeleteKPI(node.id, true);
            });
        } else if (nodesToDelete.length === 1) {
            onDeleteKPI(nodesToDelete[0].id);
        }
    }, [onDeleteKPI]);

    const onEdgesDelete = useCallback((edgesToDelete: Edge[]) => {
        edgesToDelete.forEach(edge => {
            const source = edge.source;
            const target = edge.target;
            setKpis((prev: any) => {
                if (!prev[source] || !prev[target]) return prev;
                return {
                    ...prev,
                    [source]: { ...prev[source], children: prev[source].children.filter((id: string) => id !== target) },
                    [target]: { ...prev[target], parentId: undefined }
                };
            }, true);
        });
    }, [setKpis]);

    // Generate a structural fingerprint to prevent layout recalculation on value changes
    const layoutFingerprint = useMemo(() => {
        return Object.values(kpis).map((k: any) => 
            `${k.id}-${k.parentId}-${k.children.join(',')}-${k.isExpanded}-${k.color}`
        ).sort().join('|');
    }, [kpis]);

    // Compute layout positions only when structure changes
    const layoutPositions = useMemo(() => {
        const dagreGraph = new dagre.graphlib.Graph();
        dagreGraph.setDefaultEdgeLabel(() => ({}));
        const nodeWidth = 280;
        const nodeHeight = 300;
        dagreGraph.setGraph({ rankdir: 'LR', nodesep: 50, ranksep: 100 });

        const roots = Object.values(kpis).filter((k: any) => !k.parentId || !kpis[k.parentId]);
        const visited = new Set<string>();
        const edges: Edge[] = [];
        const nodesInLayout: string[] = [];

        const traverse = (kpi: any) => {
            if (visited.has(kpi.id)) return;
            visited.add(kpi.id);
            nodesInLayout.push(kpi.id);
            dagreGraph.setNode(kpi.id, { width: nodeWidth, height: nodeHeight });

            if (kpi.isExpanded) {
                kpi.children.forEach((childId: string) => {
                    const child = kpis[childId];
                    if (child) {
                        edges.push({
                            id: `e-${kpi.id}-${childId}`,
                            source: kpi.id,
                            target: childId,
                            type: 'smoothstep',
                            animated: false,
                            style: { strokeWidth: 2, stroke: kpi.color || '#cbd5e1' }
                        });
                        dagreGraph.setEdge(kpi.id, childId);
                        traverse(child);
                    }
                });
            }
        };

        roots.forEach(r => traverse(r));
        dagre.layout(dagreGraph);

        const positions: Record<string, {x: number, y: number}> = {};
        nodesInLayout.forEach(id => {
            const pos = dagreGraph.node(id);
            if (pos) {
                positions[id] = {
                    x: pos.x - nodeWidth / 2,
                    y: pos.y - nodeHeight / 2
                };
            }
        });

        return { positions, edges };
    }, [layoutFingerprint]);

    // Initial node/edge creation when layout changes
    useEffect(() => {
        const { positions, edges: newEdges } = layoutPositions;
        
        setNodes(currNodes => {
            const existingPositions = new Map(currNodes.map(n => [n.id, n.position]));
            return Object.keys(positions).map(id => {
                const kpi = kpis[id];
                const pos = existingPositions.get(id) || positions[id];
                return {
                    id,
                    type: 'kpiNode',
                    position: pos,
                    data: {
                        ...kpi,
                        _kpiRef: kpi,
                        onToggleExpand,
                        onSimulationChange,
                        onSimulationTypeToggle,
                        onAddChild,
                        onSettings,
                        onResetKPI,
                        onFullYearOverrideChange,
                        onSplitToPage,
                        baselineData: baseValues[id] ?? [],
                        calculatedValue: calculatedValues[id] ?? [],
                        monthLabels,
                        isScenarioMode,
                        desiredTrend: kpi?.desiredTrend,
                        valueDisplayType: valueDisplayType || 'absolute',
                        onDisconnect,
                        showCharts
                    }
                };
            });
        });
        setEdges(newEdges);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [layoutPositions, setNodes, setEdges]);

    // Efficiently update node data when values change without recreating nodes
    useEffect(() => {
        setNodes(nds => {
            let hasChanges = false;
            const newNodes = nds.map(node => {
                const kpi = kpis[node.id];
                if (!kpi) return node;
                
                const newVal = calculatedValues[node.id];
                const baseVal = baseValues[node.id];
                
                // Extremely fast reference check: saves massive panning/scrolling lag
                if (node.data._kpiRef === kpi && 
                    node.data.calculatedValue === newVal && 
                    node.data.baselineData === baseVal && 
                    node.data.valueDisplayType === valueDisplayType &&
                    node.data.showCharts === showCharts &&
                    node.data.selectedScenarioIds === selectedScenarioIds &&
                    node.data.calculatedScenarioValues === calculatedScenarioValues &&
                    node.data.isScenarioMode === isScenarioMode) {
                    return node;
                }

                hasChanges = true;
                return {
                    ...node,
                    data: {
                        ...node.data,
                        ...kpi,
                        _kpiRef: kpi,
                        baselineData: baseVal ?? [],
                        calculatedValue: newVal ?? [],
                        valueDisplayType: valueDisplayType || 'absolute',
                        onToggleExpand,
                        onSimulationChange,
                        onSimulationTypeToggle,
                        onAddChild,
                        onSettings,
                        onResetKPI,
                        onFullYearOverrideChange,
                        onSplitToPage,
                        monthLabels,
                        isScenarioMode,
                        desiredTrend: kpi.desiredTrend,
                        onDisconnect,
                        showCharts,
                        calculatedScenarioValues,
                        selectedScenarioIds,
                        scenarios
                    }
                };
            });
            
            return hasChanges ? newNodes : nds;
        });
    }, [calculatedValues, baseValues, valueDisplayType, kpis, setNodes,
        onToggleExpand, onSimulationChange, onSimulationTypeToggle,
        onAddChild, onSettings, onResetKPI, onFullYearOverrideChange,
        onSplitToPage, monthLabels, isScenarioMode, onDisconnect, showCharts,
        calculatedScenarioValues, selectedScenarioIds, scenarios]);

    return (
        <div className={`canvas-wrapper ${isPresentationMode ? 'fixed inset-0 z-[100] bg-slate-50' : ''}`}>
            {isPresentationMode && (
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
            )}
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodesDelete={onNodesDelete}
                onEdgesDelete={onEdgesDelete}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                fitView
            >
                <Background />
                <Controls />
                <MiniMap 
                    nodeStrokeColor={(n) => {
                        if (n.type === 'kpiNode') return '#0f172a'; // Darker stroke
                        return '#cbd5e1';
                    }}
                    nodeBorderRadius={2}
                    pannable
                    nodeColor={(n) => {
                        if (n.type === 'kpiNode') return '#3b82f6'; // Bright blue for nodes
                        return '#94a3b8';
                    }}
                    style={{ border: '2px solid #94a3b8', borderRadius: '4px', backgroundColor: '#f1f5f9' }} // Light gray background
                />
                {!isPresentationMode && (
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
                                        <ChevronDown size={12} style={{ marginLeft: 4, color: '#64748b' }} />
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
                                                        .filter((s: any) => s.name.toLowerCase().includes(scenarioFilterSearch.toLowerCase()))
                                                        .map((s: any) => {
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
                                                                    <span style={{ color: isSelected ? '#3b82f6' : '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                                                                    {s.id !== 'base' && (
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
                                    {Object.values(scenarios as Record<string, Scenario>).map((s: Scenario) => (
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
                )}
            </ReactFlow>
        </div>
    );
};

interface SimulationCanvasProps {
    projectId: string;
    isSampleMode: boolean;
    onBack: () => void;
}

const SimulationCanvas: React.FC<SimulationCanvasProps> = ({ projectId, isSampleMode, onBack }) => {
    const months = useMemo(() => ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], []);
    const navigate = useNavigate();



    const [isLoadingData, setIsLoadingData] = useState(true);
    const [showPromotionSuccess, setShowPromotionSuccess] = useState(false);
    const [isPresentationMode, setIsPresentationMode] = useState(false);

    // Handle ESC key to exit presentation mode
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isPresentationMode) {
                setIsPresentationMode(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isPresentationMode]);

    const [appState, setAppState] = useState<AppState>({
        scenarios: {
            'base': { id: 'base', name: 'Base Scenario', kpis: isSampleMode ? initialKPIs : {}, createdAt: new Date().toISOString() }
        },
        activeScenarioId: 'base',
        baselineScenarioId: 'base',
        dateRange: {
            startMonth: 0,
            startYear: new Date().getFullYear(),
            endMonth: 11,
            endYear: new Date().getFullYear()
        },
        activityLog: [],
        isSyncEnabled: true,
        valueDisplayType: 'absolute',
        pages: [{ id: 'page-1', name: 'Page 1' }],
        activePageId: 'page-1',
        columnMappings: {}
    });

    // Load state from DB (Backend Segment)
    useEffect(() => {
        const loadState = async () => {
            setIsLoadingData(true);
            try {
                const response = await apiService.getProjectState(projectId);
                if (response && response.state) {
                    let saved = response.state;
                    if (!saved.dateRange) {
                        saved.dateRange = {
                            startMonth: 0,
                            startYear: (saved as any).selectedYear || new Date().getFullYear(),
                            endMonth: 11,
                            endYear: (saved as any).selectedYear || new Date().getFullYear()
                        };
                    }
                    if (saved.valueDisplayType === undefined) {
                        saved.valueDisplayType = 'absolute';
                    }
                    if (response.raw_rows) {
                    saved.rawImportData = response.raw_rows;
                    }
                    setAppState(saved);
                } else {
                    // Reset to initial state for new/blank project
                    setAppState({
                        scenarios: {
                            'base': { id: 'base', name: 'Base Scenario', kpis: isSampleMode ? initialKPIs : {}, createdAt: new Date().toISOString() }
                        },
                        activeScenarioId: 'base',
                        baselineScenarioId: 'base',
                        dateRange: {
                            startMonth: 0,
                            startYear: new Date().getFullYear(),
                            endMonth: 11,
                            endYear: new Date().getFullYear()
                        },
                        activityLog: [],
                        isSyncEnabled: true,
                        valueDisplayType: 'absolute',
                        pages: [{ id: 'page-1', name: 'Page 1' }],
                        activePageId: 'page-1'
                    });
                }
            } catch (e) {
                console.error('Failed to load state from backend', e);
            } finally {
                setIsLoadingData(false);
            }
        };
        loadState();
    }, [projectId, isSampleMode]);

    // Save state to Backend with debounce
    useEffect(() => {
        if (isLoadingData) return;

        const timer = setTimeout(() => {
            apiService.saveProjectState(projectId, appState);
        }, 1000); // 1s debounce for auto-save

        return () => clearTimeout(timer);
    }, [appState, projectId, isLoadingData]);

    const activePageId = appState.activePageId || 'page-1';

    const logActivity = useCallback((entry: Omit<LogEntry, 'id' | 'timestamp'>) => {
        setAppState(prev => {
            const newLog: LogEntry = {
                id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                timestamp: new Date().toISOString(),
                ...entry
            };
            return {
                ...prev,
                activityLog: [newLog, ...(prev.activityLog || [])].slice(0, 100)
            };
        });
    }, []);

    const [editingId, setEditingId] = useState<string | null>(null);
    const [isScenarioOpen, setIsScenarioOpen] = useState(false);
    const [scenarioFilterSearch, setScenarioFilterSearch] = useState('');
    const [settingsShowSlider, setSettingsShowSlider] = useState(false);
    const [settingsSliderValue, setSettingsSliderValue] = useState(0);
    const [settingsSliderBase, setSettingsSliderBase] = useState(0);
    const [showForecastModal, setShowForecastModal] = useState(false);
    const [forecastConfig, setForecastConfig] = useState<{ method: ForecastMethod, growthRate: number }>({ method: 'LINEAR_TREND', growthRate: 5 });

    // Suggestion state for Modal
    const [formulaSuggestions, setFormulaSuggestions] = useState<KPIData[]>([]);
    const [suggestionIndex, setSuggestionIndex] = useState(0);

    // Bulk Adjust state
    const [bulkPercentage, setBulkPercentage] = useState<string>('0');
    const [bulkStartMonth, setBulkStartMonth] = useState(0);
    const [bulkStartYear, setBulkStartYear] = useState(2024);
    const [bulkEndMonth, setBulkEndMonth] = useState(11);
    const [bulkEndYear, setBulkEndYear] = useState(2024);

    const [isCalculating, setIsCalculating] = useState(false);
    const [calculatedValues, setCalculatedValues] = useState<Record<string, number[]>>({});
    const [baseValues, setBaseValues] = useState<Record<string, number[]>>({});
    const [calculatedScenarioValues, setCalculatedScenarioValues] = useState<Record<string, Record<string, number[]>>>({});

    const activeScenario = appState.scenarios[appState.activeScenarioId];
    const kpis = activeScenario.kpis;
    const selectedScenarioIds = useMemo(() => appState.spreadsheetSelectedScenarios || [appState.activeScenarioId], [appState.spreadsheetSelectedScenarios, appState.activeScenarioId]);

    // Trigger calculation when KPIs or DataRange changes
    useEffect(() => {
        let isMounted = true;
        const calculate = async () => {
            setIsCalculating(true);
            try {
                const currentBaselineId = appState.baselineScenarioId || 'base';
                
                // Collect scenarios to calculate: active, baseline, and all selected scenarios for spreadsheet
                const scenariosToCalculate = new Set([appState.activeScenarioId, currentBaselineId, ...(appState.spreadsheetSelectedScenarios || [])]);
                
                const promises = Array.from(scenariosToCalculate).map(async (scenId) => {
                    const sceneKpis = appState.scenarios[scenId]?.kpis || kpis;
                    const res = await apiService.calculate(sceneKpis, appState.dateRange);
                    return { id: scenId, results: res.results, rawResponse: res };
                });

                const results = await Promise.all(promises);

                if (!isMounted) return;
                
                const newScenarioValues: Record<string, Record<string, number[]>> = {};
                let activeRawResponse = null;

                results.forEach(({ id, results, rawResponse }) => {
                    newScenarioValues[id] = results;
                    if (id === appState.activeScenarioId) {
                        setCalculatedValues(results);
                        activeRawResponse = rawResponse;
                    }
                    if (id === currentBaselineId) {
                        setBaseValues(results);
                    }
                });

                setCalculatedScenarioValues(newScenarioValues);

                const updateLogWithImpact = (response: any) => {
                    if (response?.impactedKpis?.length > 0) {
                        setAppState(prev => {
                            const logs = [...(prev.activityLog || [])];
                            if (logs.length > 0 && !logs[0].impactedKpis) {
                                if (new Date().getTime() - new Date(logs[0].timestamp).getTime() < 5000) {
                                    const impacted = response.impactedKpis.filter((id: string) => id !== logs[0].kpiId);
                                    if (impacted.length > 0) {
                                        logs[0] = { ...logs[0], impactedKpis: impacted };
                                        return { ...prev, activityLog: logs };
                                    }
                                }
                            }
                            return prev;
                        });
                    }
                };

                if (activeRawResponse) {
                    updateLogWithImpact(activeRawResponse);
                }

            } catch (err) {
                console.error('Calculation error:', err);
            } finally {
                if (isMounted) setIsCalculating(false);
            }
        };

        const timer = setTimeout(calculate, 300); // 300ms debounce
        return () => {
            isMounted = false;
            clearTimeout(timer);
        };
    }, [kpis, appState.dateRange, appState.activeScenarioId, appState.baselineScenarioId, appState.spreadsheetSelectedScenarios, appState.scenarios]);

    const setKpis = useCallback((updater: (prev: Record<string, KPIData>) => Record<string, KPIData>, forceUpdateBase: boolean = false, targetScenarioId?: string) => {
        setAppState(prev => {
            const activeId = targetScenarioId || prev.activeScenarioId;
            if (activeId === 'base' && !forceUpdateBase) {
                const newId = `scenario-${Date.now()}`;
                const baseName = "Scenario";
                const existingCount = Object.values(prev.scenarios).filter(s => s.name.startsWith(baseName)).length;
                const newName = `${baseName} ${existingCount + 1}`;
                
                return {
                    ...prev,
                    scenarios: {
                        ...prev.scenarios,
                        [newId]: { 
                            id: newId, 
                            name: newName, 
                            kpis: updater(JSON.parse(JSON.stringify(prev.scenarios['base'].kpis))), 
                            createdAt: new Date().toISOString() 
                        }
                    },
                    activeScenarioId: newId
                };
            }
            
            return {
                ...prev,
                scenarios: {
                    ...prev.scenarios,
                    [activeId]: {
                        ...prev.scenarios[activeId],
                        kpis: updater(prev.scenarios[activeId].kpis)
                    }
                }
            };
        });
    }, []);

    const monthLabels = useMemo(() => {
        const monthsInRange = getMonthsInRange(
            appState.dateRange.startMonth,
            appState.dateRange.startYear,
            appState.dateRange.endMonth,
            appState.dateRange.endYear
        );
        return monthsInRange.map(m => m.label.split(' ')[0]); // Get 'Jan', 'Feb', etc.
    }, [appState.dateRange]);
        
    // Filter KPIs for current page display, but calculations should use ALL KPIs
    const filteredKpis = useMemo(() => {
        const result: Record<string, KPIData> = {};
        Object.keys(kpis).forEach(id => {
            if (kpis[id].pageId === activePageId || (!kpis[id].pageId && activePageId === 'page-1')) {
                result[id] = kpis[id];
            }
        });
        return result;
    }, [kpis, activePageId]);
    


    const onSyncToggle = useCallback(() => {
        setAppState(prev => ({ ...prev, isSyncEnabled: !prev.isSyncEnabled }));
    }, []);

    const onValueDisplayTypeChange = useCallback((type: 'absolute' | 'variance') => {
        setAppState(prev => ({ ...prev, valueDisplayType: type }));
    }, []);

    const onScenarioAdd = useCallback((name: string, snapshot?: Record<string, KPIData>) => {
        const id = `scenario-${Date.now()}`;
        setAppState(prev => ({
            ...prev,
            scenarios: {
                ...prev.scenarios,
                [id]: { id, name, kpis: snapshot ? JSON.parse(JSON.stringify(snapshot)) : JSON.parse(JSON.stringify(kpis)), createdAt: new Date().toISOString() }
            },
            activeScenarioId: id
        }));
    }, [kpis]);

    const onScenarioDelete = useCallback((id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        if (id === 'base') {
            alert("Cannot delete the Base Scenario.");
            return;
        }
        if (!confirm("Are you sure you want to delete this scenario?")) return;

        setAppState(prev => {
            const newScenarios = { ...prev.scenarios };
            delete newScenarios[id];

            // Update active/baseline scenario if needed
            const remainingIds = Object.keys(newScenarios);
            const nextActiveId = prev.activeScenarioId === id 
                ? (remainingIds.includes('base') ? 'base' : remainingIds[0]) 
                : prev.activeScenarioId;
            const nextBaselineId = prev.baselineScenarioId === id
                ? (remainingIds.includes('base') ? 'base' : remainingIds[0])
                : prev.baselineScenarioId;

            // Update spreadsheet selected scenarios
            const nextSpreadsheetSelected = prev.spreadsheetSelectedScenarios 
                ? prev.spreadsheetSelectedScenarios.filter((sid: string) => sid !== id)
                : undefined;

            return {
                ...prev,
                scenarios: newScenarios,
                activeScenarioId: nextActiveId,
                baselineScenarioId: nextBaselineId,
                spreadsheetSelectedScenarios: nextSpreadsheetSelected && nextSpreadsheetSelected.length > 0 
                    ? nextSpreadsheetSelected 
                    : [nextActiveId]
            };
        });
    }, []);

    const handleMakeBaseScenario = useCallback(() => {
        setAppState(prev => {
            if (prev.activeScenarioId === 'base') return prev;
            
            const activeScenario = prev.scenarios[prev.activeScenarioId];
            if (!activeScenario) return prev;

            const updatedBaseKpis = JSON.parse(JSON.stringify(activeScenario.kpis));

            return {
                ...prev,
                scenarios: {
                    ...prev.scenarios,
                    ['base']: {
                        ...prev.scenarios['base'],
                        kpis: updatedBaseKpis
                    }
                },
                activeScenarioId: 'base'
            };
        });
    }, []);

    const onScenarioSelect = useCallback((id: string) => {
        setAppState(prev => ({ ...prev, activeScenarioId: id }));
    }, []);

    const onSplitToPage = useCallback((nodeId: string) => {
        const newPageId = `page-${Date.now()}`;
        setAppState(prev => {
            const activeScenarioKpis = prev.scenarios[prev.activeScenarioId]?.kpis || {};
            const newPages = [...(prev.pages || []), { id: newPageId, name: activeScenarioKpis[nodeId]?.label || 'New Page' }];
            const updatedScenarios = { ...prev.scenarios };
            
            Object.keys(updatedScenarios).forEach(sid => {
                const scenarioKpis = { ...updatedScenarios[sid].kpis };
                
                // Keep track of old -> new ID mappings for this scenario so we can rewire children
                const idMapping: Record<string, string> = {};
                
                // Helper to deep clone a subtree
                const duplicateSubtree = (currentId: string, isRoot = false): string | null => {
                    const originalNode = scenarioKpis[currentId];
                    if (!originalNode) return null;
                    
                    const newId = `${currentId}-copy-${Date.now()}`;
                    idMapping[currentId] = newId;
                    
                    const clonedNode: KPIData = {
                        ...originalNode,
                        id: newId,
                        pageId: newPageId,
                        // The root of the split subtree has no parent. Others will be wired up below.
                        parentId: isRoot ? undefined : undefined,
                        children: [] 
                    };
                    
                    scenarioKpis[newId] = clonedNode;
                    
                    originalNode.children.forEach(childId => {
                        const newChildId = duplicateSubtree(childId);
                        if (newChildId) {
                            clonedNode.children.push(newChildId);
                            // Link child back to parent
                            if (scenarioKpis[newChildId]) {
                                scenarioKpis[newChildId].parentId = newId;
                            }
                        }
                    });
                    
                    return newId;
                };

                // Duplicate the requested subtree, marking it as the root of the new tree
                duplicateSubtree(nodeId, true);
                
                // Rewrite custom formulas in the cloned nodes to point to the New IDs if they reference nodes within the same cloned subtree
                Object.values(idMapping).forEach(newId => {
                    const clonedNode = scenarioKpis[newId];
                    if (clonedNode && clonedNode.formula === 'CUSTOM' && clonedNode.customFormula) {
                        let updatedFormula = clonedNode.customFormula;
                        Object.entries(idMapping).forEach(([oldRefId, newRefId]) => {
                            // Replace [oldId] with [newId]
                            const refRegex = new RegExp(`\\[${oldRefId}\\]`, 'g');
                            updatedFormula = updatedFormula.replace(refRegex, `[${newRefId}]`);
                        });
                        clonedNode.customFormula = updatedFormula;
                    }
                });
                
                updatedScenarios[sid] = { ...updatedScenarios[sid], kpis: scenarioKpis };
            });

            return {
                ...prev,
                pages: newPages,
                activePageId: newPageId,
                scenarios: updatedScenarios
            };
        });
    }, [kpis]);

    const handleToggleExpand = useCallback((id: string) => {
        setAppState(prev => {
            const activeId = prev.activeScenarioId;
            const toggleValue = prev.scenarios[activeId]?.kpis[id] ? !prev.scenarios[activeId].kpis[id].isExpanded : true;
            
            const nextScenarios = { ...prev.scenarios };
            Object.keys(nextScenarios).forEach(scenId => {
                if (nextScenarios[scenId].kpis[id]) {
                    nextScenarios[scenId] = {
                        ...nextScenarios[scenId],
                        kpis: {
                            ...nextScenarios[scenId].kpis,
                            [id]: {
                                ...nextScenarios[scenId].kpis[id],
                                isExpanded: toggleValue
                            }
                        }
                    };
                }
            });
            return { ...prev, scenarios: nextScenarios };
        });
    }, []);
    const handleCustomDataImport = useCallback((newKpis: Record<string, KPIData>) => {
        setIsCalculating(true);
        const activePageId = appState.activePageId;
        
        // Ensure imported KPIs are assigned to the active page if not already assigned
        const processedKpis = { ...newKpis };
        Object.keys(processedKpis).forEach(id => {
            if (!processedKpis[id].pageId) {
                processedKpis[id].pageId = activePageId;
            }
        });

        setKpis(prev => {
            const merged = { ...prev, ...processedKpis };
            return merged;
        });

        setTimeout(() => setIsCalculating(false), 800);
    }, [appState.activePageId, appState.activeScenarioId]);

    const onSimulationChange = useCallback((id: string, value: number) => {
        const kpiName = kpis[id]?.label || id;
        const oldVal = kpis[id]?.simulationValue ?? 0;
        const delta = value - oldVal;

        // Post-calculation logging will happen after the async update
        
        logActivity({
            action: 'Simulation Changed',
            details: `Adjusted simulation on "${kpiName}" to ${value}`,
            oldValue: oldVal,
            newValue: value,
            kpiId: id
        });

        setKpis(prev => {
            const next = { ...prev };
            next[id] = { ...next[id], simulationValue: value };
            
            if (delta !== 0) {
                let currParent = next[id].parentId;
                while (currParent && next[currParent]) {
                    const parentData = next[currParent];
                    let changed = false;
                    
                    let parentOverrides = parentData.monthlyOverrides ? [...parentData.monthlyOverrides] : undefined;
                    if (parentOverrides) {
                        // Distribute simulation delta evenly across the 12 months for the parent's rigid monthly hooks
                        const monthlyDelta = delta / 12;
                        parentOverrides.forEach((val, mIdx) => {
                            if (typeof val === 'number') {
                                parentOverrides![mIdx] = val + monthlyDelta;
                                changed = true;
                            }
                        });
                    }
                    
                    let newFyOverride = parentData.fullYearOverride;
                    if (typeof newFyOverride === 'number') {
                        newFyOverride += delta;
                        changed = true;
                    }

                    if (changed) {
                        next[currParent] = {
                            ...parentData,
                            monthlyOverrides: parentOverrides,
                            fullYearOverride: newFyOverride
                        };
                    }
                    currParent = parentData.parentId;
                }
            }
            return next;
        });
    }, [setKpis, kpis, appState.dateRange, logActivity]);

    const onMonthlyOverrideChange = useCallback((id: string, monthIdx: number, value: number | string | undefined, targetScenarioId?: string) => {
        const targetScenKpis = targetScenarioId ? (appState.scenarios[targetScenarioId]?.kpis || kpis) : kpis;
        const kpiName = targetScenKpis[id]?.label || id;
        // Use the actual displayed calculated value as old value, not raw data
        const oldVal = targetScenarioId ? (targetScenarioId === appState.activeScenarioId ? calculatedValues[id]?.[monthIdx] : 0) : calculatedValues[id]?.[monthIdx] ?? 0;

        logActivity({
            action: 'Monthly Override',
            details: `Override on "${kpiName}" for month index ${monthIdx}`,
            oldValue: oldVal,
            newValue: value,
            kpiId: id
        });

        setKpis(prev => {
            const next = { ...prev };
            const kpi = next[id];
            
            let delta = 0;
            if (typeof value === 'number') {
                delta = value - oldVal;
            }

            const overrides = [...(kpi.monthlyOverrides || Array(12).fill(undefined))];
            overrides[monthIdx] = value;
            
            next[id] = { ...kpi, monthlyOverrides: overrides, fullYearOverride: undefined };

            if (delta !== 0) {
                let currParent = next[id].parentId;
                while (currParent && next[currParent]) {
                    const parentData = next[currParent];
                    let changed = false;
                    let parentOverrides = parentData.monthlyOverrides ? [...parentData.monthlyOverrides] : undefined;
                    
                    if (parentOverrides && typeof parentOverrides[monthIdx] === 'number') {
                        parentOverrides[monthIdx] = (parentOverrides[monthIdx] as number) + delta;
                        changed = true;
                    }
                    
                    let newFyOverride = parentData.fullYearOverride;
                    if (typeof newFyOverride === 'number') {
                        newFyOverride += delta;
                        changed = true;
                    }

                    if (changed) {
                        next[currParent] = {
                            ...parentData,
                            monthlyOverrides: parentOverrides,
                            fullYearOverride: newFyOverride
                        };
                    }
                    currParent = parentData.parentId;
                }
            }
            
            // Distribute down to children
            if (delta !== 0) {
                const distributeToChildren = (nodeId: string, currentDelta: number) => {
                    const nodeData = next[nodeId];
                    if (!nodeData || !nodeData.children || nodeData.children.length === 0) return;
                    
                    const mutableChildren = nodeData.children.filter(cid => {
                        const c = next[cid];
                        return c && !c.isLocked && !c.lockedMonths?.[monthIdx];
                    });

                    if (mutableChildren.length === 0) return;
                    
                    const oldTotal = mutableChildren.reduce((sum, cid) => sum + (calculatedValues[cid]?.[monthIdx] ?? 0), 0);
                    
                    mutableChildren.forEach(cid => {
                        const cNode = next[cid];
                        if (!cNode) return;
                        
                        const cOldVal = calculatedValues[cid]?.[monthIdx] ?? 0;
                        const cDelta = oldTotal === 0 ? (currentDelta / mutableChildren.length) : currentDelta * (cOldVal / oldTotal);
                        
                        const cOverrides = [...(cNode.monthlyOverrides || Array(12).fill(undefined))];
                        const prevOverride = typeof cOverrides[monthIdx] === 'number' ? cOverrides[monthIdx] : cOldVal;
                        cOverrides[monthIdx] = (prevOverride as number) + cDelta;
                        
                        next[cid] = { ...cNode, monthlyOverrides: cOverrides, fullYearOverride: undefined };
                        distributeToChildren(cid, cDelta);
                    });
                };
                distributeToChildren(id, delta);
            }

            return next;
        }, false, targetScenarioId);
    }, [setKpis, kpis, calculatedValues, appState.dateRange, logActivity, appState.scenarios, appState.activeScenarioId]);

    const handleDisconnect = useCallback((id: string) => {
        const kpiName = kpis[id]?.label || id;
        const parentId = kpis[id]?.parentId;

        if (!parentId) return;

        logActivity({
            action: 'KPI Disconnected',
            details: `Disconnected "${kpiName}" from its parent`,
            kpiId: id,
        });

        setKpis(prev => {
            const next = { ...prev };
            if (parentId && next[parentId]) {
                next[parentId] = {
                    ...next[parentId],
                    children: next[parentId].children.filter(cid => cid !== id)
                };
            }
            next[id] = { ...next[id], parentId: undefined };
            return next;
        });
    }, [kpis, setKpis, logActivity]);

    const onFullYearOverrideChange = useCallback((id: string, value: number | undefined, targetScenarioId?: string) => {
        const targetScenKpis = targetScenarioId ? (appState.scenarios[targetScenarioId]?.kpis || kpis) : kpis;
        const kpiName = targetScenKpis[id]?.label || id;
        const months = calculatedValues[id]?.slice(0, -1) || [];
        const oldVal = targetScenKpis[id]?.fullYearOverride ?? months.reduce((a: number, b: number) => a + b, 0);
        const delta = typeof value === 'number' ? value - oldVal : 0;

        logActivity({
            action: 'Full Year Override',
            details: `Full year override set to ${value} on "${kpiName}"`,
            oldValue: oldVal,
            newValue: value,
            kpiId: id
        });

        setKpis(prev => {
            const next = { ...prev };
            next[id] = { ...next[id], fullYearOverride: value };
            
            if (delta !== 0) {
                let currParent = next[id].parentId;
                while (currParent && next[currParent]) {
                    const parentData = next[currParent];
                    if (typeof parentData.fullYearOverride === 'number') {
                        next[currParent] = {
                            ...parentData,
                            fullYearOverride: parentData.fullYearOverride + delta
                        };
                    }
                    currParent = parentData.parentId;
                }
            }

            // Distribute down to children for full year
            if (delta !== 0) {
                const distributeToChildrenFY = (nodeId: string, currentDelta: number) => {
                    const nodeData = next[nodeId];
                    if (!nodeData || !nodeData.children || nodeData.children.length === 0) return;
                    
                    const mutableChildren = nodeData.children.filter(cid => {
                        const c = next[cid];
                        return c && !c.isLocked;
                    });

                    if (mutableChildren.length === 0) return;

                    const oldTotal = mutableChildren.reduce((sum, cid) => {
                        const mVals = calculatedValues[cid]?.slice(0, -1) || [];
                        const cOldFY = next[cid]?.fullYearOverride ?? mVals.reduce((a, b) => a + b, 0);
                        return sum + cOldFY;
                    }, 0);
                    
                    mutableChildren.forEach(cid => {
                        const cNode = next[cid];
                        if (!cNode) return;
                        
                        const mVals = calculatedValues[cid]?.slice(0, -1) || [];
                        const cOldVal = cNode.fullYearOverride ?? mVals.reduce((a, b) => a + b, 0);
                        const cDelta = oldTotal === 0 ? (currentDelta / mutableChildren.length) : currentDelta * (cOldVal / oldTotal);
                        
                        const newFY = cOldVal + cDelta;
                        next[cid] = { ...cNode, fullYearOverride: newFY };
                        distributeToChildrenFY(cid, cDelta);
                    });
                };
                distributeToChildrenFY(id, delta);
            }

            return next;
        }, false, targetScenarioId);
    }, [setKpis, kpis, calculatedValues, appState.dateRange, logActivity, appState.scenarios, appState.activeScenarioId]);

    const onSimulationTypeToggle = useCallback((id: string) => {
        setKpis(prev => ({
            ...prev,
            [id]: {
                ...prev[id],
                simulationType: prev[id].simulationType === 'PERCENT' ? 'ABSOLUTE' : 'PERCENT',
                simulationValue: 0
            }
        }));
    }, [setKpis]);

    const onLabelChange = useCallback((id: string, label: string) => {
        setKpis(prev => ({
            ...prev,
            [id]: { ...prev[id], label }
        }), true);
    }, [setKpis]);

    const onUnitChange = useCallback((id: string, unit: string) => {
        setKpis(prev => ({
            ...prev,
            [id]: { ...prev[id], unit }
        }), true);
    }, [setKpis]);

    const onAddChild = useCallback((parentId: string) => {
        const parent = kpis[parentId];
        const newId = `kpi-${Date.now()}`;
        const baseVal = parent?.formula === 'PRODUCT' ? 1 : 100;
        const fullMonths = getMonthsInRange(appState.dateRange.startMonth, appState.dateRange.startYear, appState.dateRange.endMonth, appState.dateRange.endYear);
        const newNode: KPIData = {
            id: newId,
            label: 'New Node',
            data: fullMonths.map(m => ({ month: m.label, actual: baseVal })),
            unit: parent?.unit || '',
            formula: 'NONE',
            children: [],
            parentId: parentId,
            isExpanded: false,
            simulationValue: 0,
            simulationType: 'PERCENT',
        };

        setKpis(prev => ({
            ...prev,
            [newId]: newNode,
            [parentId]: { ...prev[parentId], children: [...prev[parentId].children, newId], isExpanded: true }
        }), true);
    }, [kpis, months, setKpis]);

    const onAddRoot = useCallback((initialData?: { label?: string; unit?: string; monthlyOverrides?: (number | string | undefined)[] }) => {
        const newId = `kpi-${Date.now()}`;
        const fullMonths = getMonthsInRange(appState.dateRange.startMonth, appState.dateRange.startYear, appState.dateRange.endMonth, appState.dateRange.endYear);
        const newNode: KPIData = {
            id: newId,
            label: initialData?.label || 'New KPI',
            data: fullMonths.map(m => ({ month: m.label, actual: 1000 })),
            unit: initialData?.unit || '$',
            formula: 'NONE',
            children: [],
            isExpanded: true,
            monthlyOverrides: initialData?.monthlyOverrides,
            simulationValue: 0,
            simulationType: 'PERCENT',
            pageId: activePageId
        };
        setKpis(prev => ({ ...prev, [newId]: newNode }), true);
    }, [months, setKpis, activePageId]);

    const onAddPage = useCallback(() => {
        const newPageId = `page-${Date.now()}`;
        setAppState(prev => ({
            ...prev,
            pages: [...(prev.pages || []), { id: newPageId, name: `Page ${(prev.pages || []).length + 1}` }],
            activePageId: newPageId
        }));
    }, []);

    const onRenamePage = useCallback((id: string, name: string) => {
        setAppState(prev => ({
            ...prev,
            pages: (prev.pages || []).map(p => p.id === id ? { ...p, name } : p)
        }));
    }, []);

    const onSelectPage = useCallback((id: string) => {
        setAppState(prev => ({ ...prev, activePageId: id }));
    }, []);


    const onDeletePage = useCallback((id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const pages = appState.pages || [];
        if (pages.length <= 1) {
            alert("Cannot delete the last page.");
            return;
        }
        if (!confirm("Are you sure you want to delete this page? All KPIs on this page will be permanently deleted.")) return;

        setAppState(prev => {
            const pages = prev.pages || [];
            const newPages = pages.filter(p => p.id !== id);
            const newActiveId = prev.activePageId === id ? newPages[0].id : prev.activePageId;

            
            // Delete KPIs from this page
            const newScenarios = { ...prev.scenarios };
            Object.keys(newScenarios).forEach(sid => {
                const kpis = { ...newScenarios[sid].kpis };
                
                // Find all nodes on this page
                const nodesToDelete = Object.keys(kpis).filter(kid => kpis[kid].pageId === id);
                
                nodesToDelete.forEach(kid => {
                    const node = kpis[kid];
                    // Safely remove this node from its parent's children array to prevent ghost references
                    if (node.parentId && kpis[node.parentId]) {
                        kpis[node.parentId] = {
                            ...kpis[node.parentId],
                            children: (kpis[node.parentId].children || []).filter(cId => cId !== kid)
                        };
                    }
                    // Delete node itself
                    delete kpis[kid];
                });

                newScenarios[sid] = { ...newScenarios[sid], kpis };
            });

            return {
                ...prev,
                pages: newPages,
                activePageId: newActiveId,
                scenarios: newScenarios
            };
        });
    }, [appState.pages?.length]);


    const onRowLockToggle = useCallback((id: string) => {
        const kpiName = kpis[id]?.label || id;
        const willLock = !kpis[id]?.isLocked;
        logActivity({
            action: willLock ? 'Row Locked' : 'Row Unlocked',
            details: `${willLock ? 'Locked' : 'Unlocked'} all cells for "${kpiName}"`,
            kpiId: id
        });
        setKpis(prev => {
            const kpi = prev[id];
            if (willLock) {
                // Snapshot current calculated values as overrides so they persist after unlock
                const numMonths = appState.dateRange.endMonth - appState.dateRange.startMonth + 1;
                const currentCalc = calculatedValues[id];
                const months = currentCalc && currentCalc.length > 1 ? currentCalc.slice(0, -1) : Array(numMonths).fill(0); // exclude total
                const overrides = months.map((v: number, i: number) => kpi.monthlyOverrides?.[i] ?? v);
                return {
                    ...prev,
                    [id]: { ...kpi, isLocked: true, monthlyOverrides: overrides }
                };
            } else {
                // Unlock — keep the snapshotted overrides so values don't drift, but clear cell locks
                return {
                    ...prev,
                    [id]: { ...kpi, isLocked: false, lockedMonths: [] }
                };
            }
        });
    }, [setKpis, kpis, calculatedValues, logActivity]);

    const onCellLockToggle = useCallback((id: string, monthIdx: number) => {
        const kpiName = kpis[id]?.label || id;
        setKpis(prev => {
            const kpi = prev[id];
            const locks = [...(kpi.lockedMonths || Array(12).fill(false))];
            const isNowLocked = !locks[monthIdx];
            locks[monthIdx] = isNowLocked;

            logActivity({
                action: isNowLocked ? 'Cell Locked' : 'Cell Unlocked',
                details: `${isNowLocked ? 'Locked' : 'Unlocked'} month index ${monthIdx} for "${kpiName}"`,
                kpiId: id
            });

            // Snapshot this cell's value as an override so it persists
            if (isNowLocked) {
                const currentVal = calculatedValues[id]?.[monthIdx] ?? 0;
                const overrides = [...(kpi.monthlyOverrides || Array(12).fill(undefined))];
                if (overrides[monthIdx] === undefined) {
                    overrides[monthIdx] = currentVal;
                }
                return {
                    ...prev,
                    [id]: { ...kpi, lockedMonths: locks, monthlyOverrides: overrides }
                };
            }

            return {
                ...prev,
                [id]: { ...kpi, lockedMonths: locks }
            };
        });
    }, [setKpis, kpis, calculatedValues, logActivity]);

    const onColumnLockChange = useCallback((idx: number) => {
        logActivity({
            action: 'Column Locked',
            details: `Locked actuals up to month index ${idx}`
        });
        setAppState(prev => ({ ...prev, lockMonthIdx: idx }));
    }, [setAppState, logActivity]);

    const onSettings = useCallback((id: string) => {
        setEditingId(id);
        setSettingsShowSlider(false);
        setSettingsSliderValue(0);
        const currentKpi = kpis[id];
        if (currentKpi) {
            // Capture base value for slider at the moment settings is opened
            const baseTotal = currentKpi.fullYearOverride ?? (calculatedValues[id]?.slice(0, -1).reduce((a: number, b: number) => a + b, 0) || 0);
            setSettingsSliderBase(baseTotal);
            setBulkStartMonth(appState.dateRange.startMonth);
            setBulkStartYear(appState.dateRange.startYear);
            setBulkEndMonth(appState.dateRange.endMonth);
            setBulkEndYear(appState.dateRange.endYear);
            setBulkPercentage('0');
        }
    }, [kpis, appState.dateRange, calculatedValues]);

    const handleBulkAdjust = useCallback(() => {
        if (!editingId) return;
        const percentage = parseFloat(bulkPercentage);
        if (isNaN(percentage)) return;

        const factor = 1 + (percentage / 100);
        const kpi = kpis[editingId];
        const monthsInRange = getMonthsInRange(bulkStartMonth, bulkStartYear, bulkEndMonth, bulkEndYear);
        const monthLabels = monthsInRange.map(m => m.label);

        setKpis(prev => {
            const current = prev[editingId];
            const newData = current.data.map(d => {
                if (monthLabels.includes(d.month)) {
                    return { ...d, actual: d.actual * factor };
                }
                return d;
            });
            
            // Also update monthlyOverrides if they exist or initialize them if not
            let newOverrides = current.monthlyOverrides ? [...current.monthlyOverrides] : Array(12).fill(undefined);
            const appMonthsInRange = getMonthsInRange(appState.dateRange.startMonth, appState.dateRange.startYear, appState.dateRange.endMonth, appState.dateRange.endYear);
            
            let totalDelta = 0;
            let monthlyDeltas: Record<number, number> = {};

            appMonthsInRange.forEach((m, i) => {
                if (monthLabels.includes(m.label)) {
                    let calcOld = calculatedValues[editingId]?.[i] ?? 0;
                    if (newOverrides[i] !== undefined) {
                        const currentVal = parseFloat(String(newOverrides[i]));
                        if (!isNaN(currentVal)) {
                            newOverrides[i] = currentVal * factor;
                            monthlyDeltas[i] = (newOverrides[i] as number) - calcOld;
                            totalDelta += monthlyDeltas[i];
                        }
                    } else {
                        newOverrides[i] = calcOld * factor;
                        monthlyDeltas[i] = (newOverrides[i] as number) - calcOld;
                        totalDelta += monthlyDeltas[i];
                    }
                }
            });

            const next = {
                ...prev,
                [editingId]: {
                    ...current,
                    data: newData,
                    monthlyOverrides: newOverrides,
                    fullYearOverride: undefined // Reset total if monthly values change
                }
            };

            let currParent = next[editingId].parentId;
            while (currParent && next[currParent]) {
                const parentData = next[currParent];
                let changed = false;
                let parentOverrides = parentData.monthlyOverrides ? [...parentData.monthlyOverrides] : undefined;
                
                if (parentOverrides) {
                    Object.entries(monthlyDeltas).forEach(([mIdx, mDelta]) => {
                        const idx = parseInt(mIdx);
                        if (typeof parentOverrides![idx] === 'number') {
                            parentOverrides![idx] = (parentOverrides![idx] as number) + mDelta;
                            changed = true;
                        }
                    });
                }
                
                let newFyOverride = parentData.fullYearOverride;
                if (typeof newFyOverride === 'number') {
                    newFyOverride += totalDelta;
                    changed = true;
                }

                if (changed) {
                    next[currParent] = {
                        ...parentData,
                        monthlyOverrides: parentOverrides,
                        fullYearOverride: newFyOverride
                    };
                }
                currParent = parentData.parentId;
            }
            return next;
        });
        
        logActivity({
            action: 'EDIT',
            details: `Bulk adjusted ${kpi.label} by ${percentage}% from ${monthLabels[0]} to ${monthLabels[monthLabels.length-1]}`,
            kpiId: editingId
        });
    }, [editingId, bulkPercentage, bulkStartMonth, bulkStartYear, bulkEndMonth, bulkEndYear, kpis, setKpis, logActivity, appState.dateRange]);

    const onReset = useCallback(() => {
        logActivity({
            action: 'Reset Scenario',
            details: 'Cleared all overrides, simulations, and locks'
        });
        setKpis(prev => {
            const next = { ...prev };
            Object.keys(next).forEach(id => {
                next[id].simulationValue = 0;
                next[id].monthlyOverrides = undefined;
                next[id].fullYearOverride = undefined;
                next[id].isLocked = false;
                next[id].lockedMonths = undefined;
            });
            return next;
        });
    }, [setKpis, logActivity]);

    const onResetKPI = useCallback((id: string) => {
        const kpiName = kpis[id]?.label || id;
        logActivity({
            action: 'Delete KPI',
            details: `Cleared all overrides and locks for "${kpiName}"`,
            kpiId: id
        });
        setKpis(prev => ({
            ...prev,
            [id]: {
                ...prev[id],
                simulationValue: 0,
                monthlyOverrides: undefined,
                fullYearOverride: undefined,
                isLocked: false,
                lockedMonths: undefined
            }
        }), true);
    }, [setKpis, kpis, logActivity]);

    const onDeleteKPI = useCallback((id: string, silent: boolean = false) => {
        if (!silent && !confirm('Delete this KPI and its entire branch?')) return;
        setKpis(prev => {
            const next = { ...prev };
            const toDelete = new Set<string>();
            const collect = (tid: string) => {
                toDelete.add(tid);
                next[tid].children.forEach(collect);
            };
            if (next[id]) collect(id);
            const pId = next[id]?.parentId;
            if (pId && next[pId]) {
                next[pId].children = next[pId].children.filter(i => i !== id);
            }
            toDelete.forEach(tid => delete next[tid]);
            return next;
        }, true);
        setEditingId(null);
    }, [setKpis]);

    const onForecast = useCallback(async () => {
        if (!editingId) return;
        const kpi = kpis[editingId];
        if (!kpi) return;

        setIsCalculating(true);
        const historical = baseValues[editingId] || [];
        try {
            // Map UI method names to backend method names
            const methodMap: Record<ForecastMethod, string> = {
                'LINEAR_TREND': 'LINEAR_TREND',
                'MOVING_AVERAGE': 'MOVING_AVERAGE',
                'FLAT_GROWTH': 'FLAT_GROWTH',
                'SEASONAL_NAIVE': 'SEASONAL_NAIVE'
            };

            const { forecast } = await apiService.getForecast(
                historical, 
                monthLabels.length, 
                methodMap[forecastConfig.method],
                forecastConfig.growthRate / 100
            );


            setKpis(prev => {
                const next = { ...prev };
                next[editingId] = {
                    ...next[editingId],
                    monthlyOverrides: forecast,
                    fullYearOverride: undefined
                };
                return next;
            }, true);
            
            logActivity({
                action: 'Forecast',
                details: `Generated ${forecastConfig.method} forecast for "${kpi.label}"`,
                kpiId: editingId
            });

            setShowForecastModal(false);
        } catch (error: any) {
            console.error('Forecast failed:', error);
            alert(error.message || 'Forecast failed');
        } finally {
            setIsCalculating(false);
        }
    }, [editingId, kpis, baseValues, forecastConfig, monthLabels, setKpis, logActivity]);

    const handlePromoteSheet = useCallback(async (table: any[][], mappings: Record<string, string>, monthsCount: number, merge: boolean = false) => {
        setIsCalculating(true);
        try {
            const promoResult = await apiService.promoteSheet(
                table, 
                mappings, 
                monthsCount, 
                appState.dateRange.startMonth, 
                appState.dateRange.startYear
            );

            const activePageId = appState.activePageId;
            let processedKpis: Record<string, KPIData> = {};
            let importedScenarios: Record<string, Scenario> = {};

            // Handle multi-scenario response from backend
            if (promoResult && promoResult.type === 'multi-scenario' && promoResult.scenarios) {
                processedKpis = promoResult.kpis || {};
                
                Object.entries(promoResult.scenarios).forEach(([name, scenarioKpis]: [string, any]) => {
                    const id = name === 'Base' ? 'base' : `scenario-${Date.now()}-${Math.floor(Math.random() * 1000)}-${name.replace(/\s+/g, '-')}`;
                    importedScenarios[id] = {
                        id,
                        name: name === 'Base' ? 'Base Scenario' : name,
                        kpis: scenarioKpis,
                        createdAt: new Date().toISOString()
                    };
                });
            } else {
                processedKpis = promoResult || {};
            }

            // Ensure imported KPIs are assigned to the active page if not already assigned
            Object.keys(processedKpis).forEach(id => {
                if (!processedKpis[id].pageId) {
                    processedKpis[id].pageId = activePageId;
                }
            });

            setAppState(prev => {
                let nextScenarios = { ...prev.scenarios };
                let nextActiveId = prev.activeScenarioId;
                let nextBaselineId = prev.baselineScenarioId;
                
                if (Object.keys(importedScenarios).length > 0) {
                    // If we have imported scenarios, update/add them
                    Object.entries(importedScenarios).forEach(([id, scenario]) => {
                        // Assign pageId to all KPIs in imported scenarios too
                        Object.values(scenario.kpis).forEach((k: any) => {
                            if (!k.pageId) k.pageId = activePageId;
                        });
                        nextScenarios[id] = scenario;
                    });
                    
                    // Switch to the first non-base scenario if we imported multiple, or the only one we imported
                    const importedIds = Object.keys(importedScenarios);
                    nextActiveId = importedIds.find(id => id !== 'base') || importedIds[0];
                    
                    // If we have 'baseline' or 'actual' scenarios, try to set them intelligently
                    nextBaselineId = importedIds.find(id => id.toLowerCase().includes('base')) || 'base';
                } else {
                    // Legacy single-scenario logic - update the active scenario
                    nextScenarios[nextActiveId] = {
                        ...prev.scenarios[nextActiveId],
                        kpis: merge ? { ...prev.scenarios[nextActiveId].kpis, ...processedKpis } : processedKpis
                    };
                }

                return {
                    ...prev,
                    scenarios: nextScenarios,
                    activeScenarioId: nextActiveId,
                    baselineScenarioId: nextBaselineId,
                    dateRange: promoResult.dateRange ? { ...promoResult.dateRange } : prev.dateRange
                };
            });

            logActivity({
                action: 'Promote Sheet',
                details: `${merge ? 'Merged' : 'Promoted'} spreadsheet to KPI tree. ${Object.keys(importedScenarios).length || 1} scenario(s) imported.`,
            });

            setShowPromotionSuccess(true);
            setTimeout(() => setShowPromotionSuccess(false), 5000);

            setIsCalculating(false);
            navigate('/'); // Go back to canvas
            
        } catch (error: any) {
            setIsCalculating(false);
            console.error('Promotion failed:', error);
            alert(error.message || 'Promotion failed');
        }
    }, [appState.dateRange, appState.activePageId, setAppState, navigate, logActivity]);

    const handleUploadData = async (file: File) => {
        setIsCalculating(true);        try {
            const response = await apiService.importFile(file, monthLabels.length);
            const { kpis: importedKpis, raw_rows, sheets } = response;
            
            setAppState(prev => {
                let next = { ...prev };
                const activeScenarioId = prev.activeScenarioId;
                
                // Store raw data and sheets
                next.rawImportData = raw_rows || undefined;
                next.sheets = sheets || undefined;

                // If we got structured kpis, merge them
                if (importedKpis && typeof importedKpis === 'object' && Object.keys(importedKpis).length > 0) {
                    const currentPageId = prev.activePageId;
                    const finalizedData: Record<string, KPIData> = {};
                    
                    Object.entries(importedKpis).forEach(([id, kpi]) => {
                        finalizedData[id] = { 
                            ...(kpi as any), 
                            pageId: currentPageId,
                            data: (kpi as any).data || [],
                            children: (kpi as any).children || [],
                            formula: (kpi as any).formula || 'NONE'
                        };
                    });

                    if (prev.scenarios[activeScenarioId]) {
                        next.scenarios = {
                            ...prev.scenarios,
                            [activeScenarioId]: { 
                                ...prev.scenarios[activeScenarioId], 
                                kpis: {
                                    ...(prev.scenarios[activeScenarioId].kpis as any),
                                    ...finalizedData
                                },
                                createdAt: new Date().toISOString() 
                            }
                        } as any;
                    }
                }
                
                return next;
            });

            // Navigate to Raw Data view automatically after upload
            navigate('/raw-data'); 
        } catch (err) {
            console.error(err);
            alert('Invalid file format or server error.');
        } finally {
            setTimeout(() => setIsCalculating(false), 800);
        }
    };
    const computedCurrentYear = new Date().getFullYear();
    const availableYears = useMemo(() => {
        const yearsSet = new Set<number>();
        
        let hasDataWithoutYear = false;
        let hasExplicitYears = false;

        // Scan all KPIs in all scenarios to find years we have data for
        if (appState.scenarios) {
            Object.values(appState.scenarios).forEach(scenario => {
                if (scenario.kpis) {
                    Object.values(scenario.kpis).forEach(kpi => {
                        if (kpi.data && Array.isArray(kpi.data)) {
                            kpi.data.forEach((d: any) => {
                                // If they explicitly have a year property (from import or processing)
                                if (d.year) {
                                    yearsSet.add(parseInt(d.year, 10));
                                    hasExplicitYears = true;
                                } else if (typeof d.month === 'string') {
                                    // Sometimes month might be 'Jan 24', 'Jan 2024', or '2024-01' from other imports
                                    // Match 2-digit or 4-digit years at the end, or 4-digit years at the start
                                    const match = d.month.match(/\b(20\d{2})\b|\b(\d{2})$/);
                                    if (match) {
                                        const parsed = parseInt(match[1] || match[2], 10);
                                        // Handle 2-digit years (e.g., '24' -> 2024)
                                        yearsSet.add(parsed < 100 ? 2000 + parsed : parsed);
                                        hasExplicitYears = true;
                                    } else {
                                        // Data exists but has no identifiable year (like just "Jan")
                                        hasDataWithoutYear = true;
                                    }
                                }
                            });
                        }
                    });
                }
            });
        }
        
        // Always include currently selected years to ensure UI is stable
        // (Do this AFTER scanning, so we don't accidentally trick ourselves into thinking we had explicit data years)
        yearsSet.add(appState.dateRange.startYear);
        if (appState.dateRangeMode === 'YTD') {
            yearsSet.add(appState.dateRange.endYear);
        }

        // If we found generic month data WITHOUT any explicit years in the ENTIRE dataset 
        // (like the default local AppState), fall back to a reasonable 10-year block centered around today.
        // Otherwise, if even one explicit year exists, we assume the user's dataset is anchored
        // in time and we only show the uniquely discovered years.
        if (hasDataWithoutYear && !hasExplicitYears) {
            for (let i = computedCurrentYear - 2; i <= computedCurrentYear + 8; i++) {
                yearsSet.add(i);
            }
        }

        const years = Array.from(yearsSet).sort((a, b) => a - b);
        
        return years.length > 0 ? years : [computedCurrentYear];
    }, [appState.scenarios, appState.dateRange, computedCurrentYear]);

    return (
        <>
            {showPromotionSuccess && (
                <div style={{
                    position: 'fixed',
                    bottom: 24,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: '#10B981',
                    color: 'white',
                    padding: '12px 24px',
                    borderRadius: 12,
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                    zIndex: 9999,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    fontWeight: 600,
                    animation: 'slideUp 0.3s ease-out'
                }}>
                    <div style={{ background: 'rgba(255,255,255,0.2)', padding: 4, borderRadius: '50%' }}>
                        <TrendingUp size={20} />
                    </div>
                    Successfully promoted to KPI Tree! Heading to Graph...
                </div>
            )}

            <MainLayout
                onReset={onReset}
                onForecast={() => setShowForecastModal(true)}
                dateRange={appState.dateRange}
                onDateRangeChange={(dr: any) => setAppState(prev => ({ ...prev, dateRange: dr }))}
                onUploadData={handleUploadData}
                onBack={onBack}
                isSyncEnabled={appState.isSyncEnabled}
                onSyncToggle={onSyncToggle}
                valueDisplayType={appState.valueDisplayType || 'absolute'}
                onValueDisplayTypeChange={onValueDisplayTypeChange}
                availableYears={availableYears}
                isCalculating={isCalculating}
                onEnterPresentation={() => setIsPresentationMode(true)}
                isPresentationMode={isPresentationMode}
                showCharts={appState.showCharts}
                onToggleCharts={() => setAppState(prev => ({ ...prev, showCharts: !prev.showCharts }))}
                dateRangeMode={appState.dateRangeMode || 'YTD'}
                onDateRangeModeChange={(mode) => {
                    setAppState(prev => {
                        const next = { ...prev, dateRangeMode: mode };
                        if (mode === 'MTD') {
                            next.dateRange = {
                                ...prev.dateRange,
                                endMonth: prev.dateRange.startMonth,
                                endYear: prev.dateRange.startYear
                            };
                        } else if (mode === 'YTD') {
                            next.dateRange = {
                                ...prev.dateRange,
                                startMonth: 0,
                                startYear: prev.dateRange.startYear,
                                endMonth: 11,
                                endYear: prev.dateRange.startYear
                            };
                        }
                        return next;
                    });
                }}
                onExpandAll={() => {
                    setAppState(prev => {
                        const nextScenarios = { ...prev.scenarios };
                        Object.keys(nextScenarios).forEach(scenId => {
                            const newKpis = { ...nextScenarios[scenId].kpis };
                            Object.keys(newKpis).forEach(id => { newKpis[id] = { ...newKpis[id], isExpanded: true }; });
                            nextScenarios[scenId] = { ...nextScenarios[scenId], kpis: newKpis };
                        });
                        return { ...prev, scenarios: nextScenarios };
                    });
                }}
                onCollapseAll={() => {
                    setAppState(prev => {
                        const nextScenarios = { ...prev.scenarios };
                        Object.keys(nextScenarios).forEach(scenId => {
                            const newKpis = { ...nextScenarios[scenId].kpis };
                            Object.keys(newKpis).forEach(id => { newKpis[id] = { ...newKpis[id], isExpanded: false }; });
                            nextScenarios[scenId] = { ...nextScenarios[scenId], kpis: newKpis };
                        });
                        return { ...prev, scenarios: nextScenarios };
                    });
                }}
            >
                {/* Page Tabs Area */}
                <div className="page-tabs-container" style={{ zIndex: isPresentationMode ? 100 : undefined, position: isPresentationMode ? 'absolute' : 'relative', top: isPresentationMode ? 0 : 'auto', left: isPresentationMode ? 0 : 'auto', right: isPresentationMode ? 0 : 'auto', background: isPresentationMode ? '#0f172a' : '' }}>
                    <div className="page-tabs">
                        {(appState.pages || []).map(page => (
                            <div 
                                key={page.id} 
                                className={`page-tab ${activePageId === page.id ? 'active' : ''}`} 
                                onClick={() => onSelectPage(page.id)}
                            >
                                <input
                                    className="page-tab-input"
                                    value={page.name}
                                    onChange={(e) => onRenamePage(page.id, e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    onBlur={(e) => {
                                        if (!e.target.value.trim()) {
                                            onRenamePage(page.id, "Untitled Page");
                                        }
                                    }}
                                    title="Double click to rename"
                                />
                                <button 
                                    className="delete-page-btn" 
                                    onClick={(e) => onDeletePage(page.id, e)}
                                    title="Delete Page"
                                >
                                    <X size={12} />
                                </button>
                                {activePageId === page.id && <div className="page-tab-indicator" />}
                            </div>
                        ))}
                        <button className="add-page-btn" onClick={onAddPage} title="Add New Page">
                            <Plus size={16} />
                        </button>
                    </div>
                    {isPresentationMode && (
                        <button 
                            onClick={() => setIsPresentationMode(false)}
                            style={{
                                marginLeft: 'auto',
                                marginRight: '16px',
                                padding: '4px 12px',
                                background: 'rgba(239, 68, 68, 0.2)',
                                color: '#ef4444',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            <X size={14} /> Exit Presentation
                        </button>
                    )}
                </div>

                <div className="main-content-scrollable">
                    <Routes>
                        <Route path="/" element={
                                Object.keys(filteredKpis).length === 0 ? (
                                    <WelcomeScreen
                                        onImportData={handleCustomDataImport}
                                        onLoadSample={() => setKpis(() => initialKPIs)}
                                        monthsCount={monthLabels.length}
                                    />
                                ) : (
                                    <ReactFlowProvider>
                                        <SimulationCanvasInner
                                            kpis={filteredKpis}
                                            setKpis={setKpis}
                                            baseValues={baseValues}
                                            monthLabels={monthLabels}
                                            activePageId={appState.activePageId}
                                            onToggleExpand={handleToggleExpand}
                                            onSimulationChange={onSimulationChange}
                                            onSimulationTypeToggle={onSimulationTypeToggle}
                                            onMonthlyOverrideChange={onMonthlyOverrideChange}
                                            onAddChild={onAddChild}
                                            onAddPage={onAddPage}
                                            onSelectPage={onSelectPage}
                                            onRenamePage={onRenamePage}
                                            onDeletePage={onDeletePage}
                                            pages={appState.pages}
                                            lockMonthIdx={appState.lockMonthIdx}
                                            onColumnLockChange={onColumnLockChange}
                                            onCellLockToggle={onCellLockToggle}
                                            onRowLockToggle={onRowLockToggle}
                                            onSettings={onSettings}
                                            calculatedValues={calculatedValues}
                                            onResetKPI={onResetKPI}
                                            onFullYearOverrideChange={onFullYearOverrideChange}
                                            onSplitToPage={onSplitToPage}
                                            isScenarioMode={true}
                                            onAddRoot={onAddRoot}
                                            onDeleteKPI={onDeleteKPI}
                                            scenarios={appState.scenarios}
                                            activeScenarioId={appState.activeScenarioId}
                                            onScenarioSelect={onScenarioSelect}
                                            onScenarioAdd={onScenarioAdd}
                                            onScenarioDelete={onScenarioDelete}
                                            valueDisplayType={appState.valueDisplayType}
                                            baselineScenarioId={appState.baselineScenarioId}
                                            setAppState={setAppState}
                                            onDisconnect={handleDisconnect}
                                            setIsCalculating={setIsCalculating}
                                            isPresentationMode={isPresentationMode}
                                            setIsPresentationMode={setIsPresentationMode}
                                            showCharts={appState.showCharts}
                                            calculatedScenarioValues={calculatedScenarioValues}
                                            selectedScenarioIds={selectedScenarioIds}
                                            isScenarioOpen={isScenarioOpen}
                                            setIsScenarioOpen={setIsScenarioOpen}
                                            scenarioFilterSearch={scenarioFilterSearch}
                                            setScenarioFilterSearch={setScenarioFilterSearch}
                                        />
                                    </ReactFlowProvider>
                                )
                            } />
                            <Route path="/tabular" element={
                                <SpreadsheetView
                                    kpis={filteredKpis}
                                    calculatedValues={calculatedValues}
                                    onMonthlyOverrideChange={onMonthlyOverrideChange}
                                    onFullYearOverrideChange={onFullYearOverrideChange}
                                    scenarios={appState.scenarios}
                                    activeScenarioId={appState.activeScenarioId}
                                    onScenarioSelect={onScenarioSelect}
                                    baselineScenarioId={appState.baselineScenarioId}
                                    onBaselineScenarioSelect={(id: string) => setAppState((prev: any) => ({ ...prev, baselineScenarioId: id }))}
                                    baseValues={baseValues}
                                    onScenarioAdd={onScenarioAdd}
                                    onScenarioDelete={onScenarioDelete}
                                    onMakeBaseScenario={handleMakeBaseScenario}
                                    onToggleExpand={handleToggleExpand}
                                    onCustomDataImport={handleCustomDataImport}
                                    onRowLockToggle={onRowLockToggle}
                                    onCellLockToggle={onCellLockToggle}
                                    onColumnLockChange={onColumnLockChange}
                                    dateRange={appState.dateRange}
                                    onDateRangeChange={(range: any) => setAppState(prev => ({ ...prev, dateRange: range }))}
                                    onAddRoot={onAddRoot}
                                    onLabelChange={onLabelChange}
                                    onUnitChange={onUnitChange}
                                    onPullData={() => navigate('/raw-data')}
                                    calculatedScenarioValues={calculatedScenarioValues}
                                    selectedScenarioIds={appState.spreadsheetSelectedScenarios || []}
                                    onSelectedScenariosChange={(ids) => setAppState(prev => ({ ...prev, spreadsheetSelectedScenarios: ids }))}
                                />
                        } />
                        <Route path="/raw-data" element={
                            <RawDataView
                                rawImportData={appState.rawImportData}
                                sheets={appState.sheets}
                                currentMappings={appState.columnMappings}
                                onSaveMappings={(m) => setAppState(prev => ({ ...prev, columnMappings: m }))}
                                onPromoteSheet={handlePromoteSheet}
                            />
                        } />
                        <Route path="/logs" element={
                            <LogView logs={appState.activityLog} kpiNames={Object.fromEntries(Object.values(kpis).map(k => [k.id, k.label]))} />
                        } />
                        <Route path="/compare" element={
                            <ComparisonView
                                scenarios={appState.scenarios}
                                dateRange={appState.dateRange}
                            />
                        } />
                    </Routes>
                </div>
            </MainLayout>

            {editingId && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ width: '850px', maxWidth: '95vw' }}>
                        <div className="modal-header">
                            <h2>KPI Settings</h2>
                            <button className="close-btn" onClick={() => setEditingId(null)}><X size={20} /></button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>Label</label>
                                <input
                                    value={kpis[editingId].label}
                                    onChange={e => setKpis(prev => ({ ...prev, [editingId]: { ...prev[editingId], label: e.target.value } }))}
                                />
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Overall Total</label>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <input
                                            type="number"
                                            value={
                                                kpis[editingId]?.fullYearOverride ?? 
                                                (calculatedValues[editingId]?.slice(0, -1).reduce((a: number, b: number) => a + b, 0) || 0)
                                            }
                                            onChange={e => {
                                                const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                                                onFullYearOverrideChange(editingId, val);
                                                setSettingsSliderValue(0);
                                            }}
                                            disabled={kpis[editingId].formula !== 'NONE'}
                                            title={kpis[editingId].formula !== 'NONE' ? "Computed nodes cannot have overriding totals directly set." : ""}
                                            style={{ flex: 1, backgroundColor: kpis[editingId].formula !== 'NONE' ? '#f1f5f9' : 'white', cursor: kpis[editingId].formula !== 'NONE' ? 'not-allowed' : 'text' }}
                                        />
                                        <button 
                                            onClick={() => setSettingsShowSlider(!settingsShowSlider)}
                                            style={{ padding: '0 12px', background: 'white', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', color: '#3b82f6', fontWeight: 600 }}
                                            title="Adjust by Percentage"
                                            disabled={kpis[editingId].formula !== 'NONE'}
                                        >
                                            %
                                        </button>
                                    </div>
                                    {settingsShowSlider && kpis[editingId].formula === 'NONE' && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
                                            <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600, minWidth: '36px' }}>
                                                {settingsSliderValue > 0 ? '+' : ''}{settingsSliderValue}%
                                            </span>
                                            <input 
                                                type="range" 
                                                min="-100" 
                                                max="100" 
                                                value={settingsSliderValue}
                                                onChange={e => {
                                                    const pct = parseInt(e.target.value, 10);
                                                    setSettingsSliderValue(pct);
                                                    const computed = settingsSliderBase * (1 + pct / 100);
                                                    const finalVal = parseFloat(computed.toFixed(2).replace(/\.00$/, ''));
                                                    onFullYearOverrideChange(editingId, finalVal);
                                                }}
                                                style={{ flex: 1, cursor: 'pointer', accentColor: '#3b82f6' }}
                                            />
                                        </div>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label>Unit</label>
                                    <input
                                        value={kpis[editingId].unit}
                                        onChange={e => setKpis(prev => ({ ...prev, [editingId]: { ...prev[editingId], unit: e.target.value } }))}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Calculation Formula</label>
                                    <select
                                        value={kpis[editingId].formula}
                                        onChange={e => setKpis(prev => ({ 
                                            ...prev, 
                                            [editingId]: { 
                                                ...prev[editingId], 
                                                formula: e.target.value as FormulaType,
                                                fullYearOverride: undefined
                                            } 
                                        }))}
                                    >
                                        <option value="NONE">None (Leaf Node)</option>
                                        <option value="SUM">Sum of Children (+)</option>
                                        <option value="PRODUCT">Product of Children (×)</option>
                                        <option value="AVERAGE">Average of Children (avg)</option>
                                        <option value="CUSTOM">Semantic Formula (custom)</option>
                                    </select>
                                </div>
                            </div>
                            {kpis[editingId].formula === 'CUSTOM' && (
                                <div className="form-group">
                                    <label>Custom Logic (e.g. Revenue - TotalCosts)</label>
                                    <div className="formula-input-wrapper">
                                        <input
                                            id="modal-custom-formula"
                                            value={kpis[editingId].customFormula || ''}
                                            placeholder="e.g. Revenue - Cost"
                                            onChange={e => {
                                                const val = e.target.value;
                                                setKpis(prev => ({ ...prev, [editingId]: { ...prev[editingId], customFormula: val } }));
                                                
                                                const cursor = e.target.selectionStart || 0;
                                                const textBefore = val.substring(0, cursor);
                                                const match = textBefore.match(/[A-Za-z0-9_]*$/);
                                                
                                                if (match && match[0].length > 0) {
                                                    const search = match[0].toLowerCase();
                                                    const suggestions = Object.values(kpis)
                                                        .filter(k => 
                                                            (k.label.toLowerCase().includes(search) || k.label.replace(/\s+/g, '').toLowerCase().includes(search)) && 
                                                            k.label.toLowerCase() !== search
                                                        )
                                                        .slice(0, 10);
                                                    setFormulaSuggestions(suggestions);
                                                    setSuggestionIndex(0);
                                                } else {
                                                    setFormulaSuggestions([]);
                                                }
                                            }}
                                            onKeyDown={e => {
                                                if (formulaSuggestions.length > 0) {
                                                    if (e.key === 'ArrowDown') {
                                                        e.preventDefault();
                                                        setSuggestionIndex(prev => (prev + 1) % formulaSuggestions.length);
                                                    } else if (e.key === 'ArrowUp') {
                                                        e.preventDefault();
                                                        setSuggestionIndex(prev => (prev - 1 + formulaSuggestions.length) % formulaSuggestions.length);
                                                    } else if (e.key === 'Enter' || e.key === 'Tab') {
                                                        e.preventDefault();
                                                        const selected = formulaSuggestions[suggestionIndex];
                                                        const currentVal = kpis[editingId].customFormula || '';
                                                        const input = document.getElementById('modal-custom-formula') as HTMLInputElement;
                                                        const cursor = input.selectionStart || 0;
                                                        const textBefore = currentVal.substring(0, cursor);
                                                        const textAfter = currentVal.substring(cursor);
                                                        const match = textBefore.match(/[A-Za-z0-9_]*$/);
                                                        const prefix = textBefore.substring(0, textBefore.length - (match ? match[0].length : 0));
                                                        
                                                         const newVal = prefix + selected.label + textAfter;
                                                        setKpis(prev => ({ ...prev, [editingId]: { ...prev[editingId], customFormula: newVal } }));
                                                        setFormulaSuggestions([]);
                                                    } else if (e.key === 'Escape') {
                                                        setFormulaSuggestions([]);
                                                    }
                                                }
                                            }}
                                            onBlur={() => setTimeout(() => setFormulaSuggestions([]), 200)}
                                        />
                                        {formulaSuggestions.length > 0 && (
                                            <div className="formula-suggestions-dropdown modal-suggestions">
                                                {formulaSuggestions.map((s, i) => (
                                                     <div 
                                                         key={s.id} 
                                                        className={`suggestion-item ${i === suggestionIndex ? 'active' : ''}`}
                                                        onClick={() => {
                                                            const currentVal = kpis[editingId].customFormula || '';
                                                            const input = document.getElementById('modal-custom-formula') as HTMLInputElement;
                                                            const cursor = input.selectionStart || 0;
                                                            const textBefore = currentVal.substring(0, cursor);
                                                            const textAfter = currentVal.substring(cursor);
                                                            const match = textBefore.match(/[A-Za-z0-9_]*$/);
                                                            const prefix = textBefore.substring(0, textBefore.length - (match ? match[0].length : 0));
                                                            const newVal = prefix + s.label + textAfter;
                                                            setKpis(prev => ({ ...prev, [editingId]: { ...prev[editingId], customFormula: newVal } }));
                                                            setFormulaSuggestions([]);
                                                        }}
                                                    >
                                                        {s.label}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Business Owner</label>
                                    <input
                                        value={kpis[editingId].semantic?.businessOwner || ''}
                                        onChange={e => setKpis(prev => ({
                                            ...prev,
                                            [editingId]: {
                                                ...prev[editingId],
                                                semantic: { ...prev[editingId].semantic, businessOwner: e.target.value }
                                            }
                                        }))}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Data Source</label>
                                    <input
                                        value={kpis[editingId].semantic?.dataSource || ''}
                                        onChange={e => setKpis(prev => ({
                                            ...prev,
                                            [editingId]: {
                                                ...prev[editingId],
                                                semantic: { ...prev[editingId].semantic, dataSource: e.target.value }
                                            }
                                        }))}
                                    />
                                </div>
                            </div>                            <div className="modal-section-divider" style={{ height: '1px', background: '#e2e8f0', margin: '20px 0' }}></div>
                            
                            <div className="bulk-adjust-section" style={{ background: '#f8fafc', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                <h3 style={{ fontSize: '0.9rem', marginBottom: '20px', color: '#3b82f6', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bulk Adjust Values</h3>
                                <div className="form-row" style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
                                    <div className="form-group" style={{ flex: '1 1 300px' }}>
                                        <label style={{ fontSize: '0.75rem', marginBottom: '8px', color: '#64748b', fontWeight: 600 }}>Adjustment Range</label>
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            <select 
                                                style={{ flex: 1, padding: '10px', fontSize: '0.85rem', background: 'white', border: '1px solid #cbd5e1', color: '#1e293b', borderRadius: '8px' }}
                                                value={bulkStartMonth} onChange={e => setBulkStartMonth(parseInt(e.target.value))}
                                            >
                                                {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
                                            </select>
                                            <select 
                                                style={{ width: '100px', padding: '10px', fontSize: '0.85rem', background: 'white', border: '1px solid #cbd5e1', color: '#1e293b', borderRadius: '8px' }}
                                                value={bulkStartYear} onChange={e => setBulkStartYear(parseInt(e.target.value))}
                                            >
                                                {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                                            </select>
                                            <span style={{ color: '#94a3b8', fontWeight: 500 }}>to</span>
                                            <select 
                                                style={{ flex: 1, padding: '10px', fontSize: '0.85rem', background: 'white', border: '1px solid #cbd5e1', color: '#1e293b', borderRadius: '8px' }}
                                                value={bulkEndMonth} onChange={e => setBulkEndMonth(parseInt(e.target.value))}
                                            >
                                                {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
                                            </select>
                                            <select 
                                                style={{ width: '100px', padding: '10px', fontSize: '0.85rem', background: 'white', border: '1px solid #cbd5e1', color: '#1e293b', borderRadius: '8px' }}
                                                value={bulkEndYear} onChange={e => setBulkEndYear(parseInt(e.target.value))}
                                            >
                                                {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="form-group" style={{ flex: '1 1 200px' }}>
                                        <label style={{ fontSize: '0.75rem', marginBottom: '8px', color: '#64748b', fontWeight: 600 }}>Percentage Change</label>
                                        <div style={{ display: 'flex', gap: '12px' }}>
                                            <div style={{ position: 'relative', flex: 1 }}>
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    style={{ width: '100%', padding: '12px 16px', fontSize: '1.1rem', background: 'white', border: '1px solid #cbd5e1', color: '#1e293b', borderRadius: '8px', outline: 'none', fontWeight: 600 }}
                                                    value={bulkPercentage}
                                                    onChange={e => setBulkPercentage(e.target.value)}
                                                />
                                                <span style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontWeight: 600 }}>%</span>
                                            </div>
                                            <button 
                                                onClick={handleBulkAdjust}
                                                disabled={!bulkPercentage || bulkPercentage === '0'}
                                                style={{ 
                                                    padding: '0 32px', 
                                                    fontSize: '0.95rem', 
                                                    background: '#3b82f6', 
                                                    color: 'white', 
                                                    border: 'none', 
                                                    borderRadius: '8px',
                                                    cursor: (bulkPercentage && bulkPercentage !== '0') ? 'pointer' : 'not-allowed',
                                                    opacity: (bulkPercentage && bulkPercentage !== '0') ? 1 : 0.5,
                                                    fontWeight: 700,
                                                    transition: 'all 0.2s',
                                                    boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.2)'
                                                }}
                                            >
                                                Apply
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button className="danger-btn" onClick={() => onDeleteKPI(editingId)}>
                                <Trash2 size={16} /> Delete Branch
                            </button>
                            <button className="primary-btn" onClick={() => setEditingId(null)}>
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showForecastModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h2>Generate Scenario Forecast</h2>
                            <button className="close-btn" onClick={() => setShowForecastModal(false)}><X size={20} /></button>
                        </div>
                        <div className="modal-body">
                            <p className="text-slate-600 text-sm mb-4">Select an algorithmic method to project the next 12 months for this scenario based on historical actuals.</p>
                            <div className="form-group">
                                <label>Forecasting Method</label>
                                <select
                                    value={forecastConfig.method}
                                    onChange={e => setForecastConfig(prev => ({ ...prev, method: e.target.value as ForecastMethod }))}
                                >
                                    <option value="LINEAR_TREND">Linear Trend (Regression)</option>
                                    <option value="MOVING_AVERAGE">Moving Average (3-Period)</option>
                                    <option value="FLAT_GROWTH">Compound Growth (%)</option>
                                    <option value="SEASONAL_NAIVE">Seasonal Naive</option>
                                </select>
                            </div>
                            {forecastConfig.method === 'FLAT_GROWTH' && (
                                <div className="form-group">
                                    <label>Annual Growth Rate (%)</label>
                                    <input
                                        type="number"
                                        value={forecastConfig.growthRate}
                                        onChange={e => setForecastConfig(prev => ({ ...prev, growthRate: Number(e.target.value) }))}
                                    />
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="ghost-btn" onClick={() => setShowForecastModal(false)}>Cancel</button>
                            <button className="primary-btn flex-center gap-2" onClick={onForecast}>
                                <TrendingUp size={16} /> Execute Forecast
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default SimulationCanvas;
