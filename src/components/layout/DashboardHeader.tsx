import { useAuth } from '@/hooks/useAuth';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CalendarDays, ChevronDown, LogOut, User } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BrandMark } from './Brand';
import { titleForPath } from './navigation';
import { roleLabel } from '@/lib/roles';

const todayLabel = () =>
  new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

export function DashboardHeader() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const pageTitle = titleForPath(pathname, profile?.role);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const initials = (profile?.full_name ?? 'U')
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="sticky top-0 z-20 border-b bg-card/90 pt-[env(safe-area-inset-top)] backdrop-blur-md">
      <div className="flex h-14 items-center justify-between gap-3 px-4 md:h-16 md:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <SidebarTrigger className="hidden h-9 w-9 shrink-0 rounded-lg border text-primary hover:bg-secondary md:inline-flex" />
          {/* On phones the menu lives in the bottom tab bar; show brand + page name here */}
          <BrandMark size="sm" className="md:hidden" />
          <p className="truncate text-base font-bold text-primary md:hidden">{pageTitle}</p>
          <div className="hidden min-w-0 items-center gap-2 rounded-lg bg-secondary px-3 py-1.5 text-sm font-medium text-primary md:flex">
            <CalendarDays className="h-4 w-4 shrink-0" />
            <span className="truncate">{todayLabel()}</span>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-11 gap-2.5 rounded-xl px-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-xs font-bold text-gold-500">
                {initials}
              </span>
              <span className="hidden text-left leading-tight sm:block">
                <span className="block max-w-[160px] truncate text-sm font-semibold">{profile?.full_name}</span>
                <span className="block text-xs font-normal text-muted-foreground">
                  {roleLabel(profile?.role)}
                </span>
              </span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64 rounded-xl" align="end">
            <DropdownMenuLabel className="font-normal">
              <p className="text-sm font-semibold">{profile?.full_name}</p>
              <p className="truncate text-xs text-muted-foreground">{profile?.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/dashboard/profile')} className="cursor-pointer py-2.5">
              <User className="mr-2 h-4 w-4" />
              My profile
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleSignOut}
              className="cursor-pointer py-2.5 text-destructive focus:bg-destructive/10 focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
