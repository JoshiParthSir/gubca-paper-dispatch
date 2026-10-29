import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Check, Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react';
import { BrandMark, Wordmark } from '@/components/layout/Brand';
import { legalLinks } from '@/components/public/links';
import { APP_VERSION } from '@/lib/version';
import { EMAIL_REGEX } from '@/lib/validation';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, profile, loading: authLoading } = useAuth();

  // Redirect to dashboard if user is already authenticated
  useEffect(() => {
    if (!authLoading && user && profile) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, profile, authLoading, navigate]);

  const [loginForm, setLoginForm] = useState({
    email: '',
    password: '',
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const email = loginForm.email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(email) || loginForm.password.length < 6) {
      toast({
        title: 'Check your details',
        description: !EMAIL_REGEX.test(email) ? 'Please enter a valid email address.' : 'Password must be at least 6 characters.',
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: loginForm.password,
      });

      if (error) {
        toast({
          title: 'Login Failed',
          description:
            error.message === 'Invalid login credentials'
              ? 'Incorrect email or password. If you have forgotten it, ask the university to reset it.'
              : error.message === 'Email not confirmed'
                ? 'This account is not active yet. Ask the university to reset your password.'
                : error.message,
          variant: 'destructive',
        });
        return;
      }

      // Without a profile row the dashboard would bounce straight back here,
      // so report it instead of failing silently.
      const { data: profileRow, error: profileError } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('user_id', data.user.id)
        .maybeSingle();

      if (profileError || !profileRow) {
        await supabase.auth.signOut();
        toast({
          title: 'Account not set up',
          description: profileError
            ? `Could not load your profile: ${profileError.message}`
            : 'Your login works, but this account has no profile in the system. Ask the administrator to set it up.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Welcome back!',
          description: 'You have been logged in successfully.',
        });
      }
    } catch (error) {
      toast({
        title: 'Could not sign in',
        description: error instanceof Error ? error.message : 'Please check your connection and try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Show loading spinner while checking auth
  if (authLoading) {
    return (
      <div className="surface-navy min-h-screen flex items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-gold-500" />
      </div>
    );
  }

  // Don't render login form if user is authenticated
  if (user && profile) {
    return null;
  }


  return (
    <div className="surface-navy min-h-screen">
      <div className="mx-auto grid min-h-screen max-w-7xl content-center items-center gap-8 px-5 py-10 sm:px-8 lg:grid-cols-2 lg:gap-16">
        <section className="text-center lg:text-left">
          <button onClick={() => navigate('/')} className="inline-flex items-center gap-2.5">
            <BrandMark size="sm" />
            <Wordmark onDark className="text-xl" />
          </button>

          <h1 className="mt-8 hidden text-4xl font-extrabold leading-tight tracking-tight lg:block xl:text-5xl">
            Exam papers, delivered
            <br />
            <span className="text-gold-500">right on time.</span>
          </h1>
          <p className="mt-4 hidden max-w-md text-white/70 lg:block">
            Sign in to manage colleges, schedule exams and download your allocated question papers.
          </p>

          <ul className="mt-8 hidden space-y-3 lg:block">
            {[
              'Papers unlock only during the exam window',
              'Every download is logged and auditable',
              'Files auto-delete 7 days after the exam',
            ].map((point) => (
              <li key={point} className="flex items-center gap-3 text-sm text-white/85">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gold-500/15 text-gold-500">
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
                {point}
              </li>
            ))}
          </ul>
        </section>

        <section className="w-full">
          <div className="mx-auto w-full max-w-md rounded-2xl bg-card p-6 text-card-foreground shadow-[0_30px_80px_-30px_hsl(210_100%_5%/0.7)] sm:p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold tracking-tight text-primary">Welcome back</h2>
              <p className="mt-1 text-sm text-muted-foreground">Sign in to your account to continue</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email address</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    placeholder="name@college.edu"
                    value={loginForm.email}
                    onChange={(e) => setLoginForm(prev => ({ ...prev, email: e.target.value }))}
                    className="h-11 pl-10"
                    required
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                    className="h-11 pl-10 pr-11"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="h-11 w-full text-base font-semibold" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign in
              </Button>
            </form>

            <p className="mt-6 rounded-lg bg-muted px-4 py-3 text-xs text-muted-foreground">
              Forgot your password? Contact the university to have it reset.
            </p>
          </div>
          <nav aria-label="Legal" className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-white/60">
            {legalLinks.map((l) => (
              <Link key={l.to} to={l.to} className="transition-colors hover:text-gold-500">
                {l.label}
              </Link>
            ))}
          </nav>
          <p className="mt-3 text-center text-xs text-white/40">
            v{APP_VERSION} · Designed and developed by Parth D. Joshi
          </p>
        </section>
      </div>
    </div>
  );
}
