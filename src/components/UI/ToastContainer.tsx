import React, { useEffect } from 'react';
import { create } from 'zustand';

type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastState {
  toasts: ToastItem[];
  push: (message: string, type?: ToastType) => void;
  remove: (id: string) => void;
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (message: string, type: ToastType = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    set({ toasts: [...get().toasts, { id, message, type }] });
    // Auto-remove after 3s
    setTimeout(() => get().remove(id), 3000);
  },
  remove: (id: string) => set({ toasts: get().toasts.filter(t => t.id !== id) })
}));

const bgByType: Record<ToastType, string> = {
  info: 'bg-gray-800',
  success: 'bg-green-600',
  warning: 'bg-yellow-600',
  error: 'bg-red-600',
};

export const ToastContainer: React.FC = () => {
  const toasts = useToastStore(s => s.toasts);

  // Ensure one root container exists (safe for PWA reloads)
  useEffect(() => {
    // no-op; component handles its own lifecycle
  }, []);

  return (
    <div className="fixed z-[1000] bottom-[calc(var(--safe-bottom)+1rem)] right-[calc(var(--safe-right)+1rem)] flex flex-col gap-2">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`text-white px-4 py-2 rounded shadow ${bgByType[t.type]} max-w-xs`}
          role="status"
          aria-live="polite"
        >
          {t.message}
        </div>
      ))}
    </div>
  );
};
