'use client';

// Remembers whether the admin prefers table or card layout across management tabs.
import { useCallback, useEffect, useState } from 'react';

export type AdminViewMode = 'table' | 'card';

const STORAGE_KEY = 'garbo-admin-view-mode';

// Loads and persists the admin's table/card view preference in localStorage.
export function useAdminViewMode(defaultMode: AdminViewMode = 'table') {
  const [viewMode, setViewModeState] = useState<AdminViewMode>(defaultMode);

  // Restore saved preference after the component mounts in the browser.
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'table' || stored === 'card') {
      setViewModeState(stored);
    }
  }, []);

  // Updates view mode and saves it so all tabs stay in sync.
  const setViewMode = useCallback((mode: AdminViewMode) => {
    setViewModeState(mode);
    localStorage.setItem(STORAGE_KEY, mode);
  }, []);

  return { viewMode, setViewMode };
}
