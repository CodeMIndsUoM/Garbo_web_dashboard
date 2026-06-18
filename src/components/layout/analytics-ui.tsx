'use client';

import React from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../ui/card';
import { cn } from '../ui/utils';
import { typography } from '@/theme';
import { StatCard, type StatCardProps } from './management-ui';

/** Shared chart colors — use CSS variables from tokens.css */
export const CHART = {
  brand: 'var(--brand-600)',
  brandLight: 'var(--brand-500)',
  neutral: 'var(--chart-neutral)',
  alert: 'var(--status-danger)',
  grid: 'var(--chart-grid)',
  cursor: 'var(--chart-cursor)',
  tooltipStyle: {
    borderRadius: '8px',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--card)',
    color: 'var(--foreground)',
    boxShadow: 'var(--shadow-card)',
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
    <section className="mb-5 md:mb-8">
      <div className="mb-3 border-b border-border pb-2 md:mb-4 md:pb-3">
        <h3 className={typography.sectionEyebrow}>{title}</h3>
        {description ? (
          <p className={`${typography.caption} mt-1 hidden sm:block`}>{description}</p>
        ) : null}
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
    <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-500/30 dark:bg-amber-500/10">
      <p className="text-sm font-medium text-amber-900 dark:text-amber-200 mb-1">Needs attention</p>
      <ul className="list-disc pl-5 text-sm text-amber-800 dark:text-amber-300/90 space-y-0.5">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function AnalyticsPageShell({ children }: { children: React.ReactNode }) {
  return <div className="p-3 sm:p-4 md:p-8">{children}</div>;
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
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-accent"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        ) : null}
        <div>
          <h2 className={`${typography.pageTitle} mb-2`}>{title}</h2>
          <p className={typography.pageSubtitle}>{subtitle}</p>
        </div>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export type AnalyticsStatCardProps = StatCardProps;

/** @deprecated Import StatCard from management-ui — kept as alias for dashboard drill-down pages */
export function AnalyticsStatCard(props: AnalyticsStatCardProps) {
  return <StatCard {...props} />;
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
    <Card className={cn('min-w-0 overflow-hidden border-border shadow-[var(--shadow-card)]', className)}>
      <CardHeader className="border-b border-border p-3 pb-3 sm:p-6 sm:pb-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <h3 className={`${typography.sectionTitle} mb-0.5 text-base sm:mb-1 sm:text-lg`}>{title}</h3>
            {subtitle ? <p className={`${typography.caption} hidden sm:block`}>{subtitle}</p> : null}
          </div>
          {actions}
        </div>
      </CardHeader>
      <CardContent className="min-w-0 p-3 pt-3 sm:p-6 sm:pt-6">{children}</CardContent>
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
    <div className="flex rounded-lg bg-muted p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            'px-3 py-1.5 text-xs font-medium rounded-md transition-all',
            value === option.value
              ? 'bg-card text-brand-600 shadow-sm dark:text-brand-500'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent'
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
    <div className="mb-6 rounded-lg border border-status-danger-border bg-status-danger-muted px-4 py-3 text-sm text-status-danger">
      {message}
    </div>
  );
}

export function AnalyticsLoadingBlock({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

/** Consistent pie/donut segment colors — green family + gray + alert */
export const PIE_COLORS = [
  'var(--brand-600)',
  'var(--brand-500)',
  '#86efac',
  '#4ade80',
  'var(--chart-neutral)',
  '#64748b',
  'var(--status-danger)',
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
