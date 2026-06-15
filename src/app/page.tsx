'use client';

import { useEffect, useState } from 'react';
import { decodeJwtPayload } from '@/lib/jwt';
import {
  CouncilProvider,
  CouncilTopBar,
  useCouncil,
  type Council,
} from '@/lib/council-context';
import { Dashboard } from '@/components/Dashboard';
import { BinManagement } from '@/components/BinManagement';
import { VehicleManagement } from '@/components/VehicleManagement';
import { Reports } from '@/components/Reports';
import { Sidebar } from '@/components/Sidebar';
import { Login } from '@/components/Login';
import { AdminAssignment } from '@/components/AdminAssignment';
import AdminEditPassword from '@/components/AdminEditPassword';
import CreateAdminPage from '@/components/CreateAdminPage';
import { TotalCollection } from '@/components/TotalCollection';
import { BinAnalytics } from '@/components/BinAnalytics';
import { StaffAnalytics } from '@/components/StaffAnalytics';
import { ComplaintAnalytics } from '@/components/ComplaintAnalytics';
import { ThirdPartyAnalytics } from '@/components/ThirdPartyAnalytics';
import { VehicleAnalytics } from '@/components/VehicleAnalytics';
import { BinReportAnalytics } from '@/components/BinReportAnalytics';
import { ExternalUsers } from '@/components/ExternalUsers';
import { GamificationManagement } from '@/components/GamificationManagement';
import { InternalUsers } from '@/components/InternalUsers';
import dynamic from 'next/dynamic';

const MapView = dynamic(() => import('@/components/Map'), { ssr: false });

export type PageType =
  | 'dashboard'
  | 'bins'
  | 'map'
  | 'vehicles'
  | 'external-users'
  | 'gamification'
  | 'internal-users'
  | 'reports'
  | 'admin-assignment'
  | 'admin-edit-password'
  | 'create-admin'
  | 'total-collection'
  | 'bin-analytics'
  | 'staff-analytics'
  | 'complaint-analytics'
  | 'third-party-analytics'
  | 'vehicle-analytics'
  | 'bin-report-analytics';
export type UserRole = 'admin' | 'superadmin' | null;

interface AuthenticatedShellProps {
  currentPage: PageType;
  setCurrentPage: (page: PageType) => void;
  userRole: UserRole;
  onLogout: () => void;
  onLoginAfterPasswordChange: (opts?: { mustChangePassword?: boolean }) => void;
}

