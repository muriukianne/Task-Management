const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/tm/api/v1';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Task {
  taskId: number;
  taskTitle: string;
  taskDescription: string;
  status: TaskStatus;
  priority: Priority;
  dueDate: string | null;
  /** Immutable internal app_users.id */
  assignedTo: number;
  /** Immutable internal app_users.id */
  assignedBy: number;
  attachedFile: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AppUser {
  /** Immutable internal primary key */
  id: number;
  /** Clerk sub — null until first login */
  clerkId: string | null;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

export interface PagedResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface CreatedUser {
  id: number;
  email: string;
}

export type TaskStatus = 'created' | 'assigned' | 'in_progress' | 'resolved' | 'done';
export type Priority   = 'low' | 'medium' | 'high' | 'critical';
export type UserRole   = 'admin' | 'supervisor' | 'employee';

export interface TaskQueryParams {
  page?: number;
  size?: number;
  status?: string;
  priority?: string;
}

// ── Error class ────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly errors?: string[],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ── Clerk token provider (set by AuthTokenBridge) ──────────────────────────────

type TokenProvider = () => Promise<string | null>;
let tokenProvider: TokenProvider = async () => null;

/** Register the async Clerk token getter. Called once from AuthTokenBridge. */
export function setTokenProvider(provider: TokenProvider) {
  tokenProvider = provider;
}

/** Fallback when AuthTokenBridge has not mounted yet — uses window.Clerk. */
async function resolveToken(): Promise<string | null> {
  const fromProvider = await tokenProvider();
  if (fromProvider) return fromProvider;

  if (typeof window !== 'undefined') {
    const clerk = (window as Window & {
      Clerk?: { session?: { getToken: (opts?: { template?: string }) => Promise<string | null> } };
    }).Clerk;
    try {
      return (await clerk?.session?.getToken({ template: 'quarkus' })) ?? null;
    } catch {
      return null;
    }
  }
  return null;
}

async function authHeaders(json = true): Promise<HeadersInit> {
  const token = await resolveToken();
  if (!token) {
    throw new ApiError('Not authenticated', 401);
  }
  return {
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    Authorization: `Bearer ${token}`,
  };
}

function handleAuthFailure() {
  // Soft-fail only: a hard redirect here fights Clerk's SignIn forceRedirectUrl
  // and creates /employee → /login → / → /employee loops when the JWT is briefly
  // unavailable (clock skew, template delay, token refresh).
  if (typeof window !== 'undefined') {
    console.warn('[TaskFlow] API auth failed (401). Staying on page; session may recover.');
  }
}

// ── Core request helper ────────────────────────────────────────────────────────

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, options);
  } catch {
    throw new ApiError(
      'Lost connection to the control tower. Check that the API is running and try again.',
      503,
    );
  }

  if (res.status === 401) {
    handleAuthFailure();
    throw new ApiError('Session expired. Please sign in again.', 401);
  }

  if (res.status >= 500) {
    throw new ApiError(
      'The control tower hit turbulence (server error). Please retry in a moment.',
      res.status,
    );
  }

  let json: { success: boolean; status: number; message: string; data: T; errors?: string[] };
  try {
    json = await res.json();
  } catch {
    throw new ApiError(`Server error (${res.status})`, res.status);
  }

  if (!json.success) {
    if ((json.status ?? res.status) === 401) {
      handleAuthFailure();
    }
    const base = json.message ?? 'Request failed';
    const detail = json.errors?.length ? `${base} (${json.errors.join('; ')})` : base;
    throw new ApiError(detail, json.status ?? res.status, json.errors);
  }

  return json.data;
}

// ── Users ──────────────────────────────────────────────────────────────────────

/** Sync the authenticated Clerk user into app_users (idempotent). */
export const syncUser = async (profile?: {
  email?: string;
  firstName?: string;
  lastName?: string;
}) =>
  request<AppUser>(`${BASE}/users/sync`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(profile ?? {}),
  });

export const getUsers = async () =>
  request<AppUser[]>(`${BASE}/users`, { headers: await authHeaders() });

export const createUser = async (data: {
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}) =>
  request<CreatedUser>(`${BASE}/users/create`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(data),
  });

export const getUser = async (id: number) =>
  request<AppUser>(`${BASE}/users/${id}`, { headers: await authHeaders() });

export const updateUser = async (
  id: number,
  data: { firstName: string; lastName: string; email: string; role: string },
) =>
  request<AppUser>(`${BASE}/users/${id}`, {
    method: 'PUT',
    headers: await authHeaders(),
    body: JSON.stringify(data),
  });

export const deleteUser = async (id: number) =>
  request<null>(`${BASE}/users/${id}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  });

// ── Tasks ──────────────────────────────────────────────────────────────────────

export const getTasks = async (params: TaskQueryParams = {}) => {
  const qs = new URLSearchParams();
  if (params.page  !== undefined) qs.set('page',     String(params.page));
  if (params.size  !== undefined) qs.set('size',     String(params.size));
  if (params.status)              qs.set('status',   params.status);
  if (params.priority)            qs.set('priority', params.priority);
  const query = qs.toString() ? `?${qs}` : '';
  return request<PagedResponse<Task>>(`${BASE}/tasks${query}`, {
    headers: await authHeaders(),
  });
};

export const getTask = async (taskId: number) =>
  request<Task>(`${BASE}/tasks/${taskId}`, { headers: await authHeaders() });

export const createTask = async (data: {
  taskTitle: string;
  taskDescription: string;
  assignedTo: number;
  priority?: string;
  dueDate?: string;
}) =>
  request<Task>(`${BASE}/tasks`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(data),
  });

export const assignTask = async (taskId: number, assignedTo: number) =>
  request<Task>(`${BASE}/tasks/assign`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ taskId, assignedTo }),
  });

export const updateTaskStatus = async (taskId: number, newStatus: string) =>
  request<Task>(`${BASE}/tasks/${taskId}/status`, {
    method: 'PUT',
    headers: await authHeaders(),
    body: JSON.stringify({ newStatus }),
  });

export const uploadTaskFile = async (taskId: number, file: File) => {
  const form = new FormData();
  form.append('file', file);
  return request<Task>(`${BASE}/tasks/${taskId}/upload`, {
    method: 'POST',
    headers: await authHeaders(false),
    body: form,
  });
};
