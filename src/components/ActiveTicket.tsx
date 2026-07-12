import React from 'react';
import { Ticket } from '../types';
import { Play, Check, Pause, ArrowRightLeft, Volume2, Clock, AlertCircle } from 'lucide-react';
import { formatTimeDuration } from '../utils/export';

interface ActiveTicketProps {
  activeTicket: Ticket | null;
  announcementCount: number;
  onSpeakActive: () => void;
  onMarkDelivered: (id: string) => void;
  onMarkPending: (id: string) => void;
  onMarkMissing: (id: string) => void;
  onCallNext: () => void;
  nextTicketNumber: string | null;
  waitingCount: number;
  activeGlowColor?: string; // customizable active ticket border/shadow color
  onContextMenu?: (e: React.MouseEvent, id: string) => void;
}

export default function ActiveTicket({
  activeTicket,
  announcementCount,
  onSpeakActive,
  onMarkDelivered,
  onMarkPending,
  onMarkMissing,
  onCallNext,
  nextTicketNumber,
  waitingCount,
  activeGlowColor = '#6366f1',
  onContextMenu,
}: ActiveTicketProps) {
  if (!activeTicket) {
    return (
      <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-8 flex flex-col items-center justify-center min-h-[380px] text-center shadow-xl relative overflow-hidden">
        {/* Ambient background accent */}
        <div className="absolute w-72 h-72 bg-indigo-500/5 rounded-full blur-3xl"></div>
        
        <div className="p-4 bg-slate-950/60 border border-slate-800/50 rounded-full mb-4 text-slate-500 animate-pulse">
          <Volume2 size={44} />
        </div>
        <h3 className="text-xl font-bold text-slate-300 mb-2">No hay ticket activo</h3>
        <p className="text-sm text-slate-500 max-w-sm">
          Añade un ticket en la entrada rápida o activa la cámara para iniciar la gestión de la cola.
        </p>
      </div>
    );
  }

  // Calculate elapsed waiting time since ticket was created (approx)
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - activeTicket.createdAt) / 1000));

  const borderStyle = activeGlowColor 
    ? { borderColor: activeGlowColor, boxShadow: `0 0 25px ${activeGlowColor}33` }
    : {};

  return (
    <div 
      className="bg-slate-900 border-2 rounded-2xl p-8 shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[380px] group transition-all duration-300"
      style={borderStyle}
      onContextMenu={(e) => onContextMenu && onContextMenu(e, activeTicket.id)}
    >
      {/* Decorative background glow based on active ticket */}
      <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl group-hover:bg-indigo-500/15 transition-all duration-500"></div>

      {/* Header section */}
      <div className="flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 rounded-full bg-indigo-400 animate-ping"></span>
          <span className="text-xs font-mono font-semibold text-indigo-400 tracking-wider uppercase">
            TICKET ACTIVO
          </span>
        </div>
        <div className="flex items-center gap-2 bg-indigo-950/40 border border-indigo-900/40 px-3 py-1 rounded-full text-xs text-indigo-300 font-mono">
          <Clock size={13} />
          <span>Espera: {formatTimeDuration(elapsedSeconds)}</span>
        </div>
      </div>

      {/* Huge Display Number */}
      <div className="my-6 text-center z-10 select-none flex flex-col items-center">
        <div className="text-[120px] font-mono font-extrabold text-white leading-none tracking-tight drop-shadow-[0_10px_15px_rgba(99,102,241,0.2)] select-all selection:bg-indigo-500/40 selection:text-white">
          {activeTicket.number}
        </div>
        <div className="mt-1 flex items-center gap-1.5 px-3 py-1 bg-slate-950/80 border border-slate-800/80 rounded-full text-[11px] text-slate-400 font-mono">
          <Volume2 size={13} className="text-indigo-400 animate-pulse" />
          <span>Llamados: <strong className="text-indigo-300">{announcementCount}</strong></span>
          <span className="text-slate-600">•</span>
          <span>Frase cada 3</span>
        </div>
      </div>

      {/* Control Actions Panel */}
      <div className="z-10 flex flex-col gap-4">
        {/* Secondary Info / Next indicator */}
        {nextTicketNumber && (
          <div className="text-center text-xs text-slate-400 font-mono bg-slate-950/40 border border-slate-800/50 py-1.5 rounded-lg">
            Siguiente en cola: <strong className="text-indigo-300">{nextTicketNumber}</strong> 
            <span className="text-slate-600 mx-2">|</span>
            Tickets esperando: <strong className="text-indigo-300">{waitingCount}</strong>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {/* Entregado Button */}
          <button
            onClick={() => onMarkDelivered(activeTicket.id)}
            className="col-span-2 sm:col-span-1 flex items-center justify-center gap-2 py-3 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-950/20 active:scale-95 transition-all text-sm cursor-pointer"
            title="Entregar ticket activo"
          >
            <Check size={16} />
            <span>Entregar</span>
          </button>

          {/* Volver a Llamar Button */}
          <button
            onClick={onSpeakActive}
            className="col-span-2 sm:col-span-1 flex items-center justify-center gap-2 py-3 px-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-950/20 active:scale-95 transition-all text-sm cursor-pointer"
            title="Volver a anunciar por voz"
          >
            <Volume2 size={16} />
            <span>Anunciar</span>
          </button>

          {/* Pausa Button (Pausa ⏸️) */}
          <button
            onClick={() => onMarkPending(activeTicket.id)}
            className="col-span-1 sm:col-span-1 flex items-center justify-center gap-1.5 py-3 px-2 bg-amber-950/40 hover:bg-amber-900/40 border border-amber-900/40 text-amber-300 hover:text-amber-100 font-medium rounded-xl active:scale-95 transition-all text-xs sm:text-sm cursor-pointer"
            title="Pausar ticket activo"
          >
            <Pause size={15} />
            <span>Pausa</span>
          </button>

          {/* Desaparecido Button (AlertCircle ⚠️) */}
          <button
            onClick={() => onMarkMissing(activeTicket.id)}
            className="col-span-1 sm:col-span-1 flex items-center justify-center gap-1.5 py-3 px-2 bg-red-950/40 hover:bg-red-900/40 border border-red-900/40 text-red-300 hover:text-red-100 font-medium rounded-xl active:scale-95 transition-all text-xs sm:text-sm cursor-pointer"
            title="Marcar como desaparecido"
          >
            <AlertCircle size={15} />
            <span>Perdido</span>
          </button>

          {/* Llamar Siguiente / Rotar Button */}
          <button
            onClick={onCallNext}
            className="col-span-2 sm:col-span-1 flex items-center justify-center gap-2 py-3 px-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-medium rounded-xl active:scale-95 transition-all text-sm cursor-pointer"
            title="Mueve el ticket activo al final de la lista de espera y activa el siguiente"
          >
            <ArrowRightLeft size={15} />
            <span>Rotar</span>
          </button>
        </div>
      </div>
    </div>
  );
}
