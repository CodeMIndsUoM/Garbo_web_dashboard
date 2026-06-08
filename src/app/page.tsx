'use client';

import { useEffect, useState } from 'react';
import { decodeJwtPayload } from '@/lib/jwt';
import { Dashboard } from '@/components/Dashboard';
import { CollectionSchedule } from '@/components/CollectionSchedule';
import { BinManagement } from '@/components/BinManagement';
import { VehicleManagement } from '@/components/VehicleManagement';
import { WasteAnalytics } from '@/components/WasteAnalytics';
import { Reports } from '@/components/Reports';
import { Sidebar } from '@/components/Sidebar';
import { Login } from '@/components/Login';
import { AdminAssignment } from '@/components/AdminAssignment';
import { SuperadminCouncilSelect } from '@/components/SuperadminCouncilSelect';
import AdminEditPassword from '@/components/AdminEditPassword';
import CreateAdminPage from '@/components/CreateAdminPage';
import { TotalCollection } from '@/components/TotalCollection';
import { BinAnalytics } from '@/components/BinAnalytics';
import { StaffAnalytics } from '@/components/StaffAnalytics';
import { ComplaintAnalytics } from '@/components/ComplaintAnalytics';
import { ThirdPartyAnalytics } from '@/components/ThirdPartyAnalytics';
import { VehicleAnalytics } from '@/components/VehicleAnalytics';
import { BinReportAnalytics } from '@/components/BinReportAnalytics';
import { CitizenManagement } from '@/components/CitizenManagement';
import { ThirdPartyCollectors } from '@/components/ThirdPartyCollectors';
import { GamificationManagement } from '@/components/GamificationManagement';
import { InternalUsers } from '@/components/InternalUsers';
import dynamic from 'next/dynamic';

const MapView = dynamic(() => import('@/components/Map'), { ssr: false });

