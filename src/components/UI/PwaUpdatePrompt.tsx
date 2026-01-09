import React, { useCallback } from 'react';
import { usePwaUpdateStore } from '../../store/pwaUpdateStore';

export const PwaUpdatePrompt: React.FC = () => {
  const needRefresh = usePwaUpdateStore((s) => s.needRefresh);
  const updateServiceWorker = usePwaUpdateStore((s) => s.updateServiceWorker);
  const dismissUpdate = usePwaUpdateStore((s) => s.dismissUpdate);

  const handleReload = useCallback(async () => {
    try {
      if (updateServiceWorker) {
        await updateServiceWorker(true);
        return;
      }
    } catch {
      // fallthrough
    }
    window.location.reload();
  }, [updateServiceWorker]);

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-4 left-4 z-[10000]">
      <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md border border-gray-200 dark:border-gray-700 shadow-lg rounded-xl px-4 py-3 max-w-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-gray-900 dark:text-white">업데이트가 있습니다</div>
            <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">
              새로고침하면 최신 버전이 적용됩니다.
            </div>
          </div>

          <button
            onClick={dismissUpdate}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white transition-colors"
            aria-label="업데이트 안내 닫기"
            title="닫기"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mt-3 flex gap-2">
          <button
            onClick={handleReload}
            className="px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition-colors"
          >
            새로고침
          </button>
          <button
            onClick={dismissUpdate}
            className="px-3 py-1.5 rounded-lg bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100 text-sm font-medium transition-colors"
          >
            나중에
          </button>
        </div>
      </div>
    </div>
  );
};

