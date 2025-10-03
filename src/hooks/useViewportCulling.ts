import { useMemo } from 'react';
import { Viewport } from '../types';

interface Item {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ViewportBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * 뷰포트 기반 가상화 훅
 * 화면에 보이는 아이템만 필터링하여 렌더링 성능 최적화
 */
export const useViewportCulling = <T extends Item>(
  items: T[],
  viewport: Viewport,
  windowWidth: number,
  windowHeight: number,
  padding: number = 500 // 여유 공간 (픽셀)
): T[] => {
  return useMemo(() => {
    // 뷰포트의 실제 bounds 계산
    const viewBounds: ViewportBounds = {
      left: -viewport.x / viewport.scale - padding,
      top: -viewport.y / viewport.scale - padding,
      right: (-viewport.x + windowWidth) / viewport.scale + padding,
      bottom: (-viewport.y + windowHeight) / viewport.scale + padding,
    };

    // 뷰포트 내에 있는 아이템만 필터링
    return items.filter(item => {
      const itemRight = item.x + item.width;
      const itemBottom = item.y + item.height;

      // AABB (Axis-Aligned Bounding Box) 충돌 검사
      return (
        itemRight > viewBounds.left &&
        item.x < viewBounds.right &&
        itemBottom > viewBounds.top &&
        item.y < viewBounds.bottom
      );
    });
  }, [items, viewport.x, viewport.y, viewport.scale, windowWidth, windowHeight, padding]);
};
