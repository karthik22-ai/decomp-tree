import os
import sys

sys.path.append(os.path.abspath('backend'))
from logic.importer import parse_date_to_absolute_month

dates = ["Jan 26", "Feb 26", "Jan 27", "Dec 30", "Jan-2030", "2027-01-01"]
for d in dates:
    abs_m = parse_date_to_absolute_month(d)
    y = abs_m // 12 if abs_m else None
    m = abs_m % 12 if abs_m else None
    print(f"{d} -> abs={abs_m}, y={y}, m={m}")
