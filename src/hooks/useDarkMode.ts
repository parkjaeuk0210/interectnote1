import { useEffect } from 'react';
import { useAppStore } from '../contexts/StoreProvider';

/**
 * 다크모드 초기화 및 시스템 설정 감지 훅
 * App.tsx에서 한 번만 호출하여 전역 다크모드 상태를 관리
 */
export const useDarkMode = () => {
  const isDarkMode = useAppStore((state) => state.isDarkMode);
  const setDarkMode = useAppStore((state) => state.setDarkMode);

  // Initialize from saved theme or system preference on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('interectnote-theme');
      if (saved === 'dark' || saved === 'light') {
        setDarkMode(saved === 'dark');
        return;
      }
    } catch {}
    // Fallback to system preference if no explicit choice saved
    try {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      setDarkMode(!!mq.matches);
      const onChange = (e: MediaQueryListEvent) => {
        // Only auto-follow system if user hasn't explicitly chosen a theme yet
        const saved = localStorage.getItem('interectnote-theme');
        if (!saved) setDarkMode(e.matches);
      };
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    } catch {}
  }, [setDarkMode]);

  // Apply dark mode class to body
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    try {
      localStorage.setItem('interectnote-theme', isDarkMode ? 'dark' : 'light');
    } catch {}
  }, [isDarkMode]);

  return isDarkMode;
};
