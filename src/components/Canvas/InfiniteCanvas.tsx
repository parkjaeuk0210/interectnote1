import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Stage } from 'react-konva';
import { CanvasItems } from './CanvasItems';
import { useAppStore } from '../../contexts/StoreProvider';
import { useNoteEditor } from '../../hooks/useNoteEditor';
import { useViewportManager } from '../../hooks/useViewportManager';
import { useCanvasGestures } from '../../hooks/useCanvasGestures';
import { useWindowResize } from '../../hooks/useWindowResize';
import { useCanvasHandlers } from '../../hooks/useCanvasHandlers';
import { useMobileOptimizations } from '../../hooks/useMobileOptimizations';
import { useViewportCulling } from '../../hooks/useViewportCulling';
import Konva from 'konva';
import { getPerformanceMode } from '../../utils/device';

export const InfiniteCanvas = React.memo(() => {
  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Get store values
  const notes = useAppStore((state) => state.notes);
  const images = useAppStore((state) => state.images);
  const files = useAppStore((state) => state.files);
  const viewport = useAppStore((state) => state.viewport);
  const setViewport = useAppStore((state) => state.setViewport);
  const addNote = useAppStore((state) => state.addNote);
  const selectNote = useAppStore((state) => state.selectNote);
  const updateNote = useAppStore((state) => state.updateNote);
  const selectedImageId = useAppStore((state) => state.selectedImageId);
  const selectedFileId = useAppStore((state) => state.selectedFileId);
  const selectImage = useAppStore((state) => state.selectImage);
  const selectFile = useAppStore((state) => state.selectFile);

  // Window dimensions
  const dimensions = useWindowResize();

  // 뷰포트 기반 가상화 (화면에 보이는 아이템만 렌더링)
  const visibleNotes = useViewportCulling(notes, viewport, dimensions.width, dimensions.height);
  const visibleImages = useViewportCulling(images, viewport, dimensions.width, dimensions.height);
  const visibleFiles = useViewportCulling(files, viewport, dimensions.width, dimensions.height);
  
  // Device optimizations
  const performanceMode = useMemo(() => getPerformanceMode(), []);
  
  // Apply mobile optimizations
  useMobileOptimizations();
  
  // Check if any note is currently being resized or dragged
  const [isAnyNoteResizing, setIsAnyNoteResizing] = useState(false);
  const [isAnyNoteDragging, setIsAnyNoteDragging] = useState(false);
  
  // Editor state
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const editingNote = notes.find(note => note.id === editingNoteId);
  const { isEditing, startEditing, EditorComponent } = useNoteEditor(
    stageRef,
    editingNote || null,
    updateNote,
    () => setEditingNoteId(null)
  );
  
  // Start editing when note is selected
  useEffect(() => {
    if (editingNoteId && editingNote && !isEditing) {
      startEditing();
    }
  }, [editingNoteId, editingNote, isEditing, startEditing]);
  
  // Temporary canvas dragging state
  const [isCanvasDragging, setIsCanvasDragging] = useState(false);
  
  // Viewport manager
  const { updateViewportRAF, cleanup } = useViewportManager({
    setViewport,
    isCanvasDragging,
  });
  
  // Check if any PDF is in drawing mode
  const isAnyPDFInDrawingMode = files.some(file => 
    file.fileType === 'pdf' && file.isDrawingMode
  );
  
  // Canvas gestures
  const canvasGestures = useCanvasGestures({
    containerRef,
    stageRef,
    viewport,
    setViewport,
    updateViewportRAF,
    isAnyNoteResizing,
    isAnyNoteDragging,
    isInDrawingMode: isAnyPDFInDrawingMode,
  });
  
  // Update canvas dragging state
  useEffect(() => {
    setIsCanvasDragging(canvasGestures.isCanvasDragging);
  }, [canvasGestures.isCanvasDragging]);
  
  // Prevent canvas drag when notes are interacted with
  useEffect(() => {
    if (isAnyNoteDragging || isAnyNoteResizing) {
      canvasGestures.setIsCanvasDragging(false);
    }
  }, [isAnyNoteDragging, isAnyNoteResizing, canvasGestures]);
  
  // Cleanup RAF on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  // Prevent Safari's default pinch zoom (restore original behavior)
  useEffect(() => {
    const preventDefault = (e: Event) => e.preventDefault();
    document.addEventListener('gesturestart', preventDefault);
    document.addEventListener('gesturechange', preventDefault);
    
    return () => {
      document.removeEventListener('gesturestart', preventDefault);
      document.removeEventListener('gesturechange', preventDefault);
    };
  }, []);

  // Canvas click handlers
  const { handleStageClick, handleStageDoubleClick } = useCanvasHandlers({
    stageRef,
    viewport,
    selectNote,
    selectImage,
    selectFile,
    addNote,
    setIsCanvasDragging: canvasGestures.setIsCanvasDragging,
  });

  return (
    <div ref={containerRef} className="w-full h-full" style={{ 
      touchAction: 'none',
      WebkitTouchCallout: 'none',
      WebkitUserSelect: 'none',
      userSelect: 'none',
      cursor: isCanvasDragging ? 'grabbing' : 'grab',
    }}>
      <Stage
        ref={stageRef}
        width={dimensions.width}
        height={dimensions.height}
        onClick={handleStageClick}
        onDblClick={handleStageDoubleClick}
        x={viewport.x}
        y={viewport.y}
        scaleX={viewport.scale}
        scaleY={viewport.scale}
        listening={!isCanvasDragging || performanceMode !== 'low'} // Optimize event handling during drag
        perfectDrawEnabled={performanceMode === 'high'}
        pixelRatio={performanceMode === 'low' ? 1 : window.devicePixelRatio}
      >
        <CanvasItems
          notes={visibleNotes}
          images={visibleImages}
          files={visibleFiles}
          editingNoteId={editingNoteId}
          selectedImageId={selectedImageId}
          selectedFileId={selectedFileId}
          selectImage={selectImage}
          selectFile={selectFile}
          setEditingNoteId={setEditingNoteId}
          setIsAnyNoteResizing={setIsAnyNoteResizing}
          setIsAnyNoteDragging={setIsAnyNoteDragging}
        />
      </Stage>
      {EditorComponent}
    </div>
  );
});
