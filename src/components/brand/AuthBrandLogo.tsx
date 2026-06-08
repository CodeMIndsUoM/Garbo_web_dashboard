'use client';

import { cn } from '@/components/ui/utils';

type AuthBrandLogoSize = 'lg' | 'sm';

interface AuthBrandLogoProps {
  className?: string;
  size?: AuthBrandLogoSize;
}

const sizeStyles: Record<
  AuthBrandLogoSize,
  { name: string; accent: string; tagline: string }
> = {
  lg: {
    name: 'text-[2.75rem]',
    accent: 'mt-3 h-1 w-14',
    tagline: 'mt-3 text-sm tracking-[0.2em]',
  },
  sm: {
    name: 'text-2xl',
    accent: 'mt-2 h-0.5 w-10',
    tagline: 'mt-2 text-[0.65rem] tracking-[0.16em]',
  },
};

/** Proportional text-only Garbo wordmark */
export function AuthBrandLogo({ className, size = 'lg' }: AuthBrandLogoProps) {
  const s = sizeStyles[size];

  return (
    <div className={cn('inline-block select-none', className)} aria-label="Garbo Management System">
      <p
        className={cn(
          s.name,
          'font-extrabold leading-[0.95] tracking-tight bg-gradient-to-r from-brand-800 via-brand-600 to-brand-500 bg-clip-text text-transparent'
        )}
      >
        Garbo
      </p>
      <div className={cn(s.accent, 'rounded-full bg-brand-600')} aria-hidden />
      <p className={cn(s.tagline, 'font-semibold uppercase text-brand-700/90')}>
        Management System
      </p>
    </div>
  );
}
