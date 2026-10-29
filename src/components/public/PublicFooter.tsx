import { Link } from 'react-router-dom';
import { BrandMark, Wordmark } from '@/components/layout/Brand';
import { APP_VERSION, DEVELOPER } from '@/lib/version';
import { legalLinks } from './links';

export function PublicFooter() {
  return (
    <footer className="mt-auto bg-navy-950 pb-safe text-white">
      <div className="mx-auto max-w-[1440px] px-5 py-12 sm:px-8 xl:px-10">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <Link to="/" className="inline-flex items-center gap-2.5">
              <BrandMark size="sm" />
              <Wordmark onDark className="text-lg" />
            </Link>
            <p className="mt-3 text-sm text-white/60">
              Secure exam paper allocation and dispatch for universities and their affiliated colleges.
            </p>
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-10 gap-y-3 text-sm sm:grid-cols-4 md:gap-x-8">
            {legalLinks.map((l) => (
              <Link key={l.to} to={l.to} className="text-white/70 transition-colors hover:text-gold-500">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="mt-10 flex flex-col gap-2 border-t border-white/10 pt-6 text-xs text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} Paper Dispatch. All rights reserved.
            <span className="ml-2 rounded-full border border-white/15 px-2 py-0.5 font-mono text-[10px] text-white/60">
              v{APP_VERSION}
            </span>
          </p>
          <p>
            Designed and developed by <span className="font-semibold text-gold-500">{DEVELOPER}</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
