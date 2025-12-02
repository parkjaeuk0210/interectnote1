/**
 * IndexedDB Manager for InterectNote1
 *
 * localStorage 대비 장점:
 * - 용량: 5-10MB → 수백 MB ~ 수 GB
 * - 비동기 처리로 메인 스레드 블로킹 없음
 * - 이미지 Blob 저장 가능
 * - 트랜잭션 지원으로 데이터 무결성 보장
 *
 * Firebase 대역폭 절감 효과:
 * - 이미 다운로드한 데이터 재사용
 * - 오프라인 시에도 캐시된 데이터 표시
 * - 월 10GB 무료 제한 내에서 100명 사용자 지원
 */

import { Note, CanvasImage, CanvasFile, NoteColor } from '../types';

const DB_NAME = 'interectnote-cache';
const DB_VERSION = 1;

// Store names
const STORES = {
  NOTES: 'notes',
  IMAGES: 'images',
  FILES: 'files',
  SETTINGS: 'settings',
  IMAGE_BLOBS: 'imageBlobs', // 이미지 바이너리 캐싱
  METADATA: 'metadata',
} as const;

// Serializable versions (Date → number)
interface SerializedNote {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  color: string;
  zIndex?: number;
  createdAt: number;
  updatedAt: number;
  userId: string;
}

interface SerializedImage {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  url: string;
  originalWidth: number;
  originalHeight: number;
  fileName: string;
  fileSize: number;
  createdAt: number;
  userId: string;
}

interface SerializedFile {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fileName: string;
  fileType: string;
  fileSize: number;
  url: string;
  thumbnailUrl?: string;
  createdAt: number;
  userId: string;
  pdfData?: any;
}

interface ImageBlobEntry {
  id: string; // imageId
  userId: string;
  blob: Blob;
  url: string; // original URL for validation
  cachedAt: number;
}

interface CacheMetadata {
  userId: string;
  lastSyncTime: number;
  version: number;
  notesCount: number;
  imagesCount: number;
  filesCount: number;
}

interface UserSettings {
  userId: string;
  isDarkMode: boolean;
  language: string;
  lastSyncTime: number;
}

class IndexedDBManager {
  private db: IDBDatabase | null = null;
  private dbReady: Promise<IDBDatabase> | null = null;
  private isSupported: boolean;

  constructor() {
    this.isSupported = typeof indexedDB !== 'undefined';
    if (this.isSupported) {
      this.dbReady = this.initDB();
    }
  }

  /**
   * IndexedDB 초기화
   */
  private initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('IndexedDB open error:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('✅ IndexedDB initialized successfully');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Notes store (by userId index)
        if (!db.objectStoreNames.contains(STORES.NOTES)) {
          const notesStore = db.createObjectStore(STORES.NOTES, { keyPath: 'id' });
          notesStore.createIndex('userId', 'userId', { unique: false });
          notesStore.createIndex('userId_id', ['userId', 'id'], { unique: true });
        }

        // Images store
        if (!db.objectStoreNames.contains(STORES.IMAGES)) {
          const imagesStore = db.createObjectStore(STORES.IMAGES, { keyPath: 'id' });
          imagesStore.createIndex('userId', 'userId', { unique: false });
        }

        // Files store
        if (!db.objectStoreNames.contains(STORES.FILES)) {
          const filesStore = db.createObjectStore(STORES.FILES, { keyPath: 'id' });
          filesStore.createIndex('userId', 'userId', { unique: false });
        }

        // Settings store (per user)
        if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
          db.createObjectStore(STORES.SETTINGS, { keyPath: 'userId' });
        }

        // Image blobs store (for offline images)
        if (!db.objectStoreNames.contains(STORES.IMAGE_BLOBS)) {
          const blobStore = db.createObjectStore(STORES.IMAGE_BLOBS, { keyPath: 'id' });
          blobStore.createIndex('userId', 'userId', { unique: false });
          blobStore.createIndex('cachedAt', 'cachedAt', { unique: false });
        }

        // Metadata store
        if (!db.objectStoreNames.contains(STORES.METADATA)) {
          db.createObjectStore(STORES.METADATA, { keyPath: 'userId' });
        }

