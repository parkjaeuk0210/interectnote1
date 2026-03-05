import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useStoreMode, useAppStore } from '../../contexts/StoreProvider';
import { useSharedCanvasStore } from '../../store/sharedCanvasStore';
import { auth, database } from '../../lib/firebase';
import { signInAsGuest } from '../../utils/auth';
import { generateGuestName } from '../../lib/firebase';
import { createSharedCanvas, generateShareLink } from '../../lib/sharedCanvas';
import {
  createDeviceSyncCodeRecord,
  formatDeviceSyncCode,
  getDeviceSyncCodeRecord,
  normalizeDeviceSyncCode,
} from '../../lib/deviceSync';
import { FirebaseFile, FirebaseImage, FirebaseNote } from '../../types/firebase';
import { CanvasFile, CanvasImage, Note } from '../../types';
import { checkRateLimit, RATE_LIMITS, formatRetryMessage } from '../../utils/rateLimit';
import { toast } from '../../utils/toast';
import { useTranslation } from '../../contexts/I18nContext';

interface DeviceSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Mode = 'create' | 'join';

function inferMimeType(file: CanvasFile): string {
  if (file.fileType === 'pdf') return 'application/pdf';
  if (file.fileType === 'image') return 'image/png';
  if (file.fileType === 'document') return 'application/octet-stream';
  return 'application/octet-stream';
}

function toFirebaseNotes(notes: Note[], userId: string): FirebaseNote[] {
  return notes.map((note) => ({
    id: note.id,
    content: note.content,
    x: note.x,
    y: note.y,
    width: note.width,
    height: note.height,
    color: note.color,
    zIndex: note.zIndex,
    createdAt: note.createdAt.getTime(),
    updatedAt: note.updatedAt.getTime(),
    userId,
    deviceId: 'device_sync',
  }));
}

function toFirebaseImages(images: CanvasImage[], userId: string): FirebaseImage[] {
  return images.map((image) => ({
    id: image.id,
    url: image.url,
    storagePath: '',
    x: image.x,
    y: image.y,
    width: image.width,
    height: image.height,
    originalWidth: image.originalWidth,
    originalHeight: image.originalHeight,
    fileName: image.fileName,
    fileSize: image.fileSize,
    createdAt: image.createdAt.getTime(),
    userId,
    deviceId: 'device_sync',
  }));
}

function toFirebaseFiles(files: CanvasFile[], userId: string): FirebaseFile[] {
  return files.map((file) => ({
    id: file.id,
    url: file.url,
    storagePath: '',
    x: file.x,
    y: file.y,
    fileName: file.fileName,
    fileSize: file.fileSize,
    mimeType: inferMimeType(file),
    createdAt: file.createdAt.getTime(),
    userId,
    deviceId: 'device_sync',
  }));
}

