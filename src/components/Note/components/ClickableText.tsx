import React, { useCallback, useState, useRef, useMemo } from 'react';
import { Text, Group, Rect } from 'react-konva';
import { FONT_SIZE, LINE_HEIGHT } from '../../../constants/colors';
import { parseTextWithURLs } from '../../../utils/urlDetection';
import Konva from 'konva';

interface ClickableTextProps {
  content: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isDarkMode: boolean;
  fontSize?: number;
  fontFamily?: string;
  onLinkClick?: (url: string) => void;
  debugMode?: boolean;
}

export const ClickableText: React.FC<ClickableTextProps> = ({
  content,
  x,
  y,
  width,
  height,
  isDarkMode,
  fontSize = FONT_SIZE,
  fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif",
  onLinkClick,
  debugMode = false
}) => {
  const textColor = isDarkMode ? "rgba(255, 255, 255, 0.9)" : "rgba(0, 0, 0, 0.85)";
  const linkColor = isDarkMode ? "#60A5FA" : "#2563EB";
  const linkHoverColor = isDarkMode ? "#93C5FD" : "#1D4ED8";
  
  const [hoveredSegmentIndex, setHoveredSegmentIndex] = useState<number | null>(null);
  const groupRef = useRef<Konva.Group>(null);
  
  const handleLinkClick = useCallback((url: string, e?: any) => {
    if (e) {
      e.cancelBubble = true; // 이벤트 버블링 중단
    }
    if (onLinkClick) {
      onLinkClick(url);
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }, [onLinkClick]);
  
  // segments를 useMemo로 메모이제이션
  const segments = useMemo(() => {
    return parseTextWithURLs(content);
  }, [content]);
  
  // 각 세그먼트를 개별적으로 렌더링
  const renderSegments = () => {
    const elements: React.ReactElement[] = [];
    let currentX = 0;
    let currentY = 0;
    let currentLineWidth = 0;
    const lineHeightPx = fontSize * LINE_HEIGHT;
    const spaceWidth = fontSize * 0.3; // 공백 문자 너비 근사치
    
    segments.forEach((segment, index) => {
      const isUrl = segment.type === 'url';
      const words = segment.content.split(' ');
      
      words.forEach((word, wordIndex) => {
        if (wordIndex > 0) {
          // 단어 사이 공백 추가
          currentLineWidth += spaceWidth;
          if (currentLineWidth > width) {
            currentX = 0;
            currentY += lineHeightPx;
            currentLineWidth = 0;
          } else {
            currentX += spaceWidth;
          }
        }
        
        // URL인 경우 특별 처리
        if (isUrl && word.length * fontSize * 0.6 > width) {
          // 긴 URL을 문자 단위로 분할
          let urlChars = word;
          let charIndex = 0;
          
          while (charIndex < urlChars.length) {
            let lineChars = '';
            let lineWidth = currentLineWidth;
            
            // 현재 줄에 들어갈 수 있는 만큼의 문자 추가
            while (charIndex < urlChars.length && lineWidth + fontSize * 0.6 <= width) {
              lineChars += urlChars[charIndex];
              lineWidth += fontSize * 0.6;
              charIndex++;
            }
            
            if (lineChars.length > 0) {
              const isHovered = hoveredSegmentIndex === index && isUrl;
              
              elements.push(
                <Text
                  key={`${index}-${wordIndex}-${elements.length}`}
                  x={x + currentX}
                  y={y + currentY}
                  text={lineChars}
                  fontSize={fontSize}
                  fontFamily={fontFamily}
                  fill={isUrl ? (isHovered ? linkHoverColor : linkColor) : textColor}
                  textDecoration={isUrl ? 'underline' : undefined}
                  listening={isUrl}
                  onClick={isUrl && segment.url ? (e) => {
                    e.cancelBubble = true;
                    handleLinkClick(segment.url!, e);
                  } : undefined}
                  onTap={isUrl && segment.url ? (e) => {
                    e.cancelBubble = true;
                    handleLinkClick(segment.url!, e);
                  } : undefined}
                  onMouseEnter={isUrl ? (e) => {
                    setHoveredSegmentIndex(index);
                    const stage = e.target.getStage();
                    if (stage) {
                      stage.container().style.cursor = 'pointer';
                    }
                  } : undefined}
                  onMouseLeave={isUrl ? (e) => {
                    setHoveredSegmentIndex(null);
                    const stage = e.target.getStage();
                    if (stage) {
                      stage.container().style.cursor = 'default';
                    }
                  } : undefined}
                />
              );
              
              currentX += lineChars.length * fontSize * 0.6;
              currentLineWidth = currentX;
            }
            
            // 더 많은 문자가 있으면 줄바꿈
            if (charIndex < urlChars.length) {
              currentX = 0;
              currentY += lineHeightPx;
              currentLineWidth = 0;
            }
          }
          
          return; // 긴 URL 처리 완료
        }
        
        // 일반 단어 처리
        const wordWidth = word.length * fontSize * 0.6;
        
        // 줄바꿈 필요 여부 확인
        if (currentLineWidth + wordWidth > width && currentLineWidth > 0) {
          currentX = 0;
          currentY += lineHeightPx;
          currentLineWidth = wordWidth;
        } else {
          currentLineWidth += wordWidth;
        }
        
        const isHovered = hoveredSegmentIndex === index && isUrl;
        
        elements.push(
          <Text
            key={`${index}-${wordIndex}`}
            x={x + currentX}
            y={y + currentY}
            text={word}
            fontSize={fontSize}
            fontFamily={fontFamily}
            fill={isUrl ? (isHovered ? linkHoverColor : linkColor) : textColor}
            textDecoration={isUrl ? 'underline' : undefined}
            listening={isUrl}
            onClick={isUrl && segment.url ? (e) => {
              e.cancelBubble = true;
              handleLinkClick(segment.url!, e);
            } : undefined}
            onTap={isUrl && segment.url ? (e) => {
              e.cancelBubble = true;
              handleLinkClick(segment.url!, e);
            } : undefined}
            onMouseEnter={isUrl ? (e) => {
              setHoveredSegmentIndex(index);
              const stage = e.target.getStage();
              if (stage) {
                stage.container().style.cursor = 'pointer';
              }
            } : undefined}
            onMouseLeave={isUrl ? (e) => {
              setHoveredSegmentIndex(null);
              const stage = e.target.getStage();
              if (stage) {
                stage.container().style.cursor = 'default';
              }
            } : undefined}
          />
        );
        
        currentX += wordWidth;
      });
      
      // 세그먼트 사이에 공백 추가 (URL 뒤에 공백이 있는 경우)
      if (index < segments.length - 1) {
        currentLineWidth += spaceWidth;
        if (currentLineWidth > width) {
          currentX = 0;
          currentY += lineHeightPx;
          currentLineWidth = 0;
        } else {
          currentX += spaceWidth;
        }
      }
    });
    
    return elements;
  };
  
  return (
    <Group 
      ref={groupRef}
      clip={{
        x: x,
        y: y,
        width: width,
        height: height
      }}
    >
      {debugMode && (
        <>
          <Rect
            x={x}
            y={y}
            width={width}
            height={height}
            stroke="red"
            strokeWidth={2}
            fill="transparent"
            listening={false}
          />
          <Text
            x={x + 2}
            y={y + 2}
            text={`${width}x${height}`}
            fontSize={10}
            fill="red"
            listening={false}
          />
        </>
      )}
      {renderSegments()}
    </Group>
  );
};
