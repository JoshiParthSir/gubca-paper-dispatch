import { Link } from 'react-router-dom';
import { ArrowUpRight, Lock, ScrollText, Timer } from 'lucide-react';
import { BrandMark, Wordmark } from '@/components/layout/Brand';
import { APP_VERSION, DEVELOPER } from '@/lib/version';
import { ROLE_LABELS } from '@/lib/roles';

const columns: { heading: string; links: { to: string; label: string }[] }[] = [
  {
    heading: 'Product',
    links: [
      { to: '/', label: 'Home' },
      { to: '/#features', label: 'Features' },
      { to: '/#how', label: 'How it works' },
      { to: '/auth', label: 'Sign in' },
    ],
  },
  {
    heading: 'Organisation',
    links: [
      { to: '/about', label: 'About' },
      { to: '/#roles', label: 'Who it’s for' },
      { to: '/about', label: `Version ${APP_VERSION}` },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { to: '/privacy', label: 'Privacy Policy' },
      { to: '/terms', label: 'Terms & Conditions' },
      { to: '/cookies', label: 'Cookie Policy' },
    ],
  },
];

const badges = [
  { icon: Timer, label: 'Time-locked' },
  { icon: ScrollText, label: 'Fully logged' },
  { icon: Lock, label: 'Auto-deleted' },
];

export function PublicFooter() {
  return (
    <footer className="relative mt-auto overflow-hidden bg-navy-950 pb-safe text-white">
      {/* Gold accent line and a soft glow */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-500/70 to-transparent" />
      <div className="pointer-events-none absolute -top-32 left-1/2 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-navy-700/40 blur-3xl" />

      <div className="relative mx-auto max-w-[1440px] px-5 pb-8 pt-14 sm:px-8 xl:px-10">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))] lg:gap-10">
          {/* Brand */}
          <div className="max-w-sm">
            <Link to="/" className="inline-flex items-center gap-2.5">
              <BrandMark size="sm" />
              <Wordmark onDark className="text-xl" />
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-white/60">
              Secure exam paper allocation and dispatch for universities and their affiliated colleges.
            </p>
            <ul className="mt-6 flex flex-wrap gap-2">
              {badges.map((b) => (
                <li
                  key={b.label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/75"
                >
                  <b.icon className="h-3.5 w-3.5 text-gold-500" />
                  {b.label}
                </li>
              ))}
            </ul>
          </div>

          {/* Link columns: equal widths, top-aligned */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:contents">
            {columns.map((col) => (
              <nav key={col.heading} aria-label={col.heading}>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-gold-500">{col.heading}</p>
                <ul className="mt-4 space-y-3">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <Link
                        to={l.to}
                        className="group inline-flex items-center gap-1 text-sm text-white/70 transition-colors hover:text-white"
                      >
                        <span className="transition-transform duration-200 group-hover:translate-x-0.5">{l.label}</span>
                        <ArrowUpRight className="h-3.5 w-3.5 -translate-x-1 text-gold-500 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col items-center gap-3 border-t border-white/10 pt-6 text-center text-xs text-white/50 md:flex-row md:justify-between md:text-left">
          <div className="flex flex-col items-center gap-2 sm:flex-row sm:gap-3">
            <span>© {new Date().getFullYear()} Paper Dispatch. All rights reserved.</span>
            <span className="hidden h-3 w-px bg-white/15 sm:block" />
            <span className="inline-flex items-center gap-2">
              <span className="rounded-full border border-gold-500/30 bg-gold-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-gold-500">
                v{APP_VERSION}
              </span>
              For {ROLE_LABELS.chairperson} &amp; {ROLE_LABELS.college_admin}s
            </span>
          </div>
          <p>
            Designed and developed by <span className="font-semibold text-gold-500">{DEVELOPER}</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
