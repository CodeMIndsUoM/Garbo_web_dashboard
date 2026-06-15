'use client';

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { ChevronDown, ChevronUp, EyeOff, LayoutGrid, List, Loader2, Trash2, X } from 'lucide-react';
import { typography } from '@/theme';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { cn } from '../ui/utils';

export interface NavItem<T extends string> {
  id: T;
  label: string;
  icon?: React.ReactNode;
  count?: number;
  description?: string;
}

interface PagePrimaryTabsProps<T extends string> {
  items: NavItem<T>[];
  active: T;
  onChange: (id: T) => void;
}

function pageTabButtonClass(isActive: boolean) {
  return cn(
    'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'border border-brand-200 bg-brand-muted text-brand-700 shadow-sm dark:border-brand-200/30 dark:text-brand-muted-foreground'
      : 'border border-transparent text-muted-foreground hover:bg-accent hover:text-foreground'
  );
}

function pageTabCountClass(isActive: boolean) {
  return cn(
    'inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold',
    isActive
      ? 'bg-brand-100 text-brand-800 dark:bg-brand-muted dark:text-brand-muted-foreground'
      : 'bg-muted text-muted-foreground'
  );
}

const pageTabListClass =
  'inline-flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1 shadow-sm';

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  detail?: string;
  icon?: LucideIcon;
  iconClassName?: string;
  valueClassName?: string;
  loading?: boolean;
  error?: string;
  onClick?: () => void;
  active?: boolean;
  /** Override active ring/border — e.g. vehicle status cards use blue/green/amber */
  activeClassName?: string;
  className?: string;
}

