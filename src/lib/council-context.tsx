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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
      <div className="flex items-center justify-between gap-4 border-b border-gray-200 bg-white px-6 py-3">
        <p className="text-sm text-gray-600">Showing data for council</p>
        <span className="rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700">
          {displayLabel}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4 border-b border-gray-200 bg-white px-6 py-3">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Viewing</p>
        <p className="text-sm font-semibold text-gray-900">{displayLabel}</p>
      </div>
      <div className="flex items-center gap-3">
        <label
          htmlFor="global-council-filter"
          className="text-sm font-medium text-gray-600 shrink-0"
        >
          Council
        </label>
        <Select
          value={selectedCouncilId}
          onValueChange={(value) => setSelectedCouncilId(value as CouncilFilterId)}
        >
          <SelectTrigger
            id="global-council-filter"
            className="h-9 w-[15rem] rounded-lg border-gray-300 bg-white px-3 text-sm text-gray-800 shadow-sm hover:bg-gray-50 focus-visible:border-green-500 focus-visible:ring-green-500/25"
            aria-label="Select council"
          >
            <SelectValue placeholder="Select council" />
          </SelectTrigger>
          <SelectContent align="end" className="z-[100] min-w-[15rem]">
            <SelectItem value="all">All Councils</SelectItem>
            {councils.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
