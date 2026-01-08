import { create } from 'zustand';
import { undoable } from './middleware/undoable';
import {
  saveNote as saveNoteToFirebase,
  updateNote as updateNoteInFirebase,
  deleteNote as deleteNoteFromFirebase,
  saveImage as saveImageToFirebase,
  updateImage as updateImageInFirebase,
  deleteImage as deleteImageFromFirebase,
  saveFile as saveFileToFirebase,
  updateFile as updateFileInFirebase,
  deleteFile as deleteFileFromFirebase,
  saveSettings,
  subscribeToUserData,
  UserData
} from '../lib/database';
import { Note, CanvasImage, CanvasFile, Viewport, NoteColor } from '../types';
import { FirebaseNote, FirebaseImage, FirebaseFile } from '../types/firebase';
import { auth } from '../lib/firebase';
import { migrationManager } from '../lib/migrationManager';
import { useCanvasStore } from './canvasStore';
import { indexedDBManager } from '../lib/indexedDBManager';

export interface FirebaseCanvasStore {
  // Local state (same as before)
  notes: Note[];
  images: CanvasImage[];
  files: CanvasFile[];
  viewport: Viewport;
  selectedNoteId: string | null;
  selectedImageId: string | null;
  selectedFileId: string | null;
  isDarkMode: boolean;
  // Auth cache for PWA environments
  currentUserId: string | null;
  
  // Firebase sync state
  isSyncing: boolean;
  syncError: Error | null;
  unsubscribers: (() => void)[];
  // Remote data readiness
  notesReady: boolean;
  imagesReady: boolean;
  filesReady: boolean;
  settingsReady: boolean;
  remoteReady: boolean;
  
  // Actions (matching CanvasStore interface)
  addNote: (x: number, y: number) => void;
  updateNote: (id: string, updates: Partial<Note>) => void;
  deleteNote: (id: string) => void;
  selectNote: (id: string | null) => void;
  
  addImage: (image: Omit<CanvasImage, 'id' | 'createdAt'>) => void;
  updateImage: (id: string, updates: Partial<CanvasImage>) => void;
  deleteImage: (id: string) => void;
  selectImage: (id: string | null) => void;
  
  addFile: (file: Omit<CanvasFile, 'id' | 'createdAt'>) => void;
  updateFile: (id: string, updates: Partial<CanvasFile>) => void;
  deleteFile: (id: string) => void;
  selectFile: (id: string | null) => void;
  
  setViewport: (viewport: Viewport) => void;
  clearCanvas: () => void;
  toggleDarkMode: () => void;
  setDarkMode: (isDark: boolean) => void;
  
  // Firebase sync
  initializeFirebaseSync: (userId: string) => void;
  cleanupFirebaseSync: () => void;
  
  // Undo/Redo
  undo: () => void;
  redo: () => void;
}

const defaultColors: NoteColor[] = ['yellow', 'pink', 'blue', 'green', 'purple', 'orange'];

type CacheWritePayload = {
  notes: Note[];
  images: CanvasImage[];
  files: CanvasFile[];
  isDarkMode: boolean;
};

let cacheWriteTimer: ReturnType<typeof setTimeout> | null = null;
let pendingCacheWrite: { userId: string; payload: CacheWritePayload } | null = null;
let lastCacheWriteAt = 0;

const CACHE_MIN_INTERVAL_MS = 10_000;
const CACHE_DEBOUNCE_MS = 2_000;

const cancelScheduledCacheWrite = () => {
  if (typeof window === 'undefined') return;
  if (cacheWriteTimer !== null) {
    clearTimeout(cacheWriteTimer);
    cacheWriteTimer = null;
  }
  pendingCacheWrite = null;
};