export const DeviceSyncModal: React.FC<DeviceSyncModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const { user, loading, isAnonymous } = useAuth();
  const { isSharedMode } = useStoreMode();
  const sharedStore = useSharedCanvasStore();

  const notes = useAppStore((s) => s.notes);
  const images = useAppStore((s) => s.images);
  const files = useAppStore((s) => s.files);

  const [mode, setMode] = useState<Mode>('create');
  const [generatedCode, setGeneratedCode] = useState<string>('');
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [inputCode, setInputCode] = useState<string>('');
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canUseFirebase = !!database && !!auth;

  useEffect(() => {
    if (isOpen) {
      setMode('create');
      setGeneratedCode('');
      setExpiresAt(null);
      setInputCode('');
      setIsWorking(false);
      setError(null);
    }
  }, [isOpen]);

  const timeLeftText = useMemo(() => {
    if (!expiresAt) return '';
    const ms = expiresAt - Date.now();
    if (ms <= 0) return t('deviceSyncCodeExpired');
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return t('deviceSyncCodeExpiresIn', minutes, seconds.toString().padStart(2, '0'));
  }, [expiresAt, t]);

  const ensureGuestAuth = async () => {
    if (!auth) {
      throw new Error('Firebase auth is not initialized');
    }

    if (auth.currentUser) return auth.currentUser;

    const rateLimitCheck = await checkRateLimit(RATE_LIMITS.ANONYMOUS_SIGNIN);
    if (!rateLimitCheck.allowed) {
      throw new Error(formatRetryMessage(rateLimitCheck.retryAfter || 60));
    }

    const result = await signInAsGuest();
    if (result.error || !result.user) {
      throw new Error(t('deviceSyncGuestSignInFailed'));
    }
    return result.user;
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(normalizeDeviceSyncCode(generatedCode));
      toast.success(t('deviceSyncCodeCopied'));
    } catch {
      toast.error(t('deviceSyncCodeCopyFailed'));
    }
  };

  const handleCreateCode = async () => {
    if (!canUseFirebase) {
      setError(t('deviceSyncFirebaseNotConfigured'));
      return;
    }

    setIsWorking(true);
    setError(null);

    try {
      const authedUser = user ?? (await ensureGuestAuth());

      let canvasId = sharedStore.canvasId;
      if (!canvasId) {
        const canvasName = t('deviceSyncDefaultCanvasName');
        const newCanvasId = await createSharedCanvas(
          authedUser.uid,
          authedUser.email || 'anonymous@interectnote.app',
          canvasName,
          toFirebaseNotes(notes, authedUser.uid),
          toFirebaseImages(images, authedUser.uid),
          toFirebaseFiles(files, authedUser.uid)
        );
        sharedStore.initializeSharedCanvas(newCanvasId);
        canvasId = newCanvasId;
      } else if (isSharedMode && !sharedStore.isOwner) {
        throw new Error(t('deviceSyncOnlyOwnerCanCreate'));
      }

      const token = await generateShareLink(canvasId, authedUser.uid, 'editor', 0.25); // 15 minutes
      const record = await createDeviceSyncCodeRecord({
        token,
        canvasId,
        createdBy: authedUser.uid,
      });

      setGeneratedCode(formatDeviceSyncCode(record.code));
      setExpiresAt(record.expiresAt);
    } catch (err) {
      const message = err instanceof Error ? err.message : t('deviceSyncUnknownError');
      setError(message);
    } finally {
      setIsWorking(false);
    }
  };

  const handleJoinCode = async () => {
    if (!canUseFirebase) {
      setError(t('deviceSyncFirebaseNotConfigured'));
      return;
    }

    const normalized = normalizeDeviceSyncCode(inputCode);
    if (!normalized) {
      setError(t('deviceSyncEnterCode'));
      return;
    }

    setIsWorking(true);
    setError(null);

    try {
      const authedUser = user ?? (await ensureGuestAuth());
      const record = await getDeviceSyncCodeRecord(normalized);
      if (!record) {
        throw new Error(t('deviceSyncCodeNotFound'));
      }
      if (record.expiresAt < Date.now()) {
        throw new Error(t('deviceSyncCodeExpired'));
      }

      const displayName = (isAnonymous || authedUser.isAnonymous) ? generateGuestName() : undefined;
      await sharedStore.joinCanvas(record.token, displayName);

      toast.success(t('deviceSyncLinked'));
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : t('deviceSyncUnknownError');
      setError(message);
    } finally {
      setIsWorking(false);
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 max-w-lg w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t('deviceSyncTitle')}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label={t('deviceSyncClose')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{t('deviceSyncDescription')}</p>

        {!canUseFirebase && (
          <div className="mb-4 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-sm text-yellow-700 dark:text-yellow-200">
            {t('deviceSyncFirebaseNotConfigured')}
          </div>
        )}

        {loading && (
          <div className="py-10 text-center">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-gray-600 dark:text-gray-400">{t('deviceSyncLoading')}</p>
          </div>
        )}

        {!loading && (
          <>
            {!user && canUseFirebase && (
              <div className="mb-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-sm text-blue-700 dark:text-blue-200">
                {t('deviceSyncGuestOk')}
              </div>
            )}

            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setMode('create')}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  mode === 'create'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {t('deviceSyncCreateTab')}
              </button>
              <button
                onClick={() => setMode('join')}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  mode === 'join'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {t('deviceSyncJoinTab')}
              </button>
            </div>

            {mode === 'create' ? (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 text-sm text-gray-700 dark:text-gray-200">
                  {t('deviceSyncCreateHint')}
                </div>

                <button
                  onClick={handleCreateCode}
                  disabled={isWorking || !canUseFirebase}
                  className="w-full px-4 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {isWorking ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      {t('deviceSyncCreating')}
                    </>
                  ) : (
                    t('deviceSyncCreateButton')
                  )}
                </button>

                {generatedCode && (
                  <div className="mt-2 p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{t('deviceSyncYourCode')}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{timeLeftText}</span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        value={generatedCode}
                        readOnly
                        className="flex-1 px-3 py-2 text-lg tracking-widest font-mono border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                      <button
                        onClick={handleCopyCode}
                        className="px-3 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 rounded-md transition-colors"
                        title={t('deviceSyncCopy')}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 text-sm text-gray-700 dark:text-gray-200">
                  {t('deviceSyncJoinHint')}
                </div>

                <input
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value)}
                  placeholder={t('deviceSyncCodePlaceholder')}
                  className="w-full px-3 py-2 text-base border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />

                <button
                  onClick={handleJoinCode}
                  disabled={isWorking || !canUseFirebase}
                  className="w-full px-4 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {isWorking ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      {t('deviceSyncJoining')}
                    </>
                  ) : (
                    t('deviceSyncJoinButton')
                  )}
                </button>
              </div>
            )}

            {error && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-200 rounded-lg text-sm">
                {error}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  if (typeof document === 'undefined') return modalContent;
  return createPortal(modalContent, document.body);
};

