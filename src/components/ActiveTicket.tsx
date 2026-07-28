import React, { useState, useEffect } from 'react';
import { Ticket } from '../types';
import { Check, Volume2, ArrowRightLeft, Clock, AlertCircle, Trash2, Zap } from 'lucide-react';
import { formatTimeDuration } from '../utils/export';
import SwipeableTicket from './SwipeableTicket';

interface ActiveTicketProps {
  activeTicket: Ticket | null;
  announcementCount: number;
  onSpeakActive: () => void;
  onMarkDelivered: (id: string) => void;
  onReturnToWaiting: (id: string) => void;
  onMarkMissing: (id: string) => void;
  onCallNext: () => void;
  nextTicketNumber: string | null;
  waitingCount: number;
  activeGlowColor?: string;
  onDeleteTicket?: (id: string) => void;
}

export default function ActiveTicket({
  activeTicket,
  announcementCount,
  onSpeakActive,
  onMarkDelivered,
  onReturnToWaiting,
  onMarkMissing,
  onCallNext,
  nextTicketNumber,
  waitingCount,
  activeGlowColor = '#a855f7', // Default to beautiful premium violet
  onDeleteTicket,
}: ActiveTicketProps) {
  const [timeState, setTimeState] = useState(Date.now());
  const [isCalling, setIsCalling] = useState(false);
  const [callSuccess, setCallSuccess] = useState(false);

  // Dynamic ticking to update elapsed times & check highlight status
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeState(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleCallNextWithFeedback = async () => {
    if (isCalling) return;
    setIsCalling(true);
    setCallSuccess(false);
    try {
      await onCallNext();
      setIsCalling(false);
      setCallSuccess(true);
      setTimeout(() => setCallSuccess(false), 1500);
    } catch (e) {
      setIsCalling(false);
    }
  };

  if (!activeTicket) {
    return (
      <div className="border border-slate-800/60 bg-slate-900/40 backdrop-blur-md rounded-[22px] p-6 flex flex-col items-center justify-center min-h-[310px] text-center shadow-2xl relative overflow-hidden group hover:border-slate-700/60 transition-all duration-300">
        <div className="absolute w-72 h-72 bg-violet-500/5 rounded-full blur-3xl animate-soft-pulse"></div>
        
        <div className="p-3.5 bg-slate-950/50 border border-slate-800/80 rounded-full mb-3 text-slate-500 animate-pulse">
          <Volume2 size={32} />
        </div>
        <h3 className="font-display font-extrabold text-sm text-slate-300 tracking-wide mb-1">TICKET ACTIVO</h3>
        <p className="text-xs text-slate-500 max-w-xs leading-relaxed font-medium">
          Ningún ticket está siendo llamado ahora. Marca uno listo para anunciarlo.
        </p>
        
        {waitingCount > 0 && (
          <button
            onClick={handleCallNextWithFeedback}
            disabled={isCalling}
            className={`mt-5 px-5 py-3 bg-gradient-to-r text-white font-display font-extrabold text-xs rounded-2xl shadow-lg transition-all duration-200 flex items-center gap-2 cursor-pointer ${
              isCalling 
                ? 'from-slate-700 to-slate-800 shadow-slate-700/20 cursor-not-allowed animate-pulse'
                : callSuccess
                  ? 'from-emerald-600 to-teal-600 shadow-emerald-500/20'
                  : 'from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-violet-500/20 active:scale-95 hover:shadow-violet-500/30'
            }`}
          >
            {isCalling ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Llamando...</span>
              </>
            ) : callSuccess ? (
              <>
                <Check size={14} className="text-white" />
                <span>¡Sincronizado con TV!</span>
              </>
            ) : (
              <>
                <Zap size={14} className="text-violet-200 fill-violet-200" />
                <span>Llamar Siguiente</span>
                <span className="bg-white/15 px-2 py-0.5 rounded-lg font-mono text-[10px] font-black">
                  #{nextTicketNumber || '?'}
                </span>
              </>
            )}
          </button>
        )}
      </div>
    );
  }

  const completedAt = activeTicket.completedAt || activeTicket.createdAt || Date.now();
  const elapsedReadySeconds = Math.max(0, Math.floor((timeState - completedAt) / 1000));
  
  // Highlight state: highlight with a beautiful pulsing ring/border for 15 seconds after being marked ready
  const isHighlightActive = elapsedReadySeconds < 15;

  const glowColor = activeGlowColor || '#a855f7';
  const borderStyle = isHighlightActive
    ? { borderColor: glowColor, boxShadow: `0 0 35px ${glowColor}3d, inset 0 0 12px ${glowColor}1a` }
    : { borderColor: 'rgba(51, 65, 85, 0.4)' };

  return (
    <SwipeableTicket
      id={activeTicket.id}
      onSwipeLeft={onDeleteTicket ? () => onDeleteTicket(activeTicket.id) : undefined}
      onSwipeRight={() => onMarkDelivered(activeTicket.id)}
      swipeLeftLabel="Eliminar"
      swipeRightLabel="Entregar"
      swipeLeftIcon={<Trash2 size={18} />}
      swipeRightIcon={<Check size={18} />}
      swipeLeftColorClass="bg-rose-600/90"
      swipeRightColorClass="bg-emerald-600/90"
    >
      <div 
        className="bg-slate-900/50 backdrop-blur-md border rounded-[22px] p-6 shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[310px] group transition-all duration-300 hover:border-slate-700/60"
        style={borderStyle}
      >
        {/* Dynamic background glow under active ticket */}
        <div 
          className="absolute -left-16 -bottom-16 w-56 h-56 rounded-full blur-3xl opacity-30 transition-all duration-500 animate-soft-pulse"
          style={{ backgroundColor: glowColor }}
        ></div>

        {/* Header section */}
        <div className="flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-violet-500"></span>
            </span>
            <span className="text-[10px] font-display font-black tracking-widest text-violet-400 uppercase">
              TICKET ACTIVO
            </span>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-950/80 border border-slate-800/80 px-3 py-1 rounded-xl text-[10px] text-slate-400 font-mono font-bold">
            <Clock size={11} className="text-violet-400 animate-pulse" />
            <span>Listo hace: {formatTimeDuration(elapsedReadySeconds)}</span>
          </div>
        </div>

        {/* Huge Display Number with ambient glow */}
        <div className="my-2 text-center z-10 select-none flex flex-col items-center relative">
          {/* Subtle soft light behind the number */}
          <div 
            className="absolute inset-0 w-32 h-32 rounded-full blur-2xl opacity-10 mx-auto pointer-events-none transition-all"
            style={{ backgroundColor: glowColor }}
          ></div>
          
          <div className="text-[72px] sm:text-[84px] font-mono font-black leading-none tracking-tighter text-white drop-shadow-[0_12px_24px_rgba(168,85,247,0.2)]">
            {activeTicket.number}
          </div>
          
          <div className="mt-1 flex items-center gap-1.5 px-3 py-0.5 bg-slate-950/80 border border-slate-800/80 rounded-full text-[10px] text-slate-400 font-mono font-semibold">
            <Volume2 size={11} className="text-violet-400 animate-pulse" />
            <span>Llamados: <strong className="text-violet-300 font-bold">{announcementCount}</strong></span>
          </div>
        </div>

        {/* Control Actions Panel */}
        <div className="z-10 flex flex-col gap-3">
          <div className="grid grid-cols-4 gap-2">
            {/* ✔ Entregado (Green) */}
            <button
              onClick={() => onMarkDelivered(activeTicket.id)}
              className="col-span-1 flex flex-col items-center justify-center gap-1 py-2.5 px-1 bg-emerald-600 hover:bg-emerald-500 text-white font-display font-extrabold rounded-2xl active:scale-95 hover:shadow-lg hover:shadow-emerald-500/10 transition-all duration-200 text-xs cursor-pointer"
              title="Entregar pedido listo (pasa a Historial)"
            >
              <Check size={14} />
              <span className="text-[10px]">Entregar</span>
            </button>

            {/* 📢 Anunciar de nuevo (Purple) */}
            <button
              onClick={onSpeakActive}
              className="col-span-1 flex flex-col items-center justify-center gap-1 py-2.5 px-1 bg-violet-600 hover:bg-violet-500 text-white font-display font-extrabold rounded-2xl active:scale-95 hover:shadow-lg hover:shadow-violet-500/10 transition-all duration-200 text-xs cursor-pointer"
              title="Volver a llamar por altavoz"
            >
              <Volume2 size={14} />
              <span className="text-[10px]">Anunciar</span>
            </button>

            {/* ↩ Volver a Espera (Yellow) */}
            <button
              onClick={() => onReturnToWaiting(activeTicket.id)}
              className="col-span-1 flex flex-col items-center justify-center gap-1 py-2.5 px-1 bg-slate-950/80 hover:bg-slate-900 border border-slate-800/80 text-amber-400 hover:text-amber-300 font-display font-extrabold rounded-2xl active:scale-95 transition-all duration-200 text-xs cursor-pointer"
              title="Mover de vuelta a la lista de espera"
            >
              <ArrowRightLeft size={14} className="text-amber-500" />
              <span className="text-[10px]">Espera</span>
            </button>

            {/* 🔴 Marcar como Perdido / Desaparecido (Red) */}
            <button
              onClick={() => onMarkMissing(activeTicket.id)}
              className="col-span-1 flex flex-col items-center justify-center gap-1 py-2.5 px-1 bg-slate-950/80 hover:bg-slate-900 border border-slate-800/80 text-rose-400 hover:text-rose-300 font-display font-extrabold rounded-2xl active:scale-95 transition-all duration-200 text-xs cursor-pointer"
              title="Marcar como Desaparecido (Incidencia)"
            >
              <AlertCircle size={14} className="text-rose-500" />
              <span className="text-[10px]">Perdido</span>
            </button>
          </div>
        </div>
      </div>
    </SwipeableTicket>
  );
}
