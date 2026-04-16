import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { X, Trash2 } from 'lucide-react';
import type { KPIData, FormulaType, AppState } from '../types';
import { getMonthsInRange } from '../utils/dateRange';

interface KPISettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    editingId: string | null;
    kpis: Record<string, KPIData>;
    setKpis: (updater: (prev: Record<string, KPIData>) => Record<string, KPIData>, forceUpdateBase?: boolean, targetScenarioId?: string) => void;
    calculatedValues: Record<string, number[]>;
    appState: AppState;
    onOverallOverrideChange: (id: string, yearKeyOrValue: string | number | undefined, value?: number) => void;
    onDeleteKPI: (id: string) => void;
    monthLabels: string[];
    logActivity: (activity: any) => void;
}

const KPISettingsModal: React.FC<KPISettingsModalProps> = ({
    isOpen,
    onClose,
    editingId,
    kpis,
    setKpis,
    calculatedValues,
    appState,
    onOverallOverrideChange,
    onDeleteKPI,
    monthLabels,
    logActivity
}) => {
    // Local State
    const [settingsShowSlider, setSettingsShowSlider] = useState(false);
    const [settingsSliderValue, setSettingsSliderValue] = useState(0);
    const [settingsSliderBase, setSettingsSliderBase] = useState(0);
    const [bulkPercentage, setBulkPercentage] = useState<string>('0');
    const [bulkStartMonth, setBulkStartMonth] = useState(0);
    const [bulkStartYear, setBulkStartYear] = useState(2024);
    const [bulkEndMonth, setBulkEndMonth] = useState(11);
    const [bulkEndYear, setBulkEndYear] = useState(2024);
    const [formulaSuggestions, setFormulaSuggestions] = useState<KPIData[]>([]);
    const [suggestionIndex, setSuggestionIndex] = useState(0);

    const months = useMemo(() => ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], []);

    // Initialize state when editingId changes
    useEffect(() => {
        if (isOpen && editingId && kpis[editingId]) {
            const currentKpi = kpis[editingId];
            setSettingsShowSlider(false);
            setSettingsSliderValue(0);
            
            // Capture base value for slider
            const baseTotal = (currentKpi.overallOverride && currentKpi.overallOverride[appState.dateRange.endYear.toString()]) || 
                             (calculatedValues[editingId]?.[monthLabels.length] || 0);
            setSettingsSliderBase(baseTotal);
            
            setBulkStartMonth(appState.dateRange.startMonth);
            setBulkStartYear(appState.dateRange.startYear);
            setBulkEndMonth(appState.dateRange.endMonth);
            setBulkEndYear(appState.dateRange.endYear);
            setBulkPercentage('0');
        }
    }, [isOpen, editingId, kpis, appState.dateRange, calculatedValues, monthLabels.length]);

    const handleBulkAdjust = useCallback(() => {
        if (!editingId) return;
        const percentage = parseFloat(bulkPercentage);
        if (isNaN(percentage)) return;

        const factor = 1 + (percentage / 100);
        const monthsInRange = getMonthsInRange(bulkStartMonth, bulkStartYear, bulkEndMonth, bulkEndYear);
        const monthLabelsKeys = monthsInRange.map(m => m.label);

        setKpis(prev => {
            const next = { ...prev };
            const current = next[editingId];
            if (!current) return prev;
            
            const newData = current.data.map(d => {
                if (monthLabelsKeys.includes(d.month)) {
                    return { ...d, actual: d.actual * factor };
                }
                return d;
            });

            // Also update monthlyOverrides if they exist
            let newOverrides = { ...(current.monthlyOverrides || {}) };
            const appMonthsInRange = getMonthsInRange(appState.dateRange.startMonth, appState.dateRange.startYear, appState.dateRange.endMonth, appState.dateRange.endYear);
            
            for (let i = 0; i < appMonthsInRange.length; i++) {
                const mObj = appMonthsInRange[i];
                if (mObj && monthLabelsKeys.includes(mObj.label)) {
                    const monthKey = `${mObj.year}-${mObj.month}`;
                    const isMutable = !current.isLocked && !current.lockedMonths?.[monthKey];
                    if (isMutable) {
                        const calcOld = calculatedValues[editingId]?.[i] ?? 0;
                        const currentVal = newOverrides[monthKey] !== undefined ? (newOverrides[monthKey] as number) : calcOld;
                        newOverrides[monthKey] = currentVal * factor;
                    }
                }
            }

            next[editingId] = {
                ...current,
                data: newData,
                monthlyOverrides: newOverrides,
                simulationValue: 0,
                overallOverride: undefined
            };

            // Clear overrides for all ancestors to keep them dynamic
            let pId = current.parentId;
            while (pId && next[pId]) {
                const parentData = next[pId];
                let parentOverrides = { ...(parentData.monthlyOverrides || {}) };
                appMonthsInRange.forEach(mObj => {
                    const monthKey = `${mObj.year}-${mObj.month}`;
                    if (monthLabelsKeys.includes(mObj.label)) {
                        delete parentOverrides[monthKey];
                    }
                });
                next[pId] = {
                    ...parentData,
                    monthlyOverrides: parentOverrides,
                    overallOverride: undefined
                };
                pId = parentData.parentId;
            }
            return next;
        });

        logActivity({
            action: 'EDIT',
            details: `Bulk adjusted ${kpis[editingId]?.label} by ${percentage}% from ${monthLabelsKeys[0]} to ${monthLabelsKeys[monthLabelsKeys.length - 1]}`,
            kpiId: editingId
        });
    }, [editingId, bulkPercentage, bulkStartMonth, bulkStartYear, bulkEndMonth, bulkEndYear, kpis, setKpis, logActivity, appState.dateRange, calculatedValues]);

    if (!isOpen || !editingId || !kpis[editingId]) return null;

    const kpi = kpis[editingId];

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ width: '850px', maxWidth: '95vw' }}>
                <div className="modal-header">
                    <h2>KPI Settings</h2>
                    <button className="close-btn" onClick={onClose}><X size={20} /></button>
                </div>
                <div className="modal-body">
                    {/* Label */}
                    <div className="form-group">
                        <label>Label</label>
                        <input
                            value={kpi.label}
                            onChange={e => setKpis(prev => ({ ...prev, [editingId]: { ...prev[editingId], label: e.target.value } }))}
                        />
                    </div>
                    {/* Row: Total, Unit, Formula */}
                    <div className="form-row">
                        <div className="form-group">
                            <label>Overall Total</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input
                                    type="number"
                                    value={
                                        (kpi.overallOverride?.[appState.dateRange.endYear.toString()] as number) ??
                                        (calculatedValues[editingId]?.[monthLabels.length] || 0)
                                    }
                                    onChange={e => {
                                        const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                                        onOverallOverrideChange(editingId, appState.dateRange.endYear.toString(), val);
                                        setSettingsSliderValue(0);
                                    }}
                                    disabled={kpi.formula !== 'NONE'}
                                    title={kpi.formula !== 'NONE' ? "Computed nodes cannot have overriding totals directly set." : ""}
                                    style={{ flex: 1, backgroundColor: kpi.formula !== 'NONE' ? '#f1f5f9' : 'white', cursor: kpi.formula !== 'NONE' ? 'not-allowed' : 'text' }}
                                />
                                <button
                                    onClick={() => setSettingsShowSlider(!settingsShowSlider)}
                                    style={{ padding: '0 12px', background: 'white', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', color: '#3b82f6', fontWeight: 600 }}
                                    title="Adjust by Percentage"
                                    disabled={kpi.formula !== 'NONE'}
                                >
                                    %
                                </button>
                            </div>
                            {settingsShowSlider && kpi.formula === 'NONE' && (
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
                                            // FIX: Passing the year key to maintain consistency and fix the identified bug
                                            onOverallOverrideChange(editingId, appState.dateRange.endYear.toString(), finalVal);
                                        }}
                                        style={{ flex: 1, cursor: 'pointer', accentColor: '#3b82f6' }}
                                    />
                                </div>
                            )}
                        </div>
                        <div className="form-group">
                            <label>Unit</label>
                            <input
                                value={kpi.unit}
                                onChange={e => setKpis(prev => ({ ...prev, [editingId]: { ...prev[editingId], unit: e.target.value } }))}
                            />
                        </div>
                        <div className="form-group">
                            <label>Calculation Formula</label>
                            <select
                                value={kpi.formula}
                                onChange={e => setKpis(prev => ({
                                    ...prev,
                                    [editingId]: {
                                        ...prev[editingId],
                                        formula: e.target.value as FormulaType,
                                        overallOverride: undefined
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

                    {/* Custom Formula */}
                    {kpi.formula === 'CUSTOM' && (
                        <div className="form-group">
                            <label>Custom Logic (e.g. Revenue - TotalCosts)</label>
                            <div className="formula-input-wrapper">
                                <input
                                    id="modal-custom-formula"
                                    value={kpi.customFormula || ''}
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
                                                const currentVal = kpi.customFormula || '';
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
                                                key={`${s.id}-${i}`}
                                                className={`suggestion-item ${i === suggestionIndex ? 'active' : ''}`}
                                                onClick={() => {
                                                    const currentVal = kpi.customFormula || '';
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

                    {/* Semantic Attributes */}
                    <div className="form-row">
                        <div className="form-group">
                            <label>Business Owner</label>
                            <input
                                value={kpi.semantic?.businessOwner || ''}
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
                                value={kpi.semantic?.dataSource || ''}
                                onChange={e => setKpis(prev => ({
                                    ...prev,
                                    [editingId]: {
                                        ...prev[editingId],
                                        semantic: { ...prev[editingId].semantic, dataSource: e.target.value }
                                    }
                                }))}
                            />
                        </div>
                    </div>

                    <div className="modal-section-divider" style={{ height: '1px', background: '#e2e8f0', margin: '20px 0' }}></div>

                    {/* Bulk Adjust Section */}
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
                                        {months.map((m, i) => <option key={`${m}-${i}`} value={i}>{m}</option>)}
                                    </select>
                                    <select
                                        style={{ width: '100px', padding: '10px', fontSize: '0.85rem', background: 'white', border: '1px solid #cbd5e1', color: '#1e293b', borderRadius: '8px' }}
                                        value={bulkStartYear} onChange={e => setBulkStartYear(parseInt(e.target.value))}
                                    >
                                        {[2023, 2024, 2025, 2026].map(y => <option key={`start-year-${y}`} value={y}>{y}</option>)}
                                    </select>
                                    <span style={{ color: '#94a3b8', fontWeight: 500 }}>to</span>
                                    <select
                                        style={{ flex: 1, padding: '10px', fontSize: '0.85rem', background: 'white', border: '1px solid #cbd5e1', color: '#1e293b', borderRadius: '8px' }}
                                        value={bulkEndMonth} onChange={e => setBulkEndMonth(parseInt(e.target.value))}
                                    >
                                        {months.map((m, i) => <option key={`end-${m}-${i}`} value={i}>{m}</option>)}
                                    </select>
                                    <select
                                        style={{ width: '100px', padding: '10px', fontSize: '0.85rem', background: 'white', border: '1px solid #cbd5e1', color: '#1e293b', borderRadius: '8px' }}
                                        value={bulkEndYear} onChange={e => setBulkEndYear(parseInt(e.target.value))}
                                    >
                                        {[2023, 2024, 2025, 2026].map(y => <option key={`end-year-${y}`} value={y}>{y}</option>)}
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
                    <button className="primary-btn" onClick={onClose}>
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
};

export default KPISettingsModal;
