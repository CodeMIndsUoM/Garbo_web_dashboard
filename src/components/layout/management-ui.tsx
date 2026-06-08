'use client';

import React from 'react';
import { ChevronDown, ChevronUp, EyeOff, Trash2 } from 'lucide-react';
import { typography } from '@/theme';
import { Button } from '../ui/button';
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

/** Top-level page tabs — outline segmented control (Citizens / Collectors). */
export function PagePrimaryTabs<T extends string>({
  items,
  active,
  onChange,
}: PagePrimaryTabsProps<T>) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
      {items.map((item) => {
        const isActive = active === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={cn(
              'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'border border-green-200 bg-green-50 text-green-700 shadow-sm'
                : 'border border-transparent text-gray-600 hover:bg-gray-50'
            )}
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
    <div className="rounded-xl border border-gray-200 bg-slate-50/90 p-4">
      <p className={`${typography.sectionEyebrow} mb-3`}>{title}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => {
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'border-green-300 bg-white text-green-700 shadow-sm'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-800'
              )}
            >
              {item.icon}
              {item.label}
              {item.count !== undefined ? (
                <span
                  className={cn(
                    'inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold',
                    isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                  )}
                >
                  {item.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {activeItem?.description ? (
        <p className={`${typography.caption} mt-3 text-gray-600`}>{activeItem.description}</p>
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
  'h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 shadow-sm outline-none transition-[color,box-shadow] placeholder:text-gray-400 focus-visible:border-green-500 focus-visible:ring-green-500/25 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:bg-gray-50 disabled:opacity-60';

export function FormField({ label, htmlFor, hint, className, children }: FormFieldProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <label htmlFor={htmlFor} className={`${typography.label} text-gray-700`}>
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
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-gray-500"
        aria-hidden
      />
    </div>
  );
}

interface FormPanelProps {
  children: React.ReactNode;
  className?: string;
}

/** Bordered form area so fields read clearly against the page. */
export function FormPanel({ children, className }: FormPanelProps) {
  return (
    <div className={cn('rounded-lg border border-gray-200 bg-slate-50/60 p-5', className)}>
      {children}
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
          className="h-8 border-gray-200 text-gray-700 hover:bg-gray-50"
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
          className="h-8 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
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
    <div
      className={cn(
        'mt-5 flex flex-wrap items-center gap-3 border-t border-gray-200 pt-5',
        className
      )}
    >
      {children}
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
        isOpen ? 'border-green-400 shadow-sm' : 'border-gray-200'
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'flex w-full items-center justify-between gap-4 p-4 text-left font-normal',
          typography.body,
          isOpen ? 'bg-green-50/40' : 'hover:bg-gray-50'
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
        <div className="space-y-4 border-t border-gray-200 bg-white p-4">{children}</div>
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
        'inline-block rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-sans',
        className
      )}
    >
      {children}
    </span>
  );
}
