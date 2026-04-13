import * as React from 'react';
import Header from './Header';
import type { DateRange } from '../types';

interface MainLayoutProps {
    currentView?: string;
    onViewChange?: (view: string) => void;
    children: React.ReactNode;
    onReset: () => void;
    onForecast: () => void;
    dateRange: DateRange;
    onDateRangeChange: (range: DateRange) => void;
    onUploadData: (file: File) => void;
    onBack?: () => void;
    isSyncEnabled?: boolean;
    onSyncToggle?: () => void;
    valueDisplayType: 'absolute' | 'variance';
    onValueDisplayTypeChange: (type: 'absolute' | 'variance') => void;
    availableYears: number[];
    isCalculating?: boolean;
    onEnterPresentation?: () => void;
    showCharts?: boolean;
    onToggleCharts?: () => void;
    isPresentationMode?: boolean;
    dateRangeMode?: 'MTD' | 'YTD';
    onDateRangeModeChange?: (mode: 'MTD' | 'YTD') => void;
    onCollapseAll?: () => void;
    onExpandAll?: () => void;
}

const MainLayout: React.FC<MainLayoutProps> = ({
    currentView = "/", onViewChange, 
    children, onReset, onForecast, dateRange, onDateRangeChange, 
    onUploadData, onBack, isSyncEnabled, onSyncToggle, valueDisplayType, 
    onValueDisplayTypeChange, availableYears, isCalculating = false,
    onEnterPresentation,
    isPresentationMode = false,
    showCharts,
    onToggleCharts,
    dateRangeMode,
    onDateRangeModeChange,
    onExpandAll,
    onCollapseAll
}) => {
    return (
        <div className="app-container" style={{ width: '100%', height: '100%' }}>
            <div className="layout-container" style={{ width: '100%', height: '100%', flex: 1 }}>
                {!isPresentationMode && (
                <Header 
                    currentView={currentView}
                    onViewChange={onViewChange}
                    onReset={onReset} 
                    onForecast={onForecast} 
                    dateRange={dateRange} 
                    onDateRangeChange={onDateRangeChange}
                    onUploadData={onUploadData}
                    onBack={onBack}
                    isSyncEnabled={isSyncEnabled}
                    onSyncToggle={onSyncToggle}
                    valueDisplayType={valueDisplayType}
                    onValueDisplayTypeChange={onValueDisplayTypeChange}
                    availableYears={availableYears}
                    isCalculating={isCalculating}
                    onEnterPresentation={onEnterPresentation}
                    showCharts={showCharts}
                    onToggleCharts={onToggleCharts}
                    dateRangeMode={dateRangeMode}
                    onDateRangeModeChange={onDateRangeModeChange}
                    onCollapseAll={onCollapseAll}
                    onExpandAll={onExpandAll}
                />
            )}
            <main className="main-content" style={{ width: '100%', height: '100%', flex: 1 }}>
                {children}
            </main>
            </div>
        </div>
    );
};

export default MainLayout;
