import { 
  ref, 
  onValue, 
  push,
  DataSnapshot,
  serverTimestamp 
} from 'firebase/database';
import { database } from './firebase';
import { FirebaseNote, FirebaseImage, FirebaseFile } from '../types/firebase';
import { realtimeBatchManager } from './realtimeBatchManager';
import { storageManager } from './storageManager';

// Cache device ID in memory to avoid repeated localStorage access
let cachedDeviceId: string | null = null;

// Get device ID (stored in localStorage and cached in memory)
const getDeviceId = () => {
  // Return cached value if available
  if (cachedDeviceId) {
    return cachedDeviceId;
  }
  
  // Try to get from localStorage
  let deviceId = localStorage.getItem('deviceId');
  if (!deviceId) {
    // Use crypto-secure random generation for device ID
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    const randomId = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    deviceId = `device_${Date.now()}_${randomId}`;
    localStorage.setItem('deviceId', deviceId);
  }
  
  // Cache the device ID
  cachedDeviceId = deviceId;
  return deviceId;
};

// Database paths
const getUserPath = (userId: string) => `users/${userId}`;
const getNotesPath = (userId: string) => `${getUserPath(userId)}/notes`;
const getImagesPath = (userId: string) => `${getUserPath(userId)}/images`;
const getFilesPath = (userId: string) => `${getUserPath(userId)}/files`;
const getSettingsPath = (userId: string) => `${getUserPath(userId)}/settings`;

