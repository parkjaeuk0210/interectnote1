import { useRef, useState } from 'react';
import { Group, Rect, Text } from 'react-konva';
import Konva from 'konva';
import { CanvasFile as CanvasFileType } from '../../types';
import { useAppStore } from '../../contexts/StoreProvider';
import { PDFCanvas } from '../PDF/PDFCanvas';

interface CanvasFileProps {
  file: CanvasFileType;
  isSelected: boolean;
  onSelect: () => void;
  onDraggingChange?: (isDragging: boolean) => void;
}

export const CanvasFile = ({ 
  file, 
  isSelected, 
  onSelect,
  onDraggingChange
}: CanvasFileProps) => {
  // PDF 파일은 PDFCanvas로 렌더링
  if (file.fileType === 'pdf') {
    return (
      <PDFCanvas
        file={file}
        isSelected={isSelected}
        onSelect={onSelect}
        onDraggingChange={onDraggingChange}
      />
    );
  }
  const groupRef = useRef<Konva.Group>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const updateFile = useAppStore((state) => state.updateFile);
  const selectToMoveMode = useAppStore((state) => state.selectToMoveMode);

  const handleDragStart = () => {
    setIsDragging(true);
    onDraggingChange?.(true);
  };

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    setIsDragging(false);
    onDraggingChange?.(false);
    
    const node = e.target;
    updateFile(file.id, {
      x: node.x(),
      y: node.y(),
    });
  };

  const handleClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
    onSelect();
  };

  const handleDoubleClick = () => {
    // Open file in new tab
    window.open(file.url, '_blank');
  };

  // Get file icon based on type
  const getFileIcon = () => {
    switch (file.fileType) {
      case 'pdf':
        return '📄';
      case 'document':
        return '📝';
      default:
        return '📎';
    }
  };

  // Get file color based on type
  const getFileColor = () => {
    switch (file.fileType) {
      case 'pdf':
        return { bg: '#FEE2E2', border: '#EF4444', icon: '#DC2626' };
      case 'document':
        return { bg: '#DBEAFE', border: '#3B82F6', icon: '#2563EB' };
      default:
        return { bg: '#F3F4F6', border: '#6B7280', icon: '#4B5563' };
    }
  };

  const colors = getFileColor();
  const fileIcon = getFileIcon();
  
  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  // Truncate filename
  const truncateFileName = (name: string, maxLength: number = 20) => {
    if (name.length <= maxLength) return name;
    const ext = name.split('.').pop() || '';
    const nameWithoutExt = name.slice(0, name.length - ext.length - 1);
    const truncatedName = nameWithoutExt.slice(0, maxLength - ext.length - 4) + '...';
    return truncatedName + '.' + ext;
  };

  return (
    <Group
      ref={groupRef}
      x={file.x}
      y={file.y}
      draggable={!selectToMoveMode || isSelected}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={handleClick}
      onTap={handleClick}
      onDblClick={handleDoubleClick}
      onDblTap={handleDoubleClick}
    >
      {/* Shadow */}
      <Rect
        width={file.width}
        height={file.height}
        fill="black"
        opacity={0.1}
        cornerRadius={12}
        offsetX={isDragging ? -4 : -2}
        offsetY={isDragging ? 8 : 4}
        listening={false}
      />
      
      {/* Main container */}
      <Rect
        width={file.width}
        height={file.height}
        fill={colors.bg}
        stroke={isSelected ? '#3B82F6' : colors.border}
        strokeWidth={isSelected ? 2 : 1}
        cornerRadius={12}
        shadowColor={isSelected ? 'rgba(59, 130, 246, 0.3)' : 'rgba(0, 0, 0, 0.1)'}
        shadowBlur={isSelected ? 20 : 10}
        shadowOpacity={1}
      />
      
      {/* Icon area */}
      <Rect
        x={10}
        y={10}
        width={file.width - 20}
        height={120}
        fill="white"
        cornerRadius={8}
        opacity={0.8}
        listening={false}
      />
      
      {/* File icon */}
      <Text
        x={file.width / 2}
        y={70}
        text={fileIcon}
        fontSize={48}
        align="center"
        verticalAlign="middle"
        offsetX={24}
        offsetY={24}
        listening={false}
      />
      
      {/* File name */}
      <Text
        x={10}
        y={140}
        width={file.width - 20}
        text={truncateFileName(file.fileName)}
        fontSize={14}
        fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        fill="#1F2937"
        align="center"
        fontStyle="500"
        listening={false}
      />
      
      {/* File type badge */}
      <Rect
        x={10}
        y={165}
        width={60}
        height={24}
        fill={colors.icon}
        cornerRadius={12}
        listening={false}
      />
      <Text
        x={10}
        y={165}
        width={60}
        height={24}
        text={file.fileType.toUpperCase()}
        fontSize={11}
        fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        fill="white"
        align="center"
        verticalAlign="middle"
        fontStyle="bold"
        listening={false}
      />
      
      {/* File size */}
      <Text
        x={file.width - 70}
        y={168}
        text={formatFileSize(file.fileSize)}
        fontSize={11}
        fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        fill="#6B7280"
        align="right"
        listening={false}
      />
      
      {/* Double-click hint */}
      <Text
        x={10}
        y={file.height - 30}
        width={file.width - 20}
        text="더블클릭으로 열기"
        fontSize={10}
        fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        fill="#9CA3AF"
        align="center"
        fontStyle="italic"
        listening={false}
      />
    </Group>
  );
};
