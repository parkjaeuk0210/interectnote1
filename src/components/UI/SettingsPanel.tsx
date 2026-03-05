import { useState, useRef, useEffect } from 'react';
import { DarkModeToggle } from './DarkModeToggle';
import { useTranslation } from '../../contexts/I18nContext';
import { DeviceSyncModal } from '../Sync/DeviceSyncModal';

export const SettingsPanel = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [showDeviceSync, setShowDeviceSync] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const { language, changeLanguage } = useTranslation();

  // 패널 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // ESC 키로 닫기
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={panelRef}>
      {/* 설정 버튼 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="glass-button rounded-full p-2 sm:p-3 hover:scale-105 transition-transform text-gray-700 dark:text-gray-200"
        title="설정"
        aria-label="설정"
        aria-expanded={isOpen}
      >
        <svg className="w-4 sm:w-5 h-4 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      </button>

      {/* 설정 패널 */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-56 glass rounded-xl shadow-xl p-4 z-50">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
            설정
          </h3>

          <div className="space-y-4">
            {/* 다크 모드 토글 */}
            <DarkModeToggle />

            {/* 기기 동기화 */}
            <button
              onClick={() => {
                setIsOpen(false);
                setShowDeviceSync(true);
              }}
              className="w-full flex items-center justify-between px-2 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="기기 동기화"
            >
              <span className="text-sm text-gray-700 dark:text-gray-200">기기 동기화</span>
              <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </button>

            {/* 언어 설정 */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700 dark:text-gray-200">언어</span>
              <div className="flex gap-1">
                <button
                  onClick={() => changeLanguage('ko')}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    language === 'ko'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  한국어
                </button>
                <button
                  onClick={() => changeLanguage('en')}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    language === 'en'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  English
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <DeviceSyncModal isOpen={showDeviceSync} onClose={() => setShowDeviceSync(false)} />
    </div>
  );
};
