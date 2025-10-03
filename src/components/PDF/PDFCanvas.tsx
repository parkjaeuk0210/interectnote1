import { useState, useEffect } from 'react';
import { Group, Rect, Text, Image as KonvaImage } from 'react-konva';
import Konva from 'konva';
import { CanvasFile, DrawingTool, DrawingAnnotation } from '../../types';
import { PDFAnnotationLayer } from './PDFAnnotationLayer';
import { DrawingToolbar, useDrawingKeyboardShortcuts } from './DrawingToolbar';
import { useAppStore } from '../../contexts/StoreProvider';

// PDF.js를 동적으로 로딩 (번들 크기 최적화)
let pdfjsLib: any = null;
let workerInitialized = false;

const initPdfJs = async () => {
  if (pdfjsLib) return pdfjsLib;

  // 동적으로 pdfjs-dist 로딩
  const pdfjs = await import('pdfjs-dist');
  pdfjsLib = pdfjs;

  // Worker를 동적으로 로딩
  if (!workerInitialized) {
    const PdfJsWorker = await import('pdfjs-dist/build/pdf.worker.min.mjs?worker');
    pdfjs.GlobalWorkerOptions.workerPort = new PdfJsWorker.default();
    workerInitialized = true;
  }

  return pdfjsLib;
};

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

  // PDF를 이미지로 렌더링
  const renderPDFToImage = async () => {
    try {
      if (!file.url) {
        console.error('PDF URL이 없습니다.');
        return;
      }

      // PDF.js를 동적으로 로딩
      const pdfjs = await initPdfJs();

      // PDF.js를 사용하여 실제 PDF 렌더링
      const loadingTask = pdfjs.getDocument(file.url);
      const pdf = await loadingTask.promise;
      setNumPages(pdf.numPages);

      // 첫 번째 페이지 렌더링
      const page = await pdf.getPage(currentPage);
      const viewport = page.getViewport({ scale: 1.5 });

      // Canvas 생성
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      if (!context) {
        console.error('Canvas context를 가져올 수 없습니다.');
        return;
      }

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      // PDF 페이지를 canvas에 렌더링
      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };

      await page.render(renderContext).promise;

      // Canvas를 이미지로 변환
      const img = new Image();
      img.onload = () => {
        setPdfImage(img);
      };
      img.src = canvas.toDataURL();
      
    } catch (error) {
      console.error('PDF 렌더링 오류:', error);
      
      // 오류 발생 시 폴백 아이콘 렌더링
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) return;

      canvas.width = file.width;
      canvas.height = file.height;

      // 배경색 설정
      context.fillStyle = 'white';
      context.fillRect(0, 0, canvas.width, canvas.height);

      // 오류 메시지와 아이콘
      context.fillStyle = '#DC2626';
      context.font = '48px Arial';
      context.textAlign = 'center';
      context.fillText('📄', canvas.width / 2, canvas.height / 2 - 40);
      
      context.fillStyle = '#1F2937';
      context.font = '14px Arial';
      context.fillText('PDF 로딩 실패', canvas.width / 2, canvas.height / 2 + 10);
      context.fillText(file.fileName, canvas.width / 2, canvas.height / 2 + 30);

      const img = new Image();
      img.onload = () => {
        setPdfImage(img);
      };
      img.src = canvas.toDataURL();
    }
  };

  useEffect(() => {
    if (file.fileType === 'pdf') {
      renderPDFToImage();
    }
  }, [file]);

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
            />
            <Text
              x={file.width - 45}
              y={18}
              text={`${currentPage}/${numPages}`}
              fontSize={12}
              fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
              fill="white"
              align="center"
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
            />
            <Text
              x={55}
              y={18}
              text="✏️ 그리기 모드"
              fontSize={11}
              fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
              fill="white"
              align="center"
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
