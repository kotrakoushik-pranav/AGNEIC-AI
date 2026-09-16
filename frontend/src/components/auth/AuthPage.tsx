/**
 * AuthPage — Login + Register screen.
 * Shown when no active Supabase session exists.
 * Uses the white + golden-yellow theme.
 */
import { useState, FormEvent } from 'react';
import { Shield, Eye, EyeOff, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

type Mode = 'login' | 'register';

export function AuthPage() {
  const { signIn, signUp, authError, clearError, supabaseConfigured } = useAuth();

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  function switchMode(m: Mode) {
    setMode(m);
    clearError();
    setSuccessMsg(null);
    setPassword('');
    setConfirmPassword('');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    clearError();
    setSuccessMsg(null);

    if (mode === 'register') {
      if (password !== confirmPassword) {
        return; // handled by native browser validation
      }
      if (displayName.trim().length < 2) return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await signIn(email, password);
        if (error) console.error('[Auth] sign-in error:', error.message);
      } else {
        const { error } = await signUp(email, password, displayName.trim());
        if (!error) {
          setSuccessMsg('Account created! Check your email to confirm your address, then log in.');
          switchMode('login');
        }
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 40%, #FFFFFF 100%)' }}
    >
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{
              background: 'linear-gradient(135deg, #FACC15 0%, #D97706 100%)',
              boxShadow: '0 8px 24px rgba(234,179,8,0.35)',
            }}
          >
            <Shield size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-wide">AEGIS AI</h1>
          <p className="text-sm text-gray-500 mt-1 tracking-widest uppercase">
            Search &amp; Rescue Platform
          </p>
        </div>

        {/* Card */}
        <div
          className="bg-white rounded-2xl p-8"
          style={{
            border: '1.5px solid #EAB308',
            boxShadow: '0 8px 32px rgba(234,179,8,0.15), 0 2px 8px rgba(0,0,0,0.06)',
          }}
        >
          {/* Supabase not configured warning */}
          {!supabaseConfigured && (
            <div
              className="mb-6 p-3 rounded-lg flex items-start gap-2 text-sm"
              style={{ background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.3)', color: '#92400E' }}
            >
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>
                Supabase is not configured yet. Add your credentials to{' '}
                <code className="font-mono text-xs bg-yellow-100 px-1 rounded">frontend/.env</code>{' '}
                to enable authentication.
              </span>
            </div>
          )}

          {/* Tab switcher */}
          <div
            className="flex mb-6 rounded-xl overflow-hidden"
            style={{ border: '1.5px solid #EAB308' }}
          >
            {(['login', 'register'] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className="flex-1 py-2.5 text-sm font-semibold tracking-wider uppercase transition-all duration-150"
                style={
                  mode === m
                    ? {
                        background: 'linear-gradient(135deg, #FACC15 0%, #EAB308 100%)',
                        color: '#1F2937',
                      }
                    : { background: 'transparent', color: '#6B7280' }
                }
              >
                {m === 'login' ? 'Sign In' : 'Register'}
              </button>
            ))}
          </div>

          {/* Error */}
          {authError && (
            <div
              className="mb-4 p-3 rounded-lg flex items-start gap-2 text-sm"
              style={{ background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.3)', color: '#DC2626' }}
            >
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          {/* Success */}
          {successMsg && (
            <div
              className="mb-4 p-3 rounded-lg flex items-start gap-2 text-sm"
              style={{ background: 'rgba(22,163,74,0.07)', border: '1px solid rgba(22,163,74,0.3)', color: '#16A34A' }}
            >
              <CheckCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Display Name (register only) */}
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  minLength={2}
                  placeholder="Your full name"
                  className="w-full px-3 py-2.5 rounded-lg text-sm text-gray-800 placeholder-gray-400 outline-none transition-all duration-150"
                  style={{
                    border: '1.5px solid #E5E7EB',
                    background: '#FAFAFA',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = '#EAB308'; e.target.style.boxShadow = '0 0 0 3px rgba(234,179,8,0.15)'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="operator@aegis.ai"
                autoComplete="email"
                className="w-full px-3 py-2.5 rounded-lg text-sm text-gray-800 placeholder-gray-400 outline-none transition-all duration-150"
                style={{ border: '1.5px solid #E5E7EB', background: '#FAFAFA' }}
                onFocus={(e) => { e.target.style.borderColor = '#EAB308'; e.target.style.boxShadow = '0 0 0 3px rgba(234,179,8,0.15)'; }}
                onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; }}
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="Min. 8 characters"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  className="w-full px-3 py-2.5 pr-10 rounded-lg text-sm text-gray-800 placeholder-gray-400 outline-none transition-all duration-150"
                  style={{ border: '1.5px solid #E5E7EB', background: '#FAFAFA' }}
                  onFocus={(e) => { e.target.style.borderColor = '#EAB308'; e.target.style.boxShadow = '0 0 0 3px rgba(234,179,8,0.15)'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Confirm Password (register only) */}
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                  Confirm Password
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Repeat password"
                  autoComplete="new-password"
                  pattern={password.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}
                  title="Passwords must match"
                  className="w-full px-3 py-2.5 rounded-lg text-sm text-gray-800 placeholder-gray-400 outline-none transition-all duration-150"
                  style={{ border: '1.5px solid #E5E7EB', background: '#FAFAFA' }}
                  onFocus={(e) => { e.target.style.borderColor = '#EAB308'; e.target.style.boxShadow = '0 0 0 3px rgba(234,179,8,0.15)'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !supabaseConfigured}
              className="w-full py-3 rounded-xl text-sm font-bold uppercase tracking-widest transition-all duration-150 flex items-center justify-center gap-2 mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: loading || !supabaseConfigured
                  ? 'rgba(234,179,8,0.4)'
                  : 'linear-gradient(135deg, #FACC15 0%, #D97706 100%)',
                color: '#1F2937',
                boxShadow: loading || !supabaseConfigured ? 'none' : '0 4px 16px rgba(234,179,8,0.35)',
              }}
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {mode === 'login' ? 'Sign In to Dashboard' : 'Create Account'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Aegis AI Search &amp; Rescue Platform — Secure Access Only
        </p>
      </div>
    </div>
  );
}
