'use client';

import React from 'react';
import { X } from 'lucide-react';

/** Shared glass side-panel shell used by History, Legend, and Route Planner on the map. */
export const MAP_SIDE_PANEL_BASE =
  'absolute right-4 top-20 bottom-4 w-[380px] max-w-[calc(100vw-2rem)] flex flex-col bg-white/70 backdrop-blur-md border border-white/30 rounded-2xl shadow-2xl transition-all duration-300 transform';

export function mapSidePanelState(open: boolean) {
  return open
    ? 'translate-x-0 opacity-100'
    : 'translate-x-[110%] opacity-0 pointer-events-none';
}

interface MapSidePanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  headerExtra?: React.ReactNode;
  bodyClassName?: string;
  zIndex?: number;
}

export function MapSidePanel({
  open,
  onClose,
  title,
  icon,
  children,
  footer,
  headerExtra,
  bodyClassName = 'overflow-y-auto',
  zIndex = 999,
}: MapSidePanelProps) {
  return (
    <div style={{ zIndex }} className={`${MAP_SIDE_PANEL_BASE} ${mapSidePanelState(open)}`}>
      <div className="p-5 border-b border-white/20 shrink-0 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {icon}
          <h3 className="text-sm font-bold text-slate-800 truncate">{title}</h3>
          {headerExtra}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-slate-200/50 text-slate-500 hover:text-slate-700 transition-colors shrink-0"
          aria-label="Close panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className={`flex-1 min-h-0 ${bodyClassName}`}>{children}</div>
      {footer ? (
        <div className="p-4 border-t border-white/20 shrink-0 bg-slate-50/20">{footer}</div>
      ) : null}
    </div>
  );
}
