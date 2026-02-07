import React, { useEffect, useRef } from 'react';
import { useSharedCanvasStore } from '../../store/sharedCanvasStore';
import { useAuth } from '../../contexts/AuthContext';
import { ParticipantRole } from '../../types/sharing';
import { toast } from '../../utils/toast';

interface CollaboratorsListProps {
  onClose: () => void;
}

export const CollaboratorsList: React.FC<CollaboratorsListProps> = ({ onClose }) => {
  const { user } = useAuth();
  const { 
    participants, 
    presence, 
    isOwner, 
    removeParticipant, 
    updateParticipantRole,
    canvasInfo 
  } = useSharedCanvasStore();
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  if (!canvasInfo || Object.keys(participants).length <= 1) {
    return null;
  }

  const handleRemoveParticipant = async (participantId: string) => {
    if (confirm('이 참여자를 제거하시겠습니까?')) {
      try {
        await removeParticipant(participantId);
      } catch (error) {
        toast.error('참여자 제거에 실패했습니다.');
      }
    }
  };

  const handleRoleChange = async (participantId: string, newRole: ParticipantRole) => {
    try {
      await updateParticipantRole(participantId, newRole);
    } catch (error) {
      toast.error('권한 변경에 실패했습니다.');
    }
  };

  const getOnlineStatus = (userId: string) => {
    const userPresence = presence[userId];
    if (!userPresence) return false;
    
    // Consider online if active within last 5 minutes
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    return userPresence.isOnline && userPresence.lastActiveAt > fiveMinutesAgo;
  };

  return (
    <div ref={containerRef} className="fixed top-[calc(var(--safe-top)+5rem)] right-[calc(var(--safe-right)+1.5rem)] bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 max-w-xs w-64 z-40">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          참여자 ({Object.keys(participants).length})
        </h3>
        <button
          onClick={onClose}
          className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          title="닫기"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-2 max-h-80 overflow-y-auto">
        {Object.entries(participants).map(([userId, participant]) => {
          const isOnline = getOnlineStatus(userId);
          const isCurrentUser = userId === user?.uid;
          const isCanvasOwner = userId === canvasInfo.owner;

          return (
            <div
              key={userId}
              className="flex items-center justify-between p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center gap-2 flex-1">
                {/* User Avatar with online indicator */}
                <div className="relative">
                  {participant.photoURL ? (
                    <img
                      src={participant.photoURL}
                      alt={participant.displayName || participant.email}
                      className="w-8 h-8 rounded-full"
                    />
                  ) : (
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                      style={{ backgroundColor: participant.color }}
                    >
                      {(participant.displayName || participant.email)[0].toUpperCase()}
                    </div>
                  )}
                  {isOnline && (
                    <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white dark:border-gray-800" />
                  )}
                </div>

                {/* User Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {participant.displayName || participant.email.split('@')[0]}
                      {isCurrentUser && ' (나)'}
                    </p>
                    {isCanvasOwner && (
                      <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded">
                        소유자
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {participant.role === 'editor' ? '편집 가능' : '보기 전용'}
                  </p>
                </div>
              </div>

              {/* Actions for owner */}
              {isOwner && !isCanvasOwner && !isCurrentUser && (
                <div className="flex items-center gap-1">
                  <select
                    value={participant.role}
                    onChange={(e) => handleRoleChange(userId, e.target.value as ParticipantRole)}
                    className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                  >
                    <option value="viewer">보기</option>
                    <option value="editor">편집</option>
                  </select>
                  
                  <button
                    onClick={() => handleRemoveParticipant(userId)}
                    className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                    title="참여자 제거"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Active cursor indicators */}
      {Object.entries(presence).some(([userId, p]) => p.cursorPosition && userId !== user?.uid) && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">활동 중인 사용자</p>
          <div className="flex gap-1 flex-wrap">
            {Object.entries(presence).map(([userId, presenceData]) => {
              if (!presenceData.cursorPosition || userId === user?.uid) return null;
              const participant = participants[userId];
              if (!participant) return null;

              return (
                <div
                  key={userId}
                  className="w-2 h-2 rounded-full animate-pulse"
                  style={{ backgroundColor: participant.color }}
                  title={participant.displayName || participant.email}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
