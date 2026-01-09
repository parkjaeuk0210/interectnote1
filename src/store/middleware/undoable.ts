import { StateCreator } from 'zustand';
import { useHistoryStore } from '../historyStore';

// Deep clone helper that preserves Date instances
function deepClone<T>(value: T): T {
  if (value instanceof Date) {
    return new Date(value.getTime()) as unknown as T;
  }
  if (Array.isArray(value)) {
    // @ts-ignore - map preserves type adequately for our usage
    return value.map((v) => deepClone(v)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const result: Record<string, any> = {};
    for (const key of Object.keys(value as Record<string, any>)) {
      // @ts-ignore - index access is safe here
      result[key] = deepClone((value as Record<string, any>)[key]);
    }
    return result as unknown as T;
  }
  return value;
}

type UndoableOptions = {
  limit?: number;
};

type Undoable = <T extends object>(
  initializer: StateCreator<T, [], []>,
  options?: UndoableOptions
) => StateCreator<T, [], []>;

const undoableImpl: Undoable = (initializer, options = {}) => {
  const {
    limit = 50
  } = options;

  return (set, get, store) => {
    const historyStore = useHistoryStore.getState();
    let isUndoingOrRedoing = false;

    const setState = (partial: any, replace?: any) => {
      if (isUndoingOrRedoing) {
        set(partial, replace);
        return;
      }

      const prevState = get();

      // Call the original set
      set(partial, replace);

      const nextState = get();

      // ✅ FIX: Use reference equality instead of JSON.stringify for performance
      // Zustand ensures immutability, so reference comparison is sufficient
      const notesChanged = (prevState as any).notes !== (nextState as any).notes;
      const imagesChanged = (prevState as any).images !== (nextState as any).images;
      const filesChanged = (prevState as any).files !== (nextState as any).files;
      const hasTrackedChanges = notesChanged || imagesChanged || filesChanged;

      // ✅ FIX: Skip history for position-only updates (drag operations)
      // This prevents deepClone on every drag move, improving performance significantly
      const isPositionOnlyChange = () => {
        const prevNotes = (prevState as any).notes || [];
        const nextNotes = (nextState as any).notes || [];
        if (prevNotes.length !== nextNotes.length) return false;
        
        for (let i = 0; i < prevNotes.length; i++) {
          const prev = prevNotes[i];
          const next = nextNotes[i];
          if (prev.id !== next.id) return false;
          // If only x, y changed -> position-only
          const xChanged = prev.x !== next.x;
          const yChanged = prev.y !== next.y;
          const otherChanged = prev.content !== next.content ||
                               prev.width !== next.width ||
                               prev.height !== next.height ||
                               prev.color !== next.color;
          if (otherChanged) return false;
          if (xChanged || yChanged) continue;
        }
        return true;
      };

      // Only track if tracked properties changed AND not position-only
      const shouldTrack = hasTrackedChanges && !isPositionOnlyChange();
      
      if (shouldTrack && !isStateEqual(prevState, nextState)) {
        // Use the last history snapshot to avoid repeatedly cloning large, unchanged data
        // (especially big PDFs/images in `files/images`), which can cause high memory/CPU.
        const prevSnapshot = useHistoryStore.getState().currentState as any | null;

        // Only save the parts we care about for undo/redo
        // Deep clone to avoid future mutations leaking into history snapshots
        const snapshot = {
          notes: notesChanged ? deepClone((nextState as any).notes) : (prevSnapshot?.notes ?? deepClone((nextState as any).notes)),
          images: imagesChanged ? deepClone((nextState as any).images) : (prevSnapshot?.images ?? deepClone((nextState as any).images)),
          files: filesChanged ? deepClone((nextState as any).files) : (prevSnapshot?.files ?? deepClone((nextState as any).files)),
          viewport: deepClone((nextState as any).viewport || { x: 0, y: 0, scale: 1 }),
          selectedNoteId: (nextState as any).selectedNoteId || null,
          selectedImageId: (nextState as any).selectedImageId || null,
          selectedFileId: (nextState as any).selectedFileId || null,
        };

        historyStore.pushState(snapshot, limit);
      }
    };

    const undo = () => {
      const previousState = historyStore.undo();
      if (previousState) {
        isUndoingOrRedoing = true;
        const currentState = get() as any;

        // Merge with current state to preserve viewport and other required properties
        const mergedState = {
          ...currentState,
          ...previousState,
          viewport: previousState.viewport || currentState.viewport || { x: 0, y: 0, scale: 1 },
        };
        set(mergedState, true);

        // If this is a remotely-synced store (firebase/shared), also sync changed notes to backend
        try {
          const stateAfter = get() as any;
          const isFirebase = typeof (stateAfter as any).initializeFirebaseSync === 'function';
          const isShared = typeof (stateAfter as any).joinCanvas === 'function' || 'canvasId' in (stateAfter as any);
          if (isFirebase || isShared) {
            const prevNotes: any[] = (previousState as any).notes || [];
            const currNotes: any[] = (currentState as any).notes || [];
            const currById = new Map(currNotes.map((n) => [n.id, n]));
            for (const pn of prevNotes) {
              const cn = currById.get(pn.id);
              if (!cn) continue;
              const updates: Record<string, any> = {};
              if (pn.content !== cn.content) updates.content = pn.content;
              if (pn.x !== cn.x) updates.x = pn.x;
              if (pn.y !== cn.y) updates.y = pn.y;
              if (pn.width !== cn.width) updates.width = pn.width;
              if (pn.height !== cn.height) updates.height = pn.height;
              if (pn.color !== cn.color) updates.color = pn.color;
              if (Object.keys(updates).length > 0 && typeof (stateAfter as any).updateNote === 'function') {
                // Avoid recording history during backend sync
                (stateAfter as any).updateNote(pn.id, updates);
              }
            }
          }
        } finally {
          // done
        }

        isUndoingOrRedoing = false;
      }
    };

    const redo = () => {
      const nextState = historyStore.redo();
      if (nextState) {
        isUndoingOrRedoing = true;
        const currentState = get() as any;
        // Merge with current state to preserve viewport and other required properties
        const mergedState = {
          ...currentState,
          ...nextState,
          viewport: nextState.viewport || currentState.viewport || { x: 0, y: 0, scale: 1 },
        };
        set(mergedState, true);

        // Sync to backend for remote stores similar to undo()
        try {
          const stateAfter = get() as any;
          const isFirebase = typeof (stateAfter as any).initializeFirebaseSync === 'function';
          const isShared = typeof (stateAfter as any).joinCanvas === 'function' || 'canvasId' in (stateAfter as any);
          if (isFirebase || isShared) {
            const targetNotes: any[] = (nextState as any).notes || [];
            const currNotes: any[] = (currentState as any).notes || [];
            const currById = new Map(currNotes.map((n) => [n.id, n]));
            for (const tn of targetNotes) {
              const cn = currById.get(tn.id);
              if (!cn) continue;
              const updates: Record<string, any> = {};
              if (tn.content !== cn.content) updates.content = tn.content;
              if (tn.x !== cn.x) updates.x = tn.x;
              if (tn.y !== cn.y) updates.y = tn.y;
              if (tn.width !== cn.width) updates.width = tn.width;
              if (tn.height !== cn.height) updates.height = tn.height;
              if (tn.color !== cn.color) updates.color = tn.color;
              if (Object.keys(updates).length > 0 && typeof (stateAfter as any).updateNote === 'function') {
                (stateAfter as any).updateNote(tn.id, updates);
              }
            }
          }
        } finally {
          // done
        }

        isUndoingOrRedoing = false;
      }
    };

    const storeInitializer = initializer(
      setState as any,
      get,
      store
    );

    // Add undo and redo methods to the store
    return {
      ...storeInitializer,
      undo,
      redo,
    };
  };
};

// Helper function to check if two states are equal (shallow comparison)
function isStateEqual(state1: any, state2: any): boolean {
  const keys1 = Object.keys(state1);
  const keys2 = Object.keys(state2);
  
  if (keys1.length !== keys2.length) return false;
  
  for (const key of keys1) {
    if (state1[key] !== state2[key]) return false;
  }
  
  return true;
}

export const undoable = undoableImpl;