/** KPI summary card — same layout/typography on Dashboard, Bin, Vehicle, etc. */
export function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  iconClassName,
  valueClassName,
  loading,
  error,
  onClick,
  active,
  activeClassName,
  className,
}: StatCardProps) {
  const interactive = Boolean(onClick);

  return (
    <Card
      className={cn(
        'h-full border-border shadow-[var(--shadow-card)]',
        interactive &&
          'cursor-pointer transition-all hover:border-brand-500/50 hover:ring-2 hover:ring-brand-500/30 hover:shadow-md focus-visible:outline-none focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-500/40',
        active &&
          cn(
            'shadow-md ring-2',
            activeClassName ?? 'border-brand-500 ring-brand-500/40'
          ),
        className
      )}
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
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
            <span className={typography.caption}>Loading…</span>
          </div>
        ) : error ? (
          <p className={`${typography.caption} text-status-danger`}>{error}</p>
        ) : (
          <div className="flex min-h-[5.5rem] items-center justify-between gap-4">
            <div className="min-w-0">
              <p className={`${typography.caption} mb-1`}>{label}</p>
              <p className={cn(typography.statValue, valueClassName)}>{value}</p>
              {detail ? (
                <p className={`${typography.micro} mt-1 line-clamp-2`}>{detail}</p>
              ) : null}
            </div>
            {Icon ? (
              <Icon
                className={cn('size-10 shrink-0 text-muted-foreground', iconClassName)}
                strokeWidth={1.5}
                aria-hidden
              />
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface StatCardGridProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
  className?: string;
}

/** Responsive grid for StatCard rows — consistent gap across pages. */
export function StatCardGrid({ children, columns = 4, className }: StatCardGridProps) {
  const columnClass =
    columns === 2
      ? 'md:grid-cols-2'
      : columns === 3
        ? 'md:grid-cols-3'
        : 'md:grid-cols-2 xl:grid-cols-4';

  return (
    <div className={cn('grid grid-cols-1 items-stretch gap-6', columnClass, className)}>
      {children}
    </div>
  );
}

/** Entity list grid — Bin / Vehicle cards (3-col on lg). */
export function EntityCardGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3', className)}>
      {children}
    </div>
  );
}

interface CollapsibleEntityCardProps {
  accentClass: string;
  title: string;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  headerActions?: React.ReactNode;
  primaryMetric: {
    label: string;
    value: React.ReactNode;
    valueClassName?: string;
  };
  /** Shown when expanded — Type, max bins, actions, etc. */
  expandedContent?: React.ReactNode;
  className?: string;
}

/**
 * List entity card — collapsed size matches Bin Management cards;
 * extra details expand/collapse via chevron on the primary metric row.
 */
export function CollapsibleEntityCard({
  accentClass,
  title,
  subtitle,
  badge,
  headerActions,
  primaryMetric,
  expandedContent,
  className,
}: CollapsibleEntityCardProps) {
  const [expanded, setExpanded] = React.useState(false);
  const hasDetails = Boolean(expandedContent);

  return (
    <Card
      className={cn(
        'group relative overflow-hidden border-border transition-all duration-300 hover:shadow-lg',
        className
      )}
    >
      <div className={cn('absolute top-0 left-0 right-0 h-1.5', accentClass)} />
      <CardContent className="pt-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="mb-1 font-semibold text-foreground">{title}</h3>
            {subtitle ? (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">{subtitle}</div>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {badge}
            {headerActions}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-muted-foreground">{primaryMetric.label}</span>
            <div className="flex items-center gap-1">
              <span className={cn('text-sm font-bold', primaryMetric.valueClassName)}>
                {primaryMetric.value}
              </span>
              {hasDetails ? (
                <button
                  type="button"
                  onClick={() => setExpanded((open) => !open)}
                  className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  aria-expanded={expanded}
                  aria-label={expanded ? 'Hide details' : 'Show details'}
                >
                  {expanded ? (
                    <ChevronUp className="size-4 shrink-0" aria-hidden />
                  ) : (
                    <ChevronDown className="size-4 shrink-0" aria-hidden />
                  )}
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {expanded && expandedContent ? (
          <div className="space-y-3 border-t border-border pt-3">{expandedContent}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** Top-level page tabs — outline segmented control (Citizens / Collectors). */
export function PagePrimaryTabs<T extends string>({
  items,
  active,
  onChange,
}: PagePrimaryTabsProps<T>) {
  return (
    <div className={pageTabListClass}>
      {items.map((item) => {
        const isActive = active === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={pageTabButtonClass(isActive)}
          >
            {item.icon}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

interface PageSubSectionNavProps<T extends string> {
  items: NavItem<T>[];
  active: T;
  onChange: (id: T) => void;
  title?: string;
}

/** Secondary navigation — distinct panel so sub-sections read clearly. */
export function PageSubSectionNav<T extends string>({
  items,
  active,
  onChange,
  title = 'Sub-sections',
}: PageSubSectionNavProps<T>) {
  const activeItem = items.find((item) => item.id === active);

  return (
    <div className="rounded-xl border border-border bg-muted/50 p-4">
      <p className={`${typography.sectionEyebrow} mb-3`}>{title}</p>
      <div className={pageTabListClass}>
        {items.map((item) => {
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              className={pageTabButtonClass(isActive)}
            >
              {item.icon}
              {item.label}
              {item.count !== undefined ? (
                <span className={pageTabCountClass(isActive)}>{item.count}</span>
              ) : null}
            </button>
          );
        })}
      </div>
      {activeItem?.description ? (
        <p className={`${typography.caption} mt-3`}>{activeItem.description}</p>
      ) : null}
    </div>
  );
}

interface FormFieldProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}

/** Shared outline style for inputs, selects, and textareas in management forms. */
export const managementFieldClass =
  'h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground shadow-sm outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-brand-500 focus-visible:ring-brand-500/25 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60';

export function FormField({ label, htmlFor, hint, className, children }: FormFieldProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <label htmlFor={htmlFor} className={typography.label}>
        {label}
      </label>
      {children}
      {hint ? <p className={typography.micro}>{hint}</p> : null}
    </div>
  );
}

interface FormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  id?: string;
}

export function FormSelect({ className, children, ...props }: FormSelectProps) {
  return (
    <div className="relative">
      <select
        className={cn(managementFieldClass, 'appearance-none pr-10', className)}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
    </div>
  );
}

interface FormPanelProps {
  children: React.ReactNode;
  /** Submit / action buttons — rendered inside the panel, right-aligned */
  footer?: React.ReactNode;
  className?: string;
}

/** Bordered form area so fields read clearly against the page. */
export function FormPanel({ children, footer, className }: FormPanelProps) {
  return (
    <div className={cn('rounded-lg border border-border bg-muted/40 p-5', className)}>
      {children}
      {footer ? (
        <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

interface TableRowActionsProps {
  onHide?: () => void;
  onDelete?: () => void;
  hideLabel?: string;
  deleteLabel?: string;
  hideDisabled?: boolean;
  deleteDisabled?: boolean;
}

/** Consistent row actions — neutral hide, red delete outline. */
export function TableRowActions({
  onHide,
  onDelete,
  hideLabel = 'Hide',
  deleteLabel = 'Delete',
  hideDisabled,
  deleteDisabled,
}: TableRowActionsProps) {
  return (
    <div className="flex items-center justify-end gap-2">
      {onHide ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={hideDisabled}
          onClick={onHide}
          className="h-8 border-border text-foreground hover:bg-accent"
        >
          <EyeOff className="size-3.5" />
          {hideLabel}
        </Button>
      ) : null}
      {onDelete ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={deleteDisabled}
          onClick={onDelete}
          className="h-8 border-status-danger-border text-status-danger hover:bg-status-danger-muted hover:text-status-danger"
        >
          <Trash2 className="size-3.5" />
          {deleteLabel}
        </Button>
      ) : null}
    </div>
  );
}

interface FormActionsProps {
  children: React.ReactNode;
  className?: string;
}

export function FormActions({ children, className }: FormActionsProps) {
  return (
    <div className={cn('mt-5 border-t border-border pt-5', className)}>
      <div className="flex flex-wrap items-center justify-end gap-3">{children}</div>
    </div>
  );
}

interface ExpandableRowProps {
  isOpen: boolean;
  onToggle: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  trailing?: React.ReactNode;
  children?: React.ReactNode;
}

/** Collapsible list row — collapsed summary, expanded detail panel. */
export function ExpandableRow({
  isOpen,
  onToggle,
  title,
  subtitle,
  trailing,
  children,
}: ExpandableRowProps) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border transition-colors',
        isOpen ? 'border-brand-500 shadow-sm' : 'border-border'
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'flex w-full items-center justify-between gap-4 p-4 text-left font-normal',
          typography.body,
          isOpen ? 'bg-brand-muted' : 'hover:bg-accent'
        )}
      >
        <div className="min-w-0 flex-1">
          <p className={typography.rowTitle}>{title}</p>
          {subtitle ? <div className="mt-1">{subtitle}</div> : null}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {trailing}
          {isOpen ? (
            <ChevronUp className="size-5 text-muted-foreground" aria-hidden />
          ) : (
            <ChevronDown className="size-5 text-muted-foreground" aria-hidden />
          )}
        </div>
      </button>
      {isOpen && children ? (
        <div className="space-y-4 border-t border-border bg-card p-4">{children}</div>
      ) : null}
    </div>
  );
}

interface DetailGridProps {
  children: React.ReactNode;
  className?: string;
  columns?: 2 | 3;
}

export function DetailGrid({ children, className, columns = 3 }: DetailGridProps) {
  return (
    <div
      className={cn(
        typography.detailValue,
        'grid grid-cols-1 gap-3',
        columns === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3',
        className
      )}
    >
      {children}
    </div>
  );
}

interface DetailFieldProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

export function DetailField({ label, children, className }: DetailFieldProps) {
  return (
    <div className={className}>
      <span className={typography.detailLabel}>{label}</span>
      <div className={`mt-0.5 ${typography.detailValue}`}>{children}</div>
    </div>
  );
}

interface CodeBadgeProps {
  children: React.ReactNode;
  className?: string;
}

export function CodeBadge({ children, className }: CodeBadgeProps) {
  return (
    <span
      className={cn(
        typography.rowSubtitle,
        'inline-block rounded border border-border bg-muted px-1.5 py-0.5 font-sans',
        className
      )}
    >
      {children}
    </span>
  );
}

export type ViewMode = 'card' | 'list';

interface ViewModeToggleProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
  className?: string;
}

/** Card / list view switcher — place on the right of search toolbars. */
export function ViewModeToggle({ value, onChange, className }: ViewModeToggleProps) {
  return (
    <div
      className={cn(
        'inline-flex shrink-0 gap-1 rounded-lg border border-border bg-card p-1 shadow-sm',
        className
      )}
      role="group"
      aria-label="View mode"
    >
      <button
        type="button"
        onClick={() => onChange('card')}
        aria-pressed={value === 'card'}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
          value === 'card'
            ? 'border border-brand-200 bg-brand-muted text-brand-700 shadow-sm dark:border-brand-200/30 dark:text-brand-muted-foreground'
            : 'border border-transparent text-muted-foreground hover:bg-accent hover:text-foreground'
        )}
      >
        <LayoutGrid className="size-4" aria-hidden />
        Cards
      </button>
      <button
        type="button"
        onClick={() => onChange('list')}
        aria-pressed={value === 'list'}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
          value === 'list'
            ? 'border border-brand-200 bg-brand-muted text-brand-700 shadow-sm dark:border-brand-200/30 dark:text-brand-muted-foreground'
            : 'border border-transparent text-muted-foreground hover:bg-accent hover:text-foreground'
        )}
      >
        <List className="size-4" aria-hidden />
        List
      </button>
    </div>
  );
}

/** Transparent glass inputs — matches map route planner / bin report dialogs. */
export const glassFieldClass =
  'h-10 w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass-field)] px-3 text-sm text-[var(--glass-text)] shadow-sm outline-none transition-[color,box-shadow] placeholder:text-[var(--glass-text-muted)] focus:border-brand-600 focus:ring-brand-600/20 focus:ring-[3px] disabled:cursor-not-allowed disabled:opacity-60';

/** Compact variant for label–value rows (route history card style). */
export const glassFieldCompactClass =
  'h-9 min-w-[10rem] rounded-lg border border-[var(--glass-border)] bg-[var(--glass-field)] px-3 text-[11px] text-[var(--glass-text)] shadow-sm outline-none transition-[color,box-shadow] placeholder:text-[var(--glass-text-muted)] focus:border-brand-600 focus:ring-brand-600/20 focus:ring-[3px] disabled:cursor-not-allowed disabled:opacity-60';

interface GlassFormFieldProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}

export function GlassFormField({ label, htmlFor, hint, className, children }: GlassFormFieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label
        htmlFor={htmlFor}
        className="block text-[10px] font-bold uppercase tracking-wider text-[var(--glass-text-muted)]"
      >
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-[var(--glass-text-muted)]">{hint}</p> : null}
    </div>
  );
}

interface GlassFormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  id?: string;
}

