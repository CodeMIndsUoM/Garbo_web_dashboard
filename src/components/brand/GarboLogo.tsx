'use client';

import React from 'react';
import { cn } from '@/components/ui/utils';
import { typography } from '@/theme';

type GarboLogoVariant = 'default' | 'inverse' | 'onBrand';
type GarboLogoSize = 'sm' | 'md' | 'lg';

interface GarboLogoProps {
  variant?: GarboLogoVariant;
  size?: GarboLogoSize;
  showTagline?: boolean;
  /** Optional abstract ring mark — off by default (text-only logo) */
  showMark?: boolean;
  className?: string;
}

const sizeMap = {
  sm: {
    name: 'text-xl',
    tagline: typography.micro,
    accent: 'w-8 h-0.5',
    mark: 'h-9 w-9 text-sm',
    gap: 'gap-2.5',
  },
  md: {
    name: 'text-2xl',
    tagline: typography.micro,
    accent: 'w-10 h-0.5',
    mark: 'h-10 w-10 text-base',
    gap: 'gap-3',
  },
  lg: {
    name: 'text-4xl',
    tagline: typography.caption,
    accent: 'w-14 h-1',
    mark: 'h-12 w-12 text-lg',
    gap: 'gap-3.5',
  },
} as const;

const variantMap = {
  default: {
    nameGradient: 'from-brand-800 via-brand-600 to-brand-500',
    tagline: 'text-muted-foreground',
    accent: 'bg-brand-600',
    sublabel: 'text-brand-700/75',
    markRing: 'from-brand-500 to-brand-700 ring-brand-100',
    markLetter: 'text-white',
  },
  inverse: {
    nameGradient: 'from-white via-white to-white/90',
    tagline: 'text-white/85',
    accent: 'bg-white/90',
    sublabel: 'text-white/75',
    markRing: 'from-white/30 to-white/10 ring-white/25',
    markLetter: 'text-white',
  },
  onBrand: {
    nameGradient: 'from-brand-800 via-brand-700 to-brand-600',
    tagline: 'text-muted-foreground',
    accent: 'bg-brand-600',
    sublabel: 'text-brand-700/80 font-semibold uppercase tracking-[0.18em]',
    markRing: 'from-brand-500 to-brand-700 ring-brand-100',
    markLetter: 'text-white',
  },
} as const;

/** Typographic Garbo wordmark — no bin icon */
export function GarboLogo({
  variant = 'default',
  size = 'md',
  showTagline = true,
  showMark = false,
  className,
}: GarboLogoProps) {
  const s = sizeMap[size];
  const v = variantMap[variant];

  return (
    <div className={cn('flex items-start', s.gap, className)}>
      {showMark ? <GarboLogoMark size={s.mark} ringClass={v.markRing} letterClass={v.markLetter} /> : null}
      <div className="min-w-0">
        <p
          className={cn(
            s.name,
            'font-extrabold leading-none tracking-tight bg-gradient-to-r bg-clip-text text-transparent',
            v.nameGradient
          )}
        >
          Garbo
        </p>
        <div className={cn('mt-2.5 rounded-full', s.accent, v.accent)} aria-hidden />
        {showTagline ? (
          <p
            className={cn(
              s.tagline,
              'mt-2.5 leading-snug',
              variant === 'onBrand' ? v.sublabel : v.tagline
            )}
          >
            {variant === 'onBrand' ? 'Waste Management' : 'Waste Management System'}
          </p>
        ) : null}
      </div>
    </div>
  );
}

interface GarboLogoMarkProps {
  size: string;
  ringClass: string;
  letterClass: string;
  className?: string;
}

/** Abstract ring mark (letter G only — no bin) */
export function GarboLogoMark({ size, ringClass, letterClass, className }: GarboLogoMarkProps) {
  return (
    <div
      className={cn(
        'relative flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-bold shadow-md ring-4',
        size,
        ringClass,
        className
      )}
      aria-hidden
    >
      <span className={letterClass}>G</span>
    </div>
  );
}
