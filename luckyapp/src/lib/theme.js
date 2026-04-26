'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';

const STORAGE_KEY = 'lucky-theme';
const DEFAULT_THEME = 'dark';

const ThemeContext = createContext({
  theme: DEFAULT_THEME,
  setTheme: () => {},
  toggleTheme: () => {},
});

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    if (typeof document === 'undefined') return DEFAULT_THEME;
    return document.documentElement.getAttribute('data-theme') || DEFAULT_THEME;
  });

  const applyTheme = useCallback((next) => {
    setThemeState(next);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', next);
    }
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {}
    }
    if (typeof document !== 'undefined') {
      const meta = document.querySelector('meta[name="theme-color"]');
      const color = next === 'light' ? '#F7F5F0' : '#0E140F';
      if (meta) meta.setAttribute('content', color);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    applyTheme(theme === 'light' ? 'dark' : 'light');
  }, [theme, applyTheme]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let stored = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch {}
    if (stored && stored !== theme) {
      applyTheme(stored);
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme: applyTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
