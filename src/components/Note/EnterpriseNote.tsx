import React, { useRef, useEffect, useMemo } from 'react';
import { Group } from 'react-konva';
import Konva from 'konva';
import { Note } from '../../types';
import { useAppStore } from '../../contexts/StoreProvider';
import { ResizeHandles } from './ResizeHandles';
import { NoteBackground } from './components/NoteBackground';
import { NoteContent } from './components/NoteContent';
import { EditingIndicator } from './components/EditingIndicator';
import { useNoteDrag } from '../../hooks/useNoteDrag';
import { useNoteClick } from '../../hooks/useNoteClick';
import { useNoteHover } from '../../hooks/useNoteHover';
import { useNoteResize } from '../../hooks/useNoteResize';
import { NOTE_COLORS, NOTE_COLORS_DARK } from '../../constants/colors';
import { getPerformanceMode } from '../../utils/device';

interface EnterpriseNoteProps {
  note: Note;
  isEditing?: boolean;
  onStartEditing?: () => void;
  onResizingChange?: (isResizing: boolean) => void;
  onDraggingChange?: (isDragging: boolean) => void;
}

export const EnterpriseNote = React.memo(({ note, isEditing = false, onStartEditing, onResizingChange, onDraggingChange }: EnterpriseNoteProps) => {
  const groupRef = useRef<Konva.Group>(null);
  
  // Get performance mode
  const performanceMode = useMemo(() => getPerformanceMode(), []);
  
  const updateNote = useAppStore((state) => state.updateNote);
  const selectNote = useAppStore((state) => state.selectNote);
  const isSelected = useAppStore((state) => state.selectedNoteId === note.id);
  const isDarkMode = useAppStore((state) => state.isDarkMode);
  const selectToMoveMode = useAppStore((state) => state.selectToMoveMode);
  
  const colors = useMemo(
    () => {
      const colorKey = note.color || 'yellow'; // Default to yellow if color is undefined
      return isDarkMode ? NOTE_COLORS_DARK[colorKey] : NOTE_COLORS[colorKey];
    },
    [note.color, isDarkMode]
  );
  
  // Use custom hooks for drag, click, hover, and resize logic
  const { isDragging, dragEndFlag, handleDragStart, handleDragMove, handleDragEnd } = useNoteDrag({
    note,
    isEditing,
    selectNote,
    updateNote,
    onDraggingChange,
  });
  
  const { isResizing, tempSize, handleResizeStart, handleResizeMove, handleResizeEnd } = useNoteResize({
    noteId: note.id,
    isEditing,
    selectNote,
    updateNote,
    onResizingChange,
  });
  
  const { handleClick, handleDoubleClick } = useNoteClick({
    noteId: note.id,
    isDragging,
    isResizing,
    dragEndFlag,
    selectNote,
    onStartEditing,
  });
  
  const { isHovered, handleMouseEnter, handleMouseLeave, handleMouseDown, handleMouseUp } = useNoteHover({
    isEditing,
    isDragging,
  });

  // Current dimensions (either temp during resize or actual note dimensions)
  const currentWidth = tempSize?.width || note.width || 200;
  const currentHeight = tempSize?.height || note.height || 200;
  const currentX = tempSize?.x !== undefined ? tempSize.x : (note.x || 0);
  const currentY = tempSize?.y !== undefined ? tempSize.y : (note.y || 0);


  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    // Remove shadow from group since we're handling it on the main rect
    group.setAttrs({
      shadowEnabled: false,
    });

    if (performanceMode === 'high') {
      // Only animate on desktop
      if (isSelected && !isResizing) {
        group.to({
          scaleX: 1.03,
          scaleY: 1.03,
          duration: 0.2,
          easing: Konva.Easings.EaseOut,
        });
      } else {
        group.to({
          scaleX: 1,
          scaleY: 1,
          duration: 0.2,
          easing: Konva.Easings.EaseOut,
        });
      }
    } else {
      // Instant change on mobile
      group.setAttrs({
        scaleX: isSelected && !isResizing ? 1.03 : 1,
        scaleY: isSelected && !isResizing ? 1.03 : 1,
      });
    }
  }, [isSelected, isHovered, isDragging, isResizing, colors.accent, performanceMode]);



  return (
    <Group
      ref={groupRef}
      x={currentX}
      y={currentY}
      // zIndex is controlled by the order of elements in the parent Layer
      draggable={!isEditing && (!selectToMoveMode || isSelected)}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={handleClick}
      onDblClick={handleDoubleClick}
      onTap={handleClick}
      onDblTap={handleDoubleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      opacity={isDragging ? (performanceMode === 'high' ? 0.85 : 0.95) : isResizing ? 0.9 : 1}
      onDragMove={handleDragMove}
    >
      {/* Note background with gradient */}
      <NoteBackground
        width={currentWidth}
        height={currentHeight}
        color={note.color}
        isDarkMode={isDarkMode}
        isSelected={isSelected}
        isDragging={isDragging}
        isResizing={isResizing}
        performanceMode={performanceMode}
      />



      {/* Note content */}
      <NoteContent
        content={note.content}
        width={currentWidth}
        height={currentHeight}
        isDarkMode={isDarkMode}
        isEditing={isEditing}
      />


      {/* Editing indicator */}
      <EditingIndicator
        width={currentWidth}
        height={currentHeight}
        isEditing={isEditing}
      />

      {/* Resize handles */}
      {!isEditing && (
        <ResizeHandles
          note={note}
          isHovered={isHovered}
          isSelected={isSelected}
          tempSize={tempSize || undefined}
          onResizeMove={handleResizeMove}
          onResizeStart={handleResizeStart}
          onResizeEnd={handleResizeEnd}
        />
      )}
    </Group>
  );
}, (prevProps, nextProps) => {
  // ✅ FIX: Compare timestamps instead of Date objects for proper memoization
  const prevTime = prevProps.note.updatedAt instanceof Date
    ? prevProps.note.updatedAt.getTime()
    : prevProps.note.updatedAt;
  const nextTime = nextProps.note.updatedAt instanceof Date
    ? nextProps.note.updatedAt.getTime()
    : nextProps.note.updatedAt;

  return (
    prevProps.note.id === nextProps.note.id &&
    prevProps.note.x === nextProps.note.x &&
    prevProps.note.y === nextProps.note.y &&
    prevProps.note.width === nextProps.note.width &&
    prevProps.note.height === nextProps.note.height &&
    prevProps.note.content === nextProps.note.content &&
    prevProps.note.color === nextProps.note.color &&
    prevTime === nextTime &&
    prevProps.isEditing === nextProps.isEditing
  );
});
