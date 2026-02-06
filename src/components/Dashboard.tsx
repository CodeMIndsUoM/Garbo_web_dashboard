'use client';

import { Truck, Trash2, AlertTriangle, CheckCircle2, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const wasteData = [
  { date: 'Mon', organic: 45, recyclable: 30, general: 25 },
  { date: 'Tue', organic: 52, recyclable: 35, general: 28 },
  { date: 'Wed', organic: 48, recyclable: 38, general: 22 },
  { date: 'Thu', organic: 58, recyclable: 42, general: 30 },
  { date: 'Fri', organic: 55, recyclable: 45, general: 28 },
  { date: 'Sat', organic: 62, recyclable: 50, general: 35 },
  { date: 'Sun', organic: 60, recyclable: 48, general: 32 },
];

const recentCollections = [
  { id: 1, location: 'Downtown Area', time: '08:30 AM', status: 'completed', bins: 45 },
  { id: 2, location: 'Residential Zone A', time: '10:15 AM', status: 'completed', bins: 38 },
  { id: 3, location: 'Industrial Park', time: '02:30 PM', status: 'in-progress', bins: 22 },
  { id: 4, location: 'Shopping District', time: '04:00 PM', status: 'scheduled', bins: 31 },
];

export function Dashboard() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-gray-900 mb-2">Dashboard Overview</h2>
        <p className="text-gray-600">Monitor your waste management operations in real-time</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-gray-600">Total Collections</CardTitle>
            <Truck className="w-5 h-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-gray-900 mb-1">1,247</div>
            <div className="flex items-center gap-1 text-green-600 text-sm">
              <TrendingUp className="w-4 h-4" />
              <span>12% from last week</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-gray-600">Active Bins</CardTitle>
            <Trash2 className="w-5 h-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-gray-900 mb-1">856</div>
            <div className="flex items-center gap-1 text-green-600 text-sm">
              <TrendingUp className="w-4 h-4" />
              <span>5% increase</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-gray-600">Alerts</CardTitle>
            <AlertTriangle className="w-5 h-5 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-gray-900 mb-1">23</div>
            <div className="flex items-center gap-1 text-red-600 text-sm">
              <TrendingDown className="w-4 h-4" />
              <span>4 bins need attention</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-gray-600">Efficiency Rate</CardTitle>
            <CheckCircle2 className="w-5 h-5 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-gray-900 mb-1">94.2%</div>
            <div className="flex items-center gap-1 text-green-600 text-sm">
              <TrendingUp className="w-4 h-4" />
              <span>2.1% improvement</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Waste Collection Trend */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Weekly Waste Collection Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={wasteData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="organic" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.6} />
                <Area type="monotone" dataKey="recyclable" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
                <Area type="monotone" dataKey="general" stackId="1" stroke="#6b7280" fill="#6b7280" fillOpacity={0.6} />
              </AreaChart>
            </ResponsiveContainer>
            <div className="flex items-center justify-center gap-6 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-sm text-gray-600">Organic</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span className="text-sm text-gray-600">Recyclable</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
                <span className="text-sm text-gray-600">General</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Collections */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Collections</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentCollections.map((collection) => (
                <div key={collection.id} className="flex items-start gap-3 pb-4 border-b border-gray-100 last:border-0 last:pb-0">
                  <div className={`w-2 h-2 rounded-full mt-2 ${
                    collection.status === 'completed' ? 'bg-green-500' :
                    collection.status === 'in-progress' ? 'bg-blue-500' :
                    'bg-gray-300'
                  }`}></div>
                  <div className="flex-1">
                    <p className="text-gray-900">{collection.location}</p>
                    <p className="text-sm text-gray-500">{collection.time} • {collection.bins} bins</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
