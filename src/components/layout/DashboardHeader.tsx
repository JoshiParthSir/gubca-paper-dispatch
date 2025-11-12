import { useAuth } from '@/hooks/useAuth';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogOut, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function DashboardHeader() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <header className="h-16 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 animate-fade-in-down">
      <div className="flex h-full items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="h-8 w-8 hover-scale transition-transform" />
          <div className="animate-fade-in">
            <h1 className="text-lg font-semibold">
              {profile?.role === 'chairperson' ? 'Chairperson Dashboard' : 'College Admin Dashboard'}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full hover-scale transition-all hover-glow">
                <Avatar className="h-8 w-8 animate-scale-in">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {profile?.full_name ? getInitials(profile.full_name) : 'U'}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 animate-scale-in bg-popover/95 backdrop-blur-sm text-popover-foreground border border-border shadow-xl z-[100]" align="end" forceMount>
              <DropdownMenuLabel className="font-normal text-popover-foreground">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none text-popover-foreground">{profile?.full_name}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {profile?.email}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground capitalize">
                    {profile?.role?.replace('_', ' ')}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => navigate('/dashboard/profile')}
                className="cursor-pointer transition-colors hover:bg-accent hover:text-accent-foreground text-popover-foreground"
              >
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer transition-colors hover:bg-destructive hover:text-destructive-foreground text-popover-foreground">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}