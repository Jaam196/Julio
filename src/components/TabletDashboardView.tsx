import React, { useState, useEffect, useRef } from 'react';
import {
  Tablet,
  Camera,
  Play,
  Volume2,
  Settings,
  History,
  BarChart3,
  Music,
  Trash2,
  Tv,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Zap,
  RotateCcw,
  Delete,
  Check,
  ChevronRight,
  PauseCircle,
  PlayCircle,
  Hash,
  ArrowRightLeft,
  Megaphone
} from 'lucide-react';
import { Ticket, AppConfig, VoiceSettings, MusicConfig } from '../types';
import CameraOCR from './CameraOCR';
import ReadyList from './ReadyList';
import WaitingList from './WaitingList';
import { speakText, playNotificationSound } from '../utils/audio';
import { musicController } from '../utils/musicController';

interface TabletDashboardViewProps {
  tickets: Ticket[];
  activeTicket: Ticket | null;
  onCallNext: () => void;
  onAddTicket: (num: string, fromOcr?: boolean) => void;
  onAddDirectWaitingTicket?: (num: string) => void;
  onResolveTicket: (id: string) => void;
  onMarkMissing: (id: string) => void;
  onRepeatCall: () => void;
  onClearQueue: () => void;
  onDeliverTicket?: (id: string) => void;
  onCallTicketNow?: (id: string) => void;
  onReturnToWaiting?: (id: string) => void;
  onDeleteTicket?: (id: string) => void;
  onClearWaitingList?: () => void;
  onClearReadyList?: () => void;
  onTogglePriority?: (id: string) => void;
  selectedReadyTicketId?: string | null;
  onSelectReadyTicket?: (id: string) => void;
  selectedWaitingTicketId?: string | null;
  onSelectWaitingTicket?: (id: string) => void;
  isWaitlistPaused: boolean;
  onTogglePauseWaitlist: () => void;
  isAutoCallActive: boolean;
  onToggleAutoCall: () => void;
  appConfig: AppConfig;
  voiceSettings: VoiceSettings;
  musicConfig: MusicConfig;
  activeTab: string;
  setActiveTab: (tab: any) => void;
  pairingCode: string;
  pairingStatus: string;
  isOcrPaused: boolean;
  setIsOcrPaused: (val: boolean) => void;
  onOpenMusicModal: () => void;
  onOpenSettingsModal: () => void;
  setDeviceMode: (mode: 'local' | 'server' | 'client') => void;
  deviceMode: 'local' | 'server' | 'client';
  onCustomAnnouncement?: (text: string) => void;
}

