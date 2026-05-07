const TOKEN_KEY = 'tm_token';

export const saveToken = (token: string): void => {
  localStorage.setItem(TOKEN_KEY, token);
};

export const getToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
};

export const removeToken = (): void => {
  localStorage.removeItem(TOKEN_KEY);
};

interface JwtPayload {
  sub?: string;
  email?: string;
  role?: string;
  user_metadata?: { role?: string; full_name?: string; email?: string };
  exp?: number;
}

export const decodeToken = (token: string): JwtPayload | null => {
  try {
    const part = token.split('.')[1];
    return JSON.parse(atob(part));
  } catch {
    return null;
  }
};
    
export const getUserRole = (): string | null => {
  const token = getToken();
  if (!token) return null;
  const payload = decodeToken(token);
  if (!payload) return null;
  const topLevel = payload.role;
  if (topLevel && topLevel !== 'authenticated') return topLevel;
  return payload.user_metadata?.role ?? null;
};

export const getUserId = (): string | null => {
  const token = getToken();
  if (!token) return null;
  return decodeToken(token)?.sub ?? null;
};

export const isLoggedIn = (): boolean => {
  const token = getToken();
  if (!token) return false;
  const payload = decodeToken(token);
  if (!payload?.exp) return true;
  return Date.now() / 1000 < payload.exp;
};
