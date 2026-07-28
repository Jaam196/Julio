import React, { useState } from 'react';
import { 
  Laptop, Smartphone, Tv, Database, Music, Volume2, Shield, Copy, Check, Terminal, Play, RotateCw, Settings, LayoutGrid 
} from 'lucide-react';
import { Ticket, VoiceSettings, AppConfig, MusicConfig } from '../types';

interface ServerConsoleViewProps {
  pairingCode: string;
  serverIP: string;
  connectedClients: { id: string; name: string; connected: boolean; type?: string }[];
  tickets: Ticket[];
  activeTicket: Ticket | null;
  voiceSettings: VoiceSettings;
  appConfig: AppConfig;
  musicConfig: MusicConfig;
  serverLogs: { id: string; timestamp: string; message: string; type: 'info' | 'success' | 'warn' | 'error' }[];
  onDisconnect: () => void;
  onForceManualMode: () => void;
  onClearLogs: () => void;
  isAutonomousMode?: boolean;
  onToggleAutonomousMode?: () => void;
  isAutoCallActive?: boolean;
  onToggleAutoCall?: () => void;
}

export default function ServerConsoleView({
  pairingCode,
  serverIP,
  connectedClients,
  tickets,
  activeTicket,
  voiceSettings,
  appConfig,
  musicConfig,
  serverLogs,
  onDisconnect,
  onForceManualMode,
  onClearLogs,
  isAutonomousMode = false,
  onToggleAutonomousMode = () => {},
  isAutoCallActive = true,
  onToggleAutoCall = () => {},
}: ServerConsoleViewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(pairingCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const waitingCount = tickets.filter(t => t.status === 'waiting').length;
  const pendingCount = tickets.filter(t => t.status === 'pending').length;
  const missingCount = tickets.filter(t => t.status === 'missing').length;
  const deliveredCount = tickets.filter(t => t.status === 'delivered').length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Banner / Title Bar */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 border border-indigo-900/40 p-5 rounded-2xl shadow-lg flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl relative">
            <Laptop size={24} />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-white tracking-tight flex items-center gap-2">
              Consola del Servidor Principal
              <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] font-mono rounded-md font-bold tracking-wider uppercase">
                PC CENTRAL
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Sincronizando colas, base de datos IndexedDB, sintetizador de voz y música ambiental en tiempo real.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={onForceManualMode}
            className="px-4 py-2 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/50 text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <LayoutGrid size={13} className="text-indigo-400" />
            <span>Ver Panel Manual</span>
          </button>
          
          <button
            onClick={onDisconnect}
            className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Apagar Servidor
          </button>
        </div>
      </div>

      {/* Morning One-Click autonomous mode button */}
      <div className={`border p-5 rounded-2xl shadow-xl flex flex-col md:flex-row items-center justify-between gap-4 transition-all duration-300 ${
        isAutonomousMode 
          ? 'bg-gradient-to-r from-emerald-950/80 to-slate-900 border-emerald-500/40 shadow-emerald-950/20' 
          : 'bg-gradient-to-r from-slate-900 to-indigo-950/40 border-slate-800 shadow-slate-950/40'
      }`}>
        <div className="flex items-center gap-3.5">
          <div className={`p-3 rounded-xl relative transition-colors ${
            isAutonomousMode ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800/80 text-slate-400'
          }`}>
            <Play size={24} className={isAutonomousMode ? "animate-pulse" : ""} />
            {isAutonomousMode && (
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            )}
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-white tracking-tight flex items-center gap-2">
              Piloto Automático / Modo Autónomo Inteligente
              <span className={`px-2 py-0.5 text-[9px] font-extrabold rounded-md uppercase tracking-wider ${
                isAutonomousMode ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400 border border-slate-700/35'
              }`}>
                {isAutonomousMode ? 'ACTIVO' : 'APAGADO'}
              </span>
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed max-w-xl">
              Activa este modo para automatizar el servicio: el sistema gestionará la cola solo, reproducirá música, llamará números consecutivamente y se mantendrá activo sin interacción del personal.
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3.5 w-full md:w-auto shrink-0">
          {isAutonomousMode && (
            <label className="flex items-center gap-2 bg-slate-950/60 border border-slate-800 px-3 py-2 rounded-xl text-xs font-bold text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isAutoCallActive}
                onChange={onToggleAutoCall}
                className="rounded border-slate-700 text-emerald-600 focus:ring-emerald-500 w-4 h-4 bg-slate-900 cursor-pointer"
              />
              <span>Auto-Llamador</span>
            </label>
          )}
          <button
            onClick={onToggleAutonomousMode}
            className={`px-5 py-2.5 font-black text-xs rounded-xl transition-all w-full md:w-auto text-center cursor-pointer flex items-center justify-center gap-2 shadow-lg ${
              isAutonomousMode 
                ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-amber-500/10' 
                : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-emerald-500/20'
            }`}
          >
            <Play size={14} fill="currentColor" />
            <span>{isAutonomousMode ? 'Detener Piloto Automático' : 'INICIAR SERVICIO AUTOMÁTICO (1-CLIC)'}</span>
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Connection & Network Details */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Pairing Code massive card */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl flex flex-col items-center text-center space-y-4">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider font-mono">
              Código de Emparejamiento
            </span>
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-5xl font-black text-white tracking-widest bg-slate-950 border border-slate-800/80 px-6 py-3.5 rounded-2xl shadow-inner select-all">
                {pairingCode || '------'}
              </span>
              <button
                onClick={handleCopyCode}
                className="p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800/80 text-slate-300 hover:text-white rounded-xl transition-all cursor-pointer"
                title="Copiar código"
              >
                {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
              </button>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed max-w-xs">
              Introduce este código en las tablets o televisores para conectarlos de forma segura en la red Wi-Fi local.
            </p>
          </div>

          {/* Network Info Details */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-4">
            <h3 className="font-bold text-xs text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
              <Shield size={13} />
              Información de Red Local
            </h3>
            <div className="space-y-2.5 font-mono text-xs">
              <div className="flex justify-between py-1 border-b border-slate-950">
                <span className="text-slate-500">Dirección del Servidor:</span>
                <span className="text-slate-200 font-bold">{serverIP}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-950">
                <span className="text-slate-500">Conexiones Activas:</span>
                <span className="text-indigo-400 font-bold">{connectedClients.filter(c => c.connected).length} dispositivo(s)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-950">
                <span className="text-slate-500">Seguridad del Canal:</span>
                <span className="text-emerald-400 font-bold">WS Local Protegido</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Motor de Audio / TTS:</span>
                <span className="text-amber-400 font-bold">Local en este PC</span>
              </div>
            </div>
          </div>

          {/* Synced Devices Status */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-4">
            <h3 className="font-bold text-xs text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
              Dispositivos Vinculados ({connectedClients.length})
            </h3>

            {connectedClients.length === 0 ? (
              <div className="py-6 text-center border border-dashed border-slate-800 rounded-xl text-slate-500 text-xs">
                No hay dispositivos emparejados.
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {connectedClients.map(client => {
                  const isTV = client.type === 'Pantalla Pública' || client.name.toLowerCase().includes('tv') || client.name.toLowerCase().includes('pantalla') || client.name.toLowerCase().includes('display');
                  return (
                    <div key={client.id} className="p-3 bg-slate-950/40 border border-slate-800/60 rounded-xl flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2.5">
                        <div className={`p-1.5 rounded-lg ${client.connected ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                          {isTV ? <Tv size={14} /> : <Smartphone size={14} />}
                        </div>
                        <div>
                          <div className="font-bold text-slate-200">{client.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {isTV ? 'Modo Pantalla Pública' : 'Modo Control de Gestión'}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${client.connected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`}></span>
                        <span className={`text-[10px] font-bold ${client.connected ? 'text-emerald-400' : 'text-slate-500'}`}>
                          {client.connected ? 'ONLINE' : 'OFFLINE'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* Live Logs Terminal & Core Stats */}
        <div className="lg:col-span-8 space-y-6 flex flex-col h-full">
          
          {/* Dashboard Stats Panel */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
                <Database size={16} />
              </div>
              <div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">Ticket Activo</div>
                <div className="font-mono text-base font-black text-white">{activeTicket ? activeTicket.number : '--'}</div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center gap-3">
              <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
                <Database size={16} />
              </div>
              <div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">En Espera</div>
                <div className="font-mono text-base font-black text-white">{waitingCount}</div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
                <Database size={16} />
              </div>
              <div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">Pausados</div>
                <div className="font-mono text-base font-black text-white">{pendingCount}</div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center gap-3">
              <div className="p-2 bg-rose-500/10 text-rose-400 rounded-lg">
                <Database size={16} />
              </div>
              <div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">Perdidos / Total</div>
                <div className="font-mono text-base font-black text-white">{missingCount} / {tickets.length}</div>
              </div>
            </div>

          </div>

          {/* Real-time Logs Console */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl flex-1 flex flex-col min-h-[400px] overflow-hidden shadow-2xl">
            {/* Console Header */}
            <div className="bg-slate-900/60 px-5 py-3 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-300 text-xs font-bold">
                <Terminal size={14} className="text-emerald-400" />
                <span>Consola de Sucesos del Servidor (Tiempo Real)</span>
              </div>
              <button
                onClick={onClearLogs}
                className="text-[10px] text-slate-500 hover:text-slate-300 underline font-semibold transition-colors"
              >
                Limpiar consola
              </button>
            </div>

            {/* Terminal Logs List */}
            <div className="p-4 flex-1 overflow-y-auto font-mono text-[11px] leading-relaxed space-y-2 h-[340px] scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
              {serverLogs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-600 text-center space-y-1 py-12">
                  <Terminal size={24} className="opacity-20 mb-2" />
                  <p>Consola vacía. Iniciando escucha de red...</p>
                  <p className="text-[10px]">Las operaciones remotas y registros del sistema aparecerán aquí al instante.</p>
                </div>
              ) : (
                serverLogs.map((log) => {
                  let badgeColor = 'text-slate-500';
                  if (log.type === 'success') badgeColor = 'text-emerald-400 font-bold';
                  if (log.type === 'warn') badgeColor = 'text-amber-400 font-bold';
                  if (log.type === 'error') badgeColor = 'text-rose-400 font-bold animate-pulse';
                  if (log.type === 'info') badgeColor = 'text-indigo-400';

                  return (
                    <div key={log.id} className="flex gap-2.5 items-start hover:bg-slate-900/40 p-1 rounded transition-colors border-l-2 border-transparent hover:border-indigo-500/50">
                      <span className="text-slate-600 shrink-0 select-none">[{log.timestamp}]</span>
                      <span className={`${badgeColor} shrink-0 select-none`}>●</span>
                      <span className="text-slate-300">{log.message}</span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Console Footer Status */}
            <div className="bg-slate-900/30 px-5 py-2.5 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-500 font-mono">
              <div className="flex items-center gap-1.5">
                <Volume2 size={12} className="text-indigo-400" />
                <span>TTS: {voiceSettings.soundEnabled ? 'ACTIVO' : 'SILENCIADO'} | Idioma: {voiceSettings.lang.toUpperCase()}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Music size={12} className="text-amber-400" />
                <span>Música de fondo: {musicConfig.integratedEnabled ? 'REPRODUCIENDO' : 'APAGADA'} | Vol: {musicConfig.integratedVolume}%</span>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
