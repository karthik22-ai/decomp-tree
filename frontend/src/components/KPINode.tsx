// @ts-nocheck
import { memo, useState, useEffect, useRef } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import {
    Minus,
    Plus,
    Settings,
    ChevronDown,
    TrendingUp,
    TrendingDown,
    RefreshCcw,
    User,
    Search,
    Scissors,
    Link2Off,
    Trash2,
    MessageSquare
} from 'lucide-react';
import type { SemanticAttributes } from '../types';
import { formatValue } from '../utils/format';



interface KPINodeProps {
    id: string;
    label: string;
    unit: string;
    formula: string;
    isExpanded: boolean;
    children: string[];
    simulationValue: number;
    simulationType: 'PERCENT' | 'ABSOLUTE';
    calculatedValue: number[];
    baselineData: number[];
    calculatedScenarioValues?: Record<string, number[]>;
    selectedScenarioIds?: string[];
    scenarios?: Record<string, any>;
    monthLabels: string[];
    isScenarioMode: boolean;
    color?: string;
    desiredTrend?: 'INCREASE' | 'DECREASE';
    overallOverride?: Record<string, number>;
    onToggleExpand: (id: string) => void;
    onSimulationChange: (id: string, value: number) => void;
    onSimulationTypeToggle: (id: string) => void;
    onOverallOverrideChange: (id: string, yearKeyOrValue: string | number | undefined, value?: number) => void;
    onAddChild: (id: string) => void;
    onSettings: (id: string) => void;
    onResetKPI: (id: string) => void;
    onSplitToPage: (id: string) => void;
    onDisconnect?: (id: string) => void;
    onDeleteKPI?: (id: string) => void;
    semantic?: SemanticAttributes;
    valueDisplayType?: 'absolute' | 'variance';
    showCharts?: boolean;
    parentId?: string;
    comment?: string;
    onCommentChange?: (id: string, comment: string) => void;
    appState: any;
}


