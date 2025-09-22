import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSharedCanvasStore } from '../../store/sharedCanvasStore';
import { useAppStore } from '../../contexts/StoreProvider';
import { useAuth } from '../../contexts/AuthContext';
import { ParticipantRole } from '../../types/sharing';
import { checkRateLimit, RATE_LIMITS, formatRetryMessage } from '../../utils/rateLimit';
import { toast } from '../../utils/toast';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [canvasName, setCanvasName] = useState('');
  const [shareLink, setShareLink] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [shareRole, setShareRole] = useState<ParticipantRole>('viewer');
  const [linkExpiry, setLinkExpiry] = useState<number | undefined>(undefined);
  const [copySuccess, setCopySuccess] = useState(false);
  
  const { canvasId, isOwner, generateShareLink, createCanvas } = useSharedCanvasStore();
  const notes = useAppStore((state) => state.notes);

  // Handle ESC key press
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      return () => document.removeEventListener('keydown', handleEsc);
    }
  }, [isOpen, onClose]);

  const handleCreateSharedCanvas = async () => {
    if (!user || !canvasName.trim()) return;
    
    setIsCreating(true);
    try {
      await createCanvas(canvasName);
      // Canvas created successfully
      setCanvasName('');
    } catch (error) {
      console.error('Failed to create shared canvas:', error);
      toast.error('캔버스 생성에 실패했습니다.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleGenerateLink = async () => {
    if (!canvasId || !isOwner) return;
    
    // Check rate limit for share token generation
    const rateLimitCheck = await checkRateLimit(RATE_LIMITS.SHARE_TOKEN_GENERATION);
    if (!rateLimitCheck.allowed) {
      alert(`공유 링크 생성 제한: ${formatRetryMessage(rateLimitCheck.retryAfter || 60)}`);
      return;
    }
    
    try {
      const link = await generateShareLink(shareRole, linkExpiry);
      // Make sure the link includes the full URL
      const fullLink = link.startsWith('http') ? link : `${window.location.origin}${link}`;
      setShareLink(fullLink);
      setCopySuccess(false);
    } catch (error) {
      console.error('Failed to generate share link:', error);
      toast.error('공유 링크 생성에 실패했습니다.');
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  if (!isOpen) return null;

  const modalContent = (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-[100] p-4 sm:p-6 pt-10 sm:pt-20 overflow-y-auto"
      onClick={(e) => {
        // Close modal when clicking outside
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full max-h-[70vh] sm:max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white text-center">
            캔버스 공유
          </h2>
        </div>

        {!canvasId ? (
          // Create new shared canvas
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              현재 메모를 공유 캔버스로 변환하여 친구들과 함께 편집할 수 있습니다.
            </p>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                캔버스 이름
              </label>
              <input
                type="text"
                value={canvasName}
                onChange={(e) => setCanvasName(e.target.value)}
                placeholder="예: 프로젝트 아이디어"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                현재 {notes.length}개의 메모가 공유 캔버스로 복사됩니다.
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                최대 10명까지 참여 가능 (본인 포함)
              </p>
            </div>

            <button
              onClick={handleCreateSharedCanvas}
              disabled={!canvasName.trim() || isCreating}
              className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-medium rounded-md transition-colors"
            >
              {isCreating ? '생성 중...' : '공유 캔버스 만들기'}
            </button>
          </div>
        ) : (
          // Share existing canvas
          <div className="space-y-4">
            {isOwner ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    권한 설정
                  </label>
                  <select
                    value={shareRole}
                    onChange={(e) => setShareRole(e.target.value as ParticipantRole)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="viewer">보기 전용</option>
                    <option value="editor">편집 가능</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    만료 시간 (선택사항)
                  </label>
                  <select
                    value={linkExpiry || ''}
                    onChange={(e) => setLinkExpiry(e.target.value ? Number(e.target.value) : undefined)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">만료 없음</option>
                    <option value="1">1시간</option>
                    <option value="24">24시간</option>
                    <option value="168">7일</option>
                  </select>
                </div>

                <button
                  onClick={handleGenerateLink}
                  className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-md transition-colors"
                >
                  공유 링크 생성
                </button>

                {shareLink && (
                  <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        공유 링크
                      </span>
                      {copySuccess && (
                        <span className="text-sm text-green-600 dark:text-green-400">
                          복사됨!
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={shareLink}
                        readOnly
                        className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                      <button
                        onClick={handleCopyLink}
                        className="px-3 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 rounded-md transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-gray-600 dark:text-gray-400">
                  현재 공유 캔버스에 참여 중입니다.
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                  캔버스 소유자만 공유 링크를 생성할 수 있습니다.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  if (typeof document === 'undefined') {
    return modalContent;
  }

  return createPortal(modalContent, document.body);
};
