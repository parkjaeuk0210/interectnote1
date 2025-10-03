import { Note, CanvasImage, CanvasFile, Viewport, NoteColor } from '../../types';
import { StorageAdapter } from '../types/store.types';
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
  saveSettings as saveSettingsToFirebase,
  subscribeToNotes,
  subscribeToImages,
  subscribeToFiles,
  subscribeToSettings,
} from '../../lib/database';
import { FirebaseNote, FirebaseImage, FirebaseFile } from '../../types/firebase';

/**
 * Firebase 기반 Storage Adapter
 * Firebase Realtime Database를 사용하는 구현체
 */
export class FirebaseStorageAdapter implements StorageAdapter {
  private userId: string;
  private unsubscribers: (() => void)[] = [];
  private cache: {
    notes: Map<string, Note>;
    images: Map<string, CanvasImage>;
    files: Map<string, CanvasFile>;
    settings: { isDarkMode?: boolean; viewport?: Viewport };
  };

  constructor(userId: string) {
    this.userId = userId;
    this.cache = {
      notes: new Map(),
      images: new Map(),
      files: new Map(),
      settings: {},
    };
  }

  // ==================== CONVERTERS ====================
  private noteToFirebase(note: Omit<Note, 'id'>): Omit<FirebaseNote, 'id' | 'userId' | 'deviceId'> {
    return {
      content: note.content,
      x: note.x,
      y: note.y,
      width: note.width,
      height: note.height,
      color: note.color,
      zIndex: note.zIndex || 0,
      createdAt: note.createdAt.getTime(),
      updatedAt: note.updatedAt.getTime(),
    };
  }

  private firebaseToNote(firebaseNote: FirebaseNote, id: string): Note {
    return {
      id,
      content: firebaseNote.content,
      x: firebaseNote.x,
      y: firebaseNote.y,
      width: firebaseNote.width,
      height: firebaseNote.height,
      color: firebaseNote.color as NoteColor,
      zIndex: firebaseNote.zIndex || 0,
      createdAt: new Date(firebaseNote.createdAt),
      updatedAt: new Date(firebaseNote.updatedAt),
    };
  }

