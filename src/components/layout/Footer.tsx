import { Link } from 'react-router-dom';
import { legalLinks } from '@/components/public/links';
import { APP_VERSION, DEVELOPER } from '@/lib/version';

export function Footer() {
  return (
    <footer className="border-t bg-card pb-safe">
      <div className="flex flex-col items-center justify-between gap-3 px-4 py-4 text-xs text-muted-foreground md:px-8 lg:flex-row 2xl:px-12">
        <p className="flex items-center gap-2">
          © {new Date().getFullYear()} Paper Dispatch
          <Link
            to="/about"
            className="rounded-full border px-2 py-0.5 font-mono text-[10px] text-primary transition-colors hover:border-primary/40"
          >
            v{APP_VERSION}
          </Link>
        </p>
        <nav aria-label="Legal" className="flex flex-wrap justify-center gap-x-5 gap-y-1">
          {legalLinks.map((l) => (
            <Link key={l.to} to={l.to} className="transition-colors hover:text-primary">
              {l.label}
            </Link>
          ))}
        </nav>
        <p>
          Designed and developed by <span className="font-semibold text-primary">{DEVELOPER}</span>
        </p>
      </div>
    </footer>
  );
}
