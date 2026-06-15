'use client';

import { useEffect, useState } from 'react';
import { Menu } from 'lucide-react';
import { Sidebar, SidebarContent } from '@/components/Sidebar';
import { NotificationBell } from '@/components/NotificationBell';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { layout } from '@/theme/layout';
import { cn } from '@/components/ui/utils';
import type { PageType, UserRole } from '@/app/page';

const PAGE_LABELS: Partial<Record<PageType, string>> = {
  dashboard: 'Dashboard',
  bins: 'Bin Management',
  vehicles: 'Vehicle Management',
  map: 'Map',
  reports: 'Reports',
  'external-users': 'External Users',
  gamification: 'Gamification',
  'internal-users': 'Internal Users',
  'staff-notifications': 'Staff Notifications',
  'total-collection': 'Collection Analytics',
  'bin-analytics': 'Bin Analytics',
  'staff-analytics': 'Staff Analytics',
  'complaint-analytics': 'Complaint Analytics',
  'third-party-analytics': 'Third Party Analytics',
  'vehicle-analytics': 'Vehicle Analytics',
  'bin-report-analytics': 'Bin Report Analytics',
  'admin-assignment': 'Admin Assignment',
  'admin-edit-password': 'Change Password',
  'create-admin': 'Create Admin',
};

interface DashboardShellProps {
  currentPage: PageType;
  setCurrentPage: (page: PageType) => void;
  userRole: UserRole;
  onLogout: () => void;
  selectedCouncil?: { name?: string } | null;
  children: React.ReactNode;
}

export function DashboardShell({
  currentPage,
  setCurrentPage,
  userRole,
  onLogout,
  selectedCouncil,
  children,
}: DashboardShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [currentPage]);

  const pageTitle = PAGE_LABELS[currentPage] ?? 'Dashboard';

  return (
    <div className="flex h-[100dvh] min-h-screen bg-background">
      <Sidebar
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        onLogout={onLogout}
        userRole={userRole}
        selectedCouncil={selectedCouncil}
      />

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-[min(100vw,280px)] gap-0 p-0 sm:max-w-[280px]">
          <SheetTitle className="sr-only">Navigation menu</SheetTitle>
          <SidebarContent
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            onLogout={onLogout}
            userRole={userRole}
            selectedCouncil={selectedCouncil}
            onNavigate={() => setMobileNavOpen(false)}
            showHeaderNotifications={false}
          />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-50 flex shrink-0 items-center gap-2.5 border-b border-border bg-[var(--surface-topbar)] px-3 pb-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] shadow-sm md:hidden">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0"
            aria-label="Open navigation menu"
            onClick={() => setMobileNavOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{pageTitle}</p>
            {selectedCouncil?.name ? (
              <p className="truncate text-xs text-muted-foreground">{selectedCouncil.name}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center rounded-lg border border-border bg-card">
            <NotificationBell menuSide="bottom" menuAlign="end" sideOffset={8} alignOffset={0} />
          </div>
        </header>

        <main className={cn('relative min-w-0 flex-1 overflow-x-hidden overflow-y-auto pb-[env(safe-area-inset-bottom)]', layout.page)}>
          {children}
        </main>
      </div>
    </div>
  );
}
