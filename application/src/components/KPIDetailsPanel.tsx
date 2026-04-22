import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
    X, TrendingUp, TrendingDown, 
    ChevronRight, ChevronLeft, 
    Trash2, GripHorizontal, Activity, FileText,
    Layers, ChevronDown, MoveUp, MoveDown,
    Calendar
} from 'lucide-react';
import { formatValue } from '../utils/format';
import type { KPIData, Scenario } from '../types';

interface KPIDetailsPanelProps {
    isOpen: boolean;
    onClose: () => void;
    selectedIds: string[];
    kpis: Record<string, KPIData>;
    calculatedValues: Record<string, number[]>;
    baseValues: Record<string, number[]>;
    monthLabels: string[];
    onSettings: (id: string) => void;
    onCommentChange: (id: string, comment: string | any[]) => void;
    onRemoveFromSelection: (id: string) => void;
    activeScenarioId: string;
    scenarios: Record<string, Scenario>;
    onScenarioSelect: (id: string) => void;
    onKPISelect?: (id: string) => void;
}

const KPIDetailsPanel: React.FC<KPIDetailsPanelProps> = ({
    isOpen,
    onClose,
    selectedIds = [],
    kpis = {},
    calculatedValues = {},
    baseValues = {},
    monthLabels = [],
    onRemoveFromSelection,
    onCommentChange,
    activeScenarioId,
    scenarios = {},
    onScenarioSelect,
    onKPISelect
}) => {
    const [activeIndex, setActiveIndex] = useState(0);
    const [viewMode, setViewMode] = useState<'overview' | 'commentary'>('overview');
    const [showScenarioDropdown, setShowScenarioDropdown] = useState(false);
    const [selectedMonthIdx, setSelectedMonthIdx] = useState<number | null>(null);
    const [selectedYearIdx, setSelectedYearIdx] = useState<number | null>(null);
    const [activeCommentPageIdx, setActiveCommentPageIdx] = useState(0);
    const [editingCommentPageIdx, setEditingCommentPageIdx] = useState<number | null>(null);
    
    const [position, setPosition] = useState({ x: window.innerWidth - 280, y: 40 });
    const [size, setSize] = useState({ width: 260, height: 600 });
    
    const isDragging = useRef(false);
    const isResizing = useRef(false);
    const lastMousePos = useRef({ x: 0, y: 0 });
    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (activeIndex >= selectedIds.length && selectedIds.length > 0) {
            setActiveIndex(selectedIds.length - 1);
        }
    }, [selectedIds.length, activeIndex]);

    // Track the last selected ID to auto-switch focus when a new one is added
    const lastSelectionCount = useRef(selectedIds.length);
    useEffect(() => {
        if (selectedIds.length > lastSelectionCount.current) {
            setActiveIndex(selectedIds.length - 1);
        }
        lastSelectionCount.current = selectedIds.length;
    }, [selectedIds.length]);

    const activeId = selectedIds[activeIndex];
    const kpi = activeId ? kpis[activeId] : null;

    const navigateToKpi = useCallback((id: string) => {
        if (onKPISelect) {
            onKPISelect(id);
        } else {
            // Fallback to internal selection if global handler not provided
            if (selectedIds.includes(id)) {
                setActiveIndex(selectedIds.indexOf(id));
            }
        }
    }, [selectedIds, onKPISelect]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;
            if (e.key === 'ArrowLeft') {
                setActiveIndex(prev => Math.max(0, prev - 1));
            } else if (e.key === 'ArrowRight') {
                setActiveIndex(prev => Math.min(selectedIds.length - 1, prev + 1));
            } else if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, selectedIds.length, onClose]);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('textarea') || target.closest('select') || target.closest('.scenario-selector-header')) return;

        if (target.closest('.window-header')) {
            isDragging.current = true;
            panelRef.current?.classList.add('is-dragging');
            lastMousePos.current = { x: e.clientX, y: e.clientY };
            e.preventDefault();
        } else if (target.closest('.window-resize-handle')) {
            isResizing.current = true;
            lastMousePos.current = { x: e.clientX, y: e.clientY };
            e.preventDefault();
        }
    }, []);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging.current && !isResizing.current) return;

            const deltaX = e.clientX - lastMousePos.current.x;
            const deltaY = e.clientY - lastMousePos.current.y;
            lastMousePos.current = { x: e.clientX, y: e.clientY };

            if (isDragging.current) {
                setPosition(prev => ({
                    x: Math.max(5, Math.min(window.innerWidth - size.width - 5, prev.x + deltaX)),
                    y: Math.max(5, Math.min(window.innerHeight - size.height - 5, prev.y + deltaY))
                }));
            }

            if (isResizing.current) {
                setSize(prev => ({
                    width: Math.max(240, Math.min(450, prev.width + deltaX)),
                    height: Math.max(350, Math.min(window.innerHeight - 20, prev.height + deltaY))
                }));
            }
        };

        const handleMouseUp = () => {
            isDragging.current = false;
            isResizing.current = false;
            panelRef.current?.classList.remove('is-dragging');
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [size]);

    if (!isOpen || selectedIds.length === 0 || !kpi) return null;

    const activeScenario = scenarios[activeScenarioId];
    const kpisCoreValues = calculatedValues[activeId] || [];
    const kpisBaseValues = baseValues[activeId] || [];
    
    // Period Selection Logic
    const currentMonthIdx = selectedMonthIdx !== null ? selectedMonthIdx : Math.max(0, kpisCoreValues.length - 2);
    const currentYearIdx = selectedYearIdx !== null ? selectedYearIdx : Math.max(0, kpisCoreValues.length - 1);

    const heroVal = kpisCoreValues[kpisCoreValues.length - 1] || 0;
    
    const mtdVal = kpisCoreValues[currentMonthIdx] || 0;
    const mtdBase = kpisBaseValues[currentMonthIdx] || 0;
    const mtdVar = mtdBase !== 0 ? ((mtdVal - mtdBase) / Math.abs(mtdBase)) * 100 : 0;
    
    const ytdVal = kpisCoreValues[currentYearIdx] || 0;
    const ytdBase = kpisBaseValues[currentYearIdx] || 0;
    const ytdVar = ytdBase !== 0 ? ((ytdVal - ytdBase) / Math.abs(ytdBase)) * 100 : 0;

    const parentNode = kpi.parentId ? kpis[kpi.parentId] : null;
    const childrenNodes = (kpi.children || []).map((id: string) => kpis[id]).filter(Boolean) as KPIData[]; 

    // Color Logic: Use Formula color or fallback
    const getCategoryColor = (formula: string, defaultColor?: string) => { 
        switch (formula) { 
            case 'NONE': return '#3b82f6'; 
            case 'SUM': case 'PRODUCT': case 'AVERAGE': return '#10B981'; 
            case 'CUSTOM': return '#EC4899'; 
            default: return defaultColor || '#64748B'; 
        } 
    };

    const heroColor = getCategoryColor(kpi.formula, kpi.color);

    return (
        <div 
            ref={panelRef}
            className="kpi-inspector-window"
            style={{ 
                left: position.x, 
                top: position.y,
                width: size.width,
                height: size.height,
                position: 'fixed',
                display: 'flex',
                flexDirection: 'column'
            }}
            onMouseDown={handleMouseDown}
        >
            <div className="window-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div className="scenario-selector-header" onClick={() => setShowScenarioDropdown(!showScenarioDropdown)}>
                        <Layers size={10} style={{ color: heroColor }} />
                        <span>{activeScenario?.name || 'Standard'}</span>
                        <ChevronDown size={10} style={{ opacity: 0.5 }} />
                    </div>
                </div>
                <button className="close-panel-btn-text" onClick={onClose}>Close</button>
            </div>

            <div className="inspector-tabs" style={{ background: 'rgba(0,0,0,0.02)', padding: '3px' }}>
                <button className={`tab-btn ${viewMode === 'overview' ? 'active' : ''}`} onClick={() => setViewMode('overview')}>Overview</button>
                <button className={`tab-btn ${viewMode === 'commentary' ? 'active' : ''}`} onClick={() => setViewMode('commentary')}>Commentary</button>
            </div>

            {selectedIds.length > 1 && (
                <div style={{ 
                    padding: '6px 14px', 
                    background: 'rgba(0,0,0,0.03)', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    borderBottom: '1px solid rgba(0,0,0,0.05)'
                }}>
                    <div style={{ display: 'flex', gap: '4px' }}>
                        <button 
                            onClick={() => setActiveIndex(prev => Math.max(0, prev - 1))}
                            disabled={activeIndex === 0}
                            style={{ 
                                background: 'white', 
                                border: '1px solid #e2e8f0', 
                                borderRadius: '6px', 
                                padding: '2px',
                                opacity: activeIndex === 0 ? 0.3 : 1,
                                cursor: activeIndex === 0 ? 'default' : 'pointer'
                            }}
                        >
                            <ChevronLeft size={12} />
                        </button>
                        <button 
                            onClick={() => setActiveIndex(prev => Math.min(selectedIds.length - 1, prev + 1))}
                            disabled={activeIndex === selectedIds.length - 1}
                            style={{ 
                                background: 'white', 
                                border: '1px solid #e2e8f0', 
                                borderRadius: '4px', 
                                padding: '2px',
                                opacity: activeIndex === selectedIds.length - 1 ? 0.3 : 1,
                                cursor: activeIndex === selectedIds.length - 1 ? 'default' : 'pointer'
                            }}
                        >
                            <ChevronRight size={12} />
                        </button>
                    </div>
                    <span style={{ fontSize: '0.6rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        KPI {activeIndex + 1} of {selectedIds.length}
                    </span>
                    <button 
                        onClick={() => onRemoveFromSelection(activeId)}
                        style={{ background: 'none', border: 'none', padding: 0, color: '#ef4444', cursor: 'pointer', opacity: 0.7 }}
                    >
                        <Trash2 size={12} />
                    </button>
                </div>
            )}

            <div className="inspector-body custom-scrollbar" style={{ padding: 0 }}>
                {viewMode === 'overview' ? (
                    <>
                        {/* Dynamic Hero Section based on KPI color */}
                        <div 
                            className="inspector-hero" 
                            style={{ 
                                background: `linear-gradient(145deg, ${heroColor} 0%, ${heroColor}DD 100%)`,
                                boxShadow: `0 8px 24px -6px ${heroColor}55`,
                                borderRadius: '24px',
                                margin: '12px 14px 16px'
                            }}
                        >
                            <span className="hero-label" style={{ fontSize: '0.7rem', opacity: 0.9 }}>{kpi.label}</span>
                            <div className="hero-value" style={{ fontSize: '1.8rem', marginBottom: '2px' }}>{formatValue(ytdVal)}</div>
                            <div style={{ fontSize: '0.6rem', opacity: 0.8, fontWeight: 700, letterSpacing: '0.04em' }}>
                                TOTAL {kpi.unit} • FY PERFORMANCE
                            </div>
                        </div>

                        <div className="sub-metrics-clean" style={{ padding: '0 20px 16px', display: 'flex', gap: '32px', maxWidth: '100%', overflowX: 'hidden' }}>
                            {/* MTD Sector */}
                            <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span className="box-label" style={{ fontSize: '0.6rem', color: '#94a3b8', fontWeight: 800, letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>MTD</span>
                                    <select 
                                        value={currentMonthIdx} 
                                        onChange={(e) => setSelectedMonthIdx(parseInt(e.target.value))}
                                        className="period-select-tiny"
                                        style={{ color: heroColor, appearance: 'auto', position: 'relative', zIndex: 10, cursor: 'pointer' }}
                                    >
                                        {monthLabels.map((m, i) => <option key={m} value={i} style={{ color: '#000' }}>{m}</option>)}
                                    </select>
                                </div>
                                <div className="box-value" style={{ fontSize: '1.4rem', fontWeight: 850, color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1 }}>
                                    {formatValue(mtdVal)}
                                </div>
                                <div style={{ fontSize: '0.75rem', fontWeight: 850, color: mtdVar >= 0 ? '#10b981' : '#ef4444', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                    {mtdVar >= 0 ? '▲' : '▼'} {Math.abs(mtdVar).toFixed(1)}%
                                </div>
                            </div>

                            {/* YTD Sector */}
                            <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span className="box-label" style={{ fontSize: '0.6rem', color: '#94a3b8', fontWeight: 800, letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>YTD</span>
                                    <select 
                                        value={currentYearIdx} 
                                        onChange={(e) => setSelectedYearIdx(parseInt(e.target.value))}
                                        className="period-select-tiny"
                                        style={{ color: heroColor, appearance: 'auto', position: 'relative', zIndex: 10, cursor: 'pointer' }}
                                    >
                                        <option value={kpisCoreValues.length - 1} style={{ color: '#000' }}>FY 26</option>
                                        <option value={Math.max(0, kpisCoreValues.length - 13)} style={{ color: '#000' }}>FY 25</option>
                                    </select>
                                </div>
                                <div className="box-value" style={{ fontSize: '1.4rem', fontWeight: 850, color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1 }}>
                                    {formatValue(ytdVal)}
                                </div>
                                <div style={{ fontSize: '0.75rem', fontWeight: 850, color: ytdVar >= 0 ? '#10b981' : '#ef4444', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                    {ytdVar >= 0 ? '▲' : '▼'} {Math.abs(ytdVar).toFixed(1)}%
                                </div>
                            </div>
                        </div>

                        {/* Calculation Logic Section */}
                        <div style={{ padding: '0 14px 12px' }}>
                            <div className="hierarchy-label" style={{ fontSize: '0.6rem', marginBottom: '6px' }}>Calculation Logic</div>
                            <div style={{ 
                                background: 'rgba(0,0,0,0.02)', 
                                padding: '8px 12px', 
                                borderRadius: '12px',
                                border: '1px solid rgba(0,0,0,0.03)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}>
                                <div style={{ 
                                    padding: '2px 8px', 
                                    background: heroColor, 
                                    borderRadius: '6px', 
                                    fontSize: '0.55rem', 
                                    fontWeight: 900, 
                                    color: 'white',
                                    letterSpacing: '0.03em'
                                }}>
                                    {kpi.formula === 'NONE' ? 'INPUT' : kpi.formula}
                                </div>
                                <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 600 }}>
                                    {kpi.formula === 'NONE' ? 'Base entry point' : `Aggregates children via ${kpi.formula.toLowerCase()}`}
                                </span>
                            </div>
                        </div>

                        {/* Network Hierarchy Section */}
                        <div style={{ padding: '0 14px 16px' }}>
                            <div className="hierarchy-label" style={{ fontSize: '0.6rem', marginBottom: '8px' }}>Asset Relations</div>
                            <div className="hierarchy-structure-container" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                
                                {/* Parent Box */}
                                <div style={{ 
                                    border: '1.5px solid rgba(0,0,0,0.04)', 
                                    borderRadius: '12px', 
                                    padding: '10px',
                                    background: 'rgba(0,0,0,0.015)'
                                }}>
                                    <div className="hierarchy-type-tag" style={{ fontSize: '0.45rem', marginBottom: '6px', opacity: 0.6 }}>PARENT NODE</div>
                                    {parentNode ? (
                                        <button 
                                            className="navigatable-box"
                                            onClick={() => navigateToKpi(parentNode.id)}
                                            style={{ 
                                                background: 'white', 
                                                border: '1px solid #e2e8f0', 
                                                borderRadius: '8px',
                                                padding: '8px 12px',
                                                width: '100%',
                                                textAlign: 'left',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                                            }}
                                        >
                                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#1e293b' }}>{parentNode.label}</span>
                                            <ChevronRight size={10} style={{ opacity: 0.5 }} />
                                        </button>
                                    ) : (
                                        <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontStyle: 'italic', padding: '4px' }}>Strategic Root</div>
                                    )}
                                </div>

                                {/* Children Box */}
                                <div style={{ 
                                    border: '1.5px solid rgba(0,0,0,0.04)', 
                                    borderRadius: '12px', 
                                    padding: '10px',
                                    background: 'rgba(0,0,0,0.015)'
                                }}>
                                    <div className="hierarchy-type-tag" style={{ fontSize: '0.45rem', marginBottom: '6px', opacity: 0.6 }}>CHILD NODES</div>
                                    {childrenNodes.length > 0 ? (
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '6px' }}>
                                            {childrenNodes.map((child: KPIData) => (
                                                <button 
                                                    key={child.id} 
                                                    className="navigatable-box"
                                                    onClick={() => navigateToKpi(child.id)}
                                                    style={{ 
                                                        background: 'white', 
                                                        border: '1px solid #e2e8f0', 
                                                        borderRadius: '8px',
                                                        padding: '6px 10px',
                                                        width: '100%',
                                                        textAlign: 'left',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center',
                                                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                                                    }}
                                                >
                                                    <span style={{ fontSize: '0.65rem', fontWeight: 600, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis' }}>{child.label}</span>
                                                    <ChevronRight size={10} style={{ opacity: 0.5 }} />
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontStyle: 'italic', padding: '4px' }}>Leaf node (no components)</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Monthly Timeline Section */}
                        <div style={{ padding: '0 14px 14px' }}>
                            <div className="hierarchy-label" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.6rem' }}>
                                <Calendar size={10} /> Monthly Timeline
                            </div>
                            <div className="monthly-grid-compact">
                                {monthLabels.map((month, idx) => {
                                    const val = kpisCoreValues[idx] || 0;
                                    const bVal = kpisBaseValues[idx] || 0;
                                    const mVar = bVal !== 0 ? ((val - bVal) / Math.abs(bVal)) * 100 : 0;
                                    
                                    return (
                                        <div key={month} className="monthly-row-tiny">
                                            <span className="month-name-tiny" style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 600 }}>{month}</span>
                                            <div style={{ textAlign: 'right' }}>
                                                <span className="month-value-tiny" style={{ fontSize: '0.65rem' }}>{formatValue(val)}</span>
                                                <span style={{ 
                                                    fontSize: '0.55rem', 
                                                    marginLeft: '6px', 
                                                    fontWeight: 700,
                                                    color: mVar >= 0 ? '#10b981' : '#ef4444'
                                                }}>
                                                    {mVar > 0 ? '+' : ''}{mVar.toFixed(1)}%
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="commentary-area" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none' }}>
                            {(kpi.commentaryPages || [{id: 'p1', name: 'Page 1', content: kpi.comment || ''}]).map((page, idx) => {
                                const isActive = activeCommentPageIdx === idx;
                                const isEditing = editingCommentPageIdx === idx;
                                
                                return (
                                    <div key={page.id} style={{ position: 'relative', flexShrink: 0 }}>
                                        {isEditing ? (
                                            <input 
                                                autoFocus
                                                defaultValue={page.name}
                                                onBlur={(e) => {
                                                    const newPages = [...(kpi.commentaryPages || [{ id: 'p1', name: 'Page 1', content: kpi.comment || '' }])];
                                                    if (newPages[idx]) {
                                                        newPages[idx].name = e.target.value || `Page ${idx + 1}`;
                                                        onCommentChange(activeId, newPages);
                                                    }
                                                    setEditingCommentPageIdx(null);
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') (e.target as HTMLFormElement).blur();
                                                }}
                                                style={{
                                                    fontSize: '0.6rem',
                                                    fontWeight: 700,
                                                    padding: '2px 6px',
                                                    borderRadius: '4px',
                                                    border: '1px solid #3b82f6',
                                                    width: '60px',
                                                    outline: 'none'
                                                }}
                                            />
                                        ) : (
                                            <button 
                                                onClick={() => {
                                                    if (isActive) setEditingCommentPageIdx(idx);
                                                    else setActiveCommentPageIdx(idx);
                                                }}
                                                style={{ 
                                                    height: '24px', 
                                                    padding: '0 8px',
                                                    borderRadius: '6px', 
                                                    fontSize: '0.6rem', 
                                                    background: isActive ? '#3b82f6' : '#f1f5f9',
                                                    color: isActive ? 'white' : '#64748b',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    fontWeight: 700,
                                                    whiteSpace: 'nowrap',
                                                    transition: 'all 0.2s ease',
                                                    borderBottom: isActive ? '2px solid #2563eb' : 'none'
                                                }}
                                            >
                                                {page.name}
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                            
                            <button 
                                onClick={() => {
                                    const newPages = [...(kpi.commentaryPages || [{ id: 'p1', name: 'Page 1', content: kpi.comment || '' }])];
                                    const newId = `cp-${Date.now()}`;
                                    newPages.push({ id: newId, name: `Page ${newPages.length + 1}`, content: '' });
                                    onCommentChange(activeId, newPages);
                                    setActiveCommentPageIdx(newPages.length - 1);
                                    setEditingCommentPageIdx(newPages.length - 1); // Auto-edit after adding
                                }}
                                style={{ 
                                    width: '24px', 
                                    height: '24px', 
                                    borderRadius: '6px', 
                                    fontSize: '0.9rem', 
                                    background: '#f8fafc',
                                    color: '#3b82f6',
                                    border: '1px dashed #cbd5e1',
                                    cursor: 'pointer',
                                    fontWeight: 700,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0
                                }}
                                title="Add Page"
                            >
                                +
                            </button>
                        </div>

                        <textarea 
                            style={{ 
                                fontSize: '0.7rem', 
                                height: '160px', 
                                borderRadius: '12px',
                                border: '1px solid #e2e8f0',
                                padding: '10px',
                                background: '#f8fafc',
                                resize: 'none',
                                lineHeight: '1.5'
                            }}
                            placeholder={`Enter notes for ${(kpi.commentaryPages?.[activeCommentPageIdx]?.name || 'Page ' + (activeCommentPageIdx + 1))}...`}
                            value={kpi.commentaryPages?.[activeCommentPageIdx]?.content ?? kpi.comment ?? ''}
                            onChange={(e) => {
                                const newPages = [...(kpi.commentaryPages || [{ id: 'p1', name: 'Page 1', content: kpi.comment || '' }])];
                                if (newPages[activeCommentPageIdx]) {
                                    newPages[activeCommentPageIdx].content = e.target.value;
                                    onCommentChange(activeId, newPages);
                                } else {
                                    onCommentChange(activeId, e.target.value);
                                }
                            }}
                        />
                    </div>
                )}
            </div>

            {showScenarioDropdown && (
                <div className="dropdown-overlay" style={{ top: '38px', left: '10px' }}>
                    {Object.values(scenarios).map(s => (
                        <div 
                            key={s.id} 
                            className={`dropdown-item ${s.id === activeScenarioId ? 'active' : ''}`}
                            onClick={() => {
                                onScenarioSelect(s.id);
                                setShowScenarioDropdown(false);
                            }}
                        >
                            {s.name}
                        </div>
                    ))}
                </div>
            )}

            <div className="window-resize-handle" style={{ position: 'absolute', bottom: 0, right: 0, width: 14, height: 14, cursor: 'nwse-resize' }} />
        </div>
    );
};

export default KPIDetailsPanel;
