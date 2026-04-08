from logic.calc import KPICalculator
import numpy as np

def test_row_lock_issue():
    # Setup: 12 months, all 100.
    kpis = {
        "kpi1": {
            "id": "kpi1",
            "label": "Test KPI",
            "isLocked": True, # Row Lock
            "data": [{"month": m, "year": 2024, "actual": 100} for m in range(12)],
            "children": [],
            "fullYearOverride": 1300 # User tried to override even though locked
        }
    }
    date_range = {"startMonth": 0, "startYear": 2024, "endMonth": 11, "endYear": 2024}

    print("--- Row Lock Test: isLocked: True, FY Override: 1300 ---")
    calc = KPICalculator(kpis, date_range)
    res, _ = calc.calculate()
    
    total_val = res["kpi1"][12]
    all_months = res["kpi1"][:12]
    
    print(f"Total: {total_val}")
    print(f"Months: {all_months}")
    
    # Expected: months stay 100, Total stays 1200 because row is locked.
    # Current BUG: it will adjust months to reach 1300.
    if abs(total_val - 1200) < 1e-9:
        print("PASS: Row lock respected.")
    else:
        print(f"FAIL: Row lock IGNORED. Total changed to {total_val}")
        return False
    return True

if __name__ == "__main__":
    if test_row_lock_issue():
        print("\nTest Finished.")
    else:
        print("\nTest Finished (with errors).")
