// @ts-nocheck
import React, { useMemo, useState, useRef, useCallback } from 'react';
import { type KPIData, type Scenario, type DateRange } from '../types';
import { Save, Layers, Database, Calculator, Download, Upload, Lock, Unlock, Plus, Minus, Search, Sliders, Trash2, MessageSquare, X, Edit2, Check } from 'lucide-react';
import { getMonthsInRange } from '../utils/dateRange';
import { apiService } from '../services/api';
import * as XLSX from 'xlsx';


interface SpreadsheetViewProps {
    kpis: Record<string, KPIData>;
    calculatedValues: Record<string, number[]>;
    onMonthlyOverrideChange: (id: string, monthKey: string, value: string | number | undefined, targetScenarioId?: string) => void;
    onOverallOverrideChange: (id: string, year: string, value: number | undefined, targetScenarioId?: string) => void;
    scenarios: Record<string, Scenario>;
    activeScenarioId: string;
    onScenarioAdd: (name: string) => void;
    onScenarioDelete?: (id: string, e?: React.MouseEvent) => void;
    baselineScenarioId?: string;
    baseValues?: Record<string, number[]>;
    calculatedScenarioValues?: Record<string, Record<string, number[]>>;
    selectedScenarioIds: string[];
    onSelectedScenariosChange: (ids: string[]) => void;
    onScenarioSelect?: (id: string) => void;
    onBaselineScenarioSelect?: (id: string) => void;
    onToggleExpand?: (id: string) => void;
    onExpandAll?: (level?: number) => void;
    onCollapseAll?: () => void;
    onCustomDataImport?: (kpis: Record<string, KPIData>) => void;
    onRowLockToggle?: (id: string) => void;
    onCellLockToggle?: (id: string, monthIdx: number) => void;
    onColumnLockChange?: (idx: number) => void;
    dateRange: DateRange;
    onDateRangeChange?: (range: DateRange) => void;
    onAddRoot?: (initialData?: { label?: string; unit?: string; monthlyOverrides?: Record<string, number | string> }) => void;
    onAddChild?: (parentId: string) => void;
    onResetKPI?: (id: string) => void;
    onLabelChange?: (id: string, label: string) => void;
    onUnitChange?: (id: string, unit: string) => void;
    onPullData?: () => void;
    onMakeBaseScenario?: () => void;
    onCommentChange?: (id: string, comment: string) => void;
    onRenameScenario?: (id: string, name: string) => void;
    onCellCommentChange?: (id: string, monthIdx: number, comment: string) => void;
    onSaveAllEdits?: () => void;
}

// Format a number for display safely
const fmt = (v: any) => {
    if (typeof v === 'object' && v !== null) return '0';
    const n = typeof v === 'number' ? v : parseFloat(String(v));
    return isNaN(n) ? '0' : n.toLocaleString(undefined, { maximumFractionDigits: 1 });
};

