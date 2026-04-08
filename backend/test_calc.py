import os
import sys

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from logic.calc import KPICalculator

kpis = {
    'parent': {
        'id': 'parent',
        'label': 'Parent',
        'formula': 'SUM',
        'children': ['child1', 'child2'],
        'monthlyOverrides': [None] * 12,
        'data': []
    },
    'child1': {
        'id': 'child1',
        'label': 'Child 1',
        'formula': 'NONE',
        'children': [],
        'monthlyOverrides': [None] * 12,
        'data': [
            {'month': 0, 'year': 2024, 'actual': 100}
        ]
    },
    'child2': {
        'id': 'child2',
        'label': 'Child 2',
        'formula': 'NONE',
        'children': [],
        'monthlyOverrides': [None] * 12,
        'data': [
            {'month': 0, 'year': 2024, 'actual': 200}
        ]
    }
}

date_range = {
    'startMonth': 0,
    'startYear': 2024,
    'endMonth': 11,
    'endYear': 2024
}

print("Base calculation without overrides:")
calc = KPICalculator(kpis, date_range)
results, impacted = calc.calculate()
print("parent M1:", results['parent'][0])
print("child1 M1:", results['child1'][0])
print("child2 M1:", results['child2'][0])

print("\n---")
print("Override parent to 600 (should distribute dynamically to children):")
kpis_override = kpis.copy()
kpis_override['parent']['monthlyOverrides'][0] = 600
calc = KPICalculator(kpis_override, date_range)
results, impacted = calc.calculate()
print("parent M1:", results['parent'][0])
print("child1 M1:", results['child1'][0])
print("child2 M1:", results['child2'][0])

print("\n---")
print("Override child1 to 150 (should aggregate up to parent as 150+200=350):")
kpis_override2 = kpis.copy()
kpis_override2['parent']['monthlyOverrides'][0] = None # Reset parent
kpis_override2['child1']['monthlyOverrides'][0] = 150
calc = KPICalculator(kpis_override2, date_range)
results, impacted = calc.calculate()
print("parent M1:", results['parent'][0])
print("child1 M1:", results['child1'][0])
print("child2 M1:", results['child2'][0])
