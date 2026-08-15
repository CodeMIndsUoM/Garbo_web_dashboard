'use client';

import { useState, useEffect, useCallback } from 'react';
import { Shield, ShieldAlert, ShieldCheck, RefreshCw, FileText, CheckCircle2, AlertTriangle, Search, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { apiFetch } from '@/lib/api';

interface AuditEntry {
  ts: string;
  event: string;
  actor: string;
  ip: string;
  request: string;
  target: string;
  outcome: string;
  detail: string;
  prevHash: string;
  sig: string;
  entryHash: string;
}

interface IntegrityReport {
  ok: boolean;
  checkedEntries: number;
  issues: string[];
}

interface MonitoredFile {
  filePath: string;
  healthy: boolean;
  currentHash: string | null;
  issue: string | null;
}

interface FimStatus {
  healthy: boolean;
  monitoredFiles: MonitoredFile[];
}

export function SecurityAudit() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [integrity, setIntegrity] = useState<IntegrityReport | null>(null);
  const [fim, setFim] = useState<FimStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch all audit data and FIM status
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch file-change audit entries
      const { response: res1, data: data1 } = await apiFetch<{ entries: string[] }>('/api/admin/audit/file-changes?limit=100');
      if (!res1.ok) throw new Error(`Audit log fetch failed: ${res1.status}`);
      
      const parsedEntries: AuditEntry[] = (data1.entries || []).map((line: string) => {
        const fields: Record<string, string> = {};
        line.split('|').forEach(part => {
          const idx = part.indexOf('=');
          if (idx > 0) {
            fields[part.substring(0, idx).trim()] = part.substring(idx + 1).trim();
          }
        });
        return {
          ts: fields.ts || 'N/A',
          event: fields.event || 'N/A',
          actor: fields.actor || 'N/A',
          ip: fields.ip || 'N/A',
          request: fields.request || 'N/A',
          target: fields.target || 'N/A',
          outcome: fields.outcome || 'N/A',
          detail: fields.detail || 'N/A',
          prevHash: fields.prevHash || 'N/A',
          sig: fields.sig || 'N/A',
          entryHash: fields.entryHash || 'N/A',
        };
      });
      // Sort newest first
      parsedEntries.reverse();
      setEntries(parsedEntries);

      // 2. Fetch File Integrity Monitoring Status
      const { response: res2, data: data2 } = await apiFetch<FimStatus>('/api/admin/audit/fim/status');
      if (res2.ok) {
        setFim(data2);
      }

      // 3. Fetch general integrity status (without blocking UI)
      const { response: res3, data: data3 } = await apiFetch<IntegrityReport>('/api/admin/audit/file-changes/integrity');
      if (res3.ok) {
        setIntegrity(data3);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'An unexpected error occurred fetching security logs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Trigger manual cryptographic validation of active logs
  const handleVerifyLog = async () => {
    setVerifying(true);
    try {
      const { response, data } = await apiFetch<IntegrityReport>('/api/admin/audit/file-changes/integrity');
      if (!response.ok) throw new Error(`Verification failed: ${response.status}`);
      setIntegrity(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const filteredEntries = entries.filter(e => 
    e.actor.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.target.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.detail.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.ip.includes(searchTerm)
  );

  return (
    <div className="p-3 sm:p-4 md:p-8">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h2 className="text-gray-900 text-2xl font-bold">Security & Audit Logs</h2>
            {fim && !fim.healthy ? (
              <Badge className="bg-red-600 text-white animate-pulse">Intrusion Alert</Badge>
            ) : (
              <Badge className="bg-emerald-600 text-white">System Secure</Badge>
            )}
          </div>
          <p className="text-gray-600 mt-1">
            Real-time file integrity monitoring, cryptographic audit trail signatures, and tamper detection.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => void fetchData()} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh Logs
          </Button>
          <Button
            variant="default"
            className="bg-brand-600 text-white hover:bg-brand-700"
            onClick={() => void handleVerifyLog()}
            disabled={verifying}
          >
            <Shield className={`w-4 h-4 mr-2 ${verifying ? 'animate-spin' : ''}`} />
            Verify Log HMACs
          </Button>
        </div>
      </div>

      {/* Global Error message */}
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Grid of Top Status Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        
        {/* Panel 1: File Integrity Monitor Status */}
        <Card className={fim && !fim.healthy ? 'border-red-500 bg-red-50/10' : ''}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-md font-bold">File Integrity Monitor (FIM)</CardTitle>
              {fim && fim.healthy ? (
                <ShieldCheck className="w-6 h-6 text-emerald-600" />
              ) : (
                <ShieldAlert className="w-6 h-6 text-red-600 animate-bounce" />
              )}
            </div>
            <CardDescription>Baseline checks on critical files</CardDescription>
          </CardHeader>
          <CardContent>
            {fim ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">FIM Health</span>
                  <Badge className={fim.healthy ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}>
                    {fim.healthy ? 'INTEGRITY_OK' : 'TAMPERING_DETECTED'}
                  </Badge>
                </div>
                <div className="border-t border-border pt-3 space-y-2">
                  {fim.monitoredFiles.map((file, i) => (
                    <div key={i} className="flex flex-col gap-0.5 text-xs">
                      <div className="flex items-center justify-between font-medium">
                        <span className="truncate max-w-[200px]" title={file.filePath}>
                          {file.filePath.substring(file.filePath.lastIndexOf('\\') + 1)}
                        </span>
                        <span className={file.healthy ? 'text-emerald-600' : 'text-red-600 font-bold'}>
                          {file.healthy ? 'Secured' : file.issue || 'Failed'}
                        </span>
                      </div>
                      {file.currentHash && (
                        <div className="text-[10px] text-muted-foreground font-mono truncate">
                          SHA256: {file.currentHash}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-sm text-muted-foreground">Loading FIM metrics...</div>
            )}
          </CardContent>
        </Card>

        {/* Panel 2: Cryptographic HMAC Log Integrity */}
        <Card className={integrity && !integrity.ok ? 'border-red-500 bg-red-50/10' : ''}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-md font-bold">Cryptographic Log Chain</CardTitle>
              {integrity && integrity.ok ? (
                <ShieldCheck className="w-6 h-6 text-emerald-600" />
              ) : (
                <ShieldAlert className="w-6 h-6 text-red-600" />
              )}
            </div>
            <CardDescription>Active verification of local audit files</CardDescription>
          </CardHeader>
          <CardContent>
            {integrity ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Chain Status</span>
                  <Badge className={integrity.ok ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}>
                    {integrity.ok ? 'CHAIN_VALID' : 'CHAIN_BROKEN'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs border-t border-border pt-3">
                  <span className="text-muted-foreground">Verified Entries:</span>
                  <span className="font-semibold">{integrity.checkedEntries}</span>
                </div>
                {!integrity.ok && integrity.issues.length > 0 && (
                  <div className="mt-3 p-2 bg-red-50 border border-red-100 rounded text-red-700 text-[11px] max-h-[80px] overflow-y-auto">
                    <p className="font-bold mb-1">Detected Issues:</p>
                    <ul className="list-disc pl-3 space-y-0.5">
                      {integrity.issues.map((iss, i) => <li key={i}>{iss}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-4 text-sm text-muted-foreground">Running HMAC checks...</div>
            )}
          </CardContent>
        </Card>

        {/* Panel 3: Quick Stats */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-md font-bold">Audit Statistics</CardTitle>
              <Info className="w-6 h-6 text-brand-600" />
            </div>
            <CardDescription>Activity details in the last 100 logs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total Audits Displayed:</span>
                <span className="font-semibold">{entries.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Success Attempts:</span>
                <span className="font-semibold text-emerald-600">
                  {entries.filter(e => e.outcome === 'SUCCESS').length}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Failed Attempts / Alerts:</span>
                <span className={`font-semibold ${entries.filter(e => e.outcome === 'FAILED' || e.outcome === 'ALERT').length > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                  {entries.filter(e => e.outcome === 'FAILED' || e.outcome === 'ALERT').length}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Main Audit Entries Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>File Access Audit Logs</CardTitle>
              <CardDescription>Cryptographic log stream matching endpoints upload & fallback events</CardDescription>
            </div>
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search actor, path, details..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-xs font-semibold text-muted-foreground uppercase">
                  <th className="p-4">Timestamp</th>
                  <th className="p-4">Actor</th>
                  <th className="p-4">Client IP</th>
                  <th className="p-4">Action</th>
                  <th className="p-4">Target File</th>
                  <th className="p-4">Outcome</th>
                  <th className="p-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {filteredEntries.length > 0 ? (
                  filteredEntries.map((e, index) => (
                    <tr key={index} className="hover:bg-muted/10 transition-colors">
                      <td className="p-4 whitespace-nowrap text-xs text-muted-foreground">
                        {e.ts}
                      </td>
                      <td className="p-4 font-medium">{e.actor}</td>
                      <td className="p-4 text-xs font-mono">{e.ip}</td>
                      <td className="p-4 text-xs">
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {e.event}
                        </Badge>
                      </td>
                      <td className="p-4 text-xs font-mono max-w-[200px] truncate" title={e.target}>
                        {e.target}
                      </td>
                      <td className="p-4">
                        <Badge
                          className={
                            e.outcome === 'SUCCESS' 
                              ? 'bg-emerald-100 text-emerald-800' 
                              : e.outcome === 'FAILED'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-amber-100 text-amber-800'
                          }
                        >
                          {e.outcome}
                        </Badge>
                      </td>
                      <td className="p-4 text-xs text-muted-foreground max-w-[300px] truncate" title={e.detail}>
                        {e.detail}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground text-sm">
                      {loading ? 'Fetching log events...' : 'No audit log entries matching criteria.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
