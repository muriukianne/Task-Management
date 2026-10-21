const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/tm/api/v1';

// ── Unified envelope (mirrors backend ApiResponse<T>) ──────────────────────────

export interface ApiResponse<T> {
  requestId?: string;
  correlationId?: string;
  responseCode: string;
  responseMessage: string;
  errorCode?: string;
  errorMessage?: string;
  technicalMessage?: string;
  timestamp: string;
  data: T;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TaskAssignee {
  userId: number;
  role: 'LEAD' | 'CO_ASSIGNEE' | string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
}

export interface TaskDependency {
  taskId: number;
  taskTitle: string;
  status: TaskStatus | string;
  satisfied: boolean;
}

export interface Task {
  taskId: number;
  taskTitle: string;
  taskDescription: string;
  status: TaskStatus;
  priority: Priority;
  dueDate: string | null;
  /** Primary lead — immutable internal app_users.id */
  assignedTo: number;
  /** Immutable internal app_users.id */
  assignedBy: number;
  attachedFile: string | null;
  /** Optimistic concurrency token from the API */
  version?: number;
  createdAt: string;
  updatedAt: string;
  /** Lead + co-assignees (API enrichment) */
  assignees?: TaskAssignee[];
  /**
   * Caller's role on this task: LEAD | CO_ASSIGNEE
   * (set by API for the authenticated viewer).
   */
  viewerAssigneeRole?: 'LEAD' | 'CO_ASSIGNEE' | string | null;
  /** Co-assignee who submitted for lead approval */
  approvalRequestedBy?: number | null;
  /** Blockers this task depends on */
  dependencies?: TaskDependency[];
  /** Tasks waiting on this one */
  dependents?: TaskDependency[];
  /** True when any dependency is unfinished */
  blocked?: boolean;
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

export type TaskStatus =
  | 'created'
  | 'assigned'
  | 'in_progress'
  | 'pending_approval'
  | 'resolved'
  | 'done';
export type Priority   = 'low' | 'medium' | 'high' | 'critical';
export type UserRole   = 'admin' | 'supervisor' | 'employee';

export type ActivityActionType =
  | 'STATUS_CHANGED'
  | 'ASSIGNEE_CHANGED'
  | 'COMMENT_ADDED'
  | 'FILE_UPLOADED'
  | 'TASK_CREATED'
  | 'TASK_REJECTED'
  | 'USER_CREATED'
  | 'USER_UPDATED'
  | 'USER_DELETED';

export interface ActivityLog {
  id: number;
  taskId: number | null;
  taskTitle: string | null;
  actorId: number;
  actorName: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  actionType: ActivityActionType | string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
}

export interface TaskQueryParams {
  page?: number;
  size?: number;
  status?: string;
  priority?: string;
}

export interface ActivityQueryParams {
  page?: number;
  size?: number;
  actorId?: number;
  actionType?: string;
  taskId?: number;
}

// ── Error class ────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly errors?: string[],
    public readonly errorCode?: string,
    public readonly requestId?: string,
    public readonly correlationId?: string,
    public readonly technicalMessage?: string,
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

const CORRELATION_STORAGE_KEY = 'tm.correlationId';

function newId(): string {
  return crypto.randomUUID();
}

/** Stable per browser tab so a UI flow shares one correlationId across calls. */
function sessionCorrelationId(): string {
  if (typeof window === 'undefined') {
    return newId();
  }
  try {
    const existing = sessionStorage.getItem(CORRELATION_STORAGE_KEY);
    if (existing) return existing;
    const created = newId();
    sessionStorage.setItem(CORRELATION_STORAGE_KEY, created);
    return created;
  } catch {
    return newId();
  }
}

function tracingHeaders(): Record<string, string> {
  return {
    'X-Request-Id': newId(),
    'X-Correlation-Id': sessionCorrelationId(),
  };
}

function mergeHeaders(init?: HeadersInit, extra?: Record<string, string>): Headers {
  const headers = new Headers(init);
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (!headers.has(key)) {
        headers.set(key, value);
      }
    }
  }
  return headers;
}

