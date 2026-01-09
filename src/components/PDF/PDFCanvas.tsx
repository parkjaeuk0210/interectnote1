import { useState, useEffect } from 'react';
import { Group, Rect, Text, Image as KonvaImage } from 'react-konva';
import { pdfjs } from 'react-pdf';
import Konva from 'konva';
import { CanvasFile, DrawingTool, DrawingAnnotation } from '../../types';
import { PDFAnnotationLayer } from './PDFAnnotationLayer';
import { DrawingToolbar, useDrawingKeyboardShortcuts } from './DrawingToolbar';
import { useAppStore } from '../../contexts/StoreProvider';
import { useAppActivity } from '../../hooks/useAppActivity';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// PDF.js worker 설정
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface PDFCanvasProps {
  file: CanvasFile;
  isSelected: boolean;
  onSelect: () => void;
  onDraggingChange?: (isDragging: boolean) => void;
}

export const PDFCanvas = ({ 
  file, 
  isSelected, 
  onSelect,
  onDraggingChange
}: PDFCanvasProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isDrawingMode, setIsDrawingMode] = useState(file.isDrawingMode || false);
  const [currentTool, setCurrentTool] = useState<DrawingTool>('pen');
  const [pdfImage, setPdfImage] = useState<HTMLImageElement | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage] = useState<number>(1);

  const updateFile = useAppStore((state) => state.updateFile);
  const { isVisible: isAppVisible, isIdle: isAppIdle } = useAppActivity({ idleMs: 30_000 });

  useEffect(() => {
    if (file.fileType !== 'pdf' || !file.url) {
      setPdfImage(null);
      setNumPages(0);
      return;
    }

    // When app is hidden, aggressively release decoded image memory.
    if (!isAppVisible) {
      setPdfImage(null);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;
    const loadingTask = pdfjs.getDocument(file.url);
    let renderTask: { cancel?: () => void } | null = null;

    const cleanup = async () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      }
      try {
        renderTask?.cancel?.();
      } catch {}
      try {
        await loadingTask.destroy();
      } catch {}
    };

    const render = async () => {
      try {
        const pdf = await loadingTask.promise;
        if (cancelled) return;

        setNumPages(pdf.numPages);

        const page = await pdf.getPage(currentPage);
        if (cancelled) return;

        const scale = isAppIdle ? 0.8 : 1.25;
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) {
          throw new Error('Canvas context를 가져올 수 없습니다.');
        }

        canvas.width = Math.max(1, Math.floor(viewport.width));
        canvas.height = Math.max(1, Math.floor(viewport.height));

        renderTask = page.render({ canvasContext: context, viewport } as any);
        await (renderTask as any).promise;

        try {
          page.cleanup();
        } catch {}

        if (cancelled) return;

        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((b) => {
            if (b) resolve(b);
            else reject(new Error('canvas.toBlob returned null'));
          }, 'image/png');
        });

        if (cancelled) return;

        objectUrl = URL.createObjectURL(blob);
        const img = new Image();
        img.decoding = 'async';
        img.onload = () => {
          if (cancelled) {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
            return;
          }
          setPdfImage(img);
          if (objectUrl) {
            URL.revokeObjectURL(objectUrl);
            objectUrl = null;
          }
        };
        img.onerror = () => {
          if (objectUrl) {
            URL.revokeObjectURL(objectUrl);
            objectUrl = null;
          }
        };
        img.src = objectUrl;
      } catch (error) {
        if (cancelled) return;
        console.error('PDF 렌더링 오류:', error);

        // 오류 발생 시 폴백 아이콘 렌더링 (저해상도)
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.width = Math.max(1, Math.floor(file.width));
        canvas.height = Math.max(1, Math.floor(file.height));

        context.fillStyle = 'white';
        context.fillRect(0, 0, canvas.width, canvas.height);

        context.fillStyle = '#DC2626';
        context.font = '48px Arial';
        context.textAlign = 'center';
        context.fillText('📄', canvas.width / 2, canvas.height / 2 - 40);

        context.fillStyle = '#1F2937';
        context.font = '14px Arial';
        context.fillText('PDF 로딩 실패', canvas.width / 2, canvas.height / 2 + 10);
        context.fillText(file.fileName, canvas.width / 2, canvas.height / 2 + 30);

        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((b) => {
            if (b) resolve(b);
            else reject(new Error('canvas.toBlob returned null'));
          }, 'image/png');
        });

        if (cancelled) return;

        objectUrl = URL.createObjectURL(blob);
        const img = new Image();
        img.decoding = 'async';
        img.onload = () => {
          if (cancelled) {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
            return;
          }
          setPdfImage(img);
          if (objectUrl) {
            URL.revokeObjectURL(objectUrl);
            objectUrl = null;
          }
        };
        img.onerror = () => {
          if (objectUrl) {
            URL.revokeObjectURL(objectUrl);
            objectUrl = null;
          }
        };
        img.src = objectUrl;
      }
    };

    render();

    return () => {
      void cleanup();
    };
  }, [file.fileType, file.url, currentPage, isAppVisible, isAppIdle, file.fileName, file.width, file.height]);

  // 키보드 단축키 설정
  const { handleKeyDown } = useDrawingKeyboardShortcuts(
    () => {
      const newDrawingMode = !isDrawingMode;
      setIsDrawingMode(newDrawingMode);
      updateFile(file.id, { isDrawingMode: newDrawingMode });
    },
    setCurrentTool,
    () => {}, // onUndo - 나중에 구현
    () => {}  // onRedo - 나중에 구현
  );

  useEffect(() => {
    if (isSelected) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isSelected, handleKeyDown]);

  const handleDragStart = () => {
    setIsDragging(true);
    onDraggingChange?.(true);
  };

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    setIsDragging(false);
    onDraggingChange?.(false);
    
    const node = e.target;
    updateFile(file.id, {
      x: node.x(),
      y: node.y(),
    });
  };

  const handleClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (isDrawingMode) return; // 그리기 모드에서는 클릭으로 선택하지 않음
    e.cancelBubble = true;
    onSelect();
  };

  const handleDoubleClick = () => {
    if (!isDrawingMode) {
      // 그리기 모드가 아닐 때만 파일 열기
      try {
        // Data URL을 Blob으로 변환하여 새 탭에서 열기
        if (file.url) {
          const link = document.createElement('a');
          link.href = file.url;
          link.target = '_blank';
          link.download = file.fileName;
          link.rel = 'noopener noreferrer';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      } catch (error) {
        console.error('PDF 열기 실패:', error);
        // 폴백으로 기존 방식 시도
        window.open(file.url, '_blank');
      }
    }
  };

  // 주석 관리
  const annotations = file.pdfData?.annotations || [];
  
  const handleAddAnnotation = (annotation: DrawingAnnotation) => {
    const updatedAnnotations = [...annotations, annotation];
    updateFile(file.id, {
      pdfData: {
        ...file.pdfData,
        numPages: numPages || 1,
        pageSize: { width: file.width, height: file.height },
        annotations: updatedAnnotations
      }
    });
  };

  const handleUpdateAnnotation = (id: string, updates: Partial<DrawingAnnotation>) => {
    const updatedAnnotations = annotations.map(ann => 
      ann.id === id ? { ...ann, ...updates } : ann
    );
    updateFile(file.id, {
      pdfData: {
        ...file.pdfData,
        numPages: numPages || 1,
        pageSize: { width: file.width, height: file.height },
        annotations: updatedAnnotations
      }
    });
  };

  // 커서 스타일은 CSS를 통해 동적으로 적용됨

  return (
    <>
      <Group
        x={file.x}
        y={file.y}
        draggable={!isDrawingMode}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onClick={handleClick}
        onTap={handleClick}
        onDblClick={handleDoubleClick}
        onDblTap={handleDoubleClick}
      >
        {/* 그림자 */}
        <Rect
          width={file.width}
          height={file.height}
          fill="black"
          opacity={0.1}
          cornerRadius={12}
          offsetX={isDragging ? -4 : -2}
          offsetY={isDragging ? 8 : 4}
          listening={false}
        />
        
        {/* PDF 배경 */}
        <Rect
          width={file.width}
          height={file.height}
          fill="white"
          stroke={isSelected ? '#3B82F6' : '#DC2626'}
          strokeWidth={isSelected ? 2 : 1}
          cornerRadius={12}
          shadowColor={isSelected ? 'rgba(59, 130, 246, 0.3)' : 'rgba(220, 38, 38, 0.3)'}
          shadowBlur={isSelected ? 20 : 10}
          shadowOpacity={1}
        />

        {/* PDF 내용 */}
        {pdfImage && (
          <KonvaImage
            x={0}
            y={0}
            width={file.width}
            height={file.height}
            image={pdfImage}
            cornerRadius={12}
            listening={false}
          />
        )}

        {/* 그리기 모드 오버레이 */}
        {isDrawingMode && (
          <Rect
            width={file.width}
            height={file.height}
            fill="transparent"
            stroke="#3B82F6"
            strokeWidth={2}
            cornerRadius={12}
            dash={[5, 5]}
            opacity={0.8}
            listening={false}
          />
        )}

        {/* PDF 주석 레이어 */}
        <PDFAnnotationLayer
          annotations={annotations as DrawingAnnotation[]}
          isDrawingMode={isDrawingMode}
          currentTool={currentTool}
          onAddAnnotation={handleAddAnnotation}
          onUpdateAnnotation={handleUpdateAnnotation}
          width={file.width}
          height={file.height}
        />

        {/* 페이지 정보 */}
        {numPages > 1 && (
          <Group>
            <Rect
              x={file.width - 80}
              y={10}
              width={70}
              height={25}
              fill="rgba(0, 0, 0, 0.7)"
              cornerRadius={12}
              listening={false}
            />
            <Text
              x={file.width - 45}
              y={18}
              text={`${currentPage}/${numPages}`}
              fontSize={12}
              fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
              fill="white"
              align="center"
              listening={false}
            />
          </Group>
        )}

        {/* 그리기 모드 표시 */}
        {isDrawingMode && (
          <Group>
            <Rect
              x={10}
              y={10}
              width={90}
              height={25}
              fill="rgba(59, 130, 246, 0.9)"
              cornerRadius={12}
              listening={false}
            />
            <Text
              x={55}
              y={18}
              text="✏️ 그리기 모드"
              fontSize={11}
              fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
              fill="white"
              align="center"
              listening={false}
            />
          </Group>
        )}
      </Group>

      {/* 그리기 툴바 */}
      {isSelected && (
        <DrawingToolbar
          currentTool={currentTool}
          onToolChange={setCurrentTool}
          isDrawingMode={isDrawingMode}
          onToggleDrawing={() => {
            const newDrawingMode = !isDrawingMode;
            setIsDrawingMode(newDrawingMode);
            updateFile(file.id, { isDrawingMode: newDrawingMode });
          }}
          position={{ x: file.x, y: file.y }}
        />
      )}
    </>
  );
};
