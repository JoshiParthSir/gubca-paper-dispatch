import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, GraduationCap, ArrowLeft, Mail, Lock, User } from 'lucide-react';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  role: z.enum(['chairperson', 'college_admin']),
});

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
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

  const [signupForm, setSignupForm] = useState({
    email: '',
    password: '',
    fullName: '',
    role: 'college_admin' as 'chairperson' | 'college_admin',
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validatedData = loginSchema.parse(loginForm);
      
      const { error } = await supabase.auth.signInWithPassword({
        email: validatedData.email,
        password: validatedData.password,
      });

      if (error) {
        toast({
          title: 'Login Failed',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Welcome back!',
          description: 'You have been logged in successfully.',
        });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: 'Validation Error',
          description: error.errors[0].message,
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validatedData = signupSchema.parse(signupForm);
      
      const { error } = await supabase.auth.signUp({
        email: validatedData.email,
        password: validatedData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: {
            full_name: validatedData.fullName,
            role: validatedData.role,
          },
        },
      });

      if (error) {
        toast({
          title: 'Signup Failed',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Account Created!',
          description: 'You have been signed up successfully.',
        });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: 'Validation Error',
          description: error.errors[0].message,
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/20 via-background to-secondary/20 p-4 animate-fade-in relative overflow-hidden">
      {/* Animated background effects */}
      <div className="absolute inset-0 bg-grid-white/[0.02] pointer-events-none" />
      <div className="absolute top-20 left-10 w-72 h-72 bg-primary/30 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-secondary/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      
      <Card className="w-full max-w-md relative animate-scale-in shadow-2xl border-primary/20 backdrop-blur-xl bg-card/95 hover-lift">
        {isSignUp && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsSignUp(false)}
            className="absolute top-4 left-4 hover-scale"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        )}

        <CardHeader className="space-y-4 animate-fade-in-down text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center animate-bounce-in shadow-lg shadow-primary/50 hover-scale">
              <GraduationCap className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary via-primary/80 to-secondary bg-clip-text text-transparent">
            {isSignUp ? 'Create Account' : 'Welcome Back'}
          </CardTitle>
          <CardDescription className="animate-fade-in-up">
            {isSignUp ? 'Join our secure exam platform' : 'Sign in to access your papers'}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          {!isSignUp ? (
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2 animate-fade-in" style={{ animationDelay: '300ms' }}>
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" />
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@example.com"
                  value={loginForm.email}
                  onChange={(e) => setLoginForm(prev => ({ ...prev, email: e.target.value }))}
                  className="transition-all hover:border-primary focus:border-primary"
                  required
                />
              </div>
              <div className="space-y-2 animate-fade-in" style={{ animationDelay: '400ms' }}>
                <Label htmlFor="password" className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-primary" />
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                  className="transition-all hover:border-primary focus:border-primary"
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full hover-scale hover-glow animate-fade-in"
                disabled={loading}
                style={{ animationDelay: '500ms' }}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign In
              </Button>
              <div className="text-center animate-fade-in" style={{ animationDelay: '600ms' }}>
                <Button
                  type="button"
                  variant="link"
                  onClick={() => setIsSignUp(true)}
                  className="text-primary hover:text-primary/80"
                >
                  Don't have an account? Sign up
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSignup} className="space-y-5">
              <div className="space-y-2 animate-fade-in" style={{ animationDelay: '300ms' }}>
                <Label htmlFor="fullName" className="flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  Full Name
                </Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="John Doe"
                  value={signupForm.fullName}
                  onChange={(e) => setSignupForm(prev => ({ ...prev, fullName: e.target.value }))}
                  className="transition-all hover:border-primary focus:border-primary"
                  required
                />
              </div>
              <div className="space-y-2 animate-fade-in" style={{ animationDelay: '400ms' }}>
                <Label htmlFor="signup-email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" />
                  Email
                </Label>
                <Input
                  id="signup-email"
                  type="email"
                  placeholder="your.email@example.com"
                  value={signupForm.email}
                  onChange={(e) => setSignupForm(prev => ({ ...prev, email: e.target.value }))}
                  className="transition-all hover:border-primary focus:border-primary"
                  required
                />
              </div>
              <div className="space-y-2 animate-fade-in" style={{ animationDelay: '500ms' }}>
                <Label htmlFor="signup-password" className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-primary" />
                  Password
                </Label>
                <Input
                  id="signup-password"
                  type="password"
                  placeholder="••••••••"
                  value={signupForm.password}
                  onChange={(e) => setSignupForm(prev => ({ ...prev, password: e.target.value }))}
                  className="transition-all hover:border-primary focus:border-primary"
                  required
                  minLength={6}
                />
              </div>
              <div className="space-y-2 animate-fade-in" style={{ animationDelay: '600ms' }}>
                <Label htmlFor="role">Role</Label>
                <Select
                  value={signupForm.role}
                  onValueChange={(value: 'chairperson' | 'college_admin') => 
                    setSignupForm(prev => ({ ...prev, role: value }))
                  }
                >
                  <SelectTrigger className="transition-all">
                    <SelectValue placeholder="Select your role" />
                  </SelectTrigger>
                  <SelectContent className="animate-scale-in bg-popover z-50">
                    <SelectItem value="chairperson" className="cursor-pointer">Chairperson</SelectItem>
                    <SelectItem value="college_admin" className="cursor-pointer">College Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="submit"
                className="w-full hover-scale hover-glow animate-fade-in"
                disabled={loading}
                style={{ animationDelay: '700ms' }}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Account
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}