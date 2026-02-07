import React from 'react';
import { isMobile } from '../../utils/deviceDetection';
import { haptics } from '../../utils/haptics';

interface MobileToolbarProps {
  onAddNote: () => void;
  onDeleteSelected: () => void;
  hasSelection: boolean;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

export const MobileToolbar: React.FC<MobileToolbarProps> = ({
  onAddNote,
  onDeleteSelected,
  hasSelection,
  isDarkMode,
  onToggleDarkMode
}) => {
  if (!isMobile()) return null;

  const handleAddNote = () => {
    haptics.light();
    onAddNote();
  };

  const handleDelete = () => {
    haptics.heavy();
    onDeleteSelected();
  };

  const handleToggleDarkMode = () => {
    haptics.light();
    onToggleDarkMode();
  };

  return (
    <div className="fixed bottom-[calc(var(--safe-bottom)+1.5rem)] left-1/2 transform -translate-x-1/2 z-50">
      <div className="flex items-center gap-4 bg-white dark:bg-gray-800 rounded-full px-6 py-3 shadow-lg border border-gray-200 dark:border-gray-700">
        {/* 노트 추가 */}
        <button
          onClick={handleAddNote}
          className="p-3 bg-blue-500 hover:bg-blue-600 text-white rounded-full transition-colors active:scale-95"
          aria-label="새 노트 추가"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>

        {/* 삭제 (선택된 항목이 있을 때만) */}
        {hasSelection && (
          <button
            onClick={handleDelete}
            className="p-3 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors active:scale-95"
            aria-label="선택된 항목 삭제"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}

        {/* 다크모드 토글 */}
        <button
          onClick={handleToggleDarkMode}
          className="p-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-full transition-colors active:scale-95"
          aria-label="다크모드 토글"
        >
          {isDarkMode ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
};
