import { useState, useMemo } from 'react';
import { Line, Group, Rect } from 'react-konva';
import Konva from 'konva';
import { Point, DrawingTool, DrawingAnnotation, DrawingStyle } from '../../types';

interface PDFAnnotationLayerProps {
  annotations: DrawingAnnotation[];
  isDrawingMode: boolean;
  currentTool: DrawingTool;
  onAddAnnotation: (annotation: DrawingAnnotation) => void;
  onUpdateAnnotation?: (id: string, annotation: Partial<DrawingAnnotation>) => void;
  width: number;
  height: number;
}

export const PDFAnnotationLayer = ({
  annotations,
  isDrawingMode,
  currentTool,
  onAddAnnotation,
  width,
  height
}: PDFAnnotationLayerProps) => {
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);

  // 입력 방식별 기본 설정 (미사용, 추후 개선 예정)
  // const getBaseStyle = (inputType: string) => {
  //   switch (inputType) {
  //     case 'pen': // Apple Pencil, Surface Pen 등
  //       return {
  //         basePressure: 0.3,
  //         pressureMultiplier: 2.0,
  //         smoothing: 0.8
  //       };
  //     case 'touch': // 손가락
  //       return {
  //         basePressure: 0.8,
  //         pressureMultiplier: 1.2,
  //         smoothing: 0.6
  //       };
  //     case 'mouse': // 마우스
  //     default:
  //       return {
  //         basePressure: 0.5,
  //         pressureMultiplier: 1.0,
  //         smoothing: 0.4
  //       };
  //   }
  // };

  // 도구별 스타일 가져오기
  const getDrawingStyle = (tool: DrawingTool): DrawingStyle => {
    switch (tool) {
      case 'pen':
        return {
          stroke: '#000000',
          strokeWidth: 2,
          opacity: 1,
          globalCompositeOperation: 'source-over'
        };
      case 'highlighter':
        return {
          stroke: '#FFFF00',
          strokeWidth: 15,
          opacity: 0.3,
          globalCompositeOperation: 'multiply'
        };
      case 'eraser':
        return {
          stroke: '#FFFFFF',
          strokeWidth: 10,
          opacity: 1,
          globalCompositeOperation: 'destination-out'
        };
      default:
        return {
          stroke: '#000000',
          strokeWidth: 2,
          opacity: 1,
          globalCompositeOperation: 'source-over'
        };
    }
  };

  // 압력 기반 선 굵기 계산 (현재 미사용, 추후 개선 예정)
  // const getStrokeWidth = (pressure: number, tool: DrawingTool, inputType: string) => {
  //   const baseStyle = getBaseStyle(inputType);
  //   const adjusted = Math.max(baseStyle.basePressure, pressure * baseStyle.pressureMultiplier);
  //   
  //   switch (tool) {
  //     case 'pen':
  //       return adjusted * 3;
  //     case 'highlighter':
  //       return 15; // 하이라이터는 고정 굵기
  //     case 'eraser':
  //       return adjusted * 8;
  //     default:
  //       return adjusted * 2;
  //   }
  // };

  // 통합된 포인터 이벤트 처리
  const handlePointerDown = (e: Konva.KonvaEventObject<PointerEvent>) => {
    if (!isDrawingMode || currentTool === 'none') return;
    
    e.evt.preventDefault();
    setIsDrawing(true);
    
    const pos = e.target.getStage()?.getPointerPosition();
    const pressure = e.evt.pressure || 0.5;
    const inputType = (e.evt.pointerType || 'mouse') as 'mouse' | 'touch' | 'pen';
    
    if (pos) {
      setCurrentStroke([{ 
        x: pos.x, 
        y: pos.y, 
        pressure,
        inputType
      }]);
    }
  };

  const handlePointerMove = (e: Konva.KonvaEventObject<PointerEvent>) => {
    if (!isDrawing) return;
    
    e.evt.preventDefault();
    const pos = e.target.getStage()?.getPointerPosition();
    const pressure = e.evt.pressure || 0.5;
    const inputType = (e.evt.pointerType || 'mouse') as 'mouse' | 'touch' | 'pen';
    
    if (pos) {
      setCurrentStroke(prev => [...prev, { 
        x: pos.x, 
        y: pos.y, 
        pressure,
        inputType
      }]);
    }
  };

  const handlePointerUp = () => {
    if (!isDrawing || currentStroke.length === 0) return;
    
    // 그린 선을 주석으로 저장
    const newAnnotation: DrawingAnnotation = {
      id: `draw-${Date.now()}`,
      type: 'draw',
      page: 1, // 현재 페이지
      position: { x: currentStroke[0].x, y: currentStroke[0].y },
      strokes: [{
        points: currentStroke,
        style: getDrawingStyle(currentTool),
        timestamp: Date.now()
      }],
      createdAt: new Date(),
      author: 'current-user'
    };
    
    onAddAnnotation(newAnnotation);
    setIsDrawing(false);
    setCurrentStroke([]);
  };

  // 터치 이벤트 핸들러 (폴백)
  const handleTouchStart = (e: Konva.KonvaEventObject<TouchEvent>) => {
    if (!isDrawingMode || currentTool === 'none') return;
    
    e.evt.preventDefault();
    setIsDrawing(true);
    
    const pos = e.target.getStage()?.getPointerPosition();
    if (pos) {
      setCurrentStroke([{ 
        x: pos.x, 
        y: pos.y, 
        pressure: 0.8, // 터치 기본 압력
        inputType: 'touch'
      }]);
    }
  };

  const handleTouchMove = (e: Konva.KonvaEventObject<TouchEvent>) => {
    if (!isDrawing) return;
    
    e.evt.preventDefault();
    const pos = e.target.getStage()?.getPointerPosition();
    
    if (pos) {
      setCurrentStroke(prev => [...prev, { 
        x: pos.x, 
        y: pos.y, 
        pressure: 0.8,
        inputType: 'touch'
      }]);
    }
  };

  // 마우스 이벤트 핸들러 (폴백)
  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!isDrawingMode || currentTool === 'none') return;
    
    e.evt.preventDefault();
    setIsDrawing(true);
    
    const pos = e.target.getStage()?.getPointerPosition();
    if (pos) {
      setCurrentStroke([{ 
        x: pos.x, 
        y: pos.y, 
        pressure: 0.5, // 마우스 기본 압력
        inputType: 'mouse'
      }]);
    }
  };

  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!isDrawing) return;
    
    e.evt.preventDefault();
    const pos = e.target.getStage()?.getPointerPosition();
    
    if (pos) {
      setCurrentStroke(prev => [...prev, { 
        x: pos.x, 
        y: pos.y, 
        pressure: 0.5,
        inputType: 'mouse'
      }]);
    }
  };

  return (
    <Group
      listening={isDrawingMode}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handlePointerUp}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handlePointerUp}
    >
      {/* 투명한 그리기 영역 (PDF 크기에 맞춤) */}
      <Rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill="transparent"
        listening={isDrawingMode}
      />
      
      {/* 기존 주석들 렌더링 */}
      {annotations.map(annotation => (
        <Group key={annotation.id}>
          {annotation.strokes.map((stroke, strokeIndex) => (
            <SmoothedLine
              key={`${annotation.id}-${strokeIndex}`}
              points={stroke.points}
              style={stroke.style}
            />
          ))}
        </Group>
      ))}
      
      {/* 현재 그리고 있는 선 */}
      {isDrawing && currentStroke.length > 1 && (
        <SmoothedLine 
          points={currentStroke}
          style={getDrawingStyle(currentTool)}
        />
      )}
    </Group>
  );
};

