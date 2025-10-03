import React, { useEffect, useMemo, useRef } from 'react';
import { Rect } from 'react-konva';
import Konva from 'konva';
import { CORNER_RADIUS } from '../../../constants/colors';
import { NoteColor } from '../../../types';

const LIGHT_MODE_GRADIENTS: Record<NoteColor, (number | string)[]> = {
  yellow: [
    0, 'rgba(254, 243, 199, 0.95)',
    0.5, 'rgba(253, 230, 138, 0.88)',
    1, 'rgba(252, 211, 77, 0.82)'
  ],
  pink: [
    0, 'rgba(252, 231, 243, 0.95)',
    0.5, 'rgba(251, 207, 232, 0.88)',
    1, 'rgba(249, 168, 212, 0.82)'
  ],
  blue: [
    0, 'rgba(224, 242, 254, 0.95)',
    0.5, 'rgba(186, 230, 253, 0.88)',
    1, 'rgba(147, 197, 253, 0.82)'
  ],
  green: [
    0, 'rgba(236, 253, 245, 0.95)',
    0.5, 'rgba(209, 250, 229, 0.88)',
    1, 'rgba(134, 239, 172, 0.82)'
  ],
  purple: [
    0, 'rgba(243, 232, 255, 0.95)',
    0.5, 'rgba(233, 213, 255, 0.88)',
    1, 'rgba(196, 167, 231, 0.82)'
  ],
  orange: [
    0, 'rgba(254, 243, 199, 0.95)',
    0.5, 'rgba(253, 230, 138, 0.88)',
    1, 'rgba(251, 191, 36, 0.82)'
  ],
};

const DARK_MODE_FILLS: Record<NoteColor, string> = {
  yellow: '#78350F',
  pink: '#831843',
  blue: '#1E3A8A',
  green: '#14532D',
  purple: '#4C1D95',
  orange: '#7C2D12',
};

interface NoteBackgroundProps {
  width: number;
  height: number;
  color: NoteColor;
  isDarkMode: boolean;
  isSelected: boolean;
  isDragging: boolean;
  isResizing: boolean;
  performanceMode: 'high' | 'medium' | 'low';
}

export const NoteBackground: React.FC<NoteBackgroundProps> = ({
  width,
  height,
  color,
  isDarkMode,
  isSelected,
  isDragging,
  isResizing,
  performanceMode,
}) => {
  // Ensure width and height are valid numbers
  const safeWidth = Math.max(1, width || 200);
  const safeHeight = Math.max(1, height || 200);
  const rectRef = useRef<Konva.Rect>(null);

  const gradientStops = useMemo(() => {
    if (isDarkMode) return null;
    return LIGHT_MODE_GRADIENTS[color] ?? LIGHT_MODE_GRADIENTS.yellow;
  }, [color, isDarkMode]);

  const darkFill = useMemo(() => {
    return DARK_MODE_FILLS[color] ?? DARK_MODE_FILLS.yellow;
  }, [color]);

  useEffect(() => {
    const node = rectRef.current;
    if (!node) return;

    node.clearCache();

    // Skip caching in dark mode (flat color) or when performance mode is low.
    if (isDarkMode || performanceMode === 'low') {
      return;
    }

    if (isResizing) {
      return;
    }

    node.cache({ drawBorder: false });
  }, [color, isDarkMode, performanceMode, isResizing, safeWidth, safeHeight]);

  return (
    <Rect
      ref={rectRef}
      width={safeWidth}
      height={safeHeight}
      cornerRadius={CORNER_RADIUS}
      fill={isDarkMode ? darkFill : undefined}
      fillLinearGradientStartPoint={{ x: 0, y: 0 }}
      fillLinearGradientEndPoint={{ x: safeWidth * 0.5, y: safeHeight }}
      fillLinearGradientColorStops={gradientStops ?? undefined}
      listening={false}
      shadowColor={isDarkMode ? "rgba(0, 0, 0, 0.5)" : "rgba(0, 0, 0, 0.1)"}
      shadowBlur={performanceMode === 'high' ? (isSelected ? 20 : 8) : 0}
      shadowOffset={{ x: 0, y: performanceMode === 'high' ? (isSelected ? 6 : 2) : 0 }}
      shadowEnabled={performanceMode === 'high' && !isDragging && !isResizing}
    />
  );
};
