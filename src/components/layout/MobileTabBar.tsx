import { NavLink } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useSidebar } from '@/components/ui/sidebar';
import { navFor } from './navigation';

/** Bottom tab bar for phones: four main destinations plus the full menu. */
export function MobileTabBar() {
  const { profile } = useAuth();
  const { setOpenMobile } = useSidebar();
  const { tabs } = navFor(profile?.role);

  const tabClass = (active: boolean) =>
    [
      'relative flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-semibold transition-colors',
      active ? 'text-primary' : 'text-muted-foreground',
    ].join(' ');

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 pb-safe backdrop-blur-md md:hidden">
      <div className="mx-auto flex max-w-lg items-stretch px-2">
        {tabs.map((item) => (
          <NavLink key={item.url} to={item.url} end className={({ isActive }) => tabClass(isActive)}>
            {({ isActive }) => (
              <>
                <span
                  className={`absolute top-0 h-[3px] w-8 rounded-b-full bg-gold-500 transition-opacity duration-200 ${isActive ? 'opacity-100' : 'opacity-0'}`}
                />
                <span
                  className={`flex h-8 w-12 items-center justify-center rounded-full transition-colors duration-200 ${isActive ? 'bg-primary/10' : ''}`}
                >
                  <item.icon className="h-5 w-5" strokeWidth={isActive ? 2.4 : 2} />
                </span>
                {item.short ?? item.title}
              </>
            )}
          </NavLink>
        ))}
        <button onClick={() => setOpenMobile(true)} className={tabClass(false)}>
          <span className="flex h-8 w-12 items-center justify-center rounded-full">
            <Menu className="h-5 w-5" />
          </span>
          Menu
        </button>
      </div>
    </nav>
  );
}
