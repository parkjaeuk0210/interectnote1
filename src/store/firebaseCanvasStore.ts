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
  subscribeToNotes,
  subscribeToImages,
  subscribeToFiles,
  subscribeToSettings
} from '../lib/database';
import { Note, CanvasImage, CanvasFile, Viewport, NoteColor } from '../types';
import { FirebaseNote, FirebaseImage, FirebaseFile } from '../types/firebase';
import { auth } from '../lib/firebase';
import { migrationManager } from '../lib/migrationManager';
import { useCanvasStore } from './canvasStore';

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
    console.log('[FirebaseStore] deleteNote called for:', id);
    const userId = get().currentUserId || auth.currentUser?.uid || null;
    console.log('[FirebaseStore] Current userId:', userId);
    
    if (!userId) {
      console.log('[FirebaseStore] No user, falling back to local delete');
      useCanvasStore.getState().deleteNote(id);
      return;
    }

    set({ isSyncing: true });
    console.log('[FirebaseStore] Calling deleteNoteFromFirebase...');
    // Optimistically remove from local state
    set((s) => ({
      notes: s.notes.filter((n) => n.id !== id),
      selectedNoteId: s.selectedNoteId === id ? null : s.selectedNoteId,
    }));

    deleteNoteFromFirebase(userId, id)
      .then(() => {
        console.log('[FirebaseStore] Delete successful, waiting for listener update');
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
        
        // Then update Firebase
        updateNoteInFirebase(userId, id, { zIndex: maxZIndex + 1 })
          .catch((error) => {
            console.error('Failed to update note zIndex:', error);
          });
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

  // Firebase sync
  initializeFirebaseSync: (userId: string) => {
    // Clean up existing subscriptions
    get().cleanupFirebaseSync();

    const unsubscribers: (() => void)[] = [];

    // Reset readiness flags
    set({ currentUserId: userId, notesReady: false, imagesReady: false, filesReady: false, settingsReady: false, remoteReady: false });

    // Load cached remote snapshot for immediate UX (if present)
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
          // Don't set remoteReady to true here - let it be set when Firebase data arrives
        });
      }
    } catch (e) {
      console.warn('Failed to load remote cache:', e);
    }

    // Subscribe to notes
    unsubscribers.push(
      subscribeToNotes(userId, (firebaseNotes) => {
        console.log('[FirebaseStore] Notes listener fired, received:', Object.keys(firebaseNotes).length, 'notes');
        const notes = Object.entries(firebaseNotes).map(([id, note]) => ({
          ...firebaseNoteToLocal(note),
          id,
        }));
        set((state) => {
          const next = { ...state, notes, notesReady: true } as FirebaseCanvasStore;
          try {
            const cache = {
              version: 1,
              updatedAt: Date.now(),
              notes: next.notes.map(n => ({ ...n, createdAt: n.createdAt.getTime(), updatedAt: n.updatedAt.getTime() })),
              images: next.images.map(img => ({ ...img, createdAt: img.createdAt.getTime() })),
              files: next.files.map(f => ({ ...f, createdAt: f.createdAt.getTime() })),
              isDarkMode: next.isDarkMode,
            };
            localStorage.setItem(`remoteCache:${userId}`, JSON.stringify(cache));
          } catch {}
          const remoteReady = next.notesReady && next.imagesReady && next.filesReady && next.settingsReady;
          return { ...next, remoteReady };
        });
      })
    );

    // Subscribe to images
    unsubscribers.push(
      subscribeToImages(userId, (firebaseImages) => {
        // Only trigger migration once after initial load
        const shouldMigrate = get().imagesReady === false;
        
        const images = Object.entries(firebaseImages).map(([id, image]) => ({
          ...firebaseImageToLocal(image),
          id,
        }));
        
        // Trigger migration asynchronously without blocking UI
        if (shouldMigrate && Object.keys(firebaseImages).length > 0) {
          setTimeout(() => {
            migrationManager.migrateImages(userId, firebaseImages).catch(err => {
              console.error('Image migration error:', err);
            });
          }, 2000); // Delay migration to not interfere with initial load
        }
        
        set((state) => {
          const next = { ...state, images, imagesReady: true } as FirebaseCanvasStore;
          try {
            const cache = {
              version: 1,
              updatedAt: Date.now(),
              notes: next.notes.map(n => ({ ...n, createdAt: n.createdAt.getTime(), updatedAt: n.updatedAt.getTime() })),
              images: next.images.map(img => ({ ...img, createdAt: img.createdAt.getTime() })),
              files: next.files.map(f => ({ ...f, createdAt: f.createdAt.getTime() })),
              isDarkMode: next.isDarkMode,
            };
            localStorage.setItem(`remoteCache:${userId}`, JSON.stringify(cache));
          } catch {}
          const remoteReady = next.notesReady && next.imagesReady && next.filesReady && next.settingsReady;
          return { ...next, remoteReady };
        });
      })
    );

    // Subscribe to files
    unsubscribers.push(
      subscribeToFiles(userId, (firebaseFiles) => {
        // Only trigger migration once after initial load
        const shouldMigrate = get().filesReady === false;
        
        const files = Object.entries(firebaseFiles).map(([id, file]) => ({
          ...firebaseFileToLocal(file),
          id,
        }));
        
        // Trigger migration asynchronously without blocking UI
        if (shouldMigrate && Object.keys(firebaseFiles).length > 0) {
          setTimeout(() => {
            migrationManager.migrateFiles(userId, firebaseFiles).catch(err => {
              console.error('File migration error:', err);
            });
          }, 2000); // Delay migration to not interfere with initial load
        }
        
        set((state) => {
          const next = { ...state, files, filesReady: true } as FirebaseCanvasStore;
          try {
            const cache = {
              version: 1,
              updatedAt: Date.now(),
              notes: next.notes.map(n => ({ ...n, createdAt: n.createdAt.getTime(), updatedAt: n.updatedAt.getTime() })),
              images: next.images.map(img => ({ ...img, createdAt: img.createdAt.getTime() })),
              files: next.files.map(f => ({ ...f, createdAt: f.createdAt.getTime() })),
              isDarkMode: next.isDarkMode,
            };
            localStorage.setItem(`remoteCache:${userId}`, JSON.stringify(cache));
          } catch {}
          const remoteReady = next.notesReady && next.imagesReady && next.filesReady && next.settingsReady;
          return { ...next, remoteReady };
        });
      })
    );

    // Subscribe to settings
    unsubscribers.push(
      subscribeToSettings(userId, (settings) => {
        if (settings.isDarkMode !== undefined) {
          set((state) => {
            const next = { ...state, isDarkMode: settings.isDarkMode, settingsReady: true } as FirebaseCanvasStore;
            try {
              const cache = {
                version: 1,
                updatedAt: Date.now(),
                notes: next.notes.map(n => ({ ...n, createdAt: n.createdAt.getTime(), updatedAt: n.updatedAt.getTime() })),
                images: next.images.map(img => ({ ...img, createdAt: img.createdAt.getTime() })),
                files: next.files.map(f => ({ ...f, createdAt: f.createdAt.getTime() })),
                isDarkMode: next.isDarkMode,
              };
              localStorage.setItem(`remoteCache:${userId}`, JSON.stringify(cache));
            } catch {}
            const remoteReady = next.notesReady && next.imagesReady && next.filesReady && next.settingsReady;
            return { ...next, remoteReady };
          });
        } else {
          // Even without specific settings, mark settings as ready
          set((state) => {
            const next = { ...state, settingsReady: true } as FirebaseCanvasStore;
            const remoteReady = next.notesReady && next.imagesReady && next.filesReady && next.settingsReady;
            return { ...next, remoteReady };
          });
        }
      })
    );

    set({ unsubscribers });
  },

  cleanupFirebaseSync: () => {
    const { unsubscribers } = get();
    unsubscribers.forEach(unsubscribe => unsubscribe());
    set({ currentUserId: null, unsubscribers: [], notesReady: false, imagesReady: false, filesReady: false, settingsReady: false, remoteReady: false });
  },
  
  // These will be provided by the undoable middleware
  undo: () => {},
  redo: () => {},
    })
  )
);
