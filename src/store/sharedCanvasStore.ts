import { create } from 'zustand';
import { undoable } from './middleware/undoable';
import { 
  saveSharedNote,
  updateSharedNote,
  deleteSharedNote,
  saveSharedImage,
  updateSharedImage,
  deleteSharedImage,
  saveSharedFile,
  updateSharedFile,
  deleteSharedFile,
  subscribeToSharedCanvas,
  subscribeToSharedNotes,
  subscribeToSharedImages,
  subscribeToSharedFiles,
  subscribeToPresence,
  updatePresence,
  cleanupPresenceSession,
  createSharedCanvas,
  generateShareLink,
  joinSharedCanvas,
  removeParticipant,
  updateParticipantRole
} from '../lib/sharedCanvas';
import { Note, CanvasImage, CanvasFile, Viewport, NoteColor } from '../types';
import { FirebaseNote, FirebaseImage, FirebaseFile } from '../types/firebase';
import { SharedCanvas, CanvasParticipant, PresenceData, ParticipantRole } from '../types/sharing';
import { auth } from '../lib/firebase';

export interface SharedCanvasStore {
  // Canvas info
  canvasId: string | null;
  canvasInfo: SharedCanvas | null;
  isOwner: boolean;
  userRole: ParticipantRole | null;
  
  // Canvas items
  notes: Note[];
  images: CanvasImage[];
  files: CanvasFile[];
  viewport: Viewport;
  
  // Selection state
  selectedNoteId: string | null;
  selectedImageId: string | null;
  selectedFileId: string | null;
  
  // Dark mode
  isDarkMode: boolean;
  selectToMoveMode: boolean;
  
  // Collaboration state
  participants: Record<string, CanvasParticipant>;
  presence: Record<string, PresenceData>;
  
  // Sync state
  isSyncing: boolean;
  syncError: Error | null;
  unsubscribers: (() => void)[];
  
  // Canvas management
  createCanvas: (name: string) => Promise<string>;
  joinCanvas: (token: string, customDisplayName?: string) => Promise<string>;
  leaveCanvas: () => void;
  
  // Share management
  generateShareLink: (role?: ParticipantRole, expiresInHours?: number) => Promise<string>;
  removeParticipant: (participantId: string) => Promise<void>;
  updateParticipantRole: (participantId: string, role: ParticipantRole) => Promise<void>;
  
  // Note actions
  addNote: (x: number, y: number) => void;
  updateNote: (id: string, updates: Partial<Note>) => void;
  deleteNote: (id: string) => void;
  selectNote: (id: string | null) => void;
  
  // Image actions
  addImage: (image: Omit<CanvasImage, 'id' | 'createdAt'>) => void;
  updateImage: (id: string, updates: Partial<CanvasImage>) => void;
  deleteImage: (id: string) => void;
  selectImage: (id: string | null) => void;
  
  // File actions
  addFile: (file: Omit<CanvasFile, 'id' | 'createdAt'>) => void;
  updateFile: (id: string, updates: Partial<CanvasFile>) => void;
  deleteFile: (id: string) => void;
  selectFile: (id: string | null) => void;
  
  // Viewport and presence
  setViewport: (viewport: Viewport) => void;
  updateCursorPosition: (x: number, y: number) => void;
  
  // Utility
  clearCanvas: () => void;
  toggleDarkMode: () => void;
  setDarkMode: (isDark: boolean) => void;
  toggleSelectToMoveMode: () => void;
  setSelectToMoveMode: (enabled: boolean) => void;
  initializeSharedCanvas: (canvasId: string) => void;
  cleanupSharedCanvas: () => void;
  
  // Undo/Redo
  undo: () => void;
  redo: () => void;
}

const defaultColors: NoteColor[] = ['yellow', 'pink', 'blue', 'green', 'purple', 'orange'];

// Helper functions
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
  width: 100,
  height: 100,
  createdAt: new Date(firebaseFile.createdAt),
});

