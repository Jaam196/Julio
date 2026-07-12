import React, { useRef, useState, useEffect } from 'react';
import { Camera, CameraOff, Play, Pause, RefreshCw, Zap, Sliders, CheckCircle2 } from 'lucide-react';
import { createWorker } from 'tesseract.js';

interface CameraOCRProps {
  onAddTicket: (num: string) => void;
  existingTicketNumbers: Set<string>;
  maxTicketsSimultaneous: number;
  isOcrPausedProps?: boolean;
  onToggleOcrPauseProps?: (newValue: boolean) => void;
}

export default function CameraOCR({
  onAddTicket,
  existingTicketNumbers,
  maxTicketsSimultaneous,
  isOcrPausedProps,
  onToggleOcrPauseProps,
}: CameraOCRProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
  const [ocrLog, setOcrLog] = useState<string[]>([]);
  const [isWorkerInitializing, setIsWorkerInitializing] = useState(false);
  const [worker, setWorker] = useState<any>(null);

  // For testing/mocking in preview environments without real webcams or physical tickets
  const [useSimulator, setUseSimulator] = useState(false);
  const [simulatorImage, setSimulatorImage] = useState<string | null>(null);

  // Initialize Tesseract Worker
  useEffect(() => {
    async function initTesseract() {
      setIsWorkerInitializing(true);
      try {
        const tesseractWorker = await createWorker('spa'); // Spanish language package
        setWorker(tesseractWorker);
        addLog('Tesseract OCR cargado correctamente.');
      } catch (err) {
        console.error('Tesseract load error:', err);
        addLog('Error al cargar Tesseract.js localmente.');
      } finally {
        setIsWorkerInitializing(false);
      }
    }
    initTesseract();

    return () => {
      if (worker) {
        worker.terminate();
      }
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
        videoRef.current.play();
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

  // Process video frames or simulator images periodically for OCR
  useEffect(() => {
    let ocrInterval: NodeJS.Timeout;

    if ((isCameraActive || useSimulator) && !isOcrPaused && worker) {
      ocrInterval = setInterval(async () => {
        await runOcrOnFrame();
      }, 1500); // OCR scanning frequency (every 1.5s)
    }

    return () => {
      if (ocrInterval) clearInterval(ocrInterval);
    };
  }, [isCameraActive, useSimulator, isOcrPaused, worker, existingTicketNumbers, maxTicketsSimultaneous]);

  // Main OCR parsing function
  const runOcrOnFrame = async () => {
    if (!worker) return;

    let imageSrc: CanvasImageSource | null = null;
    let width = 0;
    let height = 0;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (useSimulator) {
      // Draw simulated receipt onto canvas
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

    // Adjust canvas size
    canvas.width = width;
    canvas.height = height;

    // Draw the image frame
    ctx.drawImage(imageSrc, 0, 0, width, height);

    // Grab image data from canvas and send to Tesseract
    try {
      const result = await worker.recognize(canvas);
      const text = result.data.text;
      const words = result.data.words || [];

      // Filter and identify potential ticket numbers
      // A ticket is a 1-3 digit standalone integer, we ignore:
      // - Dates (p.ej. 24/12/2026, 2026-07-11)
      // - Prices (p.ej. 14.50, 5,99)
      // - Long chains (VAT, CIF, phone numbers, addresses, decimals, ZIP codes)
      const detected: { number: string; x: number; y: number; w: number; h: number }[] = [];

      // Regex to ignore dates, decimals/currency, long numbers (4+ digits), phone format
      const hasDecimalsOrDashes = /[\.\-\/]/;
      
      words.forEach((word: any) => {
        const cleanWord = word.text.trim().replace(/[^\d]/g, ''); // Extract digits
        
        // Let's filter strictly:
        // Must be exactly 1 to 3 digits long
        if (cleanWord.length >= 1 && cleanWord.length <= 3) {
          // Verify it's not part of a decimal, date, or phone in the raw word
          if (!hasDecimalsOrDashes.test(word.text) && !word.text.includes('$') && !word.text.toLowerCase().includes('eur')) {
            const numVal = parseInt(cleanWord, 10);
            if (!isNaN(numVal) && numVal > 0) {
              // Get word bounding box
              const { x0, y0, x1, y1 } = word.bbox || { x0: 0, y0: 0, x1: 0, y1: 0 };
              detected.push({
                number: String(numVal),
                x: x0,
                y: y0,
                w: x1 - x0,
                h: y1 - y0,
              });
            }
          }
        }
      });

      // Filter to maximum simultaneous specified (up to 3)
      // Sort detected areas by bbox size to prioritize the biggest printed text
      detected.sort((a, b) => (b.w * b.h) - (a.w * a.h));
      const filteredDetected = detected.slice(0, maxTicketsSimultaneous);

      setRecognizedTickets(filteredDetected);

      // Add to queue if not duplicate
      let addedAny = false;
      filteredDetected.forEach((item) => {
        if (!existingTicketNumbers.has(item.number)) {
          onAddTicket(item.number);
          addLog(`Ticket #${item.number} detectado y añadido automáticamente.`);
          addedAny = true;
        }
      });

      if (filteredDetected.length > 0 && !addedAny) {
        // No new ones added, but we saw them
        addLog(`Ignorando duplicados detectados: ${filteredDetected.map(i => `#${i.number}`).join(', ')}`);
      }
    } catch (err) {
      console.warn('OCR processing failed on frame:', err);
    }
  };

  // Preset Simulated Receipts (SVG data-urls or canvas drawings) for OCR testing
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
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col h-full relative overflow-hidden">
      
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
            <Camera size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-slate-100 text-lg">Cámara OCR</h3>
            <p className="text-xs text-slate-400">Escaneo inteligente en tiempo real.</p>
          </div>
        </div>

        {/* Toggle between webcam and simulator */}
        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 self-start sm:self-auto">
          <button
            onClick={() => {
              setUseSimulator(false);
              if (isCameraActive) stopCamera();
              setTimeout(() => startCamera(), 100);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              !useSimulator ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Camera size={14} />
            Cámara
          </button>
          <button
            onClick={() => {
              setUseSimulator(true);
              if (isCameraActive) stopCamera();
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              useSimulator ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders size={14} />
            Simulador
          </button>
        </div>
      </div>

      {/* Main interactive viewport container */}
      <div className="relative aspect-video sm:aspect-[1.5] w-full bg-slate-950 rounded-xl overflow-hidden border border-slate-800/80 flex items-center justify-center">
        {/* Hidden video stream element */}
        {!useSimulator && (
          <video
            ref={videoRef}
            playsInline
            muted
            className={`w-full h-full object-cover ${isCameraActive ? 'block' : 'hidden'}`}
          />
        )}

        {/* Hidden Simulator Image Target */}
        {useSimulator && simulatorImage && (
          <img
            id="simulator-image"
            src={simulatorImage}
            alt="Ticket Simulator Source"
            crossOrigin="anonymous"
            className="max-h-full object-contain pointer-events-none"
          />
        )}

        {/* Real-time OCR overlay canvas */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-contain pointer-events-none z-10 opacity-60"
        />

        {/* Green Box bounding boxes and labels overlays */}
        {recognizedTickets.map((t, idx) => (
          <div
            key={idx}
            className="absolute border-2 border-emerald-500 bg-emerald-500/10 z-20 flex flex-col justify-start pointer-events-none rounded-sm transition-all duration-150 animate-pulse"
            style={{
              // Compute percentages relative to canvas viewport for absolute responsive rendering
              left: `${canvasRef.current ? (t.x / canvasRef.current.width) * 100 : 0}%`,
              top: `${canvasRef.current ? (t.y / canvasRef.current.height) * 100 : 0}%`,
              width: `${canvasRef.current ? (t.w / canvasRef.current.width) * 100 : 0}%`,
              height: `${canvasRef.current ? (t.h / canvasRef.current.height) * 100 : 0}%`,
            }}
          >
            <span className="bg-emerald-600 text-white font-mono text-[9px] font-bold px-1 py-0.5 rounded-sm -mt-5 self-start shadow-md flex items-center gap-1">
              <CheckCircle2 size={10} />
              {t.number}
            </span>
          </div>
        ))}

        {/* Loading / Disabled covers */}
        {isWorkerInitializing && (
          <div className="absolute inset-0 bg-slate-950/90 z-30 flex flex-col items-center justify-center text-center p-4">
            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-sm font-medium text-slate-300">Iniciando motor OCR...</p>
            <p className="text-xs text-slate-500 max-w-xs mt-1">Cargando biblioteca de redes neuronales Tesseract.js para procesar texto de imágenes offline.</p>
          </div>
        )}

        {!isCameraActive && !useSimulator && !isWorkerInitializing && (
          <div className="absolute inset-0 bg-slate-950/80 z-20 flex flex-col items-center justify-center text-center p-6">
            <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-full mb-3 text-slate-500">
              <CameraOff size={32} />
            </div>
            <p className="text-sm font-bold text-slate-300">Cámara Inactiva</p>
            <p className="text-xs text-slate-500 max-w-xs mt-1 mb-4">La cámara trasera escaneará tickets automáticamente en tiempo real.</p>
            <button
              onClick={startCamera}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg active:scale-95 transition-all cursor-pointer flex items-center gap-2"
            >
              <Play size={14} />
              Encender Cámara
            </button>
          </div>
        )}

        {isOcrPaused && (
          <div className="absolute inset-0 bg-slate-950/65 z-20 flex items-center justify-center text-center">
            <span className="px-4 py-2 bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold font-mono text-sm tracking-wider uppercase rounded-xl backdrop-blur-sm shadow-lg flex items-center gap-2">
              <Pause size={16} />
              OCR en Pausa
            </span>
          </div>
        )}
      </div>

      {/* Control Actions (Pause/Resume, Flashlight, Presets) */}
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
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 font-mono">Selecciona Receipt:</span>
            <select
              value={simulatorImage || ''}
              onChange={(e) => {
                setSimulatorImage(e.target.value);
                setRecognizedTickets([]);
                addLog(`Cambiado a plantilla sim: ${SIMULATORS.find(s => s.url === e.target.value)?.name}`);
              }}
              className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl px-2.5 py-1.5 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none"
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

      {/* Real-time scanning activity logs */}
      <div className="mt-4 flex-1 flex flex-col bg-slate-950 border border-slate-800 rounded-xl p-3 max-h-[140px]">
        <div className="text-[10px] text-slate-500 font-mono font-bold tracking-wider uppercase mb-1.5 border-b border-slate-900 pb-1">
          Historial del escáner OCR
        </div>
        <div className="flex-1 overflow-y-auto font-mono text-[10px] text-slate-400 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-900 scrollbar-track-transparent">
          {ocrLog.length === 0 ? (
            <div className="text-slate-600 italic">Esperando actividad de detección...</div>
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
