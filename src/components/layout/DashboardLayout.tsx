import { Suspense, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { smoothScrollTo } from '@/lib/smooth-scroll';
import { preloadAppPages } from '@/routes/pages';
import { PageSkeleton } from '@/components/PageFallback';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { MobileTabBar } from '@/components/layout/MobileTabBar';
import { Footer } from '@/components/layout/Footer';
import { Loader2 } from 'lucide-react';

// Remember whether the sidebar was collapsed (the sidebar component writes this cookie)
function sidebarWasOpen() {
  const match = document.cookie.match(/(?:^|;\s*)sidebar:state=(true|false)/);
  return match ? match[1] === 'true' : true;
}

export function DashboardLayout() {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  // Once inside the app, fetch the other pages' code in the background
  useEffect(() => {
    if (user) preloadAppPages();
  }, [user]);

  // Each page starts at the top, gliding there rather than jumping
  useEffect(() => {
    if (window.scrollY > 0) smoothScrollTo(0);
  }, [location.pathname]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !profile) {
    return <Navigate to="/auth" replace />;
  }

  // Accounts created or reset by the chairperson must set their own password first
  if (profile.must_change_password) {
    return <Navigate to="/change-password" replace />;
  }

  return (
    <SidebarProvider defaultOpen={sidebarWasOpen()}>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <DashboardHeader />
          <main className="flex-1 px-4 pb-28 pt-5 md:px-8 md:pb-10 md:pt-8 2xl:px-12">
            {/* Keyed by path so each page plays the entrance transition */}
            <div key={location.pathname} className="animate-page-in w-full">
              <Suspense fallback={<PageSkeleton />}>
                <Outlet />
              </Suspense>
            </div>
          </main>
          <div className="hidden md:block">
            <Footer />
          </div>
        </div>
      </div>
      <MobileTabBar />
    </SidebarProvider>
  );
}
