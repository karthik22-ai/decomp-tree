import os
import struct
import pyodbc
from azure.identity import DeviceCodeCredential
import sys

server = 'cla6t7u7c7runk4y7dkymawpde-2mqotq4cz5eefmgypbfuvnz2tu.datawarehouse.fabric.microsoft.com'
database = 'warehouse_test'

def callback(uri, code, expires):
    print("\n" + "="*60, flush=True)
    print("🔑 AZURE AUTHENTICATION REQUIRED", flush=True)
    print(f"URL:  {uri}", flush=True)
    print(f"CODE: {code}", flush=True)
    print("="*60 + "\n", flush=True)

print("[DB] Requesting fresh Device Code for Fabric Warehouse...", flush=True)
credential = DeviceCodeCredential(prompt_callback=callback)

# This blocks until authentication is successful
token_obj = credential.get_token("https://database.windows.net/.default")

print("✅ Authentication Successful!", flush=True)
print(f"Token acquired. You can now start the main backend.", flush=True)
