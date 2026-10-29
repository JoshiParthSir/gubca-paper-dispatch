import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { BrandMark, Wordmark } from '@/components/layout/Brand';
import { Check, Eye, EyeOff, KeyRound, Loader2, LogOut } from 'lucide-react';
import { MIN_PASSWORD_LENGTH } from '@/lib/password';

// Shown after the first login with a temporary password (and after a reset
// by the university). The rest of the app is blocked until it is done.
export default function ChangePassword() {
  const { user, profile, loading, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && profile && !profile.must_change_password) {
      navigate('/dashboard', { replace: true });
    }
  }, [loading, profile, navigate]);

  if (loading) {
    return (
      <div className="surface-navy flex min-h-screen items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-gold-500" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  const rules = [
    { ok: password.length >= MIN_PASSWORD_LENGTH, text: `At least ${MIN_PASSWORD_LENGTH} characters` },
    { ok: /[A-Za-z]/.test(password) && /\d/.test(password), text: 'Contains letters and numbers' },
    { ok: password.length > 0 && password === confirm, text: 'Both passwords match' },
  ];
  const valid = rules.every((r) => r.ok);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        const message = /different from the old/i.test(error.message)
          ? 'Your new password must be different from the temporary one.'
          : error.message;
        throw new Error(message);
      }
      await refreshProfile();
      toast({ title: 'Password updated', description: 'Your new password is set. Welcome!' });
      navigate('/dashboard', { replace: true });
    } catch (error) {
      toast({
        title: 'Could not change password',
        description: error instanceof Error ? error.message : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth', { replace: true });
  };

  return (
    <div className="surface-navy min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-8 px-5 py-10">
        <div className="flex items-center justify-center gap-2.5">
          <BrandMark size="sm" />
          <Wordmark onDark className="text-xl" />
        </div>

        <div className="rounded-2xl bg-card p-6 text-card-foreground shadow-[0_30px_80px_-30px_hsl(210_100%_5%/0.7)] sm:p-8">
          <span className="gold-tile flex h-12 w-12 items-center justify-center rounded-xl">
            <KeyRound className="h-6 w-6" />
          </span>
          <h1 className="mt-5 text-2xl font-bold tracking-tight text-primary">Set your own password</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {profile?.full_name ? `Hi ${profile.full_name.split(' ')[0]}, you` : 'You'} signed in with a temporary
            password. Choose a new one to continue.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new_password">New password</Label>
              <div className="relative">
                <Input
                  id="new_password"
                  type={show ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 pr-11"
                  autoFocus
                  required
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
                  aria-label={show ? 'Hide password' : 'Show password'}
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm_password">Confirm new password</Label>
              <Input
                id="confirm_password"
                type={show ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="h-11"
                required
              />
            </div>

            <ul className="space-y-1.5 rounded-lg bg-muted p-3">
              {rules.map((r) => (
                <li
                  key={r.text}
                  className={`flex items-center gap-2 text-xs ${r.ok ? 'font-medium text-success' : 'text-muted-foreground'}`}
                >
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded-full ${r.ok ? 'bg-success text-white' : 'border border-muted-foreground/40'}`}
                  >
                    {r.ok && <Check className="h-3 w-3" strokeWidth={3} />}
                  </span>
                  {r.text}
                </li>
              ))}
            </ul>

            <Button type="submit" className="h-11 w-full text-base" disabled={!valid || submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save and continue
            </Button>
          </form>
        </div>

        <button
          onClick={handleSignOut}
          className="mx-auto inline-flex items-center gap-2 text-sm text-white/60 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </div>
  );
}
