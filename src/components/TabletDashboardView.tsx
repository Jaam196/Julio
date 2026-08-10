import React, { useState, useEffect, useRef } from 'react';
import {
  Tablet,
  Camera,
  Volume2,
  Settings,
  Tv,
  CheckCircle2,
  AlertCircle,
  Clock,
  Zap,
  Delete,
  Check,
  PauseCircle,
  PlayCircle,
  Hash
} from 'lucide-react';
import { Ticket, AppConfig, VoiceSettings, MusicConfig } from '../types';
import CameraOCR from './CameraOCR';
import ReadyList from './ReadyList';
import WaitingList from './WaitingList';

interface TabletDashboardViewProps {
  tickets: Ticket[];
  activeTicket: Ticket | null;
  onCallNext: () => void;
  onAddTicket: (num: string, fromOcr?: boolean) => void;
  onResolveTicket: (id: string) => void;
  onMarkMissing: (id: string) => void;
  onRepeatCall: () => void;
  onClearQueue: () => void;
  onDeliverTicket?: (id: string) => void;
  onCallTicketNow?: (id: string) => void;
  onReturnToWaiting?: (id: string) => void;
  onDeleteTicket?: (id: string) => void;
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
  setActiveTab: (tab: string) => void;
  pairingCode: string;
  pairingStatus: string;
  isOcrPaused: boolean;
  setIsOcrPaused: (val: boolean) => void;
  onOpenMusicModal: () => void;
  onOpenSettingsModal: () => void;
  setDeviceMode: (mode: 'local' | 'server' | 'client') => void;
  deviceMode: 'local' | 'server' | 'client';
}

