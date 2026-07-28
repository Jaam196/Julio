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
    <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/60 rounded-[22px] p-6 shadow-2xl space-y-6 h-full flex flex-col justify-between">
      
      {/* Title */}
      <div className="flex items-center gap-3 border-b border-slate-800/60 pb-5">
        <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20 shadow">
          <TrendingUp size={18} />
        </div>
        <div>
          <h3 className="font-display font-extrabold text-slate-100 text-base leading-tight">Métricas y Rendimiento</h3>
          <p className="text-[10px] text-slate-400 font-medium">Panel de control de flujo de servicio de tickets de hoy.</p>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        
        {/* KPI 1: Active Ticket */}
        <div className="bg-slate-950/50 border border-slate-800 p-4 rounded-xl flex flex-col justify-between hover:border-indigo-500/30 transition-colors duration-300">
          <span className="text-[10px] text-indigo-400 font-display font-bold uppercase tracking-wider">Ticket Activo</span>
          <span className="text-2xl font-mono font-black text-white mt-1.5 leading-none">
            {activeTicket ? activeTicket.number : '-'}
          </span>
          <span className="text-[9px] text-slate-500 mt-2 font-medium">Llamado continuo</span>
        </div>

        {/* KPI 2: Waiting Queue */}
        <div className="bg-slate-950/50 border border-slate-800 p-4 rounded-xl flex flex-col justify-between hover:border-amber-500/30 transition-colors duration-300">
          <span className="text-[10px] text-amber-400 font-display font-bold uppercase tracking-wider">Esperando</span>
          <span className="text-2xl font-mono font-black text-white mt-1.5 leading-none">
            {waitingTickets.length}
          </span>
          <span className="text-[9px] text-slate-500 mt-2 font-medium">En lista de espera</span>
        </div>

        {/* KPI 3: Delivered Today */}
        <div className="bg-slate-950/50 border border-emerald-950/50 p-4 rounded-xl flex flex-col justify-between hover:border-emerald-500/30 transition-colors duration-300">
          <span className="text-[10px] text-emerald-400 font-display font-bold uppercase tracking-wider">Entregados hoy</span>
          <span className="text-2xl font-mono font-black text-emerald-400 mt-1.5 leading-none">
            {totalDelivered}
          </span>
          <span className="text-[9px] text-slate-500 mt-2 font-medium">Servicio completado</span>
        </div>

        {/* KPI 4: Missing Today */}
        <div className="bg-slate-950/50 border border-rose-950/50 p-4 rounded-xl flex flex-col justify-between hover:border-rose-500/30 transition-colors duration-300">
          <span className="text-[10px] text-rose-400 font-display font-bold uppercase tracking-wider">Desaparecidos</span>
          <span className="text-2xl font-mono font-black text-rose-400 mt-1.5 leading-none">
            {totalMissing}
          </span>
          <span className="text-[9px] text-slate-500 mt-2 font-medium">Llamados sin reclamo</span>
        </div>

        {/* KPI 5: Average Wait */}
        <div className="bg-slate-950/50 border border-slate-800 p-4 rounded-xl flex flex-col justify-between hover:border-sky-500/30 transition-colors duration-300">
          <span className="text-[10px] text-sky-400 font-display font-bold uppercase tracking-wider">T. Medio Espera</span>
          <span className="text-lg font-mono font-extrabold text-white mt-1.5 leading-none truncate">
            {formatTimeDuration(averageWaitTimeSeconds)}
          </span>
          <span className="text-[9px] text-slate-500 mt-2 font-medium">Promedio acumulado</span>
        </div>

        {/* KPI 6: Total Processed */}
        <div className="bg-slate-950/50 border border-slate-800 p-4 rounded-xl flex flex-col justify-between hover:border-violet-500/30 transition-colors duration-300">
          <span className="text-[10px] text-violet-400 font-display font-bold uppercase tracking-wider">Total Procesados</span>
          <span className="text-2xl font-mono font-black text-white mt-1.5 leading-none">
            {totalProcessed}
          </span>
          <span className="text-[9px] text-slate-500 mt-2 font-medium">Finalizados hoy</span>
        </div>
      </div>

      {/* Visual Analytics Block */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4 border-t border-slate-800/60">
        
        {/* Sub-block 1: Service Rate Funnel */}
        <div className="bg-slate-950/40 border border-slate-800 p-5 rounded-2xl space-y-4 flex flex-col justify-between">
          <h4 className="text-xs font-display font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <CheckCircle2 size={14} className="text-emerald-400" />
            Eficacia del Servicio
          </h4>
          
          <div className="space-y-4 py-2">
            {/* Delivered Rate */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-400">Tasa de Entrega</span>
                <span className="text-emerald-400 font-bold">
                  {totalProcessed > 0 ? Math.round((totalDelivered / totalProcessed) * 100) : 100}%
                </span>
              </div>
              <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800/80">
                <div 
                  className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${totalProcessed > 0 ? (totalDelivered / totalProcessed) * 100 : 100}%` }}
                />
              </div>
            </div>

            {/* Missing Rate */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-400">Tasa de Desaparición</span>
                <span className="text-rose-400 font-bold">
                  {totalProcessed > 0 ? Math.round((totalMissing / totalProcessed) * 100) : 0}%
                </span>
              </div>
              <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800/80">
                <div 
                  className="bg-gradient-to-r from-rose-500 to-pink-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${totalProcessed > 0 ? (totalMissing / totalProcessed) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>

          <div className="bg-amber-500/5 rounded-xl p-3 border border-amber-500/10 text-[10px] text-amber-300/80 leading-relaxed flex items-start gap-2 mt-2">
            <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
            <span>
              Un tiempo de espera promedio por debajo de <strong className="text-slate-200">3 minutos (180s)</strong> garantiza un flujo de servicio rápido y óptima experiencia del cliente.
            </span>
          </div>
        </div>

        {/* Sub-block 2: Processing Volume by Hour */}
        <div className="bg-slate-950/40 border border-slate-800 p-5 rounded-2xl space-y-4 lg:col-span-2 flex flex-col justify-between">
          <h4 className="text-xs font-display font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <BarChart2 size={14} className="text-indigo-400" />
            Distribución Horaria del Servicio
          </h4>

          {activeHours.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-xs py-8 border border-dashed border-slate-800/50 rounded-xl bg-slate-900/10">
              <TrendingUp size={20} className="mb-2 text-slate-600 stroke-1" />
              <span>Registra y completa tickets para ver el historial de actividad horaria.</span>
            </div>
          ) : (
            <div className="flex-1 flex items-end justify-between gap-1.5 h-36 pt-4 px-2 border-b border-slate-800/60 pb-1">
              {hourlyCounts.map((h) => {
                const pct = (h.count / maxHourlyCount) * 100;
                return (
                  <div key={h.hour} className="flex-1 flex flex-col items-center group relative">
                    {/* Hover tooltip */}
                    <div className="opacity-0 group-hover:opacity-100 absolute -top-8 bg-slate-800 text-white font-mono text-[9px] px-1.5 py-0.5 rounded border border-slate-700 pointer-events-none transition-all duration-150 shadow z-10 whitespace-nowrap">
                      {h.count} tickets
                    </div>
                    {/* Bar */}
                    <div 
                      className={`w-full rounded-t-lg transition-all duration-300 cursor-pointer ${
                        h.count > 0 
                          ? 'bg-gradient-to-t from-indigo-600 to-indigo-400 group-hover:from-indigo-500 group-hover:to-indigo-300 group-hover:shadow-[0_0_8px_rgba(99,102,241,0.4)]' 
                          : 'bg-slate-900/40'
                      }`}
                      style={{ height: `${h.count > 0 ? Math.max(8, pct) : 4}%` }}
                    />
                    {/* Label */}
                    <span className="text-[8px] text-slate-500 font-mono mt-2 select-none group-hover:text-slate-300">
                      {String(h.hour).padStart(2, '0')}h
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          <div className="text-[10px] text-slate-500 text-center leading-normal pt-1">
            Muestra el volumen de pedidos finalizados por hora para identificar momentos punta en la cocina.
          </div>
        </div>
      </div>
    </div>
  );
}
