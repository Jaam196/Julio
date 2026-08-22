/**
 * HIOPOS Background Screen Reader & Auto-Ticket Detector Engine
 * 
 * Features:
 * - Continuous background screen capture (Web getDisplayMedia + Android MediaProjection)
 * - Interactive ROI (Region of Interest) cropping for focused OCR
 * - Gemini Flash 2.5 OCR with seamless local fallback
 * - Smart deduplication (prevents spamming the same ticket number across frames)
 * - Automatic POST to /api/hiopos/ticket on new ticket detection
 * - Robust error handling (offline, rate-limits, permission revocation)
 */

import { recognizeTicketWithGemini } from './geminiOCR';
import { isAndroidNativeApp, requestScreenCaptureStream } from './androidBridge';

export interface HioposRoiConfig {
  x: number; // 0 to 100 (%)
  y: number; // 0 to 100 (%)
  width: number; // 0 to 100 (%)
  height: number; // 0 to 100 (%)
  enabled: boolean;
}

export interface HioposScanLogEntry {
  id: string;
  timestamp: number;
  timeStr: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'duplicate';
  message: string;
  ticketNumber?: string | null;
  confidence?: number;
  latencyMs?: number;
  croppedThumbnail?: string;
}

export interface HioposScreenReaderStats {
  isCapturing: boolean;
  status: 'idle' | 'requesting' | 'active' | 'paused' | 'error' | 'permission_denied';
  statusMessage: string;
  lastDetectedTicket: string | null;
  lastSentTicket: string | null;
  lastConfidence: number;
  lastScanTimestamp: number | null;
  lastLatencyMs: number;
  totalScans: number;
  totalTicketsSent: number;
  duplicatesIgnored: number;
  lastCroppedImage: string | null;
  lastFullFrameImage: string | null;
}

export const DEFAULT_HIOPOS_ROI: HioposRoiConfig = {
  x: 55,
  y: 2,
  width: 42,
  height: 22,
  enabled: true,
};

export const HIOPOS_ROI_PRESETS: { id: string; name: string; description: string; roi: HioposRoiConfig }[] = [
  {
    id: 'top_right',
    name: 'Esquina Superior Derecha (HIOPOS Estándar)',
    description: 'Cabecera derecha del TPV donde HIOPOS muestra el número de pedido',
    roi: { x: 55, y: 2, width: 42, height: 22, enabled: true },
  },
  {
    id: 'top_center',
    name: 'Cabecera Central',
    description: 'Zona superior central de la pantalla',
    roi: { x: 25, y: 2, width: 50, height: 20, enabled: true },
  },
  {
    id: 'center',
    name: 'Centro de Pantalla',
    description: 'Ventana modal o cuadro central de pedido',
    roi: { x: 20, y: 20, width: 60, height: 40, enabled: true },
  },
  {
    id: 'full_screen',
    name: 'Pantalla Completa',
    description: 'Analiza toda la pantalla sin recortar (mayor coste de tokens)',
    roi: { x: 0, y: 0, width: 100, height: 100, enabled: false },
  },
];

const LOCAL_STORAGE_ROI_KEY = 'hiopos_screen_reader_roi_v2';
const LOCAL_STORAGE_INTERVAL_KEY = 'hiopos_screen_reader_interval_v2';

export class HioposScreenReaderEngine {
  private static instance: HioposScreenReaderEngine | null = null;

  private stream: MediaStream | null = null;
  private hiddenVideo: HTMLVideoElement | null = null;
  private cropCanvas: HTMLCanvasElement | null = null;
  private fullCanvas: HTMLCanvasElement | null = null;

  private intervalMs: number = 2000;
  private scanTimer: any = null;
  private isProcessing: boolean = false;

  private roiConfig: HioposRoiConfig = DEFAULT_HIOPOS_ROI;
  private stats: HioposScreenReaderStats = {
    isCapturing: false,
    status: 'idle',
    statusMessage: 'Lector HIOPOS en reposo.',
    lastDetectedTicket: null,
    lastSentTicket: null,
    lastConfidence: 0,
    lastScanTimestamp: null,
    lastLatencyMs: 0,
    totalScans: 0,
    totalTicketsSent: 0,
    duplicatesIgnored: 0,
    lastCroppedImage: null,
    lastFullFrameImage: null,
  };

