import { useCallback, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Konva from 'konva';
import { Note } from '../types';
import { PADDING, FONT_SIZE, LINE_HEIGHT } from '../constants/colors';
import { useCanvasStore } from '../store/canvasStore';

interface EditorPortalProps {
  note: Note;
  stageScale: number;
  position: { x: number; y: number };
  onSave: (content: string) => void;
  onClose: () => void;
}

const EditorPortal = ({ note, stageScale, position, onSave, onClose }: EditorPortalProps) => {
  const [value, setValue] = useState(note.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isDarkMode = useCanvasStore((state) => state.isDarkMode);

  useEffect(() => {
    // Focus and select all text when editor opens
    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.select();
      }
    }, 50);
    
    return () => clearTimeout(timer);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter' && e.ctrlKey) {
      onSave(value);
      onClose();
    }
    // Stop propagation to prevent canvas shortcuts
    e.stopPropagation();
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return createPortal(
    <div
      style={{
        position: 'absolute',
        top: position.y,
        left: position.x,
        zIndex: 1000,
      }}
      onClick={handleClick}
      onMouseDown={handleClick}
      onDoubleClick={handleClick}
    >
      <textarea
        ref={textareaRef}
        className={isDarkMode ? 'dark-mode-textarea' : ''}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          onSave(value);
          onClose();
        }}
        style={{
          width: `${(note.width - PADDING * 2) * stageScale}px`,
          height: `${(note.height - PADDING * 2) * stageScale}px`,
          fontSize: `${FONT_SIZE * stageScale}px`,
          border: 'none',
          padding: '0px',
          margin: '0px',
          overflow: 'auto',
          background: 'transparent',
          outline: 'none',
          borderRadius: '0px',
          resize: 'none',
          lineHeight: `${LINE_HEIGHT}`,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", sans-serif',
          color: isDarkMode ? 'rgba(255, 255, 255, 0.9)' : '#111827',
          caretColor: isDarkMode ? 'rgba(255, 255, 255, 0.9)' : '#111827',
          // Force text color in WebKit browsers
          WebkitTextFillColor: isDarkMode ? 'rgba(255, 255, 255, 0.9)' : '#111827',
        } as React.CSSProperties}
      />
    </div>,
    document.body
  );
};

export const useNoteEditor = (
  stageRef: React.RefObject<Konva.Stage | null>,
  note: Note | null,
  updateNote: (id: string, updates: Partial<Note>) => void,
  onClose?: () => void
) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editorPosition, setEditorPosition] = useState({ x: 0, y: 0 });
  const [stageScale, setStageScale] = useState(1);

  const updateEditorPosition = useCallback(() => {
    if (!note || !stageRef.current) return;

    const stage = stageRef.current;
    const container = stage.container();
    if (!container) return;

    const scale = stage.scaleX();
    const stagePosition = stage.position();

    const effectiveScale = scale || 1;
    const screenX = note.x * effectiveScale + stagePosition.x;
    const screenY = note.y * effectiveScale + stagePosition.y;

    setEditorPosition({
      x: container.offsetLeft + screenX + PADDING * effectiveScale,
      y: container.offsetTop + screenY + PADDING * effectiveScale,
    });
    setStageScale(effectiveScale);
  }, [note, stageRef]);

  const startEditing = useCallback(() => {
    if (!note || !stageRef.current) return;

    setIsEditing(true);
    requestAnimationFrame(() => {
      updateEditorPosition();
    });
  }, [note, updateEditorPosition, stageRef]);

  const handleSave = useCallback((content: string) => {
    if (!note) return;
    updateNote(note.id, { content });
  }, [note, updateNote]);

  const handleClose = useCallback(() => {
    setIsEditing(false);
    onClose?.();
  }, [onClose]);

  useEffect(() => {
    if (!isEditing) return;

    updateEditorPosition();
  }, [isEditing, note?.x, note?.y, note?.width, note?.height, note?.updatedAt, updateEditorPosition]);

  useEffect(() => {
    if (!isEditing) return;
    const stage = stageRef.current;
    if (!stage) return;

    const handleStageChange = () => {
      updateEditorPosition();
    };

    stage.on('xChange yChange scaleXChange scaleYChange', handleStageChange);
    stage.on('dragmove zoom', handleStageChange);

    const container = stage.container();
    let resizeObserver: ResizeObserver | null = null;
    if (container && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        updateEditorPosition();
      });
      resizeObserver.observe(container);
    }

    window.addEventListener('resize', handleStageChange);

    return () => {
      stage.off('xChange yChange scaleXChange scaleYChange', handleStageChange);
      stage.off('dragmove zoom', handleStageChange);
      window.removeEventListener('resize', handleStageChange);
      resizeObserver?.disconnect();
    };
  }, [isEditing, stageRef, updateEditorPosition]);

  // Render portal outside of Konva context
  const editorKey = note 
    ? `editor-portal-${note.id}-${note.updatedAt instanceof Date ? note.updatedAt.getTime() : ''}`
    : undefined;

  const EditorComponent = isEditing && note ? (
    <EditorPortal
      key={editorKey}
      note={note}
      stageScale={stageScale}
      position={editorPosition}
      onSave={handleSave}
      onClose={handleClose}
    />
  ) : null;

  return {
    isEditing,
    startEditing,
    EditorComponent,
  };
};
