import { 
  ref, 
  set, 
  onValue, 
  off, 
  push, 
  remove, 
  update,
  DataSnapshot,
  serverTimestamp,
  onDisconnect
} from 'firebase/database';
import { database } from './firebase';
import { 
  SharedCanvas, 
  ShareToken, 
  CanvasParticipant, 
  ParticipantRole,
  PresenceData
} from '../types/sharing';
import { FirebaseNote, FirebaseImage, FirebaseFile } from '../types/firebase';

// Generate unique token with crypto-secure random
const generateShareToken = () => {
  // Use crypto-secure random for token generation
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

// Generate unique color for participant
const generateParticipantColor = (index: number) => {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', 
    '#98D8C8', '#FDCB6E', '#6C5CE7', '#A29BFE',
    '#FF6B9D', '#C44569' // Added 2 more colors for 10 participants
  ];
  return colors[index % colors.length];
};

// Database paths
const getUserSharedCanvasesPath = (userId: string) => `users/${userId}/shared_canvases`;
const getSharedCanvasPath = (canvasId: string) => `shared_canvases/${canvasId}`;
const getSharedNotesPath = (canvasId: string) => `${getSharedCanvasPath(canvasId)}/notes`;
const getSharedImagesPath = (canvasId: string) => `${getSharedCanvasPath(canvasId)}/images`;
const getSharedFilesPath = (canvasId: string) => `${getSharedCanvasPath(canvasId)}/files`;
const getParticipantsPath = (canvasId: string) => `${getSharedCanvasPath(canvasId)}/participants`;
const getPresencePath = (canvasId: string) => `${getSharedCanvasPath(canvasId)}/presence`;
const getShareTokenPath = (token: string) => `share_tokens/${token}`;

