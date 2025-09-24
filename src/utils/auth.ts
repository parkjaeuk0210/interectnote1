import { signInWithPopup, signInWithRedirect, getRedirectResult, signOut, signInAnonymously } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';

export const signInWithGoogle = async () => {
  console.log('🔐 Starting Google sign in...');
  console.log('Auth object:', !!auth);
  console.log('Google provider:', !!googleProvider);
  
  if (!auth || !googleProvider) {
    console.warn('Firebase auth not configured');
    return { user: null, error: new Error('Firebase not configured') };
  }
  
  try {
    console.log('🚀 Attempting signInWithPopup...');
    const result = await signInWithPopup(auth, googleProvider);
    console.log('✅ Google sign in successful:', result.user?.email);
    return { user: result.user, error: null };
  } catch (error: any) {
    console.error('❌ Error signing in with Google popup:');
    console.error('Error code:', error?.code);
    console.error('Error message:', error?.message);
    
    // If popup fails due to being blocked or other issues, try redirect
    if (error?.code === 'auth/popup-blocked' || error?.code === 'auth/popup-closed-by-user') {
      console.log('🔄 Popup blocked/closed, trying redirect method...');
      try {
        await signInWithRedirect(auth, googleProvider);
        // Redirect will happen, so we return a pending state
        return { user: null, error: null };
      } catch (redirectError: any) {
        console.error('❌ Redirect also failed:', redirectError);
        return { user: null, error: redirectError };
      }
    }
    
    console.error('Full error:', error);
    return { user: null, error };
  }
};

export const signInAsGuest = async () => {
  console.log('👤 Starting guest sign in...');
  console.log('Auth object:', !!auth);
  
  if (!auth) {
    console.warn('Firebase auth not configured');
    return { user: null, error: new Error('Firebase not configured') };
  }
  
  try {
    console.log('🚀 Attempting signInAnonymously...');
    const result = await signInAnonymously(auth);
    console.log('✅ Guest sign in successful:', result.user?.uid);
    return { user: result.user, error: null };
  } catch (error: any) {
    console.error('❌ Error signing in as guest:');
    console.error('Error code:', error?.code);
    console.error('Error message:', error?.message);
    console.error('Full error:', error);
    return { user: null, error };
  }
};

// Check for redirect result when page loads
export const checkRedirectResult = async () => {
  if (!auth) {
    return { user: null, error: null };
  }
  
  try {
    console.log('🔍 Checking for redirect result...');
    const result = await getRedirectResult(auth);
    if (result) {
      console.log('✅ Redirect login successful:', result.user?.email);
      return { user: result.user, error: null };
    }
    return { user: null, error: null };
  } catch (error: any) {
    console.error('❌ Error getting redirect result:', error);
    return { user: null, error };
  }
};

export const logout = async () => {
  if (!auth) {
    console.warn('Firebase auth not configured');
    return { error: new Error('Firebase not configured') };
  }
  
  try {
    await signOut(auth);
    return { error: null };
  } catch (error) {
    console.error('Error signing out:', error);
    return { error };
  }
};