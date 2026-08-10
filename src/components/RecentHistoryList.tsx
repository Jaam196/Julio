import React, { useState } from 'react';
import { Ticket } from '../types';
import { ArrowLeft, Trash2, CheckCircle, Clock, Tablet } from 'lucide-react';
import { formatTimeDuration } from '../utils/export';

interface RecentHistoryListProps {
  tickets: Ticket[];
  onRestoreTicket: (id: string) => void;
  onDeleteTicket: (id: string) => void;
}

export default function RecentHistoryList({
  tickets,
  onRestoreTicket,
  onDeleteTicket,
}: RecentHistoryListProps) {
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Get last 50 delivered tickets, newest first
  const recentDelivered = tickets
    .filter((t) => t.status === 'delivered')
    .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))
    .slice(0, 50);

  const confirmDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onDeleteTicket(id);
    setDeleteConfirmId(null);
  };

  return (
    <div className="border border-slate-800/60 bg-slate-900/40 backdrop-blur-md rounded-[22px] p-6 shadow-2xl flex flex-col h-full hover:border-slate-700/60 transition-all duration-300">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-slate-950/60 text-slate-300 rounded-xl border border-slate-800/60 shadow">
            <CheckCircle size={16} className="text-emerald-400" />
          </div>
          <div>
            <h3 className="font-display font-extrabold text-slate-100 text-sm leading-tight">Historial Reciente</h3>
            <p className="text-[10px] text-slate-400 font-medium">Últimos 50 tickets entregados</p>
          </div>
          <span className="ml-1 bg-slate-950/80 text-slate-400 font-mono text-xs font-bold px-2.5 py-0.5 rounded-full border border-slate-800/60">
            {recentDelivered.length}
          </span>
        </div>
      </div>

      {recentDelivered.length === 0 ? (
        <div className="flex-1 border-2 border-dashed border-slate-800/60 rounded-2xl p-6 flex flex-col items-center justify-center text-center text-slate-500 min-h-[140px]">
          <Clock className="stroke-1 mb-2 text-slate-600 animate-pulse" size={24} />
          <p className="text-xs font-bold text-slate-400 font-display">Sin entregas recientes</p>
          <p className="text-[10px] text-slate-500 mt-1 max-w-xs leading-relaxed">
            Los tickets que entregues aparecerán aquí.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto max-h-[300px] pr-1 space-y-2.5 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
          {recentDelivered.map((ticket) => {
            const isConfirmingDelete = deleteConfirmId === ticket.id;

            if (isConfirmingDelete) {
              return (
                <div
                  key={ticket.id}
                  className="bg-rose-950/30 border border-rose-500/30 p-3 rounded-2xl flex items-center justify-between animate-fadeIn shadow-md"
                >
                  <span className="text-[11px] font-display font-extrabold text-rose-300">¿BORRAR #{ticket.number}?</span>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={(e) => confirmDelete(e, ticket.id)}
                      className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white font-display font-extrabold text-[10px] rounded-lg cursor-pointer"
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

            return (
              <div
                key={ticket.id}
                className="p-3 bg-slate-900/30 border border-slate-800/60 rounded-xl flex items-center justify-between group hover:border-slate-700/60 transition-all duration-200"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-950/80 border border-slate-850/60 text-slate-300 font-mono font-black text-sm flex items-center justify-center shrink-0 shadow-sm">
                    {ticket.number}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-slate-300 font-mono font-bold">
                      Espera: {formatTimeDuration(ticket.totalTime || 0)}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                      <span>Entregado: {ticket.completedAt ? new Date(ticket.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''}</span>
                      {ticket.createdByDevice && (
                        <span className="ml-1 inline-flex items-center gap-1 bg-indigo-950/60 text-indigo-300 border border-indigo-800/40 px-1 py-0.5 rounded text-[9px] font-bold">
                          <Tablet size={8} className="text-indigo-400" />
                          <span>{ticket.createdByDevice}</span>
                        </span>
                      )}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
                  {/* Restore Button */}
                  <button
                    onClick={() => onRestoreTicket(ticket.id)}
                    className="p-2 bg-slate-950/80 hover:bg-slate-900 text-slate-400 hover:text-violet-400 border border-slate-800 rounded-xl transition-all duration-250 active:scale-90 cursor-pointer"
                    title="Restaurar ticket (mover de vuelta a Lista de Espera)"
                  >
                    <ArrowLeft size={12} className="stroke-[2.5]" />
                  </button>

                  {/* Delete Button */}
                  <button
                    onClick={() => setDeleteConfirmId(ticket.id)}
                    className="p-2 bg-slate-950/80 hover:bg-rose-950 hover:text-rose-400 hover:border-rose-900/30 border border-slate-850/60 rounded-xl transition-all duration-250 active:scale-90 cursor-pointer opacity-0 group-hover:opacity-100"
                    title="Eliminar de historial"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
