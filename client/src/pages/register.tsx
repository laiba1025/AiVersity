import React, { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useLocation, Link } from 'wouter';

export default function Register() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [major, setMajor] = useState('');
  const [programs, setPrograms] = useState<string[]>([]);
  const [programMaxSem, setProgramMaxSem] = useState<Record<string, number>>({});
  const [useCustomMajor, setUseCustomMajor] = useState(false);
  const [currentSemester, setCurrentSemester] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const semesters = (() => {
    if (useCustomMajor || !major) return [1, 2, 3, 4, 5, 6];
    const max = programMaxSem[major] || 6;
    const arr: number[] = [];
    for (let i = 1; i <= Math.max(1, Math.min(12, max)); i++) arr.push(i);
    return arr;
  })();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await apiRequest('GET', '/api/courses');
        const courses = await res.json();
        if (!mounted) return;
        if (Array.isArray(courses)) {
          const programsSet = new Set<string>();
          const semMap: Record<string, number> = {};
          for (const c of courses) {
            if (c && c.program) {
              const p = String(c.program);
              programsSet.add(p);
              const sem = typeof c.semester === 'number' ? c.semester : (c.semester ? Number(c.semester) : 0);
              if (!semMap[p] || sem > semMap[p]) semMap[p] = sem;
            }
          }
          const arr = Array.from(programsSet).sort((a,b) => a.localeCompare(b));
          setPrograms(arr);
          setProgramMaxSem(semMap);
          if (!major && arr.length) {
            setMajor(arr[0]);
            setUseCustomMajor(false);
            setCurrentSemester(1);
          }
        }
      } catch (err) {
        // silently ignore - leave major as free text
      }
    })();
    return () => { mounted = false; };
  }, []);

  // When major changes (and it's not custom), ensure currentSemester is within the program's range
  useEffect(() => {
    if (useCustomMajor) return;
    const max = programMaxSem[major] || 6;
    if (currentSemester > max) setCurrentSemester(1);
    // if major set and semester is empty, default to 1
    if (!currentSemester) setCurrentSemester(1);
  }, [major, useCustomMajor, programMaxSem]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      // Try server register first (server session will be created)
      await apiRequest('POST', '/api/auth/register', { username: email, password, fullName, language: 'en' });
      try {
        await apiRequest('POST', '/api/student/profile', { program: major, currentSemester });
      } catch (profileErr) {
        // profile creation failed server-side — ignore and continue (profile can be created later)
      }
      // Navigate to home (server session should be active)
      setLocation('/home');
    } catch (err: any) {
      // Server register failed — fall back to local-only user creation
      try {
        const { localUserStore } = await import('@/lib/localUserStore');
        await localUserStore.createUser({ username: email, password, fullName, language: 'en', program: major, currentSemester });
        // use app login which will fallback to local store
        const { useApp } = await import('@/context/app-context');
        // We can't call hook here; instead navigate to login and prefill
        setLocation('/login');
      } catch (luErr: any) {
        setError(luErr?.message || err?.message || String(err));
      }
    } finally {
      setLoading(false);
    }
  };
  const subtleGradient: React.CSSProperties = { background: 'linear-gradient(135deg, rgba(99,102,241,0.06), rgba(16,185,129,0.03))' };

  return (
    <div className="min-h-screen flex items-center justify-center bg-transparent p-4 sm:p-6">
      <div className="w-full max-w-md mx-4 sm:mx-auto bg-white dark:bg-card rounded-lg shadow-lg overflow-hidden">
        <div style={subtleGradient} className="px-6 py-4">
          <h2 className="text-xl font-semibold text-slate-800 dark:text-white">Student Registration</h2>
          <p className="text-sm text-slate-600 dark:text-gray-300">AiVersity</p>
        </div>
        <div className="p-6 bg-white dark:bg-card">
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-200">Name</label>
              <input className="mt-1 block w-full bg-white dark:bg-gray-800 border border-neutral-200 dark:border-gray-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-gray-500 rounded p-2" value={fullName} onChange={e => setFullName(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-200">Email</label>
              <input type="email" className="mt-1 block w-full bg-white dark:bg-gray-800 border border-neutral-200 dark:border-gray-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-gray-500 rounded p-2" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-200">Password</label>
              <input type="password" className="mt-1 block w-full bg-white dark:bg-gray-800 border border-neutral-200 dark:border-gray-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-gray-500 rounded p-2" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-200">Confirm Password</label>
              <input type="password" className="mt-1 block w-full bg-white dark:bg-gray-800 border border-neutral-200 dark:border-gray-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-gray-500 rounded p-2" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-200">Major</label>
              {programs && programs.length > 0 ? (
                <div className="mt-1">
                  <select className="block w-full bg-white dark:bg-gray-800 border border-neutral-200 dark:border-gray-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-gray-500 rounded p-2" value={useCustomMajor ? '__other__' : major} onChange={e => {
                    const v = e.target.value;
                    if (v === '__other__') {
                      setUseCustomMajor(true);
                      setMajor('');
                    } else {
                      setUseCustomMajor(false);
                      setMajor(v);
                    }
                  }} required>
                    {programs.map(p => <option key={p} value={p}>{p}</option>)}
                    <option value="__other__">Other (enter manually)</option>
                  </select>
                  {useCustomMajor && (
                    <input className="mt-2 block w-full bg-white dark:bg-gray-800 border border-neutral-200 dark:border-gray-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-gray-500 rounded p-2" value={major} onChange={e => setMajor(e.target.value)} placeholder="Enter major (e.g. CS BSc)" required />
                  )}
                </div>
              ) : (
                <input className="mt-1 block w-full bg-white dark:bg-gray-800 border border-neutral-200 dark:border-gray-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-gray-500 rounded p-2" value={major} onChange={e => setMajor(e.target.value)} placeholder="e.g. CS BSc" required />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-200">Current semester</label>
              <select value={currentSemester} onChange={e => setCurrentSemester(Number(e.target.value))} className="mt-1 block w-full bg-white dark:bg-gray-800 border border-neutral-200 dark:border-gray-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-gray-500 rounded p-2">
                {semesters.map(s => <option key={s} value={s}>Semester {s}</option>)}
              </select>
            </div>

            {error && <div className="text-sm text-red-600">{error}</div>}
            <div className="flex items-center justify-between">
              <button className="px-4 py-2 bg-primary text-white rounded hover:opacity-95" disabled={loading}>{loading ? 'Registering...' : 'Register'}</button>
              <Link href="/login" className="text-sm text-primary underline">Already have an account?</Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
