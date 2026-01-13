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
import { useAppActivity } from '../../hooks/useAppActivity';
import Konva from 'konva';
import { getPerformanceMode } from '../../utils/device';

export const InfiniteCanvas = React.memo(() => {
  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  type VisibleRect = { left: number; top: number; right: number; bottom: number };
  
  // Get store values
  const notes = useAppStore((state) => state.notes);
  const images = useAppStore((state) => state.images);
  const files = useAppStore((state) => state.files);
  const viewport = useAppStore((state) => state.viewport);
  const setViewport = useAppStore((state) => state.setViewport);
  const addNote = useAppStore((state) => state.addNote);
  const selectNote = useAppStore((state) => state.selectNote);
  const updateNote = useAppStore((state) => state.updateNote);
  const selectedNoteId = useAppStore((state) => state.selectedNoteId);
  const selectedImageId = useAppStore((state) => state.selectedImageId);
  const selectedFileId = useAppStore((state) => state.selectedFileId);
  const selectImage = useAppStore((state) => state.selectImage);
  const selectFile = useAppStore((state) => state.selectFile);
  
  // Device optimizations
  const performanceMode = useMemo(() => getPerformanceMode(), []);

  // App activity (visibility/focus/idle) to reduce long-run energy impact
  const { isVisible: isAppVisible, isIdle: isAppIdle } = useAppActivity({ idleMs: 30_000 });
  const isLowPower = !isAppVisible || isAppIdle;
  const pixelRatio = useMemo(() => {
    const dpr = window.devicePixelRatio || 1;
    if (!isAppVisible) return 1;
    if (isAppIdle) return 1;
    // Clamp DPR on non-mobile to reduce GPU load on retina displays.
    if (performanceMode === 'high') return Math.min(dpr, 2);
    if (performanceMode === 'medium') return Math.min(dpr, 1.5);
    return 1;
  }, [isAppVisible, isAppIdle, performanceMode]);
  
  // Apply mobile optimizations
  useMobileOptimizations();
  
  // Window dimensions
  const dimensions = useWindowResize();
  
  // Check if any note is currently being resized or dragged
  const [isAnyNoteResizing, setIsAnyNoteResizing] = useState(false);
  const [isAnyNoteDragging, setIsAnyNoteDragging] = useState(false);

  const scale = useMemo(() => Math.max(0.0001, viewport.scale || 1), [viewport.scale]);

  const viewportRect = useMemo<VisibleRect>(() => {
    const left = (0 - viewport.x) / scale;
    const top = (0 - viewport.y) / scale;
    const right = (dimensions.width - viewport.x) / scale;
    const bottom = (dimensions.height - viewport.y) / scale;
    return { left, top, right, bottom };
  }, [viewport.x, viewport.y, scale, dimensions.width, dimensions.height]);

  const overscanRect = useMemo<VisibleRect>(() => {
    const marginScreenPx = 300;
    const margin = marginScreenPx / scale;
    return {
      left: viewportRect.left - margin,
      top: viewportRect.top - margin,
      right: viewportRect.right + margin,
      bottom: viewportRect.bottom + margin,
    };
  }, [viewportRect, scale]);

  // Keep culling rect stable while panning/zooming, and only refresh when the
  // viewport exits the previously rendered overscan area. This avoids re-filtering
  // all items on every viewport tick (big win for large canvases).
  const [cullRect, setCullRect] = useState<VisibleRect | null>(() => overscanRect);

  useEffect(() => {
    if (isAnyNoteDragging || isAnyNoteResizing) return;

    if (!cullRect) {
      setCullRect(overscanRect);
      return;
    }

    const isViewportContained =
      viewportRect.left >= cullRect.left &&
      viewportRect.top >= cullRect.top &&
      viewportRect.right <= cullRect.right &&
      viewportRect.bottom <= cullRect.bottom;

    if (!isViewportContained) {
      setCullRect(overscanRect);
    }
  }, [isAnyNoteDragging, isAnyNoteResizing, cullRect, overscanRect, viewportRect]);
  
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

  const stagePixelRatio = isAnyNoteDragging || isAnyNoteResizing || isCanvasDragging ? 1 : pixelRatio;
  const stagePerfectDrawEnabled =
    performanceMode === 'high' &&
    !isLowPower &&
    !isAnyNoteDragging &&
    !isAnyNoteResizing &&
    !isCanvasDragging;

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
        // Restore original click/drag behavior: keep hit-testing on for desktop, and
        // only disable it during panning on low-performance devices.
        listening={!isCanvasDragging || performanceMode !== 'low'}
        perfectDrawEnabled={stagePerfectDrawEnabled}
        pixelRatio={stagePixelRatio}
      >
        <CanvasItems
          notes={notes}
          images={images}
          files={files}
          editingNoteId={editingNoteId}
          selectedNoteId={selectedNoteId}
          selectedImageId={selectedImageId}
          selectedFileId={selectedFileId}
          selectImage={selectImage}
          selectFile={selectFile}
          setEditingNoteId={setEditingNoteId}
          setIsAnyNoteResizing={setIsAnyNoteResizing}
          setIsAnyNoteDragging={setIsAnyNoteDragging}
          visibleRect={cullRect}
        />
      </Stage>
      {EditorComponent}
    </div>
  );
});
