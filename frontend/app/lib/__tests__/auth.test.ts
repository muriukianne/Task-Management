import { describe, it, expect } from 'vitest';
import {
  decodeToken,
  getUserRoleFromToken,
  getUserIdFromToken,
} from '../auth';

/** base64url-encode a JSON object into a JWT-like segment. */
function seg(obj: unknown): string {
  return btoa(JSON.stringify(obj)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function fakeToken(payload: Record<string, unknown>): string {
  return `${seg({ alg: 'none', typ: 'JWT' })}.${seg(payload)}.sig`;
}

describe('decodeToken', () => {
  it('returns null for malformed tokens', () => {
    expect(decodeToken('garbage')).toBeNull();
    expect(decodeToken('a.b')).toBeNull();
  });

  it('decodes the payload segment', () => {
    const payload = decodeToken(fakeToken({ sub: 'user_1', role: 'admin' }));
    expect(payload?.sub).toBe('user_1');
    expect(payload?.role).toBe('admin');
  });
});

describe('getUserRoleFromToken', () => {
  it('returns null for missing tokens', () => {
    expect(getUserRoleFromToken(null)).toBeNull();
  });

  it('prefers a real top-level role over "authenticated"', () => {
    expect(getUserRoleFromToken(fakeToken({ role: 'authenticated', user_metadata: { role: 'supervisor' } })))
      .toBe('supervisor');
    expect(getUserRoleFromToken(fakeToken({ role: 'admin' }))).toBe('admin');
  });

  it('falls back to metadata roles', () => {
    expect(getUserRoleFromToken(fakeToken({ public_metadata: { role: 'employee' } })))
      .toBe('employee');
  });

  it('returns null when no role is present', () => {
    expect(getUserRoleFromToken(fakeToken({ sub: 'x' }))).toBeNull();
  });
});

describe('getUserIdFromToken', () => {
  it('extracts the sub claim', () => {
    expect(getUserIdFromToken(fakeToken({ sub: 'user_42' }))).toBe('user_42');
    expect(getUserIdFromToken(null)).toBeNull();
  });
});