function statusFromCode(responseCode: string | undefined, fallback: number): number {
  const parsed = Number(responseCode);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isSuccessEnvelope(envelope: ApiResponse<unknown>, httpStatus: number): boolean {
  if (envelope.errorCode) return false;
  const code = statusFromCode(envelope.responseCode, httpStatus);
  return code >= 200 && code < 300;
}

function validationErrors(envelope: ApiResponse<unknown>): string[] | undefined {
  if (envelope.errorCode !== 'VALIDATION_ERROR' || !envelope.errorMessage) {
    return undefined;
  }
  return envelope.errorMessage.split(';').map((part) => part.trim()).filter(Boolean);
}

function errorFromEnvelope(envelope: ApiResponse<unknown>, httpStatus: number): ApiError {
  const statusCode = statusFromCode(envelope.responseCode, httpStatus);
  const message =
    envelope.errorMessage
    || envelope.responseMessage
    || 'Request failed';
  return new ApiError(
    message,
    statusCode,
    validationErrors(envelope),
    envelope.errorCode,
    envelope.requestId,
    envelope.correlationId,
    envelope.technicalMessage,
  );
}

// ── Core request helper ────────────────────────────────────────────────────────

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const headers = mergeHeaders(options?.headers, tracingHeaders());
  let res: Response;
  try {
    res = await fetch(url, { ...options, headers });
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

  let json: ApiResponse<T>;
  try {
    json = await res.json();
  } catch {
    if (res.status >= 500) {
      throw new ApiError(
        'The control tower hit turbulence (server error). Please retry in a moment.',
        res.status,
      );
    }
    throw new ApiError(`Server error (${res.status})`, res.status);
  }

  if (!isSuccessEnvelope(json, res.status)) {
    if (statusFromCode(json.responseCode, res.status) === 401) {
      handleAuthFailure();
    }
    if (res.status >= 500 && !json.errorMessage) {
      throw new ApiError(
        'The control tower hit turbulence (server error). Please retry in a moment.',
        res.status,
        undefined,
        json.errorCode,
        json.requestId,
        json.correlationId,
        json.technicalMessage,
      );
    }
    throw errorFromEnvelope(json, res.status);
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

/** Update the authenticated user's own name/email. */
export const updateOwnProfile = async (data: {
  firstName: string;
  lastName: string;
  email: string;
}) =>
  request<AppUser>(`${BASE}/users/me`, {
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
  coAssignees?: number[];
  dependsOnTaskIds?: number[];
  priority?: string;
  dueDate?: string;
}) =>
  request<Task>(`${BASE}/tasks`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(data),
  });

export const assignTask = async (
  taskId: number,
  assignedTo: number,
  coAssignees?: number[],
) =>
  request<Task>(`${BASE}/tasks/assign`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ taskId, assignedTo, coAssignees: coAssignees ?? [] }),
  });

export const addTaskDependency = async (taskId: number, dependsOnTaskId: number) =>
  request<Task>(`${BASE}/tasks/${taskId}/dependencies`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ dependsOnTaskId }),
  });

export const removeTaskDependency = async (taskId: number, dependsOnTaskId: number) =>
  request<void>(`${BASE}/tasks/${taskId}/dependencies/${dependsOnTaskId}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  });

export const STALE_TASK_MESSAGE =
  'Someone else updated this task — please refresh';

export function isStaleTaskError(err: unknown): boolean {
  return err instanceof ApiError && err.statusCode === 409;
}

/** Last-seen OCC token. Missing version is treated as stale so the UI refetches. */
export function requireTaskVersion(task: Task): number {
  if (typeof task.version !== 'number') {
    throw new ApiError(STALE_TASK_MESSAGE, 409);
  }
  return task.version;
}

export const updateTaskStatus = async (
  taskId: number,
  newStatus: string,
  version: number,
) =>
  request<Task>(`${BASE}/tasks/${taskId}/status`, {
    method: 'PUT',
    headers: await authHeaders(),
    body: JSON.stringify({ newStatus, version }),
  });

export const rejectTask = async (taskId: number, reason: string) =>
  request<Task>(`${BASE}/tasks/${taskId}/reject`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ reason }),
  });

export interface TaskComment {
  id: number;
  taskId: number;
  authorId: number;
  authorName: string | null;
  authorEmail: string | null;
  authorRole: string | null;
  body: string;
  createdAt: string;
}

export const getTaskComments = async (taskId: number) =>
  request<TaskComment[]>(`${BASE}/tasks/${taskId}/comments`, {
    headers: await authHeaders(),
  });

export const addTaskComment = async (taskId: number, body: string) =>
  request<TaskComment>(`${BASE}/tasks/${taskId}/comments`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ body }),
  });

// ── Task documents ─────────────────────────────────────────────────────────────

export interface TaskDocument {
  id: number;
  taskId: number;
  uploadedBy: number;
  uploaderName: string | null;
  uploaderRole: string | null;
  originalName: string;
  contentType: string | null;
  sizeBytes: number;
  createdAt: string;
}

export const getTaskDocuments = async (taskId: number) =>
  request<TaskDocument[]>(`${BASE}/tasks/${taskId}/documents`, {
    headers: await authHeaders(),
  });

export const uploadTaskDocument = async (taskId: number, file: File) => {
  const form = new FormData();
  form.append('file', file);
  return request<TaskDocument>(`${BASE}/tasks/${taskId}/documents`, {
    method: 'POST',
    headers: await authHeaders(false),
    body: form,
  });
};

/** @deprecated Prefer uploadTaskDocument — returns document metadata now. */
export const uploadTaskFile = async (taskId: number, file: File) =>
  uploadTaskDocument(taskId, file);

export const deleteTaskDocument = async (taskId: number, documentId: number) =>
  request<null>(`${BASE}/tasks/${taskId}/documents/${documentId}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  });

