export type ParticipantRole = 'viewer' | 'editor';

export interface CanvasParticipant {
  userId: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  role: ParticipantRole;
  joinedAt: number;
  lastActiveAt: number;
  isOnline?: boolean;
  cursorPosition?: {
    x: number;
    y: number;
  };
  selectedItemId?: string;
  color?: string; // Unique color for this participant
}

export interface SharedCanvas {
  id: string;
  name: string;
  owner: string;
  ownerEmail: string;
  participants: Record<string, CanvasParticipant>;
  createdAt: number;
  updatedAt: number;
  isPublic: boolean;
  shareSettings?: ShareSettings;
}

export interface ShareSettings {
  allowPublicAccess: boolean;
  requirePassword: boolean;
  password?: string;
  expiresAt?: number;
  maxParticipants?: number;
  defaultRole: ParticipantRole;
}

export interface ShareToken {
  token: string;
  canvasId: string;
  createdBy: string;
  createdAt: number;
  expiresAt?: number;
  role: ParticipantRole;
  used: boolean;
  usedBy?: string;
  usedAt?: number;
}

export interface PresenceData {
  userId: string;
  isOnline: boolean;
  lastActiveAt: number;
  cursorPosition?: {
    x: number;
    y: number;
  };
  selectedItemId?: string;
}