export function GlassFormSelect({ className, children, ...props }: GlassFormSelectProps) {
  return (
    <div className="relative">
      <select
        className={cn(glassFieldClass, 'appearance-none pr-10', className)}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[var(--glass-text-muted)]"
        aria-hidden
      />
    </div>
  );
}

interface GlassFormRowProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

/** Label left, control right — same row layout as route history session cards. */
export function GlassFormRow({ label, children, className }: GlassFormRowProps) {
  return (
    <div className={cn('flex items-center justify-between gap-4', className)}>
      <span>{label}</span>
      <div className="shrink-0 text-right">{children}</div>
    </div>
  );
}

interface GlassFormCardProps {
  title: string;
  badge?: React.ReactNode;
  accentClass?: string;
  children: React.ReactNode;
  className?: string;
}

/** Session-card shell with left accent strip — matches map route history cards. */
export function GlassFormCard({
  title,
  badge,
  accentClass = 'bg-green-500',
  children,
  className,
}: GlassFormCardProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface)] p-4 shadow-sm',
        className
      )}
    >
      <div className={cn('absolute bottom-0 left-0 top-0 w-1.5', accentClass)} />
      <div className="mb-3 flex items-start justify-between gap-2 pl-2">
        <span className="text-sm font-semibold text-[var(--glass-text)]">{title}</span>
        {badge}
      </div>
      <div className="space-y-3 pl-2 text-[11px] text-[var(--glass-text-muted)]">{children}</div>
    </div>
  );
}

