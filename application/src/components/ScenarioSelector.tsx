import React, { useState, useRef, useEffect } from 'react';
import { 
    Search, Edit2, Trash2, Check, Lock, X, Plus, ChevronRight, Sliders, TrendingUp
} from 'lucide-react';
import type { Scenario } from '../types';

interface ScenarioSelectorProps {
    scenarios: Record<string, Scenario>;
    selectedIds: string[];
    onSelect: (id: string) => void;
    onToggle?: (id: string) => void;
    onRename?: (id: string, newName: string) => void;
    onDelete?: (id: string) => void;
    onAdd?: (name: string) => void;
    onMakeBase?: (id: string) => void;
    showActions?: boolean;
    onToggleLock?: (id: string) => void;
    mode?: 'single' | 'multiple';
    label?: string;
    placeholder?: string;
    className?: string;
}

const ScenarioSelector: React.FC<ScenarioSelectorProps> = ({
    scenarios,
    selectedIds,
    onSelect,
    onToggle,
    onRename,
    onDelete,
    onAdd,
    onMakeBase,
    mode = 'single',
    label,
    placeholder = "Select scenario...",
    className = "",
    showActions = true,
    onToggleLock
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [newName, setNewName] = useState('');
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renamingValue, setRenamingValue] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredScenarios = Object.values(scenarios).filter(s => 
        s.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSelect = (id: string) => {
        if (mode === 'single') {
            onSelect(id);
            setIsOpen(false);
        } else if (onToggle) {
            onToggle(id);
        } else {
            onSelect(id);
        }
    };

    const handleRename = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setRenamingId(id);
        setRenamingValue(scenarios[id].name);
    };

    const submitRename = (id: string) => {
        if (renamingValue.trim() && onRename) {
            onRename(id, renamingValue.trim());
        }
        setRenamingId(null);
    };

    const handleDelete = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (onDelete) onDelete(id);
    };

    const handleAdd = () => {
        if (newName.trim() && onAdd) {
            onAdd(newName.trim());
            setNewName('');
            setIsAdding(false);
        }
    };

    const selectedCount = selectedIds.length;
    const activeScenario = scenarios[selectedIds[0]];
    
    const displayText = mode === 'single' 
        ? (activeScenario?.name || placeholder)
        : selectedCount === 0 
            ? "None selected"
            : selectedCount === 1
                ? activeScenario?.name
                : `${selectedCount} Scenarios`;

    return (
        <div className={className} style={{ position: 'relative' }} ref={dropdownRef}>
            {label && (
                <label style={{ 
                    display: 'block', fontSize: '10px', fontWeight: 'bold', 
                    color: '#64748b', textTransform: 'uppercase', 
                    letterSpacing: '0.05em', marginBottom: '4px', padding: '0 4px' 
                }}>
                    {label}
                </label>
            )}
            
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', padding: '6px 12px', backgroundColor: 'white',
                    border: isOpen ? '1px solid #3b82f6' : '1px solid #e2e8f0',
                    borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s',
                    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)', outline: 'none'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                    <Sliders size={14} color={isOpen ? '#3b82f6' : '#94a3b8'} />
                    <span style={{ 
                        fontSize: '12px', fontWeight: 600, color: '#334155', 
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' 
                    }}>
                        {displayText}
                    </span>
                </div>
                <ChevronRight size={14} color="#94a3b8" style={{ 
                    transition: 'transform 0.2s', transform: isOpen ? 'rotate(90deg)' : 'none' 
                }} />
            </button>

            {isOpen && (
                <div style={{
                    position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
                    backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '12px',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', zIndex: 1000,
                    overflow: 'hidden', minWidth: '240px'
                }}>
                    <div style={{ padding: '10px', borderBottom: '1px solid #f1f5f9', backgroundColor: '#f8fafc' }}>
                        <div style={{ position: 'relative' }}>
                            <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                            <input
                                autoFocus
                                type="text"
                                placeholder="Search or create..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{
                                    width: '100%', padding: '6px 10px 6px 32px', borderRadius: '8px',
                                    border: '1px solid #e2e8f0', fontSize: '12px', outline: 'none',
                                }}
                            />
                        </div>
                    </div>

                    <div style={{ maxHeight: '250px', overflowY: 'auto', padding: '4px 0' }}>
                        {filteredScenarios.length === 0 ? (
                            <div style={{ padding: '32px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                                No scenarios found
                            </div>
                        ) : (
                            filteredScenarios.map(s => {
                                const isSelected = selectedIds.includes(s.id);
                                const isBaseline = s.id === 'base';
                                
                                return (
                                    <div
                                        key={s.id}
                                        onClick={() => handleSelect(s.id)}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '12px',
                                            padding: '10px 16px', cursor: 'pointer', transition: 'background 0.2s',
                                            backgroundColor: isSelected ? '#eff6ff' : 'transparent'
                                        }}
                                        onMouseEnter={e => !isSelected && (e.currentTarget.style.backgroundColor = '#f8fafc')}
                                        onMouseLeave={e => !isSelected && (e.currentTarget.style.backgroundColor = 'transparent')}
                                    >
                                        <div style={{ 
                                            width: '18px', height: '18px', borderRadius: mode === 'single' ? '50%' : '4px',
                                            border: isSelected ? 'none' : '2px solid #cbd5e1',
                                            backgroundColor: isSelected ? '#2563eb' : 'white',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            flexShrink: 0, transition: 'all 0.2s'
                                        }}>
                                            {isSelected && (
                                                <Check size={12} color="white" strokeWidth={3} />
                                            )}
                                        </div>

                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            {renamingId === s.id ? (
                                                <input
                                                    autoFocus
                                                    value={renamingValue}
                                                    onClick={e => e.stopPropagation()}
                                                    onChange={e => setRenamingValue(e.target.value)}
                                                    onBlur={() => submitRename(s.id)}
                                                    onKeyDown={e => e.key === 'Enter' && submitRename(s.id)}
                                                    style={{ 
                                                        width: '100%', padding: '0 2px', border: 'none', 
                                                        borderBottom: '2px solid #2563eb', outline: 'none', 
                                                        fontSize: '13px', background: 'transparent', fontWeight: 600
                                                    }}
                                                />
                                            ) : (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{ 
                                                        fontSize: '13px', fontWeight: isSelected ? 600 : 500,
                                                        color: isSelected ? '#1e40af' : '#334155',
                                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                                                    }}>
                                                        {s.name}
                                                    </span>
                                                    {s.isPromoted && (
                                                        <span style={{ 
                                                            fontSize: '9px', background: '#fff7ed', color: '#c2410c',
                                                            padding: '1px 4px', borderRadius: '4px', border: '1px solid #ffedd5',
                                                            fontWeight: 600
                                                        }}>
                                                            Original
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {showActions && !isBaseline && renamingId !== s.id && (
                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                {onToggleLock && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); onToggleLock(s.id); }}
                                                        title={s.isLocked ? "Unlock Scenario" : "Lock Scenario"}
                                                        style={{ 
                                                            border: 'none', background: 'none', padding: '4px', cursor: 'pointer', 
                                                            color: s.isLocked ? '#e11d48' : '#64748b' 
                                                        }}
                                                    >
                                                        {s.isLocked ? <Lock size={12} /> : <Lock size={12} style={{ opacity: 0.3 }} />}
                                                    </button>
                                                )}
                                                {!s.isPromoted && (
                                                    <>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); onMakeBase && onMakeBase(s.id); }}
                                                            title="Set as Baseline"
                                                            style={{ border: 'none', background: 'none', padding: '4px', cursor: 'pointer', color: '#3b82f6' }}
                                                        >
                                                            <TrendingUp size={12} />
                                                        </button>
                                                        <button
                                                            onClick={(e) => handleRename(s.id, e)}
                                                            style={{ border: 'none', background: 'none', padding: '4px', cursor: 'pointer', color: '#64748b' }}
                                                        >
                                                            <Edit2 size={12} />
                                                        </button>
                                                        <button
                                                            onClick={(e) => handleDelete(s.id, e)}
                                                            style={{ border: 'none', background: 'none', padding: '4px', cursor: 'pointer', color: '#ef4444' }}
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {onAdd && (
                        <div style={{ padding: '8px', borderTop: '1px solid #f1f5f9', backgroundColor: '#f8fafc' }}>
                            {isAdding ? (
                                <div style={{ display: 'flex', gap: '6px' }}>
                                    <input
                                        autoFocus
                                        value={newName}
                                        onChange={e => setNewName(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleAdd()}
                                        placeholder="Name..."
                                        style={{
                                            flex: 1, padding: '4px 8px', borderRadius: '6px',
                                            border: '1px solid #e2e8f0', fontSize: '12px', outline: 'none'
                                        }}
                                    />
                                    <button onClick={handleAdd} style={{ padding: '4px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                                        <Check size={14} />
                                    </button>
                                    <button onClick={() => setIsAdding(false)} style={{ padding: '4px', background: '#e2e8f0', color: '#64748b', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                                        <X size={14} />
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setIsAdding(true)}
                                    style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                        gap: '6px', width: '100%', padding: '6px', border: '1px dashed #cbd5e1',
                                        borderRadius: '8px', background: 'white', color: '#64748b',
                                        fontSize: '12px', fontWeight: 600, cursor: 'pointer'
                                    }}
                                >
                                    <Plus size={14} /> New Scenario
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ScenarioSelector;
