import json
from logic.calc import KPICalculator

kpis = {
    "parent": {
        "id": "parent",
        "label": "Parent",
        "formula": "SUM",
        "children": ["child1", "child2"],
        "simulationValue": 250,  # Changed from 200 to 250
        "baseValue": 200,
    },
    "child1": {
        "id": "child1",
        "label": "Child 1",
        "formula": "NONE",
        "children": [],
        "baseValue": 100,
        "isLocked": True,
        "lockedMonths": [True] * 12
    },
    "child2": {
        "id": "child2",
        "label": "Child 2",
        "formula": "NONE",
        "children": [],
        "baseValue": 100,
    }
}

calc = KPICalculator(kpis, {"startMonth": 0, "monthsCount": 12, "startYear": 2024})
results, impacted = calc.calculate()

print("Parent:", results["parent"][0])
print("Child 1 (Locked):", results["child1"][0])
print("Child 2 (Unlocked):", results["child2"][0])
