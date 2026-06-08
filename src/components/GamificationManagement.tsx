'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8081';

interface TaskFamily {
  id: number;
  code: string;
  name: string;
  description?: string;
}

interface GamificationTask {
  id: number;
  code: string;
  title: string;
  description?: string;
  roleScope?: string;
  taskType?: string;
  basePoints?: number;
  targetProgress?: number;
  status?: string;
  family?: TaskFamily;
}

export function GamificationManagement() {
  const [families, setFamilies] = useState<TaskFamily[]>([]);
  const [tasks, setTasks] = useState<GamificationTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [familyForm, setFamilyForm] = useState({ code: '', name: '', description: '' });
  const [taskForm, setTaskForm] = useState({
    code: '',
    title: '',
    description: '',
    roleScope: 'COLLECTOR',
    taskType: 'BIN_COLLECTION',
    basePoints: '10',
    targetProgress: '1',
    familyId: '',
  });

  const tokenHeader = (): Record<string, string> => {
    const token = sessionStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [familiesRes, tasksRes] = await Promise.all([
        fetch(`${API_BASE}/api/admins/gamification/families`, { headers: tokenHeader() }),
        fetch(`${API_BASE}/api/admins/gamification/tasks`, { headers: tokenHeader() }),
      ]);
      const familiesJson = await familiesRes.json().catch(() => ({ data: [] }));
      const tasksJson = await tasksRes.json().catch(() => ({ data: [] }));
      setFamilies(Array.isArray(familiesJson?.data) ? familiesJson.data : []);
      setTasks(Array.isArray(tasksJson?.data) ? tasksJson.data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const createFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch(`${API_BASE}/api/admins/gamification/families`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...tokenHeader() },
      body: JSON.stringify(familyForm),
    });
    setFamilyForm({ code: '', name: '', description: '' });
    loadData();
  };

  const createTask = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch(`${API_BASE}/api/admins/gamification/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...tokenHeader() },
      body: JSON.stringify({
        code: taskForm.code,
        title: taskForm.title,
        description: taskForm.description,
        roleScope: taskForm.roleScope,
        taskType: taskForm.taskType,
        scoringType: 'FIXED',
        basePoints: Number(taskForm.basePoints),
        targetProgress: Number(taskForm.targetProgress),
        status: 'DRAFT',
        familyId: taskForm.familyId ? Number(taskForm.familyId) : null,
      }),
    });
    setTaskForm({
      code: '',
      title: '',
      description: '',
      roleScope: 'COLLECTOR',
      taskType: 'BIN_COLLECTION',
      basePoints: '10',
      targetProgress: '1',
      familyId: '',
    });
    loadData();
  };

  const publishTask = async (taskId: number) => {
    await fetch(`${API_BASE}/api/admins/gamification/tasks/${taskId}/publish`, {
      method: 'POST',
      headers: tokenHeader(),
    });
    loadData();
  };

  return (
    <div className="p-8 space-y-8">
      <div>
        <h2 className="text-gray-900 mb-2">Gamification</h2>
        <p className="text-gray-600">Manage task families and gamification tasks for collectors and field mentors</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Task Families</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="grid grid-cols-1 md:grid-cols-4 gap-3" onSubmit={createFamily}>
            <Input placeholder="Code" value={familyForm.code} onChange={(e) => setFamilyForm((p) => ({ ...p, code: e.target.value }))} />
            <Input placeholder="Name" value={familyForm.name} onChange={(e) => setFamilyForm((p) => ({ ...p, name: e.target.value }))} />
            <Input placeholder="Description" value={familyForm.description} onChange={(e) => setFamilyForm((p) => ({ ...p, description: e.target.value }))} />
            <Button type="submit" className="bg-green-600 hover:bg-green-700">Add Family</Button>
          </form>
          <div className="flex flex-wrap gap-2">
            {families.map((f) => (
              <Badge key={f.id} variant="secondary">{f.name} ({f.code})</Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Create Task</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid grid-cols-1 md:grid-cols-2 gap-3" onSubmit={createTask}>
            <Input placeholder="Code" value={taskForm.code} onChange={(e) => setTaskForm((p) => ({ ...p, code: e.target.value }))} />
            <Input placeholder="Title" value={taskForm.title} onChange={(e) => setTaskForm((p) => ({ ...p, title: e.target.value }))} />
            <Input placeholder="Description" value={taskForm.description} onChange={(e) => setTaskForm((p) => ({ ...p, description: e.target.value }))} />
            <Input placeholder="Role (COLLECTOR/FIELD_MENTOR/ALL)" value={taskForm.roleScope} onChange={(e) => setTaskForm((p) => ({ ...p, roleScope: e.target.value }))} />
            <Input placeholder="Task type" value={taskForm.taskType} onChange={(e) => setTaskForm((p) => ({ ...p, taskType: e.target.value }))} />
            <Input placeholder="Base points" value={taskForm.basePoints} onChange={(e) => setTaskForm((p) => ({ ...p, basePoints: e.target.value }))} />
            <Input placeholder="Target progress" value={taskForm.targetProgress} onChange={(e) => setTaskForm((p) => ({ ...p, targetProgress: e.target.value }))} />
            <select
              className="border rounded-md px-3 py-2 text-sm"
              value={taskForm.familyId}
              onChange={(e) => setTaskForm((p) => ({ ...p, familyId: e.target.value }))}
            >
              <option value="">No family</option>
              {families.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
            <Button type="submit" className="bg-green-600 hover:bg-green-700 md:col-span-2">Create Task</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-gray-500">Loading tasks...</div>
          ) : tasks.length === 0 ? (
            <div className="text-gray-500">No tasks defined yet.</div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <div key={task.id} className="p-4 border border-gray-200 rounded-lg flex items-start justify-between gap-4">
                  <div>
                    <p className="text-gray-900 font-medium">{task.title}</p>
                    <p className="text-sm text-gray-600">{task.code} · {task.roleScope} · {task.taskType}</p>
                    <p className="text-sm text-gray-600">{task.basePoints} pts · target {task.targetProgress}</p>
                    {task.family && <p className="text-xs text-gray-500">Family: {task.family.name}</p>}
                    <Badge variant="secondary" className="mt-2">{task.status}</Badge>
                  </div>
                  {task.status !== 'PUBLISHED' && (
                    <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => publishTask(task.id)}>
                      Publish
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
