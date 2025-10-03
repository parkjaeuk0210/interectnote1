import { create } from 'zustand';
import { undoable } from './middleware/undoable';
import { createCanvasStoreCore } from './core/createCanvasStore';
import { FirebaseStorageAdapter } from './adapters/FirebaseStorageAdapter';
import { BaseCanvasStore } from './types/store.types';

/**
 * 통합 Firebase 캔버스 스토어
 * 기존 firebaseCanvasStore.ts를 대체하는 새로운 아키텍처
 */

// Extended store with Firebase-specific state
export interface UnifiedFirebaseStore extends BaseCanvasStore {
  // Firebase sync state
  isSyncing: boolean;
  syncError: Error | null;
  currentUserId: string | null;
  notesReady: boolean;
  imagesReady: boolean;
  filesReady: boolean;
  settingsReady: boolean;
  remoteReady: boolean;

  // Firebase-specific actions
  initializeFirebaseSync: (userId: string) => void;
  cleanupFirebaseSync: () => void;
}

let firebaseAdapter: FirebaseStorageAdapter | null = null;

export const useUnifiedFirebaseStore = create<UnifiedFirebaseStore>()(
  undoable(
    (set, get) => {
      // Create base store without adapter initially
      const baseStore = createCanvasStoreCore(
        // Dummy adapter that will be replaced
        {
          saveNote: async () => '',
          updateNote: async () => {},
          deleteNote: async () => {},
          getNotes: async () => [],
          saveImage: async () => '',
          updateImage: async () => {},
          deleteImage: async () => {},
          getImages: async () => [],
          saveFile: async () => '',
          updateFile: async () => {},
          deleteFile: async () => {},
          getFiles: async () => [],
          saveSettings: async () => {},
          getSettings: async () => ({}),
        }
      )(set, get, null as any);

      return {
        ...baseStore,
        // Firebase-specific state
        isSyncing: false,
        syncError: null,
        currentUserId: null,
        notesReady: false,
        imagesReady: false,
        filesReady: false,
        settingsReady: false,
        remoteReady: false,

        // Initialize Firebase sync
        initializeFirebaseSync: (userId: string) => {
          // Cleanup existing adapter
          if (firebaseAdapter) {
            firebaseAdapter.cleanup();
          }

          // Create new adapter
          firebaseAdapter = new FirebaseStorageAdapter(userId);

          set({
            currentUserId: userId,
            notesReady: false,
            imagesReady: false,
            filesReady: false,
            settingsReady: false,
            remoteReady: false,
          });

          // Load cached data from localStorage
          try {
            const cacheKey = `remoteCache:${userId}`;
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
              const parsed = JSON.parse(cached);
              const cachedNotes = Array.isArray(parsed.notes)
                ? parsed.notes.map((n: any) => ({
                    ...n,
                    createdAt: new Date(n.createdAt),
                    updatedAt: new Date(n.updatedAt),
                  }))
                : [];
              const cachedImages = Array.isArray(parsed.images)
                ? parsed.images.map((img: any) => ({
                    ...img,
                    createdAt: new Date(img.createdAt),
                  }))
                : [];
              const cachedFiles = Array.isArray(parsed.files)
                ? parsed.files.map((f: any) => ({
                    ...f,
                    createdAt: new Date(f.createdAt),
                  }))
                : [];
              const cachedDark =
                typeof parsed.isDarkMode === 'boolean'
                  ? parsed.isDarkMode
                  : undefined;

              set({
                notes: cachedNotes,
                images: cachedImages,
                files: cachedFiles,
                ...(cachedDark !== undefined ? { isDarkMode: cachedDark } : {}),
              });
            }
          } catch (e) {
            console.warn('Failed to load remote cache:', e);
          }

          // Subscribe to Firebase changes
          if (firebaseAdapter) {
            firebaseAdapter.subscribeToChanges((data) => {
              set((state) => {
                const updates: Partial<UnifiedFirebaseStore> = {};

                if (data.notes) {
                  updates.notes = data.notes;
                  updates.notesReady = true;
                }
                if (data.images) {
                  updates.images = data.images;
                  updates.imagesReady = true;
                }
                if (data.files) {
                  updates.files = data.files;
                  updates.filesReady = true;
                }
                if (data.settings) {
                  if (data.settings.isDarkMode !== undefined) {
                    updates.isDarkMode = data.settings.isDarkMode;
                  }
                  updates.settingsReady = true;
                }

                // Calculate remoteReady
                const newState = { ...state, ...updates };
                const remoteReady =
                  (newState.notesReady ?? state.notesReady) &&
                  (newState.imagesReady ?? state.imagesReady) &&
                  (newState.filesReady ?? state.filesReady) &&
                  (newState.settingsReady ?? state.settingsReady);

                updates.remoteReady = remoteReady;

                // Cache to localStorage
                try {
                  const cache = {
                    version: 1,
                    updatedAt: Date.now(),
                    notes: (newState.notes ?? state.notes).map((n) => ({
                      ...n,
                      createdAt: n.createdAt.getTime(),
                      updatedAt: n.updatedAt.getTime(),
                    })),
                    images: (newState.images ?? state.images).map((img) => ({
                      ...img,
                      createdAt: img.createdAt.getTime(),
                    })),
                    files: (newState.files ?? state.files).map((f) => ({
                      ...f,
                      createdAt: f.createdAt.getTime(),
                    })),
                    isDarkMode: newState.isDarkMode ?? state.isDarkMode,
                  };
                  localStorage.setItem(`remoteCache:${userId}`, JSON.stringify(cache));
                } catch (e) {
                  console.warn('Failed to cache remote data:', e);
                }

                return updates;
              });
            });
          }
        },

        // Cleanup Firebase sync
        cleanupFirebaseSync: () => {
          if (firebaseAdapter) {
            firebaseAdapter.cleanup();
            firebaseAdapter = null;
          }

          set({
            currentUserId: null,
            notesReady: false,
            imagesReady: false,
            filesReady: false,
            settingsReady: false,
            remoteReady: false,
          });
        },
      };
    }
  )
);
