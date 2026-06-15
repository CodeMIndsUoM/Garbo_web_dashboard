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

/** Backend APIs expect the display name (e.g. "Colombo"), not the slug id ("colombo"). */
export function getCouncilApiName(council?: { id?: string; name?: string } | null): string | undefined {
  const name = council?.name?.trim();
  return name || undefined;
}

export function useCouncil(): CouncilContextValue {
  const ctx = useContext(CouncilContext);
  if (!ctx) {
    throw new Error('useCouncil must be used within CouncilProvider');
  }
  return ctx;
}
