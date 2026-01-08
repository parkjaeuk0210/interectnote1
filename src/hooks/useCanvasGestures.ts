import { useState, RefObject, useRef } from 'react';
import { useGesture } from '@use-gesture/react';
import Konva from 'konva';
import { isMobile, isTrackpadEvent, getWheelGestureType } from '../utils/device';

interface Viewport {
  x: number;
  y: number;
  scale: number;
}

interface UseCanvasGesturesProps {
  containerRef: RefObject<HTMLDivElement | null>;
  stageRef: RefObject<Konva.Stage | null>;
  viewport: Viewport;
  setViewport: (viewport: Viewport) => void;
  updateViewportRAF: (viewport: Viewport) => void;
  isAnyNoteResizing: boolean;
  isAnyNoteDragging: boolean;
  isInDrawingMode?: boolean; // PDF 그리기 모드
}

export const useCanvasGestures = ({
  containerRef,
  stageRef,
  viewport,
  setViewport,
  updateViewportRAF,
  isAnyNoteResizing,
  isAnyNoteDragging,
  isInDrawingMode = false,
}: UseCanvasGesturesProps) => {
  const [isCanvasDragging, setIsCanvasDragging] = useState(false);
  const [isPinching, setIsPinching] = useState(false);
  const isMobileDevice = isMobile();
  
  // Store initial pinch state
  const pinchStartRef = useRef<{ 
    scale: number;
    center: { x: number; y: number };
    initialDistance: number;
  } | null>(null);

  useGesture(
    {
      onWheel: ({ event, delta: [dx, dy], ctrlKey, metaKey, shiftKey }) => {
        if (isMobileDevice) return;
        
        event.preventDefault();
        
        const stage = stageRef.current;
        if (!stage) return;
        
        const isTrackpad = isTrackpadEvent(event as WheelEvent);
        const gestureType = getWheelGestureType(event as WheelEvent);
        
        if (gestureType === 'zoom' || (!isTrackpad && !shiftKey)) {
          // Zoom behavior (pinch on trackpad or mouse wheel)
          const oldScale = viewport.scale;
          const pointer = stage.getPointerPosition();
          if (!pointer) return;

          const mousePointTo = {
            x: (pointer.x - viewport.x) / oldScale,
            y: (pointer.y - viewport.y) / oldScale,
          };

          // Different zoom speeds for trackpad vs mouse wheel
          const zoomSpeed = isTrackpad ? 0.01 : 0.001;
          const zoomDelta = ctrlKey || metaKey ? -dy : -dy;
          const newScale = Math.min(Math.max(0.1, oldScale + zoomDelta * zoomSpeed), 5);
          
          updateViewportRAF({
            scale: newScale,
            x: pointer.x - mousePointTo.x * newScale,
            y: pointer.y - mousePointTo.y * newScale,
          });
        } else {
          // Pan behavior (2-finger trackpad scroll or shift+wheel)
          const panSpeed = isTrackpad ? 1 : 2;
          // Fix: Invert scroll direction for trackpad
          const scrollDirection = -1; // Inverted for natural scrolling feel
          
          setViewport({
            ...viewport,
            x: viewport.x + dx * panSpeed * scrollDirection,
            y: viewport.y + dy * panSpeed * scrollDirection,
          });
        }
      },
      
      onDragStart: ({ event, touches }) => {
        if (isAnyNoteResizing || isAnyNoteDragging || isInDrawingMode) return;
        
        // Don't start drag if it's a multi-touch (pinch gesture)
        if (touches && touches > 1) return;
        
        const target = event.target as HTMLElement;
        if (target.tagName === 'CANVAS') {
          const stage = stageRef.current;
          if (stage) {
            const pos = stage.getPointerPosition();
            if (pos) {
              const shape = stage.getIntersection(pos);
              if (!shape) {
                setIsCanvasDragging(true);
              }
            }
          }
        }
      },
      
      onDrag: ({ delta: [dx, dy], pinching, event, touches }) => {
        // Don't handle drag if pinching, multi-touch, or in drawing mode
        if (pinching || !isCanvasDragging || isAnyNoteResizing || isAnyNoteDragging || isInDrawingMode) return;
        if (touches && touches > 1) return;
        
        const target = event.target as HTMLElement;
        if (target.tagName !== 'CANVAS') {
          setIsCanvasDragging(false);
          return;
        }
        
        setViewport({
          ...viewport,
          x: viewport.x + dx,
          y: viewport.y + dy,
        });
      },
      
      onDragEnd: () => {
        setIsCanvasDragging(false);
      },
      
      onPinchStart: ({ origin: [cx, cy], offset: [distance] }) => {
        setIsPinching(true);
        setIsCanvasDragging(false);
        
        // Store initial state with correct center
        pinchStartRef.current = {
          scale: viewport.scale,
          center: { x: cx, y: cy },
          initialDistance: distance
        };
      },
      
      onPinch: ({ offset: [distance], origin: [cx, cy] }) => {
        if (!pinchStartRef.current) {
          // Initialize if not set
          pinchStartRef.current = {
            scale: viewport.scale,
            center: { x: cx, y: cy },
            initialDistance: distance
          };
        }
        
        // Calculate scale based on distance change ratio
        const distanceRatio = distance / pinchStartRef.current.initialDistance;
        const newScale = Math.min(Math.max(0.1, pinchStartRef.current.scale * distanceRatio), 5);
        
        // Use the current pinch center (it may move during gesture)
        const pinchCenter = { x: cx, y: cy };
        
        // Calculate the point that should remain fixed during zoom
        const fixedPoint = {
          x: (pinchCenter.x - viewport.x) / viewport.scale,
          y: (pinchCenter.y - viewport.y) / viewport.scale,
        };

        // Calculate new viewport position to keep the fixed point in place
        updateViewportRAF({
          scale: newScale,
          x: pinchCenter.x - fixedPoint.x * newScale,
          y: pinchCenter.y - fixedPoint.y * newScale,
        });
      },
      
      onPinchEnd: () => {
        setIsPinching(false);
        pinchStartRef.current = null;
      },
    },
    {
      target: containerRef,
      drag: { 
        filterTaps: true,
        from: () => [viewport.x, viewport.y],
        enabled: !isAnyNoteResizing && !isAnyNoteDragging && !isPinching && !isInDrawingMode,
        threshold: isMobileDevice ? 10 : 5,
        pointer: { 
          touch: true, 
          mouse: true,
        },
      },
      pinch: { 
        enabled: true,
        from: () => [100, 0], // Start with a base value
        threshold: 0, // No threshold for immediate response
        rubberband: false,
      },
      wheel: {
        preventDefault: true,
      },
      eventOptions: {
        passive: false,
      },
    }
  );

  return {
    isCanvasDragging,
    setIsCanvasDragging,
    isPinching,
  };
};
