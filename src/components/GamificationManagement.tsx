'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { PageHeader } from './layout/PageHeader';
import {
  CodeBadge,
  DetailField,
  DetailGrid,
  ExpandableRow,
  FormField,
  FormPanel,
  FormSelect,
} from './layout/management-ui';
import { typography } from '@/theme';

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

const FIELD_MENTOR_TASK_TYPES = [
  { value: 'BIN_REPORT', label: 'Bin report (weekly/cumulative)' },
  { value: 'FIELD_MENTOR_REPORT', label: 'Field mentor report' },
  { value: 'DAILY_BIN_REPORT', label: 'Daily bin report' },
] as const;

function isFieldMentorRole(role?: string) {
  return (role || '').toUpperCase() === 'FIELD_MENTOR';
}

function formatRoleScope(role?: string) {
  const value = (role || '').toUpperCase();
  if (value === 'FIELD_MENTOR') return 'Field mentor';
  if (value === 'COLLECTOR') return 'Collector';
  if (value === 'ALL') return 'All roles';
  return role || '—';
}

function taskStatusClass(status?: string) {
  const value = (status || '').toUpperCase();
  if (value === 'PUBLISHED') return 'border-green-200 bg-green-50 text-green-700';
  if (value === 'DRAFT') return 'border-amber-200 bg-amber-50 text-amber-800';
  return 'border-border bg-muted text-muted-foreground';
}

