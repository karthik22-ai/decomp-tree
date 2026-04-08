import React from 'react';
import { Activity, Clock, ArrowRight, Zap, Lock, Unlock, RotateCcw, Edit3, FileText } from 'lucide-react';
import type { LogEntry } from '../types';

interface LogViewProps {
    logs: LogEntry[];
    kpiNames?: Record<string, string>; // id → label mapping
}

const getActionColor = (action: string) => {
    if (action.includes('Lock')) return { bg: '#fef3c7', text: '#92400e', icon: action.includes('Unlock') ? Unlock : Lock };
    if (action.includes('Override')) return { bg: '#dbeafe', text: '#1e40af', icon: Edit3 };
    if (action.includes('Reset')) return { bg: '#fce7f3', text: '#9d174d', icon: RotateCcw };
    if (action.includes('Scenario')) return { bg: '#e0e7ff', text: '#3730a3', icon: FileText };
    return { bg: '#f0fdf4', text: '#166534', icon: Zap };
};

const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now.getTime() - then.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);

    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    return then.toLocaleDateString();
};

const formatValue = (val: string | number | undefined) => {
    if (val === undefined || val === null) return '—';
    if (typeof val === 'number') return val.toLocaleString(undefined, { maximumFractionDigits: 1 });
    return String(val);
};

const LogView: React.FC<LogViewProps> = ({ logs, kpiNames }) => {
    return (
        <div className="log-view-container">
            <div className="log-header">
                <Activity size={22} className="log-header-icon" />
                <h2>Activity Log</h2>
                <span className="log-count">{logs.length} events</span>
            </div>

            <div className="log-timeline">
                {logs.length === 0 ? (
                    <div className="log-empty">
                        <Activity size={48} opacity={0.15} />
                        <p>No activity recorded yet.</p>
                        <span>Changes will appear here as you edit values</span>
                    </div>
                ) : (
                    [...logs].reverse().map((log) => {
                        const actionStyle = getActionColor(log.action);
                        const ActionIcon = actionStyle.icon;
                        const hasValueChange = log.oldValue !== undefined || log.newValue !== undefined;

                        return (
                            <div key={log.id} className="log-entry">
                                <div className="log-entry-timeline-dot" style={{ background: actionStyle.bg, borderColor: actionStyle.text }}>
                                    <ActionIcon size={12} color={actionStyle.text} />
                                </div>

                                <div className="log-entry-content">
                                    <div className="log-entry-top">
                                        <span
                                            className="log-action-badge"
                                            style={{ background: actionStyle.bg, color: actionStyle.text }}
                                        >
                                            {log.action}
                                        </span>
                                        <span className="log-time" title={new Date(log.timestamp).toLocaleString()}>
                                            <Clock size={12} />
                                            {formatTimeAgo(log.timestamp)}
                                            <span className="log-time-full">
                                                {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                            </span>
                                        </span>
                                    </div>

                                    <p className="log-details">{log.details}</p>

                                    {hasValueChange && (
                                        <div className="log-value-change">
                                            <span className="log-old-value">{formatValue(log.oldValue)}</span>
                                            <ArrowRight size={14} className="log-arrow" />
                                            <span className="log-new-value">{formatValue(log.newValue)}</span>
                                        </div>
                                    )}

                                    {log.impactedKpis && log.impactedKpis.length > 0 && (
                                        <div className="log-impacted">
                                            <Zap size={12} />
                                            <span className="log-impacted-label">Impacted:</span>
                                            <div className="log-impacted-tags">
                                                {log.impactedKpis.slice(0, 6).map(kpiId => (
                                                    <span key={kpiId} className="log-impacted-tag">
                                                        {kpiNames?.[kpiId] || kpiId}
                                                    </span>
                                                ))}
                                                {log.impactedKpis.length > 6 && (
                                                    <span className="log-impacted-tag log-more">+{log.impactedKpis.length - 6} more</span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default LogView;
