import * as React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import LoginPage from "./components/auth/LoginPage";
import ChangePassword from "./pages/ChangePassword";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import { AppLoader } from "./components/AppLoader";
import { PageFallback } from "./components/PageFallback";
import {
  About,
  Allocations,
  Batches,
  CollegeAdmins,
  Colleges,
  CookiePolicy,
  Dashboard,
  DownloadLogs,
  MyPapers,
  Papers,
  PrivacyPolicy,
  Profile,
  Settings,
  Terms,
} from "./routes/pages";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <AppLoader />
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <React.Suspense fallback={<PageFallback fullScreen />}>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<LoginPage />} />
          <Route path="/about" element={<About />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/cookies" element={<CookiePolicy />} />
          <Route path="/change-password" element={<ChangePassword />} />
          {/* One persistent layout: the sidebar and header stay mounted while pages change */}
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="colleges" element={<Colleges />} />
            <Route path="college-admins" element={<CollegeAdmins />} />
            <Route path="batches" element={<Batches />} />
            <Route path="papers" element={<Papers />} />
            <Route path="allocations" element={<Allocations />} />
            <Route path="scheduled" element={<MyPapers />} />
            <Route path="downloads" element={<MyPapers />} />
            <Route path="logs" element={<DownloadLogs />} />
            <Route path="settings" element={<Settings />} />
            <Route path="profile" element={<Profile />} />
          </Route>
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        </React.Suspense>
      </BrowserRouter>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
