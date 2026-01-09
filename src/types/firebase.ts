export interface FirebaseNote {
  id: string;
  content: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  zIndex?: number;
  isImportant?: boolean;
  createdAt: number;
  updatedAt: number;
  userId: string;
  deviceId: string;
}

export interface FirebaseImage {
  id: string;
  url: string;
  storagePath: string;
  x: number;
  y: number;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  fileName: string;
  fileSize: number;
  createdAt: number;
  userId: string;
  deviceId: string;
}

export interface FirebaseFile {
  id: string;
  url: string;
  storagePath: string;
  x: number;
  y: number;
  fileName: string;
  fileSize: number;
  mimeType: string;
  createdAt: number;
  userId: string;
  deviceId: string;
}

export interface FirebaseUserData {
  notes: Record<string, FirebaseNote>;
  images: Record<string, FirebaseImage>;
  files: Record<string, FirebaseFile>;
  settings: {
    isDarkMode: boolean;
    language: string;
    lastSyncTime: number;
  };
}
