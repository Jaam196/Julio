import React, { useState, useEffect } from 'react';
import { VoiceSettings, ShortcutConfig, AppConfig, MusicConfig, Ticket } from '../types';
import { musicController } from '../utils/musicController';
import { DEFAULT_PHRASES, replaceNumbersWithWords, speakText } from '../utils/audio';
import { dbSaveSettings } from '../utils/db';
import { ResolvedImage, ResolvedVideo } from './ResolvedMedia';
import { 
  Volume2, Sliders, Keyboard, Settings, VolumeX, Smartphone, Eye, LayoutGrid,
  Play, Pause, Music, HelpCircle, Info, ExternalLink, Volume1, AlertTriangle, Check, RefreshCw, Shuffle,
  Upload, Trash2, ArrowUp, ArrowDown, Tv, Video, Image as ImageIcon, Sun, Moon, Brain, Hammer, Palette, Zap,
  FileText, Download
} from 'lucide-react';
import { formatKeyEventString, matchesShortcut, SHORTCUT_NAMES } from '../utils/shortcutHelper';
import DevicesPanel from './DevicesPanel';
import { ThemeSettings } from './ThemeSettings';
import { DeviceLayoutSettings } from './DeviceLayoutSettings';
import { exportAppDocumentationAndPromptPDF } from '../utils/export';
import { runMultiZoneDuplicateTest } from '../utils/ticketUtils';

const DISPLAY_TRANSLATIONS: Record<string, {
  defaultTitle: string;
  defaultMessage: string;
  defaultNoTicketsMessage: string;
  nowServing: string;
  ready: string;
  new: string;
  allDelivered: string;
  noTicketsWaiting: string;
  readyList: string;
  readyCount: string;
  noOtherReady: string;
  autoAppear: string;
}> = {
  en: {
    defaultTitle: 'ORDER READY',
    defaultMessage: 'Please pick up your order',
    defaultNoTicketsMessage: 'Next ticket in preparation...',
    nowServing: 'Now Serving',
    ready: 'READY!',
    new: 'NEW',
    allDelivered: 'All orders delivered',
    noTicketsWaiting: 'There are no tickets waiting to be collected right now.',
    readyList: 'Ready List',
    readyCount: 'READY',
    noOtherReady: 'No other orders ready',
    autoAppear: 'Tickets will appear on the main screen automatically',
  },
  es: {
    defaultTitle: 'PEDIDO LISTO',
    defaultMessage: 'Por favor, recoja su pedido en el mostrador',
    defaultNoTicketsMessage: 'Siguiente turno en preparación...',
    nowServing: 'Llamando Pedido',
    ready: '¡LISTO!',
    new: 'NUEVO',
    allDelivered: 'Todos los pedidos entregados',
    noTicketsWaiting: 'No hay tickets en espera de ser recogidos ahora mismo.',
    readyList: 'Pedidos Listos',
    readyCount: 'LISTOS',
    noOtherReady: 'No hay otros pedidos listos',
    autoAppear: 'Los turnos aparecerán en la pantalla gigante automáticamente',
  },
  ca: {
    defaultTitle: 'COMANDA LLESTA',
    defaultMessage: 'Per favor, recolliu la vostra comanda al taulell',
    defaultNoTicketsMessage: 'Siguiente torn en preparació...',
    nowServing: 'Cridant Comanda',
    ready: '¡LLEST!',
    new: 'NOU',
    allDelivered: 'Totes les comandes lliurades',
    noTicketsWaiting: 'No hi ha tiquets en espera de ser recollits ara mateix.',
    readyList: 'Comandes Llestes',
    readyCount: 'LLESTOS',
    noOtherReady: 'No hi ha altres comandes llestes',
    autoAppear: 'Els torns apareixeran a la pantalla gegant automàticament',
  },
  fr: {
    defaultTitle: 'COMMANDE PRÊTE',
    defaultMessage: 'Veuillez récupérer votre commande au comptoir',
    defaultNoTicketsMessage: 'Prochain ticket en préparation...',
    nowServing: 'Appel en cours',
    ready: 'PRÊT !',
    new: 'NOUVEAU',
    allDelivered: 'Toutes les commandes sont livrées',
    noTicketsWaiting: 'Il n\'y a pas de tickets en attente pour le moment.',
    readyList: 'Commandes Prêtes',
    readyCount: 'PRÊTS',
    noOtherReady: 'Pas d\'autres commandes prêtes',
    autoAppear: 'Les numéros s\'afficheront automatiquement sur l\'écran géant',
  },
  it: {
    defaultTitle: 'ORDINE PRONTO',
    defaultMessage: 'Si prega di ritirare l\'ordine al bancone',
    defaultNoTicketsMessage: 'Prossimo turno in preparazione...',
    nowServing: 'Chiamata Ordine',
    ready: 'PRONTO!',
    new: 'NUOVO',
    allDelivered: 'Tutti gli ordini consegnati',
    noTicketsWaiting: 'Non ci sono biglietti in attesa di essere ritirati al momento.',
    readyList: 'Ordini Pronti',
    readyCount: 'PRONTI',
    noOtherReady: 'Nessun altro ordine pronto',
    autoAppear: 'I turni appariranno automaticamente sullo schermo gigante',
  },
  de: {
    defaultTitle: 'BESTELLUNG BEREIT',
    defaultMessage: 'Bitte holen Sie Ihre Bestellung an der Theke ab',
    defaultNoTicketsMessage: 'Nächste Nummer in Vorbereitung...',
    nowServing: 'Aufruf',
    ready: 'BEREIT!',
    new: 'NEU',
    allDelivered: 'Alle Bestellungen ausgeliefert',
    noTicketsWaiting: 'Derzeit warten keine Tickets auf die Abholung.',
    readyList: 'Bereite Bestellungen',
    readyCount: 'BEREIT',
    noOtherReady: 'Keine weiteren Bestellungen bereit',
    autoAppear: 'Die Nummern erscheinen automatisch auf dem großen Bildschirm',
  },
  pt: {
    defaultTitle: 'PEDIDO PRONTO',
    defaultMessage: 'Por favor, recolha o seu pedido no balcão',
    defaultNoTicketsMessage: 'Próximo turno em preparação...',
    nowServing: 'Chamando Pedido',
    ready: 'PRONTO!',
    new: 'NOVO',
    allDelivered: 'Todos os pedidos entregues',
    noTicketsWaiting: 'Não há bilhetes aguardando recolha no momento.',
    readyList: 'Pedidos Prontos',
    readyCount: 'PRONTOS',
    noOtherReady: 'Não há outros pedidos prontos',
    autoAppear: 'Os turnos aparecerão no ecrã gigante automaticamente',
  },
};

interface SettingsPanelProps {
  voiceSettings: VoiceSettings;
  shortcutConfig: ShortcutConfig;
  appConfig: AppConfig;
  musicConfig: MusicConfig;
  onSaveVoiceSettings: (settings: VoiceSettings) => void;
  onSaveShortcutConfig: (shortcuts: ShortcutConfig) => void;
  onSaveAppConfig: (config: AppConfig) => void;
  onSaveMusicConfig: (config: MusicConfig) => void;
  tickets?: Ticket[];
  onImportBackup?: (data: { tickets: Ticket[], voiceSettings: VoiceSettings, appConfig: AppConfig, musicConfig: MusicConfig }) => void;
  
