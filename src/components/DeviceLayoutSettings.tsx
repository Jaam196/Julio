import React, { useState } from 'react';
import { 
  Monitor, Tablet, Smartphone, Sliders, Eye, Grid, LayoutList, Layers, RefreshCw, Check, Sparkles, Smartphone as PhoneIcon
} from 'lucide-react';
import { 
  useDeviceLayout, 
  getDeviceLayoutConfig, 
  saveDeviceLayoutConfig, 
  DeviceType, 
  DEFAULT_LAYOUT_CONFIGS,
  DeviceLayoutConfig
} from '../utils/deviceLayoutController';

interface DeviceLayoutSettingsProps {
  onToast?: (msg: string) => void;
}

export function DeviceLayoutSettings({ onToast }: DeviceLayoutSettingsProps) {
  const { deviceType: currentActiveDevice, layoutConfig: activeConfig, updateConfig } = useDeviceLayout();
  const [selectedDeviceTab, setSelectedDeviceTab] = useState<DeviceType>(currentActiveDevice);
  const [config, setConfig] = useState<DeviceLayoutConfig>(() => getDeviceLayoutConfig(selectedDeviceTab));

  const handleSelectDeviceTab = (dev: DeviceType) => {
    setSelectedDeviceTab(dev);
    setConfig(getDeviceLayoutConfig(dev));
  };

  const handleUpdate = (partial: Partial<DeviceLayoutConfig>) => {
    const updated = saveDeviceLayoutConfig(selectedDeviceTab, partial);
    setConfig(updated);
    if (selectedDeviceTab === currentActiveDevice) {
      updateConfig(partial);
    }
    onToast?.(`Configuración de ${selectedDeviceTab.toUpperCase()} actualizada`);
  };

  const handleReset = () => {
    const defaultCfg = DEFAULT_LAYOUT_CONFIGS[selectedDeviceTab];
    saveDeviceLayoutConfig(selectedDeviceTab, defaultCfg);
    setConfig(defaultCfg);
    if (selectedDeviceTab === currentActiveDevice) {
      updateConfig(defaultCfg);
    }
    onToast?.(`Diseño de ${selectedDeviceTab.toUpperCase()} restaurado por defecto`);
  };

  return (
    <div className="space-y-6 bg-slate-900/60 border border-slate-800 rounded-3xl p-6 backdrop-blur-sm">
      
      {/* Encabezado e indicador del dispositivo actual */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <Sliders size={20} className="text-indigo-400" />
            <span>Diseño Responsive Independiente (PC, Tablet y Móvil)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Los cambios realizados en un dispositivo no afectarán la apariencia ni la configuración de los demás.
          </p>
        </div>

        {/* Indicador de detección automática en tiempo real */}
        <div className="flex items-center gap-2 bg-indigo-950/80 border border-indigo-500/30 px-3.5 py-1.5 rounded-2xl">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="text-xs text-indigo-200 font-medium">Detectado ahora:</span>
          <span className="text-xs font-black text-white uppercase bg-indigo-600 px-2 py-0.5 rounded-lg flex items-center gap-1">
            {currentActiveDevice === 'pc' && <Monitor size={13} />}
            {currentActiveDevice === 'tablet' && <Tablet size={13} />}
            {currentActiveDevice === 'mobile' && <Smartphone size={13} />}
            {currentActiveDevice}
          </span>
        </div>
      </div>

      {/* Selector de pestañas de configuración por dispositivo */}
      <div className="grid grid-cols-3 gap-2 bg-slate-950 p-1.5 border border-slate-800 rounded-2xl">
        <button
          onClick={() => handleSelectDeviceTab('pc')}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
            selectedDeviceTab === 'pc'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Monitor size={16} />
          <span>🖥️ PC ({currentActiveDevice === 'pc' ? 'Activo' : 'Configurar'})</span>
        </button>

        <button
          onClick={() => handleSelectDeviceTab('tablet')}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
            selectedDeviceTab === 'tablet'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Tablet size={16} />
          <span>📟 Tablet ({currentActiveDevice === 'tablet' ? 'Activo' : 'Configurar'})</span>
        </button>

        <button
          onClick={() => handleSelectDeviceTab('mobile')}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
            selectedDeviceTab === 'mobile'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Smartphone size={16} />
          <span>📱 Móvil ({currentActiveDevice === 'mobile' ? 'Activo' : 'Configurar'})</span>
        </button>
      </div>

      {/* Opciones de configuración del dispositivo seleccionado */}
      <div className="space-y-5 bg-slate-950/70 border border-slate-800/80 rounded-2xl p-5">
        
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
            <Sparkles size={14} className="text-amber-400" />
            Configuración exclusiva para {selectedDeviceTab.toUpperCase()}
          </span>
          <button
            onClick={handleReset}
            className="text-slate-400 hover:text-amber-300 text-xs flex items-center gap-1 bg-slate-900 border border-slate-800 px-3 py-1 rounded-xl transition-all cursor-pointer"
          >
            <RefreshCw size={12} />
            <span>Restablecer por defecto</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          
          {/* Densidad visual */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 block">
              Densidad y espaciado de elementos
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'comfortable', label: 'Cómoda', desc: 'Espacio amplio' },
                { id: 'compact', label: 'Compacta', desc: 'Alta densidad' },
                { id: 'touch', label: 'Táctil', desc: 'Botones grandes' },
              ].map((d) => (
                <button
                  key={d.id}
                  onClick={() => handleUpdate({ panelDensity: d.id as any })}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    config.panelDensity === d.id
                      ? 'bg-indigo-600/20 border-indigo-500 text-white font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <p className="text-xs font-extrabold">{d.label}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{d.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Columnas predeterminadas en tablero */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 block">
              Columnas simultáneas en tablero
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((cols) => (
                <button
                  key={cols}
                  onClick={() => handleUpdate({ gridColumns: cols })}
                  className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                    config.gridColumns === cols
                      ? 'bg-indigo-600/20 border-indigo-500 text-white font-black'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <span className="text-sm">{cols} col{cols > 1 ? 's' : ''}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Escala de Zoom / Tamaño */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 block">
              Escala de interfaz ({config.zoomLevel || 100}%)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="80"
                max="120"
                step="5"
                value={config.zoomLevel || 100}
                onChange={(e) => handleUpdate({ zoomLevel: Number(e.target.value) })}
                className="w-full accent-indigo-500 cursor-pointer"
              />
              <span className="text-xs font-mono font-bold text-indigo-300 bg-slate-900 px-2.5 py-1 border border-slate-800 rounded-lg shrink-0">
                {config.zoomLevel || 100}%
              </span>
            </div>
          </div>

          {/* Vista principal predeterminada */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 block">
              Vista predeterminada del tablero
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'grid', label: 'Cuadrícula', icon: <Grid size={14} /> },
                { id: 'cards', label: 'Tarjetas', icon: <Layers size={14} /> },
                { id: 'list', label: 'Lista', icon: <LayoutList size={14} /> },
              ].map((vm) => (
                <button
                  key={vm.id}
                  onClick={() => handleUpdate({ activeViewMode: vm.id as any })}
                  className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 text-xs transition-all cursor-pointer ${
                    config.activeViewMode === vm.id
                      ? 'bg-indigo-600/20 border-indigo-500 text-white font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {vm.icon}
                  <span>{vm.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Opciones adicionales */}
          <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <label className="flex items-center gap-3 p-3 bg-slate-900 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700 transition-all">
              <input
                type="checkbox"
                checked={config.showQuickBar}
                onChange={(e) => handleUpdate({ showQuickBar: e.target.checked })}
                className="w-4 h-4 accent-indigo-600 rounded"
              />
              <div>
                <span className="text-xs font-bold text-slate-200 block">Mostrar barra de herramientas rápida</span>
                <span className="text-[10px] text-slate-400 block">Acceso directo a llamar siguiente ticket y anunciar TTS</span>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 bg-slate-900 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700 transition-all">
              <input
                type="checkbox"
                checked={config.showQuickStats}
                onChange={(e) => handleUpdate({ showQuickStats: e.target.checked })}
                className="w-4 h-4 accent-indigo-600 rounded"
              />
              <div>
                <span className="text-xs font-bold text-slate-200 block">Mostrar resumen rápido de contadores</span>
                <span className="text-[10px] text-slate-400 block">Paneles de métricas clave al inicio</span>
              </div>
            </label>
          </div>

        </div>

      </div>

      {/* Resumen explicativo de comportamiento responsive */}
      <div className="bg-slate-950/40 border border-indigo-500/20 rounded-2xl p-4 text-xs text-slate-300 space-y-2">
        <p className="font-extrabold text-indigo-300 flex items-center gap-2">
          <Check size={16} className="text-emerald-400" />
          <span>Garantía de Aislamiento por Dispositivo:</span>
        </p>
        <ul className="list-disc list-inside space-y-1 text-slate-400 text-[11px] pl-1">
          <li><strong>PC (≥ 1024px):</strong> Mantiene layout de múltiples columnas, densidad cómoda y barra superior completa.</li>
          <li><strong>Tablet (768px - 1023px):</strong> Ajusta a 2 columnas con botones adaptados a toque con mayor superficie.</li>
          <li><strong>Móvil (&lt; 768px):</strong> Dispone navegación fija e independiente en la parte inferior para manejo fácil con una sola mano, sin desbordamiento horizontal.</li>
        </ul>
      </div>

    </div>
  );
}