  private imageToFirebase(image: Omit<CanvasImage, 'id' | 'createdAt'>): Omit<FirebaseImage, 'id' | 'userId' | 'deviceId'> {
    return {
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
  }

  private firebaseToImage(firebaseImage: FirebaseImage, id: string): CanvasImage {
    return {
      id,
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
    };
  }

  private fileToFirebase(file: Omit<CanvasFile, 'id' | 'createdAt'>): Omit<FirebaseFile, 'id' | 'userId' | 'deviceId'> {
    return {
      url: file.url,
      storagePath: '',
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
  }

  private firebaseToFile(firebaseFile: FirebaseFile, id: string): CanvasFile {
    return {
      id,
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
    };
  }

  // ==================== NOTE OPERATIONS ====================
  async saveNote(note: Omit<Note, 'id'>): Promise<string> {
    const firebaseNote = this.noteToFirebase(note);
    const id = await saveNoteToFirebase(this.userId, firebaseNote);

    // Update cache
    if (id) {
      this.cache.notes.set(id, { ...note, id });
    }

    return id || '';
  }

  async updateNote(id: string, updates: Partial<Note>): Promise<void> {
    const firebaseUpdates: any = { ...updates };

    // Convert dates to timestamps
    if (updates.createdAt) {
      firebaseUpdates.createdAt = updates.createdAt.getTime();
    }
    if (updates.updatedAt) {
      firebaseUpdates.updatedAt = updates.updatedAt.getTime();
    }

    await updateNoteInFirebase(this.userId, id, firebaseUpdates);

    // Update cache
    const cached = this.cache.notes.get(id);
    if (cached) {
      this.cache.notes.set(id, { ...cached, ...updates });
    }
  }

  async deleteNote(id: string): Promise<void> {
    await deleteNoteFromFirebase(this.userId, id);
    this.cache.notes.delete(id);
  }

  async getNotes(): Promise<Note[]> {
    return Array.from(this.cache.notes.values());
  }

  // ==================== IMAGE OPERATIONS ====================
  async saveImage(image: Omit<CanvasImage, 'id' | 'createdAt'>): Promise<string> {
    const firebaseImage = this.imageToFirebase(image);
    const id = await saveImageToFirebase(this.userId, firebaseImage);

    // Update cache
    if (id) {
      this.cache.images.set(id, { ...image, id, createdAt: new Date() });
    }

    return id || '';
  }

  async updateImage(id: string, updates: Partial<CanvasImage>): Promise<void> {
    const firebaseUpdates: any = { ...updates };

    if (updates.createdAt) {
      firebaseUpdates.createdAt = updates.createdAt.getTime();
    }

    await updateImageInFirebase(this.userId, id, firebaseUpdates);

    // Update cache
    const cached = this.cache.images.get(id);
    if (cached) {
      this.cache.images.set(id, { ...cached, ...updates });
    }
  }

  async deleteImage(id: string): Promise<void> {
    await deleteImageFromFirebase(this.userId, id);
    this.cache.images.delete(id);
  }

  async getImages(): Promise<CanvasImage[]> {
    return Array.from(this.cache.images.values());
  }

  // ==================== FILE OPERATIONS ====================
  async saveFile(file: Omit<CanvasFile, 'id' | 'createdAt'>): Promise<string> {
    const firebaseFile = this.fileToFirebase(file);
    const id = await saveFileToFirebase(this.userId, firebaseFile);

    // Update cache
    if (id) {
      this.cache.files.set(id, { ...file, id, createdAt: new Date() });
    }

    return id || '';
  }

  async updateFile(id: string, updates: Partial<CanvasFile>): Promise<void> {
    const firebaseUpdates: any = { ...updates };

    if (updates.createdAt) {
      firebaseUpdates.createdAt = updates.createdAt.getTime();
    }

    await updateFileInFirebase(this.userId, id, firebaseUpdates);

    // Update cache
    const cached = this.cache.files.get(id);
    if (cached) {
      this.cache.files.set(id, { ...cached, ...updates });
    }
  }

  async deleteFile(id: string): Promise<void> {
    await deleteFileFromFirebase(this.userId, id);
    this.cache.files.delete(id);
  }

  async getFiles(): Promise<CanvasFile[]> {
    return Array.from(this.cache.files.values());
  }

  // ==================== SETTINGS OPERATIONS ====================
  async saveSettings(settings: { isDarkMode?: boolean; viewport?: Viewport }): Promise<void> {
    await saveSettingsToFirebase(this.userId, settings);
    this.cache.settings = { ...this.cache.settings, ...settings };
  }

  async getSettings(): Promise<{ isDarkMode?: boolean; viewport?: Viewport }> {
    return this.cache.settings;
  }

  // ==================== SUBSCRIPTION ====================
  subscribeToChanges(callback: (data: {
    notes?: Note[];
    images?: CanvasImage[];
    files?: CanvasFile[];
    settings?: { isDarkMode?: boolean };
  }) => void): () => void {
    // Subscribe to notes
    const unsubNotes = subscribeToNotes(this.userId, (firebaseNotes) => {
      const notes = Object.entries(firebaseNotes).map(([id, note]) =>
        this.firebaseToNote(note, id)
      );

      // Update cache
      this.cache.notes.clear();
      notes.forEach(note => this.cache.notes.set(note.id, note));

      callback({ notes });
    });

    // Subscribe to images
    const unsubImages = subscribeToImages(this.userId, (firebaseImages) => {
      const images = Object.entries(firebaseImages).map(([id, image]) =>
        this.firebaseToImage(image, id)
      );

      // Update cache
      this.cache.images.clear();
      images.forEach(image => this.cache.images.set(image.id, image));

      callback({ images });
    });

    // Subscribe to files
    const unsubFiles = subscribeToFiles(this.userId, (firebaseFiles) => {
      const files = Object.entries(firebaseFiles).map(([id, file]) =>
        this.firebaseToFile(file, id)
      );

      // Update cache
      this.cache.files.clear();
      files.forEach(file => this.cache.files.set(file.id, file));

      callback({ files });
    });

    // Subscribe to settings
    const unsubSettings = subscribeToSettings(this.userId, (settings) => {
      this.cache.settings = settings;
      callback({ settings });
    });

    // Store unsubscribers
    this.unsubscribers.push(unsubNotes, unsubImages, unsubFiles, unsubSettings);

    // Return combined unsubscribe function
    return () => {
      unsubNotes();
      unsubImages();
      unsubFiles();
      unsubSettings();
    };
  }

  // ==================== CLEANUP ====================
  cleanup(): void {
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];
    this.cache.notes.clear();
    this.cache.images.clear();
    this.cache.files.clear();
    this.cache.settings = {};
  }
}
