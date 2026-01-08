import React from 'react';
import { Rect } from 'react-konva';
import { CORNER_RADIUS } from '../../../constants/colors';

interface EditingIndicatorProps {
  width: number;
  height: number;
  isEditing: boolean;
}

export const EditingIndicator: React.FC<EditingIndicatorProps> = ({
  width,
  height,
  isEditing,
}) => {
  if (!isEditing) return null;
  
  return (
    <Rect
      width={width}
      height={height}
      stroke="#3B82F6"
      strokeWidth={2}
      cornerRadius={CORNER_RADIUS}
      fill="transparent"
      dash={[5, 5]}
      shadowEnabled={false}
      listening={false}
    />
  );
};
