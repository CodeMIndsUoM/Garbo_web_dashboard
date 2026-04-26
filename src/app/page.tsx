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
import dynamic from 'next/dynamic';

const MapView = dynamic(() => import('@/components/Map'), { ssr: false });

export type PageType = 'home' | 'dashboard' | 'schedule' | 'bins' | 'vehicles' | 'map' | 'analytics' | 'reports' | 'admin-assignment' | 'admin-edit-password' | 'create-admin';
export type UserRole = 'admin' | 'superadmin' | null;

export default function Home() {
  const [currentPage, setCurrentPage] = useState<PageType>('dashboard');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [checkingAuth, setCheckingAuth] = useState<boolean>(true);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [selectedCouncil, setSelectedCouncil] = useState<{ id: string; name: string; description?: string } | null>(null);

  // Mock councils for demo; replace with API call if needed
  const COUNCILS = [
    { id: 'colombo', name: 'Colombo Council' },
    { id: 'galle', name: 'Galle Council' },
    { id: 'matara', name: 'Matara Council' },
    { id: 'kandy', name: 'Kandy Council' },
    { id: 'gampaha', name: 'Gampaha Council' },
  ];

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8081';

  useEffect(() => {
    const checkToken = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setIsAuthenticated(false);
        setCheckingAuth(false);
        setUserRole(null);
        return;
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
        if (res.ok && json?.success && json?.data === true) {
          setIsAuthenticated(true);
          // Prefer role stored from token if available
          const payload = decodeJwtPayload(token);
          const roleFromToken = payload?.role || payload?.roles || null;
          const role = (roleFromToken as UserRole) || (localStorage.getItem('role') as UserRole);
          setUserRole(role);
          // If this is a regular admin, initialize selectedCouncil from localStorage if available
          if (role === 'admin') {
            try {
              const storedCouncil = localStorage.getItem('council');
              if (storedCouncil) setSelectedCouncil(JSON.parse(storedCouncil));
            } catch (e) {}
          }
        } else {
          localStorage.removeItem('token');
          localStorage.removeItem('admin');
          localStorage.removeItem('role');
          setIsAuthenticated(false);
          setUserRole(null);
        }
      } catch (err) {
        localStorage.removeItem('token');
        localStorage.removeItem('admin');
        localStorage.removeItem('role');
        setIsAuthenticated(false);
        setUserRole(null);
      }

      setCheckingAuth(false);
    };

    checkToken();
  }, [API_BASE]);

  const handleLogout = async () => {
    const token = localStorage.getItem('token');
    try {
      if (token) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        await fetch(`${API_BASE}/api/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
      }
    } catch (err) {
      // ignore network errors on logout
    }

    localStorage.removeItem('token');
    localStorage.removeItem('admin');
    localStorage.removeItem('role');
    localStorage.removeItem('council');
    setSelectedCouncil(null);
    
    setIsAuthenticated(false);
    setUserRole(null);
  };

  const handleLogin = (opts?: { mustChangePassword?: boolean }) => {
    setIsAuthenticated(true);
    // Prefer explicit flag passed from login response; fall back to localStorage for backward compatibility
    let mustChange = opts?.mustChangePassword;
    if (typeof mustChange === 'undefined') {
      try {
        mustChange = JSON.parse(localStorage.getItem('mustChangePassword') || 'false');
      } catch (e) {
        mustChange = false;
      }
    }

    if (mustChange) {
      setCurrentPage('admin-edit-password');
    } else {
      setCurrentPage('dashboard');
    }

    // Set userRole from localStorage after login
    const role = localStorage.getItem('role') as UserRole;
    setUserRole(role);
    // Initialize selectedCouncil for admin users from localStorage written by Login
    if (role === 'admin') {
      try {
        const stored = localStorage.getItem('council');
        if (stored) setSelectedCouncil(JSON.parse(stored));
        else setSelectedCouncil(null);
      } catch (e) {
        setSelectedCouncil(null);
      }
    }
  };

  const getActiveCouncil = () => {
    if (userRole === 'superadmin') return selectedCouncil;
    try {
      const stored = localStorage.getItem('council');
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      return null;
    }
  };

  // Navigation helper for opening the Create Admin page
  const openCreateAdmin = () => {
    setCurrentPage('create-admin');
  };
  

  if (checkingAuth) {
    return <div className="min-h-screen flex items-center justify-center">Checking authentication...</div>;
  }

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  // Superadmin: show sidebar and all-council summary if on 'home' tab or no council selected
  if (userRole === 'superadmin' && (currentPage === 'home' || !selectedCouncil)) {
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
            <AdminAssignment onAddNewAdmin={openCreateAdmin} />
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
              setSelectedCouncil(council);
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
        return <BinManagement council={getActiveCouncil()} />;
      case 'vehicles':
        return <VehicleManagement council={getActiveCouncil()} />;
      case 'map':
        return <MapView />;
      case 'analytics':
        return <WasteAnalytics />;
      case 'reports':
        return <Reports />;
      case 'admin-assignment':
        return <AdminAssignment onAddNewAdmin={openCreateAdmin} />;
      case 'admin-edit-password':
        return <AdminEditPassword onPasswordChanged={handleLogin} />;
      case 'create-admin':
        return <CreateAdminPage onBack={() => setCurrentPage('admin-assignment')} />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        onLogout={handleLogout}
        userRole={userRole}
        selectedCouncil={selectedCouncil}
      />
      <main className="flex-1 overflow-auto">
        {/* Show selected council name for superadmin */}
        {userRole === 'superadmin' && selectedCouncil && (
          <div className="p-4 bg-gray-100 border-b text-lg font-semibold text-gray-700">
            {selectedCouncil.name}
          </div>
        )}
        {renderPage()}
      </main>
    </div>
  );
}
