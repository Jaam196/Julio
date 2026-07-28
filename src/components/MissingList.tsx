import React, { useState, useEffect } from 'react';
import { Ticket } from '../types';
import { ArrowLeft, Play, Trash2, Clock, AlertCircle } from 'lucide-react';
import { formatTimeDuration } from '../utils/export';
import SwipeableTicket from './SwipeableTicket';

interface MissingListProps {
  tickets: Ticket[];
  onSendToActive: (id: string) => void;
  onReturnToWaiting: (id: string) => void;
  onDeleteTicket: (id: string) => void;
  selectedMissingTicketId?: string | null;
  onSelectMissingTicket?: (id: string | null) => void;
  missingSelectedColor?: string;
  missingRecoveryAction?: 'active' | 'waiting';
}

export default function MissingList({
  tickets,
  onSendToActive,
  onReturnToWaiting,
  onDeleteTicket,
  selectedMissingTicketId = null,
  onSelectMissingTicket,
  missingSelectedColor = '#f43f5e', // Red/rose accent for disappeared/missing
  missingRecoveryAction = 'active',
}: MissingListProps) {
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [timeState, setTimeState] = useState(Date.now());

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
    <div className="border border-slate-800/60 bg-slate-900/40 backdrop-blur-md rounded-[22px] p-6 shadow-2xl flex flex-col h-full hover:border-slate-700/60 transition-all duration-300 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-rose-500/10 text-rose-400 rounded-xl border border-rose-500/20 shadow">
            <AlertCircle size={16} className="animate-pulse" />
          </div>
          <div>
            <h3 className="font-display font-extrabold text-slate-100 text-sm leading-tight">Pedidos Perdidos</h3>
            <p className="text-[10px] text-slate-400 font-medium">No retirados / incidencias</p>
          </div>
          <span className="ml-1 bg-rose-500/15 text-rose-400 font-mono text-xs font-bold px-2.5 py-0.5 rounded-full border border-rose-500/30">
            {tickets.length}
          </span>
        </div>
      </div>

      {tickets.length === 0 ? (
        <div className="flex-1 border-2 border-dashed border-slate-800/60 rounded-2xl p-6 flex flex-col items-center justify-center text-center text-slate-500 min-h-[140px]">
          <Clock className="stroke-1 mb-2 text-slate-600 animate-pulse" size={24} />
          <p className="text-xs font-bold text-slate-400 font-display">Sin incidencias</p>
          <p className="text-[10px] text-slate-500 mt-1 max-w-xs leading-relaxed">
            Los tickets marcados como perdidos se guardarán aquí para recuperarlos.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto max-h-[420px] pr-1 space-y-3 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
          {tickets.map((ticket) => {
            const isConfirmingDelete = deleteConfirmId === ticket.id;
            const elapsedSeconds = ticket.completedAt 
              ? Math.max(0, Math.floor((timeState - ticket.completedAt) / 1000))
              : Math.max(0, Math.floor((timeState - ticket.createdAt) / 1000));

            if (isConfirmingDelete) {
              return (
                <div
                  key={ticket.id}
                  className="bg-rose-950/30 border border-rose-500/30 p-3.5 rounded-2xl flex items-center justify-between animate-fadeIn shadow-md"
                >
                  <span className="text-[11px] font-display font-extrabold text-rose-300">¿BORRAR #{ticket.number}?</span>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={(e) => confirmDelete(e, ticket.id)}
                      className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white font-display font-extrabold text-[10px] rounded-lg cursor-pointer shadow"
                    >
                      Sí
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmId(null);
                      }}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-display font-medium text-[10px] rounded-lg cursor-pointer"
                    >
                      No
                    </button>
                  </div>
                </div>
              );
            }

            const isSelected = ticket.id === selectedMissingTicketId;
            const highlightStyle = isSelected && missingSelectedColor
              ? { borderColor: missingSelectedColor, boxShadow: `0 4px 18px ${missingSelectedColor}1f` }
              : {};

            const isRecoveryActive = missingRecoveryAction === 'active';
            const swipeRightLabel = isRecoveryActive ? "Activar" : "A Espera";
            const swipeRightIcon = isRecoveryActive ? <Play size={18} /> : <ArrowLeft size={18} />;
            const swipeRightColorClass = isRecoveryActive ? "bg-violet-650/90" : "bg-slate-650/90";
            const swipeRightAction = isRecoveryActive 
              ? () => onSendToActive(ticket.id) 
              : () => onReturnToWaiting(ticket.id);

            return (
              <SwipeableTicket
                key={ticket.id}
                id={ticket.id}
                onSwipeLeft={() => onDeleteTicket(ticket.id)}
                onSwipeRight={swipeRightAction}
                swipeLeftLabel="Eliminar"
                swipeRightLabel={swipeRightLabel}
                swipeLeftIcon={<Trash2 size={18} />}
                swipeRightIcon={swipeRightIcon}
                swipeLeftColorClass="bg-rose-600/90"
                swipeRightColorClass={swipeRightColorClass}
              >
                <div
                  onClick={() => onSelectMissingTicket && onSelectMissingTicket(ticket.id)}
                  className={`p-3.5 rounded-2xl flex flex-col gap-2.5 transition-all duration-200 border cursor-pointer group ${
                    isSelected
                      ? 'bg-rose-950/20 border-rose-500/50 shadow-xl'
                      : 'bg-slate-900/30 border-slate-800/60 hover:border-slate-700/60'
                  }`}
                  style={highlightStyle}
                >
                  {/* Header: Number and time */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-mono font-black text-sm bg-slate-950/80 border ${
                        isSelected ? 'text-rose-400 border-rose-500' : 'text-rose-300 border-rose-900/40'
                      }`}>
                        {ticket.number}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-slate-500 font-mono">
                          Perdido hace:
                        </span>
                        <span className="text-xs text-rose-400 font-mono font-bold">
                          {formatTimeDuration(elapsedSeconds)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Bottom row: Control action buttons */}
                  <div className="flex items-center justify-between gap-1.5 mt-0.5 border-t border-slate-800/50 pt-2.5">
                    <div className="flex items-center gap-2 w-full">
                      {/* Send to active (▶️ Reanudar) */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSendToActive(ticket.id);
                        }}
                        className="flex-1 py-2 px-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl active:scale-95 transition-all duration-200 cursor-pointer flex items-center justify-center gap-1 text-[11px] font-display font-extrabold shadow-md shadow-violet-950/20"
                        title="Reanudar ticket (Enviar a Activo)"
                      >
                        <Play size={12} className="fill-white" />
                        <span>Activar</span>
                      </button>

                      {/* Return to waiting list (🔄) */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onReturnToWaiting(ticket.id);
                        }}
                        className="py-2 px-3 bg-slate-950/80 hover:bg-slate-900 border border-slate-800 text-slate-300 hover:text-white rounded-xl active:scale-95 transition-all duration-200 cursor-pointer flex items-center justify-center gap-1 text-[11px] font-display font-bold"
                        title="Devolver a lista de Espera"
                      >
                        <ArrowLeft size={12} className="stroke-[2.5]" />
                        <span>A Espera</span>
                      </button>

                      {/* Permanent Delete */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmId(ticket.id);
                        }}
                        className="p-2 bg-slate-950/80 hover:bg-rose-950 hover:text-rose-400 hover:border-rose-900/40 border border-slate-800 rounded-xl active:scale-95 transition-all duration-200 cursor-pointer text-slate-500"
                        title="Eliminar permanentemente"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              </SwipeableTicket>
            );
          })}
        </div>
      )}
    </div>
  );
}
