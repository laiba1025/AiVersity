import React from 'react';
// Removed language toggle; translation not needed here now
import { Button } from '@/components/ui/button';
import { useApp } from '@/context/app-context';
import { useLocation } from 'wouter';

const AppBar: React.FC = () => {
  const { user, logout } = useApp();
  const [_, setLocation] = useLocation();

  return (
    <header className="flex items-center justify-between px-6 py-3" style={{background: 'transparent', backdropFilter: 'blur(6px)'}}>
      <div className="w-12" />
      <div />
      <div className="flex items-center space-x-3">
        {user ? <UserMenu user={user} onLogout={async ()=>{ await logout(); setLocation('/login'); }} /> : null}
      </div>
    </header>
  );
};

interface UserMenuProps {
  user: { fullName?: string } & any;
  onLogout: () => Promise<void> | void;
}

const UserMenu: React.FC<UserMenuProps> = ({ user, onLogout }) => {
  const [open, setOpen] = React.useState(false);
  const [showPwd, setShowPwd] = React.useState(false);
  const initials = (user.fullName || 'U').split(' ').map((s: string)=>s[0]).slice(0,2).join('');
  return (
    <div className="relative">
      <button
        className="h-10 w-10 rounded-full flex items-center justify-center font-semibold bg-[hsl(var(--primary))] text-white shadow-sm hover:opacity-90 transition"
        onClick={()=>setOpen(o=>!o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={user.fullName || 'User'}
      >
        {initials}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--popover))] shadow-lg p-2 flex flex-col space-y-1 z-50">
          <div className="px-2 py-1 text-sm font-medium" style={{color:'hsl(var(--foreground))'}}>{user.fullName}</div>
          <button onClick={()=>{ setShowPwd(true); setOpen(false); }} className="flex items-center gap-2 px-2 py-2 rounded hover:bg-[hsl(var(--accent))] text-sm" style={{color:'hsl(var(--foreground))'}}>
            <span className="material-icons text-base">lock_reset</span> Change Password
          </button>
          <button onClick={()=>{ ThemeToggleInline(); }} className="flex items-center gap-2 px-2 py-2 rounded hover:bg-[hsl(var(--accent))] text-sm" style={{color:'hsl(var(--foreground))'}}>
            <span className="material-icons text-base">brightness_6</span> Toggle Theme
          </button>
          <button onClick={onLogout} className="flex items-center gap-2 px-2 py-2 rounded hover:bg-[hsl(var(--accent))] text-sm" style={{color:'hsl(var(--foreground))'}}>
            <span className="material-icons text-base">logout</span> Logout
          </button>
        </div>
      )}
      {showPwd && <PasswordChangeModal onClose={()=>setShowPwd(false)} />}
    </div>
  );
};

// Inline theme toggle logic reused (avoid keeping old button)
function ThemeToggleInline() {
  const el = document.documentElement;
  const isLight = el.getAttribute('data-theme') === 'light';
  if (isLight) {
    el.removeAttribute('data-theme');
    el.classList.add('dark');
    localStorage.removeItem('aiversity-theme');
  } else {
    el.setAttribute('data-theme','light');
    el.classList.remove('dark');
    localStorage.setItem('aiversity-theme','light');
  }
}

interface PasswordChangeModalProps { onClose: () => void; }
const PasswordChangeModal: React.FC<PasswordChangeModalProps> = ({ onClose }) => {
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const strong = newPassword.length >= 8 && /[A-Za-z]/.test(newPassword) && /[0-9]/.test(newPassword);
  const match = newPassword === confirmPassword;
  const canSubmit = strong && match && currentPassword.length > 0 && !loading;

  const submit = async () => {
    if (!canSubmit) return;
    setLoading(true); setMessage(null);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.message || 'Failed');
      } else {
        setMessage('Password updated');
        setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
        setTimeout(()=>{ onClose(); }, 800);
      }
    } catch (e:any) {
      setMessage('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--popover))] p-5 shadow-xl">
        <h2 className="text-lg font-semibold mb-3" style={{color:'hsl(var(--foreground))'}}>Change Password</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs block mb-1" style={{color:'hsl(var(--muted-foreground))'}}>Current Password</label>
            <input type="password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} className="w-full rounded border px-2 py-1 bg-[hsl(var(--background))]" />
          </div>
          <div>
            <label className="text-xs block mb-1" style={{color:'hsl(var(--muted-foreground))'}}>New Password</label>
            <input type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} className="w-full rounded border px-2 py-1 bg-[hsl(var(--background))]" />
            <div className="mt-1 text-xs" style={{color: strong ? 'hsl(var(--success, 140 70% 35%))' : 'hsl(var(--destructive, 0 70% 45%))'}}>
              {strong ? 'Strength OK' : 'Min 8 chars, letter & number'}
            </div>
          </div>
          <div>
            <label className="text-xs block mb-1" style={{color:'hsl(var(--muted-foreground))'}}>Confirm Password</label>
            <input type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} className="w-full rounded border px-2 py-1 bg-[hsl(var(--background))]" />
            <div className="mt-1 text-xs" style={{color: match ? 'hsl(var(--success, 140 70% 35%))' : 'hsl(var(--destructive, 0 70% 45%))'}}>
              {match ? 'Match' : 'Does not match'}
            </div>
          </div>
          {message && <div className="text-xs" style={{color:'hsl(var(--foreground))'}}>{message}</div>}
          <div className="flex justify-end space-x-2 pt-1">
            <button onClick={onClose} className="px-3 py-1 rounded text-sm bg-[hsl(var(--secondary))] hover:opacity-90" style={{color:'hsl(var(--secondary-foreground))'}} disabled={loading}>Cancel</button>
            <button onClick={submit} disabled={!canSubmit} className="px-3 py-1 rounded text-sm bg-[hsl(var(--primary))] text-white disabled:opacity-40">
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppBar;