export function GamificationManagement() {
  const [families, setFamilies] = useState<TaskFamily[]>([]);
  const [tasks, setTasks] = useState<GamificationTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null);
  const [taskRoleFilter, setTaskRoleFilter] = useState<'ALL' | 'COLLECTOR' | 'FIELD_MENTOR'>('ALL');
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

  const toggleTaskExpanded = (taskId: number) => {
    setExpandedTaskId((current) => (current === taskId ? null : taskId));
  };

  const filteredTasks = tasks.filter((task) => {
    if (taskRoleFilter === 'ALL') {
      return true;
    }
    return (task.roleScope || '').toUpperCase() === taskRoleFilter;
  });

  const handleRoleScopeChange = (roleScope: string) => {
    setTaskForm((previous) => ({
      ...previous,
      roleScope,
      taskType: isFieldMentorRole(roleScope) ? 'BIN_REPORT' : 'BIN_COLLECTION',
    }));
  };

  return (
    <div className="p-8 space-y-6">
      <PageHeader
        title="Gamification"
        subtitle="Manage task families and gamification tasks for collectors and field mentors"
      />

      <Card>
        <CardHeader>
          <CardTitle>Task Families</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={createFamily}>
            <FormPanel
              footer={
                <Button type="submit" variant="brand">
                  Add Family
                </Button>
              }
            >
              <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                <FormField label="Code" htmlFor="family-code">
                  <Input
                    id="family-code"
                    placeholder="e.g. COLLECTION"
                    value={familyForm.code}
                    onChange={(e) => setFamilyForm((p) => ({ ...p, code: e.target.value }))}
                    required
                  />
                </FormField>
                <FormField label="Name" htmlFor="family-name">
                  <Input
                    id="family-name"
                    placeholder="Family name"
                    value={familyForm.name}
                    onChange={(e) => setFamilyForm((p) => ({ ...p, name: e.target.value }))}
                    required
                  />
                </FormField>
                <FormField label="Description" htmlFor="family-description">
                  <Input
                    id="family-description"
                    placeholder="Short description"
                    value={familyForm.description}
                    onChange={(e) => setFamilyForm((p) => ({ ...p, description: e.target.value }))}
                  />
                </FormField>
              </div>
            </FormPanel>
          </form>

          {families.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {families.map((family) => (
                    <TableRow key={family.id}>
                      <TableCell>
                        <CodeBadge>{family.code}</CodeBadge>
                      </TableCell>
                      <TableCell className="font-medium">{family.name}</TableCell>
                      <TableCell className="text-muted-foreground">{family.description || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-muted/80 px-6 py-8 text-center">
              <p className={typography.label}>No task families yet</p>
              <p className={`${typography.caption} mt-1`}>
                Use the form above to create your first family and group related tasks.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Create Task</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={createTask}>
            <FormPanel
              footer={
                <Button type="submit" variant="brand">
                  Create Task
                </Button>
              }
            >
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <FormField label="Code" htmlFor="task-code">
                <Input
                  id="task-code"
                  placeholder="Task code"
                  value={taskForm.code}
                  onChange={(e) => setTaskForm((p) => ({ ...p, code: e.target.value }))}
                  required
                />
              </FormField>
              <FormField label="Title" htmlFor="task-title">
                <Input
                  id="task-title"
                  placeholder="Task title"
                  value={taskForm.title}
                  onChange={(e) => setTaskForm((p) => ({ ...p, title: e.target.value }))}
                  required
                />
              </FormField>
              <FormField label="Description" htmlFor="task-description" className="md:col-span-2">
                <Input
                  id="task-description"
                  placeholder="What the collector must do"
                  value={taskForm.description}
                  onChange={(e) => setTaskForm((p) => ({ ...p, description: e.target.value }))}
                />
              </FormField>
              <FormField label="Role scope" htmlFor="task-role">
                <FormSelect
                  id="task-role"
                  value={taskForm.roleScope}
                  onChange={(e) => handleRoleScopeChange(e.target.value)}
                >
                  <option value="COLLECTOR">Collector</option>
                  <option value="FIELD_MENTOR">Field mentor</option>
                  <option value="ALL">All</option>
                </FormSelect>
              </FormField>
              {isFieldMentorRole(taskForm.roleScope) ? (
                <FormField label="Task type" htmlFor="task-type">
                  <FormSelect
                    id="task-type"
                    value={taskForm.taskType}
                    onChange={(e) => setTaskForm((p) => ({ ...p, taskType: e.target.value }))}
                  >
                    {FIELD_MENTOR_TASK_TYPES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </FormSelect>
                </FormField>
              ) : (
                <FormField label="Task type" htmlFor="task-type">
                  <Input
                    id="task-type"
                    placeholder="BIN_COLLECTION"
                    value={taskForm.taskType}
                    onChange={(e) => setTaskForm((p) => ({ ...p, taskType: e.target.value }))}
                  />
                </FormField>
              )}
              <FormField label="Base points" htmlFor="task-points">
                <Input
                  id="task-points"
                  type="number"
                  min={0}
                  value={taskForm.basePoints}
                  onChange={(e) => setTaskForm((p) => ({ ...p, basePoints: e.target.value }))}
                />
              </FormField>
              <FormField label="Target progress" htmlFor="task-target">
                <Input
                  id="task-target"
                  type="number"
                  min={1}
                  value={taskForm.targetProgress}
                  onChange={(e) => setTaskForm((p) => ({ ...p, targetProgress: e.target.value }))}
                />
              </FormField>
              <FormField label="Task family" htmlFor="task-family">
                <FormSelect
                  id="task-family"
                  value={taskForm.familyId}
                  onChange={(e) => setTaskForm((p) => ({ ...p, familyId: e.target.value }))}
                >
                  <option value="">No family</option>
                  {families.map((family) => (
                    <option key={family.id} value={family.id}>
                      {family.name}
                    </option>
                  ))}
                </FormSelect>
              </FormField>
              {isFieldMentorRole(taskForm.roleScope) ? (
                <p className={`${typography.caption} md:col-span-2 text-muted-foreground`}>
                  Field mentor tasks progress automatically when mentors report bin status via the app.
                </p>
              ) : null}
              </div>
            </FormPanel>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <CardTitle>Tasks</CardTitle>
          <div className="flex flex-wrap items-center gap-3">
            <FormSelect
              aria-label="Filter tasks by role"
              value={taskRoleFilter}
              onChange={(e) =>
                setTaskRoleFilter(e.target.value as 'ALL' | 'COLLECTOR' | 'FIELD_MENTOR')
              }
              className="w-[180px]"
            >
              <option value="ALL">All roles</option>
              <option value="COLLECTOR">Collector</option>
              <option value="FIELD_MENTOR">Field mentor</option>
            </FormSelect>
            {!loading && filteredTasks.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
                  {filteredTasks.filter((t) => (t.status || '').toUpperCase() === 'PUBLISHED').length}{' '}
                  published
                </Badge>
                <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
                  {filteredTasks.filter((t) => (t.status || '').toUpperCase() !== 'PUBLISHED').length}{' '}
                  draft
                </Badge>
              </div>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className={typography.caption}>Loading tasks...</p>
          ) : tasks.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/80 px-6 py-10 text-center">
              <p className={typography.label}>No tasks defined yet</p>
              <p className={`${typography.caption} mt-1`}>Create a task above to reward collectors and mentors.</p>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/80 px-6 py-10 text-center">
              <p className={typography.label}>No tasks for this filter</p>
              <p className={`${typography.caption} mt-1`}>
                Try another role filter or create a task above.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTasks.map((task) => {
                const isOpen = expandedTaskId === task.id;
                const isPublished = (task.status || '').toUpperCase() === 'PUBLISHED';
                return (
                  <ExpandableRow
                    key={task.id}
                    isOpen={isOpen}
                    onToggle={() => toggleTaskExpanded(task.id)}
                    title={task.title}
                    subtitle={<CodeBadge>{task.code}</CodeBadge>}
                    trailing={
                      <>
                        <Badge
                          variant="outline"
                          className="border-green-200 bg-green-50 font-semibold text-green-700"
                        >
                          {task.basePoints ?? 0} pts
                        </Badge>
                        <Badge variant="outline" className={taskStatusClass(task.status)}>
                          {task.status || 'Unknown'}
                        </Badge>
                      </>
                    }
                  >
                    {task.description ? (
                      <DetailField label="Description">
                        <span className="text-muted-foreground">{task.description}</span>
                      </DetailField>
                    ) : null}
                    <DetailGrid>
                      <DetailField label="Code">
                        <CodeBadge>{task.code}</CodeBadge>
                      </DetailField>
                      <DetailField label="Role">
                        <Badge variant="outline" className="border-border font-normal">
                          {formatRoleScope(task.roleScope)}
                        </Badge>
                      </DetailField>
                      <DetailField label="Type">
                        {task.taskType?.replace(/_/g, ' ') || '—'}
                      </DetailField>
                      <DetailField label="Target">{task.targetProgress ?? '—'}</DetailField>
                      <DetailField label="Family">{task.family?.name || '—'}</DetailField>
                      <DetailField label="Points">
                        <span className="font-semibold text-green-700">{task.basePoints ?? 0}</span>
                      </DetailField>
                    </DetailGrid>
                    <div className="flex items-center justify-between gap-4 border-t border-border pt-3">
                      <span className={typography.caption}>
                        {isPublished ? 'This task is live for assigned roles.' : 'Draft — publish when ready.'}
                      </span>
                      {isPublished ? (
                        <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
                          Live
                        </Badge>
                      ) : (
                        <Button size="sm" variant="brand" onClick={() => publishTask(task.id)}>
                          Publish
                        </Button>
                      )}
                    </div>
                  </ExpandableRow>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
