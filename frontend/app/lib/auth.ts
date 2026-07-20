'use client';

/**
 * JWT helpers for Clerk (and other OIDC) access tokens.
 * Token storage is owned by Clerk — do not use localStorage for auth tokens.
 */

export interface JwtPayload {
  sub?: string;
  email?: string;
  role?: string;
  full_name?: string;
  name?: string;
  exp?: number;
  user_metadata?: { role?: string; full_name?: string; email?: string };
  public_metadata?: { role?: string };
}

export const decodeToken = (token: string): JwtPayload | null => {
  try {
    const part = token.split('.')[1];
    return JSON.parse(atob(part));
  } catch {
    return null;
  }
};

export const getUserRoleFromToken = (token: string | null): string | null => {
  if (!token) return null;
  const payload = decodeToken(token);
  if (!payload) return null;
  const topLevel = payload.role;
  if (topLevel && topLevel !== 'authenticated') return topLevel;
  return payload.user_metadata?.role
    ?? payload.public_metadata?.role
    ?? null;
};

export const getUserIdFromToken = (token: string | null): string | null => {
  if (!token) return null;
  return decodeToken(token)?.sub ?? null;
};

/** @deprecated Tokens come from Clerk via AuthTokenBridge — no-op. */
export const saveToken = (_token: string): void => {};

/** @deprecated Use Clerk getToken({ template: 'quarkus' }) via the API token provider. */
export const getToken = (): string | null => null;

/** @deprecated Use Clerk signOut() instead. */
export const removeToken = (): void => {};

/** @deprecated Use useAuth().isSignedIn from @clerk/nextjs. */
export const isLoggedIn = (): boolean => false;

/** @deprecated Use getUserRoleFromToken(await getToken({ template: 'quarkus' })). */
export const getUserRole = (): string | null => null;

/** @deprecated Use getUserIdFromToken(await getToken({ template: 'quarkus' })). */
export const getUserId = (): string | null => null;
