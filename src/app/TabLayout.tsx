import { NavLink, Outlet } from 'react-router';
import {
  IconChart,
  IconDownload,
  IconHome,
  IconSearch,
} from '@/lib/icons';

const tabs = [
  { to: '/', label: 'Home', icon: IconHome, end: true },
  { to: '/search', label: 'Search', icon: IconSearch, end: false },
  { to: '/downloads', label: 'Downloads', icon: IconDownload, end: false },
  { to: '/progress', label: 'Progress', icon: IconChart, end: false },
] as const;

export function TabLayout() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
      <main className="flex-1 pb-24">
        <Outlet />
      </main>

      <nav
        aria-label="Main"
        className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface"
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