// 부드러운 선 컴포넌트
interface SmoothedLineProps {
  points: Point[];
  style: DrawingStyle;
}

const SmoothedLine = ({ points, style }: SmoothedLineProps) => {
  // 부드러운 곡선으로 변환
  const smoothedPoints = useMemo(() => {
    if (points.length < 2) return [];
    if (points.length === 2) return points.flatMap(p => [p.x, p.y]);
    
    const smoothed = [points[0].x, points[0].y]; // 첫 점 추가
    
    for (let i = 1; i < points.length - 1; i++) {
      const p1 = points[i - 1];
      const p2 = points[i];
      const p3 = points[i + 1];
      
      // Catmull-Rom spline으로 부드럽게
      const midX = (p1.x + p2.x + p3.x) / 3;
      const midY = (p1.y + p2.y + p3.y) / 3;
      smoothed.push(midX, midY);
    }
    
    // 마지막 점 추가
    const lastPoint = points[points.length - 1];
    smoothed.push(lastPoint.x, lastPoint.y);
    
    return smoothed;
  }, [points]);

  if (smoothedPoints.length === 0) return null;

  // 입력 타입에 따른 평활도 조정
  const inputType = points[0]?.inputType || 'mouse';
  const tension = inputType === 'pen' ? 0.8 : inputType === 'touch' ? 0.6 : 0.4;

  return (
    <Line
      points={smoothedPoints}
      stroke={style.stroke}
      strokeWidth={style.strokeWidth}
      opacity={style.opacity}
      lineCap="round"
      lineJoin="round"
      tension={tension}
      globalCompositeOperation={style.globalCompositeOperation as any}
      perfectDrawEnabled={false} // 성능 최적화
    />
  );
};
