'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { UserRole } from '@/app/page';

export interface Council {
  id: string;
  name: string;
  description?: string;
}

export const COUNCILS: Council[] = [
  { id: 'colombo', name: 'Colombo' },
  { id: 'dehiwala-mt-lavinia', name: 'Dehiwala-Mt. Lavinia' },
  { id: 'kaduwela', name: 'Kaduwela' },
  { id: 'moratuwa', name: 'Moratuwa' },
  { id: 'sri-jayewardenepura-kotte', name: 'Sri Jayewardenepura Kotte' },
];

export type CouncilFilterId = 'all' | string;

const STORAGE_KEY = 'globalCouncilFilter';

interface CouncilContextValue {
  councils: Council[];
  isSuperadmin: boolean;
  lockedCouncil: Council | null;
  selectedCouncilId: CouncilFilterId;
  activeCouncil: Council | null;
  displayLabel: string;
  setSelectedCouncilId: (id: CouncilFilterId) => void;
}

const CouncilContext = createContext<CouncilContextValue | null>(null);

interface CouncilProviderProps {
  children: ReactNode;
  userRole: UserRole;
  lockedCouncil: Council | null;
}

export function CouncilProvider({
  children,
  userRole,
  lockedCouncil,
}: CouncilProviderProps) {
  const isSuperadmin = userRole === 'superadmin';
  const [selectedCouncilId, setSelectedCouncilIdState] =
    useState<CouncilFilterId>('all');

  useEffect(() => {
    if (!isSuperadmin) return;
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (
        stored &&
        (stored === 'all' || COUNCILS.some((c) => c.id === stored))
      ) {
        setSelectedCouncilIdState(stored);
      }
    } catch {
      // ignore invalid sessionStorage
    }
  }, [isSuperadmin]);

  const setSelectedCouncilId = (id: CouncilFilterId) => {
    setSelectedCouncilIdState(id);
    if (isSuperadmin) {
      sessionStorage.setItem(STORAGE_KEY, id);
    }
  };

  const activeCouncil = useMemo(() => {
    if (!isSuperadmin) return lockedCouncil;
    if (selectedCouncilId === 'all') return null;
    return COUNCILS.find((c) => c.id === selectedCouncilId) ?? null;
  }, [isSuperadmin, lockedCouncil, selectedCouncilId]);

  const displayLabel = useMemo(() => {
    if (!isSuperadmin) return lockedCouncil?.name ?? 'Council';
    return activeCouncil?.name ?? 'All Councils';
  }, [isSuperadmin, lockedCouncil, activeCouncil]);

  const value: CouncilContextValue = {
    councils: COUNCILS,
    isSuperadmin,
    lockedCouncil,
    selectedCouncilId: isSuperadmin
      ? selectedCouncilId
      : (lockedCouncil?.id ?? 'all'),
    activeCouncil,
    displayLabel,
    setSelectedCouncilId,
  };

  return (
    <CouncilContext.Provider value={value}>{children}</CouncilContext.Provider>
  );
}

export function useCouncil(): CouncilContextValue {
  const ctx = useContext(CouncilContext);
  if (!ctx) {
    throw new Error('useCouncil must be used within CouncilProvider');
  }
  return ctx;
}

/** Global council filter bar — superadmin dropdown; council-admin read-only chip. */
export function CouncilTopBar() {
  const {
    isSuperadmin,
    displayLabel,
    selectedCouncilId,
    setSelectedCouncilId,
    councils,
  } = useCouncil();

  if (!isSuperadmin) {
    return (
      <div className="p-4 bg-gray-100 border-b text-sm flex items-center justify-between gap-4">
        <span className="text-gray-600">Showing data for council</span>
        <span className="px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs font-semibold">
          {displayLabel}
        </span>
      </div>
    );
  }

  return (
    <div className="p-4 bg-gray-100 border-b text-sm flex items-center justify-between gap-4">
      <div className="text-gray-700 font-semibold">{displayLabel}</div>
      <div className="flex items-center gap-2">
        <label className="text-gray-600" htmlFor="global-council-filter">
          Council
        </label>
        <select
          id="global-council-filter"
          className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-700"
          value={selectedCouncilId}
          onChange={(e) => setSelectedCouncilId(e.target.value)}
        >
          <option value="all">All Councils</option>
          {councils.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