const SpreadsheetView: React.FC<SpreadsheetViewProps> = ({
    kpis,
    calculatedValues = {},
    onMonthlyOverrideChange,
    onOverallOverrideChange,
    scenarios,
    activeScenarioId,
    onScenarioAdd,
    onScenarioDelete,
    baselineScenarioId,
    baseValues = {},
    calculatedScenarioValues = {},
    selectedScenarioIds,
    onSelectedScenariosChange,
    onScenarioSelect,
    onToggleExpand,
    onCustomDataImport,
    onRowLockToggle,
    onCellLockToggle: _onCellLockToggle,
    onColumnLockChange: _onColumnLockChange,
    dateRange,
    onDateRangeChange,
    onAddRoot,
    onLabelChange,
    onUnitChange,
    onPullData,
    onMakeBaseScenario,
    onCommentChange,
    onRenameScenario,
    onCellCommentChange,
    onSaveAllEdits,
}) => {
    const monthObjects = useMemo(() => getMonthsInRange(dateRange.startMonth, dateRange.startYear, dateRange.endMonth, dateRange.endYear), [dateRange]);
    const months = useMemo(() => monthObjects.map(m => m.label), [monthObjects]);
    const [newScenarioName, setNewScenarioName] = useState('');
    const [showAddScenario, setShowAddScenario] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [isScenarioOpen, setIsScenarioOpen] = useState(false);
    const [scenarioFilterSearch, setScenarioFilterSearch] = useState('');

    // --- Editing state: track which cell is actively being edited ---
    const [editingCell, setEditingCell] = useState<{ kpiId: string; monthIdx: number | 'total' | 'label' | 'unit' | 'header' } | null>(null);
    const [editText, setEditText] = useState('');
    const [commentingKpiId, setCommentingKpiId] = useState<string | null>(null);
    const [commentingMonthIdx, setCommentingMonthIdx] = useState<number | null>(null);
    const [commentText, setCommentText] = useState('');

    const [renamingScenarioId, setRenamingScenarioId] = useState<string | null>(null);
    const [renameScenarioText, setRenameScenarioText] = useState('');

    // --- State for "Draft" values in empty spreadsheet rows ---
    const [emptyRowDrafts, setEmptyRowDrafts] = useState<Record<number, { label?: string; unit?: string; values: Record<number, string> }>>({});

    // --- Suggestion state for formulas ---
    const [suggestions, setSuggestions] = useState<KPIData[]>([]);
    const [suggestionIndex, setSuggestionIndex] = useState(0);
    const [suggestionPos, setSuggestionPos] = useState<{ top: number; left: number } | null>(null);

    // Filter suggestions based on current input text
    const updateSuggestions = useCallback((text: string, inputElement: HTMLInputElement) => {
        if (!text.startsWith('=')) {
            setSuggestions([]);
            return;
        }

        // Find the word being typed (part after the last operator or space)
        const parts = text.split(/[\+\-\*\/\(\)\s]/);
        const lastPart = parts[parts.length - 1].toLowerCase();

        if (lastPart.length === 0) {
            // Show all nodes if just started
            setSuggestions(Object.values(kpis).slice(0, 10));
        } else {
            const filtered = Object.values(kpis).filter(k =>
                (k.label.toLowerCase().includes(lastPart) ||
                    k.label.replace(/\s+/g, '').toLowerCase().includes(lastPart)) &&
                k.label.toLowerCase() !== lastPart
            ).slice(0, 8);
            setSuggestions(filtered);
        }
        setSuggestionIndex(0);

        const rect = inputElement.getBoundingClientRect();
        setSuggestionPos({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX });
    }, [kpis]);


    // --- Drag-to-fill state (2D: both row and column) ---
    const [isDragging, setIsDragging] = useState(false);
    const [dragSource, setDragSource] = useState<{ kpiId: string; monthIdx: number } | null>(null);
    const [dragTarget, setDragTarget] = useState<{ kpiId: string; monthIdx: number } | null>(null);

    // --- Header drag for date extension ---
    const [isHeaderDragging, setIsHeaderDragging] = useState(false);
    const headerDragRef = useRef<{
        startX: number;
        originalMonth: number;
        originalYear: number;
        direction: 'start' | 'end';
    } | null>(null);

    const handleHeaderDragStart = (e: React.MouseEvent, direction: 'start' | 'end') => {
        e.preventDefault();
        e.stopPropagation();
        setIsHeaderDragging(true);
        headerDragRef.current = {
            startX: e.clientX,
            originalMonth: direction === 'start' ? dateRange.startMonth : dateRange.endMonth,
            originalYear: direction === 'start' ? dateRange.startYear : dateRange.endYear,
            direction
        };
    };

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (isHeaderDragging && headerDragRef.current && onDateRangeChange) {
            const deltaX = e.clientX - headerDragRef.current.startX;
            const monthsDelta = Math.floor(deltaX / 80); // 80px is month-column width

            if (monthsDelta !== 0) {
                const { originalMonth, originalYear, direction } = headerDragRef.current;

                if (direction === 'end' && monthsDelta > 0) {
                    let m = originalMonth + monthsDelta;
                    let y = originalYear;

                    while (m > 11) { m -= 12; y++; }
                    while (m < 0) { m += 12; y--; }

                    if (y > dateRange.endYear || (y === dateRange.endYear && m > dateRange.endMonth)) {
                        onDateRangeChange({ ...dateRange, endMonth: m, endYear: y });
                    }
                } else if (direction === 'start' && monthsDelta < 0) {
                    let m = originalMonth + monthsDelta;
                    let y = originalYear;

                    while (m < 0) { m += 12; y--; }
                    while (m > 11) { m -= 12; y++; }

                    if (y < dateRange.startYear || (y === dateRange.startYear && m < dateRange.startMonth)) {
                        onDateRangeChange({ ...dateRange, startMonth: m, startYear: y });
                    }
                }
            }
        }
    }, [isHeaderDragging, dateRange, onDateRangeChange]);


    const kpiList = useMemo(() => {
        const kpiMap = Object.fromEntries(Object.values(kpis).map(k => [k.id, k]));
        const roots = Object.values(kpis).filter(k => !k.parentId || !kpiMap[k.parentId]);
        const ordered: { kpi: KPIData; depth: number; isVirtualScenario?: boolean; parentKpiId?: string; isLogicalLeaf?: boolean; hasScenariosToInject?: boolean }[] = [];

        const visited = new Set<string>();
        const traverse = (node: KPIData, depth: number) => {
            if (visited.has(node.id)) return;
            visited.add(node.id);

            if (node.isScenarioNode) {
                return; // Hide hardcoded scenario nodes (we use virtual nodes dynamically)
            }

            const hasVisibleChildren = node.children && node.children.some(childId => {
                const child = kpiMap[childId];
                return child && !child.isScenarioNode;
            });
            const isLogicalLeaf = !hasVisibleChildren;
            const hasScenariosToInject = selectedScenarioIds.length > 1;

            ordered.push({ kpi: node, depth, isLogicalLeaf, hasScenariosToInject });

            if (node.isExpanded) {
                if (hasScenariosToInject) {
                    // Inject virtual scenario child nodes for all KPIs
                    selectedScenarioIds.forEach(scenId => {
                        const scenObj = scenarios[scenId];
                        if (scenObj && scenObj.name !== 'Base Scenario') {
                            const virtualNode = {
                                ...node,
                                id: `${node.id}-virt-${scenId}`,
                                parentId: node.id,
                                label: scenObj.name,
                                children: [],
                                isScenarioNode: true,
                                virtualScenarioId: scenId,
                                isExpanded: false
                            };
                            ordered.push({ kpi: virtualNode as any, depth: depth + 1, isVirtualScenario: true, parentKpiId: node.id });
                        }
                    });
                }
                if (!isLogicalLeaf) {
                    node.children.forEach(childId => {
                        if (kpiMap[childId]) traverse(kpiMap[childId], depth + 1);
                    });
                }
            }
        };

        roots.forEach(root => traverse(root, 0));
        return ordered;
    }, [kpis, selectedScenarioIds, scenarios]);

    // Build a flat list of visible kpi IDs for row index lookup
    const visibleKpiIds = useMemo(() => kpiList.map(item => item.kpi.id), [kpiList]);

    // --- Cell display value helper ---
    const getCellDisplayValue = (kpi: KPIData, monthIdx: number, isLogicalLeaf?: boolean): string => {
        const realKpiId = kpi.isScenarioNode && (kpi as any).parentId ? (kpi as any).parentId : kpi.id;

        const scenId = (kpi as any).virtualScenarioId;

        if (scenId) {
            if (scenId === activeScenarioId) return fmt(calculatedValues[realKpiId]?.[monthIdx] ?? 0);
            if (scenId === baselineScenarioId) return fmt(baseValues[realKpiId]?.[monthIdx] ?? 0);

            // If we have calculated values for this specific selected scenario, use it
            if (calculatedScenarioValues[scenId]) {
                return fmt(calculatedScenarioValues[scenId][realKpiId]?.[monthIdx] ?? 0);
            }

            return '0';
        }

        if (isLogicalLeaf) {
            const mObj = monthObjects[monthIdx];
            const monthKey = mObj ? `${mObj.year}-${mObj.month}` : '';
            const override = kpi?.monthlyOverrides?.[monthKey];
            if (override != null) {
                return typeof override === 'number' ? fmt(override) : String(override);
            }
        }

        // Parent node logic
        // Removed cross-scenario summing to keep spreadsheet synced with Tree View.
        // Parent row now always shows the active scenario values.

        return fmt(calculatedValues[realKpiId]?.[monthIdx] ?? 0);
    };

    const getOverallDisplayValue = (kpi: KPIData): string => {
        const realKpiId = kpi.isScenarioNode && (kpi as any).parentId ? (kpi as any).parentId : kpi.id;
        const scenId = (kpi as any).virtualScenarioId;

        // Removed cross-scenario summing to keep spreadsheet synced with Tree View.
        // Overall column now always shows the active scenario total for the visible range.

        // Single scenario or virtual scenario node
        if (scenId) {
            if (scenId === activeScenarioId) return fmt(calculatedValues[realKpiId]?.[months.length] ?? 0);
            if (scenId === baselineScenarioId) return fmt(baseValues[realKpiId]?.[months.length] ?? 0);

            if (calculatedScenarioValues[scenId]) {
                return fmt(calculatedScenarioValues[scenId][realKpiId]?.[months.length] ?? 0);
            }
            return '0';
        }

        // Default behavior: return the calculated total for the visible range
        return fmt(calculatedValues[realKpiId]?.[months.length] ?? 0);
    };

    // Helper to check if a KPI is a logical leaf directly from the KPI object
    const isLogicalLeafDirect = (kpi: KPIData) => {
        const hasVisibleChildren = kpi.children && kpi.children.some(childId => {
            const child = kpis[childId];
            return child && !child.isScenarioNode;
        });
        return !hasVisibleChildren;
    };

    // --- Cell edit handlers ---
    const handleCellFocus = (kpiId: string, monthIdx: number | 'total' | 'label' | 'unit' | 'header') => {
        let initialText = '';

        const activeKpiInfo = kpiList.find(k => k.kpi.id === kpiId);
        const kpi = activeKpiInfo?.kpi;
        if (!kpi) return;

        if (monthIdx === 'total') {
            // Always start editing with the calculated range sum
            initialText = getOverallDisplayValue(kpi).replace(/,/g, '');
        } else if (monthIdx === 'label') {
            initialText = kpi.label || '';
        } else if (monthIdx === 'unit') {
            initialText = kpi.unit || '';
        } else if (monthIdx === 'header') {
            initialText = kpiId;
        } else {
            const mObj = monthObjects[monthIdx as number];
            const monthKey = mObj ? `${mObj.year}-${mObj.month}` : '';
            const override = kpi.isScenarioNode
                ? scenarios[(kpi as any).virtualScenarioId]?.kpis?.[(kpi as any).parentId]?.monthlyOverrides?.[monthKey]
                : (scenarios[activeScenarioId]?.kpis?.[kpi.id]?.monthlyOverrides?.[monthKey] ?? kpi.monthlyOverrides?.[monthKey]);
            if (override != null) {
                initialText = String(override);
            } else {
                initialText = getCellDisplayValue(kpi, monthIdx as number, activeKpiInfo.isLogicalLeaf).replace(/,/g, '');
            }
        }
        setEditText(initialText);
        setEditingCell({ kpiId, monthIdx: monthIdx as any });
        setSuggestions([]); // Reset suggestions on focus
    };

    const handleCellBlur = (kpiId: string, monthIdx: number | 'total' | 'label' | 'unit' | 'header') => {
        setEditingCell(null);
        const value = editText.trim();

        const activeKpiInfo = kpiList.find(k => k.kpi.id === kpiId);
        const isVirtual = activeKpiInfo?.kpi.isScenarioNode;
        const realKpiId = isVirtual ? (activeKpiInfo?.kpi as any).parentId : kpiId;
        const targetScenarioId = isVirtual ? (activeKpiInfo?.kpi as any).virtualScenarioId : undefined;

        if (monthIdx === 'label') {
            if (value && onLabelChange && !isVirtual) onLabelChange(realKpiId, value);
            return;
        }
        if (monthIdx === 'unit') {
            if (onUnitChange && !isVirtual) onUnitChange(realKpiId, value);
            return;
        }
        if (monthIdx === 'header') {
            months[realKpiId as any] = value;
            return;
        }

        if (monthIdx === 'total') {
            // we'll assume total is for the "current" view or we could specify year.
            // For now, let's just use the end year of the range as a heuristic or make it more explicit.
            const yearKey = String(dateRange.endYear); 
            if (!value) {
                onOverallOverrideChange(realKpiId, yearKey, undefined, targetScenarioId);
            } else {
                const num = parseFloat(value.replace(/,/g, '').replace(/"/g, ''));
                if (!isNaN(num)) onOverallOverrideChange(realKpiId, yearKey, num, targetScenarioId);
            }
        } else {
            const mObj = monthObjects[monthIdx as number];
            const monthKey = mObj ? `${mObj.year}-${mObj.month}` : '';
            if (!value) {
                onMonthlyOverrideChange(realKpiId, monthKey, undefined, targetScenarioId);
            } else if (value.startsWith('=')) {
                onMonthlyOverrideChange(realKpiId, monthKey, value, targetScenarioId);
            } else {
                const num = parseFloat(value.replace(/,/g, '').replace(/"/g, ''));
                if (!isNaN(num)) onMonthlyOverrideChange(realKpiId, monthKey, num, targetScenarioId);
            }
        }
    };

    // --- Empty row edit handlers ---
    const handleEmptyCellFocus = (rowIndex: number, type: 'label' | 'unit' | number) => {
        const draft = emptyRowDrafts[rowIndex];
        if (type === 'label') setEditText(draft?.label || '');
        else if (type === 'unit') setEditText(draft?.unit || '');
        else setEditText(draft?.values[type] || '');

        setEditingCell({ kpiId: `empty-${rowIndex}`, monthIdx: type as any });
    };

    const handleEmptyCellBlur = (rowIndex: number, type: 'label' | 'unit' | number) => {
        const value = editText.trim();
        setEditingCell(null);

        if (!value && !emptyRowDrafts[rowIndex]) return;

        // Update local draft
        const newDrafts = { ...emptyRowDrafts };
        if (!newDrafts[rowIndex]) newDrafts[rowIndex] = { values: {} };

        if (type === 'label') newDrafts[rowIndex].label = value;
        else if (type === 'unit') newDrafts[rowIndex].unit = value;
        else newDrafts[rowIndex].values[type] = value;

        setEmptyRowDrafts(newDrafts);

        // If something was entered, we can trigger the creation of a real KPI
        if (value && onAddRoot) {
            const currentDraft = newDrafts[rowIndex];
            const monthlyOverrides: Record<string, number | string> = {};
            
            monthObjects.forEach((mObj, idx) => {
                const val = currentDraft.values[idx];
                if (val) {
                    const monthKey = `${mObj.year}-${mObj.month}`;
                    if (val.startsWith('=')) {
                        monthlyOverrides[monthKey] = val;
                    } else {
                        const num = parseFloat(val.replace(/,/g, ''));
                        if (!isNaN(num)) monthlyOverrides[monthKey] = num;
                    }
                }
            });

            onAddRoot({
                label: currentDraft.label || 'New KPI',
                unit: currentDraft.unit || 'Units',
                monthlyOverrides
            });

            // Clear draft for this row
            const { [rowIndex]: _, ...remainingDrafts } = newDrafts;
            setEmptyRowDrafts(remainingDrafts);
        }
    };

    const handleApplySuggestion = (suggestion: KPIData) => {
        const parts = editText.split(/([\+\-\*\/\(\)\s])/);
        // Replace the last part with the suggestion label (without spaces)
        parts[parts.length - 1] = suggestion.label.replace(/\s+/g, '');
        const newText = parts.join('');
        setEditText(newText);
        setSuggestions([]);
    };

    const handleCellKeyDown = (e: React.KeyboardEvent, _kpiId: string, _monthIdx: number | 'total' | 'label' | 'unit' | 'header') => {
        if (suggestions.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSuggestionIndex(prev => (prev + 1) % suggestions.length);
                return;
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSuggestionIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
                return;
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                handleApplySuggestion(suggestions[suggestionIndex]);
                return;
            } else if (e.key === 'Escape') {
                setSuggestions([]);
                return;
            }
        }

        if (e.key === 'Enter') {
            (e.target as HTMLInputElement).blur();
        } else if (e.key === 'Escape') {
            setEditingCell(null);
        }
    };

    const handleAddScenario = () => {
        if (newScenarioName.trim()) {
            onScenarioAdd(newScenarioName.trim());
            setNewScenarioName('');
            setShowAddScenario(false);
        }
    };

    const handleExportData = () => {
        const headerRow = ['KPI Name', 'Unit', ...months, 'Overall'];
        const aoa: any[][] = [headerRow];

        kpiList.forEach(({ kpi, depth }) => {
            const indent = ' '.repeat(depth * 2);
            const monthlyValues = monthObjects.map((mObj, idx) => {
                const monthKey = `${mObj.year}-${mObj.month}`;
                const override = kpi.monthlyOverrides?.[monthKey];
                if (override !== undefined) return override;
                return calculatedValues[kpi.id]?.[idx] ?? 0;
            });
            // Handle overallOverride specifically or fallback to calculated total
            const endYearKey = String(dateRange.endYear);
            const fullYearValue = kpi.overallOverride?.[endYearKey] !== undefined
                ? kpi.overallOverride[endYearKey]
                : (calculatedValues[kpi.id]?.[monthObjects.length] ?? 0);

            aoa.push([
                `${indent}${kpi.label}`,
                kpi.unit,
                ...monthlyValues,
                fullYearValue
            ]);
        });

        const ws = XLSX.utils.aoa_to_sheet(aoa);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Spreadsheet");
        XLSX.writeFile(wb, `${scenarios[activeScenarioId]?.name || 'Scenario'}_export.xlsx`);
    };

    const handleImportCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const response = await apiService.importFile(file, months.length);
            if (onCustomDataImport && response.kpis && Object.keys(response.kpis).length > 0) {
                onCustomDataImport(response.kpis);
            }
        } catch (err) {

            console.error('Failed to parse file', err);
            alert('Failed to parse file.');
        }

        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // --- 2D Drag-to-Fill Logic ---
    const handleFillHandleMouseDown = useCallback((kpiId: string, monthIdx: number, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
        setDragSource({ kpiId, monthIdx });
        setDragTarget({ kpiId, monthIdx });
    }, []);

    const handleCellMouseEnter = useCallback((kpiId: string, monthIdx: number) => {
        if (isDragging && dragSource) {
            setDragTarget({ kpiId, monthIdx });
        }
    }, [isDragging, dragSource]);

    const handleMouseUp = useCallback(() => {
        if (isDragging && dragSource && dragTarget) {
            const { kpiId: srcKpiId, monthIdx: srcMonthIdx } = dragSource;
            const { kpiId: tgtKpiId, monthIdx: tgtMonthIdx } = dragTarget;

            // Get source value
            const srcKpi = kpis[srcKpiId];
            const mObjSource = monthObjects[srcMonthIdx];
            const srcMonthKey = mObjSource ? `${mObjSource.year}-${mObjSource.month}` : '';
            const srcOverride = srcKpi?.monthlyOverrides?.[srcMonthKey];
            const sourceValue = srcOverride !== undefined ? srcOverride : (calculatedValues[srcKpiId]?.[srcMonthIdx] ?? 0);

            // Get row range
            const srcRowIdx = visibleKpiIds.indexOf(srcKpiId);
            const tgtRowIdx = visibleKpiIds.indexOf(tgtKpiId);
            const rowStart = Math.min(srcRowIdx, tgtRowIdx);
            const rowEnd = Math.max(srcRowIdx, tgtRowIdx);

            // Get column range
            const colStart = Math.min(srcMonthIdx, tgtMonthIdx);
            const colEnd = Math.max(srcMonthIdx, tgtMonthIdx);

            // Fill all cells in the rectangular selection
            for (let r = rowStart; r <= rowEnd; r++) {
                const targetKpiId = visibleKpiIds[r];
                const targetListItem = kpiList[r];
                if (!targetKpiId || !targetListItem) continue;
                const isTargetRowParent = !targetListItem.isVirtualScenario && (!targetListItem.isLogicalLeaf || targetListItem.hasScenariosToInject);
                if (isTargetRowParent) continue;

                const targetKpi = kpis[targetKpiId];
                if (targetKpi?.isLocked) continue;

                // Detect horizontal trend if performing a multi-column fill on a single row
                const isHorizontalTrend = rowStart === rowEnd && colStart < colEnd;
                let step = 0;

                // Only calculate trend if sourceValue is a number (not a formula)
                const isSourceNumber = typeof sourceValue === 'number';

                if (isHorizontalTrend && srcMonthIdx > 0 && isSourceNumber) {
                    const prevVal = kpis[srcKpiId]?.monthlyOverrides?.[srcMonthIdx - 1] ?? calculatedValues[srcKpiId]?.[srcMonthIdx - 1] ?? 0;
                    if (typeof prevVal === 'number') {
                        step = sourceValue - prevVal;
                    }
                }

                for (let c = colStart; c <= colEnd; c++) {
                    const isVirtual = targetListItem.kpi.isScenarioNode;
                    const realKpiId = isVirtual ? (targetListItem.kpi as any).parentId : targetKpiId;
                    const targetScenarioId = isVirtual ? (targetListItem.kpi as any).virtualScenarioId : undefined;

                    let valueToApply: string | number = sourceValue;
                    if (isHorizontalTrend && isSourceNumber && Math.abs(step) > 1e-9) {
                        const distance = c - srcMonthIdx;
                        valueToApply = (sourceValue as number) + (distance * step);
                    }

                    const mObj = monthObjects[c];
                    const monthKey = mObj ? `${mObj.year}-${mObj.month}` : '';
                    onMonthlyOverrideChange(realKpiId, monthKey, valueToApply, targetScenarioId);
                }
            }
        }
        setIsDragging(false);
        setDragSource(null);
        setDragTarget(null);
        setIsHeaderDragging(false);
    }, [isDragging, dragSource, dragTarget, kpis, calculatedValues, onMonthlyOverrideChange, visibleKpiIds, kpiList]);

    React.useEffect(() => {
        if (isDragging || isHeaderDragging) {
            window.addEventListener('mousemove', handleMouseMove as any);
            window.addEventListener('mouseup', handleMouseUp);
            return () => {
                window.removeEventListener('mousemove', handleMouseMove as any);
                window.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDragging, isHeaderDragging, handleMouseMove, handleMouseUp]);

    // --- Add Period Logic ---
    const handleAddPeriod = useCallback(() => {
        if (!onDateRangeChange) return;
        let newEndMonth = dateRange.endMonth + 1;
        let newEndYear = dateRange.endYear;
        if (newEndMonth > 11) {
            newEndMonth = 0;
            newEndYear++;
        }
        onDateRangeChange({
            ...dateRange,
            endMonth: newEndMonth,
            endYear: newEndYear
        });
    }, [dateRange, onDateRangeChange]);

    // Determine if a cell is in the 2D drag-fill rectangle
    const isDragSelected = (kpiId: string, monthIdx: number) => {
        if (!isDragging || !dragSource || !dragTarget) return false;

        const srcRowIdx = visibleKpiIds.indexOf(dragSource.kpiId);
        const tgtRowIdx = visibleKpiIds.indexOf(dragTarget.kpiId);
        const cellRowIdx = visibleKpiIds.indexOf(kpiId);

        const rowStart = Math.min(srcRowIdx, tgtRowIdx);
        const rowEnd = Math.max(srcRowIdx, tgtRowIdx);
        const colStart = Math.min(dragSource.monthIdx, dragTarget.monthIdx);
        const colEnd = Math.max(dragSource.monthIdx, dragTarget.monthIdx);

        return cellRowIdx >= rowStart && cellRowIdx <= rowEnd && monthIdx >= colStart && monthIdx <= colEnd;
    };

    return (
        <div className="spreadsheet-container" onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
            <div className="spreadsheet-toolbar">
                <div className="toolbar-left">
                    <Database size={18} className="toolbar-icon" />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <h2 style={{ margin: 0 }}>Value Driver Grid</h2>
                        {selectedScenarioIds.length === 1 && scenarios[selectedScenarioIds[0]] && (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                background: '#eff6ff',
                                color: '#1d4ed8',
                                padding: '4px 12px',
                                borderRadius: '999px',
                                fontSize: '0.85rem',
                                fontWeight: 700,
                                border: '1px solid #bfdbfe'
                            }}>
                                <Layers size={14} />
                                {scenarios[selectedScenarioIds[0]].name}
                            </div>
                        )}
                    </div>
                </div>

                <div className="toolbar-right">
                    <div className="scenario-selector" style={{ alignItems: 'flex-start' }}>
                        <Layers size={16} style={{ marginTop: '4px' }} />
                        <span className="label" style={{ marginTop: '4px' }}>Scenarios:</span>
                        <div style={{ position: 'relative' }}>
                            <div
                                onClick={() => setIsScenarioOpen(!isScenarioOpen)}
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    border: '1px solid #D0D5DD', borderRadius: '6px', padding: '6px 12px',
                                    backgroundColor: 'white', minWidth: '180px', cursor: 'pointer',
                                    fontSize: '13px', color: '#344054'
                                }}
                            >
                                <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '140px' }}>
                                    {selectedScenarioIds.length === 1
                                        ? (scenarios[selectedScenarioIds[0]]?.name || '1 Selected')
                                        : `${selectedScenarioIds.length} Selected`}
                                </span>
                                <Sliders size={14} style={{ marginLeft: 8, color: '#98A2B3' }} />
                            </div>

                            {isScenarioOpen && (
                                <>
                                    <div onClick={() => setIsScenarioOpen(false)} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 998 }} />
                                    <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '4px', width: 220, background: 'white', border: '1px solid #EAECF0', borderRadius: 8, boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 999, padding: 12 }}>
                                        <div style={{ position: 'relative', marginBottom: 12 }}>
                                            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#98A2B3' }} />
                                            <input
                                                autoFocus
                                                placeholder="Search scenarios..."
                                                value={scenarioFilterSearch}
                                                onChange={(e) => setScenarioFilterSearch(e.target.value)}
                                                style={{ width: '100%', padding: '6px 10px 6px 30px', borderRadius: 6, border: '1px solid #D0D5DD', fontSize: 12, outline: 'none' }}
                                            />
                                        </div>
                                        <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                                            {Object.values(scenarios)
                                                .filter(s => s.name.toLowerCase().includes(scenarioFilterSearch.toLowerCase()))
                                                .map(s => {
                                                    const isSelected = selectedScenarioIds.includes(s.id);
                                                    const isRenaming = renamingScenarioId === s.id;
                                                    return (
                                                        <div
                                                            key={s.id}
                                                            onClick={() => {
                                                                if (isRenaming) return;
                                                                if (isSelected) {
                                                                    const next = selectedScenarioIds.filter(id => id !== s.id);
                                                                    if (next.length > 0) {
                                                                        onSelectedScenariosChange(next);
                                                                        if (onScenarioSelect) onScenarioSelect(next[next.length - 1]);
                                                                    }
                                                                } else {
                                                                    const next = [...selectedScenarioIds, s.id];
                                                                    onSelectedScenariosChange(next);
                                                                    if (onScenarioSelect) {
                                                                        onScenarioSelect(s.id);
                                                                    }
                                                                }
                                                            }}
                                                            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px', cursor: 'pointer', fontSize: 13 }}
                                                        >
                                                            <div style={{ width: 14, height: 14, borderRadius: '50%', border: isSelected ? '4px solid #1D4ED8' : '1px solid #D0D5DD', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                            </div>
                                                            {isRenaming ? (
                                                                <input
                                                                    autoFocus
                                                                    value={renameScenarioText}
                                                                    onChange={(e) => setRenameScenarioText(e.target.value)}
                                                                    onBlur={() => {
                                                                        if (renameScenarioText.trim() && renameScenarioText !== s.name) {
                                                                            onRenameScenario?.(s.id, renameScenarioText);
                                                                        }
                                                                        setRenamingScenarioId(null);
                                                                    }}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') {
                                                                            if (renameScenarioText.trim() && renameScenarioText !== s.name) {
                                                                                onRenameScenario?.(s.id, renameScenarioText);
                                                                            }
                                                                            setRenamingScenarioId(null);
                                                                        } else if (e.key === 'Escape') {
                                                                            setRenamingScenarioId(null);
                                                                        }
                                                                    }}
                                                                    style={{ flex: 1, border: '1px solid #1D4ED8', borderRadius: 4, padding: '2px 4px', fontSize: 13 }}
                                                                />
                                                            ) : (
                                                                <span style={{ color: isSelected ? '#1D4ED8' : '#344054', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{s.name}</span>
                                                            )}

                                                            {s.isPromoted && (
                                                                <span title="Original Data (Read-Only)" style={{ fontSize: '9px', background: '#fff7ed', color: '#c2410c', padding: '1px 4px', borderRadius: '4px', border: '1px solid #ffedd5', fontWeight: 600, flexShrink: 0, display: 'flex', alignItems: 'center', gap: '2px' }}>
                                                                    <Lock size={10} /> ORIGINAL
                                                                </span>
                                                            )}
                                                            {!isRenaming && !s.isPromoted && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setRenamingScenarioId(s.id);
                                                                        setRenameScenarioText(s.name);
                                                                    }}
                                                                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748B', display: 'flex', alignItems: 'center', padding: 4 }}
                                                                >
                                                                    <Edit2 size={12} />
                                                                </button>
                                                            )}
                                                            {s.id !== 'base' && !s.isPromoted && onScenarioDelete && (
                                                                <Trash2
                                                                    size={14}
                                                                    color="#ef4444"
                                                                    style={{ cursor: 'pointer', opacity: 0.6, flexShrink: 0 }}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        onScenarioDelete(s.id, e);
                                                                    }}
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
                    </div>

                    <div style={{ width: '1px', height: '24px', background: '#cbd5e1', margin: '0 8px' }} />

                    <button className="toolbar-btn secondary" onClick={() => fileInputRef.current?.click()} title="Import Data">
                        <Upload size={14} /> <span>Import</span>
                    </button>
                    <input
                        type="file"
                        accept=".csv, .xlsx, .xls"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        onChange={handleImportCSV}
                    />

                    {onPullData && (
                        <button className="toolbar-btn primary" onClick={onPullData} title="Pull Data from Source">
                            <Database size={14} /> <span>Pull Data</span>
                        </button>
                    )}

                    <button className="toolbar-btn secondary" onClick={handleExportData} title="Export to Excel">
                        <Download size={14} /> <span>Export</span>
                    </button>
                    {onSaveAllEdits && (
                        <button 
                            className="toolbar-btn" 
                            style={{ 
                                background: '#f0fdf4', 
                                color: '#15803d', 
                                border: '1px solid #bbf7d0',
                                marginRight: 4
                            }} 
                            onClick={onSaveAllEdits} 
                            title="Save calculated results as fixed values"
                        >
                            <Check size={14} /> <span>Save All Edits</span>
                        </button>
                    )}
                    {!showAddScenario ? (
                        <button className="toolbar-btn secondary" onClick={() => setShowAddScenario(true)}>
                            <Save size={14} /> <span>Save As...</span>
                        </button>
                    ) : (
                        <div className="add-scenario-popover">
                            <input
                                autoFocus
                                value={newScenarioName}
                                onChange={(e) => setNewScenarioName(e.target.value)}
                                placeholder="Scenario Name"
                                onKeyDown={(e) => e.key === 'Enter' && handleAddScenario()}
                            />
                            <button className="primary-btn sm" onClick={handleAddScenario}>Save</button>
                            <button className="ghost-btn sm" onClick={() => setShowAddScenario(false)}>Cancel</button>
                        </div>
                    )}

                    <div style={{ width: '1px', height: '24px', background: '#cbd5e1', margin: '0 8px' }} />

                    <button className="toolbar-btn primary" onClick={() => onAddRoot?.()} title="Add New Root KPI Row">
                        <Plus size={14} /> <span>Add Row</span>
                    </button>

                    {onMakeBaseScenario && (
                        <button
                            className="toolbar-btn"
                            onClick={onMakeBaseScenario}
                            style={{ background: '#F0F9FF', color: '#0369A1', border: '1px solid #B9E6FE', marginLeft: 8 }}
                            title="Make this scenario the base scenario"
                        >
                            <Save size={14} /> <span>Make Base Scenario</span>
                        </button>
                    )}
                </div>
            </div>

            <div className="table-scroll" style={{ overflow: 'auto', flex: 1, minHeight: 0 }}>
                <table className="sheet-table" style={{ borderCollapse: 'separate', borderSpacing: 0, userSelect: isDragging ? 'none' : undefined }}>
                    <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc' }}>
                        <tr>
                            <th className="kpi-name-cell">KPI Name</th>
                            <th className="unit-column">Unit</th>
                            <th className="lock-column"><Lock size={14} /></th>
                            {months.map((m, idx) => (
                                <th key={`month-head-${idx}`} className="month-column" style={{ borderBottom: '2px solid #cbd5e1', position: 'relative' }}>
                                    {idx === 0 && onDateRangeChange && (
                                        <div
                                            className="header-drag-handle left"
                                            onMouseDown={(e) => handleHeaderDragStart(e, 'start')}
                                            title="Drag to add previous months"
                                        />
                                    )}
                                    <input
                                        className="header-edit-input"
                                        value={editingCell?.kpiId === String(idx) && editingCell?.monthIdx === 'header' ? editText : m}
                                        onChange={(e) => editingCell?.kpiId === String(idx) && editingCell?.monthIdx === 'header' && setEditText(e.target.value)}
                                        onFocus={() => handleCellFocus(String(idx), 'header')}
                                        onBlur={() => handleCellBlur(String(idx), 'header')}
                                        onKeyDown={(e) => handleCellKeyDown(e, String(idx), 'header')}
                                    />
                                    {idx === months.length - 1 && onDateRangeChange && (
                                        <div
                                            className="header-drag-handle right"
                                            onMouseDown={(e) => handleHeaderDragStart(e, 'end')}
                                            title="Drag to add future months"
                                        />
                                    )}
                                </th>
                            ))}
                            <th className="total-head month-column" style={{ borderBottom: '2px solid #cbd5e1' }} title="Sum of all months in the selected range">Overall</th>
                            {onDateRangeChange && (
                                <th style={{ borderBottom: '2px solid #cbd5e1', width: '40px', padding: 0 }}>
                                    <button
                                        className="add-period-btn"
                                        onClick={handleAddPeriod}
                                        title="Add next month column"
                                    >
                                        <Plus size={14} />
                                    </button>
                                </th>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {kpiList.length > 0 ? (
                            kpiList.map((item) => {
                                const { kpi, depth, isVirtualScenario, isLogicalLeaf, hasScenariosToInject } = item;
                                const isEditing = (idx: number | 'total' | 'label' | 'unit' | 'header') =>
                                    editingCell?.kpiId === kpi.id && editingCell?.monthIdx === idx;

                                const isRowParent = !isVirtualScenario && (!isLogicalLeaf || hasScenariosToInject);

                                return (
                                    <React.Fragment key={`${kpi.id}-${depth}-${isVirtualScenario ? 'v' : 'r'}`}>
                                        <tr className={isRowParent ? 'parent-row' : 'leaf-row'}>
                                            <td className="kpi-name-cell">
                                                <div className="label-wrapper" style={{ paddingLeft: `${depth * 24}px` }}>
                                                    {isRowParent && (
                                                        <span
                                                            className="row-expander cursor-pointer text-slate-400 hover:text-blue-500 transition-colors select-none -ml-5 absolute"
                                                            style={{ marginLeft: -20, marginTop: 4, position: 'absolute' }}
                                                            onClick={() => onToggleExpand?.(kpi.id)}
                                                        >
                                                            {kpi.isExpanded ? <Minus size={14} /> : <Plus size={14} />}
                                                        </span>
                                                    )}
                                                    {!isRowParent && false}
                                                    {isRowParent && <Calculator size={14} className="calc-indicator" />}
                                                    <input
                                                        className={`kpi-label-input ${isRowParent ? 'font-bold' : ''}`}
                                                        value={isEditing('label') ? editText : kpi.label}
                                                        readOnly={isVirtualScenario}
                                                        onChange={(e) => !isVirtualScenario && isEditing('label') && setEditText(e.target.value)}
                                                        onFocus={() => !isVirtualScenario && handleCellFocus(kpi.id, 'label')}
                                                        onBlur={() => !isVirtualScenario && handleCellBlur(kpi.id, 'label')}
                                                        onKeyDown={(e) => !isVirtualScenario && handleCellKeyDown(e, kpi.id, 'label')}
                                                    />
                                                </div>
                                            </td>
                                            <td className="unit-column">
                                                <input
                                                    className="unit-input-cell"
                                                    value={isEditing('unit') ? editText : kpi.unit}
                                                    readOnly={isVirtualScenario}
                                                    onChange={(e) => !isVirtualScenario && isEditing('unit') && setEditText(e.target.value)}
                                                    onFocus={() => !isVirtualScenario && handleCellFocus(kpi.id, 'unit')}
                                                    onBlur={() => !isVirtualScenario && handleCellBlur(kpi.id, 'unit')}
                                                    onKeyDown={(e) => !isVirtualScenario && handleCellKeyDown(e, kpi.id, 'unit')}
                                                />
                                            </td>
                                            <td className="lock-column">
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    <button className="icon-btn-sm" onClick={() => onRowLockToggle?.(kpi.id)} style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 4 }}>
                                                        {kpi.isLocked ? <Lock size={14} className="text-red-500" /> : <Unlock size={14} className="text-slate-400" />}
                                                    </button>
                                                    {!isVirtualScenario && (
                                                        <MessageSquare
                                                            size={14}
                                                            style={{ cursor: 'pointer', opacity: kpi.comment ? 1 : 0.3, color: kpi.comment ? '#1D4ED8' : '#94A3B8' }}
                                                            onClick={() => {
                                                                setCommentingKpiId(kpi.id);
                                                                setCommentingMonthIdx(null);
                                                                setCommentText(kpi.comment || '');
                                                            }}
                                                        />
                                                    )}
                                                </div>
                                            </td>

                                            {/* Monthly cells */}
                                            {months.map((_, idx) => {
                                                const override = kpi.monthlyOverrides?.[idx];
                                                const isFormula = typeof override === 'string' && override.startsWith('=');
                                                const inDrag = isDragSelected(kpi.id, idx);
                                                const cellEditing = isEditing(idx);

                                                // Check for cell comments (if they exist in kpi data)
                                                const cellComment = kpi.monthlyComments?.[idx];

                                                return (
                                                    <td
                                                        key={`${kpi.id}-m-${idx}`}
                                                        className={`month-column ${override != null ? 'has-override' : ''} ${inDrag ? 'drag-selected' : ''}`}
                                                        onMouseEnter={() => handleCellMouseEnter(kpi.id, idx)}
                                                        style={{ position: 'relative' }}
                                                    >
                                                        <input
                                                            className={`sheet-cell-input ${isFormula ? 'formula-cell' : ''} ${isRowParent ? 'parent-val' : 'leaf-val'}`}
                                                            value={cellEditing ? editText : getCellDisplayValue(kpi, idx, isLogicalLeaf)}
                                                            readOnly={kpi.isLocked || !!kpi.lockedMonths?.[idx]}
                                                            onChange={(e) => {
                                                                if (cellEditing && !kpi.isLocked && !kpi.lockedMonths?.[idx]) {
                                                                    setEditText(e.target.value);
                                                                    updateSuggestions(e.target.value, e.target as HTMLInputElement);
                                                                }
                                                            }}
                                                            onFocus={() => {
                                                                if (!kpi.isLocked && !kpi.lockedMonths?.[idx]) {
                                                                    handleCellFocus(kpi.id, idx);
                                                                }
                                                            }}
                                                            onBlur={() => {
                                                                if (!kpi.isLocked && !kpi.lockedMonths?.[idx]) {
                                                                    handleCellBlur(kpi.id, idx);
                                                                }
                                                            }}
                                                            onKeyDown={(e) => {
                                                                if (!kpi.isLocked && !kpi.lockedMonths?.[idx]) {
                                                                    handleCellKeyDown(e, kpi.id, idx);
                                                                }
                                                            }}
                                                        />
                                                        {cellComment && <div className="cell-comment-indicator" title={cellComment} />}
                                                        {inDrag && <div className="fill-highlight" />}
                                                        <div className="fill-handle" onMouseDown={(e) => handleFillHandleMouseDown(kpi.id, idx, e)} />

                                                        {/* Context menu for cell comment */}
                                                        <div
                                                            className="cell-comment-trigger"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setCommentingKpiId(kpi.id);
                                                                setCommentingMonthIdx(idx);
                                                                setCommentText(kpi.monthlyComments?.[idx] || '');
                                                            }}
                                                            title="Add/edit cell comment"
                                                        >
                                                            <MessageSquare size={10} />
                                                        </div>
                                                    </td>
                                                );
                                            })}

                                            {/* Overall cell */}
                                            <td className={`total-cell month-column ${kpi.overallOverride != null ? 'has-override' : ''}`}>
                                                <input
                                                    className={`sheet-cell-input total-val ${isRowParent ? 'parent-val' : 'leaf-val'}`}
                                                    value={isEditing('total') ? editText : getOverallDisplayValue(kpi)}
                                                    readOnly={kpi.isLocked}
                                                    onChange={(e) => !kpi.isLocked && isEditing('total') && setEditText(e.target.value)}
                                                    onFocus={() => {
                                                        if (!kpi.isLocked) handleCellFocus(kpi.id, 'total');
                                                    }}
                                                    onBlur={() => {
                                                        if (!kpi.isLocked) handleCellBlur(kpi.id, 'total');
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (!kpi.isLocked) handleCellKeyDown(e, kpi.id, 'total');
                                                    }}
                                                    style={{ fontWeight: kpi.overallOverride != null ? 600 : 'normal' }}
                                                />
                                            </td>
                                            {onDateRangeChange && <td style={{ width: '40px' }} />}
                                        </tr>
                                    </React.Fragment>
                                );
                            })
                        ) : (
                            // Render 20 empty rows if no KPIs exist
                            Array.from({ length: 20 }).map((_, rIdx) => {
                                const isEditing = (type: 'label' | 'unit' | number) =>
                                    editingCell?.kpiId === `empty-${rIdx}` && editingCell?.monthIdx === (type as any);

                                const draft = emptyRowDrafts[rIdx];

                                return (
                                    <tr key={`empty-${rIdx}`} className="leaf-row">
                                        <td className="kpi-name-cell">
                                            <div className="label-wrapper">
                                                <input
                                                    className="kpi-label-input text-slate-400"
                                                    placeholder="New KPI..."
                                                    value={isEditing('label') ? editText : (draft?.label || '')}
                                                    onChange={(e) => isEditing('label') && setEditText(e.target.value)}
                                                    onFocus={() => handleEmptyCellFocus(rIdx, 'label')}
                                                    onBlur={() => handleEmptyCellBlur(rIdx, 'label')}
                                                    onKeyDown={(e) => handleCellKeyDown(e, `empty-${rIdx}`, 'label' as any)}
                                                />
                                            </div>
                                        </td>
                                        <td className="unit-column">
                                            <input
                                                className="unit-input-cell"
                                                placeholder="Unit"
                                                value={isEditing('unit') ? editText : (draft?.unit || '')}
                                                onChange={(e) => isEditing('unit') && setEditText(e.target.value)}
                                                onFocus={() => handleEmptyCellFocus(rIdx, 'unit')}
                                                onBlur={() => handleEmptyCellBlur(rIdx, 'unit')}
                                                onKeyDown={(e) => handleCellKeyDown(e, `empty-${rIdx}`, `unit` as any)}
                                            />
                                        </td>
                                        <td className="lock-column"></td>
                                        {months.map((_, cIdx) => (
                                            <td key={`empty-cell-${rIdx}-${cIdx}`} className="month-column">
                                                <input
                                                    className="sheet-cell-input"
                                                    value={isEditing(cIdx) ? editText : (draft?.values[cIdx] || '')}
                                                    onChange={(e) => isEditing(cIdx) && setEditText(e.target.value)}
                                                    onFocus={() => handleEmptyCellFocus(rIdx, cIdx)}
                                                    onBlur={() => handleEmptyCellBlur(rIdx, cIdx)}
                                                    onKeyDown={(e) => handleCellKeyDown(e, `empty-${rIdx}`, cIdx as any)}
                                                />
                                            </td>
                                        ))}
                                        <td className="total-cell month-column">
                                            <input className="sheet-cell-input" disabled readOnly />
                                        </td>
                                        {onDateRangeChange && <td style={{ width: '40px' }} />}
                                    </tr>
                                );
                            })
                        )}

                    </tbody>
                </table>
            </div>

            {/* Comment Modal */}
            {commentingKpiId && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
                    <div style={{ background: 'white', padding: 20, borderRadius: 8, width: 400, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                        <h3>{commentingMonthIdx !== null ? `Cell Comment (${months[commentingMonthIdx]})` : 'Row Comment'}</h3>
                        <textarea
                            autoFocus
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            style={{ width: '100%', height: 100, marginTop: 10, padding: 8, borderRadius: 4, border: '1px solid #D1D5DB', outline: 'none' }}
                            placeholder="Type progress updates or notes here..."
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 15 }}>
                            <button className="ghost-btn sm" onClick={() => setCommentingKpiId(null)}>Cancel</button>
                            <button
                                className="primary-btn sm"
                                onClick={() => {
                                    if (commentingMonthIdx !== null) {
                                        onCellCommentChange?.(commentingKpiId, commentingMonthIdx, commentText);
                                    } else {
                                        onCommentChange?.(commentingKpiId, commentText);
                                    }
                                    setCommentingKpiId(null);
                                }}
                            >
                                Save Comment
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Formula Suggestion Dropdown */}
            {suggestions.length > 0 && suggestionPos && (
                <div
                    className="formula-suggestions-dropdown"
                    style={{
                        position: 'absolute',
                        top: suggestionPos.top,
                        left: suggestionPos.left,
                        zIndex: 9999
                    }}
                >
                    {suggestions.map((s, idx) => (
                        <div
                            key={s.id}
                            className={`suggestion-item ${idx === suggestionIndex ? 'active' : ''}`}
                            onMouseDown={(e) => {
                                e.preventDefault();
                                handleApplySuggestion(s);
                            }}
                        >
                            <span className="suggestion-label">{s.label}</span>
                            <span className="suggestion-id">{s.id}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};


export default SpreadsheetView;
