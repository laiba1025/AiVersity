// Lightweight local user store for demo / offline fallback
// Stores users in localStorage under key 'aiversity_local_users_v1'

export interface LocalProfile {
  program?: string;
  major?: string;
  currentSemester?: number;
  completedCourseIds?: number[];
}

export interface LocalUser {
  username: string;
  password: string; // plaintext for demo only
  fullName?: string;
  language?: string;
  profile?: LocalProfile;
}

const LS_KEY = 'aiversity_local_users_v1';

function readAll(): Record<string, LocalUser> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, LocalUser>;
  } catch (e) {
    return {};
  }
}

function writeAll(data: Record<string, LocalUser>) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch (e) {}
}

export const localUserStore = {
  async createUser(opts: { username: string; password: string; fullName?: string; language?: string; program?: string; currentSemester?: number }) {
    const users = readAll();
    if (users[opts.username]) throw new Error('Username already exists (local)');
    const u: LocalUser = {
      username: opts.username,
      password: opts.password,
      fullName: opts.fullName,
      language: opts.language || 'en',
      profile: {
        program: opts.program,
        currentSemester: opts.currentSemester ?? 1,
        completedCourseIds: [],
      }
    };

    // Try to fetch public course list for program to seed completed ids (best-effort)
    try {
      if (u.profile?.program) {
        const q = encodeURIComponent(u.profile.program);
        const res = await fetch(`/api/courses?program=${q}`);
        if (res.ok) {
          const body = await res.json();
          if (Array.isArray(body)) {
            // mark prior semesters' required & compulsoryElective as completed up to currentSemester-1
            const semThreshold = Math.max(0, (u.profile.currentSemester ?? 1) - 1);
            const toMark: number[] = [];
            for (const c of body) {
              const sem = typeof c.semester === 'number' ? c.semester : Number(c.semester || 0);
              const isRequired = !!c.required;
              const isCompulsoryElective = !!c.compulsoryElective;
              if (sem > 0 && sem <= semThreshold && (isRequired || isCompulsoryElective)) toMark.push(c.id);
            }
            u.profile.completedCourseIds = toMark;
          }
        }
      }
    } catch (e) {
      // ignore network errors — local fallback
    }

    users[opts.username] = u;
    writeAll(users);
    return u;
  },

  async authenticate(username: string, password: string) {
    const users = readAll();
    const u = users[username];
    if (!u) return null;
    if (u.password !== password) return null;
    return u;
  },

  async getUser(username: string) {
    const users = readAll();
    return users[username] ?? null;
  },

  async updateProfile(username: string, profile: LocalProfile) {
    const users = readAll();
    const u = users[username];
    if (!u) throw new Error('User not found');
    u.profile = { ...(u.profile || {}), ...profile };
    users[username] = u;
    writeAll(users);
    return u;
  },

  async getAllUsers() {
    const users = readAll();
    return Object.values(users);
  }
};

export default localUserStore;

// Convenience: persist current local credentials when user opts to 'remember me'
export const localCredentialsKey = 'aiversity_local_current_v1';

export function setCurrentLocalCredentials(username: string, password: string) {
  try { localStorage.setItem(localCredentialsKey, JSON.stringify({ username, password })); } catch (e) {}
}

export function getCurrentLocalCredentials(): { username: string; password: string } | null {
  try {
    const raw = localStorage.getItem(localCredentialsKey);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) { return null; }
}

export function clearCurrentLocalCredentials() { try { localStorage.removeItem(localCredentialsKey); } catch (e) {} }

