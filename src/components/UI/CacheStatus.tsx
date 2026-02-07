/**
 * CacheStatus Component
 *
 * IndexedDB 캐시 상태를 표시하는 디버그 컴포넌트
 * 개발 환경에서만 표시하거나, 설정에서 활성화 가능
 */

import React, { useState, useEffect, useCallback } from 'react';
import { indexedDBManager } from '../../lib/indexedDBManager';

interface CacheStatusProps {
  userId?: string;
  showAlways?: boolean;
}

interface StorageEstimate {
  usage: number;
  quota: number;
}

export const CacheStatus: React.FC<CacheStatusProps> = ({ userId, showAlways = false }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [cacheStats, setCacheStats] = useState<{
    notesCount: number;
    imagesCount: number;
    filesCount: number;
    lastSyncTime: number | null;
  } | null>(null);
  const [storageEstimate, setStorageEstimate] = useState<StorageEstimate | null>(null);

  const loadCacheStats = useCallback(async () => {
    if (!userId || !indexedDBManager.isAvailable()) return;

    try {
      const metadata = await indexedDBManager.getMetadata(userId);
      if (metadata) {
        setCacheStats({
          notesCount: metadata.notesCount,
          imagesCount: metadata.imagesCount,
          filesCount: metadata.filesCount,
          lastSyncTime: metadata.lastSyncTime,
        });
      }

      const estimate = await indexedDBManager.estimateStorageUsage();
      setStorageEstimate(estimate);
    } catch (err) {
      console.warn('Failed to load cache stats:', err);
    }
  }, [userId]);

  useEffect(() => {
    loadCacheStats();
    // Refresh every 30 seconds
    const interval = setInterval(loadCacheStats, 30000);
    return () => clearInterval(interval);
  }, [loadCacheStats]);

  const handleCleanup = async () => {
    if (!userId) return;

    try {
      const deleted = await indexedDBManager.cleanupOldImageCache(30 * 24 * 60 * 60 * 1000);
      alert(`${deleted}개의 오래된 이미지 캐시가 삭제되었습니다.`);
      loadCacheStats();
    } catch (err) {
      console.error('Cleanup failed:', err);
    }
  };

  const handleClearAll = async () => {
    if (!userId) return;

    if (!confirm('모든 캐시를 삭제하시겠습니까? 다음 로그인 시 데이터를 다시 다운로드합니다.')) {
      return;
    }

    try {
      await indexedDBManager.clearUserData(userId);
      alert('캐시가 삭제되었습니다.');
      loadCacheStats();
    } catch (err) {
      console.error('Clear cache failed:', err);
    }
  };

  // 개발 환경이 아니고 showAlways가 false면 표시하지 않음
  if (!showAlways && !import.meta.env.DEV) {
    return null;
  }

  // IndexedDB 미지원 시
  if (!indexedDBManager.isAvailable()) {
    return (
      <div className="fixed bottom-[calc(var(--safe-bottom)+1rem)] left-[calc(var(--safe-left)+1rem)] bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-3 py-2 rounded-lg text-xs shadow-lg">
        ⚠️ IndexedDB 미지원
      </div>
    );
  }

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const formatTime = (timestamp: number | null): string => {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="fixed bottom-[calc(var(--safe-bottom)+1rem)] left-[calc(var(--safe-left)+1rem)] z-50">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="bg-gray-800 dark:bg-gray-700 text-white px-3 py-2 rounded-lg text-xs shadow-lg hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
      >
        <span className="text-green-400">●</span>
        IndexedDB {isExpanded ? '▼' : '▲'}
      </button>

      {isExpanded && (
        <div className="mt-2 bg-gray-800 dark:bg-gray-700 text-white p-4 rounded-lg shadow-xl text-xs min-w-[250px]">
          <h3 className="font-bold mb-3 text-sm">📦 캐시 상태</h3>

          {cacheStats ? (
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-400">노트:</span>
                <span>{cacheStats.notesCount}개</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">이미지:</span>
                <span>{cacheStats.imagesCount}개</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">파일:</span>
                <span>{cacheStats.filesCount}개</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">마지막 동기화:</span>
                <span>{formatTime(cacheStats.lastSyncTime)}</span>
              </div>
            </div>
          ) : (
            <p className="text-gray-400">캐시 데이터 없음</p>
          )}

          {storageEstimate && (
            <div className="mt-3 pt-3 border-t border-gray-600">
              <div className="flex justify-between mb-1">
                <span className="text-gray-400">사용량:</span>
                <span>{formatBytes(storageEstimate.usage)}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-400">할당량:</span>
                <span>{formatBytes(storageEstimate.quota)}</span>
              </div>
              <div className="w-full bg-gray-600 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all"
                  style={{
                    width: `${Math.min((storageEstimate.usage / storageEstimate.quota) * 100, 100)}%`,
                  }}
                />
              </div>
              <p className="text-gray-400 text-right mt-1">
                {((storageEstimate.usage / storageEstimate.quota) * 100).toFixed(2)}%
              </p>
            </div>
          )}

          <div className="mt-4 pt-3 border-t border-gray-600 flex gap-2">
            <button
              onClick={handleCleanup}
              className="flex-1 bg-yellow-600 hover:bg-yellow-500 px-2 py-1 rounded text-xs transition-colors"
            >
              오래된 캐시 정리
            </button>
            <button
              onClick={handleClearAll}
              className="flex-1 bg-red-600 hover:bg-red-500 px-2 py-1 rounded text-xs transition-colors"
            >
              전체 삭제
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CacheStatus;
