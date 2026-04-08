import os
import sys
import json

# Add the backend logic to path
sys.path.append(os.path.abspath('backend'))
from logic.importer import promote_by_hierarchy

rows = [
    ["KPI", "Unit", "Jan 26", "Feb 26", "Mar 26"],
    ["Revenue", "$", 100, 200, 300]
]
mappings = {"0": "L1", "1": "Unit"}
res = promote_by_hierarchy(rows, 12, mappings, 0, 2026)

with open("test_out.json", "w") as f:
    json.dump(res.get("dateRange", {}), f)
