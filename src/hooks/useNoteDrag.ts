import { useCallback, useRef, useState } from 'react';
import Konva from 'konva';
import { Note } from '../types';
import { isMobile } from '../utils/device';

interface UseNoteDragProps {
  note: Note;
  isEditing: boolean;
  selectNote: (id: string) => void;
  updateNote: (id: string, updates: Partial<Note>) => void;
  onDraggingChange?: (isDragging: boolean) => void;
}

export const useNoteDrag = ({
  note,
  isEditing,
  selectNote,
  updateNote,
  onDraggingChange,
}: UseNoteDragProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const rafId = useRef<number | null>(null);
  const dragEndFlag = useRef(false);
  const isMobileDevice = isMobile();

  const handleDragStart = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    if (isEditing) {
      e.target.stopDrag();
      return;
    }
    
    setIsDragging(true);
    selectNote(note.id);
    onDraggingChange?.(true);
    e.cancelBubble = true;
  }, [selectNote, note.id, isEditing, onDraggingChange]);

  const handleDragMove = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    if (!isDragging || !isMobileDevice) return;
    
    if (rafId.current) {
      cancelAnimationFrame(rafId.current);
    }
    
    rafId.current = requestAnimationFrame(() => {
      e.target.getLayer()?.batchDraw();
    });
  }, [isDragging, isMobileDevice]);

  const handleDragEnd = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    if (!isDragging) return;
    
    if (rafId.current) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }
    
    const node = e.target;
    const finalX = node.x();
    const finalY = node.y();
    
    updateNote(note.id, {
      x: finalX,
      y: finalY,
    });
    
    dragEndFlag.current = true;
    setIsDragging(false);
    onDraggingChange?.(false);
    
    requestAnimationFrame(() => {
      dragEndFlag.current = false;
    });
  }, [isDragging, updateNote, note.id, onDraggingChange]);

  return {
    isDragging,
    dragEndFlag,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
  };
};