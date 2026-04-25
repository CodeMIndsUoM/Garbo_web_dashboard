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
    title: 'Monthly Collection Report - September 2025',
    type: 'Collection Summary',
    date: '2025-10-01',
    status: 'completed',
    size: '2.1 MB',
  },
  {
    id: 3,
    title: 'Monthly Collection Report - August 2025',
    type: 'Collection Summary',
    date: '2025-09-01',
    status: 'completed',
    size: '1.9 MB',
  },
  {
    id: 4,
    title: 'Monthly Collection Report - July 2025',
    type: 'Collection Summary',
    date: '2025-08-01',
    status: 'completed',
    size: '2.2 MB',
  },
  {
    id: 5,
    title: 'Monthly Collection Report - June 2025',
    type: 'Collection Summary',
    date: '2025-07-01',
    status: 'completed',
    size: '2.0 MB',
  },
];

const reportTypes = [
  {
    name: 'Total Monthly Reports',
    count: 24,
    icon: FileText,
    color: 'bg-blue-100 text-blue-600',
  },
  {
    name: 'Avg Report Size',
    count: '2.1 MB',
    icon: FileText,
    color: 'bg-green-100 text-green-600',
  },
  {
    name: 'Completed This Year',
    count: 10,
    icon: FileText,
    color: 'bg-purple-100 text-purple-600',
  },
  {
    name: 'Storage Used',
    count: '52 MB',
    icon: FileText,
    color: 'bg-emerald-100 text-emerald-600',
  },
];

export function Reports() {
  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-gray-900 mb-2">Monthly Reports</h2>
          <p className="text-gray-600">Access and download monthly collection summaries</p>
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
