from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Dict, Any
import json
import uuid
import datetime

from data.database import get_db, Project, RawImport
from models.schemas import ProjectCreate, ProjectInfo, AppState
from logic.importer import parse_file_to_kpis, sanitize_for_json

router = APIRouter(prefix="/projects", tags=["projects"])

@router.post("/", response_model=ProjectInfo)
def create_project(project: ProjectCreate, db: Session = Depends(get_db)):
    db_project = Project(
        id=project.id,
        name=project.name,
        createdAt=datetime.datetime.utcnow(),
        lastAccessed=datetime.datetime.utcnow()
    )
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return db_project

@router.get("/", response_model=List[ProjectInfo])
def list_projects(db: Session = Depends(get_db)):
    return db.query(Project).order_by(Project.lastAccessed.desc()).all()

@router.get("/{project_id}")
def get_project_state(project_id: str, db: Session = Depends(get_db)):
    # SQL Server / Fabric Snapshot Isolation conflicts are common. Retry logic needed.
    max_retries = 3
    retry_count = 0
    while retry_count < max_retries:
        try:
            project = db.query(Project).filter(Project.id == project_id).first()
            if not project:
                raise HTTPException(status_code=404, detail="Project not found")
            
            # Use small interval check for lastAccessed to reduce conflicts
            now = datetime.datetime.utcnow()
            if not project.lastAccessed or (now - project.lastAccessed).total_seconds() > 60:
                project.lastAccessed = now
                db.commit()

            state = None
            if project.state_json:
                state = json.loads(project.state_json)
            
            # Check for raw imports
            raw_import = db.query(RawImport).filter(RawImport.project_id == project_id).order_by(RawImport.uploadedAt.desc()).first()
            raw_data = None
            if raw_import:
                raw_data = json.loads(raw_import.content_json)
            
            return {"state": state, "raw_rows": raw_data}
        except Exception as e:
            db.rollback()
            error_str = str(e).lower()
            if "snapshot isolation transaction aborted" in error_str or "update conflict" in error_str:
                retry_count += 1
                print(f"[DB] Snapshot conflict on GET (retry {retry_count}/{max_retries})")
                if retry_count >= max_retries:
                    raise HTTPException(status_code=500, detail=f"Database conflict retry limit exceeded: {str(e)}")
                import time
                time.sleep(0.05 * (2 ** retry_count)) # Exp backoff
            else:
                print(f"[DB] Error in get_project_state: {e}")
                raise HTTPException(status_code=500, detail=str(e))

@router.post("/{project_id}/state")
def save_project_state(project_id: str, state: Dict[str, Any], db: Session = Depends(get_db)):
    max_retries = 5
    retry_count = 0
    while retry_count < max_retries:
        try:
            # Re-fetch project to ensure current session has latest snapshot
            project = db.query(Project).filter(Project.id == project_id).first()
            if not project:
                # Auto-create if it doesn't exist
                project = Project(
                    id=project_id,
                    name="Restored Project",
                    createdAt=datetime.datetime.utcnow(),
                    lastAccessed=datetime.datetime.utcnow()
                )
                db.add(project)
            
            project.state_json = json.dumps(state)
            project.lastAccessed = datetime.datetime.utcnow()
            db.commit()
            return {"status": "success"}
        except Exception as e:
            db.rollback()
            error_str = str(e).lower()
            # Handle Snapshot conflict (SQL Server / Fabric default)
            if "snapshot isolation transaction aborted" in error_str or "update conflict" in error_str:
                retry_count += 1
                print(f"[DB] Snapshot conflict on SAVE (retry {retry_count}/{max_retries})")
                if retry_count >= max_retries:
                    raise HTTPException(status_code=500, detail=f"Database update failed after {max_retries} retries: {str(e)}")
                import time
                time.sleep(0.1 * (2 ** retry_count)) # Exponential backoff
            else:
                print(f"[DB] Fatal error in save_project_state: {e}")
                raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{project_id}")
def delete_project(project_id: str, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    db.query(RawImport).filter(RawImport.project_id == project_id).delete()
    db.delete(project)
    db.commit()
    return {"status": "success"}

@router.post("/{project_id}/import")
async def import_to_project(
    project_id: str,
    file: UploadFile = File(...),
    monthsCount: int = Form(12),
    db: Session = Depends(get_db)
):
    try:
        content = await file.read()
        result = parse_file_to_kpis(content, file.filename, monthsCount)
        
        # Store the raw rows in Python segment
        raw_rows = result.get("raw_rows", [])
        if raw_rows:
            db_import = RawImport(
                project_id=project_id,
                filename=file.filename,
                content_json=json.dumps(raw_rows)
            )
            db.add(db_import)
            db.commit()
        
        return sanitize_for_json(result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
