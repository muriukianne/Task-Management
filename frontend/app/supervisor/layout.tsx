import { redirect } from 'next/navigation';
import { getServerAppRole, isPrivilegedRole } from '../lib/server-auth';

export default async function SupervisorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const role = await getServerAppRole();

  // Block before any supervisor UI ships to the client
  if (!isPrivilegedRole(role)) {
    redirect('/employee');
  }

  return <>{children}</>;
}
