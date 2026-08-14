import React, { useState, useEffect, useRef } from 'react';
import { Ticket } from '../types';
import { Check, Volume2, Trash2, Clock, Info, Plus, Star, Tablet, Edit3, Save, AlertTriangle } from 'lucide-react';
import { formatTimeDuration } from '../utils/export';
import SwipeableTicket from './SwipeableTicket';
import { getTicketZones } from '../utils/ticketUtils';

interface WaitingListProps {
  tickets: Ticket[];
  onRaisePriority: (id: string) => void;
  onDeleteTicket: (id: string) => void;
  selectedWaitingTicketId?: string | null;
  onSelectWaitingTicket?: (id: string) => void;
  onContextMenu?: (e: React.MouseEvent, id: string) => void;
  waitingSelectedColor?: string;
  onAddDirectTicket?: (num: string) => void;
  isWaitlistPaused?: boolean;
  onToggleWaitlistPause?: () => void;
  onCallNow?: (id: string) => void;
  onTogglePriority?: (id: string) => void;
  onClearList?: () => void;
  onToggleTicketZone?: (ticketId: string, zoneId: string) => void;
  onUpdateTicketZoneName?: (ticketId: string, zoneId: string, newZoneName: string) => void;
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
  isWaitlistPaused = false,
  onToggleWaitlistPause,
  onCallNow,
  onTogglePriority,
  onClearList,
  onToggleTicketZone,
  onUpdateTicketZoneName,
}: WaitingListProps) {
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [timeState, setTimeState] = useState(Date.now());
  const [directNumber, setDirectNumber] = useState('');
  const [editingZoneKey, setEditingZoneKey] = useState<string | null>(null);
  const [editingZoneValue, setEditingZoneValue] = useState<string>('');
  const longPressTimerRef = useRef<{ [key: string]: NodeJS.Timeout }>({});

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

  // Dynamic ticking to update waiting times
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeState(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Long press event handlers for touch-based quick deletion
  const handlePressStart = (ticketId: string) => {
    if (longPressTimerRef.current[ticketId]) {
      clearTimeout(longPressTimerRef.current[ticketId]);
    }
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
    <div className="border border-slate-800/60 bg-slate-900/40 backdrop-blur-md rounded-[22px] p-6 shadow-2xl flex flex-col h-full hover:border-slate-700/60 transition-all duration-300">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
            <Clock size={18} className="animate-pulse" />
          </div>
          <div>
            <h3 className="font-display font-extrabold text-slate-100 text-lg leading-tight">Cola de Espera</h3>
            <p className="text-xs text-slate-400 font-medium">Tickets pendientes de preparación</p>
          </div>
          <span className="ml-1 bg-amber-500/15 text-amber-400 font-mono text-sm font-black px-3 py-0.5 rounded-full border border-amber-500/30 shadow-sm animate-pulse">
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
              title="Borrar todos los tickets de la lista de espera"
            >
              <Trash2 size={12} />
              <span>{confirmClearAll ? '¿Confirmar vaciar?' : 'Vaciar lista'}</span>
            </button>
          )}
          <span className="text-[10px] text-slate-500 font-mono font-medium hidden sm:flex items-center gap-1">
            <Info size={11} />
            Haz clic o pulsa para seleccionar
          </span>
        </div>
      </div>

      {/* Waitlist Pause Control and Indicator */}
      {onToggleWaitlistPause && (
        <div className="mb-4 p-3 rounded-2xl bg-slate-950/40 border border-slate-850/60 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-inner">
          <div className="flex items-center gap-2">
            {isWaitlistPaused ? (
              <span className="text-xs font-black text-amber-400 flex items-center gap-1.5 bg-amber-500/10 px-3 py-1 rounded-xl border border-amber-500/30 shadow-sm animate-pulse">
                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full"></span>
                SISTEMA EN PAUSA
              </span>
            ) : (
              <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5 bg-slate-900/40 px-3 py-1 rounded-xl border border-slate-800/40">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
                SERVICIO ACTIVO
              </span>
            )}
          </div>
          
          <button
            type="button"
            onClick={onToggleWaitlistPause}
            className={`w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-display font-extrabold cursor-pointer transition-all duration-200 active:scale-95 ${
              isWaitlistPaused
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-900/80 hover:bg-slate-850 text-slate-300 border border-slate-800'
            }`}
          >
            {isWaitlistPaused ? 'Reanudar Cola' : 'Pausar Cola'}
          </button>
        </div>
      )}

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
            placeholder="Añadir ticket rápido (3 dígitos para auto-añadir)..."
            value={directNumber}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, '');
              setDirectNumber(val);
              if (val.length === 3) {
                onAddDirectTicket(val);
                setDirectNumber('');
              }
            }}
            className="flex-1 px-4 py-2 bg-slate-950/60 border border-slate-800/80 rounded-xl text-sm font-mono text-slate-200 placeholder:text-slate-600 focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/10 outline-none transition-all duration-200 shadow-inner"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-violet-600/15 hover:bg-violet-600 text-violet-400 hover:text-white border border-violet-500/20 rounded-xl text-xs font-display font-extrabold active:scale-95 transition-all duration-200 flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Plus size={14} />
            <span>Añadir</span>
          </button>
        </form>
      )}

      {tickets.length === 0 ? (
        <div className="flex-1 border-2 border-dashed border-slate-800/60 rounded-2xl p-8 flex flex-col items-center justify-center text-center text-slate-500 min-h-[220px]">
          <Clock className="stroke-1 mb-2 animate-pulse text-slate-600" size={36} />
          <p className="text-sm font-bold text-slate-400 font-display">Cola de Espera Vacía</p>
          <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
            No hay tickets pendientes. Los nuevos pedidos manuales o detectados por OCR aparecerán aquí.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto max-h-[500px] pr-1 space-y-3.5 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
          {tickets.map((ticket) => {
            const isConfirmingDelete = deleteConfirmId === ticket.id;
            const waitingSeconds = Math.max(0, Math.floor((timeState - ticket.createdAt) / 1000));
            
            if (isConfirmingDelete) {
              return (
                <div
                  key={ticket.id}
                  className="bg-rose-950/30 border border-rose-500/30 p-4 rounded-2xl flex items-center justify-between animate-fadeIn transition-all duration-200 shadow-md"
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-display font-extrabold text-rose-300 uppercase tracking-wider">
                      ¿ELIMINAR TICKET #{ticket.number}?
                    </span>
                    <span className="text-[10px] text-rose-400 font-mono font-medium">Esta acción no se puede deshacer</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => confirmDelete(e, ticket.id)}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-display font-extrabold text-xs rounded-xl active:scale-95 transition-all cursor-pointer shadow-md shadow-rose-950/20"
                    >
                      Sí
                    </button>
                    <button
                      onClick={cancelDelete}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-display font-medium text-xs rounded-xl active:scale-95 transition-all cursor-pointer"
                    >
                      No
                    </button>
                  </div>
                </div>
              );
            }

            const isSelected = ticket.id === selectedWaitingTicketId;
            const zones = getTicketZones(ticket);

            const highlightStyle = isSelected && waitingSelectedColor
              ? { borderColor: waitingSelectedColor, boxShadow: `0 4px 18px ${waitingSelectedColor}1f` }
              : {};

            // Calculate progress of target waiting time (300 seconds = 5 minutes threshold)
            const waitPercent = Math.min(100, (waitingSeconds / 300) * 100);

            return (
              <SwipeableTicket
                key={ticket.id}
                id={ticket.id}
                onSwipeLeft={() => onDeleteTicket(ticket.id)}
                onSwipeRight={() => onRaisePriority(ticket.id)}
                swipeLeftLabel="Eliminar"
                swipeRightLabel="Listo"
                swipeLeftIcon={<Trash2 size={18} />}
                swipeRightIcon={<Check size={18} />}
                swipeLeftColorClass="bg-rose-600/90"
                swipeRightColorClass="bg-emerald-600/90"
              >
                <div
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
                  className={`relative p-4 rounded-2xl flex flex-col gap-3 transition-all duration-200 select-none cursor-pointer group border overflow-hidden ${
                    isSelected
                      ? 'bg-violet-950/20 border-violet-500 shadow-xl scale-102'
                      : ticket.isPriority
                      ? 'bg-amber-500/5 border-amber-500/40 hover:border-amber-500 active:bg-amber-500/10 shadow-lg shadow-amber-500/5'
                      : 'bg-slate-900/30 border-slate-800/60 hover:border-slate-700/60 active:bg-slate-900/50 shadow-md'
                  }`}
                  style={highlightStyle}
                  title="Haz clic para seleccionar"
                >
                  {/* Dynamic subtle amber/gold bottom timeline for elapsed wait time */}
                  <div 
                    className={`absolute bottom-0 left-0 h-0.5 transition-all duration-1000 ${
                      ticket.isPriority 
                        ? 'bg-gradient-to-r from-amber-500 to-rose-500' 
                        : 'bg-gradient-to-r from-violet-500 to-indigo-500'
                    }`}
                    style={{ width: `${waitPercent}%` }}
                  ></div>

                  {/* Header row: Ticket number and waiting metrics + master actions */}
                  <div className="flex items-center justify-between gap-2 z-10 border-b border-slate-800/60 pb-2.5">
                    <div className="flex items-center gap-3">
                      <div className={`w-13 h-13 bg-slate-950/80 border rounded-2xl flex items-center justify-center font-mono font-black text-2xl transition-all duration-200 ${
                        isSelected 
                          ? 'text-violet-400 border-violet-500 shadow-md shadow-violet-500/10' 
                          : ticket.isPriority
                          ? 'border-amber-500/50 text-amber-400 shadow-inner shadow-amber-500/10'
                          : 'border-slate-800 text-slate-100 group-hover:text-violet-400 group-hover:border-slate-700'
                      }`}
                      style={isSelected && waitingSelectedColor ? { borderColor: waitingSelectedColor, color: waitingSelectedColor } : {}}>
                        #{ticket.number}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs text-slate-300 font-mono font-bold flex items-center gap-1.5">
                          <Clock size={12} className={isSelected ? 'text-violet-400 animate-pulse' : ticket.isPriority ? 'text-amber-400' : 'text-slate-500'} />
                          <span>Espera: {formatTimeDuration(waitingSeconds)}</span>
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono font-medium flex items-center gap-1">
                          <span>Entrada: {new Date(ticket.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                          {ticket.createdByDevice && (
                            <span className="ml-1 inline-flex items-center gap-1 bg-indigo-950/60 text-indigo-300 border border-indigo-800/40 px-1.5 py-0.5 rounded text-[9px] font-bold">
                              <Tablet size={9} className="text-indigo-400" />
                              <span>{ticket.createdByDevice}</span>
                            </span>
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Right part: Master action controls */}
                    <div className="flex items-center gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
                      {/* ⭐ VIP Priority Toggle */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onTogglePriority) {
                            onTogglePriority(ticket.id);
                          } else {
                            onRaisePriority(ticket.id);
                          }
                        }}
                        className={`p-2 rounded-xl transition-all duration-200 active:scale-90 cursor-pointer border ${
                          ticket.isPriority
                            ? 'bg-amber-500 border-amber-600 text-slate-950 hover:bg-amber-400 shadow-md'
                            : 'bg-slate-950/80 hover:bg-slate-900 border-slate-800 text-slate-400 hover:text-amber-400'
                        }`}
                        title={ticket.isPriority ? "Quitar Prioridad VIP" : "Marcar como Prioridad VIP / Urgente"}
                      >
                        <Star size={13} fill={ticket.isPriority ? "currentColor" : "none"} />
                      </button>

                      {/* ✅ Mark Ready button (Green - Completes entire ticket) */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRaisePriority(ticket.id);
                        }}
                        className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500/20 rounded-xl transition-all duration-200 active:scale-90 cursor-pointer shadow-md shadow-emerald-950/30 hover:shadow-emerald-500/15"
                        title="Marcar Todo como Listo"
                      >
                        <Check size={13} className="stroke-[3]" />
                      </button>

                      {/* 📢 Announce Speaker button */}
                      {onCallNow && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onCallNow(ticket.id);
                          }}
                          className="p-2 bg-slate-950/80 hover:bg-slate-900 border border-slate-800 text-violet-400 hover:text-violet-300 rounded-xl transition-all duration-200 active:scale-90 cursor-pointer"
                          title="Anunciar por altavoz"
                        >
                          <Volume2 size={13} />
                        </button>
                      )}

                      {/* 🗑️ Trash button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmId(ticket.id);
                        }}
                        className="p-2 bg-slate-950/80 hover:bg-rose-950 hover:text-rose-400 hover:border-rose-900/30 border border-slate-800 text-slate-500 rounded-xl transition-all duration-200 active:scale-90 cursor-pointer"
                        title="Eliminar ticket"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Zones Breakdown Section */}
                  <div className="z-10 flex flex-col gap-1.5 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60">
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
                      <span>Zonas del Pedido</span>
                      <span className="font-mono text-slate-500">
                        {zones.filter((z) => z.status === 'completed').length}/{zones.length} completadas
                      </span>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      {zones.map((z) => {
                        const isCompleted = z.status === 'completed';
                        const isUnassigned = z.zone === 'Sin asignar' || z.zone === 'manual' || !z.zone;
                        const isEditing = editingZoneKey === `${ticket.id}:${z.id}`;

                        return (
                          <div
                            key={z.id}
                            onClick={(e) => e.stopPropagation()}
                            className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-all ${
                              isCompleted
                                ? 'bg-emerald-950/25 border-emerald-500/40 text-emerald-200'
                                : 'bg-slate-900/80 border-slate-800 text-slate-200'
                            }`}
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span
                                className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                                  isCompleted ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-amber-500 animate-pulse shadow-sm shadow-amber-500/50'
                                }`}
                              />

                              {isEditing ? (
                                <div className="flex items-center gap-1.5 flex-1">
                                  <input
                                    type="text"
                                    value={editingZoneValue}
                                    onChange={(e) => setEditingZoneValue(e.target.value)}
                                    placeholder="Nombre de la zona..."
                                    className="px-2 py-0.5 text-xs bg-slate-950 border border-violet-500 rounded text-white focus:outline-none w-32"
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        if (onUpdateTicketZoneName && editingZoneValue.trim()) {
                                          onUpdateTicketZoneName(ticket.id, z.id, editingZoneValue.trim());
                                        }
                                        setEditingZoneKey(null);
                                      } else if (e.key === 'Escape') {
                                        setEditingZoneKey(null);
                                      }
                                    }}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (onUpdateTicketZoneName && editingZoneValue.trim()) {
                                        onUpdateTicketZoneName(ticket.id, z.id, editingZoneValue.trim());
                                      }
                                      setEditingZoneKey(null);
                                    }}
                                    className="p-1 bg-violet-600 hover:bg-violet-500 text-white rounded text-xs"
                                  >
                                    <Save size={12} />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  {isUnassigned ? (
                                    <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
                                      <AlertTriangle size={12} className="text-amber-400 shrink-0" />
                                      <span>Zona no identificada</span>
                                    </span>
                                  ) : (
                                    <span className={`text-xs font-bold truncate ${isCompleted ? 'line-through text-emerald-400 opacity-80' : 'text-slate-100'}`}>
                                      {z.zone}
                                    </span>
                                  )}

                                  {onUpdateTicketZoneName && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingZoneKey(`${ticket.id}:${z.id}`);
                                        setEditingZoneValue(isUnassigned ? '' : z.zone);
                                      }}
                                      className="p-1 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                                      title="Editar nombre de la zona"
                                    >
                                      <Edit3 size={11} />
                                    </button>
                                  )}
                                </div>
                              )}

                              <span
                                className={`text-[9px] font-mono px-2 py-0.5 rounded font-bold shrink-0 ${
                                  isCompleted
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                }`}
                              >
                                {isCompleted ? 'Completado' : 'Pendiente'}
                              </span>
                            </div>

                            {/* Individual Zone Completion Button */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onToggleTicketZone) {
                                  onToggleTicketZone(ticket.id, z.id);
                                } else {
                                  onRaisePriority(ticket.id);
                                }
                              }}
                              className={`ml-2 px-2.5 py-1 rounded-md text-xs font-extrabold flex items-center gap-1 transition-all cursor-pointer ${
                                isCompleted
                                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-950/40'
                                  : 'bg-slate-800 hover:bg-amber-600 text-amber-300 hover:text-white border border-slate-700/80'
                              }`}
                              title={isCompleted ? 'Marcar zona como pendiente' : 'Marcar esta zona como completada'}
                            >
                              <Check size={13} className={isCompleted ? 'stroke-[3]' : ''} />
                              <span>{isCompleted ? 'Listo' : 'Completar'}</span>
                            </button>
                          </div>
                        );
                      })}
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
