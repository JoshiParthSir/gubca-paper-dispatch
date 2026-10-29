import React, { useState, useEffect, createContext, useContext, type ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { clearPageCache } from '@/lib/page-cache';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: any | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    // The profile is loaded once per signed-in user, not on every auth event
    // (initial session, token refresh, etc. would otherwise refetch it).
    let profileUserId: string | null = null;

    const fetchProfile = async (userId: string) => {
      profileUserId = userId;
      try {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', userId)
          .single();

        if (mounted && profileUserId === userId) {
          setProfile(profileData);
          setLoading(false);
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    // Fires INITIAL_SESSION on subscribe, so no separate getSession() call is needed
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);

      const userId = session?.user?.id ?? null;
      if (userId) {
        if (userId !== profileUserId) {
          // A different account: never show the previous account's cached pages
          clearPageCache();
          // Deferred so no Supabase call runs inside the auth callback
          window.setTimeout(() => fetchProfile(userId), 0);
        }
      } else {
        profileUserId = null;
        clearPageCache();
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      // Clear local state first
      clearPageCache();
      setUser(null);
      setSession(null);
      setProfile(null);
      
      // Then sign out from Supabase
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const refreshProfile = async () => {
    if (!user) return;
    
    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      setProfile(profileData);
    } catch (error) {
      console.error('Error refreshing profile:', error);
    }
  };

  const value = {
    user,
    session,
    profile,
    loading,
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};