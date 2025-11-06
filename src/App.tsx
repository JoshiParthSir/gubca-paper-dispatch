import * as React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import LoginPage from "./components/auth/LoginPage";
import Dashboard from "./pages/Dashboard";
import Colleges from "./pages/Colleges";
import Batches from "./pages/Batches";
import Papers from "./pages/Papers";
import Allocations from "./pages/Allocations";
import MyPapers from "./pages/MyPapers";
import DownloadLogs from "./pages/DownloadLogs";
import Settings from "./pages/Settings";
import { DashboardLayout } from "./components/layout/DashboardLayout";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<LoginPage />} />
            <Route path="/dashboard" element={
              <DashboardLayout>
                <Dashboard />
              </DashboardLayout>
            } />
            <Route path="/dashboard/colleges" element={
              <DashboardLayout>
                <Colleges />
              </DashboardLayout>
            } />
            <Route path="/dashboard/batches" element={
              <DashboardLayout>
                <Batches />
              </DashboardLayout>
            } />
            <Route path="/dashboard/papers" element={
              <DashboardLayout>
                <Papers />
              </DashboardLayout>
            } />
            <Route path="/dashboard/allocations" element={
              <DashboardLayout>
                <Allocations />
              </DashboardLayout>
            } />
            <Route path="/dashboard/scheduled" element={
              <DashboardLayout>
                <MyPapers />
              </DashboardLayout>
            } />
            <Route path="/dashboard/downloads" element={
              <DashboardLayout>
                <MyPapers />
              </DashboardLayout>
            } />
            <Route path="/dashboard/logs" element={
              <DashboardLayout>
                <DownloadLogs />
              </DashboardLayout>
            } />
            <Route path="/dashboard/settings" element={
              <DashboardLayout>
                <Settings />
              </DashboardLayout>
            } />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
