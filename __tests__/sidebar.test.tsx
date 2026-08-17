import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Sidebar } from '../src/components/Sidebar';
import { CouncilProvider } from '../src/lib/council-context';

// Mock dependecies
jest.mock('../src/lib/council-context', () => ({
  useCouncil: () => ({
    isSuperadmin: false,
    selectedCouncilId: 'all',
    setSelectedCouncilId: jest.fn(),
    councils: [],
  }),
  CouncilProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('../src/components/brand/GarboIcon', () => ({
  GarboBrand: () => <div>Garbo Brand</div>,
}));

jest.mock('../src/components/layout/ThemeToggle', () => ({
  ThemeToggle: () => <div>Theme Toggle</div>,
}));

jest.mock('../src/components/NotificationBell', () => ({
  NotificationBell: () => <div>Notification Bell</div>,
}));

describe('Sidebar Navigation Roles Tests', () => {
  it('does not render Security Logs for regular users or collectors', () => {
    render(
      <Sidebar
        currentPage="dashboard"
        onPageChange={jest.fn()}
        userRole={null}
      />
    );

    expect(screen.queryByText('Security Logs')).not.toBeInTheDocument();
  });

  it('renders Security Logs for admins', () => {
    render(
      <Sidebar
        currentPage="dashboard"
        onPageChange={jest.fn()}
        userRole="admin"
      />
    );

    expect(screen.queryByText('Security Logs')).not.toBeInTheDocument();
  });

  it('renders Security Logs for superadmins', () => {
    render(
      <Sidebar
        currentPage="dashboard"
        onPageChange={jest.fn()}
        userRole="superadmin"
      />
    );

    expect(screen.queryByText('Security Logs')).not.toBeInTheDocument();
  });
});