interface GlassSideFormPanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  error?: string;
}

/** Right-side glass panel — same shell as map Route History & Active Sessions. */
export function GlassSideFormPanel({
  open,
  onClose,
  title,
  icon,
  children,
  footer,
  error,
}: GlassSideFormPanelProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-background/40 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className={cn(
          'absolute bottom-2 left-2 right-2 top-[4.5rem] flex flex-col sm:left-auto sm:right-4 sm:top-20 sm:w-[380px] sm:max-w-[calc(100vw-2rem)]',
          'rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-surface-solid)] shadow-2xl backdrop-blur-md'
        )}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="glass-side-form-title"
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--glass-border)] p-5">
          <div className="flex min-w-0 items-center gap-2">
            {icon}
            <h3 id="glass-side-form-title" className="truncate text-sm font-bold text-[var(--glass-text)]">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1 text-[var(--glass-text-muted)] transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {error ? (
            <div className="mb-4 rounded-lg border border-status-danger-border bg-status-danger-muted px-3 py-2 text-[11px] text-status-danger">
              {error}
            </div>
          ) : null}
          {children}
        </div>
        {footer ? (
          <div className="shrink-0 border-t border-[var(--glass-border)] bg-muted/30 p-4">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}

interface GlassFormModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  error?: string;
  zIndex?: number;
}

/** Centered frosted modal — for pages that prefer a dialog over a side panel. */
export function GlassFormModal({
  open,
  onClose,
  title,
  icon,
  children,
  footer,
  error,
  zIndex = 50,
}: GlassFormModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 bg-background/40 backdrop-blur-sm"
      style={{ zIndex }}
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-surface-solid)] shadow-2xl backdrop-blur-md"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="glass-form-modal-title"
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--glass-border)] p-5">
          <div className="flex min-w-0 items-center gap-2">
            {icon}
            <h2 id="glass-form-modal-title" className="truncate text-sm font-bold text-[var(--glass-text)]">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1 text-[var(--glass-text-muted)] transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {error ? (
            <div className="mb-4 rounded-lg border border-status-danger-border bg-status-danger-muted px-3 py-2 text-[11px] text-status-danger">
              {error}
            </div>
          ) : null}
          {children}
        </div>
        {footer ? (
          <div className="shrink-0 border-t border-[var(--glass-border)] bg-muted/30 p-4">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}
