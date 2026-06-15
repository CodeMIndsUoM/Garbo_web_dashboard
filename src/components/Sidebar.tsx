'use client';

import { LayoutDashboard, Trash2, Truck, Map as MapIcon, Shield, UserCircle, Trophy, FileText } from 'lucide-react';
import { GarboBrand } from '@/components/brand/GarboIcon';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { NotificationBell } from '@/components/NotificationBell';
import { useCouncil, type CouncilFilterId } from '@/lib/council-context';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/components/ui/utils';
import type { PageType, UserRole } from '@/app/page';

interface SidebarContentProps {
  currentPage: PageType;
  onPageChange: (page: PageType) => void;
  onLogout?: () => void;
  userRole?: UserRole | null;
  selectedCouncil?: { name?: string } | null;
  onNavigate?: () => void;
  showHeaderNotifications?: boolean;
  className?: string;
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

export function SidebarContent({
  currentPage,
  onPageChange,
  onLogout,
  userRole,
  selectedCouncil,
  onNavigate,
  showHeaderNotifications = true,
  className,
}: SidebarContentProps) {
  const { isSuperadmin, selectedCouncilId, setSelectedCouncilId, councils } = useCouncil();
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

  const handlePageChange = (page: PageType) => {
    onPageChange(page);
    onNavigate?.();
  };

  return (
    <div className={cn('flex h-full min-h-0 flex-col bg-sidebar text-sidebar-foreground', className)}>
      <div className="border-b border-sidebar-border p-4 md:p-6">
        <div className="flex items-center justify-between gap-3">
          <GarboBrand size="sm" />
          {showHeaderNotifications ? (
            <div className="ml-2 mt-0.5 flex shrink-0 items-center rounded-lg border border-border bg-card">
              <NotificationBell menuSide="bottom" menuAlign="center" sideOffset={12} alignOffset={10} />
            </div>
          ) : null}
        </div>
        {selectedCouncil && selectedCouncil.name && (
          <div
            className="mt-4 truncate text-sm font-semibold text-brand-700 dark:text-brand-muted-foreground"
            title={selectedCouncil.name}
          >
            {selectedCouncil.name}
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto p-3 md:p-4">
        <ul className="space-y-1.5 md:space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.id === 'dashboard'
                ? currentPage === 'dashboard' || DASHBOARD_DRILL_PAGES.includes(currentPage)
                : item.id === 'internal-users'
                  ? currentPage === 'internal-users' || currentPage === 'staff-notifications'
                  : currentPage === item.id;

            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => handlePageChange(item.id)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors md:px-4 md:py-3 ${isActive
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground hover:bg-accent'
                    }`}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="text-sm md:text-base">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-sidebar-border p-3 md:p-4">
        {userRole && (
          <div
            className={`rounded-xl border p-2 ${userRole === 'superadmin'
                ? 'border-brand-200 bg-brand-muted dark:border-brand-200/30'
                : 'border-border bg-secondary'
              }`}
          >
            <button
              type="button"
              onClick={() => {
                if (userRole === 'superadmin') {
                  handlePageChange('admin-assignment');
                } else if (userRole === 'admin') {
                  handlePageChange('admin-edit-password');
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
                type="button"
                onClick={() => handlePageChange('admin-edit-password')}
                className="mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent"
              >
                Change password
              </button>
            ) : null}
            {isSuperadmin ? (
              <div className="mt-2 px-1">
                <label
                  htmlFor="sidebar-council-filter"
                  className="mb-1.5 block px-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Council filter
                </label>
                <Select
                  value={selectedCouncilId}
                  onValueChange={(value) => setSelectedCouncilId(value as CouncilFilterId)}
                >
                  <SelectTrigger
                    id="sidebar-council-filter"
                    className="h-8 w-full rounded-lg border-border bg-card px-2 text-xs text-foreground shadow-sm"
                    aria-label="Select council"
                  >
                    <SelectValue placeholder="Select council" />
                  </SelectTrigger>
                  <SelectContent align="start" className="min-w-[12rem] border-border bg-popover text-popover-foreground">
                    <SelectItem value="all">All Councils</SelectItem>
                    {councils.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="mt-2 px-1">
              <ThemeToggle />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface SidebarProps {
  currentPage: PageType;
  onPageChange: (page: PageType) => void;
  onLogout?: () => void;
  userRole?: UserRole | null;
  selectedCouncil?: { name?: string } | null;
  className?: string;
}

export function Sidebar({
  currentPage,
  onPageChange,
  onLogout,
  userRole,
  selectedCouncil,
  className,
}: SidebarProps) {
  return (
    <aside
      className={cn(
        'hidden w-64 shrink-0 flex-col border-r border-sidebar-border md:flex',
        className,
      )}
    >
      <SidebarContent
        currentPage={currentPage}
        onPageChange={onPageChange}
        onLogout={onLogout}
        userRole={userRole}
        selectedCouncil={selectedCouncil}
      />
    </aside>
  );
}
