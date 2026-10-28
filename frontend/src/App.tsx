import { useEffect, useState } from 'react';
import { supabase } from './lib/auth';
import AuthCard from './components/auth/AuthCard';
import ChatInterface from './components/chat/ChatInterface';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    // 1. Detect if Supabase redirected back with an error hash (e.g. expired OTP link)
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const errorDescription = hashParams.get('error_description');

    if (errorDescription) {
      setAuthError(decodeURIComponent(errorDescription).replace(/\+/g, ' '));
      // Clean up the hash parameters from browser address bar
      window.history.replaceState(null, '', window.location.pathname);
    }

    // 2. Fetch current session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // 3. Listen for real-time auth changes (sign in, sign out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#171717] text-white">
        Loading...
      </div>
    );
  }

  // Strictly enforce authentication: Render login card if no active session
  if (!user) {
    return <AuthCard initialError={authError} />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#171717]">
      <ChatInterface />
    </div>
  );
}