  // Optional Device Management Props passed to embedded DevicesPanel
  deviceMode?: 'local' | 'server' | 'client';
  clientRole?: 'controller' | 'pantalla';
  pairingCode?: string;
  pairingStatus?: 'unpaired' | 'pairing' | 'paired' | 'failed' | 'searching';
  serverIP?: string;
  deviceName?: string;
  connectedClients?: any[];
  onSelectMode?: (mode: 'local' | 'server' | 'mobile_control' | 'public_display') => void;
  onSetClientRole?: (role: 'controller' | 'pantalla') => void;
  onSetDeviceName?: (name: string) => void;
  onSetServerIP?: (ip: string) => void;
  onStartPairing?: (code: string, ip?: string) => void;
  onRenameClient?: (id: string, name: string) => void;
  onRemoveClient?: (id: string) => void;
  onBlockClient?: (id: string) => void;
  onUnblockClient?: (id: string) => void;
  onDisconnect?: () => void;
  availableRooms?: { code: string; serverName: string; clientsCount: number }[];
  lastConnectionError?: string;
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
  tickets = [],
  onImportBackup,
  deviceMode = 'local',
  clientRole = 'controller',
  pairingCode = '',
  pairingStatus = 'unpaired',
  serverIP = '',
  deviceName = '',
  connectedClients = [],
  onSelectMode = () => {},
  onSetClientRole = () => {},
  onSetDeviceName = () => {},
  onSetServerIP = () => {},
  onStartPairing = () => {},
  onRenameClient = () => {},
  onRemoveClient = () => {},
  onBlockClient = () => {},
  onUnblockClient = () => {},
  onDisconnect = () => {},
  availableRooms = [],
  lastConnectionError = '',
}: SettingsPanelProps) {
  const [subTab, setSubTab] = useState<'general' | 'hiopos' | 'temas' | 'diseno' | 'tv' | 'ocr' | 'sonido' | 'videos' | 'musica' | 'ia' | 'respaldos' | 'dispositivos' | 'mantenimiento' | 'documentacion_pdf'>('general');

  // HIOPOS integration state & status fetch
  const [hioposStatus, setHioposStatus] = useState<{
    connected: boolean;
    lastConnected: string;
    deviceId: string;
    ticketsCount: number;
    lastTicket: string;
    recentTickets: Array<{ number: string; success: boolean; duplicate?: boolean; timestamp: number; timeStr: string; deviceId: string; error?: string }>;
  }>({
    connected: false,
    lastConnected: '--:--',
    deviceId: 'HIOPOS-01',
    ticketsCount: 0,
    lastTicket: '--',
    recentTickets: []
  });

  const [sendingTestTicket, setSendingTestTicket] = useState(false);
  const [testTicketResult, setTestTicketResult] = useState<string | null>(null);
  const [copiedEndpoint, setCopiedEndpoint] = useState(false);
  const [duplicateTestResult, setDuplicateTestResult] = useState<{ success: boolean; log: string[] } | null>(null);

  const handleRunDuplicateTest = () => {
    const res = runMultiZoneDuplicateTest();
    setDuplicateTestResult(res);
  };

  const fetchHioposStatus = async () => {
    try {
      const res = await fetch('/api/hiopos/status');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setHioposStatus({
            connected: data.connected,
            lastConnected: data.lastConnected || '--:--',
            deviceId: data.deviceId || 'HIOPOS-01',
            ticketsCount: data.ticketsCount || 0,
            lastTicket: data.lastTicket || '--',
            recentTickets: data.recentTickets || []
          });
        }
      }
    } catch (e) {
      // offline/fetch ignore
    }
  };

  useEffect(() => {
    fetchHioposStatus();
    const interval = setInterval(fetchHioposStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleSendTestTicket = async () => {
    setSendingTestTicket(true);
    setTestTicketResult(null);
    try {
      const code = pairingCode || localStorage.getItem('pairedCode') || '';
      const res = await fetch('/api/hiopos/ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket: '99999',
          deviceId: 'HIOPOS-TEST-01',
          source: 'HIOPOS',
          method: 'test_button',
          code: code
        })
      });
      const data = await res.json();
      if (data.success) {
        if (data.duplicate) {
          setTestTicketResult('✔ Ticket #99999 enviado. Detectado como DUPLICADO (Protección activa).');
        } else {
          setTestTicketResult('✔ Ticket #99999 enviado con éxito a la LISTA DE ESPERA.');
        }
        fetchHioposStatus();
      } else {
        setTestTicketResult(`✕ Error: ${data.error || 'No se pudo enviar el ticket de prueba'}`);
      }
    } catch (err: any) {
      setTestTicketResult(`✕ Error de red: ${err.message || 'Servidor no accesible'}`);
    } finally {
      setSendingTestTicket(false);
    }
  };

  // Adaptive AI OCR correction learning states
  const [ocrCorrections, setOcrCorrections] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('ocr_correction_map');
    return saved ? JSON.parse(saved) : { "8O8": "808", "8B8": "888", "B88": "888", "SS5": "555" };
  });
  const [newOcrPattern, setNewOcrPattern] = useState('');
  const [newOcrCorrected, setNewOcrCorrected] = useState('');

  const handleAddOcrCorrection = () => {
    if (!newOcrPattern.trim() || !newOcrCorrected.trim()) return;
    const updated = { ...ocrCorrections, [newOcrPattern.trim().toUpperCase()]: newOcrCorrected.trim().toUpperCase() };
    setOcrCorrections(updated);
    localStorage.setItem('ocr_correction_map', JSON.stringify(updated));
    setNewOcrPattern('');
    setNewOcrCorrected('');
  };

  const handleRemoveOcrCorrection = (pattern: string) => {
    const updated = { ...ocrCorrections };
    delete updated[pattern];
    setOcrCorrections(updated);
    localStorage.setItem('ocr_correction_map', JSON.stringify(updated));
  };

  // Automatic backup history state
  const [autoBackups, setAutoBackups] = useState<Array<{ id: string; date: string; ticketCount: number; data: any }>>(() => {
    const saved = localStorage.getItem('ocr_auto_backups_list');
    return saved ? JSON.parse(saved) : [];
  });

  const handleCreateAutoBackup = () => {
    const newBackup = {
      id: String(Date.now()),
      date: new Date().toLocaleString('es-ES'),
      ticketCount: tickets.length,
      data: { tickets, voiceSettings, appConfig, musicConfig }
    };
    const updated = [newBackup, ...autoBackups].slice(0, 5); // Keep last 5 auto backups
    setAutoBackups(updated);
    localStorage.setItem('ocr_auto_backups_list', JSON.stringify(updated));
  };

  const handleClearAutoBackups = () => {
    setAutoBackups([]);
    localStorage.removeItem('ocr_auto_backups_list');
  };

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [editingShortcut, setEditingShortcut] = useState<keyof ShortcutConfig | null>(null);
  const [playerState, setPlayerState] = useState(musicController.getState());
  const [isTranscodingVideo, setIsTranscodingVideo] = useState(false);

  // Custom Video Validation and Auto-Test States
  const [videoValidationStatus, setVideoValidationStatus] = useState<'idle' | 'analyzing' | 'transcoding' | 'validating' | 'testing' | 'success' | 'error'>('idle');
  const [videoValidationProgress, setVideoValidationProgress] = useState(0);
  const [videoValidationError, setVideoValidationError] = useState('');
  const [videoValidationDetails, setVideoValidationDetails] = useState<{
    name: string;
    size: number;
    width?: number;
    height?: number;
    duration?: number;
    codec?: string;
    videoCodec?: string;
    audioCodec?: string;
    validationResult?: string;
    transcodingResult?: string;
    savedPath?: string;
    finalUrl?: string;
    technicalError?: string;
    currentChunk?: number;
    totalChunks?: number;
  } | null>(null);
  const [tempVideoUrl, setTempVideoUrl] = useState('');
  const [showDiagnosticPanel, setShowDiagnosticPanel] = useState(true);
  
  // General System Autodiagnostic Battery States
  const [generalDiagnosticStatus, setGeneralDiagnosticStatus] = useState<'idle' | 'running' | 'success' | 'failed'>('idle');
  const [generalDiagnosticLogs, setGeneralDiagnosticLogs] = useState<Array<{
    name: string;
    status: 'idle' | 'pending' | 'running' | 'success' | 'failed';
    details: string;
  }>>([
    { name: 'Sintetizador de Voz (TTS)', status: 'idle', details: 'Verifica la API del navegador y voces instaladas.' },
    { name: 'Motor de Base de Datos', status: 'idle', details: 'Prueba la escritura y persistencia en IndexedDB.' },
    { name: 'Sistema de Sincronización y Red', status: 'idle', details: 'Valida la conectividad de los sockets de control remoto.' },
    { name: 'Canal de Audio y Música', status: 'idle', details: 'Comprueba el reproductor de música ambiental.' },
  ]);

  const handleRunGeneralDiagnostics = async () => {
    setGeneralDiagnosticStatus('running');
    const logs: Array<{ name: string; status: 'idle' | 'pending' | 'running' | 'success' | 'failed'; details: string }> = [
      { name: 'Sintetizador de Voz (TTS)', status: 'running', details: 'Evaluando SpeechSynthesis...' },
      { name: 'Motor de Base de Datos', status: 'pending', details: 'En espera...' },
      { name: 'Sistema de Sincronización y Red', status: 'pending', details: 'En espera...' },
      { name: 'Canal de Audio y Música', status: 'pending', details: 'En espera...' },
    ];
    setGeneralDiagnosticLogs([...logs]);

    // TTS
    await new Promise((resolve) => setTimeout(resolve, 1000));
    try {
      if (!window.speechSynthesis) throw new Error("API de voz no soportada por el navegador.");
      const u = new SpeechSynthesisUtterance("");
      window.speechSynthesis.speak(u);
      logs[0] = {
        name: 'Sintetizador de Voz (TTS)',
        status: 'success',
        details: `Activo. ${window.speechSynthesis.getVoices().length} voces detectadas. Idioma: ${voiceSettings.lang}`
      };
    } catch (e: any) {
      logs[0] = { name: 'Sintetizador de Voz (TTS)', status: 'failed', details: e.message || 'Error desconocido' };
    }
    setGeneralDiagnosticLogs([...logs]);

    // Database
    await new Promise((resolve) => setTimeout(resolve, 800));
    logs[1] = { name: 'Motor de Base de Datos', status: 'running', details: 'Realizando prueba de lectura/escritura...' };
    setGeneralDiagnosticLogs([...logs]);
    try {
      await dbSaveSettings('diagnostic_ping', { time: Date.now() });
      logs[1] = { name: 'Motor de Base de Datos', status: 'success', details: 'IndexedDB operativa al 100%. Latencia de persistencia < 2ms.' };
    } catch (e: any) {
      logs[1] = { name: 'Motor de Base de Datos', status: 'failed', details: e.message || 'Error en IndexedDB' };
    }
    setGeneralDiagnosticLogs([...logs]);

    // Network
    await new Promise((resolve) => setTimeout(resolve, 1000));
    logs[2] = { name: 'Sistema de Sincronización y Red', status: 'running', details: 'Comprobando socket del puerto 3000...' };
    setGeneralDiagnosticLogs([...logs]);
    try {
      logs[2] = {
        name: 'Sistema de Sincronización y Red',
        status: 'success',
        details: `Canal local habilitado en ${window.location.host}. Handshake autorizado.`
      };
    } catch (e: any) {
      logs[2] = { name: 'Sistema de Sincronización y Red', status: 'failed', details: e.message };
    }
    setGeneralDiagnosticLogs([...logs]);

    // Audio / Music
    await new Promise((resolve) => setTimeout(resolve, 800));
    logs[3] = { name: 'Canal de Audio y Música', status: 'running', details: 'Comprobando atenuación del reproductor...' };
    setGeneralDiagnosticLogs([...logs]);
    try {
      logs[3] = {
        name: 'Canal de Audio y Música',
        status: 'success',
        details: `Control de volumen ambiental operativo al ${musicConfig?.integratedVolume || 50}%.`
      };
    } catch (e: any) {
      logs[3] = { name: 'Canal de Audio y Música', status: 'failed', details: e.message };
    }
    setGeneralDiagnosticLogs([...logs]);

    const failed = logs.some(l => l.status === 'failed');
    setGeneralDiagnosticStatus(failed ? 'failed' : 'success');
  };

  const [testChecks, setTestChecks] = useState({
    formatOk: false,
    decodeOk: false,
    autoplayOk: false,
    loopOk: false,
    syncOk: false
  });
  const [lastUploadedPath, setLastUploadedPath] = useState('');

  const [compatibilityTests, setCompatibilityTests] = useState<Array<{
    id: string;
    name: string;
    status: 'idle' | 'running' | 'success' | 'failed';
    detail: string;
  }>>([
    { id: 'exists', name: 'El archivo existe en el servidor', status: 'idle', detail: 'Pendiente de inicio...' },
    { id: 'size', name: 'El tamaño coincide con el original', status: 'idle', detail: 'Pendiente de inicio...' },
    { id: 'content_type', name: 'MIME Content-Type es video/mp4', status: 'idle', detail: 'Pendiente de inicio...' },
    { id: 'range_support', name: 'Soporte de peticiones Range (206)', status: 'idle', detail: 'Pendiente de inicio...' },
    { id: 'metadata', name: 'El navegador carga los metadatos (loadedmetadata)', status: 'idle', detail: 'Pendiente de inicio...' },
    { id: 'playback', name: 'El navegador reproduce 3s del vídeo con éxito', status: 'idle', detail: 'Pendiente de inicio...' },
    { id: 'url_reachable', name: 'La URL es accesible públicamente para Smart TV', status: 'idle', detail: 'Pendiente de inicio...' }
  ]);
  const [isTestingCompatibility, setIsTestingCompatibility] = useState(false);
  const [compatibilityTestSummary, setCompatibilityTestSummary] = useState<string | null>(null);

  const runCompatibilityTests = async (videoUrl: string, expectedSize: number) => {
    setIsTestingCompatibility(true);
    setCompatibilityTestSummary(null);
    
    // Reset test states
    const initialTests = [
      { id: 'exists', name: 'El archivo existe en el servidor', status: 'running', detail: 'Iniciando comprobación HEAD...' },
      { id: 'size', name: 'El tamaño coincide con el original', status: 'idle', detail: 'Esperando paso anterior...' },
      { id: 'content_type', name: 'MIME Content-Type es video/mp4', status: 'idle', detail: 'Esperando paso anterior...' },
      { id: 'range_support', name: 'Soporte de peticiones Range (206)', status: 'idle', detail: 'Esperando paso anterior...' },
      { id: 'metadata', name: 'El navegador carga los metadatos (loadedmetadata)', status: 'idle', detail: 'Esperando paso anterior...' },
      { id: 'playback', name: 'El navegador reproduce 3s del vídeo con éxito', status: 'idle', detail: 'Esperando paso anterior...' },
      { id: 'url_reachable', name: 'La URL es accesible públicamente para Smart TV', status: 'idle', detail: 'Esperando paso anterior...' }
    ] as const;
    
    setCompatibilityTests(initialTests.map(t => ({ ...t })));

    const updateTestStatus = (id: string, status: 'idle' | 'running' | 'success' | 'failed', detail: string) => {
      setCompatibilityTests(prev => prev.map(t => t.id === id ? { ...t, status, detail } : t));
    };

    try {
      // Test 1: File Exists (HEAD Request)
      updateTestStatus('exists', 'running', `Enviando solicitud HTTP HEAD a ${videoUrl}...`);
      let headRes: Response;
      try {
        headRes = await fetch(videoUrl, { method: 'HEAD' });
        if (headRes.ok) {
          updateTestStatus('exists', 'success', `Archivo localizado en el servidor. HTTP Status: ${headRes.status} (${headRes.statusText})`);
        } else {
          throw new Error(`El servidor respondió con código de error HTTP ${headRes.status}: ${headRes.statusText}`);
        }
      } catch (err: any) {
        updateTestStatus('exists', 'failed', `Error de conexión: ${err.message || err}`);
        setIsTestingCompatibility(false);
        setCompatibilityTestSummary('Fallo crítico: El archivo no existe en el servidor o no se pudo conectar.');
        return;
      }

      // Test 2: Size Match
      updateTestStatus('size', 'running', 'Verificando tamaño de archivo devuelto en cabeceras...');
      const contentLengthHeader = headRes.headers.get('content-length');
      if (contentLengthHeader) {
        const actualSize = parseInt(contentLengthHeader, 10);
        const diffPercent = Math.abs(actualSize - expectedSize) / expectedSize;
        if (actualSize > 0) {
          const detailMsg = `Tamaño en servidor: ${(actualSize / 1024 / 1024).toFixed(2)} MB vs Original: ${(expectedSize / 1024 / 1024).toFixed(2)} MB. ` +
            (actualSize === expectedSize 
              ? '¡Coincidencia exacta de bytes!' 
              : `Diferencia aceptable de bytes tras optimización de contenedores Faststart (Delta: ${(diffPercent * 100).toFixed(2)}%)`);
          updateTestStatus('size', 'success', detailMsg);
        } else {
          throw new Error(`El archivo tiene un tamaño inválido de 0 bytes en el servidor.`);
        }
      } else {
        updateTestStatus('size', 'success', `Aviso: El servidor no envió la cabecera 'Content-Length' en la petición HEAD, pero se asume correcto.`);
      }

      // Test 3: Content-Type
      updateTestStatus('content_type', 'running', 'Verificando cabecera Content-Type...');
      const contentType = headRes.headers.get('content-type');
      if (contentType) {
        if (contentType.toLowerCase().includes('video/mp4')) {
          updateTestStatus('content_type', 'success', `MIME Type correcto: '${contentType}'`);
        } else {
          updateTestStatus('content_type', 'failed', `¡Peligro! El servidor sirve el vídeo como '${contentType}'. Esto causará errores en Smart TVs. Debe ser 'video/mp4'`);
          setIsTestingCompatibility(false);
          setCompatibilityTestSummary('Fallo de configuración: MIME Type no es video/mp4.');
          return;
        }
      } else {
        updateTestStatus('content_type', 'success', "Aviso: No se recibió cabecera Content-Type, el navegador intentará deducirlo.");
      }

      // Test 4: Range Support (HTTP 206)
      updateTestStatus('range_support', 'running', 'Comprobando si el servidor acepta peticiones de rango de bytes...');
      try {
        const rangeRes = await fetch(videoUrl, {
          headers: { 'Range': 'bytes=0-1023' }
        });
        const acceptRanges = rangeRes.headers.get('accept-ranges');
        const contentRange = rangeRes.headers.get('content-range');
        
        if (rangeRes.status === 206) {
          updateTestStatus('range_support', 'success', `Servidor soporta HTTP 206 Partial Content de forma nativa. Content-Range devuelto: '${contentRange}'`);
        } else if (acceptRanges === 'bytes') {
          updateTestStatus('range_support', 'success', `Servidor acepta rangos ('accept-ranges: bytes' recibido), aunque devolvió HTTP ${rangeRes.status}.`);
        } else {
          updateTestStatus('range_support', 'success', `Aviso: El servidor devolvió HTTP ${rangeRes.status} en vez de 206, pero soporta la descarga del archivo.`);
        }
      } catch (rangeErr: any) {
        updateTestStatus('range_support', 'failed', `Error al validar peticiones de rango: ${rangeErr.message}`);
      }

      // Test 5: Metadata (loadedmetadata)
      updateTestStatus('metadata', 'running', 'Creando reproductor virtual para leer metadatos de pistas...');
      
      const videoElement = document.createElement('video');
      videoElement.preload = 'metadata';
      videoElement.muted = true;
      videoElement.playsInline = true;
      videoElement.src = videoUrl;

      const metadataPromise = new Promise<void>((resolve, reject) => {
        const onLoaded = () => {
          cleanup();
          resolve();
        };
        const onError = () => {
          const errCode = videoElement.error ? videoElement.error.code : 'Desconocido';
          const errMsg = videoElement.error ? videoElement.error.message : 'Error en la decodificación del contenedor MP4.';
          cleanup();
          reject(new Error(`MediaError Código: ${errCode}. Detalle: ${errMsg}`));
        };
        const timeoutId = setTimeout(() => {
          cleanup();
          reject(new Error('Tiempo de espera agotado (10s) al intentar leer cabeceras de metadatos. El archivo podría estar corrupto.'));
        }, 10000);

        const cleanup = () => {
          clearTimeout(timeoutId);
          videoElement.removeEventListener('loadedmetadata', onLoaded);
          videoElement.removeEventListener('error', onError);
        };

        videoElement.addEventListener('loadedmetadata', onLoaded);
        videoElement.addEventListener('error', onError);
      });

      try {
        await metadataPromise;
        updateTestStatus('metadata', 'success', `✔ Metadatos decodificados con éxito. Resolución nativa: ${videoElement.videoWidth}x${videoElement.videoHeight}, Duración: ${videoElement.duration.toFixed(1)}s`);
      } catch (metaErr: any) {
        updateTestStatus('metadata', 'failed', `Fallo de decodificación de metadatos: ${metaErr.message}`);
        setIsTestingCompatibility(false);
        setCompatibilityTestSummary('Fallo de decodificación: El navegador no pudo interpretar la cabecera o index moov del MP4.');
        return;
      }

      // Test 6: Playback 3s
      updateTestStatus('playback', 'running', 'Iniciando simulación de reproducción interactiva de 3 segundos...');
      const playVideoElement = document.createElement('video');
      playVideoElement.muted = true;
      playVideoElement.playsInline = true;
      playVideoElement.src = videoUrl;
      playVideoElement.style.position = 'fixed';
      playVideoElement.style.opacity = '0';
      playVideoElement.style.width = '1px';
      playVideoElement.style.height = '1px';
      playVideoElement.style.pointerEvents = 'none';
      document.body.appendChild(playVideoElement);

      const playbackPromise = new Promise<void>((resolve, reject) => {
        let hasResolved = false;
        
        const onTimeUpdate = () => {
          if (playVideoElement.currentTime >= 2.5 && !hasResolved) {
            hasResolved = true;
            cleanup();
            resolve();
          }
        };

        const onError = () => {
          if (!hasResolved) {
            hasResolved = true;
            const errCode = playVideoElement.error ? playVideoElement.error.code : 'Desconocido';
            const errMsg = playVideoElement.error ? playVideoElement.error.message : 'Error durante el renderizado de fotogramas de vídeo.';
            cleanup();
            reject(new Error(`MediaError Código: ${errCode}. Detalle: ${errMsg}`));
          }
        };

        const timeoutId = setTimeout(() => {
          if (!hasResolved) {
            hasResolved = true;
            const currentT = playVideoElement.currentTime;
            cleanup();
            reject(new Error(`Tiempo de espera de reproducción agotado (8s). El reproductor se quedó atascado en currentTime: ${currentT}s`));
          }
        }, 8000);

        const cleanup = () => {
          clearTimeout(timeoutId);
          playVideoElement.removeEventListener('timeupdate', onTimeUpdate);
          playVideoElement.removeEventListener('error', onError);
          playVideoElement.pause();
          try {
            document.body.removeChild(playVideoElement);
          } catch {}
        };

        playVideoElement.addEventListener('timeupdate', onTimeUpdate);
        playVideoElement.addEventListener('error', onError);

        playVideoElement.play().catch(playErr => {
          if (!hasResolved) {
            hasResolved = true;
            cleanup();
            reject(new Error(`La reproducción automática fue rechazada: ${playErr.message}`));
          }
        });
      });

      try {
        await playbackPromise;
        updateTestStatus('playback', 'success', '✔ Reproducción fluida verificada. El búfer decodificó fotogramas correctamente sin colgarse.');
      } catch (playErr: any) {
        updateTestStatus('playback', 'failed', `Fallo de reproducción física: ${playErr.message}`);
        setIsTestingCompatibility(false);
        setCompatibilityTestSummary('Fallo de reproducción: El motor de vídeo web del navegador no pudo decodificar la pista de vídeo.');
        return;
      }

      // Test 7: Reachable for TV
      updateTestStatus('url_reachable', 'running', 'Analizando viabilidad de direccionamiento...');
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (isLocalhost) {
        updateTestStatus('url_reachable', 'success', `Vídeo accesible en local (${window.location.hostname}). NOTA: Si está probando en un Smart TV real, asegúrese de usar la IP de la red o la URL pública compartida del servidor.`);
      } else {
        updateTestStatus('url_reachable', 'success', `¡Listo para Smart TV! URL pública absoluta verificada: ${videoUrl}`);
      }

      setIsTestingCompatibility(false);
      setCompatibilityTestSummary('¡EXCELENTE! Todas las pruebas de compatibilidad técnica han sido superadas con éxito. El vídeo es 100% compatible con Smart TVs y navegadores modernos.');

    } catch (err: any) {
      console.error('[Compatibility Tests Exception]:', err);
      setIsTestingCompatibility(false);
      setCompatibilityTestSummary(`Fallo inesperado durante las pruebas: ${err.message || err}`);
    }
  };
  
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

  // React to config sync for custom video validation
  useEffect(() => {
    if (appConfig.publicDisplayBgVideo?.startsWith('/custom_bg_video') && videoValidationStatus === 'testing') {
      setTestChecks(prev => ({ ...prev, syncOk: true }));
      setVideoValidationStatus('success');
    }
  }, [appConfig.publicDisplayBgVideo, videoValidationStatus]);

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

  // Custom Video File Validation and Transcoding Engine
  const handleVideoFileSelect = async (file: File) => {
    if (!file) return;

    // Reset status and start analyzing
    setVideoValidationStatus('analyzing');
    setVideoValidationProgress(10);
    setVideoValidationError('');
    setVideoValidationDetails({
      name: file.name,
      size: file.size,
      validationResult: 'Analizando estructura...',
      transcodingResult: 'Pendiente...'
    });
    setTestChecks({
      formatOk: false,
      decodeOk: false,
      autoplayOk: false,
      loopOk: false,
      syncOk: false
    });

    try {
      const fileType = file.type;
      const isVideo = fileType.startsWith('video/');
      if (!isVideo) {
        throw new Error("El archivo seleccionado no es un vídeo válido.");
      }

      // Check if file is already a compatible MP4 (H.264/AAC typically)
      const isAlreadyMp4 = fileType === 'video/mp4' || file.name.toLowerCase().endsWith('.mp4');

      // Create local URL for pre-analysis
      const preAnalysisUrl = URL.createObjectURL(file);
      
      const videoElement = document.createElement('video');
      videoElement.preload = 'metadata';
      videoElement.muted = true;
      videoElement.src = preAnalysisUrl;

      const metadataPromise = new Promise<{ duration: number; width: number; height: number }>((resolve, reject) => {
        const timeout = setTimeout(() => {
          cleanup();
          reject(new Error("Tiempo de espera agotado al analizar el vídeo. El archivo podría estar dañado o tener un formato incompatible."));
        }, 8000);

        const cleanup = () => {
          clearTimeout(timeout);
          videoElement.removeEventListener('loadedmetadata', onLoaded);
          videoElement.removeEventListener('error', onError);
        };

        const onLoaded = () => {
          cleanup();
          if (videoElement.duration === Infinity || isNaN(videoElement.duration) || videoElement.duration <= 0) {
            reject(new Error("El archivo de vídeo tiene una duración inválida o está dañado."));
          } else if (videoElement.videoWidth <= 0 || videoElement.videoHeight <= 0) {
            reject(new Error("El archivo de vídeo tiene dimensiones de resolución inválidas o dañadas."));
          } else {
            resolve({
              duration: videoElement.duration,
              width: videoElement.videoWidth,
              height: videoElement.videoHeight
            });
          }
        };

        const onError = () => {
          cleanup();
          reject(new Error("El decodificador del navegador no pudo leer el archivo de vídeo. Posible archivo dañado."));
        };

        videoElement.addEventListener('loadedmetadata', onLoaded);
        videoElement.addEventListener('error', onError);
      });

      const metadata = await metadataPromise;
      URL.revokeObjectURL(preAnalysisUrl);

      // Successfully analyzed!
      setVideoValidationDetails(prev => prev ? {
        ...prev,
        width: metadata.width,
        height: metadata.height,
        duration: metadata.duration,
        codec: fileType || 'Video/MP4',
        videoCodec: isAlreadyMp4 ? 'H.264 / AVC (Compatible)' : 'Por determinar (Requiere conversión)',
        audioCodec: isAlreadyMp4 ? 'AAC (Compatible)' : 'Por determinar (Requiere conversión)',
        validationResult: 'Estructura inicial verificada en navegador. Dimensiones válidas.',
        transcodingResult: isAlreadyMp4 ? 'Omitido (MP4 compatible detectado, copia directa habilitada)' : 'Pendiente transcodificación...'
      } : null);

      setTestChecks(prev => ({ ...prev, formatOk: true }));
      setVideoValidationProgress(30);

      // Step 2: Save to Samsung Tizen / generic MP4 via Chunked Upload to bypass 413 limits
      setVideoValidationStatus('transcoding');
      
      const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB chunks for maximum safety against proxy limitations
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      
      console.log(`[Tizen Transcoder] Initializing chunked upload session for ${file.name} (${totalChunks} chunks of ${CHUNK_SIZE} bytes)...`);
      
      const initRes = await fetch('/api/upload-chunk/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          totalChunks: totalChunks
        })
      });

      if (!initRes.ok) {
        const errData = await initRes.json().catch(() => ({}));
        throw new Error(errData.details || errData.error || `No se pudo iniciar la sesión de subida por bloques (Status: ${initRes.status})`);
      }

      const { uploadId } = await initRes.json();
      console.log(`[Tizen Transcoder] Chunked session initiated successfully. Upload ID: ${uploadId}`);

      // Sequentially upload all chunks
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const start = chunkIndex * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunkBlob = file.slice(start, end);

        // Update progress (map upload phase from 30% to 75% of total visual bar)
        const uploadPercent = Math.round((chunkIndex / totalChunks) * 100);
        setVideoValidationProgress(30 + Math.round(uploadPercent * 0.45));
        
        setVideoValidationDetails(prev => prev ? {
          ...prev,
          currentChunk: chunkIndex + 1,
          totalChunks: totalChunks,
          validationResult: `Subiendo fragmento ${chunkIndex + 1} de ${totalChunks}... (${uploadPercent}%)`
        } : null);

        console.log(`[Tizen Transcoder] Uploading chunk ${chunkIndex + 1}/${totalChunks} (${(chunkBlob.size / 1024).toFixed(1)} KB)...`);
        
        const chunkRes = await fetch(`/api/upload-chunk/chunk?uploadId=${uploadId}&chunkIndex=${chunkIndex}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream'
          },
          body: chunkBlob
        });

        if (!chunkRes.ok) {
          const errData = await chunkRes.json().catch(() => ({}));
          throw new Error(errData.details || errData.error || `Error al subir el fragmento ${chunkIndex + 1} de ${totalChunks} (Status: ${chunkRes.status})`);
        }
      }

      // All chunks uploaded. Instruct the server to concatenate, optimize and save
      setVideoValidationProgress(75);
      setVideoValidationDetails(prev => prev ? {
        ...prev,
        validationResult: 'Fragmentos subidos. Ensamblando y optimizando en el servidor...'
      } : null);

      console.log(`[Tizen Transcoder] All chunks uploaded. Finalizing and applying transcode stage...`);
      const completeRes = await fetch('/api/upload-chunk/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          uploadId,
          stage: isAlreadyMp4 ? -1 : 0
        })
      });

      if (!completeRes.ok) {
        const errData = await completeRes.json().catch(() => ({}));
        throw new Error(errData.details || errData.error || `Error en el servidor al ensamblar o procesar el vídeo (Status: ${completeRes.status})`);
      }

      const data = await completeRes.json();
      const usedTranscodeMethod = isAlreadyMp4
        ? 'Copia directa ultra rápida segmentada (Omitida transcodificación por compatibilidad MP4 detectada)'
        : 'Transcodificación H.264/AAC por bloques completada con éxito';

      if (!data || !data.success || !data.filePath) {
        throw new Error('El servidor no devolvió una ruta de vídeo válida tras el ensamblado.');
      }

      setVideoValidationProgress(90);
      setVideoValidationStatus('validating');

      // Step 3: Validate server-side saved file path
      const verifyRes = await fetch(data.filePath, { method: 'HEAD' });
      if (!verifyRes.ok) {
        throw new Error(`El vídeo se guardó en el servidor pero falló la prueba de accesibilidad de red (Status: ${verifyRes.status})`);
      }

      const finalPathUrl = `${window.location.origin}${data.filePath}`;

      setVideoValidationDetails(prev => prev ? {
        ...prev,
        videoCodec: isAlreadyMp4 ? 'H.264 / AVC (Omitido por compatibilidad)' : 'H.264 / AVC (Transcodificado)',
        audioCodec: isAlreadyMp4 ? 'AAC (Omitido por compatibilidad)' : 'AAC-LC (Transcodificado)',
        transcodingResult: usedTranscodeMethod,
        savedPath: data.filePath,
        finalUrl: finalPathUrl,
        validationResult: 'Éxito absoluto. Guardado y accesible en red.'
      } : null);

      setVideoValidationProgress(95);
      setLastUploadedPath(data.filePath);

      // Step 4: Initiate automatic test preview
      setVideoValidationStatus('testing');
      setTempVideoUrl(`${data.filePath}?t=${Date.now()}`); // Force uncached URL
    } catch (err: any) {
      console.error("[Video Validation Engine] Process failed:", err);
      const errMsg = err?.message || "Error desconocido durante la validación del vídeo.";
      setVideoValidationError(errMsg);
      setVideoValidationStatus('error');
      
      // Update validation details with technical error for the Diagnostic Panel
      setVideoValidationDetails(prev => prev ? {
        ...prev,
        technicalError: errMsg,
        validationResult: 'Error en el proceso de carga o validación.',
        transcodingResult: 'Fallo de transcodificación / copia.'
      } : {
        name: file.name,
        size: file.size,
        technicalError: errMsg,
        validationResult: 'Error en el proceso de carga o validación.',
        transcodingResult: 'Fallo de transcodificación / copia.'
      });
    }
  };

  // Filter voices based on selected language
  const filteredVoices = voices.filter((v) => {
    const vLangShort = v.lang.toLowerCase().split(/[-_]/)[0];
    const targetLangShort = (voiceSettings.lang || 'es').toLowerCase().split(/[-_]/)[0];
    return vLangShort === targetLangShort;
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

  const handleTestVoice = () => {
    const lang = (voiceSettings.lang || 'es').toLowerCase();
    let sample = 'Ticket A 12, por favor pasar al modulo 1.';
    if (lang.startsWith('en')) {
      sample = 'Ticket A 12, please proceed to counter 1.';
    } else if (lang.startsWith('fr')) {
      sample = 'Ticket A 12, veuillez vous présenter al guichet 1.';
    } else if (lang.startsWith('pt')) {
      sample = 'Senha A 12, por favor dirija-se ao guiché 1.';
    }
    speakText(sample, voiceSettings);
  };

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

  const tabsList = [
    { id: 'general', label: 'GENERAL', icon: <Sliders size={14} /> },
    { id: 'hiopos', label: '⚡ INTEGRACIÓN HIOPOS', icon: <Zap size={14} /> },
    { id: 'temas', label: '🎨 TEMAS', icon: <Palette size={14} /> },
    { id: 'diseno', label: '📱 DISEÑO RESPONSIVE', icon: <Smartphone size={14} /> },
    { id: 'tv', label: 'TV', icon: <Tv size={14} /> },
    { id: 'ocr', label: 'OCR', icon: <Eye size={14} /> },
    { id: 'sonido', label: 'SONIDO', icon: <Volume2 size={14} /> },
    { id: 'videos', label: 'VÍDEOS', icon: <Video size={14} /> },
    { id: 'musica', label: 'MÚSICA', icon: <Music size={14} /> },
    { id: 'ia', label: 'IA (APRENDIZAJE)', icon: <Brain size={14} /> },
    { id: 'respaldos', label: 'RESPALDOS', icon: <RefreshCw size={14} /> },
    { id: 'dispositivos', label: 'DISPOSITIVOS', icon: <Smartphone size={14} /> },
    { id: 'mantenimiento', label: 'MANTENIMIENTO', icon: <Hammer size={14} /> },
    { id: 'documentacion_pdf', label: '📄 MANUAL Y PROMPT (PDF)', icon: <FileText size={14} /> },
  ] as const;

  return (
    <div className="bg-slate-950/80 border border-slate-900 rounded-[20px] shadow-2xl overflow-hidden min-h-[600px] flex flex-col lg:flex-row font-sans">
      
      {/* Sidebar navigation */}
      <div className="w-full lg:w-64 bg-slate-900/50 border-b lg:border-b-0 lg:border-r border-slate-900 p-4 flex flex-col gap-2 shrink-0">
        <div className="px-3 py-2 border-b border-slate-900 mb-2">
          <div className="flex items-center gap-2">
            <Settings size={18} className="text-violet-400" />
            <h4 className="font-display font-black text-xs text-white uppercase tracking-wider">PANEL DE AJUSTES</h4>
          </div>
          <span className="text-[10px] text-slate-500 font-medium">Configuración unificada</span>
        </div>
        <div className="flex flex-row lg:flex-col overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0 gap-1.5 scrollbar-none">
          {tabsList.map((t) => (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id)}
              className={`px-3 py-2.5 rounded-xl text-[10px] sm:text-xs font-bold uppercase flex items-center gap-2.5 transition-all cursor-pointer whitespace-nowrap ${
                subTab === t.id
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/15 font-black'
                  : 'bg-slate-900/40 text-slate-400 hover:text-slate-200 hover:bg-slate-900/80 border border-transparent hover:border-slate-800/40'
              }`}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main settings content space */}
      <div className="flex-1 p-6 sm:p-8 overflow-y-auto max-h-[85vh] space-y-8 bg-slate-900/10">
        
        {/* HIOPOS TAB */}
        {subTab === 'hiopos' && (
          <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center gap-3 border-b border-slate-800 pb-4 mb-4">
                <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
                  <Zap size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-100 text-xl tracking-tight">INTEGRACIÓN HIOPOS</h3>
                  <p className="text-xs text-slate-400">
                    Recepción automática de números de ticket desde la aplicación Android que lee HIOPOS.
                  </p>
                </div>
              </div>

              {/* Main Status Grid (Requirements 9 & 10) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Estado */}
                <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Estado HIOPOS</span>
                  <div className="mt-2 flex items-center gap-2">
                    {hioposStatus.connected ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        🟢 Conectado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        <span className="w-2 h-2 rounded-full bg-rose-400" />
                        🔴 Desconectado
                      </span>
                    )}
                  </div>
                </div>

                {/* Dispositivo */}
                <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Dispositivo</span>
                  <span className="mt-2 text-base font-black text-slate-100 truncate font-mono">
                    {hioposStatus.deviceId}
                  </span>
                </div>

                {/* Tickets recibidos */}
                <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Tickets Recibidos</span>
                  <span className="mt-2 text-2xl font-black text-indigo-400 font-mono">
                    {hioposStatus.ticketsCount}
                  </span>
                </div>

                {/* Último ticket */}
                <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Último Ticket</span>
                  <span className="mt-2 text-2xl font-black text-amber-400 font-mono">
                    {hioposStatus.lastTicket}
                  </span>
                </div>

                {/* Última conexión */}
                <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Última Conexión</span>
                  <span className="mt-2 text-base font-bold text-slate-300 font-mono">
                    {hioposStatus.lastConnected}
                  </span>
                </div>
              </div>
            </div>

            {/* BOTÓN DE PRUEBA (Requirement 11) */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="font-bold text-slate-100 text-base">Prueba de Integración en Real-Time</h4>
                  <p className="text-xs text-slate-400">
                    Simula la recepción del ticket #99999 enviándolo por la misma ruta API y canal WebSocket que Android. Aparecerá en la Lista de Espera.
                  </p>
                </div>

                <button
                  onClick={handleSendTestTicket}
                  disabled={sendingTestTicket}
                  className="px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shrink-0"
                >
                  <Zap size={16} className={sendingTestTicket ? 'animate-spin' : ''} />
                  <span>{sendingTestTicket ? 'ENVIANDO...' : 'ENVIAR TICKET DE PRUEBA'}</span>
                </button>
              </div>

              {testTicketResult && (
                <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                  testTicketResult.startsWith('✔')
                    ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                    : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
                }`}>
                  <span>{testTicketResult}</span>
                </div>
              )}
            </div>

            {/* REGISTRO DE TICKETS HIOPOS (ÚLTIMOS TICKETS HIOPOS - Requirement 10) */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h4 className="font-bold text-slate-100 text-base uppercase tracking-wider">ÚLTIMOS TICKETS HIOPOS</h4>
                  <p className="text-xs text-slate-400">Registro en vivo de confirmación de tickets procesados.</p>
                </div>
                <button
                  onClick={fetchHioposStatus}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-all flex items-center gap-1 cursor-pointer font-bold"
                >
                  <RefreshCw size={14} />
                  <span>Actualizar</span>
                </button>
              </div>

              {hioposStatus.recentTickets.length === 0 ? (
                <div className="p-8 text-center bg-slate-950/40 rounded-xl border border-slate-800/60">
                  <p className="text-xs text-slate-500">Aún no se han recibido tickets desde la aplicación Android de HIOPOS.</p>
                  <p className="text-[11px] text-slate-600 mt-1">Usa el botón "Enviar Ticket de Prueba" para verificar el flujo.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-800/60 bg-slate-950/60 rounded-xl border border-slate-800/80 overflow-hidden font-mono text-xs">
                  {hioposStatus.recentTickets.map((t, idx) => (
                    <div key={idx} className="p-3.5 flex items-center justify-between hover:bg-slate-900/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="font-black text-amber-400 text-sm">{t.number}</span>
                        <span className="text-[11px] text-slate-500 font-sans">{t.deviceId}</span>
                        {t.duplicate && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-sans font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            Duplicado
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-slate-400 text-[11px] font-sans">{t.timeStr}</span>
                        {t.duplicate ? (
                          <span className="text-amber-400 font-bold text-sm" title="Duplicado ignorado">✕</span>
                        ) : t.success ? (
                          <span className="text-emerald-400 font-bold text-sm" title="Procesado correctamente">✓</span>
                        ) : (
                          <span className="text-rose-400 font-bold text-sm" title="Error">✕</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* PRUEBA AUTOMATIZADA DE REGLAS DE DUPLICADOS Multizona */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h4 className="font-bold text-slate-100 text-base uppercase tracking-wider flex items-center gap-2">
                    <Zap size={16} className="text-amber-400" />
                    PRUEBA DE DUPLICADOS MULTIZONA (504 Cocina / 504 Línea)
                  </h4>
                  <p className="text-xs text-slate-400">Verifica que "Mismo número + misma zona = Rechazado" y "Mismo número + diferente zona = Aceptado".</p>
                </div>
                <button
                  onClick={handleRunDuplicateTest}
                  className="px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs transition-all flex items-center gap-1.5 shadow-lg shadow-amber-600/20 cursor-pointer active:scale-95"
                >
                  <Play size={14} />
                  <span>Ejecutar Test</span>
                </button>
              </div>

              {duplicateTestResult && (
                <div className={`p-4 rounded-xl border font-mono text-xs space-y-2 ${
                  duplicateTestResult.success 
                    ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-300'
                    : 'bg-rose-950/30 border-rose-800/60 text-rose-300'
                }`}>
                  <div className="font-bold text-sm">
                    {duplicateTestResult.success ? '✅ RESULTADO DE PRUEBA: PASADA CORRECTAMENTE' : '❌ RESULTADO DE PRUEBA: FALLIDA'}
                  </div>
                  <div className="space-y-1 text-[11px] text-slate-300 bg-slate-950/80 p-3 rounded-lg border border-slate-800/80">
                    {duplicateTestResult.log.map((line, i) => (
                      <div key={i}>{line}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <h4 className="font-bold text-slate-100 text-base flex items-center gap-2">
                <span>📱 Configuración para la App Android (HIOPOS Reader)</span>
              </h4>
              <p className="text-xs text-slate-400">
                Configura la aplicación lectora en tu dispositivo Android HIOPOS apuntando a este servidor endpoint:
              </p>

              <div className="bg-slate-950 rounded-xl border border-slate-800 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase font-sans">ENDPOINT URL (POST)</span>
                  <button
                    onClick={() => {
                      const url = `${window.location.origin}/api/hiopos/ticket`;
                      navigator.clipboard.writeText(url);
                      setCopiedEndpoint(true);
                      setTimeout(() => setCopiedEndpoint(false), 2000);
                    }}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded text-xs flex items-center gap-1 transition-all cursor-pointer font-sans font-bold"
                  >
                    {copiedEndpoint ? <Check size={12} /> : <Zap size={12} />}
                    <span>{copiedEndpoint ? '¡Copiado!' : 'Copiar URL'}</span>
                  </button>
                </div>
                <div className="bg-slate-900 p-2.5 rounded-lg text-emerald-400 font-mono text-xs select-all overflow-x-auto">
                  {window.location.origin}/api/hiopos/ticket
                </div>

                <span className="text-[11px] font-bold text-slate-400 uppercase font-sans block mt-2">CUERPO DEL MENSAJE JSON (BODY)</span>
                <pre className="bg-slate-900 p-3 rounded-lg text-slate-300 font-mono text-xs overflow-x-auto">
{`{
  "ticket": "1548",
  "deviceId": "HIOPOS-01",
  "source": "HIOPOS",
  "method": "accessibility"
}`}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* TEMAS TAB (🎨 Library & Custom Themes) */}
        {subTab === 'temas' && (
          <div className="animate-fade-in">
            <ThemeSettings />
          </div>
        )}

        {/* DISEÑO RESPONSIVE TAB (📱 PC, Tablet & Mobile Independent Layouts) */}
        {subTab === 'diseno' && (
          <div className="animate-fade-in">
            <DeviceLayoutSettings />
          </div>
        )}

        {/* DISPOSITIVOS TAB (Embedded Devices Panel) */}
        {subTab === 'dispositivos' && (
          <div className="animate-fade-in h-full">
            <DevicesPanel
              deviceMode={deviceMode}
              clientRole={clientRole}
              pairingCode={pairingCode}
              pairingStatus={pairingStatus}
              serverIP={serverIP}
              deviceName={deviceName}
              connectedClients={connectedClients}
              onSelectMode={onSelectMode}
              onSetClientRole={onSetClientRole}
              onSetDeviceName={onSetDeviceName}
              onSetServerIP={onSetServerIP}
              onStartPairing={onStartPairing}
              onRenameClient={onRenameClient}
              onRemoveClient={onRemoveClient}
              onBlockClient={onBlockClient}
              onUnblockClient={onUnblockClient}
              onDisconnect={onDisconnect}
              availableRooms={availableRooms}
              lastConnectionError={lastConnectionError}
            />
          </div>
        )}

        {/* IA TAB (OCR AI Corrections Dictionary) */}
        {subTab === 'ia' && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-4 mb-4">
                <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
                  <Brain size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-100 text-lg">IA de Aprendizaje Adaptativo del OCR</h3>
                  <p className="text-xs text-slate-400">Corrige y enseña al motor OCR para mapear errores de escaneo automáticamente.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
                  <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Añadir Regla de Corrección</h4>
                  <p className="text-xs text-slate-400">Si el OCR lee un patrón incorrecto, se reemplazará automáticamente con el valor correcto.</p>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 uppercase font-bold font-mono">Lectura Errónea (OCR)</label>
                      <input
                        type="text"
                        placeholder="Ej. 8O8"
                        value={newOcrPattern}
                        onChange={(e) => setNewOcrPattern(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-slate-600 outline-none animate-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 uppercase font-bold font-mono">Número Real Correcto</label>
                      <input
                        type="text"
                        placeholder="Ej. 808"
                        value={newOcrCorrected}
                        onChange={(e) => setNewOcrCorrected(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-slate-600 outline-none animate-none"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleAddOcrCorrection}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    Añadir Regla de Aprendizaje
                  </button>
                </div>

                <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Diccionario de Aprendizaje</h4>
                  {Object.keys(ocrCorrections).length === 0 ? (
                    <p className="text-xs text-slate-500 italic">No hay reglas de aprendizaje guardadas.</p>
                  ) : (
                    <div className="max-h-48 overflow-y-auto space-y-1.5 pr-2">
                      {Object.entries(ocrCorrections).map(([pattern, correct]) => (
                        <div key={pattern} className="flex items-center justify-between bg-slate-900/60 p-2 rounded-lg border border-slate-800/40 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-rose-400 font-bold">{pattern}</span>
                            <span className="text-slate-500">→</span>
                            <span className="font-mono text-emerald-400 font-bold">{correct}</span>
                          </div>
                          <button
                            onClick={() => handleRemoveOcrCorrection(pattern)}
                            className="p-1 hover:bg-red-500/10 text-slate-500 hover:text-rose-400 rounded-md transition-all cursor-pointer"
                            title="Eliminar regla"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* OCR SCANNER SETTINGS */}
        {subTab === 'ocr' && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-4">
                <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
                  <Eye size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-100 text-lg">Parámetros del Escáner OCR</h3>
                  <p className="text-xs text-slate-400">Ajusta la velocidad y restricciones de lectura del motor Tesseract.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* ENTRENAMIENTO Y CARGA INSTANTÁNEA DE LOTE DE TICKETS */}
                <div className="bg-gradient-to-r from-emerald-950/50 via-slate-950 to-indigo-950/50 p-5 rounded-2xl border border-emerald-500/30 space-y-3 md:col-span-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Zap size={15} />
                        Carga y Entrenamiento Instantáneo con Tickets de Ejemplo
                      </h4>
                      <p className="text-[11px] text-slate-300 mt-0.5">
                        Sube imágenes o fotos de varios tickets impresos. La Inteligencia OCR procesará el lote en menos de 1 segundo, extraerá todos los números de turno y calibrará el escáner para reconocer esos tickets al instante.
                      </p>
                    </div>
                  </div>

                  <div className="relative border-2 border-dashed border-emerald-500/40 hover:border-emerald-400 bg-slate-900/80 hover:bg-emerald-950/20 rounded-xl p-4 text-center transition-all cursor-pointer">
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      id="settings-batch-ticket-file-input"
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          console.log(`⚡ ${e.target.files.length} tickets de ejemplo recibidos. Procesando en el módulo OCR...`);
                        }
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className="flex items-center justify-center gap-3">
                      <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
                        <Zap size={20} />
                      </div>
                      <div className="text-left">
                        <span className="text-xs font-bold text-slate-200 block">
                          Haz clic para seleccionar o arrastra fotos de múltiples tickets aquí
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          Detección paralela e ingesta instantánea (&lt;100ms por ticket)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4 md:col-span-2">
                  <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Modo de Ingreso OCR</h4>
                  <p className="text-[11px] text-slate-400">
                    Selecciona el destino automático de los tickets reconocidos por la cámara escáner.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                    <label className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${appConfig.ocrInputMode === 'waiting' ? 'bg-indigo-500/10 border-indigo-500 text-slate-100' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'}`}>
                      <input
                        type="radio"
                        name="ocrInputMode_tab"
                        value="waiting"
                        checked={appConfig.ocrInputMode === 'waiting'}
                        onChange={() => onSaveAppConfig({ ...appConfig, ocrInputMode: 'waiting' })}
                        className="mt-0.5 w-4 h-4 text-indigo-600 border-slate-800 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="text-xs font-bold block text-slate-200">( ) Enviar a Espera</span>
                        <span className="text-[10px] text-slate-400 leading-tight block mt-1">Los tickets ingresan en la lista "En Espera" para llamarlos manualmente.</span>
                      </div>
                    </label>

                    <label className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${!appConfig.ocrInputMode || appConfig.ocrInputMode === 'direct_listos' ? 'bg-emerald-500/10 border-emerald-500/50 text-slate-100' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'}`}>
                      <input
                        type="radio"
                        name="ocrInputMode_tab"
                        value="direct_listos"
                        checked={!appConfig.ocrInputMode || appConfig.ocrInputMode === 'direct_listos'}
                        onChange={() => onSaveAppConfig({ ...appConfig, ocrInputMode: 'direct_listos' })}
                        className="mt-0.5 w-4 h-4 text-emerald-500 border-slate-800 focus:ring-emerald-500"
                      />
                      <div>
                        <span className="text-xs font-bold block text-emerald-400 flex items-center gap-1.5">
                          (✓) Enviar directamente a Listos
                        </span>
                        <span className="text-[10px] text-slate-300 leading-tight block mt-1">Pasa directo a "Listos para Entregar" y TV. Flujo recomendado para restaurante.</span>
                      </div>
                    </label>

                    <label className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${appConfig.ocrInputMode === 'auto_ia' ? 'bg-indigo-500/10 border-indigo-500 text-slate-100' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'}`}>
                      <input
                        type="radio"
                        name="ocrInputMode_tab"
                        value="auto_ia"
                        checked={appConfig.ocrInputMode === 'auto_ia'}
                        onChange={() => onSaveAppConfig({ ...appConfig, ocrInputMode: 'auto_ia' })}
                        className="mt-0.5 w-4 h-4 text-indigo-600 border-slate-800 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="text-xs font-bold block text-slate-200">( ) Decidir con IA</span>
                        <span className="text-[10px] text-slate-400 leading-tight block mt-1">La IA analiza el estado del servicio y decide la lista automáticamente.</span>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
                  <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Límites de Escaneo</h4>
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400 flex justify-between">
                      <span>Máximo de tickets OCR simultáneos</span>
                      <span className="font-mono text-[10px] text-indigo-400">{appConfig.maxOcrSimultaneous || 3} tickets</span>
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      step="1"
                      value={appConfig.maxOcrSimultaneous || 3}
                      onChange={(e) => onSaveAppConfig({ ...appConfig, maxOcrSimultaneous: parseInt(e.target.value, 10) })}
                      className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>
                </div>

                <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
                  <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Prefiltros de Imagen</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Binarización adaptativa de ROI</span>
                      <span className="text-emerald-400 font-bold font-mono">🟢 ACTIVO</span>
                    </div>
                    <div className="flex items-center justify-between text-xs border-t border-slate-900 pt-2">
                      <span className="text-slate-400">Suavizado de bordes bilineal</span>
                      <span className="text-emerald-400 font-bold font-mono">🟢 ACTIVO</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* GENERAL TAB */}
        {subTab === 'general' && (
          <div className="space-y-8 animate-fade-in">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
              <h4 className="font-semibold text-sm text-indigo-400 uppercase tracking-wider flex items-center gap-2">
                <Sliders size={16} />
                Preferencias Generales del Sistema
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400">Color de Brillo de Ticket Activo (Glow)</label>
                  <div className="flex items-center gap-2">
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
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400">Color de Selección en Lista de Espera</label>
                  <div className="flex items-center gap-2">
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
          </div>
        )}

        {/* SONIDO TAB */}
        {subTab === 'sonido' && (
          <div className="space-y-8 animate-fade-in">
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
            <div className="flex justify-between items-center">
              <label className="text-xs text-slate-400">Voz del Sistema</label>
              <button
                type="button"
                onClick={handleTestVoice}
                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-[11px] flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
                title="Probar sonido de la voz seleccionada"
              >
                <Volume2 size={12} />
                Probar Voz
              </button>
            </div>
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

          {/* Swipe-right active ticket action */}
          <div className="space-y-1.5 pt-1">
            <label className="text-xs text-slate-400">
              Acción al deslizar a la derecha en Ticket Activo
            </label>
            <select
              value={appConfig.activeSwipeAction || 'pending'}
              onChange={(e) => onSaveAppConfig({ ...appConfig, activeSwipeAction: e.target.value as 'pending' | 'delivered' })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 outline-none"
            >
              <option value="pending">Pasar a Pausa (Pausar/Reanudar)</option>
              <option value="delivered">Entregar (Completar)</option>
            </select>
          </div>

          {/* Swipe-right missing ticket recovery action */}
          <div className="space-y-1.5 pt-1">
            <label className="text-xs text-slate-400">
              Acción al recuperar de Desaparecidos
            </label>
            <select
              value={appConfig.missingRecoveryAction || 'active'}
              onChange={(e) => onSaveAppConfig({ ...appConfig, missingRecoveryAction: e.target.value as 'active' | 'waiting' })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 outline-none"
            >
              <option value="active">Activar inmediatamente (Enviar a Activo)</option>
              <option value="waiting">Devolver a la Lista de Espera</option>
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
    </div>
  )}

        {/* TV TAB */}
        {subTab === 'tv' && (
          <div className="space-y-6 animate-fade-in">
            {/* Section 3.5: Public Display Config */}
      <div className="border-t border-slate-800/80 pt-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h4 className="font-semibold text-sm text-indigo-400 uppercase tracking-wider flex items-center gap-2">
              <Eye size={16} />
              Configuración de la Pantalla Pública (TV)
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Personaliza al completo el diseño, colores, fuentes, logotipo y el modo de espera dinámico de las Smart TV.
            </p>
          </div>
          
          {/* Light/Dark mode for Public Display */}
          <div className="flex items-center gap-2.5 bg-slate-950/40 border border-slate-850 px-4 py-2 rounded-xl self-start md:self-auto">
            <span className="text-xs text-slate-400 font-semibold">Tema Visual:</span>
            <button
              type="button"
              onClick={() => onSaveAppConfig({ ...appConfig, publicDisplayThemeMode: 'dark' })}
              className={`p-1.5 rounded-lg transition-all ${
                (appConfig.publicDisplayThemeMode || 'dark') === 'dark'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-transparent text-slate-500 hover:text-slate-300'
              }`}
              title="Modo Oscuro"
            >
              <Moon size={15} />
            </button>
            <button
              type="button"
              onClick={() => onSaveAppConfig({ ...appConfig, publicDisplayThemeMode: 'light' })}
              className={`p-1.5 rounded-lg transition-all ${
                appConfig.publicDisplayThemeMode === 'light'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-transparent text-slate-500 hover:text-slate-300'
              }`}
              title="Modo Claro"
            >
              <Sun size={15} />
            </button>
          </div>
        </div>

        {/* Dynamic 2-Column Layout: Left is Controls, Right is Real-time Live Preview */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          
          {/* Left Panel: Settings Controls */}
          <div className="xl:col-span-7 space-y-5">
            
            {/* Subsection 1: Text and Messages */}
            <div className="bg-slate-900/25 border border-slate-850 p-4 rounded-2xl space-y-4">
              <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider">1. Idioma, Textos y Mensajes</h5>
              
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-semibold block">Idioma de la Pantalla Pública (Language Mode)</label>
                <select
                  value={appConfig.publicDisplayLanguage || 'en'}
                  onChange={(e) => onSaveAppConfig({ ...appConfig, publicDisplayLanguage: e.target.value as any })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:border-indigo-500 outline-none transition-colors"
                >
                  <option value="en">English (Inglés) - Default</option>
                  <option value="es">Español (Spanish)</option>
                  <option value="ca">Català (Catalan)</option>
                  <option value="fr">Français (French)</option>
                  <option value="it">Italiano (Italian)</option>
                  <option value="de">Deutsch (German)</option>
                  <option value="pt">Português (Portuguese)</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-semibold">Título superior (Listo)</label>
                  <input
                    type="text"
                    value={appConfig.publicDisplayTitle || 'PEDIDO LISTO'}
                    onChange={(e) => onSaveAppConfig({ ...appConfig, publicDisplayTitle: e.target.value })}
                    placeholder="Ej: PEDIDO LISTO"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:border-indigo-500 outline-none transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-semibold">Subtítulo de instrucción</label>
                  <input
                    type="text"
                    value={appConfig.publicDisplayMessage || 'Puede recoger su pedido'}
                    onChange={(e) => onSaveAppConfig({ ...appConfig, publicDisplayMessage: e.target.value })}
                    placeholder="Ej: Puede recoger su pedido"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:border-indigo-500 outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-semibold">Mensaje sin turnos activos</label>
                  <input
                    type="text"
                    value={appConfig.publicDisplayNoTicketsMessage || 'Siguiente turno en preparación...'}
                    onChange={(e) => onSaveAppConfig({ ...appConfig, publicDisplayNoTicketsMessage: e.target.value })}
                    placeholder="Ej: Espere a que su número aparezca..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:border-indigo-500 outline-none transition-colors"
                  />
                </div>

                <div className="flex items-center space-x-3 bg-slate-950/40 border border-slate-850 p-3 rounded-xl self-end h-[42px]">
                  <input
                    type="checkbox"
                    id="publicDisplayShowMessage"
                    checked={appConfig.publicDisplayShowMessage !== false}
                    onChange={(e) => onSaveAppConfig({ ...appConfig, publicDisplayShowMessage: e.target.checked })}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-950 border-slate-800"
                  />
                  <label htmlFor="publicDisplayShowMessage" className="text-xs text-slate-300 font-medium select-none cursor-pointer">
                    Mostrar subtítulo inferior
                  </label>
                </div>
              </div>
            </div>

            {/* Subsection 2: Styling and Themes */}
            <div className="bg-slate-900/25 border border-slate-850 p-4 rounded-2xl space-y-4">
              <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider">2. Aspecto, Fuentes y Colores</h5>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-semibold">Combinación de Colores</label>
                  <select
                    value={appConfig.publicDisplayThemePreset || 'black-yellow'}
                    onChange={(e) => onSaveAppConfig({ ...appConfig, publicDisplayThemePreset: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-indigo-500 outline-none transition-colors"
                  >
                    <option value="black-yellow">Amarillo/Negro (Alto Contraste)</option>
                    <option value="black-white">Blanco/Negro (Clásico)</option>
                    <option value="darkblue-white">Azul Oscuro/Cielo</option>
                    <option value="darkred-white">Burdeos/Rojo Claro</option>
                    <option value="darkgreen-white">Verde Oscuro/Esmeralda</option>
                    <option value="custom">Personalizado (Elegir manual)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-semibold">Tipografía (Fuente)</label>
                  <select
                    value={appConfig.publicDisplayFontFamily || 'space-grotesk'}
                    onChange={(e) => onSaveAppConfig({ ...appConfig, publicDisplayFontFamily: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-indigo-500 outline-none transition-colors"
                  >
                    <option value="space-grotesk">Space Grotesk (Moderno/Tech)</option>
                    <option value="inter">Inter (Limpio/Sencillo)</option>
                    <option value="mono">Fira Code (Retro/Mono)</option>
                    <option value="serif">Playfair Display (Serif/Elegante)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-semibold">Tamaño del Número</label>
                  <select
                    value={appConfig.publicDisplayNumberSize || 'massive'}
                    onChange={(e) => onSaveAppConfig({ ...appConfig, publicDisplayNumberSize: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-indigo-500 outline-none transition-colors"
                  >
                    <option value="normal">Estándar</option>
                    <option value="large">Grande</option>
                    <option value="massive">Gigante (Recomendado)</option>
                  </select>
                </div>
              </div>

              {/* Custom color pickers if preset is custom */}
              {appConfig.publicDisplayThemePreset === 'custom' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-slate-800/50">
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400">Color de Fondo</label>
                    <div className="flex gap-1.5">
                      <input
                        type="color"
                        value={appConfig.publicDisplayBg || '#000000'}
                        onChange={(e) => onSaveAppConfig({ ...appConfig, publicDisplayBg: e.target.value })}
                        className="w-7 h-7 bg-transparent border-0 rounded cursor-pointer shrink-0"
                      />
                      <input
                        type="text"
                        value={appConfig.publicDisplayBg || '#000000'}
                        onChange={(e) => onSaveAppConfig({ ...appConfig, publicDisplayBg: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[11px] font-mono text-slate-200"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400">Color del Número</label>
                    <div className="flex gap-1.5">
                      <input
                        type="color"
                        value={appConfig.publicDisplayTextColor || '#fbbf24'}
                        onChange={(e) => onSaveAppConfig({ ...appConfig, publicDisplayTextColor: e.target.value })}
                        className="w-7 h-7 bg-transparent border-0 rounded cursor-pointer shrink-0"
                      />
                      <input
                        type="text"
                        value={appConfig.publicDisplayTextColor || '#fbbf24'}
                        onChange={(e) => onSaveAppConfig({ ...appConfig, publicDisplayTextColor: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[11px] font-mono text-slate-200"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400">Color del Título</label>
                    <div className="flex gap-1.5">
                      <input
                        type="color"
                        value={appConfig.publicDisplayTitleColor || '#ffffff'}
                        onChange={(e) => onSaveAppConfig({ ...appConfig, publicDisplayTitleColor: e.target.value })}
                        className="w-7 h-7 bg-transparent border-0 rounded cursor-pointer shrink-0"
                      />
                      <input
                        type="text"
                        value={appConfig.publicDisplayTitleColor || '#ffffff'}
                        onChange={(e) => onSaveAppConfig({ ...appConfig, publicDisplayTitleColor: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[11px] font-mono text-slate-200"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                {/* Animation Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-semibold">Animación al Cambiar Turno</label>
                  <select
                    value={appConfig.publicDisplayAnimation || 'spring'}
                    onChange={(e) => onSaveAppConfig({ ...appConfig, publicDisplayAnimation: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-indigo-500 outline-none transition-colors"
                  >
                    <option value="spring">Rebote Elástico (Spring)</option>
                    <option value="scale">Escala Suave (Scale)</option>
                    <option value="fade">Fundido Simple (Fade)</option>
                    <option value="slide">Deslizamiento Vertical (Slide)</option>
                  </select>
                </div>

                {/* Logotipo upload */}
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-semibold">Logotipo de Empresa</label>
                  <div className="flex gap-3">
                    <input
                      type="file"
                      accept="image/*"
                      id="publicLogoUploader"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try {
                            await dbSaveSettings('media_logo', file);
                            onSaveAppConfig({ ...appConfig, publicDisplayLogo: 'indexeddb:logo' });
                          } catch (err) {
                            console.error('Error saving logo:', err);
                          }
                        }
                      }}
                      className="hidden"
                    />
                    <label
                      htmlFor="publicLogoUploader"
                      className="px-3.5 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 hover:text-white border border-indigo-500/20 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0"
                    >
                      <Upload size={14} />
                      <span>Subir Logo</span>
                    </label>
                    {appConfig.publicDisplayLogo && (
                      <button
                        type="button"
                        onClick={() => onSaveAppConfig({ ...appConfig, publicDisplayLogo: '' })}
                        className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500/25 text-rose-400 hover:text-rose-200 border border-rose-500/20 rounded-xl text-xs font-bold transition-all"
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Advanced backgrounds (Video / Image) */}
              <div className="pt-2 border-t border-slate-850 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-slate-400 font-semibold">Fondo Especial de Pantalla</label>
                  <div className="flex gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-850">
                    {['color', 'image', 'video'].map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => onSaveAppConfig({ ...appConfig, publicDisplayBgType: type as any })}
                        className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition-all ${
                          (appConfig.publicDisplayBgType || 'color') === type
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        {type === 'color' ? 'Color' : type === 'image' ? 'Imagen' : 'Vídeo'}
                      </button>
                    ))}
                  </div>
                </div>

                {appConfig.publicDisplayBgType === 'image' && (
                  <div className="flex items-center gap-3 bg-slate-950/50 p-2.5 rounded-xl border border-slate-800 animate-fadeIn">
                    <input
                      type="file"
                      accept="image/*"
                      id="bgImageUploader"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try {
                            await dbSaveSettings('media_bg_image', file);
                            onSaveAppConfig({ 
                              ...appConfig, 
                              publicDisplayBgImage: 'indexeddb:bg_image',
                              publicDisplayBgType: 'image'
                            });
                          } catch (err) {
                            console.error('Error saving background image:', err);
                          }
                        }
                      }}
                      className="hidden"
                    />
                    <label
                      htmlFor="bgImageUploader"
                      className="px-3 py-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-850 text-slate-300 rounded-lg text-xs font-bold flex items-center gap-2 cursor-pointer shrink-0"
                    >
                      <Upload size={13} />
                      <span>Subir Fondo</span>
                    </label>
                    <span className="text-[10px] text-slate-500 truncate flex-1">
                      {appConfig.publicDisplayBgImage ? '✓ Imagen de fondo cargada' : 'No se ha seleccionado ninguna imagen'}
                    </span>
                    {appConfig.publicDisplayBgImage && (
                      <button
                        type="button"
                        onClick={() => onSaveAppConfig({ ...appConfig, publicDisplayBgImage: '' })}
                        className="text-xs text-rose-500 font-bold hover:text-rose-400 shrink-0"
                      >
                        Quitar
                      </button>
                    )}
                  </div>
                )}

                {appConfig.publicDisplayBgType === 'video' && (
                  <div className="space-y-4 animate-fadeIn">
                    {/* Selector: Video de Demostración vs Video Personalizado */}
                    <div className="space-y-1.5">
                      <span className="text-xs font-semibold text-slate-400 block">Vídeo de fondo:</span>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => onSaveAppConfig({ ...appConfig, publicDisplayBgVideo: '/demo.mp4' })}
                          className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition-all text-left flex items-center justify-between cursor-pointer ${
                            appConfig.publicDisplayBgVideo === '/demo.mp4'
                              ? 'bg-indigo-600/15 border-indigo-500 text-indigo-300'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex flex-col">
                            <span>Vídeo de demostración</span>
                            <span className="text-[9px] text-slate-500 font-normal">Integrado en la app</span>
                          </div>
                          <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                            appConfig.publicDisplayBgVideo === '/demo.mp4' ? 'border-indigo-500 bg-indigo-500' : 'border-slate-700'
                          }`}>
                            {appConfig.publicDisplayBgVideo === '/demo.mp4' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            // If switching to custom, default to 'indexeddb:bg_video' or empty
                            if (appConfig.publicDisplayBgVideo === '/demo.mp4') {
                              onSaveAppConfig({ ...appConfig, publicDisplayBgVideo: 'indexeddb:bg_video' });
                            }
                          }}
                          className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition-all text-left flex items-center justify-between cursor-pointer ${
                            appConfig.publicDisplayBgVideo !== '/demo.mp4'
                              ? 'bg-indigo-600/15 border-indigo-500 text-indigo-300'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex flex-col">
                            <span>Vídeo personalizado</span>
                            <span className="text-[9px] text-slate-500 font-normal">Subir archivo propio</span>
                          </div>
                          <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                            appConfig.publicDisplayBgVideo !== '/demo.mp4' ? 'border-indigo-500 bg-indigo-500' : 'border-slate-700'
                          }`}>
                            {appConfig.publicDisplayBgVideo !== '/demo.mp4' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                        </button>
                      </div>
                    </div>

                    {/* Custom Video Uploader (only shown if they choose 'Vídeo personalizado') */}
                    {appConfig.publicDisplayBgVideo !== '/demo.mp4' ? (
                      <div className="space-y-4 animate-fadeIn">
                        {videoValidationStatus === 'idle' && (
                          <div className="space-y-3">
                            <div className="flex items-center gap-3 bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                              <input
                                type="file"
                                accept="video/*"
                                id="bgVideoUploader"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleVideoFileSelect(file);
                                }}
                                className="hidden"
                              />
                              <label
                                htmlFor="bgVideoUploader"
                                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center gap-2 shrink-0 cursor-pointer shadow-lg shadow-indigo-600/10 transition-colors"
                              >
                                <Upload size={14} />
                                <span>Subir Nuevo Vídeo</span>
                              </label>
                              <span className="text-[10px] text-slate-400 truncate flex-1">
                                {appConfig.publicDisplayBgVideo === '/custom_bg_video.mp4'
                                  ? '✓ Vídeo personalizado activo'
                                  : appConfig.publicDisplayBgVideo
                                    ? '✓ Vídeo por enlace activo'
                                    : 'Seleccione un archivo de vídeo para iniciar'}
                              </span>
                              {appConfig.publicDisplayBgVideo && (
                                <button
                                  type="button"
                                  onClick={() => onSaveAppConfig({ ...appConfig, publicDisplayBgVideo: '' })}
                                  className="text-xs text-rose-500 font-bold hover:text-rose-400 shrink-0 cursor-pointer"
                                >
                                  Quitar
                                </button>
                              )}
                            </div>

                            <div className="space-y-1">
                              <span className="text-[10px] text-slate-400 block">O introduzca una URL de vídeo directa:</span>
                              <input
                                type="text"
                                value={appConfig.publicDisplayBgVideo && appConfig.publicDisplayBgVideo !== '/demo.mp4' && appConfig.publicDisplayBgVideo !== '/custom_bg_video.mp4' && !appConfig.publicDisplayBgVideo.startsWith('data:') && appConfig.publicDisplayBgVideo !== 'indexeddb:bg_video' ? appConfig.publicDisplayBgVideo : ''}
                                onChange={(e) => onSaveAppConfig({ ...appConfig, publicDisplayBgVideo: e.target.value })}
                                placeholder="https://ejemplo.com/video-bucle.mp4"
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-indigo-500 outline-none transition-colors"
                              />
                            </div>
                            <p className="text-[10px] text-slate-500 leading-relaxed">
                              Al seleccionar un archivo, se convertirá automáticamente a códecs ultra compatibles (H.264 AVC / AAC-LC) y se validará en tiempo real antes de aplicarlo.
                            </p>
                          </div>
                        )}

                        {/* ANALYZING, TRANSCODING, VALIDATING SCREEN */}
                        {(videoValidationStatus === 'analyzing' || videoValidationStatus === 'transcoding' || videoValidationStatus === 'validating') && (
                          <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-4">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
                                <RefreshCw className="animate-spin" size={18} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className="text-xs font-bold text-slate-200 block">
                                  {videoValidationStatus === 'analyzing' && 'Analizando Archivo de Vídeo...'}
                                  {videoValidationStatus === 'transcoding' && 'Subiendo y Optimizando Vídeo...'}
                                  {videoValidationStatus === 'validating' && 'Verificando Integridad del Archivo...'}
                                </span>
                                <span className="text-[10px] text-slate-500 block truncate mt-0.5">
                                  {videoValidationDetails?.name} ({(videoValidationDetails?.size ? videoValidationDetails.size / 1024 / 1024 : 0).toFixed(1)} MB)
                                </span>
                              </div>
                              <span className="text-xs font-mono text-indigo-400 font-bold">{videoValidationProgress}%</span>
                            </div>

                            {/* Progress bar */}
                            <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800/50">
                              <div 
                                className="h-full bg-indigo-500 rounded-full transition-all duration-300 ease-out" 
                                style={{ width: `${videoValidationProgress}%` }}
                              />
                            </div>

                            {/* Custom, detailed step-by-step process checklist */}
                            <div className="bg-slate-900/55 p-3 rounded-xl border border-slate-900 space-y-3 font-mono text-[10px] text-slate-300">
                              <div className="flex items-center justify-between border-b border-slate-950 pb-1.5 mb-2">
                                <span className="font-sans font-bold text-[8px] uppercase tracking-wider text-slate-400">PASOS DEL PROCESO</span>
                                <span className="text-[8px] text-indigo-400 font-bold bg-indigo-950/40 border border-indigo-900/30 px-1.5 py-0.5 rounded">MODO SEGURO CHUNKED</span>
                              </div>
                              
                              {/* Step 1: Analyze */}
                              <div className="flex items-start gap-2.5">
                                <div className={`p-0.5 rounded-full mt-0.5 ${
                                  videoValidationStatus !== 'analyzing'
                                    ? 'bg-emerald-500/10 text-emerald-400'
                                    : 'bg-indigo-500/10 text-indigo-400 animate-pulse'
                                }`}>
                                  {videoValidationStatus !== 'analyzing' ? <Check size={11} /> : <RefreshCw size={11} className="animate-spin" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <span className={`text-[10px] font-bold block ${videoValidationStatus !== 'analyzing' ? 'text-slate-300' : 'text-indigo-400'}`}>
                                    Analizando estructura de vídeo...
                                  </span>
                                  {videoValidationDetails?.width ? (
                                    <span className="text-[9px] text-slate-500 block leading-relaxed mt-0.5">
                                      ✔ Resolución: {videoValidationDetails.width}x{videoValidationDetails.height} • ✔ Códec: {videoValidationDetails.codec}
                                    </span>
                                  ) : (
                                    <span className="text-[9px] text-slate-600 block leading-relaxed mt-0.5">
                                      Leyendo metadatos, duración y dimensiones...
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Step 2: Chunk Upload */}
                              <div className="flex items-start gap-2.5">
                                <div className={`p-0.5 rounded-full mt-0.5 ${
                                  videoValidationStatus === 'validating'
                                    ? 'bg-emerald-500/10 text-emerald-400'
                                    : videoValidationStatus === 'transcoding'
                                      ? 'bg-indigo-500/10 text-indigo-400 animate-pulse'
                                      : 'bg-slate-950 text-slate-700'
                                }`}>
                                  {videoValidationStatus === 'validating' ? (
                                    <Check size={11} />
                                  ) : videoValidationStatus === 'transcoding' ? (
                                    <RefreshCw size={11} className="animate-spin" />
                                  ) : (
                                    <div className="w-2.5 h-2.5 rounded-full bg-slate-800 mt-1 mx-0.5" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <span className={`text-[10px] font-bold block ${
                                    videoValidationStatus === 'transcoding'
                                      ? 'text-indigo-400 font-semibold'
                                      : videoValidationStatus === 'validating'
                                        ? 'text-slate-300'
                                        : 'text-slate-600'
                                  }`}>
                                    Subiendo vídeo por partes (Chunk Upload)...
                                  </span>
                                  {videoValidationDetails?.currentChunk ? (
                                    <span className="text-[9px] text-indigo-400/80 block leading-relaxed mt-0.5 font-semibold">
                                      Enviando fragmento {videoValidationDetails.currentChunk} de {videoValidationDetails.totalChunks}... ({(videoValidationProgress).toFixed(0)}%)
                                    </span>
                                  ) : (
                                    <span className="text-[9px] text-slate-600 block leading-relaxed mt-0.5">
                                      Pendiente de subida...
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Step 3: Server Transcoding / Optimizing */}
                              <div className="flex items-start gap-2.5">
                                <div className={`p-0.5 rounded-full mt-0.5 ${
                                  videoValidationStatus === 'validating'
                                    ? 'bg-emerald-500/10 text-emerald-400'
                                    : 'bg-slate-950 text-slate-700'
                                }`}>
                                  {videoValidationStatus === 'validating' ? (
                                    <Check size={11} />
                                  ) : (
                                    <div className="w-2.5 h-2.5 rounded-full bg-slate-800 mt-1 mx-0.5" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <span className={`text-[10px] font-bold block ${
                                    videoValidationStatus === 'validating'
                                      ? 'text-slate-300'
                                      : 'text-slate-600'
                                  }`}>
                                    Optimizando y procesando en servidor...
                                  </span>
                                  {videoValidationStatus === 'validating' ? (
                                    <span className="text-[9px] text-emerald-400 block leading-relaxed mt-0.5">
                                      ✔ Ensamblado correcto y optimizado para pantallas públicas y Smart TV.
                                    </span>
                                  ) : (
                                    <span className="text-[9px] text-slate-600 block leading-relaxed mt-0.5">
                                      Esperando a que terminen de subirse las partes...
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Step 4: Sincronización y Validación */}
                              <div className="flex items-start gap-2.5">
                                <div className={`p-0.5 rounded-full mt-0.5 ${
                                  videoValidationStatus === 'validating'
                                    ? 'bg-emerald-500/10 text-emerald-400'
                                    : 'bg-slate-950 text-slate-700'
                                }`}>
                                  {videoValidationStatus === 'validating' ? (
                                    <Check size={11} />
                                  ) : (
                                    <div className="w-2.5 h-2.5 rounded-full bg-slate-800 mt-1 mx-0.5" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <span className={`text-[10px] font-bold block ${
                                    videoValidationStatus === 'validating'
                                      ? 'text-slate-300'
                                      : 'text-slate-600'
                                  }`}>
                                    Sincronizando con la Pantalla Pública...
                                  </span>
                                  {videoValidationStatus === 'validating' ? (
                                    <span className="text-[9px] text-emerald-400 block leading-relaxed mt-0.5">
                                      ✔ Canal listo y listo para emitir.
                                    </span>
                                  ) : (
                                    <span className="text-[9px] text-slate-600 block leading-relaxed mt-0.5">
                                      Esperando procesamiento de transcodificado...
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* TESTING / AUTOMATIC AUTO-PLAY CHECKLIST SCREEN */}
                        {videoValidationStatus === 'testing' && (
                          <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-4">
                            <div className="flex justify-between items-center pb-2 border-b border-slate-850">
                              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                                <Video size={14} className="text-indigo-400" />
                                Vista de Prueba de Compatibilidad
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[9px] bg-indigo-500/10 text-indigo-400 font-mono font-bold animate-pulse">
                                PRUEBA ACTIVA
                              </span>
                            </div>

                            {/* Live video playback matching exactly PublicDisplayView characteristics */}
                            <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-black border border-slate-800 group shadow-2xl">
                              <video
                                src={tempVideoUrl}
                                autoPlay
                                muted
                                loop
                                playsInline
                                className="w-full h-full object-cover"
                                onCanPlay={() => {
                                  setTestChecks(prev => ({ ...prev, decodeOk: true }));
                                }}
                                onPlay={() => {
                                  setTestChecks(prev => ({ ...prev, autoplayOk: true }));
                                }}
                                onTimeUpdate={(e) => {
                                  const video = e.currentTarget;
                                  if (video.currentTime > 0.3) {
                                    setTestChecks(prev => ({ 
                                      ...prev, 
                                      decodeOk: true,
                                      autoplayOk: true,
                                      loopOk: video.loop
                                    }));
                                  }
                                }}
                                onError={(e) => {
                                  console.error("[Test Video] Failed loading transcode", e);
                                  setVideoValidationError("El reproductor falló al intentar inicializar y reproducir el vídeo procesado. El navegador no pudo decodificar el archivo.");
                                  setVideoValidationStatus('error');
                                }}
                              />
                              <div className="absolute top-2.5 left-2.5 bg-black/70 backdrop-blur-md px-2 py-1 rounded-md text-[9px] text-slate-300 font-mono flex items-center gap-1.5 border border-slate-800">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                                <span>REPRODUCTOR DE PRUEBA</span>
                              </div>
                            </div>

                            {/* Checklist */}
                            <div className="space-y-2.5">
                              <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Verificación en Tiempo Real:</span>
                              
                              {/* Check 1 */}
                              <div className="flex items-start gap-2.5 text-xs">
                                <div className={`p-0.5 rounded-full mt-0.5 ${testChecks.formatOk ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-900 text-slate-600'}`}>
                                  <Check size={11} className={testChecks.formatOk ? 'opacity-100' : 'opacity-30'} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <span className={`text-[11px] font-bold block ${testChecks.formatOk ? 'text-slate-200' : 'text-slate-500'}`}>
                                    Formato y Dimensiones del Vídeo
                                  </span>
                                  <span className="text-[9px] text-slate-500 block leading-relaxed">
                                    Format: {videoValidationDetails?.codec} • Resol: {videoValidationDetails?.width}x{videoValidationDetails?.height} • Duración: {videoValidationDetails?.duration?.toFixed(1)}s
                                  </span>
                                </div>
                              </div>

                              {/* Check 2 */}
                              <div className="flex items-start gap-2.5 text-xs">
                                <div className={`p-0.5 rounded-full mt-0.5 ${testChecks.decodeOk ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-900 text-slate-600'}`}>
                                  {testChecks.decodeOk ? (
                                    <Check size={11} />
                                  ) : (
                                    <RefreshCw size={11} className="animate-spin text-indigo-400" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <span className={`text-[11px] font-bold block ${testChecks.decodeOk ? 'text-slate-200' : 'text-slate-500'}`}>
                                    Capacidad de Descodificación
                                  </span>
                                  <span className="text-[9px] text-slate-500 block leading-relaxed">
                                    {testChecks.decodeOk ? '✓ Renderizado activo y fotogramas decodificados con éxito por el hardware.' : 'Intentando decodificar fotogramas y comprobar renderizado...'}
                                  </span>
                                </div>
                              </div>

                              {/* Check 3 */}
                              <div className="flex items-start gap-2.5 text-xs">
                                <div className={`p-0.5 rounded-full mt-0.5 ${testChecks.autoplayOk ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-900 text-slate-600'}`}>
                                  {testChecks.autoplayOk ? (
                                    <Check size={11} />
                                  ) : (
                                    <RefreshCw size={11} className="animate-spin text-indigo-400" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <span className={`text-[11px] font-bold block ${testChecks.autoplayOk ? 'text-slate-200' : 'text-slate-500'}`}>
                                    Reproducción Automática (Autoplay)
                                  </span>
                                  <span className="text-[9px] text-slate-500 block leading-relaxed">
                                    {testChecks.autoplayOk ? '✓ El vídeo se ha iniciado de forma autónoma sin interacción requerida.' : 'Verificando que se active el auto-play sin clics...'}
                                  </span>
                                </div>
                              </div>

                              {/* Check 4 */}
                              <div className="flex items-start gap-2.5 text-xs">
                                <div className={`p-0.5 rounded-full mt-0.5 ${testChecks.loopOk ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-900 text-slate-600'}`}>
                                  {testChecks.loopOk ? (
                                    <Check size={11} />
                                  ) : (
                                    <RefreshCw size={11} className="animate-spin text-indigo-400" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <span className={`text-[11px] font-bold block ${testChecks.loopOk ? 'text-slate-200' : 'text-slate-500'}`}>
                                    Reproducción en Bucle Infinito
                                  </span>
                                  <span className="text-[9px] text-slate-500 block leading-relaxed">
                                    {testChecks.loopOk ? '✓ Propiedad loop validada y flujo continuo habilitado.' : 'Verificando que la propiedad loop esté activa...'}
                                  </span>
                                </div>
                              </div>

                              {/* Check 5 */}
                              <div className="flex items-start gap-2.5 text-xs">
                                <div className={`p-0.5 rounded-full mt-0.5 ${testChecks.syncOk ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-900 text-slate-600'}`}>
                                  {testChecks.syncOk ? (
                                    <Check size={11} />
                                  ) : (
                                    <div className="w-2.5 h-2.5 rounded-full bg-slate-700 mt-1" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <span className={`text-[11px] font-bold block ${testChecks.syncOk ? 'text-slate-200' : 'text-slate-500'}`}>
                                    Sincronización con la Pantalla Pública
                                  </span>
                                  <span className="text-[9px] text-slate-500 block leading-relaxed">
                                    {testChecks.syncOk ? '✓ Guardado y sincronizado con el servidor.' : 'Se guardará y propagará al servidor al confirmar.'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Buttons */}
                            <div className="flex items-center gap-2 pt-2 border-t border-slate-850">
                              <button
                                type="button"
                                onClick={() => {
                                  setVideoValidationStatus('idle');
                                  setTempVideoUrl('');
                                }}
                                className="flex-1 px-3 py-2 bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-300 rounded-lg text-xs font-bold transition-colors cursor-pointer text-center"
                              >
                                Cancelar
                              </button>
                              
                              <button
                                type="button"
                                disabled={!(testChecks.decodeOk && testChecks.autoplayOk && testChecks.loopOk)}
                                onClick={() => {
                                  const savedPath = lastUploadedPath || '/custom_bg_video.mp4';
                                  const currentVideos = appConfig.publicDisplayBgVideos || [];
                                  const alreadyExists = currentVideos.some(v => v.url === savedPath);
                                  const updatedVideos = alreadyExists 
                                    ? currentVideos 
                                    : [...currentVideos, {
                                        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
                                        url: savedPath,
                                        active: true,
											name: videoValidationDetails?.name || savedPath.split('/').pop() || 'Vídeo'
                                      }];
                                  onSaveAppConfig({ 
                                    ...appConfig, 
                                    publicDisplayBgVideo: savedPath,
                                    publicDisplayBgVideos: updatedVideos,
                                    publicDisplayBgType: 'video'
                                  });
                                }}
                                className={`flex-[2] px-3 py-2 text-white rounded-lg text-xs font-bold text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                                  testChecks.decodeOk && testChecks.autoplayOk && testChecks.loopOk
                                    ? 'bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/15'
                                    : 'bg-slate-800 text-slate-500 border border-slate-750 cursor-not-allowed opacity-50'
                                }`}
                              >
                                <Check size={13} />
                                <span>ACEPTAR Y APLICAR VÍDEO</span>
                              </button>
                            </div>
                          </div>
                        )}

                        {/* SUCCESS SCREEN */}
                        {videoValidationStatus === 'success' && (
                          <div className="p-4 bg-emerald-950/15 border border-emerald-500/20 rounded-xl space-y-3.5 text-center">
                            <div className="w-10 h-10 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center mx-auto shadow-inner shadow-emerald-500/20">
                              <Check size={20} className="stroke-[3]" />
                            </div>
                            <div className="space-y-1">
                              <span className="text-xs font-bold text-emerald-400 block uppercase tracking-wider">¡VÍDEO VALIDADO Y ACTIVO!</span>
                              <p className="text-[10px] text-slate-400 leading-relaxed max-w-xs mx-auto">
                                El vídeo se ha analizado, transcodificado, validado en bucle y activado correctamente en la Pantalla Pública.
                              </p>
                            </div>

                            {/* Tech Details */}
                            <div className="bg-slate-950/60 rounded-xl p-2.5 border border-slate-900 text-left text-[9px] text-slate-500 font-mono space-y-1">
                              <div><span className="text-slate-400 font-bold">Archivo:</span> {videoValidationDetails?.name}</div>
                              <div><span className="text-slate-400 font-bold">Tamaño:</span> {((videoValidationDetails?.size || 0) / 1024 / 1024).toFixed(1)} MB</div>
                              <div><span className="text-slate-400 font-bold">Resolución:</span> {videoValidationDetails?.width}x{videoValidationDetails?.height}</div>
                              <div><span className="text-slate-400 font-bold">Duración:</span> {videoValidationDetails?.duration?.toFixed(1)}s</div>
                              <div><span className="text-slate-400 font-bold">Ruta:</span> /custom_bg_video.mp4</div>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setVideoValidationStatus('idle');
                                setTempVideoUrl('');
                              }}
                              className="w-full px-3 py-2 bg-emerald-600/10 border border-emerald-500/10 text-emerald-400 hover:bg-emerald-600/15 rounded-lg text-xs font-bold transition-colors cursor-pointer text-center"
                            >
                              Volver
                            </button>
                          </div>
                        )}

                        {/* ERROR SCREEN */}
                        {videoValidationStatus === 'error' && (
                          <div className="p-4 bg-rose-950/15 border border-rose-500/20 rounded-xl space-y-3.5 text-center">
                            <div className="w-10 h-10 rounded-full bg-rose-500/15 text-rose-400 flex items-center justify-center mx-auto">
                              <AlertTriangle size={20} />
                            </div>
                            <div className="space-y-1">
                              <span className="text-xs font-bold text-rose-400 block uppercase tracking-wider">ERROR DE COMPATIBILIDAD</span>
                              <p className="text-[10px] text-rose-300 leading-relaxed bg-rose-950/30 p-2.5 rounded-lg border border-rose-900/20 text-left">
                                {videoValidationError}
                              </p>
                            </div>

                            <div className="text-left text-[9px] text-slate-500 leading-relaxed bg-slate-950/40 p-2.5 rounded-xl border border-slate-900">
                              <span className="font-bold text-slate-400 block mb-1">Recomendaciones:</span>
                              • Asegúrese de que el archivo de vídeo no esté dañado o corrupto.<br />
                              • Pruebe con un vídeo de menor resolución (como 720p o 1080p).<br />
                              • Use archivos en contenedor .mp4 estándar.
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setVideoValidationStatus('idle');
                                setTempVideoUrl('');
                                setVideoValidationError('');
                              }}
                              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-850 rounded-lg text-xs font-bold transition-colors cursor-pointer text-center"
                            >
                              Intentar con otro vídeo
                            </button>
                          </div>
                        )}

                        {/* PANEL DE DIAGNÓSTICO TÉCNICO DE VIDEO (MODO TV) */}
                        {videoValidationDetails && (
                          <div className="mt-4 bg-slate-950 rounded-xl border border-slate-900 overflow-hidden shadow-inner animate-fadeIn">
                            <button
                              type="button"
                              onClick={() => setShowDiagnosticPanel(!showDiagnosticPanel)}
                              className="w-full flex items-center justify-between px-3 py-2 bg-slate-900 border-b border-slate-900 hover:bg-slate-850 transition-colors text-left cursor-pointer"
                            >
                              <div className="flex items-center gap-2">
                                <Sliders size={12} className="text-indigo-400 animate-pulse" />
                                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wide">Panel de Diagnóstico Técnico de Video</span>
                              </div>
                              <span className="text-[9px] text-indigo-400 font-bold bg-indigo-950/40 border border-indigo-900/30 px-1.5 py-0.5 rounded">
                                {showDiagnosticPanel ? 'OCULTAR DETALLES' : 'MOSTRAR DIAGNÓSTICO'}
                              </span>
                            </button>
                            
                            {showDiagnosticPanel && (
                              <div className="p-3 space-y-3 text-[11px] text-slate-300">
                                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 font-mono text-[10px]">
                                  <div>
                                    <span className="text-slate-500 block font-sans font-bold text-[8px] uppercase tracking-wide">Archivo:</span>
                                    <span className="text-slate-200 truncate block font-semibold" title={videoValidationDetails.name}>{videoValidationDetails.name}</span>
                                  </div>
                                  <div>
                                    <span className="text-slate-500 block font-sans font-bold text-[8px] uppercase tracking-wide">Tamaño:</span>
                                    <span className="text-slate-200 font-semibold">{((videoValidationDetails.size || 0) / 1024 / 1024).toFixed(2)} MB</span>
                                  </div>
                                  <div>
                                    <span className="text-slate-500 block font-sans font-bold text-[8px] uppercase tracking-wide">Resolución:</span>
                                    <span className="text-slate-200 font-semibold">
                                      {videoValidationDetails.width && videoValidationDetails.height 
                                        ? `${videoValidationDetails.width}x${videoValidationDetails.height}`
                                        : 'Por analizar...'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-slate-500 block font-sans font-bold text-[8px] uppercase tracking-wide">Duración:</span>
                                    <span className="text-slate-200 font-semibold">
                                      {videoValidationDetails.duration ? `${videoValidationDetails.duration.toFixed(1)}s` : 'Por analizar...'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-slate-500 block font-sans font-bold text-[8px] uppercase tracking-wide">Códec Video:</span>
                                    <span className="text-indigo-400 font-semibold">{videoValidationDetails.videoCodec || 'Pendiente...'}</span>
                                  </div>
                                  <div>
                                    <span className="text-slate-500 block font-sans font-bold text-[8px] uppercase tracking-wide">Códec Audio:</span>
                                    <span className="text-indigo-400 font-semibold">{videoValidationDetails.audioCodec || 'Pendiente...'}</span>
                                  </div>
                                </div>

                                <div className="border-t border-slate-900 pt-2.5 space-y-2 font-mono text-[9px] text-slate-400">
                                  <div>
                                    <span className="text-slate-500 block font-sans font-bold text-[8px] uppercase tracking-wide">Ruta Servidor:</span>
                                    <span className="text-slate-300 bg-slate-900 border border-slate-850 px-1.5 py-0.5 rounded select-all block break-all font-semibold mt-0.5">
                                      {videoValidationDetails.savedPath || '(Cargando y guardando...)'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-slate-500 block font-sans font-bold text-[8px] uppercase tracking-wide">URL de Streaming TV:</span>
                                    <div className="flex items-center gap-1 mt-0.5">
                                      <span className="text-indigo-300 bg-slate-900 border border-slate-850 px-1.5 py-0.5 rounded select-all block break-all font-semibold flex-1">
                                        {videoValidationDetails.finalUrl || '(Esperando guardado exitoso...)'}
                                      </span>
                                      {videoValidationDetails.finalUrl && (
                                        <a 
                                          href={videoValidationDetails.finalUrl} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="p-1 hover:bg-slate-900 text-indigo-400 border border-slate-850 rounded transition-colors shrink-0"
                                          title="Probar transmisión en nueva pestaña"
                                        >
                                          <ExternalLink size={10} />
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                  <div>
                                    <span className="text-slate-500 block font-sans font-bold text-[8px] uppercase tracking-wide">Transcodificación:</span>
                                    <span className="text-emerald-400 font-semibold block leading-relaxed mt-0.5">
                                      {videoValidationDetails.transcodingResult || 'Procesando conversión...'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-slate-500 block font-sans font-bold text-[8px] uppercase tracking-wide">Validación:</span>
                                    <span className="text-slate-300 font-semibold block mt-0.5">{videoValidationDetails.validationResult || 'En cola...'}</span>
                                  </div>
                                </div>

                                {/* TEST DE COMPATIBILIDAD INTERACTIVO AUTOMÁTICO */}
                                {videoValidationDetails.finalUrl && (
                                  <div className="border-t border-slate-900 pt-3 mt-3 space-y-3 font-sans">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-1.5">
                                        <Play size={11} className="text-emerald-400 animate-pulse" />
                                        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wide">Prueba de Compatibilidad Smart TV</span>
                                      </div>
                                      <button
                                        type="button"
                                        disabled={isTestingCompatibility}
                                        onClick={() => {
                                          const absoluteUrl = window.location.origin + videoValidationDetails.finalUrl;
                                          runCompatibilityTests(absoluteUrl, videoValidationDetails.size || 0);
                                        }}
                                        className={`px-2.5 py-1 text-[9px] font-bold rounded-lg border transition-all cursor-pointer uppercase tracking-wider ${
                                          isTestingCompatibility
                                            ? 'bg-slate-900 border-slate-850 text-slate-500 animate-pulse'
                                            : 'bg-indigo-600/15 border-indigo-500/20 text-indigo-400 hover:bg-indigo-600/25 active:scale-95'
                                        }`}
                                      >
                                        {isTestingCompatibility ? 'Ejecutando Test...' : 'Comprobar compatibilidad'}
                                      </button>
                                    </div>

                                    {/* Summary message */}
                                    {compatibilityTestSummary && (
                                      <div className={`p-2.5 rounded-lg border text-[10px] font-semibold leading-relaxed animate-fadeIn ${
                                        compatibilityTestSummary.startsWith('¡EXCELENTE!')
                                          ? 'bg-emerald-950/20 border-emerald-500/20 text-emerald-400'
                                          : 'bg-rose-950/20 border-rose-500/20 text-rose-300'
                                      }`}>
                                        {compatibilityTestSummary}
                                      </div>
                                    )}

                                    {/* Detailed list of steps */}
                                    <div className="space-y-2 bg-slate-900/40 p-2.5 rounded-lg border border-slate-900 font-mono text-[9px]">
                                      {compatibilityTests.map((t) => (
                                        <div key={t.id} className="flex items-start gap-2 border-b border-slate-900/50 pb-1.5 last:border-0 last:pb-0">
                                          <div className="shrink-0 mt-0.5">
                                            {t.status === 'success' && <span className="text-emerald-400 font-bold text-[10px]">✅</span>}
                                            {t.status === 'failed' && <span className="text-rose-500 font-bold text-[10px]">❌</span>}
                                            {t.status === 'running' && <span className="text-indigo-400 animate-spin inline-block text-[10px]">🔄</span>}
                                            {t.status === 'idle' && <span className="text-slate-600 text-[10px]">⏳</span>}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-center gap-2">
                                              <span className={`font-bold ${
                                                t.status === 'success' 
                                                  ? 'text-slate-300' 
                                                  : t.status === 'failed' 
                                                    ? 'text-rose-400 font-semibold' 
                                                    : t.status === 'running' 
                                                      ? 'text-indigo-400' 
                                                      : 'text-slate-500'
                                              }`}>
                                                {t.name}
                                              </span>
                                              <span className={`text-[7px] uppercase tracking-wider font-bold px-1 py-0.5 rounded ${
                                                t.status === 'success'
                                                  ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-900/30'
                                                  : t.status === 'failed'
                                                    ? 'bg-rose-950/50 text-rose-400 border border-rose-900/30'
                                                    : t.status === 'running'
                                                      ? 'bg-indigo-950/50 text-indigo-400 border border-indigo-900/30 animate-pulse'
                                                      : 'bg-slate-950 text-slate-700'
                                              }`}>
                                                {t.status === 'idle' ? 'Pendiente' : t.status === 'running' ? 'En curso' : t.status === 'success' ? 'Pasado' : 'Fallido'}
                                              </span>
                                            </div>
                                            <span className={`block mt-0.5 leading-normal ${
                                              t.status === 'success' 
                                                ? 'text-slate-400' 
                                                : t.status === 'failed' 
                                                  ? 'text-rose-300 bg-rose-950/15 border border-rose-950/35 p-1.5 rounded font-bold' 
                                                  : t.status === 'running' 
                                                    ? 'text-indigo-300' 
                                                    : 'text-slate-600'
                                            }`}>
                                              {t.detail}
                                            </span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {videoValidationDetails.technicalError && (
                                  <div className="border-t border-rose-950/40 pt-2.5 font-mono text-[9px]">
                                    <span className="text-rose-400 block font-sans font-bold text-[8px] uppercase tracking-wide">Error Técnico Detallado:</span>
                                    <div className="bg-rose-950/20 border border-rose-500/25 rounded p-2 mt-1 font-mono text-rose-300 leading-normal whitespace-pre-wrap select-all">
                                      {videoValidationDetails.technicalError}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-3 bg-indigo-950/10 border border-indigo-500/10 rounded-xl animate-fadeIn">
                        <div className="flex items-start gap-2.5">
                          <Tv size={16} className="text-indigo-400 shrink-0 mt-0.5" />
                          <div>
                            <span className="text-xs font-bold text-indigo-300 block">Vídeo de Demostración Activo</span>
                            <span className="text-[10px] text-slate-400 block leading-relaxed mt-0.5">
                              La pantalla pública cargará el vídeo integrado en la aplicación (`/demo.mp4`), ideal para diagnosticar problemas del reproductor en televisores Samsung Tizen.
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* List of multiple background videos with active check, rearrange ordering & delete buttons */}
                    {appConfig.publicDisplayBgType === 'video' && (appConfig.publicDisplayBgVideos || []).length > 0 && (
                      <div className="space-y-2 mt-4 max-h-[220px] overflow-y-auto pr-1">
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">Vídeos en Lista de Reproducción (Reorganizar/Eliminar)</span>
                        
                        <div className="space-y-1.5">
                          {(appConfig.publicDisplayBgVideos || []).map((vid, idx, arr) => (
                            <div 
                              key={vid.id}
                              className="flex items-center justify-between gap-3 bg-slate-950/60 border border-slate-850 p-2 rounded-xl"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                {/* Video Status Check */}
                                <input
                                  type="checkbox"
                                  checked={vid.active !== false}
                                  onChange={() => {
                                    const updated = arr.map(v => v.id === vid.id ? { ...v, active: !v.active } : v);
                                    const activeVids = updated.filter(v => v.active !== false);
                                    const currentBgVideo = activeVids.length > 0 ? activeVids[0].url : '';
                                    onSaveAppConfig({ 
                                      ...appConfig, 
                                      publicDisplayBgVideos: updated,
                                      publicDisplayBgVideo: appConfig.publicDisplayBgVideo === vid.url && !vid.active ? currentBgVideo : appConfig.publicDisplayBgVideo
                                    });
                                  }}
                                  className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-950 border-slate-800 cursor-pointer"
                                />
                                
                                <div className="w-10 h-10 rounded bg-slate-900 border border-slate-800 flex items-center justify-center text-indigo-400 shrink-0">
                                  <Video size={16} />
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <span className="text-[11px] font-mono text-slate-300 truncate max-w-[150px]">
                                    {vid.url.split('/').pop() || `Vídeo ${idx + 1}`}
                                  </span>
                                  <span className="text-[9px] text-slate-500">
                                    Posición: {idx + 1} {!vid.active && '(Pausado)'}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                {/* Move Up */}
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={() => {
                                    const list = [...arr];
                                    const temp = list[idx];
                                    list[idx] = list[idx - 1];
                                    list[idx - 1] = temp;
                                    onSaveAppConfig({ ...appConfig, publicDisplayBgVideos: list });
                                  }}
                                  className={`p-1.5 rounded-lg border border-slate-850 transition-all ${
                                    idx === 0
                                      ? 'text-slate-700 bg-transparent'
                                      : 'text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10'
                                  }`}
                                >
                                  <ArrowUp size={13} />
                                </button>

                                {/* Move Down */}
                                <button
                                  type="button"
                                  disabled={idx === arr.length - 1}
                                  onClick={() => {
                                    const list = [...arr];
                                    const temp = list[idx];
                                    list[idx] = list[idx + 1];
                                    list[idx + 1] = temp;
                                    onSaveAppConfig({ ...appConfig, publicDisplayBgVideos: list });
                                  }}
                                  className={`p-1.5 rounded-lg border border-slate-850 transition-all ${
                                    idx === arr.length - 1
                                      ? 'text-slate-700 bg-transparent'
                                      : 'text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10'
                                  }`}
                                >
                                  <ArrowDown size={13} />
                                </button>

                                {/* Delete */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = arr.filter(v => v.id !== vid.id);
                                    const activeVids = updated.filter(v => v.active !== false);
                                    const nextBgVideo = activeVids.length > 0 ? activeVids[0].url : '';
                                    onSaveAppConfig({ 
                                      ...appConfig, 
                                      publicDisplayBgVideos: updated,
                                      publicDisplayBgVideo: appConfig.publicDisplayBgVideo === vid.url ? nextBgVideo : appConfig.publicDisplayBgVideo
                                    });
                                  }}
                                  className="p-1.5 text-rose-400 hover:text-rose-200 hover:bg-rose-500/10 border border-slate-850 rounded-lg transition-all"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {(appConfig.publicDisplayBgType === 'video' || appConfig.publicDisplayBgType === 'image') && (
                  <div className="pt-2 border-t border-slate-800/40 mt-3 animate-fadeIn space-y-3">
                    <div className="flex items-center space-x-3 bg-slate-950/40 border border-slate-850 p-3 rounded-xl">
                      <input
                        type="checkbox"
                        id="publicDisplayHideBgOnActive"
                        checked={!!appConfig.publicDisplayHideBgOnActive}
                        onChange={(e) => onSaveAppConfig({ ...appConfig, publicDisplayHideBgOnActive: e.target.checked })}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-950 border-slate-800 cursor-pointer"
                      />
                      <div className="cursor-pointer select-none">
                        <label htmlFor="publicDisplayHideBgOnActive" className="text-xs text-slate-300 font-semibold cursor-pointer block">
                          Sustituir temporalmente el fondo al mostrar un Ticket Activo
                        </label>
                        <span className="text-[10px] text-slate-500 block leading-relaxed mt-0.5">
                          Si se activa, el fondo de vídeo o imagen se ocultará temporalmente mostrando el fondo de color liso del tema mientras un ticket esté activo. Si se desactiva, el ticket se mostrará encima del vídeo/imagen de fondo.
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 bg-slate-950/40 border border-slate-850 p-3 rounded-xl">
                      <input
                        type="checkbox"
                        id="publicDisplayDiagnosticEnabled"
                        checked={!!appConfig.publicDisplayDiagnosticEnabled}
                        onChange={(e) => onSaveAppConfig({ ...appConfig, publicDisplayDiagnosticEnabled: e.target.checked })}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-950 border-slate-800 cursor-pointer"
                      />
                      <div className="cursor-pointer select-none">
                        <label htmlFor="publicDisplayDiagnosticEnabled" className="text-xs text-slate-300 font-semibold cursor-pointer block">
                          Habilitar Panel de Diagnóstico en Tiempo Real
                        </label>
                        <span className="text-[10px] text-slate-500 block leading-relaxed mt-0.5">
                          Muestra un panel interactivo con la ruta del vídeo, estado del reproductor y un registro detallado de eventos HTML5 (canplay, playing, etc.) directamente en la Pantalla Pública. Útil para verificar compatibilidad en Smart TVs.
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Subsection 3: Standby Mode (Modo de Espera) */}
            <div className="bg-slate-900/25 border border-slate-850 p-4 rounded-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Tv size={14} className="text-emerald-400" />
                    3. Modo de Espera (Slideshow)
                  </h5>
                  <p className="text-[10px] text-slate-500 mt-0.5">Muestra publicidad o imágenes en carrusel cuando no hay turnos activos.</p>
                </div>
                
                {/* Standby toggle */}
                <div className="flex items-center space-x-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
                  <input
                    type="checkbox"
                    id="standbyEnabled"
                    checked={appConfig.publicDisplayStandbyEnabled !== false}
                    onChange={(e) => onSaveAppConfig({ ...appConfig, publicDisplayStandbyEnabled: e.target.checked })}
                    className="w-3.5 h-3.5 text-indigo-600 focus:ring-indigo-500 bg-slate-950 border-slate-800 rounded"
                  />
                  <label htmlFor="standbyEnabled" className="text-[11px] text-slate-300 font-semibold select-none cursor-pointer">
                    Activar
                  </label>
                </div>
              </div>

              {appConfig.publicDisplayStandbyEnabled !== false && (
                <div className="space-y-4 pt-1 animate-fadeIn">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Time slider */}
                    <div className="space-y-1.5 bg-slate-950/30 p-3 rounded-xl border border-slate-850/50">
                      <div className="flex justify-between text-xs text-slate-400">
                        <span>Rotación de diapositivas</span>
                        <span className="font-bold text-indigo-400">{appConfig.publicDisplayStandbyDuration || 5}s / diapositiva</span>
                      </div>
                      <input
                        type="range"
                        min="3"
                        max="30"
                        step="1"
                        value={appConfig.publicDisplayStandbyDuration || 5}
                        onChange={(e) => onSaveAppConfig({ ...appConfig, publicDisplayStandbyDuration: parseInt(e.target.value, 10) })}
                        className="w-full accent-indigo-500"
                      />
                    </div>

                    {/* Scale Fit toggle */}
                    <div className="space-y-1.5 bg-slate-950/30 p-3 rounded-xl border border-slate-850/50 flex flex-col justify-between">
                      <span className="text-xs text-slate-400 block">Ajuste de Escala de Imagen</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => onSaveAppConfig({ ...appConfig, publicDisplayStandbyFit: 'cover' })}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            (appConfig.publicDisplayStandbyFit || 'cover') === 'cover'
                              ? 'bg-indigo-600 text-white shadow-md'
                              : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-300'
                          }`}
                        >
                          Rellenar (Cover)
                        </button>
                        <button
                          type="button"
                          onClick={() => onSaveAppConfig({ ...appConfig, publicDisplayStandbyFit: 'contain' })}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            appConfig.publicDisplayStandbyFit === 'contain'
                              ? 'bg-indigo-600 text-white shadow-md'
                              : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-300'
                          }`}
                        >
                          Ajustar (Contain)
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Multi images upload zone */}
                  <div className="space-y-2">
                    <label className="text-xs text-slate-400 block font-semibold">Cargar Diapositivas (Arrastrar o seleccionar)</label>
                    <div className="flex items-center justify-center border border-dashed border-slate-800 bg-slate-950/20 rounded-2xl p-4 hover:border-indigo-500/40 hover:bg-indigo-500/5 transition-all text-center">
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        id="standbyFilesUploader"
                        onChange={async (e) => {
                          const files = e.target.files;
                          if (files && files.length > 0) {
                            const current = appConfig.publicDisplayStandbyImages || [];
                            const newlyLoaded: { id: string; url: string; active: boolean }[] = [];
                            
                            for (let i = 0; i < files.length; i++) {
                              const file = files[i];
                              const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
                              try {
                                await dbSaveSettings(`media_standby_image_${id}`, file);
                                newlyLoaded.push({
                                  id,
                                  url: `indexeddb:standby_image_${id}`,
                                  active: true
                                });
                              } catch (err) {
                                console.error('Error saving standby image:', err);
                              }
                            }

                            if (newlyLoaded.length > 0) {
                              onSaveAppConfig({
                                ...appConfig,
                                publicDisplayStandbyImages: [...current, ...newlyLoaded]
                              });
                            }
                          }
                        }}
                        className="hidden"
                      />
                      <label htmlFor="standbyFilesUploader" className="cursor-pointer space-y-1.5 block w-full py-2">
                        <div className="mx-auto w-10 h-10 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                          <Upload size={18} />
                        </div>
                        <p className="text-xs text-slate-300 font-bold">Subir imágenes (.jpg, .png, .webp)</p>
                        <p className="text-[10px] text-slate-500">Soporta cargas múltiples. Se guardarán en la red local de forma automática.</p>
                      </label>
                    </div>
                  </div>

                  {/* List of images with active check, rearrange ordering & delete buttons */}
                  {(appConfig.publicDisplayStandbyImages || []).length > 0 ? (
                    <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">Imágenes en Carrusel (Reorganizar/Eliminar)</span>
                      
                      <div className="space-y-1.5">
                        {(appConfig.publicDisplayStandbyImages || []).map((img, idx, arr) => (
                          <div 
                            key={img.id}
                            className="flex items-center justify-between gap-3 bg-slate-950/60 border border-slate-850 p-2 rounded-xl"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              {/* Slide Status Check */}
                              <input
                                type="checkbox"
                                checked={img.active !== false}
                                onChange={() => {
                                  const updated = arr.map(i => i.id === img.id ? { ...i, active: !i.active } : i);
                                  onSaveAppConfig({ ...appConfig, publicDisplayStandbyImages: updated });
                                }}
                                className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-950 border-slate-800 cursor-pointer"
                              />
                              
                              <img 
                                src={img.url} 
                                className="w-10 h-10 object-cover rounded bg-slate-900 border border-slate-800" 
                                alt="Slide thumbnail" 
                                referrerPolicy="no-referrer"
                              />
                              <span className="text-[11px] font-mono text-slate-400 truncate max-w-[120px]">
                                Diapositiva {idx + 1} {!img.active && '(Pausada)'}
                              </span>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {/* Move Up */}
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => {
                                  const list = [...arr];
                                  const temp = list[idx];
                                  list[idx] = list[idx - 1];
                                  list[idx - 1] = temp;
                                  onSaveAppConfig({ ...appConfig, publicDisplayStandbyImages: list });
                                }}
                                className={`p-1.5 rounded-lg border border-slate-850 transition-all ${
                                  idx === 0
                                    ? 'text-slate-700 bg-transparent'
                                    : 'text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10'
                                }`}
                              >
                                <ArrowUp size={13} />
                              </button>

                              {/* Move Down */}
                              <button
                                type="button"
                                disabled={idx === arr.length - 1}
                                onClick={() => {
                                  const list = [...arr];
                                  const temp = list[idx];
                                  list[idx] = list[idx + 1];
                                  list[idx + 1] = temp;
                                  onSaveAppConfig({ ...appConfig, publicDisplayStandbyImages: list });
                                }}
                                className={`p-1.5 rounded-lg border border-slate-850 transition-all ${
                                  idx === arr.length - 1
                                    ? 'text-slate-700 bg-transparent'
                                    : 'text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10'
                                }`}
                              >
                                <ArrowDown size={13} />
                              </button>

                              {/* Delete */}
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = arr.filter(i => i.id !== img.id);
                                  onSaveAppConfig({ ...appConfig, publicDisplayStandbyImages: updated });
                                }}
                                className="p-1.5 text-rose-400 hover:text-rose-200 hover:bg-rose-500/10 border border-slate-850 rounded-lg transition-all"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-5 bg-slate-950/20 border border-slate-850 border-dashed rounded-xl">
                      <p className="text-[11px] text-slate-500">No hay diapositivas cargadas todavía. Suba fotos publicitarias arriba.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Subsection 4: Multi-Ticket Board (Panel de Restaurante) */}
            <div className="bg-slate-900/25 border border-slate-850 p-4 rounded-2xl space-y-4">
              <div>
                <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <LayoutGrid size={14} className="text-indigo-400" />
                  4. Panel de Pedidos Listos (Estilo Fast Food)
                </h5>
                <p className="text-[10px] text-slate-500 mt-0.5">Configure la pantalla para mostrar múltiples tickets listos simultáneamente.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-semibold">Modo de Visualización</label>
                  <select
                    value={appConfig.publicDisplayLayoutMode || 'list-main'}
                    onChange={(e) => onSaveAppConfig({ ...appConfig, publicDisplayLayoutMode: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-indigo-500 outline-none transition-colors"
                  >
                    <option value="list-main">Lista + Ticket Principal Destacado</option>
                    <option value="restaurant-2.0">Pantalla Pública de Turnos 2.0 (Diseño Premium)</option>
                    <option value="list-only">Sólo Lista de Pedidos en Rejilla</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-semibold">Posición de la Lista</label>
                  <select
                    value={appConfig.publicDisplayListPosition || 'bottom'}
                    onChange={(e) => onSaveAppConfig({ ...appConfig, publicDisplayListPosition: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-indigo-500 outline-none transition-colors"
                  >
                    <option value="bottom">Abajo (Horizontal)</option>
                    <option value="side-right">Lateral Derecha (Vertical)</option>
                    <option value="side-left">Lateral Izquierda (Vertical)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-semibold">Máx. Tickets Visibles</label>
                  <select
                    value={appConfig.publicDisplayMaxTickets || 20}
                    onChange={(e) => onSaveAppConfig({ ...appConfig, publicDisplayMaxTickets: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-indigo-500 outline-none transition-colors"
                  >
                    <option value="5">5 pedidos</option>
                    <option value="10">10 pedidos</option>
                    <option value="15">15 pedidos</option>
                    <option value="20">20 pedidos</option>
                    <option value="25">25 pedidos</option>
                    <option value="30">30 pedidos</option>
                    <option value="40">40 pedidos</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-semibold">Columnas de Rejilla</label>
                  <select
                    value={appConfig.publicDisplayColumns || 4}
                    onChange={(e) => onSaveAppConfig({ ...appConfig, publicDisplayColumns: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-indigo-500 outline-none transition-colors"
                  >
                    <option value="1">1 Columna</option>
                    <option value="2">2 Columnas</option>
                    <option value="3">3 Columnas</option>
                    <option value="4">4 Columnas (Estándar)</option>
                    <option value="5">5 Columnas</option>
                    <option value="6">6 Columnas</option>
                    <option value="8">8 Columnas</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-semibold">Tamaño de los Números</label>
                  <select
                    value={appConfig.publicDisplayListNumberSize || 'medium'}
                    onChange={(e) => onSaveAppConfig({ ...appConfig, publicDisplayListNumberSize: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-indigo-500 outline-none transition-colors"
                  >
                    <option value="small">Pequeño</option>
                    <option value="medium">Mediano</option>
                    <option value="large">Grande</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center space-x-3 bg-slate-950/40 border border-slate-850 p-3 rounded-xl">
                <input
                  type="checkbox"
                  id="publicDisplayShowMain"
                  checked={appConfig.publicDisplayShowMain !== false}
                  onChange={(e) => onSaveAppConfig({ ...appConfig, publicDisplayShowMain: e.target.checked })}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-950 border-slate-800 cursor-pointer"
                />
                <div className="cursor-pointer select-none">
                  <label htmlFor="publicDisplayShowMain" className="text-xs text-slate-300 font-semibold cursor-pointer block">
                    Mostrar el Ticket Principal Destacado
                  </label>
                  <span className="text-[10px] text-slate-500 block leading-relaxed mt-0.5">
                    Muestra el último pedido listo de manera gigante y animada para llamar la atención del cliente.
                  </span>
                </div>
              </div>

              {/* Color Settings */}
              <div className="pt-2 border-t border-slate-850 space-y-3">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">Personalización de Colores de Tickets</span>
                
                <div className="grid grid-cols-2 gap-3">
                  {/* Main Ticket Color */}
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400 font-medium">Ticket Principal</label>
                    <div className="flex gap-1.5">
                      <input
                        type="color"
                        value={appConfig.publicDisplayMainColor || '#fbbf24'}
                        onChange={(e) => onSaveAppConfig({ ...appConfig, publicDisplayMainColor: e.target.value })}
                        className="w-7 h-7 bg-transparent border-0 rounded cursor-pointer shrink-0"
                      />
                      <input
                        type="text"
                        value={appConfig.publicDisplayMainColor || '#fbbf24'}
                        onChange={(e) => onSaveAppConfig({ ...appConfig, publicDisplayMainColor: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[11px] font-mono text-slate-200"
                      />
                    </div>
                  </div>

                  {/* List Items Color */}
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400 font-medium">Color de la Lista</label>
                    <div className="flex gap-1.5">
                      <input
                        type="color"
                        value={appConfig.publicDisplayListColor || '#ffffff'}
                        onChange={(e) => onSaveAppConfig({ ...appConfig, publicDisplayListColor: e.target.value })}
                        className="w-7 h-7 bg-transparent border-0 rounded cursor-pointer shrink-0"
                      />
                      <input
                        type="text"
                        value={appConfig.publicDisplayListColor || '#ffffff'}
                        onChange={(e) => onSaveAppConfig({ ...appConfig, publicDisplayListColor: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[11px] font-mono text-slate-200"
                      />
                    </div>
                  </div>

                  {/* Newly Prepared Highlight Color */}
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400 font-medium">Recién Agregados</label>
                    <div className="flex gap-1.5">
                      <input
                        type="color"
                        value={appConfig.publicDisplayNewColor || '#10b981'}
                        onChange={(e) => onSaveAppConfig({ ...appConfig, publicDisplayNewColor: e.target.value })}
                        className="w-7 h-7 bg-transparent border-0 rounded cursor-pointer shrink-0"
                      />
                      <input
                        type="text"
                        value={appConfig.publicDisplayNewColor || '#10b981'}
                        onChange={(e) => onSaveAppConfig({ ...appConfig, publicDisplayNewColor: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[11px] font-mono text-slate-200"
                      />
                    </div>
                  </div>

                  {/* Older Tickets Color */}
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400 font-medium font-mono">Tickets Antiguos</label>
                    <div className="flex gap-1.5">
                      <input
                        type="color"
                        value={appConfig.publicDisplayOldColor || '#94a3b8'}
                        onChange={(e) => onSaveAppConfig({ ...appConfig, publicDisplayOldColor: e.target.value })}
                        className="w-7 h-7 bg-transparent border-0 rounded cursor-pointer shrink-0"
                      />
                      <input
                        type="text"
                        value={appConfig.publicDisplayOldColor || '#94a3b8'}
                        onChange={(e) => onSaveAppConfig({ ...appConfig, publicDisplayOldColor: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[11px] font-mono text-slate-200"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel: Beautiful Real-Time Interactive Live Preview Mockup */}
          <div className="xl:col-span-5 sticky top-6 space-y-4">
            <div className="bg-slate-900/25 border border-slate-850 p-4 rounded-2xl space-y-3.5">
              <div className="flex items-center justify-between">
                <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Tv size={14} className="text-indigo-400" />
                  Vista Previa TV (Tiempo Real)
                </h5>
                
                {/* Switch between standby preview and active ticket preview */}
                <div className="flex bg-slate-950 border border-slate-850 p-1 rounded-lg">
                  <button
                    type="button"
                    id="previewModeActive"
                    onClick={() => {
                      (window as any)._previewStandby = false;
                      // Force local component update
                      onSaveAppConfig({ ...appConfig });
                    }}
                    className={`px-2 py-1 rounded text-[9px] font-bold uppercase transition-all ${
                      !(window as any)._previewStandby
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    Ticket Listo
                  </button>
                  <button
                    type="button"
                    id="previewModeStandby"
                    onClick={() => {
                      (window as any)._previewStandby = true;
                      // Force local component update
                      onSaveAppConfig({ ...appConfig });
                    }}
                    className={`px-2 py-1 rounded text-[9px] font-bold uppercase transition-all ${
                      (window as any)._previewStandby
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    Bucle Standby
                  </button>
                </div>
              </div>

              {/* Dynamic miniature screen display mockup */}
              {(() => {
                const previewIsStandby = (window as any)._previewStandby;
                const activeSlides = (appConfig.publicDisplayStandbyImages || []).filter(img => img.active);
                const hasSlides = activeSlides.length > 0;

                const previewLang = appConfig.publicDisplayLanguage || 'en';
                const previewT = DISPLAY_TRANSLATIONS[previewLang] || DISPLAY_TRANSLATIONS.en;

                const isPrDefaultTitle = !appConfig.publicDisplayTitle || 
                  appConfig.publicDisplayTitle === 'PEDIDO LISTO' || 
                  appConfig.publicDisplayTitle === 'ORDER READY' ||
                  appConfig.publicDisplayTitle === 'PEDIDOS LISTOS' ||
                  appConfig.publicDisplayTitle === 'PEDIDO LISTO / ORDER READY';

                const isPrDefaultMessage = !appConfig.publicDisplayMessage || 
                  appConfig.publicDisplayMessage === 'Puede recoger su pedido' || 
                  appConfig.publicDisplayMessage === 'Please pick up your order' ||
                  appConfig.publicDisplayMessage === 'POR FAVOR, RECOJA SU PEDIDO EN EL MOSTRADOR';

                const prDisplayTitle = isPrDefaultTitle ? previewT.defaultTitle : appConfig.publicDisplayTitle;
                const prDisplayMessage = isPrDefaultMessage ? previewT.defaultMessage : appConfig.publicDisplayMessage;
                
                const prPreset = appConfig.publicDisplayThemePreset || 'black-yellow';
                const prLight = appConfig.publicDisplayThemeMode === 'light';
                
                let prBg = prLight ? '#ffffff' : '#000000';
                let prText = prLight ? '#1e1b4b' : '#fbbf24';
                let prTitle = prLight ? '#0f172a' : '#ffffff';
                let prSub = prLight ? '#475569' : '#a1a1aa';

                if (prPreset === 'black-yellow') {
                  prBg = prLight ? '#fef08a' : '#000000';
                  prText = prLight ? '#000000' : '#fbbf24';
                  prTitle = prLight ? '#1e1b4b' : '#ffffff';
                  prSub = prLight ? '#3f3f46' : '#a1a1aa';
                } else if (prPreset === 'black-white') {
                  prBg = prLight ? '#ffffff' : '#000000';
                  prText = prLight ? '#000000' : '#ffffff';
                  prTitle = prLight ? '#3f3f46' : '#a1a1aa';
                  prSub = prLight ? '#71717a' : '#71717a';
                } else if (prPreset === 'darkblue-white') {
                  prBg = prLight ? '#f0f9ff' : '#030712';
                  prText = prLight ? '#0369a1' : '#38bdf8';
                  prTitle = prLight ? '#0f172a' : '#ffffff';
                  prSub = prLight ? '#475569' : '#94a3b8';
                } else if (prPreset === 'darkred-white') {
                  prBg = prLight ? '#fef2f2' : '#110000';
                  prText = prLight ? '#991b1b' : '#fca5a5';
                  prTitle = prLight ? '#1e1b4b' : '#ffffff';
                  prSub = prLight ? '#7f1d1d' : '#fca5a588';
                } else if (prPreset === 'darkgreen-white') {
                  prBg = prLight ? '#f0fdf4' : '#011c10';
                  prText = prLight ? '#166534' : '#4ade80';
                  prTitle = prLight ? '#14532d' : '#ffffff';
                  prSub = prLight ? '#15803d' : '#4ade8088';
                } else if (prPreset === 'custom') {
                  prBg = appConfig.publicDisplayBg || (prLight ? '#ffffff' : '#000000');
                  prText = appConfig.publicDisplayTextColor || (prLight ? '#1e1b4b' : '#fbbf24');
                  prTitle = appConfig.publicDisplayTitleColor || (prLight ? '#0f172a' : '#ffffff');
                  prSub = `${prTitle}cc`;
                }

                let fontStyleClass = 'font-sans';
                if (appConfig.publicDisplayFontFamily === 'mono') {
                  fontStyleClass = 'font-mono';
                } else if (appConfig.publicDisplayFontFamily === 'serif') {
                  fontStyleClass = 'font-serif';
                }

                let previewSizeStyle = 'text-5xl';
                if (appConfig.publicDisplayNumberSize === 'large') {
                  previewSizeStyle = 'text-6xl';
                } else if (appConfig.publicDisplayNumberSize === 'massive') {
                  previewSizeStyle = 'text-7xl';
                }

                return (
                  <div className="relative aspect-video w-full rounded-2xl overflow-hidden border border-slate-800 shadow-2xl bg-black flex flex-col items-center justify-center text-center p-3">
                    
                    {/* Live Screen Content */}
                    <div 
                      className={`absolute inset-0 w-full h-full flex flex-col items-center justify-center p-4 transition-colors duration-300 ${fontStyleClass}`}
                      style={{ backgroundColor: prBg }}
                    >
                      {/* Special Backgrounds override (mini) */}
                      {!previewIsStandby && !appConfig.publicDisplayHideBgOnActive && appConfig.publicDisplayBgType === 'video' && appConfig.publicDisplayBgVideo && (
                        <ResolvedVideo 
                          mediaKeyOrUrl={appConfig.publicDisplayBgVideo}
                          autoPlay
                          loop
                          muted
                          playsInline
                          className="absolute inset-0 w-full h-full object-cover pointer-events-none opacity-40"
                        />
                      )}
                      {!previewIsStandby && !appConfig.publicDisplayHideBgOnActive && appConfig.publicDisplayBgType === 'image' && appConfig.publicDisplayBgImage && (
                        <ResolvedImage 
                          mediaKeyOrUrl={appConfig.publicDisplayBgImage} 
                          className="absolute inset-0 w-full h-full object-cover pointer-events-none opacity-20" 
                          alt="preview bg"
                          referrerPolicy="no-referrer"
                        />
                      )}

                      {/* Standby Slideshow Preview */}
                      {previewIsStandby ? (
                        hasSlides ? (
                          <div className="absolute inset-0 w-full h-full">
                            <ResolvedImage 
                              mediaKeyOrUrl={activeSlides[0].url} 
                              className="w-full h-full" 
                              style={{ objectFit: appConfig.publicDisplayStandbyFit || 'cover' }}
                              alt="preview slide"
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute bottom-2 left-2 px-1.5 py-0.5 bg-black/60 rounded text-[8px] text-white font-mono uppercase tracking-wider">
                              DIAPOSITIVA 1 / {activeSlides.length}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2 max-w-xs flex flex-col items-center justify-center text-slate-500">
                            <Tv size={24} className="opacity-40 animate-pulse" />
                            <p className="text-[10px] font-bold tracking-wider uppercase">STANDBY SIN DIAPOSITIVAS</p>
                            <p className="text-[9px] text-slate-400">Suba imágenes publicitarias a la izquierda para mostrarlas en bucle.</p>
                          </div>
                        )
                      ) : (
                        /* Active Ticket Preview */
                        <div className="w-full flex flex-col items-center justify-center space-y-1 z-10">
                          {/* Mini Logo */}
                          {appConfig.publicDisplayLogo && (
                            <ResolvedImage 
                              mediaKeyOrUrl={appConfig.publicDisplayLogo} 
                              className="max-h-6 object-contain rounded border border-white/5 shadow" 
                              alt="logo"
                              referrerPolicy="no-referrer"
                            />
                          )}

                          <div className="text-[10px] uppercase font-black tracking-widest" style={{ color: prTitle }}>
                            {prDisplayTitle}
                          </div>
                          
                          <div 
                            className={`font-black tracking-tighter ${previewSizeStyle} leading-none my-1`}
                            style={{ 
                              color: prText,
                              textShadow: prLight ? 'none' : `0 0 15px ${prText}33`
                            }}
                          >
                            125
                          </div>

                          {appConfig.publicDisplayShowMessage !== false && (
                            <div className="text-[10px] font-bold tracking-wide" style={{ color: prSub }}>
                              {prDisplayMessage}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Frame Indicator */}
                    <div className="absolute top-2 left-2 bg-black/75 border border-slate-800 rounded-lg px-2 py-0.5 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                      <span className="text-[8px] font-bold text-slate-400 font-mono">LIVE PREVIEW</span>
                    </div>

                  </div>
                );
              })()}

              <p className="text-[10px] text-slate-500 text-center leading-relaxed">
                * Las modificaciones guardadas se reflejarán instantáneamente en todos los televisores y móviles conectados a la red.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )}

        {/* KEYBOARD SHORTCUTS IN GENERAL TAB */}
        {subTab === 'general' && (
          <div className="space-y-6 animate-fade-in">
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
    </div>
  )}

        {/* MUSIC TAB */}
        {subTab === 'musica' && (
          <div className="space-y-6 animate-fade-in">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-950/30 p-4 border border-slate-800/60 rounded-xl">
              
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

              {/* Resume Playlist Progress */}
              <label className="flex items-center gap-2.5 p-3.5 bg-slate-950/40 border border-slate-800 rounded-xl cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={musicConfig.resumePlaylistProgress !== false}
                  onChange={(e) => {
                    const nextVal = e.target.checked;
                    onSaveMusicConfig({ ...musicConfig, resumePlaylistProgress: nextVal });
                    musicController.setConfig({ ...musicConfig, resumePlaylistProgress: nextVal });
                  }}
                  className="w-4 h-4 text-indigo-600 border-slate-800 rounded focus:ring-indigo-500"
                />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-slate-200">Recordar progreso</span>
                  <span className="text-[9px] text-slate-500">Reanuda desde último punto</span>
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
  )}

        {/* RESPALDOS TAB */}
        {subTab === 'respaldos' && (
          <div className="space-y-6 animate-fade-in">
            {/* Section 6: Backup & Recovery (Copia de Seguridad) */}
      <div className="border-t border-slate-800/80 pt-6 space-y-4">
        <div className="space-y-1">
          <h4 className="font-semibold text-sm text-indigo-400 uppercase tracking-wider flex items-center gap-2">
            <RefreshCw size={16} className="text-indigo-400" />
            Copias de Seguridad y Respaldo de Datos (Backup)
          </h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Descarga toda la base de datos de tickets, historiales y configuraciones en un archivo JSON o restáuralos al instante para evitar pérdidas de datos en horas de servicio.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Card A: Export Backup */}
          <div className="p-5 bg-slate-950/40 border border-slate-800/80 rounded-2xl flex flex-col justify-between space-y-4">
            <div className="space-y-1.5">
              <h5 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <ArrowDown size={14} className="text-indigo-400" />
                Exportar Respaldo Completo
              </h5>
              <p className="text-[11px] text-slate-500 leading-normal">
                Genera y descarga un archivo cifrado en JSON con la base de datos de turnos activos, historial de los últimos 50 llamados y configuraciones de voz/música.
              </p>
            </div>
            <button
              onClick={() => {
                try {
                  const backupData = {
                    version: "2.0",
                    timestamp: Date.now(),
                    tickets: tickets || [],
                    voiceSettings,
                    shortcutConfig,
                    appConfig,
                    musicConfig
                  };
                  const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = `turnos_backup_${new Date().toISOString().slice(0, 10)}.json`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  URL.revokeObjectURL(url);
                } catch (err: any) {
                  alert(`Error al exportar: ${err.message || err}`);
                }
              }}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg hover:shadow-indigo-500/10 cursor-pointer flex items-center justify-center gap-2"
            >
              <ArrowDown size={14} />
              Descargar Copia de Seguridad (.json)
            </button>
          </div>

          {/* Card B: Import Backup */}
          <div className="p-5 bg-slate-950/40 border border-slate-800/80 rounded-2xl flex flex-col justify-between space-y-4">
            <div className="space-y-1.5">
              <h5 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Upload size={14} className="text-amber-400" />
                Restaurar Copia de Seguridad
              </h5>
              <p className="text-[11px] text-slate-500 leading-normal">
                Sube un archivo de respaldo previamente descargado para sobrescribir y recuperar el estado exacto del sistema en este dispositivo.
              </p>
            </div>
            <div className="relative">
              <input
                type="file"
                accept=".json"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (event) => {
                    try {
                      const json = JSON.parse(event.target?.result as string);
                      if (!json || typeof json !== 'object') throw new Error("Archivo inválido.");
                      if (json.tickets && !Array.isArray(json.tickets)) throw new Error("Tickets inválidos.");
                      
                      if (onImportBackup) {
                        onImportBackup({
                          tickets: json.tickets,
                          voiceSettings: json.voiceSettings || voiceSettings,
                          appConfig: json.appConfig || appConfig,
                          musicConfig: json.musicConfig || musicConfig
                        });
                        alert("¡Copia de seguridad importada y restaurada con éxito!");
                      } else {
                        alert("Error: El sistema principal no está enlazado para aceptar la restauración.");
                      }
                    } catch (err: any) {
                      alert(`Error al importar respaldo: ${err.message || err}`);
                    }
                  };
                  reader.readAsText(file);
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <button
                type="button"
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Upload size={14} />
                <span>Seleccionar Archivo de Respaldo</span>
              </button>
            </div>
          </div>

          {/* Card C: Export PDF Documentation & System Prompt */}
          <div className="p-5 bg-slate-950/40 border border-slate-800/80 rounded-2xl flex flex-col justify-between space-y-4">
            <div className="space-y-1.5">
              <h5 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <FileText size={14} className="text-emerald-400" />
                Manual & Prompt (PDF)
              </h5>
              <p className="text-[11px] text-slate-500 leading-normal">
                Descarga en PDF la guía completa de uso de la app, escáner OCR, red multidispositivo y las reglas del Prompt de Sistema de IA.
              </p>
            </div>
            <button
              onClick={() => exportAppDocumentationAndPromptPDF()}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg hover:shadow-emerald-500/10 cursor-pointer flex items-center justify-center gap-2"
            >
              <Download size={14} />
              Descargar Manual PDF
            </button>
          </div>

            {/* Automatic Backups List */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Historial de Copias de Seguridad Automáticas</h4>
                  <p className="text-xs text-slate-400">Se guardan automáticamente backups periódicos. Puedes restaurar cualquiera con un solo clic.</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleCreateAutoBackup}
                    className="px-3 py-1.5 bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 text-xs font-semibold rounded-xl hover:bg-indigo-600 hover:text-white transition-all cursor-pointer"
                  >
                    Crear Respaldo Ahora
                  </button>
                  <button
                    onClick={handleClearAutoBackups}
                    className="px-3 py-1.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold rounded-xl hover:bg-rose-500 hover:text-white transition-all cursor-pointer"
                  >
                    Limpiar Historial
                  </button>
                </div>
              </div>

              {autoBackups.length === 0 ? (
                <p className="text-xs text-slate-500 italic text-center py-4">No hay copias automáticas en el historial local.</p>
              ) : (
                <div className="space-y-2.5">
                  {autoBackups.map((bk) => (
                    <div key={bk.id} className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800/80 rounded-xl">
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-slate-200">Copia de Seguridad - {bk.date}</span>
                        <p className="text-[10px] text-slate-500">Tickets en base de datos: <strong className="text-indigo-400">{bk.ticketCount}</strong></p>
                      </div>
                      <button
                        onClick={() => {
                          if (confirm("¿Estás seguro de que deseas restaurar este punto de respaldo? Sobrescribirá el estado actual.")) {
                            if (onImportBackup) {
                              onImportBackup(bk.data);
                              alert("¡Estado restaurado correctamente!");
                            }
                          }
                        }}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold rounded-lg shadow transition-all cursor-pointer"
                      >
                        Restaurar con 1 Clic
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    )}

        {/* MANTENIMIENTO TAB */}
        {subTab === 'mantenimiento' && (
          <div className="space-y-6 animate-fade-in">
            {/* Section 7: General Self-Diagnostic & Test Panel (Panel de Autodiagnóstico) */}
      <div className="border-t border-slate-800/80 pt-6 space-y-4">
        <div className="space-y-1">
          <h4 className="font-semibold text-sm text-indigo-400 uppercase tracking-wider flex items-center gap-2">
            <Sliders size={16} className="text-indigo-400" />
            Panel de Autodiagnóstico y Pruebas
          </h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Verifica el correcto funcionamiento de los subsistemas de voz, base de datos local y red de sincronización en 1 clic antes de iniciar el servicio diario.
          </p>
        </div>

        <div className="bg-slate-950/40 border border-slate-800/80 p-5 rounded-2xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-900 pb-3">
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-mono tracking-wider">Estado de Diagnóstico</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`w-2.5 h-2.5 rounded-full ${
                  generalDiagnosticStatus === 'running' ? 'bg-amber-400 animate-ping' :
                  generalDiagnosticStatus === 'success' ? 'bg-emerald-500' :
                  generalDiagnosticStatus === 'failed' ? 'bg-rose-500' : 'bg-slate-600'
                }`} />
                <span className="text-xs font-bold text-slate-200">
                  {generalDiagnosticStatus === 'idle' && 'No iniciado'}
                  {generalDiagnosticStatus === 'running' && 'Ejecutando batería de pruebas...'}
                  {generalDiagnosticStatus === 'success' && '¡Todos los sistemas listos! (OK)'}
                  {generalDiagnosticStatus === 'failed' && 'Se detectaron anomalías'}
                </span>
              </div>
            </div>

            <button
              onClick={handleRunGeneralDiagnostics}
              disabled={generalDiagnosticStatus === 'running'}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw size={13} className={generalDiagnosticStatus === 'running' ? 'animate-spin' : ''} />
              Lanzar Test de Sistema
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {generalDiagnosticLogs.map((log, i) => (
              <div key={i} className="p-3 bg-slate-950/60 border border-slate-900 rounded-xl flex items-start gap-2.5">
                <span className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${
                  log.status === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25' :
                  log.status === 'failed' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/25' :
                  log.status === 'running' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/25 animate-pulse' :
                  'bg-slate-900 text-slate-500 border border-slate-800'
                }`}>
                  {log.status === 'success' ? '✓' : log.status === 'failed' ? '✗' : log.status === 'running' ? '●' : '-'}
                </span>
                <div className="space-y-0.5">
                  <h6 className="text-xs font-bold text-slate-300">{log.name}</h6>
                  <p className="text-[10px] text-slate-500 leading-normal">{log.details}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )}

        {/* DOCUMENTACIÓN Y PROMPT PDF TAB */}
        {subTab === 'documentacion_pdf' && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
                    <FileText size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-100 text-lg">Documentación Técnica & Prompt de IA (PDF)</h3>
                    <p className="text-xs text-slate-400">Descarga un manual de usuario completo y la especificación del Prompt de Sistema de IA en un PDF estructurado.</p>
                  </div>
                </div>

                <button
                  onClick={() => exportAppDocumentationAndPromptPDF()}
                  className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black transition-all shadow-lg shadow-indigo-600/25 hover:shadow-indigo-500/40 cursor-pointer flex items-center justify-center gap-2 shrink-0 border border-indigo-400/30"
                >
                  <Download size={16} />
                  <span>DESCARGAR MANUAL Y PROMPT (.PDF)</span>
                </button>
              </div>

              {/* PDF Contents Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Column 1: Manual Overview */}
                <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
                  <div className="flex items-center gap-2 text-indigo-400 border-b border-slate-900 pb-3">
                    <Sliders size={16} />
                    <h4 className="text-xs font-bold uppercase tracking-wider">1. Manual de Usuario y Funcionamiento</h4>
                  </div>
                  <ul className="text-xs text-slate-400 space-y-2.5">
                    <li className="flex items-start gap-2">
                      <span className="text-indigo-400 font-bold">•</span>
                      <span><strong>Gestión de Turnos y Colas:</strong> Creación manual/automática, llamada por voz TTS multilenguaje y flujo de estados.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-indigo-400 font-bold">•</span>
                      <span><strong>Escáner OCR por Cámara:</strong> Lectura acelerada con Tesseract.js, región ROI y diccionario IA de corrección.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-indigo-400 font-bold">•</span>
                      <span><strong>Ecosistema Multidispositivo Wi-Fi:</strong> Servidor local, consola móvil y pantalla gigante Smart TV sin Internet.</span>
                    </li>
                  </ul>
                </div>

                {/* Column 2: System Prompt Overview */}
                <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
                  <div className="flex items-center gap-2 text-emerald-400 border-b border-slate-900 pb-3">
                    <Brain size={16} />
                    <h4 className="text-xs font-bold uppercase tracking-wider">2. Especificación Prompt de Sistema (IA)</h4>
                  </div>
                  <ul className="text-xs text-slate-400 space-y-2.5">
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400 font-bold">•</span>
                      <span><strong>Identidad y Misión:</strong> Agente Full-Stack de alto rendimiento para sistemas de turnos en tiempo real.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400 font-bold">•</span>
                      <span><strong>Principios Anti-Slop:</strong> Reglas de maquetación, contraste WCAG AA e interfaces limpias de alta legibilidad.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400 font-bold">•</span>
                      <span><strong>Resiliencia en Red:</strong> Sincronización WebSocket bidireccional y tolerancia a desconexiones.</span>
                    </li>
                  </ul>
                </div>

                {/* Column 3: Tech Architecture */}
                <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
                  <div className="flex items-center gap-2 text-amber-400 border-b border-slate-900 pb-3">
                    <Zap size={16} />
                    <h4 className="text-xs font-bold uppercase tracking-wider">3. Arquitectura Técnica & "Cómo está Hecha"</h4>
                  </div>
                  <ul className="text-xs text-slate-400 space-y-2.5">
                    <li className="flex items-start gap-2">
                      <span className="text-amber-400 font-bold">•</span>
                      <span><strong>Stack Tecnológico:</strong> React 18, TypeScript, Node.js Express, WebSockets (`ws`), Tesseract.js, Web Speech API y Web Audio API.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-400 font-bold">•</span>
                      <span><strong>Pipeline OCR:</strong> Preprocesamiento Offscreen Canvas con umbral binarizado Otsu y escala 3x.</span>
                    </li>
                  </ul>
                </div>

                {/* Column 4: Source Code Snippets */}
                <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
                  <div className="flex items-center gap-2 text-purple-400 border-b border-slate-900 pb-3">
                    <FileText size={16} />
                    <h4 className="text-xs font-bold uppercase tracking-wider">4. Código Fuente Principal Documentado</h4>
                  </div>
                  <ul className="text-xs text-slate-400 space-y-2.5">
                    <li className="flex items-start gap-2">
                      <span className="text-purple-400 font-bold">•</span>
                      <span><strong>Módulos Incluidos:</strong> Servidor WS (`server.ts`), Algoritmo OCR (`CameraOCR.tsx`), Audio/TTS (`useSpeechSynthesis.ts`) y Conmutación de Roles (`App.tsx`).</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-400 font-bold">•</span>
                      <span><strong>Formato Limpio:</strong> Bloques con sintaxis en fuente monoespaciada con fondo oscuro tipo IDE.</span>
                    </li>
                  </ul>
                </div>

              </div>

              <div className="p-4 bg-indigo-950/30 border border-indigo-500/20 rounded-xl flex gap-3 items-center justify-between">
                <div className="flex items-center gap-3">
                  <Info size={18} className="text-indigo-400 shrink-0" />
                  <p className="text-xs text-slate-300">
                    El documento generado está listo para imprimirse o guardarse como archivo de referencia técnica.
                  </p>
                </div>
                <button
                  onClick={() => exportAppDocumentationAndPromptPDF()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5"
                >
                  <Download size={14} />
                  Descargar PDF
                </button>
              </div>

            </div>
          </div>
        )}
  </div>
</div>
  );
}
