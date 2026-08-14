import React, { useState, useEffect } from 'react';
import { 
  Laptop, Smartphone, Tv, Wifi, WifiOff, RefreshCw, Trash2, Edit2, Check, X, Copy, Info, AlertCircle, Shield, ShieldAlert, ShieldCheck
} from 'lucide-react';

interface ClientDevice {
  id: string;
  name: string;
  connected: boolean;
  type?: string;
  status?: 'authorized' | 'blocked';
}

interface DevicesPanelProps {
  deviceMode: 'local' | 'server' | 'client';
  clientRole?: 'controller' | 'pantalla';
  pairingCode: string;
  pairingStatus: 'unpaired' | 'pairing' | 'paired' | 'failed' | 'searching';
  serverIP: string;
  deviceName: string;
  connectedClients: ClientDevice[];
  onSelectMode: (mode: 'local' | 'server' | 'mobile_control' | 'public_display') => void;
  onSetClientRole?: (role: 'controller' | 'pantalla') => void;
  onSetDeviceName: (name: string) => void;
  onSetServerIP: (ip: string) => void;
  onStartPairing: (code: string, ip?: string) => void;
  onRenameClient: (id: string, name: string) => void;
  onRemoveClient: (id: string) => void;
  onBlockClient?: (id: string) => void;
  onUnblockClient?: (id: string) => void;
  onDisconnect: () => void;
  availableRooms?: { code: string; serverName: string; clientsCount: number }[];
  lastConnectionError?: string;
}

