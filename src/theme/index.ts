export { brand, surface, status } from './colors';
export { typography } from './typography';
export { layout } from './layout';

/** CSS variable names for inline styles or dynamic theming */
export const cssVars = {
  brandPrimary: 'var(--brand-primary)',
  brandPrimaryHover: 'var(--brand-primary-hover)',
  brand600: 'var(--brand-600)',
  brand700: 'var(--brand-700)',
  surfacePage: 'var(--surface-page)',
  surfaceElevated: 'var(--surface-elevated)',
  authHeroImage: 'var(--auth-hero-image)',
  authHeroOverlay: 'var(--auth-hero-overlay)',
  authHeroBrandTint: 'var(--auth-hero-brand-tint)',
} as const;

/** Public assets referenced by auth layout */
export const authAssets = {
  heroImage: '/images/login-hero.jpg',
  logoSvg: '/brand/garbo-logo.svg',
} as const;
