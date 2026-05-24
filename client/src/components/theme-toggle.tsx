import React, { useEffect, useState } from 'react';

const STORAGE_KEY = 'aiversity-theme';

const ThemeToggle: React.FC = () => {
  const [isLight, setIsLight] = useState<boolean>(false);

  useEffect(() => {
    // initialize from localStorage
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
        document.documentElement.classList.remove('dark');
        setIsLight(true);
      } else {
        document.documentElement.removeAttribute('data-theme');
        document.documentElement.classList.add('dark');
        setIsLight(false);
      }
    } catch (e) {
      // ignore
    }
  }, []);

  const toggle = () => {
    try {
      if (isLight) {
        document.documentElement.removeAttribute('data-theme');
        document.documentElement.classList.add('dark');
        localStorage.removeItem(STORAGE_KEY);
        setIsLight(false);
      } else {
        document.documentElement.setAttribute('data-theme', 'light');
        document.documentElement.classList.remove('dark');
        localStorage.setItem(STORAGE_KEY, 'light');
        setIsLight(true);
      }
    } catch (e) {
      // ignore storage errors
    }
  };

  return (
    <button
      aria-label={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
      onClick={toggle}
      className="p-2 rounded-full hover:bg-[hsl(var(--popover) / 0.06)] transition"
      title={isLight ? 'Dark' : 'Light'}
    >
      <span className="material-icons">{isLight ? 'dark_mode' : 'light_mode'}</span>
    </button>
  );
};

export default ThemeToggle;
