import React from 'react';
import Header from './Header';
import type { DateRange } from '../types';

interface MainLayoutProps {
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
    onExpandAll?: () => void;
    onCollapseAll?: () => void;
}

const MainLayout: React.FC<MainLayoutProps> = ({ 
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
        <div className="layout-container">
            {!isPresentationMode && (
                <Header 
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
                    onExpandAll={onExpandAll}
                    onCollapseAll={onCollapseAll}
                />
            )}
            <main className="main-content">
                {children}
            </main>
        </div>
    );
};

export default MainLayout;
