import { useEffect, useRef } from 'react';
import { apiService } from '../services/api';
import type { AppState } from '../types';

interface UseAutoSaveProps {
  projectId: string;
  isSampleMode: boolean;
  isLoadingData: boolean;
  appState: AppState;
}

export const useAutoSave = ({ projectId, isSampleMode, isLoadingData, appState }: UseAutoSaveProps) => {
  const lastSavedStateRef = useRef<string>('');
  const pendingSaveRef = useRef<any>(null);
  const appStateRef = useRef(appState);

  // Keep appStateRef in sync for the unmount cleanup
  useEffect(() => {
    appStateRef.current = appState;
  }, [appState]);

  // Auto-save appState to backend whenever it changes meaningfully
  useEffect(() => {
    if (!projectId || isSampleMode || isLoadingData) return;

    // Skip if change is not meaningful
    const stateStr = JSON.stringify(appState);
    if (stateStr === lastSavedStateRef.current) return;

    // Debounce logic: clear any pending timer
    if (pendingSaveRef.current) clearTimeout(pendingSaveRef.current);

    pendingSaveRef.current = setTimeout(async () => {
      try {
        // Final check before sending to avoid race condition with fast typing
        if (stateStr !== lastSavedStateRef.current) {
          await apiService.saveProjectState(projectId, appState);
          lastSavedStateRef.current = stateStr;
          console.info("Project state auto-saved.");
        }
        pendingSaveRef.current = null;
      } catch (err) {
        console.error("Auto-save failed:", err);
      }
    }, 1000);

    return () => {
      // In a normal custom hook, we might clear timeout on every change,
      // but the original logic specifically noted NOT clearing it here 
      // to ensure it fires eventually if renders are frequent.
    };
  }, [appState, projectId, isSampleMode, isLoadingData]);

  // Ensure save on unmount/back
  useEffect(() => {
    return () => {
      if (pendingSaveRef.current) {
        clearTimeout(pendingSaveRef.current);
        const stateToSave = appStateRef.current;
        const stateStr = JSON.stringify(stateToSave);
        if (stateStr !== lastSavedStateRef.current) {
          apiService.saveProjectState(projectId, stateToSave).catch(e => console.error("Final save failed", e));
          lastSavedStateRef.current = stateStr;
        }
      }
    };
  }, [projectId]);
};
