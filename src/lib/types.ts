export type { Council } from '@/lib/council-context';
export type { UserRole, PageType } from '@/app/page';

export interface ApiListResponse<T> {
  success?: boolean;
  data?: T;
  message?: string;
}
