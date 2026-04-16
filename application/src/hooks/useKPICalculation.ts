import { useState, useEffect, useRef } from 'react';
import { apiService } from '../services/api';
import type { AppState } from '../types';

interface UseKPICalculationProps {
  appState: AppState;
  isLoadingData: boolean;
}

export const useKPICalculation = ({ appState, isLoadingData }: UseKPICalculationProps) => {
  const [isCalculating, setIsCalculating] = useState(false);
  const [calculatedValues, setCalculatedValues] = useState<Record<string, number[]>>({});
  const [baseValues, setBaseValues] = useState<Record<string, number[]>>({});
  const [calculatedScenarioValues, setCalculatedScenarioValues] = useState<Record<string, Record<string, number[]>>>({});
  
  // Reference to track calculation versions and prevent race conditions
  const calculationVersionRef = useRef(0);

  useEffect(() => {
    if (isLoadingData) return;
    
    const currentVersion = ++calculationVersionRef.current;
    let isMounted = true;

    const calculate = async () => {
      setIsCalculating(true);
      try {
        const currentBaselineId = appState.baselineScenarioId || 'base';
        const scenarioIdsToCalculate = Array.from(new Set([
          appState.activeScenarioId, 
          currentBaselineId, 
          ...(appState.spreadsheetSelectedScenarios || [])
        ]));

        const promises = scenarioIdsToCalculate.map(async (scenId) => {
          const sceneKpis = appState.scenarios?.[scenId]?.kpis || {};
          const res = await apiService.calculate(sceneKpis, appState.dateRange);
          return { id: scenId, results: res?.results || {}, rawResponse: res };
        });

        const results = await Promise.all(promises);

        // Only apply if this is still the latest calculation and component is mounted
        if (!isMounted || currentVersion !== calculationVersionRef.current) return;

        const newScenarioValues: Record<string, Record<string, number[]>> = {};
        
        const activeResults = results.find(r => r.id === appState.activeScenarioId);
        if (activeResults) {
          setCalculatedValues(activeResults.results || {});
        }

        const baseResults = results.find(r => r.id === (appState.baselineScenarioId || 'base'));
        if (baseResults) {
          setBaseValues(baseResults.results || {});
        }

        results.forEach(({ id, results }) => {
          newScenarioValues[id] = results || {};
        });

        setCalculatedScenarioValues(newScenarioValues);

      } catch (err) {
        console.error('Calculation error:', err);
      } finally {
        if (isMounted && currentVersion === calculationVersionRef.current) {
          setIsCalculating(false);
        }
      }
    };

    const timer = setTimeout(calculate, 300);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [
    appState.dateRange, 
    appState.activeScenarioId, 
    appState.baselineScenarioId, 
    appState.spreadsheetSelectedScenarios, 
    appState.scenarios, 
    isLoadingData
  ]);

  return {
    calculatedValues,
    baseValues,
    calculatedScenarioValues,
    isCalculating,
    setIsCalculating,
    setCalculatedValues,
    setBaseValues,
    setCalculatedScenarioValues
  };
};
