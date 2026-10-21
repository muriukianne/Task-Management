import { describe, it, expect } from 'vitest';
import {
  ApiError,
  isStaleTaskError,
  requireTaskVersion,
  STALE_TASK_MESSAGE,
  type Task,
} from '../api';

function task(overrides: Partial<Task> = {}): Task {
  return {
    taskId: 1,
    taskTitle: 'T',
    taskDescription: 'D',
    status: 'assigned',
    priority: 'medium',
    dueDate: null,
    assignedTo: 2,
    assignedBy: 3,
    attachedFile: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('ApiError', () => {
  it('captures status code and name', () => {
    const err = new ApiError('boom', 500);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ApiError');
    expect(err.statusCode).toBe(500);
    expect(err.message).toBe('boom');
  });
});

describe('isStaleTaskError', () => {
  it('is true only for 409 ApiErrors', () => {
    expect(isStaleTaskError(new ApiError('conflict', 409))).toBe(true);
    expect(isStaleTaskError(new ApiError('server', 500))).toBe(false);
    expect(isStaleTaskError(new Error('plain'))).toBe(false);
    expect(isStaleTaskError(null)).toBe(false);
  });
});

describe('requireTaskVersion', () => {
  it('returns the version when present', () => {
    expect(requireTaskVersion(task({ version: 4 }))).toBe(4);
  });

  it('throws a stale-task ApiError when version is missing', () => {
    expect(() => requireTaskVersion(task())).toThrowError(ApiError);
    try {
      requireTaskVersion(task());
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).statusCode).toBe(409);
      expect((e as ApiError).message).toBe(STALE_TASK_MESSAGE);
    }
  });
});
