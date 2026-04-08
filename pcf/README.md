# Power Apps Component Framework (PCF) Integration

This directory contains the integration layer for surfacing the Forecasting Dashboard within the Microsoft Power Platform ecosystem.

## Projects

- **`forecasting-pcf`**: The core custom control source code (React-based).
- **`forecasting-solution`**: The Dataverse solution project that bundles the component for import into Power Apps environments.

## Deployment Flow (PAC CLI)

### 1. Build & Test Locally
Navigate to the PCF project:
```powershell
cd pcf/forecasting-pcf
npm install
npm run build
# Test in the local test harness
npm start
```

### 2. Push to Environment
To quickly see changes in a development environment:
1.  **Auth**: `pac auth create --url https://your org.crm.dynamics.com`
2.  **Push**: `pac pcf push --publisher-prefix dev`

### 3. Solution Packaging (Production)
For formal deployment:
1.  Navigate to the solution folder: `cd pcf/forecasting-solution`
2.  Add the PCF component: `pac solution add-reference --path ..\forecasting-pcf`
3.  Build the solution: `dotnet build`
4.  **Output**: The resulting solution zip file is located in `bin\Debug` or `bin\Release`. Import this into your Power Platform environment under **Solutions**.

## Best Practices
- **Publisher Prefix**: Ensure the publisher prefix in your `pcfproj` matches your Power Platform publisher to avoiding naming conflicts.
- **Resource Management**: Large assets should be served via CDN if they exceed Dataverse file size limits.
