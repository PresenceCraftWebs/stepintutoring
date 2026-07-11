import { NavLink, Outlet } from 'react-router';
import {
  IconBriefcase,
  IconChart,
  IconDownload,
  IconHome,
  IconSearch,
  IconUpload,
} from '@/lib/icons';

const tabs = [
  { to: '/', label: 'Home', icon: IconHome, end: true },
  { to: '/search', label: 'Search', icon: IconSearch, end: false },
  { to: '/downloads', label: 'Downloads', icon: IconDownload, end: false },
  { to: '/progress', label: 'Progress', icon: IconChart, end: false },
] as const;

/** Brand mark used in the desktop sidebar (mirrors favicon.svg). */
function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden>
      <rect width="64" height="64" rx="14" fill="#0d5c55" />
      <path
        d="M12 48h12v-9h10v-9h10v-9h8v27H12z"
        fill="#ffffff"
        opacity="0.96"
      />
      <circle cx="18" cy="31" r="5" fill="#7dbdb2" />
    </svg>
  );
}

/*
 * App shell. Phones/tablets: single column + fixed bottom tab bar.
 * Laptops (lg:): the tab bar becomes a left sidebar rail and the content
 * column widens — the web build on Cloudflare Pages shouldn't feel like a
 * phone strip in the middle of a browser tab.
 */
export function TabLayout() {
  const sideLink = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-xl px-3.5 py-2.5 font-bold transition-colors ${
      isActive
        ? 'bg-brand-700 text-white'
        : 'text-ink-soft hover:bg-brand-50 hover:text-brand-800'
    }`;

  return (
    <div className="min-h-dvh lg:flex">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-line bg-surface px-4 py-6 lg:flex">
        <div className="flex items-center gap-3 px-2">
          <BrandMark />
          <div className="leading-tight">
            <p className="font-bold">Step-In Tutoring</p>
            <p className="text-xs text-ink-faint">Learn. Step by step.</p>
          </div>
        </div>

        <nav aria-label="Main" className="mt-8 flex flex-col gap-1">
          {tabs.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={sideLink}>
              <Icon size={20} />
              {label}
            </NavLink>
          ))}
        </nav>

        <p className="mt-8 px-3.5 text-xs font-bold tracking-wide text-ink-faint uppercase">
          More
        </p>
        <nav className="mt-1 flex flex-col gap-1">
          <NavLink to="/careers" className={sideLink}>
            <IconBriefcase size={20} />
            Career Corner
          </NavLink>
          <NavLink to="/admin-tools/upload" className={sideLink}>
            <IconUpload size={20} />
            Tutor / admin
          </NavLink>
        </nav>

        <p className="mt-auto px-3.5 text-xs text-ink-faint">
          Videos download for offline viewing on the Android app.
        </p>
      </aside>

      {/* Content */}
      <div className="min-w-0 flex-1 lg:pl-60">
        <main className="mx-auto w-full max-w-lg pb-24 lg:max-w-5xl lg:px-8 lg:pb-10">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav
        aria-label="Main"
        className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface lg:hidden"
      >
        <div className="mx-auto flex w-full max-w-lg">
          {tabs.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-bold ${
                  isActive ? 'text-brand-700' : 'text-ink-faint'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
