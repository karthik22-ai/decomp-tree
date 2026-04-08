from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import datetime

class TimeSeriesValue(BaseModel):
    month: str
    actual: float
    forecast: Optional[float] = None
    simulated: Optional[float] = None

class SemanticAttributes(BaseModel):
    businessOwner: Optional[str] = None
    dataSource: Optional[str] = None
    lastUpdated: Optional[str] = None
    tags: Optional[List[str]] = None

class KPIData(BaseModel):
    id: str
    label: str
    data: List[TimeSeriesValue]
    unit: str
    formula: str
    customFormula: Optional[str] = None
    children: List[str]
    parentId: Optional[str] = None
    isExpanded: bool
    simulationValue: Optional[float] = None
    simulationType: Optional[str] = None
    color: Optional[str] = None
    desiredTrend: Optional[str] = None
    semantic: Optional[SemanticAttributes] = None
    monthlyOverrides: Optional[List[Any]] = None
    overallOverride: Optional[float] = None
    overrideMonthCount: Optional[int] = None
    isLocked: Optional[bool] = None
    lockedMonths: Optional[Any] = None
    pageId: Optional[str] = None

class Scenario(BaseModel):
    id: str
    name: str
    kpis: Dict[str, KPIData]
    createdAt: str

class DateRange(BaseModel):
    startMonth: int
    startYear: int
    endMonth: int
    endYear: int

class AppState(BaseModel):
    scenarios: Dict[str, Scenario]
    activeScenarioId: str
    dateRange: DateRange
    activityLog: List[Any]
    lockMonthIdx: Optional[int] = None
    isSyncEnabled: bool
    valueDisplayType: Optional[str] = 'absolute'
    pages: Optional[List[Any]] = None
    activePageId: Optional[str] = None
    rawImportData: Optional[List[List[Any]]] = None

class ProjectCreate(BaseModel):
    id: str
    name: str

class ProjectInfo(BaseModel):
    id: str
    name: str
    lastAccessed: datetime
    createdAt: datetime

    class Config:
        from_attributes = True
