/**
 * Calendar-date helpers for due-date urgency (avoids timezone false-overdue from Date parsing).
 */

export type DueUrgency = 'none' | 'upcoming' | 'soon' | 'today' | 'overdue';

const SOON_DAYS = 3;

/** Parse `yyyy-MM-dd` (or ISO datetime) as a local calendar date. */
export function parseDueDate(dueDate: string | null | undefined): Date | null {
  if (!dueDate) return null;
  const day = dueDate.slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function daysUntilDue(dueDate: string | null | undefined): number | null {
  const due = parseDueDate(dueDate);
  if (!due) return null;
  const today = startOfToday();
  return Math.round((due.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

export function getDueUrgency(
  dueDate: string | null | undefined,
  status?: string | null,
  soonDays = SOON_DAYS,
): DueUrgency {
  if (status === 'done') return 'none';
  const days = daysUntilDue(dueDate);
  if (days == null) return 'none';
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  if (days <= soonDays) return 'soon';
  return 'upcoming';
}

export function formatDueLabel(dueDate: string | null | undefined): string {
  const due = parseDueDate(dueDate);
  if (!due) return '—';
  return due.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
}

export function formatDueLong(dueDate: string | null | undefined): string {
  const due = parseDueDate(dueDate);
  if (!due) return '—';
  return due.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}
