import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { undoable } from './middleware/undoable';
import { createCanvasStoreCore } from './core/createCanvasStore';
import { LocalStorageAdapter } from './adapters/LocalStorageAdapter';
import { BaseCanvasStore } from './types/store.types';

/**
 * 통합 캔버스 스토어 (LocalStorage 기반)
 * 기존 canvasStore.ts를 대체하는 새로운 아키텍처
 */
export const useUnifiedCanvasStore = create<BaseCanvasStore>()(
  persist(
    undoable(
      createCanvasStoreCore(new LocalStorageAdapter())
    ),
    {
      name: 'interectnote-storage-v2',
      // Only persist essential state, not functions
      partialize: (state) => ({
        notes: state.notes,
        images: state.images,
        files: state.files,
        viewport: state.viewport,
        isDarkMode: state.isDarkMode,
      }),
    }
  )
);
