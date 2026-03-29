// Device detection utilities
export const isMobile = (): boolean => {
  // Check for touch capability
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  // Check screen size
  const isSmallScreen = window.innerWidth <= 768;
  
  // Check user agent (fallback)
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
  const isMobileUserAgent = mobileRegex.test(navigator.userAgent);
  
  return hasTouch && (isSmallScreen || isMobileUserAgent);
};

export const isTouch = (): boolean => {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
};

export const isStandalonePwa = (): boolean => {
  if (typeof window === 'undefined') return false;

  const displayModeStandalone =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches;
  const iosStandalone = 'standalone' in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true;

  return displayModeStandalone || iosStandalone;
};

// Detect if the user is on macOS
export const isMacOS = (): boolean => {
  return navigator.platform.toUpperCase().indexOf('MAC') >= 0 || 
         navigator.userAgent.toUpperCase().indexOf('MAC') >= 0;
};

// Detect if wheel event is from a trackpad
export const isTrackpadEvent = (event: WheelEvent): boolean => {
  // Check for precise scrolling (common on trackpads)
  if (event.deltaMode === 0) {
    // Pixel scrolling mode (trackpads use this)
    const isPrecise = Math.abs(event.deltaY) < 50 && event.deltaY !== 0;
    
    // Check for fractional delta values (trackpads often have these)
    const hasFractionalDelta = event.deltaY % 1 !== 0 || event.deltaX % 1 !== 0;
    
    // Trackpads often have both X and Y deltas
    const hasBothDeltas = event.deltaX !== 0 && event.deltaY !== 0;
    
    return isPrecise || hasFractionalDelta || hasBothDeltas;
  }
  
  return false;
};

// Detect gesture type from wheel event
export const getWheelGestureType = (event: WheelEvent): 'zoom' | 'pan' => {
  // Pinch-to-zoom on trackpad (ctrl key on Windows/Linux, metaKey on macOS)
  if (event.ctrlKey || event.metaKey) {
    return 'zoom';
  }
  
  // Regular scroll is pan
  return 'pan';
};

// Performance mode based on device
export const getPerformanceMode = (): 'high' | 'medium' | 'low' => {
  if (!isMobile()) return 'high';
  
  // Check device pixel ratio for high-res screens
  const pixelRatio = window.devicePixelRatio || 1;
  
  // Check screen size
  const screenSize = window.innerWidth * window.innerHeight;
  
  if (pixelRatio > 2 || screenSize < 500000) {
    return 'low'; // High DPI or small screens need more optimization
  }
  
  return 'medium';
};
