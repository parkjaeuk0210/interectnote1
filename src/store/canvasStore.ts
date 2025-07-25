import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { undoable } from './middleware/undoable';
import { Note, NoteColor, Viewport, CanvasImage, CanvasFile } from '../types';

export interface CanvasStore {
  notes: Note[];
  images: CanvasImage[];
  files: CanvasFile[];
  viewport: Viewport;
  selectedNoteId: string | null;
  selectedImageId: string | null;
  selectedFileId: string | null;
  isDarkMode: boolean;
  
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
  
  undo: () => void;
  redo: () => void;
}

const defaultColors: NoteColor[] = ['yellow', 'pink', 'blue', 'green', 'purple', 'orange'];

export const useCanvasStore = create<CanvasStore>()(
  persist(
    undoable(
      (set) => ({
      notes: [],
      images: [],
      files: [],
      viewport: { x: 0, y: 0, scale: 1 },
      selectedNoteId: null,
      selectedImageId: null,
      selectedFileId: null,
      isDarkMode: false,
      
      addNote: (x, y) => {
        const newNote: Note = {
          id: `note-${Date.now()}`,
          x,
          y,
          width: 260,
          height: 180,
          content: '',
          color: defaultColors[Math.floor(Math.random() * defaultColors.length)],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        
        set((state) => ({
          notes: [...state.notes, newNote],
          selectedNoteId: newNote.id,
          selectedImageId: null,
          selectedFileId: null,
        }));
      },
      
      updateNote: (id, updates) => {
        set((state) => ({
          notes: state.notes.map((note) =>
            note.id === id
              ? { ...note, ...updates, updatedAt: new Date() }
              : note
          ),
        }));
      },
      
      deleteNote: (id) => {
        set((state) => ({
          notes: state.notes.filter((note) => note.id !== id),
          selectedNoteId: state.selectedNoteId === id ? null : state.selectedNoteId,
        }));
      },
      
      selectNote: (id) => {
        set({ selectedNoteId: id, selectedImageId: null, selectedFileId: null });
      },
      
      addImage: (image) => {
        const newImage: CanvasImage = {
          ...image,
          id: `image-${Date.now()}`,
          createdAt: new Date(),
        };
        
        set((state) => {
          const newState = {
            images: [...state.images, newImage],
            selectedImageId: newImage.id,
            selectedNoteId: null,
            selectedFileId: null,
          };
          
          // Test if we can save to localStorage
          try {
            const testKey = 'interectnote-storage';
            const newData = JSON.stringify({ ...state, ...newState });
            
            localStorage.setItem(testKey, newData);
            
            // Success - return new state
            return newState;
          } catch (e) {
            console.error('Failed to save image to localStorage:', e);
            alert('저장 공간이 부족합니다. 일부 이미지를 삭제하고 다시 시도해주세요.');
            
            // Don't add the image if we can't save it
            return state;
          }
        });
      },
      
      updateImage: (id, updates) => {
        set((state) => ({
          images: state.images.map((image) =>
            image.id === id ? { ...image, ...updates } : image
          ),
        }));
      },
      
      deleteImage: (id) => {
        set((state) => ({
          images: state.images.filter((image) => image.id !== id),
          selectedImageId: state.selectedImageId === id ? null : state.selectedImageId,
        }));
      },
      
      selectImage: (id) => {
        set({ selectedImageId: id, selectedNoteId: null, selectedFileId: null });
      },
      
      addFile: (file) => {
        const newFile: CanvasFile = {
          ...file,
          id: `file-${Date.now()}`,
          createdAt: new Date(),
        };
        
        set((state) => {
          const newState = {
            files: [...state.files, newFile],
            selectedFileId: newFile.id,
            selectedNoteId: null,
            selectedImageId: null,
          };
          
          // Test if we can save to localStorage
          try {
            const testKey = 'interectnote-storage';
            const newData = JSON.stringify({ ...state, ...newState });
            
            localStorage.setItem(testKey, newData);
            
            // Success - return new state
            return newState;
          } catch (e) {
            console.error('Failed to save file to localStorage:', e);
            alert('저장 공간이 부족합니다. 일부 파일을 삭제하고 다시 시도해주세요.');
            
            // Don't add the file if we can't save it
            return state;
          }
        });
      },
      
      updateFile: (id, updates) => {
        set((state) => ({
          files: state.files.map((file) =>
            file.id === id ? { ...file, ...updates } : file
          ),
        }));
      },
      
      deleteFile: (id) => {
        set((state) => ({
          files: state.files.filter((file) => file.id !== id),
          selectedFileId: state.selectedFileId === id ? null : state.selectedFileId,
        }));
      },
      
      selectFile: (id) => {
        set({ selectedFileId: id, selectedNoteId: null, selectedImageId: null });
      },
      
      setViewport: (viewport) => {
        set({ viewport });
      },
      
      clearCanvas: () => {
        set({
          notes: [],
          images: [],
          files: [],
          viewport: { x: 0, y: 0, scale: 1 },
          selectedNoteId: null,
          selectedImageId: null,
          selectedFileId: null,
        });
      },
      
      toggleDarkMode: () => {
        set((state) => ({ isDarkMode: !state.isDarkMode }));
      },
      
      setDarkMode: (isDark) => {
        set({ isDarkMode: isDark });
      },
      
      // These will be provided by the undoable middleware
      undo: () => {},
      redo: () => {},
      })
    ),
    {
      name: 'interectnote-storage',
    }
  )
);