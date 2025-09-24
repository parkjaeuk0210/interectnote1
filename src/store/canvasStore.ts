import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { undoable } from './middleware/undoable';
import { toast } from '../utils/toast';
import { Note, NoteColor, Viewport, CanvasImage, CanvasFile, PDFAnnotation } from '../types';

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
  
  // PDF annotation actions
  addPDFAnnotation: (fileId: string, annotation: PDFAnnotation) => void;
  updatePDFAnnotation: (fileId: string, annotationId: string, updates: Partial<PDFAnnotation>) => void;
  deletePDFAnnotation: (fileId: string, annotationId: string) => void;
  setPDFDrawingMode: (fileId: string, isDrawing: boolean) => void;
  
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
          zIndex: 0, // Will be updated when added
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        
        set((state) => {
          // Get the maximum zIndex from all notes
          const maxZIndex = Math.max(...state.notes.map(n => n.zIndex || 0), 0);
          newNote.zIndex = maxZIndex + 1;
          
          return {
            notes: [...state.notes, newNote],
            selectedNoteId: newNote.id,
            selectedImageId: null,
            selectedFileId: null,
          };
        });
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
        console.log('[LocalStore] deleteNote called for:', id);
        set((state) => {
          const newNotes = state.notes.filter((note) => note.id !== id);
          console.log('[LocalStore] Notes before:', state.notes.length, 'after:', newNotes.length);
          return {
            notes: newNotes,
            selectedNoteId: state.selectedNoteId === id ? null : state.selectedNoteId,
          };
        });
      },
      
      selectNote: (id) => {
        set((state) => {
          if (id) {
            // Get the maximum zIndex from all notes
            const maxZIndex = Math.max(...state.notes.map(n => n.zIndex || 0), 0);
            
            // Update the selected note's zIndex to be on top
            const updatedNotes = state.notes.map(note =>
              note.id === id
                ? { ...note, zIndex: maxZIndex + 1 }
                : note
            );
            
            return {
              notes: updatedNotes,
              selectedNoteId: id,
              selectedImageId: null,
              selectedFileId: null
            };
          }
          
          return { selectedNoteId: id, selectedImageId: null, selectedFileId: null };
        });
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
            toast.error('저장 공간이 부족합니다. 일부 이미지를 삭제하고 다시 시도해주세요.');
            
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
            toast.error('저장 공간이 부족합니다. 일부 파일을 삭제하고 다시 시도해주세요.');
            
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
      
      // PDF annotation actions
      addPDFAnnotation: (fileId: string, annotation: PDFAnnotation) => {
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
      },
      
      updatePDFAnnotation: (fileId: string, annotationId: string, updates: Partial<PDFAnnotation>) => {
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
      },
      
      deletePDFAnnotation: (fileId: string, annotationId: string) => {
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
      },
      
      setPDFDrawingMode: (fileId: string, isDrawing: boolean) => {
        set((state) => ({
          files: state.files.map((file) => 
            file.id === fileId ? { ...file, isDrawingMode: isDrawing } : file
          )
        }));
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
