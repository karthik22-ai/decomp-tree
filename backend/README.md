# Forecasting Backend

FastAPI-based backend for the Forecasting with Directed Graphs application. This service handles data persistence, KPI calculations, and integration with Microsoft Fabric SQL Warehouse.

## Project Structure

- `main.py`: Entry point for the FastAPI application.
- `api/`: REST API endpoints:
    - `projects.py`: Management of forecasting projects and states (includes Retry logic for Fabric conflicts).
    - `kpis.py`: Management of KPI metadata.
- `data/`: Data access layer.
    - `database.py`: Core logic for dual-mode connection (SQLite or Microsoft Fabric).
- `models/`: Database schemas and SQLAlchemy ORM models.
- `logic/`: Business logic and computational engines.
    - `calc.py`: The core DAG distribution and recursive calculation engine.
- `forecasting.db`: Local SQLite database used for development when Fabric is not linked.

## Key Technologies

- **FastAPI**: High-performance web framework.
- **SQLAlchemy**: Python SQL toolkit and ORM.
- **PyODBC**: ODBC client for Microsoft Fabric connectivity.
- **Azure Identity**: Passwordless Entra ID authentication.

## Microsoft Fabric Integration

### Configuration Reference
Create a `.env` file in the `backend/` directory with the following variables:

| Variable | Description | Example |
| :--- | :--- | :--- |
| `FABRIC_SERVER` | The SQL connection string for your workspace. | `xyz.datawarehouse.fabric.microsoft.com` |
| `FABRIC_DATABASE` | Your Warehouse name. | `ForecastingWarehouse` |

If `FABRIC_SERVER` is missing, the system defaults to **Local Mode** using SQLite.

### Authentication Detail
The backend uses `DefaultAzureCredential`. 
1.  **Local Development**: Log in via `az login`. The backend will automatically fetch your identity.
2.  **Production (Azure)**: Enable a **Managed Identity** on the hosting resource (App Service/Function) and grant it access to the Fabric Warehouse.

## Execution

### Setup
```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate  # Windows
pip install -r requirements.txt
```

### Run
```powershell
uvicorn main:app --host 0.0.0.0 --port 8000
```
Visit `/docs` for the interactive Swagger UI.
