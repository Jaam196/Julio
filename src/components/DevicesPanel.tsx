import React, { useState, useEffect } from 'react';
import { 
  Laptop, Smartphone, Wifi, WifiOff, RefreshCw, Trash2, Edit2, Check, X, Code, Copy, Info, AlertCircle 
} from 'lucide-react';

interface ClientDevice {
  id: string;
  name: string;
  connected: boolean;
}

interface DevicesPanelProps {
  deviceMode: 'local' | 'server' | 'client';
  pairingCode: string;
  pairingStatus: 'unpaired' | 'pairing' | 'paired' | 'failed' | 'searching';
  serverIP: string;
  deviceName: string;
  connectedClients: ClientDevice[];
  onSelectMode: (mode: 'local' | 'server' | 'client') => void;
  onSetDeviceName: (name: string) => void;
  onSetServerIP: (ip: string) => void;
  onStartPairing: (code: string) => void;
  onRenameClient: (id: string, name: string) => void;
  onRemoveClient: (id: string) => void;
  onDisconnect: () => void;
}

export default function DevicesPanel({
  deviceMode,
  pairingCode,
  pairingStatus,
  serverIP,
  deviceName,
  connectedClients,
  onSelectMode,
  onSetDeviceName,
  onSetServerIP,
  onStartPairing,
  onRenameClient,
  onRemoveClient,
  onDisconnect,
}: DevicesPanelProps) {
  const [inputCode, setInputCode] = useState('');
  const [inputIP, setInputIP] = useState(serverIP);
  const [inputName, setInputName] = useState(deviceName);
  const [copied, setCopied] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState({ scanned: 0, total: 254 });
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [editingClientName, setEditingClientName] = useState('');

  useEffect(() => {
    setInputIP(serverIP);
  }, [serverIP]);

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

  // Automated IP Scanner fallback
  const handleAutoDiscover = async () => {
    setIsScanning(true);
    setScanProgress({ scanned: 0, total: 254 });
    
    // Invert search starting subnet based on current host or input IP
    let subnetBase = "192.168.1";
    const currentHost = window.location.hostname;
    
    if (currentHost.match(/^\d+\.\d+\.\d+\.\d+$/)) {
      const parts = currentHost.split('.');
      subnetBase = `${parts[0]}.${parts[1]}.${parts[2]}`;
    } else if (inputIP.split(':')[0].match(/^\d+\.\d+\.\d+\.\d+$/)) {
      const parts = inputIP.split(':')[0].split('.');
      subnetBase = `${parts[0]}.${parts[1]}.${parts[2]}`;
    }

    const total = 254;
    let foundIP: string | null = null;
    const batchSize = 15;

    for (let i = 1; i <= 254; i += batchSize) {
      if (foundIP) break;
      const promises = [];
      
      for (let j = i; j < i + batchSize && j <= 254; j++) {
        const ip = `${subnetBase}.${j}`;
        const url = `http://${ip}:3000/api/health`;
        
        const p = (async () => {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 900);
            
            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);
            
            if (res.ok) {
              const data = await res.json();
              if (data && data.status === "ok") {
                foundIP = `${ip}:3000`;
                return foundIP;
              }
            }
          } catch (e) {
            // fail silently
          } finally {
            setScanProgress(prev => ({ ...prev, scanned: prev.scanned + 1 }));
          }
          return null;
        })();
        promises.push(p);
      }
      await Promise.all(promises);
    }

    // Secondary common subnets if not found
    const altSubnets = ["192.168.0", "192.168.100", "10.0.0"];
    if (!foundIP) {
      for (const altSubnet of altSubnets) {
        if (foundIP) break;
        const commonHosts = [1, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 101, 102, 103, 104, 105, 110, 120, 150, 200];
        
        const promises = commonHosts.map(async (hostId) => {
          const ip = `${altSubnet}.${hostId}`;
          const url = `http://${ip}:3000/api/health`;
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 850);
            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);
            if (res.ok) {
              const data = await res.json();
              if (data && data.status === "ok") {
                foundIP = `${ip}:3000`;
                return foundIP;
              }
            }
          } catch (e) {}
          return null;
        });
        await Promise.all(promises);
      }
    }

    setIsScanning(false);
    if (foundIP) {
      onSetServerIP(foundIP);
      setInputIP(foundIP);
    } else {
      alert("No se pudo encontrar ningún PC Servidor en los rangos de red local escaneados. Introduce la dirección IP de forma manual.");
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

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-8 h-full">
      
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-4">
        <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
          <Smartphone size={20} />
        </div>
        <div>
          <h3 className="font-semibold text-slate-100 text-lg">Modo de Red Local (PC + Tablet)</h3>
          <p className="text-xs text-slate-400">Configura la aplicación para trabajar de manera distribuida.</p>
        </div>
      </div>

      {/* Mode Selection Cards */}
      {deviceMode === 'local' && (
        <div className="space-y-4">
          <h4 className="font-semibold text-sm text-slate-300">Selecciona el modo de funcionamiento:</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Card 1: Local Mode */}
            <button
              onClick={() => onSelectMode('local')}
              className="p-5 text-left rounded-xl border border-indigo-500/40 bg-indigo-500/5 hover:bg-indigo-500/10 transition-all flex flex-col justify-between h-48 focus:outline-none"
            >
              <div>
                <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg w-fit mb-3">
                  <Laptop size={18} />
                </div>
                <h5 className="font-bold text-slate-200 text-sm mb-1">Modo Local (Estandar)</h5>
                <p className="text-xs text-slate-400">Funciona de forma independiente en este dispositivo. Guarda los datos localmente.</p>
              </div>
              <span className="text-[10px] uppercase tracking-wider text-indigo-400 font-bold">Activo</span>
            </button>

            {/* Card 2: Server Mode */}
            <button
              onClick={() => onSelectMode('server')}
              className="p-5 text-left rounded-xl border border-slate-800 bg-slate-950/40 hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all flex flex-col justify-between h-48 focus:outline-none"
            >
              <div>
                <div className="p-2 bg-indigo-500/10 text-slate-400 rounded-lg w-fit mb-3">
                  <Laptop size={18} />
                </div>
                <h5 className="font-bold text-slate-300 text-sm mb-1">PC Principal (Servidor)</h5>
                <p className="text-xs text-slate-400">Este PC guardará los datos, reproducirá el audio, controlará la impresora y las llamadas.</p>
              </div>
              <span className="text-[10px] uppercase tracking-wider text-slate-500">Activar</span>
            </button>

            {/* Card 3: Client Mode */}
            <button
              onClick={() => onSelectMode('client')}
              className="p-5 text-left rounded-xl border border-slate-800 bg-slate-950/40 hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all flex flex-col justify-between h-48 focus:outline-none"
            >
              <div>
                <div className="p-2 bg-indigo-500/10 text-slate-400 rounded-lg w-fit mb-3">
                  <Smartphone size={18} />
                </div>
                <h5 className="font-bold text-slate-300 text-sm mb-1">Tablet (Control Remoto)</h5>
                <p className="text-xs text-slate-400">Actúa como un control remoto. Envía comandos al PC principal para manejar las colas.</p>
              </div>
              <span className="text-[10px] uppercase tracking-wider text-slate-500">Conectar</span>
            </button>

          </div>

          <div className="p-4 bg-slate-950/50 border border-slate-800 rounded-xl flex gap-3 items-start">
            <Info size={16} className="text-indigo-400 mt-0.5 shrink-0" />
            <p className="text-xs text-slate-400 leading-relaxed">
              El modo cliente-servidor te permite colocar pantallas principales (PC) en el mostrador para el público, y manejar los tickets mediante mandos o tablets inalámbricas en tiempo real. 
              <strong> Sin dependencias de internet:</strong> Toda la transmisión se efectúa localmente en la misma red Wi-Fi.
            </p>
          </div>
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
                Introduce este código de 6 dígitos en la tablet para sincronizarla al instante.
              </p>
            </div>

            {/* Right side: Connection Information */}
            <div className="space-y-4 bg-slate-950/40 p-5 rounded-2xl border border-slate-800/50">
              <h5 className="font-semibold text-xs text-indigo-400 uppercase tracking-wider">Información de Red</h5>
              <div className="space-y-3 font-mono text-xs">
                <div className="flex justify-between py-1 border-b border-slate-900">
                  <span className="text-slate-400">Origen de Red:</span>
                  <span className="text-slate-200">{window.location.host}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-900">
                  <span className="text-slate-400">Seguridad:</span>
                  <span className="text-emerald-400">WSS/WS Local Autorizado</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Audios & Impresora:</span>
                  <span className="text-amber-400">Ejecución en PC</span>
                </div>
              </div>
              <div className="p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-xl flex gap-2.5 items-start">
                <Info size={14} className="text-indigo-400 mt-0.5 shrink-0" />
                <p className="text-[11px] text-slate-400 leading-normal">
                  Este PC mantendrá toda la persistencia (IndexedDB). Las tablets son únicamente controles remotos rápidos que actúan en tiempo real.
                </p>
              </div>
            </div>

          </div>

          {/* List of Authorized Tablets */}
          <div className="space-y-3">
            <h5 className="font-semibold text-sm text-slate-200">Tablets y Dispositivos Sincronizados ({connectedClients.length})</h5>
            
            {connectedClients.length === 0 ? (
              <div className="py-8 text-center border border-dashed border-slate-800 rounded-xl text-slate-500 text-xs">
                No hay tablets emparejadas todavía.
              </div>
            ) : (
              <div className="border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800 bg-slate-950/20">
                {connectedClients.map((client) => (
                  <div key={client.id} className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-1.5 rounded-lg ${client.connected ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                        <Smartphone size={16} />
                      </div>
                      <div>
                        {editingClientId === client.id ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={editingClientName}
                              onChange={(e) => setEditingClientName(e.target.value)}
                              className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-xs text-white outline-none focus:border-indigo-500"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveClientRename(client.id)}
                              className="p-1 text-emerald-400 hover:bg-slate-800 rounded"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={() => setEditingClientId(null)}
                              className="p-1 text-slate-400 hover:bg-slate-800 rounded"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-200 text-xs">{client.name}</span>
                            <button
                              onClick={() => handleStartEditingClient(client)}
                              className="p-0.5 text-slate-500 hover:text-slate-300 rounded"
                            >
                              <Edit2 size={10} />
                            </button>
                          </div>
                        )}
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${client.connected ? 'bg-emerald-500' : 'bg-slate-600'}`}></span>
                          <span className="text-[10px] text-slate-500">
                            {client.connected ? 'Conectado ahora' : 'Desconectado'}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => onRemoveClient(client.id)}
                      className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/5 rounded-lg transition-all cursor-pointer"
                      title="Desautorizar y desconectar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TABLET CLIENT MODE */}
      {deviceMode === 'client' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-sm text-slate-200">Mando Tablet (Control Remoto)</h4>
              
              {pairingStatus === 'paired' ? (
                <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded text-[10px] font-mono font-semibold flex items-center gap-1">
                  <Wifi size={10} /> CONECTADO
                </span>
              ) : pairingStatus === 'searching' ? (
                <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 rounded text-[10px] font-mono font-semibold flex items-center gap-1 animate-pulse">
                  <RefreshCw size={10} className="animate-spin" /> BUSCANDO PC...
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
              
              {/* Device Custom Name */}
              <div className="p-5 bg-slate-950/40 border border-slate-800/80 rounded-2xl space-y-3">
                <h5 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  Identificación de esta Tablet
                </h5>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputName}
                    onChange={(e) => setInputName(e.target.value)}
                    placeholder="E.g. Tablet Cocina"
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

              {/* Pairing Form */}
              <div className="bg-slate-950/80 border border-slate-800 p-6 rounded-2xl space-y-6">
                
                <div className="space-y-2">
                  <h5 className="font-bold text-slate-100 text-sm">Emparejar con el PC</h5>
                  <p className="text-xs text-slate-400">Introduce el código de 6 dígitos que se muestra en la pantalla del PC principal.</p>
                </div>

                <div className="flex flex-col gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-slate-500 font-mono">CÓDIGO DE 6 DÍGITOS</label>
                    <input
                      type="text"
                      maxLength={6}
                      value={inputCode}
                      onChange={(e) => setInputCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="E.g. 123456"
                      className="w-full text-center bg-slate-900 border border-slate-800 rounded-xl py-3 text-2xl font-extrabold text-white tracking-widest focus:border-indigo-500 outline-none placeholder:text-slate-700 font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-slate-500 font-mono">DIRECCIÓN IP DEL PC</label>
                      <input
                        type="text"
                        value={inputIP}
                        onChange={(e) => setInputIP(e.target.value)}
                        placeholder="E.g. 192.168.1.50:3000"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:border-indigo-500 outline-none font-mono"
                      />
                    </div>

                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={handleAutoDiscover}
                        disabled={isScanning}
                        className="w-full bg-slate-800 hover:bg-slate-700 text-indigo-400 hover:text-indigo-300 font-bold text-xs py-2 rounded-xl transition-all border border-slate-700/50 flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer h-9"
                      >
                        <RefreshCw size={12} className={isScanning ? "animate-spin" : ""} />
                        {isScanning ? 'Escaneando...' : 'Descubrir PC automático'}
                      </button>
                    </div>
                  </div>

                  {isScanning && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                        <span>Buscando PC en subred local ({scanProgress.scanned}/{scanProgress.total})...</span>
                        <span>{Math.floor((scanProgress.scanned / scanProgress.total) * 100)}%</span>
                      </div>
                      <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden border border-slate-800">
                        <div 
                          className="bg-indigo-500 h-full transition-all duration-100"
                          style={{ width: `${(scanProgress.scanned / scanProgress.total) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => onStartPairing(inputCode)}
                    disabled={inputCode.length !== 6 || pairingStatus === 'searching'}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/20 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {pairingStatus === 'searching' && <RefreshCw size={16} className="animate-spin" />}
                    Comenzar Emparejamiento
                  </button>

                </div>

              </div>

              <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-xl flex gap-3">
                <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h6 className="font-bold text-slate-200 text-xs">Instrucciones de Red</h6>
                  <p className="text-[11px] text-slate-400 leading-normal">
                    Ambos dispositivos deben estar conectados a la misma red Wi-Fi local para poder sincronizarse. Si el PC cambia de IP, haz clic en <strong>Descubrir PC automático</strong> para buscar el nuevo origen en la red Wi-Fi sin volver a emparejar.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
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
                      // Trigger a reconnect / verify
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

    </div>
  );
}
