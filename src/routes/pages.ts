import { lazy } from 'react';

// Each page is its own chunk so the first load stays small. After sign-in,
// preloadAppPages() fetches the rest in the background, so navigating
// between pages never waits on the network for code.
const loaders = {
  Dashboard: () => import('@/pages/Dashboard'),
  Colleges: () => import('@/pages/Colleges'),
  CollegeAdmins: () => import('@/pages/CollegeAdmins'),
  Batches: () => import('@/pages/Batches'),
  Papers: () => import('@/pages/Papers'),
  Allocations: () => import('@/pages/Allocations'),
  MyPapers: () => import('@/pages/MyPapers'),
  DownloadLogs: () => import('@/pages/DownloadLogs'),
  Settings: () => import('@/pages/Settings'),
  Profile: () => import('@/pages/Profile'),
  About: () => import('@/pages/About'),
  PrivacyPolicy: () => import('@/pages/PrivacyPolicy'),
  Terms: () => import('@/pages/Terms'),
  CookiePolicy: () => import('@/pages/CookiePolicy'),
};

export const Dashboard = lazy(loaders.Dashboard);
export const Colleges = lazy(loaders.Colleges);
export const CollegeAdmins = lazy(loaders.CollegeAdmins);
export const Batches = lazy(loaders.Batches);
export const Papers = lazy(loaders.Papers);
export const Allocations = lazy(loaders.Allocations);
export const MyPapers = lazy(loaders.MyPapers);
export const DownloadLogs = lazy(loaders.DownloadLogs);
export const Settings = lazy(loaders.Settings);
export const Profile = lazy(loaders.Profile);
export const About = lazy(loaders.About);
export const PrivacyPolicy = lazy(loaders.PrivacyPolicy);
export const Terms = lazy(loaders.Terms);
export const CookiePolicy = lazy(loaders.CookiePolicy);

let preloaded = false;

/** Download every page chunk when the browser is idle. Safe to call repeatedly. */
export function preloadAppPages() {
  if (preloaded) return;
  preloaded = true;
  const run = () => Object.values(loaders).forEach((load) => void load().catch(() => undefined));
  const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
  if (idle) idle(run);
  else window.setTimeout(run, 300);
}
