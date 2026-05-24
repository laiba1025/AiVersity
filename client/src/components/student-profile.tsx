import React, { useEffect, useMemo, useState } from "react";
import { useApp } from '@/context/app-context';
import { localUserStore } from '@/lib/localUserStore';
import ConfirmModal from './confirm-modal';

interface Course {
  id: number;
  code: string;
  title: string;
  program: string;
  credits: number;
  semester: number | null;
  required: boolean;
  elective: boolean;
  completed?: boolean;
}

interface CoursesBySemester {
  [key: string]: Course[];
}

export const StudentProfile: React.FC<{ program?: string }> = ({ program = "AI MSc" }) => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [programTotal, setProgramTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [profile, setProfile] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [editSemester, setEditSemester] = useState<number | null>(null);
  const [editMajor, setEditMajor] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmCallback, setConfirmCallback] = useState<() => void>(() => () => {});

  const app = useApp();

  const fetchCourses = async (prog?: string) => {
    setLoading(true);
    setError(null);
    try {
      const usedProgram = prog ?? program;
      const res = await fetch(`/api/student/courses/by-program?program=${encodeURIComponent(usedProgram)}`, { credentials: 'include' });
      if (res.status === 401) {
        // Try local fallback when server denies access
        const username = app.user?.username;
        if (username) {
          const lu = await localUserStore.getUser(username);
          if (lu && lu.profile && lu.profile.program === usedProgram) {
            // Attempt to get public course list and annotate from local completed ids
            try {
              const publicRes = await fetch(`/api/courses?program=${encodeURIComponent(usedProgram)}`);
              if (publicRes.ok) {
                const list = await publicRes.json();
                const done = new Set<number>(lu.profile.completedCourseIds || []);
                const annotated = (list || []).map((c: any) => ({ ...c, completed: done.has(c.id) }));
                setCourses(annotated);
                setProgramTotal((list || []).reduce((s: number, c: any) => s + (c.credits || 0), 0));
                setError(null);
                return;
              }
            } catch (e) {
              // ignore
            }
          }
        }
        setError('You must sign in to view and mark your courses.');
        setCourses([]);
      } else if (!res.ok) {
        const txt = await res.text();
        setError(`Failed to load courses: ${res.status} ${txt}`);
      } else {
        const body = await res.json();
        setCourses(body.courses || []);
        if (typeof body.programTotalCredits === 'number') setProgramTotal(body.programTotalCredits);
      }
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/student/profile', { credentials: 'include' });
      if (res.ok) {
        const p = await res.json();
        setProfile(p || {});
        if (p && p.program) {
          // refresh courses for this program
          await fetchCourses(p.program);
        } else {
          await fetchCourses();
        }
      }
      else if (res.status === 401) {
        // fallback to local user profile
        const username = app.user?.username;
        if (username) {
          const lu = await localUserStore.getUser(username);
          if (lu) {
            setProfile({ fullName: lu.fullName, program: lu.profile?.program, major: lu.profile?.major, currentSemester: lu.profile?.currentSemester });
            if (lu.profile?.program) await fetchCourses(lu.profile.program);
            return;
          }
        }
        setError('Not authenticated');
      }
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [program]);

  const grouped = useMemo(() => {
    const bySem: CoursesBySemester = {};
    for (const c of courses) {
      const key = c.semester === null || c.semester === undefined ? "Other" : `Semester ${c.semester}`;
      if (!bySem[key]) bySem[key] = [];
      bySem[key].push(c);
    }
    // sort keys by semester number where possible
    const ordered: CoursesBySemester = {};
    const keys = Object.keys(bySem).sort((a, b) => {
      const na = a.startsWith("Semester ") ? parseInt(a.replace("Semester ", ""), 10) : 999;
      const nb = b.startsWith("Semester ") ? parseInt(b.replace("Semester ", ""), 10) : 999;
      return na - nb;
    });
    for (const k of keys) ordered[k] = bySem[k];
    return ordered;
  }, [courses]);

  const totalCreditsFromCourses = useMemo(() => courses.reduce((s, c) => s + (c.credits || 0), 0), [courses]);
  const completedCredits = useMemo(() => courses.filter(c => c.completed).reduce((s, c) => s + (c.credits || 0), 0), [courses]);
  const totalCredits = programTotal ?? totalCreditsFromCourses;
  const progressPercent = totalCredits > 0 ? Math.round((completedCredits / totalCredits) * 100) : 0;

  const toggleCourse = async (course: Course, mark: boolean) => {
    // optimistic update
    setCourses(prev => prev.map(p => p.id === course.id ? { ...p, completed: mark } : p));
    try {
      const url = mark ? '/api/student/courses/mark-completed' : '/api/student/courses/unmark-completed';
      const body = mark ? { courseId: course.id } : { courseId: course.id };
      const res = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.status === 401) {
        setError('Not authenticated - please sign in');
        // revert optimistic
        setCourses(prev => prev.map(p => p.id === course.id ? { ...p, completed: !mark } : p));
      } else if (!res.ok) {
        const txt = await res.text();
        setError(`Failed to ${mark ? 'mark' : 'unmark'} course: ${res.status} ${txt}`);
        setCourses(prev => prev.map(p => p.id === course.id ? { ...p, completed: !mark } : p));
      } else {
        // success - nothing else to do (server state already applied)
      }
    } catch (e: any) {
      setError(String(e));
      setCourses(prev => prev.map(p => p.id === course.id ? { ...p, completed: !mark } : p));
    }
  };

  const startEdit = () => {
    setEditing(true);
    setEditSemester(profile && typeof profile.currentSemester === 'number' ? profile.currentSemester : null);
  };

  const cancelEdit = () => {
    setEditing(false);
    setEditSemester(null);
  };

  const saveEdit = async () => {
    if (!profile) return;
    const newSem = editSemester;
    if (newSem === null || typeof newSem !== 'number') {
      alert('Please provide a valid semester number');
      return;
    }

    // If decreasing semester, ask for confirmation via modal
    const oldSem = typeof profile.currentSemester === 'number' ? profile.currentSemester : null;
    if (oldSem !== null && newSem < oldSem) {
      setConfirmMessage('You are decreasing your current semester. Previously-marked courses will NOT be removed automatically. Do you want to continue?');
      setConfirmCallback(() => async () => {
        setConfirmOpen(false);
        await doSave(newSem);
      });
      setConfirmOpen(true);
      return;
    }

    if (oldSem === null || newSem > (oldSem ?? 0)) {
      setConfirmMessage('Updating semester will automatically mark required courses up to the chosen semester as completed. Continue?');
      setConfirmCallback(() => async () => {
        setConfirmOpen(false);
        await doSave(newSem);
      });
      setConfirmOpen(true);
      return;
    }

    // No confirmation needed
    await doSave(newSem);
  };

  const doSave = async (newSem: number) => {
    try {
      const res = await fetch('/api/student/profile', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ program: profile.program || program, currentSemester: newSem }),
      });
      if (!res.ok) {
        const txt = await res.text();
        setError(`Failed to update profile: ${res.status} ${txt}`);
        return;
      }
      const body = await res.json();
      // body.profile contains the saved profile; refresh
      setProfile(body.profile || body);
      await fetchCourses(body.profile?.program ?? profile.program ?? program);
      setEditing(false);
    } catch (e: any) {
      setError(String(e));
    }
  };

  return (
    <div className="p-4 rounded-lg border bg-card text-card-foreground shadow-sm">
      <ConfirmModal
        open={confirmOpen}
        title="Confirm profile update"
        message={confirmMessage}
        onConfirm={() => confirmCallback()}
        onCancel={() => setConfirmOpen(false)}
      />
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-lg font-semibold">{profile?.program ?? program}</h2>
          <div className="text-sm text-gray-700">{profile?.fullName ? `Student: ${profile.fullName}` : null}</div>
          <div className="text-sm text-gray-900 dark:text-white">Current semester: <strong className="text-gray-900 dark:text-white">{profile?.currentSemester ?? '—'}</strong></div>
        </div>
        <div>
          {!editing ? (
            <button onClick={startEdit} className="px-2 py-0.5 text-sm bg-primary text-white rounded">Edit profile</button>
          ) : (
            <div className="space-x-2">
              <button onClick={saveEdit} className="px-3 py-1 bg-primary text-white rounded">Save</button>
              <button onClick={cancelEdit} className="px-3 py-1 border rounded">Cancel</button>
            </div>
          )}
        </div>
      </div>
      {editing && (
        <div className="mt-3 space-y-2">
          <div>
            <label className="block text-sm text-gray-900 dark:text-gray-200">Current semester</label>
            <input
              type="number"
              min={1}
              className="mt-1 block w-24 border border-neutral-300 dark:border-gray-700 rounded p-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              value={editSemester ?? ''}
              onChange={(e) => setEditSemester(Number(e.target.value))}
            />
          </div>
        </div>
      )}

      {/* Course progress summary removed per user request */}
      {loading && <div className="mt-4 text-sm text-gray-500">Loading courses...</div>}
      {error && <div className="mt-4 text-sm text-red-600">{error}</div>}

      {!loading && !error && Object.keys(grouped).length === 0 && (
        <div className="mt-4 text-sm text-gray-500">No courses found for this program.</div>
      )}

      {!loading && !error && (
        <div className="mt-4 space-y-4">
          {Object.entries(grouped).map(([sem, list]) => (
            <div key={sem} className="border rounded">
              <button
                className="w-full text-left px-3 py-2 bg-transparent flex justify-between items-center"
                onClick={() => setExpanded(e => ({ ...e, [sem]: !e[sem] }))}
              >
                <div className="font-medium">{sem} ({list.reduce((s, c) => s + (c.credits || 0), 0)} credits)</div>
                <div className="text-sm text-gray-500">{expanded[sem] ? '▲' : '▼'}</div>
              </button>
              {expanded[sem] && (
                <div className="p-3 space-y-2">
                  {list.map(c => (
                    <div key={c.id} className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold">{c.code} — {c.title}</div>
                        <div className="text-sm text-gray-500">{c.credits} credits • {c.required ? 'Required' : (c.elective ? 'Elective' : 'Optional')}</div>
                      </div>
                      <div>
                        <label className="inline-flex items-center">
                          <input
                            type="checkbox"
                            checked={!!c.completed}
                            onChange={(e) => toggleCourse(c, e.target.checked)}
                            className="mr-2"
                          />
                          <span className="text-sm">Completed</span>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StudentProfile;
