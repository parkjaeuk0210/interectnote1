import { create } from 'zustand';

interface HistoryState {
  undoStack: any[];
  redoStack: any[];
  currentState: any | null;
  
  pushState: (previousState: any, nextState: any, limit?: number) => void;
  undo: () => any | null;
  redo: () => any | null;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clear: () => void;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  undoStack: [],
  redoStack: [],
  currentState: null,
  
  pushState: (previousState, nextState, limit = 50) => {
    const { undoStack } = get();

    const newUndoStack = [...undoStack, previousState];

    // Limit the undo stack size
    if (newUndoStack.length > limit) {
      newUndoStack.shift();
    }

    set({
      undoStack: newUndoStack,
      currentState: nextState,
      redoStack: [], // Clear redo stack when new action is performed
    });
  },
  
  undo: () => {
    const { undoStack, currentState, redoStack } = get();
    
    if (undoStack.length === 0) return null;
    
    // Pop from undo stack
    const previousState = undoStack[undoStack.length - 1];
    const newUndoStack = undoStack.slice(0, -1);
    
    // Push current state to redo stack
    const newRedoStack = currentState !== null ? [...redoStack, currentState] : redoStack;
    
    set({
      undoStack: newUndoStack,
      redoStack: newRedoStack,
      currentState: previousState,
    });
    
    return previousState;
  },
  
  redo: () => {
    const { redoStack, currentState, undoStack } = get();
    
    if (redoStack.length === 0) return null;
    
    // Pop from redo stack
    const nextState = redoStack[redoStack.length - 1];
    const newRedoStack = redoStack.slice(0, -1);
    
    // Push current state to undo stack
    const newUndoStack = currentState !== null ? [...undoStack, currentState] : undoStack;
    
    set({
      undoStack: newUndoStack,
      redoStack: newRedoStack,
      currentState: nextState,
    });
    
    return nextState;
  },
  
  canUndo: () => {
    const { undoStack } = get();
    return undoStack.length > 0;
  },
  
  canRedo: () => {
    const { redoStack } = get();
    return redoStack.length > 0;
  },
  
  clear: () => {
    set({
      undoStack: [],
      redoStack: [],
      currentState: null,
    });
  },
}));
