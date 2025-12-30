import { useEffect, useState } from 'react';
import { Dashboard } from './components/Dashboard';
import { CollectionSchedule } from './components/CollectionSchedule';
import { BinManagement } from './components/BinManagement';
import { WasteAnalytics } from './components/WasteAnalytics';
import { Reports } from './components/Reports';
import { Sidebar } from './components/Sidebar';
import { Login } from './components/Login';
import { AdminAssignment } from './components/AdminAssignment';
import { SuperadminCouncilSelect } from './components/SuperadminCouncilSelect';
import { Map } from './components/Map';
import { AllCouncilsWrapper } from './components/AllCouncilsWrapper';
import AdminEditPassword from './components/AdminEditPassword';
import CreateAdminPage from './components/CreateAdminPage';

export type PageType = 'home' | 'dashboard' | 'schedule' | 'bins' | 'map' | 'analytics' | 'reports' | 'admin-assignment' | 'admin-edit-password' | 'create-admin';

export default function App() {
  const [currentPage, setCurrentPage] = useState<PageType>('dashboard');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [checkingAuth, setCheckingAuth] = useState<boolean>(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [selectedCouncil, setSelectedCouncil] = useState<any>(null);
  // Mock councils for demo; replace with API call if needed
  const councils = [
    { id: '1', name: 'Colombo Municipal Council', description: 'Colombo city region' },
    { id: '2', name: 'Kandy Municipal Council', description: 'Kandy city region' },
    { id: '3', name: 'Galle Municipal Council', description: 'Galle city region' },
  ];

  const API_BASE = (import.meta as any).env?.VITE_API_BASE || 'http://localhost:8080';

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
        const res = await fetch(`${API_BASE}/api/auth/validate`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (res.ok && json?.success && json?.data === true) {
          setIsAuthenticated(true);
          // Get role from localStorage
          const role = localStorage.getItem('role');
          setUserRole(role);
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
  }, []);

  const handleLogout = async () => {
    const token = localStorage.getItem('token');
    try {
      if (token) {
        await fetch(`${API_BASE}/api/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch (err) {
      // ignore network errors on logout
    }

    localStorage.removeItem('token');
    localStorage.removeItem('admin');
    localStorage.removeItem('role');
    setIsAuthenticated(false);
    setUserRole(null);
  };

  const handleLogin = () => {
    setIsAuthenticated(true);
    setCurrentPage('dashboard');
    // Set userRole from localStorage after login
    const role = localStorage.getItem('role');
    setUserRole(role);
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
            onPageChange={page => {
              setCurrentPage(page);
              if (page === 'home') setSelectedCouncil(null);
            }}
            onLogout={handleLogout}
            userRole={userRole}
            selectedCouncil={selectedCouncil}
          />
          <main className="flex-1 overflow-auto">
            <AdminAssignment onAddNewAdmin={() => setCurrentPage('create-admin')} />
          </main>
        </div>
      );
    }
    // Show all councils' details inside each tab
    const renderAllCouncilsTab = () => {
      switch (currentPage) {
        case 'dashboard':
          return <Dashboard />;
        case 'schedule':
          return <CollectionSchedule />;
        case 'bins':
          return <BinManagement />;
        case 'map':
          return <Map />;
        case 'analytics':
          return <WasteAnalytics />;
        case 'reports':
          return <Reports />;
        default:
          return <Dashboard />;
      }
    };
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar
          currentPage={currentPage}
          onPageChange={page => {
            setCurrentPage(page);
            if (page === 'home') setSelectedCouncil(null);
          }}
          onLogout={handleLogout}
          userRole={userRole}
          selectedCouncil={selectedCouncil}
        />
        <main className="flex-1 overflow-auto">
          <div className="p-4 bg-gray-100 border-b text-lg font-semibold text-gray-700">
            All Municipal Councils
          </div>
          <SuperadminCouncilSelect councils={councils} onSelect={council => {
            setSelectedCouncil(council);
            setCurrentPage('dashboard');
          }} />
          <div className="mt-6">
            {renderAllCouncilsTab()}
          </div>
        </main>
      </div>
    );
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'schedule':
        return <CollectionSchedule />;
      case 'bins':
        return <BinManagement />;
      case 'map':
        return <Map />;
      case 'analytics':
        return <WasteAnalytics />;
      case 'reports':
        return <Reports />;
      case 'admin-assignment':
        return <AdminAssignment onAddNewAdmin={() => setCurrentPage('create-admin')} />;
      case 'admin-edit-password':
        return <AdminEditPassword />;
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
