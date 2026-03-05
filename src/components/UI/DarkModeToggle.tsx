import { useAppStore } from '../../contexts/StoreProvider';

/**
 * 다크모드 토글 스위치 컴포넌트 (설정 패널 내부용)
 */
export const DarkModeToggle = () => {
  const isDarkMode = useAppStore((state) => state.isDarkMode);
  const toggleDarkMode = useAppStore((state) => state.toggleDarkMode);

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-700 dark:text-gray-200">다크 모드</span>
      <button
        onClick={toggleDarkMode}
        className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
          isDarkMode ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
        }`}
        role="switch"
        aria-checked={isDarkMode}
        aria-label={isDarkMode ? '라이트 모드로 전환' : '다크 모드로 전환'}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 flex items-center justify-center ${
            isDarkMode ? 'translate-x-5' : 'translate-x-0'
          }`}
        >
          {isDarkMode ? (
            <svg className="w-3 h-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          ) : (
            <svg className="w-3 h-3 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          )}
        </span>
      </button>
    </div>
  );
};
