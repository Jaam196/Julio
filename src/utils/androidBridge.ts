// Utility to interface between JS/React application and Native Android MediaProjection Bridge / Web Screen Capture API

export interface ScreenCaptureStatus {
  isCapturing: boolean;
  isPaused: boolean;
  hasPermission: boolean;
  lastDetectedNumber: string | null;
  statusText: string;
}

declare global {
  interface Window {
    AndroidBridge?: {
      requestScreenCapturePermission: () => void;
      startScreenCaptureService: () => void;
      stopScreenCaptureService: () => void;
      isNativeAndroidAvailable: () => boolean;
      postTicketToNative: (ticketNumber: string) => void;
    };
    onAndroidScreenCapturePermissionGranted?: () => void;
    onAndroidScreenCapturePermissionDenied?: (reason: string) => void;
    onAndroidFrameReceived?: (base64ImageData: string) => void;
  }
}

// Check if running inside Android Native app with WebView bridge
export const isAndroidNativeApp = (): boolean => {
  return typeof window !== 'undefined' && !!window.AndroidBridge && typeof window.AndroidBridge.isNativeAndroidAvailable === 'function' && window.AndroidBridge.isNativeAndroidAvailable();
};

// Check if web browser supports getDisplayMedia (Screen Capture API)
export const isWebScreenCaptureSupported = (): boolean => {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === 'function';
};

// Request Screen Capture stream (either through Android MediaProjection bridge or Web getDisplayMedia API)
export const requestScreenCaptureStream = async (): Promise<MediaStream> => {
  if (isWebScreenCaptureSupported()) {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor',
          frameRate: { max: 10 }, // Optimize to 10 FPS to save CPU and battery
        },
        audio: false,
      });
      return stream;
    } catch (err: any) {
      console.warn('Screen capture permission request rejected or unsupported:', err);
      throw new Error(err.message || 'Permiso de captura de pantalla denegado por el usuario.');
    }
  } else {
    throw new Error('La captura de pantalla no está soportada en este navegador/dispositivo.');
  }
};

// Image frame pixel difference calculation for smart change detection
export const computeFrameDifference = (
  ctxCurrent: CanvasRenderingContext2D,
  ctxPrev: CanvasRenderingContext2D,
  width: number,
  height: number,
  sampleStep = 8 // Sample every 8th pixel to be extremely fast and low-CPU
): number => {
  try {
    const currentData = ctxCurrent.getImageData(0, 0, width, height).data;
    const prevData = ctxPrev.getImageData(0, 0, width, height).data;

    let diffPixels = 0;
    let totalSampled = 0;

    const len = currentData.length;
    for (let i = 0; i < len; i += 4 * sampleStep) {
      const rDiff = Math.abs(currentData[i] - prevData[i]);
      const gDiff = Math.abs(currentData[i + 1] - prevData[i + 1]);
      const bDiff = Math.abs(currentData[i + 2] - prevData[i + 2]);

      // If RGB value changed significantly
      if (rDiff > 25 || gDiff > 25 || bDiff > 25) {
        diffPixels++;
      }
      totalSampled++;
    }

    if (totalSampled === 0) return 0;
    return (diffPixels / totalSampled) * 100; // Return percentage of changed pixels
  } catch (err) {
    return 100; // If error, assume changed to force scan
  }
};
