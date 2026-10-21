import { describe, it, expect } from 'vitest';
import {
  parseDueDate,
  daysUntilDue,
  getDueUrgency,
  formatDueLabel,
} from '../dueDate';

/** Build a yyyy-MM-dd string offset from today by `days` (local calendar). */
function isoOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

describe('parseDueDate', () => {
  it('returns null for empty/invalid input', () => {
    expect(parseDueDate(null)).toBeNull();
    expect(parseDueDate(undefined)).toBeNull();
    expect(parseDueDate('not-a-date')).toBeNull();
  });

  it('parses yyyy-MM-dd as a local calendar date', () => {
    const d = parseDueDate('2026-03-15');
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(2); // zero-based → March
    expect(d!.getDate()).toBe(15);
  });

  it('accepts an ISO datetime prefix', () => {
    expect(parseDueDate('2026-03-15T10:20:00Z')?.getDate()).toBe(15);
  });
});

describe('daysUntilDue', () => {
  it('is 0 for today and negative for past dates', () => {
    expect(daysUntilDue(isoOffset(0))).toBe(0);
    expect(daysUntilDue(isoOffset(-3))).toBe(-3);
    expect(daysUntilDue(isoOffset(10))).toBe(10);
  });

  it('is null for unparseable dates', () => {
    expect(daysUntilDue(null)).toBeNull();
  });
});

describe('getDueUrgency', () => {
  it('returns none for completed tasks', () => {
    expect(getDueUrgency(isoOffset(-5), 'done')).toBe('none');
  });

  it('classifies overdue / today / soon / upcoming', () => {
    expect(getDueUrgency(isoOffset(-1), 'in_progress')).toBe('overdue');
    expect(getDueUrgency(isoOffset(0), 'assigned')).toBe('today');
    expect(getDueUrgency(isoOffset(2), 'assigned')).toBe('soon');
    expect(getDueUrgency(isoOffset(30), 'assigned')).toBe('upcoming');
  });

  it('honours a custom soon threshold', () => {
    expect(getDueUrgency(isoOffset(6), 'assigned', 7)).toBe('soon');
    expect(getDueUrgency(isoOffset(6), 'assigned', 3)).toBe('upcoming');
  });

  it('returns none when no due date', () => {
    expect(getDueUrgency(null, 'assigned')).toBe('none');
  });
});

describe('formatDueLabel', () => {
  it('renders an em dash for missing dates', () => {
    expect(formatDueLabel(null)).toBe('—');
  });

  it('renders a short en-US label', () => {
    expect(formatDueLabel('2026-03-15')).toBe('Mar 15, 26');
  });
});
