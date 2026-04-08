import React, { useRef } from 'react';
import { Upload, Database, FolderDown } from 'lucide-react';
import type { KPIData } from '../types';
import { apiService } from '../services/api';


interface WelcomeScreenProps {
    onImportData: (kpis: Record<string, KPIData>) => void;
    onLoadSample: () => void;
    monthsCount?: number;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onImportData, onLoadSample, monthsCount = 12 }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Note: isCalculating state is managed in SimulationCanvas, but we can call onImportData with empty when starting
        // Actually, WelcomeScreen doesn't have isCalculating prop. 
        // We'll rely on the parent's handleCustomDataImport to set it, but for immediate feedback:
        try {
            const response = await apiService.importFile(file, monthsCount);
            if (response.kpis && Object.keys(response.kpis).length > 0) {
                onImportData(response.kpis);
            }
        } catch (err) {
            console.error(err);
            alert('Failed to parse file.');
        }

        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            height: '100%', width: '100%', background: '#f8fafc', padding: 40, textAlign: 'center'
        }}>
            <Database size={64} style={{ color: '#94a3b8', marginBottom: 20 }} />
            <h1 style={{ fontSize: 28, color: '#1e293b', marginBottom: 12 }}>Welcome to the Value Driver Model</h1>
            <p style={{ color: '#64748b', maxWidth: 600, fontSize: 16, marginBottom: 40 }}>
                Start by uploading your financial or operational data (Excel or CSV). You can map your data into a directed graph for rapid scenario simulation and business planning.
            </p>

            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
                <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '16px 32px',
                        background: '#3b82f6', color: 'white', borderRadius: 8, fontSize: 16, border: 'none',
                        cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
                    }}
                >
                    <Upload size={20} />
                    Upload Data File
                </button>
                <input
                    type="file"
                    accept=".csv, .xlsx, .xls"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    onChange={handleFileUpload}
                />

                <button
                    onClick={onLoadSample}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '16px 32px',
                        background: 'white', color: '#475569', borderRadius: 8, fontSize: 16,
                        border: '1px solid #cbd5e1', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                    }}
                >
                    <FolderDown size={20} />
                    Load Sample Data
                </button>
            </div>
        </div>
    );
};
