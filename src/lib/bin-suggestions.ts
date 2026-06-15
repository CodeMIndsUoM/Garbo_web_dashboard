import { apiFetch } from '@/lib/api';

export interface BinSuggestionItem {
  id: number;
  mentorId?: number;
  mentorName?: string;
  council?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  category?: string;
  notes?: string;
  imageUrl?: string;
  status?: string;
  resolutionNotes?: string;
  createdBinId?: number;
  createdAt?: string;
  updatedAt?: string;
}

export type BinSuggestionDecision = 'APPROVED' | 'REJECTED';

export function isPendingBinSuggestion(status?: string): boolean {
  const normalized = (status || 'PENDING').trim().toUpperCase();
  return normalized === 'PENDING' || normalized === 'NEW';
}

export function binSuggestionTitle(item: BinSuggestionItem): string {
  return (
    item.category?.trim() ||
    item.notes?.slice(0, 80) ||
    `Bin suggestion #${item.id}`
  );
}

export function binSuggestionStatusLabel(status?: string): string {
  const normalized = (status || 'PENDING').trim().toUpperCase();
  switch (normalized) {
    case 'PENDING':
    case 'NEW':
      return 'Pending';
    case 'APPROVED':
    case 'ACCEPTED':
      return 'Approved';
    case 'REJECTED':
      return 'Rejected';
    default:
      return normalized.replaceAll('_', ' ');
  }
}

export function binSuggestionStatusBadgeClass(status?: string): string {
  const normalized = (status || 'PENDING').trim().toUpperCase();
  if (normalized === 'PENDING' || normalized === 'NEW') {
    return 'bg-amber-100 text-amber-800';
  }
  if (normalized === 'REJECTED') {
    return 'bg-red-100 text-red-800';
  }
  if (normalized === 'APPROVED' || normalized === 'ACCEPTED') {
    return 'bg-green-100 text-green-800';
  }
  return 'bg-gray-100 text-gray-700';
}

export function filterBinSuggestionsByCouncil(
  suggestions: BinSuggestionItem[],
  councilName?: string,
): BinSuggestionItem[] {
  if (!councilName) return suggestions;
  const needle = councilName.trim().toLowerCase();
  return suggestions.filter((item) => {
    const council = item.council?.trim().toLowerCase();
    return council === needle;
  });
}

export async function patchBinSuggestionStatus(
  id: number,
  status: BinSuggestionDecision,
  resolutionNotes?: string,
): Promise<void> {
  const notes =
    resolutionNotes?.trim() ||
    (status === 'REJECTED'
      ? 'Rejected by admin'
      : status === 'APPROVED'
        ? 'Approved by admin'
        : undefined);

  const { response, data } = await apiFetch(`/api/bin-suggestions/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({
      status,
      ...(notes ? { resolutionNotes: notes } : {}),
    }),
  });

  if (!response.ok) {
    const message =
      typeof data === 'object' &&
      data !== null &&
      'message' in data &&
      typeof (data as { message?: unknown }).message === 'string'
        ? (data as { message: string }).message
        : 'Failed to update bin suggestion';
    throw new Error(message);
  }
}

function resolveMediaUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const base = (process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8081').replace(/\/$/, '');
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${base}${path}`;
}

export function binSuggestionImageUrl(url?: string | null): string | null {
  return resolveMediaUrl(url);
}