        console.log('📦 IndexedDB stores created');
      };
    });
  }

  /**
   * DB가 준비될 때까지 대기
   */
  private async getDB(): Promise<IDBDatabase> {
    if (!this.isSupported) {
      throw new Error('IndexedDB is not supported');
    }
    if (this.db) return this.db;
    if (this.dbReady) return this.dbReady;
    throw new Error('IndexedDB not initialized');
  }

  /**
   * IndexedDB 지원 여부 확인
   */
  isAvailable(): boolean {
    return this.isSupported;
  }

  // ============================================
  // Notes Operations
  // ============================================

  async saveNotes(userId: string, notes: Note[]): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction(STORES.NOTES, 'readwrite');
    const store = tx.objectStore(STORES.NOTES);

    // First, delete all existing notes for this user
    const index = store.index('userId');
    const existingKeys = await this.getAllKeysFromIndex(index, userId);
    for (const key of existingKeys) {
      store.delete(key);
    }

    // Then add new notes
    for (const note of notes) {
      const serialized: SerializedNote = {
        id: note.id,
        x: note.x,
        y: note.y,
        width: note.width,
        height: note.height,
        content: note.content,
        color: note.color,
        zIndex: note.zIndex,
        createdAt: note.createdAt.getTime(),
        updatedAt: note.updatedAt.getTime(),
        userId,
      };
      store.put(serialized);
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getNotes(userId: string): Promise<Note[]> {
    const db = await this.getDB();
    const tx = db.transaction(STORES.NOTES, 'readonly');
    const store = tx.objectStore(STORES.NOTES);
    const index = store.index('userId');

    return new Promise((resolve, reject) => {
      const request = index.getAll(userId);
      request.onsuccess = () => {
        const serialized = request.result as SerializedNote[];
        const notes: Note[] = serialized.map(n => ({
          id: n.id,
          x: n.x,
          y: n.y,
          width: n.width,
          height: n.height,
          content: n.content,
          color: n.color as NoteColor,
          zIndex: n.zIndex,
          createdAt: new Date(n.createdAt),
          updatedAt: new Date(n.updatedAt),
        }));
        resolve(notes);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async saveNote(userId: string, note: Note): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction(STORES.NOTES, 'readwrite');
    const store = tx.objectStore(STORES.NOTES);

    const serialized: SerializedNote = {
      id: note.id,
      x: note.x,
      y: note.y,
      width: note.width,
      height: note.height,
      content: note.content,
      color: note.color,
      zIndex: note.zIndex,
      createdAt: note.createdAt.getTime(),
      updatedAt: note.updatedAt.getTime(),
      userId,
    };

    return new Promise((resolve, reject) => {
      const request = store.put(serialized);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteNote(noteId: string): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction(STORES.NOTES, 'readwrite');
    const store = tx.objectStore(STORES.NOTES);

    return new Promise((resolve, reject) => {
      const request = store.delete(noteId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // ============================================
  // Images Operations
  // ============================================

  async saveImages(userId: string, images: CanvasImage[]): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction(STORES.IMAGES, 'readwrite');
    const store = tx.objectStore(STORES.IMAGES);

    // Delete existing
    const index = store.index('userId');
    const existingKeys = await this.getAllKeysFromIndex(index, userId);
    for (const key of existingKeys) {
      store.delete(key);
    }

    // Add new
    for (const image of images) {
      const serialized: SerializedImage = {
        id: image.id,
        x: image.x,
        y: image.y,
        width: image.width,
        height: image.height,
        url: image.url,
        originalWidth: image.originalWidth,
        originalHeight: image.originalHeight,
        fileName: image.fileName,
        fileSize: image.fileSize,
        createdAt: image.createdAt.getTime(),
        userId,
      };
      store.put(serialized);
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getImages(userId: string): Promise<CanvasImage[]> {
    const db = await this.getDB();
    const tx = db.transaction(STORES.IMAGES, 'readonly');
    const store = tx.objectStore(STORES.IMAGES);
    const index = store.index('userId');

    return new Promise((resolve, reject) => {
      const request = index.getAll(userId);
      request.onsuccess = () => {
        const serialized = request.result as SerializedImage[];
        const images: CanvasImage[] = serialized.map(img => ({
          id: img.id,
          x: img.x,
          y: img.y,
          width: img.width,
          height: img.height,
          url: img.url,
          originalWidth: img.originalWidth,
          originalHeight: img.originalHeight,
          fileName: img.fileName,
          fileSize: img.fileSize,
          createdAt: new Date(img.createdAt),
        }));
        resolve(images);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteImage(imageId: string): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction([STORES.IMAGES, STORES.IMAGE_BLOBS], 'readwrite');

    tx.objectStore(STORES.IMAGES).delete(imageId);
    tx.objectStore(STORES.IMAGE_BLOBS).delete(imageId);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // ============================================
  // Files Operations
  // ============================================

  async saveFiles(userId: string, files: CanvasFile[]): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction(STORES.FILES, 'readwrite');
    const store = tx.objectStore(STORES.FILES);

    // Delete existing
    const index = store.index('userId');
    const existingKeys = await this.getAllKeysFromIndex(index, userId);
    for (const key of existingKeys) {
      store.delete(key);
    }

    // Add new
    for (const file of files) {
      const serialized: SerializedFile = {
        id: file.id,
        x: file.x,
        y: file.y,
        width: file.width,
        height: file.height,
        fileName: file.fileName,
        fileType: file.fileType,
        fileSize: file.fileSize,
        url: file.url,
        thumbnailUrl: file.thumbnailUrl,
        createdAt: file.createdAt.getTime(),
        userId,
        pdfData: file.pdfData,
      };
      store.put(serialized);
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getFiles(userId: string): Promise<CanvasFile[]> {
    const db = await this.getDB();
    const tx = db.transaction(STORES.FILES, 'readonly');
    const store = tx.objectStore(STORES.FILES);
    const index = store.index('userId');

    return new Promise((resolve, reject) => {
      const request = index.getAll(userId);
      request.onsuccess = () => {
        const serialized = request.result as SerializedFile[];
        const files: CanvasFile[] = serialized.map(f => ({
          id: f.id,
          x: f.x,
          y: f.y,
          width: f.width,
          height: f.height,
          fileName: f.fileName,
          fileType: f.fileType as CanvasFile['fileType'],
          fileSize: f.fileSize,
          url: f.url,
          thumbnailUrl: f.thumbnailUrl,
          createdAt: new Date(f.createdAt),
          pdfData: f.pdfData,
        }));
        resolve(files);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteFile(fileId: string): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction(STORES.FILES, 'readwrite');
    const store = tx.objectStore(STORES.FILES);

    return new Promise((resolve, reject) => {
      const request = store.delete(fileId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // ============================================
  // Settings Operations
  // ============================================

  async saveSettings(userId: string, settings: Partial<UserSettings>): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction(STORES.SETTINGS, 'readwrite');
    const store = tx.objectStore(STORES.SETTINGS);

    // Get existing settings first
    const existing = await this.getSettings(userId);
    const merged: UserSettings = {
      userId,
      isDarkMode: settings.isDarkMode ?? existing?.isDarkMode ?? false,
      language: settings.language ?? existing?.language ?? 'ko',
      lastSyncTime: settings.lastSyncTime ?? Date.now(),
    };

    return new Promise((resolve, reject) => {
      const request = store.put(merged);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getSettings(userId: string): Promise<UserSettings | null> {
    const db = await this.getDB();
    const tx = db.transaction(STORES.SETTINGS, 'readonly');
    const store = tx.objectStore(STORES.SETTINGS);

    return new Promise((resolve, reject) => {
      const request = store.get(userId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  // ============================================
  // Image Blob Caching (오프라인 이미지)
  // ============================================

  /**
   * 이미지 URL을 Blob으로 캐싱
   * Firebase Storage URL → IndexedDB Blob
   */
  async cacheImageBlob(userId: string, imageId: string, url: string): Promise<string | null> {
    try {
      // Skip data URLs (already embedded)
      if (url.startsWith('data:')) {
        return url;
      }

      // Check if already cached
      const existing = await this.getImageBlob(imageId);
      if (existing && existing.url === url) {
        return URL.createObjectURL(existing.blob);
      }

      // Fetch and cache
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`Failed to fetch image for caching: ${url}`);
        return null;
      }

      const blob = await response.blob();
      const db = await this.getDB();
      const tx = db.transaction(STORES.IMAGE_BLOBS, 'readwrite');
      const store = tx.objectStore(STORES.IMAGE_BLOBS);

      const entry: ImageBlobEntry = {
        id: imageId,
        userId,
        blob,
        url,
        cachedAt: Date.now(),
      };

      return new Promise((resolve, reject) => {
        const request = store.put(entry);
        request.onsuccess = () => {
          resolve(URL.createObjectURL(blob));
        };
        request.onerror = () => {
          console.error('Failed to cache image blob:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Error caching image blob:', error);
      return null;
    }
  }

  async getImageBlob(imageId: string): Promise<ImageBlobEntry | null> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(STORES.IMAGE_BLOBS, 'readonly');
      const store = tx.objectStore(STORES.IMAGE_BLOBS);

      return new Promise((resolve, reject) => {
        const request = store.get(imageId);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } catch {
      return null;
    }
  }

  /**
   * 캐시된 이미지 URL 가져오기 (없으면 원본 반환)
   */
  async getCachedImageUrl(imageId: string, originalUrl: string): Promise<string> {
    const cached = await this.getImageBlob(imageId);
    if (cached) {
      return URL.createObjectURL(cached.blob);
    }
    return originalUrl;
  }

  /**
   * 오래된 이미지 캐시 정리 (30일 이상)
   */
  async cleanupOldImageCache(maxAgeMs: number = 30 * 24 * 60 * 60 * 1000): Promise<number> {
    const db = await this.getDB();
    const tx = db.transaction(STORES.IMAGE_BLOBS, 'readwrite');
    const store = tx.objectStore(STORES.IMAGE_BLOBS);
    const index = store.index('cachedAt');

    const cutoff = Date.now() - maxAgeMs;
    let deletedCount = 0;

    return new Promise((resolve, reject) => {
      const range = IDBKeyRange.upperBound(cutoff);
      const request = index.openCursor(range);

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        }
      };

      tx.oncomplete = () => {
        console.log(`🧹 Cleaned up ${deletedCount} old cached images`);
        resolve(deletedCount);
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  // ============================================
  // Metadata Operations
  // ============================================

  async saveMetadata(userId: string, metadata: Partial<CacheMetadata>): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction(STORES.METADATA, 'readwrite');
    const store = tx.objectStore(STORES.METADATA);

    const existing = await this.getMetadata(userId);
    const merged: CacheMetadata = {
      userId,
      lastSyncTime: metadata.lastSyncTime ?? existing?.lastSyncTime ?? Date.now(),
      version: metadata.version ?? existing?.version ?? 1,
      notesCount: metadata.notesCount ?? existing?.notesCount ?? 0,
      imagesCount: metadata.imagesCount ?? existing?.imagesCount ?? 0,
      filesCount: metadata.filesCount ?? existing?.filesCount ?? 0,
    };

    return new Promise((resolve, reject) => {
      const request = store.put(merged);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getMetadata(userId: string): Promise<CacheMetadata | null> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(STORES.METADATA, 'readonly');
      const store = tx.objectStore(STORES.METADATA);

      return new Promise((resolve, reject) => {
        const request = store.get(userId);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } catch {
      return null;
    }
  }

  // ============================================
  // Bulk Operations (성능 최적화)
  // ============================================

  /**
   * 전체 사용자 데이터 한 번에 저장 (트랜잭션 최적화)
   */
  async saveAllUserData(
    userId: string,
    data: {
      notes: Note[];
      images: CanvasImage[];
      files: CanvasFile[];
      settings?: Partial<UserSettings>;
    }
  ): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction(
      [STORES.NOTES, STORES.IMAGES, STORES.FILES, STORES.SETTINGS, STORES.METADATA],
      'readwrite'
    );

    const notesStore = tx.objectStore(STORES.NOTES);
    const imagesStore = tx.objectStore(STORES.IMAGES);
    const filesStore = tx.objectStore(STORES.FILES);
    const settingsStore = tx.objectStore(STORES.SETTINGS);
    const metadataStore = tx.objectStore(STORES.METADATA);

    // Clear and save notes
    const notesIndex = notesStore.index('userId');
    const noteKeys = await this.getAllKeysFromIndex(notesIndex, userId);
    for (const key of noteKeys) {
      notesStore.delete(key);
    }
    for (const note of data.notes) {
      notesStore.put({
        id: note.id,
        x: note.x,
        y: note.y,
        width: note.width,
        height: note.height,
        content: note.content,
        color: note.color,
        zIndex: note.zIndex,
        createdAt: note.createdAt.getTime(),
        updatedAt: note.updatedAt.getTime(),
        userId,
      });
    }

    // Clear and save images
    const imagesIndex = imagesStore.index('userId');
    const imageKeys = await this.getAllKeysFromIndex(imagesIndex, userId);
    for (const key of imageKeys) {
      imagesStore.delete(key);
    }
    for (const image of data.images) {
      imagesStore.put({
        id: image.id,
        x: image.x,
        y: image.y,
        width: image.width,
        height: image.height,
        url: image.url,
        originalWidth: image.originalWidth,
        originalHeight: image.originalHeight,
        fileName: image.fileName,
        fileSize: image.fileSize,
        createdAt: image.createdAt.getTime(),
        userId,
      });
    }

    // Clear and save files
    const filesIndex = filesStore.index('userId');
    const fileKeys = await this.getAllKeysFromIndex(filesIndex, userId);
    for (const key of fileKeys) {
      filesStore.delete(key);
    }
    for (const file of data.files) {
      filesStore.put({
        id: file.id,
        x: file.x,
        y: file.y,
        width: file.width,
        height: file.height,
        fileName: file.fileName,
        fileType: file.fileType,
        fileSize: file.fileSize,
        url: file.url,
        thumbnailUrl: file.thumbnailUrl,
        createdAt: file.createdAt.getTime(),
        userId,
        pdfData: file.pdfData,
      });
    }

    // Save settings
    if (data.settings) {
      const existingSettings = await this.getSettings(userId);
      settingsStore.put({
        userId,
        isDarkMode: data.settings.isDarkMode ?? existingSettings?.isDarkMode ?? false,
        language: data.settings.language ?? existingSettings?.language ?? 'ko',
        lastSyncTime: Date.now(),
      });
    }

    // Save metadata
    metadataStore.put({
      userId,
      lastSyncTime: Date.now(),
      version: 1,
      notesCount: data.notes.length,
      imagesCount: data.images.length,
      filesCount: data.files.length,
    });

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => {
        console.log(`✅ IndexedDB: Saved ${data.notes.length} notes, ${data.images.length} images, ${data.files.length} files`);
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * 전체 사용자 데이터 한 번에 로드
   */
  async getAllUserData(userId: string): Promise<{
    notes: Note[];
    images: CanvasImage[];
    files: CanvasFile[];
    settings: UserSettings | null;
    metadata: CacheMetadata | null;
  } | null> {
    try {
      const [notes, images, files, settings, metadata] = await Promise.all([
        this.getNotes(userId),
        this.getImages(userId),
        this.getFiles(userId),
        this.getSettings(userId),
        this.getMetadata(userId),
      ]);

      return { notes, images, files, settings, metadata };
    } catch (error) {
      console.error('Error loading user data from IndexedDB:', error);
      return null;
    }
  }

  /**
   * 사용자 데이터 전체 삭제
   */
  async clearUserData(userId: string): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction(
      [STORES.NOTES, STORES.IMAGES, STORES.FILES, STORES.SETTINGS, STORES.IMAGE_BLOBS, STORES.METADATA],
      'readwrite'
    );

    const stores = [
      { store: tx.objectStore(STORES.NOTES), indexName: 'userId' },
      { store: tx.objectStore(STORES.IMAGES), indexName: 'userId' },
      { store: tx.objectStore(STORES.FILES), indexName: 'userId' },
      { store: tx.objectStore(STORES.IMAGE_BLOBS), indexName: 'userId' },
    ];

    for (const { store, indexName } of stores) {
      const index = store.index(indexName);
      const keys = await this.getAllKeysFromIndex(index, userId);
      for (const key of keys) {
        store.delete(key);
      }
    }

    tx.objectStore(STORES.SETTINGS).delete(userId);
    tx.objectStore(STORES.METADATA).delete(userId);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => {
        console.log(`🗑️ Cleared all IndexedDB data for user: ${userId}`);
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  // ============================================
  // Helper Methods
  // ============================================

  private getAllKeysFromIndex(index: IDBIndex, key: IDBValidKey): Promise<IDBValidKey[]> {
    return new Promise((resolve, reject) => {
      const keys: IDBValidKey[] = [];
      const request = index.openKeyCursor(IDBKeyRange.only(key));

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          keys.push(cursor.primaryKey);
          cursor.continue();
        } else {
          resolve(keys);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 데이터베이스 용량 확인 (대략적 추정)
   */
  async estimateStorageUsage(): Promise<{ usage: number; quota: number } | null> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        return {
          usage: estimate.usage || 0,
          quota: estimate.quota || 0,
        };
      } catch {
        return null;
      }
    }
    return null;
  }
}

// Singleton export
export const indexedDBManager = new IndexedDBManager();
