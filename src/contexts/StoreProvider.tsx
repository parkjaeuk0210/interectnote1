import React, { createContext, useContext, ReactNode, useEffect, useState } from 'react';
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
  const firebaseStore = useFirebaseCanvasStore();
  const sharedStore = useSharedCanvasStore();
  const [isSharedMode, setIsSharedMode] = useState(false);
  
  // Use Firebase mode if user is logged in and not anonymous
  const isFirebaseMode = !loading && !!user && !user.isAnonymous && !isSharedMode;

  // Check if we're in shared canvas mode
  useEffect(() => {
    const checkSharedMode = () => {
      // Check if already in a shared canvas
      const sharedCanvasId = sharedStore.canvasId;
      setIsSharedMode(!!sharedCanvasId);
    };

    checkSharedMode();
  }, [sharedStore.canvasId]);

  useEffect(() => {
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

    // ✅ FIX: Prevent duplicate Firebase sync initialization
    if (isSharedMode) {
      // Already in shared mode, no need to do anything
    } else if (isFirebaseMode && user && firebaseStore.currentUserId !== user.uid) {
      // Only initialize if user changed
      firebaseStore.initializeFirebaseSync(user.uid);
    } else if (!isFirebaseMode && !isSharedMode) {
      // Cleanup Firebase sync when logged out
      firebaseStore.cleanupFirebaseSync();
    }

    return () => {
      // Cleanup on unmount only
      if (isFirebaseMode) {
        firebaseStore.cleanupFirebaseSync();
      } else if (isSharedMode) {
        sharedStore.cleanupSharedCanvas();
      }
    };
  }, [isFirebaseMode, isSharedMode, user?.uid, loading]);

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

  // ✅ FIX: Only subscribe to the appropriate store based on mode
  // This prevents unnecessary subscriptions and re-renders
  if (isSharedMode) {
    return useSharedCanvasStore(selector as (state: SharedCanvasStore) => T);
  } else if (isFirebaseMode) {
    return useFirebaseCanvasStore(selector as (state: FirebaseCanvasStore) => T);
  } else {
    return useCanvasStore(selector as (state: CanvasStore) => T);
  }
}