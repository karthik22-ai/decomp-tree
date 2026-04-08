import os
import struct
import pyodbc
from azure.identity import DeviceCodeCredential

# Configuration from your .env
SERVER = 'cla6t7u7c7runk4y7dkymawpde-2mqotq4cz5eefmgypbfuvnz2tu.datawarehouse.fabric.microsoft.com'
DATABASE = 'warehouse_test'

def verify():
    print("\n" + "="*60)
    print("🔍 MICROSOFT FABRIC DATA VERIFICATION")
    print("="*60)
    
    def callback(uri, code, expires):
        print(f"\n🔑 ACTION REQUIRED")
        print(f"Go to: {uri}")
        print(f"Enter Code: {code}")
        print("Waiting for authentication...\n")

    try:
        credential = DeviceCodeCredential(prompt_callback=callback)
        print("Acquiring token for SQL Warehouse...")
        token_obj = credential.get_token("https://database.windows.net/.default")
        
        token_bytes = token_obj.token.encode("UTF-16-LE")
        token_struct = struct.pack(f"<I{len(token_bytes)}s", len(token_bytes), token_bytes)

        conn_str = (
            f"DRIVER={{ODBC Driver 18 for SQL Server}};"
            f"SERVER={SERVER};"
            f"DATABASE={DATABASE};"
            "Encrypt=yes;"
            "TrustServerCertificate=no;"
            "Connection Timeout=30;"
        )

        print(f"Connecting to {DATABASE}...")
        conn = pyodbc.connect(conn_str, attrs_before={1256: token_struct}, autocommit=True)
        cursor = conn.cursor()

        # 1. Check if tables exist
        cursor.execute("SELECT name FROM sys.tables")
        tables = [row[0] for row in cursor.fetchall()]
        print(f"\n✅ Connection Successful!")
        print(f"Found Tables: {', '.join(tables)}")

        # 2. Check Project Count
        if 'projects' in tables:
            cursor.execute("SELECT COUNT(*) FROM projects")
            count = cursor.fetchone()[0]
            print(f"Current project count in Fabric: {count}")

            if count > 0:
                print("\n--- Recent Projects Stored in Fabric ---")
                cursor.execute("SELECT TOP 5 id, name, lastAccessed FROM projects ORDER BY lastAccessed DESC")
                for row in cursor.fetchall():
                    print(f" • {row[1]} (ID: {row[0]}) | Last Saved: {row[2]}")
            else:
                print("\n⚠️ Table exists but is currently EMPTY.")
        else:
            print("\n❌ Error: 'projects' table not found in the warehouse.")

        conn.close()
        
    except Exception as e:
        print(f"\n❌ Troubleshooting Error: {e}")
    
    print("\n" + "="*60 + "\n")

if __name__ == "__main__":
    verify()
