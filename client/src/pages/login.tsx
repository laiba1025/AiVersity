import React, { useState } from 'react';
import { useLocation, Link } from 'wouter';
import { useApp } from '@/context/app-context';

export default function Login() {
  const [, setLocation] = useLocation();
  const { login } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      // After login, if we're a local-only session and the user opted to remember, persist credentials
      try {
        const { localUserStore, setCurrentLocalCredentials, clearCurrentLocalCredentials } = await import('@/lib/localUserStore');
        // determine if active user is local-only
        const { useApp } = await import('@/context/app-context');
        // We can't call hook here; instead check persisted store: if user exists locally and remember checked, save creds
        const lu = await localUserStore.getUser(email);
        if (lu && remember) {
          setCurrentLocalCredentials(email, password);
        } else {
          clearCurrentLocalCredentials();
        }
      } catch (e) {
        // ignore
      }
      setLocation('/home');
    } catch (err: any) {
      setError(err?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };
  const subtleGradient: React.CSSProperties = { background: 'linear-gradient(135deg, rgba(99,102,241,0.06), rgba(56,189,248,0.04))' };

  return (
    <div className="min-h-screen flex items-center justify-center bg-transparent p-4 sm:p-6">
      <div className="w-full max-w-md mx-4 sm:mx-auto bg-white dark:bg-card rounded-lg shadow-lg overflow-hidden">
        <div style={subtleGradient} className="px-6 py-4">
          <h2 className="text-xl font-semibold text-slate-800 dark:text-white">Sign in</h2>
          <p className="text-sm text-slate-600 dark:text-gray-300">AiVersity</p>
        </div>
        <div className="p-6 bg-white dark:bg-card">
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-200">Email</label>
              <input type="email" className="mt-1 block w-full bg-white dark:bg-gray-800 border border-neutral-200 dark:border-gray-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-gray-500 rounded p-2" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-200">Password</label>
              <input type="password" className="mt-1 block w-full bg-white dark:bg-gray-800 border border-neutral-200 dark:border-gray-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-gray-500 rounded p-2" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <div className="flex items-center mt-2">
              <input id="remember" type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} className="mr-2" />
              <label htmlFor="remember" className="text-sm text-slate-700 dark:text-gray-300">Remember me (local)</label>
            </div>
            {error && <div className="text-sm text-red-600">{error}</div>}
            <div className="flex items-center justify-between">
              <button className="px-4 py-2 bg-primary text-white rounded hover:opacity-95" disabled={loading}>{loading ? 'Signing in...' : 'Sign in'}</button>
              <Link href="/register" className="text-sm text-primary underline">Create account</Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
