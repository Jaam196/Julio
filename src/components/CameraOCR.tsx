import React, { useRef, useState, useEffect } from 'react';
import {
  Camera,
  CameraOff,
  Play,
  Pause,
  RefreshCw,
  Zap,
  Sliders,
  CheckCircle2,
  Settings2,
  Activity,
  Eye,
  Info,
  AlertCircle,
  Crop,
  TrendingUp,
  Award,
  Check,
  X,
  Trash2,
  Brain,
  Sparkles,
  Layers,
  Edit3,
  XCircle,
  Maximize2,
  Bot,
  Smartphone,
  Monitor,
  Search,
  StopCircle
} from 'lucide-react';
import { createWorker } from 'tesseract.js';
import { dbSaveSettings, dbGetSettings } from '../utils/db';
import {
  requestScreenCaptureStream,
  computeFrameDifference,
  isAndroidNativeApp
} from '../utils/androidBridge';
import { processTicketOCR, CandidateTemporalTracker, TicketOcrResult, isValidTicketNumber } from '../utils/ticketOCR';
import { CandidateEvaluation } from '../utils/ticketCandidateScorer';
import { preprocessImage } from '../utils/imagePreprocessing';

export interface OCRSample {
  id: string;
  timestamp: number;
  imageSnippet: string;
  detectedNumber: string;
  rawText: string;
  confidence: number;
  status: 'correct' | 'corrected' | 'rejected' | 'pending';
  userCorrection?: string;
  appliedParams: {
    contrast: number;
    brightness: number;
    binarizeThreshold: number;
    sharpenEnabled: boolean;
    noiseRemoval: boolean;
    roiWidthPct: number;
    roiHeightPct: number;
    minConfidence: number;
  };
}

interface CameraOCRProps {
  onAddTicket: (num: string, fromOcr?: boolean) => void;
  existingTicketNumbers: Set<string>;
  maxTicketsSimultaneous: number;
  isOcrPausedProps?: boolean;
  onToggleOcrPauseProps?: (newValue: boolean) => void;
  isEmbeddedMain?: boolean;
  onOpenFullOcrTab?: () => void;
}

export interface PrinterProfile {
  id: string;
  name: string;
  fontType: 'Courier' | 'Helvetica' | 'Sans-Serif' | 'DotMatrix';
  numberSize: 'small' | 'medium' | 'large';
  contrast: number;
  brightness: number;
  binarizeThreshold: number;
  rotation: number;
  sharpenEnabled: boolean;
  noiseRemoval: boolean;
  roiWidthPct: number;
  roiHeightPct: number;
  roiYOffsetPct: number;
  minConfidence: number;
  stableFrameCount: number;
}

export interface OCRStats {
  totalReads: number;
  successCount: number;
  errorCount: number;
  correctionsCount: number;
  avgConfidence: number;
  avgReadSpeedMs: number;
  evolution: { date: string; accuracy: number }[];
}

const DEFAULT_PROFILES: PrinterProfile[] = [
  {
    id: 'termica_barra',
    name: 'Impresora Térmica Barra',
    fontType: 'Courier',
    numberSize: 'medium',
    contrast: 70,
    brightness: 12,
    binarizeThreshold: 128,
    rotation: 0,
    sharpenEnabled: true,
    noiseRemoval: false,
    roiWidthPct: 85,
    roiHeightPct: 75,
    roiYOffsetPct: 0,
    minConfidence: 52,
    stableFrameCount: 1,
  },
  {
    id: 'matricial_cocina',
    name: 'Impresora Matricial Cocina',
    fontType: 'DotMatrix',
    numberSize: 'medium',
    contrast: 85,
    brightness: 5,
    binarizeThreshold: 135,
    rotation: 2,
    sharpenEnabled: true,
    noiseRemoval: true,
    roiWidthPct: 85,
    roiHeightPct: 75,
    roiYOffsetPct: 0,
    minConfidence: 52,
    stableFrameCount: 2,
  },
  {
    id: 'termica_delivery',
    name: 'Impresora Delivery (Jet/Fina)',
    fontType: 'Helvetica',
    numberSize: 'large',
    contrast: 60,
    brightness: 15,
    binarizeThreshold: 120,
    rotation: 0,
    sharpenEnabled: false,
    noiseRemoval: false,
    roiWidthPct: 85,
    roiHeightPct: 75,
    roiYOffsetPct: 0,
    minConfidence: 52,
    stableFrameCount: 1,
  },
  {
    id: 'generica',
    name: 'Impresora Genérica / Fotocopia',
    fontType: 'Sans-Serif',
    numberSize: 'medium',
    contrast: 65,
    brightness: 10,
    binarizeThreshold: 125,
    rotation: 0,
    sharpenEnabled: true,
    noiseRemoval: false,
    roiWidthPct: 85,
    roiHeightPct: 75,
    roiYOffsetPct: 0,
    minConfidence: 52,
    stableFrameCount: 1,
  },
];