export const useSharedCanvasStore = create<SharedCanvasStore>()(
  undoable(
    (set, get) => ({
      // Initial state
      canvasId: null,
      canvasInfo: null,
      isOwner: false,
      userRole: null,
      notes: [],
      images: [],
      files: [],
      viewport: { x: 0, y: 0, scale: 1 },
      selectedNoteId: null,
      selectedImageId: null,
      selectedFileId: null,
      isDarkMode: false,
      selectToMoveMode: false,
      participants: {},
      presence: {},
      isSyncing: false,
      syncError: null,
      unsubscribers: [],

      // Canvas management
      createCanvas: async (name: string) => {
        const user = auth.currentUser;
        if (!user) throw new Error('User not authenticated');

        set({ isSyncing: true });
        try {
          // Get current items from user's personal canvas
          const { notes, images, files } = get();
          const firebaseNotes = notes.map(note => ({
            ...note,
            createdAt: note.createdAt.getTime(),
            updatedAt: note.updatedAt.getTime(),
            userId: user.uid,
            deviceId: 'shared'
          }));
          
          const firebaseImages = images.map(image => ({
            ...image,
            createdAt: image.createdAt.getTime(),
            userId: user.uid,
            deviceId: 'shared',
            storagePath: ''
          }));
          
          const firebaseFiles = files.map(file => ({
            ...file,
            createdAt: file.createdAt.getTime(),
            userId: user.uid,
            deviceId: 'shared',
            storagePath: '',
            mimeType: file.fileType === 'pdf' ? 'application/pdf' : 'application/octet-stream'
          }));

          const canvasId = await createSharedCanvas(
            user.uid,
            user.email!,
            name,
            firebaseNotes,
            firebaseImages,
            firebaseFiles
          );
          
          get().initializeSharedCanvas(canvasId);
          return canvasId;
        } catch (error) {
          set({ syncError: error as Error });
          throw error;
        } finally {
          set({ isSyncing: false });
        }
      },

      joinCanvas: async (token: string, customDisplayName?: string) => {
        const user = auth.currentUser;
        if (!user) throw new Error('User not authenticated');

        set({ isSyncing: true });
        try {
          const canvasId = await joinSharedCanvas(
            token,
            user.uid,
            user.email || 'anonymous@interectnote.app',
            customDisplayName || user.displayName || undefined,
            user.photoURL || undefined
          );
          
          get().initializeSharedCanvas(canvasId);
          return canvasId;
        } catch (error) {
          set({ syncError: error as Error });
          throw error;
        } finally {
          set({ isSyncing: false });
        }
      },

      leaveCanvas: () => {
        get().cleanupSharedCanvas();
        set({
          canvasId: null,
          canvasInfo: null,
          isOwner: false,
          userRole: null,
          notes: [],
          images: [],
          files: [],
          participants: {},
          presence: {},
          selectedNoteId: null,
          selectedImageId: null,
          selectedFileId: null,
        });
      },

      // Share management
      generateShareLink: async (role: ParticipantRole = 'viewer', expiresInHours?: number) => {
        const { canvasId, isOwner } = get();
        const user = auth.currentUser;
        
        if (!canvasId || !user) throw new Error('No canvas or user');
        if (!isOwner) throw new Error('Only owner can generate share links');

        const token = await generateShareLink(canvasId, user.uid, role, expiresInHours);
        return `${window.location.origin}/share/${token}`;
      },

      removeParticipant: async (participantId: string) => {
        const { canvasId } = get();
        const user = auth.currentUser;
        
        if (!canvasId || !user) throw new Error('No canvas or user');
        
        await removeParticipant(canvasId, participantId, user.uid);
      },

      updateParticipantRole: async (participantId: string, role: ParticipantRole) => {
        const { canvasId } = get();
        const user = auth.currentUser;
        
        if (!canvasId || !user) throw new Error('No canvas or user');
        
        await updateParticipantRole(canvasId, participantId, role, user.uid);
      },

      // Note actions
      addNote: (x: number, y: number) => {
        const { canvasId, userRole, isOwner } = get();
        const user = auth.currentUser;
        
        if (!canvasId || !user || (!isOwner && userRole !== 'editor')) return;

        const state = get();
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
        saveSharedNote(canvasId, newNote, user.uid)
          .then((newId) => {
            // Optimistically add to local state for immediate feedback
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
          .catch((error) => set({ syncError: error as Error }))
          .finally(() => set({ isSyncing: false }));
      },

      updateNote: (id: string, updates: Partial<Note>) => {
        const { canvasId, userRole, isOwner } = get();
        const user = auth.currentUser;
        
        if (!canvasId || !user || (!isOwner && userRole !== 'editor')) return;

        // Optimistic update - immediately update local state
        set((state) => ({
          notes: state.notes.map((note) =>
            note.id === id
              ? { ...note, ...updates, updatedAt: new Date() }
              : note
          ),
        }));

        const firebaseUpdates: any = { ...updates };
        if (updates.createdAt) {
          firebaseUpdates.createdAt = updates.createdAt.getTime();
        }
        if (updates.updatedAt) {
          firebaseUpdates.updatedAt = updates.updatedAt.getTime();
        }

        set({ isSyncing: true });
        updateSharedNote(canvasId, id, firebaseUpdates)
          .catch((error) => {
            // On error, the Firebase listener will restore the correct state
            set({ syncError: error as Error });
          })
          .finally(() => set({ isSyncing: false }));
      },

      deleteNote: (id: string) => {
        const { canvasId, userRole, isOwner } = get();
        if (!canvasId || (!isOwner && userRole !== 'editor')) return;

        set({ isSyncing: true });
        // Optimistically remove locally
        set((s) => ({
          notes: s.notes.filter(n => n.id !== id),
          selectedNoteId: s.selectedNoteId === id ? null : s.selectedNoteId,
        }));

        deleteSharedNote(canvasId, id)
          .catch((error) => set({ syncError: error as Error }))
          .finally(() => set({ isSyncing: false }));
      },

      selectNote: (id: string | null) => {
        const { canvasId, userRole, isOwner } = get();
        const user = auth.currentUser;
        
        if (id && canvasId && user) {
          // Update presence with selected item
          updatePresence(canvasId, user.uid, { selectedItemId: id });
          
          // Update z-index if editor or owner
          if (isOwner || userRole === 'editor') {
            const state = get();
            const maxZIndex = Math.max(...state.notes.map(n => n.zIndex || 0), 0);
            
            const noteToUpdate = state.notes.find(n => n.id === id);
            if (noteToUpdate) {
              updateSharedNote(canvasId, id, { zIndex: maxZIndex + 1 })
                .catch((error) => console.error('Failed to update note zIndex:', error));
            }
          }
        }
        
        set({ selectedNoteId: id, selectedImageId: null, selectedFileId: null });
      },

      // Image actions
      addImage: (image: Omit<CanvasImage, 'id' | 'createdAt'>) => {
        const { canvasId, userRole, isOwner, images } = get();
        const user = auth.currentUser;
        
        if (!canvasId || !user || (!isOwner && userRole !== 'editor')) return;
        
        // Prevent spam: Limit total images on canvas
        const MAX_IMAGES_PER_CANVAS = 50;
        if (images.length >= MAX_IMAGES_PER_CANVAS) {
          alert(`최대 ${MAX_IMAGES_PER_CANVAS}개의 이미지만 추가할 수 있습니다.`);
          return;
        }

        const firebaseImage: Omit<FirebaseImage, 'id' | 'userId' | 'deviceId'> = {
          url: image.url,
          storagePath: '',
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
        saveSharedImage(canvasId, firebaseImage, user.uid)
          .catch((error) => set({ syncError: error as Error }))
          .finally(() => set({ isSyncing: false }));
      },

      updateImage: (id: string, updates: Partial<CanvasImage>) => {
        const { canvasId, userRole, isOwner } = get();
        if (!canvasId || (!isOwner && userRole !== 'editor')) return;

        const firebaseUpdates: any = { ...updates };
        if (updates.createdAt) {
          firebaseUpdates.createdAt = updates.createdAt.getTime();
        }

        set({ isSyncing: true });
        updateSharedImage(canvasId, id, firebaseUpdates)
          .catch((error) => set({ syncError: error as Error }))
          .finally(() => set({ isSyncing: false }));
      },

      deleteImage: (id: string) => {
        const { canvasId, userRole, isOwner } = get();
        if (!canvasId || (!isOwner && userRole !== 'editor')) return;

        set({ isSyncing: true });
        deleteSharedImage(canvasId, id)
          .catch((error) => set({ syncError: error as Error }))
          .finally(() => set({ isSyncing: false }));
      },

      selectImage: (id: string | null) => {
        const { canvasId } = get();
        const user = auth.currentUser;
        
        if (id && canvasId && user) {
          updatePresence(canvasId, user.uid, { selectedItemId: id });
        }
        
        set({ selectedImageId: id, selectedNoteId: null, selectedFileId: null });
      },

      // File actions
      addFile: (file: Omit<CanvasFile, 'id' | 'createdAt'>) => {
        const { canvasId, userRole, isOwner } = get();
        const user = auth.currentUser;
        
        if (!canvasId || !user || (!isOwner && userRole !== 'editor')) return;

        const firebaseFile: Omit<FirebaseFile, 'id' | 'userId' | 'deviceId'> = {
          url: file.url,
          storagePath: '',
          x: file.x,
          y: file.y,
          fileName: file.fileName,
          fileSize: file.fileSize,
          mimeType: file.fileType === 'pdf' ? 'application/pdf' : 'application/octet-stream',
          createdAt: Date.now(),
        };

        set({ isSyncing: true });
        saveSharedFile(canvasId, firebaseFile, user.uid)
          .catch((error) => set({ syncError: error as Error }))
          .finally(() => set({ isSyncing: false }));
      },

      updateFile: (id: string, updates: Partial<CanvasFile>) => {
        const { canvasId, userRole, isOwner } = get();
        if (!canvasId || (!isOwner && userRole !== 'editor')) return;

        const firebaseUpdates: any = { ...updates };
        if (updates.createdAt) {
          firebaseUpdates.createdAt = updates.createdAt.getTime();
        }

        set({ isSyncing: true });
        updateSharedFile(canvasId, id, firebaseUpdates)
          .catch((error) => set({ syncError: error as Error }))
          .finally(() => set({ isSyncing: false }));
      },

      deleteFile: (id: string) => {
        const { canvasId, userRole, isOwner } = get();
        if (!canvasId || (!isOwner && userRole !== 'editor')) return;

        set({ isSyncing: true });
        deleteSharedFile(canvasId, id)
          .catch((error) => set({ syncError: error as Error }))
          .finally(() => set({ isSyncing: false }));
      },

      selectFile: (id: string | null) => {
        const { canvasId } = get();
        const user = auth.currentUser;
        
        if (id && canvasId && user) {
          updatePresence(canvasId, user.uid, { selectedItemId: id });
        }
        
        set({ selectedFileId: id, selectedNoteId: null, selectedImageId: null });
      },

      // Viewport and presence
      setViewport: (viewport: Viewport) => {
        set({ viewport });
      },

      updateCursorPosition: (x: number, y: number) => {
        const { canvasId } = get();
        const user = auth.currentUser;
        
        if (canvasId && user) {
          updatePresence(canvasId, user.uid, { 
            cursorPosition: { x, y },
            isOnline: true 
          });
        }
      },

      // Utility
      clearCanvas: () => {
        const { canvasId, isOwner, userRole } = get();
        if (!canvasId || (!isOwner && userRole !== 'editor')) return;

        set({ isSyncing: true });
        const { notes, images, files } = get();
        
        Promise.all([
          ...notes.map(note => deleteSharedNote(canvasId, note.id)),
          ...images.map(image => deleteSharedImage(canvasId, image.id)),
          ...files.map(file => deleteSharedFile(canvasId, file.id)),
        ])
          .catch((error) => set({ syncError: error as Error }))
          .finally(() => set({ isSyncing: false }));
      },

      toggleDarkMode: () => {
        set((state) => ({ isDarkMode: !state.isDarkMode }));
      },

      setDarkMode: (isDark: boolean) => {
        set({ isDarkMode: isDark });
      },

      toggleSelectToMoveMode: () => {
        set((state) => ({ selectToMoveMode: !state.selectToMoveMode }));
      },

      setSelectToMoveMode: (enabled: boolean) => {
        set({ selectToMoveMode: enabled });
      },

      // Initialize shared canvas
      initializeSharedCanvas: (canvasId: string) => {
        const user = auth.currentUser;
        if (!user) return;

        get().cleanupSharedCanvas();

        const unsubscribers: (() => void)[] = [];

        // Subscribe to canvas info
        unsubscribers.push(
          subscribeToSharedCanvas(canvasId, (canvas) => {
            if (canvas) {
              const isOwner = canvas.owner === user.uid;
              const userRole = canvas.participants[user.uid]?.role || null;
              
              set({ 
                canvasInfo: canvas,
                isOwner,
                userRole,
                participants: canvas.participants
              });
            }
          })
        );

        // Subscribe to notes
        unsubscribers.push(
          subscribeToSharedNotes(canvasId, (firebaseNotes) => {
            const notes = Object.entries(firebaseNotes).map(([id, note]) => ({
              ...firebaseNoteToLocal(note),
              id,
            }));
            set({ notes });
          })
        );

        // Subscribe to images
        unsubscribers.push(
          subscribeToSharedImages(canvasId, (firebaseImages) => {
            const images = Object.entries(firebaseImages).map(([id, image]) => ({
              ...firebaseImageToLocal(image),
              id,
            }));
            set({ images });
          })
        );

        // Subscribe to files
        unsubscribers.push(
          subscribeToSharedFiles(canvasId, (firebaseFiles) => {
            const files = Object.entries(firebaseFiles).map(([id, file]) => ({
              ...firebaseFileToLocal(file),
              id,
            }));
            set({ files });
          })
        );

        // Subscribe to presence
        unsubscribers.push(
          subscribeToPresence(canvasId, (presence) => {
            set({ presence });
          })
        );

        // Set initial presence
        updatePresence(canvasId, user.uid, { isOnline: true });

        set({ canvasId, unsubscribers });
      },

      cleanupSharedCanvas: () => {
        const { canvasId, unsubscribers } = get();
        const user = auth.currentUser;
        unsubscribers.forEach(unsubscribe => unsubscribe());
        if (canvasId && user) {
          cleanupPresenceSession(canvasId, user.uid);
        }
        set({ unsubscribers: [] });
      },

      // Undo/Redo
      undo: () => {},
      redo: () => {},
    })
  )
);
