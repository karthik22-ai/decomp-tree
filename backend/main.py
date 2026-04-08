# Load environment variables FIRST (before any module reads them)
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List, Any, Optional
import asyncio
import anyio
from contextlib import asynccontextmanager
from data.database import init_db
from api import projects
from logic.calc import KPICalculator
from logic.forecaster import generate_forecast
from logic.importer import sanitize_for_json, parse_file_to_kpis, promote_by_hierarchy

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup:
    # Initialize the database (Table segments) - this happens after server start signal
    print("[DB] Starting non-blocking database initialization...")
    
    # We run this in a thread so it doesn't block the lifespan setup
    # If using Fabric, this will prompt for device login in the terminal
    async def _init():
        # Small delay to ensure logs aren't buried
        await asyncio.sleep(2)
        while True:
            try:
                await anyio.to_thread.run_sync(init_db)
                print("[DB] Initialization successful!")
                break
            except Exception as e:
                print(f"[DB] Initialization failed/timed out. Retrying in 10s... ({e})")
                await asyncio.sleep(10)
            
    # Start the task without waiting for it to finish (so server can start)
    asyncio.create_task(_init())
    
    yield

app = FastAPI(title="Forecasting Backend", lifespan=lifespan)

# Enable CORS for the React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include segments
app.include_router(projects.router)

class CalculationRequest(BaseModel):
    kpis: Dict[str, Any]
    dateRange: Dict[str, int]

class ForecastRequest(BaseModel):
    historicalData: List[float]
    horizon: int = 12
    method: str = "LINEAR"
    growthRate: float = 0.0

class PromotionRequest(BaseModel):
    rows: List[List[Any]]
    mappings: Dict[str, str]
    monthsCount: int = 12
    startMonth: int = 0
    startYear: int = 2024

@app.get("/")
async def root():
    return {"status": "ok", "message": "Forecasting Backend is running"}

@app.post("/calculate")
async def calculate(request: CalculationRequest):
    try:
        calculator = KPICalculator(request.kpis, request.dateRange)
        results, impacted = calculator.calculate()
        return sanitize_for_json({"results": results, "impactedKpis": impacted})
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/import")
async def import_data(file: UploadFile = File(...), monthsCount: int = Form(12)):
    try:
        content = await file.read()
        result = parse_file_to_kpis(content, file.filename, monthsCount)
        return result
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/forecast")
async def forecast(request: ForecastRequest):
    try:
        result = generate_forecast(request.historicalData, request.horizon, request.method, request.growthRate)
        return sanitize_for_json({"forecast": result})
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/promote-sheet")
async def promote_sheet(request: PromotionRequest):
    try:
        # Use the new hierarchy discovery logic
        result = promote_by_hierarchy(request.rows, request.monthsCount, request.mappings, 
                                      request.startMonth, request.startYear)
        return sanitize_for_json(result)
    except Exception as e:
        import traceback
        print(f"Promotion Error: {e}")
        traceback.print_exc()
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
