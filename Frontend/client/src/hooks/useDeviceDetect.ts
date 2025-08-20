import { useState, useEffect } from 'react';

export function useDeviceDetect() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkDevice = () => {
      const mobile = window.matchMedia('(max-width: 768px)').matches;
      setIsMobile(mobile);
    };

    // Check on mount
    checkDevice();

    // Add resize listener
    const mediaQuery = window.matchMedia('(max-width: 768px)');
    mediaQuery.addEventListener('change', checkDevice);

    // Cleanup
    return () => mediaQuery.removeEventListener('change', checkDevice);
  }, []);

  return isMobile;
}
