'use client';

import { Trash2 } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import {
  GlassFormCard,
  GlassFormModal,
  GlassFormRow,
  GlassFormSelect,
  glassFieldCompactClass,
} from '../layout/management-ui';
import { cn } from '../ui/utils';

export type BinPriority = 'low' | 'medium' | 'high';

const PRIORITY_OPTIONS: { value: BinPriority; label: string; hint: string }[] = [
  { value: 'high', label: 'High', hint: 'Hospitals, schools, critical sites' },
  { value: 'medium', label: 'Medium', hint: 'Standard collection priority' },
  { value: 'low', label: 'Low', hint: 'Lower urgency areas' },
];

interface AddBinGlassModalProps {
  open: boolean;
  onClose: () => void;
  mode?: 'create' | 'edit';
  nextBinCode: string;
  onBinCodeChange?: (value: string) => void;
  location: string;
  onLocationChange: (value: string) => void;
  priority?: BinPriority;
  onPriorityChange?: (value: BinPriority) => void;
  type?: string;
  onTypeChange?: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  showTypeSelect?: boolean;
  zIndex?: number;
}

export function AddBinGlassModal({
  open,
  onClose,
  mode = 'create',
  nextBinCode,
  onBinCodeChange,
  location,
  onLocationChange,
  priority = 'medium',
  onPriorityChange,
  type = 'General Waste',
  onTypeChange,
  onSubmit,
  showTypeSelect = false,
  zIndex = 50,
}: AddBinGlassModalProps) {
  const formId = 'add-bin-glass-form';
  const isEdit = mode === 'edit';

  return (
    <GlassFormModal
      open={open}
      onClose={onClose}
      zIndex={zIndex}
      title={isEdit ? 'Edit Waste Bin' : 'Add New Waste Bin'}
      icon={<Trash2 className="size-5 shrink-0 text-brand-500" />}
      footer={
        <div className="flex w-full justify-end">
          <Button type="submit" form={formId} variant="brand" size="sm" className="w-full sm:w-auto">
            {isEdit ? 'Save Changes' : 'Save Bin'}
          </Button>
        </div>
      }
    >
      <form id={formId} onSubmit={onSubmit}>
        <GlassFormCard title={nextBinCode || (isEdit ? 'Edit bin' : 'New bin')} accentClass="bg-brand-500">
          <GlassFormRow label="Bin code:">
            <Input
              value={nextBinCode}
              disabled={!isEdit}
              onChange={(e) => onBinCodeChange?.(e.target.value)}
              className={cn(glassFieldCompactClass, 'w-[10rem] font-semibold', !isEdit && 'text-muted-foreground')}
            />
          </GlassFormRow>
          <GlassFormRow label="Location:">
            <Input
              placeholder="lat, lng"
              value={location}
              onChange={(e) => onLocationChange(e.target.value)}
              className={cn(glassFieldCompactClass, 'w-[10rem]')}
              required
            />
          </GlassFormRow>
          {showTypeSelect && onTypeChange ? (
            <GlassFormRow label="Type:">
              <GlassFormSelect
                value={type}
                onChange={(e) => onTypeChange(e.target.value)}
                className={cn(glassFieldCompactClass, 'h-9 w-[10rem]')}
              >
                <option value="General Waste">General Waste</option>
                <option value="Recyclables">Recyclables</option>
                <option value="Organic Waste">Organic Waste</option>
                <option value="Mixed Waste">Mixed Waste</option>
              </GlassFormSelect>
            </GlassFormRow>
          ) : null}
          {onPriorityChange ? (
            <GlassFormRow label="Priority:">
              <GlassFormSelect
                value={priority}
                onChange={(e) => onPriorityChange(e.target.value as BinPriority)}
                className={cn(glassFieldCompactClass, 'h-9 w-[10rem]')}
                aria-describedby="bin-priority-hint"
              >
                {PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </GlassFormSelect>
            </GlassFormRow>
          ) : null}
          {onPriorityChange ? (
            <p
              id="bin-priority-hint"
              className="rounded-lg border border-[var(--glass-border)] bg-[var(--glass-surface)] px-3 py-2 text-[10px] leading-relaxed text-[var(--glass-text-muted)]"
            >
              {PRIORITY_OPTIONS.find((o) => o.value === priority)?.hint ??
                'Set how urgently this bin should be collected — e.g. high for hospitals.'}
            </p>
          ) : null}
          {!isEdit ? (
            <p className="rounded-lg border border-[var(--glass-border)] bg-[var(--glass-surface)] px-3 py-2 text-[10px] leading-relaxed text-[var(--glass-text-muted)]">
              Zone is assigned automatically from coordinates when you save.
            </p>
          ) : null}
        </GlassFormCard>
      </form>
    </GlassFormModal>
  );
}
