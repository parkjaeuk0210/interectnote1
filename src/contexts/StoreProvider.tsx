import React, { createContext, useContext, ReactNode, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useCanvasStore, CanvasStore } from '../store/canvasStore';
import { useFirebaseCanvasStore, FirebaseCanvasStore } from '../store/firebaseCanvasStore';
import { useSharedCanvasStore, SharedCanvasStore } from '../store/sharedCanvasStore';

interface StoreContextType {
  isFirebaseMode: boolean;
  isSharedMode: boolean;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  const initializeFirebaseSync = useFirebaseCanvasStore((state) => state.initializeFirebaseSync);
  const cleanupFirebaseSync = useFirebaseCanvasStore((state) => state.cleanupFirebaseSync);
  const sharedCanvasId = useSharedCanvasStore((state) => state.canvasId);
  const cleanupSharedCanvas = useSharedCanvasStore((state) => state.cleanupSharedCanvas);
  
  // Use Firebase mode if user is logged in and not anonymous
  const isSharedMode = !!sharedCanvasId;
  const isFirebaseMode = !loading && !!user && !user.isAnonymous && !isSharedMode;

  // Check if we're in shared canvas mode
  useEffect(() => {
    console.log('[StoreProvider] Auth state changed:', {
      user: user?.uid,
      isAnonymous: user?.isAnonymous,
      loading,
      isFirebaseMode,
      isSharedMode
    });
    
    // Check for pending share token after login
    if (user && !loading) {
      const pendingToken = sessionStorage.getItem('pendingShareToken');
      if (pendingToken) {
        sessionStorage.removeItem('pendingShareToken');
        // Navigate to share link
        window.location.href = `/share/${pendingToken}`;
        return;
      }
    }
    
    if (isSharedMode) {
      console.log('[StoreProvider] Using shared mode');
      // Already in shared mode, no need to do anything
    } else if (isFirebaseMode && user) {
      console.log('[StoreProvider] Initializing Firebase mode for user:', user.uid);
      // Initialize Firebase sync
      initializeFirebaseSync(user.uid);
    } else {
      console.log('[StoreProvider] Using local mode (no auth or anonymous)');
      // Cleanup Firebase sync when logged out
      cleanupFirebaseSync();
    }

    return () => {
      // Cleanup on unmount
      if (isFirebaseMode) {
        cleanupFirebaseSync();
      } else if (isSharedMode) {
        cleanupSharedCanvas();
      }
    };
  }, [cleanupFirebaseSync, cleanupSharedCanvas, initializeFirebaseSync, isFirebaseMode, isSharedMode, loading, user, user?.uid, user?.isAnonymous]);

  return (
    <StoreContext.Provider value={{ isFirebaseMode, isSharedMode }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStoreMode = () => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStoreMode must be used within StoreProvider');
  }
  return context;
};

// All stores share similar interfaces
type AppStore = CanvasStore | FirebaseCanvasStore | SharedCanvasStore;

// Hook to get the appropriate store based on auth state
export function useAppStore<T>(selector: (state: AppStore) => T): T {
  const { isFirebaseMode, isSharedMode } = useStoreMode();
  
  // Use the appropriate store based on mode
  const localResult = useCanvasStore(selector as (state: CanvasStore) => T);
  const firebaseResult = useFirebaseCanvasStore(selector as (state: FirebaseCanvasStore) => T);
  const sharedResult = useSharedCanvasStore(selector as (state: SharedCanvasStore) => T);
  
  // Store selection without excessive logging in production
  if (isSharedMode) {
    return sharedResult;
  } else if (isFirebaseMode) {
    return firebaseResult;
  } else {
    return localResult;
  }
}
