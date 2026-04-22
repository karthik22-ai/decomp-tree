# Single-Application Architecture (Full React Migration)

This document explains how the platform will function if the Python backend is completely removed and the entire logic is consolidated into a single **Power Apps PCF Component**.

---

## 1. The "Everything in One" Concept
By removing the Python backend, all logic (calculations, data parsing, and state management) is moved into the **React/TypeScript** source code of the PCF component.

*   **No API Server:** The component does not call an external Azure URL.
*   **Local Calculation:** All forecasting math (Top-Down, Bottom-Up, Graph Traversal) happens in the user's browser/Power Apps runtime.
*   **Native Context:** The app understands the environment it is running in (Environment ID, User ID, etc.).

## 2. Dynamic Dataverse Integration (The New Workflow)
Instead of a static CSV import, the application becomes "Data-Aware."

### A. Connecting to Dataverse
The PCF component uses the native **Power Apps Web API**. 
*   **Automatic Auth:** No client IDs or secrets needed. It uses the user's active Power Apps session.
*   **Table Discovery:** The app presents a searchable list of Dataverse tables (e.g., `cr_financial_actuals`, `opportunity`).
*   **Field Selection:** You select a table, and the app retrieves all available fields.

### B. Drag & Drop Hierarchy Builder (No more L1/L2)
We are replacing the manual mapping screen with an intuitive **Mapping Canvas**:
1.  **Source Fields:** On the left, you see all the columns from your Dataverse table.
2.  **Hierarchy Bin:** You drag field names into this bin in the order you want the tree to grow (e.g., Drag `Business Unit` first, then `Region`, then `Site`).
3.  **Automatic DAG Generation:** As you drag fields, the React code instantly groups the data and renders the Directed Graph.
4.  **Measure Mapping:** You drag the `Amount` or `Revenue` field into the "Value" slot.

## 3. Storage: Fabric SQL Vault

*   **Technology:** **Custom Connector** or **Power Automate Flow**.
*   **Workflow:**
    1.  The UI state is stringified as JSON.
    2.  The PCF component calls a Power Platform "Custom Connector".
    3.  The Connector uses its internal connection to reach **Microsoft Fabric SQL Warehouse**.
    4.  Fabric stores the data as rows in the `projects` table.

---

## 3. How the "Calculation Engine" Migrates
The complex logic from `calc.py` and `importer.py` will be converted to a TypeScript library:

1.  **Logic Object:** A class called `KPICalculator.ts` will replace the Python `KPICalculator` class.
2.  **Math Handling:** Instead of `numpy`, we will use specialized JS libraries like `mathjs` or pure recursive functions to handle the KPI tree updates.
3.  **Performance:** For graphs up to 1,000 nodes, the calculation will feel nearly instantaneous because it happens locally on your computer without a network round-trip.

---

## 4. Hosting & Deployment Workflow

### Where is it hosted?
*   **Strictly Power Platform:** The code lives inside your Power Apps environment as a **Custom Control**.

### How do you host/deploy it?
1.  **Build:** Run `npm run build` to generate a single `bundle.js` file.
2.  **Package:** The `bundle.js` and the manifest are zipped into a **Solution File** (`ForecastingSolution.zip`).
3.  **Import:** You go to your Power Apps environment -> Solutions -> **Import**.
4.  **Use:** Drag the "Forecasting Visual" into any Canvas App or Model-Driven App.

---

## 5. Summary of the "Single Application" Experience

| Feature | How it works |
| :--- | :--- |
| **Login** | Automatic (Uses your Power Apps login). |
| **Updates** | Re-import the Solution file to update all users. |
| **Latency** | Extremely low (No backend communication delay). |
| **Dependency** | 100% dependent on Power Platform (no Azure required). |

> [!TIP]
> This scenario is preferred if you want a **maintenance-free** setup where you don't want to manage Azure App Services or Container Registries. However, it requires a "one-time" heavy lift to rewrite the Python math logic into TypeScript.
