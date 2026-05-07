'use client';

import { useEffect, useState, useRef, FormEvent, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { isLoggedIn, getUserRole, removeToken } from '../lib/auth';
import {
  getTasks, getTask, getUsers, createTask, assignTask,
  updateTaskStatus, uploadTaskFile, createUser,
} from '../lib/api';

interface Task {
  taskId: number;
  taskTitle: string;
  taskDescription: string;
  status: string;
  assignedTo: string;
  assignedBy: string;
  attachedFile: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AppUser {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

type Tab = 'tasks' | 'create-task' | 'create-user' | 'users';
type StatusFilter = 'all' | 'created' | 'assigned' | 'in_progress' | 'resolved' | 'done';

const STATUS_COLORS: Record<string, string> = {
  created:     'bg-gray-100 text-gray-700',
  assigned:    'bg-blue-100 text-blue-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  resolved:    'bg-green-100 text-green-800',
  done:        'bg-emerald-100 text-emerald-800',
};

const STATUS_LABEL: Record<string, string> = {
  created:     'Created',
  assigned:    'Assigned',
  in_progress: 'In Progress',
  resolved:    'Resolved',
  done:        'Done',
};

const ROLE_COLORS: Record<string, string> = {
  admin:      'bg-red-100 text-red-800',
  supervisor: 'bg-purple-100 text-purple-800',
  employee:   'bg-blue-100 text-blue-800',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-700'}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${ROLE_COLORS[role] ?? 'bg-gray-100 text-gray-700'}`}>
      {role}
    </span>
  );
}

export default function SupervisorPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [callerRole, setCallerRole] = useState<string>('supervisor');
  const [tab, setTab] = useState<Tab>('tasks');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState<'ok' | 'err'>('ok');
  const [loading, setLoading] = useState(true);

  // Create task form
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newAssignedTo, setNewAssignedTo] = useState('');
  const [creating, setCreating] = useState(false);

  // Create user form
  const [uFirstName, setUFirstName] = useState('');
  const [uLastName, setULastName]   = useState('');
  const [uEmail, setUEmail]         = useState('');
  const [uPassword, setUPassword]   = useState('');
  const [uRole, setURole]           = useState('employee');
  const [creatingUser, setCreatingUser] = useState(false);

  // Re-assign modal
  const [reAssignTask, setReAssignTask] = useState<Task | null>(null);
  const [reAssignTo, setReAssignTo]     = useState('');
  const [reAssigning, setReAssigning]   = useState(false);

  // Task detail drawer
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const fileRefs = useRef<Record<number, HTMLInputElement | null>>({});

  useEffect(() => {
    if (!isLoggedIn()) { router.replace('/login'); return; }
    const role = getUserRole();
    if (role !== 'supervisor' && role !== 'admin') { router.replace('/employee'); return; }
    setCallerRole(role ?? 'supervisor');
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
    try {
      const [tr, ur] = await Promise.all([getTasks(), getUsers()]);
      if (tr.code === 200) setTasks(tr.data ?? []);
      if (ur.code === 200) setUsers(ur.data ?? []);
    } catch {
      showMsg('Could not load data from the server.', 'err');
    } finally {
      setLoading(false);
    }
  }

  function showMsg(text: string, type: 'ok' | 'err') {
    setMsg(text);
    setMsgType(type);
    setTimeout(() => setMsg(''), 5000);
  }

  function getUserName(userId: string) {
    const u = users.find((x) => x.userId === userId);
    return u ? `${u.firstName} ${u.lastName}` : userId;
  }

  async function handleOpenDetail(task: Task) {
    setLoadingDetail(true);
    setDetailTask(task);
    try {
      const res = await getTask(task.taskId);
      if (res.code === 200) setDetailTask(res.data);
    } catch {
      // keep the task data we already have
    } finally {
      setLoadingDetail(false);
    }
  }

  async function handleCreateTask(e: FormEvent) {
    e.preventDefault();
    if (!newAssignedTo) { showMsg('Please select a user to assign the task to.', 'err'); return; }
    setCreating(true);
    try {
      const res = await createTask({
        taskTitle: newTitle,
        taskDescription: newDesc,
        assignedTo: newAssignedTo,
      });
      if (res.code === 200) {
        showMsg('Task created and assigned successfully.', 'ok');
        setNewTitle(''); setNewDesc(''); setNewAssignedTo('');
        setTab('tasks');
        fetchAll();
      } else {
        showMsg(res.msg ?? 'Failed to create task.', 'err');
      }
    } catch {
      showMsg('Server error while creating task.', 'err');
    } finally {
      setCreating(false);
    }
  }

  async function handleCreateUser(e: FormEvent) {
    e.preventDefault();
    setCreatingUser(true);
    try {
      const res = await createUser({
        firstName: uFirstName, lastName: uLastName,
        email: uEmail, password: uPassword, role: uRole,
      });
      if (res.code === 200) {
        showMsg(`${uRole} account created for ${uEmail}.`, 'ok');
        setUFirstName(''); setULastName(''); setUEmail('');
        setUPassword(''); setURole('employee');
        fetchAll();
      } else {
        showMsg(res.msg ?? 'Failed to create user.', 'err');
      }
    } catch {
      showMsg('Server error while creating user.', 'err');
    } finally {
      setCreatingUser(false);
    }
  }

  async function handleConfirmDone(task: Task) {
    const res = await updateTaskStatus(task.taskId, 'done');
    if (res.code === 200) {
      showMsg(`Task "${task.taskTitle}" marked as Done.`, 'ok');
      fetchAll();
    } else {
      showMsg(res.msg ?? 'Failed to update task.', 'err');
    }
  }

  async function handleReAssign(e: FormEvent) {
    e.preventDefault();
    if (!reAssignTask || !reAssignTo) return;
    setReAssigning(true);
    try {
      const res = await assignTask(reAssignTask.taskId, reAssignTo);
      if (res.code === 200) {
        showMsg(`Task re-assigned to ${getUserName(reAssignTo)}.`, 'ok');
        setReAssignTask(null);
        fetchAll();
      } else {
        showMsg(res.msg ?? 'Failed to re-assign task.', 'err');
      }
    } catch {
      showMsg('Server error while re-assigning task.', 'err');
    } finally {
      setReAssigning(false);
    }
  }

  async function handleFileChange(taskId: number, e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const res = await uploadTaskFile(taskId, file);
    if (res.code === 200) {
      showMsg('File uploaded successfully.', 'ok');
      fetchAll();
    } else {
      showMsg(res.msg ?? 'File upload failed.', 'err');
    }
    e.target.value = '';
  }

  // Admin sees all users; supervisor sees only employees in Users tab
  const usersTabList = callerRole === 'admin' ? users : users.filter((u) => u.role === 'employee');
  const filteredTasks = statusFilter === 'all'
    ? tasks
    : tasks.filter((t) => t.status === statusFilter);
  const resolvedCount = tasks.filter((t) => t.status === 'resolved').length;

  const tabs: { key: Tab; label: string }[] = [
    { key: 'tasks',       label: 'All Tasks' },
    { key: 'create-task', label: '+ New Task' },
    { key: 'create-user', label: '+ New Account' },
    { key: 'users',       label: 'Users' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-700">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Header ── */}
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-indigo-700">Task Manager</h1>
          <p className="text-xs text-gray-700 capitalize font-medium">{callerRole} Dashboard</p>
        </div>
        <button
          onClick={() => { removeToken(); router.replace('/login'); }}
          className="text-sm text-gray-700 hover:text-red-600 font-semibold transition-colors"
        >
          Sign Out
        </button>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">

        {/* ── Alert banner ── */}
        {msg && (
          <div className={`rounded-lg px-4 py-3 text-sm font-semibold ${msgType === 'ok' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
            {msg}
          </div>
        )}

        {resolvedCount > 0 && (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg px-4 py-3 text-sm flex items-center gap-2 font-semibold">
            ⚠ {resolvedCount} task{resolvedCount > 1 ? 's are' : ' is'} waiting for your review.
            <button onClick={() => { setStatusFilter('resolved'); setTab('tasks'); }} className="underline ml-auto font-bold">
              View now
            </button>
          </div>
        )}

        {/* ── Stats cards ── */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {(['all', 'created', 'assigned', 'in_progress', 'resolved', 'done'] as const).map((s) => {
            const count = s === 'all' ? tasks.length : tasks.filter((t) => t.status === s).length;
            return (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); setTab('tasks'); }}
                className={`rounded-xl p-3 text-center border transition-all ${statusFilter === s && tab === 'tasks' ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 bg-white hover:border-indigo-300'}`}
              >
                <p className="text-2xl font-bold text-gray-900">{count}</p>
                <p className="text-xs text-gray-700 font-medium capitalize">{s === 'all' ? 'Total' : STATUS_LABEL[s]}</p>
              </button>
            );
          })}
        </div>

        {/* ── Tab bar ── */}
        <div className="flex gap-1 border-b border-gray-200">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${tab === key ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-600 hover:text-gray-900'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ══ All Tasks tab ══ */}
        {tab === 'tasks' && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {(['all', 'created', 'assigned', 'in_progress', 'resolved', 'done'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${statusFilter === s ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-400'}`}
                >
                  {s === 'all' ? 'All' : STATUS_LABEL[s]}
                </button>
              ))}
            </div>

            {filteredTasks.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-700">
                No tasks found. Use the &quot;+ New Task&quot; tab to create one.
              </div>
            ) : (
              <div className="space-y-2">
                {filteredTasks.map((task) => (
                  <div key={task.taskId} className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => handleOpenDetail(task)}
                            className="font-bold text-gray-900 hover:text-indigo-700 text-left transition-colors"
                          >
                            {task.taskTitle}
                          </button>
                          <StatusBadge status={task.status} />
                          {task.attachedFile && (
                            <span className="text-xs bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full font-semibold">
                              📎 file attached
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-700 mt-1 line-clamp-2">{task.taskDescription}</p>
                        <p className="text-xs text-gray-600 mt-1">
                          Assigned to: <span className="text-gray-900 font-semibold">{getUserName(task.assignedTo)}</span>
                          &nbsp;·&nbsp;Updated: {new Date(task.updatedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        {task.status === 'resolved' && (
                          <button
                            onClick={() => handleConfirmDone(task)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors"
                          >
                            Confirm Done
                          </button>
                        )}
                        {(task.status === 'created' || task.status === 'assigned') && (
                          <button
                            onClick={() => { setReAssignTask(task); setReAssignTo(task.assignedTo ?? ''); }}
                            className="bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors border border-blue-200"
                          >
                            Re-assign
                          </button>
                        )}
                        <button
                          onClick={() => fileRefs.current[task.taskId]?.click()}
                          className="bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors border border-indigo-200"
                        >
                          Upload File
                        </button>
                        <input
                          type="file"
                          ref={(el) => { fileRefs.current[task.taskId] = el; }}
                          className="hidden"
                          onChange={(e) => handleFileChange(task.taskId, e)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ Create Task tab ══ */}
        {tab === 'create-task' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-lg">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Create a New Task</h2>
            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1">Task Title</label>
                <input
                  required value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Short title for the task"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1">Description</label>
                <textarea
                  required value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  rows={3}
                  placeholder="Describe what needs to be done"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1">Assign To</label>
                {users.length > 0 ? (
                  <select
                    value={newAssignedTo}
                    onChange={(e) => setNewAssignedTo(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  >
                    <option value="">-- Select user --</option>
                    {users.map((u) => (
                      <option key={u.userId} value={u.userId}>
                        {u.firstName} {u.lastName} ({u.role}) — {u.email}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="space-y-1">
                    <input
                      value={newAssignedTo}
                      onChange={(e) => setNewAssignedTo(e.target.value)}
                      placeholder="User ID"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                    <p className="text-xs text-gray-700">No users found. Create accounts first.</p>
                  </div>
                )}
              </div>
              <button
                type="submit" disabled={creating}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-bold py-2 px-6 rounded-lg text-sm transition-colors"
              >
                {creating ? 'Creating…' : 'Create Task'}
              </button>
            </form>
          </div>
        )}

        {/* ══ Create User tab ══ */}
        {tab === 'create-user' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-lg">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Create a New Account</h2>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-1">First Name</label>
                  <input required value={uFirstName} onChange={(e) => setUFirstName(e.target.value)}
                    placeholder="John"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-1">Last Name</label>
                  <input required value={uLastName} onChange={(e) => setULastName(e.target.value)}
                    placeholder="Doe"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1">Email</label>
                <input required type="email" value={uEmail} onChange={(e) => setUEmail(e.target.value)}
                  placeholder="john.doe@company.com"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1">Password</label>
                <input required type="password" value={uPassword} onChange={(e) => setUPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1">Role</label>
                <select value={uRole} onChange={(e) => setURole(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  <option value="employee">Employee</option>
                  {callerRole === 'admin' && <option value="supervisor">Supervisor</option>}
                  {callerRole === 'admin' && <option value="admin">Admin</option>}
                </select>
              </div>
              <button
                type="submit" disabled={creatingUser}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-bold py-2 px-6 rounded-lg text-sm transition-colors"
              >
                {creatingUser ? 'Creating…' : 'Create Account'}
              </button>
            </form>
          </div>
        )}

        {/* ══ Users tab ══ */}
        {tab === 'users' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-800 font-semibold">
              {callerRole === 'admin'
                ? `All users (${usersTabList.length})`
                : `Employees (${usersTabList.length})`}
            </p>
            {usersTabList.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-700">
                No users found. Create accounts using the &quot;+ New Account&quot; tab.
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                {usersTabList.map((u) => (
                  <div key={u.userId} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="font-bold text-gray-900">{u.firstName} {u.lastName}</p>
                      <p className="text-sm text-gray-700">{u.email}</p>
                    </div>
                    <RoleBadge role={u.role} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* ══ Re-assign modal ══ */}
      {reAssignTask && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Re-assign Task</h2>
            <p className="text-sm text-gray-700">
              Task: <span className="font-semibold">{reAssignTask.taskTitle}</span>
            </p>
            <form onSubmit={handleReAssign} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1">Assign To</label>
                <select
                  value={reAssignTo}
                  onChange={(e) => setReAssignTo(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  required
                >
                  <option value="">-- Select user --</option>
                  {users.map((u) => (
                    <option key={u.userId} value={u.userId}>
                      {u.firstName} {u.lastName} ({u.role}) — {u.email}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setReAssignTask(null)}
                  className="px-4 py-2 text-sm font-semibold text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit" disabled={reAssigning || !reAssignTo}
                  className="px-4 py-2 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-lg transition-colors"
                >
                  {reAssigning ? 'Saving…' : 'Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══ Task detail drawer ══ */}
      {detailTask && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-bold text-gray-900">{detailTask.taskTitle}</h2>
              <button
                onClick={() => setDetailTask(null)}
                className="text-gray-500 hover:text-gray-900 text-xl font-bold shrink-0"
              >
                ✕
              </button>
            </div>
            {loadingDetail ? (
              <p className="text-sm text-gray-600">Loading details…</p>
            ) : (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusBadge status={detailTask.status} />
                  {detailTask.attachedFile && (
                    <span className="text-xs bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full font-semibold">
                      📎 {detailTask.attachedFile.split('_').slice(2).join('_') || detailTask.attachedFile}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{detailTask.taskDescription}</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-gray-600 font-semibold uppercase tracking-wide">Assigned To</p>
                    <p className="text-gray-900 font-semibold">{getUserName(detailTask.assignedTo)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 font-semibold uppercase tracking-wide">Created</p>
                    <p className="text-gray-900">{new Date(detailTask.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 font-semibold uppercase tracking-wide">Task ID</p>
                    <p className="text-gray-900">#{detailTask.taskId}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 font-semibold uppercase tracking-wide">Last Updated</p>
                    <p className="text-gray-900">{new Date(detailTask.updatedAt).toLocaleDateString()}</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