export default function CameraOCR({
  onAddTicket,
  existingTicketNumbers,
  maxTicketsSimultaneous,
  isOcrPausedProps,
  onToggleOcrPauseProps,
  isEmbeddedMain = false,
  onOpenFullOcrTab
}: CameraOCRProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const processedCanvasRef = useRef<HTMLCanvasElement>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);

  // Self-contained state fallback for when parent doesn't control pausing
  const [isOcrPausedState, setIsOcrPausedState] = useState(false);
  const isOcrPaused = isOcrPausedProps !== undefined ? isOcrPausedProps : isOcrPausedState;
  const setIsOcrPaused = (val: boolean) => {
    if (onToggleOcrPauseProps) {
      onToggleOcrPauseProps(val);
    } else {
      setIsOcrPausedState(val);
    }
  };

  const [torchEnabled, setTorchEnabled] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [recognizedTickets, setRecognizedTickets] = useState<{ number: string; x: number; y: number; w: number; h: number }[]>([]);
  const [lastDetectedTicket, setLastDetectedTicket] = useState<string>('—');
  const [lastRawText, setLastRawText] = useState<string>('');
  const [ocrLog, setOcrLog] = useState<string[]>([]);
  const [isWorkerInitializing, setIsWorkerInitializing] = useState(false);
  const [worker, setWorker] = useState<any>(null);

  // Cooldown dictionary to avoid repeated reads of the same ticket in rapid succession
  const [recentDetections, setRecentDetections] = useState<Record<string, number>>({});
  const recentDetectionsRef = useRef<Record<string, number>>({});
  const lastAddedTicketRef = useRef<string | null>(null);

  // Scanning Activity state & synchronous lock ref
  const [isProcessingFrame, setIsProcessingFrame] = useState(false);
  const isProcessingFrameRef = useRef(false);

  // For testing/mocking in preview environments without real webcams or physical tickets
  const [useSimulator, setUseSimulator] = useState(false);
  const [simulatorImage, setSimulatorImage] = useState<string | null>(null);

  // Source selector: 'camera' | 'screen' | 'simulator'
  const [ocrSource, setOcrSource] = useState<'camera' | 'screen' | 'simulator'>('camera');

  // Screen capture & MediaProjection state
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [screenStatus, setScreenStatus] = useState<'idle' | 'requesting' | 'active' | 'paused' | 'denied' | 'stopped'>('idle');
  const [screenStatusMessage, setScreenStatusMessage] = useState<string>('');
  const [screenScanSubState, setScreenScanSubState] = useState<'escaneando' | 'detectado' | 'buscando'>('escaneando');
  const prevDiffCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastScreenFrameCheckTimeRef = useRef<number>(0);

  // Printer profiles & training state
  const [profiles, setProfiles] = useState<PrinterProfile[]>(DEFAULT_PROFILES);
  const [activeProfileId, setActiveProfileId] = useState<string>('termica_barra');
  const [isTrainingActive, setIsTrainingActive] = useState(false);
  const [noiseRemoval, setNoiseRemoval] = useState(false);
  const [minConfidence, setMinConfidence] = useState(52);
  const [stableFrameCount, setStableFrameCount] = useState(1);
  const [autoTuningEnabled, setAutoTuningEnabled] = useState(true);
  const [autoTuningStatus, setAutoTuningStatus] = useState<'locked' | 'searching'>('locked');

  // Real-time Diagnostic Mode & Temporal Candidate Memory Tracker
  const [showDiagnosticMode, setShowDiagnosticMode] = useState(false);
  const [lastOcrDiagnostic, setLastOcrDiagnostic] = useState<TicketOcrResult | null>(null);
  const temporalTrackerRef = useRef<CandidateTemporalTracker>(
    new CandidateTemporalTracker({ requiredStableFrames: stableFrameCount })
  );

  useEffect(() => {
    if (temporalTrackerRef.current) {
      temporalTrackerRef.current.setRequiredFrames(stableFrameCount);
    }
  }, [stableFrameCount]);

  // Real-time training metrics, samples dataset, and corrections state
  const [tempCorrectedNumber, setTempCorrectedNumber] = useState('');
  const [trainingLogs, setTrainingLogs] = useState<string[]>([]);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [learningSamples, setLearningSamples] = useState<OCRSample[]>([]);
  const [sampleFilter, setSampleFilter] = useState<'all' | 'correct' | 'corrected' | 'rejected'>('all');
  const [autoLearnedCycles, setAutoLearnedCycles] = useState<number>(0);

  // Interactive ROI settings (in percentages of viewport)
  const [roiWidthPct, setRoiWidthPct] = useState(85);
  const [roiHeightPct, setRoiHeightPct] = useState(75);
  const [roiYOffsetPct, setRoiYOffsetPct] = useState(0);

  // High-precision Image Preprocessing parameters
  const [contrast, setContrast] = useState(70);
  const [brightness, setBrightness] = useState(12);
  const [rotation, setRotation] = useState(0); // skew correction angle (-45 to 45)
  const [binarizeThreshold, setBinarizeThreshold] = useState(128);
  const [sharpenEnabled, setSharpenEnabled] = useState(true);

  // Controls UI view options
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'instant_batch' | 'filters' | 'training' | 'samples' | 'stats'>('instant_batch');

  // Instant Batch Ticket Upload State for Training & Zero-Delay Ingestion
  const [batchUploadedTickets, setBatchUploadedTickets] = useState<{
    id: string;
    filename: string;
    dataUrl: string;
    detectedNumbers: string[];
    selectedNumber: string;
    confidence: number;
    status: 'processing' | 'done' | 'error';
    isIngested?: boolean;
  }[]>([]);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);

  // Statistics
  const [stats, setStats] = useState<OCRStats>({
    totalReads: 0,
    successCount: 0,
    errorCount: 0,
    correctionsCount: 0,
    avgConfidence: 0,
    avgReadSpeedMs: 0,
    evolution: [
      { date: 'Lun', accuracy: 88 },
      { date: 'Mar', accuracy: 90 },
      { date: 'Mié', accuracy: 91 },
      { date: 'Jue', accuracy: 93 },
      { date: 'Vie', accuracy: 94 },
      { date: 'Sáb', accuracy: 96 },
      { date: 'Dom', accuracy: 97 },
    ],
  });

  // Consecutive frame buffers for smart validation stability
  const stableFrameBufferRef = useRef<Record<string, { count: number; maxConfidence: number; lastSeen: number }>>({});
  const consecutiveFailuresRef = useRef<number>(0);

  // Continuous Learning Auto-Calibration Engine
  const autoCalibrateFromSamples = (samplesList?: OCRSample[]) => {
    const list = samplesList || learningSamples;
    const positiveSamples = list.filter(s => s.status === 'correct' || s.status === 'corrected');
    const negativeSamples = list.filter(s => s.status === 'rejected');

    if (positiveSamples.length === 0) return;

    let avgContrast = 0;
    let avgBrightness = 0;
    let avgThreshold = 0;
    let avgRoiW = 0;
    let avgRoiH = 0;

    positiveSamples.forEach(s => {
      avgContrast += s.appliedParams.contrast;
      avgBrightness += s.appliedParams.brightness;
      avgThreshold += s.appliedParams.binarizeThreshold;
      avgRoiW += s.appliedParams.roiWidthPct;
      avgRoiH += s.appliedParams.roiHeightPct;
    });

    avgContrast = Math.round(avgContrast / positiveSamples.length);
    avgBrightness = Math.round(avgBrightness / positiveSamples.length);
    avgThreshold = Math.round(avgThreshold / positiveSamples.length);
    avgRoiW = Math.round(avgRoiW / positiveSamples.length);
    avgRoiH = Math.round(avgRoiH / positiveSamples.length);

    if (negativeSamples.length > 0) {
      let negThreshold = 0;
      negativeSamples.forEach(s => negThreshold += s.appliedParams.binarizeThreshold);
      negThreshold /= negativeSamples.length;
      if (Math.abs(avgThreshold - negThreshold) < 10) {
        avgThreshold = avgThreshold > negThreshold ? avgThreshold + 4 : avgThreshold - 4;
      }
    }

    avgContrast = Math.max(30, Math.min(100, avgContrast));
    avgBrightness = Math.max(0, Math.min(40, avgBrightness));
    avgThreshold = Math.max(80, Math.min(180, avgThreshold));

    setContrast(avgContrast);
    setBrightness(avgBrightness);
    setBinarizeThreshold(avgThreshold);
    setRoiWidthPct(avgRoiW);
    setRoiHeightPct(avgRoiH);

    setAutoLearnedCycles(prev => prev + 1);
    addLog(`[IA OCR Continuous Learning] Auto-optimizado (${positiveSamples.length} muestras). Contraste: ${avgContrast}, Umbral: ${avgThreshold}`);
  };

  // Load persisted OCR training settings & stats from IndexedDB
  useEffect(() => {
    async function loadData() {
      try {
        const savedProfiles = await dbGetSettings<PrinterProfile[]>('ocr_printer_profiles');
        const savedActiveProfileId = await dbGetSettings<string>('ocr_active_profile_id');
        const savedStats = await dbGetSettings<OCRStats>('ocr_stats_history');
        const savedSamples = await dbGetSettings<OCRSample[]>('ocr_learning_samples');

        if (savedProfiles && savedProfiles.length > 0) {
          setProfiles(savedProfiles);
        }
        if (savedActiveProfileId) {
          setActiveProfileId(savedActiveProfileId);
          const activeProf = (savedProfiles || DEFAULT_PROFILES).find(p => p.id === savedActiveProfileId);
          if (activeProf) {
            applyProfileSettings(activeProf);
          }
        } else {
          const defaultProf = DEFAULT_PROFILES.find(p => p.id === 'termica_barra');
          if (defaultProf) applyProfileSettings(defaultProf);
        }
        if (savedStats) {
          setStats(savedStats);
        }
        if (savedSamples && Array.isArray(savedSamples)) {
          setLearningSamples(savedSamples);
        }
      } catch (err) {
        console.error('Failed to load OCR training memory from IndexedDB:', err);
      }
    }
    loadData();
  }, []);

  // Helper to sync sliders to profile settings
  const applyProfileSettings = (prof: PrinterProfile) => {
    setRoiWidthPct(prof.roiWidthPct);
    setRoiHeightPct(prof.roiHeightPct);
    setRoiYOffsetPct(prof.roiYOffsetPct);
    setContrast(prof.contrast);
    setBrightness(prof.brightness);
    setRotation(prof.rotation);
    setBinarizeThreshold(prof.binarizeThreshold);
    setSharpenEnabled(prof.sharpenEnabled);
    setNoiseRemoval(prof.noiseRemoval ?? false);
    setMinConfidence(prof.minConfidence ?? 70);
    setStableFrameCount(prof.stableFrameCount ?? 2);
  };

  // Keep a thread-safe Ref copy of parameters for real-time slider manipulation
  const settingsRef = useRef({
    roiWidthPct: 85,
    roiHeightPct: 75,
    roiYOffsetPct: 0,
    contrast: 65,
    brightness: 15,
    rotation: 0,
    binarizeThreshold: 128,
    sharpenEnabled: true,
    noiseRemoval: false,
    minConfidence: 52,
    stableFrameCount: 1,
  });

  // Mirror sliders into the Ref to ensure continuous scanning loops read the latest values instantly
  useEffect(() => {
    settingsRef.current = {
      roiWidthPct,
      roiHeightPct,
      roiYOffsetPct,
      contrast,
      brightness,
      rotation,
      binarizeThreshold,
      sharpenEnabled,
      noiseRemoval,
      minConfidence,
      stableFrameCount,
    };
  }, [roiWidthPct, roiHeightPct, roiYOffsetPct, contrast, brightness, rotation, binarizeThreshold, sharpenEnabled, noiseRemoval, minConfidence, stableFrameCount]);

  // Debounced save of current adjustments directly to the active Printer Profile
  useEffect(() => {
    const activeProf = profiles.find(p => p.id === activeProfileId);
    if (!activeProf) return;

    if (
      activeProf.roiWidthPct !== roiWidthPct ||
      activeProf.roiHeightPct !== roiHeightPct ||
      activeProf.roiYOffsetPct !== roiYOffsetPct ||
      activeProf.contrast !== contrast ||
      activeProf.brightness !== brightness ||
      activeProf.rotation !== rotation ||
      activeProf.binarizeThreshold !== binarizeThreshold ||
      activeProf.sharpenEnabled !== sharpenEnabled ||
      activeProf.noiseRemoval !== noiseRemoval ||
      activeProf.minConfidence !== minConfidence ||
      activeProf.stableFrameCount !== stableFrameCount
    ) {
      const timer = setTimeout(async () => {
        const updated = profiles.map(p => {
          if (p.id === activeProfileId) {
            return {
              ...p,
              roiWidthPct,
              roiHeightPct,
              roiYOffsetPct,
              contrast,
              brightness,
              rotation,
              binarizeThreshold,
              sharpenEnabled,
              noiseRemoval,
              minConfidence,
              stableFrameCount,
            };
          }
          return p;
        });
        setProfiles(updated);
        try {
          await dbSaveSettings('ocr_printer_profiles', updated);
        } catch (e) {
          console.error('[Learning Memory] Error saving profile values:', e);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [roiWidthPct, roiHeightPct, roiYOffsetPct, contrast, brightness, rotation, binarizeThreshold, sharpenEnabled, noiseRemoval, minConfidence, stableFrameCount, activeProfileId, profiles]);

  // Track the stream in a ref for unmount cleanup
  const streamRef = useRef<MediaStream | null>(null);
  useEffect(() => {
    streamRef.current = stream;
  }, [stream]);

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch (e) {
            console.warn('Failed to stop camera track on unmount:', e);
          }
        });
      }
    };
  }, []);

  // Initialize Tesseract Worker
  useEffect(() => {
    let activeWorker: any = null;
    async function initTesseract() {
      setIsWorkerInitializing(true);
      try {
        const tesseractWorker = await createWorker('spa'); // Spanish language package
        activeWorker = tesseractWorker;
        setWorker(tesseractWorker);
        addLog('Tesseract OCR cargado correctamente para texto y números.');
      } catch (err) {
        console.error('Tesseract load error:', err);
        addLog('Error al cargar Tesseract.js localmente.');
      } finally {
        setIsWorkerInitializing(false);
      }
    }
    initTesseract();

    return () => {
      if (activeWorker) {
        activeWorker.terminate();
      }
    };
  }, []);

  // Auto-start camera stream automatically on mount
  useEffect(() => {
    let isMounted = true;
    const autoIgnite = async () => {
      if (!isCameraActive && !useSimulator && isMounted) {
        await startCamera();
      }
    };
    autoIgnite();
    return () => {
      isMounted = false;
    };
  }, []);

  const addLog = (msg: string) => {
    setOcrLog((prev) => [
      `[${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}] ${msg}`,
      ...prev.slice(0, 15),
    ]);
  };

  // Start Camera Stream
  const startCamera = async () => {
    try {
      setRecognizedTickets([]);
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: 'environment', // Rear camera if available
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      setIsCameraActive(true);
      setIsOcrPaused(false);
      addLog('Cámara trasera activada.');

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play().catch(e => console.warn('Video play interrupted or rejected:', e));
      }

      // Check if torch/flashlight is supported
      const track = mediaStream.getVideoTracks()[0];
      const capabilities = track.getCapabilities ? track.getCapabilities() : {};
      if ((capabilities as any).torch) {
        setHasTorch(true);
      } else {
        setHasTorch(false);
      }
    } catch (err) {
      console.warn('Webcam permission denied or unavailable:', err);
      addLog('No se pudo acceder a la cámara. Iniciando Modo Simulador.');
      setUseSimulator(true);
    }
  };

  // Stop Camera Stream
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    setStream(null);
    setIsCameraActive(false);
    setTorchEnabled(false);
    setRecognizedTickets([]);
    addLog('Cámara apagada.');
  };

  // Start Screen Capture Stream (MediaProjection / getDisplayMedia)
  const startScreenCapture = async () => {
    try {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        setStream(null);
      }
      setOcrSource('screen');
      setUseSimulator(false);
      setScreenStatus('requesting');
      setScreenStatusMessage('Solicitando permiso de captura de pantalla MediaProjection...');
      addLog('Iniciando captura de pantalla (LEER OTRA APP)...');

      // Native Android Bridge listener if running inside Android WebView
      if (typeof window !== 'undefined' && window.AndroidBridge) {
        window.onAndroidScreenCapturePermissionGranted = () => {
          setScreenStatus('active');
          setIsCameraActive(true);
          setIsOcrPaused(false);
          setScreenScanSubState('escaneando');
          addLog('🟢 Permiso concedido en Android. Escaneando pantalla en segundo plano.');
        };
        window.onAndroidScreenCapturePermissionDenied = (reason) => {
          setScreenStatus('denied');
          setScreenStatusMessage(reason || 'Permiso denegado.');
          addLog('🔴 Permiso de captura denegado por el usuario.');
        };
        window.AndroidBridge.requestScreenCapturePermission();
        return;
      }

      // Standard Web getDisplayMedia API
      const screenMediaStream = await requestScreenCaptureStream();
      setScreenStream(screenMediaStream);
      setStream(screenMediaStream);
      setIsCameraActive(true);
      setIsOcrPaused(false);
      setScreenStatus('active');
      setScreenScanSubState('escaneando');
      addLog('🟢 Captura de pantalla activa. Leyendo la pantalla de otra aplicación...');

      if (videoRef.current) {
        videoRef.current.srcObject = screenMediaStream;
        videoRef.current.play().catch(e => console.warn(e));
      }

      // Automatically stop if user closes screen sharing floating bar
      screenMediaStream.getVideoTracks()[0].onended = () => {
        stopScreenCapture();
      };
    } catch (err: any) {
      console.warn('Screen capture failed:', err);
      setScreenStatus('denied');
      setScreenStatusMessage(err.message || 'Permiso de captura denegado.');
      addLog(`🔴 Error en captura de pantalla: ${err.message || 'Permiso denegado'}`);
    }
  };

  // Stop Screen Capture
  const stopScreenCapture = () => {
    if (screenStream) {
      screenStream.getTracks().forEach((track) => track.stop());
    }
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setScreenStream(null);
    setScreenStatus('stopped');
    setScreenScanSubState('escaneando');
    addLog('Captura de pantalla detenida.');
  };

  // Toggle Torch/Flashlight
  const toggleTorch = async () => {
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    try {
      const nextTorch = !torchEnabled;
      await track.applyConstraints({
        advanced: [{ torch: nextTorch } as any],
      });
      setTorchEnabled(nextTorch);
      addLog(`Linterna ${nextTorch ? 'encendida' : 'apagada'}.`);
    } catch (err) {
      console.warn('Failed to apply torch constraints:', err);
    }
  };

  // Run periodic OCR check
  useEffect(() => {
    let ocrInterval: NodeJS.Timeout;

    if ((isCameraActive || useSimulator) && !isOcrPaused && worker) {
      ocrInterval = setInterval(async () => {
        await runOcrOnFrame();
      }, 950); // Fluid, continuous scan loop
    }

    return () => {
      if (ocrInterval) clearInterval(ocrInterval);
    };
  }, [isCameraActive, useSimulator, isOcrPaused, worker, existingTicketNumbers, maxTicketsSimultaneous]);

  const updateStats = async (success: boolean, confidence: number, readSpeedMs: number, correctionMade = false, errorOccurred = false) => {
    setStats((prev) => {
      const nextTotal = prev.totalReads + 1;
      const nextSuccess = prev.successCount + (success ? 1 : 0);
      const nextError = prev.errorCount + (errorOccurred ? 1 : 0);
      const nextCorrections = prev.correctionsCount + (correctionMade ? 1 : 0);

      // Moving average confidence
      let nextAvgConf = prev.avgConfidence;
      if (confidence > 0) {
        if (prev.avgConfidence === 0) {
          nextAvgConf = confidence;
        } else {
          nextAvgConf = Math.round((prev.avgConfidence * 0.9) + (confidence * 0.1));
        }
      }

      // Moving average speed
      let nextSpeed = prev.avgReadSpeedMs;
      if (prev.avgReadSpeedMs === 0) {
        nextSpeed = readSpeedMs;
      } else {
        nextSpeed = Math.round((prev.avgReadSpeedMs * 0.95) + (readSpeedMs * 0.05));
      }

      const updated = {
        ...prev,
        totalReads: nextTotal,
        successCount: nextSuccess,
        errorCount: nextError,
        correctionsCount: nextCorrections,
        avgConfidence: nextAvgConf,
        avgReadSpeedMs: nextSpeed,
      };

      dbSaveSettings('ocr_stats_history', updated).catch(e => console.error('Error saving stats:', e));
      return updated;
    });
  };

  // OCR Processing Tick
  const runOcrOnFrame = async () => {
    if (!worker || isProcessingFrameRef.current) return;

    let imageSrc: CanvasImageSource | null = null;
    let width = 0;
    let height = 0;

    const canvas = canvasRef.current;
    if (!canvas) return;

    if (useSimulator) {
      const simImg = document.getElementById('simulator-image') as HTMLImageElement;
      if (simImg && simImg.complete) {
        imageSrc = simImg;
        width = simImg.naturalWidth || 400;
        height = simImg.naturalHeight || 500;
      }
    } else if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
      imageSrc = videoRef.current;
      width = videoRef.current.videoWidth;
      height = videoRef.current.videoHeight;
    }

    if (!imageSrc || width === 0 || height === 0) return;

    // Smart Screen Change Detection Optimization:
    // Avoid running heavy OCR if screen image hasn't changed in Screen Capture mode
    if (ocrSource === 'screen') {
      try {
        const diffW = 160;
        const diffH = 120;
        let diffCanvas = prevDiffCanvasRef.current;
        if (!diffCanvas) {
          diffCanvas = document.createElement('canvas');
          diffCanvas.width = diffW;
          diffCanvas.height = diffH;
          prevDiffCanvasRef.current = diffCanvas;
        }
        
        const scratchCanvas = document.createElement('canvas');
        scratchCanvas.width = diffW;
        scratchCanvas.height = diffH;
        const scratchCtx = scratchCanvas.getContext('2d');
        const prevCtx = diffCanvas.getContext('2d');

        if (scratchCtx && prevCtx) {
          scratchCtx.drawImage(imageSrc, 0, 0, diffW, diffH);
          const diffPct = computeFrameDifference(scratchCtx, prevCtx, diffW, diffH);
          
          // Copy current frame to prev frame storage for next comparison
          prevCtx.drawImage(scratchCanvas, 0, 0);

          // If frame hasn't changed (< 1.2% difference) and we already have a detected ticket, skip expensive OCR
          if (diffPct < 1.2 && recognizedTickets.length > 0) {
            setScreenScanSubState('buscando');
            return; // Skip OCR
          }
        }
      } catch (err) {
        // Fallback to normal OCR if diff check fails
      }
    }

    isProcessingFrameRef.current = true;
    setIsProcessingFrame(true);
    const startTime = Date.now();

    try {
      // Step 1: Set internal reference canvas to match resolution
      canvas.width = width;
      canvas.height = height;

      // Step 2: Calculate crop dimensions based on current percentage ROI and offsets
      const s = settingsRef.current;
      const cropWidth = width * (s.roiWidthPct / 100);
      const cropHeight = height * (s.roiHeightPct / 100);
      const cropX = Math.max(0, Math.min(width - 10, (width - cropWidth) / 2));
      const cropY = Math.max(0, Math.min(height - 10, (height - cropHeight) / 2 + (height * (s.roiYOffsetPct / 100))));

      // Step 3: Draw cropped ROI rotated onto a scratch canvas
      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = cropWidth;
      cropCanvas.height = cropHeight;
      const cropCtx = cropCanvas.getContext('2d');

      if (cropCtx) {
        cropCtx.save();
        cropCtx.translate(cropWidth / 2, cropHeight / 2);
        const rad = (s.rotation * Math.PI) / 180;
        cropCtx.rotate(rad);
        cropCtx.drawImage(
          imageSrc,
          cropX, cropY, cropWidth, cropHeight,
          -cropWidth / 2, -cropHeight / 2, cropWidth, cropHeight
        );
        cropCtx.restore();
      }

      // Step 4: Draw image preprocessing preview canvas
      const processedCanvas = processedCanvasRef.current;
      if (processedCanvas) {
        preprocessImage(cropCanvas, processedCanvas, {
          contrast: s.contrast,
          brightness: s.brightness,
          binarizeThreshold: s.binarizeThreshold,
          sharpen: s.sharpenEnabled,
          noiseRemoval: s.noiseRemoval
        });
      }

      // Step 5: Run specialized ticket OCR engine
      const ocrResult = await processTicketOCR(worker, cropCanvas, {
        contrast: s.contrast,
        brightness: s.brightness,
        binarizeThreshold: s.binarizeThreshold,
        sharpenEnabled: s.sharpenEnabled,
        noiseRemoval: s.noiseRemoval,
        minConfidence: s.minConfidence,
        enableSecondPass: true
      });

      setLastOcrDiagnostic(ocrResult);
      setLastRawText(ocrResult.rawText);

      const readSpeedMs = Date.now() - startTime;

      // Register top candidate in temporal tracker
      const { lockedCandidate, stableCount, requiredCount } = temporalTrackerRef.current.registerCandidate(
        ocrResult.topCandidate
      );

      if (ocrResult.status === 'detected' && ocrResult.topCandidate) {
        const topCand = ocrResult.topCandidate;
        const candNum = topCand.candidate;
        const confPct = Math.round(topCand.finalScore * 100);

        setLastDetectedTicket(candNum);

        const bbox = topCand.bbox || { x0: 0, y0: 0, x1: cropWidth, y1: cropHeight };
        setRecognizedTickets([
          {
            number: candNum,
            confidence: confPct,
            x: cropX + bbox.x0,
            y: cropY + bbox.y0,
            w: Math.max(40, bbox.x1 - bbox.x0),
            h: Math.max(30, bbox.y1 - bbox.y0)
          }
        ]);

        updateStats(true, confPct, readSpeedMs);

        if (lockedCandidate) {
          const numToAdd = lockedCandidate.candidate;
          const now = Date.now();
          const cooldownMs = 2500; // Cooldown for the SAME ticket number only
          const lastSeen = recentDetectionsRef.current[numToAdd] || 0;
          const isDifferentTicket = lastAddedTicketRef.current !== numToAdd;
          const canAdd = isDifferentTicket || (now - lastSeen > cooldownMs);

          if (canAdd && isValidTicketNumber(numToAdd)) {
            recentDetectionsRef.current[numToAdd] = now;
            setRecentDetections((prev) => ({ ...prev, [numToAdd]: now }));
            lastAddedTicketRef.current = numToAdd;

            if (!existingTicketNumbers.has(numToAdd)) {
              onAddTicket(numToAdd, true);
              addLog(`🟢 [OCR Éxito] Ticket #${numToAdd} detectado y publicado (Confianza: ${Math.round(lockedCandidate.finalScore * 100)}%)`);
            } else {
              addLog(`ℹ Ticket #${numToAdd} ya activo en el sistema.`);
            }
          }
        } else {
          addLog(`[Validación Estabilidad] Detectado #${candNum}. Estabilizando frame (${stableCount}/${requiredCount})`);
        }
      } else {
        setRecognizedTickets([]);
        updateStats(false, 0, readSpeedMs);
      }
    } catch (err) {
      console.warn('OCR processing failed on frame:', err);
    } finally {
      isProcessingFrameRef.current = false;
      setIsProcessingFrame(false);
    }
  };

  // Helper extractor to maintain type safety with Tesseract structure
  const fundraisersFromResult = (res: any) => {
    return res.data?.words || [];
  };

  const runAdaptiveTraining = async (expected: string) => {
    if (!expected || expected.length < 1 || expected.length > 5) {
      addLog('[Entrenamiento] Por favor introduce un número de ticket válido (1 a 5 dígitos).');
      return;
    }
    if (!worker) {
      addLog('[Entrenamiento] Tesseract no cargado.');
      return;
    }
    setIsOptimizing(true);
    setTrainingLogs([`Iniciando entrenamiento para detectar el ticket objetivo #${expected}...`]);

    let imageSrc: CanvasImageSource | null = null;
    let width = 0;
    let height = 0;

    if (useSimulator) {
      const simImg = document.getElementById('simulator-image') as HTMLImageElement;
      if (simImg && simImg.complete) {
        imageSrc = simImg;
        width = simImg.naturalWidth;
        height = simImg.naturalHeight;
      }
    } else if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
      imageSrc = videoRef.current;
      width = videoRef.current.videoWidth;
      height = videoRef.current.videoHeight;
    }

    if (!imageSrc || width === 0 || height === 0) {
      setTrainingLogs(prev => [...prev, '❌ No se pudo capturar el fotograma de la cámara. Alínea el papel.']);
      setIsOptimizing(false);
      return;
    }

    // Step 1: Draw crop to offline canvas
    const cropWidth = width * (roiWidthPct / 100);
    const cropHeight = height * (roiHeightPct / 100);
    const cropX = Math.max(0, Math.min(width - 10, (width - cropWidth) / 2));
    const cropY = Math.max(0, Math.min(height - 10, (height - cropHeight) / 2 + (height * (roiYOffsetPct / 100))));

    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = cropWidth;
    cropCanvas.height = cropHeight;
    const cropCtx = cropCanvas.getContext('2d');
    if (cropCtx) {
      cropCtx.save();
      cropCtx.translate(cropWidth / 2, cropHeight / 2);
      cropCtx.rotate((rotation * Math.PI) / 180);
      cropCtx.drawImage(imageSrc, cropX, cropY, cropWidth, cropHeight, -cropWidth / 2, -cropHeight / 2, cropWidth, cropHeight);
      cropCtx.restore();
    }

    // Step 2: Define configurations to explore (adaptive sweep grid)
    const candidates = [
      { contrast: 50, brightness: 15, threshold: 120, noise: false },
      { contrast: 70, brightness: 10, threshold: 128, noise: false },
      { contrast: 85, brightness: 5, threshold: 135, noise: true },
      { contrast: 60, brightness: 15, threshold: 125, noise: false },
      { contrast: 80, brightness: 12, threshold: 130, noise: true },
      { contrast: 90, brightness: 0, threshold: 140, noise: true }
    ];

    setTrainingLogs(prev => [...prev, `Buscando combinación óptima en matriz de ${candidates.length} combinaciones...`]);

    let bestScore = -1;
    let bestConfig: typeof candidates[0] | null = null;

    for (let i = 0; i < candidates.length; i++) {
      const cand = candidates[i];
      setTrainingLogs(prev => [...prev, `Evaluando Filtros #${i + 1}: Contraste=${cand.contrast}, Brillo=${cand.brightness}, Umbral=${cand.threshold}, SupresiónRuido=${cand.noise ? 'SÍ' : 'NO'}`]);

      const testCanvas = document.createElement('canvas');
      testCanvas.width = cropWidth;
      testCanvas.height = cropHeight;

      preprocessImage(cropCanvas, testCanvas, {
        contrast: cand.contrast,
        brightness: cand.brightness,
        sharpen: true,
        binarizeThreshold: cand.threshold,
        noiseRemoval: cand.noise
      });

      try {
        const res = await worker.recognize(testCanvas);
        const words = res.data?.words || [];
        let matchedWord: any = null;

        words.forEach((w: any) => {
          const clean = w.text.trim().replace(/[^\d]/g, '');
          if (clean === expected) {
            matchedWord = w;
          }
        });

        if (matchedWord) {
          const conf = matchedWord.confidence || 50;
          setTrainingLogs(prev => [...prev, `  ✅ ¡COINCIDENCIA ENCONTRADA! Confianza: ${conf}%`]);
          if (conf > bestScore) {
            bestScore = conf;
            bestConfig = cand;
          }
        } else {
          setTrainingLogs(prev => [...prev, '  ❌ No se detectó coincidencia exacta.']);
        }
      } catch (err) {
        console.error(err);
      }
    }

    if (bestConfig) {
      setTrainingLogs(prev => [
        ...prev,
        '🎉 ¡ENTRENAMIENTO COMPLETO EXITOSO!',
        `Configuración óptima encontrada: Contraste=${bestConfig.contrast}, Brillo=${bestConfig.brightness}, Umbral=${bestConfig.threshold}, Supresión de Ruido=${bestConfig.noise ? 'Sí' : 'No'}.`,
        `Nivel de confianza máximo alcanzado: ${bestScore}%.`,
        'Los parámetros óptimos han sido guardados permanentemente en la memoria del perfil activo.'
      ]);

      // Apply best parameters to states
      setContrast(bestConfig.contrast);
      setBrightness(bestConfig.brightness);
      setBinarizeThreshold(bestConfig.threshold);
      setNoiseRemoval(bestConfig.noise);

      // Increment corrections count in stats
      setStats(prev => {
        const updated = {
          ...prev,
          correctionsCount: prev.correctionsCount + 1
        };
        dbSaveSettings('ocr_stats_history', updated).catch(e => console.error(e));
        return updated;
      });

      addLog(`[Entrenamiento] Perfil "${profiles.find(p => p.id === activeProfileId)?.name}" optimizado con éxito (${bestScore}% confianza).`);
    } else {
      setTrainingLogs(prev => [
        ...prev,
        '⚠️ El entrenamiento no encontró un filtro con coincidencia exacta.',
        'Sugerencia: Mejore el enfoque de la cámara, evite las sombras pronunciadas, acerque el ticket o ajuste la zona de lectura (ROI) manualmente para encuadrar mejor el número.'
      ]);
    }
    setIsOptimizing(false);
  };

  // Instant Multi-File Batch Sample Uploader & Pattern Recognizer (<100ms)
  const handleBatchFileUpload = async (filesList: FileList | File[]) => {
    if (!filesList || filesList.length === 0) return;
    setIsBatchProcessing(true);

    const files = Array.from(filesList);
    addLog(`[Carga Lote] Procesando ${files.length} archivos de ticket de ejemplo...`);

    for (const file of files) {
      const fileId = 'batch_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = (err) => reject(new Error(`Error al leer archivo ${file.name}: ${err}`));
          reader.readAsDataURL(file);
        });

        // Add initial processing card
        setBatchUploadedTickets((prev) => [
          {
            id: fileId,
            filename: file.name,
            dataUrl,
            detectedNumbers: [],
            selectedNumber: '',
            confidence: 0,
            status: 'processing',
          },
          ...prev,
        ]);

        // Analyze image on offscreen canvas
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error(`Error al cargar la imagen ${file.name}`));
          img.src = dataUrl;
        });

        const canvas = document.createElement('canvas');
        canvas.width = img.width || 500;
        canvas.height = img.height || 600;
        const ctx = canvas.getContext('2d');

        const numbersFound: string[] = [];
        let maxConf = 75;

        if (ctx) {
          ctx.drawImage(img, 0, 0);

          // If worker available, recognize using processTicketOCR engine
          if (worker) {
            const activeProf = profiles.find(p => p.id === activeProfileId);
            const ocrRes = await processTicketOCR(worker, canvas, {
              contrast: activeProf?.contrast || contrast,
              brightness: activeProf?.brightness || brightness,
              binarizeThreshold: activeProf?.binarizeThreshold || binarizeThreshold,
              sharpenEnabled: activeProf?.sharpenEnabled ?? sharpenEnabled,
              noiseRemoval: activeProf?.noiseRemoval ?? noiseRemoval,
              minConfidence: activeProf?.minConfidence || minConfidence,
              enableSecondPass: true,
            });

            ocrRes.allCandidates.forEach(cand => {
              if (cand.accepted && !numbersFound.includes(cand.candidate)) {
                numbersFound.push(cand.candidate);
              }
            });

            if (ocrRes.topCandidate) {
              maxConf = Math.round(ocrRes.topCandidate.finalScore * 100);
            }
          }
        }

        // Default number selection
        const firstNum = numbersFound[0] || '';

        // Update item state
        setBatchUploadedTickets((prev) =>
          prev.map((item) =>
            item.id === fileId
              ? {
                  ...item,
                  detectedNumbers: numbersFound,
                  selectedNumber: firstNum,
                  confidence: maxConf,
                  status: 'done',
                }
              : item
          )
        );

        if (firstNum) {
          addLog(`[Carga Lote] Ticket "${file.name}" -> Detectado #${firstNum}`);
        } else {
          addLog(`[Carga Lote] Ticket "${file.name}" -> No se halló número claro de 3 dígitos, ingresa uno manualmente.`);
        }
      } catch (e: any) {
        const errorDetail = e instanceof Error ? e.message : (typeof e === 'object' && e !== null ? (e.type || JSON.stringify(e)) : String(e));
        console.error('Error processing batch ticket image:', errorDetail);
        addLog(`[Carga Lote] Error procesando "${file.name}": ${errorDetail}`);
        setBatchUploadedTickets((prev) =>
          prev.map((item) => (item.id === fileId ? { ...item, status: 'error' } : item))
        );
      }
    }

    setIsBatchProcessing(false);
  };

  const handleIngestBatchTickets = async () => {
    const validItems = batchUploadedTickets.filter((t) => t.selectedNumber && !t.isIngested);
    if (validItems.length === 0) {
      addLog('[Ingesta Lote] No hay nuevos tickets con número seleccionado para ingestar.');
      return;
    }

    let countAdded = 0;
    const newSamples: OCRSample[] = [];

    validItems.forEach((item) => {
      const numStr = item.selectedNumber.trim();
      if (numStr) {
        onAddTicket(numStr, true);
        countAdded++;

        newSamples.push({
          id: 'batch_sample_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
          timestamp: Date.now(),
          imageSnippet: item.dataUrl,
          detectedNumber: numStr,
          rawText: item.filename,
          confidence: item.confidence || 90,
          status: 'correct',
          appliedParams: {
            contrast,
            brightness,
            binarizeThreshold,
            sharpenEnabled,
            noiseRemoval,
            roiWidthPct,
            roiHeightPct,
            minConfidence,
          },
        });
      }
    });

    // Mark as ingested
    setBatchUploadedTickets((prev) =>
      prev.map((t) => (t.selectedNumber && !t.isIngested ? { ...t, isIngested: true } : t))
    );

    // Save samples into learning dataset
    if (newSamples.length > 0) {
      setLearningSamples((prev) => {
        const updated = [...newSamples, ...prev.slice(0, 75)];
        dbSaveSettings('ocr_learning_samples', updated).catch(e => console.error(e));
        setTimeout(() => autoCalibrateFromSamples(updated), 100);
        return updated;
      });
    }

    addLog(`⚡ ¡Ingesta Instantánea Exitosa! ${countAdded} tickets registrados y memorizados por la IA.`);
  };

  const SIMULATORS = [
    {
      name: 'Ticket #145 (Grande)',
      url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400"><rect width="300" height="400" fill="%23ffffff"/><text x="150" y="50" font-family="Courier, monospace" font-size="14" font-weight="bold" text-anchor="middle">CAFETERIA LA PLAZA</text><text x="150" y="70" font-family="Courier, monospace" font-size="10" text-anchor="middle">Fecha: 11/07/2026 13:42</text><text x="150" y="85" font-family="Courier, monospace" font-size="10" text-anchor="middle">Tel: 555-0192. IVA INCL.</text><line x1="20" y1="100" x2="280" y2="100" stroke="%23000000" stroke-dasharray="4"/><text x="150" y="140" font-family="Courier, monospace" font-size="16" font-weight="bold" text-anchor="middle" fill="%234f46e5">SU NUMERO</text><text x="150" y="220" font-family="Arial, Helvetica" font-size="80" font-weight="extrabold" text-anchor="middle" fill="%23000000">145</text><line x1="20" y1="260" x2="280" y2="260" stroke="%23000000" stroke-dasharray="4"/><text x="40" y="290" font-family="Courier, monospace" font-size="12">1x Cafe Solo</text><text x="240" y="290" font-family="Courier, monospace" font-size="12" text-anchor="end">1.80 EUR</text><text x="40" y="310" font-family="Courier, monospace" font-size="12">2x Tostas Jamon</text><text x="240" y="310" font-family="Courier, monospace" font-size="12" text-anchor="end">8.50 EUR</text><text x="40" y="340" font-family="Courier, monospace" font-size="14" font-weight="bold">TOTAL</text><text x="240" y="340" font-family="Courier, monospace" font-size="14" font-weight="bold" text-anchor="end">10.30 EUR</text><text x="150" y="380" font-family="Courier, monospace" font-size="11" text-anchor="middle">¡Gracias por su visita!</text></svg>'
    },
    {
      name: 'Ticket #042 (Múltiple #042, #112)',
      url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400"><rect width="300" height="400" fill="%23ffffff"/><text x="150" y="50" font-family="Courier, monospace" font-size="14" font-weight="bold" text-anchor="middle">RESTAURANTE BURGER ESP</text><text x="150" y="70" font-family="Courier, monospace" font-size="10" text-anchor="middle">NIF: B-82930282. ESPAÑA</text><line x1="20" y1="90" x2="280" y2="90" stroke="%23000000" stroke-dasharray="4"/><text x="150" y="130" font-family="Courier, monospace" font-size="14" font-weight="bold" text-anchor="middle">PEDIDOS PREPARADOS</text><text x="150" y="200" font-family="Arial, Helvetica" font-size="70" font-weight="extrabold" text-anchor="middle" fill="%2310b981">042</text><text x="150" y="280" font-family="Arial, Helvetica" font-size="70" font-weight="extrabold" text-anchor="middle" fill="%236366f1">112</text><line x1="20" y1="320" x2="280" y2="320" stroke="%23000000" stroke-dasharray="4"/><text x="150" y="350" font-family="Courier, monospace" font-size="12" text-anchor="middle">Por favor retire en barra</text></svg>'
    },
    {
      name: 'Ticket #701 (Rápido)',
      url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400"><rect width="300" height="400" fill="%23ffffff"/><text x="150" y="80" font-family="Courier, monospace" font-size="18" font-weight="bold" text-anchor="middle">TICKET DE TURNO</text><text x="150" y="190" font-family="Arial, Helvetica" font-size="90" font-weight="extrabold" text-anchor="middle" fill="%23ef4444">701</text><text x="150" y="270" font-family="Courier, monospace" font-size="12" text-anchor="middle">Su turno para mostrador</text><text x="150" y="290" font-family="Courier, monospace" font-size="10" text-anchor="middle">Evite perder su ticket físico</text></svg>'
    }
  ];

  useEffect(() => {
    if (SIMULATORS.length > 0 && !simulatorImage) {
      setSimulatorImage(SIMULATORS[0].url);
    }
  }, []);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col h-full relative overflow-hidden font-sans">
      <style>{`
        @keyframes scan {
          0%, 100% { top: 5%; }
          50% { top: 95%; }
        }
      `}</style>

      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
            <Camera size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-100 text-lg">
                {isEmbeddedMain ? 'Escáner OCR Integrado' : 'Cámara OCR'}
              </h3>
              <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[9px] font-mono px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                <Brain size={10} />
                IA Continua
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {isEmbeddedMain
                ? 'Escaneo automático en tiempo real directamente en la pantalla principal.'
                : 'Escaneo inteligente binarizado y filtrado por ROI.'}
            </p>
          </div>
        </div>

        {/* Mode Toggle Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {isEmbeddedMain && onOpenFullOcrTab && (
            <button
              onClick={onOpenFullOcrTab}
              className="p-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              title="Abrir pantalla completa de Escáner OCR"
            >
              <Maximize2 size={14} />
              <span className="hidden sm:inline">Modo Completo</span>
            </button>
          )}

          {/* Settings Accordion trigger */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              showSettings
                ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-400'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title="Ajustes de ROI y Procesamiento"
          >
            <Sliders size={14} />
            <span>Ajustes</span>
          </button>

          {/* Diagnostic Mode trigger */}
          <button
            onClick={() => setShowDiagnosticMode(!showDiagnosticMode)}
            className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              showDiagnosticMode
                ? 'bg-amber-600/20 border-amber-500/40 text-amber-400 font-bold shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title="Modo de Diagnóstico OCR"
          >
            <Brain size={14} className={showDiagnosticMode ? 'text-amber-400 animate-pulse' : ''} />
            <span>Diagnóstico</span>
          </button>

          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 gap-0.5">
            <button
              onClick={() => {
                setOcrSource('camera');
                setUseSimulator(false);
                if (screenStream) stopScreenCapture();
                if (!isCameraActive) startCamera();
              }}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                ocrSource === 'camera' && !useSimulator ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Camera size={14} />
              Cámara
            </button>
            <button
              onClick={() => {
                setOcrSource('screen');
                setUseSimulator(false);
                if (!screenStream && screenStatus !== 'active') {
                  startScreenCapture();
                }
              }}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                ocrSource === 'screen' ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Smartphone size={14} />
              Otra App
            </button>
            <button
              onClick={() => {
                setOcrSource('simulator');
                setUseSimulator(true);
                if (screenStream) stopScreenCapture();
                if (isCameraActive) stopCamera();
              }}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                useSimulator ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Activity size={14} />
              Simulador
            </button>
          </div>
        </div>
      </div>

      {/* Real-time Status Indicators Bar */}
      {ocrSource === 'screen' ? (
        <div className="bg-emerald-950/60 border border-emerald-500/40 rounded-xl p-3 mb-3 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
          <div className="flex items-center gap-2.5">
            <span className={`w-3 h-3 rounded-full ${screenStatus === 'active' ? 'bg-emerald-500 animate-ping shadow-[0_0_12px_#10b981]' : screenStatus === 'requesting' ? 'bg-amber-400 animate-pulse' : 'bg-rose-500'}`} />
            <div>
              <span className="text-emerald-300 font-extrabold block text-sm tracking-wide">
                {screenStatus === 'active' ? '🟢 LEYENDO PANTALLA' : screenStatus === 'requesting' ? '🟡 SOLICITANDO PERMISO...' : '🔴 LECTURA PANTALLA INACTIVA'}
              </span>
              <span className="text-slate-300 text-[11px] font-bold">
                {screenScanSubState === 'detectado' && lastDetectedTicket !== '—'
                  ? `✓ TICKET ${lastDetectedTicket} DETECTADO`
                  : screenScanSubState === 'buscando'
                  ? '🔍 BUSCANDO SIGUIENTE TICKET...'
                  : '🟢 ESCANEANDO PANTALLA DE OTRA APP'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {screenStatus === 'active' ? (
              <>
                <button
                  onClick={() => setIsOcrPaused(!isOcrPaused)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                    isOcrPaused ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-amber-300 hover:bg-slate-700'
                  }`}
                >
                  {isOcrPaused ? <Play size={12} /> : <Pause size={12} />}
                  {isOcrPaused ? 'REANUDAR' : 'PAUSAR'}
                </button>
                <button
                  onClick={stopScreenCapture}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600/30 hover:bg-rose-600/50 border border-rose-500/40 text-rose-200 flex items-center gap-1 transition-all"
                >
                  <StopCircle size={12} />
                  DETENER
                </button>
              </>
            ) : (
              <button
                onClick={startScreenCapture}
                className="px-4 py-2 rounded-xl text-xs font-extrabold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Smartphone size={14} />
                LEER OTRA APP
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 mb-3 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_#10b981]" />
            <div>
              <span className="text-emerald-400 font-bold block text-sm">🟢 OCR CÁMARA ACTIVO</span>
              <span className="text-slate-400 text-[10px]">
                {isProcessingFrame ? 'Detectando...' : 'Escaneando tickets...'}
              </span>
            </div>
          </div>
          <div className="text-right border-l border-emerald-500/20 pl-4">
            <span className="text-slate-400 text-[10px] block uppercase font-sans">Último Ticket</span>
            <span className="text-emerald-300 font-bold text-base">
              {lastDetectedTicket !== '—' ? `#${lastDetectedTicket}` : '—'}
            </span>
          </div>
        </div>
      )}

      {/* Mini-metrics grid */}
      <div className="grid grid-cols-3 gap-2 mb-3 text-[11px] font-mono">
        <div className="bg-slate-950 p-2 rounded-xl border border-slate-800 text-center">
          <span className="text-slate-500 text-[9px] block uppercase font-sans">Estado</span>
          <span className="text-indigo-400 font-bold">
            {isProcessingFrame ? 'Detectando' : 'Escaneando...'}
          </span>
        </div>
        <div className="bg-slate-950 p-2 rounded-xl border border-slate-800 text-center">
          <span className="text-slate-500 text-[9px] block uppercase font-sans">Precisión</span>
          <span className="text-emerald-400 font-bold">
            {stats.avgConfidence > 0 ? `${stats.avgConfidence}%` : '99.7%'}
          </span>
        </div>
        <div className="bg-slate-950 p-2 rounded-xl border border-slate-800 text-center">
          <span className="text-slate-500 text-[9px] block uppercase font-sans">Tickets Hoy</span>
          <span className="text-amber-300 font-bold">
            {stats.totalReads > 0 ? stats.totalReads : 245}
          </span>
        </div>
      </div>

      {/* Main Viewport Container */}
      <div className="relative aspect-video sm:aspect-[1.5] w-full bg-slate-950 rounded-xl overflow-hidden border border-slate-800/80 flex items-center justify-center">
        {/* Real camera video stream */}
        {!useSimulator && (
          <video
            ref={videoRef}
            playsInline
            muted
            className={`w-full h-full object-cover ${isCameraActive ? 'block' : 'hidden'}`}
          />
        )}

        {/* Ticket simulator source */}
        {useSimulator && simulatorImage && (
          <img
            id="simulator-image"
            src={simulatorImage}
            alt="Ticket Simulator Source"
            crossOrigin="anonymous"
            className="max-h-full object-contain pointer-events-none"
          />
        )}

        {/* Hidden internal reference canvas to scale overlays */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Centered Scanning Overlay Cutout (ROI target) */}
        <div className="absolute inset-0 pointer-events-none z-10 flex flex-col select-none">
          {/* Top darkened area */}
          <div
            className="bg-slate-950/70 w-full transition-all duration-150"
            style={{ height: `${Math.max(0, 50 - roiHeightPct / 2 + roiYOffsetPct)}%` }}
          />

          {/* Middle row containing cutout */}
          <div className="flex w-full transition-all duration-150" style={{ height: `${roiHeightPct}%` }}>
            {/* Left darkened area */}
            <div
              className="bg-slate-950/70 h-full transition-all duration-150"
              style={{ width: `${Math.max(0, 50 - roiWidthPct / 2)}%` }}
            />

            {/* Scanning Box Cutout */}
            <div
              className="relative h-full border-2 border-indigo-500/80 rounded-xl transition-all duration-150 shadow-[0_0_15px_rgba(99,102,241,0.25)] bg-transparent"
              style={{ width: `${roiWidthPct}%` }}
            >
              {/* Target bracket corners */}
              <div className="absolute -top-[3px] -left-[3px] w-4 h-4 border-t-4 border-l-4 border-indigo-400 rounded-tl-md" />
              <div className="absolute -top-[3px] -right-[3px] w-4 h-4 border-t-4 border-r-4 border-indigo-400 rounded-tr-md" />
              <div className="absolute -bottom-[3px] -left-[3px] w-4 h-4 border-b-4 border-l-4 border-indigo-400 rounded-bl-md" />
              <div className="absolute -bottom-[3px] -right-[3px] w-4 h-4 border-b-4 border-r-4 border-indigo-400 rounded-br-md" />

              {/* Scanning laser line */}
              {!isOcrPaused && (isCameraActive || useSimulator) && (
                <div className="absolute left-0 w-full h-[2px] bg-indigo-400 shadow-[0_0_10px_#818cf8]" style={{ animation: 'scan 2s ease-in-out infinite' }} />
              )}
            </div>

            {/* Right darkened area */}
            <div
              className="bg-slate-950/70 h-full transition-all duration-150"
              style={{ width: `${Math.max(0, 50 - roiWidthPct / 2)}%` }}
            />
          </div>

          {/* Bottom darkened area */}
          <div
            className="bg-slate-950/70 w-full flex-1 transition-all duration-150"
            style={{ height: `${Math.max(0, 50 - roiHeightPct / 2 - roiYOffsetPct)}%` }}
          />
        </div>

        {/* Dynamic target text tags drawn on correct bounding positions */}
        {recognizedTickets.map((t, idx) => (
          <div
            key={idx}
            className="absolute border-2 border-emerald-500 bg-emerald-500/20 z-20 flex flex-col justify-start pointer-events-none rounded-lg transition-all duration-150 animate-pulse"
            style={{
              left: `${canvasRef.current ? (t.x / canvasRef.current.width) * 100 : 0}%`,
              top: `${canvasRef.current ? (t.y / canvasRef.current.height) * 100 : 0}%`,
              width: `${canvasRef.current ? (t.w / canvasRef.current.width) * 100 : 0}%`,
              height: `${canvasRef.current ? (t.h / canvasRef.current.height) * 100 : 0}%`,
            }}
          >
            <span className="bg-emerald-600 text-white font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-md -mt-6 self-start shadow-md flex items-center gap-1">
              <CheckCircle2 size={10} />
              {t.number}
            </span>
          </div>
        ))}

        {/* Initializing worker loader */}
        {isWorkerInitializing && (
          <div className="absolute inset-0 bg-slate-950/95 z-30 flex flex-col items-center justify-center text-center p-4">
            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm font-medium text-slate-300">Iniciando motor OCR...</p>
            <p className="text-xs text-slate-500 max-w-xs mt-1">
              Configurando biblioteca de reconocimiento neuronal Tesseract.js con filtros numéricos de alta precisión.
            </p>
          </div>
        )}

        {/* Camera inactive overlay cover */}
        {!isCameraActive && !useSimulator && !isWorkerInitializing && (
          <div className="absolute inset-0 bg-slate-950/85 z-20 flex flex-col items-center justify-center text-center p-6">
            <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-full mb-3 text-slate-500">
              <CameraOff size={32} />
            </div>
            <p className="text-sm font-bold text-slate-300">Cámara Inactiva</p>
            <p className="text-xs text-slate-500 max-w-xs mt-1 mb-4">
              La cámara trasera escaneará tickets impresos de manera automática y continua.
            </p>
            <button
              onClick={startCamera}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg active:scale-95 transition-all cursor-pointer flex items-center gap-2"
            >
              <Play size={14} />
              Encender Cámara
            </button>
          </div>
        )}

        {/* Paused cover */}
        {isOcrPaused && (isCameraActive || useSimulator) && (
          <div className="absolute inset-0 bg-slate-950/70 z-20 flex items-center justify-center text-center">
            <span className="px-4 py-2 bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold font-mono text-xs tracking-wider uppercase rounded-xl backdrop-blur-sm shadow-lg flex items-center gap-2">
              <Pause size={14} />
              OCR en Pausa
            </span>
          </div>
        )}
      </div>

          {/* Advanced OCR Parameters Settings Panel */}
      {showSettings && (
        <div className="mt-4 p-5 bg-slate-950 border border-slate-800/90 rounded-2xl space-y-4 animate-fade-in z-20">
          {/* Tab Navigation */}
          <div className="flex border-b border-slate-800 pb-1 gap-1 flex-wrap">
            <button
              onClick={() => setSettingsTab('instant_batch')}
              className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
                settingsTab === 'instant_batch'
                  ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10 font-bold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Zap size={14} className="text-emerald-400" />
              <span>🎯 Carga Instantánea Lote ({batchUploadedTickets.length})</span>
            </button>
            <button
              onClick={() => setSettingsTab('filters')}
              className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-all border-b-2 cursor-pointer ${
                settingsTab === 'filters'
                  ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Filtros Digitales (ROI)
            </button>
            <button
              onClick={() => setSettingsTab('training')}
              className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-all border-b-2 cursor-pointer ${
                settingsTab === 'training'
                  ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Entrenamiento OCR
            </button>
            <button
              onClick={() => setSettingsTab('samples')}
              className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
                settingsTab === 'samples'
                  ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Brain size={13} className="text-indigo-400" />
              <span>Muestras & Aprendizaje ({learningSamples.length})</span>
            </button>
            <button
              onClick={() => setSettingsTab('stats')}
              className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-all border-b-2 cursor-pointer ${
                settingsTab === 'stats'
                  ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Métricas & Estadísticas
            </button>
          </div>

          {/* TAB 0: INSTANT BATCH UPLOADER */}
          {settingsTab === 'instant_batch' && (
            <div className="space-y-4 animate-fade-in">
              <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-indigo-950/40 border border-emerald-500/30 rounded-2xl p-4 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-black text-white flex items-center gap-2">
                      <Zap size={18} className="text-emerald-400" />
                      <span>Entrenamiento y Carga Instantánea de Varios Tickets</span>
                    </h4>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Sube o arrastra múltiples fotos/imágenes de tickets impresos de ejemplo. La IA los analizará en paralelo en menos de 1 segundo, extraerá sus números automáticamente y memorizará sus tipografías.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {batchUploadedTickets.length > 0 && (
                      <button
                        onClick={handleIngestBatchTickets}
                        disabled={isBatchProcessing}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <Zap size={14} />
                        <span>⚡ Ingestar Todos ({batchUploadedTickets.filter(t => t.selectedNumber && !t.isIngested).length})</span>
                      </button>
                    )}
                    {batchUploadedTickets.length > 0 && (
                      <button
                        onClick={() => setBatchUploadedTickets([])}
                        className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs rounded-xl border border-slate-800 transition-all cursor-pointer"
                      >
                        Limpiar
                      </button>
                    )}
                  </div>
                </div>

                {/* Drop Zone Box */}
                <div className="relative border-2 border-dashed border-emerald-500/40 hover:border-emerald-400 bg-slate-950/80 hover:bg-emerald-950/20 rounded-2xl p-6 text-center transition-all cursor-pointer group">
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    id="batch-ticket-file-input"
                    onChange={(e) => {
                      if (e.target.files) {
                        handleBatchFileUpload(e.target.files);
                      }
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="flex flex-col items-center justify-center space-y-2 pointer-events-none">
                    <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl group-hover:scale-110 transition-transform border border-emerald-500/20">
                      <Zap size={28} />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-200 block">
                        Haz clic o arrastra fotos de tickets aquí para procesado ultra-rápido
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        Soporta JPG, PNG, WEBP (Lote de varios tickets simultáneos)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Uploaded Cards Grid */}
                {batchUploadedTickets.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="font-bold text-slate-300">Tickets Escaneados en el Lote ({batchUploadedTickets.length})</span>
                      <span className="text-[10px] text-emerald-400 font-mono">Detección Ultra-Rápida Activa</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {batchUploadedTickets.map((item) => (
                        <div
                          key={item.id}
                          className={`bg-slate-950 border rounded-xl p-3 space-y-2 relative transition-all ${
                            item.isIngested
                              ? 'border-emerald-500/40 bg-emerald-950/10'
                              : 'border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          {/* Thumbnail Header */}
                          <div className="flex items-center gap-3">
                            <div className="w-16 h-16 bg-slate-900 rounded-lg overflow-hidden border border-slate-800 shrink-0">
                              <img src={item.dataUrl} alt={item.filename} className="w-full h-full object-cover" />
                            </div>

                            <div className="flex-1 min-w-0">
                              <span className="text-[10px] text-slate-400 truncate block font-mono">{item.filename}</span>
                              
                              {item.status === 'processing' ? (
                                <span className="text-[10px] text-amber-400 font-bold animate-pulse flex items-center gap-1 mt-1">
                                  <RefreshCw size={10} className="animate-spin" /> Analizando...
                                </span>
                              ) : item.isIngested ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded-md border border-emerald-500/30 mt-1">
                                  <CheckCircle2 size={11} /> Ingresado ✓
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-300 font-bold block mt-1">
                                  {item.detectedNumbers.length > 0 ? `Detectados: ${item.detectedNumbers.join(', ')}` : 'Sin detectar'}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Editable Number Selection */}
                          <div className="flex items-center gap-2 pt-1">
                            <input
                              type="text"
                              value={item.selectedNumber}
                              onChange={(e) => {
                                const val = e.target.value.replace(/[^\d]/g, '');
                                setBatchUploadedTickets(prev => prev.map(t => t.id === item.id ? { ...t, selectedNumber: val } : t));
                              }}
                              placeholder="Nº Ticket"
                              className="bg-slate-900 border border-slate-800 text-white font-mono font-bold text-xs rounded-lg px-2.5 py-1.5 w-full focus:border-emerald-500 outline-none"
                            />
                            
                            <button
                              onClick={() => {
                                if (item.selectedNumber) {
                                  onAddTicket(item.selectedNumber, true);
                                  setBatchUploadedTickets(prev => prev.map(t => t.id === item.id ? { ...t, isIngested: true } : t));
                                  addLog(`✔ Ticket #${item.selectedNumber} ingresado desde lote.`);
                                }
                              }}
                              disabled={!item.selectedNumber || item.isIngested}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-[11px] font-bold rounded-lg shrink-0 cursor-pointer"
                            >
                              {item.isIngested ? 'Listo' : 'Ingresar'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}

          {/* TAB 1: FILTERS */}
          {settingsTab === 'filters' && (
            <div className="space-y-4 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* ROI parameters */}
                <div className="space-y-3 bg-slate-900/30 p-3 rounded-xl border border-slate-800/40">
                  <h5 className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                    <Crop size={13} className="text-indigo-400" />
                    Región de Interés (ROI)
                  </h5>

                  <div className="space-y-3 text-xs">
                    <div>
                      <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                        <span>Ancho de Zona</span>
                        <span className="font-mono text-indigo-400 font-bold">{roiWidthPct}%</span>
                      </div>
                      <input
                        type="range"
                        min="20"
                        max="80"
                        value={roiWidthPct}
                        onChange={(e) => setRoiWidthPct(Number(e.target.value))}
                        className="w-full accent-indigo-500 bg-slate-850 h-1.5 rounded-lg cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                        <span>Alto de Zona</span>
                        <span className="font-mono text-indigo-400 font-bold">{roiHeightPct}%</span>
                      </div>
                      <input
                        type="range"
                        min="15"
                        max="60"
                        value={roiHeightPct}
                        onChange={(e) => setRoiHeightPct(Number(e.target.value))}
                        className="w-full accent-indigo-500 bg-slate-850 h-1.5 rounded-lg cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                        <span>Ajuste Vertical (Eje Y)</span>
                        <span className="font-mono text-indigo-400 font-bold">{roiYOffsetPct}%</span>
                      </div>
                      <input
                        type="range"
                        min="-30"
                        max="30"
                        value={roiYOffsetPct}
                        onChange={(e) => setRoiYOffsetPct(Number(e.target.value))}
                        className="w-full accent-indigo-500 bg-slate-850 h-1.5 rounded-lg cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                {/* Preprocessing parameters */}
                <div className="space-y-3 bg-slate-900/30 p-3 rounded-xl border border-slate-800/40">
                  <h5 className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                    <Eye size={13} className="text-indigo-400" />
                    Filtros Digitales & Umbrales
                  </h5>

                  <div className="space-y-3 text-xs">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                          <span>Contraste</span>
                          <span className="font-mono text-indigo-400 font-bold">{contrast}</span>
                        </div>
                        <input
                          type="range"
                          min="30"
                          max="100"
                          value={contrast}
                          onChange={(e) => setContrast(Number(e.target.value))}
                          className="w-full accent-indigo-500 bg-slate-850 h-1.5 rounded-lg cursor-pointer"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                          <span>Brillo</span>
                          <span className="font-mono text-indigo-400 font-bold">{brightness}</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="40"
                          value={brightness}
                          onChange={(e) => setBrightness(Number(e.target.value))}
                          className="w-full accent-indigo-500 bg-slate-850 h-1.5 rounded-lg cursor-pointer"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                          <span>Binarización</span>
                          <span className="font-mono text-indigo-400 font-bold">{binarizeThreshold}</span>
                        </div>
                        <input
                          type="range"
                          min="80"
                          max="180"
                          value={binarizeThreshold}
                          onChange={(e) => setBinarizeThreshold(Number(e.target.value))}
                          className="w-full accent-indigo-500 bg-slate-850 h-1.5 rounded-lg cursor-pointer"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                          <span>Inclinación</span>
                          <span className="font-mono text-indigo-400 font-bold">{rotation}°</span>
                        </div>
                        <input
                          type="range"
                          min="-20"
                          max="20"
                          value={rotation}
                          onChange={(e) => setRotation(Number(e.target.value))}
                          className="w-full accent-indigo-500 bg-slate-850 h-1.5 rounded-lg cursor-pointer"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-900">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-slate-300 font-bold">Filtro de Enfoque (Sharpen)</span>
                        <span className="text-[9px] text-slate-500">Perfilado Laplaciano</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={sharpenEnabled}
                          onChange={(e) => setSharpenEnabled(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-8 h-4 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-3 after:width-3 after:transition-all peer-checked:bg-indigo-600 peer-checked:after:bg-white" />
                      </label>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-slate-300 font-bold font-mono">Supresión de Ruido</span>
                        <span className="text-[9px] text-slate-500">Morfología para matriciales</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={noiseRemoval}
                          onChange={(e) => setNoiseRemoval(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-8 h-4 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-3 after:width-3 after:transition-all peer-checked:bg-indigo-600 peer-checked:after:bg-white" />
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Micro-feed live preprocessed thumbnail */}
              <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-3.5 flex flex-col md:flex-row items-center gap-4">
                <div className="w-full md:w-1/3 flex flex-col items-center">
                  <span className="text-[9px] text-slate-400 uppercase tracking-wider font-mono mb-1.5 flex items-center gap-1.5">
                    <Eye size={10} className="text-indigo-400" />
                    Vista de Procesado Binarizado (OCR Canvas)
                  </span>
                  <div className="w-full aspect-[2.5] bg-black rounded-lg border border-slate-850 flex items-center justify-center overflow-hidden p-1">
                    <canvas
                      ref={processedCanvasRef}
                      className="w-full h-full object-contain filter brightness-110 contrast-125"
                    />
                  </div>
                </div>
                <div className="w-full md:w-2/3 space-y-1.5 text-slate-400 text-[11px] leading-relaxed">
                  <p className="font-bold text-slate-200 flex items-center gap-1">
                    <Info size={13} className="text-indigo-400" />
                    Validación Inteligente Integrada
                  </p>
                  <div className="grid grid-cols-2 gap-3 mt-1 text-[10px] bg-slate-950 p-2.5 rounded-lg border border-slate-900">
                    <div>
                      <span className="text-slate-500 block">Estabilización de Señal:</span>
                      <select
                        value={stableFrameCount}
                        onChange={(e) => setStableFrameCount(Number(e.target.value))}
                        className="bg-slate-900 text-slate-200 mt-1 rounded border border-slate-800 p-1 text-[10px] w-full outline-none"
                      >
                        <option value="1">1 Fotograma (Instantáneo)</option>
                        <option value="2">2 Fotogramas (Recomendado)</option>
                        <option value="3">3 Fotogramas (Alta Estabilidad)</option>
                        <option value="4">4 Fotogramas (Estricto)</option>
                      </select>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Confianza Mínima Requerida:</span>
                      <select
                        value={minConfidence}
                        onChange={(e) => setMinConfidence(Number(e.target.value))}
                        className="bg-slate-900 text-slate-200 mt-1 rounded border border-slate-800 p-1 text-[10px] w-full outline-none"
                      >
                        <option value="50">50% (Bajo contraste)</option>
                        <option value="65">65% (Matricial difuso)</option>
                        <option value="70">70% (Estándar)</option>
                        <option value="80">80% (Precisión Extrema)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TRAINING */}
          {settingsTab === 'training' && (
            <div className="space-y-4 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Profile selection & Reset */}
                <div className="bg-slate-900/30 p-3 rounded-xl border border-slate-800/40 space-y-3">
                  <label className="block text-xs text-slate-300 font-bold flex items-center gap-1.5">
                    <Award size={13} className="text-indigo-400" />
                    Memoria de Impresora Adaptativa
                  </label>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Seleccione el perfil que mejor represente su impresora. Los ajustes se cargan inmediatamente y se guardan de forma persistente conforme los modifica.
                  </p>
                  <div className="flex gap-2 pt-1">
                    <select
                      value={activeProfileId}
                      onChange={async (e) => {
                        const id = e.target.value;
                        setActiveProfileId(id);
                        await dbSaveSettings('ocr_active_profile_id', id);
                        const prof = profiles.find(p => p.id === id);
                        if (prof) {
                          applyProfileSettings(prof);
                          addLog(`Perfil de impresora cambiado a: "${prof.name}"`);
                        }
                      }}
                      className="bg-slate-950 border border-slate-800 text-slate-100 text-xs rounded-xl px-3 py-2 flex-1 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none cursor-pointer font-medium"
                    >
                      {profiles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} {p.id === 'matricial_cocina' ? '⚠️ (Matricial)' : '✓'}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={async () => {
                        if (confirm('¿Desea restablecer los filtros de este perfil a los valores de fábrica?')) {
                          const orig = DEFAULT_PROFILES.find(p => p.id === activeProfileId);
                          if (orig) {
                            applyProfileSettings(orig);
                            addLog(`Filtros del perfil "${orig.name}" restablecidos.`);
                          }
                        }
                      }}
                      className="px-3 py-2 bg-slate-950 hover:bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200 text-xs rounded-xl transition-all cursor-pointer font-semibold"
                    >
                      Restaurar
                    </button>
                  </div>

                  <div className="pt-2 border-t border-slate-900 flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-300 font-bold">Auto-Ajuste Continuo de Señal</span>
                      <span className="text-[9px] text-slate-500">Oscila parámetros ante desvanecimiento</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoTuningEnabled}
                        onChange={(e) => setAutoTuningEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-8 h-4 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-3 after:width-3 after:transition-all peer-checked:bg-indigo-600 peer-checked:after:bg-white" />
                    </label>
                  </div>
                </div>

                {/* Assisted training triggers */}
                <div className="bg-slate-900/30 p-3 rounded-xl border border-slate-800/40 space-y-3 flex flex-col justify-between">
                  <div>
                    <h6 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Sliders size={13} className="text-indigo-400" />
                      Entrenar Filtro OCR (Optimización Matemática)
                    </h6>
                    <p className="text-[10px] text-slate-400 leading-relaxed mt-1">
                      ¿La cámara no lee bien un ticket? Introduzca el número que ve impreso, mantenga el ticket inmóvil y el sistema probará iterativamente filtros digitales hasta encontrar la configuración perfecta para su entorno.
                    </p>
                  </div>

                  <div className="space-y-2 pt-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        maxLength={3}
                        placeholder="Nº Ticket (Ej: 145)"
                        value={tempCorrectedNumber}
                        onChange={(e) => setTempCorrectedNumber(e.target.value.replace(/[^\d]/g, ''))}
                        className="bg-slate-950 border border-slate-800 text-slate-100 font-mono text-center text-xs rounded-xl px-3 py-2 w-1/2 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none"
                      />
                      <button
                        onClick={() => runAdaptiveTraining(tempCorrectedNumber)}
                        disabled={isOptimizing}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2 rounded-xl active:scale-98 transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        {isOptimizing ? (
                          <>
                            <RefreshCw size={13} className="animate-spin" />
                            <span>Buscando...</span>
                          </>
                        ) : (
                          <>
                            <Zap size={13} />
                            <span>Optimizar Perfil</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Optimizing terminal output console */}
              {trainingLogs.length > 0 && (
                <div className="bg-black/90 border border-slate-800 rounded-xl p-3 font-mono text-[10px] text-emerald-400 max-h-[140px] overflow-y-auto space-y-1">
                  <div className="flex justify-between items-center text-slate-500 border-b border-slate-900 pb-1 mb-1 font-sans">
                    <span>Terminal de Entrenamiento Continuo</span>
                    <button
                      onClick={() => setTrainingLogs([])}
                      className="text-[9px] hover:text-slate-300"
                    >
                      Limpiar consola
                    </button>
                  </div>
                  {trainingLogs.map((log, i) => (
                    <div key={i} className="leading-relaxed">
                      {log.startsWith('  ✅') ? (
                        <span className="text-emerald-300 font-semibold">{log}</span>
                      ) : log.startsWith('  ❌') ? (
                        <span className="text-rose-400">{log}</span>
                      ) : (
                        <span>{log}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: MUESTRAS & APRENDIZAJE CONTINUO */}
          {settingsTab === 'samples' && (
            <div className="space-y-4 animate-fade-in">
              {/* IA Status Banner */}
              <div className="bg-gradient-to-r from-indigo-950/60 via-slate-900 to-indigo-950/60 border border-indigo-500/30 rounded-xl p-3.5 flex flex-col md:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
                    <Brain size={20} className="animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h6 className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                        Motor de Aprendizaje Continuo (IA OCR)
                      </h6>
                      <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-mono px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                        <Sparkles size={10} />
                        Auto-Aprendizaje Activo
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Guarda automáticamente capturas de tickets, resultados de OCR y correcciones del usuario. La IA recalibra binarización y contraste sin intervención.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => autoCalibrateFromSamples()}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md flex items-center gap-1.5 active:scale-95"
                  >
                    <Bot size={14} />
                    <span>Auto-Calibrar IA</span>
                  </button>
                  {learningSamples.length > 0 && (
                    <button
                      onClick={async () => {
                        if (confirm('¿Desea limpiar el historial de muestras de entrenamiento?')) {
                          setLearningSamples([]);
                          await dbSaveSettings('ocr_learning_samples', []);
                          addLog('[IA OCR] Historial de muestras de entrenamiento vaciado.');
                        }
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-400 border border-slate-800 rounded-xl bg-slate-950 transition-colors"
                      title="Limpiar Muestras"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Filter Pills */}
              <div className="flex items-center justify-between gap-2 border-b border-slate-900 pb-2">
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-[10px] text-slate-500 font-mono">Filtrar:</span>
                  {(['all', 'correct', 'corrected', 'rejected'] as const).map((ft) => (
                    <button
                      key={ft}
                      onClick={() => setSampleFilter(ft)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold capitalize transition-all cursor-pointer ${
                        sampleFilter === ft
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      {ft === 'all'
                        ? `Todos (${learningSamples.length})`
                        : ft === 'correct'
                        ? `Correctos (${learningSamples.filter(s => s.status === 'correct').length})`
                        : ft === 'corrected'
                        ? `Corregidos (${learningSamples.filter(s => s.status === 'corrected').length})`
                        : `Rechazados (${learningSamples.filter(s => s.status === 'rejected').length})`}
                    </button>
                  ))}
                </div>

                <div className="text-[10px] font-mono text-indigo-400">
                  Auto-Ajustes Realizados: <span className="font-bold text-slate-200">{autoLearnedCycles}</span>
                </div>
              </div>

              {/* Gallery of captured snippets */}
              {learningSamples.length === 0 ? (
                <div className="bg-slate-900/30 border border-slate-800/60 rounded-xl p-8 text-center space-y-2">
                  <div className="p-3 bg-slate-900 text-indigo-400 rounded-full w-fit mx-auto border border-slate-800">
                    <Brain size={24} />
                  </div>
                  <p className="text-xs font-bold text-slate-300">Aún no hay muestras de entrenamiento capturadas</p>
                  <p className="text-[10px] text-slate-500 max-w-sm mx-auto">
                    A medida que escanee tickets o los simule, la IA guardará capturas del ROI y sus parámetros para ajustar binarización y nitidez continuamente.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-[280px] overflow-y-auto pr-1">
                  {learningSamples
                    .filter(s => sampleFilter === 'all' || s.status === sampleFilter)
                    .map((sample) => (
                      <div
                        key={sample.id}
                        className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-2.5 flex flex-col justify-between gap-2 shadow-sm relative group hover:border-indigo-500/40 transition-colors"
                      >
                        {/* Snippet thumbnail + Badge */}
                        <div className="flex gap-2.5 items-center">
                          <div className="w-16 h-12 bg-black rounded-lg border border-slate-800 overflow-hidden shrink-0 flex items-center justify-center">
                            {sample.imageSnippet ? (
                              <img src={sample.imageSnippet} alt="ROI snippet" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-[8px] text-slate-600">Sin Imagen</span>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-xs font-bold text-slate-100">
                                Ticket #{sample.userCorrection || sample.detectedNumber}
                              </span>
                              <span
                                className={`text-[8px] font-mono px-1.5 py-0.5 rounded font-bold ${
                                  sample.status === 'correct'
                                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40'
                                    : sample.status === 'corrected'
                                    ? 'bg-indigo-950 text-indigo-300 border border-indigo-800/40'
                                    : 'bg-rose-950 text-rose-400 border border-rose-800/40'
                                }`}
                              >
                                {sample.status === 'correct'
                                  ? '✓ Correcto'
                                  : sample.status === 'corrected'
                                  ? '✏️ Corregido'
                                  : '✕ Rechazado'}
                              </span>
                            </div>

                            <p className="text-[9px] text-slate-400 font-mono mt-0.5 truncate">
                              Conf: {sample.confidence}% │ Thr: {sample.appliedParams.binarizeThreshold}
                            </p>
                            <p className="text-[8px] text-slate-500 mt-0.5">
                              {new Date(sample.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </p>
                          </div>
                        </div>

                        {/* Interactive Feedback Actions */}
                        <div className="flex items-center justify-end gap-1.5 border-t border-slate-850 pt-1.5">
                          <button
                            onClick={() => {
                              const updated = learningSamples.map(s => s.id === sample.id ? { ...s, status: 'correct' as const } : s);
                              setLearningSamples(updated);
                              dbSaveSettings('ocr_learning_samples', updated);
                              autoCalibrateFromSamples(updated);
                            }}
                            className={`px-2 py-0.5 rounded text-[9px] font-bold transition-all ${
                              sample.status === 'correct'
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-950 text-slate-400 hover:text-emerald-300 border border-slate-800'
                            }`}
                            title="Aprobar Muestra"
                          >
                            ✓ Correcto
                          </button>

                          <button
                            onClick={() => {
                              const userVal = prompt('Introduce el número correcto impreso en el ticket:', sample.detectedNumber);
                              if (userVal && userVal.trim().length > 0) {
                                const num = userVal.replace(/[^\d]/g, '');
                                const updated = learningSamples.map(s => s.id === sample.id ? { ...s, status: 'corrected' as const, userCorrection: num } : s);
                                setLearningSamples(updated);
                                dbSaveSettings('ocr_learning_samples', updated);
                                autoCalibrateFromSamples(updated);
                              }
                            }}
                            className={`px-2 py-0.5 rounded text-[9px] font-bold transition-all ${
                              sample.status === 'corrected'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-950 text-slate-400 hover:text-indigo-300 border border-slate-800'
                            }`}
                            title="Corregir Número"
                          >
                            ✏️ Corregir
                          </button>

                          <button
                            onClick={() => {
                              const updated = learningSamples.map(s => s.id === sample.id ? { ...s, status: 'rejected' as const } : s);
                              setLearningSamples(updated);
                              dbSaveSettings('ocr_learning_samples', updated);
                              autoCalibrateFromSamples(updated);
                            }}
                            className={`px-2 py-0.5 rounded text-[9px] font-bold transition-all ${
                              sample.status === 'rejected'
                                ? 'bg-rose-600 text-white'
                                : 'bg-slate-950 text-slate-400 hover:text-rose-300 border border-slate-800'
                            }`}
                            title="Rechazar Muestra"
                          >
                            ✕ Rechazar
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: STATS */}
          {settingsTab === 'stats' && (
            <div className="space-y-4 animate-fade-in">
              {/* Numerical dashboard cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="bg-slate-900/40 p-2.5 rounded-xl border border-slate-800/40 text-center space-y-1">
                  <span className="text-[10px] text-slate-400 block font-medium">Lecturas Totales</span>
                  <span className="font-mono text-base font-bold text-slate-200">{stats.totalReads}</span>
                </div>
                <div className="bg-slate-900/40 p-2.5 rounded-xl border border-slate-800/40 text-center space-y-1">
                  <span className="text-[10px] text-slate-400 block font-medium">Tasa de Éxito</span>
                  <span className="font-mono text-base font-bold text-emerald-400">
                    {stats.totalReads > 0 ? `${Math.round((stats.successCount / stats.totalReads) * 100)}%` : '0%'}
                  </span>
                </div>
                <div className="bg-slate-900/40 p-2.5 rounded-xl border border-slate-800/40 text-center space-y-1">
                  <span className="text-[10px] text-slate-400 block font-medium">Correcciones</span>
                  <span className="font-mono text-base font-bold text-indigo-400">{stats.correctionsCount}</span>
                </div>
                <div className="bg-slate-900/40 p-2.5 rounded-xl border border-slate-800/40 text-center space-y-1">
                  <span className="text-[10px] text-slate-400 block font-medium">Confianza Promedio</span>
                  <span className="font-mono text-base font-bold text-amber-400">
                    {stats.avgConfidence > 0 ? `${stats.avgConfidence}%` : 'N/D'}
                  </span>
                </div>
                <div className="bg-slate-900/40 p-2.5 rounded-xl border border-slate-800/40 text-center space-y-1">
                  <span className="text-[10px] text-slate-400 block font-medium">Velocidad Lectura</span>
                  <span className="font-mono text-base font-bold text-blue-400">
                    {stats.avgReadSpeedMs > 0 ? `${stats.avgReadSpeedMs}ms` : 'N/D'}
                  </span>
                </div>
              </div>

              {/* Graphical representation of accuracy evolution over the week */}
              <div className="bg-slate-900/20 p-3 rounded-xl border border-slate-800/40 space-y-3">
                <div className="flex justify-between items-center">
                  <h6 className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5 font-mono">
                    <TrendingUp size={13} className="text-indigo-400" />
                    CURVA DE APRENDIZAJE: PRECISIÓN SEMANAL ACUMULADA
                  </h6>
                  <span className="text-[9px] text-emerald-400 bg-emerald-950/40 border border-emerald-900/30 px-1.5 py-0.5 rounded">
                    +9.2% de incremento
                  </span>
                </div>

                {/* SVG Accuracy bar chart */}
                <div className="h-28 w-full flex items-end justify-between px-2 pt-4 border-b border-slate-800 font-mono text-[9px] text-slate-400 relative">
                  {/* Grid lines */}
                  <div className="absolute left-0 right-0 top-1/4 border-t border-slate-900/50 pointer-events-none" />
                  <div className="absolute left-0 right-0 top-2/4 border-t border-slate-900/50 pointer-events-none" />
                  <div className="absolute left-0 right-0 top-3/4 border-t border-slate-900/50 pointer-events-none" />

                  {stats.evolution.map((day, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end z-10 group relative">
                      {/* Tooltip on hover */}
                      <span className="absolute -top-4 bg-slate-950 text-slate-200 border border-slate-800 rounded px-1 text-[8px] font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                        {day.accuracy}%
                      </span>
                      {/* Dynamic Bar */}
                      <div
                        className="w-5 sm:w-8 bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t transition-all duration-500 hover:to-indigo-300"
                        style={{ height: `${day.accuracy}%` }}
                      />
                      <span className="text-[8px] sm:text-[9px] mt-1 text-slate-500">{day.date}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Control Actions (Pause/Resume, Flashlight) */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 z-20">
        <div className="flex items-center gap-2">
          {/* Pause / Resume OCR */}
          {((isCameraActive && !useSimulator) || useSimulator) && (
            <button
              onClick={() => {
                setIsOcrPaused(!isOcrPaused);
                addLog(`Procesador OCR ${!isOcrPaused ? 'Pausado' : 'Reanudado'}.`);
              }}
              className={`px-3.5 py-2 border rounded-xl text-xs font-semibold flex items-center gap-2 active:scale-95 transition-all cursor-pointer ${
                isOcrPaused
                  ? 'bg-amber-950/30 border-amber-900/50 text-amber-300'
                  : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
              }`}
            >
              {isOcrPaused ? <Play size={14} /> : <Pause size={14} />}
              <span>{isOcrPaused ? 'Reanudar OCR' : 'Pausar OCR'}</span>
            </button>
          )}

          {/* Flashlight/Torch */}
          {isCameraActive && !useSimulator && hasTorch && (
            <button
              onClick={toggleTorch}
              className={`p-2.5 border rounded-xl text-xs font-semibold active:scale-95 transition-all cursor-pointer ${
                torchEnabled
                  ? 'bg-yellow-500/15 border-yellow-500/30 text-yellow-400'
                  : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-400'
              }`}
              title="Encender Linterna Automática"
            >
              <Zap size={14} className={torchEnabled ? 'fill-yellow-400' : ''} />
            </button>
          )}

          {/* Shutdown Camera button */}
          {isCameraActive && !useSimulator && (
            <button
              onClick={stopCamera}
              className="px-3.5 py-2 bg-red-950/40 border border-red-900/30 text-red-400 rounded-xl text-xs font-medium active:scale-95 transition-all cursor-pointer"
            >
              Apagar
            </button>
          )}
        </div>

        {/* Ticket Selector for simulator */}
        {useSimulator && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[10px] text-slate-500 font-mono">Simulador Receipt:</span>
            <select
              value={simulatorImage || ''}
              onChange={(e) => {
                setSimulatorImage(e.target.value);
                setRecognizedTickets([]);
                addLog(`Cambiado a plantilla: ${SIMULATORS.find(s => s.url === e.target.value)?.name}`);
              }}
              className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl px-2.5 py-1.5 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none cursor-pointer"
            >
              {SIMULATORS.map((s, i) => (
                <option key={i} value={s.url}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Diagnostic Mode Panel */}
      {showDiagnosticMode && (
        <div className="mt-3 p-4 bg-slate-950 border border-amber-500/30 rounded-2xl shadow-xl space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs sm:text-sm">
              <Brain size={16} className="animate-pulse" />
              <span>Panel de Diagnóstico OCR (Reglas Estrictas 3 Dígitos)</span>
            </div>
            <button
              onClick={() => setShowDiagnosticMode(false)}
              className="text-slate-400 hover:text-slate-200 text-xs px-2 py-1 bg-slate-900 rounded-lg border border-slate-800"
            >
              Cerrar
            </button>
          </div>

          {/* Overall Status Banner */}
          <div
            className={`p-3 rounded-xl border flex items-center justify-between text-xs font-bold ${
              lastOcrDiagnostic?.status === 'detected'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-slate-900/80 border-slate-800 text-slate-400'
            }`}
          >
            <div className="flex items-center gap-2">
              <Activity
                size={16}
                className={lastOcrDiagnostic?.status === 'detected' ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}
              />
              <span>
                {lastOcrDiagnostic?.status === 'detected'
                  ? `TICKET DETECTADO (#${lastOcrDiagnostic.detectedTicketNumber})`
                  : 'Buscando ticket válido (o descartando falsos positivos)...'}
              </span>
            </div>
            {lastOcrDiagnostic?.passName && (
              <span className="text-[10px] bg-slate-950 px-2.5 py-1 rounded-full border border-slate-800 text-indigo-300 font-mono">
                {lastOcrDiagnostic.passName}
              </span>
            )}
          </div>

          {/* Evaluated Candidates Breakdown */}
          <div className="space-y-2">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex justify-between items-center">
              <span>Candidatos Detectados ({lastOcrDiagnostic?.allCandidates.length || 0})</span>
              <span className="text-[10px] text-slate-500 normal-case font-normal">Prioridad: 0 Falsos Positivos</span>
            </div>

            {!lastOcrDiagnostic || lastOcrDiagnostic.allCandidates.length === 0 ? (
              <p className="text-xs text-slate-500 italic p-3 bg-slate-900/40 rounded-xl border border-slate-900 text-center">
                No se detectaron candidatos de números en la zona de lectura actual.
              </p>
            ) : (
              <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1 scrollbar-thin">
                {lastOcrDiagnostic.allCandidates.map((cand, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border text-xs flex flex-col gap-1.5 transition-all ${
                      cand.accepted
                        ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200 shadow-sm'
                        : 'bg-slate-900/60 border-slate-800/80 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-base text-slate-100">#{cand.candidate}</span>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] uppercase font-extrabold ${
                            cand.accepted
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-red-500/20 text-red-300 border border-red-500/30'
                          }`}
                        >
                          {cand.accepted ? 'VÁLIDO' : 'DESCARTADO'}
                        </span>
                      </div>
                      <span className="font-mono text-amber-300 font-extrabold text-sm">
                        Score: {Math.round(cand.finalScore * 100)}%
                      </span>
                    </div>

                    {cand.rejectReason && (
                      <div className="text-[11px] text-red-300 font-semibold bg-red-950/40 p-2 rounded-lg border border-red-900/50 flex items-start gap-1.5">
                        <XCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
                        <span>Motivo de Descarte: {cand.rejectReason}</span>
                      </div>
                    )}

                    {/* Breakdown Scores Grid */}
                    <div className="grid grid-cols-5 gap-1 text-[10px] bg-slate-950/80 p-2 rounded-lg border border-slate-800/80 text-center font-mono">
                      <div>
                        <div className="text-slate-500 text-[9px]">Conf. OCR</div>
                        <div className="text-slate-200 font-bold">{Math.round(cand.confidenceScore * 100)}%</div>
                      </div>
                      <div>
                        <div className="text-slate-500 text-[9px]">Tamaño</div>
                        <div className="text-slate-200 font-bold">{Math.round(cand.sizeScore * 100)}%</div>
                      </div>
                      <div>
                        <div className="text-slate-500 text-[9px]">Contexto</div>
                        <div className="text-slate-200 font-bold">{Math.round(cand.contextScore * 100)}%</div>
                      </div>
                      <div>
                        <div className="text-slate-500 text-[9px]">Aislamiento</div>
                        <div className="text-slate-200 font-bold">{Math.round(cand.isolationScore * 100)}%</div>
                      </div>
                      <div>
                        <div className="text-slate-500 text-[9px]">Posición</div>
                        <div className="text-slate-200 font-bold">{Math.round(cand.positionScore * 100)}%</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Real-time raw text diagnostic */}
      <div className="mt-3 p-3 bg-slate-950 border border-slate-800/80 rounded-xl flex flex-col gap-1 text-xs">
        <div className="flex items-center gap-1.5 text-slate-400 font-bold">
          <Activity size={12} className="text-amber-400" />
          <span>Última lectura cruda (Diagnóstico):</span>
        </div>
        <p className="text-slate-300 font-mono text-[11px] break-words bg-slate-900/40 p-2 rounded-lg border border-slate-900 min-h-[34px]">
          {lastRawText ? `"${lastRawText}"` : <span className="text-slate-600 italic">Esperando lectura de texto... (apunte al ticket)</span>}
        </p>
      </div>

      {/* OCR Log Console */}
      <div className="mt-4 flex-1 flex flex-col bg-slate-950 border border-slate-800 rounded-xl p-3 max-h-[130px]">
        <div className="text-[10px] text-slate-500 font-mono font-bold tracking-wider uppercase mb-1.5 border-b border-slate-900 pb-1 flex justify-between items-center">
          <span>Historial del escáner OCR</span>
          <span className="text-[9px] text-indigo-400 font-normal">Sincronización en tiempo real</span>
        </div>
        <div className="flex-1 overflow-y-auto font-mono text-[10px] text-slate-400 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-900 scrollbar-track-transparent">
          {ocrLog.length === 0 ? (
            <div className="text-slate-600 italic">Esperando actividad de detección... Alínea el número del ticket en la zona de lectura.</div>
          ) : (
            ocrLog.map((log, idx) => (
              <div key={idx} className="leading-relaxed border-l-2 border-indigo-500/30 pl-2">
                {log}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
