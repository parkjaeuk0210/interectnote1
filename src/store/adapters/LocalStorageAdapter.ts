import { Note, CanvasImage, CanvasFile, Viewport } from '../../types';
import { StorageAdapter } from '../types/store.types';
import { toast } from '../../utils/toast';

const STORAGE_KEY = 'interectnote-storage';

interface LocalStorageData {
  notes: Record<string, Note>;
  images: Record<string, CanvasImage>;
  files: Record<string, CanvasFile>;
  settings: {
    isDarkMode?: boolean;
    viewport?: Viewport;
  };
}

/**
 * LocalStorage 기반 Storage Adapter
 * 브라우저 로컬 저장소를 사용하는 구현체
 */
export class LocalStorageAdapter implements StorageAdapter {
  private storageKey: string;

  constructor(storageKey: string = STORAGE_KEY) {
    this.storageKey = storageKey;
  }

  // ==================== PRIVATE HELPERS ====================
  private getData(): LocalStorageData {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (!data) {
        return { notes: {}, images: {}, files: {}, settings: {} };
      }
      const parsed = JSON.parse(data);

      // Convert date strings back to Date objects
      if (parsed.notes) {
        Object.values(parsed.notes).forEach((note: any) => {
          if (note.createdAt) note.createdAt = new Date(note.createdAt);
          if (note.updatedAt) note.updatedAt = new Date(note.updatedAt);
        });
      }
      if (parsed.images) {
        Object.values(parsed.images).forEach((image: any) => {
          if (image.createdAt) image.createdAt = new Date(image.createdAt);
        });
      }
      if (parsed.files) {
        Object.values(parsed.files).forEach((file: any) => {
          if (file.createdAt) file.createdAt = new Date(file.createdAt);
        });
      }

      return parsed;
    } catch (error) {
      console.error('Failed to parse localStorage data:', error);
      return { notes: {}, images: {}, files: {}, settings: {} };
    }
  }

  private setData(data: LocalStorageData): void {
    try {
      // Test if we can save (storage quota check)
      const serialized = JSON.stringify(data);
      localStorage.setItem(this.storageKey, serialized);
    } catch (error: any) {
      if (error.name === 'QuotaExceededError') {
        toast.error('저장 공간이 부족합니다. 일부 항목을 삭제하고 다시 시도해주세요.');
      }
      throw error;
    }
  }

  private generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // ==================== NOTE OPERATIONS ====================
  async saveNote(note: Omit<Note, 'id'>): Promise<string> {
    const data = this.getData();
    const id = this.generateId('note');
    const newNote: Note = { ...note, id };

    data.notes[id] = newNote;
    this.setData(data);

    return id;
  }

  async updateNote(id: string, updates: Partial<Note>): Promise<void> {
    const data = this.getData();

    if (!data.notes[id]) {
      console.warn(`Note ${id} not found in localStorage`);
      return;
    }

    data.notes[id] = { ...data.notes[id], ...updates };
    this.setData(data);
  }

  async deleteNote(id: string): Promise<void> {
    const data = this.getData();
    delete data.notes[id];
    this.setData(data);
  }

  async getNotes(): Promise<Note[]> {
    const data = this.getData();
    return Object.values(data.notes);
  }

  // ==================== IMAGE OPERATIONS ====================
  async saveImage(image: Omit<CanvasImage, 'id' | 'createdAt'>): Promise<string> {
    const data = this.getData();
    const id = this.generateId('image');
    const newImage: CanvasImage = {
      ...image,
      id,
      createdAt: new Date(),
    };

    data.images[id] = newImage;

    // Test storage quota before saving
    try {
      this.setData(data);
    } catch (error) {
      // Rollback
      delete data.images[id];
      throw error;
    }

    return id;
  }

  async updateImage(id: string, updates: Partial<CanvasImage>): Promise<void> {
    const data = this.getData();

    if (!data.images[id]) {
      console.warn(`Image ${id} not found in localStorage`);
      return;
    }

    data.images[id] = { ...data.images[id], ...updates };
    this.setData(data);
  }

  async deleteImage(id: string): Promise<void> {
    const data = this.getData();
    delete data.images[id];
    this.setData(data);
  }

  async getImages(): Promise<CanvasImage[]> {
    const data = this.getData();
    return Object.values(data.images);
  }

  // ==================== FILE OPERATIONS ====================
  async saveFile(file: Omit<CanvasFile, 'id' | 'createdAt'>): Promise<string> {
    const data = this.getData();
    const id = this.generateId('file');
    const newFile: CanvasFile = {
      ...file,
      id,
      createdAt: new Date(),
    };

    data.files[id] = newFile;

    // Test storage quota before saving
    try {
      this.setData(data);
    } catch (error) {
      // Rollback
      delete data.files[id];
      throw error;
    }

    return id;
  }

  async updateFile(id: string, updates: Partial<CanvasFile>): Promise<void> {
    const data = this.getData();

    if (!data.files[id]) {
      console.warn(`File ${id} not found in localStorage`);
      return;
    }

    data.files[id] = { ...data.files[id], ...updates };
    this.setData(data);
  }

  async deleteFile(id: string): Promise<void> {
    const data = this.getData();
    delete data.files[id];
    this.setData(data);
  }

  async getFiles(): Promise<CanvasFile[]> {
    const data = this.getData();
    return Object.values(data.files);
  }

  // ==================== SETTINGS OPERATIONS ====================
  async saveSettings(settings: { isDarkMode?: boolean; viewport?: Viewport }): Promise<void> {
    const data = this.getData();
    data.settings = { ...data.settings, ...settings };
    this.setData(data);
  }

  async getSettings(): Promise<{ isDarkMode?: boolean; viewport?: Viewport }> {
    const data = this.getData();
    return data.settings || {};
  }

  // ==================== CLEANUP ====================
  cleanup(): void {
    // Nothing to clean up for localStorage
  }
}
