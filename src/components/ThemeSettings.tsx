import React, { useState, useEffect } from 'react';
import {
  Palette,
  Sparkles,
  Eye,
  Check,
  Plus,
  Download,
  Upload,
  Copy,
  Trash2,
  Edit3,
  Sliders,
  Tv,
  Smartphone,
  Layers,
  Clock,
  Sun,
  Moon,
  Search,
  X,
  Laptop,
  History,
  Camera,
  Settings,
  Share2,
  CheckCircle2
} from 'lucide-react';
import {
  ThemePreset,
  CustomTheme,
  AppThemeConfig,
  AppModuleName,
  ThemeColors,
  ThemeAdvanced
} from '../types/theme';
import { PRESET_THEMES } from '../data/presetThemes';
import {
  getThemeConfig,
  saveThemeConfig,
  findThemeById,
  getAllThemes,
  applyThemeVariables,
  exportThemeToJSON,
  importThemeFromJSON
} from '../utils/themeController';
import { ThemeDiagnosticPanel } from './ThemeDiagnosticPanel';

interface ThemeSettingsProps {
  onToast?: (msg: string) => void;
}

export const ThemeSettings: React.FC<ThemeSettingsProps> = ({ onToast }) => {
  const [themeConfig, setThemeConfig] = useState<AppThemeConfig>(() => getThemeConfig());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  // Modals
  const [previewTheme, setPreviewTheme] = useState<ThemePreset | null>(null);
  const [isCreatorOpen, setIsCreatorOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState<ThemePreset | null>(null);

  // Custom theme editor state
  const [editingTheme, setEditingTheme] = useState<Partial<CustomTheme>>({
    name: 'Mi Tema Personalizado',
    description: 'Diseño personalizado a mi medida.',
    category: 'dark',
    colors: {
      primary: '#6366f1',
      secondary: '#38bdf8',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      bg: '#0f172a',
      cardBg: '#1e293b',
      buttonBg: '#4f46e5',
      text: '#f8fafc',
      icon: '#818cf8',
      tableBg: '#020617',
    },
    advanced: {
      borderRadius: 'lg',
      buttonSize: 'md',
      fontSize: 'md',
      spacing: 'normal',
      shadow: 'medium',
      glassmorphism: false,
      glassBlur: 12,
      animationIntensity: 'normal',
      transitionDuration: 'normal',
    },
  });

  const [importJsonText, setImportJsonText] = useState('');

  // Persist theme config changes
  const updateConfig = (newCfg: AppThemeConfig) => {
    setThemeConfig(newCfg);
    saveThemeConfig(newCfg);
    const currentTheme = findThemeById(newCfg.activeThemeId, newCfg.customThemes);
    applyThemeVariables(currentTheme);
  };

  const handleApplyTheme = (themeId: string) => {
    const updated: AppThemeConfig = {
      ...themeConfig,
      activeThemeId: themeId,
      moduleThemes: {
        panel: themeId,
        tv: themeId,
        mobile: themeId,
        settings: themeId,
        ocr: themeId,
        history: themeId,
      },
    };
    updateConfig(updated);
    setPreviewTheme(null);
    const themeObj = findThemeById(themeId, themeConfig.customThemes);
    onToast?.(`🎨 Tema "${themeObj.name}" aplicado a toda la aplicación`);
  };

  const handleSaveCustomTheme = () => {
    if (!editingTheme.name?.trim()) return;

    const newCustom: CustomTheme = {
      id: editingTheme.id || `custom_${Date.now()}`,
      name: editingTheme.name || 'Tema Personalizado',
      description: editingTheme.description || '',
      category: editingTheme.category || 'dark',
      colors: editingTheme.colors as ThemeColors,
      advanced: editingTheme.advanced as ThemeAdvanced,
      isCustom: true,
      createdAt: editingTheme.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    const existingIndex = themeConfig.customThemes.findIndex((t) => t.id === newCustom.id);
    let updatedCustoms = [...themeConfig.customThemes];

    if (existingIndex >= 0) {
      updatedCustoms[existingIndex] = newCustom;
    } else {
      updatedCustoms.push(newCustom);
    }

    const updatedConfig: AppThemeConfig = {
      ...themeConfig,
      customThemes: updatedCustoms,
      activeThemeId: newCustom.id,
    };

    updateConfig(updatedConfig);
    setIsCreatorOpen(false);
    onToast?.(`✨ Tema personalizado "${newCustom.name}" guardado y aplicado`);
  };

  const handleDeleteCustomTheme = (id: string, name: string) => {
    const updatedCustoms = themeConfig.customThemes.filter((t) => t.id !== id);
    let activeId = themeConfig.activeThemeId;
    if (activeId === id) {
      activeId = 'dark-premium';
    }
    const updatedConfig: AppThemeConfig = {
      ...themeConfig,
      customThemes: updatedCustoms,
      activeThemeId: activeId,
    };
    updateConfig(updatedConfig);
    onToast?.(`🗑️ Tema "${name}" eliminado`);
  };

  const handleDuplicateTheme = (theme: ThemePreset) => {
    const dup: Partial<CustomTheme> = {
      id: `custom_${Date.now()}`,
      name: `${theme.name} (Copia)`,
      description: `Copia basada en ${theme.name}`,
      category: theme.category,
      colors: { ...theme.colors },
      advanced: { ...theme.advanced },
      isCustom: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setEditingTheme(dup);
    setIsCreatorOpen(true);
  };

  const handleImportJson = () => {
    const imported = importThemeFromJSON(importJsonText);
    if (!imported) {
      onToast?.('❌ Error: Formato JSON de tema inválido');
      return;
    }
    const updatedCustoms = [...themeConfig.customThemes, imported];
    const updatedConfig: AppThemeConfig = {
      ...themeConfig,
      customThemes: updatedCustoms,
      activeThemeId: imported.id,
    };
    updateConfig(updatedConfig);
    setIsImportOpen(false);
    setImportJsonText('');
    onToast?.(`📥 Tema "${imported.name}" importado exitosamente`);
  };

  const allThemes = getAllThemes(themeConfig.customThemes);

  const filteredThemes = allThemes.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCategory === 'all' || t.category === selectedCategory || (selectedCategory === 'custom' && t.isCustom);
    return matchesSearch && matchesCat;
  });

  const activeTheme = findThemeById(themeConfig.activeThemeId, themeConfig.customThemes);

  return (
    <div className="space-y-8 text-slate-100">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-900/40 via-purple-900/30 to-slate-900 p-6 rounded-3xl border border-indigo-500/30 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Palette size={180} className="text-indigo-400" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold">
              <Sparkles size={14} />
              <span>Personalización de Apariencia Total</span>
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white flex items-center gap-3">
              🎨 Biblioteca de Temas Profesionales
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Selecciona entre 30 temas predefinidos de alta definición, crea tus propias combinaciones cromáticas avanzadas o configura temas independientes para la Pantalla TV y el Panel Principal.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => {
                setEditingTheme({
                  id: `custom_${Date.now()}`,
                  name: 'Nuevo Tema Personalizado',
                  description: 'Creado desde cero.',
                  category: 'dark',
                  colors: { ...activeTheme.colors },
                  advanced: { ...activeTheme.advanced },
                  isCustom: true,
                });
                setIsCreatorOpen(true);
              }}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2"
            >
              <Plus size={16} />
              <span>Crear Tema</span>
            </button>
            <button
              onClick={() => setIsImportOpen(true)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs px-3.5 py-2.5 rounded-xl border border-slate-700 transition-all flex items-center gap-2"
            >
              <Upload size={15} />
              <span>Importar JSON</span>
            </button>
          </div>
        </div>
      </div>

      {/* Active Theme Status Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-inner border border-white/20"
            style={{ backgroundColor: activeTheme.colors.primary }}
          >
            🎨
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Tema Activo Actual</div>
            <div className="text-sm font-bold text-white flex items-center gap-2">
              <span>{activeTheme.name}</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                ● Aplicado en tiempo real
              </span>
            </div>
          </div>
        </div>

        {/* Color Palette Pill Preview */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-2 rounded-xl border border-slate-800">
          <span className="text-[10px] text-slate-400 font-mono mr-1">Paleta:</span>
          <div className="w-5 h-5 rounded-full border border-white/20" style={{ backgroundColor: activeTheme.colors.bg }} title="Fondo" />
          <div className="w-5 h-5 rounded-full border border-white/20" style={{ backgroundColor: activeTheme.colors.cardBg }} title="Tarjeta" />
          <div className="w-5 h-5 rounded-full border border-white/20" style={{ backgroundColor: activeTheme.colors.primary }} title="Principal" />
          <div className="w-5 h-5 rounded-full border border-white/20" style={{ backgroundColor: activeTheme.colors.secondary }} title="Secundario" />
          <div className="w-5 h-5 rounded-full border border-white/20" style={{ backgroundColor: activeTheme.colors.buttonBg }} title="Botón" />
          <div className="w-5 h-5 rounded-full border border-white/20" style={{ backgroundColor: activeTheme.colors.success }} title="Éxito" />
        </div>
      </div>

      {/* Herramienta de Diagnóstico Global de Temas */}
      <ThemeDiagnosticPanel onToast={onToast} />

      {/* Filter and Search Bar */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Categories */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
            {[
              { id: 'all', label: 'Todos (30+)' },
              { id: 'dark', label: '🌙 Oscuros' },
              { id: 'light', label: '☀️ Claros' },
              { id: 'neon', label: '⚡ Neón' },
              { id: 'glass', label: '💎 Cristal / Glass' },
              { id: 'corporate', label: '🏢 Corporativos' },
              { id: 'vibrant', label: '🔥 Vibrantes' },
              { id: 'custom', label: '⭐ Mis Temas' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-64">
            <Search size={14} className="absolute left-3 top-3 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar tema..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Theme Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredThemes.map((theme) => {
            const isActive = themeConfig.activeThemeId === theme.id;
            return (
              <div
                key={theme.id}
                className={`group bg-slate-900 rounded-2xl border transition-all duration-200 flex flex-col justify-between overflow-hidden relative ${
                  isActive
                    ? 'border-indigo-500 ring-2 ring-indigo-500/40 shadow-xl shadow-indigo-950/50'
                    : 'border-slate-800/90 hover:border-slate-700 hover:shadow-lg'
                }`}
              >
                {/* Active Badge */}
                {isActive && (
                  <div className="absolute top-2.5 right-2.5 z-20 bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-md">
                    <CheckCircle2 size={12} />
                    <span>Activo</span>
                  </div>
                )}

                {/* Card Top / Mini Live Preview Frame */}
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">
                        {theme.name}
                      </h3>
                      <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                        {theme.category}
                      </span>
                    </div>
                  </div>

                  {/* Visual Theme Card Micro Mockup */}
                  <div
                    className="p-3 rounded-xl border transition-all overflow-hidden relative space-y-2 shadow-inner"
                    style={{
                      backgroundColor: theme.colors.bg,
                      borderColor: theme.colors.primary + '30',
                      color: theme.colors.text,
                    }}
                  >
                    {/* Header Bar Mockup */}
                    <div
                      className="h-4 rounded-md flex items-center justify-between px-2 text-[8px] font-bold"
                      style={{ backgroundColor: theme.colors.cardBg, color: theme.colors.text }}
                    >
                      <span style={{ color: theme.colors.primary }}>REST. CONTROL</span>
                      <div className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: theme.colors.success }} />
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: theme.colors.warning }} />
                      </div>
                    </div>

                    {/* Content Mockup */}
                    <div className="grid grid-cols-2 gap-1.5">
                      <div
                        className="p-2 rounded-lg text-center space-y-1 border"
                        style={{ backgroundColor: theme.colors.cardBg, borderColor: theme.colors.primary + '20' }}
                      >
                        <span className="text-[8px] opacity-60 block uppercase font-mono">Llamando</span>
                        <span className="text-xs font-black block" style={{ color: theme.colors.primary }}>
                          #542
                        </span>
                      </div>
                      <div
                        className="p-2 rounded-lg text-center space-y-1 border"
                        style={{ backgroundColor: theme.colors.cardBg, borderColor: theme.colors.primary + '20' }}
                      >
                        <span className="text-[8px] opacity-60 block uppercase font-mono">Listos</span>
                        <span className="text-[10px] font-bold block" style={{ color: theme.colors.secondary }}>
                          #543, #544
                        </span>
                      </div>
                    </div>

                    {/* Action Button Mockup */}
                    <div
                      className="h-5 rounded-lg flex items-center justify-center text-[9px] font-bold text-white shadow-sm"
                      style={{ backgroundColor: theme.colors.buttonBg }}
                    >
                      Siguiente Pedido →
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                    {theme.description}
                  </p>
                </div>

                {/* Card Footer Actions */}
                <div className="p-3 bg-slate-950/60 border-t border-slate-800/80 flex items-center justify-between gap-1.5">
                  <button
                    onClick={() => setPreviewTheme(theme)}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold py-1.5 rounded-lg transition-all flex items-center justify-center gap-1"
                  >
                    <Eye size={13} />
                    <span>Vista previa</span>
                  </button>

                  <button
                    onClick={() => handleApplyTheme(theme.id)}
                    className={`flex-1 text-xs font-bold py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 ${
                      isActive
                        ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md'
                    }`}
                  >
                    <Check size={13} />
                    <span>{isActive ? 'Aplicado' : 'Aplicar'}</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDuplicateTheme(theme)}
                      className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-md transition-colors"
                      title="Duplicar y editar"
                    >
                      <Copy size={13} />
                    </button>
                    <button
                      onClick={() => setIsExportOpen(theme)}
                      className="p-1.5 text-slate-400 hover:text-sky-400 hover:bg-slate-800 rounded-md transition-colors"
                      title="Exportar JSON"
                    >
                      <Download size={13} />
                    </button>

                    {/* Extra options for custom themes */}
                    {theme.isCustom && (
                      <>
                        <button
                          onClick={() => {
                            setEditingTheme(theme);
                            setIsCreatorOpen(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-md transition-colors"
                          title="Editar tema"
                        >
                          <Edit3 size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteCustomTheme(theme.id, theme.name)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-md transition-colors"
                          title="Eliminar tema"
                        >
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Module Independent Theme Assignment Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Layers size={20} className="text-indigo-400" />
              <span>Temas Independientes por Módulo</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Asigna un estilo visual distinto para la Pantalla TV, el Panel Principal, Móvil u OCR.
            </p>
          </div>
          <span className="bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold px-3 py-1 rounded-full font-mono">
            Multipantalla
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { id: 'panel', label: 'Panel Principal', icon: Laptop, desc: 'Pantalla de control del personal' },
            { id: 'tv', label: 'Pantalla TV Pública', icon: Tv, desc: 'Pantalla grande para clientes' },
            { id: 'mobile', label: 'Modo Móvil', icon: Smartphone, desc: 'Navegación compacta en smartphones' },
            { id: 'settings', label: 'Configuración', icon: Settings, desc: 'Panel de ajustes y configuración' },
            { id: 'ocr', label: 'Escaner OCR Cámara', icon: Camera, desc: 'Visor de reconocimiento visual' },
            { id: 'history', label: 'Historial', icon: History, desc: 'Módulo de auditoría y registros' },
          ].map((mod) => {
            const IconComp = mod.icon;
            const currentModThemeId = themeConfig.moduleThemes[mod.id as AppModuleName] || themeConfig.activeThemeId;
            const currentModTheme = findThemeById(currentModThemeId, themeConfig.customThemes);

            return (
              <div key={mod.id} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      <IconComp size={16} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">{mod.label}</h4>
                      <p className="text-[10px] text-slate-400">{mod.desc}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono text-slate-500 block uppercase">Tema Asignado</label>
                  <select
                    value={currentModThemeId}
                    onChange={(e) => {
                      const updatedModuleThemes = {
                        ...themeConfig.moduleThemes,
                        [mod.id]: e.target.value,
                      };
                      updateConfig({
                        ...themeConfig,
                        moduleThemes: updatedModuleThemes,
                      });
                      onToast?.(`🎨 Tema para "${mod.label}" actualizado a "${e.target.options[e.target.selectedIndex].text}"`);
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 font-semibold focus:outline-none focus:border-indigo-500"
                  >
                    {allThemes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.category})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/60 font-mono">
                  <span>Color Primario:</span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-white/20 inline-block"
                      style={{ backgroundColor: currentModTheme.colors.primary }}
                    />
                    <span className="text-slate-200 font-bold">{currentModTheme.name}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Auto Theme Switcher Schedule Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Clock size={20} className="text-indigo-400" />
              <span>Modo Automático de Apariencia</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Alterna automáticamente entre temas claros y oscuros según la hora o la preferencia del sistema.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={themeConfig.autoSchedule.enabled}
              onChange={(e) => {
                updateConfig({
                  ...themeConfig,
                  autoSchedule: {
                    ...themeConfig.autoSchedule,
                    enabled: e.target.checked,
                  },
                });
                onToast?.(e.target.checked ? '⏰ Cambio automático de tema ACTIVADO' : '⏸️ Cambio automático DESACTIVADO');
              }}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600" />
          </label>
        </div>

        {themeConfig.autoSchedule.enabled && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
              <label className="text-xs font-bold text-indigo-400 block uppercase">Criterio de Cambio</label>
              <select
                value={themeConfig.autoSchedule.mode}
                onChange={(e) => {
                  updateConfig({
                    ...themeConfig,
                    autoSchedule: {
                      ...themeConfig.autoSchedule,
                      mode: e.target.value as any,
                    },
                  });
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="schedule">Programación por Horario (Día / Noche)</option>
                <option value="system">Sincronizar con Modo Sistema (OS)</option>
              </select>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
              <label className="text-xs font-bold text-amber-400 block uppercase flex items-center gap-1">
                <Sun size={14} /> Tema Diurno
              </label>
              <select
                value={themeConfig.autoSchedule.dayThemeId}
                onChange={(e) => {
                  updateConfig({
                    ...themeConfig,
                    autoSchedule: {
                      ...themeConfig.autoSchedule,
                      dayThemeId: e.target.value,
                    },
                  });
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                {allThemes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
              <label className="text-xs font-bold text-indigo-400 block uppercase flex items-center gap-1">
                <Moon size={14} /> Tema Nocturno
              </label>
              <select
                value={themeConfig.autoSchedule.nightThemeId}
                onChange={(e) => {
                  updateConfig({
                    ...themeConfig,
                    autoSchedule: {
                      ...themeConfig.autoSchedule,
                      nightThemeId: e.target.value,
                    },
                  });
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                {allThemes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* LIVE PREVIEW MODAL */}
      {previewTheme && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 space-y-6 shadow-2xl overflow-hidden relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Eye size={20} className="text-indigo-400" />
                  <span>Vista Previa del Tema: {previewTheme.name}</span>
                </h3>
                <p className="text-xs text-slate-400">{previewTheme.description}</p>
              </div>
              <button
                onClick={() => setPreviewTheme(null)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Simulated Live UI Preview */}
            <div
              className="p-6 rounded-2xl border space-y-4 shadow-xl"
              style={{
                backgroundColor: previewTheme.colors.bg,
                borderColor: previewTheme.colors.primary + '40',
                color: previewTheme.colors.text,
              }}
            >
              {/* Top Navigation Bar Simulation */}
              <div
                className="p-3.5 rounded-xl flex items-center justify-between border"
                style={{
                  backgroundColor: previewTheme.colors.cardBg,
                  borderColor: previewTheme.colors.primary + '20',
                }}
              >
                <div className="flex items-center gap-2 font-black text-sm">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: previewTheme.colors.primary }} />
                  <span>SISTEMA DE TURNOS - RESTAURANTE</span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="px-2.5 py-1 rounded-full text-[10px] font-bold text-white"
                    style={{ backgroundColor: previewTheme.colors.buttonBg }}
                  >
                    🔴 EN VIVO TV
                  </span>
                </div>
              </div>

              {/* Main Ticket Call Panel Simulation */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div
                  className="p-5 rounded-2xl border text-center space-y-2 shadow-lg"
                  style={{
                    backgroundColor: previewTheme.colors.cardBg,
                    borderColor: previewTheme.colors.primary,
                  }}
                >
                  <span className="text-xs uppercase font-bold tracking-widest opacity-70">
                    Llamando Ahora (TV)
                  </span>
                  <div
                    className="text-4xl font-black tracking-tight my-2"
                    style={{ color: previewTheme.colors.primary }}
                  >
                    #542
                  </div>
                  <div
                    className="inline-block px-3 py-1 rounded-full text-xs font-bold text-white shadow-sm"
                    style={{ backgroundColor: previewTheme.colors.success }}
                  >
                    ✓ PEDIDO LISTO PARA ENTREGAR
                  </div>
                </div>

                <div
                  className="p-5 rounded-2xl border space-y-3"
                  style={{
                    backgroundColor: previewTheme.colors.cardBg,
                    borderColor: previewTheme.colors.secondary + '30',
                  }}
                >
                  <span className="text-xs uppercase font-bold tracking-wider opacity-70 block">
                    Próximos Pedidos en Cola
                  </span>
                  <div className="flex items-center gap-2">
                    {['#543', '#544', '#545'].map((num) => (
                      <span
                        key={num}
                        className="px-3 py-1.5 rounded-xl font-bold text-xs border"
                        style={{
                          backgroundColor: previewTheme.colors.bg,
                          color: previewTheme.colors.secondary,
                          borderColor: previewTheme.colors.secondary + '40',
                        }}
                      >
                        {num}
                      </span>
                    ))}
                  </div>
                  <button
                    className="w-full py-2.5 rounded-xl text-xs font-bold text-white shadow-md transition-all mt-2"
                    style={{ backgroundColor: previewTheme.colors.buttonBg }}
                  >
                    Entregar Ticket #542
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
              <button
                onClick={() => setPreviewTheme(null)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs px-4 py-2.5 rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleApplyTheme(previewTheme.id)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2"
              >
                <Check size={16} />
                <span>Aplicar Tema Ahora</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT CUSTOM THEME MODAL */}
      {isCreatorOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full p-6 space-y-6 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Palette size={20} className="text-indigo-400" />
                  <span>Editor de Tema Personalizado</span>
                </h3>
                <p className="text-xs text-slate-400">Personaliza cada color y parámetro visual de la interfaz.</p>
              </div>
              <button
                onClick={() => setIsCreatorOpen(false)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Theme Meta Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Nombre del Tema</label>
                <input
                  type="text"
                  value={editingTheme.name || ''}
                  onChange={(e) => setEditingTheme({ ...editingTheme, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  placeholder="Ej: Mi Restaurante Gold"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Categoría</label>
                <select
                  value={editingTheme.category || 'dark'}
                  onChange={(e) => setEditingTheme({ ...editingTheme, category: e.target.value as any })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="dark">Oscuro</option>
                  <option value="light">Claro</option>
                  <option value="neon">Neón</option>
                  <option value="glass">Cristal / Glass</option>
                  <option value="corporate">Corporativo</option>
                  <option value="vibrant">Vibrante</option>
                </select>
              </div>
            </div>

            {/* Color Palette Controls Grid */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Paleta Cromática</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {[
                  { key: 'primary', label: 'Color Principal' },
                  { key: 'secondary', label: 'Color Secundario' },
                  { key: 'success', label: 'Éxito / Listo' },
                  { key: 'warning', label: 'Advertencia' },
                  { key: 'error', label: 'Error / Anulado' },
                  { key: 'bg', label: 'Fondo Pantalla' },
                  { key: 'cardBg', label: 'Fondo Tarjetas' },
                  { key: 'buttonBg', label: 'Fondo Botones' },
                  { key: 'text', label: 'Texto Principal' },
                  { key: 'icon', label: 'Iconos' },
                  { key: 'tableBg', label: 'Fondo Tablas' },
                ].map((item) => {
                  const colorVal = (editingTheme.colors as any)?.[item.key] || '#ffffff';
                  return (
                    <div key={item.key} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 space-y-1.5">
                      <label className="text-[10px] font-semibold text-slate-400 block truncate">{item.label}</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={colorVal.startsWith('#') ? colorVal : '#ffffff'}
                          onChange={(e) =>
                            setEditingTheme({
                              ...editingTheme,
                              colors: {
                                ...(editingTheme.colors as ThemeColors),
                                [item.key]: e.target.value,
                              },
                            })
                          }
                          className="w-7 h-7 rounded-lg border-0 cursor-pointer p-0 bg-transparent"
                        />
                        <input
                          type="text"
                          value={colorVal}
                          onChange={(e) =>
                            setEditingTheme({
                              ...editingTheme,
                              colors: {
                                ...(editingTheme.colors as ThemeColors),
                                [item.key]: e.target.value,
                              },
                            })
                          }
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-[11px] font-mono text-slate-200 focus:outline-none"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Advanced UI Parameters */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Ajustes Avanzados</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                  <label className="text-[10px] text-slate-400 block font-semibold">Bordes Redondeados</label>
                  <select
                    value={editingTheme.advanced?.borderRadius || 'lg'}
                    onChange={(e) =>
                      setEditingTheme({
                        ...editingTheme,
                        advanced: {
                          ...(editingTheme.advanced as ThemeAdvanced),
                          borderRadius: e.target.value as any,
                        },
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none"
                  >
                    <option value="none">Recto (0px)</option>
                    <option value="sm">Suave (6px)</option>
                    <option value="md">Medio (12px)</option>
                    <option value="lg">Redondeado (16px)</option>
                    <option value="full">Pill (9999px)</option>
                  </select>
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                  <label className="text-[10px] text-slate-400 block font-semibold">Efecto Cristal (Glass)</label>
                  <button
                    onClick={() =>
                      setEditingTheme({
                        ...editingTheme,
                        advanced: {
                          ...(editingTheme.advanced as ThemeAdvanced),
                          glassmorphism: !editingTheme.advanced?.glassmorphism,
                        },
                      })
                    }
                    className={`w-full py-1.5 rounded-lg text-xs font-bold transition-all ${
                      editingTheme.advanced?.glassmorphism
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-900 text-slate-400 border border-slate-800'
                    }`}
                  >
                    {editingTheme.advanced?.glassmorphism ? '✨ Glassmorphism ON' : 'Desactivado'}
                  </button>
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                  <label className="text-[10px] text-slate-400 block font-semibold">Efecto Sombra</label>
                  <select
                    value={editingTheme.advanced?.shadow || 'medium'}
                    onChange={(e) =>
                      setEditingTheme({
                        ...editingTheme,
                        advanced: {
                          ...(editingTheme.advanced as ThemeAdvanced),
                          shadow: e.target.value as any,
                        },
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none"
                  >
                    <option value="none">Sin sombra</option>
                    <option value="subtle">Sutil</option>
                    <option value="medium">Media</option>
                    <option value="glow">Brillo Neón (Glow)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
              <button
                onClick={() => setIsCreatorOpen(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs px-4 py-2.5 rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveCustomTheme}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2"
              >
                <Check size={16} />
                <span>Guardar y Aplicar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IMPORT JSON MODAL */}
      {isImportOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Upload size={18} className="text-indigo-400" />
                <span>Importar Tema desde JSON</span>
              </h3>
              <button
                onClick={() => setIsImportOpen(false)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Pega aquí el código JSON del tema para agregarlo a tu biblioteca.
            </p>

            <textarea
              rows={8}
              value={importJsonText}
              onChange={(e) => setImportJsonText(e.target.value)}
              placeholder='{\n  "name": "Mi Tema",\n  "colors": { ... }\n}'
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
            />

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
              <button
                onClick={() => setIsImportOpen(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs px-4 py-2 rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={handleImportJson}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-5 py-2 rounded-xl shadow-md flex items-center gap-2"
              >
                <Check size={15} />
                <span>Importar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EXPORT JSON MODAL */}
      {isExportOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Download size={18} className="text-sky-400" />
                <span>Exportar Tema: {isExportOpen.name}</span>
              </h3>
              <button
                onClick={() => setIsExportOpen(null)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Copia este código JSON para compartirlo o guardarlo como respaldo:
            </p>

            <textarea
              rows={10}
              readOnly
              value={exportThemeToJSON(isExportOpen)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-indigo-300 focus:outline-none"
            />

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(exportThemeToJSON(isExportOpen));
                  onToast?.('📋 Código JSON copiado al portapapeles');
                }}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs px-4 py-2 rounded-xl flex items-center gap-2 border border-slate-700"
              >
                <Copy size={14} />
                <span>Copiar JSON</span>
              </button>
              <button
                onClick={() => {
                  const blob = new Blob([exportThemeToJSON(isExportOpen)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `tema_${isExportOpen.id}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                  onToast?.('💾 Archivo JSON descargado');
                }}
                className="bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs px-5 py-2 rounded-xl shadow-md flex items-center gap-2"
              >
                <Download size={15} />
                <span>Descargar Archivo</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
