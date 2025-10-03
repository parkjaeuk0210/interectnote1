import { StateCreator } from 'zustand';
import { Note, CanvasImage, CanvasFile, Viewport, NoteColor, PDFAnnotation } from '../../types';
import { BaseCanvasStore, StorageAdapter } from '../types/store.types';

const defaultColors: NoteColor[] = ['yellow', 'pink', 'blue', 'green', 'purple', 'orange'];

/**
 * 통합 캔버스 스토어 생성 팩토리
 * StorageAdapter 패턴을 사용하여 저장소 구현을 추상화
 */
export const createCanvasStoreCore = (
  adapter: StorageAdapter
): StateCreator<BaseCanvasStore, [], []> => {
  return (set, get) => ({
    // Initial state
    notes: [],
    images: [],
    files: [],
    viewport: { x: 0, y: 0, scale: 1 },
    selectedNoteId: null,
    selectedImageId: null,
    selectedFileId: null,
    isDarkMode: false,

    // ==================== NOTE ACTIONS ====================
    addNote: async (x: number, y: number) => {
      const state = get();
      const maxZIndex = Math.max(...state.notes.map(n => n.zIndex || 0), 0);

      const newNote: Omit<Note, 'id'> = {
        x,
        y,
        width: 260,
        height: 180,
        content: '',
        color: defaultColors[Math.floor(Math.random() * defaultColors.length)],
        zIndex: maxZIndex + 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      try {
        const newId = await adapter.saveNote(newNote);

        // Optimistic update
        set((s) => ({
          notes: [
            ...s.notes,
            {
              ...newNote,
              id: newId,
            },
          ],
          selectedNoteId: newId,
          selectedImageId: null,
          selectedFileId: null,
        }));
      } catch (error) {
        console.error('Failed to add note:', error);
      }
    },

    updateNote: async (id: string, updates: Partial<Note>) => {
      // Optimistic update
      set((state) => ({
        notes: state.notes.map((note) =>
          note.id === id
            ? { ...note, ...updates, updatedAt: new Date() }
            : note
        ),
      }));

      try {
        await adapter.updateNote(id, { ...updates, updatedAt: new Date() });
      } catch (error) {
        console.error('Failed to update note:', error);
        // In case of error, the subscription will restore the correct state
      }
    },

    deleteNote: async (id: string) => {
      console.log('[CanvasStore] deleteNote called for:', id);

      // Optimistic delete
      set((state) => ({
        notes: state.notes.filter((note) => note.id !== id),
        selectedNoteId: state.selectedNoteId === id ? null : state.selectedNoteId,
      }));

      try {
        await adapter.deleteNote(id);
      } catch (error) {
        console.error('Failed to delete note:', error);
      }
    },

    selectNote: async (id: string | null) => {
      const state = get();

      if (id) {
        const maxZIndex = Math.max(...state.notes.map(n => n.zIndex || 0), 0);
        const noteToUpdate = state.notes.find(n => n.id === id);

        if (noteToUpdate) {
          const updatedNotes = state.notes.map(note =>
            note.id === id
              ? { ...note, zIndex: maxZIndex + 1 }
              : note
          );

          set({
            notes: updatedNotes,
            selectedNoteId: id,
            selectedImageId: null,
            selectedFileId: null,
          });

          // Update zIndex in storage
          try {
            await adapter.updateNote(id, { zIndex: maxZIndex + 1 });
          } catch (error) {
            console.error('Failed to update note zIndex:', error);
          }
        }
      } else {
        set({ selectedNoteId: id, selectedImageId: null, selectedFileId: null });
      }
    },

    // ==================== IMAGE ACTIONS ====================
    addImage: async (image: Omit<CanvasImage, 'id' | 'createdAt'>) => {
      try {
        const newId = await adapter.saveImage(image);

        const newImage: CanvasImage = {
          ...image,
          id: newId,
          createdAt: new Date(),
        };

        set((state) => ({
          images: [...state.images, newImage],
          selectedImageId: newId,
          selectedNoteId: null,
          selectedFileId: null,
        }));
      } catch (error) {
        console.error('Failed to add image:', error);
      }
    },

    updateImage: async (id: string, updates: Partial<CanvasImage>) => {
      set((state) => ({
        images: state.images.map((image) =>
          image.id === id ? { ...image, ...updates } : image
        ),
      }));

      try {
        await adapter.updateImage(id, updates);
      } catch (error) {
        console.error('Failed to update image:', error);
      }
    },

    deleteImage: async (id: string) => {
      set((state) => ({
        images: state.images.filter((image) => image.id !== id),
        selectedImageId: state.selectedImageId === id ? null : state.selectedImageId,
      }));

      try {
        await adapter.deleteImage(id);
      } catch (error) {
        console.error('Failed to delete image:', error);
      }
    },

    selectImage: (id: string | null) => {
      set({ selectedImageId: id, selectedNoteId: null, selectedFileId: null });
    },

    // ==================== FILE ACTIONS ====================
    addFile: async (file: Omit<CanvasFile, 'id' | 'createdAt'>) => {
      try {
        const newId = await adapter.saveFile(file);

        const newFile: CanvasFile = {
          ...file,
          id: newId,
          createdAt: new Date(),
        };

        set((state) => ({
          files: [...state.files, newFile],
          selectedFileId: newId,
          selectedNoteId: null,
          selectedImageId: null,
        }));
      } catch (error) {
        console.error('Failed to add file:', error);
      }
    },

    updateFile: async (id: string, updates: Partial<CanvasFile>) => {
      set((state) => ({
        files: state.files.map((file) =>
          file.id === id ? { ...file, ...updates } : file
        ),
      }));

      try {
        await adapter.updateFile(id, updates);
      } catch (error) {
        console.error('Failed to update file:', error);
      }
    },

    deleteFile: async (id: string) => {
      set((state) => ({
        files: state.files.filter((file) => file.id !== id),
        selectedFileId: state.selectedFileId === id ? null : state.selectedFileId,
      }));

      try {
        await adapter.deleteFile(id);
      } catch (error) {
        console.error('Failed to delete file:', error);
      }
    },

    selectFile: (id: string | null) => {
      set({ selectedFileId: id, selectedNoteId: null, selectedImageId: null });
    },

    // ==================== PDF ANNOTATION ACTIONS ====================
    addPDFAnnotation: async (fileId: string, annotation: PDFAnnotation) => {
      set((state) => ({
        files: state.files.map((file) => {
          if (file.id === fileId && file.fileType === 'pdf') {
            const currentAnnotations = file.pdfData?.annotations || [];
            return {
              ...file,
              pdfData: {
                numPages: file.pdfData?.numPages || 1,
                pageSize: file.pdfData?.pageSize || { width: file.width, height: file.height },
                annotations: [...currentAnnotations, annotation]
              }
            };
          }
          return file;
        })
      }));

      // Update in storage
      const file = get().files.find(f => f.id === fileId);
      if (file) {
        try {
          await adapter.updateFile(fileId, { pdfData: file.pdfData });
        } catch (error) {
          console.error('Failed to save PDF annotation:', error);
        }
      }
    },

    updatePDFAnnotation: async (fileId: string, annotationId: string, updates: Partial<PDFAnnotation>) => {
      set((state) => ({
        files: state.files.map((file) => {
          if (file.id === fileId && file.fileType === 'pdf' && file.pdfData) {
            return {
              ...file,
              pdfData: {
                ...file.pdfData,
                annotations: file.pdfData.annotations.map(ann =>
                  ann.id === annotationId ? { ...ann, ...updates } : ann
                )
              }
            };
          }
          return file;
        })
      }));

      const file = get().files.find(f => f.id === fileId);
      if (file) {
        try {
          await adapter.updateFile(fileId, { pdfData: file.pdfData });
        } catch (error) {
          console.error('Failed to update PDF annotation:', error);
        }
      }
    },

    deletePDFAnnotation: async (fileId: string, annotationId: string) => {
      set((state) => ({
        files: state.files.map((file) => {
          if (file.id === fileId && file.fileType === 'pdf' && file.pdfData) {
            return {
              ...file,
              pdfData: {
                ...file.pdfData,
                annotations: file.pdfData.annotations.filter(ann => ann.id !== annotationId)
              }
            };
          }
          return file;
        })
      }));

      const file = get().files.find(f => f.id === fileId);
      if (file) {
        try {
          await adapter.updateFile(fileId, { pdfData: file.pdfData });
        } catch (error) {
          console.error('Failed to delete PDF annotation:', error);
        }
      }
    },

    setPDFDrawingMode: (fileId: string, isDrawing: boolean) => {
      set((state) => ({
        files: state.files.map((file) =>
          file.id === fileId ? { ...file, isDrawingMode: isDrawing } : file
        )
      }));
    },

    // ==================== VIEWPORT ACTIONS ====================
    setViewport: async (viewport: Viewport) => {
      set({ viewport });

      try {
        await adapter.saveSettings({ viewport });
      } catch (error) {
        console.error('Failed to save viewport:', error);
      }
    },

    // ==================== CANVAS ACTIONS ====================
    clearCanvas: async () => {
      const { notes, images, files } = get();

      set({
        notes: [],
        images: [],
        files: [],
        viewport: { x: 0, y: 0, scale: 1 },
        selectedNoteId: null,
        selectedImageId: null,
        selectedFileId: null,
      });

      try {
        await Promise.all([
          ...notes.map(note => adapter.deleteNote(note.id)),
          ...images.map(image => adapter.deleteImage(image.id)),
          ...files.map(file => adapter.deleteFile(file.id)),
        ]);
      } catch (error) {
        console.error('Failed to clear canvas:', error);
      }
    },

    toggleDarkMode: async () => {
      const newDarkMode = !get().isDarkMode;
      set({ isDarkMode: newDarkMode });

      try {
        await adapter.saveSettings({ isDarkMode: newDarkMode });
      } catch (error) {
        console.error('Failed to save dark mode setting:', error);
      }
    },

    setDarkMode: async (isDark: boolean) => {
      set({ isDarkMode: isDark });

      try {
        await adapter.saveSettings({ isDarkMode: isDark });
      } catch (error) {
        console.error('Failed to save dark mode setting:', error);
      }
    },

    // ==================== UNDO/REDO ====================
    // These will be provided by the undoable middleware
    undo: () => {},
    redo: () => {},
  });
};
