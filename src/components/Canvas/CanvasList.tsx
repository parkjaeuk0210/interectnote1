import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useStoreMode } from '../../contexts/StoreProvider';
import { useSharedCanvasStore } from '../../store/sharedCanvasStore';
import { getUserSharedCanvases, leaveSharedCanvas, createSharedCanvas } from '../../lib/sharedCanvas';
import { useAppStore } from '../../contexts/StoreProvider';
import { database } from '../../lib/firebase';

interface CanvasListProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CanvasItem {
  canvasId: string;
  name: string;
  role: 'owner' | 'editor' | 'viewer';
  joinedAt: number;
  participantCount?: number;
}

export const CanvasList: React.FC<CanvasListProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const { isSharedMode } = useStoreMode();
  const { canvasId: currentCanvasId, leaveCanvas } = useSharedCanvasStore();
  const [sharedCanvases, setSharedCanvases] = useState<CanvasItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isCreating, setIsCreating] = useState(false);
  const [showNewCanvas, setShowNewCanvas] = useState(false);
  const [newCanvasName, setNewCanvasName] = useState('');
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(false);
  const closeTimeoutRef = useRef<number | null>(null);
  const notes = useAppStore((state) => state.notes);
  const images = useAppStore((state) => state.images);
  const files = useAppStore((state) => state.files);

  useEffect(() => {
    if (isOpen) {
      if (closeTimeoutRef.current) {
        window.clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }

      setShouldRender(true);
      setIsVisible(false);
      return;
    }

    setIsVisible(false);
    if (!shouldRender) return;

    closeTimeoutRef.current = window.setTimeout(() => {
      setShouldRender(false);
      closeTimeoutRef.current = null;
    }, 300);

    return () => {
      if (closeTimeoutRef.current) {
        window.clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
    };
  }, [isOpen, shouldRender]);

  useEffect(() => {
    if (!isOpen) return;

    const timeoutId = window.setTimeout(() => {
      setIsVisible(true);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (user && isOpen) {
      loadSharedCanvases();
    }
  }, [user, isOpen, refreshKey]);

  const loadSharedCanvases = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const canvases = await getUserSharedCanvases(user.uid);
      setSharedCanvases(canvases);
    } catch (error) {
      console.error('Failed to load shared canvases:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchToPersonal = () => {
    if (isSharedMode) {
      leaveCanvas();
    }
    window.location.href = '/';
  };

  const handleSwitchToShared = (canvasId: string) => {
    window.location.href = `/`;
    // After redirect, the app will need to load the shared canvas
    sessionStorage.setItem('loadSharedCanvas', canvasId);
  };

  const handleLeaveCanvas = async (canvasId: string) => {
    if (!user || !confirm('이 공유 캔버스에서 나가시겠습니까?')) return;

    try {
      await leaveSharedCanvas(user.uid, canvasId);
      if (currentCanvasId === canvasId) {
        leaveCanvas();
        window.location.href = '/';
      } else {
        setRefreshKey(prev => prev + 1);
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : '캔버스 나가기 실패');
    }
  };

  const handleCreateCanvas = async () => {
    if (!user || !newCanvasName.trim()) {
      alert('캔버스 이름을 입력해주세요');
      return;
    }
    
    // Check if Firebase is available
    if (!database) {
      alert('Firebase가 초기화되지 않았습니다. 로그인이 필요합니다.');
      return;
    }

    setIsCreating(true);
    try {
      // Convert notes to FirebaseNote format
      const firebaseNotes = notes.map(note => ({
        ...note,
        userId: user.uid,
        deviceId: 'web',
        createdAt: note.createdAt.getTime(),
        updatedAt: note.updatedAt.getTime()
      }));
      
      // Convert images to FirebaseImage format
      const firebaseImages = images.map(image => ({
        ...image,
        userId: user.uid,
        deviceId: 'web',
        createdAt: image.createdAt.getTime(),
        updatedAt: image.createdAt.getTime(), // Use createdAt since updatedAt doesn't exist
        storagePath: `images/${user.uid}/${image.id}` // Add required storagePath
      }));
      
      // Convert files to FirebaseFile format
      const firebaseFiles = files.map(file => ({
        ...file,
        userId: user.uid,
        deviceId: 'web',
        createdAt: file.createdAt.getTime(),
        updatedAt: file.createdAt.getTime(), // Use createdAt since updatedAt doesn't exist
        storagePath: `files/${user.uid}/${file.id}`, // Add required storagePath
        mimeType: file.fileType === 'document' ? 'application/pdf' : 
                 file.fileType === 'image' ? 'image/png' : 'application/octet-stream'
      }));

      const canvasId = await createSharedCanvas(
        user.uid,
        user.email || '',
        newCanvasName,
        firebaseNotes,
        firebaseImages,
        firebaseFiles
      );
      
      // Navigate to the new canvas
      sessionStorage.setItem('loadSharedCanvas', canvasId);
      window.location.href = '/';
    } catch (error) {
      console.error('Failed to create canvas:', error);
      if (error instanceof Error) {
        console.error('Error details:', error.message, error.stack);
        alert(`캔버스 생성 실패: ${error.message}`);
      } else {
        alert('캔버스 생성에 실패했습니다');
      }
    } finally {
      setIsCreating(false);
      setNewCanvasName('');
      setShowNewCanvas(false);
    }
  };

  if (!isOpen && !shouldRender) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] transition-opacity duration-300 ease-out motion-reduce:transition-none ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />
      
      {/* Sidebar */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="캔버스 목록"
        className={`fixed left-0 top-0 h-full w-80 max-w-[calc(100vw-3rem)] glass rounded-r-2xl shadow-xl z-50 transform-gpu transition-[transform,opacity] duration-300 ease-out motion-reduce:transition-none ${
          isVisible ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0'
        }`}
      >
        <div className="h-full px-6 pb-[calc(var(--safe-bottom)+1.5rem)] pt-[calc(var(--safe-top)+1.5rem)] overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              내 캔버스
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Personal Canvas */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">개인 캔버스</h3>
            <button
              onClick={handleSwitchToPersonal}
              className={`w-full text-left p-3 rounded-lg transition-colors ${
                !isSharedMode 
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' 
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <div className="flex items-center">
                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <span className="font-medium">내 캔버스</span>
              </div>
            </button>
          </div>

          {/* Shared Canvases */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">공유 캔버스</h3>
              <button
                onClick={() => {
                  setShowNewCanvas(true);
                  setNewCanvasName('');
                }}
                className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
                title="새 캔버스 만들기"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
            
            {/* New Canvas Input */}
            {showNewCanvas && (
              <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <input
                  type="text"
                  value={newCanvasName}
                  onChange={(e) => setNewCanvasName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateCanvas();
                    if (e.key === 'Escape') {
                      setNewCanvasName('');
                      setShowNewCanvas(false);
                    }
                  }}
                  placeholder="캔버스 이름 입력..."
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={handleCreateCanvas}
                    disabled={!newCanvasName.trim() || isCreating}
                    className="flex-1 px-3 py-1.5 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isCreating ? '생성 중...' : '생성'}
                  </button>
                  <button
                    onClick={() => {
                      setNewCanvasName('');
                      setShowNewCanvas(false);
                    }}
                    className="px-3 py-1.5 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm rounded-md hover:bg-gray-300 dark:hover:bg-gray-500"
                  >
                    취소
                  </button>
                </div>
              </div>
            )}
            
            {loading ? (
              <div className="text-center py-4">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              </div>
            ) : sharedCanvases.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                참여 중인 공유 캔버스가 없습니다
              </p>
            ) : (
              <div className="space-y-2">
                {sharedCanvases.map((canvas) => (
                  <div
                    key={canvas.canvasId}
                    className={`p-3 rounded-lg transition-colors ${
                      currentCanvasId === canvas.canvasId
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <button
                      onClick={() => handleSwitchToShared(canvas.canvasId)}
                      className="w-full text-left"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center flex-1">
                          <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m9.032 4.026a3 3 0 10-5.464 0m5.464 0a3 3 0 10-5.464 0M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div>
                            <p className="font-medium">{canvas.name}</p>
                            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                              <span>{canvas.role === 'owner' ? '소유자' : canvas.role === 'editor' ? '편집자' : '뷰어'}</span>
                              {canvas.participantCount && (
                                <>
                                  <span>•</span>
                                  <span>👥 {canvas.participantCount}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {canvas.role !== 'owner' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleLeaveCanvas(canvas.canvasId);
                            }}
                            className="ml-2 p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                            title="나가기"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
