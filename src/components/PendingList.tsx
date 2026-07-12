import React, { useState, useEffect, useRef } from 'react';
import { Ticket } from '../types';
import { Play, ArrowRight, ArrowRightLeft, Check, Trash2, Clock, Info, Volume2, Plus } from 'lucide-react';
import { formatTimeDuration } from '../utils/export';

interface PendingListProps {
  tickets: Ticket[];
  onSendToActive: (id: string) => void;
  onReturnToWaiting: (id: string) => void;
  onCallNow: (id: string) => void;
  onDeliver: (id: string) => void;
  onDeleteTicket: (id: string) => void;
  selectedPendingTicketId?: string | null;
  onSelectPendingTicket?: (id: string) => void;
  pendingSelectedColor?: string; // custom highlight color
  onContextMenu?: (e: React.MouseEvent, id: string) => void;
  onAddDirectTicket?: (num: string) => void;
}

export default function PendingList({
  tickets,
  onSendToActive,
  onReturnToWaiting,
  onCallNow,
  onDeliver,
  onDeleteTicket,
  selectedPendingTicketId = null,
  onSelectPendingTicket,
  pendingSelectedColor = '#f59e0b', // Default amber/orange color
  onContextMenu,
  onAddDirectTicket,
}: PendingListProps) {
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [timeState, setTimeState] = useState(Date.now());
  const [directNumber, setDirectNumber] = useState('');

  // Dynamic ticking to update waiting times
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeState(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const confirmDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onDeleteTicket(id);
    setDeleteConfirmId(null);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-slate-100 text-sm">Pausa</h3>
          <span className="bg-amber-950/60 text-amber-400 font-mono text-xs font-bold px-2 py-0.5 rounded-full border border-amber-900/40">
            {tickets.length}
          </span>
        </div>
        <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
          <Info size={11} />
          Pausados
        </span>
      </div>

      {/* Direct Add Input Form */}
      {onAddDirectTicket && (
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            const cleanNum = directNumber.replace(/\D/g, '').trim();
            if (cleanNum) {
              onAddDirectTicket(cleanNum);
              setDirectNumber('');
            }
          }} 
          className="mb-4 flex gap-1.5"
        >
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={3}
            placeholder="Añadir nº..."
            value={directNumber}
            onChange={(e) => setDirectNumber(e.target.value.replace(/\D/g, ''))}
            className="flex-1 px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:border-amber-500 outline-none transition-all"
          />
          <button
            type="submit"
            className="px-2.5 py-1 bg-amber-950 hover:bg-amber-900 border border-amber-900/40 text-amber-300 hover:text-amber-100 rounded-xl text-xs font-semibold active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
          >
            <Plus size={12} />
            <span>Añadir</span>
          </button>
        </form>
      )}

      {tickets.length === 0 ? (
        <div className="flex-1 border-2 border-dashed border-slate-800/80 rounded-xl p-4 flex flex-col items-center justify-center text-center text-slate-500 min-h-[180px]">
          <Clock className="stroke-1 mb-2 text-slate-600" size={24} />
          <p className="text-xs font-medium text-slate-400">Sin pausados</p>
          <p className="text-[10px] text-slate-600 mt-1">Los tickets pausados irán aquí.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto max-h-[420px] pr-1 space-y-2.5 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
          {tickets.map((ticket) => {
            const isConfirmingDelete = deleteConfirmId === ticket.id;
            const totalWaitSeconds = Math.max(0, Math.floor((timeState - ticket.createdAt) / 1000));
            const pendingSeconds = ticket.pendingAt 
              ? Math.max(0, Math.floor((timeState - ticket.pendingAt) / 1000))
              : 0;
            
            const isSelected = ticket.id === selectedPendingTicketId;

            if (isConfirmingDelete) {
              return (
                <div
                  key={ticket.id}
                  className="bg-red-950/60 border border-red-900/60 p-2.5 rounded-xl flex items-center justify-between animate-fadeIn transition-all duration-200"
                >
                  <div className="flex flex-col">
                    <span className="text-[10px] font-semibold text-red-300 uppercase tracking-wider">
                      ¿Borrar #{ticket.number}?
                    </span>
                    <span className="text-[9px] text-red-400 font-mono">Definitivo</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => confirmDelete(e, ticket.id)}
                      className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white font-bold text-[10px] rounded active:scale-95 transition-all cursor-pointer"
                    >
                      Sí
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmId(null);
                      }}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-[10px] rounded active:scale-95 transition-all cursor-pointer"
                    >
                      No
                    </button>
                  </div>
                </div>
              );
            }

            // Inline styles for custom color selection if provided
            const highlightStyle = isSelected && pendingSelectedColor
              ? { borderColor: pendingSelectedColor, boxShadow: `0 4px 12px ${pendingSelectedColor}1a` }
              : {};

            return (
              <div
                key={ticket.id}
                onClick={() => onSelectPendingTicket && onSelectPendingTicket(ticket.id)}
                onContextMenu={(e) => onContextMenu && onContextMenu(e, ticket.id)}
                className={`p-2.5 rounded-xl flex flex-col gap-2 transition-all duration-150 select-none cursor-pointer group border ${
                  isSelected
                    ? 'bg-amber-950/20 border-2 shadow-lg'
                    : 'bg-slate-950 border-slate-800/80 hover:border-amber-950'
                }`}
                style={highlightStyle}
              >
                {/* Upper row: Number and times */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono font-bold text-sm border transition-all ${
                      isSelected 
                        ? 'bg-amber-950/60 text-amber-400' 
                        : 'bg-slate-900 border-slate-800 text-slate-300 group-hover:text-amber-400 group-hover:border-amber-900'
                    }`}
                    style={isSelected && pendingSelectedColor ? { borderColor: pendingSelectedColor, color: pendingSelectedColor } : {}}>
                      {ticket.number}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] text-slate-400 font-mono flex items-center gap-1">
                        <Clock size={9} className="text-amber-500" />
                        Acumulado: {formatTimeDuration(totalWaitSeconds)}
                      </span>
                      {ticket.pendingAt && (
                        <span className="text-[8px] text-slate-500 font-mono">
                          Paso: {new Date(ticket.pendingAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          {` (${formatTimeDuration(pendingSeconds)})`}
                        </span>
                      )}
                    </div>
                  </div>

                  {isSelected && (
                    <span className="text-[8px] bg-amber-500/15 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded-full font-mono font-bold animate-pulse">
                      SEL
                    </span>
                  )}
                </div>

                {/* Bottom row: Control action buttons */}
                <div className="flex items-center justify-between gap-1 mt-1 border-t border-slate-800/60 pt-2">
                  <div className="flex items-center gap-1 w-full justify-between">
                    {/* Send to active (▶️ Reanudar) */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSendToActive(ticket.id);
                      }}
                      className="p-1.5 bg-indigo-950 hover:bg-indigo-900 text-indigo-400 hover:text-indigo-200 border border-indigo-900/40 rounded-lg active:scale-90 transition-all cursor-pointer"
                      title="Activar / Reanudar Ticket"
                    >
                      <Play size={13} />
                    </button>

                    {/* Return to waiting list (🔄) */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onReturnToWaiting(ticket.id);
                      }}
                      className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-slate-100 border border-slate-800 rounded-lg active:scale-90 transition-all cursor-pointer"
                      title="Volver al final de Lista de Espera"
                    >
                      <ArrowRightLeft size={13} />
                    </button>

                    {/* Call immediately (📢) */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onCallNow(ticket.id);
                      }}
                      className="p-1.5 bg-amber-950 hover:bg-amber-900 text-amber-400 hover:text-amber-200 border border-amber-900/40 rounded-lg active:scale-90 transition-all cursor-pointer"
                      title="Llamar inmediatamente"
                    >
                      <Volume2 size={13} />
                    </button>

                    {/* Deliver (✅) */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeliver(ticket.id);
                      }}
                      className="p-1.5 bg-emerald-950 hover:bg-emerald-900 text-emerald-400 hover:text-emerald-200 border border-emerald-900/40 rounded-lg active:scale-90 transition-all cursor-pointer"
                      title="Entregar ticket"
                    >
                      <Check size={13} />
                    </button>

                    {/* Delete permanently (🗑️) */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmId(ticket.id);
                      }}
                      className="p-1.5 bg-red-950/40 hover:bg-red-950 text-red-400 hover:text-red-300 border border-red-900/30 rounded-lg active:scale-90 transition-all cursor-pointer"
                      title="Eliminar definitivamente"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
