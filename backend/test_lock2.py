from logic.calc import KPICalculator
import json

kpis = {
    "root": {
        "id": "root",
        "label": "Root",
        "formula": "SUM",
        "children": ["parent1", "parent2"],
        "data": []
    },
    "parent1": {
        "id": "parent1",
        "label": "Parent 1",
        "formula": "SUM",
        "children": ["childA", "childB"],
        "data": []
    },
    "parent2": {
        "id": "parent2",
        "label": "Parent 2",
        "formula": "SUM",
        "children": ["childC"],
        "data": []
    },
    "childA": {
        "id": "childA",
        "label": "Child A (Locked)",
        "isLocked": True,
        "data": [{"month": m, "year": 2024, "actual": 100} for m in range(12)]
    },
    "childB": {
        "id": "childB",
        "label": "Child B (Unlocked)",
        "isLocked": False,
        "data": [{"month": m, "year": 2024, "actual": 200} for m in range(12)]
    },
    "childC": {
        "id": "childC",
        "label": "Child C",
        "isLocked": False,
        "data": [{"month": m, "year": 2024, "actual": 300} for m in range(12)]
    }
}

# 1. Base calculate
calc = KPICalculator(kpis, {"startMonth": 0, "startYear": 2024, "endMonth": 11, "endYear": 2024, "monthsCount": 12})
res, _ = calc.calculate()
print("BASE:")
print(f"Parent 1: {res['parent1'][0]} (sum of {res['childA'][0]} and {res['childB'][0]})")

# 2. Modify Parent 1 with monthly override
kpis["parent1"]["monthlyOverrides"] = [600] + [None]*11

calc = KPICalculator(kpis, {"startMonth": 0, "startYear": 2024, "endMonth": 11, "endYear": 2024, "monthsCount": 12})
res, _ = calc.calculate()
print("\nAFTER OVERRIDE PARENT1=600:")
print(f"Parent 1: {res['parent1'][0]} (sum of {res['childA'][0]} and {res['childB'][0]})")

# 3. What if both are locked?
kpis["childB"]["isLocked"] = True
calc = KPICalculator(kpis, {"startMonth": 0, "startYear": 2024, "endMonth": 11, "endYear": 2024, "monthsCount": 12})
res, _ = calc.calculate()
print("\nAFTER OVERRIDE PARENT1=600 (BOTH LOCKED):")
print(f"Parent 1: {res['parent1'][0]} (sum of {res['childA'][0]} and {res['childB'][0]})")

