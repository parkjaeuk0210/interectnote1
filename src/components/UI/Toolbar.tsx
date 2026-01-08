import { useRef, useEffect, useState } from 'react';
import { useAppStore } from '../../contexts/StoreProvider';
import { ColorPicker } from './ColorPicker';
import { FileType } from '../../types';
import { compressImage, getDataUrlSize, formatBytes } from '../../utils/imageCompression';
import { getLocalStorageUsagePercent, isLocalStorageNearLimit } from '../../utils/storageUtils';
import { useAuth } from '../../contexts/AuthContext';
import { ShareModal } from '../Sharing/ShareModal';
import { useSharedCanvasStore } from '../../store/sharedCanvasStore';
import { toast } from '../../utils/toast';

interface ToolbarProps {
  isSharedMode?: boolean;
  showCollaborators?: boolean;
  onToggleCollaborators?: () => void;
}

export const Toolbar = ({ isSharedMode, showCollaborators, onToggleCollaborators }: ToolbarProps) => {
  const { user } = useAuth();
  const notes = useAppStore((state) => state.notes);
  const selectedNoteId = useAppStore((state) => state.selectedNoteId);
  const selectedImageId = useAppStore((state) => state.selectedImageId);
  const selectedFileId = useAppStore((state) => state.selectedFileId);
  const deleteNote = useAppStore((state) => state.deleteNote);
  const deleteImage = useAppStore((state) => state.deleteImage);
  const deleteFile = useAppStore((state) => state.deleteFile);
  const clearCanvas = useAppStore((state) => state.clearCanvas);
  const viewport = useAppStore((state) => state.viewport);
  const updateNote = useAppStore((state) => state.updateNote);
  const addImage = useAppStore((state) => state.addImage);
  const addFile = useAppStore((state) => state.addFile);
  const images = useAppStore((state) => state.images);
  const files = useAppStore((state) => state.files);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedNote = notes.find(n => n.id === selectedNoteId);
  const [storageUsage, setStorageUsage] = useState(0);
  const [showShareModal, setShowShareModal] = useState(false);
  const { participants } = useSharedCanvasStore();
  
  // ✅ FIX: Monitor storage usage only when dependencies change
  // No need for setInterval since we already have dependencies tracking changes
  useEffect(() => {
    setStorageUsage(getLocalStorageUsagePercent());
  }, [notes.length, images.length, files.length]);

  const handleDelete = () => {
    if (selectedNoteId) {
      deleteNote(selectedNoteId);
    } else if (selectedImageId) {
      deleteImage(selectedImageId);
    } else if (selectedFileId) {
      deleteFile(selectedFileId);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        const url = e.target?.result as string;
        const fileType = file.type;
        
        // Calculate position for new item
        const x = (window.innerWidth / 2 - viewport.x) / viewport.scale;
        const y = (window.innerHeight / 2 - viewport.y) / viewport.scale;
        
        if (fileType.startsWith('image/')) {
          try {
            // Check storage before adding
            if (isLocalStorageNearLimit()) {
              toast.error('저장 공간이 부족합니다. 일부 항목을 삭제한 후 다시 시도해주세요.');
              return;
            }
            
            // Compress image before storing
            const compressedUrl = await compressImage(url);
            const compressedSize = getDataUrlSize(compressedUrl);
            
            // Check if compressed size is reasonable for localStorage
            if (compressedSize > 3 * 1024 * 1024) { // 3MB limit per image (increased from 1MB)
              toast.warning(`이미지 "${file.name}"의 크기가 너무 큽니다 (${formatBytes(compressedSize)}). 더 작은 이미지를 사용해주세요.`);
              return;
            }
            
            // Get original dimensions first
            const originalImg = new Image();
            originalImg.onload = () => {
              const originalWidth = originalImg.width;
              const originalHeight = originalImg.height;
              
              // Handle compressed image
              const img = new Image();
              img.onload = () => {
                const maxSize = 400;
                let width = originalWidth;
                let height = originalHeight;
                
                if (width > maxSize || height > maxSize) {
                  const ratio = Math.min(maxSize / width, maxSize / height);
                  width *= ratio;
                  height *= ratio;
                }
                
                addImage({
                  x,
                  y,
                  width,
                  height,
                  url: compressedUrl,
                  originalWidth: originalWidth,
                  originalHeight: originalHeight,
                  fileName: file.name,
                  fileSize: compressedSize,
                });
                
                console.log(`Image compressed: ${formatBytes(file.size)} → ${formatBytes(compressedSize)}`);
              };
              img.src = compressedUrl;
            };
            originalImg.src = url;
          } catch (error) {
            console.error('Image compression failed:', error);
            toast.error(`이미지 처리 중 오류가 발생했습니다: ${file.name}`);
          }
        } else {
          // Handle other files
          let fileTypeCategory: FileType = 'other';
          if (fileType === 'application/pdf') fileTypeCategory = 'pdf';
          else if (fileType.includes('document') || fileType.includes('text')) fileTypeCategory = 'document';
          
          // Check file size for non-images - PDF files get higher limit
          const fileDataSize = getDataUrlSize(url);
          const sizeLimit = fileTypeCategory === 'pdf' 
            ? 10 * 1024 * 1024  // 10MB limit for PDF files
            : 2 * 1024 * 1024;  // 2MB limit for other files (increased from 500KB)
          
          if (fileDataSize > sizeLimit) {
            const limitText = fileTypeCategory === 'pdf' ? '10MB' : '2MB';
            toast.warning(`파일 "${file.name}"의 크기가 너무 큽니다 (${formatBytes(fileDataSize)}). ${limitText} 이하의 파일을 사용해주세요.`);
            return;
          }
          
          addFile({
            x,
            y,
            width: 200,
            height: 240,
            fileName: file.name,
            fileType: fileTypeCategory,
            fileSize: file.size,
            url,
          });
        }
      };
      
      reader.readAsDataURL(file);
    }
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed right-6 bottom-24 glass rounded-full px-3 py-6 shadow-lg">
      <div className="flex flex-col items-center gap-4">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.pdf,.doc,.docx,.txt"
          onChange={handleFileUpload}
          className="hidden"
        />
        
        <button
          onClick={() => fileInputRef.current?.click()}
          className="glass-button rounded-full p-3 hover:scale-105 transition-transform text-gray-700 dark:text-gray-200"
          title="파일 추가"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
	        </button>

	        {user && (
	          <>
	            <div className="w-6 h-px bg-gray-300" />
            
            <button
              onClick={() => setShowShareModal(true)}
              className="glass-button rounded-full p-3 hover:scale-105 transition-transform text-gray-700 dark:text-gray-200"
              title="공유하기"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m9.032 4.026a3 3 0 10-5.464 0m5.464 0a3 3 0 10-5.464 0M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            
            {/* Show participants button in shared mode */}
            {isSharedMode && Object.keys(participants).length > 1 && (
              <button
                onClick={onToggleCollaborators}
                className={`glass-button rounded-full p-3 hover:scale-105 transition-transform text-gray-700 dark:text-gray-200 ${
                  showCollaborators ? 'bg-blue-500 bg-opacity-20' : ''
                }`}
                title={showCollaborators ? "참여자 목록 숨기기" : "참여자 목록 보기"}
              >
                <div className="relative">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                    {Object.keys(participants).length}
                  </span>
                </div>
              </button>
            )}
          </>
        )}

        <div className="text-sm text-gray-600">
          {Math.round(viewport.scale * 100)}%
          {storageUsage > 50 && (
            <span className={`ml-2 ${storageUsage > 80 ? 'text-red-500' : 'text-orange-500'}`}>
              | 저장공간 {storageUsage}%
            </span>
          )}
        </div>

        {selectedNote && (
          <>
            <div className="w-6 h-px bg-gray-300" />
            
            <ColorPicker
              currentColor={selectedNote.color}
              onColorChange={(color) => selectedNoteId && updateNote(selectedNoteId, { color })}
            />
            
            <button
              onClick={handleDelete}
              className="glass-button rounded-full p-3 hover:scale-105 transition-transform text-red-600 dark:text-red-400"
              title="메모 삭제"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </>
        )}
        
        {(selectedImageId || selectedFileId) && (
          <>
            <div className="w-6 h-px bg-gray-300" />
            
            <button
              onClick={handleDelete}
              className="glass-button rounded-full p-3 hover:scale-105 transition-transform text-red-600 dark:text-red-400"
              title="삭제"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </>
        )}

        {notes.length > 0 && (
          <>
            <div className="w-6 h-px bg-gray-300" />
            
            <button
              onClick={() => {
                if (confirm('모든 메모를 삭제하시겠습니까?')) {
                  clearCanvas();
                }
              }}
              className="glass-button rounded-full p-3 hover:scale-105 transition-transform text-red-500"
              title="모두 지우기"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z" />
              </svg>
            </button>
          </>
        )}
      </div>

      {/* Share Modal */}
      {showShareModal && (
        <ShareModal 
          isOpen={showShareModal} 
          onClose={() => setShowShareModal(false)} 
        />
      )}
    </div>
  );
};
