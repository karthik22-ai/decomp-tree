import pandas as pd
import numpy as np
import io
import re
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime
from dateutil import parser
import hashlib

def parse_file_to_kpis(file_content: bytes, filename: str, months_count: int = 12) -> Dict[str, Any]:
    """
    Parses an uploaded file (Excel or CSV) into all its raw sheets.
    Returns a dictionary mapping sheet names to lists of lists.
    """
    is_excel = filename.endswith('.xlsx') or filename.endswith('.xls')
    sheets_data = {}
    
    if is_excel:
        excel_file = pd.ExcelFile(io.BytesIO(file_content))
        for sheet_name in excel_file.sheet_names:
            df = pd.read_excel(excel_file, sheet_name=sheet_name, header=None)
            df_clean = df.replace([np.inf, -np.inf], np.nan)
            raw_rows = df_clean.where(pd.notnull(df_clean), None).values.tolist()
            sheets_data[sheet_name] = raw_rows
    else:
        # CSV Handling (Single sheet by definition)
        try:
            df = pd.read_csv(io.BytesIO(file_content), header=None, encoding='utf-8')
        except UnicodeDecodeError:
            df = pd.read_csv(io.BytesIO(file_content), header=None, encoding='latin1')
            
        df_clean = df.replace([np.inf, -np.inf], np.nan)
        raw_rows = df_clean.where(pd.notnull(df_clean), None).values.tolist()
        sheets_data["Default"] = raw_rows

    return sanitize_for_json({
        "sheets": sheets_data,
        "kpis": {}, # Empty for backward compatibility during transition
        "raw_rows": sheets_data.get(next(iter(sheets_data))) if sheets_data else []
    })

