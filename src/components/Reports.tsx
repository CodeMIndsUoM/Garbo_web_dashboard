'use client';

import { FileText, Download, Calendar, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

const reports = [
  {
    id: 1,
    title: 'Monthly Collection Report - October 2025',
    type: 'Collection Summary',
    date: '2025-11-01',
    status: 'completed',
    size: '2.4 MB',
  },
  {
    id: 2,
    title: 'Recycling Performance Q3 2025',
    type: 'Recycling Analysis',
    date: '2025-10-15',
    status: 'completed',
    size: '1.8 MB',
  },
  {
    id: 3,
    title: 'Zone A Efficiency Report',
    type: 'Zone Performance',
    date: '2025-10-28',
    status: 'completed',
    size: '956 KB',
  },
  {
    id: 4,
    title: 'Equipment Maintenance Log',
    type: 'Maintenance',
    date: '2025-11-05',
    status: 'completed',
    size: '634 KB',
  },
  {
    id: 5,
    title: 'Environmental Impact Assessment',
    type: 'Sustainability',
    date: '2025-11-10',
    status: 'completed',
    size: '3.2 MB',
  },
  {
    id: 6,
    title: 'Weekly Operations Report - Week 46',
    type: 'Operations',
    date: '2025-11-15',
    status: 'in-progress',
    size: '-',
  },
];

const reportTypes = [
  {
    name: 'Collection Summary',
    count: 24,
    icon: FileText,
    color: 'bg-blue-100 text-blue-600',
  },
  {
    name: 'Recycling Analysis',
    count: 12,
    icon: FileText,
    color: 'bg-green-100 text-green-600',
  },
  {
    name: 'Zone Performance',
    count: 18,
    icon: FileText,
    color: 'bg-purple-100 text-purple-600',
  },
  {
    name: 'Sustainability',
    count: 8,
    icon: FileText,
    color: 'bg-emerald-100 text-emerald-600',
  },
];

export function Reports() {
  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-gray-900 mb-2">Reports</h2>
          <p className="text-gray-600">Generate and download system reports</p>
        </div>
        <Button className="bg-green-600 hover:bg-green-700">
          <FileText className="w-4 h-4 mr-2" />
          Generate Report
        </Button>
      </div>

      {/* Report Types Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {reportTypes.map((type) => {
          const Icon = type.icon;
          return (
            <Card key={type.name}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">{type.name}</p>
                    <p className="text-2xl text-gray-900">{type.count}</p>
                  </div>
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${type.color}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm">
              <Calendar className="w-4 h-4 mr-2" />
              Date Range
            </Button>
            <Button variant="outline" size="sm">
              <Filter className="w-4 h-4 mr-2" />
              Report Type
            </Button>
            <Button variant="outline" size="sm">
              <Filter className="w-4 h-4 mr-2" />
              Status
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Reports List */}
      <Card>
        <CardHeader>
          <CardTitle>Available Reports</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {reports.map((report) => (
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
                      <span>{report.type}</span>
                      <span>•</span>
                      <span>{new Date(report.date).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric',
                        year: 'numeric'
                      })}</span>
                      {report.size !== '-' && (
                        <>
                          <span>•</span>
                          <span>{report.size}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Badge
                    variant="secondary"
                    className={
                      report.status === 'completed'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-orange-100 text-orange-700'
                    }
                  >
                    {report.status === 'completed' ? 'Ready' : 'Processing'}
                  </Badge>
                  {report.status === 'completed' && (
                    <Button variant="outline" size="sm">
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
