import { useState } from 'react';
import { DrawingTool } from '../../types';

interface DrawingToolbarProps {
  currentTool: DrawingTool;
  onToolChange: (tool: DrawingTool) => void;
  isDrawingMode: boolean;
  onToggleDrawing: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  position?: { x: number; y: number };
}

export const DrawingToolbar = ({
  currentTool,
  onToolChange,
  isDrawingMode,
  onToggleDrawing,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  position = { x: 0, y: 0 }
}: DrawingToolbarProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const tools = [
    { id: 'pen' as DrawingTool, icon: '🖊️', label: '펜', shortcut: 'P' },
    { id: 'highlighter' as DrawingTool, icon: '🖍️', label: '형광펜', shortcut: 'H' },
    { id: 'eraser' as DrawingTool, icon: '🧽', label: '지우개', shortcut: 'E' }
  ];

  const handleToolSelect = (tool: DrawingTool) => {
    onToolChange(tool);
    if (!isDrawingMode) {
      onToggleDrawing(); // 도구 선택 시 자동으로 그리기 모드 활성화
    }
  };

  const getCursorStyle = () => {
    if (!isDrawingMode) return 'grab';
    
    switch (currentTool) {
      case 'pen':
        return 'crosshair';
      case 'highlighter':
        return 'text';
      case 'eraser':
        return 'grab';
      default:
        return 'crosshair';
    }
  };

  return (
    <div
      className="drawing-toolbar fixed z-50 flex items-center gap-2 p-2 glass-button rounded-lg shadow-lg"
      style={{
        left: `${position.x + 10}px`,
        top: `${position.y - 60}px`,
        cursor: getCursorStyle()
      }}
    >
      {/* 그리기 모드 토글 */}
      <button
        onClick={onToggleDrawing}
        className={`tool-button p-2 rounded-lg transition-all duration-200 ${
          isDrawingMode 
            ? 'bg-blue-500 text-white shadow-md' 
            : 'bg-white/20 text-gray-700 dark:text-gray-200 hover:bg-white/30'
        }`}
        title={`그리기 모드 ${isDrawingMode ? '해제' : '활성화'} (D)`}
      >
        ✏️
      </button>
      
      {/* 도구 확장/축소 토글 */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`tool-button p-2 rounded-lg transition-all duration-200 ${
          isExpanded 
            ? 'bg-gray-500 text-white' 
            : 'bg-white/20 text-gray-700 dark:text-gray-200 hover:bg-white/30'
        }`}
        title="도구 더보기"
      >
        {isExpanded ? '◀' : '▶'}
      </button>

      {/* 확장된 도구들 */}
      {(isDrawingMode || isExpanded) && (
        <div className="flex items-center gap-2 border-l border-gray-300 dark:border-gray-600 pl-2 ml-2">
          {tools.map((tool) => (
            <button
              key={tool.id}
              onClick={() => handleToolSelect(tool.id)}
              className={`tool-button p-2 rounded-lg transition-all duration-200 ${
                currentTool === tool.id && isDrawingMode
                  ? 'bg-blue-500 text-white shadow-md transform scale-105' 
                  : 'bg-white/20 text-gray-700 dark:text-gray-200 hover:bg-white/30 hover:scale-105'
              }`}
              title={`${tool.label} (${tool.shortcut})`}
            >
              {tool.icon}
            </button>
          ))}
          
          {/* 구분선 */}
          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />
          
          {/* 실행취소/재실행 */}
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className={`tool-button p-2 rounded-lg transition-all duration-200 ${
              canUndo
                ? 'bg-white/20 text-gray-700 dark:text-gray-200 hover:bg-white/30 hover:scale-105'
                : 'bg-white/10 text-gray-400 dark:text-gray-500 cursor-not-allowed'
            }`}
            title="실행취소 (Ctrl+Z)"
          >
            ↶
          </button>
          
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className={`tool-button p-2 rounded-lg transition-all duration-200 ${
              canRedo
                ? 'bg-white/20 text-gray-700 dark:text-gray-200 hover:bg-white/30 hover:scale-105'
                : 'bg-white/10 text-gray-400 dark:text-gray-500 cursor-not-allowed'
            }`}
            title="재실행 (Ctrl+Y)"
          >
            ↷
          </button>
        </div>
      )}
      
      {/* 키보드 힌트 */}
      {isDrawingMode && (
        <div className="text-xs text-gray-500 dark:text-gray-400 ml-2 hidden sm:block">
          Press 'D' to toggle drawing mode
        </div>
      )}
    </div>
  );
};

// 모바일용 간단한 툴바
export const MobileDrawingToolbar = ({
  currentTool,
  onToolChange,
  isDrawingMode,
  onToggleDrawing
}: Pick<DrawingToolbarProps, 'currentTool' | 'onToolChange' | 'isDrawingMode' | 'onToggleDrawing'>) => {
  const tools = [
    { id: 'pen' as DrawingTool, icon: '🖊️' },
    { id: 'highlighter' as DrawingTool, icon: '🖍️' },
    { id: 'eraser' as DrawingTool, icon: '🧽' }
  ];

  return (
    <div className="fixed bottom-[calc(var(--safe-bottom)+1rem)] left-[calc(var(--safe-left)+1rem)] right-[calc(var(--safe-right)+1rem)] z-50 sm:hidden">
      <div className="glass-button rounded-full p-3 flex justify-center items-center gap-4">
        {/* 그리기 모드 토글 */}
        <button
          onClick={onToggleDrawing}
          className={`p-3 rounded-full transition-all duration-200 ${
            isDrawingMode 
              ? 'bg-blue-500 text-white shadow-lg' 
              : 'bg-white/20 text-gray-700'
          }`}
        >
          ✏️
        </button>
        
        {/* 도구들 */}
        {isDrawingMode && tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => onToolChange(tool.id)}
            className={`p-3 rounded-full transition-all duration-200 ${
              currentTool === tool.id
                ? 'bg-blue-500 text-white shadow-lg transform scale-110' 
                : 'bg-white/20 text-gray-700'
            }`}
          >
            {tool.icon}
          </button>
        ))}
      </div>
    </div>
  );
};

// 키보드 단축키 훅
export const useDrawingKeyboardShortcuts = (
  onToggleDrawing: () => void,
  onToolChange: (tool: DrawingTool) => void,
  onUndo?: () => void,
  onRedo?: () => void
) => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // 텍스트 입력 중일 때는 단축키 비활성화
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      return;
    }

    switch (e.key.toLowerCase()) {
      case 'd':
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          onToggleDrawing();
        }
        break;
      case 'p':
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          onToolChange('pen');
        }
        break;
      case 'h':
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          onToolChange('highlighter');
        }
        break;
      case 'e':
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          onToolChange('eraser');
        }
        break;
      case 'z':
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
          e.preventDefault();
          onUndo?.();
        }
        break;
      case 'y':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          onRedo?.();
        }
        break;
      case 'escape':
        e.preventDefault();
        onToggleDrawing(); // ESC로 그리기 모드 해제
        break;
    }
  };

  return { handleKeyDown };
};
