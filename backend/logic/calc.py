import numpy as np
import pandas as pd
from typing import Dict, List, Any, Set, Optional, Tuple
import re

class KPICalculator:
    def __init__(self, kpis: Dict[str, Any], date_range: Dict[str, int]):
        self.kpis = kpis
        self.date_range = date_range
        self.start_month = date_range['startMonth']
        self.start_year = date_range['startYear']
        self.end_month = date_range['endMonth']
        self.end_year = date_range['endYear']
        
        # Calculate period count
        self.months = self._get_months()
        self.period_count = len(self.months)
        
        # Result storage as numpy arrays for efficiency
        self.results = {kid: np.zeros(self.period_count + 1) for kid in kpis.keys()}
        self.monthly_overrides_set = set()
        self.impacted_kpis = set()
        self.computed_nodes = set()
        self.computing_nodes = set()
        
        # Initialize with base data
        self._initialize_data()

    def _get_months(self) -> List[Dict[str, Any]]:
        months_labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        res = []
        curr_m, curr_y = self.start_month, self.start_year
        while curr_y < self.end_year or (curr_y == self.end_year and curr_m <= self.end_month):
            res.append({'month': curr_m, 'year': curr_y, 'label': f"{months_labels[curr_m]} {curr_y}"})
            curr_m += 1
            if curr_m > 11:
                curr_m = 0
                curr_y += 1
        return res

    def _initialize_data(self):
        for kid, kpi in self.kpis.items():
            base_data = kpi.get('data', [])
            for m_idx, period in enumerate(self.months):
                # Match by month/year index (robust) or label (fallback)
                val = 0
                for d in base_data:
                    try:
                        d_month = d.get('month')
                        d_year = d.get('year')
                        
                        # Match by indices if available
                        if isinstance(d_month, int) and d_month >= 0:
                            if d_month == period['month'] and (d_year is None or d_year == period['year']):
                                val = d.get('actual', 0)
                                break
                        
                        # Fallback: Match by label
                        d_label = d.get('label', '')
                        if d_label and d_label == period['label']:
                            val = d.get('actual', 0)
                            break
                        
                        # Fallback: legacy integer matching if year is provided as int
                        if d_year is not None and d_month is not None:
                            if int(d_month) == period['month'] and int(d_year) == period['year']:
                                val = d.get('actual', 0)
                                break
                    except (ValueError, TypeError):
                        continue
                self.results[kid][m_idx] = val

    def calculate(self) -> Tuple[Dict[str, List[float]], List[str]]:
        for kid in self.kpis.keys():
            self._compute_node(kid)
        
        # Calculate FY totals
        for kid in self.results:
            self.results[kid][self.period_count] = np.sum(self.results[kid][:self.period_count])
            
        return {kid: self.results[kid].tolist() for kid in self.results}, list(self.impacted_kpis)


    def _is_mutable(self, node_id: str, month_idx: int) -> bool:
        node = self.kpis.get(node_id)
        if not node: return False
        if node.get('isLocked'): return False
        
        lm = node.get('lockedMonths')
        if isinstance(lm, list):
            if month_idx < len(lm) and lm[month_idx]:
                return False
        elif isinstance(lm, dict):
            if lm.get(str(month_idx)):
                return False
        elif lm:
            return False
            
        return True

    def _distribute_top_down(self, parent_id: str, month_idx: int, target_value: float):
        kpi = self.kpis.get(parent_id)
        if not kpi or not kpi.get('children'):
            return

        formula = kpi.get('formula', 'SUM')
        if formula not in ['SUM', 'NONE', None, '', 'AVERAGE', 'PRODUCT']:
            return

        child_ids = kpi['children']
        
        mutable_children = [cid for cid in child_ids if self._is_mutable(cid, month_idx)]
        if not mutable_children:
            return

        if formula == 'AVERAGE':
            target_sum = target_value * len(child_ids)
            current_sum = sum(self.results[cid][month_idx] for cid in child_ids)
            diff = target_sum - current_sum
            
            if abs(diff) < 1e-9:
                return

            current_mutable_sum = sum(self.results[cid][month_idx] for cid in mutable_children)
            if abs(current_mutable_sum) > 1e-9:
                for cid in mutable_children:
                    proportion = self.results[cid][month_idx] / current_mutable_sum
                    self.results[cid][month_idx] += (diff * proportion)
                    self._distribute_top_down(cid, month_idx, self.results[cid][month_idx])
            else:
                even_diff = diff / len(mutable_children)
                for cid in mutable_children:
                    self.results[cid][month_idx] += even_diff
                    self._distribute_top_down(cid, month_idx, self.results[cid][month_idx])

        elif formula == 'PRODUCT':
            current_product = np.prod([self.results[cid][month_idx] for cid in child_ids])
            if abs(current_product) < 1e-9 and abs(target_value) > 1e-9:
                non_mut_vals = [self.results[cid][month_idx] for cid in child_ids if cid not in mutable_children]
                non_mut_prod = np.prod(non_mut_vals) if non_mut_vals else 1.0
                if abs(non_mut_prod) < 1e-9:
                    return # Impossible to reach target if locked child is 0
                    
                target_mut_prod = target_value / non_mut_prod
                if target_mut_prod < 0 and len(mutable_children) % 2 == 0:
                    return # Mathematically impossible with real numbers
                
                sign = -1 if target_mut_prod < 0 else 1
                root = sign * (abs(target_mut_prod) ** (1.0 / len(mutable_children)))
                for cid in mutable_children:
                    self.results[cid][month_idx] = root
                    self._distribute_top_down(cid, month_idx, self.results[cid][month_idx])
                return

            ratio = target_value / current_product if abs(current_product) > 1e-9 else 1
            if abs(ratio - 1) < 1e-9:
                return

            if ratio < 0 and len(mutable_children) % 2 == 0:
                return # Cannot do even roots of negative numbers

            sign = -1 if ratio < 0 else 1
            factor = sign * (abs(ratio) ** (1.0 / len(mutable_children)))
            for cid in mutable_children:
                self.results[cid][month_idx] *= factor
                self._distribute_top_down(cid, month_idx, self.results[cid][month_idx])

        else: # SUM and NONE
            current_sum = sum(self.results[cid][month_idx] for cid in child_ids)
            diff = target_value - current_sum
            
            if abs(diff) < 1e-9:
                return

            current_mutable_sum = sum(self.results[cid][month_idx] for cid in mutable_children)
            
            if abs(current_mutable_sum) > 1e-9:
                for cid in mutable_children:
                    proportion = self.results[cid][month_idx] / current_mutable_sum
                    self.results[cid][month_idx] += (diff * proportion)
                    self._distribute_top_down(cid, month_idx, self.results[cid][month_idx])
            else:
                even_diff = diff / len(mutable_children)
                for cid in mutable_children:
                    self.results[cid][month_idx] += even_diff
                    self._distribute_top_down(cid, month_idx, self.results[cid][month_idx])

    def _eval_formula(self, formula: str, month_idx: int, depth: int = 0) -> float:
        # Prevent runaway recursion
        if depth > 20:
            return 0.0

        expr = formula[1:] if formula.startswith('=') else formula
        
        # Sort by length descending to avoid partial matches (e.g. "Revenue" matching in "Revenue Growth")
        items = sorted(self.kpis.items(), key=lambda x: len(x[1]['label']), reverse=True)
        
        # Dependency Discovery & Trigger Calculation
        for kid, kpi in items:
            escaped_label = re.escape(kpi['label'])
            escaped_id = re.escape(kid)
            
            # Check if this KPI is referenced in the expression
            pattern = rf"\b({escaped_label}|{escaped_id})\b"
            if re.search(pattern, expr, flags=re.IGNORECASE):
                # If it's not computed yet, compute it now (recursive dependency)
                if kid not in self.computed_nodes:
                    self._compute_node(kid, month_idx, depth + 1)
                
                val = self.results[kid][month_idx]
                expr = re.sub(pattern, str(val), expr, flags=re.IGNORECASE)
            
        try:
            # We add a small subset of math functions
            safe_dict = {"__builtins__": None, "pd": pd, "np": np, "sum": sum, "abs": abs, "pow": pow}
            return float(eval(expr, safe_dict))
        except Exception as e:
            # Log error but return 0 to avoid crashing the whole calculation
            print(f"Error evaluating formula {formula} (month {month_idx}): {e}")
            return 0.0

    def _compute_node(self, id: str, specific_month: Optional[int] = None, depth: int = 0):
        if depth > 50 or id in self.computing_nodes:
            return
            
        if specific_month is None and id in self.computed_nodes:
            return
            
        kpi = self.kpis.get(id)
        if not kpi:
            return

        months_to_compute = [specific_month] if specific_month is not None else range(self.period_count)
        
        self.computing_nodes.add(id)
        
        # 1. Pre-compute children if they are present (bottom-up approach)
        if 'children' in kpi and kpi['children']:
            for cid in kpi['children']:
                self._compute_node(cid, specific_month, depth + 1)
            
        pre_override_values = self.results[id].copy()
        
        for m in months_to_compute:
            if m is None: continue
            
            is_directly_modified = False
            overrides = kpi.get('monthlyOverrides', [])
            override = overrides[m] if m < len(overrides) else None
            
            if override is not None and override != "":
                if isinstance(override, str) and override.startswith('='):
                    self.results[id][m] = self._eval_formula(override, m, depth)
                else:
                    try:
                        self.results[id][m] = float(override)
                    except (ValueError, TypeError):
                        pass
                self.monthly_overrides_set.add(f"{id}-{m}")
                is_directly_modified = True
            elif kpi.get('formula') == 'CUSTOM' and kpi.get('customFormula'):
                self.results[id][m] = self._eval_formula(kpi['customFormula'], m, depth)
                is_directly_modified = True
            elif kpi.get('children'):
                child_ids = kpi['children']
                child_vals = [self.results[cid][m] for cid in child_ids if cid in self.results]
                
                agg_type = kpi.get('formula', 'SUM')
                if agg_type == 'PRODUCT':
                    self.results[id][m] = np.prod(child_vals) if child_vals else 0
                elif agg_type == 'AVERAGE':
                    self.results[id][m] = sum(child_vals) / len(child_vals) if child_vals else 0
                else: # Default to SUM for 'NONE' or empty strings
                    self.results[id][m] = sum(child_vals)
            
            # Simulation Slider Adjustments
            sim_val = kpi.get('simulationValue', 0)
            if sim_val != 0:
                if kpi.get('simulationType') == 'PERCENT':
                    self.results[id][m] *= (1 + sim_val / 100)
                else:
                    # Distribute the absolute variance evenly across all periods
                    self.results[id][m] += (sim_val / self.period_count)
                is_directly_modified = True
                
            if abs(self.results[id][m] - pre_override_values[m]) > 1e-9:
                self.impacted_kpis.add(id)
                if is_directly_modified:
                    self._distribute_top_down(id, m, self.results[id][m])

        # Full Year Override - Distribute override over non-overridden months
        if specific_month is None:
            fy_override = kpi.get('fullYearOverride')
            if fy_override is not None:
                curr_total = np.sum(self.results[id][:self.period_count])
                if abs(curr_total - fy_override) > 0.01:
                    self.impacted_kpis.add(id)
                    mutable_months = [m for m in range(self.period_count) if f"{id}-{m}" not in self.monthly_overrides_set]
                    if mutable_months:
                        curr_mutable_sum = sum(self.results[id][m] for m in mutable_months)
                        fixed_sum = curr_total - curr_mutable_sum
                        needed_mutable_sum = fy_override - fixed_sum
                        
                        if abs(curr_mutable_sum) < 1e-8:
                            diff = needed_mutable_sum / len(mutable_months)
                            for m in mutable_months:
                                self.results[id][m] += diff
                                self._distribute_top_down(id, m, self.results[id][m])
                        else:
                            ratio = needed_mutable_sum / curr_mutable_sum
                            for m in mutable_months:
                                self.results[id][m] *= ratio
                                self._distribute_top_down(id, m, self.results[id][m])
            
            self.computed_nodes.add(id)

        self.computing_nodes.remove(id)