export default function TabletDashboardView({
  tickets,
  activeTicket,
  onCallNext,
  onAddTicket,
  onResolveTicket,
  onRepeatCall,
  onDeliverTicket,
  onCallTicketNow,
  onReturnToWaiting,
  onDeleteTicket,
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
  setActiveTab,
  pairingCode,
  isOcrPaused,
  setIsOcrPaused,
  onOpenSettingsModal
}: TabletDashboardViewProps) {
  // Numpad manual entry state
  const [numpadValue, setNumpadValue] = useState('');
  const [inputMode, setInputMode] = useState<'numpad' | 'ocr'>('numpad');
  const [manualFeedback, setManualFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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
  const submitTicketNumber = (rawNum: string) => {
    clearAutoSubmitTimer();
    if (!rawNum.trim()) return;
    const cleanNum = rawNum.trim();

    const exists = tickets.some(t => t.number === cleanNum && (t.status === 'active' || t.status === 'waiting'));
    if (exists) {
      setManualFeedback({ type: 'error', message: `Ticket #${cleanNum} ya está activo o en espera` });
      setTimeout(() => setManualFeedback(null), 2500);
      setNumpadValue('');
      return;
    }

    onAddTicket(cleanNum, false);
    setManualFeedback({ type: 'success', message: `Ticket #${cleanNum} añadido correctamente` });
    setNumpadValue('');
    setTimeout(() => setManualFeedback(null), 2200);
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

  // Wrapper for OCR detection
  const handleOcrAddTicket = (num: string, fromOcr?: boolean) => {
    const exists = tickets.some(t => t.number === num && (t.status === 'active' || t.status === 'waiting'));
    if (exists) {
      setManualFeedback({ type: 'error', message: `Ticket #${num} ya está en cola o activo` });
      setTimeout(() => setManualFeedback(null), 2500);
      return;
    }

    onAddTicket(num, fromOcr);
    setManualFeedback({ type: 'success', message: `Ticket #${num} escaneado correctamente` });
    setTimeout(() => setManualFeedback(null), 2200);
  };

  const waitingTickets = tickets.filter(t => t.status === 'waiting');
  const readyTickets = tickets.filter(t => t.status === 'active');

  return (
    <div className="space-y-4 max-w-[1700px] mx-auto p-2 sm:p-4 select-none">
      
      {/* HEADER DE MODO TABLET COMPACTO CON CONTROLES SECUNDARIOS Y ACCIONES RÁPIDAS */}
      <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-3 shadow-xl backdrop-blur-md flex flex-wrap items-center justify-between gap-3">
        
        {/* TITULO Y MODO */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-xl shadow-inner flex items-center justify-center">
            <Tablet size={22} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-white tracking-tight">MODO TABLET</h2>
              {pairingCode && (
                <span className="px-2 py-0.5 bg-indigo-950/80 text-indigo-300 border border-indigo-500/30 text-[11px] font-mono font-bold rounded-lg flex items-center gap-1">
                  <Tv size={12} className="text-indigo-400" />
                  SALA: {pairingCode}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 font-medium">Entrada Rápida + Cola de Espera + Pedidos Listos</p>
          </div>
        </div>

        {/* MANDO CENTRAL COMPACTO: TICKET ACTIVO Y ACCIONES RÁPIDAS DE LLAMADA */}
        <div className="flex flex-wrap items-center gap-2 bg-slate-950/80 p-1.5 border border-slate-800 rounded-xl">
          {/* TICKET ATENDIENDO */}
          <div className="px-3 py-1 bg-slate-900 border border-slate-800 rounded-lg flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold text-slate-400">Atendiendo:</span>
            <span className="font-mono font-black text-lg text-emerald-400">
              {activeTicket ? `#${activeTicket.number}` : '—'}
            </span>
          </div>

          {/* BOTÓN LLAMAR SIGUIENTE */}
          <button
            onClick={onCallNext}
            disabled={waitingTickets.length === 0}
            className={`px-4 py-2 rounded-xl font-extrabold text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer active:scale-95 border ${
              waitingTickets.length > 0
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400 shadow-emerald-600/30'
                : 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
            }`}
          >
            <Zap size={15} />
            <span>LLAMAR SIGUIENTE ({waitingTickets.length})</span>
          </button>

          {/* REANUNCIAR */}
          <button
            onClick={onRepeatCall}
            disabled={!activeTicket}
            className={`px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 border transition-all cursor-pointer active:scale-95 ${
              activeTicket
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-400 shadow-indigo-600/20'
                : 'bg-slate-800/60 text-slate-500 border-slate-800 cursor-not-allowed'
            }`}
            title="Reanunciar Ticket Activo"
          >
            <Volume2 size={14} />
            <span>Reanunciar</span>
          </button>

          {/* ATENDIDO / ENTREGADO */}
          <button
            onClick={() => activeTicket && onResolveTicket(activeTicket.id)}
            disabled={!activeTicket}
            className={`px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 border transition-all cursor-pointer active:scale-95 ${
              activeTicket
                ? 'bg-teal-600 hover:bg-teal-500 text-white border-teal-400 shadow-teal-600/20'
                : 'bg-slate-800/60 text-slate-500 border-slate-800 cursor-not-allowed'
            }`}
            title="Marcar como Entregado"
          >
            <CheckCircle2 size={14} />
            <span>Entregado</span>
          </button>

          {/* PAUSAR / REANUDAR COLA */}
          <button
            onClick={onTogglePauseWaitlist}
            className={`p-2 rounded-xl font-bold text-xs flex items-center gap-1 border transition-all cursor-pointer ${
              isWaitlistPaused
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
            title={isWaitlistPaused ? 'Reanudar Cola de Espera' : 'Pausar Cola de Espera'}
          >
            {isWaitlistPaused ? <PlayCircle size={15} /> : <PauseCircle size={15} />}
          </button>

          {/* AUTO LLAMADOR TOGGLE */}
          <button
            onClick={onToggleAutoCall}
            className={`px-2.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 border transition-all cursor-pointer ${
              isAutoCallActive
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
            }`}
            title="Llamador Autónomo"
          >
            <Zap size={13} className={isAutoCallActive ? 'text-emerald-400' : ''} />
            <span className="text-[10px]">AUTO: {isAutoCallActive ? 'ON' : 'OFF'}</span>
          </button>
        </div>

        {/* NAVEGACIÓN Y CONFIGURACIÓN DERECHA */}
        <div className="flex items-center gap-2">
          {/* SELECTOR MODO VISTA */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 border border-slate-800 rounded-xl text-xs font-bold">
            <button
              onClick={() => setActiveTab('board')}
              className="px-2.5 py-1 rounded-lg text-slate-400 hover:text-white transition-all cursor-pointer"
            >
              🖥️ PC
            </button>
            <button
              className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-extrabold shadow-sm flex items-center gap-1 cursor-default"
            >
              <Tablet size={12} />
              <span>Tablet</span>
            </button>
            <button
              onClick={() => setActiveTab('board')}
              className="px-2.5 py-1 rounded-lg text-slate-400 hover:text-white transition-all cursor-pointer"
            >
              📱 Móvil
            </button>
          </div>

          <button
            onClick={() => setActiveTab('tv_view')}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs rounded-xl flex items-center gap-1 transition-all cursor-pointer"
            title="Ver Pantalla TV"
          >
            <Tv size={16} />
          </button>

          <button
            onClick={onOpenSettingsModal}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs rounded-xl flex items-center gap-1 transition-all cursor-pointer"
            title="Configuración"
          >
            <Settings size={16} />
          </button>
        </div>

      </div>

      {/* ÁREA PRINCIPAL MODO TABLET: 1. ENTRADA RÁPIDA | 2. COLA DE ESPERA | 3. PEDIDOS LISTOS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* COLUMNA 1: 1. ENTRADA RÁPIDA (TECLADO NUMÉRICO TÁCTIL O ESCÁNER OCR) */}
        <div className="lg:col-span-4 bg-slate-900/90 border border-slate-800 rounded-3xl p-4 flex flex-col justify-between shadow-2xl space-y-3">
          
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-xl">
                <Hash size={18} />
              </div>
              <div>
                <h3 className="font-extrabold text-white text-sm leading-tight uppercase tracking-wider">1. ENTRADA RÁPIDA</h3>
                <p className="text-[10px] text-slate-400">Teclado numérico táctil / Escáner</p>
              </div>
            </div>

            <div className="flex bg-slate-950 p-1 border border-slate-800 rounded-xl text-xs font-bold">
              <button
                onClick={() => setInputMode('numpad')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  inputMode === 'numpad' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Teclado
              </button>
              <button
                onClick={() => setInputMode('ocr')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                  inputMode === 'ocr' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Camera size={12} />
                <span>OCR</span>
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
              <div className="bg-slate-950 border border-indigo-500/30 rounded-2xl p-3 text-center shadow-inner min-h-[68px] flex flex-col justify-center items-center relative">
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
                    className="py-4 bg-slate-800/90 hover:bg-slate-700 active:bg-indigo-600 text-white font-mono font-black text-2xl rounded-2xl border border-slate-700/80 shadow-md active:scale-95 transition-all cursor-pointer flex items-center justify-center min-h-[58px]"
                  >
                    {digit}
                  </button>
                ))}

                {/* TECLA BORRAR (←) */}
                <button
                  onClick={handleNumpadBackspace}
                  className="py-4 bg-slate-800/60 hover:bg-rose-900/40 hover:text-rose-300 text-slate-300 font-bold text-lg rounded-2xl border border-slate-700/80 shadow-md active:scale-95 transition-all cursor-pointer flex items-center justify-center min-h-[58px]"
                  title="Borrar dígito"
                >
                  <Delete size={22} />
                </button>

                {/* TECLA 0 */}
                <button
                  onClick={() => handleNumpadPress('0')}
                  className="py-4 bg-slate-800/90 hover:bg-slate-700 active:bg-indigo-600 text-white font-mono font-black text-2xl rounded-2xl border border-slate-700/80 shadow-md active:scale-95 transition-all cursor-pointer flex items-center justify-center min-h-[58px]"
                >
                  0
                </button>

                {/* TECLA CONFIRMAR / AÑADIR DIRECTO (✓) */}
                <button
                  onClick={handleNumpadSubmit}
                  disabled={!numpadValue}
                  className={`py-4 rounded-2xl font-black text-lg flex items-center justify-center gap-1 shadow-md active:scale-95 transition-all cursor-pointer border min-h-[58px] ${
                    numpadValue
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400 shadow-emerald-600/30'
                      : 'bg-slate-800/40 text-slate-600 border-slate-800 cursor-not-allowed'
                  }`}
                  title="Añadir ticket inmediatamente"
                >
                  <Check size={24} className="stroke-[3]" />
                </button>
              </div>
            </>
          ) : (
            <div className="min-h-[320px] rounded-2xl overflow-hidden border border-slate-800 bg-black relative">
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

        {/* COLUMNA 2: 2. COLA DE ESPERA */}
        <div className="lg:col-span-4 h-full">
          <WaitingList
            tickets={waitingTickets}
            onRaisePriority={onCallTicketNow || onCallNext}
            onDeleteTicket={onDeleteTicket || (() => {})}
            onCallNow={onCallTicketNow || onRepeatCall}
            onTogglePriority={onTogglePriority}
            selectedWaitingTicketId={selectedWaitingTicketId}
            onSelectWaitingTicket={onSelectWaitingTicket}
            isWaitlistPaused={isWaitlistPaused}
            onToggleWaitlistPause={onTogglePauseWaitlist}
          />
        </div>

        {/* COLUMNA 3: 3. PEDIDOS LISTOS */}
        <div className="lg:col-span-4 h-full">
          <ReadyList
            tickets={readyTickets}
            onDeliver={onDeliverTicket || onResolveTicket}
            onCallNow={onCallTicketNow || onRepeatCall}
            onReturnToWaiting={onReturnToWaiting || (() => {})}
            onDeleteTicket={onDeleteTicket || (() => {})}
            activeGlowColor={appConfig.activeGlowColor}
            selectedReadyTicketId={selectedReadyTicketId}
            onSelectReadyTicket={onSelectReadyTicket}
          />
        </div>

      </div>

    </div>
  );
}
