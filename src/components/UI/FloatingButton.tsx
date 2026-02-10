import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../contexts/StoreProvider';
import { isMobile } from '../../utils/device';
import { computeJoystickVelocity } from '../../utils/joystick';

export const FloatingButton = () => {
  const addNote = useAppStore((state) => state.addNote);
  const viewport = useAppStore((state) => state.viewport);
  const setViewport = useAppStore((state) => state.setViewport);

  const isMobileDevice = useMemo(() => isMobile(), []);
  const viewportRef = useRef(viewport);
  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  const originRef = useRef<{ x: number; y: number } | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const velocityRef = useRef<{ vx: number; vy: number }>({ vx: 0, vy: 0 });

  const [isJoystickActive, setIsJoystickActive] = useState(false);
  const [knobOffset, setKnobOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const RADIUS_PX = 42;
  const DEADZONE_PX = 8;
  const MAX_SPEED_PX_PER_SEC = 850;

  const stopRaf = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    lastTsRef.current = null;
  };

  const startRafIfNeeded = () => {
    if (rafRef.current !== null) return;
    const tick = (ts: number) => {
      rafRef.current = requestAnimationFrame(tick);

      const last = lastTsRef.current ?? ts;
      lastTsRef.current = ts;
      const dtMs = Math.min(50, Math.max(0, ts - last)); // clamp to avoid jumps
      const dtSec = dtMs / 1000;

      const { vx, vy } = velocityRef.current;
      if (vx === 0 && vy === 0) return;

      const current = viewportRef.current;
      setViewport({
        ...current,
        x: current.x + vx * dtSec,
        y: current.y + vy * dtSec,
      });
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const handleAddNote = () => {
    const centerX = (window.innerWidth / 2 - viewport.x) / viewport.scale;
    const centerY = (window.innerHeight / 2 - viewport.y) / viewport.scale;
    addNote(centerX - 130, centerY - 90);
  };

  useEffect(() => {
    return () => {
      stopRaf();
    };
  }, []);

  const resetJoystick = () => {
    isDraggingRef.current = false;
    pointerIdRef.current = null;
    originRef.current = null;
    velocityRef.current = { vx: 0, vy: 0 };
    setKnobOffset({ x: 0, y: 0 });
    setIsJoystickActive(false);
    stopRaf();
  };

  return (
    <button
      type="button"
      className="fixed bottom-[calc(var(--safe-bottom)+1.5rem)] left-1/2 transform -translate-x-1/2 w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 text-white rounded-full shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center group"
      style={{ 
        zIndex: 9999,
        boxShadow: '0 4px 20px rgba(79, 70, 229, 0.4), 0 2px 8px rgba(0, 0, 0, 0.1)',
        touchAction: 'none',
      }}
      aria-label="새 메모 추가"
      onPointerDown={(e) => {
        if (!isMobileDevice) return;
        // Only react to primary touch/pointer.
        if (pointerIdRef.current !== null) return;

        pointerIdRef.current = e.pointerId;
        (e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId);

        const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
        originRef.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        isDraggingRef.current = false;
        velocityRef.current = { vx: 0, vy: 0 };
        setKnobOffset({ x: 0, y: 0 });
        setIsJoystickActive(false);
        stopRaf();
      }}
      onPointerMove={(e) => {
        if (!isMobileDevice) return;
        if (pointerIdRef.current === null || e.pointerId !== pointerIdRef.current) return;
        const origin = originRef.current;
        if (!origin) return;

        const dx = e.clientX - origin.x;
        const dy = e.clientY - origin.y;
        const { vx, vy, clampedDx, clampedDy } = computeJoystickVelocity({
          dx,
          dy,
          radiusPx: RADIUS_PX,
          deadzonePx: DEADZONE_PX,
          maxSpeedPxPerSec: MAX_SPEED_PX_PER_SEC,
        });

        velocityRef.current = { vx, vy };
        setKnobOffset({ x: clampedDx, y: clampedDy });

        const active = vx !== 0 || vy !== 0;
        if (active) {
          if (!isDraggingRef.current) {
            isDraggingRef.current = true;
            setIsJoystickActive(true);
          }
          startRafIfNeeded();
        } else {
          // Inside deadzone -> stop movement but keep capture.
          setIsJoystickActive(false);
          stopRaf();
        }
      }}
      onPointerUp={(e) => {
        if (!isMobileDevice) return;
        if (pointerIdRef.current === null || e.pointerId !== pointerIdRef.current) return;

        const wasDragging = isDraggingRef.current;
        resetJoystick();
        // Tap adds a note; drag does not.
        if (!wasDragging) {
          handleAddNote();
        }
      }}
      onPointerCancel={(e) => {
        if (!isMobileDevice) return;
        if (pointerIdRef.current === null || e.pointerId !== pointerIdRef.current) return;
        resetJoystick();
      }}
    >
      {/* Ripple effect background */}
      <div className="absolute inset-0 rounded-full bg-white opacity-0 group-hover:opacity-10 transition-opacity duration-300" />

      {/* Joystick ring */}
      {isJoystickActive && (
        <div
          className="absolute -inset-2 rounded-full border border-white/40"
          aria-hidden="true"
        />
      )}

      {/* Knob (visual feedback) */}
      <div
        className="absolute w-6 h-6 rounded-full bg-white/25 backdrop-blur-sm"
        style={{
          transform: `translate(${knobOffset.x}px, ${knobOffset.y}px)`,
          transition: isJoystickActive ? 'none' : 'transform 120ms ease-out',
        }}
        aria-hidden="true"
      />
      
      {/* Icon */}
      <svg className="w-7 h-7 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
      </svg>
    </button>
  );
};
