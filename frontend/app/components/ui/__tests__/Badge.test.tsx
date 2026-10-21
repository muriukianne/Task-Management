import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge, PriorityBadge, RoleBadge, ActionBadge } from '../Badge';

describe('StatusBadge', () => {
  it('renders the friendly label for a known status', () => {
    render(<StatusBadge status="in_progress" />);
    expect(screen.getByText('In Progress')).toBeInTheDocument();
  });

  it('falls back to the raw status when unknown', () => {
    render(<StatusBadge status="archived" />);
    expect(screen.getByText('archived')).toBeInTheDocument();
  });
});

describe('PriorityBadge', () => {
  it('renders a known priority label', () => {
    render(<PriorityBadge priority="critical" />);
    expect(screen.getByText('Critical')).toBeInTheDocument();
  });

  it('defaults unknown priorities to Medium', () => {
    render(<PriorityBadge priority="mystery" />);
    expect(screen.getByText('Medium')).toBeInTheDocument();
  });
});

describe('RoleBadge', () => {
  it('renders the role text', () => {
    render(<RoleBadge role="supervisor" />);
    expect(screen.getByText('supervisor')).toBeInTheDocument();
  });
});

describe('ActionBadge', () => {
  it('humanises a known audit action', () => {
    render(<ActionBadge action="TASK_CREATED" />);
    expect(screen.getByText('Task created')).toBeInTheDocument();
  });

  it('derives a label for an unknown action', () => {
    render(<ActionBadge action="SOMETHING_HAPPENED" />);
    expect(screen.getByText('something happened')).toBeInTheDocument();
  });
});
