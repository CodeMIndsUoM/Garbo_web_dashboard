import { TrendingUp, Recycle, Trash2, Leaf } from 'lucide-react';
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

export function WasteAnalytics() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-gray-900 mb-2">Waste Analytics</h2>
        <p className="text-gray-600">Insights and trends from waste collection data</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-gray-600">Total Collected</CardTitle>
            <Trash2 className="w-5 h-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-gray-900 mb-1">1,245 tons</div>
            <div className="flex items-center gap-1 text-green-600 text-sm">
              <TrendingUp className="w-4 h-4" />
              <span>8.2% vs last month</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-gray-600">Recycling Rate</CardTitle>
            <Recycle className="w-5 h-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-gray-900 mb-1">67.5%</div>
            <div className="flex items-center gap-1 text-green-600 text-sm">
              <TrendingUp className="w-4 h-4" />
              <span>5.1% increase</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-gray-600">Organic Waste</CardTitle>
            <Leaf className="w-5 h-5 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-gray-900 mb-1">560 tons</div>
            <div className="flex items-center gap-1 text-green-600 text-sm">
              <TrendingUp className="w-4 h-4" />
              <span>12% increase</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-gray-600">Landfill Waste</CardTitle>
            <Trash2 className="w-5 h-5 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-gray-900 mb-1">405 tons</div>
            <div className="flex items-center gap-1 text-red-600 text-sm">
              <TrendingUp className="w-4 h-4 rotate-180" />
              <span>3.2% decrease</span>
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

        <Card>
          <CardHeader>
            <CardTitle>Environmental Impact</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                <div>
                  <p className="text-sm text-gray-600 mb-1">CO₂ Reduced</p>
                  <p className="text-2xl text-gray-900">842 tons</p>
                </div>
                <Leaf className="w-12 h-12 text-green-600" />
              </div>

              <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Materials Recycled</p>
                  <p className="text-2xl text-gray-900">1,340 tons</p>
                </div>
                <Recycle className="w-12 h-12 text-blue-600" />
              </div>

              <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Energy Saved</p>
                  <p className="text-2xl text-gray-900">3,245 MWh</p>
                </div>
                <TrendingUp className="w-12 h-12 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
