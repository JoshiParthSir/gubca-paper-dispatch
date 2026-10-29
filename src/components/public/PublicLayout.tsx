import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { BrandMark, Wordmark } from '@/components/layout/Brand';
import { PublicFooter } from './PublicFooter';
import { legalLinks } from './links';

interface PublicLayoutProps {
  children: ReactNode;
}

/** Frame for public information pages (About, legal pages). */
export function PublicLayout({ children }: PublicLayoutProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();

  // Opening a page from a link should start at its top
  useEffect(() => {
    window.scrollTo(0, 0);
    setMenuOpen(false);
  }, [pathname]);

  const links = [{ to: '/', label: 'Home' }, ...legalLinks];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 bg-navy-900/95 pt-[env(safe-area-inset-top)] shadow-lg shadow-navy-950/20 backdrop-blur-md">
        <nav className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-5 sm:px-8 xl:px-10">
          <Link to="/" className="flex items-center gap-2.5">
            <BrandMark size="sm" />
            <Wordmark onDark className="text-lg" />
          </Link>
          <div className="hidden items-center gap-7 lg:flex">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end
                className={({ isActive }) =>
                  `relative py-1 text-sm font-medium transition-colors hover:text-white ${isActive ? 'text-white' : 'text-white/70'}`
                }
              >
                {({ isActive }) => (
                  <>
                    {l.label}
                    <span
                      className={`absolute -bottom-0.5 left-0 h-0.5 w-full origin-left rounded-full bg-gold-500 transition-transform duration-300 ${isActive ? 'scale-x-100' : 'scale-x-0'}`}
                    />
                  </>
                )}
              </NavLink>
            ))}
            <Link to="/auth" className="btn-gold h-10 text-sm">
              Sign in
            </Link>
          </div>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-white hover:bg-white/10 lg:hidden"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </nav>
        <div
          className={`grid overflow-hidden transition-[grid-template-rows] duration-300 lg:hidden ${menuOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
        >
          <div className="min-h-0">
            <div className="space-y-1 border-t border-white/10 px-5 pb-5 pt-3">
              {links.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end
                  className={({ isActive }) =>
                    `block rounded-lg px-3 py-3 font-medium hover:bg-white/10 ${isActive ? 'bg-white/10 text-gold-500' : 'text-white/85'}`
                  }
                >
                  {l.label}
                </NavLink>
              ))}
              <Link to="/auth" className="btn-gold mt-2 h-12 w-full">
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div key={pathname} className="animate-page-in flex flex-1 flex-col">
        {children}
      </div>

      <PublicFooter />
    </div>
  );
}

interface PageHeroProps {
  eyebrow: string;
  title: string;
  subtitle?: ReactNode;
  children?: ReactNode;
}

export function PageHero({ eyebrow, title, subtitle, children }: PageHeroProps) {
  return (
    <section className="surface-navy relative overflow-hidden">
      <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-gold-500/10 blur-3xl" />
      <div className="relative mx-auto max-w-[1440px] px-5 py-14 sm:px-8 sm:py-20 xl:px-10">
        <p className="text-sm font-bold uppercase tracking-[0.14em] text-gold-500">{eyebrow}</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl">{title}</h1>
        {subtitle && <div className="mt-4 max-w-2xl text-base text-white/75 sm:text-lg">{subtitle}</div>}
        {children}
      </div>
    </section>
  );
}