// Notes operations
export const saveNote = async (userId: string, note: Omit<FirebaseNote, 'id' | 'userId' | 'deviceId'>) => {
  try {
    const notesRef = ref(database, getNotesPath(userId));
    const newNoteRef = push(notesRef);
    const noteData = {
      ...note,
      id: newNoteRef.key!,
      userId,
      deviceId: getDeviceId(),
    };
    
    // Use batch manager for better performance
    const path = `${getNotesPath(userId)}/${newNoteRef.key}`;
    realtimeBatchManager.addUpdate(path, noteData);
    
    return newNoteRef.key;
  } catch (error: any) {
    // Log error but don't break the app
    if (error?.message?.includes('XMLHttpRequest') || 
        error?.message?.includes('network') ||
        error?.code === 'unavailable') {
      console.warn('⚠️ Save Note: Network issue, continuing offline:', error.message);
    } else {
      console.error('❌ Save Note failed:', error);
    }
    
    // Generate a local ID so the UI doesn't break
    return `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
};

export const updateNote = async (userId: string, noteId: string, updates: Partial<Omit<FirebaseNote, 'id' | 'userId' | 'deviceId'>>) => {
  // Use batch manager for better performance
  const path = `${getNotesPath(userId)}/${noteId}`;
  
  // Prepare individual field updates for multi-path update
  const fieldUpdates = Object.entries({
    ...updates,
    updatedAt: Date.now(),
  }).reduce((acc, [key, value]) => {
    acc[`${path}/${key}`] = value;
    return acc;
  }, {} as Record<string, any>);
  
  Object.entries(fieldUpdates).forEach(([fieldPath, value]) => {
    realtimeBatchManager.addUpdate(fieldPath, value);
  });
};

export const deleteNote = async (userId: string, noteId: string) => {
  const path = `${getNotesPath(userId)}/${noteId}`;
  if (import.meta.env.DEV) {
    console.log('[Database] deleteNote - adding delete to batch:', path);
  }
  realtimeBatchManager.addDelete(path);
  if (import.meta.env.DEV) {
    console.log('[Database] Pending operations:', realtimeBatchManager.getPendingCount());
  }
};

// Images operations
export const saveImage = async (userId: string, image: Omit<FirebaseImage, 'id' | 'userId' | 'deviceId'>) => {
  const imagesRef = ref(database, getImagesPath(userId));
  const newImageRef = push(imagesRef);
  const imageId = newImageRef.key!;
  
  // Upload image to Storage if it's base64
  let imageUrl = image.url;
  if (imageUrl.startsWith('data:')) {
    try {
      imageUrl = await storageManager.uploadImage(userId, imageId, imageUrl);
    } catch (error) {
      console.error('Failed to upload image to Storage, falling back to base64:', error);
      // Fall back to base64 if Storage upload fails
    }
  }
  
  const imageData = {
    ...image,
    url: imageUrl,
    id: imageId,
    userId,
    deviceId: getDeviceId(),
  };
  
  // Use batch manager
  const path = `${getImagesPath(userId)}/${imageId}`;
  realtimeBatchManager.addUpdate(path, imageData);
  
  return imageId;
};

export const updateImage = async (userId: string, imageId: string, updates: Partial<Omit<FirebaseImage, 'id' | 'userId' | 'deviceId'>>) => {
  // If updating image URL, upload to Storage first
  if (updates.url && updates.url.startsWith('data:')) {
    try {
      updates.url = await storageManager.uploadImage(userId, imageId, updates.url);
    } catch (error) {
      console.error('Failed to upload image to Storage:', error);
    }
  }
  
  // Use batch manager
  const path = `${getImagesPath(userId)}/${imageId}`;
  const fieldUpdates = Object.entries(updates).reduce((acc, [key, value]) => {
    acc[`${path}/${key}`] = value;
    return acc;
  }, {} as Record<string, any>);
  
  Object.entries(fieldUpdates).forEach(([fieldPath, value]) => {
    realtimeBatchManager.addUpdate(fieldPath, value);
  });
};

export const deleteImage = async (userId: string, imageId: string) => {
  // Delete from Storage
  try {
    await storageManager.deleteImage(userId, imageId);
  } catch (error) {
    console.error('Failed to delete image from Storage:', error);
  }
  
  // Delete from Database using batch manager
  const path = `${getImagesPath(userId)}/${imageId}`;
  realtimeBatchManager.addDelete(path);
};

// Files operations
export const saveFile = async (userId: string, file: Omit<FirebaseFile, 'id' | 'userId' | 'deviceId'>) => {
  const filesRef = ref(database, getFilesPath(userId));
  const newFileRef = push(filesRef);
  const fileId = newFileRef.key!;
  
  // Upload file to Storage if it's base64
  let fileUrl = file.url;
  if (fileUrl.startsWith('data:')) {
    try {
      fileUrl = await storageManager.uploadFile(userId, fileId, fileUrl, file.fileName);
    } catch (error) {
      console.error('Failed to upload file to Storage, falling back to base64:', error);
      // Fall back to base64 if Storage upload fails
    }
  }
  
  const fileData = {
    ...file,
    url: fileUrl,
    id: fileId,
    userId,
    deviceId: getDeviceId(),
  };
  
  // Use batch manager
  const path = `${getFilesPath(userId)}/${fileId}`;
  realtimeBatchManager.addUpdate(path, fileData);
  
  return fileId;
};

export const updateFile = async (userId: string, fileId: string, updates: Partial<Omit<FirebaseFile, 'id' | 'userId' | 'deviceId'>>) => {
  // If updating file URL, upload to Storage first
  if (updates.url && updates.url.startsWith('data:')) {
    try {
      updates.url = await storageManager.uploadFile(userId, fileId, updates.url, updates.fileName || 'file');
    } catch (error) {
      console.error('Failed to upload file to Storage:', error);
    }
  }
  
  // Use batch manager
  const path = `${getFilesPath(userId)}/${fileId}`;
  const fieldUpdates = Object.entries(updates).reduce((acc, [key, value]) => {
    acc[`${path}/${key}`] = value;
    return acc;
  }, {} as Record<string, any>);
  
  Object.entries(fieldUpdates).forEach(([fieldPath, value]) => {
    realtimeBatchManager.addUpdate(fieldPath, value);
  });
};

export const deleteFile = async (userId: string, fileId: string, fileName?: string) => {
  // Delete from Storage
  try {
    await storageManager.deleteFile(userId, fileId, fileName);
  } catch (error) {
    console.error('Failed to delete file from Storage:', error);
  }
  
  // Delete from Database using batch manager
  const path = `${getFilesPath(userId)}/${fileId}`;
  realtimeBatchManager.addDelete(path);
};

// Settings operations
export const saveSettings = async (userId: string, settings: any) => {
  const path = getSettingsPath(userId);
  realtimeBatchManager.addUpdate(path, {
    ...settings,
    lastSyncTime: serverTimestamp(),
  });
};

// Subscribe to changes
export const subscribeToNotes = (
  userId: string, 
  callback: (notes: Record<string, FirebaseNote>) => void
) => {
  const notesRef = ref(database, getNotesPath(userId));
  const unsubscribe = onValue(notesRef, (snapshot: DataSnapshot) => {
    const data = snapshot.val() || {};
    callback(data);
  });
  
  // onValue returns an unsubscribe function directly in Firebase v9
  return unsubscribe;
};

export const subscribeToImages = (
  userId: string, 
  callback: (images: Record<string, FirebaseImage>) => void
) => {
  const imagesRef = ref(database, getImagesPath(userId));
  const unsubscribe = onValue(imagesRef, (snapshot: DataSnapshot) => {
    const data = snapshot.val() || {};
    callback(data);
  });
  
  // onValue returns an unsubscribe function directly in Firebase v9
  return unsubscribe;
};

export const subscribeToFiles = (
  userId: string, 
  callback: (files: Record<string, FirebaseFile>) => void
) => {
  const filesRef = ref(database, getFilesPath(userId));
  const unsubscribe = onValue(filesRef, (snapshot: DataSnapshot) => {
    const data = snapshot.val() || {};
    callback(data);
  });
  
  // onValue returns an unsubscribe function directly in Firebase v9
  return unsubscribe;
};

export const subscribeToSettings = (
  userId: string, 
  callback: (settings: any) => void
) => {
  const settingsRef = ref(database, getSettingsPath(userId));
  const unsubscribe = onValue(settingsRef, (snapshot: DataSnapshot) => {
    const data = snapshot.val() || {};
    callback(data);
  });
  
  // onValue returns an unsubscribe function directly in Firebase v9
  return unsubscribe;
};