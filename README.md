# Forecasting with Directed Graphs

A comprehensive forecasting and visualization platform that integrates FastAPI, React, and Power Apps Component Framework (PCF) with Microsoft Fabric SQL Warehouse.

## Project Architecture

The project is organized into three main modules:

### 1. [Backend](./backend) (Python / FastAPI)
The core engine for data persistence and KPI distribution logic.
- **Database**: Dual-mode поддержку for **Microsoft Fabric SQL Warehouse** and local **SQLite**.
- **Auth**: Secure authentication via **Entra ID** (formery Azure AD) using passwordless tokens.
- **API**: RESTful endpoints for project management and scenario modeling.
- [Read Backend Documentation](./backend/README.md)

### 2. [Frontend](./frontend) (React / Vite / TypeScript)
Modern dashboard for visualizing forecasting nodes, managing overrides, and performing scenario analysis.
- **Visuals**: Dynamic node-link diagrams and hierarchical spreadsheets.
- **State**: Optimized state management for complex calculation triggers.
- **Hosting**: Pre-configured for **Netlify**.
- [Read Frontend Documentation](./frontend/README.md)

### 3. [PCF](./pcf) (Power Apps Component Framework)
Integration layer for surfacing the forecasting tools directly inside Microsoft Power Platform environments.
- **Integration**: Power Apps and Dynamics 365.
- [Read PCF Documentation](./pcf/README.md)

## Quick Start

### Running the Entire Stack Locally

1.  **Start the Backend**:
    ```powershell
    cd backend
    uvicorn main:app --port 8000
    ```
2.  **Start the Frontend**:
    ```powershell
    cd frontend
    npm install
    npm run dev
    ```
3.  **Access the App**: Open [http://localhost:5173](http://localhost:5173) in your browser.

## Deployment

- **Backend**: Can be deployed to Cloud Run or Azure App Service.
- **Frontend**: Deploy to Netlify (base directory: `frontend`).
- **Database**: Designed for Microsoft Fabric SQL Warehouse.
