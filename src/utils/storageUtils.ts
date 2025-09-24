export const getLocalStorageSize = (): number => {
  let totalSize = 0;
  
  for (const key in localStorage) {
    if (localStorage.hasOwnProperty(key)) {
      const value = localStorage.getItem(key);
      if (value) {
        // Each character in JavaScript is 2 bytes (UTF-16)
        totalSize += key.length * 2 + value.length * 2;
      }
    }
  }
  
  return totalSize;
};

export const getLocalStorageSizeForKey = (key: string): number => {
  const value = localStorage.getItem(key);
  if (!value) return 0;
  
  return (key.length + value.length) * 2;
};

export const getLocalStorageUsagePercent = (): number => {
  // Most browsers have a 5-10MB limit for localStorage
  // We'll use 10MB as a more generous estimate to support larger PDF files
  const ESTIMATED_LIMIT = 10 * 1024 * 1024; // 10MB in bytes (increased from 5MB)
  const currentSize = getLocalStorageSize();
  
  return Math.round((currentSize / ESTIMATED_LIMIT) * 100);
};

export const isLocalStorageNearLimit = (): boolean => {
  // Warn when storage is above 85% (relaxed from 80% to allow larger files)
  return getLocalStorageUsagePercent() > 85;
};

export const formatStorageSize = (bytes: number): string => {
  const kb = bytes / 1024;
  const mb = kb / 1024;
  
  if (mb >= 1) {
    return `${mb.toFixed(2)} MB`;
  } else if (kb >= 1) {
    return `${kb.toFixed(2)} KB`;
  } else {
    return `${bytes} bytes`;
  }
};