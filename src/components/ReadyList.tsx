import React, { useState, useEffect } from 'react';
import { Ticket } from '../types';
import { Check, Volume2, ArrowRightLeft, Trash2, Clock, Info, Tablet } from 'lucide-react';
import { formatTimeDuration } from '../utils/export';
import SwipeableTicket from './SwipeableTicket';

interface ReadyListProps {
  tickets: Ticket[];
  onDeliver: (id: string) => void;
  onCallNow: (id: string) => void;
  onReturnToWaiting: (id: string) => void;
  onDeleteTicket: (id: string) => void;
  activeGlowColor?: string;
  selectedReadyTicketId?: string | null;
  onSelectReadyTicket?: (id: string) => void;
  onClearList?: () => void;
}

export default function ReadyList({
  tickets,
  onDeliver,
  onCallNow,
  onReturnToWaiting,
  onDeleteTicket,
  activeGlowColor = '#10b981',
  selectedReadyTicketId = null,
  onSelectReadyTicket,
  onClearList,
}: ReadyListProps) {
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [timeState, setTimeState] = useState(Date.now());

  const handleClearAllClick = () => {
    if (confirmClearAll) {
      setConfirmClearAll(false);
      if (onClearList) {
        onClearList();
      } else {
        tickets.forEach((t) => onDeleteTicket(t.id));
      }
    } else {
      setConfirmClearAll(true);
      setTimeout(() => setConfirmClearAll(false), 4000);
    }
  };

  // Dynamic ticking to update elapsed times since completed (ready)
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

  const sortedReady = [...tickets].sort((a, b) => {
    const timeA = a.completedAt || a.createdAt || 0;
    const timeB = b.completedAt || b.createdAt || 0;
    return timeB - timeA; // newest first
  });

  return (
    <div className="border border-slate-800/60 bg-slate-900/40 backdrop-blur-md rounded-[22px] p-6 shadow-2xl flex flex-col h-full hover:border-slate-700/60 transition-all duration-300">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-450 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </div>
          <div>
            <h3 className="font-display font-extrabold text-slate-100 text-base leading-tight">Pedidos Listos</h3>
            <p className="text-xs text-slate-400 font-medium">Anunciados en pantalla TV</p>
          </div>
          <span className="ml-1 bg-emerald-500/15 text-emerald-400 font-mono text-sm font-black px-3 py-0.5 rounded-full border border-emerald-500/30 shadow-sm animate-pulse">
            {tickets.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {tickets.length > 0 && (
            <button
              type="button"
              onClick={handleClearAllClick}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer shadow-sm ${
                confirmClearAll
                  ? 'bg-rose-600 text-white border border-rose-400 animate-pulse'
                  : 'text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20'
              }`}
              title="Borrar todos los pedidos de la lista de listos"
            >
              <Trash2 size={12} />
              <span>{confirmClearAll ? '¿Confirmar vaciar?' : 'Vaciar lista'}</span>
            </button>
          )}
          <span className="text-[10px] text-slate-500 font-mono font-bold hidden sm:flex items-center gap-1">
            <Info size={11} />
            Canal TV Activo
          </span>
        </div>
      </div>

      {sortedReady.length === 0 ? (
        <div className="flex-1 border-2 border-dashed border-slate-800/60 rounded-2xl p-6 flex flex-col items-center justify-center text-center text-slate-500 min-h-[180px]">
          <Clock className="stroke-1 mb-2 text-slate-600 animate-pulse animate-soft-pulse" size={32} />
          <p className="text-sm font-bold text-slate-400 font-display">Sin Pedidos Listos</p>
          <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
            Ninguno en este momento. Los pedidos que marques listos pasarán a esta sección.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto max-h-[500px] pr-1 space-y-3.5 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
          {sortedReady.map((ticket) => {
            const isConfirmingDelete = deleteConfirmId === ticket.id;
            const now = Date.now();
            const completedAt = ticket.completedAt || ticket.createdAt || now;
            const elapsedReadySeconds = Math.max(0, Math.floor((timeState - completedAt) / 1000));
            const isNew = now - completedAt < 20000; // highlighted green if under 20s
            
            const isSelected = ticket.id === selectedReadyTicketId;

            if (isConfirmingDelete) {
              return (
                <div
                  key={ticket.id}
                  className="bg-rose-950/30 border border-rose-500/30 p-3.5 rounded-2xl flex items-center justify-between animate-fadeIn shadow-md"
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-display font-extrabold text-rose-300 uppercase tracking-wider">
                      ¿BORRAR #{ticket.number}?
                    </span>
                    <span className="text-[10px] text-rose-400 font-mono font-medium">Operación irreversible</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => confirmDelete(e, ticket.id)}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-display font-extrabold text-xs rounded-xl active:scale-95 transition-all cursor-pointer shadow-md shadow-rose-950/20"
                    >
                      Sí
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmId(null);
                      }}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-display font-medium text-xs rounded-xl active:scale-95 transition-all cursor-pointer"
                    >
                      No
                    </button>
                  </div>
                </div>
              );
            }

            const highlightStyle = isSelected && activeGlowColor
              ? { borderColor: activeGlowColor, boxShadow: `0 4px 18px ${activeGlowColor}1f` }
              : {};

            return (
              <SwipeableTicket
                key={ticket.id}
                id={ticket.id}
                onSwipeLeft={() => onDeleteTicket(ticket.id)}
                onSwipeRight={() => onDeliver(ticket.id)}
                swipeLeftLabel="Eliminar"
                swipeRightLabel="Entregar"
                swipeLeftIcon={<Trash2 size={18} />}
                swipeRightIcon={<Check size={18} />}
                swipeLeftColorClass="bg-rose-600/90"
                swipeRightColorClass="bg-emerald-600/90"
              >
                <div
                  onClick={() => onSelectReadyTicket && onSelectReadyTicket(ticket.id)}
                  className={`p-3.5 rounded-2xl flex flex-col gap-2.5 transition-all duration-200 select-none cursor-pointer group border ${
                    isSelected
                      ? 'bg-emerald-950/20 border-emerald-500 shadow-xl'
                      : isNew 
                        ? 'bg-emerald-500/5 border-emerald-500/40 hover:border-emerald-500 shadow-lg shadow-emerald-500/5 animate-soft-pulse'
                        : 'bg-slate-900/30 border-slate-800/60 hover:border-slate-700/60'
                  }`}
                  style={highlightStyle}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-mono font-black text-lg border transition-all duration-200 ${
                        isSelected 
                          ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500 shadow-md shadow-emerald-500/10' 
                          : isNew
                            ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-400'
                            : 'bg-slate-950/80 border-slate-800 text-slate-100 group-hover:text-emerald-400 group-hover:border-slate-700'
                      }`}
                      style={isSelected && activeGlowColor ? { borderColor: activeGlowColor, color: activeGlowColor } : {}}>
                        {ticket.number}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs text-slate-300 font-mono font-bold flex items-center gap-1.5">
                          <Clock size={12} className="text-emerald-400 animate-pulse" />
                          <span>Listo hace: {formatTimeDuration(elapsedReadySeconds)}</span>
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono font-medium flex items-center gap-1">
                          <span>Creado: {new Date(ticket.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                          {ticket.createdByDevice && (
                            <span className="ml-1 inline-flex items-center gap-1 bg-indigo-950/60 text-indigo-300 border border-indigo-800/40 px-1.5 py-0.5 rounded text-[9px] font-bold">
                              <Tablet size={9} className="text-indigo-400" />
                              <span>{ticket.createdByDevice}</span>
                            </span>
                          )}
                        </span>
                      </div>
                    </div>

                    {isNew && (
                      <span className="text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-lg font-mono font-black tracking-wide animate-bounce">
                        NUEVO
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-1.5 mt-0.5 border-t border-slate-800/50 pt-2.5">
                    <div className="flex items-center gap-2 w-full">
                      {/* ✔ Entregado */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeliver(ticket.id);
                        }}
                        className="flex-1 py-2 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl active:scale-95 transition-all duration-200 cursor-pointer shadow-md shadow-emerald-950/20 text-xs font-display font-extrabold flex items-center justify-center gap-1.5"
                        title="Marcar como entregado (pasa a Historial)"
                      >
                        <Check size={13} className="stroke-[2.5]" />
                        <span>Entregar</span>
                      </button>

                      {/* 📢 Repetir anuncio */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onCallNow(ticket.id);
                        }}
                        className="py-2 px-3 bg-slate-950/80 hover:bg-slate-900 text-violet-400 hover:text-violet-300 border border-slate-800 rounded-xl active:scale-95 transition-all duration-200 cursor-pointer text-xs font-display font-bold flex items-center justify-center gap-1"
                        title="Volver a anunciar por voz"
                      >
                        <Volume2 size={13} />
                        <span>Llamar</span>
                      </button>

                      {/* ↩ Volver a Espera */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onReturnToWaiting(ticket.id);
                        }}
                        className="py-2 px-3 bg-slate-950/80 hover:bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800 rounded-xl active:scale-95 transition-all duration-200 cursor-pointer text-xs font-display font-bold flex items-center justify-center gap-1"
                        title="Mover de vuelta a Cola de Espera"
                      >
                        <ArrowRightLeft size={13} />
                        <span>Espera</span>
                      </button>

                      {/* 🗑️ Eliminar */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmId(ticket.id);
                        }}
                        className="p-2 bg-slate-950/80 hover:bg-rose-950 hover:text-rose-400 hover:border-rose-900/40 border border-slate-800 rounded-xl active:scale-95 transition-all duration-200 cursor-pointer text-slate-500"
                        title="Eliminar definitivamente"
                      >
                        <Trash2 size={13} />
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