export type PageType = 'home' | 'dashboard' | 'schedule' | 'bins' | 'map' |'vehicles' |'analytics' | 'citizen-management' | 'third-party-collectors' | 'gamification' | 'internal-users' | 'reports' | 'admin-assignment' | 'admin-edit-password' | 'create-admin' | 'total-collection' | 'bin-analytics' | 'staff-analytics' | 'complaint-analytics' | 'third-party-analytics' | 'vehicle-analytics' | 'bin-report-analytics';
export type UserRole = 'admin' | 'superadmin' | null;

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [currentPage, setCurrentPage] = useState<PageType>('dashboard');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [checkingAuth, setCheckingAuth] = useState<boolean>(true);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [selectedCouncil, setSelectedCouncil] = useState<{ id: string; name: string; description?: string } | null>(null);
  const [tabCouncilFilters, setTabCouncilFilters] = useState<Record<string, string>>({});

  // Mock councils for demo; replace with API call if needed
  const COUNCILS = [
    { id: 'colombo', name: 'Colombo' },
    { id: 'dehiwala-mt-lavinia', name: 'Dehiwala-Mt. Lavinia' },
    { id: 'kaduwela', name: 'Kaduwela' },
    { id: 'moratuwa', name: 'Moratuwa' },
    { id: 'sri-jayewardenepura-kotte', name: 'Sri Jayewardenepura Kotte' },
  ];

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

      // Client-side JWT expiration check
      try {
        const payload = decodeJwtPayload(token);
        if (payload && payload.exp) {
          const currentTimestamp = Math.floor(Date.now() / 1000);
          if (currentTimestamp >= payload.exp) {
            console.log('Token expired client-side');
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
        if (res.ok && (json?.success === true || json?.message === 'Token is valid')) {
          setIsAuthenticated(true);
          // Prefer role stored from token if available
          const payload = decodeJwtPayload(token);
          const roleFromToken = payload?.role || payload?.roles || null;
          const role = (roleFromToken as UserRole) || (sessionStorage.getItem('role') as UserRole);
          setUserRole(role);
          // If this is a regular admin, initialize selectedCouncil from sessionStorage if available
          if (role === 'admin') {
            try {
              const storedCouncil = sessionStorage.getItem('council');
              if (storedCouncil) setSelectedCouncil(JSON.parse(storedCouncil));
            } catch (e) {}
          }
        } else {
          sessionStorage.removeItem('token');
          sessionStorage.removeItem('admin');
          sessionStorage.removeItem('role');
          setIsAuthenticated(false);
          setUserRole(null);
        }
      } catch (err) {
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
    setSelectedCouncil(null);
    
    setIsAuthenticated(false);
    setUserRole(null);
  };

  const handleLogin = (opts?: { mustChangePassword?: boolean }) => {
    setIsAuthenticated(true);
    // Prefer explicit flag passed from login response; fall back to sessionStorage for backward compatibility
    let mustChange = opts?.mustChangePassword;
    if (typeof mustChange === 'undefined') {
      try {
        mustChange = JSON.parse(sessionStorage.getItem('mustChangePassword') || 'false');
      } catch (e) {
        mustChange = false;
      }
    }

    if (mustChange) {
      setCurrentPage('admin-edit-password');
    } else {
      setCurrentPage('dashboard');
    }

    // Set userRole from sessionStorage after login
    const role = sessionStorage.getItem('role') as UserRole;
    setUserRole(role);
    // Initialize selectedCouncil for admin users from sessionStorage written by Login
    if (role === 'admin') {
      try {
        const stored = sessionStorage.getItem('council');
        if (stored) setSelectedCouncil(JSON.parse(stored));
        else setSelectedCouncil(null);
      } catch (e) {
        setSelectedCouncil(null);
      }
    }
  };

  const getActiveCouncil = () => {
    if (userRole === 'superadmin') {
      const selectedId = tabCouncilFilters[currentPage];
      if (!selectedId || selectedId === 'all') return null;
      return COUNCILS.find((c) => c.id === selectedId) || null;
    }
    return selectedCouncil;
  };

  // Navigation helper for opening the Create Admin page
  const openCreateAdmin = () => {
    setCurrentPage('create-admin');
  };
  

  if (!mounted || checkingAuth) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  // Superadmin special pages around home/council selection
  if (userRole === 'superadmin' && (currentPage === 'home' || currentPage === 'admin-assignment' || currentPage === 'create-admin')) {
    // Special case: allow admin-assignment page to render as normal
    if (currentPage === 'admin-assignment') {
      return (
        <div className="flex h-screen bg-gray-50">
          <Sidebar
            currentPage={currentPage}
            onPageChange={(page) => {
              setCurrentPage(page);
              if (page === 'home') setSelectedCouncil(null);
            }}
            onLogout={handleLogout}
            userRole={userRole}
            selectedCouncil={selectedCouncil}
          />
          <main className="flex-1 overflow-auto">
            <AdminAssignment onAddNewAdmin={openCreateAdmin} onLogout={handleLogout} />
          </main>
        </div>
      );
    }

    // Allow explicit rendering of the Create Admin page even when no council is selected
    if (currentPage === 'create-admin') {
      return (
        <div className="flex h-screen bg-gray-50">
          <Sidebar
            currentPage={currentPage}
            onPageChange={(page) => {
              setCurrentPage(page);
              if (page === 'home') setSelectedCouncil(null);
            }}
            onLogout={handleLogout}
            userRole={userRole}
            selectedCouncil={selectedCouncil}
          />
          <main className="flex-1 overflow-auto">
            <CreateAdminPage onBack={() => setCurrentPage('admin-assignment')} />
          </main>
        </div>
      );
    }

    // Superadmin HOME: only show council selector and header (no dashboard content)

    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar
          currentPage={currentPage}
          onPageChange={(page) => {
            setCurrentPage(page);
            if (page === 'home') setSelectedCouncil(null);
          }}
          onLogout={handleLogout}
          userRole={userRole}
          selectedCouncil={selectedCouncil}
        />
        <main className="flex-1 overflow-auto">
          <div className="p-4 bg-gray-100 border-b text-lg font-semibold text-gray-700">
            All Councils
          </div>
          <SuperadminCouncilSelect
            councils={COUNCILS}
            onSelect={(council) => {
              setTabCouncilFilters((prev) => ({ ...prev, dashboard: council.id }));
              setCurrentPage('dashboard');
            }}
            onSelectAll={() => {
              setTabCouncilFilters((prev) => ({ ...prev, dashboard: 'all' }));
              setCurrentPage('dashboard');
            }}
          />
        </main>
      </div>
    );
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard council={getActiveCouncil()} />;
      case 'schedule':
        return <CollectionSchedule council={getActiveCouncil()} />;
      case 'bins':
        return <BinManagement council={getActiveCouncil()} userRole={userRole} />;
      case 'vehicles':
        return <VehicleManagement council={getActiveCouncil()} userRole={userRole} />;
      case 'map':
        return <MapView council={getActiveCouncil()} />;
      case 'analytics':
        return <WasteAnalytics onNavigate={(page) => setCurrentPage(page as PageType)} council={getActiveCouncil()} />;
      case 'citizen-management':
        return <CitizenManagement council={getActiveCouncil()} />;
      case 'third-party-collectors':
        return <ThirdPartyCollectors council={getActiveCouncil()} />;
      case 'gamification':
        return <GamificationManagement />;
      case 'internal-users':
        return <InternalUsers council={getActiveCouncil()} />;
      case 'total-collection':
        return <TotalCollection onBack={() => setCurrentPage('analytics')} council={getActiveCouncil()} />;
      case 'bin-analytics':
        return <BinAnalytics onBack={() => setCurrentPage('analytics')} onNavigate={(page) => setCurrentPage(page as PageType)} council={getActiveCouncil()} />;
      case 'staff-analytics':
        return <StaffAnalytics onBack={() => setCurrentPage('analytics')} council={getActiveCouncil()} />;
      case 'complaint-analytics':
      return <ComplaintAnalytics onBack={() => setCurrentPage('analytics')} council={getActiveCouncil()} />;
      case 'third-party-analytics':
      return <ThirdPartyAnalytics onBack={() => setCurrentPage('analytics')} council={getActiveCouncil()} />;
      case 'vehicle-analytics':
      return <VehicleAnalytics onBack={() => setCurrentPage('analytics')} council={getActiveCouncil()} />;
      case 'bin-report-analytics':
      return <BinReportAnalytics onBack={() => setCurrentPage('analytics')} council={getActiveCouncil()} />;
      case 'reports':
        return <Reports council={getActiveCouncil()} />;
      case 'admin-assignment':
        return <AdminAssignment onAddNewAdmin={openCreateAdmin} onLogout={handleLogout} />;
      case 'admin-edit-password':
        return <AdminEditPassword onPasswordChanged={handleLogin} onLogout={handleLogout} />;
      case 'create-admin':
        return <CreateAdminPage onBack={() => setCurrentPage('admin-assignment')} />;
      default:
        return <Dashboard onNavigate={(page) => setCurrentPage(page as PageType)} />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        onLogout={handleLogout}
        userRole={userRole}
        selectedCouncil={getActiveCouncil()}
      />
      <main className="flex-1 overflow-auto">
        {userRole === 'superadmin' && currentPage !== 'home' && (
          <div className="p-4 bg-gray-100 border-b text-sm flex items-center justify-between gap-4">
            <div className="text-gray-700 font-semibold">
              {getActiveCouncil()?.name || 'All Councils'}
            </div>
            <div className="flex items-center gap-2">
              <label className="text-gray-600">Council</label>
              <select
                className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-700"
                value={tabCouncilFilters[currentPage] || 'all'}
                onChange={(e) => setTabCouncilFilters((prev) => ({ ...prev, [currentPage]: e.target.value }))}
              >
                <option value="all">All Councils</option>
                {COUNCILS.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}
        {renderPage()}
      </main>
    </div>
  );
}