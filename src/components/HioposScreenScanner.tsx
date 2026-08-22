import React, { useState, useEffect, useRef } from 'react';
import {
  Zap, Play, Square, RefreshCw, Crop, Eye, Settings2, CheckCircle2,
  AlertTriangle, AlertCircle, Layers, Sparkles, Activity, Clock,
  ArrowRight, ShieldCheck, Cpu, Image as ImageIcon, Volume2, Info,
  Sliders, Maximize2
} from 'lucide-react';
import {
  hioposReader,
  HioposRoiConfig,
  HIOPOS_ROI_PRESETS,
  DEFAULT_HIOPOS_ROI,
  HioposScreenReaderStats,
  HioposScanLogEntry,
} from '../utils/hioposScreenReader';
import { isAndroidNativeApp } from '../utils/androidBridge';

interface HioposScreenScannerProps {
  onTicketDispatched?: (ticketNumber: string) => void;
}

export const HioposScreenScanner: React.FC<HioposScreenScannerProps> = () => {
  const [stats, setStats] = useState<HioposScreenReaderStats>(hioposReader.getStats());
  const [logs, setLogs] = useState<HioposScanLogEntry[]>(hioposReader.getLogs());
  const [roiConfig, setRoiConfig] = useState<HioposRoiConfig>(hioposReader.getRoiConfig());
  const [intervalMs, setIntervalMs] = useState<number>(hioposReader.getIntervalMs());
  const [isCalibrating, setIsCalibrating] = useState<boolean>(false);
  const [selectedPreset, setSelectedPreset] = useState<string>('top_right');
  const [activeTab, setActiveTab] = useState<'monitor' | 'calibration' | 'logs'>('monitor');

  // Dragging states for interactive ROI rectangle
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [isDraggingRoi, setIsDraggingRoi] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; roiX: number; roiY: number }>({ x: 0, y: 0, roiX: 0, roiY: 0 });

  useEffect(() => {
    const unsubscribe = hioposReader.subscribe((newStats, newLogs) => {
      setStats(newStats);
      setLogs(newLogs);
    });
    return () => unsubscribe();
  }, []);

  const handleToggleCapture = async () => {
    if (stats.isCapturing) {
      hioposReader.stopCapture();
    } else {
      await hioposReader.startCapture();
    }
  };

  const handleIntervalChange = (ms: number) => {
    setIntervalMs(ms);
    hioposReader.setIntervalMs(ms);
  };

  const handleApplyPreset = (presetId: string) => {
    const preset = HIOPOS_ROI_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      setSelectedPreset(presetId);
      setRoiConfig(preset.roi);
      hioposReader.saveRoiConfig(preset.roi);
    }
  };

  const handleRoiSliderChange = (field: keyof HioposRoiConfig, value: number | boolean) => {
    const updated = { ...roiConfig, [field]: value };
    setSelectedPreset('custom');
    setRoiConfig(updated);
    hioposReader.saveRoiConfig(updated);
  };

  // Interactive Drag & Move of ROI Box inside preview container
  const handleRoiMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingRoi(true);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      roiX: roiConfig.x,
      roiY: roiConfig.y,
    });
  };

  const handleContainerMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRoi || !previewContainerRef.current) return;
    const rect = previewContainerRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const deltaXPercent = ((e.clientX - dragStart.x) / rect.width) * 100;
    const deltaYPercent = ((e.clientY - dragStart.y) / rect.height) * 100;

    const newX = Math.max(0, Math.min(100 - roiConfig.width, dragStart.roiX + deltaXPercent));
    const newY = Math.max(0, Math.min(100 - roiConfig.height, dragStart.roiY + deltaYPercent));

    const updated: HioposRoiConfig = {
      ...roiConfig,
      x: Math.round(newX),
      y: Math.round(newY),
      enabled: true,
    };

    setRoiConfig(updated);
    setSelectedPreset('custom');
    hioposReader.saveRoiConfig(updated);
  };

  const handleContainerMouseUp = () => {
    if (isDraggingRoi) {
      setIsDraggingRoi(false);
    }
  };

  const isAndroid = isAndroidNativeApp();

  return (
    <div className="space-y-6">
      
      {/* 1. MASTER CONTROL & LIVE STATUS HERO BANNER */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          
          {/* Status info */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className={`relative flex h-3.5 w-3.5`}>
                {stats.isCapturing && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                )}
                <span
                  className={`relative inline-flex rounded-full h-3.5 w-3.5 ${
                    stats.isCapturing
                      ? 'bg-emerald-500'
                      : stats.status === 'requesting'
                      ? 'bg-amber-400 animate-pulse'
                      : stats.status === 'error' || stats.status === 'permission_denied'
                      ? 'bg-rose-500'
                      : 'bg-slate-600'
                  }`}
                />
              </span>
              <h3 className="font-extrabold text-white text-lg tracking-tight flex items-center gap-2">
                <span>Lector Continuo de Pantalla HIOPOS</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-bold uppercase">
                  {isAndroid ? 'Android MediaProjection' : 'Web Screen API + Gemini Flash'}
                </span>
              </h3>
            </div>

            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Captura automáticamente en segundo plano la ventana donde se ejecuta HIOPOS, recorta la zona exacta del número de ticket y lo añade a la cola en tiempo real con deduplicación inteligente.
            </p>

            {/* Status message */}
            <div className="flex items-center gap-2 pt-1 font-mono text-xs">
              <span className="text-slate-500">Estado:</span>
              <span
                className={`font-bold ${
                  stats.isCapturing
                    ? 'text-emerald-400'
                    : stats.status === 'permission_denied'
                    ? 'text-rose-400'
                    : 'text-slate-300'
                }`}
              >
                {stats.statusMessage}
              </span>
            </div>
          </div>

          {/* Action Buttons & Interval Selector */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            
            {/* Interval selector */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-1.5 flex items-center gap-1">
              <span className="text-[10px] font-mono text-slate-500 px-2 uppercase font-bold">Frecuencia:</span>
              {[1000, 2000, 3000, 5000].map((ms) => (
                <button
                  key={ms}
                  onClick={() => handleIntervalChange(ms)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                    intervalMs === ms
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                  title={`Escanear cada ${ms / 1000} segundos`}
                >
                  {ms / 1000}s
                </button>
              ))}
            </div>

            {/* Master Start/Stop Button */}
            <button
              onClick={handleToggleCapture}
              disabled={stats.status === 'requesting'}
              className={`px-6 py-3.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2.5 shadow-xl cursor-pointer active:scale-95 disabled:opacity-50 ${
                stats.isCapturing
                  ? 'bg-rose-500 hover:bg-rose-400 text-white shadow-rose-500/20'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
              }`}
            >
              {stats.status === 'requesting' ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  <span>SOLICITANDO...</span>
                </>
              ) : stats.isCapturing ? (
                <>
                  <Square size={16} className="fill-current" />
                  <span>DETENER LECTOR</span>
                </>
              ) : (
                <>
                  <Play size={16} className="fill-current" />
                  <span>INICIAR LECTOR AUTOMÁTICO</span>
                </>
              )}
            </button>

          </div>

        </div>

      </div>

      {/* 2. REAL-TIME METRICS & TELEMETRY ROW */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        
        {/* Metric 1: Last Ticket Detected */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase font-mono tracking-wider">Último Detectado</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-400 font-mono">
              {stats.lastDetectedTicket ? `#${stats.lastDetectedTicket}` : '---'}
            </span>
          </div>
        </div>

        {/* Metric 2: Gemini Confidence */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase font-mono tracking-wider">Confianza OCR</span>
          <div className="mt-1 flex items-center gap-2">
            <span className={`text-2xl font-black font-mono ${stats.lastConfidence > 80 ? 'text-emerald-400' : stats.lastConfidence > 50 ? 'text-amber-400' : 'text-slate-400'}`}>
              {stats.lastConfidence > 0 ? `${stats.lastConfidence}%` : '---'}
            </span>
          </div>
        </div>

        {/* Metric 3: Latency */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase font-mono tracking-wider">Latencia IA</span>
          <div className="mt-1">
            <span className="text-2xl font-black text-indigo-400 font-mono">
              {stats.lastLatencyMs > 0 ? `${stats.lastLatencyMs}ms` : '---'}
            </span>
          </div>
        </div>

        {/* Metric 4: Total Scans */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase font-mono tracking-wider">Escaneos Totales</span>
          <div className="mt-1">
            <span className="text-2xl font-black text-slate-200 font-mono">
              {stats.totalScans}
            </span>
          </div>
        </div>

        {/* Metric 5: Tickets Sent */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase font-mono tracking-wider">Tickets Enviados</span>
          <div className="mt-1">
            <span className="text-2xl font-black text-emerald-400 font-mono">
              {stats.totalTicketsSent}
            </span>
          </div>
        </div>

        {/* Metric 6: Duplicates Filtered */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase font-mono tracking-wider">Duplicados Filtrados</span>
          <div className="mt-1">
            <span className="text-2xl font-black text-slate-400 font-mono">
              {stats.duplicatesIgnored}
            </span>
          </div>
        </div>

      </div>

      {/* 3. SUB-TABS: LIVE MONITOR & CALIBRATION / RECORTE ROI / LIVE FEED LOGS */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        
        {/* Navigation bar */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 pt-4 pb-0 bg-slate-950/40">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('monitor')}
              className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
                activeTab === 'monitor'
                  ? 'border-indigo-500 text-indigo-400 bg-slate-900/60 rounded-t-lg'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Eye size={14} />
              <span>Monitor en Vivo y Recorte ROI</span>
            </button>

            <button
              onClick={() => setActiveTab('calibration')}
              className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
                activeTab === 'calibration'
                  ? 'border-indigo-500 text-indigo-400 bg-slate-900/60 rounded-t-lg'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sliders size={14} />
              <span>Calibración de Zona ({roiConfig.width}x{roiConfig.height}%)</span>
            </button>

            <button
              onClick={() => setActiveTab('logs')}
              className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
                activeTab === 'logs'
                  ? 'border-indigo-500 text-indigo-400 bg-slate-900/60 rounded-t-lg'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Activity size={14} />
              <span>Registro de Escaneos ({logs.length})</span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-2 pb-2">
            <span className="text-[11px] text-slate-500 font-mono">
              IA Modelo: <strong className="text-slate-300">Gemini 3.6 Flash</strong>
            </span>
          </div>
        </div>

        {/* TAB 1: LIVE MONITOR & REAL-TIME CROPPED ROI PREVIEW */}
        {activeTab === 'monitor' && (
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Column: Full Screen Live View with ROI Overlay */}
              <div className="lg:col-span-7 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <Maximize2 size={13} className="text-indigo-400" />
                    Vista de Pantalla Capturada
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {stats.isCapturing ? '🔴 Transmitiendo en vivo' : '⚪ En pausa (Presiona Iniciar)'}
                  </span>
                </div>

                <div
                  ref={previewContainerRef}
                  onMouseMove={handleContainerMouseMove}
                  onMouseUp={handleContainerMouseUp}
                  className="relative aspect-video bg-slate-950 rounded-xl border border-slate-800 overflow-hidden flex items-center justify-center select-none shadow-inner"
                >
                  {stats.lastFullFrameImage ? (
                    <img
                      src={stats.lastFullFrameImage}
                      alt="Full screen capture"
                      className="w-full h-full object-contain pointer-events-none"
                    />
                  ) : (
                    <div className="text-center p-6 space-y-3">
                      <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-600">
                        <ImageIcon size={22} />
                      </div>
                      <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                        Inicia el lector para ver la pantalla en vivo y verificar el recuadro recortable.
                      </p>
                    </div>
                  )}

                  {/* Interactive Crop Rectangle Box Overlay */}
                  {roiConfig.enabled && (
                    <div
                      onMouseDown={handleRoiMouseDown}
                      style={{
                        position: 'absolute',
                        left: `${roiConfig.x}%`,
                        top: `${roiConfig.y}%`,
                        width: `${roiConfig.width}%`,
                        height: `${roiConfig.height}%`,
                        cursor: isDraggingRoi ? 'grabbing' : 'grab',
                      }}
                      className={`border-2 border-amber-400 bg-amber-500/20 rounded-lg shadow-lg flex flex-col justify-between p-1 transition-all ${
                        isDraggingRoi ? 'ring-2 ring-amber-300 shadow-amber-500/40' : 'hover:border-amber-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="bg-amber-500 text-slate-950 text-[9px] font-black uppercase px-1.5 py-0.5 rounded shadow">
                          ZONA RECORTADA (OCR)
                        </span>
                        <span className="text-[9px] font-mono font-bold text-amber-200 drop-shadow">
                          {roiConfig.width}% × {roiConfig.height}%
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[8px] text-amber-200/80 font-mono">
                          Arrastrar para mover
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <p className="text-[11px] text-slate-500 leading-normal">
                  💡 <strong>Consejo:</strong> Puedes hacer clic y arrastrar el recuadro amarillo directamente sobre la pantalla para encuadrar la zona donde HIOPOS muestra el número de pedido.
                </p>
              </div>

              {/* Right Column: Exact Cropped Thumbnail Analyzed by Gemini */}
              <div className="lg:col-span-5 space-y-4">
                
                {/* Thumbnail Card */}
                <div className="bg-slate-950/80 border-2 border-indigo-500/40 rounded-2xl p-5 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                    <div className="flex items-center gap-2">
                      <Crop size={15} className="text-indigo-400" />
                      <span className="text-xs font-bold text-indigo-300 uppercase font-mono tracking-wider">
                        Último Recorte Enviado a Gemini
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                      Solo {roiConfig.width * roiConfig.height > 0 ? `${roiConfig.width}%×${roiConfig.height}%` : '100%'}
                    </span>
                  </div>

                  {/* Thumbnail Image display */}
                  <div className="aspect-[3/1] bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex items-center justify-center p-2 relative shadow-inner">
                    {stats.lastCroppedImage ? (
                      <img
                        src={stats.lastCroppedImage}
                        alt="Cropped ticket area"
                        className="max-h-full max-w-full object-contain rounded filter contrast-125"
                      />
                    ) : (
                      <span className="text-xs text-slate-500 font-mono">
                        Aún no se ha realizado ninguna captura
                      </span>
                    )}
                  </div>

                  {/* OCR Recognition Result Callout */}
                  <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 font-mono uppercase font-bold">Resultado de Lectura:</span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {stats.lastScanTimestamp
                          ? `Hace ${Math.round((Date.now() - stats.lastScanTimestamp) / 1000)}s`
                          : 'Esperando...'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="font-mono text-3xl font-black text-amber-400 tracking-wider">
                        {stats.lastDetectedTicket ? `#${stats.lastDetectedTicket}` : 'Ninguno'}
                      </span>

                      {stats.lastDetectedTicket && (
                        <div className="text-right">
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-500/40 px-2.5 py-1 rounded-lg">
                            <CheckCircle2 size={13} />
                            {stats.lastConfidence}% Precisión
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Quick Preset Buttons */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase font-mono tracking-wider block">
                      Ajuste Rápido de Zona:
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      {HIOPOS_ROI_PRESETS.slice(0, 4).map((preset) => (
                        <button
                          key={preset.id}
                          onClick={() => handleApplyPreset(preset.id)}
                          className={`p-2 rounded-lg text-left text-xs transition-all border cursor-pointer ${
                            selectedPreset === preset.id
                              ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 font-bold'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                          }`}
                        >
                          <div className="truncate font-semibold text-[11px]">{preset.name}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                </div>

              </div>

            </div>
          </div>
        )}

        {/* TAB 2: ADVANCED CALIBRATION & SLIDERS */}
        {activeTab === 'calibration' && (
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Presets Column */}
              <div className="space-y-4 bg-slate-950/60 p-5 rounded-2xl border border-slate-800">
                <h4 className="font-bold text-sm text-slate-200 uppercase tracking-wider font-mono flex items-center gap-2">
                  <Crop size={15} className="text-amber-400" />
                  Plantillas Predefinidas
                </h4>
                <p className="text-xs text-slate-400">
                  Selecciona la ubicación habitual donde aparece el número en la pantalla de HIOPOS:
                </p>

                <div className="space-y-2.5">
                  {HIOPOS_ROI_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => handleApplyPreset(preset.id)}
                      className={`w-full p-3.5 rounded-xl text-left transition-all border cursor-pointer flex items-center justify-between ${
                        selectedPreset === preset.id
                          ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                          : 'bg-slate-900/60 border-slate-800/80 text-slate-300 hover:bg-slate-850'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="font-bold text-xs">{preset.name}</div>
                        <div className="text-[11px] text-slate-400">{preset.description}</div>
                      </div>
                      <div className="text-right font-mono text-xs text-slate-400 font-bold shrink-0 ml-3">
                        {preset.roi.width}% × {preset.roi.height}%
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Sliders Column */}
              <div className="space-y-4 bg-slate-950/60 p-5 rounded-2xl border border-slate-800">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm text-slate-200 uppercase tracking-wider font-mono flex items-center gap-2">
                    <Sliders size={15} className="text-indigo-400" />
                    Ajuste Fino Manual
                  </h4>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-300">
                    <input
                      type="checkbox"
                      checked={roiConfig.enabled}
                      onChange={(e) => handleRoiSliderChange('enabled', e.target.checked)}
                      className="rounded bg-slate-900 border-slate-700 text-indigo-500 focus:ring-indigo-500"
                    />
                    <span>Activar Recorte ROI</span>
                  </label>
                </div>

                <div className="space-y-4 pt-2">
                  
                  {/* Slider X */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-slate-400">Posición Horizontal (X):</span>
                      <span className="text-amber-400 font-bold">{roiConfig.x}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="90"
                      value={roiConfig.x}
                      disabled={!roiConfig.enabled}
                      onChange={(e) => handleRoiSliderChange('x', parseInt(e.target.value, 10))}
                      className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400 disabled:opacity-40"
                    />
                  </div>

                  {/* Slider Y */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-slate-400">Posición Vertical (Y):</span>
                      <span className="text-amber-400 font-bold">{roiConfig.y}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="90"
                      value={roiConfig.y}
                      disabled={!roiConfig.enabled}
                      onChange={(e) => handleRoiSliderChange('y', parseInt(e.target.value, 10))}
                      className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400 disabled:opacity-40"
                    />
                  </div>

                  {/* Slider Width */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-slate-400">Ancho del Recorte:</span>
                      <span className="text-indigo-400 font-bold">{roiConfig.width}%</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={roiConfig.width}
                      disabled={!roiConfig.enabled}
                      onChange={(e) => handleRoiSliderChange('width', parseInt(e.target.value, 10))}
                      className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 disabled:opacity-40"
                    />
                  </div>

                  {/* Slider Height */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-slate-400">Alto del Recorte:</span>
                      <span className="text-indigo-400 font-bold">{roiConfig.height}%</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={roiConfig.height}
                      disabled={!roiConfig.enabled}
                      onChange={(e) => handleRoiSliderChange('height', parseInt(e.target.value, 10))}
                      className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 disabled:opacity-40"
                    />
                  </div>

                </div>

                <div className="p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-xl flex items-start gap-2 text-[11px] text-slate-400 leading-normal">
                  <Info size={14} className="text-indigo-400 shrink-0 mt-0.5" />
                  <span>
                    Al recortar sólo el recuadro del número se reduce drásticamente el consumo de red, se acelera la inferencia a menos de 200ms y se evitan falsos positivos de precios o importes.
                  </span>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* TAB 3: LIVE SCAN ACTIVITY LOG FEED */}
        {activeTab === 'logs' && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm text-slate-200 uppercase tracking-wider font-mono">
                  Registro de Actividad en Vivo
                </h4>
                <p className="text-xs text-slate-400">
                  Secuencia cronológica de capturas, inferencias de Gemini y llamadas API.
                </p>
              </div>

              <span className="text-xs font-mono text-slate-400">
                {logs.length} eventos registrados
              </span>
            </div>

            {logs.length === 0 ? (
              <div className="p-8 text-center bg-slate-950/40 rounded-xl border border-slate-800/60">
                <p className="text-xs text-slate-500">Aún no hay actividad de escaneo registrada.</p>
                <p className="text-[11px] text-slate-600 mt-1">Presiona "Iniciar Lector Automático" para comenzar.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/60 bg-slate-950/80 rounded-xl border border-slate-800 overflow-hidden font-mono text-xs max-h-96 overflow-y-auto">
                {logs.map((log) => (
                  <div key={log.id} className="p-3 flex items-center justify-between gap-4 hover:bg-slate-900/40 transition-colors">
                    <div className="flex items-center gap-3 truncate">
                      <span className="text-slate-500 text-[10px] shrink-0">{log.timeStr}</span>

                      {log.type === 'success' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                          TICKET
                        </span>
                      )}
                      {log.type === 'info' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
                          INFO
                        </span>
                      )}
                      {log.type === 'duplicate' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                          DUPLICADO
                        </span>
                      )}
                      {log.type === 'error' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 shrink-0">
                          ERROR
                        </span>
                      )}
                      {log.type === 'warning' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                          AVISO
                        </span>
                      )}

                      <span className="text-slate-300 text-xs truncate">{log.message}</span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {log.ticketNumber && (
                        <span className="text-amber-400 font-bold text-sm">#{log.ticketNumber}</span>
                      )}
                      {log.latencyMs !== undefined && (
                        <span className="text-slate-500 text-[10px]">{log.latencyMs}ms</span>
                      )}
                      {log.croppedThumbnail && (
                        <img
                          src={log.croppedThumbnail}
                          alt="Thumbnail"
                          className="w-10 h-6 object-contain rounded border border-slate-700 bg-slate-900"
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

    </div>
  );
};
