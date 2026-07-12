import React, { useState, useEffect } from 'react';
import { Ticket } from '../types';
import { ArrowLeft, Play, Trash2, Clock, AlertCircle } from 'lucide-react';
import { formatTimeDuration } from '../utils/export';

interface MissingListProps {
  tickets: Ticket[];
  onSendToActive: (id: string) => void;
  onReturnToWaiting: (id: string) => void;
  onDeleteTicket: (id: string) => void;
  selectedMissingTicketId?: string | null;
  onSelectMissingTicket?: (id: string | null) => void;
  missingSelectedColor?: string;
}

export default function MissingList({
  tickets,
  onSendToActive,
  onReturnToWaiting,
  onDeleteTicket,
  selectedMissingTicketId = null,
  onSelectMissingTicket,
  missingSelectedColor = '#ef4444', // Red accent for disappeared/missing
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
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-slate-100 text-sm">Desaparecidos</h3>
          <span className="bg-red-950/60 text-red-400 font-mono text-xs font-bold px-2 py-0.5 rounded-full border border-red-900/40">
            {tickets.length}
          </span>
        </div>
        <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
          <AlertCircle size={11} />
          Perdidos
        </span>
      </div>

      {tickets.length === 0 ? (
        <div className="flex-1 border-2 border-dashed border-slate-800/80 rounded-xl p-4 flex flex-col items-center justify-center text-center text-slate-500 min-h-[120px]">
          <Clock className="stroke-1 mb-2 text-slate-600" size={24} />
          <p className="text-xs font-medium text-slate-400">Sin desaparecidos</p>
          <p className="text-[10px] text-slate-600 mt-1">Los tickets marcados como desaparecidos irán aquí.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto max-h-[420px] pr-1 space-y-2.5 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
          {tickets.map((ticket) => {
            const isConfirmingDelete = deleteConfirmId === ticket.id;
            const elapsedSeconds = ticket.completedAt 
              ? Math.max(0, Math.floor((timeState - ticket.completedAt) / 1000))
              : Math.max(0, Math.floor((timeState - ticket.createdAt) / 1000));

            if (isConfirmingDelete) {
              return (
                <div
                  key={ticket.id}
                  className="bg-red-950/50 border border-red-900/50 p-2.5 rounded-xl flex items-center justify-between animate-fadeIn duration-150"
                >
                  <div className="flex flex-col">
                    <span className="text-[10px] font-semibold text-red-300">
                      ¿Eliminar {ticket.number}?
                    </span>
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

            const isSelected = ticket.id === selectedMissingTicketId;
            const highlightStyle = isSelected && missingSelectedColor
              ? { borderColor: missingSelectedColor, boxShadow: `0 2px 8px ${missingSelectedColor}1a` }
              : {};

            return (
              <div
                key={ticket.id}
                onClick={() => onSelectMissingTicket && onSelectMissingTicket(ticket.id)}
                className={`p-2.5 rounded-xl flex flex-col gap-2 transition-all duration-150 border cursor-pointer group ${
                  isSelected
                    ? 'bg-red-950/20 border-red-500/50 shadow-md'
                    : 'bg-slate-950 border-slate-800/80 hover:border-slate-700/80'
                }`}
                style={highlightStyle}
              >
                {/* Header: Number and time */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono font-bold text-sm bg-slate-900 border ${
                      isSelected ? 'text-red-400 border-red-500/50' : 'text-slate-200 border-slate-800'
                    }`}>
                      {ticket.number}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] text-slate-500 font-mono">
                        Desaparecido hace:
                      </span>
                      <span className="text-[10px] text-red-400/80 font-mono font-semibold">
                        {formatTimeDuration(elapsedSeconds)}
                      </span>
                    </div>
                  </div>
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
                      className="p-1.5 bg-indigo-950 hover:bg-indigo-900 text-indigo-400 hover:text-indigo-200 border border-indigo-900/40 rounded-lg active:scale-90 transition-all cursor-pointer flex items-center gap-1 text-[10px] px-2"
                      title="Reanudar ticket (Enviar a Activo)"
                    >
                      <Play size={11} />
                      <span>Activar</span>
                    </button>

                    {/* Return to waiting list (🔄) */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onReturnToWaiting(ticket.id);
                      }}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-slate-100 border border-slate-700/40 rounded-lg active:scale-90 transition-all cursor-pointer flex items-center gap-1 text-[10px] px-1.5"
                      title="Devolver a lista de Espera"
                    >
                      <ArrowLeft size={11} />
                      <span>A Espera</span>
                    </button>

                    {/* Permanent Delete */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmId(ticket.id);
                      }}
                      className="p-1.5 bg-red-950/40 hover:bg-red-950 text-red-400 hover:text-red-200 border border-red-950/40 rounded-lg active:scale-90 transition-all cursor-pointer"
                      title="Eliminar permanentemente"
                    >
                      <Trash2 size={11} />
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