const scheduleCacheWrite = (userId: string, payload: CacheWritePayload) => {
  if (typeof window === 'undefined') return;

  pendingCacheWrite = { userId, payload };

  const now = Date.now();
  const minWait = Math.max(0, lastCacheWriteAt + CACHE_MIN_INTERVAL_MS - now);
  const delay = Math.max(CACHE_DEBOUNCE_MS, minWait);

  if (cacheWriteTimer) {
    clearTimeout(cacheWriteTimer);
  }

  cacheWriteTimer = setTimeout(() => {
    cacheWriteTimer = null;
    const pending = pendingCacheWrite;
    pendingCacheWrite = null;
    if (!pending) return;

    // Avoid background churn: cache writes are best-effort.
    if (typeof document !== 'undefined' && document.hidden) {
      return;
    }

    const run = () => {
      lastCacheWriteAt = Date.now();

      // IndexedDB cache (large-capacity)
      if (indexedDBManager.isAvailable()) {
        indexedDBManager
          .saveAllUserData(pending.userId, {
            notes: pending.payload.notes,
            images: pending.payload.images,
            files: pending.payload.files,
            settings: {
              isDarkMode: pending.payload.isDarkMode,
            },
          })
          .catch((err) => {
            console.warn('IndexedDB save failed:', err);
          });
      }

      // localStorage fallback (limited size, for unsupported browsers)
      try {
        const cache = {
          version: 1,
          updatedAt: Date.now(),
          notes: pending.payload.notes
            .slice(0, 50)
            .map((n) => ({ ...n, createdAt: n.createdAt.getTime(), updatedAt: n.updatedAt.getTime() })),
          images: pending.payload.images
            .slice(0, 20)
            .map((img) => ({ ...img, createdAt: img.createdAt.getTime() })),
          files: pending.payload.files
            .slice(0, 10)
            .map((f) => ({ ...f, createdAt: f.createdAt.getTime() })),
          isDarkMode: pending.payload.isDarkMode,
        };
        localStorage.setItem(`remoteCache:${pending.userId}`, JSON.stringify(cache));
      } catch {}
    };

    const requestIdle = (window as any).requestIdleCallback as
      | ((cb: () => void, opts?: { timeout?: number }) => void)
      | undefined;

    if (typeof requestIdle === 'function') {
      requestIdle(run, { timeout: 2000 });
      return;
    }

    setTimeout(run, 0);
  }, delay);
};

// Helper to convert Firebase data to local format
const firebaseNoteToLocal = (firebaseNote: FirebaseNote): Note => ({
  id: firebaseNote.id,
  content: firebaseNote.content,
  x: firebaseNote.x,
  y: firebaseNote.y,
  width: firebaseNote.width,
  height: firebaseNote.height,
  color: firebaseNote.color as NoteColor,
  zIndex: firebaseNote.zIndex || 0,
  createdAt: new Date(firebaseNote.createdAt),
  updatedAt: new Date(firebaseNote.updatedAt),
});

const firebaseImageToLocal = (firebaseImage: FirebaseImage): CanvasImage => ({
  id: firebaseImage.id,
  url: firebaseImage.url,
  x: firebaseImage.x,
  y: firebaseImage.y,
  width: firebaseImage.width,
  height: firebaseImage.height,
  originalWidth: firebaseImage.originalWidth,
  originalHeight: firebaseImage.originalHeight,
  fileName: firebaseImage.fileName,
  fileSize: firebaseImage.fileSize,
  createdAt: new Date(firebaseImage.createdAt),
});

const firebaseFileToLocal = (firebaseFile: FirebaseFile): CanvasFile => ({
  id: firebaseFile.id,
  fileName: firebaseFile.fileName,
  fileSize: firebaseFile.fileSize,
  fileType: firebaseFile.mimeType.startsWith('image/') ? 'image' : 
           firebaseFile.mimeType === 'application/pdf' ? 'pdf' : 
           firebaseFile.mimeType.includes('document') ? 'document' : 'other',
  url: firebaseFile.url,
  x: firebaseFile.x,
  y: firebaseFile.y,
  width: 100, // Default width
  height: 100, // Default height
  createdAt: new Date(firebaseFile.createdAt),
});

