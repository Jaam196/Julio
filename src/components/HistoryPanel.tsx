import React, { useState } from 'react';
import { Ticket } from '../types';
import { Search, Calendar, Trash2, FileText, Download, CheckCircle, HelpCircle, RefreshCw, Clock } from 'lucide-react';
import { exportToPDF, exportToExcel, formatDate, formatTimeDuration } from '../utils/export';

interface HistoryPanelProps {
  tickets: Ticket[];
  onDeleteTicket: (id: string) => void;
  onClearHistory: (status: 'delivered' | 'missing' | 'pending_history') => void;
}

export default function HistoryPanel({ tickets, onDeleteTicket, onClearHistory }: HistoryPanelProps) {
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
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col h-full">
      {/* Tab toggle buttons */}
      <div className="flex bg-slate-950 p-1.5 rounded-xl border border-slate-800/80 mb-6 gap-1 flex-wrap sm:flex-nowrap">
        <button
          onClick={() => {
            setActiveTab('delivered');
            setSearchQuery('');
            setDateFilter('');
            setDeleteConfirmId(null);
          }}
          className={`flex-1 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'delivered'
              ? 'bg-emerald-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <CheckCircle size={15} />
          <span>Tickets Entregados</span>
          <span className={`px-2 py-0.5 text-[10px] rounded-full font-mono font-bold ${
            activeTab === 'delivered' ? 'bg-emerald-700 text-emerald-100' : 'bg-slate-900 text-slate-500'
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
          className={`flex-1 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'missing'
              ? 'bg-red-950/60 border border-red-900/40 text-red-300 shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <HelpCircle size={15} />
          <span>Tickets Desaparecidos</span>
          <span className={`px-2 py-0.5 text-[10px] rounded-full font-mono font-bold ${
            activeTab === 'missing' ? 'bg-red-900 text-red-100' : 'bg-slate-900 text-slate-500'
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
          className={`flex-1 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'pending_history'
              ? 'bg-amber-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Clock size={15} />
          <span>Historial Pendientes</span>
          <span className={`px-2 py-0.5 text-[10px] rounded-full font-mono font-bold ${
            activeTab === 'pending_history' ? 'bg-amber-700 text-amber-100' : 'bg-slate-900 text-slate-500'
          }`}>
            {tickets.filter(t => t.pendingAt && t.status !== 'active' && t.status !== 'waiting' && t.status !== 'pending').length}
          </span>
        </button>
      </div>

      {/* Filter and Action bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        {/* Search Input */}
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por número..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:border-indigo-500 outline-none"
          />
        </div>

        {/* Date Filter Input */}
        <div className="relative">
          <Calendar size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3 py-2 text-xs text-slate-100 focus:border-indigo-500 outline-none select-none"
          />
        </div>

        {/* Reset Filters */}
        {(searchQuery || dateFilter) && (
          <button
            onClick={() => {
              setSearchQuery('');
              setDateFilter('');
            }}
            className="px-3 py-2 bg-slate-800 border border-slate-700 text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-700 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            <RefreshCw size={13} />
            Restaurar Filtros
          </button>
        )}
      </div>

      {/* Main List Area */}
      <div className="flex-1 overflow-y-auto max-h-[380px] space-y-2 pr-1 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
        {historyItems.length === 0 ? (
          <div className="py-12 text-center text-slate-500 flex flex-col items-center justify-center border-2 border-dashed border-slate-800/80 rounded-xl">
            <Trash2 size={24} className="stroke-1 mb-2 text-slate-600" />
            <p className="text-xs font-medium text-slate-400">Ningún ticket en este historial</p>
            <p className="text-[10px] text-slate-600 mt-0.5">Usa los filtros o entrega tickets para empezar.</p>
          </div>
        ) : (
          historyItems.map((item) => {
            const isConfirmingDelete = deleteConfirmId === item.id;
            return isConfirmingDelete ? (
              <div
                key={item.id}
                className="bg-red-950/40 border border-red-900/40 p-3 rounded-xl flex items-center justify-between"
              >
                <span className="text-xs text-red-300 font-medium">¿Seguro de borrar ticket #{item.number} permanentemente?</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      onDeleteTicket(item.id);
                      setDeleteConfirmId(null);
                    }}
                    className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white font-bold text-[10px] rounded"
                  >
                    Sí
                  </button>
                  <button
                    onClick={() => setDeleteConfirmId(null)}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] rounded"
                  >
                    No
                  </button>
                </div>
              </div>
            ) : (
              <div
                key={item.id}
                className="bg-slate-950 border border-slate-800 p-3 rounded-xl flex items-center justify-between group hover:border-slate-700/60 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-mono font-bold text-sm shrink-0 ${
                    activeTab === 'delivered' 
                      ? 'bg-emerald-950/50 border border-emerald-900/30 text-emerald-400' 
                      : activeTab === 'missing'
                      ? 'bg-red-950/50 border border-red-900/30 text-red-400'
                      : 'bg-amber-950/50 border border-amber-900/30 text-amber-400'
                  }`}>
                    {item.number}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {activeTab === 'pending_history' ? (
                      <>
                        <span className="text-[10px] text-slate-500 font-mono">
                          Creado: <strong className="text-slate-300 font-medium">{formatDate(item.createdAt)}</strong>
                        </span>
                        {item.pendingAt && (
                          <span className="text-[10px] text-amber-500/80 font-mono">
                            Paso a Pendientes: <strong className="text-amber-400 font-medium">{formatDate(item.pendingAt)}</strong>
                          </span>
                        )}
                        {item.recoveredAt && (
                          <span className="text-[10px] text-indigo-400/80 font-mono">
                            Recuperado: <strong className="text-indigo-400 font-medium">{formatDate(item.recoveredAt)}</strong>
                          </span>
                        )}
                        {item.completedAt && item.status === 'delivered' && (
                          <span className="text-[10px] text-emerald-500/80 font-mono">
                            Entregado: <strong className="text-emerald-400 font-medium">{formatDate(item.completedAt)}</strong>
                          </span>
                        )}
                        {item.status === 'deleted_pending' && (
                          <span className="text-[9px] text-red-400 font-mono font-bold uppercase tracking-wider">
                            Eliminado definitivamente de Pendientes
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400 font-mono">
                          Tiempo total: <strong className="text-slate-200 font-medium">{formatTimeDuration(item.totalTime || Math.max(0, Math.floor(((item.completedAt || Date.now()) - item.createdAt) / 1000)))}</strong>
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-[10px] text-slate-500 font-mono">
                          Espera total: <strong className="text-slate-300 font-medium">{formatTimeDuration(item.totalTime || 0)}</strong>
                        </span>
                        <span className="text-[10px] text-slate-600 font-mono">
                          Entrada: {formatDate(item.createdAt)}
                        </span>
                        {item.completedAt && (
                          <span className="text-[9px] text-slate-700 font-mono">
                            Salida: {formatDate(item.completedAt)}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => setDeleteConfirmId(item.id)}
                  className="p-2 bg-slate-900 hover:bg-red-950 hover:text-red-400 border border-slate-800 hover:border-red-900/40 text-slate-500 rounded-lg transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                  title="Eliminar de historial"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Export & Reset footer buttons */}
      {historyItems.length > 0 && (
        <div className="mt-6 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <button
              onClick={handleExportPDF}
              className="px-3.5 py-2 bg-indigo-950 hover:bg-indigo-900 text-indigo-400 hover:text-indigo-200 border border-indigo-900/50 rounded-xl text-xs font-semibold active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <FileText size={14} />
              PDF
            </button>
            <button
              onClick={handleExportExcel}
              className="px-3.5 py-2 bg-emerald-950 hover:bg-emerald-900 text-emerald-400 hover:text-emerald-200 border border-emerald-900/50 rounded-xl text-xs font-semibold active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Download size={14} />
              Excel (xlsx)
            </button>
          </div>

          <button
            onClick={handleClearHistory}
            className="px-3.5 py-2 bg-red-950/40 hover:bg-red-950 border border-red-900/30 text-red-400 hover:text-red-300 rounded-xl text-xs font-medium active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Trash2 size={14} />
            Vaciar Historial
          </button>
        </div>
      )}
    </div>
  );
}
