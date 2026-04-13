import * as XLSX from 'xlsx';

import type { KPIData, TimeSeriesValue, DateRange } from '../types';

export type KPIValue = TimeSeriesValue;
export type KPINode = KPIData;

/**
 * Generates a stable ID for a KPI based on its hierarchy path.
 */
function getStableId(path: string): string {
    let hash = 0;
    for (let i = 0; i < path.length; i++) {
        const char = path.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return `kpi-${Math.abs(hash).toString(16).padStart(8, '0')}`;
}

export function parseDateToAbsoluteMonth(dateStr: any, fallbackYear: number = 2024): number | null {
    if (dateStr === null || dateStr === undefined || dateStr === "") return null;

    let mIdx = -1;
    let yIdx = -1;

    // 1. Handle Numbers (Excel serial dates or simple indices)
    if (typeof dateStr === 'number') {
        if (dateStr > 1000) {
            // Excel Serial Date fallback logic
            const dt = new Date(Math.round((dateStr - 25569) * 86400 * 1000));
            mIdx = dt.getUTCMonth();
            yIdx = dt.getUTCFullYear();
        } else {
            if (dateStr >= 1 && dateStr <= 12) mIdx = dateStr - 1;
            else if (dateStr >= 0 && dateStr <= 11) mIdx = dateStr;
            if (mIdx !== -1) yIdx = fallbackYear;
        }
    } else {
        // 2. Handle Strings
        const s = String(dateStr).trim().toLowerCase();
        const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
        
        for (let i = 0; i < months.length; i++) {
            if (s.includes(months[i])) {
                mIdx = i;
                break;
            }
        }

        // Improved year detection
        const yearMatch = s.match(/(20\d{2})/);
        if (yearMatch) {
            yIdx = parseInt(yearMatch[1]);
        } else {
            const shortYearMatch = s.match(/(\d{2})$/);
            if (shortYearMatch) {
                const yr = parseInt(shortYearMatch[1]);
                yIdx = 2000 + yr;
            } else {
                yIdx = fallbackYear;
            }
        }
    }

    if (mIdx !== -1 && yIdx !== -1) {
        return yIdx * 12 + mIdx;
    }
    return null;
}

function extractNumber(val: any): number | null {
    if (val === null || val === undefined || val === "") return null;
    if (typeof val === 'number') return val;
    
    const s = String(val).trim().toLowerCase();
    const zeros = ["-", "--", "( - )", "n.a.", "n/a", "tbd"];
    if (zeros.includes(s)) return 0.0;
    
    let cleaned = s.replace(/[$,£€%]/g, '');
    if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
        cleaned = '-' + cleaned.slice(1, -1);
    }
    cleaned = cleaned.replace(/,/g, '');
    
    const num = parseFloat(cleaned);
    if (isNaN(num)) return null;
    return s.includes('%') ? num / 100.0 : num;
}

