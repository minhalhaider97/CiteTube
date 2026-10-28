import { useState } from 'react';
import { supabase } from '../../lib/auth';
import vectorIcon from '../../assets/Vector.png';

interface AuthCardProps {
  initialError?: string | null;
}

export default function AuthCard({ initialError }: AuthCardProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError || null);
  const [resendSent, setResendSent] = useState(false);

  const handleResendVerification = async () => {
    if (!email) {
      setError('Please enter your email above to resend the verification link.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setResendSent(true);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert('Check your email for the confirmation link!');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0D0D0E] px-4 font-sans">
      <div className="w-full max-w-md rounded-2xl bg-[#141416] p-8 shadow-2xl border border-[#232326]">
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="rounded-xl bg-[#1C1C1F] p-3 border border-[#2A2A2E] mb-3">
            <img src={vectorIcon} alt="CiteTube Logo" className="h-8 w-8 object-contain" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            {isSignUp ? 'Create your account' : 'Welcome back'}
          </h2>
          <p className="text-xs text-neutral-400 mt-1 font-mono">
            CiteTube • Timestamp Grounded RAG
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-950/40 p-3 border border-red-800/40 text-xs text-red-200">
            <p>{error}</p>
            {error.toLowerCase().includes('expired') || error.toLowerCase().includes('confirmation') ? (
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={loading}
                className="mt-2 text-[11px] text-white underline hover:text-gray-300 disabled:opacity-50"
              >
                {resendSent ? 'Verification link sent!' : 'Resend verification email'}
              </button>
            ) : null}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1.5">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg bg-[#0D0D0E] border border-[#232326] px-3 py-2 text-xs text-white focus:outline-none focus:border-neutral-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1.5">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg bg-[#0D0D0E] border border-[#232326] px-3 py-2 text-xs text-white focus:outline-none focus:border-neutral-500 font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-gradient-to-r from-red-500 to-rose-600 py-2.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50 shadow-lg shadow-red-900/20"
          >
            {loading ? 'Processing...' : isSignUp ? 'Sign Up' : 'Log In'}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-neutral-400">
          {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
            }}
            className="font-semibold text-white hover:underline"
          >
            {isSignUp ? 'Log in' : 'Sign up'}
          </button>
        </div>
      </div>
    </div>
  );
}