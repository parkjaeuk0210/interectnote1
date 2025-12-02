/**
 * useCachedImage Hook
 *
 * Firebase Storage URL을 IndexedDB에 캐싱하여:
 * - 오프라인 시에도 이미지 표시
 * - Firebase Storage 대역폭 절감 (월 10GB 무료 제한)
 * - 이미지 로딩 속도 향상
 */

import { useState, useEffect, useCallback } from 'react';
import { indexedDBManager } from '../lib/indexedDBManager';

interface UseCachedImageOptions {
  userId?: string;
  imageId: string;
  originalUrl: string;
  enabled?: boolean;
}

interface UseCachedImageResult {
  url: string;
  isLoading: boolean;
  isCached: boolean;
  error: Error | null;
  retry: () => void;
}

/**
 * 이미지 URL을 IndexedDB에 캐싱하고 캐시된 URL 반환
 */
export function useCachedImage({
  userId,
  imageId,
  originalUrl,
  enabled = true,
}: UseCachedImageOptions): UseCachedImageResult {
  const [url, setUrl] = useState<string>(originalUrl);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isCached, setIsCached] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const loadCachedImage = useCallback(async () => {
    if (!enabled || !userId || !imageId || !originalUrl) {
      setUrl(originalUrl);
      return;
    }

    // Skip data URLs (already embedded)
    if (originalUrl.startsWith('data:')) {
      setUrl(originalUrl);
      setIsCached(true);
      return;
    }

    // Check if IndexedDB is available
    if (!indexedDBManager.isAvailable()) {
      setUrl(originalUrl);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 1. 먼저 캐시 확인
      const cached = await indexedDBManager.getImageBlob(imageId);
      if (cached && cached.url === originalUrl) {
        // 캐시된 blob이 있고 URL이 일치하면 사용
        const blobUrl = URL.createObjectURL(cached.blob);
        setUrl(blobUrl);
        setIsCached(true);
        setIsLoading(false);
        return;
      }

      // 2. 캐시 미스 - 백그라운드에서 캐싱 시작
      // 일단 원본 URL 사용 (즉시 표시)
      setUrl(originalUrl);

      // 백그라운드에서 blob 캐싱 (네트워크 요청)
      const cachedUrl = await indexedDBManager.cacheImageBlob(userId, imageId, originalUrl);
      if (cachedUrl) {
        setUrl(cachedUrl);
        setIsCached(true);
      }
    } catch (err) {
      console.warn('Image caching failed, using original URL:', err);
      setError(err as Error);
      setUrl(originalUrl);
    } finally {
      setIsLoading(false);
    }
  }, [userId, imageId, originalUrl, enabled]);

  // 초기 로드
  useEffect(() => {
    loadCachedImage();
  }, [loadCachedImage]);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      if (url && url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    };
  }, [url]);

  const retry = useCallback(() => {
    loadCachedImage();
  }, [loadCachedImage]);

  return {
    url,
    isLoading,
    isCached,
    error,
    retry,
  };
}

/**
 * 여러 이미지를 한 번에 캐싱하는 유틸리티
 */
export async function cacheMultipleImages(
  userId: string,
  images: Array<{ id: string; url: string }>
): Promise<void> {
  if (!indexedDBManager.isAvailable()) return;

  const promises = images
    .filter(img => !img.url.startsWith('data:')) // Skip data URLs
    .map(img => indexedDBManager.cacheImageBlob(userId, img.id, img.url));

  await Promise.allSettled(promises);
  console.log(`📦 Cached ${images.length} images to IndexedDB`);
}

/**
 * 오래된 이미지 캐시 정리
 */
export async function cleanupOldImageCache(maxAgeDays: number = 30): Promise<number> {
  if (!indexedDBManager.isAvailable()) return 0;

  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  return indexedDBManager.cleanupOldImageCache(maxAgeMs);
}
