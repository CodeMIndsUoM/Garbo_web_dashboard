'use client';

import { LayoutDashboard, Trash2, Truck, BarChart3, Map as MapIcon, Shield, UserCircle } from 'lucide-react';
import type { PageType, UserRole } from '@/app/page';

interface SidebarProps {
  currentPage: PageType;
  onPageChange: (page: PageType) => void;
  onLogout?: () => void;
  userRole?: UserRole | null;
  selectedCouncil?: { name?: string } | null;
}

export function Sidebar({ currentPage, onPageChange, onLogout, userRole, selectedCouncil }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard' as PageType, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'bins' as PageType, label: 'Bin Management', icon: Trash2 },
    { id: 'vehicles' as PageType, label: 'Vehicle Management', icon: Truck },
    { id: 'map' as PageType, label: 'Map', icon: MapIcon },
    { id: 'analytics' as PageType, label: 'Analytics', icon: BarChart3 },
    { id: 'external-users' as PageType, label: 'External Users', icon: UserCircle },
    { id: 'internal-users' as PageType, label: 'Internal Users', icon: Shield },
  ];

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
            <Trash2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-gray-900">Garbo</h1>
            <p className="text-xs text-gray-500">Management System</p>
          </div>
        </div>
        {/* Council name display */}
        {selectedCouncil && selectedCouncil.name && (
          <div className="mt-4 text-sm font-semibold text-green-700 truncate" title={selectedCouncil.name}>
            {selectedCouncil.name}
          </div>
        )}
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            
            return (
              <li key={item.id}>
                <button
                  onClick={() => onPageChange(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-green-50 text-green-700'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  <span className="whitespace-nowrap">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-gray-200">
        {userRole && (
          <div className={`rounded-xl border p-2 ${
            userRole === 'superadmin' ? 'bg-purple-50 border-purple-100' : 'bg-blue-50 border-blue-100'
          }`}>
            <button
              onClick={() => {
                if (userRole === 'superadmin') {
                  onPageChange('admin-assignment');
                }
                if (userRole === 'admin') {
                  onPageChange('admin-edit-password');
                }
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors select-none ${
                userRole === 'superadmin'
                  ? 'hover:bg-purple-100 cursor-pointer'
                  : 'hover:bg-blue-100 cursor-pointer'
              }`}
              disabled={userRole !== 'superadmin' && userRole !== 'admin'}
            >
              <Shield className={`w-4 h-4 shrink-0 ${
                userRole === 'superadmin' ? 'text-purple-600' : 'text-blue-600'
              }`} />
              <span className={`text-xs font-medium capitalize ${
                userRole === 'superadmin' ? 'text-purple-700' : 'text-blue-700'
              }`}>
                {userRole === 'superadmin' ? 'Superadmin' : 'Admin'}
              </span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
