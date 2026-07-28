import { useState, useEffect, useCallback } from 'react';

export type DeviceType = 'pc' | 'tablet' | 'mobile';

export interface DeviceLayoutConfig {
  deviceType: DeviceType;
  sidebarCollapsed: boolean;
  zoomLevel: number; // percentage (80 - 120)
  panelDensity: 'comfortable' | 'compact' | 'touch';
  gridColumns: number; // 1, 2, 3, or 4
  showQuickStats: boolean;
  showQuickBar: boolean;
  activeViewMode: 'grid' | 'list' | 'cards';
  fontSize: 'sm' | 'md' | 'lg';
}

export const DEFAULT_LAYOUT_CONFIGS: Record<DeviceType, DeviceLayoutConfig> = {
  pc: {
    deviceType: 'pc',
    sidebarCollapsed: false,
    zoomLevel: 100,
    panelDensity: 'comfortable',
    gridColumns: 3,
    showQuickStats: true,
    showQuickBar: true,
    activeViewMode: 'grid',
    fontSize: 'md',
  },
  tablet: {
    deviceType: 'tablet',
    sidebarCollapsed: true,
    zoomLevel: 100,
    panelDensity: 'touch',
    gridColumns: 2,
    showQuickStats: true,
    showQuickBar: true,
    activeViewMode: 'cards',
    fontSize: 'md',
  },
  mobile: {
    deviceType: 'mobile',
    sidebarCollapsed: true,
    zoomLevel: 100,
    panelDensity: 'touch',
    gridColumns: 1,
    showQuickStats: false,
    showQuickBar: true,
    activeViewMode: 'list',
    fontSize: 'sm',
  },
};

/**
 * Detects device category based on viewport width
 */
export function detectDeviceType(width: number = typeof window !== 'undefined' ? window.innerWidth : 1200): DeviceType {
  if (width < 768) {
    return 'mobile';
  } else if (width < 1024) {
    return 'tablet';
  } else {
    return 'pc';
  }
}

/**
 * Retrieves independent saved layout settings for a specific device type
 */
export function getDeviceLayoutConfig(deviceType: DeviceType): DeviceLayoutConfig {
  if (typeof window === 'undefined') {
    return DEFAULT_LAYOUT_CONFIGS[deviceType];
  }
  try {
    const raw = localStorage.getItem(`app_layout_settings_${deviceType}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_LAYOUT_CONFIGS[deviceType],
        ...parsed,
        deviceType, // Ensure strict mapping
      };
    }
  } catch (err) {
    console.warn(`[DeviceLayout] Error loading layout for ${deviceType}:`, err);
  }
  return DEFAULT_LAYOUT_CONFIGS[deviceType];
}

/**
 * Saves independent layout settings for a specific device type without leaking to other devices
 */
export function saveDeviceLayoutConfig(
  deviceType: DeviceType,
  partialConfig: Partial<DeviceLayoutConfig>
): DeviceLayoutConfig {
  const current = getDeviceLayoutConfig(deviceType);
  const updated: DeviceLayoutConfig = {
    ...current,
    ...partialConfig,
    deviceType,
  };

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(`app_layout_settings_${deviceType}`, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('app-device-layout-changed', {
        detail: { deviceType, config: updated }
      }));
    } catch (err) {
      console.warn(`[DeviceLayout] Error saving layout for ${deviceType}:`, err);
    }
  }

  return updated;
}

/**
 * React hook for responsive, independent device layouts
 */
export function useDeviceLayout() {
  const [deviceType, setDeviceType] = useState<DeviceType>(() => detectDeviceType());
  const [layoutConfig, setLayoutConfig] = useState<DeviceLayoutConfig>(() => getDeviceLayoutConfig(detectDeviceType()));

  // Auto-detect screen resize and load the corresponding device's independent config
  useEffect(() => {
    const handleResize = () => {
      const newDevType = detectDeviceType(window.innerWidth);
      setDeviceType(newDevType);
      setLayoutConfig(getDeviceLayoutConfig(newDevType));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Listen for manual configuration updates for the active device
  useEffect(() => {
    const handleLayoutChange = (e: Event) => {
      const customEv = e as CustomEvent;
      if (customEv.detail && customEv.detail.deviceType === deviceType) {
        setLayoutConfig(customEv.detail.config);
      }
    };

    window.addEventListener('app-device-layout-changed', handleLayoutChange);
    return () => window.removeEventListener('app-device-layout-changed', handleLayoutChange);
  }, [deviceType]);

  const updateConfig = useCallback((partial: Partial<DeviceLayoutConfig>) => {
    const updated = saveDeviceLayoutConfig(deviceType, partial);
    setLayoutConfig(updated);
  }, [deviceType]);

  return {
    deviceType,
    layoutConfig,
    updateConfig,
    isMobile: deviceType === 'mobile',
    isTablet: deviceType === 'tablet',
    isPC: deviceType === 'pc',
  };
}