const KPINode = ({ data }: NodeProps<KPINodeProps>) => {
    const {
        id,
        label,
        unit,
        formula,
        isExpanded,
        calculatedValue,
        baselineData,
        calculatedScenarioValues,
        selectedScenarioIds,
        scenarios,
        isScenarioMode,
        color,
        onToggleExpand,
        onAddChild,
        onSettings,
        onResetKPI,
        onSplitToPage,
        onDisconnect,
        onDeleteKPI,
        semantic,
        valueDisplayType,
        showCharts,
        parentId,
        comment,
        onCommentChange,
        onOverallOverrideChange,
        appState
    } = data;

    const yearKey = String(appState?.dateRange?.endYear || new Date().getFullYear());
    
    // Check for explicit overrides for the active year
    const overrideVal = (typeof data.overallOverride === 'object' && data.overallOverride !== null) 
        ? data.overallOverride[yearKey] 
        : (typeof data.overallOverride === 'number' ? data.overallOverride : undefined);

    const calc = Array.isArray(calculatedValue) ? calculatedValue : [];
    const base = Array.isArray(baselineData) ? baselineData : [];

    const periodCount = Math.max(0, calc.length - 1);
    const rawVal = calc[periodCount];
    
    // currentVal should represent what's actually displayed (prefer override if provided in calc)
    const currentVal = (typeof rawVal === 'number' && !isNaN(rawVal)) ? rawVal : 0;

    const rawBase = base[periodCount] ?? calc[periodCount];
    const baselineVal = (typeof rawBase === 'number' && !isNaN(rawBase)) ? rawBase : 0;

    const [isEditing, setIsEditing] = useState(false);
    const [isCommenting, setIsCommenting] = useState(false);
    const [editValue, setEditValue] = useState('');
    const [commentValue, setCommentValue] = useState(comment || '');
    const [showSlider, setShowSlider] = useState(false);
    const [sliderValue, setSliderValue] = useState(0);
    const [sliderBaseValue, setSliderBaseValue] = useState(0);
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const commentRef = useRef<HTMLTextAreaElement>(null);
    const editorRef = useRef<HTMLDivElement>(null);

    // Variance is annual now
    const diff = currentVal - baselineVal;
    const absBase = Math.abs(baselineVal);
    const variance = absBase > 0 ? (diff / absBase) * 100 : 0;
    const safeVariance = isNaN(variance) || !isFinite(variance) ? 0 : variance;

    const isPositiveImpact = data.desiredTrend === 'DECREASE' ? (variance <= 0) : (variance >= 0);
    const varianceClass = Math.abs(variance) < 0.01 ? 'neutral' : (isPositiveImpact ? 'pos' : 'neg');

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    useEffect(() => {
        if (isCommenting && commentRef.current) {
            commentRef.current.focus();
        }
    }, [isCommenting]);

    const handleEditStart = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!isScenarioMode) return;

        // Use the explicit override value in the edit box if it exists, otherwise use calculated
        setEditValue(overrideVal !== undefined ? overrideVal.toString() : currentVal.toString());
        setSliderBaseValue(overrideVal !== undefined ? overrideVal : currentVal);
        setSliderValue(0);
        setShowSlider(false);
        setIsEditing(true);
    };

    const handleEditCommit = () => {
        setIsEditing(false);
        const sanitizedStr = editValue.replace(/,/g, '').replace(/"/g, '');
        const num = parseFloat(sanitizedStr);

        if (isNaN(num) || sanitizedStr === '') {
            if (data.overallOverride && Object.keys(data.overallOverride).length > 0) {
                // If clearing, pass the specific year to clear
                const yearKey = String(appState?.dateRange?.endYear || new Date().getFullYear());
                onOverallOverrideChange(id, yearKey, undefined);
            }
            return;
        }

        // Always pass the specific year key to ensure consistency with Spreadsheet view
        const yearKey = String(appState?.dateRange?.endYear || new Date().getFullYear());
        onOverallOverrideChange(id, yearKey, num);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleEditCommit();
        } else if (e.key === 'Escape') {
            setIsEditing(false);
        }
    };

    const handleBlur = (e: React.FocusEvent) => {
        if (editorRef.current && editorRef.current.contains(e.relatedTarget as Node)) {
            return;
        }
        handleEditCommit();
    };

    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const pct = parseInt(e.target.value, 10);
        setSliderValue(pct);
        const computed = sliderBaseValue * (1 + pct / 100);
        setEditValue(computed.toFixed(2).replace(/\.00$/, ''));
    };

    const handleCommentCommit = () => {
        setIsCommenting(false);
        if (onCommentChange && commentValue !== comment) {
            onCommentChange(id, commentValue);
        }
    };

    const getCategoryColor = (formula: string, trend?: 'INCREASE' | 'DECREASE', defaultColor?: string) => { switch (formula) { case 'NONE': return '#3b82f6'; case 'SUM': case 'PRODUCT': case 'AVERAGE': return '#10B981'; case 'CUSTOM': return '#EC4899'; default: return defaultColor || '#64748B'; } };

    const isSimulated = (data.monthlyOverrides && Object.keys(data.monthlyOverrides).length > 0) || 
                       (typeof data.overallOverride === 'object' && data.overallOverride !== null && Object.keys(data.overallOverride).length > 0);

    return (
        <div
            className={`kpi-node valq-style ${isExpanded ? 'expanded' : ''} ${isSimulated ? 'simulated' : ''}`}
            style={{ '--node-accent': getCategoryColor(formula, data.desiredTrend, color) } as React.CSSProperties}
            onClick={() => onToggleExpand(id)}
        >
            <div className="node-category-strip" style={{ background: getCategoryColor(formula, data.desiredTrend, color) }} />

            <Handle type="target" position={Position.Left} />

            <div className="node-main-content">
                <div className="node-top-row">
                    <span className="node-label">{label}</span>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        {comment && <MessageSquare size={10} className="text-slate-400" />}
                        <span className="node-formula">{formula !== 'NONE' ? formula : ''}</span>
                    </div>
                </div>

                {isEditing ? (
                    <div
                        ref={editorRef}
                        className="node-value-center editing"
                        onClick={e => e.stopPropagation()}
                        style={{ flexDirection: 'column', alignItems: 'stretch', padding: '4px 8px' }}
                    >
                        <div className="inline-editor-wrapper" style={{ margin: 0 }}>
                            <input
                                ref={inputRef}
                                type="number"
                                className="inline-val-input"
                                value={editValue}
                                onChange={(e) => {
                                    setEditValue(e.target.value);
                                    setSliderValue(0);
                                }}
                                onBlur={handleBlur}
                                onKeyDown={handleKeyDown}
                                placeholder="0"
                            />
                            <button
                                className="inline-type-toggle"
                                style={{ padding: '0 8px', color: '#3b82f6', fontWeight: 600, cursor: 'pointer', background: 'transparent', border: 'none' }}
                                onClick={() => {
                                    setShowSlider(!showSlider);
                                    setTimeout(() => inputRef.current?.focus(), 0);
                                }}
                                title="Adjust by Percentage"
                            >
                                %
                            </button>
                        </div>
                        {showSlider && (
                            <div className="nodrag" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, minWidth: '32px' }}>
                                    {sliderValue > 0 ? '+' : ''}{sliderValue}%
                                </span>
                                <input
                                    type="range"
                                    min="-100"
                                    max="100"
                                    value={sliderValue}
                                    onChange={handleSliderChange}
                                    onBlur={handleBlur}
                                    style={{ flex: 1, cursor: 'pointer', accentColor: '#3b82f6' }}
                                    className="nodrag nopan"
                                />
                            </div>
                        )}
                    </div>
                ) : (
                    <div
                        className={`node-value-center ${isScenarioMode ? 'editable-hover' : ''}`}
                        onClick={handleEditStart}
                        title={isScenarioMode ? "Click to quick-edit range total" : undefined}
                    >
                        <div className="node-center-values">
                            <div className="center-value-container">
                                <span 
                                    className={`center-value ${isSimulated ? 'has-override' : ''}`} 
                                    title={isSimulated ? "Range total modified via overrides" : "Calculated Range Total"}
                                >
                                    {formatValue(valueDisplayType === 'variance' ? (currentVal - baselineVal) : currentVal)}
                                </span>
                            </div>
                            
                            {!isNaN(variance) && isFinite(variance) && Math.abs(variance) > 0 && (
                                <div className={`node-variance-badge ${varianceClass}`}>
                                    {variance >= 0 ? '+' : ''}{variance.toFixed(1)}%
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className="node-variance-track">
                    <div 
                        className={`node-variance-bar ${varianceClass}`} 
                        style={{ 
                            width: `${Math.min(100, Math.abs(safeVariance))}%`,
                            marginLeft: safeVariance >= 0 ? '50%' : `${50 - Math.min(50, Math.abs(safeVariance))}%`,
                            left: safeVariance >= 0 ? 0 : 'auto',
                            right: safeVariance < 0 ? '50%' : 'auto'
                        }} 
                    />
                </div>

                {showCharts && data.monthLabels && calc.length > 1 && (
                    <div className="node-sparkline custom-scrollbar" style={{ marginTop: '4px', marginBottom: '4px', overflowX: 'auto', overflowY: 'hidden', position: 'relative', paddingBottom: '4px' }}>
                        {(() => {
                            // Backend results have period_count + 1 (last one is total). Slice to get only monthly components for trend chart.
                            const monthlyVals = calc.slice(0, -1).map(v => (typeof v === 'number' && !isNaN(v)) ? v : 0);
                            if (monthlyVals.length === 0 || !data.monthLabels) return null;
                            const minV = Math.min(...monthlyVals);
                            const maxV = Math.max(...monthlyVals);
                            const range = (maxV - minV) || 1;

                            const numPoints = monthlyVals.length;
                            let w = Math.max(180, numPoints * 45);
                            if (isNaN(w) || !isFinite(w) || w <= 0) w = 180;
                            const h = 30;

                            const pts = monthlyVals.map((v, i) => {
                                const x = (i / Math.max(1, numPoints - 1)) * w;
                                const y = h - ((v - minV) / range) * h;
                                return {
                                    x: isNaN(x) ? 0 : x,
                                    y: isNaN(y) ? 0 : y,
                                    v: isNaN(v) ? 0 : v,
                                    i
                                };
                            });
                            const ptsString = pts.map(p => `${p.x},${p.y}`).join(' ');

                            return (
                                <div style={{ position: 'relative', width: `${w}px`, height: '40px' }}>
                                    <svg viewBox={`0 0 ${w} 40`} style={{ width: `${w}px`, height: '40px', overflow: 'visible' }}>
                                        <polyline
                                            points={ptsString}
                                            fill="none"
                                            stroke={color || "#3b82f6"}
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                        {pts.map(p => {
                                            const raw = data.monthLabels?.[p.i] || '';
                                            const parts = raw.split(' ');
                                            const mStr = parts[0] ? parts[0].substring(0, 3) : '';
                                            const yStr = parts[1] || '';
                                            const lbl = `${mStr} ${yStr}`;

                                            return (
                                                <g key={p.i}
                                                    onMouseEnter={() => setHoveredIndex(p.i)}
                                                    onMouseLeave={() => setHoveredIndex(null)}
                                                    style={{ cursor: 'crosshair' }}
                                                >
                                                    <circle cx={p.x} cy={p.y} r="8" fill="transparent" />
                                                    <circle cx={p.x} cy={p.y} r={hoveredIndex === p.i ? 3 : 1.5} fill={color || "#3b82f6"} />
                                                    <text x={p.x} y={40} fontSize="9" fill="#94a3b8" textAnchor="middle">
                                                        {lbl}
                                                    </text>
                                                </g>
                                            );
                                        })}
                                    </svg>
                                    {hoveredIndex !== null && pts[hoveredIndex] && (
                                        <div style={{
                                            position: 'absolute',
                                            left: isNaN(pts[hoveredIndex].x) ? 0 : Math.min(pts[hoveredIndex].x, w - 80),
                                            top: isNaN(pts[hoveredIndex].y) ? 0 : Math.max(0, pts[hoveredIndex].y - 25),
                                            background: '#1e293b',
                                            color: 'white',
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            fontSize: '10px',
                                            pointerEvents: 'none',
                                            whiteSpace: 'nowrap',
                                            zIndex: 10,
                                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                        }}>
                                            {data.monthLabels[hoveredIndex]}: {formatValue(pts[hoveredIndex].v)}
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                )}

                <div className="node-footer">
                    <div className="footer-stat" style={{ flex: '1 1 100%' }}>
                        <span className="stat-label">Baseline Values</span>
                        <span className="stat-value">{formatValue(baselineVal)}</span>
                    </div>
                    {isScenarioMode && selectedScenarioIds && selectedScenarioIds.length > 1 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '4px', marginTop: '4px' }}>
                            {selectedScenarioIds.map(scenId => {
                                const scenName = scenarios?.[scenId]?.name || 'Scenario';
                                const sVals = calculatedScenarioValues?.[scenId] || [];
                                const sVal = sVals[periodCount] ?? 0;
                                const sVar = (typeof sVal === 'number' && typeof baselineVal === 'number' && baselineVal !== 0)
                                    ? ((sVal - baselineVal) / Math.abs(baselineVal)) * 100
                                    : 0;
                                const safeSVar = isNaN(sVar) ? 0 : sVar;
                                const sPos = data.desiredTrend === 'DECREASE' ? safeSVar <= 0 : safeSVar >= 0;
                                const sClass = isNaN(safeSVar) || Math.abs(safeSVar) < 0.01 ? 'neutral' : (sPos ? 'pos' : 'neg');

                                return (
                                    <div key={scenId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', background: 'rgba(255,255,255,0.5)', padding: '2px 4px', borderRadius: '4px' }}>
                                        <span style={{ color: '#475569', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={scenName}>{scenName}</span>
                                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                            <span style={{ fontWeight: 600, color: '#1e293b' }}>{formatValue(sVal)}</span>
                                            <span className={`footer-stat variance ${sClass}`} style={{ padding: '0 4px', fontSize: '9px', minWidth: '35px', textAlign: 'center' }}>
                                                {safeSVar > 0 ? '+' : ''}{safeSVar.toFixed(1)}%
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        isScenarioMode && (
                            <div className={`footer-stat variance ${varianceClass}`}>
                                <span className="stat-label">Overall Scenario Delta</span>
                                <span className="stat-value">
                                    {variance > 0 ? '+' : ''}{variance.toFixed(1)}%
                                </span>
                            </div>
                        )
                    )}
                </div>
            </div>

            {/* Hover Actions */}
            <div className="card-controls" onClick={e => e.stopPropagation()}>
                {semantic?.businessOwner && (
                    <div className="semantic-pill owner" title={`Business Owner: ${semantic.businessOwner}`}>
                        <User size={10} /> {semantic.businessOwner.split(' ')[0]}
                    </div>
                )}
                {semantic?.dataSource && (
                    <div className="semantic-pill source" title={`Source: ${semantic.dataSource}`}>
                        <Search size={10} /> {semantic.dataSource}
                    </div>
                )}
                <div className="spacer" />
                {parentId && onDisconnect && (
                    <button
                        className="icon-btn-sm"
                        onClick={(e) => { e.stopPropagation(); onDisconnect(id); }}
                        title="Disconnect from Parent"
                    >
                        <Link2Off size={12} />
                    </button>
                )}
                <button className="icon-btn-sm" onClick={() => onSettings(id)} title="Node Settings"><Settings size={12} /></button>
                <button
                    className={`icon-btn-sm ${comment ? 'active' : ''}`}
                    onClick={(e) => { e.stopPropagation(); setIsCommenting(!isCommenting); }}
                    title="Add/Edit Comment"
                >
                    <MessageSquare size={12} />
                </button>
                <button className="icon-btn-sm" onClick={() => onAddChild(id)} title="Add Sub-KPI"><Plus size={12} /></button>
                <button className="icon-btn-sm" onClick={(e) => { e.stopPropagation(); onSplitToPage(id); }} title="Split subtree to new page"><Scissors size={12} /></button>
                <button className="icon-btn-sm" onClick={() => onResetKPI(id)} title="Reset KPI Data"><RefreshCcw size={12} /></button>
                {onDeleteKPI && (
                    <button className="icon-btn-sm danger" onClick={(e) => { e.stopPropagation(); onDeleteKPI(id); }} title="Delete KPI Branch">
                        <Trash2 size={12} />
                    </button>
                )}
            </div>

            {isCommenting && (
                <div
                    className="node-comment-overlay nodrag nopan"
                    onClick={e => e.stopPropagation()}
                    style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        zIndex: 100,
                        background: 'white',
                        padding: '12px',
                        borderRadius: '0 0 12px 12px',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                        border: '1px solid #e2e8f0',
                        marginTop: '-4px'
                    }}
                >
                    <textarea
                        ref={commentRef}
                        className="comment-textarea"
                        value={commentValue}
                        onChange={e => setCommentValue(e.target.value)}
                        placeholder="Add a comment..."
                        style={{
                            width: '100%',
                            minHeight: '60px',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            padding: '8px',
                            fontSize: '12px',
                            resize: 'vertical',
                            outline: 'none',
                            marginBottom: '8px'
                        }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button
                            className="ghost-btn-sm"
                            onClick={() => setIsCommenting(false)}
                            style={{ fontSize: '11px', padding: '4px 8px' }}
                        >
                            Cancel
                        </button>
                        <button
                            className="primary-btn-sm"
                            onClick={handleCommentCommit}
                            style={{ fontSize: '11px', padding: '4px 12px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                        >
                            Save
                        </button>
                    </div>
                </div>
            )}



            <div className="node-expansion-toggle" onClick={(e) => { e.stopPropagation(); onToggleExpand(id); }}>
                {isExpanded ? <Minus size={14} /> : <Plus size={14} />}
            </div>

            <Handle type="source" position={Position.Right} />
        </div>
    );
};

export default memo(KPINode);


