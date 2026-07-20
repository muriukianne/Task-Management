import { auth, currentUser } from '@clerk/nextjs/server';

type ClaimBag = Record<string, unknown>;

function roleFromObject(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const role = (value as ClaimBag).role;
  if (typeof role === 'string' && role.trim() && role !== 'authenticated') {
    return role.trim().toLowerCase();
  }
  return null;
}

/**
 * Resolve the app role for server layouts.
 * Checks session token custom claims first, then Clerk publicMetadata.
 */
export async function getServerAppRole(): Promise<string | null> {
  const { userId, sessionClaims } = await auth();
  if (!userId) return null;

  const claims = sessionClaims as ClaimBag | null;
  const fromClaims =
    roleFromObject(claims?.metadata) ??
    roleFromObject(claims?.public_metadata) ??
    roleFromObject(claims?.publicMetadata) ??
    (typeof claims?.role === 'string' && claims.role !== 'authenticated'
      ? claims.role.trim().toLowerCase()
      : null);

  if (fromClaims) return fromClaims;

  const user = await currentUser();
  return roleFromObject(user?.publicMetadata) ?? roleFromObject(user?.privateMetadata);
}

export function isPrivilegedRole(role: string | null | undefined): boolean {
  return role === 'supervisor' || role === 'admin';
}
