
import sys
import os
# Add backend to path to import logic
sys.path.append(os.path.abspath('d:/D TREE/direacted graph/backend'))

from logic.calc import KPICalculator
import numpy as np

def test_overall_override():
    kpis = {
        'root': {
            'id': 'root',
            'label': 'Total Revenue',
            'data': [
                {'month': i, 'year': 2024, 'actual': 100} for i in range(12)
            ],
            'children': ['child1', 'child2'],
            'formula': 'SUM'
        },
        'child1': {
            'id': 'child1',
            'label': 'Product A',
            'data': [
                {'month': i, 'year': 2024, 'actual': 50} for i in range(12)
            ],
            'parentId': 'root',
            'children': []
        },
        'child2': {
            'id': 'child2',
            'label': 'Product B',
            'data': [
                {'month': i, 'year': 2024, 'actual': 50} for i in range(12)
            ],
            'parentId': 'root',
            'children': []
        }
    }

    date_range = {
        'startMonth': 0, 'startYear': 2024,
        'endMonth': 11, 'endYear': 2024
    }

    # Initial calculation (should be 1200)
    calc = KPICalculator(kpis, date_range)
    res, _ = calc.calculate()
    print(f"Initial Total: {res['root'][-1]}")
    assert abs(res['root'][-1] - 1200) < 1e-9

    # Add overall override: 1800 (ratio 1.5)
    kpis['root']['overallOverride'] = {'2024': 1800}
    calc2 = KPICalculator(kpis, date_range)
    res2, _ = calc2.calculate()
    print(f"Override Total (Current): {res2['root'][-1]}")
    
    # Due to the broken logic, it probably won't be 1800
    if abs(res2['root'][-1] - 1800) < 1e-9:
        print("Wait, it matches? Let's check child totals.")
    else:
        print(f"Mismatch! Expected 1800, got {res2['root'][-1]}")

    print(f"Child1 Total: {res2['child1'][-1]}") # Should be 900
    print(f"Child2 Total: {res2['child2'][-1]}") # Should be 900

if __name__ == "__main__":
    test_overall_override()
