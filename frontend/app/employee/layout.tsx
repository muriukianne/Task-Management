import { redirect } from 'next/navigation';
import { getServerAppRole, isPrivilegedRole } from '../lib/server-auth';

export default async function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const role = await getServerAppRole();

  // Privileged users belong on the supervisor dashboard
  if (isPrivilegedRole(role)) {
    redirect('/supervisor');
  }

  return <>{children}</>;
}
