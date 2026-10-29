import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  Globe,
  Lock,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Timer,
  Trash2,
  UserCog,
} from 'lucide-react';
import { PageHero, PublicLayout } from '@/components/public/PublicLayout';
import { legalLinks } from '@/components/public/links';
import { APP_RELEASE_DATE, APP_VERSION, DEVELOPER, RELEASES } from '@/lib/version';

const facts = [
  { icon: Sparkles, label: 'Version', value: `v${APP_VERSION}` },
  { icon: CalendarDays, label: 'Released', value: APP_RELEASE_DATE },
  { icon: Globe, label: 'Platform', value: 'Web · desktop & mobile' },
];

const security = [
  { icon: Timer, title: 'Time-locked downloads', text: 'Papers can only be downloaded during the exam window, checked by the server.' },
  { icon: Lock, title: 'Private storage', text: 'Files sit in a private bucket and are never publicly linked.' },
  { icon: ScrollText, title: 'Full audit trail', text: 'Every download is recorded with the account, paper and time.' },
  { icon: Trash2, title: 'Automatic deletion', text: 'Paper files are removed 7 days after their last exam.' },
];


export default function About() {
  const [current] = RELEASES;

  return (
    <PublicLayout>
      <PageHero
        eyebrow="About"
        title="About Paper Dispatch"
        subtitle="A secure system for universities to deliver question papers to their affiliated colleges: on time, on record, and gone once the exams are over."
      >
        <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-gold-500 px-4 py-1.5 text-sm font-bold text-navy-900 shadow-[0_8px_20px_-10px_hsl(var(--gold-600))]">
          <Sparkles className="h-4 w-4" />
          Version {APP_VERSION}
        </div>
      </PageHero>

      <div className="mx-auto w-full max-w-[1440px] space-y-16 px-5 py-12 sm:px-8 sm:py-16 xl:px-10">
        {/* Facts */}
        <section className="stagger grid gap-3 sm:grid-cols-3 sm:gap-4">
          {facts.map((f) => (
            <div key={f.label} className="card-elevated p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-gold-500">
                <f.icon className="h-5 w-5" />
              </span>
              <p className="eyebrow mt-4">{f.label}</p>
              <p className="mt-1 text-base font-bold text-primary sm:text-lg">{f.value}</p>
            </div>
          ))}
        </section>

        {/* Overview + what's new */}
        <section className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <div className="legal-prose">
            <h2>What it does</h2>
            <p>
              Paper Dispatch replaces emailing and shared-drive links for question papers. The university uploads
              each paper once, schedules it for one or many colleges, and the system makes it available to each
              college only while that exam is running.
            </p>
            <p>
              Every download is logged for the university, and the file is deleted automatically a week after the
              last exam, so confidential papers don’t linger on shared drives or inboxes.
            </p>
            <h3>Who uses it</h3>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-primary p-4 text-white">
                <Building2 className="h-5 w-5 text-gold-500" />
                <p className="mt-2 font-bold">University / Chairperson</p>
                <p className="mt-1 text-sm text-white/75">Manages colleges, accounts, papers and the exam schedule.</p>
              </div>
              <div className="rounded-xl border-2 border-gold-500/40 bg-card p-4">
                <UserCog className="h-5 w-5 text-gold-600" />
                <p className="mt-2 font-bold text-primary">College Admin</p>
                <p className="mt-1 text-sm text-muted-foreground">Downloads their college’s papers when each exam opens.</p>
              </div>
            </div>
          </div>

          <div className="surface-navy relative overflow-hidden rounded-2xl p-6 sm:p-8">
            <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-gold-500/15 blur-2xl" />
            <div className="relative">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gold-500/15 px-3 py-1 text-xs font-semibold text-gold-500">
                What’s new · v{current.version}
              </span>
              <h2 className="mt-3 text-2xl font-extrabold tracking-tight">{current.title}</h2>
              <ul className="mt-5 space-y-3">
                {current.changes.map((c) => (
                  <li key={c} className="flex items-start gap-3 text-sm text-white/85">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold-500 text-navy-900">
                      <Check className="h-3 w-3" strokeWidth={3.5} />
                    </span>
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Security */}
        <section>
          <div className="mb-6 flex items-center gap-3">
            <ShieldCheck className="h-6 w-6 text-gold-600" />
            <h2 className="text-2xl font-extrabold tracking-tight text-primary">Built for confidentiality</h2>
          </div>
          <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {security.map((s) => (
              <div key={s.title} className="card-elevated p-5">
                <span className="gold-tile flex h-10 w-10 items-center justify-center rounded-xl">
                  <s.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-bold text-primary">{s.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* History + tech */}
        <section className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight text-primary">Version history</h2>
            <ol className="relative mt-6 space-y-6 border-l-2 border-border pl-6">
              {RELEASES.map((r, i) => (
                <li key={r.version} className="relative">
                  <span
                    className={`absolute -left-[33px] top-1 flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-background ${
                      i === 0 ? 'bg-gold-500' : 'bg-primary'
                    }`}
                  />
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="font-mono text-sm font-bold text-primary">v{r.version}</span>
                    <span className="text-xs text-muted-foreground">{r.date}</span>
                    {i === 0 && (
                      <span className="rounded-full bg-gold-500/20 px-2 py-0.5 text-[11px] font-semibold text-navy-900">
                        Current
                      </span>
                    )}
                  </div>
                  <p className="mt-1 font-semibold">{r.title}</p>
                  {i > 0 && (
                    <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                      {r.changes.map((c) => (
                        <li key={c}>· {c}</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ol>
          </div>

          <div className="space-y-6">
            <div className="card-elevated p-6">
              <p className="eyebrow">Credits</p>
              <p className="mt-2 text-sm text-muted-foreground">Concept, design and development</p>
              <p className="text-xl font-extrabold text-primary">{DEVELOPER}</p>
            </div>

            <div className="card-elevated divide-y p-2">
              {legalLinks
                .filter((l) => l.to !== '/about')
                .map((l) => (
                  <Link
                    key={l.to}
                    to={l.to}
                    className="group flex items-center justify-between rounded-lg px-4 py-3 text-sm font-semibold text-primary hover:bg-secondary"
                  >
                    {l.label}
                    <ArrowRight className="h-4 w-4 text-gold-600 transition-transform group-hover:translate-x-1" />
                  </Link>
                ))}
            </div>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}