function AuthenticatedShell({
  currentPage,
  setCurrentPage,
  userRole,
  onLogout,
  onLoginAfterPasswordChange,
}: AuthenticatedShellProps) {
  const { activeCouncil } = useCouncil();

  const openCreateAdmin = () => {
    setCurrentPage('create-admin');
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return (
          <Dashboard
            onNavigate={(page) => setCurrentPage(page as PageType)}
            council={activeCouncil}
          />
        );
      case 'bins':
        return (
          <BinManagement council={activeCouncil} userRole={userRole} />
        );
      case 'vehicles':
        return (
          <VehicleManagement council={activeCouncil} userRole={userRole} />
        );
      case 'map':
        return <MapView council={activeCouncil} />;
      case 'external-users':
        return <ExternalUsers council={activeCouncil} onNavigateToMap={() => setCurrentPage('map')} />;
      case 'gamification':
        return <GamificationManagement />;
      case 'internal-users':
        return <InternalUsers council={activeCouncil} />;
      case 'total-collection':
        return (
          <TotalCollection
            onBack={() => setCurrentPage('dashboard')}
            council={activeCouncil}
          />
        );
      case 'bin-analytics':
        return (
          <BinAnalytics
            onBack={() => setCurrentPage('dashboard')}
            onNavigate={(page) => setCurrentPage(page as PageType)}
            council={activeCouncil}
          />
        );
      case 'staff-analytics':
        return (
          <StaffAnalytics
            onBack={() => setCurrentPage('dashboard')}
            council={activeCouncil}
          />
        );
      case 'complaint-analytics':
        return (
          <ComplaintAnalytics
            onBack={() => setCurrentPage('dashboard')}
            council={activeCouncil}
          />
        );
      case 'third-party-analytics':
        return (
          <ThirdPartyAnalytics
            onBack={() => setCurrentPage('dashboard')}
            council={activeCouncil}
          />
        );
      case 'vehicle-analytics':
        return (
          <VehicleAnalytics
            onBack={() => setCurrentPage('dashboard')}
            council={activeCouncil}
          />
        );
      case 'bin-report-analytics':
        return (
          <BinReportAnalytics
            onBack={() => setCurrentPage('dashboard')}
            council={activeCouncil}
          />
        );
      case 'reports':
        return <Reports council={activeCouncil} />;
      case 'admin-assignment':
        return (
          <AdminAssignment
            onAddNewAdmin={openCreateAdmin}
            onLogout={onLogout}
          />
        );
      case 'admin-edit-password':
        return (
          <AdminEditPassword
            onPasswordChanged={onLoginAfterPasswordChange}
            onLogout={onLogout}
          />
        );
      case 'create-admin':
        return (
          <CreateAdminPage onBack={() => setCurrentPage('admin-assignment')} />
        );
      default:
        return (
          <Dashboard
            onNavigate={(page) => setCurrentPage(page as PageType)}
            council={activeCouncil}
          />
        );
    }
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        onLogout={onLogout}
        userRole={userRole}
        selectedCouncil={activeCouncil}
      />
      <main className="flex-1 overflow-auto">
        <CouncilTopBar />
        {renderPage()}
      </main>
    </div>
  );
}

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [currentPage, setCurrentPage] = useState<PageType>('dashboard');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [checkingAuth, setCheckingAuth] = useState<boolean>(true);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [lockedCouncil, setLockedCouncil] = useState<Council | null>(null);

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8081';

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const checkToken = async () => {
      const token = sessionStorage.getItem('token');
      if (!token) {
        setIsAuthenticated(false);
        setCheckingAuth(false);
        setUserRole(null);
        return;
      }

      try {
        const payload = decodeJwtPayload(token);
        if (payload && payload.exp) {
          const currentTimestamp = Math.floor(Date.now() / 1000);
          if (currentTimestamp >= payload.exp) {
            sessionStorage.removeItem('token');
            sessionStorage.removeItem('admin');
            sessionStorage.removeItem('role');
            sessionStorage.removeItem('council');
            setIsAuthenticated(false);
            setUserRole(null);
            setCheckingAuth(false);
            return;
          }
        }
      } catch (e) {
        console.error('Failed to parse token client-side', e);
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const res = await fetch(`${API_BASE}/api/auth/validate`, {
          headers: { Authorization: `Bearer ${token}` },
          method: 'GET',
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const json = await res.json();
        if (
          res.ok &&
          (json?.success === true || json?.message === 'Token is valid')
        ) {
          setIsAuthenticated(true);
          const payload = decodeJwtPayload(token);
          const roleFromToken = payload?.role || payload?.roles || null;
          const role =
            (roleFromToken as UserRole) ||
            (sessionStorage.getItem('role') as UserRole);
          setUserRole(role);
          if (role === 'admin') {
            try {
              const storedCouncil = sessionStorage.getItem('council');
              if (storedCouncil) setLockedCouncil(JSON.parse(storedCouncil));
            } catch {
              setLockedCouncil(null);
            }
          }
        } else {
          sessionStorage.removeItem('token');
          sessionStorage.removeItem('admin');
          sessionStorage.removeItem('role');
          setIsAuthenticated(false);
          setUserRole(null);
        }
      } catch {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('admin');
        sessionStorage.removeItem('role');
        setIsAuthenticated(false);
        setUserRole(null);
      }

      setCheckingAuth(false);
    };

    checkToken();
  }, [API_BASE, mounted]);

  const handleLogout = async () => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('admin');
    sessionStorage.removeItem('role');
    sessionStorage.removeItem('council');
    setLockedCouncil(null);
    setIsAuthenticated(false);
    setUserRole(null);
  };

  const handleLogin = (opts?: { mustChangePassword?: boolean }) => {
    setIsAuthenticated(true);
    let mustChange = opts?.mustChangePassword;
    if (typeof mustChange === 'undefined') {
      try {
        mustChange = JSON.parse(
          sessionStorage.getItem('mustChangePassword') || 'false'
        );
      } catch {
        mustChange = false;
      }
    }

    if (mustChange) {
      setCurrentPage('admin-edit-password');
    } else {
      setCurrentPage('dashboard');
    }

    const role = sessionStorage.getItem('role') as UserRole;
    setUserRole(role);
    if (role === 'admin') {
      try {
        const stored = sessionStorage.getItem('council');
        if (stored) setLockedCouncil(JSON.parse(stored));
        else setLockedCouncil(null);
      } catch {
        setLockedCouncil(null);
      }
    } else {
      setLockedCouncil(null);
    }
  };

  if (!mounted || checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Checking authentication...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <CouncilProvider userRole={userRole} lockedCouncil={lockedCouncil}>
      <AuthenticatedShell
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        userRole={userRole}
        onLogout={handleLogout}
        onLoginAfterPasswordChange={handleLogin}
      />
    </CouncilProvider>
  );
}
