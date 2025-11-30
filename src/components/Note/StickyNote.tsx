import { useRef, useEffect, useState } from 'react';
import { Group, Rect, Text } from 'react-konva';
import Konva from 'konva';
import { Note } from '../../types';
import { useAppStore } from '../../contexts/StoreProvider';
import { ClickableText } from './components/ClickableText';
import { parseTextWithURLs } from '../../utils/urlDetection';
import { NOTE_COLORS, NOTE_COLORS_DARK } from '../../constants/colors';

interface StickyNoteProps {
  note: Note;
}

export const StickyNote = ({ note }: StickyNoteProps) => {
  const groupRef = useRef<Konva.Group>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  const updateNote = useAppStore((state) => state.updateNote);
  const selectNote = useAppStore((state) => state.selectNote);
  const selectedNoteId = useAppStore((state) => state.selectedNoteId);
  const isSelected = selectedNoteId === note.id;

  // Use the centralized color system from constants
  const isDarkMode = document.documentElement.classList.contains('dark');
  const colorSystem = isDarkMode ? NOTE_COLORS_DARK : NOTE_COLORS;
  const noteColor = colorSystem[note.color as keyof typeof colorSystem];
  
  const backgroundColor = noteColor.primary;
  const textColor = isDarkMode ? '#FFFFFF' : '#1F2937';

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    // Enhanced shadow with glow effect for dark mode
    const shadowEnabled = true;
    const shadowBlur = isSelected ? 24 : 12;
    const glowColor = isDarkMode && 'glow' in noteColor ? noteColor.glow : null;
    const shadowColor = isSelected 
      ? (isDarkMode ? `rgba(0, 0, 0, 0.4)` : 'rgba(0, 0, 0, 0.15)')
      : (isDarkMode ? `rgba(0, 0, 0, 0.3)` : 'rgba(0, 0, 0, 0.1)');
    const shadowOffsetY = isSelected ? 12 : 6;
    
    group.setAttrs({
      shadowEnabled,
      shadowBlur,
      shadowColor: glowColor && isSelected ? glowColor : shadowColor,
      shadowOffsetX: 0,
      shadowOffsetY: glowColor ? 0 : shadowOffsetY,
    });
  }, [isSelected, isDarkMode, noteColor]);

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    updateNote(note.id, {
      x: e.target.x(),
      y: e.target.y(),
    });
  };

  const handleClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    // 이벤트가 이미 처리되었으면 무시
    if (e.evt.defaultPrevented) return;
    selectNote(note.id);
  };

  const handleDoubleClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    console.log('[StickyNote] Double-click detected on note:', note.id);
    e.evt.preventDefault();
    e.evt.stopPropagation();
    setIsEditing(true);
    // Create textarea for editing
    const stage = groupRef.current?.getStage();
    if (!stage) {
      console.log('[StickyNote] No stage found, cannot create textarea');
      return;
    }

    const textPosition = groupRef.current?.absolutePosition();
    if (!textPosition) return;

    // Get current dark mode state
    const currentIsDarkMode = document.documentElement.classList.contains('dark');

    const areaPosition = {
      x: stage.container().offsetLeft + textPosition.x * stage.scaleX() + stage.x() + 10,
      y: stage.container().offsetTop + textPosition.y * stage.scaleY() + stage.y() + 10,
    };

    const textarea = document.createElement('textarea');
    textarea.id = `note-editor-${note.id}`;
    textarea.className = currentIsDarkMode ? 'dark-mode-textarea note-textarea' : 'note-textarea';
    
    // Set all styles first
    textarea.value = note.content;
    textarea.style.position = 'absolute';
    textarea.style.top = `${areaPosition.y}px`;
    textarea.style.left = `${areaPosition.x}px`;
    textarea.style.width = `${(note.width - 20) * stage.scaleX()}px`;
    textarea.style.height = `${(note.height - 20) * stage.scaleY()}px`;
    textarea.style.fontSize = `${16 * stage.scaleX()}px`;
    textarea.style.border = 'none';
    textarea.style.padding = '5px';
    textarea.style.margin = '0px';
    textarea.style.overflow = 'hidden';
    textarea.style.background = 'transparent';
    textarea.style.outline = 'none';
    textarea.style.resize = 'none';
    textarea.style.lineHeight = '1.5';
    textarea.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    textarea.style.zIndex = '9999';
    
    // Force text color with maximum specificity
    if (currentIsDarkMode) {
      // Use cssText for maximum priority
      const darkStyles = `
        color: white !important;
        -webkit-text-fill-color: white !important;
        caret-color: white !important;
      `;
      textarea.style.cssText += darkStyles;
      
      // Double-check by setting properties individually
      textarea.style.setProperty('color', 'white', 'important');
      textarea.style.setProperty('-webkit-text-fill-color', 'white', 'important');
      textarea.style.setProperty('caret-color', 'white', 'important');
    } else {
      textarea.style.color = '#1F2937';
      textarea.style.caretColor = '#1F2937';
    }
    
    // Append to body
    document.body.appendChild(textarea);
    
    // Force browser to recalculate styles
    void textarea.offsetHeight;
    
    // Verify styles are applied (for debugging)
    setTimeout(() => {
      const computedStyle = window.getComputedStyle(textarea);
      console.log('Textarea color styles:', {
        color: computedStyle.color,
        webkitTextFillColor: computedStyle.webkitTextFillColor,
        caretColor: computedStyle.caretColor,
        isDarkMode: currentIsDarkMode
      });
    }, 0);

    textarea.focus();
    textarea.select();

    // ✅ FIX: Use flag to track if listener was added (prevent race condition)
    let listenerAdded = false;

    const handleOutsideClick = (e: MouseEvent) => {
      if (e.target !== textarea) {
        updateNote(note.id, { content: textarea.value });
        removeTextarea();
      }
    };

    const removeTextarea = () => {
      textarea.parentNode?.removeChild(textarea);
      if (listenerAdded) {
        window.removeEventListener('click', handleOutsideClick);
      }
      setIsEditing(false);
    };

    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        removeTextarea();
      } else if (e.key === 'Enter' && e.ctrlKey) {
        updateNote(note.id, { content: textarea.value });
        removeTextarea();
      }
    });

    // ✅ FIX: Mark listener as added after setTimeout
    setTimeout(() => {
      listenerAdded = true;
      window.addEventListener('click', handleOutsideClick);
    });
  };

  return (
    <Group
      ref={groupRef}
      x={note.x}
      y={note.y}
      // zIndex is controlled by the order of elements in the parent Layer
      draggable={!isEditing}
      onDragEnd={handleDragEnd}
      onClick={handleClick}
      onDblClick={handleDoubleClick}
      onTap={handleClick}
      onDblTap={handleDoubleClick}
    >
      <Rect
        width={note.width}
        height={note.height}
        fill={backgroundColor}
        stroke={isSelected ? noteColor.accent : 'transparent'}
        strokeWidth={2}
        cornerRadius={8}
      />
      {!isEditing && (() => {
        const content = note.content || '더블 클릭하여 메모 작성';
        const segments = parseTextWithURLs(content);
        const hasUrls = segments.some(segment => segment.type === 'url');
        const isDarkTheme = document.documentElement.classList.contains('dark');
        
        if (hasUrls && note.content) {
          return (
            <ClickableText
              content={content}
              x={10}
              y={10}
              width={note.width - 20}
              height={note.height - 20}
              isDarkMode={isDarkTheme}
              fontSize={16}
              fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
              onLinkClick={(url) => {
                // 링크 클릭시 노트 선택 방지
                window.open(url, '_blank', 'noopener,noreferrer');
              }}
            />
          );
        }
        
        return (
          <Text
            x={10}
            y={10}
            width={note.width - 20}
            height={note.height - 20}
            text={content}
            fontSize={16}
            fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
            fill={note.content ? textColor : (isDarkTheme ? '#9CA3AF' : '#6B7280')}
            wrap="word"
            lineHeight={1.5}
          />
        );
      })()}
    </Group>
  );
};