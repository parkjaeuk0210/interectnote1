/**
 * Firebase Storage 404 에러 핸들러
 * 삭제된 이미지/파일을 감지하고 DB에서 제거
 */

export const handleImageLoadError = (imageId: string, url: string) => {
  console.warn(`⚠️ Image load failed: ${imageId}`, url);

  // Firebase Storage 404 에러인 경우
  if (url.includes('firebasestorage.googleapis.com')) {
    console.log(`🗑️ Removing broken image from store: ${imageId}`);

    // 스토어에서 제거 (선택적)
    // useAppStore.getState().deleteImage(imageId);
  }
};

export const handleFileLoadError = (fileId: string, url: string) => {
  console.warn(`⚠️ File load failed: ${fileId}`, url);

  if (url.includes('firebasestorage.googleapis.com')) {
    console.log(`🗑️ Removing broken file from store: ${fileId}`);

    // 스토어에서 제거 (선택적)
    // useAppStore.getState().deleteFile(fileId);
  }
};

/**
 * Firebase Storage URL 유효성 검사
 */
export const isFirebaseStorageUrl = (url: string): boolean => {
  return url.includes('firebasestorage.googleapis.com');
};

/**
 * 끊어진 리소스 정리 유틸리티
 * Note: 사용 시 스토어를 직접 import하여 사용
 */
export const cleanupBrokenResources = async (
  images: Array<{ id: string; url: string }>,
  files: Array<{ id: string; url: string }>,
  deleteImage: (id: string) => void,
  deleteFile: (id: string) => void
) => {
  const brokenImages: string[] = [];
  const brokenFiles: string[] = [];

  // 이미지 체크
  for (const image of images) {
    if (isFirebaseStorageUrl(image.url)) {
      try {
        const response = await fetch(image.url, { method: 'HEAD' });
        if (!response.ok) {
          brokenImages.push(image.id);
        }
      } catch (error) {
        brokenImages.push(image.id);
      }
    }
  }

  // 파일 체크
  for (const file of files) {
    if (isFirebaseStorageUrl(file.url)) {
      try {
        const response = await fetch(file.url, { method: 'HEAD' });
        if (!response.ok) {
          brokenFiles.push(file.id);
        }
      } catch (error) {
        brokenFiles.push(file.id);
      }
    }
  }

  // 삭제
  console.log(`🗑️ Cleaning up ${brokenImages.length} broken images and ${brokenFiles.length} broken files`);

  brokenImages.forEach(id => deleteImage(id));
  brokenFiles.forEach(id => deleteFile(id));

  return {
    removedImages: brokenImages.length,
    removedFiles: brokenFiles.length,
  };
};
