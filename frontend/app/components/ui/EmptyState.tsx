interface EmptyStateProps {
  icon?: React.ReactNode;
  title?: string;
  description?: string;
  action?: React.ReactNode;
}

function ClearSkiesIcon() {
  return (
    <div className="relative w-20 h-20 mb-5 flex items-center justify-center">
      <div className="absolute inset-0 rounded-3xl bg-[var(--accent-subtle)] animate-pulse-soft" />
      <svg
        width="48"
        height="48"
        viewBox="0 0 48 48"
        fill="none"
        aria-hidden="true"
        className="relative"
      >
        {/* Soft sun */}
        <circle cx="34" cy="14" r="7" fill="var(--accent)" opacity="0.25" />
        <circle cx="34" cy="14" r="4.5" fill="var(--accent)" opacity="0.55" />
        {/* Cloud body */}
        <path
          d="M14 32c-4.4 0-8-3.1-8-7s3.6-7 8-7c.7-3.9 4.2-7 8.4-7 4.5 0 8.2 3.4 8.6 7.7 3.5.4 6 3.2 6 6.8 0 3.7-3.1 6.5-7 6.5H14z"
          fill="var(--accent)"
          opacity="0.18"
        />
        <path
          d="M16 30c-3.3 0-6-2.5-6-5.5S12.7 19 16 19c.5-3 3.2-5.3 6.4-5.3 3.4 0 6.2 2.6 6.5 5.9 2.6.3 4.6 2.4 4.6 5.1 0 2.8-2.3 5.3-5.3 5.3H16z"
          fill="var(--accent)"
          opacity="0.45"
        />
        {/* Checkmark spark */}
        <path
          d="M20 28.5l3 3 6.5-7"
          stroke="var(--accent)"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export default function EmptyState({
  icon,
  title = 'Clear skies ahead',
  description = 'No tasks found. Create your first task to get started!',
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center animate-fade-in">
      {icon ?? <ClearSkiesIcon />}
      <h3 className="text-base font-semibold text-[var(--text-primary)] mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-[var(--text-secondary)] max-w-sm mb-5">{description}</p>
      )}
      {action}
    </div>
  );
}
