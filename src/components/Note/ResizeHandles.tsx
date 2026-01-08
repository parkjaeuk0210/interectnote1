import { useRef, useMemo, useState } from 'react';
import { Group, Circle, Rect } from 'react-konva';
import { Note } from '../../types';
import { getPerformanceMode, isMobile } from '../../utils/device';
import { useAppStore } from '../../contexts/StoreProvider';
import { NOTE_COLORS, NOTE_COLORS_DARK } from '../../constants/colors';

interface ResizeHandlesProps {
  note: Note;
  isHovered: boolean;
  isSelected: boolean;
  tempSize?: { width: number; height: number; x?: number; y?: number };
  onResizeMove: (width: number, height: number, x?: number, y?: number) => void;
  onResizeStart: () => void;
  onResizeEnd: (width: number, height: number, x?: number, y?: number) => void;
}

const MIN_WIDTH = 180;
const MIN_HEIGHT = 120;
const MAX_WIDTH = 600;
const MAX_HEIGHT = 500;

export const ResizeHandles = ({
  note,
  isHovered,
  isSelected,
  tempSize,
  onResizeMove,
  onResizeStart,
  onResizeEnd,
}: ResizeHandlesProps) => {
  const startPos = useRef({ x: 0, y: 0, width: 0, height: 0, noteX: 0, noteY: 0 });
  const rafId = useRef<number | null>(null);
  const performanceMode = useMemo(() => getPerformanceMode(), []);
  const isMobileDevice = useMemo(() => isMobile(), []);
  const isDarkMode = useAppStore((state) => state.isDarkMode);
  const [hoveredHandle, setHoveredHandle] = useState<string | null>(null);
  
  // Get colors based on note color and theme
  const colors = useMemo(
    () => {
      const colorKey = note.color || 'yellow'; // Default to yellow if color is undefined
      return isDarkMode ? NOTE_COLORS_DARK[colorKey] : NOTE_COLORS[colorKey];
    },
    [note.color, isDarkMode]
  );
  
  // Smaller, more elegant handle size
  const HANDLE_SIZE = isMobileDevice ? 12 : 8;
  const lastUpdateTime = useRef<number>(0);
  const updateThrottle = performanceMode === 'low' ? 32 : 16;

  if (!isHovered && !isSelected) return null;

  const currentWidth = tempSize?.width || note.width;
  const currentHeight = tempSize?.height || note.height;

  const getCursor = (handle: string) => {
    const cursors: { [key: string]: string } = {
      'top-left': 'nw-resize',
      'top': 'n-resize',
      'top-right': 'ne-resize',
      'right': 'e-resize',
      'bottom-right': 'se-resize',
      'bottom': 's-resize',
      'bottom-left': 'sw-resize',
      'left': 'w-resize',
    };
    return cursors[handle] || 'default';
  };

  const handles = [
    { name: 'top-left', x: 0, y: 0 },
    { name: 'top', x: currentWidth / 2, y: 0 },
    { name: 'top-right', x: currentWidth, y: 0 },
    { name: 'right', x: currentWidth, y: currentHeight / 2 },
    { name: 'bottom-right', x: currentWidth, y: currentHeight },
    { name: 'bottom', x: currentWidth / 2, y: currentHeight },
    { name: 'bottom-left', x: 0, y: currentHeight },
    { name: 'left', x: 0, y: currentHeight / 2 },
  ];

  // Helper to determine if handle is a corner
  const isCornerHandle = (handleName: string) => {
    return ['top-left', 'top-right', 'bottom-left', 'bottom-right'].includes(handleName);
  };

  // Render glassmorphism handle
  const renderHandle = (handle: { name: string; x: number; y: number }) => {
    const isCorner = isCornerHandle(handle.name);
    const isCurrentHovered = hoveredHandle === handle.name;
    const scale = isCurrentHovered ? 1.2 : 1;
    
    if (isCorner) {
      // Circular handles for corners
      return (
        <Group
          key={handle.name}
          x={handle.x}
          y={handle.y}
          scaleX={scale}
          scaleY={scale}
        >
          {/* Background circle with glassmorphism effect */}
          <Circle
            radius={HANDLE_SIZE / 2}
            fill={isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.85)'}
            stroke={colors.accent}
            strokeWidth={1.5}
            shadowColor={colors.accent}
            shadowBlur={isCurrentHovered ? 8 : 4}
            shadowOpacity={0.3}
            shadowEnabled={performanceMode === 'high'}
            opacity={isCurrentHovered ? 1 : 0.9}
            listening={false}
          />
          {/* Inner accent dot */}
          <Circle
            radius={HANDLE_SIZE / 4}
            fill={colors.accent}
            opacity={0.6}
            listening={false}
          />
        </Group>
      );
    } else {
      // Rounded rectangle for edge handles
      return (
        <Group
          key={handle.name}
          x={handle.x}
          y={handle.y}
          scaleX={scale}
          scaleY={scale}
        >
          <Rect
            width={HANDLE_SIZE}
            height={HANDLE_SIZE}
            offsetX={HANDLE_SIZE / 2}
            offsetY={HANDLE_SIZE / 2}
            fill={isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.85)'}
            stroke={colors.accent}
            strokeWidth={1.5}
            cornerRadius={HANDLE_SIZE / 3}
            shadowColor={colors.accent}
            shadowBlur={isCurrentHovered ? 8 : 4}
            shadowOpacity={0.3}
            shadowEnabled={performanceMode === 'high'}
            opacity={isCurrentHovered ? 1 : 0.9}
            listening={false}
          />
        </Group>
      );
    }
  };

  return (
    <Group>
      {handles.map((handle) => (
        <Group key={handle.name}>
          {renderHandle(handle)}
          <Rect
            x={handle.x}
            y={handle.y}
            width={HANDLE_SIZE + (isMobileDevice ? 16 : 8)}
            height={HANDLE_SIZE + (isMobileDevice ? 16 : 8)}
            offsetX={(HANDLE_SIZE + (isMobileDevice ? 16 : 8)) / 2}
            offsetY={(HANDLE_SIZE + (isMobileDevice ? 16 : 8)) / 2}
            fill="transparent"
            draggable
          onDragStart={(e) => {
            e.cancelBubble = true;
            const stage = e.target.getStage();
            if (!stage) return;
            
            const pos = stage.getPointerPosition();
            if (!pos) return;
            
            startPos.current = {
              x: pos.x,
              y: pos.y,
              width: note.width,
              height: note.height,
              noteX: note.x,
              noteY: note.y
            };
            
            onResizeStart();
          }}
          onDragMove={(e) => {
            e.cancelBubble = true;
            const stage = e.target.getStage();
            if (!stage) return;

            const pos = stage.getPointerPosition();
            if (!pos) return;
            
            // Cancel previous RAF if exists
            if (rafId.current) {
              cancelAnimationFrame(rafId.current);
            }
            
            // Use RAF for smooth updates
            const now = Date.now();
            const timeSinceLastUpdate = now - lastUpdateTime.current;
            
            // Throttle updates on low performance mode
            if (performanceMode === 'low' && timeSinceLastUpdate < updateThrottle) {
              return;
            }
            
            rafId.current = requestAnimationFrame(() => {
              lastUpdateTime.current = now;
              const deltaX = (pos.x - startPos.current.x) / stage.scaleX();
              const deltaY = (pos.y - startPos.current.y) / stage.scaleY();

              let newWidth = startPos.current.width;
              let newHeight = startPos.current.height;
              let newX = startPos.current.noteX;
              let newY = startPos.current.noteY;

            switch (handle.name) {
              case 'right':
                newWidth = startPos.current.width + deltaX;
                break;
              case 'bottom':
                newHeight = startPos.current.height + deltaY;
                break;
              case 'bottom-right':
                newWidth = startPos.current.width + deltaX;
                newHeight = startPos.current.height + deltaY;
                break;
              case 'left':
                newWidth = startPos.current.width - deltaX;
                newX = startPos.current.noteX + deltaX;
                break;
              case 'top':
                newHeight = startPos.current.height - deltaY;
                newY = startPos.current.noteY + deltaY;
                break;
              case 'top-left':
                newWidth = startPos.current.width - deltaX;
                newHeight = startPos.current.height - deltaY;
                newX = startPos.current.noteX + deltaX;
                newY = startPos.current.noteY + deltaY;
                break;
              case 'top-right':
                newWidth = startPos.current.width + deltaX;
                newHeight = startPos.current.height - deltaY;
                newY = startPos.current.noteY + deltaY;
                break;
              case 'bottom-left':
                newWidth = startPos.current.width - deltaX;
                newHeight = startPos.current.height + deltaY;
                newX = startPos.current.noteX + deltaX;
                break;
            }

            // Apply constraints
            if (newWidth < MIN_WIDTH) {
              if (handle.name.includes('left')) {
                newX = startPos.current.noteX + startPos.current.width - MIN_WIDTH;
              }
              newWidth = MIN_WIDTH;
            }
            if (newWidth > MAX_WIDTH) {
              if (handle.name.includes('left')) {
                newX = startPos.current.noteX + startPos.current.width - MAX_WIDTH;
              }
              newWidth = MAX_WIDTH;
            }
            if (newHeight < MIN_HEIGHT) {
              if (handle.name.includes('top')) {
                newY = startPos.current.noteY + startPos.current.height - MIN_HEIGHT;
              }
              newHeight = MIN_HEIGHT;
            }
            if (newHeight > MAX_HEIGHT) {
              if (handle.name.includes('top')) {
                newY = startPos.current.noteY + startPos.current.height - MAX_HEIGHT;
              }
              newHeight = MAX_HEIGHT;
            }

              // Call resize move with new dimensions
              if (newX !== startPos.current.noteX || newY !== startPos.current.noteY) {
                onResizeMove(newWidth, newHeight, newX, newY);
              } else {
                onResizeMove(newWidth, newHeight);
              }
            });
          }}
          onDragEnd={(e) => {
            e.cancelBubble = true;
            
            const stage = e.target.getStage();
            if (!stage) return;

            const pos = stage.getPointerPosition();
            if (!pos) return;

            const deltaX = (pos.x - startPos.current.x) / stage.scaleX();
            const deltaY = (pos.y - startPos.current.y) / stage.scaleY();

            let finalWidth = startPos.current.width;
            let finalHeight = startPos.current.height;
            let finalX = startPos.current.noteX;
            let finalY = startPos.current.noteY;

            // Calculate final dimensions (same logic as onDragMove)
            switch (handle.name) {
              case 'right':
                finalWidth = startPos.current.width + deltaX;
                break;
              case 'bottom':
                finalHeight = startPos.current.height + deltaY;
                break;
              case 'bottom-right':
                finalWidth = startPos.current.width + deltaX;
                finalHeight = startPos.current.height + deltaY;
                break;
              case 'left':
                finalWidth = startPos.current.width - deltaX;
                finalX = startPos.current.noteX + deltaX;
                break;
              case 'top':
                finalHeight = startPos.current.height - deltaY;
                finalY = startPos.current.noteY + deltaY;
                break;
              case 'top-left':
                finalWidth = startPos.current.width - deltaX;
                finalHeight = startPos.current.height - deltaY;
                finalX = startPos.current.noteX + deltaX;
                finalY = startPos.current.noteY + deltaY;
                break;
              case 'top-right':
                finalWidth = startPos.current.width + deltaX;
                finalHeight = startPos.current.height - deltaY;
                finalY = startPos.current.noteY + deltaY;
                break;
              case 'bottom-left':
                finalWidth = startPos.current.width - deltaX;
                finalHeight = startPos.current.height + deltaY;
                finalX = startPos.current.noteX + deltaX;
                break;
            }

            // Apply constraints
            if (finalWidth < MIN_WIDTH) {
              if (handle.name.includes('left')) {
                finalX = startPos.current.noteX + startPos.current.width - MIN_WIDTH;
              }
              finalWidth = MIN_WIDTH;
            }
            if (finalWidth > MAX_WIDTH) {
              if (handle.name.includes('left')) {
                finalX = startPos.current.noteX + startPos.current.width - MAX_WIDTH;
              }
              finalWidth = MAX_WIDTH;
            }
            if (finalHeight < MIN_HEIGHT) {
              if (handle.name.includes('top')) {
                finalY = startPos.current.noteY + startPos.current.height - MIN_HEIGHT;
              }
              finalHeight = MIN_HEIGHT;
            }
            if (finalHeight > MAX_HEIGHT) {
              if (handle.name.includes('top')) {
                finalY = startPos.current.noteY + startPos.current.height - MAX_HEIGHT;
              }
              finalHeight = MAX_HEIGHT;
            }

            // Reset handle position
            e.target.position({ x: handle.x, y: handle.y });
            
            // Call resize end with final dimensions
            if (finalX !== startPos.current.noteX || finalY !== startPos.current.noteY) {
              onResizeEnd(finalWidth, finalHeight, finalX, finalY);
            } else {
              onResizeEnd(finalWidth, finalHeight);
            }
          }}
          onMouseEnter={(e) => {
            const stage = e.target.getStage();
            if (stage) {
              stage.container().style.cursor = getCursor(handle.name);
            }
            setHoveredHandle(handle.name);
          }}
          onMouseLeave={(e) => {
            const stage = e.target.getStage();
            if (stage) {
              stage.container().style.cursor = 'default';
            }
            setHoveredHandle(null);
          }}
          onMouseDown={(e) => {
            e.cancelBubble = true;
            e.evt.stopPropagation();
            e.evt.preventDefault();
          }}
          />
        </Group>
      ))}
    </Group>
  );
};