export function promoteByHierarchy(
    rows: any[][], 
    monthsCount: number, 
    mappings: Record<string, string>,
    startMonth: number = 0,
    startYear: number = 2024
): any {
    if (!rows || rows.length < 2) return {};

    const header = rows[0].map(c => String(c || "").trim());
    const dataRows = rows.slice(1);

    const roles: Record<string, number> = {};
    const hierarchyLevels: Array<{level: number, index: number}> = [];

    // 1. Identify Roles
    Object.entries(mappings).forEach(([idxStr, role]) => {
        const idx = parseInt(idxStr);
        if (role.startsWith("L")) {
            const level = parseInt(role.substring(1));
            if (!isNaN(level)) hierarchyLevels.push({ level, index: idx });
        } else {
            roles[role] = idx;
        }
    });

    hierarchyLevels.sort((a, b) => a.level - b.level);

    // 2. Format Detection (Wide vs Long) and Date Range bounds
    const hasMonthsInHeader = header.some(h => parseDateToAbsoluteMonth(h, startYear) !== null);
    const isLongFormat = "Value" in roles && ("Time" in roles || hasMonthsInHeader);

    const timeAbsValues: number[] = [];
    if (isLongFormat) {
        const timeIdx = roles["Time"];
        dataRows.forEach(row => {
            if (timeIdx !== undefined && timeIdx < row.length) {
                const absM = parseDateToAbsoluteMonth(row[timeIdx], startYear);
                if (absM !== null) timeAbsValues.push(absM);
            }
        });
    } else {
        header.forEach((h, i) => {
            if (hierarchyLevels.some(hl => hl.index === i) || i === roles["Scenario"]) return;
            const absM = parseDateToAbsoluteMonth(h, startYear);
            if (absM !== null) timeAbsValues.push(absM);
        });
    }

    let detectedDateRange: DateRange | null = null;
    if (timeAbsValues.length > 0) {
        const minAbs = Math.min(...timeAbsValues);
        const maxAbs = Math.max(...timeAbsValues);
        
        startYear = Math.floor(minAbs / 12);
        startMonth = minAbs % 12;
        const span = maxAbs - minAbs + 1;
        monthsCount = Math.max(span, monthsCount);
        
        const finalAbs = minAbs + monthsCount - 1;
        
        detectedDateRange = {
            startMonth,
            startYear,
            endMonth: finalAbs % 12,
            endYear: Math.floor(finalAbs / 12),
            monthsCount
        };
    }

    const startAbs = startYear * 12 + startMonth;

    // 3. Process Rows into a Hierarchy Map
    type KpiMapItem = { 
        id: string; 
        label: string; 
        levels: string[]; 
        scenarios: Record<string, number[]> 
    };
    const kpiMap: Record<string, KpiMapItem> = {};
    const getKpiKey = (levels: string[]) => levels.join(" > ");

    dataRows.forEach(row => {
        const currentLevels = hierarchyLevels
            .map(h => String(row[h.index] || "").trim())
            .filter(Boolean);
        
        if (currentLevels.length === 0) return;

        // Clean trailing blanks if any (already filter Boolean handled it but let's be safe)
        const kpiKey = getKpiKey(currentLevels);
        if (!kpiMap[kpiKey]) {
            const kpiId = getStableId(kpiKey);
            kpiMap[kpiKey] = {
                id: kpiId,
                label: currentLevels[currentLevels.length - 1],
                levels: currentLevels,
                scenarios: {}
            };
        }

        const scenarioName = roles["Scenario"] !== undefined ? String(row[roles["Scenario"]] || "Actual").trim() : "Actual";
        if (!kpiMap[kpiKey].scenarios[scenarioName]) {
            kpiMap[kpiKey].scenarios[scenarioName] = new Array(monthsCount).fill(0.0);
        }

        if (isLongFormat) {
            const val = extractNumber(row[roles["Value"]]) || 0.0;
            const timeIdx = roles["Time"];
            let mIdx = 0;
            if (timeIdx !== undefined) {
                const absM = parseDateToAbsoluteMonth(row[timeIdx], startYear);
                if (absM !== null) mIdx = absM - startAbs;
            }
            if (mIdx >= 0 && mIdx < monthsCount) {
                kpiMap[kpiKey].scenarios[scenarioName][mIdx] += val;
            }
        } else {
            // Wide format
            header.forEach((h, i) => {
                if (hierarchyLevels.some(hl => hl.index === i) || i === roles["Scenario"]) return;
                const absM = parseDateToAbsoluteMonth(h, startYear);
                if (absM !== null) {
                    const mIdx = absM - startAbs;
                    if (mIdx >= 0 && mIdx < monthsCount) {
                        const v = extractNumber(row[i]) || 0.0;
                        kpiMap[kpiKey].scenarios[scenarioName][mIdx] += v;
                    }
                }
            });
        }
    });

    // 4. Build Relationship Map and Registry
    const nodeRegistry: Record<string, any> = {};
    const sortedKpiKeys = Object.keys(kpiMap).sort((a, b) => a.split(" > ").length - b.split(" > ").length);

    // Ensure all levels exist in registry
    sortedKpiKeys.forEach(key => {
        const item = kpiMap[key];
        const levels = item.levels;
        for (let i = 1; i <= levels.length; i++) {
            const subPath = levels.slice(0, i);
            const subKey = getKpiKey(subPath);
            if (!nodeRegistry[subKey]) {
                const pPath = levels.slice(0, i - 1);
                const pKey = pPath.length > 0 ? getKpiKey(pPath) : null;
                const nodeId = getStableId(subKey);

                nodeRegistry[subKey] = {
                    id: nodeId,
                    label: subPath[subPath.length - 1],
                    unit: "$",
                    formula: i < levels.length ? 'SUM' : 'NONE',
                    children: [],
                    parentId: pKey ? nodeRegistry[pKey].id : undefined,
                    data: [], // populated per scenario
                    isExpanded: true,
                    simulationValue: 0,
                    simulationType: 'PERCENT'
                };
                
                if (pKey && nodeRegistry[pKey]) {
                    if (!nodeRegistry[pKey].children.includes(nodeId)) {
                        nodeRegistry[pKey].children.push(nodeId);
                    }
                }
            }
        }
    });

    // 5. Populate scenarios and aggregate
    const allScenarios = new Set<string>();
    Object.values(kpiMap).forEach(item => {
        Object.keys(item.scenarios).forEach(s => allScenarios.add(s));
    });
    if (allScenarios.size === 0) allScenarios.add("Actual");

    const scenariosOutput: Record<string, Record<string, KPIData>> = {};
    
    allScenarios.forEach(sName => {
        const sKpis: Record<string, KPIData> = {};
        
        // 5.1 Initialize leaf data
        Object.entries(nodeRegistry).forEach(([key, node]) => {
            const newNode = { ...node, children: [...node.children] };
            const vals = (kpiMap[key] && kpiMap[key].scenarios[sName]) || new Array(monthsCount).fill(0.0);
            
            newNode.data = vals.map((v: number, j: number) => ({
                month: (startYear * 12 + startMonth + j) % 12,
                year: Math.floor((startYear * 12 + startMonth + j) / 12),
                actual: v
            }));
            sKpis[newNode.id] = newNode;
        });

        // 5.2 Aggregation: Bottom-up
        const depthSortedKeys = Object.keys(nodeRegistry).sort((a, b) => b.split(" > ").length - a.split(" > ").length);
        depthSortedKeys.forEach(key => {
            const nodeId = nodeRegistry[key].id;
            const node = sKpis[nodeId];
            if (node.children && node.children.length > 0) {
                // If it's a SUM parent, recalculate from children
                if (node.formula === 'SUM') {
                    const totals = new Array(monthsCount).fill(0.0);
                    node.children.forEach(cid => {
                        const child = sKpis[cid];
                        if (child && child.data) {
                            child.data.forEach((d: any, idx: number) => {
                                if (idx < monthsCount) totals[idx] += d.actual || 0;
                            });
                        }
                    });

                    node.data = totals.map((v, j) => ({
                        month: ((startYear * 12 + startMonth + j) % 12).toString(),
                        year: Math.floor((startYear * 12 + startMonth + j) / 12),
                        actual: v
                    }));
                }
            }
        });

        scenariosOutput[sName] = sKpis;
    });

    // 6. Final Result
    const defaultScenario = scenariosOutput["Actual"] ? "Actual" : Object.keys(scenariosOutput)[0];
    const stats = {
        total_rows_processed: dataRows.length,
        kpis_created: Object.keys(kpiMap).length,
        scenarios_detected: Array.from(allScenarios)
    };

    const result = {
        type: 'multi-scenario',
        scenarios: scenariosOutput,
        kpis: scenariosOutput[defaultScenario],
        dateRange: detectedDateRange || { startMonth, startYear, monthsCount },
        stats
    };

    return result;
}

/**
 * Parses an Excel or CSV file in the browser and returns raw row data for all sheets.
 */
export async function parseFile(file: File): Promise<{ sheets: Record<string, any[][]>, firstSheetData: any[][] }> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            
            const sheets: Record<string, any[][]> = {};
            workbook.SheetNames.forEach(name => {
                const worksheet = workbook.Sheets[name];
                sheets[name] = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
            });

            const firstSheetData = sheets[workbook.SheetNames[0]] || [];
            resolve({ sheets, firstSheetData });
        };
        reader.onerror = (err) => reject(err);
        reader.readAsArrayBuffer(file);
    });
}