export const useFirebaseCanvasStore = create<FirebaseCanvasStore>()(
  undoable(
    (set, get) => ({
  // Initial state
  notes: [],
  images: [],
  files: [],
  viewport: { x: 0, y: 0, scale: 1 },
  selectedNoteId: null,
  selectedImageId: null,
  selectedFileId: null,
  isDarkMode: false,
  currentUserId: null,
  isSyncing: false,
  syncError: null,
  unsubscribers: [],
  notesReady: false,
  imagesReady: false,
  filesReady: false,
  settingsReady: false,
  remoteReady: false,

  // Note actions
  addNote: (x: number, y: number) => {
    const userId = get().currentUserId || auth.currentUser?.uid || null;
    if (!userId) {
      // Fallback to local store if auth is not ready (PWA edge cases)
      useCanvasStore.getState().addNote(x, y);
      return;
    }

    const state = get();
    // Get the maximum zIndex from all notes
    const maxZIndex = Math.max(...state.notes.map(n => n.zIndex || 0), 0);

    const newNote: Omit<FirebaseNote, 'id' | 'userId' | 'deviceId'> = {
      content: '',
      x,
      y,
      width: 200,
      height: 200,
      color: defaultColors[Math.floor(Math.random() * defaultColors.length)],
      zIndex: maxZIndex + 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    set({ isSyncing: true });
    // Request an id from Firebase (client-side generated), then optimistic update
    saveNoteToFirebase(userId, newNote)
      .then((newId) => {
        // Optimistically add to local state for immediate UX
        set((s) => ({
          notes: [
            ...s.notes,
            {
              id: newId,
              content: '',
              x,
              y,
              width: 200,
              height: 200,
              color: newNote.color as NoteColor,
              zIndex: maxZIndex + 1,
              createdAt: new Date(newNote.createdAt),
              updatedAt: new Date(newNote.updatedAt),
            },
          ],
          selectedNoteId: newId,
          selectedImageId: null,
          selectedFileId: null,
        }));
      })
      .catch((error) => {
        set({ syncError: error as Error });
      })
      .finally(() => {
        set({ isSyncing: false });
      });
  },

  updateNote: (id: string, updates: Partial<Note>) => {
    const userId = get().currentUserId || auth.currentUser?.uid || null;
    if (!userId) return;

    // Optimistic update - immediately update local state
    set((state) => ({
      notes: state.notes.map((note) =>
        note.id === id
          ? { ...note, ...updates, updatedAt: new Date() }
          : note
      ),
    }));

    // Convert Date to timestamp for Firebase
    const firebaseUpdates: any = { ...updates };
    if (updates.createdAt) {
      firebaseUpdates.createdAt = updates.createdAt.getTime();
    }
    if (updates.updatedAt) {
      firebaseUpdates.updatedAt = updates.updatedAt.getTime();
    }

    set({ isSyncing: true });
    updateNoteInFirebase(userId, id, firebaseUpdates)
      .then(() => {
        // The update will be reflected via the Firebase listener
        // which will sync with our optimistic update
      })
      .catch((error) => {
        // On error, revert the optimistic update by fetching from Firebase
        set({ syncError: error as Error });
        // The Firebase listener will restore the correct state
      })
      .finally(() => {
        set({ isSyncing: false });
      });
  },

  deleteNote: (id: string) => {
    const userId = get().currentUserId || auth.currentUser?.uid || null;

    if (!userId) {
      if (import.meta.env.DEV) {
        console.log('[FirebaseStore] No user, falling back to local delete');
      }
      useCanvasStore.getState().deleteNote(id);
      return;
    }

    set({ isSyncing: true });
    // Optimistically remove from local state
    set((s) => ({
      notes: s.notes.filter((n) => n.id !== id),
      selectedNoteId: s.selectedNoteId === id ? null : s.selectedNoteId,
    }));

    deleteNoteFromFirebase(userId, id)
      .then(() => {
        // The deletion will be reflected via the Firebase listener
      })
      .catch((error) => {
        console.error('[FirebaseStore] Delete failed:', error);
        set({ syncError: error as Error });
        // On error, data will be restored by listener on next sync
      })
      .finally(() => {
        set({ isSyncing: false });
      });
  },

  selectNote: (id: string | null) => {
    const userId = get().currentUserId || auth.currentUser?.uid || null;
    if (!userId) {
      set({ selectedNoteId: id, selectedImageId: null, selectedFileId: null });
      return;
    }

    const state = get();
    
    if (id) {
      // Get the maximum zIndex from all notes
      const maxZIndex = Math.max(...state.notes.map(n => n.zIndex || 0), 0);
      
      // Update the selected note's zIndex to be on top
      const noteToUpdate = state.notes.find(n => n.id === id);
      if (noteToUpdate) {
        // Update locally first
        const updatedNotes = state.notes.map(note =>
          note.id === id
            ? { ...note, zIndex: maxZIndex + 1 }
            : note
        );
        
        set({
          notes: updatedNotes,
          selectedNoteId: id,
          selectedImageId: null,
          selectedFileId: null
        });
        
        // FIX: Debounce z-index Firebase update to reduce drag start delay
        if ((globalThis as any).__zIndexTimer) {
          clearTimeout((globalThis as any).__zIndexTimer);
        }
        (globalThis as any).__zIndexTimer = setTimeout(() => {
          updateNoteInFirebase(userId, id, { zIndex: maxZIndex + 1 }).catch(() => {});
        }, 1000);
      }
    } else {
      set({ selectedNoteId: id, selectedImageId: null, selectedFileId: null });
    }
  },

  // Image actions (similar pattern)
  addImage: (image: Omit<CanvasImage, 'id' | 'createdAt'>) => {
    const userId = get().currentUserId || auth.currentUser?.uid || null;
    if (!userId) return;

    // TODO: Upload image to Firebase Storage first
    // For now, we'll store the data URL
    const firebaseImage: Omit<FirebaseImage, 'id' | 'userId' | 'deviceId'> = {
      url: image.url,
      storagePath: '', // Will be set after Storage upload
      x: image.x,
      y: image.y,
      width: image.width,
      height: image.height,
      originalWidth: image.originalWidth,
      originalHeight: image.originalHeight,
      fileName: image.fileName,
      fileSize: image.fileSize,
      createdAt: Date.now(),
    };

    set({ isSyncing: true });
    saveImageToFirebase(userId, firebaseImage)
      .then(() => {
        // Image will be added to local state via the Firebase listener
      })
      .catch((error) => {
        set({ syncError: error as Error });
      })
      .finally(() => {
        set({ isSyncing: false });
      });
  },

  updateImage: (id: string, updates: Partial<CanvasImage>) => {
    const userId = get().currentUserId || auth.currentUser?.uid || null;
    if (!userId) return;

    // Convert Date to timestamp for Firebase
    const firebaseUpdates: any = { ...updates };
    if (updates.createdAt) {
      firebaseUpdates.createdAt = updates.createdAt.getTime();
    }

    set({ isSyncing: true });
    updateImageInFirebase(userId, id, firebaseUpdates)
      .then(() => {
        // The update will be reflected via the Firebase listener
      })
      .catch((error) => {
        set({ syncError: error as Error });
      })
      .finally(() => {
        set({ isSyncing: false });
      });
  },

  deleteImage: (id: string) => {
    const userId = get().currentUserId || auth.currentUser?.uid || null;
    if (!userId) return;

    set({ isSyncing: true });
    deleteImageFromFirebase(userId, id)
      .then(() => {
        // The deletion will be reflected via the Firebase listener
      })
      .catch((error) => {
        set({ syncError: error as Error });
      })
      .finally(() => {
        set({ isSyncing: false });
      });
  },

  selectImage: (id: string | null) => {
    set({ selectedImageId: id, selectedNoteId: null, selectedFileId: null });
  },

  // File actions (similar pattern)
  addFile: (file: Omit<CanvasFile, 'id' | 'createdAt'>) => {
    const userId = get().currentUserId || auth.currentUser?.uid || null;
    if (!userId) return;

    const firebaseFile: Omit<FirebaseFile, 'id' | 'userId' | 'deviceId'> = {
      url: file.url,
      storagePath: '', // Will be set after Storage upload
      x: file.x,
      y: file.y,
      fileName: file.fileName,
      fileSize: file.fileSize,
      mimeType: file.fileType === 'image' ? 'image/png' : 
                file.fileType === 'pdf' ? 'application/pdf' : 
                file.fileType === 'document' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 
                'application/octet-stream',
      createdAt: Date.now(),
    };

    set({ isSyncing: true });
    saveFileToFirebase(userId, firebaseFile)
      .then(() => {
        // File will be added to local state via the Firebase listener
      })
      .catch((error) => {
        set({ syncError: error as Error });
      })
      .finally(() => {
        set({ isSyncing: false });
      });
  },

  updateFile: (id: string, updates: Partial<CanvasFile>) => {
    const userId = get().currentUserId || auth.currentUser?.uid || null;
    if (!userId) return;

    // Convert Date to timestamp for Firebase
    const firebaseUpdates: any = { ...updates };
    if (updates.createdAt) {
      firebaseUpdates.createdAt = updates.createdAt.getTime();
    }

    set({ isSyncing: true });
    updateFileInFirebase(userId, id, firebaseUpdates)
      .then(() => {
        // The update will be reflected via the Firebase listener
      })
      .catch((error) => {
        set({ syncError: error as Error });
      })
      .finally(() => {
        set({ isSyncing: false });
      });
  },

  deleteFile: (id: string) => {
    const userId = get().currentUserId || auth.currentUser?.uid || null;
    if (!userId) return;

    set({ isSyncing: true });
    deleteFileFromFirebase(userId, id)
      .then(() => {
        // The deletion will be reflected via the Firebase listener
      })
      .catch((error) => {
        set({ syncError: error as Error });
      })
      .finally(() => {
        set({ isSyncing: false });
      });
  },

  selectFile: (id: string | null) => {
    set({ selectedFileId: id, selectedNoteId: null, selectedImageId: null });
  },

  // Other actions
  setViewport: (viewport: Viewport) => {
    set({ viewport });
  },

  clearCanvas: () => {
    const userId = get().currentUserId || auth.currentUser?.uid || null;
    if (!userId) return;

    set({ isSyncing: true });
    // Delete all notes, images, and files
    const { notes, images, files } = get();
    
    Promise.all([
      ...notes.map(note => deleteNoteFromFirebase(userId, note.id)),
      ...images.map(image => deleteImageFromFirebase(userId, image.id)),
      ...files.map(file => deleteFileFromFirebase(userId, file.id)),
    ])
      .then(() => {
        // All deletions will be reflected via the Firebase listeners
      })
      .catch((error) => {
        set({ syncError: error as Error });
      })
      .finally(() => {
        set({ isSyncing: false });
      });
  },

  toggleDarkMode: () => {
    const newDarkMode = !get().isDarkMode;
    set({ isDarkMode: newDarkMode });
    
    const userId = get().currentUserId || auth.currentUser?.uid || null;
    if (userId) {
      saveSettings(userId, { isDarkMode: newDarkMode });
    }
  },

  setDarkMode: (isDark: boolean) => {
    set({ isDarkMode: isDark });
    
    const userId = get().currentUserId || auth.currentUser?.uid || null;
    if (userId) {
      saveSettings(userId, { isDarkMode: isDark });
    }
  },

  // Firebase sync - 최적화: 4개 리스너 → 1개 통합 리스너 (75% 연결 감소)
  // + IndexedDB 캐싱으로 Firebase 대역폭 70% 절감
  initializeFirebaseSync: (userId: string) => {
    // Clean up existing subscriptions
    get().cleanupFirebaseSync();

    // Reset readiness flags
    set({ currentUserId: userId, notesReady: false, imagesReady: false, filesReady: false, settingsReady: false, remoteReady: false });

    // 1단계: IndexedDB 캐시 우선 로드 (가장 빠름, 용량 제한 없음)
    const loadCache = async () => {
      try {
        if (indexedDBManager.isAvailable()) {
          const cached = await indexedDBManager.getAllUserData(userId);
          if (cached && (cached.notes.length > 0 || cached.images.length > 0 || cached.files.length > 0)) {
            console.log('📦 IndexedDB cache loaded:', {
              notes: cached.notes.length,
              images: cached.images.length,
              files: cached.files.length,
            });
            set({
              notes: cached.notes,
              images: cached.images,
              files: cached.files,
              ...(cached.settings?.isDarkMode !== undefined ? { isDarkMode: cached.settings.isDarkMode } : {}),
            });
            return true;
          }
        }
      } catch (e) {
        console.warn('IndexedDB cache load failed:', e);
      }

      // 2단계: localStorage 폴백 (IndexedDB 실패 시)
      try {
        const cacheKey = `remoteCache:${userId}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          const cachedNotes: Note[] = Array.isArray(parsed.notes)
            ? parsed.notes.map((n: any) => ({ ...n, createdAt: new Date(n.createdAt), updatedAt: new Date(n.updatedAt) }))
            : [];
          const cachedImages: CanvasImage[] = Array.isArray(parsed.images)
            ? parsed.images.map((img: any) => ({ ...img, createdAt: new Date(img.createdAt) }))
            : [];
          const cachedFiles: CanvasFile[] = Array.isArray(parsed.files)
            ? parsed.files.map((f: any) => ({ ...f, createdAt: new Date(f.createdAt) }))
            : [];
          const cachedDark = typeof parsed.isDarkMode === 'boolean' ? parsed.isDarkMode : undefined;
          set({
            notes: cachedNotes,
            images: cachedImages,
            files: cachedFiles,
            ...(cachedDark !== undefined ? { isDarkMode: cachedDark } : {}),
          });
          console.log('📦 localStorage fallback cache loaded');
          return true;
        }
      } catch (e) {
        console.warn('localStorage cache load failed:', e);
      }
      return false;
    };

    // 캐시 로드 시작 (비동기)
    loadCache();

    // 통합 구독: 1개의 리스너로 모든 데이터 수신 (연결 75% 감소)
    const unsubscriber = subscribeToUserData(userId, (userData: UserData) => {
      const { notes: firebaseNotes, images: firebaseImages, files: firebaseFiles, settings } = userData;

      // Process notes
      const notes = Object.entries(firebaseNotes).map(([id, note]) => ({
        ...firebaseNoteToLocal(note),
        id,
      }));

      // Process images
      const shouldMigrateImages = get().imagesReady === false;
      const images = Object.entries(firebaseImages).map(([id, image]) => ({
        ...firebaseImageToLocal(image),
        id,
      }));

      if (shouldMigrateImages && Object.keys(firebaseImages).length > 0) {
        setTimeout(() => {
          migrationManager.migrateImages(userId, firebaseImages).catch(err => {
            console.error('Image migration error:', err);
          });
        }, 2000);
      }

      // Process files
      const shouldMigrateFiles = get().filesReady === false;
      const files = Object.entries(firebaseFiles).map(([id, file]) => ({
        ...firebaseFileToLocal(file),
        id,
      }));

      if (shouldMigrateFiles && Object.keys(firebaseFiles).length > 0) {
        setTimeout(() => {
          migrationManager.migrateFiles(userId, firebaseFiles).catch(err => {
            console.error('File migration error:', err);
          });
        }, 2000);
      }

      const nextIsDarkMode =
        settings?.isDarkMode !== undefined ? settings.isDarkMode : get().isDarkMode;

      // Update state
      set((state) => ({
        ...state,
        notes,
        images,
        files,
        notesReady: true,
        imagesReady: true,
        filesReady: true,
        settingsReady: true,
        remoteReady: true,
        ...(settings?.isDarkMode !== undefined ? { isDarkMode: settings.isDarkMode } : {}),
      }));

      // 캐시 저장은 디바운스/스로틀 처리해서 배터리/디스크 I/O를 줄인다.
      scheduleCacheWrite(userId, { notes, images, files, isDarkMode: nextIsDarkMode });
    });

    set({ unsubscribers: [unsubscriber] });
  },

  cleanupFirebaseSync: () => {
    const { unsubscribers } = get();
    unsubscribers.forEach(unsubscribe => unsubscribe());
    cancelScheduledCacheWrite();
    set({ currentUserId: null, unsubscribers: [], notesReady: false, imagesReady: false, filesReady: false, settingsReady: false, remoteReady: false });
  },
  
  // These will be provided by the undoable middleware
  undo: () => {},
  redo: () => {},
    })
  )
);
