import React from 'react';
import { X, TrendingUp } from 'lucide-react';
import type { ForecastMethod } from '../types';

interface ForecastModalProps {
    isOpen: boolean;
    onClose: () => void;
    forecastConfig: { method: ForecastMethod; growthRate: number };
    setForecastConfig: React.Dispatch<React.SetStateAction<{ method: ForecastMethod; growthRate: number }>>;
    onForecast: () => void;
}

const ForecastModal: React.FC<ForecastModalProps> = ({
    isOpen,
    onClose,
    forecastConfig,
    setForecastConfig,
    onForecast
}) => {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header">
                    <h2>Generate Scenario Forecast</h2>
                    <button className="close-btn" onClick={onClose}><X size={20} /></button>
                </div>
                <div className="modal-body">
                    <p className="text-slate-600 text-sm mb-4">Select an algorithmic method to project the next 12 months for this scenario based on historical actuals.</p>
                    <div className="form-group">
                        <label>Forecasting Method</label>
                        <select
                            value={forecastConfig.method}
                            onChange={e => setForecastConfig(prev => ({ ...prev, method: e.target.value as ForecastMethod }))}
                        >
                            <option value="LINEAR_TREND">Linear Trend (Regression)</option>
                            <option value="MOVING_AVERAGE">Moving Average (3-Period)</option>
                            <option value="FLAT_GROWTH">Compound Growth (%)</option>
                            <option value="SEASONAL_NAIVE">Seasonal Naive</option>
                        </select>
                    </div>
                    {forecastConfig.method === 'FLAT_GROWTH' && (
                        <div className="form-group">
                            <label>Annual Growth Rate (%)</label>
                            <input
                                type="number"
                                value={forecastConfig.growthRate}
                                onChange={e => setForecastConfig(prev => ({ ...prev, growthRate: Number(e.target.value) }))}
                            />
                        </div>
                    )}
                </div>
                <div className="modal-footer">
                    <button className="ghost-btn" onClick={onClose}>Cancel</button>
                    <button className="primary-btn flex-center gap-2" onClick={onForecast}>
                        <TrendingUp size={16} /> Execute Forecast
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ForecastModal;
