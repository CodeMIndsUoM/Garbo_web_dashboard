'use client';

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../ui/card';
import { cn } from '../ui/utils';

/** Shared chart colors — brand green primary, gray secondary, red for alerts only */
export const CHART = {
  brand: '#16a34a',
  brandLight: '#86efac',
  neutral: '#9ca3af',
  alert: '#ef4444',
  grid: '#f3f4f6',
  tooltipStyle: {
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    padding: '12px',
  },
} as const;

/** Recharts animation defaults for dashboard graphs */
export const CHART_ANIMATION = {
  isAnimationActive: true,
  animationDuration: 900,
  animationEasing: 'ease-out' as const,
};

interface DashboardSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function DashboardSection({ title, description, children }: DashboardSectionProps) {
  return (
    <section className="mb-8">
      <div className="mb-4 border-b border-gray-100 pb-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">{title}</h3>
        {description ? <p className="mt-1 text-sm text-gray-600">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

interface DashboardAlertBannerProps {
  items: string[];
}

export function DashboardAlertBanner({ items }: DashboardAlertBannerProps) {
  if (items.length === 0) return null;
  return (
    <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
      <p className="text-sm font-medium text-amber-900 mb-1">Needs attention</p>
      <ul className="list-disc pl-5 text-sm text-amber-800 space-y-0.5">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function AnalyticsPageShell({ children }: { children: React.ReactNode }) {
  return <div className="p-8">{children}</div>;
}

interface AnalyticsPageHeaderProps {
  title: string;
  subtitle: string;
  onBack?: () => void;
  actions?: React.ReactNode;
}

export function AnalyticsPageHeader({ title, subtitle, onBack, actions }: AnalyticsPageHeaderProps) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-4">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to dashboard"
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 transition-colors hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        ) : null}
        <div>
          <h2 className="text-gray-900 mb-2">{title}</h2>
          <p className="text-gray-600">{subtitle}</p>
        </div>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

interface AnalyticsStatCardProps {
  label: string;
  value: React.ReactNode;
  detail?: string;
  icon?: LucideIcon;
  loading?: boolean;
  error?: string;
  onClick?: () => void;
}

export function AnalyticsStatCard({
  label,
  value,
  detail,
  icon: Icon,
  loading,
  error,
  onClick,
}: AnalyticsStatCardProps) {
  const interactive = Boolean(onClick);

  return (
    <Card
      className={cn(interactive && 'cursor-pointer transition-all hover:shadow-md')}
      onClick={onClick}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter') onClick?.();
            }
          : undefined
      }
    >
      <CardContent className="pt-6">
        {loading ? (
          <div className="flex items-center gap-2 py-2">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            <span className="text-sm text-gray-400">Loading...</span>
          </div>
        ) : error ? (
          <div className="text-sm text-red-600 py-1">{error}</div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-sm text-gray-600 mb-1">{label}</p>
              <p className="text-2xl text-gray-900">{value}</p>
              {detail ? <p className="text-xs text-gray-500 mt-1">{detail}</p> : null}
            </div>
            {Icon ? <Icon className="w-10 h-10 shrink-0 text-gray-400" /> : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface AnalyticsChartCardProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function AnalyticsChartCard({
  title,
  subtitle,
  actions,
  children,
  className,
}: AnalyticsChartCardProps) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="border-b border-gray-100 pb-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-gray-900 mb-1">{title}</h3>
            {subtitle ? <p className="text-sm text-gray-600">{subtitle}</p> : null}
          </div>
          {actions}
        </div>
      </CardHeader>
      <CardContent className="pt-6">{children}</CardContent>
    </Card>
  );
}

interface SegmentOption<T extends string> {
  label: string;
  value: T;
}

interface AnalyticsSegmentFilterProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function AnalyticsSegmentFilter<T extends string>({
  options,
  value,
  onChange,
}: AnalyticsSegmentFilterProps<T>) {
  return (
    <div className="flex rounded-lg bg-gray-100 p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            'px-3 py-1.5 text-xs font-medium rounded-md transition-all',
            value === option.value
              ? 'bg-white text-green-600 shadow-sm'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function AnalyticsErrorBanner({ message }: { message: string }) {
  return (
    <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {message}
    </div>
  );
}

export function AnalyticsLoadingBlock({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

/** Consistent pie/donut segment colors — green family + gray + alert */
export const PIE_COLORS = [
  CHART.brand,
  '#22c55e',
  '#86efac',
  '#4ade80',
  CHART.neutral,
  '#d1d5db',
  CHART.alert,
] as const;

export interface PieChartEntry {
  name: string;
  value: number;
  color: string;
}

export function mapRecordToPieData(
  map: Record<string, number> | undefined | null,
  labelFormatter?: (key: string) => string
): PieChartEntry[] {
  if (!map) return [];
  return Object.entries(map)
    .filter(([, value]) => value > 0)
    .map(([key, value], index) => ({
      name: labelFormatter ? labelFormatter(key) : key.charAt(0) + key.slice(1).toLowerCase().replace(/_/g, ' '),
      value,
      color: PIE_COLORS[index % PIE_COLORS.length],
    }));
}

export function formatStatusKey(key: string): string {
  return key.charAt(0) + key.slice(1).toLowerCase().replace(/_/g, ' ');
}