export default function DevicesPanel({
  deviceMode,
  clientRole = 'controller',
  pairingCode,
  pairingStatus,
  serverIP,
  deviceName,
  connectedClients,
  onSelectMode,
  onSetClientRole,
  onSetDeviceName,
  onSetServerIP,
  onStartPairing,
  onRenameClient,
  onRemoveClient,
  onBlockClient,
  onUnblockClient,
  onDisconnect,
  availableRooms = [],
  lastConnectionError = '',
}: DevicesPanelProps) {
  const [inputCode, setInputCode] = useState('');
  const [inputIP, setInputIP] = useState(serverIP);
  const [inputName, setInputName] = useState(deviceName);
  const [copied, setCopied] = useState(false);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [editingClientName, setEditingClientName] = useState('');

  // Local state copy for immediate search button updates
  const [localRooms, setLocalRooms] = useState<{ code: string; serverName: string; clientsCount: number }[]>(availableRooms);

  useEffect(() => {
    setLocalRooms(availableRooms);
  }, [availableRooms]);

  useEffect(() => {
    setInputIP(serverIP);
  }, [serverIP]);

  useEffect(() => {
    setInputName(deviceName);
  }, [deviceName]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(pairingCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveDeviceName = () => {
    if (inputName.trim()) {
      onSetDeviceName(inputName.trim());
    }
  };

  const handleStartEditingClient = (client: ClientDevice) => {
    setEditingClientId(client.id);
    setEditingClientName(client.name);
  };

  const handleSaveClientRename = (id: string) => {
    if (editingClientName.trim()) {
      onRenameClient(id, editingClientName.trim());
      setEditingClientId(null);
    }
  };

  // Compute active function key
  const currentActiveKey: 'local' | 'server' | 'mobile_control' | 'public_display' = 
    deviceMode === 'local' 
      ? 'local' 
      : deviceMode === 'server' 
        ? 'server' 
        : clientRole === 'pantalla' 
          ? 'public_display' 
          : 'mobile_control';

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-8 h-full">
      
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-4">
        <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
          <Smartphone size={20} />
        </div>
        <div>
          <h3 className="font-semibold text-slate-100 text-lg">Sincronización Multidispositivo</h3>
          <p className="text-xs text-slate-400">Conecta pantallas secundarias y mandos de control remoto inalámbricos.</p>
        </div>
      </div>

      {/* Device Name Configuration Card - ALWAYS VISIBLE & EDITABLE */}
      <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-sans">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl shrink-0">
            <Smartphone size={20} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2 flex-wrap">
              <span>Nombre de este Dispositivo</span>
              <span className="text-[10px] font-mono font-bold bg-indigo-950/80 text-indigo-300 border border-indigo-800/60 px-2 py-0.5 rounded-md">
                {deviceName || 'Sin nombre'}
              </span>
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Este nombre se asociará a los tickets creados en este modo (Tablet / Mando / PC).
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:w-80">
          <input
            type="text"
            value={inputName}
            onChange={(e) => setInputName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveDeviceName();
            }}
            placeholder="Ej: Tablet Mostrador 1"
            className="flex-1 bg-slate-900 border border-slate-700 focus:border-indigo-500 text-white text-xs rounded-xl px-3 py-2 outline-none font-medium"
          />
          <button
            onClick={handleSaveDeviceName}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 shadow-sm"
          >
            Guardar
          </button>
        </div>
      </div>

      {/* Mode Selection Cards - ALWAYS VISIBLE */}
      <div className="space-y-4">
        <h4 className="font-semibold text-sm text-slate-300">Selecciona la función de este dispositivo:</h4>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: Local Mode */}
          <button
            onClick={() => onSelectMode('local')}
            className={`p-5 text-left rounded-xl transition-all flex flex-col justify-between h-48 focus:outline-none cursor-pointer relative group ${
              currentActiveKey === 'local'
                ? 'border-2 border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/30'
                : 'border border-slate-800 bg-slate-950/40 hover:border-indigo-500/50 hover:bg-indigo-500/5'
            }`}
          >
            <div>
              <div className={`p-2 rounded-lg w-fit mb-3 ${currentActiveKey === 'local' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400 group-hover:text-indigo-400'}`}>
                <Laptop size={18} />
              </div>
              <h5 className={`font-bold text-sm mb-1 ${currentActiveKey === 'local' ? 'text-emerald-300' : 'text-slate-200'}`}>Modo Local (Completo)</h5>
              <p className="text-xs text-slate-400">Todo en uno: administra colas, OCR, audios y tickets en esta misma pantalla.</p>
            </div>
            {currentActiveKey === 'local' ? (
              <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-extrabold flex items-center gap-1 bg-emerald-950/80 border border-emerald-500/30 px-2 py-0.5 rounded-md w-fit">
                <Check size={12} /> ACTIVO
              </span>
            ) : (
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold group-hover:text-indigo-400 transition-colors">
                SELECCIONAR →
              </span>
            )}
          </button>

          {/* Card 2: Server Mode */}
          <button
            onClick={() => onSelectMode('server')}
            className={`p-5 text-left rounded-xl transition-all flex flex-col justify-between h-48 focus:outline-none cursor-pointer relative group ${
              currentActiveKey === 'server'
                ? 'border-2 border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/30'
                : 'border border-slate-800 bg-slate-950/40 hover:border-indigo-500/50 hover:bg-indigo-500/5'
            }`}
          >
            <div>
              <div className={`p-2 rounded-lg w-fit mb-3 ${currentActiveKey === 'server' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400 group-hover:text-indigo-400'}`}>
                <Laptop size={18} />
              </div>
              <h5 className={`font-bold text-sm mb-1 ${currentActiveKey === 'server' ? 'text-emerald-300' : 'text-slate-200'}`}>PC Principal (Servidor)</h5>
              <p className="text-xs text-slate-400">Actúa como servidor de base de datos, OCR, sonido y sincroniza la red local.</p>
            </div>
            {currentActiveKey === 'server' ? (
              <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-extrabold flex items-center gap-1 bg-emerald-950/80 border border-emerald-500/30 px-2 py-0.5 rounded-md w-fit">
                <Check size={12} /> ACTIVO
              </span>
            ) : (
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold group-hover:text-indigo-400 transition-colors">
                SELECCIONAR →
              </span>
            )}
          </button>

          {/* Card 3: Mobile Mode */}
          <button
            onClick={() => onSelectMode('mobile_control')}
            className={`p-5 text-left rounded-xl transition-all flex flex-col justify-between h-48 focus:outline-none cursor-pointer relative group ${
              currentActiveKey === 'mobile_control'
                ? 'border-2 border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/30'
                : 'border border-slate-800 bg-slate-950/40 hover:border-indigo-500/50 hover:bg-indigo-500/5'
            }`}
          >
            <div>
              <div className={`p-2 rounded-lg w-fit mb-3 ${currentActiveKey === 'mobile_control' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400 group-hover:text-indigo-400'}`}>
                <Smartphone size={18} />
              </div>
              <h5 className={`font-bold text-sm mb-1 ${currentActiveKey === 'mobile_control' ? 'text-emerald-300' : 'text-slate-200'}`}>📱 Modo Móvil (Control)</h5>
              <p className="text-xs text-slate-400">Llama, entrega, pasa a pendientes y configura turnos de forma remota en tu móvil/tablet.</p>
            </div>
            {currentActiveKey === 'mobile_control' ? (
              <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-extrabold flex items-center gap-1 bg-emerald-950/80 border border-emerald-500/30 px-2 py-0.5 rounded-md w-fit">
                <Check size={12} /> ACTIVO
              </span>
            ) : (
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold group-hover:text-indigo-400 transition-colors">
                SELECCIONAR →
              </span>
            )}
          </button>

          {/* Card 4: TV Display Mode */}
          <button
            onClick={() => onSelectMode('public_display')}
            className={`p-5 text-left rounded-xl transition-all flex flex-col justify-between h-48 focus:outline-none cursor-pointer relative group ${
              currentActiveKey === 'public_display'
                ? 'border-2 border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/30'
                : 'border border-slate-800 bg-slate-950/40 hover:border-indigo-500/50 hover:bg-indigo-500/5'
            }`}
          >
            <div>
              <div className={`p-2 rounded-lg w-fit mb-3 ${currentActiveKey === 'public_display' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400 group-hover:text-indigo-400'}`}>
                <Tv size={18} />
              </div>
              <h5 className={`font-bold text-sm mb-1 ${currentActiveKey === 'public_display' ? 'text-emerald-300' : 'text-slate-200'}`}>📺 Modo Pantalla Pública</h5>
              <p className="text-xs text-slate-400">Vista de Smart TV limpia sin botones para que los clientes vean el turno activo gigante.</p>
            </div>
            {currentActiveKey === 'public_display' ? (
              <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-extrabold flex items-center gap-1 bg-emerald-950/80 border border-emerald-500/30 px-2 py-0.5 rounded-md w-fit">
                <Check size={12} /> ACTIVO
              </span>
            ) : (
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold group-hover:text-indigo-400 transition-colors">
                SELECCIONAR →
              </span>
            )}
          </button>

        </div>

        <div className="p-4 bg-slate-950/50 border border-slate-800 rounded-xl flex gap-3 items-start">
          <Info size={16} className="text-indigo-400 mt-0.5 shrink-0" />
          <p className="text-xs text-slate-400 leading-relaxed">
            El ecosistema multidispositivo te permite separar funciones de manera limpia. Coloca tu PC como Servidor en mostrador, tu tablet como mando táctil y tu monitor o Smart TV como Pantalla para tus clientes. Todo sincronizado al milisegundo mediante Wi-Fi local sin depender de Internet.
          </p>
        </div>
      </div>

      {/* LOCAL MODE DEVICE MANAGEMENT SHORTCUT */}
      {deviceMode === 'local' && (
        <div className="space-y-6">
          <div className="bg-slate-950/60 border border-slate-800 p-5 rounded-2xl flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-slate-800 text-slate-300 rounded-xl">
                <Laptop size={20} />
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-200">Modo Local Autónomo (Este PC)</h4>
                <p className="text-xs text-slate-400">Todo se ejecuta localmente. Para conectar tablets o pantallas TV, activa el Servidor.</p>
              </div>
            </div>
            <button
              onClick={() => onSelectMode('server')}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Wifi size={14} />
              Activar Servidor y Ver Código
            </button>
          </div>

          {/* List of Connected and Authorized Devices in Local Mode */}
          {connectedClients.length > 0 && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h5 className="font-semibold text-sm text-slate-200">Dispositivos Registrados / Bloqueados ({connectedClients.length})</h5>
              </div>
              <div className="border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800 bg-slate-950/20">
                {connectedClients.map((client) => {
                  const isBlocked = client.status === 'blocked';
                  return (
                    <div key={client.id} className="p-4 flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${isBlocked ? 'bg-rose-500/10 text-rose-400' : client.connected ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                          {client.type === 'Pantalla Pública' || client.type === 'TV' ? <Tv size={16} /> : <Smartphone size={16} />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-200 text-xs">{client.name}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-wide bg-indigo-950/40 border border-indigo-900/30 px-1.5 py-0.2 rounded">
                              {client.type || 'MANDO'}
                            </span>
                            <div className="flex items-center gap-1">
                              <span className={`w-1.5 h-1.5 rounded-full ${isBlocked ? 'bg-rose-500' : client.connected ? 'bg-emerald-500' : 'bg-slate-600'}`}></span>
                              <span className="text-[10px] text-slate-500">
                                {isBlocked ? 'Bloqueado' : client.connected ? 'Conectado' : 'Desconectado'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {isBlocked ? (
                          <button
                            onClick={() => onUnblockClient?.(client.id)}
                            className="px-2.5 py-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                            title="Desbloquear dispositivo"
                          >
                            <ShieldCheck size={13} />
                            Desbloquear
                          </button>
                        ) : (
                          <button
                            onClick={() => onBlockClient?.(client.id)}
                            className="px-2.5 py-1.5 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                            title="Bloquear y revocar acceso"
                          >
                            <ShieldAlert size={13} />
                            Bloquear
                          </button>
                        )}
                        <button
                          onClick={() => onRemoveClient(client.id)}
                          className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/5 rounded-lg transition-all cursor-pointer"
                          title="Eliminar de la lista"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* PC SERVER MODE */}
      {deviceMode === 'server' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <h4 className="font-bold text-sm text-slate-200">Servidor Activo (PC Principal)</h4>
            </div>
            <button
              onClick={onDisconnect}
              className="px-3 py-1.5 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 rounded-lg text-xs font-bold transition-all cursor-pointer"
            >
              Desactivar Modo Servidor
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Left side: Pairing Code Display */}
            <div className="bg-slate-950/80 border border-slate-800/80 p-6 rounded-2xl flex flex-col items-center justify-center text-center space-y-4">
              <span className="text-xs text-slate-400 uppercase font-mono tracking-wider">Código de Emparejamiento</span>
              <div className="flex items-center gap-3">
                <span className="font-mono text-4xl font-extrabold text-white tracking-widest bg-slate-900 border border-slate-800 px-5 py-3 rounded-xl shadow-inner select-all">
                  {pairingCode || '------'}
                </span>
                <button
                  onClick={handleCopyCode}
                  className="p-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white rounded-xl transition-all cursor-pointer"
                  title="Copiar código"
                >
                  {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                </button>
              </div>
              <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                Introduce este código en tus otros dispositivos para sincronizarlos al instante sin configurar puertos ni IPs.
              </p>
            </div>

            {/* Right side: Connection Information */}
            <div className="space-y-4 bg-slate-950/40 p-5 rounded-2xl border border-slate-800/50">
              <h5 className="font-semibold text-xs text-indigo-400 uppercase tracking-wider">Información de Red</h5>
              <div className="space-y-3 font-mono text-xs">
                <div className="flex justify-between py-1 border-b border-slate-900">
                  <span className="text-slate-400">Origen local:</span>
                  <span className="text-slate-200">{window.location.host}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-900">
                  <span className="text-slate-400">Seguridad:</span>
                  <span className="text-emerald-400">WS con Handshake de Aprobación</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Audios y OCR:</span>
                  <span className="text-amber-400">Procesados en este PC</span>
                </div>
              </div>
              <div className="p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-xl flex gap-2.5 items-start">
                <Info size={14} className="text-indigo-400 mt-0.5 shrink-0" />
                <p className="text-[11px] text-slate-400 leading-normal font-sans">
                  Toda la base de datos se guarda en este PC. Los dispositivos conectados actúan de forma remota, ejecutando comandos en tiempo real.
                </p>
              </div>
            </div>

          </div>

          {/* List of Connected and Authorized Devices */}
          <div className="space-y-3">
            <h5 className="font-semibold text-sm text-slate-200">Panel de Dispositivos Sincronizados ({connectedClients.length})</h5>
            
            {connectedClients.length === 0 ? (
              <div className="py-8 text-center border border-dashed border-slate-800 rounded-xl text-slate-500 text-xs">
                No hay dispositivos emparejados todavía. Enciende la app en tu tablet y busca servidores.
              </div>
            ) : (
              <div className="border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800 bg-slate-950/20">
                {connectedClients.map((client) => {
                  const isBlocked = client.status === 'blocked';
                  return (
                    <div key={client.id} className="p-4 flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${isBlocked ? 'bg-rose-500/10 text-rose-400' : client.connected ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                          {client.type === 'Pantalla Pública' || client.type === 'TV' ? <Tv size={16} /> : <Smartphone size={16} />}
                        </div>
                        <div>
                          {editingClientId === client.id ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                value={editingClientName}
                                onChange={(e) => setEditingClientName(e.target.value)}
                                className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-xs text-white outline-none focus:border-indigo-500 font-sans"
                                autoFocus
                              />
                              <button
                                onClick={() => handleSaveClientRename(client.id)}
                                className="p-1 text-emerald-400 hover:bg-slate-800 rounded cursor-pointer"
                              >
                                <Check size={14} />
                              </button>
                              <button
                                onClick={() => setEditingClientId(null)}
                                className="p-1 text-slate-400 hover:bg-slate-800 rounded cursor-pointer"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-200 text-xs">{client.name}</span>
                              <button
                                onClick={() => handleStartEditingClient(client)}
                                className="p-0.5 text-slate-500 hover:text-slate-300 rounded cursor-pointer"
                              >
                                <Edit2 size={10} />
                              </button>
                            </div>
                          )}
                          <div className="flex items-center gap-2 mt-0.5">
                            {/* Device Type Badge */}
                            <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-wide bg-indigo-950/40 border border-indigo-900/30 px-1.5 py-0.2 rounded">
                              {client.type || 'MANDO'}
                            </span>
                            {/* State indicator */}
                            <div className="flex items-center gap-1">
                              <span className={`w-1.5 h-1.5 rounded-full ${isBlocked ? 'bg-rose-500' : client.connected ? 'bg-emerald-500' : 'bg-slate-600'}`}></span>
                              <span className="text-[10px] text-slate-500">
                                {isBlocked ? 'Bloqueado' : client.connected ? 'Conectado ahora' : 'Desconectado'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {/* Block / Unblock Button */}
                        {isBlocked ? (
                          <button
                            onClick={() => onUnblockClient?.(client.id)}
                            className="px-2.5 py-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                            title="Volver a autorizar dispositivo"
                          >
                            <ShieldCheck size={13} />
                            Desbloquear
                          </button>
                        ) : (
                          <button
                            onClick={() => onBlockClient?.(client.id)}
                            className="px-2.5 py-1.5 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                            title="Bloquear y revocar acceso"
                          >
                            <ShieldAlert size={13} />
                            Bloquear
                          </button>
                        )}

                        {/* Forget device */}
                        <button
                          onClick={() => onRemoveClient(client.id)}
                          className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/5 rounded-lg transition-all cursor-pointer"
                          title="Eliminar de la lista"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TABLET CLIENT MODE */}
      {deviceMode === 'client' && (
        <div className="space-y-6">
          
          {/* Active Mode Display Banner */}
          <div className="bg-slate-950/60 border border-slate-800 p-5 rounded-2xl flex items-center justify-between gap-4 font-sans flex-wrap">
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl relative">
                {clientRole === 'pantalla' ? <Tv size={24} /> : <Smartphone size={24} />}
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span>
                </span>
              </div>
              <div>
                <h5 className="text-sm font-extrabold text-white flex items-center gap-2">
                  {clientRole === 'pantalla' ? '📺 Modo Pantalla Pública' : '📱 Modo Móvil (Control)'}
                  <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[9px] font-mono rounded-md font-bold tracking-wider uppercase">
                    VINCULADO DIRECTO
                  </span>
                </h5>
                <p className="text-xs text-slate-400 mt-0.5">
                  {clientRole === 'pantalla' 
                    ? 'Este dispositivo está configurado exclusivamente para mostrar pedidos listos en Smart TV / monitores.'
                    : 'Este dispositivo está configurado como consola de administración móvil para gestionar la cola, llamar turnos y escanear tickets físicos mediante la cámara (OCR) en tiempo real.'
                  }
                </p>
                
                {/* Role Switcher Pills */}
                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={() => {
                      onSetClientRole?.('controller');
                      onSelectMode('mobile_control');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      clientRole === 'controller'
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-1 ring-indigo-400'
                        : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Smartphone size={13} />
                    <span>📱 Consola Móvil</span>
                  </button>
                  <button
                    onClick={() => {
                      onSetClientRole?.('pantalla');
                      onSelectMode('public_display');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      clientRole === 'pantalla'
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-1 ring-indigo-400'
                        : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Tv size={13} />
                    <span>📺 Pantalla Pública TV</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center flex-wrap gap-3 font-sans">
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-sm text-slate-200">Estado de Sincronización</h4>
              
              {pairingStatus === 'paired' ? (
                <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded text-[10px] font-mono font-semibold flex items-center gap-1">
                  <Wifi size={10} /> CONECTADO
                </span>
              ) : pairingStatus === 'searching' ? (
                <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 rounded text-[10px] font-mono font-semibold flex items-center gap-1 animate-pulse">
                  <RefreshCw size={10} className="animate-spin" /> VINCULANDO...
                </span>
              ) : (
                <span className="px-2 py-0.5 bg-rose-500/10 text-rose-400 rounded text-[10px] font-mono font-semibold flex items-center gap-1">
                  <WifiOff size={10} /> DESCONECTADO
                </span>
              )}
            </div>
            
            <button
              onClick={onDisconnect}
              className="px-3 py-1.5 bg-slate-800 text-slate-300 hover:text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
            >
              Volver a Modo Local
            </button>
          </div>

          {pairingStatus !== 'paired' ? (
            <div className="space-y-6">
              {/* Connection failure warning banner shown prominently in the setup flow */}
              {pairingStatus === 'failed' && lastConnectionError && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl text-xs flex gap-3 items-start animate-fade-in font-sans">
                  <AlertCircle size={18} className="shrink-0 text-rose-400 mt-0.5" />
                  <div className="space-y-1">
                    <h6 className="font-bold text-rose-300">No se pudo establecer la conexión</h6>
                    <p className="text-slate-300 leading-relaxed">{lastConnectionError}</p>
                  </div>
                </div>
              )}
              
              {/* Device Custom Name */}
              <div className="p-5 bg-slate-950/40 border border-slate-800/80 rounded-2xl space-y-3 font-sans">
                <h5 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  Identificación de este Dispositivo
                </h5>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputName}
                    onChange={(e) => setInputName(e.target.value)}
                    placeholder="E.g. Tablet Caja 1"
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 outline-none"
                  />
                  <button
                    onClick={handleSaveDeviceName}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    Guardar
                  </button>
                </div>
              </div>

              {/* Automatic Server Discovery Section */}
              <div className="bg-slate-950/80 border border-slate-800 p-6 rounded-2xl space-y-4 font-sans">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h5 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                    <Wifi size={16} className="text-indigo-400 animate-pulse" />
                    Búsqueda Automática de Servidores
                  </h5>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const btnIcon = document.getElementById('btn-buscar-servidores');
                        if (btnIcon) {
                          btnIcon.classList.add('animate-spin');
                          setTimeout(() => btnIcon.classList.remove('animate-spin'), 1000);
                        }
                        fetch('/api/rooms')
                          .then(res => res.json())
                          .then(data => {
                            setLocalRooms(data.rooms || []);
                          })
                          .catch(err => console.error('Error manual refresh rooms:', err));
                      }}
                      className="px-2 py-1 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-white rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                      title="Buscar de nuevo"
                    >
                      <RefreshCw size={12} id="btn-buscar-servidores" />
                      <span>Buscar servidor</span>
                    </button>
                    <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider animate-pulse">
                      Buscando...
                    </span>
                  </div>
                </div>

                {localRooms.length === 0 ? (
                  <div className="py-10 text-center border border-dashed border-slate-800 rounded-xl text-slate-500 text-xs flex flex-col items-center justify-center space-y-3">
                    <RefreshCw className="w-6 h-6 text-slate-600 animate-spin" />
                    <p className="font-semibold text-slate-400">Buscando PC Servidor en tu red local...</p>
                    <p className="text-[10.5px] text-slate-500 max-w-xs leading-normal">
                      Sincronización instantánea activa. Asegúrate de activar el modo "PC Principal" en el PC para conectarte al instante sin ingresar nada.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-400 leading-normal">
                      Hemos detectado los siguientes servidores activos en tu red local. Elige uno para sincronizar:
                    </p>
                    <div className="grid grid-cols-1 gap-2">
                      {localRooms.map((room) => {
                        const isConnectingThis = pairingStatus === 'searching';
                        return (
                          <div
                            key={room.code}
                            onClick={() => {
                              if (pairingStatus === 'searching') return;
                              onStartPairing(room.code, window.location.host);
                            }}
                            className={`p-4 bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-indigo-500/50 rounded-xl transition-all flex items-center justify-between cursor-pointer group ${
                              isConnectingThis ? 'opacity-70 cursor-wait' : ''
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                <Laptop size={16} />
                              </div>
                              <div className="text-left">
                                <h6 className="font-bold text-slate-200 text-xs">{room.serverName || 'PC Servidor Principal'}</h6>
                                <p className="text-[10px] text-slate-500 mt-0.5">Código de sala: <span className="font-mono text-indigo-400 font-bold">{room.code}</span></p>
                              </div>
                            </div>
                            <span className="text-[10px] bg-indigo-600/10 text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5">
                              {isConnectingThis ? (
                                <>
                                  <RefreshCw size={10} className="animate-spin" />
                                  <span>Conectando...</span>
                                </>
                              ) : (
                                <span>Conectar</span>
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Manual Backup Pairing Form */}
              <div className="bg-slate-950/40 border border-slate-800/80 p-5 rounded-2xl space-y-4 font-sans">
                <div className="space-y-1">
                  <h5 className="font-bold text-slate-300 text-xs uppercase tracking-wider">¿No se conecta de forma automática?</h5>
                  <p className="text-[11px] text-slate-500">Introduce el código o la dirección IP de tu PC Servidor de forma manual:</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500 font-mono uppercase">Código de 6 dígitos</label>
                    <input
                      type="text"
                      maxLength={6}
                      value={inputCode}
                      onChange={(e) => setInputCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="123456"
                      className="w-full text-center bg-slate-900 border border-slate-800 rounded-xl py-2 text-xl font-bold text-white tracking-widest focus:border-indigo-500 outline-none font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500 font-mono uppercase">Dirección IP manual</label>
                    <input
                      type="text"
                      value={inputIP}
                      onChange={(e) => setInputIP(e.target.value)}
                      placeholder="E.g. 192.168.1.50:3000"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-300 focus:border-indigo-500 outline-none font-mono"
                    />
                  </div>
                </div>

                <button
                  onClick={() => {
                    onSetServerIP(inputIP);
                    onStartPairing(inputCode || '000000', inputIP);
                  }}
                  disabled={pairingStatus === 'searching'}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {pairingStatus === 'searching' ? (
                    <>
                      <RefreshCw size={12} className="animate-spin text-indigo-400" />
                      <span>Estableciendo conexión...</span>
                    </>
                  ) : (
                    <span>Conectar de forma manual</span>
                  )}
                </button>
              </div>

              <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-xl flex gap-3 font-sans">
                <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h6 className="font-bold text-slate-200 text-xs">Instrucciones de Red Local</h6>
                  <p className="text-[11px] text-slate-400 leading-normal">
                    Tanto tu PC Servidor como este dispositivo móvil o Smart TV deben estar en la misma red de Wi-Fi local para detectarse. La conexión es segura, directa, sin lag y con autorización manual desde el PC.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 font-sans">
              <div className="p-6 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col items-center justify-center text-center space-y-4">
                <div className="p-4 bg-emerald-500/10 text-emerald-400 rounded-full animate-bounce">
                  <Wifi size={32} />
                </div>
                
                <div>
                  <h5 className="font-extrabold text-slate-200 text-base">Sincronizado con el Servidor</h5>
                  <p className="text-xs text-slate-400 mt-1">Conectado a PC Principal en {serverIP}</p>
                </div>

                <div className="font-mono text-xs bg-slate-900 border border-slate-800/80 px-4 py-2.5 rounded-xl text-slate-300 w-full max-w-sm flex flex-col gap-1.5 text-left">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Nombre de Tablet:</span>
                    <span className="text-white font-bold">{deviceName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Código de Sala:</span>
                    <span className="text-white font-bold tracking-widest">{localStorage.getItem('pairedCode')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Base de Datos:</span>
                    <span className="text-indigo-400">PC (Lectura/Escritura Remota)</span>
                  </div>
                </div>

                <div className="flex gap-3 w-full max-w-sm">
                  <button
                    onClick={() => {
                      onDisconnect();
                    }}
                    className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-bold border border-slate-800 transition-all cursor-pointer"
                  >
                    Desconectar
                  </button>
                  
                  <button
                    onClick={() => {
                      onStartPairing(localStorage.getItem('pairedCode') || '');
                    }}
                    className="px-4 py-2 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 font-bold rounded-xl text-xs transition-all cursor-pointer"
                  >
                    Recomenzar
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* Connection Diagnosis Panel */}
      <div className="border-t border-slate-800 pt-6 space-y-4 font-sans">
        <h4 className="font-bold text-sm text-slate-300 flex items-center gap-2">
          <Shield size={16} className="text-indigo-400" />
          Estado de Conexión y Diagnóstico
        </h4>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 text-xs">
          {/* Item 1: Server Status */}
          <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex flex-col justify-between space-y-1">
            <span className="text-[10px] text-slate-500 uppercase font-mono tracking-wider">Servidor Iniciado</span>
            <div className="flex items-center gap-1.5 font-bold mt-0.5">
              <span className={`w-2 h-2 rounded-full ${deviceMode === 'server' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`}></span>
              <span className={deviceMode === 'server' ? 'text-emerald-400' : 'text-slate-400'}>
                {deviceMode === 'server' ? 'Sí (PC Principal)' : 'No (Modo Local/Cliente)'}
              </span>
            </div>
          </div>

          {/* Item 2: Active Port */}
          <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex flex-col justify-between space-y-1">
            <span className="text-[10px] text-slate-500 uppercase font-mono tracking-wider">Puerto Activo</span>
            <span className="font-mono text-slate-300 font-bold mt-0.5">
              3000 <span className="text-[10px] text-slate-500 font-normal font-sans">(Reverse Proxy)</span>
            </span>
          </div>

          {/* Item 3: Detected Network */}
          <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex flex-col justify-between space-y-1">
            <span className="text-[10px] text-slate-500 uppercase font-mono tracking-wider">Red Detectada</span>
            <span className="font-mono text-slate-300 font-bold truncate mt-0.5" title={window.location.host}>
              {window.location.host}
            </span>
          </div>

          {/* Item 4: Rooms/Servers Found */}
          <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex flex-col justify-between space-y-1">
            <span className="text-[10px] text-slate-500 uppercase font-mono tracking-wider">Servidores Detectados</span>
            <span className="font-bold text-slate-300 mt-0.5">
              {localRooms.length} servidor(es) encontrado(s)
            </span>
          </div>

          {/* Item 5: Devices Connected */}
          <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex flex-col justify-between space-y-1">
            <span className="text-[10px] text-slate-500 uppercase font-mono tracking-wider">Dispositivos Conectados</span>
            <span className="font-bold text-indigo-400 mt-0.5">
              {deviceMode === 'server' 
                ? `${connectedClients.filter(c => c.connected).length} dispositivo(s)`
                : pairingStatus === 'paired' ? '1 (Conectado a PC)' : '0 (Desconectado)'
              }
            </span>
          </div>

          {/* Item 6: Pairing Code / Connection status */}
          <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex flex-col justify-between space-y-1">
            <span className="text-[10px] text-slate-500 uppercase font-mono tracking-wider">Código de Sala</span>
            <span className="font-mono text-amber-400 font-extrabold tracking-widest mt-0.5">
              {pairingCode || '------'}
            </span>
          </div>
        </div>

        {/* Item 7: Last connection error if any */}
        {lastConnectionError && (
          <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs flex gap-2.5 items-start">
            <AlertCircle size={15} className="shrink-0 mt-0.5 animate-bounce" />
            <div className="space-y-0.5">
              <span className="font-bold">Último error de conexión:</span>
              <p className="text-slate-300 leading-normal">{lastConnectionError}</p>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
