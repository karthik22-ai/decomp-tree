# Forecasting Frontend

Modern React-based dashboard for Directed Graph Forecasting, built with Vite and TypeScript.

## Key Features

- **Simulation Canvas**: Interactively visualize and modify KPI relationships using React Flow.
- **Hierarchical Spreadsheet**: Tabular data entry with automatic total updates and month-level overrides.
- **Scenario Studio**: Create, clone, and compare multiple financial scenarios (e.g., "Best Case", "Worst Case").
- **Audit Logs & Comments**: Add business context to cell-level changes with persistent comments.
- **Sparklines**: Real-time trend visualization inside the grid using Recharts.

## Project Structure

- `src/components/`: Reusable UI components.
- `src/features/`: Complex modules like the canvas and spreadsheet views.
- `src/services/api.ts`: Centralized API client using Axios.
- `src/store/`: State management (if using Zustand/Redux) or custom hooks.
- `public/`: Static assets and icons.

## Connectivity

The frontend connects to the backend API defined in your environment.

### Local Configuration
Create a `.env` file in the `frontend/` directory:
```bash
VITE_API_URL=http://localhost:8000
```

### Production Configuration
Set `VITE_API_URL` in your Netlify or deployment provider's environment settings.

## Getting Started

### Installation
```powershell
cd frontend
npm install
```

### Run
```powershell
npm run dev
```

### Build
```powershell
npm run build
```
The output will be in the `dist/` directory, optimized for production.
