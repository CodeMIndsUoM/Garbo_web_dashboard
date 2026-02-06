'use client';

import { Trash2, MapPin, Battery, AlertTriangle, Search } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Progress } from './ui/progress';

const bins = [
  {
    id: 'BIN-001',
    location: '123 Main St, Downtown',
    type: 'General Waste',
    fillLevel: 85,
    battery: 92,
    status: 'warning',
    lastCollection: '2 days ago',
    coordinates: '40.7128° N, 74.0060° W',
  },
  {
    id: 'BIN-002',
    location: '456 Oak Ave, Residential Zone A',
    type: 'Recyclables',
    fillLevel: 45,
    battery: 78,
    status: 'normal',
    lastCollection: '1 day ago',
    coordinates: '40.7589° N, 73.9851° W',
  },
  {
    id: 'BIN-003',
    location: '789 Industrial Rd, Industrial Park',
    type: 'Organic Waste',
    fillLevel: 92,
    battery: 65,
    status: 'critical',
    lastCollection: '3 days ago',
    coordinates: '40.7489° N, 73.9680° W',
  },
  {
    id: 'BIN-004',
    location: '321 Park Blvd, Shopping District',
    type: 'General Waste',
    fillLevel: 38,
    battery: 88,
    status: 'normal',
    lastCollection: '1 day ago',
    coordinates: '40.7282° N, 74.0776° W',
  },
  {
    id: 'BIN-005',
    location: '654 Elm St, Residential Zone B',
    type: 'Recyclables',
    fillLevel: 72,
    battery: 45,
    status: 'warning',
    lastCollection: '2 days ago',
    coordinates: '40.7580° N, 73.9855° W',
  },
  {
    id: 'BIN-006',
    location: '987 Commerce Dr, Business District',
    type: 'Mixed Waste',
    fillLevel: 55,
    battery: 91,
    status: 'normal',
    lastCollection: '1 day ago',
    coordinates: '40.7614° N, 73.9776° W',
  },
];

export function BinManagement() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-gray-900 mb-2">Bin Management</h2>
        <p className="text-gray-600">Monitor and manage all waste bins in real-time</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Bins</p>
                <p className="text-2xl text-gray-900">856</p>
              </div>
              <Trash2 className="w-10 h-10 text-gray-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Critical</p>
                <p className="text-2xl text-red-600">23</p>
              </div>
              <AlertTriangle className="w-10 h-10 text-red-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Warning</p>
                <p className="text-2xl text-orange-600">67</p>
              </div>
              <AlertTriangle className="w-10 h-10 text-orange-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Normal</p>
                <p className="text-2xl text-green-600">766</p>
              </div>
              <Trash2 className="w-10 h-10 text-green-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <Input
            placeholder="Search bins by ID, location, or type..."
            className="pl-10"
          />
        </div>
      </div>

      {/* Bins Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {bins.map((bin) => (
          <Card key={bin.id} className="hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-gray-900 mb-1">{bin.id}</h3>
                  <div className="flex items-center gap-1 text-sm text-gray-600">
                    <MapPin className="w-4 h-4" />
                    <span className="line-clamp-1">{bin.location}</span>
                  </div>
                </div>
                <Badge
                  variant="secondary"
                  className={
                    bin.status === 'critical'
                      ? 'bg-red-100 text-red-700'
                      : bin.status === 'warning'
                      ? 'bg-orange-100 text-orange-700'
                      : 'bg-green-100 text-green-700'
                  }
                >
                  {bin.status}
                </Badge>
              </div>

              <div className="space-y-4">
                {/* Fill Level */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Fill Level</span>
                    <span className="text-sm text-gray-900">{bin.fillLevel}%</span>
                  </div>
                  <Progress 
                    value={bin.fillLevel} 
                    className={
                      bin.fillLevel >= 80
                        ? '[&>div]:bg-red-500'
                        : bin.fillLevel >= 60
                        ? '[&>div]:bg-orange-500'
                        : '[&>div]:bg-green-500'
                    }
                  />
                </div>

                {/* Battery */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600 flex items-center gap-1">
                      <Battery className="w-4 h-4" />
                      Battery
                    </span>
                    <span className="text-sm text-gray-900">{bin.battery}%</span>
                  </div>
                  <Progress 
                    value={bin.battery} 
                    className={
                      bin.battery < 50
                        ? '[&>div]:bg-red-500'
                        : bin.battery < 70
                        ? '[&>div]:bg-orange-500'
                        : '[&>div]:bg-green-500'
                    }
                  />
                </div>

                {/* Info */}
                <div className="pt-2 border-t border-gray-100 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Type</span>
                    <span className="text-gray-900">{bin.type}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Last Collection</span>
                    <span className="text-gray-900">{bin.lastCollection}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
