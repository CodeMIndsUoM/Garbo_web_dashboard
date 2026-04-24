'use client';

import { TrendingUp, Recycle, Trash2, Leaf, Route, Users, Truck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

const monthlyData = [
  { month: 'Jan', organic: 120, recyclable: 85, general: 95 },
  { month: 'Feb', organic: 135, recyclable: 92, general: 88 },
  { month: 'Mar', organic: 148, recyclable: 98, general: 92 },
  { month: 'Apr', organic: 155, recyclable: 105, general: 85 },
  { month: 'May', organic: 168, recyclable: 115, general: 90 },
  { month: 'Jun', organic: 175, recyclable: 122, general: 88 },
];

const wasteTypeData = [
  { name: 'Organic', value: 45, color: '#10b981' },
  { name: 'Recyclable', value: 35, color: '#3b82f6' },
  { name: 'General', value: 20, color: '#6b7280' },
];

const zoneData = [
  { zone: 'Zone A', collected: 245 },
  { zone: 'Zone B', collected: 198 },
  { zone: 'Zone C', collected: 312 },
  { zone: 'Zone D', collected: 276 },
  { zone: 'Zone E', collected: 189 },
];

export function WasteAnalytics({ onNavigate }: { onNavigate?: (page: string) => void }) {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">Waste Analytics</h1>
        <p className="text-gray-500 text-lg">Detailed insights and trends from waste collection operations</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card
          className="hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-none bg-gradient-to-br from-white to-blue-50/30 shadow-md ring-1 ring-gray-100 relative overflow-hidden group cursor-pointer"
          onClick={() => onNavigate?.('total-collection')}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Total Collected</CardTitle>
            <div className="p-2.5 bg-blue-50 rounded-xl group-hover:bg-blue-100 transition-colors shadow-sm">
              <Trash2 className="w-5 h-5 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">1,245 <span className="text-base font-medium text-gray-500">tons</span></div>
            <div className="flex items-center gap-2 text-sm">
              <span className="flex items-center gap-1 text-green-700 font-medium bg-green-100 px-2 py-0.5 rounded-full">
                <TrendingUp className="w-3.5 h-3.5" />
                8.2%
              </span>
              <span className="text-gray-500">vs last month</span>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-none bg-gradient-to-br from-white to-green-50/30 shadow-md ring-1 ring-gray-100 relative overflow-hidden group">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Recycling Rate</CardTitle>
            <div className="p-2.5 bg-green-50 rounded-xl group-hover:bg-green-100 transition-colors shadow-sm">
              <Recycle className="w-5 h-5 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">67.5%</div>
            <div className="flex items-center gap-2 text-sm">
              <span className="flex items-center gap-1 text-green-700 font-medium bg-green-100 px-2 py-0.5 rounded-full">
                <TrendingUp className="w-3.5 h-3.5" />
                5.1%
              </span>
              <span className="text-gray-500">increase</span>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-none bg-gradient-to-br from-white to-emerald-50/30 shadow-md ring-1 ring-gray-100 relative overflow-hidden group">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Organic Waste</CardTitle>
            <div className="p-2.5 bg-emerald-50 rounded-xl group-hover:bg-emerald-100 transition-colors shadow-sm">
              <Leaf className="w-5 h-5 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">560 <span className="text-base font-medium text-gray-500">tons</span></div>
            <div className="flex items-center gap-2 text-sm">
              <span className="flex items-center gap-1 text-green-700 font-medium bg-green-100 px-2 py-0.5 rounded-full">
                <TrendingUp className="w-3.5 h-3.5" />
                12%
              </span>
              <span className="text-gray-500">increase</span>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-none bg-gradient-to-br from-white to-red-50/30 shadow-md ring-1 ring-gray-100 relative overflow-hidden group">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Landfill Waste</CardTitle>
            <div className="p-2.5 bg-red-50 rounded-xl group-hover:bg-red-100 transition-colors shadow-sm">
              <Trash2 className="w-5 h-5 text-red-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">405 <span className="text-base font-medium text-gray-500">tons</span></div>
            <div className="flex items-center gap-2 text-sm">
              <span className="flex items-center gap-1 text-red-700 font-medium bg-red-100 px-2 py-0.5 rounded-full">
                <TrendingUp className="w-3.5 h-3.5 rotate-180" />
                3.2%
              </span>
              <span className="text-gray-500">decrease</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-none bg-gradient-to-br from-white to-indigo-50/30 shadow-md ring-1 ring-gray-100 relative overflow-hidden group">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Route Collection</CardTitle>
            <div className="p-2.5 bg-indigo-50 rounded-xl group-hover:bg-indigo-100 transition-colors shadow-sm">
              <Route className="w-5 h-5 text-indigo-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">91.3%</div>
            <div className="flex items-center gap-2 text-sm">
              <span className="flex items-center gap-1 text-green-700 font-medium bg-green-100 px-2 py-0.5 rounded-full">
                <TrendingUp className="w-3.5 h-3.5" />
                On-time
              </span>
              <span className="text-gray-500">completion</span>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-none bg-gradient-to-br from-white to-teal-50/30 shadow-md ring-1 ring-gray-100 relative overflow-hidden group">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Team Performance</CardTitle>
            <div className="p-2.5 bg-teal-50 rounded-xl group-hover:bg-teal-100 transition-colors shadow-sm">
              <Users className="w-5 h-5 text-teal-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">88.7%</div>
            <div className="flex items-center gap-2 text-sm">
              <span className="flex items-center gap-1 text-green-700 font-medium bg-green-100 px-2 py-0.5 rounded-full">
                <TrendingUp className="w-3.5 h-3.5" />
                High
              </span>
              <span className="text-gray-500">Efficiency score</span>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-none bg-gradient-to-br from-white to-amber-50/30 shadow-md ring-1 ring-gray-100 relative overflow-hidden group">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Vehicle Performance</CardTitle>
            <div className="p-2.5 bg-amber-50 rounded-xl group-hover:bg-amber-100 transition-colors shadow-sm">
              <Truck className="w-5 h-5 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">94.1%</div>
            <div className="flex items-center gap-2 text-sm">
              <span className="flex items-center gap-1 text-green-700 font-medium bg-green-100 px-2 py-0.5 rounded-full">
                <TrendingUp className="w-3.5 h-3.5" />
                Optimal
              </span>
              <span className="text-gray-500">Fleet uptime</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Monthly Collection Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="organic" stroke="#10b981" strokeWidth={2} name="Organic" />
                <Line type="monotone" dataKey="recyclable" stroke="#3b82f6" strokeWidth={2} name="Recyclable" />
                <Line type="monotone" dataKey="general" stroke="#6b7280" strokeWidth={2} name="General" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Waste Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={wasteTypeData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {wasteTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Collection by Zone</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={zoneData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="zone" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="collected" fill="#3b82f6" name="Tons Collected" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
