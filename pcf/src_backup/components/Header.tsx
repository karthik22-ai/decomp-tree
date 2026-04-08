import React, { useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { Calendar, RefreshCcw, TrendingUp, Upload, ArrowLeft } from 'lucide-react';
import type { DateRange } from '../types';

interface HeaderProps {
    onReset: () => void;
    onForecast: () => void;
    dateRange: DateRange;
    onDateRangeChange: (range: DateRange) => void;
    onUploadData: (file: File) => void;
    onBack?: () => void;
    isSyncEnabled?: boolean;
    onSyncToggle?: () => void;
    showCharts?: boolean;
    onToggleCharts?: () => void;
    valueDisplayType: 'absolute' | 'variance';
    onValueDisplayTypeChange: (type: 'absolute' | 'variance') => void;
    availableYears: number[];
    isCalculating?: boolean;
    onEnterPresentation?: () => void;
    dateRangeMode?: 'MTD' | 'YTD';
    onDateRangeModeChange?: (mode: 'MTD' | 'YTD') => void;
    onExpandAll?: () => void;
    onCollapseAll?: () => void;
}

const Header: React.FC<HeaderProps> = ({ 
    onReset, onForecast, dateRange, onDateRangeChange, onUploadData, 
    onBack, isSyncEnabled, onSyncToggle, showCharts, onToggleCharts, valueDisplayType, 
    onValueDisplayTypeChange, availableYears, isCalculating = false,
    onEnterPresentation,
    dateRangeMode = 'YTD',
    onDateRangeModeChange,
    onExpandAll,
    onCollapseAll
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            onUploadData(e.target.files[0]);
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };
    return (
        <header className="app-header">
            <div className="header-left">
                {onBack && (
                    <button
                        onClick={onBack}
                        style={{
                            background: 'none', border: 'none', color: 'white', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 8px',
                            marginRight: 12
                        }}
                        title="Back to Projects"
                    >
                        <ArrowLeft size={20} />
                    </button>
                )}
                <div className="logo-section" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', paddingRight: '20px', borderRight: '1px solid #334155' }}>
                    <span className="logo-text" style={{ 
                        fontSize: '1.4rem', 
                        fontFamily: '"Playfair Display", "Georgia", serif', // Calligraphic/Professional Serif
                        fontWeight: 600, 
                        letterSpacing: '0.01em',
                        color: '#f8fafc',
                        fontStyle: 'italic',
                        lineHeight: '1.1'
                    }}>Strategic<br/>Forecast</span>
                </div>
            </div>

            <div className="header-center" style={{ flex: 1, display: 'flex', justifyContent: 'center', paddingLeft: '20px' }}>
                <nav className="header-nav" style={{ marginRight: '16px' }}>
                    <NavLink to="/" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                        Tree<br/>View
                    </NavLink>
                    <NavLink to="/tabular" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                        Tabular<br/>View
                    </NavLink>
                    <NavLink to="/raw-data" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                        Raw Data<br/>Viewer
                    </NavLink>
                    <NavLink to="/compare" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                        Compare<br/>View
                    </NavLink>
                    <NavLink to="/logs" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                        Activity<br/>Log
                    </NavLink>
                </nav>
                <div className="date-picker-wrapper" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', width: '280px' }}>
                    {onDateRangeModeChange && (
                        <div style={{ display: 'flex', gap: '4px', background: 'white', padding: '2px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                            <button
                                onClick={() => onDateRangeModeChange('MTD')}
                                style={{
                                    padding: '2px 8px', fontSize: '11px', borderRadius: '3px', border: 'none', cursor: 'pointer',
                                    background: dateRangeMode === 'MTD' ? '#0D1846' : 'transparent',
                                    color: dateRangeMode === 'MTD' ? 'white' : '#64748b',
                                    fontWeight: dateRangeMode === 'MTD' ? 600 : 400
                                }}
                            >
                                MTD
                            </button>
                            <button
                                onClick={() => onDateRangeModeChange('YTD')}
                                style={{
                                    padding: '2px 8px', fontSize: '11px', borderRadius: '3px', border: 'none', cursor: 'pointer',
                                    background: dateRangeMode === 'YTD' ? '#0D1846' : 'transparent',
                                    color: dateRangeMode === 'YTD' ? 'white' : '#64748b',
                                    fontWeight: dateRangeMode === 'YTD' ? 600 : 400
                                }}
                            >
                                YTD
                            </button>
                        </div>
                    )}
                    <div className="date-picker-bar" style={{ background: 'white', border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', borderRadius: '6px', padding: '4px 8px' }}>
                        <Calendar size={14} className="calendar-icon" style={{ opacity: 0.8, color: '#475569' }} />
                        <select
                            className="date-select"
                            value={dateRange.startMonth}
                            onChange={(e) => {
                                const newStartMonth = parseInt(e.target.value);
                                onDateRangeChange({
                                    ...dateRange, 
                                    startMonth: newStartMonth,
                                    ...(dateRangeMode === 'MTD' ? { endMonth: newStartMonth } : {})
                                });
                            }}
                            style={{ marginLeft: '6px', background: 'transparent', color: '#1e293b', border: 'none', outline: 'none', cursor: 'pointer', fontWeight: 500 }}
                        >
                            {months.map((m, i) => <option key={i} value={i} style={{ color: 'black' }}>{m}</option>)}
                        </select>
                        <select
                            className="date-select"
                            value={dateRange.startYear}
                            onChange={(e) => {
                                const newStartYear = parseInt(e.target.value);
                                onDateRangeChange({ 
                                    ...dateRange, 
                                    startYear: newStartYear,
                                    ...(dateRangeMode === 'MTD' ? { endYear: newStartYear } : {})
                                });
                            }}
                            style={{ width: '60px', background: 'transparent', color: '#1e293b', border: 'none', outline: 'none', cursor: 'pointer', fontWeight: 500 }}
                        >
                            {availableYears.map(y => <option key={y} value={y} style={{ color: 'black' }}>{y}</option>)}
                        </select>

                        {dateRangeMode === 'YTD' && (
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <span style={{ margin: '0 8px', color: '#94a3b8', fontWeight: 900 }}>—</span>
                                <select
                                    className="date-select"
                                    value={dateRange.endMonth}
                                    onChange={(e) => onDateRangeChange({ ...dateRange, endMonth: parseInt(e.target.value) })}
                                    style={{ background: 'transparent', color: '#1e293b', border: 'none', outline: 'none', cursor: 'pointer', fontWeight: 500 }}
                                >
                                    {months.map((m, i) => <option key={i} value={i} style={{ color: 'black' }}>{m}</option>)}
                                </select>
                                <select
                                    className="date-select"
                                    value={dateRange.endYear}
                                    onChange={(e) => onDateRangeChange({ ...dateRange, endYear: parseInt(e.target.value) })}
                                    style={{ width: '60px', background: 'transparent', color: '#1e293b', border: 'none', outline: 'none', cursor: 'pointer', fontWeight: 500 }}
                                >
                                    {availableYears.map(y => <option key={y} value={y} style={{ color: 'black' }}>{y}</option>)}
                                </select>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingRight: '16px' }}>
                
                {/* Inline Loading Spinner */}
                <div style={{ width: '24px', display: 'flex', justifyContent: 'center' }}>
                    {isCalculating && (
                        <RefreshCcw size={18} className="spin-slow" style={{ color: '#8b5cf6' }} />
                    )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {onSyncToggle && (
                        <button 
                            className={`header-btn secondary sync-btn ${isSyncEnabled ? 'active' : ''}`} 
                            onClick={onSyncToggle}
                            title={isSyncEnabled ? "Sync is ON" : "Sync is OFF"}
                            style={{ padding: '2px 8px', fontSize: '11px', height: '24px' }}
                        >
                            <RefreshCcw size={12} className={isSyncEnabled ? 'spin-slow' : ''} />
                            <span>{isSyncEnabled ? 'SYNC' : 'SYNC OFF'}</span>
                        </button>
                    )}

                    {onToggleCharts && (
                        <button 
                            className={`header-btn secondary sync-btn ${showCharts ? 'active' : ''}`} 
                            onClick={onToggleCharts}
                            title={showCharts ? "Hide Node Charts" : "Show Node Charts"}
                            style={{ padding: '2px 8px', fontSize: '11px', height: '24px' }}
                        >
                            <TrendingUp size={12} />
                            <span>{showCharts ? 'CHARTS ON' : 'CHARTS OFF'}</span>
                        </button>
                    )}

                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {onExpandAll && (
                        <button 
                            className="header-btn secondary" 
                            onClick={onExpandAll}
                            title="Expand All Nodes/Rows"
                            style={{ padding: '2px 8px', fontSize: '11px', height: '24px' }}
                        >
                            <TrendingUp size={12} />
                            <span>EXPAND ALL</span>
                        </button>
                    )}
                    {onCollapseAll && (
                        <button 
                            className="header-btn secondary" 
                            onClick={onCollapseAll}
                            title="Collapse All Nodes/Rows"
                            style={{ padding: '2px 8px', fontSize: '11px', height: '24px' }}
                        >
                            <TrendingUp size={12} />
                            <span>COLLAPSE ALL</span>
                        </button>
                    )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div className="value-type-selector">
                        <select 
                            className="header-select"
                            value={valueDisplayType}
                            onChange={(e) => onValueDisplayTypeChange(e.target.value as 'absolute' | 'variance')}
                            style={{ padding: '2px 24px 2px 8px', fontSize: '11px', height: '24px', minHeight: '24px' }}
                        >
                            <option value="absolute">Absolute Value</option>
                            <option value="variance">Variance Value</option>
                        </select>
                    </div>
                    <button className="header-btn secondary" onClick={() => fileInputRef.current?.click()} title="Upload Data Model (JSON/Excel)" style={{ padding: '2px 8px', fontSize: '11px', height: '24px' }}>
                        <Upload size={12} /> <span>Upload Data</span>
                    </button>
                </div>
                <input
                    type="file"
                    accept=".json,.csv,.xlsx,.xls"
                    style={{ display: 'none' }}
                    ref={fileInputRef}
                    onChange={handleFileChange}
                />
                <div className="header-actions-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: 'transparent', padding: 0, border: 'none' }}>
                    <div style={{ display: 'flex', gap: '4px' }}>
                        {onEnterPresentation && (
                            <button className="header-btn" style={{ backgroundColor: '#3b82f6', color: 'white', border: 'none', padding: '2px 8px', fontSize: '11px', height: '24px', flex: 1 }} onClick={onEnterPresentation} title="Enter Presentation Mode">
                                <TrendingUp size={12} /> <span>Present</span>
                            </button>
                        )}
                        <button className="header-btn forecast-btn" style={{ padding: '2px 8px', fontSize: '11px', height: '24px', flex: 1 }} onClick={onForecast} title="Generate Forecast">
                            <TrendingUp size={12} /> <span>Forecast</span>
                        </button>
                    </div>
                    <button className="header-btn reset-btn" style={{ padding: '2px 8px', fontSize: '11px', height: '24px', width: '100%' }} onClick={onReset} title="Reset Simulation">
                        <RefreshCcw size={12} /> <span>Reset</span>
                    </button>
                </div>
                <div className="user-profile">
                    <div className="avatar" style={{ border: '1px solid #1e293b', background: '#1e293b', color: '#94a3b8' }}>JD</div>
                </div>
            </div>
        </header>
    );
};

export default Header;
