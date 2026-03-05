import { get, ref, set } from 'firebase/database';
import { database } from './firebase';

export interface DeviceSyncCodeRecord {
  code: string;
  token: string;
  canvasId: string;
  createdBy: string;
  createdAt: number;
  expiresAt: number;
}

const DEVICE_SYNC_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const DEVICE_SYNC_CODE_LENGTH = 6;
const DEFAULT_EXPIRES_IN_MS = 10 * 60 * 1000; // 10 minutes

const getDeviceSyncCodePath = (code: string) => `device_sync_codes/${code}`;

export function normalizeDeviceSyncCode(input: string): string {
  return (input || '')
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '') // remove spaces/dashes
    .replace(/[ILO01]/g, ''); // drop ambiguous characters entirely
}

export function formatDeviceSyncCode(code: string): string {
  const normalized = normalizeDeviceSyncCode(code);
  if (normalized.length <= 3) return normalized;
  return `${normalized.slice(0, 3)}-${normalized.slice(3, 6)}`;
}

function generateDeviceSyncCode(): string {
  const bytes = new Uint8Array(DEVICE_SYNC_CODE_LENGTH);
  crypto.getRandomValues(bytes);

  let code = '';
  for (let i = 0; i < bytes.length; i++) {
    const idx = bytes[i] % DEVICE_SYNC_CODE_ALPHABET.length;
    code += DEVICE_SYNC_CODE_ALPHABET[idx];
  }
  return code;
}

export async function createDeviceSyncCodeRecord(params: {
  token: string;
  canvasId: string;
  createdBy: string;
  expiresInMs?: number;
}): Promise<DeviceSyncCodeRecord> {
  if (!database) {
    throw new Error('Firebase database is not initialized');
  }

  const createdAt = Date.now();
  const expiresAt = createdAt + (params.expiresInMs ?? DEFAULT_EXPIRES_IN_MS);

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateDeviceSyncCode();
    const codeRef = ref(database, getDeviceSyncCodePath(code));
    const existing = await get(codeRef);
    const existingVal = existing.val() as Partial<DeviceSyncCodeRecord> | null;

    // Avoid overwriting an active code (rare, but possible).
    if (existingVal?.expiresAt && existingVal.expiresAt > Date.now()) {
      continue;
    }

    const record: DeviceSyncCodeRecord = {
      code,
      token: params.token,
      canvasId: params.canvasId,
      createdBy: params.createdBy,
      createdAt,
      expiresAt,
    };

    await set(codeRef, record);
    return record;
  }

  throw new Error('동기화 코드 생성에 실패했습니다. 잠시 후 다시 시도해주세요.');
}

export async function getDeviceSyncCodeRecord(codeInput: string): Promise<DeviceSyncCodeRecord | null> {
  if (!database) {
    throw new Error('Firebase database is not initialized');
  }

  const code = normalizeDeviceSyncCode(codeInput);
  if (!code) return null;

  const snapshot = await get(ref(database, getDeviceSyncCodePath(code)));
  const data = snapshot.val() as DeviceSyncCodeRecord | null;
  return data;
}

