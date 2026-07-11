import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { IconArrowLeft } from '@/lib/icons';

/** Standard page shell: sticky header with optional back button. */
export function Screen({
  title,
  back,
  children,
  actions,
}: {
  title: string;
  back?: boolean;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <div>
      <header className="pt-safe sticky top-0 z-30 border-b border-line bg-paper/95 backdrop-blur">
        <div className="flex min-h-14 items-center gap-2 px-4 py-2">
          {back && (
            <button
              type="button"
              onClick={() => void navigate(-1)}
              aria-label="Back"
              className="-ml-2 rounded-full p-2 text-ink-soft active:bg-line"
            >
              <IconArrowLeft size={22} />
            </button>
          )}
          <h1 className="flex-1 truncate text-lg font-bold">{title}</h1>
          {actions}
        </div>
      </header>
      <div className="px-4 py-4">{children}</div>
    </div>
  );
}

/** Progress ring used on subject cards and the Progress tab. */
export function ProgressRing({
  fraction,
  color,
  size = 44,
  children,
}: {
  fraction: number;
  color: string;
  size?: number;
  children?: ReactNode;
}) {
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, fraction));
  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${Math.round(clamped * 100)}% complete`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-line)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}

const SUBJECT_GLYPHS: Record<string, ReactNode> = {
  sigma: (
    <path d="M6 4h12M6 4l6 8-6 8M6 20h12" fill="none" strokeWidth={2} />
  ),
  atom: (
    <>
      <ellipse cx="12" cy="12" rx="9" ry="3.8" fill="none" strokeWidth={1.8} />
      <ellipse
        cx="12"
        cy="12"
        rx="9"
        ry="3.8"
        transform="rotate(60 12 12)"
        fill="none"
        strokeWidth={1.8}
      />
      <circle cx="12" cy="12" r="1.6" />
    </>
  ),
  leaf: (
    <path
      d="M5 19C5 9 12 4 20 4c0 9-5 15-15 15Zm0 0c3-5 7-9 11-11"
      fill="none"
      strokeWidth={2}
    />
  ),
  book: (
    <path
      d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5Zm0 15V5.5M20 18v3H6.5"
      fill="none"
      strokeWidth={2}
    />
  ),
  ledger: (
    <path
      d="M5 3h14v18H5Zm4 0v18M12 7h4M12 11h4M12 15h4"
      fill="none"
      strokeWidth={2}
    />
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" fill="none" strokeWidth={2} />
      <path
        d="M3 12h18M12 3a14.5 14.5 0 0 1 0 18 14.5 14.5 0 0 1 0-18"
        fill="none"
        strokeWidth={2}
      />
    </>
  ),
};

/** Subject glyph in the subject's accent colour, with a letter fallback. */
export function SubjectIcon({
  icon,
  name,
  color,
  size = 28,
}: {
  icon: string;
  name: string;
  color: string;
  size?: number;
}) {
  const glyph = SUBJECT_GLYPHS[icon];
  if (!glyph) {
    return (
      <span
        className="inline-flex items-center justify-center rounded-full font-bold text-white"
        style={{ width: size, height: size, backgroundColor: color }}
      >
        {name.charAt(0)}
      </span>
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      stroke={color}
      fill={color}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {glyph}
    </svg>
  );
}

export function EmptyState({
  title,
  hint,
}: {
  title: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-surface px-6 py-10 text-center">
      <p className="font-bold text-ink-soft">{title}</p>
      {hint && <p className="mt-1 text-sm text-ink-faint">{hint}</p>}
    </div>
  );
}

/** Small pill chip, used for tags and filters. */
export function Chip({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-bold ${
        active
          ? 'border-brand-700 bg-brand-700 text-white'
          : 'border-line bg-surface text-ink-soft'
      }`}
    >
      {children}
    </button>
  );
}

/** Card link with chevron used in lists. */
export function CardLink({
  to,
  children,
}: {
  to: string;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 active:bg-brand-50"
    >
      {children}
    </Link>
  );
}
