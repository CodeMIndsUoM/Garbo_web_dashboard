'use client';

import { useState, useEffect, useMemo } from 'react';
import { Trash2, MapPin, AlertTriangle, Search, Plus, Loader2 } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Progress } from './ui/progress';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { toast } from "sonner";

const API_BASE = `${process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8081'}/api/bins`;
const COUNCILS = [
  'Colombo',
  'Dehiwala-Mt. Lavinia',
  'Kaduwela',
  'Moratuwa',
  'Sri Jayewardenepura Kotte',
];

interface Bin {
  id: number;
  binCode: string;
  location: string;
  zone?: string;
  council?: string;
  fillLevel: number;
  status: string;
  coordinates: string;
  isAssigned?: boolean;
}

export function BinManagement({ council, userRole }: { council?: { name?: string } | null; userRole?: 'admin' | 'superadmin' | null }) {
  const [bins, setBins] = useState<Bin[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [councilFilterUnavailable, setCouncilFilterUnavailable] = useState(false);
  
  // Form State
  const [newBin, setNewBin] = useState({
    binCode: '',
    location: '',
    type: 'General Waste',
    zone: '',
    status: 'notChecked',
    coordinates: ''
  });

  const isAdmin = userRole === 'admin';
  const defaultCouncil = council?.name || '';
  const authHeaders = (): Record<string, string> => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchBins = async () => {
    try {
      setLoading(true);
      const query = council?.name ? `?council=${encodeURIComponent(council.name)}` : '';
      const response = await fetch(`${API_BASE}${query}`, { headers: authHeaders() });
      const result = await response.json();
      if (result.success) {
        const data = Array.isArray(result.data) ? result.data : [];
        const hasCouncilField = data.some((b: any) => typeof b?.council === 'string');
        setCouncilFilterUnavailable(Boolean(council?.name) && !hasCouncilField && data.length > 0);
        setBins(data);
      }
    } catch (error) {
      console.error("Error fetching bins:", error);
      toast.error("Failed to load bins");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBins();
  }, []);



  const handleCreateBin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isAdmin && !defaultCouncil) {
        toast.error("Your admin account has no council assigned");
        return;
      }

      const payload = {
        ...newBin,
        zone: newBin.zone,
      };

      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (result.success) {
        toast.success("Bin created successfully");
        setIsCreateModalOpen(false);
        setNewBin({
          binCode: '',
          location: '',
          type: 'General Waste',
          zone: '',
          status: 'notChecked',
          coordinates: ''
        });
        fetchBins();
      } else {
        toast.error(result.message || "Failed to create bin");
      }
    } catch (error) {
      console.error("Error creating bin:", error);
      toast.error("Connection error");
    }
  };

  const handleDeleteBin = async (id: number) => {
    if (!confirm("Are you sure you want to delete this bin?")) return;
    try {
      const response = await fetch(`${API_BASE}/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      const result = await response.json();
      if (result.success) {
        toast.success("Bin deleted successfully");
        fetchBins();
      }
    } catch (error) {
      toast.error("Failed to delete bin");
    }
  };

  const filteredBins = bins.filter(bin => 
    bin.binCode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    bin.location?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const councilScopedBins = useMemo(() => {
    if (!council?.name) return filteredBins;
    const councilName = council.name.toLowerCase();
    return filteredBins.filter((bin: any) => {
      if (typeof bin?.council !== 'string') return true;
      return bin.council.toLowerCase() === councilName;
    });
  }, [filteredBins, council]);

  const nextBinCode = useMemo(() => {
    if (!council?.name) return 'Auto-generated';
    const prefix = `${council.name.trim()}-`.toLowerCase();
    
    const maxNumber = councilScopedBins.reduce((max, bin) => {
      const code = bin.binCode?.toLowerCase() || '';
      if (code.startsWith(prefix)) {
        const numStr = code.slice(prefix.length).trim();
        if (/^\d+$/.test(numStr)) {
          return Math.max(max, parseInt(numStr, 10));
        }
      }
      return max;
    }, 0);
    
    return `${council.name.trim()}-${maxNumber + 1}`;
  }, [council, councilScopedBins]);



  return (
    <div className="p-8">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h2 className="text-gray-900 mb-2">Bin Management</h2>
          <p className="text-gray-600">Monitor and manage all waste bins in real-time</p>
        </div>
        
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Add New Bin
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Waste Bin</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateBin} className="space-y-4 pt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Bin Code (Auto-generated)</label>
                <Input 
                  value={nextBinCode}
                  disabled
                  className="bg-gray-50 text-gray-500 font-semibold"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Location (Coordinates)</label>
                <Input 
                  placeholder="lat, lng" 
                  value={newBin.location}
                  onChange={(e) => setNewBin({...newBin, location: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Zone</label>
                <Input 
                  type="number"
                  min="1"
                  placeholder="e.g. 1" 
                  value={newBin.zone}
                  onChange={(e) => setNewBin({...newBin, zone: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Initial Fill Status</label>
                <Select 
                  value={newBin.status} 
                  onValueChange={(val) => setNewBin({...newBin, status: val})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="notChecked">Not Checked</SelectItem>
                    <SelectItem value="empty">Empty</SelectItem>
                    <SelectItem value="half">Half</SelectItem>
                    <SelectItem value="full">Full</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
                Save Bin
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="bg-white">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Bins</p>
                <p className="text-2xl font-semibold text-gray-900">{bins.length}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-full">
                <Trash2 className="w-6 h-6 text-gray-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Critical</p>
                <p className="text-2xl font-semibold text-red-600">
                  {bins.filter(b => b.status === 'critical').length}
                </p>
              </div>
              <div className="p-3 bg-red-50 rounded-full">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Warning</p>
                <p className="text-2xl font-semibold text-orange-600">
                  {bins.filter(b => b.status === 'warning').length}
                </p>
              </div>
              <div className="p-3 bg-orange-50 rounded-full">
                <AlertTriangle className="w-6 h-6 text-orange-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Normal</p>
                <p className="text-2xl font-semibold text-green-600">
                  {bins.filter(b => b.status === 'normal').length}
                </p>
              </div>
              <div className="p-3 bg-green-50 rounded-full">
                <Trash2 className="w-6 h-6 text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      {councilFilterUnavailable && (
        <div className="mb-4 p-3 rounded-lg border border-orange-200 bg-orange-50 text-orange-700 text-sm">
          Council-specific bin filtering is not available from backend data yet, so all bins are shown for this section.
        </div>
      )}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <Input
            placeholder="Search bins by ID or location..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Bins Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
          <p className="text-gray-600">Loading bin data...</p>
        </div>
      ) : councilScopedBins.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
          <Trash2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">No bins found</p>
          <p className="text-sm text-gray-400 mt-1">Start by adding a new waste bin to the system.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {councilScopedBins.map((bin) => (
            <Card key={bin.id} className="hover:shadow-lg transition-all duration-300 border-gray-100 group overflow-hidden relative">
              <div className={`absolute top-0 left-0 right-0 h-1.5 ${
                bin.status === 'full' ? 'bg-red-500' :
                bin.status === 'half' ? 'bg-yellow-400' :
                bin.status === 'empty' ? 'bg-green-500' :
                'bg-white'
              }`} />
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-gray-900 font-semibold mb-1">{bin.binCode}</h3>
                    <div className="flex items-center gap-1 text-sm text-gray-500">
                      <MapPin className="w-4 h-4" />
                      <span className="line-clamp-1">{bin.location}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      className={
                        bin.isAssigned
                          ? 'bg-blue-50 text-blue-700 border-blue-100'
                          : 'bg-gray-50 text-gray-700 border-gray-100'
                      }
                      variant="outline"
                    >
                      {bin.isAssigned ? 'Assigned' : 'Not Assigned'}
                    </Badge>
                    <button 
                      onClick={() => handleDeleteBin(bin.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-600 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Fill Level */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-600">Fill Status</span>
                      <span className={`text-sm font-bold ${
                        bin.status === 'full' ? 'text-red-600' :
                        bin.status === 'half' ? 'text-yellow-600' :
                        bin.status === 'empty' ? 'text-green-600' :
                        'text-gray-400'
                      }`}>
                        {bin.status === 'full' ? 'Full' :
                         bin.status === 'half' ? 'Half' :
                         bin.status === 'empty' ? 'Empty' :
                         'Not Checked'}
                      </span>
                    </div>
                  </div>

                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