def sanitize_for_json(obj: Any) -> Any:
    """Recursively replaces non-JSON compliant floats (NaN, Inf) with None."""
    if isinstance(obj, dict):
        return {k: sanitize_for_json(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [sanitize_for_json(x) for x in obj]
    elif isinstance(obj, float):
        if np.isnan(obj) or np.isinf(obj):
            return None
        return obj
    return obj

def _find_col(header: List[str], markers: List[str], default: int = -1) -> int:
    for marker in markers:
        if marker in header:
            return header.index(marker)
    return default

def _extract_number(val: Any) -> Optional[float]:
    if pd.isna(val) or val == "":
        return None
    
    # Common zero markers in financial data
    financial_zeros = ["-", "--", "( - )", "n.a.", "n/a", "tbd", "actuals", "target"]
    if isinstance(val, str) and val.strip().lower() in financial_zeros:
        return 0.0

    if isinstance(val, (int, float)):
        return float(val)
    
    s = str(val).strip()
    
    # Handle negative brackets
    if s.startswith('(') and s.endswith(')'):
        inner = s[1:-1].strip()
        if inner in ["-", "--"]: return 0.0
        s = '-' + inner
    
    # Handle currency symbols and common separators
    s = s.replace('$', '').replace('£', '').replace('€', '')
    if ',' in s and '.' in s:
        s = s.replace(',', '')
    elif ',' in s and s.count(',') == 1:
        parts = s.split(',')
        if len(parts[1]) != 3: s = s.replace(',', '.')
        else: s = s.replace(',', '')
    else:
        s = s.replace(',', '')

    s = re.sub(r'[^0-9.\-eE%]', '', s)
    if not s or s == '-' or s == '.':
        return None
        
    try:
        if s.endswith('%'):
            return float(s[:-1]) / 100.0
        return float(s)
    except ValueError:
        return None

def parse_excel_date(val: Any) -> Optional[datetime]:
    if isinstance(val, (int, float)) and val > 1000:
        try:
            return pd.to_datetime(val, unit='D', origin='1899-12-30').to_pydatetime()
        except:
             return None
    return None

def parse_date_to_absolute_month(date_str: Any, fallback_year: int = 2024) -> Optional[int]:
    if date_str is None or date_str == "":
        return None
    
    m_idx = -1
    y_idx = -1
    
    # 1. Handle Excel Serial Dates
    excel_dt = parse_excel_date(date_str)
    if excel_dt:
        m_idx = excel_dt.month - 1
        y_idx = excel_dt.year
    
    # 2. Handle Numbers (Month Indices)
    elif isinstance(date_str, (int, float)):
        val = int(date_str)
        if 1 <= val <= 12: m_idx = val - 1
        elif 0 <= val <= 11: m_idx = val
        if m_idx != -1: y_idx = fallback_year
    
    # 3. Handle String Dates
    else:
        try:
            dt = parser.parse(str(date_str), fuzzy=True)
            m_idx = dt.month - 1
            y_idx = dt.year
        except:
            s = str(date_str).lower()
            months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
            for i, month in enumerate(months):
                if month in s:
                    m_idx = i
                    break
            
            # Improved year detection to handle "feb2025" (no boundary between letters and numbers)
            year_match = re.search(r'(?<!\d)(20\d{2})(?=\b)', s)
            if not year_match:
                year_match = re.search(r'(20\d{2})', s)
            
            if year_match:
                y_val = int(year_match.group(1))
                y_idx = y_val if y_val > 100 else 2000 + y_val
            else:
                # Try 2-digit year fallback if separated or at end
                short_year_match = re.search(r'(\d{2})$', s)
                if short_year_match:
                    y_idx = 2000 + int(short_year_match.group(1))
                else:
                    y_idx = fallback_year

    if m_idx != -1 and y_idx != -1:
        return y_idx * 12 + m_idx
    return None

def promote_by_hierarchy(rows: List[List[Any]], months_count: int, mappings: Dict[str, str], 
                         start_month: int = 0, start_year: int = 2024) -> Dict[str, Any]:
    """
    Builds a structural KPI tree from flat data.
    Supports both Wide format (months in columns) and Long format (Time, Scenario, Value columns).
    """
    if not rows or len(rows) < 2:
        return {}

    header = [str(c).strip() if c else "" for c in rows[0]]
    data_rows = rows[1:]
    
    # 1. Identify Column Roles
    roles = {} # role -> index
    hierarchy_levels = [] # list of (level, index) e.g., [(1, 0), (2, 1)]
    
    if mappings:
        for idx_str, role in mappings.items():
            try:
                idx = int(idx_str)
                if role.startswith("L"):
                    try:
                        level = int(role[1:])
                        hierarchy_levels.append((level, idx))
                    except: pass
                else:
                    roles[role] = idx
            except: pass
    else:
        # Heuristic discovery
        for i, col in enumerate(header):
            c_upper = col.upper()
            if c_upper == "L1" or "LEVEL 1" in c_upper: hierarchy_levels.append((1, i))
            elif c_upper == "L2" or "LEVEL 2" in c_upper: hierarchy_levels.append((2, i))
            elif c_upper == "L3" or "LEVEL 3" in c_upper: hierarchy_levels.append((3, i))
            elif c_upper == "L4" or "LEVEL 4" in c_upper: hierarchy_levels.append((4, i))
            elif any(x in c_upper for x in ["SCENARIO", "VERSION", "TYPE", "DATA TYPE", "ACTUAL/BUDGET"]): 
                roles["Scenario"] = i

    if not hierarchy_levels:
        # Default to first few columns as hierarchy if nothing else, but SKIP scenario/time/value columns
        possible_indices = [i for i in range(len(header)) if i not in roles.values()]
        if len(possible_indices) >= 2:
            hierarchy_levels = [(1, possible_indices[0]), (2, possible_indices[1])]
        elif len(possible_indices) == 1:
            hierarchy_levels = [(1, possible_indices[0])]
        else:
            hierarchy_levels = [(1, 0), (2, 1)] # Fallback

    hierarchy_levels.sort() # Ensure L1 comes before L2

    # 2. Determine Format (Wide vs Long) and Auto-Detect Date Range bounds
    has_months_in_header = any(parse_date_to_absolute_month(c, start_year) is not None for c in header)
    is_long_format = "Value" in roles and ("Time" in roles or has_months_in_header)
    
    # Collect all absolute months present in the dataset
    time_abs_values = []
    
    if is_long_format:
        time_idx = roles.get("Time")
        if time_idx is not None:
            for row in data_rows:
                if time_idx < len(row):
                    abs_m = parse_date_to_absolute_month(row[time_idx], start_year)
                    if abs_m is not None:
                        time_abs_values.append(abs_m)
    else:
        for i, col_name in enumerate(header):
            if i in [idx for _, idx in hierarchy_levels] or i == roles.get("Scenario"):
                continue
            abs_m = parse_date_to_absolute_month(col_name, start_year)
            if abs_m is not None:
                time_abs_values.append(abs_m)
                
    detected_date_range = None
    if time_abs_values:
        min_abs_month = min(time_abs_values)
        max_abs_month = max(time_abs_values)
        
        start_year = min_abs_month // 12
        start_month = min_abs_month % 12
        end_year = max_abs_month // 12
        end_month = max_abs_month % 12
        
        span = max_abs_month - min_abs_month + 1
        
        # Don't strictly shrink if the user requested a larger grid (e.g. for padding/forecasting)
        months_count = max(span, months_count)
        
        # Recalculate end_month and end_year to match the final padded months_count
        final_abs_month = min_abs_month + months_count - 1
        end_year = final_abs_month // 12
        end_month = final_abs_month % 12
        
        detected_date_range = {
            "startMonth": start_month,
            "startYear": start_year,
            "endMonth": end_month,
            "endYear": end_year,
            "monthsCount": months_count
        }
    
    # 3. Process Rows into a Hierarchy Map
    # Structure: { kpi_key: { id: str, label: str, values: { scenario: [values] } } }
    kpi_map = {}
    
    def get_kpi_key(levels_data: List[str]) -> str:
        return " > ".join(levels_data)

    for row in data_rows:
        # Extract hierarchy
        current_levels = []
        for _, idx in hierarchy_levels:
            if idx < len(row):
                val = str(row[idx]).strip() if row[idx] is not None else ""
                current_levels.append(val)
        
        if not any(current_levels):
            continue # Skip blank rows
            
        # Clean current_levels (trailing blanks)
        while current_levels and not current_levels[-1]:
            current_levels.pop()
            
        if not current_levels:
            continue
            
        kpi_key = get_kpi_key(current_levels)
        if kpi_key not in kpi_map:
            # Generate a stable ID based on the hierarchy path
            kpi_id = f"kpi-{hashlib.md5(kpi_key.encode()).hexdigest()[:16]}"
            kpi_map[kpi_key] = {
                "id": kpi_id,
                "label": current_levels[-1],
                "levels": current_levels,
                "scenarios": {} # scenario_name -> [0] * months_count
            }
        
        scenario_name = "Actual"
        if "Scenario" in roles and roles["Scenario"] < len(row):
            scenario_name = str(row[roles["Scenario"]]).strip() or "Actual"

        if scenario_name not in kpi_map[kpi_key]["scenarios"]:
            kpi_map[kpi_key]["scenarios"][scenario_name] = [0.0] * months_count

        # Extract values
        if is_long_format:
            # Long format logic
            val_idx = roles.get("Value")
            time_idx = roles.get("Time")
            
            val = _extract_number(row[val_idx]) if val_idx is not None and val_idx < len(row) else 0.0
            
            m_idx = 0
            if time_idx is not None and time_idx < len(row):
                abs_m = parse_date_to_absolute_month(row[time_idx], start_year)
                if abs_m is not None:
                    m_idx = abs_m - (start_year * 12 + start_month)
                
            if 0 <= m_idx < months_count:
                kpi_map[kpi_key]["scenarios"][scenario_name][m_idx] += val
        else:
            # Wide format logic (months are columns)
            for i, col_name in enumerate(header):
                # Skip hierarchy/scenario columns
                if i in [idx for _, idx in hierarchy_levels] or i == roles.get("Scenario"):
                    continue
                
                abs_m = parse_date_to_absolute_month(col_name, start_year)
                if abs_m is not None:
                    m_idx = abs_m - (start_year * 12 + start_month)
                    if 0 <= m_idx < months_count:
                        v = _extract_number(row[i]) if i < len(row) else 0.0
                        kpi_map[kpi_key]["scenarios"][scenario_name][m_idx] += v

    # 4. Build Relationship Map & Registry
    # We do this twice: once to establish structure, then again per scenario to populate data.
    node_registry = {}
    sorted_keys = sorted(kpi_map.keys(), key=lambda x: len(x.split(" > ")))
    
    # First pass: structure only
    for key in sorted_keys:
        item = kpi_map[key]
        levels = item["levels"]
        for i in range(1, len(levels) + 1):
            sub_path = levels[:i]
            sub_key = " > ".join(sub_path)
            if sub_key not in node_registry:
                p_path = levels[:i-1]
                p_key = " > ".join(p_path) if p_path else None
                
                # Use the same stable ID logic
                node_id = f"kpi-{hashlib.md5(sub_key.encode()).hexdigest()[:16]}"
                
                node_registry[sub_key] = {
                    "id": node_id,
                    "label": sub_path[-1],
                    "unit": "$",
                    "formula": "SUM" if i < len(levels) else "NONE",
                    "children": [],
                    "parentId": node_registry[p_key]["id"] if p_key in node_registry else None,
                    "data": [], # Will be populated per scenario
                    "isExpanded": True,
                    "simulationValue": 0,
                    "simulationType": "PERCENT",
                }
    
    # Link children (Existing logic handles the CSV hierarchy, we just appended scenario nodes)
    for node in node_registry.values():
        p_id = node["parentId"]
        if p_id:
            for p_node in node_registry.values():
                if p_node["id"] == p_id:
                    if node["id"] not in p_node["children"]:
                        p_node["children"].append(node["id"])
                    break

    # 5. Populate Data for each scenario
    all_scenarios = set()
    for item in kpi_map.values():
        all_scenarios.update(item["scenarios"].keys())
    
    if not all_scenarios:
        all_scenarios = {"Actual"}

    scenarios_output = {}
    for s_name in all_scenarios:
        # Create a full set of KPIs for this scenario
        s_kpis = {}
        # 5.1 Initialize leaf data for this scenario
        for key, node in node_registry.items():
            s_node = node.copy()
            s_node["children"] = node["children"].copy()
            
            # Find data in kpi_map if it's a leaf we actually have data for
            vals = [0.0] * months_count
            if key in kpi_map and s_name in kpi_map[key]["scenarios"]:
                vals = kpi_map[key]["scenarios"][s_name]
            
            # Calculate actual month and year corresponding to `j`
            s_node["data"] = [
                {
                    "month": (start_year * 12 + start_month + j) % 12,
                    "year": (start_year * 12 + start_month + j) // 12,
                    "actual": v
                } 
                for j, v in enumerate(vals)
            ]
            s_kpis[s_node["id"]] = s_node

        # 5.2 Aggregation: Sum up parent data from children for this scenario
        depth_sorted_keys = sorted(node_registry.keys(), key=lambda x: len(x.split(" > ")), reverse=True)
        for key in depth_sorted_keys:
            node_id = node_registry[key]["id"]
            s_node = s_kpis[node_id]
            if s_node["children"]:
                # We want to aggregate ONLY from children that are NOT scenario nodes.
                regular_children = []
                for cid in s_node["children"]:
                    child_node_key = next((k for k, v in node_registry.items() if v["id"] == cid), None)
                    # If this child is a scenario node (its key ends with a scenario name), skip it
                    if child_node_key and " > " in child_node_key and child_node_key.split(" > ")[-1] in all_scenarios:
                        continue
                    regular_children.append(cid)
                    
                if regular_children:
                    totals = [0.0] * months_count
                    for cid in regular_children:
                        if cid in s_kpis:
                            c_data = s_kpis[cid]["data"]
                            for j in range(min(len(c_data), months_count)):
                                totals[j] += c_data[j]["actual"]
                    
                    s_node["data"] = [
                        {
                            "month": (start_year * 12 + start_month + j) % 12,
                            "year": (start_year * 12 + start_month + j) // 12,
                            "actual": v
                        }
                        for j, v in enumerate(totals)
                    ]
        
        # Also handle scenario child nodes if created
        for s_key, s_item in kpi_map.items():
            for s_name_inner, s_values in s_item["scenarios"].items():
                scen_node_key = f"{s_key} > {s_name_inner}"
                if scen_node_key in node_registry:
                    sn_id = node_registry[scen_node_key]["id"]
                    s_kpis[sn_id] = node_registry[scen_node_key].copy()
                    s_kpis[sn_id]["isScenarioNode"] = True
                    s_kpis[sn_id]["data"] = [
                        {"month": (start_year*12+start_month+j)%12, "year": (start_year*12+start_month+j)//12, "actual": v}
                        for j, v in enumerate(s_values)
                    ]
        
        scenarios_output[s_name] = s_kpis

    # 6. Return Result
    stats = {
        "total_rows_processed": len(data_rows),
        "kpis_created": len(kpi_map),
        "scenarios_detected": list(all_scenarios)
    }

    res = {}
    if len(all_scenarios) > 1 or (len(all_scenarios) == 1 and next(iter(all_scenarios)) != "Actual"):
        default_scenario = "Actual" if "Actual" in scenarios_output else \
                          ("Base" if "Base" in scenarios_output else next(iter(scenarios_output)))
        res = {
            "type": "multi-scenario",
            "scenarios": scenarios_output,
            "kpis": scenarios_output[default_scenario]
        }
    else:
        res = scenarios_output.get("Actual", scenarios_output.get(next(iter(scenarios_output))))
    
    if isinstance(res, dict):
        res["stats"] = stats
        if detected_date_range:
            res["dateRange"] = detected_date_range
            # Also ensure startMonth/startYear in the root result match detected values for UI
            res["startMonth"] = detected_date_range["startMonth"]
            res["startYear"] = detected_date_range["startYear"]
    return res
