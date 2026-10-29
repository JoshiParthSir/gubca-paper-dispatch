import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { X } from 'lucide-react';
import { BrandMark, Wordmark } from './Brand';
import { navFor } from './navigation';

// Collapsed (icon) mode: the sidebar is 4.5rem wide with 0.75rem padding,
// leaving a 3rem column. Every row keeps its icon at the same left offset in
// both states, and labels fade instead of popping, so collapsing is smooth.
const fadeWhenCollapsed =
  'whitespace-nowrap transition-[opacity,transform] duration-200 group-data-[collapsible=icon]:pointer-events-none group-data-[collapsible=icon]:-translate-x-1 group-data-[collapsible=icon]:opacity-0';

export function AppSidebar() {
  const { profile } = useAuth();
  const { pathname } = useLocation();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === 'collapsed' && !isMobile;
  const isChair = profile?.role === 'chairperson';
  const { groups } = navFor(profile?.role);

  const initials = (profile?.full_name ?? 'U')
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="px-3 pb-3 pt-4">
        <div className="flex h-10 items-center gap-3 overflow-hidden pl-2">
          <BrandMark size="sm" />
          <Wordmark onDark className={`text-[17px] ${fadeWhenCollapsed}`} />
          {isMobile && (
            <button
              onClick={() => setOpenMobile(false)}
              className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg text-sidebar-foreground hover:bg-sidebar-accent hover:text-white"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-0 px-3">
        {groups.map((group, gi) => (
          <SidebarGroup key={group.label} className="px-0 py-1.5">
            <div className="relative flex h-7 items-center px-3">
              <span
                className={`text-[10.5px] font-semibold uppercase tracking-[0.1em] text-sidebar-foreground/50 ${fadeWhenCollapsed}`}
              >
                {group.label}
              </span>
              {gi > 0 && (
                <span className="absolute inset-x-2 top-1/2 h-px bg-sidebar-border opacity-0 transition-opacity duration-200 group-data-[collapsible=icon]:opacity-100" />
              )}
            </div>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        {/* Plain string className: the tooltip trigger (Radix Slot) cannot merge
                            NavLink's function form and would stringify it. */}
                        <NavLink
                          to={item.url}
                          end
                          onClick={() => isMobile && setOpenMobile(false)}
                          aria-current={pathname === item.url ? 'page' : undefined}
                          className={[
                            'relative flex h-11 items-center gap-3 overflow-hidden rounded-xl pl-[15px] pr-3 text-sm font-medium transition-colors duration-150',
                            pathname === item.url
                              ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-[0_8px_20px_-10px_hsl(var(--gold-600))]'
                              : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                          ].join(' ')}
                        >
                          <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
                          <span className={fadeWhenCollapsed}>{item.title}</span>
                        </NavLink>
                      </TooltipTrigger>
                      <TooltipContent side="right" sideOffset={10} hidden={!collapsed} className="font-medium">
                        {item.title}
                      </TooltipContent>
                    </Tooltip>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="p-3">
        <div className="flex items-center gap-3 overflow-hidden rounded-xl bg-sidebar-accent p-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold-500 text-xs font-bold text-navy-900">
            {initials}
          </span>
          <div className={`min-w-0 leading-tight ${fadeWhenCollapsed}`}>
            <p className="truncate text-sm font-semibold text-white">{profile?.full_name}</p>
            <p className="truncate text-xs text-sidebar-foreground/70">{isChair ? 'Chairperson' : 'College Admin'}</p>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
