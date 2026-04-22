import { useCallback } from 'react';
import type { AppState, KPIData } from '../types';

interface UseScenariosProps {
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  kpis: Record<string, KPIData>;
}

export const useScenarios = ({ appState, setAppState, kpis }: UseScenariosProps) => {
  const onScenarioAdd = useCallback((name: string, snapshot?: Record<string, KPIData>) => {
    const id = `scenario-${Date.now()}`;
    setAppState(prev => ({
      ...prev,
      scenarios: {
        ...prev.scenarios,
        [id]: { 
          id, 
          name, 
          kpis: snapshot ? JSON.parse(JSON.stringify(snapshot)) : JSON.parse(JSON.stringify(kpis)), 
          createdAt: new Date().toISOString() 
        }
      },
      activeScenarioId: id
    }));
  }, [kpis, setAppState]);

  const onScenarioDelete = useCallback((id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (id === 'base') {
      alert("Cannot delete the Base Scenario.");
      return;
    }
    if (!confirm("Are you sure you want to delete this scenario?")) return;

    setAppState(prev => {
      const newScenarios = { ...prev.scenarios };
      delete newScenarios[id];

      const remainingIds = Object.keys(newScenarios);
      
      const nextActiveId = prev.activeScenarioId === id
        ? (() => {
            // Prefer Actuals if available
            if (remainingIds.includes('actual') && id !== 'actual') return 'actual';
            // Otherwise first available promoted scenario
            const promoted = remainingIds.find(rid => rid !== id && newScenarios[rid].isPromoted);
            if (promoted) return promoted;
            // Otherwise first available non-base
            const nonBase = remainingIds.find(rid => rid !== id && rid !== 'base');
            if (nonBase) return nonBase;
            // Fallback to base
            return 'base';
          })()
        : prev.activeScenarioId;
      const nextBaselineId = prev.baselineScenarioId === id
        ? (remainingIds.includes('base') ? 'base' : remainingIds[0])
        : prev.baselineScenarioId;

      const nextSpreadsheetSelected = prev.spreadsheetSelectedScenarios
        ? prev.spreadsheetSelectedScenarios.filter((sid: string) => sid !== id)
        : undefined;

      return {
        ...prev,
        scenarios: newScenarios,
        activeScenarioId: nextActiveId,
        baselineScenarioId: nextBaselineId,
        spreadsheetSelectedScenarios: nextSpreadsheetSelected && nextSpreadsheetSelected.length > 0
          ? nextSpreadsheetSelected
          : [nextActiveId]
      };
    });
  }, [setAppState]);

  const onScenarioSelect = useCallback((id: string) => {
    setAppState(prev => ({ ...prev, activeScenarioId: id }));
  }, [setAppState]);

  const handleMakeBaseScenario = useCallback((targetId?: string) => {
    const scenarioId = targetId || appState.activeScenarioId;
    if (scenarioId === 'base') return;

    const sourceScenario = appState.scenarios[scenarioId];
    if (!sourceScenario) return;

    const updatedBaseKpis = JSON.parse(JSON.stringify(sourceScenario.kpis));

    setAppState(prev => {
      return {
        ...prev,
        scenarios: {
          ...prev.scenarios,
          ['base']: {
            ...prev.scenarios['base'],
            kpis: updatedBaseKpis,
            updatedAt: new Date().toISOString(),
            lastPromotedFrom: scenarioId
          }
        },
        activeScenarioId: 'base',
        baselineScenarioId: 'base'
      };
    });
    
    alert(`Successfully promoted data from "${sourceScenario.name}" to the Base scenario.`);
  }, [appState.activeScenarioId, appState.scenarios, setAppState]);

  const onRenameScenario = useCallback((id: string, name: string) => {
    setAppState(prev => {
      const next = { ...prev };
      if (next.scenarios[id]) {
        next.scenarios[id] = { ...next.scenarios[id], name };
      }
      return next;
    });
  }, [setAppState]);

  const onToggleLock = useCallback((id: string) => {
    setAppState(prev => {
      const next = { ...prev };
      if (next.scenarios[id]) {
        next.scenarios[id] = { ...next.scenarios[id], isLocked: !next.scenarios[id].isLocked };
      }
      return next;
    });
  }, [setAppState]);

  return {
    onScenarioAdd,
    onScenarioDelete,
    onScenarioSelect,
    handleMakeBaseScenario,
    onRenameScenario,
    onToggleLock
  };
};
