import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ArrowRight } from 'lucide-react';
import { useScrollSpy } from '@/hooks/use-reveal';
import { handleAnchorClick } from '@/lib/smooth-scroll';
import { LEGAL_LAST_UPDATED, APP_VERSION } from '@/lib/version';
import { PageHero, PublicLayout } from './PublicLayout';

export interface LegalSection {
  id: string;
  title: string;
  body: ReactNode;
}

interface LegalDocumentProps {
  eyebrow: string;
  title: string;
  intro: ReactNode;
  sections: LegalSection[];
  related: { to: string; label: string }[];
}

export function LegalDocument({ eyebrow, title, intro, sections, related }: LegalDocumentProps) {
  const active = useScrollSpy(
    sections.map((s) => s.id),
    110,
  );

  return (
    <PublicLayout>
      <PageHero eyebrow={eyebrow} title={title} subtitle={intro}>
        <div className="mt-6 flex flex-wrap gap-3 text-xs">
          <span className="glass inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-white/80">
            <CalendarDays className="h-3.5 w-3.5 text-gold-500" />
            Last updated {LEGAL_LAST_UPDATED}
          </span>
          <span className="glass inline-flex items-center rounded-full px-3 py-1.5 font-mono text-white/80">
            Applies to v{APP_VERSION}
          </span>
        </div>
      </PageHero>

      <div className="mx-auto grid w-full max-w-[1440px] gap-10 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[260px_minmax(0,1fr)] xl:px-10">
        {/* Contents */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <p className="eyebrow mb-3">On this page</p>
          <nav aria-label="Contents" className="card-elevated p-2">
            <ol className="space-y-0.5">
              {sections.map((s, i) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    onClick={(e) => handleAnchorClick(e)}
                    className={`flex gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                      active === s.id
                        ? 'bg-primary font-semibold text-white'
                        : 'text-muted-foreground hover:bg-secondary hover:text-primary'
                    }`}
                  >
                    <span className={`font-mono text-xs ${active === s.id ? 'text-gold-500' : ''}`}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </aside>

        {/* Body */}
        <article className="min-w-0 max-w-3xl">
          {sections.map((s, i) => (
            <section key={s.id} id={s.id} className="legal-prose scroll-mt-24 border-b py-8 first:pt-0 last:border-0">
              <h2>
                <span className="mr-3 font-mono text-base text-gold-600">{String(i + 1).padStart(2, '0')}</span>
                {s.title}
              </h2>
              {s.body}
            </section>
          ))}

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {related.map((r) => (
              <Link
                key={r.to}
                to={r.to}
                className="card-elevated group flex items-center justify-between p-5 transition-all hover:-translate-y-0.5 hover:border-primary/25"
              >
                <span className="font-semibold text-primary">{r.label}</span>
                <ArrowRight className="h-4 w-4 text-gold-600 transition-transform group-hover:translate-x-1" />
              </Link>
            ))}
          </div>
        </article>
      </div>
    </PublicLayout>
  );
}
