import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInAnonymously } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';

// Check if Firebase config is available
const hasFirebaseConfig = !!(import.meta.env.VITE_FIREBASE_API_KEY && 
                           import.meta.env.VITE_FIREBASE_AUTH_DOMAIN && 
                           import.meta.env.VITE_FIREBASE_PROJECT_ID);

// Log Firebase configuration status (for debugging)
console.log('🔥 Firebase Config Status:', {
  hasConfig: hasFirebaseConfig,
  hasApiKey: !!import.meta.env.VITE_FIREBASE_API_KEY,
  hasAuthDomain: !!import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  hasProjectId: !!import.meta.env.VITE_FIREBASE_PROJECT_ID,
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ? 'SET' : 'MISSING',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ? 'SET' : 'MISSING',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ? 'SET' : 'MISSING'
});

let app: any = null;
let auth: any = null;
let googleProvider: any = null;
let database: any = null;
let storage: any = null;

if (hasFirebaseConfig) {
  const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  };

  try {
    // Initialize Firebase
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    
    // Configure Google provider with additional settings
    googleProvider.addScope('email');
    googleProvider.addScope('profile');
    googleProvider.setCustomParameters({
      prompt: 'select_account'
    });
    
    database = getDatabase(app);
    storage = getStorage(app);
    
    console.log('✅ Firebase initialized successfully');
    console.log('Auth domain:', import.meta.env.VITE_FIREBASE_AUTH_DOMAIN);
    
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error);
  }
} else {
  console.warn('❌ Firebase configuration not found. Running in local-only mode.');
}

// Export Firebase services
export { auth, googleProvider, database, storage, app };

// Enable offline persistence for Realtime Database with error handling
if (typeof window !== 'undefined' && database) {
  import('firebase/database').then(({ goOffline, goOnline }) => {
    // Handle online/offline state with error catching
    window.addEventListener('online', () => {
      try {
        goOnline(database);
        console.log('🌐 Firebase: Connection restored');
      } catch (error) {
        console.warn('⚠️ Firebase: Failed to go online:', error);
      }
    });
    
    window.addEventListener('offline', () => {
      try {
        goOffline(database);
        console.log('📴 Firebase: Working offline');
      } catch (error) {
        console.warn('⚠️ Firebase: Failed to go offline:', error);
      }
    });
  }).catch(error => {
    console.warn('⚠️ Firebase: Failed to setup offline handling:', error);
  });
}

// Anonymous auth helper functions
export const signInAnonymouslyHelper = async () => {
  if (!auth) {
    throw new Error('Firebase auth is not initialized');
  }
  try {
    const result = await signInAnonymously(auth);
    return result.user;
  } catch (error) {
    console.error('Anonymous sign in failed:', error);
    throw error;
  }
};

// Check if current user is anonymous
export const isAnonymousUser = (user: any) => {
  return user?.isAnonymous === true;
};

// Generate random guest name
export const generateGuestName = () => {
  const randomNum = Math.floor(Math.random() * 10000);
  return `게스트${randomNum}`;
};

// Link anonymous account with Google account (optional upgrade)
export const linkAnonymousWithGoogle = async (user: any) => {
  // This is optional - users don't need to link accounts to use the app
  if (!user) {
    // If no user, just sign in with Google
    const { signInWithPopup } = await import('firebase/auth');
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  }
  
  if (!user.isAnonymous) {
    // Already has an account, no need to link
    return user;
  }
  
  try {
    // Try to upgrade anonymous account to Google account
    const { signInWithPopup, GoogleAuthProvider: GoogleAuthProviderImport, linkWithCredential: linkWithCred } = await import('firebase/auth');
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProviderImport.credentialFromResult(result);
    
    if (credential) {
      try {
        // Try to link if possible
        const linkedResult = await linkWithCred(user, credential);
        return linkedResult.user;
      } catch (linkError: any) {
        // If linking fails, just return the Google account
        // The anonymous data might be lost, but user can still continue
        if (linkError.code === 'auth/credential-already-in-use') {
          return result.user;
        }
      }
    }
    
    return result.user;
  } catch (error: any) {
    // Don't block the user - let them continue as anonymous
    if (error.code === 'auth/popup-closed-by-user') {
      return user; // User cancelled, continue as anonymous
    }
    throw error;
  }
};

// Firebase connection status utility
export const isFirebaseAvailable = () => {
  return !!app && !!auth && !!database;
};

// Graceful Firebase operation wrapper
export const withFirebaseErrorHandling = async <T>(
  operation: () => Promise<T>,
  fallback?: T,
  operationName: string = 'Firebase operation'
): Promise<T | null> => {
  if (!isFirebaseAvailable()) {
    console.warn(`⚠️ ${operationName}: Firebase not available, using local mode`);
    return fallback || null;
  }

  try {
    return await operation();
  } catch (error: any) {
    // Handle common Firebase errors gracefully
    if (error?.code === 'unavailable' || 
        error?.message?.includes('Failed to get document') ||
        error?.message?.includes('XMLHttpRequest') ||
        error?.message?.includes('network')) {
      console.warn(`⚠️ ${operationName}: Network issue, continuing offline:`, error.message);
    } else {
      console.error(`❌ ${operationName} failed:`, error);
    }
    return fallback || null;
  }
};

export default app;