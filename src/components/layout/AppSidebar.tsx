import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  GraduationCap,
  Building2,
  Users,
  FileText,
  Calendar,
  Download,
  BarChart3,
  Settings,
} from 'lucide-react';

const chairpersonItems = [
  { title: 'Dashboard', url: '/dashboard', icon: BarChart3 },
  { title: 'Colleges', url: '/dashboard/colleges', icon: Building2 },
  { title: 'Batches', url: '/dashboard/batches', icon: Users },
  { title: 'Papers', url: '/dashboard/papers', icon: FileText },
  { title: 'Allocations', url: '/dashboard/allocations', icon: Calendar },
  { title: 'Download Logs', url: '/dashboard/logs', icon: BarChart3 },
];

const collegeAdminItems = [
  { title: 'Dashboard', url: '/dashboard', icon: BarChart3 },
  { title: 'Scheduled Papers', url: '/dashboard/scheduled', icon: Calendar },
  { title: 'Downloads', url: '/dashboard/downloads', icon: Download },
];

export function AppSidebar() {
  const { open, setOpen } = useSidebar();
  const { profile } = useAuth();
  const location = useLocation();
  const currentPath = location.pathname;

  const items = profile?.role === 'chairperson' ? chairpersonItems : collegeAdminItems;
  
  const handleNavClick = () => {
    // Collapse sidebar on mobile after navigation
    if (window.innerWidth < 768) {
      setOpen(false);
    }
  };

  return (
    <Sidebar
      className={open ? 'w-60' : 'w-14'}
    >
      <SidebarContent>
        {/* App Logo */}
        <div className="p-4 border-b border-sidebar-border animate-fade-in">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-sidebar-primary rounded-lg flex items-center justify-center animate-bounce-in hover-scale transition-all">
              <GraduationCap className="h-4 w-4 text-sidebar-primary-foreground" />
            </div>
            {open && (
              <div className="animate-fade-in-left">
                <h1 className="font-semibold text-sidebar-foreground">Exam System</h1>
                <p className="text-xs text-sidebar-foreground/70">
                  {profile?.role === 'chairperson' ? 'Chairperson' : 'College Admin'}
                </p>
              </div>
            )}
          </div>
        </div>

        <SidebarGroup>
          <SidebarGroupLabel>Main Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item, index) => (
                <SidebarMenuItem 
                  key={item.title}
                  className="animate-fade-in-up"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to={item.url} 
                      end 
                      className={({ isActive }) =>
                        isActive 
                          ? 'flex items-center gap-2 rounded-md px-3 py-2 bg-sidebar-accent text-sidebar-accent-foreground font-medium' 
                          : 'flex items-center gap-2 rounded-md px-3 py-2 hover:bg-sidebar-accent/50 transition-colors'
                      }
                      onClick={handleNavClick}
                    >
                      <item.icon className="h-4 w-4 transition-transform hover:scale-110" />
                      {open && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {profile?.role === 'chairperson' && (
          <SidebarGroup>
            <SidebarGroupLabel>Settings</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem className="animate-fade-in-up" style={{ animationDelay: '400ms' }}>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to="/dashboard/settings" 
                      className={({ isActive }) =>
                        isActive 
                          ? 'flex items-center gap-2 rounded-md px-3 py-2 bg-sidebar-accent text-sidebar-accent-foreground font-medium' 
                          : 'flex items-center gap-2 rounded-md px-3 py-2 hover:bg-sidebar-accent/50 transition-colors'
                      }
                      onClick={handleNavClick}
                    >
                      <Settings className="h-4 w-4 transition-transform hover:rotate-90 hover:scale-110" />
                      {open && <span>Settings</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}