import { signInWithPopup, signInWithRedirect, getRedirectResult, signOut, signInAnonymously } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { isMobile, isStandalonePwa } from './device';

const GOOGLE_REDIRECT_FALLBACK_ERRORS = new Set([
  'auth/popup-blocked',
  'auth/cancelled-popup-request',
  'auth/operation-not-supported-in-this-environment',
]);

const shouldPreferRedirectForGoogleSignIn = () => {
  if (typeof window === 'undefined') return false;
  return isStandalonePwa() || isMobile();
};

export const getAuthErrorMessage = (error: unknown) => {
  const authError = error as { code?: string; message?: string } | null;

  switch (authError?.code) {
    case 'auth/popup-closed-by-user':
      return '로그인 팝업이 닫혔습니다.';
    case 'auth/popup-blocked':
      return '브라우저가 로그인 팝업을 차단했습니다.';
    case 'auth/cancelled-popup-request':
      return '이미 다른 로그인 창이 열려 있습니다. 잠시 후 다시 시도해주세요.';
    case 'auth/operation-not-supported-in-this-environment':
      return '현재 환경에서는 팝업 로그인이 지원되지 않습니다.';
    case 'auth/network-request-failed':
      return '네트워크 오류로 로그인에 실패했습니다.';
    case 'auth/too-many-requests':
      return '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.';
    case 'auth/unauthorized-domain':
      return '현재 도메인이 Firebase Auth 허용 도메인에 없습니다.';
    default:
      return authError?.message || '로그인 중 오류가 발생했습니다.';
  }
};

const startGoogleRedirectSignIn = async () => {
  if (!auth || !googleProvider) {
    return { user: null, error: new Error('Firebase not configured') };
  }

  await signInWithRedirect(auth, googleProvider);
  return { user: null, error: null };
};

export const signInWithGoogle = async () => {
  console.log('🔐 Starting Google sign in...');
  console.log('Auth object:', !!auth);
  console.log('Google provider:', !!googleProvider);
  
  if (!auth || !googleProvider) {
    console.warn('Firebase auth not configured');
    return { user: null, error: new Error('Firebase not configured') };
  }
  
  try {
    if (shouldPreferRedirectForGoogleSignIn()) {
      console.log('↪️ Using redirect-based Google sign in for mobile/PWA environment...');
      return await startGoogleRedirectSignIn();
    }

    console.log('🚀 Attempting signInWithPopup...');
    const result = await signInWithPopup(auth, googleProvider);
    console.log('✅ Google sign in successful:', result.user?.email);
    return { user: result.user, error: null };
  } catch (error: any) {
    console.error('❌ Error signing in with Google popup:');
    console.error('Error code:', error?.code);
    console.error('Error message:', error?.message);
    
    // If popup is unavailable in this environment, retry with redirect.
    if (GOOGLE_REDIRECT_FALLBACK_ERRORS.has(error?.code)) {
      console.log('🔄 Popup sign in unavailable, trying redirect method...');
      try {
        return await startGoogleRedirectSignIn();
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
