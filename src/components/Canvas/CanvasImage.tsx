import { useRef, useEffect, useState } from 'react';
import { Image, Group, Rect, Transformer, Text } from 'react-konva';
import Konva from 'konva';
import { CanvasImage as CanvasImageType } from '../../types';
import { useAppStore } from '../../contexts/StoreProvider';

interface CanvasImageProps {
  image: CanvasImageType;
  isSelected: boolean;
  onSelect: () => void;
  onDraggingChange?: (isDragging: boolean) => void;
  onResizingChange?: (isResizing: boolean) => void;
}

export const CanvasImage = ({ 
  image, 
  isSelected, 
  onSelect,
  onDraggingChange,
  onResizingChange 
}: CanvasImageProps) => {
  const groupRef = useRef<Konva.Group>(null);
  const imageRef = useRef<Konva.Image>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const [imageObj, setImageObj] = useState<HTMLImageElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [currentSize, setCurrentSize] = useState({ width: image.width, height: image.height });
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  
  const updateImage = useAppStore((state) => state.updateImage);

  // Load image
  useEffect(() => {
    const img = new window.Image();
    img.src = image.url;
    img.onload = () => {
      setImageObj(img);
    };
  }, [image.url]);

  // Handle transformer
  useEffect(() => {
    if (isSelected && transformerRef.current && imageRef.current) {
      transformerRef.current.nodes([imageRef.current]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  // Handle Shift key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift' && isSelected) {
        setIsShiftPressed(true);
        if (transformerRef.current) {
          transformerRef.current.keepRatio(false); // Shift pressed = free transform
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift' && isSelected) {
        setIsShiftPressed(false);
        if (transformerRef.current) {
          transformerRef.current.keepRatio(true); // Shift released = keep ratio
        }
      }
    };

    if (isSelected) {
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isSelected]);

  const handleDragStart = () => {
    setIsDragging(true);
    onDraggingChange?.(true);
  };

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    setIsDragging(false);
    onDraggingChange?.(false);
    
    const node = e.target;
    updateImage(image.id, {
      x: node.x(),
      y: node.y(),
    });
  };

  const handleTransformStart = () => {
    setIsResizing(true);
    onResizingChange?.(true);
  };

  const handleTransformEnd = () => {
    setIsResizing(false);
    onResizingChange?.(false);
    
    const node = imageRef.current;
    const group = groupRef.current;
    if (!node || !group) return;

    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    // Reset scale
    node.scaleX(1);
    node.scaleY(1);

    // Calculate new dimensions
    const newWidth = Math.max(50, node.width() * scaleX);
    const newHeight = Math.max(50, node.height() * scaleY);

    // Update with group position + node position
    updateImage(image.id, {
      x: group.x() + node.x(),
      y: group.y() + node.y(),
      width: newWidth,
      height: newHeight,
    });
  };

  const handleClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
    onSelect();
  };

  const handleDblClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
    
    // Reset to original size with animation
    const node = imageRef.current;
    if (!node || !image.originalWidth || !image.originalHeight) return;
    
    // Calculate the scale needed to fit original size within reasonable bounds
    const maxSize = 800;
    let targetWidth = image.originalWidth;
    let targetHeight = image.originalHeight;
    
    if (targetWidth > maxSize || targetHeight > maxSize) {
      const ratio = Math.min(maxSize / targetWidth, maxSize / targetHeight);
      targetWidth *= ratio;
      targetHeight *= ratio;
    }
    
    // Animate the size change
    node.to({
      width: targetWidth,
      height: targetHeight,
      duration: 0.3,
      easing: Konva.Easings.EaseInOut,
      onFinish: () => {
        updateImage(image.id, {
          width: targetWidth,
          height: targetHeight,
        });
        setCurrentSize({ width: targetWidth, height: targetHeight });
      }
    });
  };

  if (!imageObj) return null;

	  return (
	    <Group
	      ref={groupRef}
	      x={image.x}
	      y={image.y}
	      draggable
	      onDragStart={handleDragStart}
	      onDragEnd={handleDragEnd}
	      onClick={handleClick}
      onTap={handleClick}
      onDblClick={handleDblClick}
      onDblTap={handleDblClick}
    >
      {/* Shadow for selected state */}
      {isSelected && (
        <Rect
          x={-2}
          y={-2}
          width={image.width + 4}
          height={image.height + 4}
          fill="transparent"
          stroke="transparent"
          strokeWidth={0}
          cornerRadius={8}
          shadowColor="rgba(59, 130, 246, 0.4)"
          shadowBlur={25}
          shadowOpacity={0.6}
          listening={false}
        />
      )}
      
      <Image
        ref={imageRef}
        image={imageObj}
        width={image.width}
        height={image.height}
        cornerRadius={8}
        shadowColor={isDragging ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.15)'}
        shadowBlur={isDragging ? 20 : 10}
        shadowOpacity={1}
        shadowOffsetY={isDragging ? 10 : 5}
        onTransformStart={handleTransformStart}
        onTransformEnd={handleTransformEnd}
        onTransform={() => {
          const node = imageRef.current;
          if (node) {
            const width = Math.round(node.width() * node.scaleX());
            const height = Math.round(node.height() * node.scaleY());
            setCurrentSize({ width, height });
          }
        }}
      />
      
      {isSelected && (
        <Transformer
          ref={transformerRef}
          boundBoxFunc={(_, newBox) => {
            // Limit minimum size and maintain aspect ratio
            const aspectRatio = image.width / image.height;
            
            if (newBox.width < 50) {
              newBox.width = 50;
              newBox.height = 50 / aspectRatio;
            }
            if (newBox.height < 50) {
              newBox.height = 50;
              newBox.width = 50 * aspectRatio;
            }
            
            return newBox;
          }}
          enabledAnchors={[
            'top-left',
            'top-right',
            'bottom-left',
            'bottom-right',
          ]}
          anchorStroke="#3B82F6"
          anchorFill="white"
          anchorSize={16}
          anchorCornerRadius={2}
          borderStroke="#3B82F6"
          borderStrokeWidth={2}
          borderDash={[6, 3]}
          rotateEnabled={false}
          keepRatio={true}
          anchorStyleFunc={(anchor) => {
            anchor.on('mouseenter', function() {
              document.body.style.cursor = 'nwse-resize';
              this.scale({ x: 1.2, y: 1.2 });
              this.fill('#3B82F6');
            });
            anchor.on('mouseleave', function() {
              document.body.style.cursor = 'default';
              this.scale({ x: 1, y: 1 });
              this.fill('white');
            });
          }}
        />
      )}
      
      {/* Size tooltip during resize */}
      {isResizing && isSelected && (
        <>
          <Rect
            x={image.width + 10}
            y={-30}
            width={140}
            height={50}
            fill="rgba(0, 0, 0, 0.85)"
            cornerRadius={6}
            listening={false}
          />
          <Text
            x={image.width + 10}
            y={-25}
            width={140}
            height={20}
            text={`${currentSize.width} × ${currentSize.height}px`}
            fill="white"
            fontSize={14}
            fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto"
            align="center"
            verticalAlign="middle"
            listening={false}
          />
          <Text
            x={image.width + 10}
            y={-5}
            width={140}
            height={20}
            text={isShiftPressed ? '자유 변형' : '비율 유지'}
            fill="#60A5FA"
            fontSize={12}
            fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto"
            align="center"
            verticalAlign="middle"
            listening={false}
          />
        </>
      )}
    </Group>
  );
};
