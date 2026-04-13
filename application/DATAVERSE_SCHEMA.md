# Dataverse Schema: Directed Graph Forecasting

This document defines the recommended Dataverse table structure to support persistence for the forecasting platform.

## Table 1: Forecasting Project (`crxxx_forecasting_project`)
This is the primary container for a simulation graph.

| Display Name | Logical Name | Data Type | Description |
| :--- | :--- | :--- | :--- |
| **Project Name** | `crxxx_name` | Single Line of Text | User-friendly name of the project. |
| **Project ID** | `crxxx_projectid` | Single Line of Text (Key) | Unique stable identifier (UUID). |
| **Project State** | `crxxx_state` | Multiple Lines of Text | Full JSON string of `AppState`, including scenarios and date ranges. Recommended size: 1,048,576 characters. |
| **Last Accessed** | `crxxx_lastaccessed` | Date and Time | Used for "Recent Projects" sorting. |
| **Created On** | `createdon` | Date and Time (System) | Initial creation date. |
| **Owner** | `ownerid` | Owner (System) | Security boundary for who can see/edit the project. |

---

## Table 2: KPI Taxonomy (`crxxx_kpi_definition`) - *Optional*
Use this if you want to manage your KPI hierarchy as structured records instead of a single JSON blob. This is better for Power BI reporting directly on Dataverse.

| Display Name | Logical Name | Data Type | Description |
| :--- | :--- | :--- | :--- |
| **KPI ID** | `crxxx_kpiid` | Single Line of Text (Key) | Unique ID of the KPI. |
| **Label** | `crxxx_label` | Single Line of Text | Display name (e.g., "Gross Revenue"). |
| **Parent KPI** | `crxxx_parentkpiid` | Lookup (`crxxx_kpi_definition`) | Self-referential lookup to build the hierarchy. |
| **Formula Type** | `crxxx_formulatype` | Choice | SUM, PRODUCT, AVERAGE, CUSTOM, NONE. |
| **Custom Formula** | `crxxx_customformula` | Single Line of Text | The math expression used for calculation. |
| **Desired Trend** | `crxxx_desiredtrend` | Choice | Increase, Decrease. |

---

## Table 3: Time Series Data (`crxxx_kpi_data`) - *Optional*
Used for storing historical/actual values if they are not coming from external sources.

| Display Name | Logical Name | Data Type | Description |
| :--- | :--- | :--- | :--- |
| **KPI** | `crxxx_kpiid` | Lookup (`crxxx_kpi_definition`) | Reference to the KPI. |
| **Date** | `crxxx_date` | Date Only | The month/year of the data point. |
| **Value** | `crxxx_value` | Decimal Number | The numerical value for that period. |
| **Value Type** | `crxxx_valuetype` | Choice | Actual, Forecast, Simulated. |

---

## Implementation Rationale

1. **Blob Storage (Table 1)**: For simplicity and high performance in the React app, storing the entire state as a JSON blob in `crxxx_state` is the most efficient. It ensures that complex relationships (like `monthlyOverrides`) are preserved exactly as they are in the TypeScript types.
2. **Standard PCF Integration**: When running inside a PCF, you should use the Power Platform **Solution** to create these tables. Exporting this schema into a `.zip` solution is recommended.
3. **Managed Identities**: If using the Python backend (Scenario 1), the Azure App Service's Managed Identity must have the **System User** role in Dataverse with at least "User" level access to these tables.
