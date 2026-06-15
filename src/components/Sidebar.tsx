'use client';

import { LayoutDashboard, Trash2, Truck, Map as MapIcon, Shield, UserCircle, Trophy, FileText } from 'lucide-react';
import { AuthBrandLogo } from '@/components/brand/AuthBrandLogo';
import type { PageType, UserRole } from '@/app/page';

interface SidebarProps {
  currentPage: PageType;
  onPageChange: (page: PageType) => void;
  onLogout?: () => void;
  userRole?: UserRole | null;
  selectedCouncil?: { name?: string } | null;
}

const DASHBOARD_DRILL_PAGES: PageType[] = [
  'total-collection',
  'bin-analytics',
  'staff-analytics',
  'complaint-analytics',
  'third-party-analytics',
  'vehicle-analytics',
  'bin-report-analytics',
];

export function Sidebar({ currentPage, onPageChange, onLogout, userRole, selectedCouncil }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard' as PageType, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'bins' as PageType, label: 'Bin Management', icon: Trash2 },
    { id: 'vehicles' as PageType, label: 'Vehicle Management', icon: Truck },
    { id: 'map' as PageType, label: 'Map', icon: MapIcon },
    { id: 'reports' as PageType, label: 'Reports', icon: FileText },
    { id: 'external-users' as PageType, label: 'External Users', icon: UserCircle },
    { id: 'gamification' as PageType, label: 'Gamification', icon: Trophy },
    { id: 'internal-users' as PageType, label: 'Internal Users', icon: Shield },
  ];

  return (
    <aside className="flex w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="border-b border-sidebar-border p-6">
        <AuthBrandLogo size="sm" />
        {selectedCouncil && selectedCouncil.name && (
          <div
            className="mt-4 truncate text-sm font-semibold text-brand-700 dark:text-brand-muted-foreground"
            title={selectedCouncil.name}
          >
            {selectedCouncil.name}
          </div>
        )}
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.id === 'dashboard'
                ? currentPage === 'dashboard' || DASHBOARD_DRILL_PAGES.includes(currentPage)
                : currentPage === item.id;

            return (
              <li key={item.id}>
                <button
                  onClick={() => onPageChange(item.id)}
                  className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 transition-colors ${isActive
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground hover:bg-accent'
                    }`}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="whitespace-nowrap">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-sidebar-border p-4">
        {userRole && (
          <div
            className={`rounded-xl border p-2 ${userRole === 'superadmin'
                ? 'border-brand-200 bg-brand-muted dark:border-brand-200/30'
                : 'border-border bg-secondary'
              }`}
          >
            <button
              onClick={() => {
                if (userRole === 'superadmin') {
                  onPageChange('admin-assignment');
                } else if (userRole === 'admin') {
                  onPageChange('admin-edit-password');
                }
              }}
              className={`flex w-full cursor-pointer select-none items-center gap-2 rounded-lg px-3 py-2 transition-colors ${userRole === 'superadmin' ? 'hover:bg-brand-100 dark:hover:bg-brand-muted' : 'hover:bg-accent'
                }`}
            >
              <Shield
                className={`h-4 w-4 shrink-0 ${userRole === 'superadmin' ? 'text-brand-600 dark:text-brand-500' : 'text-status-info'
                  }`}
              />
              <span
                className={`text-xs font-medium capitalize ${userRole === 'superadmin' ? 'text-brand-700 dark:text-brand-muted-foreground' : 'text-foreground'
                  }`}
              >
                {userRole === 'superadmin' ? 'Superadmin' : 'Admin'}
              </span>
            </button>
            {userRole === 'superadmin' ? (
              <button
                onClick={() => onPageChange('admin-edit-password')}
                className="mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent"
              >
                Change password
              </button>
            ) : null}
          </div>
        )}
      </div>
    </aside>
  );
}
