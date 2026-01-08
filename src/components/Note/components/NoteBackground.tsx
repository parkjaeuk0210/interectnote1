import React from 'react';
import { Shape } from 'react-konva';
import { CORNER_RADIUS } from '../../../constants/colors';

interface NoteBackgroundProps {
  width: number;
  height: number;
  color: string;
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
  
  return (
    <Shape
      sceneFunc={(context) => {
        let fillStyle;
        
        if (isDarkMode) {
          // 다크 모드에서는 단색 사용
          switch (color) {
            case 'yellow':
              fillStyle = '#78350F';
              break;
            case 'pink':
              fillStyle = '#831843';
              break;
            case 'blue':
              fillStyle = '#1E3A8A';
              break;
            case 'green':
              fillStyle = '#14532D';
              break;
            case 'purple':
              fillStyle = '#4C1D95';
              break;
            case 'orange':
              fillStyle = '#7C2D12';
              break;
            default:
              fillStyle = '#78350F';
          }
        } else {
          // 라이트 모드에서는 그라데이션 유지
          const gradient = context.createLinearGradient(0, 0, safeWidth * 0.5, safeHeight);
          switch (color) {
            case 'yellow':
              gradient.addColorStop(0, 'rgba(254, 243, 199, 0.95)');
              gradient.addColorStop(0.5, 'rgba(253, 230, 138, 0.88)');
              gradient.addColorStop(1, 'rgba(252, 211, 77, 0.82)');
              break;
            case 'pink':
              gradient.addColorStop(0, 'rgba(252, 231, 243, 0.95)');
              gradient.addColorStop(0.5, 'rgba(251, 207, 232, 0.88)');
              gradient.addColorStop(1, 'rgba(249, 168, 212, 0.82)');
              break;
            case 'blue':
              gradient.addColorStop(0, 'rgba(224, 242, 254, 0.95)');
              gradient.addColorStop(0.5, 'rgba(186, 230, 253, 0.88)');
              gradient.addColorStop(1, 'rgba(147, 197, 253, 0.82)');
              break;
            case 'green':
              gradient.addColorStop(0, 'rgba(236, 253, 245, 0.95)');
              gradient.addColorStop(0.5, 'rgba(209, 250, 229, 0.88)');
              gradient.addColorStop(1, 'rgba(134, 239, 172, 0.82)');
              break;
            case 'purple':
              gradient.addColorStop(0, 'rgba(243, 232, 255, 0.95)');
              gradient.addColorStop(0.5, 'rgba(233, 213, 255, 0.88)');
              gradient.addColorStop(1, 'rgba(196, 167, 231, 0.82)');
              break;
            case 'orange':
              gradient.addColorStop(0, 'rgba(254, 243, 199, 0.95)');
              gradient.addColorStop(0.5, 'rgba(253, 230, 138, 0.88)');
              gradient.addColorStop(1, 'rgba(251, 191, 36, 0.82)');
              break;
          }
          fillStyle = gradient;
        }
        
        context.beginPath();
        context.roundRect(0, 0, safeWidth, safeHeight, CORNER_RADIUS);
        context.fillStyle = fillStyle;
        context.fill();
        context.closePath();
      }}
      hitFunc={(context, shape) => {
        // IMPORTANT: Don't override fillStyle in hit graph (Konva sets a unique color key).
        // Otherwise getIntersection() cannot detect this shape and notes become unclickable.
        context.beginPath();
        context.roundRect(0, 0, safeWidth, safeHeight, CORNER_RADIUS);
        context.closePath();
        context.fillStrokeShape(shape);
      }}
      shadowColor={isDarkMode ? "rgba(0, 0, 0, 0.5)" : "rgba(0, 0, 0, 0.1)"}
      shadowBlur={performanceMode === 'high' ? (isSelected ? 20 : 8) : 0}
      shadowOffset={{ x: 0, y: performanceMode === 'high' ? (isSelected ? 6 : 2) : 0 }}
      shadowEnabled={performanceMode === 'high' && !isDragging && !isResizing}
    />
  );
};
