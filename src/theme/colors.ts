/**
 * Brand & semantic color token names for use in className strings.
 * Maps to CSS variables in tokens.css — never hardcode hex here.
 */

export const brand = {
  50: 'bg-brand-50',
  100: 'bg-brand-100',
  600: 'bg-brand-600',
  700: 'bg-brand-700',
  text600: 'text-brand-600',
  text700: 'text-brand-700',
  text800: 'text-brand-800',
  border200: 'border-brand-200',
  ring: 'ring-brand-500',
  primary: 'bg-brand-600 text-white',
  primaryHover: 'hover:bg-brand-700',
  mutedSurface: 'bg-brand-50',
  mutedText: 'text-brand-800',
} as const;

export const surface = {
  page: 'bg-[var(--surface-page)]',
  elevated: 'bg-[var(--surface-elevated)]',
  subtle: 'bg-[var(--surface-subtle)]',
  border: 'border-[var(--surface-border)]',
  topbar: 'bg-[var(--surface-topbar)]',
} as const;

export const glass = {
  surface: 'bg-[var(--glass-surface)]',
  surfaceSolid: 'bg-[var(--glass-surface-solid)]',
  border: 'border-[var(--glass-border)]',
  field: 'bg-[var(--glass-field)]',
  text: 'text-[var(--glass-text)]',
  textMuted: 'text-[var(--glass-text-muted)]',
} as const;

export const status = {
  full: 'text-red-600',
  half: 'text-yellow-600',
  empty: 'text-brand-600',
  neutral: 'text-muted-foreground',
} as const;
