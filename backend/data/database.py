import os
import struct
import datetime

from sqlalchemy import Column, String, BigInteger, Text, DateTime, create_engine, VARCHAR, event
from sqlalchemy.orm import declarative_base, sessionmaker

# ---------------------------------------------------------------------------
# Microsoft Fabric SQL Warehouse / SQLite dual-mode connection
# ---------------------------------------------------------------------------
# Set FABRIC_SERVER in .env to enable Fabric mode.
# Leave unset to fall back to local SQLite (for dev without Fabric access).
# ---------------------------------------------------------------------------

FABRIC_SERVER   = os.environ.get("FABRIC_SERVER")       # e.g. xxxx.datawarehouse.fabric.microsoft.com
FABRIC_DATABASE = os.environ.get("FABRIC_DATABASE")      # Your warehouse name

_is_fabric = bool(FABRIC_SERVER)

if _is_fabric:
    # ---- Microsoft Fabric SQL Warehouse (Entra ID / Identity) ----
    import pyodbc
    import json
    from azure.identity import DefaultAzureCredential, DeviceCodeCredential

    # Persistent token cache is ONLY for local development. 
    # Cloud environments (Cloud Run) should use Managed Identity / Service Account OIDC.
    TOKEN_CACHE_PATH = os.path.join(os.path.dirname(__file__), "token_cache.json")
    IS_CLOUD = bool(os.environ.get("K_SERVICE") or os.environ.get("PORT"))

    # Use DefaultAzureCredential to automatically pick up identities from Azure CLI, VS Code, or Managed Identity.
    _credential = DefaultAzureCredential(exclude_interactive_browser_credential=False)

    def _get_fabric_connection():
        """Create a pyodbc connection to Fabric using Entra ID token auth."""
        token_str = None
        
        # 1. Try to load from file-based cache (LOCAL ONLY)
        if not IS_CLOUD and os.path.exists(TOKEN_CACHE_PATH):
            try:
                with open(TOKEN_CACHE_PATH, "r") as f:
                    cache = json.load(f)
                    expires_on = cache.get("expires_on", 0)
                    # Check if token is still valid (with 5 min buffer)
                    if expires_on > (datetime.datetime.now().timestamp() + 300):
                        token_str = cache.get("token")
                        print("[AUTH] Reusing cached token from file.")
            except Exception as e:
                print(f"[AUTH] Failed to read token cache: {e}")

        # 2. If no valid cached token, get a new one
        if not token_str:
            try:
                # Try Default (CLI, VSCode, Managed Identity)
                token = _credential.get_token("https://database.windows.net/.default")
                token_str = token.token
                # Cache it locally for developer speed
                if not IS_CLOUD:
                    try:
                        with open(TOKEN_CACHE_PATH, "w") as f:
                            json.dump({"token": token.token, "expires_on": token.expires_on}, f)
                    except Exception as e:
                        print(f"[AUTH] Failed to write token cache: {e}")
                print("[AUTH] Successfully obtained new token.")
            except Exception as e:
                print(f"[AUTH] Default credential failed, trying fallback device code: {e}")
                # Fallback to DeviceCode if local CLI/VSCode login isn't available
                try:
                    fallback = DeviceCodeCredential()
                    token = fallback.get_token("https://database.windows.net/.default")
                    token_str = token.token
                    # Cache it
                    with open(TOKEN_CACHE_PATH, "w") as f:
                        json.dump({"token": token.token, "expires_on": token.expires_on}, f)
                except Exception as ef:
                    print(f"[AUTH] All authentication methods failed: {ef}")
                    raise
            
        token_bytes = token_str.encode("UTF-16-LE")
        token_struct = struct.pack(f"<I{len(token_bytes)}s", len(token_bytes), token_bytes)

        # Detect which ODBC driver is installed
        available_drivers = pyodbc.drivers()
        driver = None
        for d in ["ODBC Driver 18 for SQL Server", "ODBC Driver 17 for SQL Server", "SQL Server"]:
            if d in available_drivers:
                driver = d
                break
        if not driver:
            raise RuntimeError(
                f"No compatible ODBC driver found. "
                f"Install 'ODBC Driver 18 for SQL Server'. "
                f"Available drivers: {available_drivers}"
            )

        conn_str = (
            f"DRIVER={{{driver}}};"
            f"SERVER={FABRIC_SERVER};"
            f"DATABASE={FABRIC_DATABASE};"
            "Encrypt=yes;"
            "TrustServerCertificate=no;"
            "Connection Timeout=30;"
        )

        # SQL_COPT_SS_ACCESS_TOKEN = 1256
        return pyodbc.connect(conn_str, attrs_before={1256: token_struct}, autocommit=True)

    engine = create_engine(
        "mssql+pyodbc://",
        creator=_get_fabric_connection,
        pool_pre_ping=True,
        pool_recycle=1800,   # Refresh connections every 30 min (token expiry safety)
    )

    print(f"[DB] Connected to Microsoft Fabric: {FABRIC_SERVER} / {FABRIC_DATABASE}")

