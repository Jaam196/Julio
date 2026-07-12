import React from 'react';
import { Ticket } from '../types';
import { TrendingUp, Clock, CheckCircle2, AlertTriangle, Users, BarChart2 } from 'lucide-react';
import { formatTimeDuration } from '../utils/export';

interface StatisticsPanelProps {
  tickets: Ticket[];
  activeTicket: Ticket | null;
}

export default function StatisticsPanel({ tickets, activeTicket }: StatisticsPanelProps) {
  // Compute key stats
  const waitingTickets = tickets.filter((t) => t.status === 'waiting');
  const deliveredTickets = tickets.filter((t) => t.status === 'delivered');
  const missingTickets = tickets.filter((t) => t.status === 'missing');

  const totalDelivered = deliveredTickets.length;
  const totalMissing = missingTickets.length;
  const totalProcessed = totalDelivered + totalMissing;
  const totalInSystem = tickets.length + (activeTicket ? 1 : 0);

  // Average wait time for processed tickets
  const processedWithTime = [...deliveredTickets, ...missingTickets];
  const averageWaitTimeSeconds = processedWithTime.length > 0
    ? Math.round(processedWithTime.reduce((sum, t) => sum + (t.totalTime || 0), 0) / processedWithTime.length)
    : 0;

  // Hourly ticket processing chart calculations
  const hourlyCounts = Array.from({ length: 24 }, (_, hour) => {
    const count = processedWithTime.filter((t) => {
      const date = new Date(t.completedAt || t.createdAt);
      return date.getHours() === hour;
    }).length;
    return { hour, count };
  });

  // Find peak hour and max count for charts scaling
  const maxHourlyCount = Math.max(...hourlyCounts.map((h) => h.count), 1);
  const activeHours = hourlyCounts.filter((h) => h.count > 0);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6 h-full">
      
      {/* Title */}
      <div className="flex items-center gap-2 border-b border-slate-800/80 pb-4">
        <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
          <TrendingUp size={20} />
        </div>
        <div>
          <h3 className="font-semibold text-slate-100 text-lg">Métricas y Rendimiento</h3>
          <p className="text-xs text-slate-400">Panel de control de flujo de servicio de tickets de hoy.</p>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        
        {/* KPI 1: Active Ticket */}
        <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
          <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">Ticket Activo</span>
          <span className="text-2xl font-mono font-black text-white mt-1.5 leading-none">
            {activeTicket ? activeTicket.number : '-'}
          </span>
          <span className="text-[9px] text-slate-500 mt-2">Llamado continuo</span>
        </div>

        {/* KPI 2: Waiting Queue */}
        <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
          <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">Esperando</span>
          <span className="text-2xl font-mono font-black text-white mt-1.5 leading-none">
            {waitingTickets.length}
          </span>
          <span className="text-[9px] text-slate-500 mt-2">En lista de espera</span>
        </div>

        {/* KPI 3: Delivered Today */}
        <div className="bg-slate-950 border border-emerald-950/40 p-4 rounded-xl flex flex-col justify-between">
          <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Entregados hoy</span>
          <span className="text-2xl font-mono font-black text-emerald-400 mt-1.5 leading-none">
            {totalDelivered}
          </span>
          <span className="text-[9px] text-slate-500 mt-2">Servicio completado</span>
        </div>

        {/* KPI 4: Missing Today */}
        <div className="bg-slate-950 border border-red-950/40 p-4 rounded-xl flex flex-col justify-between">
          <span className="text-[10px] text-red-400 font-bold uppercase tracking-wider">Desaparecidos</span>
          <span className="text-2xl font-mono font-black text-red-400 mt-1.5 leading-none">
            {totalMissing}
          </span>
          <span className="text-[9px] text-slate-500 mt-2">Llamados sin reclamo</span>
        </div>

        {/* KPI 5: Average Wait */}
        <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
          <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">T. Medio Espera</span>
          <span className="text-lg font-mono font-extrabold text-white mt-1.5 leading-none truncate">
            {formatTimeDuration(averageWaitTimeSeconds)}
          </span>
          <span className="text-[9px] text-slate-500 mt-2">Promedio acumulado</span>
        </div>

        {/* KPI 6: Total Processed */}
        <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
          <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">Total Procesados</span>
          <span className="text-2xl font-mono font-black text-white mt-1.5 leading-none">
            {totalProcessed}
          </span>
          <span className="text-[9px] text-slate-500 mt-2">Finalizados hoy</span>
        </div>
      </div>

      {/* Visual Analytics Block */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4 border-t border-slate-800/60">
        
        {/* Sub-block 1: Service Rate Funnel */}
        <div className="bg-slate-950 border border-slate-800 p-5 rounded-xl space-y-4">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-emerald-400" />
            Eficacia del Servicio
          </h4>
          
          <div className="space-y-3.5">
            {/* Delivered Rate */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-400">Tasa de Entrega</span>
                <span className="text-emerald-400 font-bold">
                  {totalProcessed > 0 ? Math.round((totalDelivered / totalProcessed) * 100) : 100}%
                </span>
              </div>
              <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${totalProcessed > 0 ? (totalDelivered / totalProcessed) * 100 : 100}%` }}
                />
              </div>
            </div>

            {/* Missing Rate */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-400">Tasa de Desaparición</span>
                <span className="text-red-400 font-bold">
                  {totalProcessed > 0 ? Math.round((totalMissing / totalProcessed) * 100) : 0}%
                </span>
              </div>
              <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-red-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${totalProcessed > 0 ? (totalMissing / totalProcessed) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>

          <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-800/40 text-[10px] text-slate-500 leading-normal flex items-start gap-1.5">
            <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
            <span>
              Un tiempo de espera promedio por debajo de <strong className="text-slate-300">3 minutos (180s)</strong> se considera óptimo para garantizar la máxima satisfacción del cliente.
            </span>
          </div>
        </div>

        {/* Sub-block 2: Processing Volume by Hour */}
        <div className="bg-slate-950 border border-slate-800 p-5 rounded-xl space-y-4 lg:col-span-2 flex flex-col">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <BarChart2 size={14} className="text-indigo-400" />
            Distribución Horaria del Servicio
          </h4>

          {activeHours.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-600 text-xs italic py-6">
              Registra y completa tickets para ver el historial de actividad horaria.
            </div>
          ) : (
            <div className="flex-1 flex items-end justify-between gap-2 h-32 pt-4 px-2 border-b border-slate-800">
              {hourlyCounts.map((h) => {
                // Render only hours that had activity to prevent cluttering
                const pct = (h.count / maxHourlyCount) * 100;
                return (
                  <div key={h.hour} className="flex-1 flex flex-col items-center group">
                    {/* Hover tooltip */}
                    <div className="opacity-0 group-hover:opacity-100 absolute -translate-y-10 bg-slate-800 text-white font-mono text-[9px] px-1.5 py-0.5 rounded border border-slate-700 pointer-events-none transition-all duration-150 shadow z-10">
                      {h.count} tickets
                    </div>
                    {/* Bar */}
                    <div 
                      className={`w-full rounded-t-sm transition-all duration-300 ${
                        h.count > 0 ? 'bg-indigo-500/80 group-hover:bg-indigo-400' : 'bg-transparent'
                      }`}
                      style={{ height: `${Math.max(4, pct)}%` }}
                    />
                    {/* Label */}
                    <span className="text-[8px] text-slate-500 font-mono mt-2 select-none">
                      {String(h.hour).padStart(2, '0')}h
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          <div className="text-[10px] text-slate-500 text-center">
            Muestra el número de pedidos procesados por hora para analizar las horas punta.
          </div>
        </div>
      </div>
    </div>
  );
}
