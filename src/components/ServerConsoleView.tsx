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
      <div 
        className="border p-5 rounded-2xl shadow-lg flex flex-col md:flex-row md:items-center md:justify-between gap-4 transition-colors duration-300"
        style={{
          backgroundColor: 'var(--theme-card-bg, #0f172a)',
          borderColor: 'var(--theme-card-border, rgba(255, 255, 255, 0.1))',
          color: 'var(--theme-text, #f8fafc)',
        }}
      >
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl relative">
            <Laptop size={24} />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
          </div>
          <div>
            <h2 className="text-lg font-extrabold tracking-tight flex items-center gap-2" style={{ color: 'var(--theme-text, #f8fafc)' }}>
              Consola del Servidor Principal
              <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] font-mono rounded-md font-bold tracking-wider uppercase">
                PC CENTRAL
              </span>
            </h2>
            <p className="text-xs" style={{ color: 'var(--theme-text-muted, #94a3b8)' }}>
              Sincronizando colas, base de datos IndexedDB, sintetizador de voz y música ambiental en tiempo real.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={onForceManualMode}
            className="px-4 py-2 border rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            style={{
              backgroundColor: 'var(--theme-input-bg, #020617)',
              borderColor: 'var(--theme-card-border, rgba(255, 255, 255, 0.1))',
              color: 'var(--theme-text, #f8fafc)',
            }}
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
      <div 
        className="border p-5 rounded-2xl shadow-xl flex flex-col md:flex-row items-center justify-between gap-4 transition-all duration-300"
        style={{
          backgroundColor: 'var(--theme-card-bg, #0f172a)',
          borderColor: isAutonomousMode ? 'rgba(16, 185, 129, 0.4)' : 'var(--theme-card-border, rgba(255, 255, 255, 0.1))',
          color: 'var(--theme-text, #f8fafc)',
        }}
      >
        <div className="flex items-center gap-3.5">
          <div className={`p-3 rounded-xl relative transition-colors ${
            isAutonomousMode ? 'bg-emerald-500/10 text-emerald-400' : 'bg-indigo-500/10 text-indigo-400'
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
            <h3 className="text-sm font-extrabold tracking-tight flex items-center gap-2" style={{ color: 'var(--theme-text, #f8fafc)' }}>
              Piloto Automático / Modo Autónomo Inteligente
              <span className={`px-2 py-0.5 text-[9px] font-extrabold rounded-md uppercase tracking-wider ${
                isAutonomousMode ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400 border border-slate-700/35'
              }`}>
                {isAutonomousMode ? 'ACTIVO' : 'APAGADO'}
              </span>
            </h3>
            <p className="text-xs leading-relaxed max-w-xl" style={{ color: 'var(--theme-text-muted, #94a3b8)' }}>
              Activa este modo para automatizar el servicio: el sistema gestionará la cola solo, reproducirá música, llamará números consecutivamente y se mantendrá activo sin interacción del personal.
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3.5 w-full md:w-auto shrink-0">
          {isAutonomousMode && (
            <label 
              className="flex items-center gap-2 border px-3 py-2 rounded-xl text-xs font-bold cursor-pointer select-none"
              style={{
                backgroundColor: 'var(--theme-input-bg, #020617)',
                borderColor: 'var(--theme-card-border, rgba(255, 255, 255, 0.1))',
                color: 'var(--theme-text, #f8fafc)',
              }}
            >
              <input
                type="checkbox"
                checked={isAutoCallActive}
                onChange={onToggleAutoCall}
                className="rounded border-slate-700 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
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
          <div 
            className="border p-6 rounded-2xl shadow-xl flex flex-col items-center text-center space-y-4"
            style={{
              backgroundColor: 'var(--theme-card-bg, #0f172a)',
              borderColor: 'var(--theme-card-border, rgba(255, 255, 255, 0.1))',
            }}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider font-mono" style={{ color: 'var(--theme-text-muted, #94a3b8)' }}>
              Código de Emparejamiento
            </span>
            <div className="flex items-center gap-2.5">
              <span 
                className="font-mono text-5xl font-black tracking-widest border px-6 py-3.5 rounded-2xl shadow-inner select-all"
                style={{
                  backgroundColor: 'var(--theme-input-bg, #020617)',
                  borderColor: 'var(--theme-card-border, rgba(255, 255, 255, 0.1))',
                  color: 'var(--theme-text, #ffffff)',
                }}
              >
                {pairingCode || '------'}
              </span>
              <button
                onClick={handleCopyCode}
                className="p-3 border rounded-xl transition-all cursor-pointer"
                style={{
                  backgroundColor: 'var(--theme-input-bg, #020617)',
                  borderColor: 'var(--theme-card-border, rgba(255, 255, 255, 0.1))',
                  color: 'var(--theme-text, #f8fafc)',
                }}
                title="Copiar código"
              >
                {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
              </button>
            </div>
            <p className="text-xs leading-relaxed max-w-xs" style={{ color: 'var(--theme-text-muted, #94a3b8)' }}>
              Introduce este código en las tablets o televisores para conectarlos de forma segura en la red Wi-Fi local.
            </p>
          </div>

          {/* Network Info Details */}
          <div 
            className="border p-5 rounded-2xl shadow-xl space-y-4"
            style={{
              backgroundColor: 'var(--theme-card-bg, #0f172a)',
              borderColor: 'var(--theme-card-border, rgba(255, 255, 255, 0.1))',
            }}
          >
            <h3 className="font-bold text-xs text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
              <Shield size={13} />
              Información de Red Local
            </h3>
            <div className="space-y-2.5 font-mono text-xs">
              <div className="flex justify-between py-1 border-b" style={{ borderColor: 'var(--theme-card-border, rgba(255, 255, 255, 0.05))' }}>
                <span style={{ color: 'var(--theme-text-muted, #94a3b8)' }}>Dirección del Servidor:</span>
                <span className="font-bold" style={{ color: 'var(--theme-text, #f8fafc)' }}>{serverIP}</span>
              </div>
              <div className="flex justify-between py-1 border-b" style={{ borderColor: 'var(--theme-card-border, rgba(255, 255, 255, 0.05))' }}>
                <span style={{ color: 'var(--theme-text-muted, #94a3b8)' }}>Conexiones Activas:</span>
                <span className="text-indigo-400 font-bold">{connectedClients.filter(c => c.connected).length} dispositivo(s)</span>
              </div>
              <div className="flex justify-between py-1 border-b" style={{ borderColor: 'var(--theme-card-border, rgba(255, 255, 255, 0.05))' }}>
                <span style={{ color: 'var(--theme-text-muted, #94a3b8)' }}>Seguridad del Canal:</span>
                <span className="text-emerald-400 font-bold">WS Local Protegido</span>
              </div>
              <div className="flex justify-between py-1">
                <span style={{ color: 'var(--theme-text-muted, #94a3b8)' }}>Motor de Audio / TTS:</span>
                <span className="text-amber-400 font-bold">Local en este PC</span>
              </div>
            </div>
          </div>

          {/* Synced Devices Status */}
          <div 
            className="border p-5 rounded-2xl shadow-xl space-y-4"
            style={{
              backgroundColor: 'var(--theme-card-bg, #0f172a)',
              borderColor: 'var(--theme-card-border, rgba(255, 255, 255, 0.1))',
            }}
          >
            <h3 className="font-bold text-xs uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--theme-text, #f8fafc)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
              Dispositivos Vinculados ({connectedClients.length})
            </h3>

            {connectedClients.length === 0 ? (
              <div className="py-6 text-center border border-dashed rounded-xl text-xs" style={{ borderColor: 'var(--theme-card-border, rgba(255, 255, 255, 0.1))', color: 'var(--theme-text-muted, #94a3b8)' }}>
                No hay dispositivos emparejados.
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {connectedClients.map(client => {
                  const isTV = client.type === 'Pantalla Pública' || client.name.toLowerCase().includes('tv') || client.name.toLowerCase().includes('pantalla') || client.name.toLowerCase().includes('display');
                  return (
                    <div key={client.id} className="p-3 border rounded-xl flex items-center justify-between gap-3 text-xs" style={{ backgroundColor: 'var(--theme-input-bg, #020617)', borderColor: 'var(--theme-card-border, rgba(255, 255, 255, 0.1))' }}>
                      <div className="flex items-center gap-2.5">
                        <div className={`p-1.5 rounded-lg ${client.connected ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                          {isTV ? <Tv size={14} /> : <Smartphone size={14} />}
                        </div>
                        <div>
                          <div className="font-bold" style={{ color: 'var(--theme-text, #f8fafc)' }}>{client.name}</div>
                          <div className="text-[10px] font-mono" style={{ color: 'var(--theme-text-muted, #94a3b8)' }}>
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
            
            <div 
              className="border p-4 rounded-xl flex items-center gap-3"
              style={{
                backgroundColor: 'var(--theme-card-bg, #0f172a)',
                borderColor: 'var(--theme-card-border, rgba(255, 255, 255, 0.1))',
              }}
            >
              <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
                <Database size={16} />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider font-mono" style={{ color: 'var(--theme-text-muted, #94a3b8)' }}>Ticket Activo</div>
                <div className="font-mono text-base font-black" style={{ color: 'var(--theme-text, #ffffff)' }}>{activeTicket ? activeTicket.number : '--'}</div>
              </div>
            </div>

            <div 
              className="border p-4 rounded-xl flex items-center gap-3"
              style={{
                backgroundColor: 'var(--theme-card-bg, #0f172a)',
                borderColor: 'var(--theme-card-border, rgba(255, 255, 255, 0.1))',
              }}
            >
              <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
                <Database size={16} />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider font-mono" style={{ color: 'var(--theme-text-muted, #94a3b8)' }}>En Espera</div>
                <div className="font-mono text-base font-black" style={{ color: 'var(--theme-text, #ffffff)' }}>{waitingCount}</div>
              </div>
            </div>

            <div 
              className="border p-4 rounded-xl flex items-center gap-3"
              style={{
                backgroundColor: 'var(--theme-card-bg, #0f172a)',
                borderColor: 'var(--theme-card-border, rgba(255, 255, 255, 0.1))',
              }}
            >
              <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
                <Database size={16} />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider font-mono" style={{ color: 'var(--theme-text-muted, #94a3b8)' }}>Pausados</div>
                <div className="font-mono text-base font-black" style={{ color: 'var(--theme-text, #ffffff)' }}>{pendingCount}</div>
              </div>
            </div>

            <div 
              className="border p-4 rounded-xl flex items-center gap-3"
              style={{
                backgroundColor: 'var(--theme-card-bg, #0f172a)',
                borderColor: 'var(--theme-card-border, rgba(255, 255, 255, 0.1))',
              }}
            >
              <div className="p-2 bg-rose-500/10 text-rose-400 rounded-lg">
                <Database size={16} />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider font-mono" style={{ color: 'var(--theme-text-muted, #94a3b8)' }}>Perdidos / Total</div>
                <div className="font-mono text-base font-black" style={{ color: 'var(--theme-text, #ffffff)' }}>{missingCount} / {tickets.length}</div>
              </div>
            </div>

          </div>

          {/* Real-time Logs Console */}
          <div 
            className="border rounded-2xl flex-1 flex flex-col min-h-[400px] overflow-hidden shadow-2xl"
            style={{
              backgroundColor: 'var(--theme-input-bg, #020617)',
              borderColor: 'var(--theme-card-border, rgba(255, 255, 255, 0.1))',
            }}
          >
            {/* Console Header */}
            <div 
              className="px-5 py-3 border-b flex items-center justify-between"
              style={{
                backgroundColor: 'var(--theme-card-bg, #0f172a)',
                borderColor: 'var(--theme-card-border, rgba(255, 255, 255, 0.1))',
              }}
            >
              <div className="flex items-center gap-2 text-xs font-bold" style={{ color: 'var(--theme-text, #f8fafc)' }}>
                <Terminal size={14} className="text-emerald-400" />
                <span>Consola de Sucesos del Servidor (Tiempo Real)</span>
              </div>
              <button
                onClick={onClearLogs}
                className="text-[10px] underline font-semibold transition-colors cursor-pointer"
                style={{ color: 'var(--theme-text-muted, #94a3b8)' }}
              >
                Limpiar consola
              </button>
            </div>

            {/* Terminal Logs List */}
            <div className="p-4 flex-1 overflow-y-auto font-mono text-[11px] leading-relaxed space-y-2 h-[340px] scrollbar-thin">
              {serverLogs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-1 py-12" style={{ color: 'var(--theme-text-muted, #94a3b8)' }}>
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
                    <div key={log.id} className="flex gap-2.5 items-start p-1 rounded transition-colors border-l-2 border-transparent">
                      <span className="shrink-0 select-none" style={{ color: 'var(--theme-text-muted, #64748b)' }}>[{log.timestamp}]</span>
                      <span className={`${badgeColor} shrink-0 select-none`}>●</span>
                      <span style={{ color: 'var(--theme-text, #e2e8f0)' }}>{log.message}</span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Console Footer Status */}
            <div 
              className="px-5 py-2.5 border-t flex items-center justify-between text-[10px] font-mono"
              style={{
                backgroundColor: 'var(--theme-card-bg, #0f172a)',
                borderColor: 'var(--theme-card-border, rgba(255, 255, 255, 0.1))',
                color: 'var(--theme-text-muted, #94a3b8)',
              }}
            >
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
