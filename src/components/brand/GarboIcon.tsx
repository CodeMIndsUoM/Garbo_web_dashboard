'use client';

import Image from 'next/image';
import { cn } from '@/components/ui/utils';

const ICON_SRC = '/brand/garbo-bin-icon-green.png';
const ICON_ASPECT = 181 / 230;

type GarboBrandSize = 'sm' | 'md' | 'lg';

interface GarboBrandProps {
  className?: string;
  size?: GarboBrandSize;
  /** Icon only — no wordmark */
  iconOnly?: boolean;
}

const sizeConfig: Record<
  GarboBrandSize,
  { iconHeight: number; wordmark: string }
> = {
  sm: { iconHeight: 36, wordmark: 'text-xl' },
  md: { iconHeight: 44, wordmark: 'text-2xl' },
  lg: { iconHeight: 52, wordmark: 'text-[2rem] leading-none' },
};

function GarboBinIcon({ height, className }: { height: number; className?: string }) {
  const width = Math.round(height * ICON_ASPECT);

  return (
    <Image
      src={ICON_SRC}
      alt=""
      aria-hidden
      width={width}
      height={height}
      className={cn('inline-block h-auto w-auto shrink-0 object-contain', className)}
      style={{ width, height }}
      priority
      draggable={false}
    />
  );
}

/** Garbo bin icon + green wordmark */
export function GarboBrand({ className, size = 'md', iconOnly = false }: GarboBrandProps) {
  const { iconHeight, wordmark } = sizeConfig[size];

  if (iconOnly) {
    return (
      <div className={cn('inline-flex', className)} aria-label="Garbo">
        <GarboBinIcon height={iconHeight} />
      </div>
    );
  }

  return (
    <div className={cn('inline-flex items-center gap-2.5', className)} aria-label="Garbo">
      <GarboBinIcon height={iconHeight} />
      <span className={cn('font-extrabold tracking-tight text-brand-600 dark:text-brand-500', wordmark)}>Garbo</span>
    </div>
  );
}

/** @deprecated Use GarboBrand — icon-only alias */
export function GarboIcon({
  className,
  size = 'md',
}: {
  className?: string;
  size?: GarboBrandSize | number;
}) {
  const height =
    typeof size === 'number'
      ? size
      : sizeConfig[size]?.iconHeight ?? sizeConfig.md.iconHeight;

  return (
    <div className={cn('inline-flex', className)} aria-label="Garbo">
      <GarboBinIcon height={height} />
    </div>
  );
}
