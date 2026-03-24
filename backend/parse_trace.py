import json
with open('calculate_payload_trace.json', 'r') as f:
    data = json.load(f)
    print(f"Total KPIs: {len(data['kpis'])}")
    for kid, kpi in data['kpis'].items():
        locked = kpi.get('isLocked', False)
        lmonths = kpi.get('lockedMonths', [])[:3] if kpi.get('lockedMonths') else []
        sim_val = kpi.get('simulationValue', 0)
        mo = kpi.get('monthlyOverrides', [])[:3] if kpi.get('monthlyOverrides') else []
        if locked or any(lmonths) or any(mo) or sim_val != 0:
            print(f"{kpi.get('label', kid)} | L:{locked} | LM:{lmonths} | MO:{mo} | SIM:{sim_val}")
