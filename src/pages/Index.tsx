import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useReveal, useScrolled, useScrollSpy } from '@/hooks/use-reveal';
import { handleAnchorClick, scrollToSection } from '@/lib/smooth-scroll';
import { PublicFooter } from '@/components/public/PublicFooter';
import { BrandMark, Wordmark } from '@/components/layout/Brand';
import {
  ArrowRight,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock,
  FileUp,
  Lock,
  Menu,
  ScrollText,
  ShieldCheck,
  Timer,
  Trash2,
  UploadCloud,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';

type Tone = 'navy' | 'gold' | 'slate';

const features: { title: string; text: string; icon: LucideIcon; tone: Tone }[] = [
  {
    title: 'Time-Locked Access',
    text: 'Each paper opens for a college only during its exam window, enforced on the server, not just in the browser.',
    icon: Timer,
    tone: 'navy',
  },
  {
    title: 'Smart Scheduling',
    text: 'Allocate one paper to many colleges at once, publish when ready, and import a whole timetable from CSV.',
    icon: CalendarClock,
    tone: 'gold',
  },
  {
    title: 'Complete Audit Trail',
    text: 'Every download is logged with the admin, college and time, and can be exported for records.',
    icon: ScrollText,
    tone: 'navy',
  },
  {
    title: 'Secure Temporary Storage',
    text: 'Papers are stored privately and deleted automatically 7 days after the last exam.',
    icon: ShieldCheck,
    tone: 'slate',
  },
  {
    title: 'University-Managed Accounts',
    text: 'No sign-ups or emails. The university creates every login, and admins set their own password on first use.',
    icon: Users,
    tone: 'gold',
  },
  {
    title: 'Bulk Operations',
    text: 'Upload dozens of PDFs in one go and create every college admin from a single spreadsheet.',
    icon: FileUp,
    tone: 'navy',
  },
];

const toneStyles: Record<Tone, { card: string; icon: string; text: string }> = {
  navy: { card: 'bg-gradient-to-br from-navy-800 to-navy-900 text-white', icon: 'gold-tile', text: 'text-white/75' },
  gold: {
    card: 'bg-gradient-to-br from-gold-500 to-gold-600 text-navy-900',
    icon: 'bg-navy-800 text-gold-500',
    text: 'text-navy-900/75',
  },
  slate: { card: 'bg-gradient-to-br from-slate-700 to-slate-900 text-white', icon: 'gold-tile', text: 'text-white/75' },
};

const steps: { title: string; text: string; icon: LucideIcon }[] = [
  { title: 'Upload', text: 'The university uploads question papers as PDFs, one at a time or in bulk.', icon: UploadCloud },
  { title: 'Allocate', text: 'Papers are scheduled to colleges with an exam date and time window.', icon: CalendarClock },
  { title: 'Unlock on time', text: 'Each college can download its paper only while the exam window is open.', icon: Lock },
  { title: 'Auto-delete', text: 'Seven days after the last exam, the file is removed from storage for good.', icon: Trash2 },
];

const stats = [
  { value: '100%', label: 'Downloads logged' },
  { value: '7 days', label: 'Auto-delete after exam' },
  { value: '0', label: 'Papers opened early' },
];

/** Live-looking preview of the college admin schedule, with a ticking countdown. */
function ProductPreview() {
  const [seconds, setSeconds] = useState(14 * 60 + 32);

  useEffect(() => {
    const id = window.setInterval(() => setSeconds((s) => (s <= 1 ? 15 * 60 : s - 1)), 1000);
    return () => window.clearInterval(id);
  }, []);

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');

  const rows = [
    { day: '12', mon: 'Nov', title: 'Programming in C', time: '10:00 – 13:00', status: 'open' as const },
    { day: '12', mon: 'Nov', title: 'Database Management', time: '14:30 – 17:30', status: 'soon' as const },
    { day: '14', mon: 'Nov', title: 'Discrete Mathematics', time: '10:00 – 13:00', status: 'locked' as const },
  ];

  return (
    <div className="relative">
      <div className="pointer-events-none absolute -inset-6 rounded-[2rem] bg-gold-500/10 blur-2xl" />
      <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-white text-left text-foreground shadow-[0_40px_80px_-30px_rgba(0,10,30,0.7)]">
        <div className="flex items-center gap-2 border-b bg-slate-50 px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
          <span className="ml-3 truncate rounded-md bg-white px-3 py-1 text-[11px] text-muted-foreground ring-1 ring-border">
            paperdispatch / scheduled-papers
          </span>
        </div>

        <div className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Your schedule</p>
              <p className="text-lg font-bold text-primary">This week</p>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-navy-800 px-3 py-2 text-white">
              <Clock className="h-4 w-4 text-gold-500" />
              <div className="leading-none">
                <p className="text-[10px] text-white/60">Next unlock</p>
                <p className="mt-0.5 font-mono text-sm font-semibold tabular">00:{mm}:{ss}</p>
              </div>
            </div>
          </div>

          <ul className="mt-4 space-y-2.5">
            {rows.map((r) => (
              <li key={r.title} className="flex items-center gap-3 rounded-xl border p-2.5">
                <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-secondary text-primary">
                  <span className="text-[9px] font-bold uppercase leading-none">{r.mon}</span>
                  <span className="text-base font-extrabold leading-tight">{r.day}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{r.title}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">{r.time}</p>
                </div>
                {r.status === 'open' && (
                  <span className="flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-semibold text-success">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping-slow absolute inline-flex h-full w-full rounded-full bg-success" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
                    </span>
                    Open
                  </span>
                )}
                {r.status === 'soon' && (
                  <span className="rounded-full bg-gold-500/20 px-2.5 py-1 text-[11px] font-semibold text-navy-900">
                    {mm}m
                  </span>
                )}
                {r.status === 'locked' && (
                  <span className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-primary">
                    <Lock className="h-3 w-3" />
                    Locked
                  </span>
                )}
              </li>
            ))}
          </ul>

          <div className="mt-4 flex items-center gap-3 rounded-xl border border-success/20 bg-success/5 px-3 py-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-success/15">
              <CheckCircle2 className="h-4 w-4 text-success" />
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="text-xs font-semibold text-foreground">Download recorded</p>
              <p className="text-[11px] text-muted-foreground">Programming in C · audit log updated</p>
            </div>
            <span className="shrink-0 font-mono text-[11px] text-muted-foreground">10:02</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const scrolled = useScrolled();
  const revealRef = useReveal<HTMLDivElement>();
  const [menuOpen, setMenuOpen] = useState(false);
  const activeSection = useScrollSpy(['features', 'how', 'roles']);
  const { hash } = useLocation();

  // Links like /#features (e.g. from the footer) glide to that section
  useEffect(() => {
    if (!hash) return;
    const id = window.setTimeout(() => scrollToSection(hash.slice(1)), 80);
    return () => window.clearTimeout(id);
  }, [hash]);

  useEffect(() => {
    if (user && !loading) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  const goSignIn = () => navigate('/auth');
  const navLinks = [
    { href: '#features', label: 'Features' },
    { href: '#how', label: 'How it works' },
    { href: '#roles', label: 'Who it’s for' },
  ];

  return (
    <div ref={revealRef} className="flex min-h-screen flex-col bg-background">
      {/* Navbar */}
      <header
        className={`fixed inset-x-0 top-0 z-40 pt-[env(safe-area-inset-top)] transition-all duration-300 ${
          scrolled || menuOpen ? 'bg-navy-900/90 shadow-lg shadow-navy-950/20 backdrop-blur-md' : 'bg-transparent'
        }`}
      >
        <nav className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-5 sm:px-8 xl:px-10">
          <a href="#top" onClick={(e) => handleAnchorClick(e, () => setMenuOpen(false))} className="flex items-center gap-2.5">
            <BrandMark size="sm" />
            <Wordmark onDark className="text-lg" />
          </a>
          <div className="hidden items-center gap-8 md:flex">
            {navLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={(e) => handleAnchorClick(e)}
                className={`relative py-1 text-sm font-medium transition-colors hover:text-white ${
                  activeSection === l.href.slice(1) ? 'text-white' : 'text-white/70'
                }`}
              >
                {l.label}
                <span
                  className={`absolute -bottom-0.5 left-0 h-0.5 w-full origin-left rounded-full bg-gold-500 transition-transform duration-300 ${
                    activeSection === l.href.slice(1) ? 'scale-x-100' : 'scale-x-0'
                  }`}
                />
              </a>
            ))}
            <button onClick={goSignIn} className="btn-gold h-10 text-sm">
              Sign in
            </button>
          </div>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-white hover:bg-white/10 md:hidden"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </nav>
        <div
          className={`grid overflow-hidden transition-[grid-template-rows] duration-300 md:hidden ${menuOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
        >
          <div className="min-h-0">
            <div className="space-y-1 border-t border-white/10 px-5 pb-5 pt-3">
              {navLinks.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={(e) => handleAnchorClick(e, () => setMenuOpen(false))}
                  className="block rounded-lg px-3 py-3 font-medium text-white/85 hover:bg-white/10"
                >
                  {l.label}
                </a>
              ))}
              <button onClick={goSignIn} className="btn-gold mt-2 h-12 w-full">
                Sign in
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section id="top" className="surface-navy relative overflow-hidden">
        <div className="animate-drift pointer-events-none absolute -left-32 top-24 h-80 w-80 rounded-full bg-navy-700/60 blur-3xl" />
        <div
          className="animate-drift pointer-events-none absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-gold-500/10 blur-3xl"
          style={{ animationDelay: '-9s' }}
        />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />

        <div className="relative mx-auto grid max-w-[1440px] items-center gap-12 px-5 pb-16 pt-28 sm:px-8 sm:pb-24 sm:pt-36 lg:grid-cols-[1.1fr_1fr] lg:gap-14">
          <div className="text-center lg:text-left">
            <span className="animate-fade-in inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-semibold text-white/85">
              <span className="h-1.5 w-1.5 rounded-full bg-gold-500" />
              For universities &amp; affiliated colleges
            </span>
            <h1
              className="animate-fade-in-up mt-6 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl 2xl:text-7xl"
              style={{ animationDelay: '80ms' }}
            >
              Exam papers, delivered{' '}
              <span className="relative inline-block text-gold-500">
                right on time.
                <span className="animate-draw absolute -bottom-1 left-0 h-[3px] w-full rounded-full bg-gold-500/60" />
              </span>
            </h1>
            <p
              className="animate-fade-in-up mx-auto mt-6 max-w-xl text-base text-white/75 sm:text-lg lg:mx-0"
              style={{ animationDelay: '160ms' }}
            >
              Upload question papers, schedule exams across every college and track each download. Papers unlock
              only when the exam begins, then disappear a week later.
            </p>
            <div
              className="animate-fade-in-up mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start"
              style={{ animationDelay: '240ms' }}
            >
              <button onClick={goSignIn} className="btn-gold h-12 text-base">
                Sign in to Dashboard
                <ArrowRight className="h-4 w-4" />
              </button>
              <a
                href="#how"
                onClick={(e) => handleAnchorClick(e)}
                className="press inline-flex h-12 items-center justify-center rounded-lg border border-white/25 px-6 font-semibold text-white hover:bg-white/10"
              >
                See how it works
              </a>
            </div>
            <ul
              className="animate-fade-in mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-white/70 lg:justify-start"
              style={{ animationDelay: '320ms' }}
            >
              {['Time-locked downloads', 'Full audit trail', 'No emails needed'].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-gold-500" strokeWidth={3} />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <div className="animate-fade-in-up mx-auto w-full max-w-md lg:max-w-none" style={{ animationDelay: '200ms' }}>
            <div className="animate-float">
              <ProductPreview />
            </div>
          </div>
        </div>

        <div className="relative mx-auto grid max-w-[1440px] gap-4 px-5 pb-16 sm:grid-cols-3 sm:px-8 sm:pb-20">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className="reveal glass rounded-xl px-6 py-5"
              style={{ '--reveal-delay': `${i * 90}ms` } as React.CSSProperties}
            >
              <p className="text-3xl font-extrabold text-gold-500 sm:text-4xl">{s.value}</p>
              <p className="mt-1 text-sm font-medium text-white/85">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto w-full max-w-[1440px] scroll-mt-20 px-5 py-20 sm:px-8 sm:py-28">
        <div className="reveal mx-auto max-w-2xl text-center">
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-gold-600">Features</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-primary sm:text-4xl">
            Everything for the exam cycle
          </h2>
          <p className="mt-3 text-muted-foreground">
            Built for universities that dispatch question papers to many affiliated colleges.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => {
            const t = toneStyles[f.tone];
            return (
              <div
                key={f.title}
                className={`reveal group rounded-2xl p-6 shadow-[0_18px_40px_-20px_hsl(210_100%_13%/0.45)] transition-transform duration-300 hover:-translate-y-1.5 ${t.card}`}
                style={{ '--reveal-delay': `${(i % 3) * 90}ms` } as React.CSSProperties}
              >
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110 ${t.icon}`}
                >
                  <f.icon className="h-5 w-5" strokeWidth={2.25} />
                </div>
                <h3 className="mt-5 text-lg font-bold">{f.title}</h3>
                <p className={`mt-2 text-sm leading-relaxed ${t.text}`}>{f.text}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-20 border-y bg-card">
        <div className="mx-auto max-w-[1440px] px-5 py-20 sm:px-8 sm:py-28">
          <div className="reveal mx-auto max-w-2xl text-center">
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-gold-600">How it works</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-primary sm:text-4xl">
              From upload to auto-delete
            </h2>
            <p className="mt-3 text-muted-foreground">Four steps, with the timing enforced by the system.</p>
          </div>

          <ol className="relative mt-14 grid gap-10 md:grid-cols-4 md:gap-6">
            <span className="absolute left-[27px] top-2 h-[calc(100%-2rem)] w-px bg-gradient-to-b from-gold-500 to-primary/20 md:left-[12%] md:right-[12%] md:top-7 md:h-px md:w-auto md:bg-gradient-to-r" />
            {steps.map((s, i) => (
              <li
                key={s.title}
                className="reveal relative flex gap-5 md:flex-col md:items-center md:text-center"
                style={{ '--reveal-delay': `${i * 120}ms` } as React.CSSProperties}
              >
                <span className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-gold-500 shadow-[0_12px_30px_-12px_hsl(var(--primary))] ring-4 ring-card">
                  <s.icon className="h-6 w-6" />
                  <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-gold-500 text-xs font-extrabold text-navy-900">
                    {i + 1}
                  </span>
                </span>
                <div className="pt-1 md:pt-0">
                  <h3 className="text-lg font-bold text-primary md:mt-5">{s.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Roles */}
      <section id="roles" className="mx-auto w-full max-w-[1440px] scroll-mt-20 px-5 py-20 sm:px-8 sm:py-28">
        <div className="reveal mx-auto max-w-2xl text-center">
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-gold-600">Who it’s for</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-primary sm:text-4xl">
            Two roles, one secure workflow
          </h2>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {[
            {
              title: 'University / Chairperson',
              tag: 'Runs the exam cycle',
              dark: true,
              points: [
                'Add colleges, batches and admin logins',
                'Upload papers individually or in bulk',
                'Schedule exams for many colleges at once',
                'See and export every download',
              ],
            },
            {
              title: 'College Admin',
              tag: 'Receives the papers',
              dark: false,
              points: [
                'Sign in with details from the university',
                'See the exam schedule for your college',
                'Download each paper when its window opens',
                'Works on any phone or computer',
              ],
            },
          ].map((role, i) => (
            <div
              key={role.title}
              className={`reveal rounded-2xl p-7 sm:p-8 ${
                role.dark ? 'surface-navy' : 'card-elevated border-2 border-gold-500/40'
              }`}
              style={{ '--reveal-delay': `${i * 120}ms` } as React.CSSProperties}
            >
              <span
                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                  role.dark ? 'bg-gold-500/15 text-gold-500' : 'bg-gold-500/20 text-navy-900'
                }`}
              >
                {role.tag}
              </span>
              <h3 className={`mt-4 text-2xl font-extrabold ${role.dark ? 'text-white' : 'text-primary'}`}>
                {role.title}
              </h3>
              <ul className="mt-5 space-y-3">
                {role.points.map((p) => (
                  <li key={p} className={`flex items-start gap-3 text-sm ${role.dark ? 'text-white/85' : 'text-foreground'}`}>
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                        role.dark ? 'bg-gold-500 text-navy-900' : 'bg-primary text-gold-500'
                      }`}
                    >
                      <Check className="h-3 w-3" strokeWidth={3.5} />
                    </span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-5 pb-20 sm:px-8 sm:pb-28">
        <div className="reveal surface-navy relative mx-auto max-w-[1440px] overflow-hidden rounded-3xl px-6 py-14 text-center sm:px-12 sm:py-16">
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-gold-500/15 blur-2xl" />
          <h2 className="relative text-3xl font-extrabold tracking-tight sm:text-4xl">
            Ready for the next exam session?
          </h2>
          <p className="relative mx-auto mt-3 max-w-lg text-white/75">
            Sign in with the account details provided by the university.
          </p>
          <button onClick={goSignIn} className="btn-gold relative mt-8 h-12 text-base">
            Sign in now
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
};

export default Index;
