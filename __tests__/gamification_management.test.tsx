import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { GamificationManagement } from '../src/components/GamificationManagement';

// Mock API fetch helper
const mockTasks = [
  {
    id: 1,
    code: 'T_01',
    title: 'Report Bins',
    description: 'Submit daily bin status reports',
    roleScope: 'FIELD_MENTOR',
    basePoints: 100,
    targetProgress: 5,
    status: 'PUBLISHED',
  },
  {
    id: 2,
    code: 'T_02',
    title: 'Complete Collection Route',
    description: 'Empty all bins on assigned route',
    roleScope: 'COLLECTOR',
    basePoints: 150,
    targetProgress: 1,
    status: 'PUBLISHED',
  },
];

global.fetch = jest.fn().mockImplementation((url: string) => {
  if (url.includes('/api/admins/gamification/tasks')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ success: true, data: mockTasks }),
    });
  }
  if (url.includes('/api/admins/gamification/families')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ success: true, data: [] }),
    });
  }
  return Promise.reject(new Error('Unknown url'));
});

jest.mock('../src/components/layout/PageHeader', () => ({
  PageHeader: () => <div>Page Header</div>,
}));

jest.mock('../src/components/layout/management-ui', () => ({
  FormPanel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  FormField: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  FormSelect: ({ children }: { children: React.ReactNode }) => <select>{children}</select>,
  CodeBadge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  DetailGrid: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DetailField: ({ label, value }: { label: string; value: string }) => (
    <div>
      <span>{label}: </span>
      <span>{value}</span>
    </div>
  ),
  ExpandableRow: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('GamificationManagement Page Tests', () => {
  it('correctly maps and renders task details in table rows', async () => {
    render(<GamificationManagement />);

    // Wait for mock fetch to complete and table rows to render
    const fieldMentorLabel = await screen.findByText('Field mentor');
    const collectorLabel = await screen.findByText('Collector');

    expect(fieldMentorLabel).toBeInTheDocument();
    expect(collectorLabel).toBeInTheDocument();

    expect(screen.getByText('Report Bins')).toBeInTheDocument();
    expect(screen.getByText('Complete Collection Route')).toBeInTheDocument();
  });
});
