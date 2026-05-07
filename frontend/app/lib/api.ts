import { getToken } from './auth';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/tm/api/v1';

const jsonHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${getToken()}`,
});

// ── Auth ──────────────────────────────────────────────────────────────────────

export const login = async (email: string, password: string) => {
  const res = await fetch(`${BASE}/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return res.json();
};

// ── Users ─────────────────────────────────────────────────────────────────────

export const getUsers = async () => {
  const res = await fetch(`${BASE}/users/get-users`, { headers: jsonHeaders() });
  return res.json();
};

export const createUser = async (data: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: string;
}) => {
  const res = await fetch(`${BASE}/users/create`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify(data),
  });
  return res.json();
};

// ── Tasks ─────────────────────────────────────────────────────────────────────

export const getTasks = async () => {
  const res = await fetch(`${BASE}/tasks`, { headers: jsonHeaders() });
  return res.json();
};

export const getTask = async (taskId: number) => {
  const res = await fetch(`${BASE}/tasks/${taskId}`, { headers: jsonHeaders() });
  return res.json();
};

export const createTask = async (data: {
  taskTitle: string;
  taskDescription: string;
  assignedTo: string;
}) => {
  const res = await fetch(`${BASE}/tasks`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify(data),
  });
  return res.json();
};

/** Re-assign an existing task to a different user */
export const assignTask = async (taskId: number, assignedTo: string) => {
  const res = await fetch(`${BASE}/tasks/assign`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ taskId, assignedTo }),
  });
  return res.json();
};

export const updateTaskStatus = async (taskId: number, newStatus: string) => {
  const res = await fetch(`${BASE}/tasks/${taskId}/status`, {
    method: 'PUT',
    headers: jsonHeaders(),
    body: JSON.stringify({ newStatus }),
  });
  return res.json();
};

export const uploadTaskFile = async (taskId: number, file: File) => {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${BASE}/tasks/${taskId}/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
    body: form,
  });
  return res.json();
};
