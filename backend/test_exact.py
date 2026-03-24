import json
from logic.calc import KPICalculator

kpis = {
    "Parent 1": {
        "id": "Parent 1",
        "formula": "SUM",
        "children": ["a", "b"],
        "isLocked": False,
        "isDirectlyModified": True,
        "monthlyOverrides": [300] * 12
    },
    "a": {
        "id": "a",
        "formula": "SUM",
        "children": [],
        "isLocked": True,
        "isDirectlyModified": False,
        "monthlyOverrides": [100] * 12,
        "data": [{"month": i%12, "year": 2024, "actual": 100} for i in range(12)]
    },
    "b": {
        "id": "b",
        "formula": "SUM",
        "children": [],
        "isLocked": False,
        "isDirectlyModified": False,
        "data": [{"month": i%12, "year": 2024, "actual": 100} for i in range(12)]
    }
}

date_range = {"startMonth": 0, "startYear": 2024, "endMonth": 11, "endYear": 2024}
calc = KPICalculator(kpis, date_range)
res, impacted = calc.calculate()

print("A values (Locked):", res['a'][:3])
print("B values (Unlocked):", res['b'][:3])
print("Parent values:", res['Parent 1'][:3])
