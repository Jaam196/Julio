import React, { useState, useEffect } from 'react';
import { VoiceSettings, ShortcutConfig, AppConfig, MusicConfig } from '../types';
import { musicController } from '../utils/musicController';
import { DEFAULT_PHRASES, replaceNumbersWithWords } from '../utils/audio';
import { 
  Volume2, Sliders, Keyboard, Settings, VolumeX, Smartphone, Eye, 
  Play, Pause, Music, HelpCircle, Info, ExternalLink, Volume1, AlertTriangle, Check, RefreshCw, Shuffle
} from 'lucide-react';
import { formatKeyEventString, matchesShortcut, SHORTCUT_NAMES } from '../utils/shortcutHelper';

interface SettingsPanelProps {
  voiceSettings: VoiceSettings;
  shortcutConfig: ShortcutConfig;
  appConfig: AppConfig;
  musicConfig: MusicConfig;
  onSaveVoiceSettings: (settings: VoiceSettings) => void;
  onSaveShortcutConfig: (shortcuts: ShortcutConfig) => void;
  onSaveAppConfig: (config: AppConfig) => void;
  onSaveMusicConfig: (config: MusicConfig) => void;
}

export default function SettingsPanel({
  voiceSettings,
  shortcutConfig,
  appConfig,
  musicConfig,
  onSaveVoiceSettings,
  onSaveShortcutConfig,
  onSaveAppConfig,
  onSaveMusicConfig,
}: SettingsPanelProps) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [editingShortcut, setEditingShortcut] = useState<keyof ShortcutConfig | null>(null);
  const [playerState, setPlayerState] = useState(musicController.getState());
  
  // Keyboard Shortcut advanced states
  const [conflict, setConflict] = useState<{
    key: string;
    newField: keyof ShortcutConfig;
    oldField: keyof ShortcutConfig;
  } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testKey, setTestKey] = useState<{
    raw: string;
    formatted: string;
    matchedAction: string | null;
  } | null>(null);

  // Subscribe to real-time player state
  useEffect(() => {
    const unsubscribe = musicController.subscribe((state) => {
      setPlayerState(state);
    });
    return () => unsubscribe();
  }, []);

  // Load available system TTS voices
  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      const loadVoices = () => {
        const synthVoices = window.speechSynthesis.getVoices();
        setVoices(synthVoices);
      };
      
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  // Synchronize selected voice when lang or available voices change
  useEffect(() => {
    if (voices.length === 0) return;
    
    const prefix = voiceSettings.lang;
    const availableFiltered = voices.filter((v) => v.lang.toLowerCase().startsWith(prefix));
    
    if (availableFiltered.length > 0) {
      const hasSelectedMatched = availableFiltered.some(v => v.voiceURI === voiceSettings.voiceURI);
      if (!hasSelectedMatched) {
        // Auto-select first matching voice to prevent state mismatch
        onSaveVoiceSettings({
          ...voiceSettings,
          voiceURI: availableFiltered[0].voiceURI
        });
      }
    }
  }, [voiceSettings.lang, voices, voiceSettings.voiceURI, onSaveVoiceSettings]);

  // Filter voices based on selected language
  const filteredVoices = voices.filter((v) => {
    return v.lang.toLowerCase().startsWith(voiceSettings.lang);
  });

  const femaleNames = ["female", "zira", "hazel", "helena", "elsa", "salli", "karen", "moira", "tessa", "alice", "samantha", "siri", "sabina", "paola", "marisol", "victoria", "joana"];
  const maleNames = ["male", "david", "mark", "george", "pavel", "ravi", "julio", "stefano", "yannick", "dietmar", "daniel"];

  // Gender filtering
  const genderFilteredVoices = filteredVoices.filter((v) => {
    if (!voiceSettings.voiceGender || voiceSettings.voiceGender === 'all') return true;
    const nameLower = v.name.toLowerCase();
    const isFemale = femaleNames.some(name => nameLower.includes(name)) && !maleNames.some(name => nameLower.includes(name));
    if (voiceSettings.voiceGender === 'female') return isFemale;
    if (voiceSettings.voiceGender === 'male') return !isFemale;
    return true;
  });

  // Handle shortcut recording
  useEffect(() => {
    if (!editingShortcut) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const key = formatKeyEventString(e);
      if (!key) return; // ignore pure modifier key releases/presses

      // Conflict checking
      let conflictingField: keyof ShortcutConfig | null = null;
      for (const [field, value] of Object.entries(shortcutConfig)) {
        if (field !== editingShortcut && value && value.toLowerCase() === key.toLowerCase()) {
          conflictingField = field as keyof ShortcutConfig;
          break;
        }
      }

      if (conflictingField) {
        setConflict({
          key,
          newField: editingShortcut,
          oldField: conflictingField,
        });
      } else {
        onSaveShortcutConfig({
          ...shortcutConfig,
          [editingShortcut]: key,
        });
      }
      setEditingShortcut(null);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [editingShortcut, shortcutConfig, onSaveShortcutConfig]);

  // Handle live shortcut testing
  useEffect(() => {
    if (!isTesting) return;

    const handleTestKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const formatted = formatKeyEventString(e);
      if (!formatted) return;

      // Find if it matches any shortcut
      let matchedAction: string | null = null;
      for (const [field, value] of Object.entries(shortcutConfig)) {
        if (value && (value.toLowerCase() === formatted.toLowerCase() || matchesShortcut(e, value))) {
          matchedAction = SHORTCUT_NAMES[field as keyof ShortcutConfig];
          break;
        }
      }

      setTestKey({
        raw: `${e.code} (key: ${e.key})`,
        formatted,
        matchedAction
      });
    };

    window.addEventListener('keydown', handleTestKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleTestKeyDown, true);
    };
  }, [isTesting, shortcutConfig]);

  const updateVoiceSetting = <K extends keyof VoiceSettings>(key: K, value: VoiceSettings[K]) => {
    onSaveVoiceSettings({
      ...voiceSettings,
      [key]: value,
    });
  };

  // Live announcement preview calculation
  const getPreviewText = () => {
    const defaultIntro = DEFAULT_PHRASES[voiceSettings.lang]?.intro || "Atención por favor";
    const defaultTicketName = DEFAULT_PHRASES[voiceSettings.lang]?.ticketName || "Ticket número";
    const defaultOutro = DEFAULT_PHRASES[voiceSettings.lang]?.outro || "Su pedido está listo";

    const intro = voiceSettings.customIntro !== undefined && voiceSettings.customIntro !== '' ? voiceSettings.customIntro : defaultIntro;
    const ticketName = voiceSettings.customTicketName !== undefined && voiceSettings.customTicketName !== '' ? voiceSettings.customTicketName : defaultTicketName;
    const outro = voiceSettings.customOutro !== undefined && voiceSettings.customOutro !== '' ? voiceSettings.customOutro : defaultOutro;

    const spokenNumber = replaceNumbersWithWords("125", voiceSettings.lang);

    return `"${intro}. ${ticketName} ${spokenNumber}. ${outro}."`;
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-8 h-full">
      
      {/* Settings header */}
      <div className="flex items-center gap-2 border-b border-slate-800/80 pb-4">
        <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
          <Settings size={20} />
        </div>
        <div>
          <h3 className="font-semibold text-slate-100 text-lg">Configuración de Preferencias</h3>
          <p className="text-xs text-slate-400">Personaliza la voz, atajos de teclado y funcionamiento del motor.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Section 1: TTS Voice Configuration */}
        <div className="space-y-4">
          <h4 className="font-semibold text-sm text-indigo-400 uppercase tracking-wider flex items-center gap-2">
            <Volume2 size={16} />
            Locución y Voces (Web Speech API)
          </h4>

          {/* Lang Selector */}
          <div className="space-y-1.5">
            <label className="text-xs text-slate-400">Idioma de Locución</label>
            <select
              value={voiceSettings.lang}
              onChange={(e) => {
                const nextLang = e.target.value as any;
                
                // Find a default voice for the new language to avoid keeping a mismatched old voiceURI
                const prefix = nextLang;
                const nextVoices = voices.filter(v => v.lang.toLowerCase().startsWith(prefix));
                const defaultVoiceURI = nextVoices.length > 0 ? nextVoices[0].voiceURI : '';

                onSaveVoiceSettings({
                  ...voiceSettings,
                  lang: nextLang,
                  voiceURI: defaultVoiceURI,
                  customIntro: '',
                  customTicketName: '',
                  customOutro: ''
                });
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 outline-none"
            >
              <option value="es">Español (España)</option>
              <option value="en">English (United States)</option>
              <option value="ca">Catalán (Catalunya)</option>
              <option value="fr">Français (Francia)</option>
              <option value="it">Italiano (Italia)</option>
              <option value="de">Deutsch (Alemania)</option>
              <option value="pt">Português (Portugal/Brasil)</option>
            </select>
          </div>

          {/* Voice Gender Preference */}
          <div className="space-y-1.5">
            <label className="text-xs text-slate-400">Preferencia de Género</label>
            <select
              value={voiceSettings.voiceGender || 'all'}
              onChange={(e) => updateVoiceSetting('voiceGender', e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 outline-none"
            >
              <option value="all">Todas las voces disponibles</option>
              <option value="female">Voz Femenina</option>
              <option value="male">Voz Masculina</option>
            </select>
          </div>

          {/* Voice Selector */}
          <div className="space-y-1.5">
            <label className="text-xs text-slate-400">Voz del Sistema</label>
            <select
              value={voiceSettings.voiceURI}
              onChange={(e) => updateVoiceSetting('voiceURI', e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 outline-none font-mono text-xs"
            >
              {genderFilteredVoices.length === 0 ? (
                <option value="">Voz predeterminada del navegador</option>
              ) : (
                genderFilteredVoices.map((v, idx) => (
                  <option key={`${v.voiceURI}-${idx}`} value={v.voiceURI}>
                    {v.name} ({v.lang})
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Rate & Pitch sliders */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 flex justify-between">
                <span>Velocidad</span>
                <span className="font-mono text-[10px] text-indigo-400">{voiceSettings.rate}x</span>
              </label>
              <input
                type="range"
                min="0.5"
                max="1.8"
                step="0.1"
                value={voiceSettings.rate}
                onChange={(e) => updateVoiceSetting('rate', parseFloat(e.target.value))}
                className="w-full accent-indigo-500 bg-slate-950"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 flex justify-between">
                <span>Tono</span>
                <span className="font-mono text-[10px] text-indigo-400">{voiceSettings.pitch}</span>
              </label>
              <input
                type="range"
                min="0.5"
                max="1.5"
                step="0.1"
                value={voiceSettings.pitch}
                onChange={(e) => updateVoiceSetting('pitch', parseFloat(e.target.value))}
                className="w-full accent-indigo-500 bg-slate-950"
              />
            </div>
          </div>

          {/* Voice Volume Control (Independent of Music) */}
          <div className="space-y-1.5 pt-1">
            <label className="text-xs text-slate-400 flex justify-between font-semibold">
              <span>Volumen de Locución (Independiente)</span>
              <span className="font-mono text-indigo-400">{(voiceSettings.voiceVolume !== undefined ? voiceSettings.voiceVolume : 100)}%</span>
            </label>
            <input
              type="range"
              min="10"
              max="100"
              step="5"
              value={voiceSettings.voiceVolume !== undefined ? voiceSettings.voiceVolume : 100}
              onChange={(e) => updateVoiceSetting('voiceVolume', parseInt(e.target.value, 10))}
              className="w-full accent-indigo-500 bg-slate-950"
            />
          </div>
        </div>

        {/* Section 2: Customizable Phrases */}
        <div className="space-y-4">
          <h4 className="font-semibold text-sm text-indigo-400 uppercase tracking-wider flex items-center gap-2">
            <Sliders size={16} />
            Plantilla de Frase Personalizada
          </h4>

          {/* Custom Intro */}
          <div className="space-y-1.5">
            <label className="text-xs text-slate-400">Frase Inicial (p. ej. "Atención por favor")</label>
            <input
              type="text"
              placeholder={DEFAULT_PHRASES[voiceSettings.lang]?.intro}
              value={voiceSettings.customIntro || ''}
              onChange={(e) => updateVoiceSetting('customIntro', e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-100 focus:border-indigo-500 outline-none"
            />
          </div>

          {/* Custom Ticket Name */}
          <div className="space-y-1.5">
            <label className="text-xs text-slate-400">Nombre del Ticket (p. ej. "Pedido número")</label>
            <input
              type="text"
              placeholder={DEFAULT_PHRASES[voiceSettings.lang]?.ticketName}
              value={voiceSettings.customTicketName || ''}
              onChange={(e) => updateVoiceSetting('customTicketName', e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-100 focus:border-indigo-500 outline-none"
            />
          </div>

          {/* Custom Outro */}
          <div className="space-y-1.5">
            <label className="text-xs text-slate-400">Frase Final (p. ej. "Puede recoger su pedido")</label>
            <input
              type="text"
              placeholder={DEFAULT_PHRASES[voiceSettings.lang]?.outro}
              value={voiceSettings.customOutro || ''}
              onChange={(e) => updateVoiceSetting('customOutro', e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-100 focus:border-indigo-500 outline-none"
            />
          </div>

          {/* Live Preview Box */}
          <div className="p-3.5 bg-indigo-950/15 border border-indigo-900/40 rounded-xl space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-indigo-400 uppercase font-mono tracking-wider">Vista previa de locución (Ticket 125)</span>
              <span className="text-[10px] text-slate-500 font-mono">Números Reales Activos</span>
            </div>
            <p className="text-xs text-slate-300 italic font-medium leading-relaxed">
              {getPreviewText()}
            </p>
          </div>
        </div>

      </div>

      {/* Section 3: Intervals and alert properties */}
      <div className="border-t border-slate-800/80 pt-6 grid grid-cols-1 md:grid-cols-2 gap-8">
        
        <div className="space-y-4">
          <h4 className="font-semibold text-sm text-indigo-400 uppercase tracking-wider flex items-center gap-2">
            <RefreshCw size={16} />
            Llamadas y Repeticiones
          </h4>

          {/* Time between announcements */}
          <div className="space-y-1.5">
            <label className="text-xs text-slate-400 flex justify-between">
              <span>Tiempo entre anuncios repetidos</span>
              <span className="font-mono text-[10px] text-indigo-400">{voiceSettings.announcementInterval} segundos</span>
            </label>
            <input
              type="range"
              min="5"
              max="60"
              step="5"
              value={voiceSettings.announcementInterval}
              onChange={(e) => updateVoiceSetting('announcementInterval', parseInt(e.target.value, 10))}
              className="w-full accent-indigo-500 bg-slate-950"
            />
          </div>

          {/* Phrase Repeat Frequency (X announcements) */}
          <div className="space-y-1.5">
            <label className="text-xs text-slate-400 flex justify-between">
              <span>Anunciar frase completa cada:</span>
              <span className="font-mono text-[10px] text-indigo-400">{voiceSettings.repeatPhraseInterval} llamadas</span>
            </label>
            <select
              value={voiceSettings.repeatPhraseInterval}
              onChange={(e) => updateVoiceSetting('repeatPhraseInterval', parseInt(e.target.value, 10))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 outline-none"
            >
              <option value="1">Cada llamada (siempre completo)</option>
              <option value="2">Cada 2 llamadas (intermitente)</option>
              <option value="3">Cada 3 llamadas (predeterminado)</option>
              <option value="4">Cada 4 llamadas</option>
              <option value="5">Cada 5 llamadas</option>
            </select>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="font-semibold text-sm text-indigo-400 uppercase tracking-wider flex items-center gap-2">
            <Smartphone size={16} />
            Haptics y Alertas
          </h4>

          {/* Sound & Vibration toggles */}
          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center gap-2.5 p-3.5 bg-slate-950 rounded-xl border border-slate-800 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={voiceSettings.soundEnabled}
                onChange={(e) => updateVoiceSetting('soundEnabled', e.target.checked)}
                className="w-4 h-4 text-indigo-600 border-slate-800 rounded focus:ring-indigo-500 focus:ring-opacity-25"
              />
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-slate-200">Activar Sonido</span>
                <span className="text-[9px] text-slate-500">Campana de aviso</span>
              </div>
            </label>

            <label className="flex items-center gap-2.5 p-3.5 bg-slate-950 rounded-xl border border-slate-800 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={voiceSettings.vibrationEnabled}
                onChange={(e) => updateVoiceSetting('vibrationEnabled', e.target.checked)}
                className="w-4 h-4 text-indigo-600 border-slate-800 rounded focus:ring-indigo-500 focus:ring-opacity-25"
              />
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-slate-200">Vibración</span>
                <span className="text-[9px] text-slate-500">Móvil/Tablet</span>
              </div>
            </label>
          </div>

          {/* Max OCR Simultaneous */}
          <div className="space-y-1.5">
            <label className="text-xs text-slate-400 flex justify-between">
              <span>Máximo tickets OCR simultáneos</span>
              <span className="font-mono text-[10px] text-indigo-400">{appConfig.maxOcrSimultaneous} tickets</span>
            </label>
            <select
              value={appConfig.maxOcrSimultaneous}
              onChange={(e) => onSaveAppConfig({ ...appConfig, maxOcrSimultaneous: parseInt(e.target.value, 10) })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 outline-none"
            >
              <option value="1">1 Ticket a la vez</option>
              <option value="2">2 Tickets simultáneos</option>
              <option value="3">3 Tickets simultáneos (predeterminado)</option>
            </select>
          </div>

          {/* Demote Active position */}
          <div className="space-y-1.5 pt-1">
            <label className="text-xs text-slate-400">
              Posición de retorno de Ticket Activo al reasignar
            </label>
            <select
              value={appConfig.demoteActivePosition || 'start'}
              onChange={(e) => onSaveAppConfig({ ...appConfig, demoteActivePosition: e.target.value as 'start' | 'end' })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 outline-none"
            >
              <option value="start">Al principio de la Lista de Espera (predeterminado)</option>
              <option value="end">Al final de la Lista de Espera</option>
            </select>
          </div>

          {/* Auto-activate first ticket toggle */}
          <div className="space-y-1.5 pt-1">
            <label className="flex items-center gap-2.5 p-3.5 bg-slate-950 rounded-xl border border-slate-800 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={appConfig.autoActivateFirstTicket !== false}
                onChange={(e) => onSaveAppConfig({ ...appConfig, autoActivateFirstTicket: e.target.checked })}
                className="w-4 h-4 text-indigo-600 border-slate-800 rounded focus:ring-indigo-500 focus:ring-opacity-25"
              />
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-slate-200">Activar automáticamente el primer ticket</span>
                <span className="text-[10px] text-slate-500">Si está apagado, el primer ticket ingresado irá a "En espera".</span>
              </div>
            </label>
          </div>

          {/* Active Ticket Glow Color */}
          <div className="space-y-1.5 pt-1">
            <label className="text-xs text-slate-400 flex justify-between">
              <span>Color de brillo del Ticket Activo</span>
              <span className="font-mono text-[10px]" style={{ color: appConfig.activeGlowColor || '#6366f1' }}>{appConfig.activeGlowColor || '#6366f1'}</span>
            </label>
            <div className="flex gap-2">
              <input
                type="color"
                value={appConfig.activeGlowColor || '#6366f1'}
                onChange={(e) => onSaveAppConfig({ ...appConfig, activeGlowColor: e.target.value })}
                className="w-10 h-10 bg-transparent border-0 rounded cursor-pointer"
              />
              <input
                type="text"
                value={appConfig.activeGlowColor || '#6366f1'}
                onChange={(e) => onSaveAppConfig({ ...appConfig, activeGlowColor: e.target.value })}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-100 focus:border-indigo-500 outline-none"
              />
            </div>
          </div>

          {/* Waiting List Selected Color */}
          <div className="space-y-1.5 pt-1">
            <label className="text-xs text-slate-400 flex justify-between">
              <span>Color de selección en Lista de Espera</span>
              <span className="font-mono text-[10px]" style={{ color: appConfig.waitingSelectedColor || '#4f46e5' }}>{appConfig.waitingSelectedColor || '#4f46e5'}</span>
            </label>
            <div className="flex gap-2">
              <input
                type="color"
                value={appConfig.waitingSelectedColor || '#4f46e5'}
                onChange={(e) => onSaveAppConfig({ ...appConfig, waitingSelectedColor: e.target.value })}
                className="w-10 h-10 bg-transparent border-0 rounded cursor-pointer"
              />
              <input
                type="text"
                value={appConfig.waitingSelectedColor || '#4f46e5'}
                onChange={(e) => onSaveAppConfig({ ...appConfig, waitingSelectedColor: e.target.value })}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-100 focus:border-indigo-500 outline-none"
              />
            </div>
          </div>

          {/* Pending List Selected Color */}
          <div className="space-y-1.5 pt-1">
            <label className="text-xs text-slate-400 flex justify-between">
              <span>Color de selección en Pendientes</span>
              <span className="font-mono text-[10px]" style={{ color: appConfig.pendingSelectedColor || '#f59e0b' }}>{appConfig.pendingSelectedColor || '#f59e0b'}</span>
            </label>
            <div className="flex gap-2">
              <input
                type="color"
                value={appConfig.pendingSelectedColor || '#f59e0b'}
                onChange={(e) => onSaveAppConfig({ ...appConfig, pendingSelectedColor: e.target.value })}
                className="w-10 h-10 bg-transparent border-0 rounded cursor-pointer"
              />
              <input
                type="text"
                value={appConfig.pendingSelectedColor || '#f59e0b'}
                onChange={(e) => onSaveAppConfig({ ...appConfig, pendingSelectedColor: e.target.value })}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-100 focus:border-indigo-500 outline-none"
              />
            </div>
          </div>
        </div>

      </div>

      {/* Section 4: Keyboard Shortcuts Config */}
      <div className="border-t border-slate-800/80 pt-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <h4 className="font-semibold text-sm text-indigo-400 uppercase tracking-wider flex items-center gap-2">
              <Keyboard size={16} />
              Atajos de Teclado Personalizables
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Haz clic en cualquier botón de atajo para registrar una tecla o combinación. Se guardará automáticamente.
            </p>
          </div>
        </div>

        {/* Conflict Warning Alert Box */}
        {conflict && (
          <div className="bg-amber-950/40 border border-amber-500/40 p-4 rounded-xl space-y-3 animate-fadeIn">
            <div className="flex items-start gap-3 text-amber-400">
              <AlertTriangle size={18} className="shrink-0 mt-0.5" />
              <div>
                <h5 className="font-bold text-xs uppercase tracking-wider">⚠️ Conflicto de Teclas Detectado</h5>
                <p className="text-xs text-slate-300 mt-1">
                  La combinación <span className="font-mono bg-slate-950 px-1.5 py-0.5 rounded text-amber-300 font-bold">{conflict.key}</span> ya está siendo utilizada por la acción <strong className="text-white">"{SHORTCUT_NAMES[conflict.oldField]}"</strong>.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 justify-end">
              <button
                type="button"
                onClick={() => setConflict(null)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold cursor-pointer transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const updated = {
                    ...shortcutConfig,
                    [conflict.oldField]: '',
                    [conflict.newField]: conflict.key
                  };
                  onSaveShortcutConfig(updated);
                  setConflict(null);
                }}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold cursor-pointer transition-all flex items-center gap-1 shadow shadow-amber-600/20"
              >
                <Check size={14} />
                Reasignar y Reemplazar
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          
          <div className="flex items-center justify-between p-3.5 bg-slate-950 border border-slate-800/80 rounded-xl hover:border-slate-800 transition-all">
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-slate-300">Rotar ticket activo</span>
              <span className="text-[10px] text-slate-500">Pasa al final de la cola</span>
            </div>
            <button
              onClick={() => setEditingShortcut(editingShortcut === 'callNext' ? null : 'callNext')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                editingShortcut === 'callNext'
                  ? 'bg-amber-600 text-white animate-pulse'
                  : 'bg-slate-900 border border-slate-800 text-indigo-400 hover:bg-slate-800/80'
              }`}
            >
              {editingShortcut === 'callNext' ? 'Presiona Tecla...' : (shortcutConfig.callNext || 'Sin Asignar')}
            </button>
          </div>

          <div className="flex items-center justify-between p-3.5 bg-slate-950 border border-slate-800/80 rounded-xl hover:border-slate-800 transition-all">
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-slate-300">Entregar ticket</span>
              <span className="text-[10px] text-slate-500">Mueve a entregados</span>
            </div>
            <button
              onClick={() => setEditingShortcut(editingShortcut === 'markDelivered' ? null : 'markDelivered')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                editingShortcut === 'markDelivered'
                  ? 'bg-amber-600 text-white animate-pulse'
                  : 'bg-slate-900 border border-slate-800 text-indigo-400 hover:bg-slate-800/80'
              }`}
            >
              {editingShortcut === 'markDelivered' ? 'Presiona Tecla...' : (shortcutConfig.markDelivered || 'Sin Asignar')}
            </button>
          </div>

          <div className="flex items-center justify-between p-3.5 bg-slate-950 border border-slate-800/80 rounded-xl hover:border-slate-800 transition-all">
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-slate-300">Desaparecer ticket</span>
              <span className="text-[10px] text-slate-500">Mueve a desaparecidos</span>
            </div>
            <button
              onClick={() => setEditingShortcut(editingShortcut === 'markMissing' ? null : 'markMissing')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                editingShortcut === 'markMissing'
                  ? 'bg-amber-600 text-white animate-pulse'
                  : 'bg-slate-900 border border-slate-800 text-indigo-400 hover:bg-slate-800/80'
              }`}
            >
              {editingShortcut === 'markMissing' ? 'Presiona Tecla...' : (shortcutConfig.markMissing || 'Sin Asignar')}
            </button>
          </div>

          <div className="flex items-center justify-between p-3.5 bg-slate-950 border border-slate-800/80 rounded-xl hover:border-slate-800 transition-all">
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-slate-300">Enfocar entrada</span>
              <span className="text-[10px] text-slate-500">Fuerza foco en input rápido</span>
            </div>
            <button
              onClick={() => setEditingShortcut(editingShortcut === 'focusInput' ? null : 'focusInput')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                editingShortcut === 'focusInput'
                  ? 'bg-amber-600 text-white animate-pulse'
                  : 'bg-slate-900 border border-slate-800 text-indigo-400 hover:bg-slate-800/80'
              }`}
            >
              {editingShortcut === 'focusInput' ? 'Presiona Tecla...' : (shortcutConfig.focusInput || 'Sin Asignar')}
            </button>
          </div>

          <div className="flex items-center justify-between p-3.5 bg-slate-950 border border-slate-800/80 rounded-xl hover:border-slate-800 transition-all">
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-slate-300">Pausar/Reanudar OCR</span>
              <span className="text-[10px] text-slate-500">Congela escáner OCR</span>
            </div>
            <button
              onClick={() => setEditingShortcut(editingShortcut === 'pauseResumeOcr' ? null : 'pauseResumeOcr')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                editingShortcut === 'pauseResumeOcr'
                  ? 'bg-amber-600 text-white animate-pulse'
                  : 'bg-slate-900 border border-slate-800 text-indigo-400 hover:bg-slate-800/80'
              }`}
            >
              {editingShortcut === 'pauseResumeOcr' ? 'Presiona Tecla...' : (shortcutConfig.pauseResumeOcr || 'Sin Asignar')}
            </button>
          </div>

          <div className="flex items-center justify-between p-3.5 bg-slate-950 border border-slate-800/80 rounded-xl hover:border-slate-800 transition-all">
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-slate-300">Enviar a Ticket Activo</span>
              <span className="text-[10px] text-slate-500">Activa ticket seleccionado</span>
            </div>
            <button
              onClick={() => setEditingShortcut(editingShortcut === 'activateSelected' ? null : 'activateSelected')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                editingShortcut === 'activateSelected'
                  ? 'bg-amber-600 text-white animate-pulse'
                  : 'bg-slate-900 border border-slate-800 text-indigo-400 hover:bg-slate-800/80'
              }`}
            >
              {editingShortcut === 'activateSelected' ? 'Presiona Tecla...' : (shortcutConfig.activateSelected || 'Sin Asignar')}
            </button>
          </div>
        </div>

        {/* Interactive Keyboard & Shortcut Tester Card */}
        <div className="bg-slate-950/40 border border-slate-800/60 p-4 rounded-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/40 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-indigo-500/10 text-indigo-400 rounded-lg">
                <Keyboard size={16} />
              </div>
              <div>
                <h5 className="font-bold text-xs text-slate-200">🧪 Probador de Teclas y Atajos</h5>
                <p className="text-[10px] text-slate-500">Verifica lo que el navegador e iFrame capturan en tiempo real.</p>
              </div>
            </div>
            
            <button
              type="button"
              onClick={() => {
                setIsTesting(!isTesting);
                setTestKey(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                isTesting
                  ? 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/15'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow shadow-indigo-600/10'
              }`}
            >
              {isTesting ? (
                <>
                  <Pause size={13} fill="currentColor" />
                  Detener Prueba
                </>
              ) : (
                <>
                  <Play size={13} fill="currentColor" className="ml-0.5" />
                  Iniciar Prueba de Teclado
                </>
              )}
            </button>
          </div>

          {isTesting ? (
            <div className="space-y-3.5">
              <div className="text-center py-4 bg-slate-950/60 border border-dashed border-slate-800 rounded-xl space-y-2">
                <p className="text-xs text-indigo-300 font-medium">
                  Presiona cualquier combinación (ej: <code className="bg-slate-900 px-1 py-0.5 rounded font-mono text-white text-[10px]">Ctrl+Shift+T</code>, <code className="bg-slate-900 px-1 py-0.5 rounded font-mono text-white text-[10px]">Espacio</code>, <code className="bg-slate-900 px-1 py-0.5 rounded font-mono text-white text-[10px]">F4</code>)
                </p>
                <div className="flex items-center justify-center gap-1 text-[10px] text-slate-500 font-mono">
                  <span className="inline-block w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
                  Escuchando pulsaciones del teclado...
                </div>
              </div>

              {testKey ? (
                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider block">Combinación Detectada</span>
                    <span className="text-xl font-extrabold text-slate-100 tracking-tight font-mono inline-block px-3 py-1 bg-slate-900 rounded-lg border border-slate-850">
                      {testKey.formatted || '(Sin registrar)'}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider block">Estatus de Atajo</span>
                    {testKey.matchedAction ? (
                      <span className="px-2.5 py-1 rounded bg-indigo-950 text-indigo-400 border border-indigo-900/50 text-xs font-semibold inline-flex items-center gap-1">
                        <Check size={12} />
                        Asignado a "{testKey.matchedAction}"
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded bg-emerald-950 text-emerald-400 border border-emerald-900/50 text-xs font-semibold inline-flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
                        Tecla Libre (Disponible)
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-center py-3 text-xs text-slate-500 italic">Pulsa cualquier tecla para probar...</p>
              )}
            </div>
          ) : (
            <div className="flex items-start gap-2.5 p-3.5 bg-slate-950/20 rounded-xl border border-slate-800/40 text-xs text-slate-500">
              <Info size={15} className="shrink-0 text-slate-400 mt-0.5" />
              <p className="leading-relaxed">
                Usa el probador para verificar si el navegador captura tus pulsaciones. Recuerda hacer clic primero dentro de la aplicación para asegurarte de que tiene el foco activo.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Section 5: Advanced Music Control Settings */}
      <div className="border-t border-slate-800/80 pt-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h4 className="font-semibold text-sm text-indigo-400 uppercase tracking-wider flex items-center gap-2">
              <Music size={16} />
              Control Avanzado de Música de Fondo
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Configura el comportamiento del reproductor de música cuando se anuncian los números de ticket.
            </p>
          </div>

          {/* Master Enable/Disable Switch */}
          <label className="flex items-center gap-2.5 px-4 py-2 bg-slate-950 rounded-xl border border-slate-800 cursor-pointer select-none self-start sm:self-center">
            <input
              type="checkbox"
              checked={musicConfig?.enabled || false}
              onChange={(e) => {
                const updatedConfig = { ...musicConfig, enabled: e.target.checked };
                onSaveMusicConfig(updatedConfig);
              }}
              className="w-4 h-4 text-indigo-600 border-slate-800 rounded focus:ring-indigo-500 focus:ring-opacity-25"
            />
            <span className="text-xs font-semibold text-slate-200">Activar Control de Música</span>
          </label>
        </div>

        {musicConfig?.enabled && (
          <div className="space-y-6 animate-fadeIn">
            
            {/* Announcement Mitigation Mode Selection */}
            <div className="space-y-2">
              <label className="text-xs text-slate-400 font-semibold">Modo al anunciar un ticket</label>
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3.5">
                
                {/* 20% duck */}
                <div
                  onClick={() => onSaveMusicConfig({ ...musicConfig, mode: 'duck20' })}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col gap-1 text-center items-center justify-center ${
                    musicConfig.mode === 'duck20'
                      ? 'bg-indigo-950/40 border-indigo-500 shadow-lg'
                      : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <Volume1 size={16} className={musicConfig.mode === 'duck20' ? 'text-indigo-400' : 'text-slate-400'} />
                  <span className="text-[11px] font-bold text-slate-200">Bajar al 20%</span>
                </div>

                {/* 40% duck */}
                <div
                  onClick={() => onSaveMusicConfig({ ...musicConfig, mode: 'duck40' })}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col gap-1 text-center items-center justify-center ${
                    musicConfig.mode === 'duck40'
                      ? 'bg-indigo-950/40 border-indigo-500 shadow-lg'
                      : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <Volume1 size={16} className={musicConfig.mode === 'duck40' ? 'text-indigo-400' : 'text-slate-400'} />
                  <span className="text-[11px] font-bold text-slate-200">Bajar al 40%</span>
                </div>

                {/* 60% duck */}
                <div
                  onClick={() => onSaveMusicConfig({ ...musicConfig, mode: 'duck60' })}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col gap-1 text-center items-center justify-center ${
                    musicConfig.mode === 'duck60'
                      ? 'bg-indigo-950/40 border-indigo-500 shadow-lg'
                      : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <Volume1 size={16} className={musicConfig.mode === 'duck60' ? 'text-indigo-400' : 'text-slate-400'} />
                  <span className="text-[11px] font-bold text-slate-200">Bajar al 60%</span>
                </div>

                {/* Pause */}
                <div
                  onClick={() => onSaveMusicConfig({ ...musicConfig, mode: 'pause' })}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col gap-1 text-center items-center justify-center ${
                    musicConfig.mode === 'pause'
                      ? 'bg-indigo-950/40 border-indigo-500 shadow-lg'
                      : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <Pause size={16} className={musicConfig.mode === 'pause' ? 'text-indigo-400' : 'text-slate-400'} />
                  <span className="text-[11px] font-bold text-slate-200">Pausar</span>
                </div>

                {/* Do nothing */}
                <div
                  onClick={() => onSaveMusicConfig({ ...musicConfig, mode: 'none' })}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col gap-1 text-center items-center justify-center ${
                    musicConfig.mode === 'none'
                      ? 'bg-indigo-950/40 border-indigo-500 shadow-lg'
                      : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <VolumeX size={16} className={musicConfig.mode === 'none' ? 'text-indigo-400' : 'text-slate-400'} />
                  <span className="text-[11px] font-bold text-slate-200">No hacer nada</span>
                </div>

              </div>
            </div>

            {/* Resume automatically + Infinite Playback + Shuffle Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-950/30 p-4 border border-slate-800/60 rounded-xl">
              
              {/* Auto Resume */}
              <label className="flex items-center gap-2.5 p-3.5 bg-slate-950/40 border border-slate-800 rounded-xl cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={musicConfig.autoResume}
                  onChange={(e) => onSaveMusicConfig({ ...musicConfig, autoResume: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 border-slate-800 rounded focus:ring-indigo-500"
                />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-slate-200">Reanudar automáticamente</span>
                  <span className="text-[9px] text-slate-500">Restaura volumen/play al acabar</span>
                </div>
              </label>

              {/* Infinite Playback */}
              <label className="flex items-center gap-2.5 p-3.5 bg-slate-950/40 border border-slate-800 rounded-xl cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={musicConfig.infinitePlay}
                  onChange={(e) => {
                    const nextVal = e.target.checked;
                    onSaveMusicConfig({ ...musicConfig, infinitePlay: nextVal });
                    musicController.setConfig({ ...musicConfig, infinitePlay: nextVal });
                  }}
                  className="w-4 h-4 text-indigo-600 border-slate-800 rounded focus:ring-indigo-500"
                />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-slate-200">Reproducción infinita</span>
                  <span className="text-[9px] text-slate-500">Bucle infinito de música sin fin</span>
                </div>
              </label>

              {/* Playlist Shuffle */}
              <label className="flex items-center gap-2.5 p-3.5 bg-slate-950/40 border border-slate-800 rounded-xl cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={musicConfig.shuffle}
                  onChange={(e) => {
                    const nextVal = e.target.checked;
                    onSaveMusicConfig({ ...musicConfig, shuffle: nextVal });
                    musicController.setConfig({ ...musicConfig, shuffle: nextVal });
                  }}
                  className="w-4 h-4 text-indigo-600 border-slate-800 rounded focus:ring-indigo-500"
                />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-slate-200">Playlist aleatoria</span>
                  <span className="text-[9px] text-slate-500">Mezcla videos de YouTube</span>
                </div>
              </label>

            </div>

            {/* Integrated Player Module */}
            <div className="border-t border-slate-800/50 pt-4 space-y-4">
              <label className="flex items-center gap-2.5 p-3.5 bg-slate-950 rounded-xl border border-slate-800 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={musicConfig.integratedEnabled}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    const updatedConfig = { ...musicConfig, integratedEnabled: enabled };
                    onSaveMusicConfig(updatedConfig);
                    if (!enabled) {
                      musicController.pause();
                    }
                  }}
                  className="w-4 h-4 text-indigo-600 border-slate-800 rounded focus:ring-indigo-500"
                />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-200">Activar Reproductor de Música Integrado</span>
                  <span className="text-[10px] text-slate-500">Permite controlar perfectamente el audio y la atenuación de música ambiental de forma nativa.</span>
                </div>
              </label>

              {musicConfig.integratedEnabled && (
                <div className="bg-slate-950 p-6 border border-slate-800/80 rounded-2xl space-y-6 animate-fadeIn">
                  
                  {/* Preset Buttons Grid */}
                  <div className="space-y-2">
                    <label className="text-xs text-slate-400 font-semibold flex items-center gap-1">
                      <Music size={13} />
                      Canales de Música Ambiental (Presets)
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { label: '☕ Café Lofi', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
                        { label: '🎷 Jazz Restaurante', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3' },
                        { label: '🛋️ Chillout Lounge', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3' },
                        { label: '🌧️ Lluvia Relajante', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3' },
                      ].map((preset) => (
                        <button
                          key={preset.url}
                          type="button"
                          onClick={() => {
                            const updatedConfig = { ...musicConfig, integratedUrl: preset.url };
                            onSaveMusicConfig(updatedConfig);
                          }}
                          className={`px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all border text-left ${
                            musicConfig.integratedUrl === preset.url
                              ? 'bg-indigo-600 border-indigo-500 text-white shadow shadow-indigo-500/20'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-900/80'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom URL Input */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400 font-semibold flex justify-between">
                      <span>URL de Audio, Transmisión o Video de YouTube</span>
                      <span className="text-[10px] text-indigo-400 font-bold flex items-center gap-1">
                        <Shuffle size={11} /> Compatible con Playlists y Vídeos
                      </span>
                    </label>
                    <input
                      type="text"
                      placeholder="Pega un enlace .mp3, flujo de radio o enlace de video/playlist de YouTube"
                      value={musicConfig.integratedUrl}
                      onChange={(e) => {
                        const updatedConfig = { ...musicConfig, integratedUrl: e.target.value };
                        onSaveMusicConfig(updatedConfig);
                      }}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:border-indigo-500 outline-none font-mono"
                    />
                  </div>

                  {/* Player Status and Interactive Controls */}
                  <div className="border-t border-slate-900 pt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                    
                    <div className="flex items-center gap-4">
                      {playerState.isPlaying ? (
                        <button
                          type="button"
                          onClick={() => musicController.pause()}
                          className="w-12 h-12 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-800 flex items-center justify-center text-indigo-400 shadow cursor-pointer transition-all hover:scale-105"
                        >
                          <Pause size={20} fill="currentColor" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => musicController.play()}
                          className="w-12 h-12 rounded-full bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25 cursor-pointer transition-all hover:scale-105"
                        >
                          <Play size={20} fill="currentColor" className="ml-0.5" />
                        </button>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-slate-200">Reproductor Integrado</span>
                          {playerState.isPlaying ? (
                            playerState.isDucked ? (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold font-mono bg-indigo-950 text-indigo-300 border border-indigo-900 animate-pulse">
                                Atenuado ({playerState.currentVolume}%)
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold font-mono bg-emerald-950 text-emerald-400 border border-emerald-900">
                                Sonando
                              </span>
                            )
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold font-mono bg-slate-900 text-slate-500 border border-slate-800">
                              Pausado
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-indigo-400 font-semibold mt-1 truncate max-w-xs sm:max-w-sm">
                          {playerState.trackTitle}
                        </p>
                      </div>
                    </div>

                    {/* Volume control */}
                    <div className="space-y-1.5 w-full sm:w-48">
                      <label className="text-[11px] text-slate-400 flex justify-between font-semibold">
                        <span>Volumen del reproductor</span>
                        <span className="font-mono text-indigo-400">{musicConfig.integratedVolume}%</span>
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={musicConfig.integratedVolume}
                        onChange={(e) => {
                          const vol = parseInt(e.target.value, 10);
                          const updatedConfig = { ...musicConfig, integratedVolume: vol };
                          onSaveMusicConfig(updatedConfig);
                          musicController.setVolume(vol);
                        }}
                        className="w-full accent-indigo-500 bg-slate-900"
                      />
                    </div>

                  </div>

                  {playerState.error && (
                    <div className="p-3 bg-red-500/5 border border-red-500/25 text-red-400 rounded-xl text-xs flex gap-2">
                      <Info size={14} className="shrink-0 mt-0.5" />
                      <span>{playerState.error}</span>
                    </div>
                  )}

                </div>
              )}

            </div>
          </div>
        )}
      </div>
    </div>
  );
}
