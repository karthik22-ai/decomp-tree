// @ts-nocheck
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Filter, Search, Check, Info, TrendingUp } from 'lucide-react';

interface RawDataViewProps {
    sheets?: Record<string, any[][]>;
    rawImportData?: any[][];
    currentMappings?: Record<string, string>;
    onSaveMappings?: (mappings: Record<string, string>) => void;
    onPromoteSheet?: (table: any[][], mappings: Record<string, string>, monthsCount: number) => Promise<void>;
}

export const RawDataView: React.FC<RawDataViewProps> = ({ 
    sheets, 
    rawImportData, 
    currentMappings,
    onSaveMappings,
    onPromoteSheet 
}) => {
    const [activeSheet, setActiveSheet] = useState<string | null>(null);

    // Synchronize activeSheet with incoming sheets or rawImportData
    useEffect(() => {
        const sheetsAvailable = sheets || (rawImportData ? { "Default": rawImportData } : {});
        const names = Object.keys(sheetsAvailable);
        
        if (names.length > 0) {
            if (!activeSheet || !names.includes(activeSheet)) {
                setActiveSheet(names[0]);
            }
        } else {
            setActiveSheet(null);
        }
    }, [sheets, rawImportData]);
    
    const [activeFilters, setActiveFilters] = useState<Record<number, string[]>>({});
    const [openFilterIdx, setOpenFilterIdx] = useState<number | null>(null);
    const [filterSearch, setFilterSearch] = useState("");
    const [isPromoting, setIsPromoting] = useState(false);
    const [isMergeMode, setIsMergeMode] = useState(false);
    const [columnMappings, setColumnMappings] = useState<Record<number, string>>({});
    const [monthsCount, setMonthsCount] = useState<number | ''>('');

    // Memoize sheetsToDisplay to prevent unnecessary effect triggers
    const sheetsToDisplay = useMemo(() => sheets || (rawImportData ? { "Default": rawImportData } : {}), [sheets, rawImportData]);
    const sheetNames = useMemo(() => Object.keys(sheetsToDisplay), [sheetsToDisplay]);
    const currentData = activeSheet ? sheetsToDisplay[activeSheet] : [];

    const lastSheetRef = useRef<string | null>(null);

    useEffect(() => {
        // Only reset filters if the active sheet has actually changed
        if (lastSheetRef.current !== activeSheet) {
            setActiveFilters({});
            setOpenFilterIdx(null);
            lastSheetRef.current = activeSheet;
        }
        
        if (currentData && currentData.length > 0) {
            const nextMapping: Record<number, string> = { ...columnMappings };
            
            // Apply current mappings if passed from parent
            if (currentMappings) {
                 Object.entries(currentMappings).forEach(([idx, role]) => {
                     nextMapping[parseInt(idx)] = role;
                 });
            }

            // Heuristic detection if no mappings exist
            if (Object.keys(nextMapping).length === 0) {
                currentData[0].forEach((cell: any, i: number) => {
                    const header = String(cell || "").toUpperCase();
                    const levelMatch = header.match(/L(EVEL\s*)?(\d+)/);
                    if (levelMatch) {
                        const levelNum = parseInt(levelMatch[2], 10);
                        if (levelNum >= 1 && levelNum <= 15) {
                            nextMapping[i] = `L${levelNum}`;
                        }
                    } else if (header.includes("SCENARIO")) {
                        nextMapping[i] = "Scenario";
                    } else if (header.includes("TIME") || header.includes("DATE") || header.includes("MONTH")) {
                        nextMapping[i] = "Time";
                    } else if (header.includes("VALUE") || header.includes("AMOUNT") || header.includes("ACTUAL")) {
                        nextMapping[i] = "Value";
                    }
                });
            }
            // Only update if mappings actually changed to avoid re-render loops
            if (JSON.stringify(nextMapping) !== JSON.stringify(columnMappings)) {
                setColumnMappings(nextMapping);
            }
        }
    }, [activeSheet, currentData]); // Rely on stable currentData reference

    const syncedValuesPerColumn = useMemo(() => {
        if (!currentData || currentData.length <= 1) return [];
        const numCols = currentData[0].length;
        const result: string[][] = Array(numCols).fill([]);
        
        const dataRows = currentData.slice(1);

        for (let j = 0; j < numCols; j++) {
            const validRowsForColJ = dataRows.filter(row => {
                return Object.entries(activeFilters).every(([colIdx, selectedValues]) => {
                    const idx = parseInt(colIdx);
                    if (idx === j) return true; // ignore own filter for syncing
                    if (!selectedValues || selectedValues.length === 0) return true;
                    const val = row[idx];
                    const displayVal = val === null || val === undefined ? "(Blanks)" : String(val);
                    return selectedValues.includes(displayVal);
                });
            });

            const values = new Set<string>();
            for (let i = 0; i < validRowsForColJ.length; i++) {
                const val = validRowsForColJ[i][j];
                const displayVal = val === null || val === undefined ? "(Blanks)" : String(val);
                values.add(displayVal);
            }
            result[j] = Array.from(values).sort((a, b) => {
                if (a === "(Blanks)") return 1;
                if (b === "(Blanks)") return -1;
                return a.localeCompare(b, undefined, { numeric: true });
            });
        }
        return result;
    }, [currentData, activeFilters]);

    const filteredRows = useMemo(() => {
        if (!currentData || currentData.length <= 1) return [];
        const rows = currentData.slice(1);
        
        return rows.filter(row => {
            return Object.entries(activeFilters).every(([colIdx, selectedValues]) => {
                if (!selectedValues || selectedValues.length === 0) return true;
                const idx = parseInt(colIdx);
                const val = row[idx];
                const displayVal = val === null || val === undefined ? "(Blanks)" : String(val);
                return selectedValues.includes(displayVal);
            });
        });
    }, [currentData, activeFilters]);

    const handlePromote = async () => {
        if (!onPromoteSheet) return;
        setIsPromoting(true);
        try {
            const table = [currentData[0], ...filteredRows];
            const roleMappings: Record<string, string> = {};
            Object.entries(columnMappings).forEach(([idx, role]) => {
                roleMappings[idx] = role;
            });

            await onPromoteSheet(table, roleMappings, monthsCount === '' ? 0 : monthsCount);
        } catch (error: any) {
            console.error('Promotion failed:', error);
            alert(error.message || 'Promotion failed.');
        } finally {
            setIsPromoting(false);
        }
    };

    const toggleFilterValue = (colIdx: number, value: string) => {
        setActiveFilters(prev => {
            const current = prev[colIdx] || [];
            const next = current.includes(value) 
                ? current.filter(v => v !== value)
                : [...current, value];
            
            const nextFilters = { ...prev };
            if (next.length === 0) delete nextFilters[colIdx];
            else nextFilters[colIdx] = next;
            return nextFilters;
        });
    };

    if (sheetNames.length === 0) {
        return (
            <div className="view-container" style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                <h2 style={{ marginBottom: 20, fontSize: 24, color: '#1e293b' }}>Raw Data View</h2>
                <div style={{ background: 'white', padding: 40, borderRadius: 12, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
                    No data uploaded yet.
                </div>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, padding: '24px', background: '#F9FAFB', overflow: 'hidden' }}>
            <div className="raw-data-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexShrink: 0 }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: 24, color: '#101828', fontWeight: 700 }}>Data Explorer</h2>
                    <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#667085' }}>
                        Define column roles and promote results to your model.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#F8FAFC', padding: '6px 12px', borderRadius: 8, border: '1px solid #E2E8F0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Months:</label>
                            <input 
                                type="number" 
                                value={monthsCount} 
                                onChange={e => setMonthsCount(e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
                                placeholder="Auto"
                                style={{ width: 45, border: '1px solid #CBD5E1', borderRadius: 4, padding: '2px 4px', fontSize: 12 }}
                            />
                        </div>
                        <label style={{ fontSize: 12, fontWeight: 500, color: '#64748B', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', borderLeft: '1px solid #E2E8F0', paddingLeft: 12 }}>
                            <input 
                                type="checkbox" 
                                checked={isMergeMode} 
                                onChange={(e) => setIsMergeMode(e.target.checked)}
                                style={{ cursor: 'pointer' }}
                            />
                            Merge?
                        </label>
                    </div>
                    {Object.keys(activeFilters).length > 0 && (
                        <button
                            onClick={() => setActiveFilters({})}
                            style={{ 
                                padding: '6px 12px', 
                                background: 'white', 
                                color: '#EF4444', 
                                border: '1px solid #FECACA', 
                                borderRadius: 8, 
                                fontSize: 12, 
                                fontWeight: 600, 
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                            }}
                        >
                            Clear Filters
                        </button>
                    )}
                    {onPromoteSheet && (
                        <button 
                            disabled={isPromoting || filteredRows.length === 0}
                            onClick={handlePromote}
                            style={{ 
                                padding: '10px 18px', 
                                background: isPromoting ? '#94A3B8' : '#1D4ED8', 
                                color: 'white', 
                                border: 'none', 
                                borderRadius: 8, 
                                fontSize: 13, 
                                fontWeight: 600, 
                                cursor: isPromoting ? 'not-allowed' : 'pointer', 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: 8,
                                boxShadow: '0 1px 2px rgba(16, 24, 40, 0.05)'
                            }}
                        >
                            <TrendingUp size={16} className={isPromoting ? 'animate-spin' : ''} /> 
                            {isPromoting ? 'Promoting...' : 'Promote to KPI Tree'}
                        </button>
                    )}
                </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexShrink: 0 }}>
                <Info size={18} color="#026AA2" style={{ flexShrink: 0 }} />
                <div style={{ fontSize: 13, color: '#026AA2', lineHeight: '1.5' }}>
                    <strong>Map Columns:</strong> Use the dropdowns in the table header to tell us which columns represent your 
                    <strong>Hierarchy (L1-L4)</strong>, <strong>Time</strong>, and <strong>Values</strong>. 
                    Filter rows to only promote what you need.
                </div>
            </div>

            {/* Sheet Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid #EAECF0', marginBottom: 20, gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
                {sheetNames.map(name => (
                    <button
                        key={name}
                        onClick={() => setActiveSheet(name)}
                        style={{
                            padding: '8px 16px',
                            border: 'none',
                            background: activeSheet === name ? '#F9FAFB' : 'transparent',
                            borderBottom: activeSheet === name ? '2px solid #1D4ED8' : '2px solid transparent',
                            color: activeSheet === name ? '#1D4ED8' : '#667085',
                            fontWeight: activeSheet === name ? 600 : 500,
                            fontSize: 14,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            transition: 'all 0.2s'
                        }}
                    >
                        {name}
                    </button>
                ))}
            </div>

            <div style={{ flex: 1, minHeight: 0, overflow: 'auto', background: 'white', borderRadius: 8, border: '1px solid #EAECF0', boxShadow: '0 1px 3px rgba(16, 24, 40, 0.05)' }}>
                <table style={{ borderCollapse: 'collapse', textAlign: 'left', minWidth: 800 }}>
                    <thead style={{ background: '#F9FAFB', borderBottom: '2px solid #EAECF0', position: 'sticky', top: 0, zIndex: 10 }}>
                        <tr>
                            {currentData[0]?.map((cell: any, i: number) => {
                                const isMapped = !!columnMappings[i];
                                const isFiltered = !!activeFilters[i];
                                return (
                                    <th key={i} style={{ 
                                        padding: '12px 24px', 
                                        fontWeight: 600, 
                                        color: '#475467', 
                                        fontSize: 12, 
                                        borderRight: '1px solid #EAECF0',
                                        position: 'relative'
                                    }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                                                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: isMapped ? '#1D4ED8' : '#475467' }}>
                                                    {cell === null || cell === "" ? `Col ${i + 1}` : String(cell)}
                                                </span>
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setOpenFilterIdx(openFilterIdx === i ? null : i);
                                                        setFilterSearch("");
                                                    }}
                                                    style={{ 
                                                        background: isFiltered ? '#1D4ED8' : 'transparent', 
                                                        border: 'none', 
                                                        borderRadius: 4, 
                                                        padding: 4, 
                                                        color: isFiltered ? 'white' : '#98A2B3',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    <Filter size={14} />
                                                </button>
                                            </div>
                                            
                                            <select 
                                                value={columnMappings[i] || ""}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    const nextMapping = { ...columnMappings };
                                                    if (val) nextMapping[i] = val;
                                                    else delete nextMapping[i];
                                                    
                                                    setColumnMappings(nextMapping);
                                                    
                                                    // Sync to global state
                                                    const stringMappings: Record<string, string> = {};
                                                    Object.entries(nextMapping).forEach(([idx, r]) => {
                                                        stringMappings[idx] = r;
                                                    });
                                                    onSaveMappings?.(stringMappings);
                                                }}
                                                style={{ 
                                                    fontSize: '11px', 
                                                    padding: '4px', 
                                                    borderRadius: 4, 
                                                    border: isMapped ? '1px solid #1D4ED8' : '1px solid #D1D5DB',
                                                    background: isMapped ? '#EFF6FF' : 'white',
                                                    color: isMapped ? '#1D4ED8' : '#6B7280',
                                                    outline: 'none',
                                                    fontWeight: isMapped ? 700 : 400
                                                }}
                                            >
                                                <option value="">-- Role --</option>
                                                <optgroup label="Hierarchy">
                                                    {[...Array(15)].map((_, idx) => (
                                                        <option key={`L${idx + 1}`} value={`L${idx + 1}`}>
                                                            Level {idx + 1} {idx === 0 ? '(Top)' : ''}
                                                        </option>
                                                    ))}
                                                </optgroup>
                                                <optgroup label="Data">
                                                    <option value="Time">Time Column</option>
                                                    <option value="Scenario">Scenario Column</option>
                                                    <option value="Value">Value Column</option>
                                                </optgroup>
                                            </select>
                                        </div>

                                        {openFilterIdx === i && (
                                            <>
                                                <div onClick={() => setOpenFilterIdx(null)} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 998 }} />
                                                <div style={{ position: 'absolute', top: '100%', right: 0, minWidth: 240, background: 'white', border: '1px solid #EAECF0', borderRadius: 8, boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 999, padding: 12, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                        {activeFilters[i] && activeFilters[i].length > 0 && (
                                                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setActiveFilters(prev => {
                                                                            const next = {...prev};
                                                                            delete next[i];
                                                                            return next;
                                                                        });
                                                                    }}
                                                                    style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#EF4444', borderRadius: 6, padding: '4px 8px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                                                                    title="Clear column filter"
                                                                >
                                                                    Clear
                                                                </button>
                                                            </div>
                                                        )}
                                                        <div style={{ position: 'relative', width: '100%' }}>
                                                            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#98A2B3' }} />
                                                            <input 
                                                                autoFocus
                                                                placeholder="Search..."
                                                                value={filterSearch}
                                                                onChange={(e) => setFilterSearch(e.target.value)}
                                                                style={{ width: '100%', padding: '6px 10px 6px 30px', boxSizing: 'border-box', borderRadius: 6, border: '1px solid #D0D5DD', fontSize: 12, outline: 'none' }}
                                                            />
                                                        </div>
                                                    <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                        {syncedValuesPerColumn[i]
                                                            ?.filter((v: string) => v.toLowerCase().includes(filterSearch.toLowerCase()))
                                                            .map((val: string) => (
                                                                <div 
                                                                    key={val} 
                                                                    onClick={() => toggleFilterValue(i, val)}
                                                                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px', cursor: 'pointer', fontSize: 13, borderRadius: 4 }}
                                                                >
                                                                    <div style={{ width: 14, height: 14, flexShrink: 0, borderRadius: 3, border: activeFilters[i]?.includes(val) ? '1px solid #1D4ED8' : '1px solid #D0D5DD', background: activeFilters[i]?.includes(val) ? '#1D4ED8' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                        {activeFilters[i]?.includes(val) && <Check size={10} color="white" />}
                                                                    </div>
                                                                    <span style={{ color: activeFilters[i]?.includes(val) ? '#1D4ED8' : '#344054', wordBreak: 'break-all' }}>{val}</span>
                                                                </div>
                                                            ))}
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {filteredRows.map((row: any[], ridx: number) => (
                            <tr key={`${activeSheet}-${ridx}`} style={{ borderBottom: '1px solid #EAECF0', background: ridx % 2 === 0 ? 'transparent' : '#F9FAFB' }}>
                                {row.map((cell: any, cidx: number) => (
                                    <td key={cidx} style={{ padding: '12px 24px', color: '#344054', fontSize: 13, borderRight: '1px solid #EAECF0' }}>
                                        {cell === null || cell === undefined ? "-" : String(cell)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            
            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#F9FAFB', border: '1px solid #EAECF0', borderRadius: 8 }}>
                <div style={{ fontSize: 12, color: '#667085' }}>
                    Showing <strong>{filteredRows.length}</strong> rows.
                </div>
                <div style={{ fontSize: 11, color: '#98A2B3', fontWeight: 700, letterSpacing: '0.05em' }}>
                    READY FOR PROMOTION
                </div>
            </div>
        </div>
    );
};