export async function downloadTaskDocument(
  taskId: number,
  documentId: number,
  filename: string,
): Promise<void> {
  const token = await resolveToken();
  if (!token) throw new ApiError('Not authenticated', 401);

  const res = await fetch(`${BASE}/tasks/${taskId}/documents/${documentId}/download`, {
    headers: {
      Authorization: `Bearer ${token}`,
      ...tracingHeaders(),
    },
  });
  if (!res.ok) {
    try {
      const json = (await res.json()) as ApiResponse<unknown>;
      throw errorFromEnvelope(json, res.status);
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(
        res.status === 404 ? 'Document not found' : 'Download failed',
        res.status,
      );
    }
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ── Activity / audit trail ─────────────────────────────────────────────────────

export const getActivity = async (params: ActivityQueryParams = {}) => {
  const qs = new URLSearchParams();
  if (params.page  !== undefined) qs.set('page',       String(params.page));
  if (params.size  !== undefined) qs.set('size',       String(params.size));
  if (params.actorId !== undefined) qs.set('actorId',  String(params.actorId));
  if (params.actionType)          qs.set('actionType', params.actionType);
  if (params.taskId !== undefined) qs.set('taskId',    String(params.taskId));
  const query = qs.toString() ? `?${qs}` : '';
  return request<PagedResponse<ActivityLog>>(`${BASE}/activity${query}`, {
    headers: await authHeaders(),
  });
};

// ── Notifications ─────────────────────────────────────────────────────────────

export type NotificationType =
  | 'COMMENT_ADDED'
  | 'TASK_REJECTED'
  | 'STATUS_CHANGED'
  | 'ASSIGNEE_CHANGED'
  | 'TASK_CREATED'
  | 'FILE_UPLOADED'
  | 'DUE_SOON'
  | 'DUE_TODAY'
  | 'OVERDUE'
  | 'LEAD_APPROVAL_PENDING';

export interface AppNotification {
  id: number;
  recipientId: number;
  actorId: number | null;
  actorName: string | null;
  taskId: number | null;
  taskTitle: string | null;
  type: NotificationType | string;
  title: string;
  body: string | null;
  read: boolean;
  readAt: string | null;
  createdAt: string;
}

export const getNotifications = async (params: {
  page?: number;
  size?: number;
  unreadOnly?: boolean;
} = {}) => {
  const qs = new URLSearchParams();
  if (params.page !== undefined) qs.set('page', String(params.page));
  if (params.size !== undefined) qs.set('size', String(params.size));
  if (params.unreadOnly) qs.set('unreadOnly', 'true');
  const query = qs.toString() ? `?${qs}` : '';
  return request<PagedResponse<AppNotification>>(`${BASE}/notifications${query}`, {
    headers: await authHeaders(),
  });
};

export const getUnreadNotificationCount = async () =>
  request<{ count: number }>(`${BASE}/notifications/unread-count`, {
    headers: await authHeaders(),
  });

export const markNotificationRead = async (id: number) =>
  request<AppNotification>(`${BASE}/notifications/${id}/read`, {
    method: 'POST',
    headers: await authHeaders(),
  });

export const markAllNotificationsRead = async () =>
  request<{ marked: number }>(`${BASE}/notifications/read-all`, {
    method: 'POST',
    headers: await authHeaders(),
  });

