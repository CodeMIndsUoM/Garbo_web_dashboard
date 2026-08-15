import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SecurityAudit } from '../src/components/SecurityAudit';

// Mock apiFetch for security logs and FIM endpoints
jest.mock('../src/lib/api', () => ({
  apiFetch: jest.fn().mockImplementation((path: string) => {
    if (path.includes('/api/admin/audit/file-changes')) {
      const mockLogLine = '{"ts":"2026-08-16T00:00:00Z","event":"FILE_WRITE_ATTEMPT","actor":"admin@garbo.local","ip":"127.0.0.1","request":"PUT /api/bins","target":"application-prod.yml","outcome":"SUCCESS","detail":"Updated database configurations","prevHash":"0000","sig":"abcd","entryHash":"efff"}';
      return Promise.resolve({
        response: { ok: true },
        data: { entries: [mockLogLine] },
      });
    }
    if (path.includes('/api/admin/audit/fim/status')) {
      return Promise.resolve({
        response: { ok: true },
        data: {
          healthy: false,
          monitoredFiles: [
            {
              filePath: 'application-prod.yml',
              healthy: false,
              currentHash: 'abc',
              issue: 'File hash mismatch (FIM Alert)',
            },
          ],
        },
      });
    }
    return Promise.reject(new Error('Unknown endpoint'));
  }),
}));

describe('SecurityAudit Page View Tests', () => {
  it('renders FIM alert banners and audit log tables', async () => {
    render(<SecurityAudit />);

    // Wait for mock fetch to render components
    const header = await screen.findByText('Security Audit & Governance');
    expect(header).toBeInTheDocument();

    const fimSection = await screen.findByText('File Integrity Monitor');
    expect(fimSection).toBeInTheDocument();

    // Verify FIM alert banner is rendered
    const alertText = await screen.findByText('File hash mismatch (FIM Alert)');
    expect(alertText).toBeInTheDocument();

    // Verify audit logs render actor and target
    const actorEmail = await screen.findByText('admin@garbo.local');
    expect(actorEmail).toBeInTheDocument();
    
    const targetFile = await screen.findByText('application-prod.yml');
    expect(targetFile).toBeInTheDocument();
  });
});