  private logs: HioposScanLogEntry[] = [];
  private listeners: Set<(stats: HioposScreenReaderStats, logs: HioposScanLogEntry[]) => void> = new Set();

  private cooldownTicket: string | null = null;
  private cooldownExpiry: number = 0;

  private constructor() {
    this.loadSavedConfig();
  }

  public static getInstance(): HioposScreenReaderEngine {
    if (!HioposScreenReaderEngine.instance) {
      HioposScreenReaderEngine.instance = new HioposScreenReaderEngine();
    }
    return HioposScreenReaderEngine.instance;
  }

  private loadSavedConfig() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const savedRoi = localStorage.getItem(LOCAL_STORAGE_ROI_KEY);
        if (savedRoi) {
          this.roiConfig = { ...DEFAULT_HIOPOS_ROI, ...JSON.parse(savedRoi) };
        }
        const savedInterval = localStorage.getItem(LOCAL_STORAGE_INTERVAL_KEY);
        if (savedInterval) {
          const parsedInt = parseInt(savedInterval, 10);
          if (parsedInt >= 1000 && parsedInt <= 10000) {
            this.intervalMs = parsedInt;
          }
        }
      }
    } catch (e) {
      console.warn('[HIOPOS Engine] Could not load saved configuration from localStorage:', e);
    }
  }

  public saveRoiConfig(roi: HioposRoiConfig) {
    this.roiConfig = { ...roi };
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(LOCAL_STORAGE_ROI_KEY, JSON.stringify(this.roiConfig));
      }
    } catch (e) {
      console.warn('[HIOPOS Engine] Could not save ROI config:', e);
    }
    this.notifySubscribers();
  }

  public setIntervalMs(interval: number) {
    this.intervalMs = Math.max(1000, Math.min(10000, interval));
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(LOCAL_STORAGE_INTERVAL_KEY, String(this.intervalMs));
      }
    } catch (e) {}

    // If currently running, restart the timer with the new interval
    if (this.stats.isCapturing) {
      this.stopTimer();
      this.startTimer();
    }
    this.notifySubscribers();
  }

  public getRoiConfig(): HioposRoiConfig {
    return { ...this.roiConfig };
  }

  public getIntervalMs(): number {
    return this.intervalMs;
  }

  public getStats(): HioposScreenReaderStats {
    return { ...this.stats };
  }

  public getLogs(): HioposScanLogEntry[] {
    return [...this.logs];
  }

  public subscribe(callback: (stats: HioposScreenReaderStats, logs: HioposScanLogEntry[]) => void): () => void {
    this.listeners.add(callback);
    callback(this.getStats(), this.getLogs());
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifySubscribers() {
    const currentStats = this.getStats();
    const currentLogs = this.getLogs();
    this.listeners.forEach((cb) => {
      try {
        cb(currentStats, currentLogs);
      } catch (err) {
        console.error('[HIOPOS Engine] Subscriber error:', err);
      }
    });
  }

  private addLog(
    type: 'info' | 'success' | 'warning' | 'error' | 'duplicate',
    message: string,
    ticketNumber?: string | null,
    confidence?: number,
    latencyMs?: number,
    croppedThumbnail?: string
  ) {
    const now = Date.now();
    const timeStr = new Date(now).toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const entry: HioposScanLogEntry = {
      id: `${now}-${Math.random().toString(36).substr(2, 5)}`,
      timestamp: now,
      timeStr,
      type,
      message,
      ticketNumber,
      confidence,
      latencyMs,
      croppedThumbnail,
    };

    this.logs.unshift(entry);
    if (this.logs.length > 50) {
      this.logs.pop();
    }
    this.notifySubscribers();
  }

  /**
   * Starts continuous background screen capture
   */
  public async startCapture(): Promise<boolean> {
    if (this.stats.isCapturing) {
      return true;
    }

    this.stats.status = 'requesting';
    this.stats.statusMessage = 'Solicitando permiso de captura de pantalla...';
    this.notifySubscribers();
    this.addLog('info', 'Solicitando permiso de captura de pantalla (HIOPOS / Otra Aplicación)...');

    try {
      // 1. Android Native MediaProjection Bridge
      if (isAndroidNativeApp()) {
        if (typeof window !== 'undefined' && window.AndroidBridge) {
          window.onAndroidScreenCapturePermissionGranted = () => {
            this.stats.isCapturing = true;
            this.stats.status = 'active';
            this.stats.statusMessage = '🟢 Captura Android activa en segundo plano.';
            this.addLog('success', 'Permiso concedido en Android. Escaneando pantalla en segundo plano.');
            this.startTimer();
          };

          window.onAndroidScreenCapturePermissionDenied = (reason) => {
            this.stats.isCapturing = false;
            this.stats.status = 'permission_denied';
            this.stats.statusMessage = reason || 'Permiso denegado por el usuario en Android.';
            this.addLog('error', `Permiso de captura denegado: ${reason || 'Cancelado por el usuario'}`);
            this.notifySubscribers();
          };

          window.onAndroidFrameReceived = (base64ImageData: string) => {
            this.handleIncomingBase64Frame(base64ImageData);
          };

          window.AndroidBridge.requestScreenCapturePermission();
          return true;
        }
      }

      // 2. Standard Web Screen Capture (getDisplayMedia)
      const mediaStream = await requestScreenCaptureStream();
      this.stream = mediaStream;

      if (!this.hiddenVideo) {
        this.hiddenVideo = document.createElement('video');
        this.hiddenVideo.muted = true;
        this.hiddenVideo.playsInline = true;
        this.hiddenVideo.autoplay = true;
      }
      this.hiddenVideo.srcObject = mediaStream;
      await this.hiddenVideo.play();

      // Listen for user closing screen sharing from browser bar
      const videoTrack = mediaStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          this.handleStreamEnded('Captura detenida por el usuario desde la barra del navegador.');
        };
      }

      this.stats.isCapturing = true;
      this.stats.status = 'active';
      this.stats.statusMessage = `🟢 Captura activa. Escaneando cada ${(this.intervalMs / 1000).toFixed(1)}s.`;
      this.addLog('success', 'Captura de pantalla iniciada correctamente.');
      this.notifySubscribers();

      this.startTimer();
      // Run first scan immediately
      setTimeout(() => this.performScan(), 500);

      return true;
    } catch (err: any) {
      console.warn('[HIOPOS Engine] Screen capture start failed:', err);
      this.stats.isCapturing = false;
      this.stats.status = 'permission_denied';
      this.stats.statusMessage = err.message || 'Permiso de captura denegado o no disponible.';
      this.addLog('error', `Error al iniciar captura: ${err.message || 'Permiso denegado'}`);
      this.notifySubscribers();
      return false;
    }
  }

  /**
   * Stops continuous screen capture and cleans up streams
   */
  public stopCapture() {
    this.stopTimer();

    if (this.stream) {
      try {
        this.stream.getTracks().forEach((track) => track.stop());
      } catch (e) {}
      this.stream = null;
    }

    if (this.hiddenVideo) {
      this.hiddenVideo.srcObject = null;
    }

    if (isAndroidNativeApp() && typeof window !== 'undefined' && window.AndroidBridge) {
      try {
        window.AndroidBridge.stopScreenCaptureService();
      } catch (e) {}
    }

    this.stats.isCapturing = false;
    this.stats.status = 'idle';
    this.stats.statusMessage = 'Lector HIOPOS detenido.';
    this.addLog('info', 'Captura de pantalla detenida.');
    this.notifySubscribers();
  }

  private handleStreamEnded(reason: string) {
    this.stopTimer();
    this.stream = null;
    this.stats.isCapturing = false;
    this.stats.status = 'idle';
    this.stats.statusMessage = reason;
    this.addLog('warning', reason);
    this.notifySubscribers();
  }

  private startTimer() {
    this.stopTimer();
    this.scanTimer = setInterval(() => {
      this.performScan();
    }, this.intervalMs);
  }

  private stopTimer() {
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = null;
    }
  }

  /**
   * Performs a single crop & OCR scan cycle
   */
  public async performScan(): Promise<void> {
    if (!this.stats.isCapturing || this.isProcessing) {
      return;
    }

    // If using video stream
    if (this.hiddenVideo && this.hiddenVideo.readyState >= 2) {
      const vWidth = this.hiddenVideo.videoWidth;
      const vHeight = this.hiddenVideo.videoHeight;

      if (vWidth === 0 || vHeight === 0) return;

      this.isProcessing = true;
      const startTime = Date.now();

      try {
        // 1. Crop Region of Interest (ROI)
        const croppedData = this.cropVideoFrame(this.hiddenVideo, vWidth, vHeight, this.roiConfig);

        this.stats.lastCroppedImage = croppedData.base64;
        this.stats.lastFullFrameImage = croppedData.fullFrameBase64;
        this.stats.totalScans += 1;
        this.stats.lastScanTimestamp = startTime;

        // 2. Process with Gemini Flash 2.5 OCR
        await this.processCroppedImage(croppedData.base64, startTime);
      } catch (err: any) {
        console.warn('[HIOPOS Engine] Scan cycle error:', err);
        this.addLog('warning', `Error en ciclo de escaneo: ${err?.message || 'Fallo desconocido'}`);
      } finally {
        this.isProcessing = false;
        this.notifySubscribers();
      }
    }
  }

  /**
   * Handles incoming frame from Android Native Bridge
   */
  private async handleIncomingBase64Frame(base64ImageData: string) {
    if (!this.stats.isCapturing || this.isProcessing) return;

    this.isProcessing = true;
    const startTime = Date.now();

    try {
      const croppedData = await this.cropBase64Image(base64ImageData, this.roiConfig);
      this.stats.lastCroppedImage = croppedData.base64;
      this.stats.lastFullFrameImage = base64ImageData;
      this.stats.totalScans += 1;
      this.stats.lastScanTimestamp = startTime;

      await this.processCroppedImage(croppedData.base64, startTime);
    } catch (err: any) {
      console.warn('[HIOPOS Engine] Android frame processing error:', err);
    } finally {
      this.isProcessing = false;
      this.notifySubscribers();
    }
  }

  /**
   * Crops video frame to the configured ROI coordinates
   */
  private cropVideoFrame(
    video: HTMLVideoElement,
    vWidth: number,
    vHeight: number,
    roi: HioposRoiConfig
  ): { base64: string; fullFrameBase64: string } {
    if (!this.cropCanvas) {
      this.cropCanvas = document.createElement('canvas');
    }
    if (!this.fullCanvas) {
      this.fullCanvas = document.createElement('canvas');
    }

    // Save full frame thumbnail (scaled down to 320px for preview performance)
    const fullScale = Math.min(1, 480 / vWidth);
    this.fullCanvas.width = Math.round(vWidth * fullScale);
    this.fullCanvas.height = Math.round(vHeight * fullScale);
    const fullCtx = this.fullCanvas.getContext('2d');
    if (fullCtx) {
      fullCtx.drawImage(video, 0, 0, this.fullCanvas.width, this.fullCanvas.height);
    }
    const fullFrameBase64 = this.fullCanvas.toDataURL('image/jpeg', 0.6);

    // Calculate crop rectangle
    let sx = 0;
    let sy = 0;
    let sw = vWidth;
    let sh = vHeight;

    if (roi.enabled) {
      sx = Math.max(0, Math.min(vWidth, (roi.x / 100) * vWidth));
      sy = Math.max(0, Math.min(vHeight, (roi.y / 100) * vHeight));
      sw = Math.max(20, Math.min(vWidth - sx, (roi.width / 100) * vWidth));
      sh = Math.max(20, Math.min(vHeight - sy, (roi.height / 100) * vHeight));
    }

    // Target crisp resolution for OCR (between 300px and 600px width)
    const targetWidth = Math.max(300, Math.min(600, Math.round(sw)));
    const targetHeight = Math.round((targetWidth / sw) * sh);

    this.cropCanvas.width = targetWidth;
    this.cropCanvas.height = targetHeight;
    const ctx = this.cropCanvas.getContext('2d');

    if (ctx) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);
    }

    const base64 = this.cropCanvas.toDataURL('image/jpeg', 0.88);
    return { base64, fullFrameBase64 };
  }

  /**
   * Crops a base64 image (used for Android frames)
   */
  private cropBase64Image(
    base64Data: string,
    roi: HioposRoiConfig
  ): Promise<{ base64: string; fullFrameBase64: string }> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const vWidth = img.naturalWidth || img.width;
        const vHeight = img.naturalHeight || img.height;

        if (!this.cropCanvas) this.cropCanvas = document.createElement('canvas');

        let sx = 0;
        let sy = 0;
        let sw = vWidth;
        let sh = vHeight;

        if (roi.enabled) {
          sx = Math.max(0, Math.min(vWidth, (roi.x / 100) * vWidth));
          sy = Math.max(0, Math.min(vHeight, (roi.y / 100) * vHeight));
          sw = Math.max(20, Math.min(vWidth - sx, (roi.width / 100) * vWidth));
          sh = Math.max(20, Math.min(vHeight - sy, (roi.height / 100) * vHeight));
        }

        const targetWidth = Math.max(300, Math.min(600, Math.round(sw)));
        const targetHeight = Math.round((targetWidth / sw) * sh);

        this.cropCanvas.width = targetWidth;
        this.cropCanvas.height = targetHeight;
        const ctx = this.cropCanvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);
        }

        const croppedBase64 = this.cropCanvas.toDataURL('image/jpeg', 0.88);
        resolve({ base64: croppedBase64, fullFrameBase64: base64Data });
      };
      img.onerror = () => {
        resolve({ base64: base64Data, fullFrameBase64: base64Data });
      };
      img.src = base64Data;
    });
  }

  /**
   * Passes the cropped image to Gemini OCR and handles smart ticket deduplication
   */
  private async processCroppedImage(imageBase64: string, startTime: number) {
    const ocrResult = await recognizeTicketWithGemini(imageBase64);
    const latency = Date.now() - startTime;
    this.stats.lastLatencyMs = latency;

    const detectedTicket = ocrResult.ticketNumber;
    const confidence = ocrResult.confidence;

    this.stats.lastDetectedTicket = detectedTicket;
    this.stats.lastConfidence = confidence;

    // Case 1: No ticket detected in current crop
    if (!detectedTicket) {
      // If screen was cleared (no ticket visible), clear cooldown after 1.5s so next ticket can be accepted
      if (this.cooldownTicket && Date.now() > this.cooldownExpiry) {
        this.cooldownTicket = null;
      }
      return;
    }

    // Case 2: Ticket detected is identical to the last sent ticket (Deduplication)
    if (detectedTicket === this.stats.lastSentTicket || detectedTicket === this.cooldownTicket) {
      this.stats.duplicatesIgnored += 1;
      // Refresh cooldown expiry to 5 seconds while still visible
      this.cooldownExpiry = Date.now() + 5000;
      return;
    }

    // Case 3: Genuine NEW ticket detected!
    this.stats.lastSentTicket = detectedTicket;
    this.cooldownTicket = detectedTicket;
    this.cooldownExpiry = Date.now() + 6000;

    this.addLog(
      'info',
      `🎯 Ticket detectado en pantalla: #${detectedTicket} (${confidence}% confianza, ${latency}ms). Enviando a cola...`,
      detectedTicket,
      confidence,
      latency,
      imageBase64
    );

    // Call /api/hiopos/ticket
    await this.dispatchTicketToApi(detectedTicket, confidence, imageBase64);
  }

  /**
   * Posts detected ticket to the backend endpoint /api/hiopos/ticket
   */
  private async dispatchTicketToApi(ticketNumber: string, confidence: number, thumbnailBase64: string) {
    try {
      const res = await fetch('/api/hiopos/ticket', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ticket: ticketNumber,
          deviceId: 'HIOPOS-SCREEN-READER',
          source: 'HIOPOS',
          method: 'screen_ocr',
          confidence: confidence,
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      this.stats.totalTicketsSent += 1;

      if (data.duplicate) {
        this.addLog(
          'duplicate',
          `⚠️ Servidor: Ticket #${ticketNumber} ya estaba en la cola activa (Duplicado omitido)`,
          ticketNumber,
          confidence,
          undefined,
          thumbnailBase64
        );
      } else {
        this.addLog(
          'success',
          `✅ Ticket #${ticketNumber} añadido a la Lista de Espera con éxito`,
          ticketNumber,
          confidence,
          undefined,
          thumbnailBase64
        );
      }

      this.notifySubscribers();
    } catch (err: any) {
      console.warn('[HIOPOS Engine] Failed to dispatch ticket to /api/hiopos/ticket:', err);
      this.addLog(
        'error',
        `❌ Error de red al enviar ticket #${ticketNumber}: ${err?.message || 'Servidor inaccesible'}`,
        ticketNumber,
        confidence,
        undefined,
        thumbnailBase64
      );
      this.notifySubscribers();
    }
  }
}

export const hioposReader = HioposScreenReaderEngine.getInstance();
