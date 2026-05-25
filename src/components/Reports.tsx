'use client';

import { useState, useEffect } from 'react';
import { FileText, Download, Loader2, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ReportPrintView } from './Reportprintview';

// Summary rows returned from the reports list endpoint.
interface ReportSummary {
  id:              number;
  title:           string;
  periodStart:     string;
  periodEnd:       string;
  status:          string;
  createdAt:       string;
  fileSizeKb:      number;
  periodLabel:     string;
  fileSizeDisplay: string;
}

// Full report payload returned when opening one report by id.
interface ReportDetail {
  id:          number;
  title:       string;
  periodLabel: string;
  snapshot:    any;
}

// Council context provided by parent views for scoped report generation.
interface Council {
  id:           string;
  name:         string;
  description?: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8081';

export function Reports({ council }: { council?: Council | null }) {

  // Main view state: list, loading flags, selected report, and UI error text.
  const [reports, setReports]             = useState<ReportSummary[]>([]);
  const [loading, setLoading]             = useState(true);
  const [generating, setGenerating]       = useState(false);
  const [openReport, setOpenReport]       = useState<ReportDetail | null>(null);
  const [loadingReport, setLoadingReport] = useState<number | null>(null);
  const [error, setError]                 = useState<string | null>(null);

  // Fetch report list on first mount so the table is populated immediately.
  useEffect(() => { fetchReports(); }, []);

  // Loads all generated reports for the current admin scope.
  async function fetchReports() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/reports`);
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data: ReportSummary[] = await res.json();
      setReports(data);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  }

  // Creates a new report on the backend, then refreshes the list.
  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (council?.name) params.set('councilId', council.name);

      const res = await fetch(
        `${API_BASE}/api/admin/reports/generate?${params.toString()}`,
        { method: 'POST' }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message ?? `Server error: ${res.status}`);
      }
      await fetchReports();
    } catch (e: any) {
      setError(e.message ?? 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  }

  // Fetches one report snapshot and opens the print/view modal.
  async function handleOpen(id: number) {
    setLoadingReport(id);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/reports/${id}`);
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const detail: ReportDetail = await res.json();
      setOpenReport(detail);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load report');
    } finally {
      setLoadingReport(null);
    }
  }

  // Triggers a browser download for the raw JSON snapshot file.
  function handleDownload(id: number, title: string) {
    const a = document.createElement('a');
    a.href = `${API_BASE}/api/admin/reports/${id}/download`;
    a.download = `${title.replace(/\s+/g, '_')}.json`;
    a.click();
  }

  // Derived dashboard stats shown in the top card row.
  const completed   = reports.filter(r => r.status === 'COMPLETED').length;
  const totalSizeKb = reports.reduce((s, r) => s + (r.fileSizeKb ?? 0), 0);
  const avgSizeKb   = reports.length > 0 ? Math.round(totalSizeKb / reports.length) : 0;
  const formatKb    = (kb: number) => kb < 1024 ? `${kb} KB` : `${(kb / 1024).toFixed(1)} MB`;

  // Static descriptors for the stat cards, fed by derived values above.
  const statCards = [
    { label: 'Total Reports',       value: reports.length },
    { label: 'Avg Report Size',     value: avgSizeKb > 0 ? formatKb(avgSizeKb) : '—' },
    { label: 'Completed This Year', value: completed },
    { label: 'Storage Used',        value: totalSizeKb > 0 ? formatKb(totalSizeKb) : '—' },
  ];

  return (
    <div className="p-8">

      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-gray-900 mb-2">Monthly Reports</h2>
          <p className="text-gray-600">
            {council?.name
              ? `${council.name} — generate and download monthly analytics summaries`
              : 'Generate and download monthly analytics summaries'}
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={fetchReports} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            className="bg-green-600 hover:bg-green-700"
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating…</>
              : <><FileText className="w-4 h-4 mr-2" />Generate Report</>
            }
          </Button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {statCards.map(s => (
          <Card key={s.label}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">{s.label}</p>
                  <p className="text-2xl text-gray-900">{s.value}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Reports list */}
      <Card>
        <CardHeader>
          <CardTitle>Available Reports</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Loading, empty, and populated states keep list UX predictable. */}
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              Loading reports…
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No reports yet. Click <strong>Generate Report</strong> to create the first one.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reports.map(report => (
                <div
                  key={report.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                      <FileText className="w-6 h-6 text-gray-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-gray-900 mb-1">{report.title}</h3>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span>{report.periodLabel}</span>
                        <span>•</span>
                        <span>{new Date(report.createdAt).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric',
                        })}</span>
                        {report.fileSizeDisplay && report.fileSizeDisplay !== '-' && (
                          <><span>•</span><span>{report.fileSizeDisplay}</span></>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Only completed reports are printable/downloadable. */}
                    <Badge
                      variant="secondary"
                      className={report.status === 'COMPLETED'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-orange-100 text-orange-700'}
                    >
                      {report.status === 'COMPLETED' ? 'Ready' : report.status}
                    </Badge>

                    {report.status === 'COMPLETED' && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpen(report.id)}
                          disabled={loadingReport === report.id}
                        >
                          {loadingReport === report.id
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : '🖨 Print / View'
                          }
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownload(report.id, report.title)}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          JSON
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Print preview modal */}
      {openReport && (
        <ReportPrintView
          snapshot={openReport.snapshot}
          reportId={openReport.id}
          onClose={() => setOpenReport(null)}
        />
      )}
    </div>
  );
}