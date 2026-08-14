import React, { useState } from 'react';
import { Ticket } from '../types';
import { Search, Calendar, Trash2, FileText, Download, CheckCircle, HelpCircle, RefreshCw, Clock, ArrowLeft, AlertCircle, Tablet } from 'lucide-react';
import { exportToPDF, exportToExcel, formatDate, formatTimeDuration } from '../utils/export';

interface HistoryPanelProps {
  tickets: Ticket[];
  onDeleteTicket: (id: string) => void;
  onClearHistory: (status: 'delivered' | 'missing' | 'pending_history') => void;
  onRestoreTicket?: (id: string) => void;
}

export default function HistoryPanel({ tickets, onDeleteTicket, onClearHistory, onRestoreTicket }: HistoryPanelProps) {
  const [activeTab, setActiveTab] = useState<'delivered' | 'missing' | 'pending_history'>('delivered');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Filter history items by type, search query and date
  const historyItems = tickets.filter((t) => {
    // Correct status
    if (activeTab === 'pending_history') {
      // Show if it has been marked pending AND is not currently active, waiting, or actively pending
      if (!t.pendingAt || t.status === 'active' || t.status === 'waiting' || t.status === 'pending') return false;
    } else {
      if (t.status !== activeTab) return false;
    }

    // Search query matches ticket number
    if (searchQuery && !t.number.includes(searchQuery)) return false;

    // Date filter matches ticket creation/completion date
    if (dateFilter) {
      const ticketDateStr = new Date(t.completedAt || t.createdAt).toISOString().split('T')[0];
      if (ticketDateStr !== dateFilter) return false;
    }

    return true;
  });

  const handleExportPDF = () => {
    exportToPDF(historyItems, activeTab);
  };

  const handleExportExcel = () => {
    exportToExcel(historyItems, activeTab);
  };

  const handleClearHistory = () => {
    const label = activeTab === 'delivered' 
      ? 'Entregados' 
      : activeTab === 'missing' 
      ? 'Desaparecidos' 
      : 'Pendientes Históricos';
    if (window.confirm(`¿Estás seguro de que deseas vaciar el historial de ${label}?`)) {
      onClearHistory(activeTab);
    }
  };

  return (
    <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/60 rounded-[22px] p-6 shadow-2xl flex flex-col h-full space-y-6">
      
      {/* Tab toggle buttons */}
      <div className="flex bg-slate-950/60 p-1.5 rounded-2xl border border-slate-800/50 gap-1.5 flex-wrap sm:flex-nowrap">
        <button
          onClick={() => {
            setActiveTab('delivered');
            setSearchQuery('');
            setDateFilter('');
            setDeleteConfirmId(null);
          }}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-display font-bold flex items-center justify-center gap-2 transition-all duration-300 cursor-pointer ${
            activeTab === 'delivered'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.1)]'
              : 'border border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
          }`}
        >
          <CheckCircle size={14} className={activeTab === 'delivered' ? 'text-emerald-400' : 'text-slate-500'} />
          <span>Tickets Entregados</span>
          <span className={`px-2 py-0.5 text-[10px] rounded-full font-mono font-black ${
            activeTab === 'delivered' ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-900/30' : 'bg-slate-900 text-slate-500'
          }`}>
            {tickets.filter(t => t.status === 'delivered').length}
          </span>
        </button>

        <button
          onClick={() => {
            setActiveTab('missing');
            setSearchQuery('');
            setDateFilter('');
            setDeleteConfirmId(null);
          }}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-display font-bold flex items-center justify-center gap-2 transition-all duration-300 cursor-pointer ${
            activeTab === 'missing'
              ? 'bg-rose-500/10 border border-rose-500/30 text-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.1)]'
              : 'border border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
          }`}
        >
          <HelpCircle size={14} className={activeTab === 'missing' ? 'text-rose-400' : 'text-slate-500'} />
          <span>Tickets Perdidos</span>
          <span className={`px-2 py-0.5 text-[10px] rounded-full font-mono font-black ${
            activeTab === 'missing' ? 'bg-rose-950/80 text-rose-400 border border-rose-900/30' : 'bg-slate-900 text-slate-500'
          }`}>
            {tickets.filter(t => t.status === 'missing').length}
          </span>
        </button>

        <button
          onClick={() => {
            setActiveTab('pending_history');
            setSearchQuery('');
            setDateFilter('');
            setDeleteConfirmId(null);
          }}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-display font-bold flex items-center justify-center gap-2 transition-all duration-300 cursor-pointer ${
            activeTab === 'pending_history'
              ? 'bg-amber-500/10 border border-amber-500/30 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.1)]'
              : 'border border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
          }`}
        >
          <Clock size={14} className={activeTab === 'pending_history' ? 'text-amber-400' : 'text-slate-500'} />
          <span>Historial Pendientes</span>
          <span className={`px-2 py-0.5 text-[10px] rounded-full font-mono font-black ${
            activeTab === 'pending_history' ? 'bg-amber-950/80 text-amber-400 border border-amber-900/30' : 'bg-slate-900 text-slate-500'
          }`}>
            {tickets.filter(t => t.pendingAt && t.status !== 'active' && t.status !== 'waiting' && t.status !== 'pending').length}
          </span>
        </button>
      </div>

      {/* Filter and Action bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Search Input */}
        <div className="relative">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por número..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950/60 border border-slate-800/80 rounded-xl pl-10 pr-3 py-2 text-xs text-slate-100 placeholder:text-slate-650 focus:border-indigo-500/50 outline-none focus:ring-1 focus:ring-indigo-500/20 transition-all duration-300"
          />
        </div>

        {/* Date Filter Input */}
        <div className="relative">
          <Calendar size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-full bg-slate-950/60 border border-slate-800/80 rounded-xl pl-10 pr-3 py-2 text-xs text-slate-100 focus:border-indigo-500/50 outline-none focus:ring-1 focus:ring-indigo-500/20 transition-all duration-300"
          />
        </div>

        {/* Reset Filters */}
        {(searchQuery || dateFilter) && (
          <button
            onClick={() => {
              setSearchQuery('');
              setDateFilter('');
            }}
            className="px-3.5 py-2 bg-slate-850 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-xs font-display font-bold hover:text-slate-200 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 duration-200"
          >
            <RefreshCw size={13} className="text-indigo-400" />
            Restaurar Filtros
          </button>
        )}
      </div>

      {/* Main List Area */}
      <div className="flex-1 overflow-y-auto max-h-[380px] space-y-2.5 pr-1.5 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
        {historyItems.length === 0 ? (
          <div className="py-16 text-center text-slate-500 flex flex-col items-center justify-center border-2 border-dashed border-slate-800/60 rounded-2xl bg-slate-950/20">
            <AlertCircle size={24} className="mb-2.5 text-slate-600 stroke-1" />
            <p className="text-xs font-display font-extrabold text-slate-400 uppercase tracking-wider">Ningún ticket en este historial</p>
            <p className="text-[10px] text-slate-500 mt-1">Usa los filtros o entrega tickets para registrar actividad.</p>
          </div>
        ) : (
          historyItems.map((item) => {
            const isConfirmingDelete = deleteConfirmId === item.id;
            return isConfirmingDelete ? (
              <div
                key={item.id}
                className="bg-rose-950/20 border border-rose-500/30 p-4 rounded-xl flex items-center justify-between"
              >
                <span className="text-xs text-rose-300 font-bold">¿Seguro de borrar ticket #{item.number} permanentemente?</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      onDeleteTicket(item.id);
                      setDeleteConfirmId(null);
                    }}
                    className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white font-display font-extrabold text-[10px] rounded-lg cursor-pointer"
                  >
                    Sí, borrar
                  </button>
                  <button
                    onClick={() => setDeleteConfirmId(null)}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-750 text-slate-300 font-display font-bold text-[10px] rounded-lg cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div
                key={item.id}
                className="bg-slate-950/40 border border-slate-800/80 p-3.5 rounded-xl flex items-center justify-between group hover:border-slate-700/60 hover:bg-slate-900/20 transition-all duration-300"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-mono font-black text-base shrink-0 border shadow-lg ${
                    activeTab === 'delivered' 
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                      : activeTab === 'missing'
                      ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                      : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                  }`}>
                    {item.number}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {activeTab === 'pending_history' ? (
                      <>
                        <span className="text-[10px] text-slate-500 font-mono">
                          Creado: <strong className="text-slate-300 font-semibold">{formatDate(item.createdAt)}</strong>
                        </span>
                        {item.pendingAt && (
                          <span className="text-[10px] text-amber-400/80 font-mono">
                            Paso a Pendientes: <strong className="text-amber-400 font-semibold">{formatDate(item.pendingAt)}</strong>
                          </span>
                        )}
                        {item.recoveredAt && (
                          <span className="text-[10px] text-indigo-400/80 font-mono">
                            Recuperado: <strong className="text-indigo-400 font-semibold">{formatDate(item.recoveredAt)}</strong>
                          </span>
                        )}
                        {item.completedAt && item.status === 'delivered' && (
                          <span className="text-[10px] text-emerald-400/80 font-mono">
                            Entregado: <strong className="text-emerald-400 font-semibold">{formatDate(item.completedAt)}</strong>
                          </span>
                        )}
                        {item.status === 'deleted_pending' && (
                          <span className="text-[9px] text-rose-400 font-mono font-black uppercase tracking-wider">
                            Eliminado de Pendientes
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400 font-mono">
                          Tiempo total: <strong className="text-indigo-300 font-semibold">{formatTimeDuration(item.totalTime || Math.max(0, Math.floor(((item.completedAt || Date.now()) - item.createdAt) / 1000)))}</strong>
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-[10px] text-slate-400 font-mono">
                          Espera total: <strong className="text-indigo-300 font-semibold">{formatTimeDuration(item.totalTime || 0)}</strong>
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          Entrada: {formatDate(item.createdAt)}
                        </span>
                        {item.completedAt && (
                          <span className="text-[10px] text-slate-500 font-mono">
                            Salida: {formatDate(item.completedAt)}
                          </span>
                        )}
                        {item.createdByDevice && (
                          <span className="text-[10px] text-indigo-300 font-mono flex items-center gap-1">
                            <Tablet size={9} className="text-indigo-400" />
                            <span>Dispositivo: {item.createdByDevice}</span>
                          </span>
                        )}
                        {item.zones && item.zones.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {item.zones.map((z, idx) => (
                              <span key={idx} className="text-[9px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                                📍 {z.zone}: {z.status === 'completed' ? 'Completado' : 'Pendiente'}
                              </span>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {onRestoreTicket && (
                    <button
                      onClick={() => onRestoreTicket(item.id)}
                      className="p-2 bg-slate-950/60 hover:bg-indigo-950 border border-slate-800 hover:border-indigo-900/30 text-slate-400 hover:text-indigo-400 rounded-lg transition-all md:opacity-0 md:group-hover:opacity-100 cursor-pointer duration-300"
                      title="Restaurar ticket (devolver a lista de Espera)"
                    >
                      <ArrowLeft size={13} />
                    </button>
                  )}
                  <button
                    onClick={() => setDeleteConfirmId(item.id)}
                    className="p-2 bg-slate-950/60 hover:bg-rose-950 border border-slate-800 hover:border-rose-900/30 text-slate-500 hover:text-rose-400 rounded-lg transition-all md:opacity-0 md:group-hover:opacity-100 cursor-pointer duration-300"
                    title="Eliminar de historial"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Export & Reset footer buttons */}
      {historyItems.length > 0 && (
        <div className="pt-4 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportPDF}
              className="px-4 py-2 bg-indigo-950/80 hover:bg-indigo-900 text-indigo-400 hover:text-indigo-200 border border-indigo-900/40 rounded-xl text-xs font-display font-bold active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 duration-200"
            >
              <FileText size={14} />
              Exportar PDF
            </button>
            <button
              onClick={handleExportExcel}
              className="px-4 py-2 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-400 hover:text-emerald-200 border border-emerald-900/40 rounded-xl text-xs font-display font-bold active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 duration-200"
            >
              <Download size={14} />
              Excel (.xlsx)
            </button>
          </div>

          <button
            onClick={handleClearHistory}
            className="px-4 py-2 bg-rose-950/30 hover:bg-rose-950 border border-rose-900/30 text-rose-400 hover:text-rose-300 rounded-xl text-xs font-display font-bold active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 duration-200"
          >
            <Trash2 size={14} />
            Vaciar Historial
          </button>
        </div>
      )}
    </div>
  );
}
