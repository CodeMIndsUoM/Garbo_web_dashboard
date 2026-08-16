import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { InternalUsers } from '../src/components/InternalUsers';

// Mock dependencies
jest.mock('../src/lib/api', () => ({
  apiFetch: jest.fn().mockResolvedValue({
    response: { ok: true },
    data: {
      success: true,
      data: [
        {
          empId: 101,
          empName: 'Collector Bob',
          email: 'bob@garbo.local',
          role: 'FIELD_MENTOR',
          onDuty: true,
        },
        {
          empId: 102,
          empName: 'Collector Alice',
          email: 'alice@garbo.local',
          role: 'FIELD_MENTOR',
          onDuty: false,
        },
      ],
    },
  }),
}));

jest.mock('../src/lib/auth', () => ({
  isSuperadmin: () => false,
}));

jest.mock('../src/components/layout/PageHeader', () => ({
  PageHeader: () => <div>Page Header</div>,
}));

jest.mock('../src/components/layout/management-ui', () => ({
  PageSubSectionNav: () => <div>Section Nav</div>,
  FormPanel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  FormField: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  FormActions: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TableRowActions: () => <div>Actions</div>,
}));

describe('InternalUsers Staff Duty Status Badge Tests', () => {
  it('correctly displays on-duty status badges', async () => {
    render(<InternalUsers council={{ id: '1', name: 'Colombo' }} />);

    // Wait for the data fetch and table render
    const onDutyBadge = await screen.findByText('On duty');
    const offDutyBadge = await screen.findByText('Off duty');

    expect(onDutyBadge).toBeInTheDocument();
    expect(onDutyBadge.className).toContain('bg-green-100');

    expect(offDutyBadge).toBeInTheDocument();
    expect(offDutyBadge.className).toContain('bg-gray-100');
  });
});
