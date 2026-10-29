import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { legalLinks } from '@/components/public/links';
import { APP_VERSION, DEVELOPER } from '@/lib/version';

export function Footer() {
  return (
    <footer className="relative border-t bg-card pb-safe">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-500/50 to-transparent" />
      {/* Three zones: left and right share the remaining space equally, so the links sit exactly in the centre */}
      <div className="grid items-center gap-3 px-4 py-4 text-xs text-muted-foreground md:px-8 lg:grid-cols-[1fr_auto_1fr] 2xl:px-12">
        <p className="flex items-center justify-center gap-2 lg:justify-start">
          <span>© {new Date().getFullYear()} Paper Dispatch</span>
          <Link
            to="/about"
            className="rounded-full border border-gold-500/40 bg-gold-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-navy-900 transition-colors hover:bg-gold-500/20"
          >
            v{APP_VERSION}
          </Link>
        </p>

        <nav aria-label="Legal" className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          {legalLinks.map((l, i) => (
            <Fragment key={l.to}>
              {i > 0 && <span className="h-1 w-1 rounded-full bg-gold-500/60" aria-hidden="true" />}
              <Link to={l.to} className="font-medium transition-colors hover:text-primary">
                {l.label}
              </Link>
            </Fragment>
          ))}
        </nav>

        <p className="text-center lg:text-right">
          Designed and developed by <span className="font-semibold text-primary">{DEVELOPER}</span>
        </p>
      </div>
    </footer>
  );
}
