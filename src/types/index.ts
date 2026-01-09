export interface Note {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  color: NoteColor;
  zIndex?: number;
  isImportant?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type NoteColor = 'yellow' | 'pink' | 'blue' | 'green' | 'purple' | 'orange';

export interface Viewport {
  x: number;
  y: number;
  scale: number;
}

export interface CanvasState {
  notes: Note[];
  viewport: Viewport;
  selectedNoteId: string | null;
}

export type FileType = 'image' | 'pdf' | 'document' | 'other';

// PDF Annotation Types
export type DrawingTool = 'pen' | 'highlighter' | 'eraser' | 'none';

export interface Point {
  x: number;
  y: number;
  pressure: number;
  inputType?: 'mouse' | 'touch' | 'pen';
}

export interface DrawingStroke {
  points: Point[];
  style: DrawingStyle;
  timestamp: number;
}

export interface DrawingStyle {
  stroke: string;
  strokeWidth: number;
  opacity?: number;
  globalCompositeOperation?: string;
}

export interface PDFAnnotation {
  id: string;
  type: 'highlight' | 'text' | 'draw';
  page: number;
  position: { x: number; y: number };
  content?: string;
  author: string;
  createdAt: Date;
}

export interface DrawingAnnotation extends PDFAnnotation {
  type: 'draw';
  strokes: DrawingStroke[];
}

export interface CanvasFile {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fileName: string;
  fileType: FileType;
  fileSize: number;
  url: string;
  thumbnailUrl?: string;
  createdAt: Date;
  // PDF-specific properties
  pdfData?: {
    numPages: number;
    pageSize: { width: number; height: number };
    annotations: PDFAnnotation[];
  };
  editMode?: 'view' | 'annotate';
  isDrawingMode?: boolean;
}

export interface CanvasImage {
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
  createdAt: Date;
}
