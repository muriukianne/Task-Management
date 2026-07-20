'use client';

interface UserAvatarProps {
  firstName?: string;
  lastName?: string;
  email?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE: Record<NonNullable<UserAvatarProps['size']>, string> = {
  sm: 'w-7 h-7 text-[10px]',
  md: 'w-8 h-8 text-xs',
  lg: 'w-10 h-10 text-sm',
};

function initials(firstName?: string, lastName?: string, email?: string) {
  const a = (firstName?.trim()?.[0] ?? '').toUpperCase();
  const b = (lastName?.trim()?.[0] ?? '').toUpperCase();
  if (a || b) return `${a}${b}` || a || b;
  return (email?.trim()?.[0] ?? '?').toUpperCase();
}

/** Deterministic soft accent from a name/email seed. */
function hueFromSeed(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(hash) % 360;
}

export default function UserAvatar({
  firstName = '',
  lastName = '',
  email = '',
  size = 'md',
  className = '',
}: UserAvatarProps) {
  const seed = `${firstName}${lastName}${email}` || 'user';
  const hue = hueFromSeed(seed);

  return (
    <div
      aria-hidden="true"
      className={[
        'rounded-full flex items-center justify-center font-bold text-white shrink-0 select-none',
        'ring-2 ring-white/40 dark:ring-black/20',
        SIZE[size],
        className,
      ].join(' ')}
      style={{
        background: `linear-gradient(135deg, hsl(${hue} 55% 48%), hsl(${(hue + 28) % 360} 60% 38%))`,
      }}
    >
      {initials(firstName, lastName, email)}
    </div>
  );
}
