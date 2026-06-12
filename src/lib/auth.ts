import type { Council } from '@/lib/council-context';

export function getRole(): string {
  if (typeof window === 'undefined') return '';
  return sessionStorage.getItem('role') || '';
}

export function isSuperadmin(): boolean {
  return getRole().toLowerCase() === 'superadmin';
}

export function isCouncilAdmin(): boolean {
  const role = getRole().toLowerCase();
  return role === 'admin' || role === 'role_admin';
}

export function getStoredCouncil(): Council | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = sessionStorage.getItem('council');
    if (!stored) return null;
    return JSON.parse(stored) as Council;
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem('token');
}
