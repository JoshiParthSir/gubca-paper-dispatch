import {
  LayoutDashboard,
  Building2,
  Layers,
  FileText,
  CalendarClock,
  Download,
  ScrollText,
  Settings,
  UserCog,
  User,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  title: string;
  /** Shorter label for the mobile tab bar */
  short?: string;
  url: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

const dashboard: NavItem = { title: 'Dashboard', short: 'Home', url: '/dashboard', icon: LayoutDashboard };
const colleges: NavItem = { title: 'Colleges', url: '/dashboard/colleges', icon: Building2 };
const admins: NavItem = { title: 'College Admins', short: 'Admins', url: '/dashboard/college-admins', icon: UserCog };
const batches: NavItem = { title: 'Batches', url: '/dashboard/batches', icon: Layers };
const papers: NavItem = { title: 'Papers', url: '/dashboard/papers', icon: FileText };
const allocations: NavItem = { title: 'Allocations', short: 'Exams', url: '/dashboard/allocations', icon: CalendarClock };
const logs: NavItem = { title: 'Download Logs', short: 'Logs', url: '/dashboard/logs', icon: ScrollText };
const settings: NavItem = { title: 'Settings', url: '/dashboard/settings', icon: Settings };
const scheduled: NavItem = { title: 'Scheduled Papers', short: 'Papers', url: '/dashboard/scheduled', icon: CalendarClock };
const downloads: NavItem = { title: 'Downloads', url: '/dashboard/downloads', icon: Download };
const profile: NavItem = { title: 'Profile', url: '/dashboard/profile', icon: User };

export const chairpersonNav: NavGroup[] = [
  { label: 'Overview', items: [dashboard] },
  { label: 'Institution', items: [colleges, admins, batches] },
  { label: 'Examinations', items: [papers, allocations, logs] },
  { label: 'System', items: [settings] },
];

export const collegeAdminNav: NavGroup[] = [
  { label: 'Overview', items: [dashboard] },
  { label: 'Examinations', items: [scheduled, downloads] },
  { label: 'Account', items: [profile] },
];

/** The four most used destinations, shown in the mobile tab bar. */
export const chairpersonTabs: NavItem[] = [dashboard, papers, allocations, colleges];
export const collegeAdminTabs: NavItem[] = [dashboard, scheduled, downloads, profile];

export function navFor(role: string | undefined) {
  return role === 'chairperson'
    ? { groups: chairpersonNav, tabs: chairpersonTabs }
    : { groups: collegeAdminNav, tabs: collegeAdminTabs };
}

export function titleForPath(pathname: string, role: string | undefined): string {
  const { groups } = navFor(role);
  for (const g of groups) {
    for (const item of g.items) if (item.url === pathname) return item.title;
  }
  return 'Dashboard';
}