// Create a new shared canvas
export const createSharedCanvas = async (
  userId: string, 
  userEmail: string,
  canvasName: string,
  currentNotes?: FirebaseNote[],
  currentImages?: FirebaseImage[],
  currentFiles?: FirebaseFile[]
) => {
  // Check if Firebase database is initialized
  if (!database) {
    throw new Error('Firebase database is not initialized. Please check your Firebase configuration.');
  }
  
  const canvasRef = ref(database, 'shared_canvases');
  const newCanvasRef = push(canvasRef);
  const canvasId = newCanvasRef.key!;

  const sharedCanvas: SharedCanvas = {
    id: canvasId,
    name: canvasName,
    owner: userId,
    ownerEmail: userEmail,
    participants: {
      [userId]: {
        userId,
        email: userEmail,
        role: 'owner' as ParticipantRole, // Changed from 'editor' to 'owner'
        joinedAt: Date.now(),
        lastActiveAt: Date.now(),
        isOnline: true,
        color: generateParticipantColor(0)
      }
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isPublic: false,
    shareSettings: {
      allowPublicAccess: false,
      requirePassword: false,
      defaultRole: 'viewer' as ParticipantRole,
      maxParticipants: 10 // Limit to 10 participants for team collaboration
    }
  };

  await set(newCanvasRef, sharedCanvas);

  // Add canvas to user's shared canvas list
  const userCanvasesRef = ref(database, `${getUserSharedCanvasesPath(userId)}/${canvasId}`);
  await set(userCanvasesRef, {
    canvasId,
    name: canvasName,
    role: 'owner',
    joinedAt: Date.now()
  });

  // Copy existing notes, images, and files to shared canvas
  if (currentNotes && currentNotes.length > 0) {
    const notesRef = ref(database, getSharedNotesPath(canvasId));
    const notesData: Record<string, FirebaseNote> = {};
    currentNotes.forEach(note => {
      notesData[note.id] = note;
    });
    await set(notesRef, notesData);
  }

  if (currentImages && currentImages.length > 0) {
    const imagesRef = ref(database, getSharedImagesPath(canvasId));
    const imagesData: Record<string, FirebaseImage> = {};
    currentImages.forEach(image => {
      imagesData[image.id] = image;
    });
    await set(imagesRef, imagesData);
  }

  if (currentFiles && currentFiles.length > 0) {
    const filesRef = ref(database, getSharedFilesPath(canvasId));
    const filesData: Record<string, FirebaseFile> = {};
    currentFiles.forEach(file => {
      filesData[file.id] = file;
    });
    await set(filesRef, filesData);
  }

  return canvasId;
};

// Generate share link/token
export const generateShareLink = async (
  canvasId: string, 
  userId: string,
  role: ParticipantRole = 'viewer',
  expiresInHours?: number
) => {
  const token = generateShareToken();
  const shareToken: Omit<ShareToken, 'expiresAt'> & { expiresAt?: number } = {
    token,
    canvasId,
    createdBy: userId,
    createdAt: Date.now(),
    role,
    used: false
  };

  // Only add expiresAt if it's defined
  if (expiresInHours) {
    shareToken.expiresAt = Date.now() + (expiresInHours * 60 * 60 * 1000);
  }

  const tokenRef = ref(database, getShareTokenPath(token));
  await set(tokenRef, shareToken);

  // Ensure canvas is accessible to invited collaborators
  const canvasRef = ref(database, getSharedCanvasPath(canvasId));
  await update(canvasRef, {
    isPublic: true,
    'shareSettings/allowPublicAccess': true,
  });

  return token;
};

// Join shared canvas using token
export const joinSharedCanvas = async (
  token: string,
  userId: string,
  userEmail: string,
  displayName?: string,
  photoURL?: string
) => {
  const tokenRef = ref(database, getShareTokenPath(token));
  const tokenSnapshot = await new Promise<DataSnapshot>((resolve) => {
    onValue(tokenRef, resolve, { onlyOnce: true });
  });

  const tokenData = tokenSnapshot.val() as ShareToken;
  
  if (!tokenData) {
    throw new Error('유효하지 않은 공유 링크입니다.');
  }

  // Remove single-use token check - tokens should be reusable for multiple users
  // Only check if this specific user has already used this token
  if (tokenData.usedBy && tokenData.usedBy === userId) {
    // This user has already joined with this token, just redirect to canvas
    return tokenData.canvasId;
  }

  if (tokenData.expiresAt && tokenData.expiresAt < Date.now()) {
    throw new Error('만료된 공유 링크입니다.');
  }

  // Get canvas info to check participant limit
  const canvasRef = ref(database, getSharedCanvasPath(tokenData.canvasId));
  const canvasSnapshot = await new Promise<DataSnapshot>((resolve) => {
    onValue(canvasRef, resolve, { onlyOnce: true });
  });
  
  const canvasData = canvasSnapshot.val() as SharedCanvas;
  if (!canvasData) {
    throw new Error('캔버스를 찾을 수 없습니다.');
  }

  // Check if user is already a participant
  const currentParticipants = canvasData.participants || {};
  const existingParticipant = currentParticipants[userId];
  if (existingParticipant) {
    // Update role if token grants higher privileges than current assignment
    if (existingParticipant.role !== tokenData.role) {
      const participantRef = ref(database, `${getParticipantsPath(tokenData.canvasId)}/${userId}`);
      await update(participantRef, {
        role: tokenData.role,
        lastActiveAt: Date.now(),
      });

      const userCanvasRef = ref(
        database,
        `${getUserSharedCanvasesPath(userId)}/${tokenData.canvasId}`
      );
      await update(userCanvasRef, {
        role: tokenData.role,
        joinedAt: existingParticipant.joinedAt ?? Date.now(),
      });
    }

    // Ensure presence entry is refreshed for returning participant
    await updatePresence(tokenData.canvasId, userId, { isOnline: true });
    return tokenData.canvasId;
  }

  // Get current participants count to check limit
  const participantCount = Object.keys(currentParticipants).length;
  
  // Check participant limit (treat old 2-person limit as 10)
  const storedLimit = canvasData.shareSettings?.maxParticipants;
  // Automatically treat any canvas with old 2-person limit as 10
  // Don't update Firebase as new users don't have permission yet
  const maxParticipants = (storedLimit === 2) ? 10 : (storedLimit || 10);
  
  // Debug logging to understand the issue
  console.log('Join Canvas Debug:', {
    participantCount,
    storedLimit,
    maxParticipants,
    currentParticipants: Object.keys(currentParticipants),
    userId
  });
  
  if (participantCount >= maxParticipants) {
    throw new Error(`이 캔버스는 최대 ${maxParticipants}명까지만 참여할 수 있습니다. (현재: ${participantCount}명)`);
  }

  // Add user as participant
  const participant: Omit<CanvasParticipant, 'displayName' | 'photoURL'> & {
    displayName?: string;
    photoURL?: string;
  } = {
    userId,
    email: userEmail,
    role: tokenData.role,
    joinedAt: Date.now(),
    lastActiveAt: Date.now(),
    isOnline: true,
    color: generateParticipantColor(participantCount)
  };

  // Only add optional fields if they are defined
  if (displayName) {
    participant.displayName = displayName;
  }
  if (photoURL) {
    participant.photoURL = photoURL;
  }

  const participantRef = ref(database, `${getParticipantsPath(tokenData.canvasId)}/${userId}`);
  await set(participantRef, participant);

  // Track who has used the token (for analytics, not for blocking)
  // Don't mark as "used" to allow multiple users to join
  const usageRef = ref(database, `${getShareTokenPath(token)}/usage/${userId}`);
  try {
    await set(usageRef, {
      userId,
      joinedAt: Date.now()
    });
  } catch (error) {
    // Non-owners can't update share token metadata; ignore so join proceeds.
    console.warn('share token usage tracking failed', error);
  }

  // Add canvas to user's shared canvas list
  const userCanvasesRef = ref(database, `${getUserSharedCanvasesPath(userId)}/${tokenData.canvasId}`);
  await set(userCanvasesRef, {
    canvasId: tokenData.canvasId,
    name: canvasData.name,
    role: tokenData.role,
    joinedAt: Date.now()
  });

  return tokenData.canvasId;
};

// Update participant presence
export const updatePresence = async (
  canvasId: string,
  userId: string,
  presenceData: Partial<PresenceData>
) => {
  const presenceRef = ref(database, `${getPresencePath(canvasId)}/${userId}`);
  
  await update(presenceRef, {
    ...presenceData,
    lastActiveAt: serverTimestamp()
  });

  // Set up onDisconnect to mark user as offline
  onDisconnect(presenceRef).update({
    isOnline: false,
    lastActiveAt: serverTimestamp()
  });
};

// Remove participant from canvas
export const removeParticipant = async (
  canvasId: string,
  participantId: string,
  requesterId: string
) => {
  // Check if requester is owner
  const canvasRef = ref(database, getSharedCanvasPath(canvasId));
  const canvasSnapshot = await new Promise<DataSnapshot>((resolve) => {
    onValue(canvasRef, resolve, { onlyOnce: true });
  });

  const canvasData = canvasSnapshot.val() as SharedCanvas;
  
  if (canvasData.owner !== requesterId) {
    throw new Error('Only the canvas owner can remove participants');
  }

  // Remove participant
  const participantRef = ref(database, `${getParticipantsPath(canvasId)}/${participantId}`);
  await remove(participantRef);

  // Remove presence data
  const presenceRef = ref(database, `${getPresencePath(canvasId)}/${participantId}`);
  await remove(presenceRef);
};

// Update participant role
export const updateParticipantRole = async (
  canvasId: string,
  participantId: string,
  newRole: ParticipantRole,
  requesterId: string
) => {
  // Check if requester is owner
  const canvasRef = ref(database, getSharedCanvasPath(canvasId));
  const canvasSnapshot = await new Promise<DataSnapshot>((resolve) => {
    onValue(canvasRef, resolve, { onlyOnce: true });
  });

  const canvasData = canvasSnapshot.val() as SharedCanvas;
  
  if (canvasData.owner !== requesterId) {
    throw new Error('Only the canvas owner can change participant roles');
  }

  const participantRef = ref(database, `${getParticipantsPath(canvasId)}/${participantId}`);
  await update(participantRef, { role: newRole });
};

// Subscribe to shared canvas changes
export const subscribeToSharedCanvas = (
  canvasId: string,
  callback: (canvas: SharedCanvas | null) => void
) => {
  const canvasRef = ref(database, getSharedCanvasPath(canvasId));
  const unsubscribe = onValue(canvasRef, (snapshot: DataSnapshot) => {
    callback(snapshot.val());
  });
  
  return () => off(canvasRef, 'value', unsubscribe);
};

// Subscribe to shared notes
export const subscribeToSharedNotes = (
  canvasId: string,
  callback: (notes: Record<string, FirebaseNote>) => void
) => {
  const notesRef = ref(database, getSharedNotesPath(canvasId));
  const unsubscribe = onValue(notesRef, (snapshot: DataSnapshot) => {
    const data = snapshot.val() || {};
    callback(data);
  });
  
  return () => off(notesRef, 'value', unsubscribe);
};

// Subscribe to shared images
export const subscribeToSharedImages = (
  canvasId: string,
  callback: (images: Record<string, FirebaseImage>) => void
) => {
  const imagesRef = ref(database, getSharedImagesPath(canvasId));
  const unsubscribe = onValue(imagesRef, (snapshot: DataSnapshot) => {
    const data = snapshot.val() || {};
    callback(data);
  });
  
  return () => off(imagesRef, 'value', unsubscribe);
};

// Subscribe to shared files
export const subscribeToSharedFiles = (
  canvasId: string,
  callback: (files: Record<string, FirebaseFile>) => void
) => {
  const filesRef = ref(database, getSharedFilesPath(canvasId));
  const unsubscribe = onValue(filesRef, (snapshot: DataSnapshot) => {
    const data = snapshot.val() || {};
    callback(data);
  });
  
  return () => off(filesRef, 'value', unsubscribe);
};

// Subscribe to presence updates
export const subscribeToPresence = (
  canvasId: string,
  callback: (presence: Record<string, PresenceData>) => void
) => {
  const presenceRef = ref(database, getPresencePath(canvasId));
  const unsubscribe = onValue(presenceRef, (snapshot: DataSnapshot) => {
    const data = snapshot.val() || {};
    callback(data);
  });
  
  return () => off(presenceRef, 'value', unsubscribe);
};

// CRUD operations for shared canvas items
export const saveSharedNote = async (
  canvasId: string,
  note: Omit<FirebaseNote, 'id' | 'userId' | 'deviceId'>,
  userId: string
) => {
  const notesRef = ref(database, getSharedNotesPath(canvasId));
  const newNoteRef = push(notesRef);
  const noteData = {
    ...note,
    id: newNoteRef.key!,
    userId,
    deviceId: 'shared',
  };
  await set(newNoteRef, noteData);
  return newNoteRef.key;
};

export const updateSharedNote = async (
  canvasId: string,
  noteId: string,
  updates: Partial<Omit<FirebaseNote, 'id' | 'userId' | 'deviceId'>>
) => {
  const noteRef = ref(database, `${getSharedNotesPath(canvasId)}/${noteId}`);
  await update(noteRef, {
    ...updates,
    updatedAt: Date.now(),
  });
};

export const deleteSharedNote = async (canvasId: string, noteId: string) => {
  const noteRef = ref(database, `${getSharedNotesPath(canvasId)}/${noteId}`);
  await remove(noteRef);
};

// Similar functions for images and files
export const saveSharedImage = async (
  canvasId: string,
  image: Omit<FirebaseImage, 'id' | 'userId' | 'deviceId'>,
  userId: string
) => {
  const imagesRef = ref(database, getSharedImagesPath(canvasId));
  const newImageRef = push(imagesRef);
  const imageData = {
    ...image,
    id: newImageRef.key!,
    userId,
    deviceId: 'shared',
  };
  await set(newImageRef, imageData);
  return newImageRef.key;
};

export const updateSharedImage = async (
  canvasId: string,
  imageId: string,
  updates: Partial<Omit<FirebaseImage, 'id' | 'userId' | 'deviceId'>>
) => {
  const imageRef = ref(database, `${getSharedImagesPath(canvasId)}/${imageId}`);
  await update(imageRef, updates);
};

export const deleteSharedImage = async (canvasId: string, imageId: string) => {
  const imageRef = ref(database, `${getSharedImagesPath(canvasId)}/${imageId}`);
  await remove(imageRef);
};

export const saveSharedFile = async (
  canvasId: string,
  file: Omit<FirebaseFile, 'id' | 'userId' | 'deviceId'>,
  userId: string
) => {
  const filesRef = ref(database, getSharedFilesPath(canvasId));
  const newFileRef = push(filesRef);
  const fileData = {
    ...file,
    id: newFileRef.key!,
    userId,
    deviceId: 'shared',
  };
  await set(newFileRef, fileData);
  return newFileRef.key;
};

export const updateSharedFile = async (
  canvasId: string,
  fileId: string,
  updates: Partial<Omit<FirebaseFile, 'id' | 'userId' | 'deviceId'>>
) => {
  const fileRef = ref(database, `${getSharedFilesPath(canvasId)}/${fileId}`);
  await update(fileRef, updates);
};

export const deleteSharedFile = async (canvasId: string, fileId: string) => {
  const fileRef = ref(database, `${getSharedFilesPath(canvasId)}/${fileId}`);
  await remove(fileRef);
};

// Get user's shared canvases
export const getUserSharedCanvases = async (userId: string): Promise<Array<{
  canvasId: string;
  name: string;
  role: 'owner' | 'editor' | 'viewer';
  joinedAt: number;
  participantCount?: number;
}>> => {
  const userCanvasesRef = ref(database, getUserSharedCanvasesPath(userId));
  const snapshot = await new Promise<DataSnapshot>((resolve) => {
    onValue(userCanvasesRef, resolve, { onlyOnce: true });
  });
  
  const canvasesData = snapshot.val() || {};
  const canvasList = [];
  
  // Get additional info for each canvas
  for (const [canvasId, canvasInfo] of Object.entries(canvasesData)) {
    const canvasRef = ref(database, getSharedCanvasPath(canvasId));
    const canvasSnapshot = await new Promise<DataSnapshot>((resolve) => {
      onValue(canvasRef, resolve, { onlyOnce: true });
    });
    
    const canvasData = canvasSnapshot.val() as SharedCanvas;
    if (canvasData) {
      canvasList.push({
        ...(canvasInfo as any),
        participantCount: Object.keys(canvasData.participants || {}).length
      });
    }
  }
  
  return canvasList.sort((a, b) => b.joinedAt - a.joinedAt);
};

// Leave shared canvas
export const leaveSharedCanvas = async (userId: string, canvasId: string) => {
  // Get canvas data first
  const canvasRef = ref(database, getSharedCanvasPath(canvasId));
  const canvasSnapshot = await new Promise<DataSnapshot>((resolve) => {
    onValue(canvasRef, resolve, { onlyOnce: true });
  });
  
  const canvasData = canvasSnapshot.val() as SharedCanvas;
  if (!canvasData) {
    throw new Error('캔버스를 찾을 수 없습니다.');
  }
  
  // Check if user is the owner
  if (canvasData.owner === userId) {
    throw new Error('캔버스 소유자는 나갈 수 없습니다. 캔버스를 삭제하려면 모든 참여자를 제거하세요.');
  }
  
  // Remove from participants
  const participantRef = ref(database, `${getParticipantsPath(canvasId)}/${userId}`);
  await remove(participantRef);
  
  // Remove from presence
  const presenceRef = ref(database, `${getPresencePath(canvasId)}/${userId}`);
  await remove(presenceRef);
  
  // Remove from user's canvas list
  const userCanvasRef = ref(database, `${getUserSharedCanvasesPath(userId)}/${canvasId}`);
  await remove(userCanvasRef);
};

// Update canvas participant limit (for canvas owners)
export const updateCanvasParticipantLimit = async (
  canvasId: string,
  userId: string,
  newLimit: number
) => {
  // Verify the canvas exists
  const canvasRef = ref(database, getSharedCanvasPath(canvasId));
  const canvasSnapshot: DataSnapshot = await new Promise((resolve) => {
    onValue(canvasRef, resolve, { onlyOnce: true });
  });
  
  const canvasData = canvasSnapshot.val() as SharedCanvas;
  if (!canvasData) {
    throw new Error('캔버스를 찾을 수 없습니다.');
  }
  
  // Check if user is the owner
  if (canvasData.owner !== userId) {
    throw new Error('캔버스 소유자만 참여자 제한을 변경할 수 있습니다.');
  }
  
  // Update the participant limit
  const settingsRef = ref(database, `${getSharedCanvasPath(canvasId)}/shareSettings/maxParticipants`);
  await set(settingsRef, newLimit);
};
