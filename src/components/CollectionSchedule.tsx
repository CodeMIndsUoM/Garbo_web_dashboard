import { Calendar, MapPin, Clock, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

const schedules = [
  {
    id: 1,
    zone: 'Residential Zone A',
    date: '2025-11-18',
    time: '08:00 AM - 12:00 PM',
    type: 'General Waste',
    crew: 'Team Alpha',
    status: 'scheduled',
    bins: 45,
  },
  {
    id: 2,
    zone: 'Downtown Area',
    date: '2025-11-18',
    time: '01:00 PM - 04:00 PM',
    type: 'Recyclables',
    crew: 'Team Beta',
    status: 'in-progress',
    bins: 38,
  },
  {
    id: 3,
    zone: 'Industrial Park',
    date: '2025-11-19',
    time: '07:00 AM - 11:00 AM',
    type: 'Mixed Waste',
    crew: 'Team Gamma',
    status: 'scheduled',
    bins: 52,
  },
  {
    id: 4,
    zone: 'Shopping District',
    date: '2025-11-19',
    time: '02:00 PM - 06:00 PM',
    type: 'General Waste',
    crew: 'Team Alpha',
    status: 'scheduled',
    bins: 31,
  },
  {
    id: 5,
    zone: 'Residential Zone B',
    date: '2025-11-20',
    time: '08:00 AM - 12:00 PM',
    type: 'Organic Waste',
    crew: 'Team Delta',
    status: 'scheduled',
    bins: 48,
  },
  {
    id: 6,
    zone: 'Business District',
    date: '2025-11-20',
    time: '01:00 PM - 05:00 PM',
    type: 'Recyclables',
    crew: 'Team Beta',
    status: 'scheduled',
    bins: 42,
  },
];

export function CollectionSchedule() {
  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-gray-900 mb-2">Collection Schedule</h2>
          <p className="text-gray-600">Manage and track waste collection schedules</p>
        </div>
        <Button className="bg-green-600 hover:bg-green-700">
          <Calendar className="w-4 h-4 mr-2" />
          Add Schedule
        </Button>
      </div>

      {/* Calendar View Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-gray-600">Today's Collections</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-gray-900">2</div>
            <p className="text-sm text-gray-500">83 total bins</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-gray-600">This Week</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-gray-900">12</div>
            <p className="text-sm text-gray-500">456 total bins</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-gray-600">Active Crews</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-gray-900">4</div>
            <p className="text-sm text-gray-500">16 team members</p>
          </CardContent>
        </Card>
      </div>

      {/* Schedule List */}
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Collections</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {schedules.map((schedule) => (
              <div
                key={schedule.id}
                className="p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-gray-900 mb-1">{schedule.zone}</h3>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {new Date(schedule.date).toLocaleDateString('en-US', { 
                          weekday: 'short', 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {schedule.time}
                      </span>
                    </div>
                  </div>
                  <Badge
                    variant={schedule.status === 'in-progress' ? 'default' : 'secondary'}
                    className={
                      schedule.status === 'in-progress'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-700'
                    }
                  >
                    {schedule.status === 'in-progress' ? 'In Progress' : 'Scheduled'}
                  </Badge>
                </div>

                <div className="flex items-center gap-6 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <MapPin className="w-4 h-4" />
                    <span>{schedule.bins} bins</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Users className="w-4 h-4" />
                    <span>{schedule.crew}</span>
                  </div>
                  <div className="px-2 py-1 bg-gray-100 rounded text-gray-700">
                    {schedule.type}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
