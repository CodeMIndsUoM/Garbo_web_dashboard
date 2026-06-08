/**
 * Typography class bundles — use instead of ad-hoc text-* per page.
 */

export const typography = {
  display: 'text-[length:var(--text-display)] font-semibold tracking-[var(--tracking-tight)] leading-[var(--leading-tight)] text-foreground',
  pageTitle: 'text-[length:var(--text-page-title)] font-semibold tracking-[var(--tracking-tight)] leading-[var(--leading-tight)] text-foreground',
  pageSubtitle: 'text-[length:var(--text-caption)] leading-[var(--leading-normal)] text-muted-foreground',
  sectionTitle: 'text-[length:var(--text-section-title)] font-semibold leading-[var(--leading-tight)] text-foreground',
  body: 'text-[length:var(--text-body)] font-normal leading-[var(--leading-normal)] text-foreground',
  bodyMuted: 'text-[length:var(--text-body)] font-normal leading-[var(--leading-normal)] text-muted-foreground',
  caption: 'text-[length:var(--text-caption)] leading-[var(--leading-normal)] text-muted-foreground',
  label: 'text-[length:var(--text-caption)] font-medium leading-[var(--leading-normal)] text-foreground',
  micro: 'text-[length:var(--text-micro)] leading-[var(--leading-normal)] text-muted-foreground',
} as const;
