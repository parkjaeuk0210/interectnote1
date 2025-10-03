import { Note, CanvasImage, CanvasFile, Viewport, PDFAnnotation } from '../../types';

/**
 * 공통 캔버스 스토어 인터페이스
 * 모든 스토어 구현체가 따라야 하는 표준 인터페이스
 */
export interface BaseCanvasStore {
  // State
  notes: Note[];
  images: CanvasImage[];
  files: CanvasFile[];
  viewport: Viewport;
  selectedNoteId: string | null;
  selectedImageId: string | null;
  selectedFileId: string | null;
  isDarkMode: boolean;

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

  // PDF annotation actions
  addPDFAnnotation: (fileId: string, annotation: PDFAnnotation) => void;
  updatePDFAnnotation: (fileId: string, annotationId: string, updates: Partial<PDFAnnotation>) => void;
  deletePDFAnnotation: (fileId: string, annotationId: string) => void;
  setPDFDrawingMode: (fileId: string, isDrawing: boolean) => void;

  // Viewport actions
  setViewport: (viewport: Viewport) => void;

  // Canvas actions
  clearCanvas: () => void;
  toggleDarkMode: () => void;
  setDarkMode: (isDark: boolean) => void;

  // Undo/Redo
  undo: () => void;
  redo: () => void;
}

/**
 * Storage Adapter 인터페이스
 * 실제 데이터 저장/로드를 담당하는 추상화 레이어
 */
export interface StorageAdapter {
  // Note operations
  saveNote: (note: Omit<Note, 'id'>) => Promise<string>; // Returns generated ID
  updateNote: (id: string, updates: Partial<Note>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  getNotes: () => Promise<Note[]>;

  // Image operations
  saveImage: (image: Omit<CanvasImage, 'id' | 'createdAt'>) => Promise<string>;
  updateImage: (id: string, updates: Partial<CanvasImage>) => Promise<void>;
  deleteImage: (id: string) => Promise<void>;
  getImages: () => Promise<CanvasImage[]>;

  // File operations
  saveFile: (file: Omit<CanvasFile, 'id' | 'createdAt'>) => Promise<string>;
  updateFile: (id: string, updates: Partial<CanvasFile>) => Promise<void>;
  deleteFile: (id: string) => Promise<void>;
  getFiles: () => Promise<CanvasFile[]>;

  // Settings operations
  saveSettings: (settings: { isDarkMode?: boolean; viewport?: Viewport }) => Promise<void>;
  getSettings: () => Promise<{ isDarkMode?: boolean; viewport?: Viewport }>;

  // Subscription (for real-time updates)
  subscribeToChanges?: (callback: (data: {
    notes?: Note[];
    images?: CanvasImage[];
    files?: CanvasFile[];
    settings?: { isDarkMode?: boolean };
  }) => void) => () => void; // Returns unsubscribe function

  // Cleanup
  cleanup?: () => void;
}

/**
 * 스토어 옵션
 */
export interface StoreOptions {
  adapter: StorageAdapter;
  enableUndo?: boolean;
  undoLimit?: number;
  enableSync?: boolean;
}
