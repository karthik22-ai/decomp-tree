import type { KPIData, TimeSeriesValue, FormulaType } from '../types';

/**
 * Expected Column Order:
 * 0: ID
 * 1: Label
 * 2: ParentId
 * 3: Unit
 * 4: Formula (SUM, NONE, PRODUCT, etc.)
 * 5: DesiredTrend (INCREASE, DECREASE)
 * 6: Jan
 * 7: Feb
 * ...
 * 17: Dec
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const parseSheetToKPIs = (rows: any[][]): Record<string, KPIData> => {
    if (!rows || rows.length <= 1) return {};

    const header = rows[0].map(h => String(h || '').toLowerCase().trim());
    
    // Find column indices by searching for keywords in headers
    const findIdx = (names: string[]) => header.findIndex(h => names.some(n => h.includes(n.toLowerCase()) || n.toLowerCase().includes(h)));
    
    const idIdx = findIdx(['id', 'child kpi', 'kpi id', 'name', 'code']);
    const labelIdx = findIdx(['label', 'kpi name', 'description', 'title', 'display name']);
    const parentIdx = findIdx(['parent', 'parent kpi', 'parent id', 'belongs to', 'parent code']);
    const unitIdx = findIdx(['unit', 'measure', 'currency', 'uom']);
    const formulaIdx = findIdx(['formula', 'aggregation', 'calc', 'type']);
    const trendIdx = findIdx(['trend', 'desired', 'direction', 'target']);

    // Find month columns (looking for Jan, Feb, etc. anywhere in the header)
    const monthIndices: (number | null)[] = MONTHS.map(m => {
        const idx = header.findIndex(h => h.includes(m.toLowerCase()));
        return idx !== -1 ? idx : null;
    });

    const kpiMap: Record<string, KPIData> = {};
    const dataRows = rows.slice(1);

    // First pass: Create all KPI objects
    dataRows.forEach((row) => {
        // Fallback to row index if no ID column found, but prefer a structured name
        let id = idIdx !== -1 ? String(row[idIdx] || '').trim() : '';
        
        // If still no ID, use a combination of row index and label if available
        if (!id) {
            const tempLabel = labelIdx !== -1 ? String(row[labelIdx] || '').trim() : '';
            if (tempLabel) {
                id = tempLabel.toLowerCase().replace(/\s+/g, '_');
            } else {
                // Skip rows with no identifying information
                return;
            }
        }

        const label = labelIdx !== -1 ? String(row[labelIdx] || id).trim() : id;
        const parentId = (parentIdx !== -1 && row[parentIdx]) ? String(row[parentIdx]).trim() : undefined;
        const unit = unitIdx !== -1 ? String(row[unitIdx] || '$').trim() : '$';
        const rawFormula = formulaIdx !== -1 ? String(row[formulaIdx] || 'NONE').toUpperCase() : 'NONE';
        const formula = (['SUM', 'PRODUCT', 'AVERAGE', 'CUSTOM', 'NONE'].includes(rawFormula) ? rawFormula : 'NONE') as FormulaType;
        
        const rawTrend = trendIdx !== -1 ? String(row[trendIdx] || 'INCREASE').toUpperCase() : 'INCREASE';
        const desiredTrend = (rawTrend.includes('DEC') ? 'DECREASE' : 'INCREASE') as 'INCREASE' | 'DECREASE';

        // Extract time series data
        const data: TimeSeriesValue[] = MONTHS.map((month, i) => {
            const colIdx = monthIndices[i];
            const rawVal = colIdx !== null ? row[colIdx] : 0;
            return {
                month,
                actual: typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal).replace(/[$,]/g, '')) || 0
            };
        });

        kpiMap[id] = {
            id,
            label,
            parentId,
            unit,
            formula,
            desiredTrend,
            data,
            children: [],
            isExpanded: true,
            simulationValue: 0,
            simulationType: 'PERCENT',
            color: '#3B82F6' // Default blue
        };
    });

    // Second pass: Establish parent-child relationships
    Object.values(kpiMap).forEach(kpi => {
        if (kpi.parentId && kpiMap[kpi.parentId]) {
            const parent = kpiMap[kpi.parentId];
            if (!parent.children.includes(kpi.id)) {
                parent.children.push(kpi.id);
            }
        }
    });

    return kpiMap;
};
