import React, { useState, useEffect, useRef } from 'react';
import { Ticket } from '../types';
import { ArrowUp, Trash2, Clock, Info, Plus } from 'lucide-react';
import { formatTimeDuration } from '../utils/export';

interface WaitingListProps {
  tickets: Ticket[];
  onRaisePriority: (id: string) => void;
  onDeleteTicket: (id: string) => void;
  selectedWaitingTicketId?: string | null;
  onSelectWaitingTicket?: (id: string) => void;
  onContextMenu?: (e: React.MouseEvent, id: string) => void;
  waitingSelectedColor?: string;
  onAddDirectTicket?: (num: string) => void;
}

export default function WaitingList({
  tickets,
  onRaisePriority,
  onDeleteTicket,
  selectedWaitingTicketId = null,
  onSelectWaitingTicket,
  onContextMenu,
  waitingSelectedColor = '#4f46e5',
  onAddDirectTicket,
}: WaitingListProps) {
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [timeState, setTimeState] = useState(Date.now());
  const [directNumber, setDirectNumber] = useState('');
  const longPressTimerRef = useRef<{ [key: string]: NodeJS.Timeout }>({});

  // Dynamic ticking to update waiting times
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeState(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Long press event handlers
  const handlePressStart = (ticketId: string) => {
    // Clear any existing timer for safety
    if (longPressTimerRef.current[ticketId]) {
      clearTimeout(longPressTimerRef.current[ticketId]);
    }
    
    // Start 800ms timer
    longPressTimerRef.current[ticketId] = setTimeout(() => {
      setDeleteConfirmId(ticketId);
    }, 800);
  };

  const handlePressEnd = (ticketId: string) => {
    if (longPressTimerRef.current[ticketId]) {
      clearTimeout(longPressTimerRef.current[ticketId]);
    }
  };

  const cancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirmId(null);
  };

  const confirmDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onDeleteTicket(id);
    setDeleteConfirmId(null);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-slate-100 text-lg">Lista de Espera</h3>
          <span className="bg-indigo-950 text-indigo-400 font-mono text-xs font-bold px-2.5 py-0.5 rounded-full border border-indigo-900/50">
            {tickets.length}
          </span>
        </div>
        <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
          <Info size={11} />
          Mantén pulsado un ticket para eliminarlo
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
          className="mb-4 flex gap-2"
        >
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={3}
            placeholder="Añadir nº..."
            value={directNumber}
            onChange={(e) => setDirectNumber(e.target.value.replace(/\D/g, ''))}
            className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:border-indigo-500 outline-none transition-all"
          />
          <button
            type="submit"
            className="px-3 py-1.5 bg-indigo-950 hover:bg-indigo-900 border border-indigo-900/50 text-indigo-400 hover:text-indigo-200 rounded-xl text-xs font-semibold active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
          >
            <Plus size={14} />
            <span>Añadir</span>
          </button>
        </form>
      )}

      {tickets.length === 0 ? (
        <div className="flex-1 border-2 border-dashed border-slate-800/80 rounded-xl p-8 flex flex-col items-center justify-center text-center text-slate-500 min-h-[180px]">
          <Clock className="stroke-1 mb-2 animate-pulse" size={32} />
          <p className="text-sm font-medium text-slate-400">Cola vacía</p>
          <p className="text-xs text-slate-600 mt-1">Los nuevos tickets irán apareciendo aquí.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto max-h-[420px] pr-1 space-y-2.5 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
          {tickets.map((ticket) => {
            const isConfirmingDelete = deleteConfirmId === ticket.id;
            const waitingSeconds = Math.max(0, Math.floor((timeState - ticket.createdAt) / 1000));
            
            if (isConfirmingDelete) {
              return (
                <div
                  key={ticket.id}
                  className="bg-red-950/60 border border-red-900/60 p-3 rounded-xl flex items-center justify-between animate-fadeIn transition-all duration-200"
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-red-300 uppercase tracking-wider">
                      ¿Eliminar ticket {ticket.number}?
                    </span>
                    <span className="text-[10px] text-red-400 font-mono">Esta acción no se puede deshacer</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => confirmDelete(e, ticket.id)}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-lg active:scale-95 transition-all cursor-pointer"
                    >
                      Sí
                    </button>
                    <button
                      onClick={cancelDelete}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs rounded-lg active:scale-95 transition-all cursor-pointer"
                    >
                      No
                    </button>
                  </div>
                </div>
              );
            }

            const isSelected = ticket.id === selectedWaitingTicketId;

            const highlightStyle = isSelected && waitingSelectedColor
              ? { borderColor: waitingSelectedColor, boxShadow: `0 4px 12px ${waitingSelectedColor}1a` }
              : {};

            return (
              <div
                key={ticket.id}
                onMouseDown={() => handlePressStart(ticket.id)}
                onMouseUp={() => {
                  handlePressEnd(ticket.id);
                  if (onSelectWaitingTicket) onSelectWaitingTicket(ticket.id);
                }}
                onMouseLeave={() => handlePressEnd(ticket.id)}
                onTouchStart={() => handlePressStart(ticket.id)}
                onTouchEnd={() => {
                  handlePressEnd(ticket.id);
                  if (onSelectWaitingTicket) onSelectWaitingTicket(ticket.id);
                }}
                onContextMenu={(e) => onContextMenu && onContextMenu(e, ticket.id)}
                className={`p-3 rounded-xl flex items-center justify-between transition-all duration-150 select-none cursor-pointer group border ${
                  isSelected
                    ? 'bg-indigo-950/40 border-2 shadow-lg'
                    : 'bg-slate-950 border-slate-800/80 hover:border-slate-700/80 active:bg-slate-900'
                }`}
                style={highlightStyle}
                title="Mantén pulsado para eliminar, clic para seleccionar"
              >
                {/* Left part: Ticket number */}
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 bg-slate-900 border rounded-lg flex items-center justify-center font-mono font-bold text-xl transition-colors ${
                    isSelected 
                      ? 'text-indigo-400 shadow-sm shadow-indigo-500/20' 
                      : 'border-slate-800 text-slate-100 group-hover:text-indigo-400'
                  }`}
                  style={isSelected && waitingSelectedColor ? { borderColor: waitingSelectedColor, color: waitingSelectedColor } : {}}>
                    {ticket.number}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
                      <Clock size={11} className={isSelected ? 'text-indigo-400' : 'text-slate-500'} />
                      Espera: {formatTimeDuration(waitingSeconds)}
                    </span>
                    <span className="text-[10px] text-slate-600 font-mono">
                      Entrada: {new Date(ticket.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                </div>

                {/* Right part: Action controls */}
                <div className="flex items-center gap-2">
                  {isSelected && (
                    <span className="text-[9px] bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 px-2 py-0.5 rounded-full font-mono font-extrabold animate-pulse">
                      ACTIVO
                    </span>
                  )}
                  <div className="flex items-center gap-1">
                    {/* Raise priority button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRaisePriority(ticket.id);
                      }}
                      className={`p-2.5 border rounded-lg transition-all active:scale-90 cursor-pointer ${
                        isSelected 
                          ? 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500 shadow-md' 
                          : 'bg-indigo-950 hover:bg-indigo-900 text-indigo-400 hover:text-indigo-200 border-indigo-900/50'
                      }`}
                      title="Subir prioridad (pasa a ser el ticket activo)"
                    >
                      <ArrowUp size={16} />
                    </button>

                    {/* Desktop support: small trash can so mouse users don't have to guess long press */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmId(ticket.id);
                      }}
                      className={`p-2.5 border rounded-lg transition-all active:scale-90 cursor-pointer ${
                        isSelected 
                          ? 'bg-slate-900 hover:bg-red-950 hover:text-red-400 border-indigo-500/30 text-slate-400' 
                          : 'bg-slate-900 hover:bg-red-950 hover:text-red-400 border-slate-800 hover:border-red-900/40 text-slate-500 opacity-0 group-hover:opacity-100'
                      }`}
                      title="Eliminar ticket"
                    >
                      <Trash2 size={15} />
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
