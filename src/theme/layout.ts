/**
 * Shared layout / elevation class bundles.
 */

export const layout = {
  page: 'min-h-screen bg-[var(--surface-page)]',
  pagePadding: 'p-3 sm:p-4 md:p-8',
  card: 'rounded-[var(--radius-card)] border border-[var(--surface-border)] bg-[var(--surface-elevated)] shadow-[var(--shadow-card)]',
  cardInteractive: 'rounded-[var(--radius-card)] border border-[var(--surface-border)] bg-[var(--surface-elevated)] shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-elevated)]',
  panel: 'rounded-[var(--radius-panel)] border border-[var(--surface-border)] bg-[var(--surface-elevated)] shadow-[var(--shadow-elevated)]',
  authShell: 'min-h-screen flex flex-col lg:flex-row bg-[var(--surface-page)]',
  authFormColumn:
    'flex flex-1 items-center justify-center px-4 py-10 sm:px-8 lg:px-12 lg:py-12 order-1',
  authFormCard:
    'w-full max-w-md rounded-[var(--radius-auth-card)] border border-[var(--surface-border)] bg-[var(--auth-form-backdrop)] backdrop-blur-sm p-8 sm:p-10 shadow-[var(--shadow-auth-card)]',
  authHeroColumn:
    'relative hidden min-h-[280px] flex-1 overflow-hidden lg:block order-2',
} as const;
