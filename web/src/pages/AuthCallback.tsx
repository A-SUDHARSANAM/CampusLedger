import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import { useAuth } from '../hooks/useAuth';
import { ROLE_HOME_ROUTE } from '../routes/routeConfig';

export function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { loginWithToken } = useAuth();
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setError('Google Sign-In is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.');
      return;
    }

    const code = searchParams.get('code');

    if (code) {
      // PKCE flow — exchange code for session
      supabase.auth
        .exchangeCodeForSession(code)
        .then(async ({ data, error: supaErr }) => {
          if (supaErr || !data.session) {
            setError(supaErr?.message ?? 'Could not complete Google Sign-In. Please try again.');
            return;
          }
          try {
            const user = await loginWithToken(
              data.session.access_token,
              data.session.refresh_token ?? ''
            );
            navigate(ROLE_HOME_ROUTE[user.role], { replace: true });
          } catch {
            // Google account not in CampusLedger → redirect to register with prefilled info
            const googleUser = data.session.user;
            const params = new URLSearchParams();
            params.set('google_email', googleUser.email ?? '');
            params.set(
              'google_name',
              (googleUser.user_metadata?.full_name as string) ??
                (googleUser.user_metadata?.name as string) ??
                ''
            );
            navigate(`/login?${params.toString()}&mode=register`, { replace: true });
          }
        })
        .catch((e: Error) => setError(e.message));
    } else {
      // Implicit / hash flow — session already in storage
      supabase.auth.getSession().then(async ({ data }) => {
        if (data.session) {
          try {
            const user = await loginWithToken(
              data.session.access_token,
              data.session.refresh_token ?? ''
            );
            navigate(ROLE_HOME_ROUTE[user.role], { replace: true });
          } catch {
            navigate('/login?error=google_not_registered', { replace: true });
          }
        } else {
          setError('Sign-in session not found. Please try again.');
        }
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          background: '#0f172a',
          color: '#f1f5f9',
          fontFamily: 'Inter, sans-serif',
          padding: 24,
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 40 }}>❌</div>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Sign-in failed</h2>
        <p style={{ color: '#94a3b8', maxWidth: 380, margin: 0 }}>{error}</p>
        <a
          href="/login"
          style={{
            marginTop: 8,
            padding: '10px 24px',
            background: '#4f46e5',
            color: '#fff',
            borderRadius: 10,
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          Return to Login
        </a>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        background: '#0f172a',
        color: '#f1f5f9',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      <motion.div
        style={{
          width: 48,
          height: 48,
          border: '4px solid #4f46e533',
          borderTopColor: '#4f46e5',
          borderRadius: '50%',
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
      />
      <p style={{ color: '#94a3b8', margin: 0 }}>Completing sign-in…</p>
    </div>
  );
}
