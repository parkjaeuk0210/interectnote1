import React, { useCallback } from 'react';
import { Circle } from 'react-konva';

interface ImportantIndicatorProps {
  width: number;
  isSelected: boolean;
  isImportant: boolean;
  isDarkMode: boolean;
  isInteractive: boolean;
  onToggle: () => void;
}

export const ImportantIndicator: React.FC<ImportantIndicatorProps> = ({
  width,
  isSelected,
  isImportant,
  isDarkMode,
  isInteractive,
  onToggle,
}) => {
  if (!isSelected && !isImportant) return null;

  const x = Math.max(0, width - 18);
  const y = 12;

  const ringStroke = isDarkMode ? 'rgba(255, 255, 255, 0.28)' : 'rgba(0, 0, 0, 0.18)';
  const dotFill = isDarkMode ? 'rgba(255, 255, 255, 0.65)' : 'rgba(17, 24, 39, 0.5)';

  const stopBubble = useCallback((e: any) => {
    e.cancelBubble = true;
    e.evt?.preventDefault?.();
  }, []);

  const handleToggle = useCallback((e: any) => {
    stopBubble(e);
    if (!isInteractive) return;
    onToggle();
  }, [isInteractive, onToggle, stopBubble]);

  return (
    <>
      {isSelected && (
        <Circle
          x={x}
          y={y}
          radius={7}
          stroke={ringStroke}
          strokeWidth={1.25}
          fill="rgba(0, 0, 0, 0)"
          listening={isInteractive}
          onMouseDown={isInteractive ? stopBubble : undefined}
          onTouchStart={isInteractive ? stopBubble : undefined}
          onClick={isInteractive ? handleToggle : undefined}
          onTap={isInteractive ? handleToggle : undefined}
        />
      )}
      {isImportant && (
        <Circle
          x={x}
          y={y}
          radius={3.25}
          fill={dotFill}
          listening={false}
        />
      )}
    </>
  );
};