export default function TabletDashboardView({
  tickets,
  activeTicket,
  onCallNext,
  onAddTicket,
  onAddDirectWaitingTicket,
  onResolveTicket,
  onMarkMissing,
  onRepeatCall,
  onClearQueue,
  onDeliverTicket,
  onCallTicketNow,
  onReturnToWaiting,
  onDeleteTicket,
  onClearWaitingList,
  onClearReadyList,
  onTogglePriority,
  selectedReadyTicketId,
  onSelectReadyTicket,
  selectedWaitingTicketId,
  onSelectWaitingTicket,
  isWaitlistPaused,
  onTogglePauseWaitlist,
  isAutoCallActive,
  onToggleAutoCall,
  appConfig,
  voiceSettings,
  musicConfig,
  activeTab,
  setActiveTab,
  pairingCode,
  pairingStatus,
  isOcrPaused,
  setIsOcrPaused,
  onOpenMusicModal,
  onOpenSettingsModal,
  setDeviceMode,
  deviceMode,
  onCustomAnnouncement
}: TabletDashboardViewProps) {
  // Custom Voice Announcement state
  const [customTTSInput, setCustomTTSInput] = useState('');

  const handleSendCustomTTS = () => {
    if (!customTTSInput.trim()) return;
    const text = customTTSInput.trim();
    if (onCustomAnnouncement) {
      onCustomAnnouncement(text);
    } else {
      musicController.startAnnouncement();
      if (voiceSettings.soundEnabled) {
        playNotificationSound();
      }
      speakText(text, voiceSettings, undefined, () => {
        musicController.endAnnouncement();
      });
    }
    setManualFeedback({ type: 'success', message: `Anunciando por voz: "${text}"` });
    setTimeout(() => setManualFeedback(null), 2500);
    setCustomTTSInput('');
  };

  // Numpad manual entry state
  const [numpadValue, setNumpadValue] = useState('');
  const [inputMode, setInputMode] = useState<'numpad' | 'ocr'>('numpad');
  const [quickInputTarget, setQuickInputTarget] = useState<'active' | 'waiting'>('active');
  const [manualFeedback, setManualFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // High / Low confidence scan prompt state
  const [lowConfidenceTicket, setLowConfidenceTicket] = useState<{ number: string; confidence: number } | null>(null);
  const [recentScanBanner, setRecentScanBanner] = useState<{ number: string; timestamp: number } | null>(null);
  const [duplicateScanBanner, setDuplicateScanBanner] = useState<{ number: string; timestamp: number } | null>(null);

  // Auto-submit timer ref
  const autoSubmitTimerRef = useRef<NodeJS.Timeout | null>(null);

  const clearAutoSubmitTimer = () => {
    if (autoSubmitTimerRef.current) {
      clearTimeout(autoSubmitTimerRef.current);
      autoSubmitTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => clearAutoSubmitTimer();
  }, []);

  // Core submit function - called directly or via auto-timer
  const submitTicketNumber = (rawNum: string, targetStatus: 'active' | 'waiting' = quickInputTarget) => {
    clearAutoSubmitTimer();
    if (!rawNum.trim()) return;
    const cleanNum = rawNum.trim();

    const exists = tickets.some(t => t.number === cleanNum && (t.status === 'active' || t.status === 'waiting'));
    if (exists) {
      setManualFeedback({ type: 'error', message: `Ticket #${cleanNum} ya está en la cola` });
      setTimeout(() => setManualFeedback(null), 2000);
      setNumpadValue('');
      return;
    }

    if (targetStatus === 'waiting') {
      if (onAddDirectWaitingTicket) {
        onAddDirectWaitingTicket(cleanNum);
      } else {
        onAddTicket(cleanNum, false);
      }
      setManualFeedback({ type: 'success', message: `Ticket #${cleanNum} añadido a Lista de Espera` });
    } else {
      onAddTicket(cleanNum, false);
      setManualFeedback({ type: 'success', message: `Ticket #${cleanNum} añadido a Pedidos Listos` });
    }
    setNumpadValue('');
    setTimeout(() => setManualFeedback(null), 2000);
  };

  // Numpad button handlers - Auto-submit instantly on 3rd digit
  const handleNumpadPress = (digit: string) => {
    clearAutoSubmitTimer();
    const nextVal = (numpadValue + digit).slice(0, 3);

    if (nextVal.length === 3) {
      setNumpadValue(nextVal);
      // Brief 120ms pause so the 3rd digit is visibly rendered before resetting
      autoSubmitTimerRef.current = setTimeout(() => {
        submitTicketNumber(nextVal);
      }, 120);
    } else {
      setNumpadValue(nextVal);
    }
  };

  const handleNumpadClear = () => {
    clearAutoSubmitTimer();
    setNumpadValue('');
  };

  const handleNumpadBackspace = () => {
    clearAutoSubmitTimer();
    setNumpadValue(prev => prev.slice(0, -1));
  };

  const handleNumpadSubmit = () => {
    if (numpadValue) {
      submitTicketNumber(numpadValue);
    }
  };

  // Keyboard shortcut listener for tablet mode
  useEffect(() => {
    if (inputMode !== 'numpad') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        handleNumpadPress(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleNumpadBackspace();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (numpadValue) {
          submitTicketNumber(numpadValue);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleNumpadClear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inputMode, numpadValue, tickets]);

  // Wrapper for OCR detection with auto-confidence check & visual feedback
  const handleOcrAddTicket = (num: string, fromOcr?: boolean) => {
    const exists = tickets.some(t => t.number === num && (t.status === 'active' || t.status === 'waiting'));
    if (exists) {
      setDuplicateScanBanner({ number: num, timestamp: Date.now() });
      setTimeout(() => setDuplicateScanBanner(null), 2500);
      return;
    }

    onAddTicket(num, fromOcr);
    setRecentScanBanner({ number: num, timestamp: Date.now() });
    setTimeout(() => setRecentScanBanner(null), 2500);
  };

  const waitingTickets = tickets.filter(t => t.status === 'waiting');
  const deliveredTickets = tickets.filter(t => t.status === 'delivered');
  const missingTickets = tickets.filter(t => t.status === 'missing');

  return (
    <div className="space-y-4 max-w-[1600px] mx-auto p-2 sm:p-4 select-none">
      
      {/* HEADER DE MODO TABLET */}
      <div className="bg-slate-900/90 border border-slate-800/80 rounded-3xl p-4 shadow-xl backdrop-blur-md flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-2xl shadow-inner">
            <Tablet size={24} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-white tracking-tight">MODO TABLET</h2>
              <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-extrabold uppercase rounded-full tracking-wider flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                OCR TÁCTIL
              </span>
            </div>
            <p className="text-xs text-slate-400">Escaneo inteligente por posiciones y dispensador numérico de respuesta inmediata</p>
          </div>
        </div>

        {/* MEGAFONÍA / MENSAJE PERSONALIZADO POR VOZ */}
        <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800 rounded-2xl px-3 py-1.5 flex-1 min-w-[240px] max-w-md shadow-inner">
          <Megaphone size={16} className="text-indigo-400 shrink-0" />
          <input
            type="text"
            value={customTTSInput}
            onChange={(e) => setCustomTTSInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSendCustomTTS();
              }
            }}
            placeholder="Mensaje personalizado por voz..."
            className="bg-transparent border-none text-xs focus:outline-none w-full px-1 py-0.5 font-medium text-white placeholder-slate-500"
          />
          <button
            type="button"
            onClick={handleSendCustomTTS}
            disabled={!customTTSInput.trim()}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white font-extrabold text-xs rounded-xl transition-all cursor-pointer shrink-0 shadow-md shadow-indigo-600/20 flex items-center gap-1.5"
            title="Anunciar mensaje por voz"
          >
            <Volume2 size={14} />
            <span>Anunciar</span>
          </button>
        </div>

        {/* SELECTOR DE MODO TÁCTIL / PC / MÓVIL */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 border border-slate-800 rounded-2xl">
          <button
            onClick={() => setActiveTab('board')}
            className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-900 transition-all cursor-pointer"
          >
            🖥️ PC
          </button>
          <button
            className="px-3.5 py-1.5 rounded-xl text-xs font-extrabold bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Tablet size={14} />
            <span>📟 Tablet</span>
          </button>
          <button
            onClick={() => setActiveTab('board')}
            className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-900 transition-all cursor-pointer"
          >
            📱 Móvil
          </button>
        </div>

        {/* INDICADOR CÓDIGO SALA / TV */}
        <div className="flex items-center gap-2">
          {pairingCode && (
            <div className="bg-indigo-950/60 border border-indigo-500/30 px-3 py-1.5 rounded-xl text-xs font-mono font-bold text-indigo-300 flex items-center gap-2">
              <Tv size={14} className="text-indigo-400" />
              <span>SALA: {pairingCode}</span>
            </div>
          )}
          <button
            onClick={() => setActiveTab('tv_view')}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Tv size={15} />
            <span>Ver Pantalla TV</span>
          </button>
        </div>
      </div>

      {/* ÁREA DESTACADA: TICKET ACTIVO Y LLAMAR SIGUIENTE */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border-2 border-indigo-500/30 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          
          {/* INFORMACIÓN DEL TICKET ACTIVO */}
          <div className="lg:col-span-5 text-center lg:text-left space-y-2">
            <div className="flex items-center justify-center lg:justify-start gap-2">
              <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-extrabold uppercase rounded-full">
                TICKET EN ATENCIÓN
              </span>
              {activeTicket && (
                <span className="text-xs text-slate-400 font-mono">
                  Llamado a las {new Date(activeTicket.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>

            <div className="py-2">
              <span className="font-mono font-black text-6xl sm:text-7xl lg:text-8xl text-white tracking-tighter drop-shadow-[0_0_25px_rgba(99,102,241,0.5)]">
                {activeTicket ? `#${activeTicket.number}` : '—'}
              </span>
            </div>

            <div className="flex items-center justify-center lg:justify-start gap-3 text-xs text-slate-400 font-medium">
              <span className="flex items-center gap-1">
                <Clock size={14} className="text-amber-400" />
                En espera: <strong className="text-white font-bold">{waitingTickets.length}</strong>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <CheckCircle2 size={14} className="text-emerald-400" />
                Entregados: <strong className="text-white font-bold">{deliveredTickets.length}</strong>
              </span>
            </div>
          </div>

          {/* BOTONES DE ACCIÓN PRINCIPALES TÁCTILES */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            
            {/* BOTÓN LLAMAR SIGUIENTE (GIGANTE) */}
            <button
              onClick={onCallNext}
              disabled={waitingTickets.length === 0}
              className={`sm:col-span-3 py-4 px-6 rounded-2xl font-black text-xl sm:text-2xl flex items-center justify-center gap-3 shadow-2xl transition-all cursor-pointer active:scale-95 border ${
                waitingTickets.length > 0
                  ? 'bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border-emerald-400 shadow-emerald-600/40 animate-pulse'
                  : 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
              }`}
            >
              <Zap size={28} />
              <span>LLAMAR SIGUIENTE TICKET</span>
            </button>

            {/* REANUNCIAR */}
            <button
              onClick={onRepeatCall}
              disabled={!activeTicket}
              className={`py-3.5 px-3 rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 border transition-all cursor-pointer active:scale-95 ${
                activeTicket
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-400 shadow-lg shadow-indigo-600/20'
                  : 'bg-slate-800/60 text-slate-500 border-slate-800 cursor-not-allowed'
              }`}
              title="Volver a anunciar el ticket activo por voz"
            >
              <Volume2 size={18} />
              <span>Reanunciar</span>
            </button>

            {/* MANDAR A ESPERA */}
            <button
              onClick={() => activeTicket && onReturnToWaiting && onReturnToWaiting(activeTicket.id)}
              disabled={!activeTicket}
              className={`py-3.5 px-3 rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 border transition-all cursor-pointer active:scale-95 ${
                activeTicket
                  ? 'bg-amber-600 hover:bg-amber-500 text-white border-amber-400 shadow-lg shadow-amber-600/20'
                  : 'bg-slate-800/60 text-slate-500 border-slate-800 cursor-not-allowed'
              }`}
              title="Devolver el ticket activo a la lista de espera"
            >
              <ArrowRightLeft size={18} />
              <span>Mandar a Espera</span>
            </button>

            {/* ATENDIDO / FINALIZAR */}
            <button
              onClick={() => activeTicket && onResolveTicket(activeTicket.id)}
              disabled={!activeTicket}
              className={`py-3.5 px-3 rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 border transition-all cursor-pointer active:scale-95 ${
                activeTicket
                  ? 'bg-teal-600 hover:bg-teal-500 text-white border-teal-400 shadow-lg shadow-teal-600/20'
                  : 'bg-slate-800/60 text-slate-500 border-slate-800 cursor-not-allowed'
              }`}
              title="Marcar el ticket activo como entregado"
            >
              <CheckCircle2 size={18} />
              <span>Marcar Entregado</span>
            </button>

            {/* CONTROLES RÁPIDOS DE ESTADO */}
            <div className="sm:col-span-3 grid grid-cols-2 gap-2 mt-1">
              <button
                onClick={onTogglePauseWaitlist}
                className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                  isWaitlistPaused
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
              >
                {isWaitlistPaused ? <PlayCircle size={15} /> : <PauseCircle size={15} />}
                <span>{isWaitlistPaused ? 'Reanudar Cola' : 'Pausar Cola'}</span>
              </button>

              <button
                onClick={onToggleAutoCall}
                className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                  isAutoCallActive
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
              >
                <Zap size={15} className={isAutoCallActive ? 'text-emerald-400' : ''} />
                <span>Auto-Llamador: {isAutoCallActive ? 'ON' : 'OFF'}</span>
              </button>
            </div>
        </div>
      </div>
    </div>

      {/* BLOQUE CENTRAL PRINCIPAL DE TABLET: ENTRADA RÁPIDA | COLA DE ESPERA | PEDIDOS LISTOS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* COLUMNA 1: ENTRADA RÁPIDA (TECLADO NUMÉRICO Y ESCÁNER) */}
        <div className="lg:col-span-4 bg-slate-900/80 border border-slate-800 rounded-3xl p-4 flex flex-col justify-between shadow-2xl space-y-3">
          
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-xl">
                <Hash size={18} />
              </div>
              <div>
                <h3 className="font-extrabold text-white text-sm leading-tight uppercase tracking-wider">ENTRADA RÁPIDA</h3>
                <p className="text-[10px] text-slate-400">Teclado numérico táctil o escáner</p>
              </div>
            </div>

            <div className="flex bg-slate-950 p-1 border border-slate-800 rounded-xl text-xs font-bold">
              <button
                onClick={() => setInputMode('numpad')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  inputMode === 'numpad' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Teclado
              </button>
              <button
                onClick={() => setInputMode('ocr')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                  inputMode === 'ocr' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Camera size={12} />
                <span>OCR / App</span>
              </button>
            </div>
          </div>

          {/* Selector de Destino por defecto (A Listos o A Espera) */}
          <div className="flex items-center justify-between gap-1 bg-slate-950 p-1.5 border border-slate-800 rounded-xl text-xs font-bold">
            <span className="text-[10px] text-slate-400 font-mono pl-1 uppercase tracking-wider">Enviar a:</span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setQuickInputTarget('active')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 text-xs ${
                  quickInputTarget === 'active'
                    ? 'bg-emerald-600 text-white shadow-sm font-extrabold border border-emerald-400'
                    : 'text-slate-400 hover:text-slate-200 bg-slate-900/60 border border-slate-800'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>A Listos (Llamar)</span>
              </button>
              <button
                type="button"
                onClick={() => setQuickInputTarget('waiting')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 text-xs ${
                  quickInputTarget === 'waiting'
                    ? 'bg-amber-600 text-white shadow-sm font-extrabold border border-amber-400'
                    : 'text-slate-400 hover:text-slate-200 bg-slate-900/60 border border-slate-800'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                <span>A Espera</span>
              </button>
            </div>
          </div>

          {/* Feedback de Entrada Manual */}
          {manualFeedback && (
            <div className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 animate-fade-in ${
              manualFeedback.type === 'success'
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                : 'bg-rose-500/20 border-rose-500/40 text-rose-300'
            }`}>
              {manualFeedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span>{manualFeedback.message}</span>
            </div>
          )}

          {inputMode === 'numpad' ? (
            <>
              {/* PANTALLA VISUAL DEL TECLADO */}
              <div className="bg-slate-950 border border-indigo-500/30 rounded-2xl p-3 text-center shadow-inner min-h-[64px] flex flex-col justify-center items-center relative">
                <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest block flex items-center justify-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  3 DÍGITOS — ENVÍO AUTO AL PULSAR 3º DÍGITO
                </span>
                <span className="font-mono font-black text-4xl tracking-tight text-white">
                  {numpadValue ? `#${numpadValue}` : '—'}
                </span>
                {numpadValue.length > 0 && (
                  <button
                    onClick={handleNumpadClear}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 hover:text-rose-400 bg-slate-900 px-2 py-1 rounded-lg transition-all cursor-pointer"
                  >
                    Limpiar
                  </button>
                )}
              </div>

              {/* TECLADO NUMÉRICO TÁCTIL (1 2 3 / 4 5 6 / 7 8 9 / ← 0 ✓) */}
              <div className="grid grid-cols-3 gap-2">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(digit => (
                  <button
                    key={digit}
                    onClick={() => handleNumpadPress(digit)}
                    className="py-3.5 bg-slate-800/90 hover:bg-slate-700 active:bg-indigo-600 text-white font-mono font-black text-xl rounded-xl border border-slate-700/80 shadow-md active:scale-95 transition-all cursor-pointer flex items-center justify-center min-h-[52px]"
                  >
                    {digit}
                  </button>
                ))}

                {/* TECLA BORRAR (←) */}
                <button
                  onClick={handleNumpadBackspace}
                  className="py-3.5 bg-slate-800/60 hover:bg-rose-900/40 hover:text-rose-300 text-slate-300 font-bold text-base rounded-xl border border-slate-700/80 shadow-md active:scale-95 transition-all cursor-pointer flex items-center justify-center min-h-[52px]"
                  title="Borrar dígito"
                >
                  <Delete size={20} />
                </button>

                {/* TECLA 0 */}
                <button
                  onClick={() => handleNumpadPress('0')}
                  className="py-3.5 bg-slate-800/90 hover:bg-slate-700 active:bg-indigo-600 text-white font-mono font-black text-xl rounded-xl border border-slate-700/80 shadow-md active:scale-95 transition-all cursor-pointer flex items-center justify-center min-h-[52px]"
                >
                  0
                </button>

                {/* TECLA CONFIRMAR / AÑADIR DIRECTO (✓) */}
                <button
                  onClick={handleNumpadSubmit}
                  disabled={!numpadValue}
                  className={`py-3.5 rounded-xl font-black text-base flex items-center justify-center gap-1 shadow-md active:scale-95 transition-all cursor-pointer border min-h-[52px] ${
                    numpadValue
                      ? quickInputTarget === 'waiting'
                        ? 'bg-amber-600 hover:bg-amber-500 text-white border-amber-400 shadow-amber-600/30'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400 shadow-emerald-600/30'
                      : 'bg-slate-800/40 text-slate-600 border-slate-800 cursor-not-allowed'
                  }`}
                  title={quickInputTarget === 'waiting' ? 'Añadir a Lista de Espera' : 'Añadir a Pedidos Listos'}
                >
                  <Check size={22} className="stroke-[3]" />
                </button>
              </div>

              {/* BOTONES DIRECTOS PARA ELEGIR DESTINO CUALQUIER MOMENTO */}
              <div className="grid grid-cols-2 gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => submitTicketNumber(numpadValue, 'active')}
                  disabled={!numpadValue}
                  className={`py-2.5 px-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                    numpadValue
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400 shadow-md shadow-emerald-600/30 active:scale-95'
                      : 'bg-slate-800/40 text-slate-600 border-slate-800 cursor-not-allowed'
                  }`}
                  title="Añadir a Pedidos Listos para entregar"
                >
                  <Check size={16} />
                  <span>+ A Listos</span>
                </button>

                <button
                  type="button"
                  onClick={() => submitTicketNumber(numpadValue, 'waiting')}
                  disabled={!numpadValue}
                  className={`py-2.5 px-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                    numpadValue
                      ? 'bg-amber-600 hover:bg-amber-500 text-white border-amber-400 shadow-md shadow-amber-600/30 active:scale-95'
                      : 'bg-slate-800/40 text-slate-600 border-slate-800 cursor-not-allowed'
                  }`}
                  title="Añadir a la Lista de Espera"
                >
                  <Clock size={16} />
                  <span>+ A Espera</span>
                </button>
              </div>
            </>
          ) : (
            <div className="min-h-[300px] rounded-2xl overflow-hidden border border-slate-800 bg-black relative">
              <CameraOCR
                onAddTicket={handleOcrAddTicket}
                existingTicketNumbers={new Set(tickets.map(t => t.number))}
                maxTicketsSimultaneous={appConfig.maxOcrSimultaneous}
                isOcrPausedProps={isOcrPaused}
                onToggleOcrPauseProps={setIsOcrPaused}
                isEmbeddedMain={true}
                onOpenFullOcrTab={() => setActiveTab('ocr')}
              />
            </div>
          )}

        </div>

        {/* COLUMNA 2: COLA DE ESPERA */}
        <div className="lg:col-span-4 h-full">
          <WaitingList
            tickets={tickets.filter((t) => t.status === 'waiting')}
            onRaisePriority={onCallTicketNow || onCallNext}
            onDeleteTicket={onDeleteTicket || (() => {})}
            onCallNow={onCallTicketNow || onRepeatCall}
            onTogglePriority={onTogglePriority}
            selectedWaitingTicketId={selectedWaitingTicketId}
            onSelectWaitingTicket={onSelectWaitingTicket}
            isWaitlistPaused={isWaitlistPaused}
            onToggleWaitlistPause={onTogglePauseWaitlist}
            onClearList={onClearWaitingList}
          />
        </div>

        {/* COLUMNA 3: PEDIDOS LISTOS (IGUAL QUE EN LOS DEMÁS MODOS) */}
        <div className="lg:col-span-4 h-full">
          <ReadyList
            tickets={tickets.filter((t) => t.status === 'active')}
            onDeliver={onDeliverTicket || onResolveTicket}
            onCallNow={onCallTicketNow || onRepeatCall}
            onReturnToWaiting={onReturnToWaiting || (() => {})}
            onDeleteTicket={onDeleteTicket || (() => {})}
            activeGlowColor={appConfig.activeGlowColor}
            selectedReadyTicketId={selectedReadyTicketId}
            onSelectReadyTicket={onSelectReadyTicket}
            onClearList={onClearReadyList}
          />
        </div>

      </div>

    </div>
  );
}
