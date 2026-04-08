import React, { useState, useMemo, useEffect } from 'react';
import type { Scenario, DateRange, KPIData } from '../types';
import { apiService } from '../services/api';
import { BarChart3, Loader2, ArrowRightLeft, TrendingUp, TrendingDown, Minus, Table as TableIcon, BarChart as BarChartIcon, Edit3, X, Save } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ComparisonViewProps {
    scenarios: Record<string, Scenario>;
    dateRange: DateRange;
}

const ComparisonView: React.FC<ComparisonViewProps> = ({ scenarios, dateRange }) => {
    const scenarioKeys = Object.keys(scenarios);
    const [baseId, setBaseId] = useState<string>(scenarioKeys[0] || '');
    const [compId, setCompId] = useState<string>(scenarioKeys.length > 1 ? scenarioKeys[1] : scenarioKeys[0] || '');
    
    const [baseCalculated, setBaseCalculated] = useState<Record<string, number[]>>({});
    const [compCalculated, setCompCalculated] = useState<Record<string, number[]>>({});
    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');
    const [isNotesOpen, setIsNotesOpen] = useState(false);
    const [notes, setNotes] = useState('');

    const baseData = scenarios[baseId];
    const compData = scenarios[compId];

    useEffect(() => {
        let isMounted = true;
        const fetchResults = async () => {
            if (!baseData || !compData) return;
            setLoading(true);
            try {
                const [baseRes, compRes] = await Promise.all([
                    apiService.calculate(baseData.kpis, dateRange),
                    apiService.calculate(compData.kpis, dateRange)
                ]);
                if (isMounted) {
                    setBaseCalculated(baseRes.results);
                    setCompCalculated(compRes.results);
                }
            } catch (err) {
                console.error('Variance analysis error:', err);
            } finally {
                if (isMounted) setLoading(false);
            }
        };
        fetchResults();
        return () => { isMounted = false; };
    }, [baseData, compData, dateRange]);


    const kpiList = useMemo(() => {
        if (!baseData) return [];
        const kpis = baseData.kpis;
        const roots = Object.values(kpis).filter(k => !k.parentId || !kpis[k.parentId]);
        const ordered: { kpi: KPIData, depth: number }[] = [];
        const visited = new Set<string>();

        const traverse = (node: KPIData, depth: number) => {
            if (visited.has(node.id)) return;
            visited.add(node.id);
            ordered.push({ kpi: node, depth });
            // Always traverse all children for complete comparison
            node.children.forEach(childId => {
                if (kpis[childId]) traverse(kpis[childId], depth + 1);
            });
        };

        roots.forEach(root => traverse(root, 0));

        // Catch any orphans to ensure absolutely every KPI is compared
        Object.values(kpis).forEach(kpi => {
            if (!visited.has(kpi.id)) {
                traverse(kpi, 0);
            }
        });

        return ordered;
    }, [baseData]);

    const periodCount = (dateRange.endYear - dateRange.startYear) * 12 + (dateRange.endMonth - dateRange.startMonth) + 1;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#F9FAFB', padding: '24px', boxSizing: 'border-box' }}>
            
            {/* Header Area */}
            <div style={{ 
                backgroundColor: 'white', 
                borderRadius: '12px', 
                border: '1px solid #EAECF0', 
                boxShadow: '0 1px 3px rgba(16, 24, 40, 0.05)', 
                marginBottom: '20px', 
                display: 'flex', 
                flexDirection: 'column', 
                flexShrink: 0, 
                overflow: 'hidden' 
            }}>
                <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #EAECF0', backgroundColor: '#F8FAFC' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ padding: '8px', backgroundColor: '#EEF2FF', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <BarChart3 size={20} color="#4F46E5" />
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1E293B', lineHeight: '1.2' }}>Variance Analysis Dashboard</h2>
                            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748B', fontWeight: 500 }}>Compare KPIs between any two scenarios</p>
                        </div>
                    </div>
                    {/* View Toggle */}
                    <div style={{ display: 'flex', backgroundColor: '#F1F5F9', padding: '4px', borderRadius: '8px', gap: '4px' }}>
                        <button
                            onClick={() => setViewMode('table')}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                                ...(viewMode === 'table' ? { backgroundColor: 'white', color: '#4F46E5', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' } : { backgroundColor: 'transparent', color: '#64748B' })
                            }}
                        >
                            <TableIcon size={14} />
                            Table
                        </button>
                        <button
                            onClick={() => setViewMode('chart')}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                                ...(viewMode === 'chart' ? { backgroundColor: 'white', color: '#4F46E5', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' } : { backgroundColor: 'transparent', color: '#64748B' })
                            }}
                        >
                            <BarChartIcon size={14} />
                            Chart
                        </button>
                    </div>
                </div>
                
                <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '24px', backgroundColor: 'white' }}>
                    {/* Base Scenario Selector */}
                    <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Baseline Scenario</label>
                        <select
                            value={baseId}
                            onChange={(e) => setBaseId(e.target.value)}
                            style={{ width: '100%', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', color: '#1E293B', fontWeight: 500, outline: 'none', cursor: 'pointer' }}
                        >
                            {Object.values(scenarios).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: '18px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#F1F5F9', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8' }}>
                            <ArrowRightLeft size={14} />
                        </div>
                    </div>

                    {/* Comparison Scenario Selector */}
                    <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Comparison Target</label>
                        <select
                            value={compId}
                            onChange={(e) => setCompId(e.target.value)}
                            style={{ width: '100%', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', color: '#1E293B', fontWeight: 500, outline: 'none', cursor: 'pointer' }}
                        >
                            {Object.values(scenarios).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* Data Grid Area */}
            <div style={{ flex: 1, backgroundColor: 'white', borderRadius: '12px', border: '1px solid #EAECF0', boxShadow: '0 1px 3px rgba(16, 24, 40, 0.05)', overflow: 'auto', position: 'relative' }}>
                {loading && (
                    <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.7)', zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', backgroundColor: 'white', padding: '24px', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', border: '1px solid #F1F5F9' }}>
                            <Loader2 style={{ animation: 'spin 1s linear infinite', color: '#4F46E5' }} size={32} />
                            <span style={{ fontSize: '14px', fontWeight: 700, color: '#334155' }}>Crunching Numbers...</span>
                        </div>
                    </div>
                )}
                {viewMode === 'table' ? (
                <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', minWidth: '900px' }}>
                    <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                        <tr style={{ backgroundColor: '#F9FAFB' }}>
                            <th style={{ padding: '16px 24px', borderBottom: '2px solid #EAECF0', fontWeight: 600, color: '#475467', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', width: '350px' }}>Metric / KPI</th>
                            <th style={{ padding: '16px 24px', borderBottom: '2px solid #EAECF0', fontWeight: 600, color: '#475467', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', minWidth: '100px', whiteSpace: 'nowrap' }}>Unit</th>
                            <th style={{ padding: '16px 24px', borderBottom: '2px solid #EAECF0', fontWeight: 600, color: '#475467', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right', minWidth: '140px', whiteSpace: 'nowrap' }}>Base FY Total</th>
                            <th style={{ padding: '16px 24px', borderBottom: '2px solid #EAECF0', fontWeight: 600, color: '#475467', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right', minWidth: '140px', whiteSpace: 'nowrap' }}>Comp FY Total</th>
                            <th style={{ padding: '16px 24px', borderBottom: '2px solid #EAECF0', fontWeight: 600, color: '#475467', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right', minWidth: '140px', whiteSpace: 'nowrap' }}>Variance (Abs)</th>
                            <th style={{ padding: '16px 24px', borderBottom: '2px solid #EAECF0', fontWeight: 600, color: '#475467', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right', minWidth: '140px' }}>Variance (%)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {kpiList.map(({ kpi, depth }, index) => {
                            const baseVal = baseCalculated[kpi.id]?.[periodCount] ?? 0;
                            const compVal = compCalculated[kpi.id]?.[periodCount] ?? 0;
                            const varianceAbs = compVal - baseVal;
                            const variancePct = baseVal !== 0 ? (varianceAbs / Math.abs(baseVal)) * 100 : 0;

                            const isPositive = varianceAbs > 0;
                            const isNegative = varianceAbs < 0;

                            return (
                                <tr key={kpi.id} style={{ backgroundColor: index % 2 === 0 ? 'white' : '#F9FAFB', transition: 'background-color 0.2s', borderBottom: '1px solid #EAECF0' }}>
                                    <td style={{ padding: '12px 24px' }}>
                                        <div style={{ paddingLeft: `${depth * 24}px`, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            {depth > 0 && <div style={{ width: '8px', height: '1px', backgroundColor: '#CBD5E1' }}></div>}
                                            <span style={{ fontSize: '13px', color: depth === 0 ? '#1E293B' : '#475569', fontWeight: depth === 0 ? 700 : 500 }}>
                                                {kpi.label}
                                            </span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '12px 24px' }}>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '2px 8px', backgroundColor: '#F1F5F9', border: '1px solid #E2E8F0', color: '#475569', borderRadius: '4px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.02em' }}>
                                            {kpi.unit}
                                        </span>
                                    </td>
                                    <td style={{ padding: '12px 24px', fontSize: '13px', textAlign: 'right', fontWeight: 600, color: '#334155' }}>
                                        {baseVal.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                                    </td>
                                    <td style={{ padding: '12px 24px', fontSize: '13px', textAlign: 'right', fontWeight: 600, color: '#334155' }}>
                                        {compVal.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                                    </td>
                                    <td style={{ padding: '12px 24px', textAlign: 'right' }}>
                                        <span style={{ fontSize: '13px', fontWeight: 700, color: isPositive ? '#059669' : isNegative ? '#E11D48' : '#94A3B8' }}>
                                            {varianceAbs > 0 ? '+' : ''}{varianceAbs.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                                        </span>
                                    </td>
                                    <td style={{ padding: '12px 24px', textAlign: 'right' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                                            {isPositive ? (
                                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '9999px', backgroundColor: '#D1FAE5', color: '#047857', border: '1px solid #A7F3D0' }}>
                                                    <TrendingUp size={12} strokeWidth={2.5} />
                                                    <span style={{ fontSize: '12px', fontWeight: 700, lineHeight: 1 }}>+{variancePct.toLocaleString(undefined, { maximumFractionDigits: 1 })}%</span>
                                                </div>
                                            ) : isNegative ? (
                                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '9999px', backgroundColor: '#FFE4E6', color: '#BE123C', border: '1px solid #FECDD3' }}>
                                                    <TrendingDown size={12} strokeWidth={2.5} />
                                                    <span style={{ fontSize: '12px', fontWeight: 700, lineHeight: 1 }}>{variancePct.toLocaleString(undefined, { maximumFractionDigits: 1 })}%</span>
                                                </div>
                                            ) : (
                                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '9999px', backgroundColor: '#F1F5F9', color: '#64748B', border: '1px solid #E2E8F0' }}>
                                                    <Minus size={12} strokeWidth={2.5} />
                                                    <span style={{ fontSize: '12px', fontWeight: 700, lineHeight: 1 }}>0.0%</span>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                ) : (
                    <div style={{ padding: '24px', width: '100%', height: '100%', minHeight: '700px', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                        {/* Notes Toggle Button */}
                        <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 10 }}>
                            <button 
                                onClick={() => setIsNotesOpen(!isNotesOpen)}
                                style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'white', border: '1px solid #E2E8F0', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', color: '#4F46E5', fontWeight: 600, fontSize: '12px' }}
                            >
                                <Edit3 size={14} />
                                {isNotesOpen ? 'Close Notes' : 'Add Notes'}
                            </button>
                        </div>
                        
                        {/* Notes Panel Overlay */}
                        {isNotesOpen && (
                            <div style={{ position: 'absolute', top: '60px', right: '16px', width: '300px', backgroundColor: 'white', border: '1px solid #E2E8F0', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', padding: '16px', zIndex: 20, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#1E293B' }}>Chart Notes</h3>
                                    <button onClick={() => setIsNotesOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}><X size={16}/></button>
                                </div>
                                <textarea 
                                    value={notes} 
                                    onChange={(e) => setNotes(e.target.value)} 
                                    placeholder="Type your notes here..."
                                    style={{ width: '100%', boxSizing: 'border-box', minHeight: '120px', padding: '10px', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '13px', resize: 'vertical', outline: 'none', fontFamily: 'inherit' }}
                                />
                                <button 
                                    onClick={() => { setIsNotesOpen(false); }}
                                    style={{ backgroundColor: '#4F46E5', color: 'white', border: 'none', padding: '8px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                                >
                                    <Save size={14} /> Save Notes
                                </button>
                            </div>
                        )}

                        <div style={{ flex: 1, width: '100%', overflowX: 'auto', overflowY: 'hidden' }}>
                            <div style={{ minWidth: `${Math.max(1000, kpiList.length * 80)}px`, height: '100%' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={kpiList.map(({ kpi }) => ({
                                            name: kpi.label,
                                            [baseData?.name || 'Base']: baseCalculated[kpi.id]?.[periodCount] ?? 0,
                                            [compData?.name || 'Comp']: compCalculated[kpi.id]?.[periodCount] ?? 0,
                                        }))}
                                        margin={{ top: 40, right: 30, left: 40, bottom: 150 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                        <XAxis 
                                            dataKey="name" 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{ fill: '#64748B', fontSize: 11, fontWeight: 600 }}
                                            angle={-90}
                                            textAnchor="end"
                                            interval={0}
                                        />
                                        <YAxis 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{ fill: '#64748B', fontSize: 12, fontWeight: 500 }}
                                            tickFormatter={(val) => val.toLocaleString()}
                                        />
                                        <Tooltip 
                                            cursor={{ fill: '#F8FAFC' }}
                                            contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', fontWeight: 600 }}
                                            formatter={(value: any) => Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                                        />
                                        <Legend wrapperStyle={{ paddingTop: '20px', fontWeight: 600, fontSize: '13px' }}/>
                                        <Bar dataKey={baseData?.name || 'Base'} fill="#94A3B8" radius={[4, 4, 0, 0]} maxBarSize={60} />
                                        <Bar dataKey={compData?.name || 'Comp'} fill="#4F46E5" radius={[4, 4, 0, 0]} maxBarSize={60} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                )}
                {kpiList.length === 0 && !loading && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94A3B8', gap: '12px' }}>
                        <BarChart3 size={48} style={{ opacity: 0.2 }} />
                        <span style={{ fontSize: '14px', fontWeight: 500 }}>No KPIs to compare in selected scenarios.</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ComparisonView;
