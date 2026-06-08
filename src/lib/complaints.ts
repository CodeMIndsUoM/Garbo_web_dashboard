import { apiFetch } from '@/lib/api';

export interface ComplaintItem {
  id: number;
  title?: string;
  issueType?: string;
  urgency?: string;
  wasteType?: string;
  description?: string;
  status?: string;
  location?: string;
  council?: string;
  imageUrl?: string;
  resolutionNotes?: string;
  createdAt?: string;
}

export type ComplaintDecision = 'APPROVED' | 'REJECTED' | 'IN_PROGRESS';

export function isPendingComplaint(status?: string): boolean {
  const normalized = (status || 'PENDING').trim().toUpperCase();
  return normalized === 'PENDING' || normalized === 'NEW';
}

export function complaintTitle(complaint: ComplaintItem): string {
  return (
    complaint.title?.trim() ||
    complaint.issueType?.trim() ||
    complaint.description?.slice(0, 80) ||
    `Complaint #${complaint.id}`
  );
}

export function complaintStatusLabel(status?: string): string {
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
    case 'IN_PROGRESS':
      return 'In Progress';
    default:
      return normalized.replaceAll('_', ' ');
  }
}

export function complaintStatusBadgeClass(status?: string): string {
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
  if (normalized === 'IN_PROGRESS') {
    return 'bg-blue-100 text-blue-800';
  }
  return 'bg-gray-100 text-gray-700';
}

export function filterComplaintsByCouncil(
  complaints: ComplaintItem[],
  councilName?: string,
): ComplaintItem[] {
  if (!councilName) return complaints;
  const needle = councilName.trim().toLowerCase();
  return complaints.filter((complaint) => {
    const council = complaint.council?.trim().toLowerCase();
    return council === needle;
  });
}

export async function patchComplaintStatus(
  id: number,
  status: ComplaintDecision,
  resolutionNotes?: string,
): Promise<void> {
  const notes =
    resolutionNotes?.trim() ||
    (status === 'REJECTED'
      ? 'Rejected by admin'
      : status === 'APPROVED'
        ? 'Approved by admin'
        : undefined);

  const { response, data } = await apiFetch(`/api/complaints/${id}/status`, {
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
        : 'Failed to update complaint';
    throw new Error(message);
  }
}
