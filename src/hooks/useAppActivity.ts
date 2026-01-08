import { useEffect, useRef, useState } from 'react';

export interface UseAppActivityOptions {
  /**
   * No input for this duration => idle.
   * Defaults to 30s to reduce long-run energy impact.
   */
  idleMs?: number;
}

export interface AppActivityState {
  isVisible: boolean;
  isFocused: boolean;
  isActive: boolean;
  isIdle: boolean;
}

export function useAppActivity(options: UseAppActivityOptions = {}): AppActivityState {
  const idleMs = options.idleMs ?? 30_000;

  const [isVisible, setIsVisible] = useState(() => {
    if (typeof document === 'undefined') return true;
    return document.visibilityState !== 'hidden';
  });

  const [isFocused, setIsFocused] = useState(() => {
    if (typeof document === 'undefined') return true;
    return typeof document.hasFocus === 'function' ? document.hasFocus() : true;
  });

  const [isIdle, setIsIdle] = useState(false);
  const idleTimerRef = useRef<number | null>(null);

  const clearIdleTimer = () => {
    if (idleTimerRef.current !== null) {
      window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  };

  const scheduleIdle = () => {
    clearIdleTimer();
    idleTimerRef.current = window.setTimeout(() => {
      setIsIdle(true);
    }, idleMs);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const markActive = () => {
      setIsIdle(false);

      // Only keep an idle timer running while the app is actually active.
      if (
        document.visibilityState !== 'hidden' &&
        (typeof document.hasFocus !== 'function' || document.hasFocus())
      ) {
        scheduleIdle();
      } else {
        clearIdleTimer();
      }
    };

    const handleVisibility = () => {
      const visible = document.visibilityState !== 'hidden';
      setIsVisible(visible);
      if (!visible) {
        setIsIdle(true);
        clearIdleTimer();
        return;
      }
      markActive();
    };

    const handleFocus = () => {
      setIsFocused(true);
      markActive();
    };

    const handleBlur = () => {
      setIsFocused(false);
      setIsIdle(true);
      clearIdleTimer();
    };

    // Start timer immediately if active.
    markActive();

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    const activityEvents: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
    activityEvents.forEach((evt) => window.addEventListener(evt, markActive, { passive: true } as any));

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      activityEvents.forEach((evt) => window.removeEventListener(evt, markActive as any));
      clearIdleTimer();
    };
  }, [idleMs]);

  const isActive = isVisible && isFocused;
  return { isVisible, isFocused, isActive, isIdle };
}

