'use client';

// Toggle control for switching between table and card layout on admin lists.
import { LayoutGrid, Table2 } from 'lucide-react';
import type { AdminViewMode } from '../lib/useAdminViewMode';

export function ViewModeToggle({
  viewMode,
  onChange,
}: {
  viewMode: AdminViewMode;
  onChange: (mode: AdminViewMode) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
      <button
        type="button"
        onClick={() => onChange('table')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          viewMode === 'table' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'
        }`}
        title="Table view"
      >
        <Table2 className="w-4 h-4" />
        Table
      </button>
      <button
        type="button"
        onClick={() => onChange('card')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          viewMode === 'card' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'
        }`}
        title="Card view"
      >
        <LayoutGrid className="w-4 h-4" />
        Cards
      </button>
    </div>
  );
}
