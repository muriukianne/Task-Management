'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isLoggedIn, getUserRole, removeToken } from '../lib/auth';
import { getTasks, getTask, updateTaskStatus } from '../lib/api';

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

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-700'}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

export default function EmployeePage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState<'ok' | 'err'>('ok');

  // Task detail drawer (uses getTask endpoint)
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) { router.replace('/login'); return; }
    const role = getUserRole();
    if (role === 'supervisor' || role === 'admin') { router.replace('/supervisor'); return; }
    fetchTasks();
  }, []);

  async function fetchTasks() {
    setLoading(true);
    try {
      const res = await getTasks();
      if (res.code === 200) setTasks(res.data ?? []);
    } catch {
      showMsg('Could not load tasks. Make sure the backend is running.', 'err');
    } finally {
      setLoading(false);
    }
  }

  function showMsg(text: string, type: 'ok' | 'err') {
    setMsg(text);
    setMsgType(type);
    setTimeout(() => setMsg(''), 5000);
  }

  async function handleOpenDetail(task: Task) {
    setLoadingDetail(true);
    setDetailTask(task);
    try {
      const res = await getTask(task.taskId);
      if (res.code === 200) setDetailTask(res.data);
    } catch {
      // keep the existing task data
    } finally {
      setLoadingDetail(false);
    }
  }

  async function handleStatusUpdate(task: Task, newStatus: string) {
    const res = await updateTaskStatus(task.taskId, newStatus);
    if (res.code === 200) {
      showMsg(`Task "${task.taskTitle}" updated to ${STATUS_LABEL[newStatus]}.`, 'ok');
      fetchTasks();
      // Refresh detail if open
      if (detailTask?.taskId === task.taskId) {
        setDetailTask(res.data);
      }
    } else {
      showMsg(res.msg ?? 'Could not update task status.', 'err');
    }
  }

  const counts = {
    total:       tasks.length,
    assigned:    tasks.filter((t) => t.status === 'assigned').length,
    in_progress: tasks.filter((t) => t.status === 'in_progress').length,
    resolved:    tasks.filter((t) => t.status === 'resolved').length,
    done:        tasks.filter((t) => t.status === 'done').length,
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-700">Loading your tasks…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Header ── */}
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-indigo-700">Task Manager</h1>
          <p className="text-xs text-gray-700 font-semibold">My Tasks</p>
        </div>
        <button
          onClick={() => { removeToken(); router.replace('/login'); }}
          className="text-sm text-gray-700 hover:text-red-600 font-semibold transition-colors"
        >
          Sign Out
        </button>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">

        {msg && (
          <div className={`rounded-lg px-4 py-3 text-sm font-semibold ${msgType === 'ok' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
            {msg}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total',       value: counts.total },
            { label: 'Assigned',    value: counts.assigned },
            { label: 'In Progress', value: counts.in_progress },
            { label: 'Done',        value: counts.done },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 p-3 text-center">
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-700 font-semibold">{label}</p>
            </div>
          ))}
        </div>

        {counts.assigned > 0 && (
          <div className="bg-blue-50 border border-blue-200 text-blue-900 rounded-lg px-4 py-3 text-sm font-semibold">
            You have <span className="font-bold">{counts.assigned}</span> task{counts.assigned > 1 ? 's' : ''} waiting for you to start.
          </div>
        )}

        {/* Task list */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide">My Assigned Tasks</h2>

          {tasks.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-700">
              No tasks assigned to you yet. Check back later.
            </div>
          ) : (
            tasks.map((task) => (
              <div key={task.taskId} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-4">
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
                      </div>
                      <p className="text-xs text-gray-600 mt-0.5 font-medium">
                        Updated {new Date(task.updatedAt).toLocaleDateString()}
                      </p>
                      <p className="text-sm text-gray-800 mt-2 line-clamp-2">{task.taskDescription}</p>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2 flex-wrap mt-3">
                    {task.status === 'assigned' && (
                      <button
                        onClick={() => handleStatusUpdate(task, 'in_progress')}
                        className="bg-yellow-500 hover:bg-yellow-600 text-white text-sm px-4 py-2 rounded-lg font-semibold transition-colors"
                      >
                        Start Working
                      </button>
                    )}
                    {task.status === 'in_progress' && (
                      <button
                        onClick={() => handleStatusUpdate(task, 'resolved')}
                        className="bg-green-600 hover:bg-green-700 text-white text-sm px-4 py-2 rounded-lg font-semibold transition-colors"
                      >
                        Mark as Resolved
                      </button>
                    )}
                    {task.status === 'resolved' && (
                      <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg px-4 py-2 text-sm font-semibold">
                        Waiting for supervisor to confirm completion.
                      </div>
                    )}
                    {task.status === 'done' && (
                      <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg px-4 py-2 text-sm font-bold">
                        Task completed and confirmed.
                      </div>
                    )}
                    {task.status === 'created' && (
                      <div className="text-xs text-gray-700 italic font-medium">
                        Pending formal assignment from supervisor.
                      </div>
                    )}
                    {task.attachedFile && (
                      <div className="flex items-center gap-2 text-sm bg-purple-50 border border-purple-200 rounded-lg px-3 py-2">
                        <span>📎</span>
                        <span className="text-purple-800 font-semibold">
                          {task.attachedFile.split('_').slice(2).join('_') || task.attachedFile}
                        </span>
                        <span className="text-xs text-purple-700">(from supervisor)</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ══ Task detail drawer ══ */}
      {detailTask && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-bold text-gray-900">{detailTask.taskTitle}</h2>
              <button
                onClick={() => setDetailTask(null)}
                className="text-gray-600 hover:text-gray-900 text-xl font-bold shrink-0"
              >
                ✕
              </button>
            </div>
            {loadingDetail ? (
              <p className="text-sm text-gray-700">Loading…</p>
            ) : (
              <>
                <StatusBadge status={detailTask.status} />
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{detailTask.taskDescription}</p>

                {detailTask.attachedFile && (
                  <div className="flex items-center gap-2 text-sm bg-purple-50 border border-purple-200 rounded-lg px-3 py-2">
                    <span>📎</span>
                    <span className="text-purple-800 font-semibold">
                      {detailTask.attachedFile.split('_').slice(2).join('_') || detailTask.attachedFile}
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-600 font-bold uppercase tracking-wide">Task ID</p>
                    <p className="text-gray-900 font-semibold">#{detailTask.taskId}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 font-bold uppercase tracking-wide">Created</p>
                    <p className="text-gray-900">{new Date(detailTask.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 font-bold uppercase tracking-wide">Last Updated</p>
                    <p className="text-gray-900">{new Date(detailTask.updatedAt).toLocaleDateString()}</p>
                  </div>
                </div>

                {/* Action buttons inside detail */}
                <div className="flex gap-2 flex-wrap pt-2">
                  {detailTask.status === 'assigned' && (
                    <button
                      onClick={() => handleStatusUpdate(detailTask, 'in_progress')}
                      className="bg-yellow-500 hover:bg-yellow-600 text-white text-sm px-4 py-2 rounded-lg font-semibold transition-colors"
                    >
                      Start Working
                    </button>
                  )}
                  {detailTask.status === 'in_progress' && (
                    <button
                      onClick={() => handleStatusUpdate(detailTask, 'resolved')}
                      className="bg-green-600 hover:bg-green-700 text-white text-sm px-4 py-2 rounded-lg font-semibold transition-colors"
                    >
                      Mark as Resolved
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