else:
    # ---- Local SQLite fallback ----
    if os.environ.get("K_SERVICE") or os.environ.get("PORT"):
        DATABASE_URL = "sqlite:////tmp/forecasting.db"
    else:
        DATABASE_URL = "sqlite:///./forecasting.db"

    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
    print(f"[DB] Using local SQLite: {DATABASE_URL}")


SessionLocal = sessionmaker(
    autocommit=False, 
    autoflush=True,      # Ensure changes are flushed before queries
    expire_on_commit=False, # Maintain object state after commit for large JSON handling
    bind=engine
)
Base = declarative_base()


# ---------------------------------------------------------------------------
# ORM Models — compatible with both SQLite and Microsoft Fabric
# ---------------------------------------------------------------------------
# Fabric notes:
#   - VARCHAR(MAX) instead of TEXT/NVARCHAR (Fabric doesn't support NVARCHAR)
#   - IDENTITY columns must be BIGINT in Fabric
#   - Primary key / foreign key constraints are NOT ENFORCED in Fabric
# ---------------------------------------------------------------------------

class Project(Base):
    __tablename__ = "projects"

    id            = Column(String(255), primary_key=True, index=True)
    name          = Column(String(500))
    lastAccessed  = Column(DateTime, default=datetime.datetime.utcnow)
    createdAt     = Column(DateTime, default=datetime.datetime.utcnow)
    state_json    = Column(Text, nullable=True)  # Full AppState JSON blob


class RawImport(Base):
    __tablename__ = "raw_imports"

    id           = Column(BigInteger, primary_key=True, autoincrement=True)
    project_id   = Column(String(255))  # Logical FK to projects.id (not enforced in Fabric)
    filename     = Column(String(500))
    content_json = Column(Text)  # Raw rows as JSON
    uploadedAt   = Column(DateTime, default=datetime.datetime.utcnow)


# ---------------------------------------------------------------------------
# Session handling
# ---------------------------------------------------------------------------

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create tables if they don't exist.
    
    For Fabric: Uses autocommit mode (set via the connection creator).
    For SQLite: Standard create_all.
    """
    if _is_fabric:
        # Fabric requires autocommit for DDL statements.
        # The creator function already sets autocommit=True on each connection.
        try:
            Base.metadata.create_all(bind=engine)
            print("[DB] Fabric tables verified/created successfully.")
        except Exception as e:
            print(f"[DB] Warning: Could not auto-create tables in Fabric: {e}")
            print("[DB] If tables don't exist, create them manually in Fabric portal.")
            print("[DB] DDL for reference:")
            print("""
                CREATE TABLE projects (
                    id           VARCHAR(255) NOT NULL,
                    name         VARCHAR(500),
                    lastAccessed DATETIME2,
                    createdAt    DATETIME2,
                    state_json   VARCHAR(MAX)
                );

                CREATE TABLE raw_imports (
                    id           BIGINT IDENTITY NOT NULL,
                    project_id   VARCHAR(255),
                    filename     VARCHAR(500),
                    content_json VARCHAR(MAX),
                    uploadedAt   DATETIME2
                );
            """)
    else:
        Base.metadata.create_all(bind=engine)
        print("[DB] SQLite tables verified/created.")
