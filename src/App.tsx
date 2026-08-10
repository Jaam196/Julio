import React, { useState, useEffect, useRef } from 'react';
import { Ticket, VoiceSettings, ShortcutConfig, AppConfig, MusicConfig, AuthorizedDevice } from './types';
import { musicController } from './utils/musicController';
import {
  initDB,
  dbGetTickets,
  dbSaveTicket,
  dbSaveTicketsBulk,
  dbDeleteTicket,
  dbClearTickets,
  dbGetSettings,
  dbSaveSettings,
} from './utils/db';
import { speakText, playNotificationSound, triggerVibration, formatAnnouncementText } from './utils/audio';
import { buildWsUrl, buildApiUrl } from './utils/urlHelper';

import ManualInput from './components/ManualInput';
import ActiveTicket from './components/ActiveTicket';
import WaitingList from './components/WaitingList';
import RecentHistoryList from './components/RecentHistoryList';
import ReadyList from './components/ReadyList';
import MissingList from './components/MissingList';
import CameraOCR from './components/CameraOCR';
import SettingsPanel from './components/SettingsPanel';
import HistoryPanel from './components/HistoryPanel';
import StatisticsPanel from './components/StatisticsPanel';
import BackgroundMusicPlayer from './components/BackgroundMusicPlayer';
import DevicesPanel from './components/DevicesPanel';
import PublicDisplayView from './components/PublicDisplayView';
import ServerConsoleView from './components/ServerConsoleView';
import TabletDashboardView from './components/TabletDashboardView';

import { LayoutGrid, Camera, History, BarChart2, Settings as SettingsIcon, AlertCircle, Volume2, Keyboard, Play, Check, Trash2, ArrowRightLeft, Smartphone, Tablet, Monitor, Tv, Activity, Wifi, Music, Radio, Brain, Sparkles, Maximize, Minimize, X, Zap, Megaphone, Search, Pause, RotateCcw } from 'lucide-react';
import { matchesShortcut, shouldProcessShortcut, SHORTCUT_NAMES } from './utils/shortcutHelper';
import { AnimatePresence, motion } from 'motion/react';
import { getThemeConfig, applyThemeVariables, findThemeById } from './utils/themeController';
import { useDeviceLayout } from './utils/deviceLayoutController';

const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  lang: 'es',
  voiceURI: '',
  rate: 1.0,
  pitch: 1.0,
  phraseType: 'ticket_numero',
  announcementInterval: 12, // announce every 12 seconds
  soundEnabled: true,
  vibrationEnabled: true,
  repeatPhraseInterval: 3, // full phrase every 3 calls
  customIntro: '',
  customTicketName: '',
  customOutro: '',
  voiceGender: 'all',
  voiceVolume: 100,
};

const DEFAULT_SHORTCUTS: ShortcutConfig = {
  callNext: 'Space',
  markDelivered: 'Enter',
  markMissing: 'KeyM',
  focusInput: 'Escape',
  pauseResumeOcr: 'KeyP',
  activateSelected: 'KeyA',
  pauseResumeWaitlist: 'KeyQ',
};

const DEFAULT_APP_CONFIG: AppConfig = {
  maxOcrSimultaneous: 3,
  theme: 'dark',
  activeGlowColor: '#6366f1',
  waitingSelectedColor: '#4f46e5',
  pendingSelectedColor: '#f59e0b',
  demoteActivePosition: 'start',
  ocrInputMode: 'direct_listos',
  activeSwipeAction: 'pending',
  missingRecoveryAction: 'active',
  publicDisplayTitle: 'ORDER READY',
  publicDisplayMessage: 'Please pick up your order',
  publicDisplayThemePreset: 'black-yellow',
  publicDisplayBg: '#000000',
  publicDisplayTextColor: '#fbbf24',
  publicDisplayTitleColor: '#ffffff',
  publicDisplayShowMessage: true,
  
  // Enhanced defaults:
  publicDisplayBgType: 'color',
  publicDisplayBgImage: '',
  publicDisplayBgVideo: '',
  publicDisplayLogo: '',
  publicDisplayFontFamily: 'space-grotesk',
  publicDisplayNumberSize: 'massive',
  publicDisplayAnimation: 'spring',
  publicDisplayNoTicketsMessage: 'Next ticket in preparation...',
  publicDisplayThemeMode: 'dark',
  publicDisplayLanguage: 'en',
  
  publicDisplayStandbyEnabled: true,
  publicDisplayStandbyImages: [],
  publicDisplayBgVideos: [],
  publicDisplayStandbyDuration: 5,
  publicDisplayStandbyFit: 'cover',
  publicDisplayHideBgOnActive: false,
  publicDisplayDiagnosticEnabled: false,

  publicDisplayMainColor: '#fbbf24',
  publicDisplayListColor: '#ffffff',
  publicDisplayNewColor: '#10b981',
  publicDisplayOldColor: '#94a3b8',
  publicDisplayMaxTickets: 20,
  publicDisplayColumns: 4,
  publicDisplayListNumberSize: 'medium',
  publicDisplayListPosition: 'bottom',
  publicDisplayShowMain: true,
  publicDisplayLayoutMode: 'restaurant-2.0',
};

const DEFAULT_MUSIC_CONFIG: MusicConfig = {
  enabled: true,
  mode: 'duck40',
  autoResume: true,
  infinitePlay: true,
  shuffle: false,
  integratedEnabled: true,
  integratedUrl: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
  integratedVolume: 80,
};

export default function App() {
  // Device layout controller (Independent for PC, Tablet, and Mobile)
  const { deviceType, layoutConfig, isMobile, isTablet, isPC } = useDeviceLayout();

  // Application states
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [announcementCount, setAnnouncementCount] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'board' | 'tablet' | 'ocr' | 'history' | 'stats' | 'settings' | 'devices' | 'tv_view'>(() => {
    if (typeof window === 'undefined') return 'board';
    const devType = window.innerWidth < 768 ? 'mobile' : window.innerWidth < 1024 ? 'tablet' : 'pc';
    const validTabs = ['board', 'tablet', 'ocr', 'history', 'stats', 'settings', 'devices', 'tv_view'];
    
    // 1. Check general saved active mode directly chosen by user
    const saved = localStorage.getItem('activeTab');
    if (saved && validTabs.includes(saved)) {
      return saved as any;
    }

    // 2. Check device-specific saved mode
    const savedForDevice = localStorage.getItem(`activeTab_${devType}`);
    if (savedForDevice && validTabs.includes(savedForDevice)) {
      return savedForDevice as any;
    }

    // 3. Default based on screen type
    if (devType === 'tablet' || devType === 'mobile') {
      return 'tablet';
    }
    return 'board';
  });

  // Automatically remember active mode for the current device whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined' && activeTab) {
      localStorage.setItem('activeTab', activeTab);
      if (deviceType) {
        localStorage.setItem(`activeTab_${deviceType}`, activeTab);
      }
    }
  }, [activeTab, deviceType]);
  const [boardSubTab, setBoardSubTab] = useState<'all' | 'control' | 'waiting' | 'ready' | 'missing' | 'recent'>('all');
  const [isDBReady, setIsDBReady] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isMusicModalOpen, setIsMusicModalOpen] = useState(false);
  const [customTTSInput, setCustomTTSInput] = useState('');
  const [clockTime, setClockTime] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Clock ticker effect
  useEffect(() => {
    const updateClock = () => {
      setClockTime(new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fullscreen handler
  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      console.error('Fullscreen toggle error:', err);
    }
  };

  const [isAutonomousMode, setIsAutonomousMode] = useState<boolean>(() => {
    return localStorage.getItem('isAutonomousMode') === 'true';
  });
  const [isAutoCallActive, setIsAutoCallActive] = useState<boolean>(() => {
    return localStorage.getItem('isAutoCallActive') !== 'false'; // defaults to true
  });

  // Smart TV & URL query parameter auto-detection
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const urlMode = searchParams?.get('mode');
  const urlRole = searchParams?.get('role');
  const urlCode = searchParams?.get('code');
  const isTvUA = typeof navigator !== 'undefined' && /Tizen|SmartTV|SMART-TV|SamsungBrowser|HbbTV|WebOS|webOS|NetCast|BRAVIA|MiTV|AFTB|FireTV|Vidaa|Hisense|Large Screen|CrKey/i.test(navigator.userAgent);

  // Client-Server and WebSocket states
  const [deviceMode, setDeviceMode] = useState<'local' | 'server' | 'client'>(() => {
    if (urlMode === 'public_display' || urlMode === 'client' || urlRole === 'pantalla' || isTvUA) {
      return 'client';
    }
    return (localStorage.getItem('deviceMode') as any) || 'local';
  });
  const [clientRole, setClientRole] = useState<'controller' | 'pantalla'>(() => {
    if (urlRole === 'pantalla' || urlMode === 'public_display' || isTvUA) {
      return 'pantalla';
    }
    return (localStorage.getItem('clientRole') as any) || 'controller';
  });
  const [forcePCManualMode, setForcePCManualMode] = useState<boolean>(false);
  const [serverLogs, setServerLogs] = useState<{ id: string; timestamp: string; message: string; type: 'info' | 'success' | 'warn' | 'error' }[]>([]);

  const addServerLog = (message: string, type: 'info' | 'success' | 'warn' | 'error' = 'info') => {
    const time = new Date().toLocaleTimeString();
    setServerLogs(prev => [
      { id: String(Date.now() + Math.random()), timestamp: time, message, type },
      ...prev.slice(0, 99)
    ]);
  };

  const [pairingCode, setPairingCode] = useState<string>(() => {
    if (urlCode) return urlCode;
    return localStorage.getItem('pairedCode') || '';
  });
  const [pairingStatus, setPairingStatus] = useState<'unpaired' | 'pairing' | 'paired' | 'failed' | 'searching'>('unpaired');
  const [deviceName, setDeviceName] = useState<string>(() => {
    return localStorage.getItem('deviceName') || 'Tablet ' + Math.floor(100 + Math.random() * 900);
  });
  const [serverIP, setServerIP] = useState<string>(() => {
    return localStorage.getItem('serverIP') || window.location.host;
  });
  const [connectedClients, setConnectedClients] = useState<{ id: string; name: string; connected: boolean; type?: string }[]>([]);
  const [authorizedDevices, setAuthorizedDevices] = useState<AuthorizedDevice[]>(() => {
    const saved = localStorage.getItem('authorizedDevices');
    return saved ? JSON.parse(saved) : [];
  });
  const [pendingAuthRequests, setPendingAuthRequests] = useState<{ deviceId: string; deviceName: string; deviceType: string }[]>([]);
  const [deauthorizedDeviceIds, setDeauthorizedDeviceIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('deauthorizedDeviceIds');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [availableRooms, setAvailableRooms] = useState<{ code: string; serverName: string; clientsCount: number }[]>([]);
  const [lastConnectionError, setLastConnectionError] = useState<string>('');

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);
  const lastMessageReceivedTimeRef = useRef<number>(Date.now());
  const connectionStartTimeRef = useRef<number>(0);
  const syncVersionRef = useRef<number>(1);

  // Initial theme application and listener on boot
  const [activeThemeId, setActiveThemeId] = useState<string>(() => {
    const themeCfg = getThemeConfig();
    return themeCfg.activeThemeId;
  });

  useEffect(() => {
    const applyInitial = () => {
      const themeCfg = getThemeConfig();
      const activeT = findThemeById(themeCfg.activeThemeId, themeCfg.customThemes);
      applyThemeVariables(activeT);
      setActiveThemeId(themeCfg.activeThemeId);
    };

    applyInitial();

    const handleThemeEvent = (e: Event) => {
      const customEv = e as CustomEvent;
      if (customEv.detail) {
        applyThemeVariables(customEv.detail);
        if (customEv.detail.id) setActiveThemeId(customEv.detail.id);
      } else {
        applyInitial();
      }
    };

    window.addEventListener('app-theme-changed', handleThemeEvent);
    return () => {
      window.removeEventListener('app-theme-changed', handleThemeEvent);
    };
  }, []);

  // Client diagnostic states
  const [syncVersion, setSyncVersion] = useState<number>(1);
  const [lastSyncTime, setLastSyncTime] = useState<string>('Nunca');
  const [lastLatency, setLastLatency] = useState<number | null>(null);
  const [lastReceivedEvent, setLastReceivedEvent] = useState<string>('Ninguno');

  // Get or Create Unique Client ID
  const getOrCreateDeviceId = () => {
    let id = localStorage.getItem('deviceId');
    if (!id) {
      id = crypto.randomUUID ? crypto.randomUUID() : String(Math.floor(Date.now() + Math.random() * 1000000));
      localStorage.setItem('deviceId', id);
    }
    return id;
  };

  // Controlled OCR pause state
  const [isOcrPaused, setIsOcrPaused] = useState(false);

  // Controlled Waitlist pause state
  const [isWaitlistPaused, setIsWaitlistPaused] = useState(false);

  // Modo Servicio State (Hides non-essential UI during active service)
  const [isServiceMode, setIsServiceMode] = useState<boolean>(() => {
    return localStorage.getItem('isServiceMode') === 'true';
  });

  // Keyboard navigation & highlight state for the waiting queue
  const [selectedWaitingTicketId, setSelectedWaitingTicketId] = useState<string | null>(null);

  // Keyboard navigation & highlight state for the pending list
  const [selectedPendingTicketId, setSelectedPendingTicketId] = useState<string | null>(null);

  // Keyboard navigation & highlight state for the missing list
  const [selectedMissingTicketId, setSelectedMissingTicketId] = useState<string | null>(null);

  // Keyboard navigation & highlight state for the ready list
  const [selectedReadyTicketId, setSelectedReadyTicketId] = useState<string | null>(null);

  // Track the last focused list to route Arrow keys and Enter
  const [lastFocusedList, setLastFocusedList] = useState<'waiting' | 'pending' | 'missing' | 'ready'>('waiting');

  // Triggered when OCR detects a ticket that exists in Pending
  const [ocrPendingPrompt, setOcrPendingPrompt] = useState<{
    number: string;
    ticketId: string;
  } | null>(null);

  // Beautiful floating transition notification for moving tickets
  const [transitionNotification, setTransitionNotification] = useState<{
    number: string;
    type: 'pending' | 'active' | 'delivered' | 'missing';
    id: number;
  } | null>(null);

  // Custom right-click context menu overlay state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    ticketId: string;
  } | null>(null);

  // Visual shortcut notification toast state
  const [shortcutNotification, setShortcutNotification] = useState<{
    action: string;
    key: string;
    id: number;
  } | null>(null);

  // Config saved confirmation toast state
  const [configSavedToast, setConfigSavedToast] = useState<string | null>(null);

  const triggerConfigSavedToast = (message: string) => {
    setConfigSavedToast(message);
    const id = setTimeout(() => {
      setConfigSavedToast(null);
    }, 2000);
  };

  // Configuration states
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>(DEFAULT_VOICE_SETTINGS);
  const [shortcutConfig, setShortcutConfig] = useState<ShortcutConfig>(DEFAULT_SHORTCUTS);
  const [appConfig, setAppConfig] = useState<AppConfig>(DEFAULT_APP_CONFIG);
  const [musicConfig, setMusicConfig] = useState<MusicConfig>(DEFAULT_MUSIC_CONFIG);

  // Refs for tracking announcement timers and background loops
  const announcementTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isSpeakingRef = useRef(false);
  const speechQueueRef = useRef<Ticket[]>([]);
  const announcedTicketIdsRef = useRef<Set<string>>(new Set());
  const voiceSettingsRef = useRef<VoiceSettings>(voiceSettings);
  const announcementCountRef = useRef<number>(announcementCount);
  const activeTicketRef = useRef<Ticket | null>(activeTicket);
  
  const ticketsRef = useRef<Ticket[]>(tickets);
  const selectedWaitingTicketIdRef = useRef<string | null>(null);
  const selectedPendingTicketIdRef = useRef<string | null>(null);
  const selectedMissingTicketIdRef = useRef<string | null>(null);
  const lastFocusedListRef = useRef<'waiting' | 'pending' | 'missing'>('waiting');

  const authorizedDevicesRef = useRef(authorizedDevices);
  const deauthorizedDeviceIdsRef = useRef(deauthorizedDeviceIds);
  const deviceNameRef = useRef(deviceName);
  const handleRemoteActionRef = useRef<any>(null);
  const appConfigRef = useRef<AppConfig>(appConfig);
  const musicConfigRef = useRef<MusicConfig>(musicConfig);
  const isWaitlistPausedRef = useRef<boolean>(isWaitlistPaused);

  // Connection management and offline sync queue refs
  const reconnectAttemptsRef = useRef<number>(0);
  const heartbeatIntervalRef = useRef<any>(null);
  const pendingActionsRef = useRef<{ action: string; payload: any }[]>([]);

  // Sync refs to avoid closures in setInterval and global listeners
  useEffect(() => {
    authorizedDevicesRef.current = authorizedDevices;
    localStorage.setItem('authorizedDevices', JSON.stringify(authorizedDevices));
  }, [authorizedDevices]);

  useEffect(() => {
    deauthorizedDeviceIdsRef.current = deauthorizedDeviceIds;
  }, [deauthorizedDeviceIds]);

  useEffect(() => {
    deviceNameRef.current = deviceName;
  }, [deviceName]);

  useEffect(() => {
    appConfigRef.current = appConfig;
  }, [appConfig]);

  useEffect(() => {
    musicConfigRef.current = musicConfig;
  }, [musicConfig]);

  useEffect(() => {
    isWaitlistPausedRef.current = isWaitlistPaused;
  }, [isWaitlistPaused]);

  useEffect(() => {
    voiceSettingsRef.current = voiceSettings;
  }, [voiceSettings]);

  useEffect(() => {
    announcementCountRef.current = announcementCount;
  }, [announcementCount]);

  useEffect(() => {
    activeTicketRef.current = activeTicket;
  }, [activeTicket]);

  useEffect(() => {
    ticketsRef.current = tickets;
  }, [tickets]);

  useEffect(() => {
    selectedWaitingTicketIdRef.current = selectedWaitingTicketId;
  }, [selectedWaitingTicketId]);

  useEffect(() => {
    selectedPendingTicketIdRef.current = selectedPendingTicketId;
  }, [selectedPendingTicketId]);

  useEffect(() => {
    selectedMissingTicketIdRef.current = selectedMissingTicketId;
  }, [selectedMissingTicketId]);

  useEffect(() => {
    lastFocusedListRef.current = lastFocusedList;
  }, [lastFocusedList]);

  // Keep selectedWaitingTicketId valid based on the active tickets queue
  useEffect(() => {
    const waitingList = tickets.filter((t) => t.status === 'waiting');
    if (waitingList.length === 0) {
      setSelectedWaitingTicketId(null);
    } else if (!selectedWaitingTicketId || !waitingList.some((t) => t.id === selectedWaitingTicketId)) {
      setSelectedWaitingTicketId(waitingList[0].id);
    }
  }, [tickets, selectedWaitingTicketId]);

  // Keep selectedPendingTicketId valid based on the pending queue
  useEffect(() => {
    const pendingList = tickets.filter((t) => t.status === 'pending');
    if (pendingList.length === 0) {
      setSelectedPendingTicketId(null);
    } else if (!selectedPendingTicketId || !pendingList.some((t) => t.id === selectedPendingTicketId)) {
      setSelectedPendingTicketId(pendingList[0].id);
    }
  }, [tickets, selectedPendingTicketId]);

  // Keep selectedMissingTicketId valid based on the missing queue
  useEffect(() => {
    const missingList = tickets.filter((t) => t.status === 'missing');
    if (missingList.length === 0) {
      setSelectedMissingTicketId(null);
    } else if (!selectedMissingTicketId || !missingList.some((t) => t.id === selectedMissingTicketId)) {
      setSelectedMissingTicketId(missingList[0].id);
    }
  }, [tickets, selectedMissingTicketId]);

  // Auto-dismiss transition notification after 2 seconds
  useEffect(() => {
    if (!transitionNotification) return;
    const timer = setTimeout(() => {
      setTransitionNotification(null);
    }, 2000);
    return () => clearTimeout(timer);
  }, [transitionNotification]);

  // Handle outside click to close context menu
  useEffect(() => {
    const handleOutsideClick = () => {
      setContextMenu(null);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => {
      window.removeEventListener('click', handleOutsideClick);
    };
  }, []);

  // Force cursor refocus automatically back to the fast-ticket-input (cuadro verde)
  const forceRefocusInput = () => {
    setTimeout(() => {
      const input = document.getElementById('fast-ticket-input');
      if (input) {
        (input as HTMLInputElement).focus();
      }
    }, 50);
  };

  const uploadAllMediaToServer = async (roomCode: string) => {
    try {
      const mediaKeys = ['bg_video', 'bg_image', 'logo'];
      for (const key of mediaKeys) {
        const stored = await dbGetSettings<string | Blob>('media_' + key);
        if (stored) {
          let blobToUpload: Blob | null = null;
          let mimeType: string = '';

          if (stored instanceof Blob) {
            blobToUpload = stored;
            mimeType = stored.type;
          } else if (typeof stored === 'string') {
            if (stored.startsWith('data:')) {
              if (stored.length > 10 * 1024 * 1024) {
                console.warn(`[Media Sync] skipping '${key}' because base64 data URI is too large. Please re-upload.`);
                continue;
              }
              try {
                const parts = stored.split(',');
                const byteString = atob(parts[1]);
                mimeType = parts[0].split(':')[1].split(';')[0];
                const ab = new ArrayBuffer(byteString.length);
                const ia = new Uint8Array(ab);
                for (let i = 0; i < byteString.length; i++) {
                  ia[i] = byteString.charCodeAt(i);
                }
                blobToUpload = new Blob([ab], { type: mimeType });
              } catch (e) {
                console.error('Error converting stored data URI to Blob for upload:', e);
              }
            }
          }

          if (blobToUpload) {
            console.log(`[Media Sync] Uploading media '${key}' as raw binary (${mimeType}) to HTTP server for room '${roomCode}'...`);
            const response = await fetch(`/api/media/${roomCode}/${key}`, {
              method: 'POST',
              headers: { 
                'Content-Type': mimeType || 'application/octet-stream'
              },
              body: blobToUpload,
            });
            if (response.ok) {
              console.log(`[Media Sync] '${key}' uploaded successfully!`);
            } else {
              console.warn(`[Media Sync] Failed to upload media '${key}':`, response.statusText);
            }
          }
        }
      }

      // Upload background video playlist items if present
      const savedAppConfig = await dbGetSettings<AppConfig>('app_config');
      if (savedAppConfig && savedAppConfig.publicDisplayBgVideos && Array.isArray(savedAppConfig.publicDisplayBgVideos)) {
        for (const vid of savedAppConfig.publicDisplayBgVideos) {
          const key = `bg_video_${vid.id}`;
          const stored = await dbGetSettings<string | Blob>('media_' + key);
          if (stored) {
            let blobToUpload: Blob | null = null;
            let mimeType: string = '';

            if (stored instanceof Blob) {
              blobToUpload = stored;
              mimeType = stored.type;
            } else if (typeof stored === 'string') {
              if (stored.startsWith('data:')) {
                if (stored.length > 10 * 1024 * 1024) continue;
                try {
                  const parts = stored.split(',');
                  const byteString = atob(parts[1]);
                  mimeType = parts[0].split(':')[1].split(';')[0];
                  const ab = new ArrayBuffer(byteString.length);
                  const ia = new Uint8Array(ab);
                  for (let i = 0; i < byteString.length; i++) {
                    ia[i] = byteString.charCodeAt(i);
                  }
                  blobToUpload = new Blob([ab], { type: mimeType });
                } catch (e) {
                  console.error('Error converting playlist video to Blob for upload:', e);
                }
              }
            }

            if (blobToUpload) {
              console.log(`[Media Sync] Uploading background playlist video '${vid.id}' to HTTP server...`);
              await fetch(`/api/media/${roomCode}/${key}`, {
                method: 'POST',
                headers: { 'Content-Type': mimeType || 'video/mp4' },
                body: blobToUpload,
              });
            }
          }
        }
      }

      // Also upload standby images if they exist
      if (savedAppConfig && savedAppConfig.publicDisplayStandbyImages && Array.isArray(savedAppConfig.publicDisplayStandbyImages)) {
        for (const img of savedAppConfig.publicDisplayStandbyImages) {
          const key = `standby_image_${img.id}`;
          const stored = await dbGetSettings<string | Blob>('media_' + key);
          if (stored) {
            let blobToUpload: Blob | null = null;
            let mimeType: string = '';

            if (stored instanceof Blob) {
              blobToUpload = stored;
              mimeType = stored.type;
            } else if (typeof stored === 'string') {
              if (stored.startsWith('data:')) {
                if (stored.length > 10 * 1024 * 1024) {
                  console.warn(`[Media Sync] skipping standby image because base64 data URI is too large.`);
                  continue;
                }
                try {
                  const parts = stored.split(',');
                  const byteString = atob(parts[1]);
                  mimeType = parts[0].split(':')[1].split(';')[0];
                  const ab = new ArrayBuffer(byteString.length);
                  const ia = new Uint8Array(ab);
                  for (let i = 0; i < byteString.length; i++) {
                    ia[i] = byteString.charCodeAt(i);
                  }
                  blobToUpload = new Blob([ab], { type: mimeType });
                } catch (e) {
                  console.error('Error converting stored standby image to Blob for upload:', e);
                }
              }
            }

            if (blobToUpload) {
              console.log(`[Media Sync] Uploading standby image '${img.id}' as raw binary (${mimeType}) to HTTP server...`);
              await fetch(`/api/media/${roomCode}/${key}`, {
                method: 'POST',
                headers: { 
                  'Content-Type': mimeType || 'application/octet-stream'
                },
                body: blobToUpload,
              });
            }
          }
        }
      }
    } catch (err) {
      console.error('[Media Sync] Error in uploadAllMediaToServer:', err);
    }
  };

  // Client-Server actions and WebSocket management
  const connectWebSocket = (mode: 'server' | 'client', code: string, ip: string, isManual = false) => {
    connectionStartTimeRef.current = Date.now();
    if (socketRef.current) {
      const isSameHost = socketRef.current.url.includes(ip);
      if (!isManual && isSameHost && (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING)) {
        console.log('WebSocket is already active or connecting. Skipping redundant connect attempt.');
        return;
      }
      try {
        console.log('Closing existing WebSocket to force clean connection/pairing...');
        socketRef.current.close();
      } catch (e) {}
      socketRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    setPairingStatus('searching');
    if (mode === 'client') {
      setPairingCode(code);
    }

    const socketHost = mode === 'server' ? window.location.host : ip;
    const wsUrl = buildWsUrl(socketHost);

    console.log(`Connecting to WebSocket at ${wsUrl}`);
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      lastMessageReceivedTimeRef.current = Date.now();
      reconnectAttemptsRef.current = 0; // Reset connection attempts on successful connection

      // Setup keep-alive heartbeat interval to prevent idle disconnections (especially on TVs)
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      heartbeatIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(JSON.stringify({ type: 'ping' }));
          } catch (e) {}
        }
      }, 15000);

      if (mode === 'server') {
        const savedCode = localStorage.getItem('pairedCode') || '';
        ws.send(JSON.stringify({ type: 'register_server', code: savedCode, serverName: 'PC Servidor Principal' }));
      } else {
        ws.send(JSON.stringify({
          type: 'register_client',
          code,
          deviceId: getOrCreateDeviceId(),
          deviceName: deviceNameRef.current,
          deviceType: clientRole === 'pantalla' ? 'Pantalla Pública' : 'Cliente de Control',
          isManual,
        }));

        // Flush offline action queue if returning online
        if (pendingActionsRef.current.length > 0) {
          console.log(`[Offline Sync Queue] Connection restored! Flushing ${pendingActionsRef.current.length} queued action(s)...`);
          pendingActionsRef.current.forEach((item) => {
            try {
              ws.send(JSON.stringify({
                type: 'client_action',
                action: item.action,
                payload: item.payload,
                deviceName: deviceNameRef.current,
              }));
            } catch (e) {
              console.error('[Offline Sync Queue] Failed to flush action:', item.action, e);
            }
          });
          pendingActionsRef.current = [];
          triggerConfigSavedToast('¡Conexión recuperada! Cambios sincronizados.');
        }
      }
    };

    ws.onmessage = async (event) => {
      try {
        lastMessageReceivedTimeRef.current = Date.now();
        const data = JSON.parse(event.data);
        console.log('WebSocket message received:', data);

        if (mode === 'client') {
          setLastReceivedEvent(data.type || 'unknown');
          setLastSyncTime(new Date().toLocaleTimeString());
        }

        if (data.type === 'pong') {
          return;
        }

        if (data.type === 'server_registered') {
          setPairingCode(data.code);
          localStorage.setItem('pairedCode', data.code);
          setPairingStatus('paired');
          if (mode === 'server') {
            addServerLog(`Servidor registrado con éxito. Código de sala local: ${data.code}`, 'success');
            uploadAllMediaToServer(data.code);
          }
        }

        else if (data.type === 'pairing_success') {
          setPairingCode(data.code);
          localStorage.setItem('pairedCode', data.code);
          setPairingStatus('paired');
          setServerIP(ip);
          localStorage.setItem('serverIP', ip);
          setLastConnectionError('');
          if (clientRole === 'controller') {
            setActiveTab(prevTab => {
              if (prevTab === 'devices') {
                const saved = localStorage.getItem('activeTab');
                return (saved && saved !== 'devices' && ['board', 'tablet', 'ocr', 'history', 'stats', 'settings', 'devices', 'tv_view'].includes(saved)) 
                  ? (saved as any) 
                  : 'board';
              }
              return prevTab;
            });
          }
        }

        else if (data.type === 'pairing_failed') {
          setPairingStatus('failed');
          setLastConnectionError(data.reason || 'Código incorrecto o vencido');
          triggerConfigSavedToast(`Error de emparejamiento: ${data.reason}`);
          if (mode === 'server') {
            addServerLog(`Error de vinculación: ${data.reason}`, 'error');
          } else {
            const isTvScreen = isTvUA || clientRole === 'pantalla' || activeTab === 'tv_view' || urlRole === 'pantalla' || urlMode === 'public_display';
            if (isTvScreen || mode === 'client') {
              console.log('[Auto-Reconnect] Pairing failed. Clearing stale code to trigger room auto-discovery...');
              localStorage.removeItem('pairedCode');
              setPairingCode('');
            }
            try {
              ws.close();
            } catch (e) {}
          }
        }

        else if (data.type === 'client_connection_request') {
          const existingDevice = authorizedDevicesRef.current.find(d => d.id === data.deviceId);
          const isPublicDisplay = data.deviceType === 'Pantalla Pública' || 
                                  data.deviceType === 'pantalla' || 
                                  (data.deviceName && (data.deviceName.toLowerCase().includes('pantalla') || data.deviceName.toLowerCase().includes('tv')));

          if (existingDevice) {
            if (existingDevice.status === 'blocked') {
              ws.send(JSON.stringify({
                type: 'auth_decision',
                deviceId: data.deviceId,
                approved: false,
                deviceName: data.deviceName,
                deviceType: data.deviceType,
              }));
              if (mode === 'server') {
                addServerLog(`Intento de conexión rechazado automáticamente para dispositivo BLOQUEADO: "${data.deviceName}"`, 'warn');
              }
            } else {
              ws.send(JSON.stringify({
                type: 'auth_decision',
                deviceId: data.deviceId,
                approved: true,
                remember: existingDevice.remember,
                deviceName: data.deviceName,
                deviceType: data.deviceType,
              }));
              setAuthorizedDevices(prev => prev.map(d => d.id === data.deviceId ? {
                ...d,
                lastConnected: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
              } : d));
            }
          } else if (isPublicDisplay || appConfigRef.current?.autoApprovePublicDisplays) {
            // Auto-authorize Public Display TV screens so they connect instantly without manual popup!
            const newDevice = {
              id: data.deviceId,
              name: data.deviceName || 'Pantalla TV Pública',
              type: data.deviceType || 'Pantalla Pública',
              status: 'authorized' as const,
              remember: true,
              lastConnected: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
            };
            setAuthorizedDevices(prev => {
              if (prev.some(d => d.id === data.deviceId)) return prev;
              return [...prev, newDevice];
            });
            ws.send(JSON.stringify({
              type: 'auth_decision',
              deviceId: data.deviceId,
              approved: true,
              remember: true,
              deviceName: data.deviceName,
              deviceType: data.deviceType || 'Pantalla Pública',
            }));
            if (mode === 'server') {
              addServerLog(`Pantalla Pública "${data.deviceName}" autorizada y vinculada automáticamente.`, 'success');
            }
          } else {
            setPendingAuthRequests(prev => {
              if (prev.some(r => r.deviceId === data.deviceId)) return prev;
              return [...prev, { deviceId: data.deviceId, deviceName: data.deviceName, deviceType: data.deviceType }];
            });
            if (mode === 'server') {
              addServerLog(`Nueva solicitud de conexión de: "${data.deviceName}" (${data.deviceType})`, 'info');
            }
          }
        }

        else if (data.type === 'client_joined') {
          setAuthorizedDevices(prev => {
            const exists = prev.some(d => d.id === data.deviceId);
            const newDevice = {
              id: data.deviceId,
              name: data.deviceName,
              type: data.deviceType || 'Tablet',
              status: 'authorized' as const,
              remember: data.remember || false,
              lastConnected: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
            };
            if (exists) {
              return prev.map(d => d.id === data.deviceId ? newDevice : d);
            }
            return [...prev, newDevice];
          });

          setConnectedClients(prev => {
            const exists = prev.some(c => c.id === data.deviceId);
            if (exists) {
              return prev.map(c => c.id === data.deviceId ? { ...c, name: data.deviceName, connected: true, type: data.deviceType } : c);
            }
            return [...prev, { id: data.deviceId, name: data.deviceName, connected: true, type: data.deviceType }];
          });

          if (mode === 'server') {
            addServerLog(`Dispositivo "${data.deviceName}" (${data.deviceType || 'Tablet'}) se ha conectado al Servidor.`, 'success');
            
            // Immediately push current server state to this specific reconnected client
            const statePayload = {
              type: 'sync_state',
              tickets: ticketsRef.current,
              activeTicket: activeTicketRef.current,
              announcementCount: announcementCountRef.current,
              appConfig: appConfigRef.current,
              voiceSettings: voiceSettingsRef.current,
              musicConfig: musicConfigRef.current,
              isWaitlistPaused: isWaitlistPausedRef.current,
            };
            
            ws.send(JSON.stringify({
              type: 'send_to_client',
              deviceId: data.deviceId,
              payload: statePayload
            }));
            console.log(`[Sync] Sent immediate full-state synchronization to newly reconnected client: "${data.deviceName}" (${data.deviceId})`);
          }
        }

        else if (data.type === 'client_left') {
          setConnectedClients(prev => {
            const clientObj = prev.find(c => c.id === data.deviceId);
            if (clientObj && mode === 'server') {
              addServerLog(`Dispositivo "${clientObj.name}" se ha desconectado de la red local.`, 'warn');
            }
            return prev.map(c => c.id === data.deviceId ? { ...c, connected: false } : c);
          });
        }

        else if (data.type === 'media_response') {
          await dbSaveSettings('media_' + data.mediaKey, data.data);
          window.dispatchEvent(new CustomEvent('media-updated', { detail: { key: data.mediaKey } }));
        }

        else if (data.type === 'media_updated') {
          console.log(`[Media Sync] Real-time video update event received for key: ${data.key}`);
          window.dispatchEvent(new CustomEvent('media-updated', { detail: { key: data.key } }));
        }

        else if (data.type === 'sync_state') {
          if (mode === 'client') {
            const prevActiveId = activeTicketRef.current?.id;
            const newActive = data.activeTicket;

            setTickets(data.tickets);
            setActiveTicket(newActive);
            setAnnouncementCount(data.announcementCount);
            setAppConfig(data.appConfig);
            setVoiceSettings(data.voiceSettings);
            setMusicConfig(data.musicConfig);
            setIsWaitlistPaused(data.isWaitlistPaused ?? false);
            setPairingStatus('paired');

            setSyncVersion(data.syncVersion ?? 0);
            if (data.timestamp) {
              setLastLatency(Math.max(0, Date.now() - data.timestamp));
            }

            // Play loud bell chime and vocalize new ticket when active ticket changes on TV / client
            if (newActive && newActive.id !== prevActiveId) {
              const vs = data.voiceSettings || voiceSettingsRef.current;
              if (vs.soundEnabled !== false) {
                playNotificationSound();
              }
              if (vs.voiceEnabled !== false) {
                const msgText = formatAnnouncementText(newActive.number, vs, data.announcementCount || 1);
                speakText(msgText, vs);
              }
            }

            // Persist locally for TV recovery!
            try {
              if (data.tickets) {
                // Clear and save to indexedDB
                dbClearTickets('all').then(() => {
                  dbSaveTicketsBulk(data.tickets);
                }).catch(err => console.error('[Client Persist] Clear tickets error:', err));
              }
              if (data.appConfig) {
                dbSaveSettings('app_config', data.appConfig);
              }
              if (data.voiceSettings) {
                dbSaveSettings('voice_settings', data.voiceSettings);
              }
              if (data.musicConfig) {
                dbSaveSettings('music_settings', data.musicConfig);
              }
            } catch (err) {
              console.error('Failed to persist synced state locally:', err);
            }
          }
        }

        else if (data.type === 'deauthorized') {
          ws.close();
          setDeviceMode('local');
          localStorage.setItem('deviceMode', 'local');
          setPairingStatus('unpaired');
          triggerConfigSavedToast('Tu tablet ha sido desvinculada por el PC Servidor.');
        }

        else if (data.type === 'rename') {
          setDeviceName(data.name);
          localStorage.setItem('deviceName', data.name);
        }

        else if (data.type === 'server_disconnected') {
          setPairingStatus('failed');
          if (mode === 'client') {
            console.log('Server disconnected. Reconnecting in 1 second...');
            reconnectTimeoutRef.current = setTimeout(() => {
              connectWebSocket('client', code, ip);
            }, 1000);
          }
        }

        else if (data.type === 'client_action') {
          if (mode === 'server') {
            if (mode === 'server') {
              const clientName = data.deviceName || 'Tablet Remota';
              let actionName = data.action;
              if (data.action === 'add_ticket') actionName = `Crear Ticket #${data.payload?.number}`;
              else if (data.action === 'call_next') actionName = `Llamar siguiente ticket`;
              else if (data.action === 'mark_delivered') actionName = `Entregar ticket actual`;
              else if (data.action === 'mark_pending') actionName = `Pausar ticket actual`;
              else if (data.action === 'mark_missing') actionName = `Marcar ticket como desaparecido`;
              else if (data.action === 'repeat_call') actionName = `Repetir llamada vocal`;
              else if (data.action === 'activate_from_pause') actionName = `Reactivar ticket desde pausa`;
              else if (data.action === 'activate_from_missing') actionName = `Recuperar ticket de perdidos`;
              else if (data.action === 'delete_ticket') actionName = `Eliminar ticket`;
              else if (data.action === 'toggle_waitlist_pause') actionName = `Alternar pausa de lista de espera`;
              addServerLog(`Comando [${actionName}] recibido de "${clientName}" y ejecutado.`, 'info');
            }
            if (handleRemoteActionRef.current) {
              handleRemoteActionRef.current(data.action, data.payload, data.deviceId, data.deviceName);
            }
          }
        }
      } catch (err) {
        console.warn('Error processing websocket message:', err);
      }
    };

    ws.onclose = (event) => {
      console.log('WebSocket closed with code:', event.code);
      setPairingStatus('failed');

      // Clear heartbeat interval to prevent timer leaks
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }

      if (!event.wasClean) {
        setLastConnectionError(`Conexión perdida o interrumpida de forma inesperada (Código: ${event.code})`);
      } else {
        setLastConnectionError('Conexión cerrada.');
      }
      
      // Auto reconnect with continuous 1-second frequency for screens & clients
      reconnectAttemptsRef.current += 1;
      const isTvScreen = isTvUA || clientRole === 'pantalla' || activeTab === 'tv_view' || urlRole === 'pantalla' || urlMode === 'public_display';
      const isClientOrTVMode = mode === 'client' || isTvScreen;
      const nextDelay = isClientOrTVMode ? 1000 : Math.min(reconnectAttemptsRef.current * 1000, 5000);

      console.log(`[WS Reconnect] Lost connection. Reconnecting in ${nextDelay / 1000}s (Attempt ${reconnectAttemptsRef.current})...`);

      reconnectTimeoutRef.current = setTimeout(() => {
        let m = localStorage.getItem('deviceMode') || (isClientOrTVMode ? 'client' : 'local');
        if (isClientOrTVMode) {
          m = 'client';
          localStorage.setItem('deviceMode', 'client');
        }
        if (m && m !== 'local') {
          const c = localStorage.getItem('pairedCode') || pairingCode || '';
          const i = localStorage.getItem('serverIP') || serverIP || window.location.host;
          connectWebSocket(m as 'server' | 'client', c, i);
        }
      }, nextDelay);
    };

    ws.onerror = (err) => {
      console.warn('WebSocket connection error (this is normal during setup or local scanning):', err);
      setLastConnectionError('No se pudo establecer conexión. Verifique la IP o el código de sala.');
      setPairingStatus('failed');
      try {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close();
        }
      } catch (e) {}
    };
  };

  const sendClientAction = (action: string, payload: any = {}) => {
    if (deviceMode === 'client') {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({
          type: 'client_action',
          action,
          payload,
          deviceName,
        }));
        return true; // Action routed remotely, skip local state updates
      } else {
        // Queue the action while offline to prevent data loss!
        pendingActionsRef.current.push({ action, payload });
        console.log(`[Offline Sync Queue] Queued action '${action}' while disconnected.`, payload);
        triggerConfigSavedToast('Dispositivo sin conexión. Los cambios se enviarán al reconectar.');
        return true; // Prevent local state update on read-only client until server responds
      }
    }
    return false; // Run locally
  };

  const handleSendMediaToClient = async (mediaKey: string, deviceId: string) => {
    try {
      const stored = await dbGetSettings<string | Blob>('media_' + mediaKey);
      if (stored) {
        let sendData: string = '';
        if (stored instanceof Blob) {
          sendData = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(stored);
          });
        } else if (typeof stored === 'string') {
          sendData = stored;
        } else {
          console.warn('Unknown media type in DB:', typeof stored);
          return;
        }

        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({
            type: 'send_to_client',
            deviceId,
            payload: {
              type: 'media_response',
              mediaKey,
              data: sendData
            }
          }));
        }
      }
    } catch (e) {
      console.error('Error sending media to client:', e);
    }
  };

  const handleRemoteAction = (action: string, payload: any, deviceId?: string, clientName?: string) => {
    console.log(`Executing remote client action: ${action}`, payload);
    switch (action) {
      case 'request_media':
        if (deviceId) {
          handleSendMediaToClient(payload.mediaKey, deviceId);
        }
        break;
      case 'add_ticket':
        handleAddTicket(payload.number, payload.fromOcr, payload.createdByDevice || clientName);
        break;
      case 'add_direct_waiting':
        handleAddDirectWaitingTicket(payload.number, payload.createdByDevice || clientName);
        break;
      case 'add_direct_pending':
        handleAddDirectPendingTicket(payload.number, payload.createdByDevice || clientName);
        break;
      case 'mark_delivered':
        handleMarkDelivered(payload.id);
        break;
      case 'mark_pending':
        handleMarkPending(payload.id);
        break;
      case 'move_to_pending':
        handleMoveToPending(payload.id);
        break;
      case 'mark_missing':
        handleMarkMissing(payload.id);
        break;
      case 'activate_from_pause':
        handleActivateFromPause(payload.id);
        break;
      case 'activate_from_missing':
        handleActivateFromMissing(payload.id);
        break;
      case 'return_to_waiting_from_missing':
        handleReturnToWaitingFromMissing(payload.id);
        break;
      case 'delete_ticket':
        handleDeleteTicket(payload.id);
        break;
      case 'raise_priority':
        handleRaisePriority(payload.id);
        break;
      case 'toggle_priority':
        handleTogglePriority(payload.id);
        break;
      case 'call_next':
        handleCallNext();
        break;
      case 'repeat_call':
        handleRepeatCall();
        break;
      case 'call_ticket_now':
        handleCallTicketNow(payload.id);
        break;
      case 'add_direct_waiting':
        handleAddDirectWaitingTicket(payload.number);
        break;
      case 'add_direct_pending':
        handleAddDirectPendingTicket(payload.number);
        break;
      case 'return_to_waiting':
        handleReturnToWaiting(payload.id);
        break;
      case 'restore_ticket':
        handleRestoreTicket(payload.id);
        break;
      case 'deliver_from_pause':
        handleDeliverFromPause(payload.id);
        break;
      case 'toggle_waitlist_pause':
        handleToggleWaitlistPause();
        break;
      case 'save_voice_settings':
        handleSaveVoiceSettings(payload.settings);
        break;
      case 'save_shortcut_config':
        handleSaveShortcutConfig(payload.shortcuts);
        break;
      case 'save_app_config':
        handleSaveAppConfig(payload.config);
        break;
      case 'save_music_config':
        handleSaveMusicConfig(payload.config);
        break;
      default:
        console.warn(`Unknown remote action: ${action}`);
    }
  };

  handleRemoteActionRef.current = handleRemoteAction;

  const handleSelectMode = (mode: 'local' | 'server' | 'mobile_control' | 'public_display') => {
    if (socketRef.current) {
      try {
        socketRef.current.close();
      } catch (e) {}
      socketRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (mode === 'local') {
      setDeviceMode('local');
      localStorage.setItem('deviceMode', 'local');
      setClientRole('controller');
      localStorage.setItem('clientRole', 'controller');
      setActiveTab('board');
      setPairingStatus('unpaired');
      setPairingCode('');
      setConnectedClients([]);
      setIsDBReady(false);
      dbGetTickets().then((allTickets) => {
        const active = allTickets.find((t) => t.status === 'active') || null;
        setTickets(allTickets);
        setActiveTicket(active);
        setIsDBReady(true);
      });
    } else if (mode === 'server') {
      setDeviceMode('server');
      localStorage.setItem('deviceMode', 'server');
      const savedCode = localStorage.getItem('pairedCode') || '';
      connectWebSocket('server', savedCode, window.location.host);
    } else if (mode === 'mobile_control') {
      setDeviceMode('client');
      localStorage.setItem('deviceMode', 'client');
      setClientRole('controller');
      localStorage.setItem('clientRole', 'controller');
      setTickets([]);
      setActiveTicket(null);
      setActiveTab('devices');
      const savedCode = localStorage.getItem('pairedCode') || pairingCode || '';
      const savedIP = localStorage.getItem('serverIP') || serverIP || window.location.host;
      if (savedCode) {
        connectWebSocket('client', savedCode, savedIP);
      } else {
        setPairingStatus('unpaired');
      }
    } else if (mode === 'public_display') {
      setDeviceMode('client');
      localStorage.setItem('deviceMode', 'client');
      setClientRole('pantalla');
      localStorage.setItem('clientRole', 'pantalla');
      setTickets([]);
      setActiveTicket(null);
      setActiveTab('tv_view');
      const savedCode = localStorage.getItem('pairedCode') || pairingCode || '';
      const savedIP = localStorage.getItem('serverIP') || serverIP || window.location.host;
      if (savedCode) {
        connectWebSocket('client', savedCode, savedIP);
      } else {
        // Query rooms immediately for TV screen auto-connection
        fetch(buildApiUrl(savedIP, '/api/rooms'))
          .then(res => res.ok ? res.json() : null)
          .then(data => {
            if (data && data.rooms && data.rooms.length > 0) {
              const discovered = data.rooms[0].code;
              setPairingCode(discovered);
              localStorage.setItem('pairedCode', discovered);
              connectWebSocket('client', discovered, savedIP);
            } else {
              setPairingStatus('searching');
            }
          })
          .catch(() => setPairingStatus('searching'));
      }
    }
  };

  const handleStartPairing = (code: string, ip?: string) => {
    const targetIP = ip || serverIP || window.location.host;
    if (ip && ip !== serverIP) {
      setServerIP(ip);
      localStorage.setItem('serverIP', ip);
    }
    connectWebSocket('client', code, targetIP, true);
  };

  const handleSetDeviceName = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setDeviceName(trimmed);
    localStorage.setItem('deviceName', trimmed);
    deviceNameRef.current = trimmed;
    triggerConfigSavedToast(`✔ Dispositivo renombrado como: "${trimmed}"`);

    // Sync with WS Server if connected as a client
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN && deviceMode === 'client') {
      try {
        socketRef.current.send(JSON.stringify({
          type: 'register_client',
          code: pairingCode,
          deviceId: getOrCreateDeviceId(),
          deviceName: trimmed,
          deviceType: clientRole === 'pantalla' ? 'Pantalla Pública' : 'Cliente de Control',
        }));
      } catch (err) {
        console.error('Error updating device name on WS server:', err);
      }
    }
  };

  const handleSetServerIP = (ip: string) => {
    setServerIP(ip);
    localStorage.setItem('serverIP', ip);
  };

  const handleRenameClient = (id: string, name: string) => {
    setConnectedClients(prev => {
      return prev.map(c => c.id === id ? { ...c, name } : c);
    });
    setAuthorizedDevices(prev => {
      return prev.map(d => d.id === id ? { ...d, name } : d);
    });
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'rename_client',
        deviceId: id,
        name,
      }));
    }
  };

  const handleBlockDevice = (id: string) => {
    setAuthorizedDevices(prev => {
      return prev.map(d => d.id === id ? { ...d, status: 'blocked' as const } : d);
    });
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'deauthorize_client',
        deviceId: id,
      }));
    }
  };

  const handleUnblockDevice = (id: string) => {
    setAuthorizedDevices(prev => {
      return prev.map(d => d.id === id ? { ...d, status: 'authorized' as const } : d);
    });
  };

  const handleRemoveClient = (id: string) => {
    setConnectedClients(prev => prev.filter(c => c.id !== id));
    setAuthorizedDevices(prev => prev.filter(d => d.id !== id));
    setDeauthorizedDeviceIds(prev => {
      const next = prev.includes(id) ? prev : [...prev, id];
      localStorage.setItem('deauthorizedDeviceIds', JSON.stringify(next));
      return next;
    });
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'deauthorize_client',
        deviceId: id,
      }));
    }
  };

  const handleDisconnect = () => {
    handleSelectMode('local');
  };

  const handleSetClientRole = (role: 'controller' | 'pantalla') => {
    setClientRole(role);
    localStorage.setItem('clientRole', role);
    if (deviceMode === 'client') {
      const savedCode = localStorage.getItem('pairedCode') || pairingCode || '';
      const ip = localStorage.getItem('serverIP') || serverIP || window.location.host;
      if (savedCode) {
        connectWebSocket('client', savedCode, ip);
      }
    }
  };

  // Sync authorizedDevices to localStorage
  useEffect(() => {
    localStorage.setItem('authorizedDevices', JSON.stringify(authorizedDevices));
    setConnectedClients(prev => {
      return authorizedDevices.map(d => {
        const existing = prev.find(p => p.id === d.id);
        return {
          id: d.id,
          name: d.name,
          connected: existing ? existing.connected : false,
          type: d.type || 'Tablet',
          status: d.status || 'authorized',
        };
      });
    });
  }, [authorizedDevices]);

  // Establish initial connections on start
  useEffect(() => {
    if (deviceMode === 'server') {
      const savedCode = localStorage.getItem('pairedCode') || '';
      connectWebSocket('server', savedCode, window.location.host);
      addServerLog("Servidor local iniciado. Esperando conexiones de tablets o pantallas...", "info");
    } else if (deviceMode === 'client' && pairingCode) {
      connectWebSocket('client', pairingCode, serverIP);
    }
    return () => {
      if (socketRef.current) {
        try {
          socketRef.current.close();
        } catch (e) {}
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  // Bulletproof 1-Second Continuous Monitoring & Auto-Reconnect Engine for TV Screens & Clients
  useEffect(() => {
    const checkAndReconnect1s = async () => {
      const isTvScreen = isTvUA || clientRole === 'pantalla' || activeTab === 'tv_view' || urlRole === 'pantalla' || urlMode === 'public_display';
      let currentMode = localStorage.getItem('deviceMode') as 'server' | 'client' | 'local' | null;

      if (isTvScreen) {
        currentMode = 'client';
        if (deviceMode !== 'client') {
          setDeviceMode('client');
        }
        localStorage.setItem('deviceMode', 'client');
      } else if (!currentMode) {
        currentMode = deviceMode;
      }

      if (!currentMode || currentMode === 'local') return;

      const socket = socketRef.current;
      const isSocketOpen = socket && socket.readyState === WebSocket.OPEN;

      // 1. Check for stale / half-open socket (if open but no message received in 25s)
      if (isSocketOpen) {
        const idleTime = Date.now() - lastMessageReceivedTimeRef.current;
        if (idleTime > 25000) {
          console.warn('[1s Monitor] Heartbeat timeout (no message in 25s). Force closing stale socket...');
          try {
            socket.close();
          } catch (e) {}
        }
        return; // Connected and healthy!
      }

      // 2. If socket is connecting, check if stuck for > 8s
      if (socket && socket.readyState === WebSocket.CONNECTING) {
        const connectingTime = Date.now() - connectionStartTimeRef.current;
        if (connectingTime > 8000) {
          console.warn('[1s Monitor] Connection attempt stuck in CONNECTING for >8s. Resetting...');
          try {
            socket.close();
          } catch (e) {}
        }
        return;
      }

      // 3. Socket is closed, missing, or failed -> TRIGGER RECONNECT IMMEDIATELY!
      if (!socket || socket.readyState === WebSocket.CLOSED || socket.readyState === WebSocket.CLOSING) {
        let code = localStorage.getItem('pairedCode') || pairingCode || '';
        let ip = localStorage.getItem('serverIP') || serverIP || window.location.host;

        // If code is empty, attempt room auto-discovery from /api/rooms
        if (!code) {
          try {
            const res = await fetch(buildApiUrl(ip, '/api/rooms'));
            if (res.ok) {
              const data = await res.json();
              const roomsList = data.rooms || [];
              setAvailableRooms(roomsList);
              if (roomsList.length > 0) {
                code = roomsList[0].code;
                console.log(`[1s Auto-Discovery] Found room ${code}. Saving and connecting...`);
                setPairingCode(code);
                localStorage.setItem('pairedCode', code);
              }
            }
          } catch (err) {
            console.warn('[1s Auto-Discovery] Room fetch failed:', err);
          }
        }

        if (code) {
          console.log(`[1s Reconnect Engine] Attempting connection to ${ip} with room code ${code}...`);
          connectWebSocket(currentMode, code, ip);
        } else if (currentMode === 'server') {
          connectWebSocket('server', code, ip);
        } else {
          console.log(`[1s Reconnect Engine] Waiting for room code or auto-discovery...`);
        }
      }
    };

    checkAndReconnect1s();
    const interval = setInterval(checkAndReconnect1s, 1000); // Continuous 1-second check!

    const handleInstantReconnect = () => {
      checkAndReconnect1s();
    };

    window.addEventListener('visibilitychange', handleInstantReconnect);
    window.addEventListener('focus', handleInstantReconnect);
    window.addEventListener('online', handleInstantReconnect);

    return () => {
      clearInterval(interval);
      window.removeEventListener('visibilitychange', handleInstantReconnect);
      window.removeEventListener('focus', handleInstantReconnect);
      window.removeEventListener('online', handleInstantReconnect);
    };
  }, [deviceMode, clientRole, activeTab, pairingCode, serverIP]);

  // Screen WakeLock for Smart TVs & Public Display Screens
  useEffect(() => {
    let wakeLock: any = null;
    const requestWake = async () => {
      try {
        if ('wakeLock' in navigator && (navigator as any).wakeLock?.request) {
          wakeLock = await (navigator as any).wakeLock.request('screen');
          console.log('[TV Screen Engine] Screen WakeLock acquired successfully.');
        }
      } catch (err) {
        // Wake lock failed or unsupported
      }
    };

    requestWake();
    const handleReWake = () => {
      if (document.visibilityState === 'visible') {
        requestWake();
      }
    };

    document.addEventListener('visibilitychange', handleReWake);
    return () => {
      document.removeEventListener('visibilitychange', handleReWake);
      if (wakeLock) {
        try { wakeLock.release(); } catch (e) {}
      }
    };
  }, []);

  // Continuous Dual-Engine HTTP REST Sync for TV Screens and Clients
  // Acts as a secondary bulletproof sync layer alongside WebSockets
  useEffect(() => {
    let syncInterval: any = null;

    const performHttpSync = async () => {
      const isTvScreen = isTvUA || clientRole === 'pantalla' || activeTab === 'tv_view' || urlRole === 'pantalla' || urlMode === 'public_display';
      let currentMode = localStorage.getItem('deviceMode') as 'server' | 'client' | 'local' | null;
      if (isTvScreen) {
        currentMode = 'client';
      } else if (!currentMode) {
        currentMode = deviceMode;
      }

      if (currentMode !== 'client') return;

      const ip = localStorage.getItem('serverIP') || serverIP || window.location.host;
      const code = localStorage.getItem('pairedCode') || pairingCode || '';

      try {
        const syncUrl = buildApiUrl(ip, `/api/rooms/state/${encodeURIComponent(code)}`);
        const res = await fetch(syncUrl, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.state) {
            const st = data.state;

            // Auto adopt valid active room code if missing
            if (data.code && (!pairingCode || pairingCode !== data.code)) {
              setPairingCode(data.code);
              localStorage.setItem('pairedCode', data.code);
            }

            const prevActiveId = activeTicketRef.current?.id;
            const newActive = st.activeTicket;

            // Apply state synchronization
            if (st.tickets) setTickets(st.tickets);
            if (newActive !== undefined) setActiveTicket(newActive);
            if (st.announcementCount !== undefined) setAnnouncementCount(st.announcementCount);
            if (st.appConfig) setAppConfig(st.appConfig);
            if (st.voiceSettings) setVoiceSettings(st.voiceSettings);
            if (st.musicConfig) setMusicConfig(st.musicConfig);
            if (st.isWaitlistPaused !== undefined) setIsWaitlistPaused(st.isWaitlistPaused);

            setPairingStatus('paired');
            setLastSyncTime(new Date().toLocaleTimeString());

            // Trigger chime and voice announcement if active ticket changed
            if (newActive && newActive.id !== prevActiveId) {
              console.log('[HTTP Sync Engine] New active ticket detected via HTTP REST fallback:', newActive.number);
              const vs = st.voiceSettings || voiceSettingsRef.current;
              if (vs.soundEnabled !== false) {
                playNotificationSound();
              }
              if (vs.voiceEnabled !== false) {
                const msgText = formatAnnouncementText(newActive.number, vs, st.announcementCount || 1);
                speakText(msgText, vs);
              }
            }
          }
        }
      } catch (err) {
        // Silent fail; next iteration or WebSocket will handle
      }
    };

    const isTvScreen = isTvUA || clientRole === 'pantalla' || activeTab === 'tv_view' || urlRole === 'pantalla' || urlMode === 'public_display';
    const pollIntervalMs = isTvScreen ? 2000 : 3000;

    performHttpSync();
    syncInterval = setInterval(performHttpSync, pollIntervalMs);

    const handleWakeSync = () => {
      performHttpSync();
    };

    window.addEventListener('visibilitychange', handleWakeSync);
    window.addEventListener('focus', handleWakeSync);
    window.addEventListener('online', handleWakeSync);

    return () => {
      if (syncInterval) clearInterval(syncInterval);
      window.removeEventListener('visibilitychange', handleWakeSync);
      window.removeEventListener('focus', handleWakeSync);
      window.removeEventListener('online', handleWakeSync);
    };
  }, [deviceMode, clientRole, activeTab, pairingCode, serverIP]);

  const handleForceReconnect = async () => {
    console.log('[Force Reconnect] Forced reconnection requested...');
    if (socketRef.current) {
      try {
        socketRef.current.close();
      } catch (e) {}
    }
    let code = localStorage.getItem('pairedCode') || pairingCode || '';
    let ip = localStorage.getItem('serverIP') || serverIP || window.location.host;

    if (!code) {
      try {
        const res = await fetch(buildApiUrl(ip, '/api/rooms'));
        if (res.ok) {
          const data = await res.json();
          if (data.rooms && data.rooms.length > 0) {
            code = data.rooms[0].code;
            setPairingCode(code);
            localStorage.setItem('pairedCode', code);
          }
        }
      } catch (e) {}
    }

    const modeToUse = (deviceMode === 'local' || activeTab === 'tv_view' || clientRole === 'pantalla') ? 'client' : deviceMode;
    connectWebSocket(modeToUse, code, ip);
  };

  // Server state broadcast effect: broadcast server state updates to clients
  useEffect(() => {
    if (deviceMode !== 'server' || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    
    syncVersionRef.current += 1;
    const statePayload = {
      type: 'state_broadcast',
      tickets,
      activeTicket,
      announcementCount,
      appConfig,
      voiceSettings,
      musicConfig,
      isWaitlistPaused,
      syncVersion: syncVersionRef.current,
      timestamp: Date.now(),
    };
    socketRef.current.send(JSON.stringify(statePayload));
  }, [tickets, activeTicket, announcementCount, appConfig, voiceSettings, musicConfig, deviceMode, isWaitlistPaused]);

  // 1. Initial boot and IndexedDB fetch
  useEffect(() => {
    async function loadAppState() {
      try {
        await initDB();
        
        // Load voice configurations
        const savedVoice = await dbGetSettings<VoiceSettings>('voice_settings');
        if (savedVoice) setVoiceSettings(savedVoice);
        
        const savedShortcuts = await dbGetSettings<ShortcutConfig>('shortcuts');
        if (savedShortcuts) setShortcutConfig(savedShortcuts);

        const savedAppConfig = await dbGetSettings<AppConfig>('app_config');
        if (savedAppConfig) {
          const migrated = await processAndSaveMedia(savedAppConfig);
          if (JSON.stringify(migrated) !== JSON.stringify(savedAppConfig)) {
            await dbSaveSettings('app_config', migrated);
          }
          setAppConfig(migrated);
        }

        const savedMusic = await dbGetSettings<MusicConfig>('music_settings');
        const activeMusicConfig: MusicConfig = savedMusic
          ? {
              ...savedMusic,
              enabled: savedMusic.enabled !== undefined ? savedMusic.enabled : true,
              integratedEnabled: savedMusic.integratedEnabled !== undefined ? savedMusic.integratedEnabled : true,
              mode: (savedMusic.mode as any) === 'integrated' ? 'duck40' : (savedMusic.mode || 'duck40'),
            }
          : DEFAULT_MUSIC_CONFIG;

        setMusicConfig(activeMusicConfig);
        musicController.setConfig(activeMusicConfig);
        musicController.triggerAutoplay();

        // Fetch all tickets
        const allTickets = await dbGetTickets();
        
        // Filter out those still waiting or active
        const waiting = allTickets.filter((t) => t.status === 'waiting');
        const active = allTickets.find((t) => t.status === 'active') || null;
        
        // Sort waiting by creation time FIFO
        waiting.sort((a, b) => a.createdAt - b.createdAt);

        setTickets(allTickets);
        setActiveTicket(active);

        if (active) {
          // If there's an active ticket, start from call #1
          setAnnouncementCount(1);
        }

        setIsDBReady(true);
      } catch (err) {
        console.error('Failed to restore app data from IndexedDB:', err);
        setIsDBReady(true);
      }
    }
    loadAppState();
  }, []);

  // Process the speech announcement queue sequentially
  const processSpeechQueue = async () => {
    if (isSpeakingRef.current || speechQueueRef.current.length === 0 || deviceMode === 'client') return;

    isSpeakingRef.current = true;
    const nextTicket = speechQueueRef.current.shift();
    if (!nextTicket) {
      isSpeakingRef.current = false;
      return;
    }

    try {
      const settings = voiceSettingsRef.current;
      
      // Notify music controller that an announcement is starting
      musicController.startAnnouncement();

      // 1. Sound beep alert if enabled
      if (settings.soundEnabled) {
        await playNotificationSound();
      }

      // 2. Phone Haptic/Vibrator if enabled
      if (settings.vibrationEnabled) {
        triggerVibration(true);
      }

      // 3. TTS Vocalization
      const msgText = formatAnnouncementText(nextTicket.number, settings, 1);
      
      await new Promise<void>((resolve) => {
        speakText(msgText, settings, undefined, () => {
          resolve();
        });
      });

    } catch (err) {
      console.warn("Error playing announcement for ticket:", nextTicket.number, err);
    } finally {
      // Notify music controller that speech is finished
      musicController.endAnnouncement();
      isSpeakingRef.current = false;
      
      // Process next item in the queue with a tiny gap
      setTimeout(() => {
        processSpeechQueue();
      }, 400);
    }
  };

  // 2. Sequential non-overlapping Voice Queue controller
  useEffect(() => {
    if (!isDBReady || deviceMode === 'client') return;
    
    const activeList = tickets.filter(t => t.status === 'active');
    
    // Warm up announced set on mount so we don't repeat-announce historical tickets
    if (announcedTicketIdsRef.current.size === 0 && activeList.length > 0) {
      activeList.forEach(t => announcedTicketIdsRef.current.add(t.id));
      return;
    }

    // Clean up IDs that are no longer active, so they can be announced again if reactivated
    const currentActiveIds = new Set(activeList.map(t => t.id));
    announcedTicketIdsRef.current.forEach(id => {
      if (!currentActiveIds.has(id)) {
        announcedTicketIdsRef.current.delete(id);
      }
    });

    let hasNew = false;
    activeList.forEach(t => {
      if (!announcedTicketIdsRef.current.has(t.id)) {
        announcedTicketIdsRef.current.add(t.id);
        speechQueueRef.current.push(t);
        hasNew = true;
      }
    });

    if (hasNew) {
      processSpeechQueue();
    }
  }, [tickets, isDBReady]);

  // Trigger a temporary visual toast on the screen when a keyboard shortcut is activated
  const triggerShortcutNotification = (actionName: string, keyName: string) => {
    setShortcutNotification({
      action: actionName,
      key: keyName,
      id: Date.now(),
    });
  };

  // Automatically dismiss the toast after 1500ms
  useEffect(() => {
    if (!shortcutNotification) return;
    const timer = setTimeout(() => {
      setShortcutNotification(null);
    }, 1500);
    return () => clearTimeout(timer);
  }, [shortcutNotification]);

  // 3. Repeat active ticket vocalization call
  const handleRepeatCall = () => {
    if (sendClientAction('repeat_call')) return;
    if (!activeTicketRef.current) return;
    setAnnouncementCount((prev) => {
      const nextCount = prev + 1;
      musicController.startAnnouncement();
      playNotificationSound().then(() => {
        if (activeTicketRef.current) {
          const msgText = formatAnnouncementText(
            activeTicketRef.current.number,
            voiceSettingsRef.current,
            nextCount
          );
          speakText(msgText, voiceSettingsRef.current, undefined, () => {
            musicController.endAnnouncement();
          });
        } else {
          musicController.endAnnouncement();
        }
      });
      return nextCount;
    });
  };

  const handleToggleWaitlistPause = async () => {
    if (sendClientAction('toggle_waitlist_pause')) return;
    
    const nextVal = !isWaitlistPaused;
    setIsWaitlistPaused(nextVal);
    
    if (deviceMode === 'server') {
      addServerLog(`Lista de espera ${nextVal ? 'PAUSADA' : 'REANUDADA'}.`, nextVal ? 'warn' : 'success');
    }
    
    if (!nextVal) {
      // Resumed! Let's activate the first waiting ticket if no active ticket
      if (!activeTicketRef.current) {
        const waitingList = ticketsRef.current.filter((t) => t.status === 'waiting');
        if (waitingList.length > 0) {
          const first = waitingList[0];
          const newActive: Ticket = {
            ...first,
            status: 'active',
          };
          const remainingWaiting = waitingList.slice(1);
          const otherTickets = ticketsRef.current.filter((t) => t.status !== 'waiting' && t.status !== 'active');
          const finalTickets = [...otherTickets, newActive, ...remainingWaiting];
          
          await dbSaveTicket(newActive);
          setTickets(finalTickets);
          setActiveTicket(newActive);
          setAnnouncementCount(1);
        }
      }
    }
    forceRefocusInput();
  };

  const handleToggleAutonomousMode = async () => {
    const nextVal = !isAutonomousMode;
    setIsAutonomousMode(nextVal);
    localStorage.setItem('isAutonomousMode', String(nextVal));

    if (nextVal) {
      // 1-Click Startup logic:
      setDeviceMode('server');
      localStorage.setItem('deviceMode', 'server');
      setForcePCManualMode(false);

      // Unlock sound and music
      const updatedVoice = { ...voiceSettings, soundEnabled: true };
      setVoiceSettings(updatedVoice);
      await dbSaveSettings('voice_settings', updatedVoice);

      const updatedMusic = { ...musicConfig, integratedEnabled: true };
      setMusicConfig(updatedMusic);
      musicController.setConfig(updatedMusic);
      await dbSaveSettings('music_settings', updatedMusic);

      musicController.play();

      addServerLog("⚙️ MODO AUTÓNOMO ACTIVADO: Servidor iniciado, audio desbloqueado, música ambiental en reproducción y auto-procesamiento de colas listo.", "success");
    } else {
      addServerLog("⚙️ MODO AUTÓNOMO DESACTIVADO. Volviendo a control manual.", "warn");
    }
  };

  // Autonomous auto-caller loop
  useEffect(() => {
    if (!isAutonomousMode || !isAutoCallActive || deviceMode === 'client' || isWaitlistPaused) return;

    const interval = setInterval(async () => {
      // Get chronological waiting tickets
      const waitingList = [...ticketsRef.current]
        .filter((t) => t.status === 'waiting')
        .sort((a, b) => {
          const aPri = a.isPriority ? 1 : 0;
          const bPri = b.isPriority ? 1 : 0;
          if (aPri !== bPri) return bPri - aPri;
          return a.createdAt - b.createdAt;
        });

      if (waitingList.length > 0) {
        if (!activeTicketRef.current) {
          addServerLog("🤖 Autopiloto: Auto-llamando siguiente ticket en espera.", "info");
          await handleCallNext();
        } else {
          const activeTime = activeTicketRef.current.completedAt || activeTicketRef.current.createdAt;
          if (Date.now() - activeTime > 15000) {
            addServerLog(`🤖 Autopiloto: Auto-entregando ticket #${activeTicketRef.current.number} para llamar al siguiente.`, "info");
            await handleMarkDelivered(activeTicketRef.current.id);
            await handleCallNext();
          }
        }
      } else if (activeTicketRef.current) {
        // No waiting tickets, auto-deliver active after 15 seconds to keep the screen tidy
        const activeTime = activeTicketRef.current.completedAt || activeTicketRef.current.createdAt;
        if (Date.now() - activeTime > 15000) {
          addServerLog(`🤖 Autopiloto: Auto-entregando ticket #${activeTicketRef.current.number} para mantener la pantalla despejada.`, "info");
          await handleMarkDelivered(activeTicketRef.current.id);
        }
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [isAutonomousMode, isAutoCallActive, isWaitlistPaused, deviceMode]);

  const handleKeyDownRef = useRef<any>(null);

  // 4. Global keyboard shortcuts handler using a ref to prevent stale closures
  useEffect(() => {
    handleKeyDownRef.current = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      
      // ESC → Clear fast ticket input and focus it
      if (e.key === 'Escape' || (shortcutConfig.focusInput && matchesShortcut(e, shortcutConfig.focusInput))) {
        const mainInput = document.getElementById('fast-ticket-input');
        if (mainInput) {
          e.preventDefault();
          e.stopPropagation();
          (mainInput as HTMLInputElement).focus();
          // Clear text inside manual input if we are in it
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
          if (nativeInputValueSetter) {
            nativeInputValueSetter.call(mainInput, "");
            const event = new Event('input', { bubbles: true });
            mainInput.dispatchEvent(event);
          }
          triggerShortcutNotification('Limpiar Entrada', 'Esc');
          return;
        }
      }

      // MARK MISSING (Mover a pendientes / Desaparecer)
      if (shortcutConfig.markMissing && matchesShortcut(e, shortcutConfig.markMissing)) {
        e.preventDefault();
        e.stopPropagation();
        if (activeTicketRef.current) {
          handleMarkMissing(activeTicketRef.current.id);
          triggerShortcutNotification(SHORTCUT_NAMES.markMissing, shortcutConfig.markMissing);
        }
        forceRefocusInput();
        return;
      }

      // PAUSE/RESUME OCR
      if (shortcutConfig.pauseResumeOcr && matchesShortcut(e, shortcutConfig.pauseResumeOcr)) {
        e.preventDefault();
        e.stopPropagation();
        setIsOcrPaused((prev) => {
          const nextVal = !prev;
          triggerShortcutNotification(
            SHORTCUT_NAMES.pauseResumeOcr, 
            `${shortcutConfig.pauseResumeOcr} (${nextVal ? 'Pausado' : 'Reanudado'})`
          );
          return nextVal;
        });
        forceRefocusInput();
        return;
      }

      // PAUSE/RESUME WAITLIST
      if (shortcutConfig.pauseResumeWaitlist && matchesShortcut(e, shortcutConfig.pauseResumeWaitlist)) {
        e.preventDefault();
        e.stopPropagation();
        handleToggleWaitlistPause();
        triggerShortcutNotification(
          SHORTCUT_NAMES.pauseResumeWaitlist,
          `${shortcutConfig.pauseResumeWaitlist}`
        );
        forceRefocusInput();
        return;
      }

      // ROTATE / CALL NEXT (Default Space)
      if (shortcutConfig.callNext && matchesShortcut(e, shortcutConfig.callNext)) {
        e.preventDefault();
        e.stopPropagation();
        if (activeTicketRef.current) {
          handleCallNext();
          triggerShortcutNotification(SHORTCUT_NAMES.callNext, shortcutConfig.callNext);
        }
        forceRefocusInput();
        return;
      }

      // DELIVER TICKET / ENTER (Default Enter)
      if (shortcutConfig.markDelivered && matchesShortcut(e, shortcutConfig.markDelivered)) {
        e.preventDefault();
        e.stopPropagation();
        if (activeTicketRef.current) {
          handleMarkDelivered(activeTicketRef.current.id);
          triggerShortcutNotification(SHORTCUT_NAMES.markDelivered, shortcutConfig.markDelivered);
        } else {
          // If no active, try to promote selected in highlighted list
          const list = lastFocusedListRef.current;
          const currentId = list === 'waiting' ? selectedWaitingTicketIdRef.current : selectedPendingTicketIdRef.current;
          if (currentId) {
            if (list === 'waiting') {
              handleRaisePriority(currentId);
            } else {
              handleActivateFromPause(currentId);
            }
            triggerShortcutNotification('Activar ticket seleccionado', 'Enter');
          }
        }
        forceRefocusInput();
        return;
      }

      // ACTIVATE SELECTED (Default KeyA)
      if (shortcutConfig.activateSelected && matchesShortcut(e, shortcutConfig.activateSelected)) {
        e.preventDefault();
        e.stopPropagation();
        const list = lastFocusedListRef.current;
        const currentId = list === 'waiting' 
          ? selectedWaitingTicketIdRef.current 
          : list === 'pending'
            ? selectedPendingTicketIdRef.current
            : selectedMissingTicketIdRef.current;
        if (currentId) {
          if (list === 'waiting') {
            handleRaisePriority(currentId);
          } else if (list === 'pending') {
            handleActivateFromPause(currentId);
          } else if (list === 'missing') {
            handleActivateFromMissing(currentId);
          }
          triggerShortcutNotification(SHORTCUT_NAMES.activateSelected, shortcutConfig.activateSelected);
        }
        forceRefocusInput();
        return;
      }

      // ARROW UP (↑) → Select previous ticket in current queue list
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        const list = lastFocusedListRef.current;
        if (list === 'waiting') {
          const waitingList = ticketsRef.current.filter((t) => t.status === 'waiting');
          if (waitingList.length > 0) {
            const currentIndex = waitingList.findIndex((t) => t.id === selectedWaitingTicketIdRef.current);
            let prevId = waitingList[waitingList.length - 1].id;
            if (currentIndex > 0) {
              prevId = waitingList[currentIndex - 1].id;
            }
            setSelectedWaitingTicketId(prevId);
            triggerShortcutNotification('Seleccionar anterior', '↑');
          }
        } else if (list === 'pending') {
          const pendingList = ticketsRef.current.filter((t) => t.status === 'pending');
          if (pendingList.length > 0) {
            const currentIndex = pendingList.findIndex((t) => t.id === selectedPendingTicketIdRef.current);
            let prevId = pendingList[pendingList.length - 1].id;
            if (currentIndex > 0) {
              prevId = pendingList[currentIndex - 1].id;
            }
            setSelectedPendingTicketId(prevId);
            triggerShortcutNotification('Seleccionar anterior', '↑');
          }
        } else if (list === 'missing') {
          const missingList = ticketsRef.current.filter((t) => t.status === 'missing');
          if (missingList.length > 0) {
            const currentIndex = missingList.findIndex((t) => t.id === selectedMissingTicketIdRef.current);
            let prevId = missingList[missingList.length - 1].id;
            if (currentIndex > 0) {
              prevId = missingList[currentIndex - 1].id;
            }
            setSelectedMissingTicketId(prevId);
            triggerShortcutNotification('Seleccionar anterior', '↑');
          }
        }
        forceRefocusInput();
        return;
      }

      // ARROW DOWN (↓) → Select next ticket in current queue list
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        const list = lastFocusedListRef.current;
        if (list === 'waiting') {
          const waitingList = ticketsRef.current.filter((t) => t.status === 'waiting');
          if (waitingList.length > 0) {
            const currentIndex = waitingList.findIndex((t) => t.id === selectedWaitingTicketIdRef.current);
            let nextId = waitingList[0].id;
            if (currentIndex !== -1 && currentIndex < waitingList.length - 1) {
              nextId = waitingList[currentIndex + 1].id;
            }
            setSelectedWaitingTicketId(nextId);
            triggerShortcutNotification('Seleccionar siguiente', '↓');
          }
        } else if (list === 'pending') {
          const pendingList = ticketsRef.current.filter((t) => t.status === 'pending');
          if (pendingList.length > 0) {
            const currentIndex = pendingList.findIndex((t) => t.id === selectedPendingTicketIdRef.current);
            let nextId = pendingList[0].id;
            if (currentIndex !== -1 && currentIndex < pendingList.length - 1) {
              nextId = pendingList[currentIndex + 1].id;
            }
            setSelectedPendingTicketId(nextId);
            triggerShortcutNotification('Seleccionar siguiente', '↓');
          }
        } else if (list === 'missing') {
          const missingList = ticketsRef.current.filter((t) => t.status === 'missing');
          if (missingList.length > 0) {
            const currentIndex = missingList.findIndex((t) => t.id === selectedMissingTicketIdRef.current);
            let nextId = missingList[0].id;
            if (currentIndex !== -1 && currentIndex < missingList.length - 1) {
              nextId = missingList[currentIndex + 1].id;
            }
            setSelectedMissingTicketId(nextId);
            triggerShortcutNotification('Seleccionar siguiente', '↓');
          }
        }
        forceRefocusInput();
        return;
      }

      // TAB / ARROW LEFT / ARROW RIGHT → Cycle focused list
      if (e.key === 'Tab' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        setLastFocusedList((prev) => {
          let nextVal: 'waiting' | 'missing' = 'waiting';
          if (prev === 'waiting') nextVal = 'missing';
          else nextVal = 'waiting';
          const listNameEs = nextVal === 'waiting' ? 'En espera' : 'Desaparecidos';
          triggerShortcutNotification(`Enfoque: ${listNameEs}`, 'Navegación');
          return nextVal as any;
        });
        forceRefocusInput();
        return;
      }

      // Fallback for SPACE to repeat call when it doesn't rotate
      if ((e.key === ' ' || e.code === 'Space') && shortcutConfig.callNext !== 'Space') {
        e.preventDefault();
        e.stopPropagation();
        if (activeTicketRef.current) {
          handleRepeatCall();
          triggerShortcutNotification('Repetir llamada', 'Espacio');
        }
        forceRefocusInput();
        return;
      }
    };
  });

  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (handleKeyDownRef.current) {
        handleKeyDownRef.current(e);
      }
    };
    window.addEventListener('keydown', listener, true);
    return () => {
      window.removeEventListener('keydown', listener, true);
    };
  }, []);

  // 5. Ticket Actions Operations
  const handleAddTicket = async (number: string, fromOcr = false, createdByDevice?: string) => {
    const creator = createdByDevice || deviceName || 'Tablet';
    if (sendClientAction('add_ticket', { number, fromOcr, createdByDevice: creator })) return;
    // 3-digit normalization helper
    const normalizedNum = String(parseInt(number, 10));

    // Guard: check for active or waiting duplicates
    const isDuplicate = tickets.some(
      (t) => t.number === normalizedNum && (t.status === 'active' || t.status === 'waiting')
    );
    if (isDuplicate) {
      triggerConfigSavedToast(`⚠ Ticket #${normalizedNum} ya registrado`);
      if (deviceMode === 'server') {
        addServerLog(`Ticket #${normalizedNum} (${fromOcr ? 'OCR' : 'Manual'}) duplicado ignorado.`, 'warn');
      }
      forceRefocusInput();
      return;
    }

    const ocrMode = appConfig.ocrInputMode || 'direct_listos';

    if (fromOcr && ocrMode === 'waiting') {
      const newTicket: Ticket = {
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
        number: normalizedNum,
        createdAt: Date.now(),
        status: 'waiting',
        createdByDevice: creator,
      };
      const updatedTickets = [...tickets, newTicket];
      setTickets(updatedTickets);
      await dbSaveTicket(newTicket);
      triggerConfigSavedToast(`✔ Ticket #${normalizedNum} añadido a Espera (${creator})`);
      if (deviceMode === 'server') {
        addServerLog(`Ticket #${normalizedNum} (OCR) -> Espera [${creator}].`, 'info');
      }
      forceRefocusInput();
      return;
    }

    // FLUJO UNIFICADO MANUAL + OCR AUTÓNOMO
    const newTicket: Ticket = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
      number: normalizedNum,
      createdAt: Date.now(),
      completedAt: Date.now(),
      status: 'active',
      createdByDevice: creator,
    };

    const updatedTickets = [...tickets, newTicket];
    setTickets(updatedTickets);
    await dbSaveTicket(newTicket);

    // CASO 1: Si no hay ningún ticket activo -> Se vuelve el ticket activo principal y se anuncia en TV + Audio
    if (!activeTicket) {
      setActiveTicket(newTicket);
      setAnnouncementCount(1);
      triggerConfigSavedToast(`✔ Ticket #${normalizedNum} en LISTOS (Llamando en TV)`);

      if (voiceSettings.soundEnabled) {
        playNotificationSound();
      }
      const msg = formatAnnouncementText(normalizedNum, voiceSettings, 1);
      speakText(msg, voiceSettings);
    } else {
      // CASO 2: Ya existe un ticket activo -> Se agrega en cola a "Listos para Entregar" detrás de él
      triggerConfigSavedToast(`✔ Ticket #${normalizedNum} añadido a LISTOS PARA ENTREGAR`);
    }

    if (deviceMode === 'server') {
      addServerLog(`Ticket #${normalizedNum} (${fromOcr ? 'OCR' : 'Manual'}) -> LISTOS PARA ENTREGAR -> TV.`, 'success');
    }
    forceRefocusInput();
  };

  const handleMarkDelivered = async (id: string) => {
    if (sendClientAction('mark_delivered', { id })) return;
    const completedAt = Date.now();
    
    // Check for target ticket
    const targetTicket = tickets.find((t) => t.id === id);
    if (!targetTicket) {
      forceRefocusInput();
      return;
    }

    const ticketsToDeliver = [targetTicket];
    let updatedTickets = [...tickets];
    
    for (const ticket of ticketsToDeliver) {
      if (deviceMode === 'server') {
        addServerLog(`Ticket #${ticket.number} marcado como entregado/completado.`, 'success');
      }

      const updatedTicket: Ticket = {
        ...ticket,
        status: 'delivered',
        completedAt,
        totalTime: Math.max(0, Math.floor((completedAt - ticket.createdAt) / 1000)),
      };

      await dbSaveTicket(updatedTicket);
      updatedTickets = updatedTickets.map((t) => (t.id === ticket.id ? updatedTicket : t));
    }

    setTickets(updatedTickets);

    // CASO 3: Auto-llamador -> Al entregar el ticket activo actual (#541), el siguiente en la lista de Listos (#542) pasa a ser ACTIVO automáticamente
    if (activeTicket && ticketsToDeliver.some((t) => t.id === activeTicket.id)) {
      const remainingActive = updatedTickets
        .filter((t) => t.status === 'active' && !ticketsToDeliver.some(td => td.id === t.id))
        .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)); // FIFO: el más antiguo primero

      if (remainingActive.length > 0) {
        const nextInLine = remainingActive[0];
        setActiveTicket(nextInLine);
        setAnnouncementCount(1);

        if (voiceSettings.soundEnabled) {
          playNotificationSound();
        }
        const msg = formatAnnouncementText(nextInLine.number, voiceSettings, 1);
        speakText(msg, voiceSettings);
      } else {
        const waitingList = updatedTickets.filter((t) => t.status === 'waiting');
        if (waitingList.length > 0 && appConfig.autoActivateFirstTicket !== false) {
          const nextWaiting = waitingList[0];
          nextWaiting.status = 'active';
          nextWaiting.completedAt = Date.now();
          await dbSaveTicket(nextWaiting);
          setActiveTicket(nextWaiting);
          setAnnouncementCount(1);

          if (voiceSettings.soundEnabled) {
            playNotificationSound();
          }
          const msg = formatAnnouncementText(nextWaiting.number, voiceSettings, 1);
          speakText(msg, voiceSettings);
        } else {
          setActiveTicket(null);
          setAnnouncementCount(0);
        }
      }
    }

    setTransitionNotification({
      number: activeTicket && activeTicket.id === id ? activeTicket.number : targetTicket.number,
      type: 'delivered',
      id: Date.now(),
    });

    forceRefocusInput();
  };

  const handleMarkPending = async (id: string) => {
    if (sendClientAction('mark_pending', { id })) return;
    const pausedAt = Date.now();
    const targetTicket = tickets.find((t) => t.id === id);
    if (!targetTicket) {
      forceRefocusInput();
      return;
    }
    if (deviceMode === 'server') {
      addServerLog(`Ticket #${targetTicket.number} movido a preparación.`, 'warn');
    }

    const updatedTicket: Ticket = {
      ...targetTicket,
      status: 'pending',
      pendingAt: pausedAt,
    };

    await dbSaveTicket(updatedTicket);

    const updatedTickets = tickets.map((t) => (t.id === id ? updatedTicket : t));
    setTickets(updatedTickets);

    if (activeTicket && activeTicket.id === id) {
      const remainingActive = updatedTickets.filter((t) => t.status === 'active' && t.id !== id);
      if (remainingActive.length > 0) {
        const newest = [...remainingActive].sort((a, b) => {
          const tA = a.completedAt || a.createdAt || 0;
          const tB = b.completedAt || b.createdAt || 0;
          return tB - tA;
        })[0];
        setActiveTicket(newest);
        setAnnouncementCount(1);
      } else {
        setActiveTicket(null);
        setAnnouncementCount(0);
      }
    }

    setTransitionNotification({
      number: targetTicket.number,
      type: 'pending',
      id: Date.now(),
    });

    forceRefocusInput();
  };

  const handleMoveToPending = async (id: string) => {
    if (sendClientAction('move_to_pending', { id })) return;
    const pausedAt = Date.now();
    const ticket = tickets.find((t) => t.id === id);
    if (!ticket) return;
    if (deviceMode === 'server') {
      addServerLog(`Ticket #${ticket.number} movido a la sección de preparación.`, 'warn');
    }

    const updated: Ticket = {
      ...ticket,
      status: 'pending',
      pendingAt: pausedAt,
    };

    await dbSaveTicket(updated);

    const updatedTickets = tickets.map((t) => (t.id === id ? updated : t));
    setTickets(updatedTickets);

    setTransitionNotification({
      number: ticket.number,
      type: 'pending',
      id: Date.now(),
    });

    forceRefocusInput();
  };

  const handleMarkMissing = async (id: string) => {
    if (sendClientAction('mark_missing', { id })) return;
    const missingAt = Date.now();
    const targetTicket = tickets.find((t) => t.id === id);
    if (!targetTicket) {
      forceRefocusInput();
      return;
    }
    if (deviceMode === 'server') {
      addServerLog(`Ticket #${targetTicket.number} marcado como desaparecido/perdido.`, 'warn');
    }

    const updatedTicket: Ticket = {
      ...targetTicket,
      status: 'missing',
      completedAt: missingAt,
    };

    await dbSaveTicket(updatedTicket);

    const updatedTickets = tickets.map((t) => (t.id === id ? updatedTicket : t));
    setTickets(updatedTickets);

    if (activeTicket && activeTicket.id === id) {
      const remainingActive = updatedTickets.filter((t) => t.status === 'active' && t.id !== id);
      if (remainingActive.length > 0) {
        const newest = [...remainingActive].sort((a, b) => {
          const tA = a.completedAt || a.createdAt || 0;
          const tB = b.completedAt || b.createdAt || 0;
          return tB - tA;
        })[0];
        setActiveTicket(newest);
        setAnnouncementCount(1);
      } else {
        setActiveTicket(null);
        setAnnouncementCount(0);
      }
    }

    setTransitionNotification({
      number: targetTicket.number,
      type: 'missing',
      id: Date.now(),
    });

    forceRefocusInput();
  };

  const handleAddDirectWaitingTicket = async (number: string, createdByDevice?: string) => {
    const creator = createdByDevice || deviceName || 'Tablet';
    if (sendClientAction('add_direct_waiting', { number, createdByDevice: creator })) return;
    const normalizedNum = String(parseInt(number, 10));

    // Guard: check for active or waiting duplicates
    const isDuplicate = tickets.some(
      (t) => t.number === normalizedNum && (t.status === 'active' || t.status === 'waiting')
    );
    if (isDuplicate) {
      forceRefocusInput();
      return;
    }

    const newTicket: Ticket = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
      number: normalizedNum,
      createdAt: Date.now(),
      status: 'waiting',
      createdByDevice: creator,
    };

    const updatedTickets = [...tickets, newTicket];
    setTickets(updatedTickets);
    await dbSaveTicket(newTicket);
    forceRefocusInput();
  };

  const handleAddDirectPendingTicket = async (number: string, createdByDevice?: string) => {
    const creator = createdByDevice || deviceName || 'Tablet';
    if (sendClientAction('add_direct_pending', { number, createdByDevice: creator })) return;
    const normalizedNum = String(parseInt(number, 10));

    // Guard: check for duplicate in pending status
    const isDuplicate = tickets.some(
      (t) => t.number === normalizedNum && t.status === 'pending'
    );
    if (isDuplicate) {
      forceRefocusInput();
      return;
    }

    const newTicket: Ticket = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
      number: normalizedNum,
      createdAt: Date.now(),
      pendingAt: Date.now(),
      status: 'pending',
      createdByDevice: creator,
    };

    const updatedTickets = [...tickets, newTicket];
    setTickets(updatedTickets);
    await dbSaveTicket(newTicket);
    forceRefocusInput();
  };

  const handleActivateFromMissing = async (id: string) => {
    if (sendClientAction('activate_from_missing', { id })) return;
    const selectedTicket = tickets.find((t) => t.id === id);
    if (!selectedTicket || selectedTicket.status !== 'missing') {
      forceRefocusInput();
      return;
    }

    const currentActive = activeTicket;
    const waitingList = tickets.filter((t) => t.status === 'waiting');
    let newWaitingList: Ticket[] = [];

    if (currentActive) {
      // Demote active to waiting status
      const demotedActive: Ticket = {
        ...currentActive,
        status: 'waiting',
      };
      await dbSaveTicket(demotedActive);
      newWaitingList = [demotedActive, ...waitingList];
    } else {
      newWaitingList = waitingList;
    }

    // Promote missing ticket to active
    const newActive: Ticket = {
      ...selectedTicket,
      status: 'active',
      recoveredAt: Date.now(),
    };
    await dbSaveTicket(newActive);

    const otherTickets = tickets.filter((t) => t.id !== id && t.status !== 'waiting' && t.status !== 'active');
    const finalTickets = [...otherTickets, newActive, ...newWaitingList];

    setTickets(finalTickets);
    setActiveTicket(newActive);
    setAnnouncementCount(1);

    setTransitionNotification({
      number: selectedTicket.number,
      type: 'active',
      id: Date.now(),
    });

    forceRefocusInput();
  };

  const handleReturnToWaitingFromMissing = async (id: string) => {
    if (sendClientAction('return_to_waiting_from_missing', { id })) return;
    const selectedTicket = tickets.find((t) => t.id === id);
    if (!selectedTicket || selectedTicket.status !== 'missing') {
      forceRefocusInput();
      return;
    }

    const updatedTicket: Ticket = {
      ...selectedTicket,
      status: 'waiting',
    };
    await dbSaveTicket(updatedTicket);

    const otherTickets = tickets.filter((t) => t.id !== id);
    setTickets([...otherTickets, updatedTicket]);
    forceRefocusInput();
  };

  const handleActivateFromPause = async (id: string) => {
    if (sendClientAction('activate_from_pause', { id })) return;
    const selectedTicket = tickets.find((t) => t.id === id);
    if (!selectedTicket || selectedTicket.status !== 'pending') {
      forceRefocusInput();
      return;
    }

    // Promote paused ticket to active/Listo
    const newActive: Ticket = {
      ...selectedTicket,
      status: 'active',
      recoveredAt: Date.now(),
      completedAt: Date.now(),
    };
    await dbSaveTicket(newActive);

    const updatedTickets = tickets.map((t) => (t.id === id ? newActive : t));
    setTickets(updatedTickets);
    setActiveTicket(newActive);
    setAnnouncementCount(1);

    setTransitionNotification({
      number: selectedTicket.number,
      type: 'active',
      id: Date.now(),
    });

    forceRefocusInput();
  };

  const handleReturnToWaiting = async (id: string) => {
    if (sendClientAction('return_to_waiting', { id })) return;
    const ticket = tickets.find((t) => t.id === id);
    if (!ticket) return;

    const updatedTicket: Ticket = {
      ...ticket,
      status: 'waiting',
    };
    await dbSaveTicket(updatedTicket);

    const updatedTickets = tickets.map((t) => (t.id === id ? updatedTicket : t));
    setTickets(updatedTickets);

    if (activeTicket && activeTicket.id === id) {
      const remainingActive = updatedTickets.filter((t) => t.status === 'active' && t.id !== id);
      if (remainingActive.length > 0) {
        const newest = [...remainingActive].sort((a, b) => {
          const tA = a.completedAt || a.createdAt || 0;
          const tB = b.completedAt || b.createdAt || 0;
          return tB - tA;
        })[0];
        setActiveTicket(newest);
        setAnnouncementCount(1);
      } else {
        setActiveTicket(null);
        setAnnouncementCount(0);
      }
    }

    forceRefocusInput();
  };

  const handleCallTicketNow = (id: string) => {
    if (sendClientAction('call_ticket_now', { id })) return;
    const ticket = tickets.find((t) => t.id === id);
    if (!ticket) return;

    // Trigger TTS announcement for this specific ticket
    musicController.startAnnouncement();
    if (voiceSettings.soundEnabled) {
      playNotificationSound();
    }
    if (voiceSettings.vibrationEnabled) {
      triggerVibration(true);
    }
    const msgText = formatAnnouncementText(ticket.number, voiceSettings, 1);
    speakText(msgText, voiceSettings, undefined, () => {
      musicController.endAnnouncement();
    });
    forceRefocusInput();
  };

  const handleDeliverFromPause = async (id: string) => {
    if (sendClientAction('deliver_from_pause', { id })) return;
    const ticket = tickets.find((t) => t.id === id);
    if (!ticket) return;

    const completedAt = Date.now();
    const updatedTicket: Ticket = {
      ...ticket,
      status: 'delivered',
      completedAt,
      totalTime: Math.max(0, Math.floor((completedAt - ticket.createdAt) / 1000)),
    };
    await dbSaveTicket(updatedTicket);

    const updatedTickets = tickets.map((t) => (t.id === id ? updatedTicket : t));
    setTickets(updatedTickets);

    setTransitionNotification({
      number: ticket.number,
      type: 'delivered',
      id: Date.now(),
    });
    forceRefocusInput();
  };

  const handleRestoreTicket = async (id: string) => {
    if (sendClientAction('restore_ticket', { id })) return;
    const targetTicket = tickets.find((t) => t.id === id);
    if (!targetTicket) {
      forceRefocusInput();
      return;
    }

    if (deviceMode === 'server') {
      addServerLog(`Ticket #${targetTicket.number} restaurado a la lista de espera.`, 'success');
    }

    const updatedTicket: Ticket = {
      ...targetTicket,
      status: 'waiting',
      completedAt: undefined,
      totalTime: undefined,
    };

    await dbSaveTicket(updatedTicket);

    const updatedTickets = tickets.map((t) => (t.id === id ? updatedTicket : t));
    setTickets(updatedTickets);

    setTransitionNotification({
      number: targetTicket.number,
      type: 'waiting',
      id: Date.now(),
    });

    forceRefocusInput();
  };

  const handleCallNext = async () => {
    if (sendClientAction('call_next')) return;
    
    try {
      // Sort waiting list by priority first, then chronologically
      const sortedWaitingList = [...tickets.filter((t) => t.status === 'waiting')].sort((a, b) => {
        const aPri = a.isPriority ? 1 : 0;
        const bPri = b.isPriority ? 1 : 0;
        if (aPri !== bPri) {
          return bPri - aPri;
        }
        return a.createdAt - b.createdAt;
      });
      
      if (sortedWaitingList.length === 0) {
        // Nothing to call, just replay announcement of active ticket if exists
        if (activeTicket) {
          setAnnouncementCount((prev) => prev + 1);
          triggerConfigSavedToast('Repitiendo llamada del ticket activo.');
        } else {
          triggerConfigSavedToast('No hay tickets listos para llamar.');
        }
        forceRefocusInput();
        return;
      }

      // Auto-grouping of consecutive ticket numbers
      const promotedTickets: Ticket[] = [sortedWaitingList[0]];
      const firstNum = parseInt(sortedWaitingList[0].number, 10);
      
      if (!isNaN(firstNum)) {
        let currentNum = firstNum;
        for (let i = 1; i < sortedWaitingList.length; i++) {
          const nextTicket = sortedWaitingList[i];
          const nextNum = parseInt(nextTicket.number, 10);
          // group if consecutive AND they share the same priority status (to prevent mixing VIP/normal in confusing ways)
          if (!isNaN(nextNum) && nextNum === currentNum + 1 && !!nextTicket.isPriority === !!sortedWaitingList[0].isPriority) {
            promotedTickets.push(nextTicket);
            currentNum = nextNum;
          } else {
            break;
          }
        }
      }

      const completedAt = Date.now();
      const updatedPromoted = promotedTickets.map(ticket => ({
        ...ticket,
        status: 'active' as const,
        completedAt,
      }));

      // Save all to database
      for (const ticket of updatedPromoted) {
        await dbSaveTicket(ticket);
      }

      // Update local tickets state
      const promotedIds = new Set(promotedTickets.map(t => t.id));
      const updatedTickets = tickets.map((t) => {
        const found = updatedPromoted.find(p => p.id === t.id);
        return found ? found : t;
      });

      setTickets(updatedTickets);

      // Format grouped ticket number string
      let groupedNumberString = '';
      if (promotedTickets.length === 1) {
        groupedNumberString = promotedTickets[0].number;
      } else {
        const numbers = promotedTickets.map(t => t.number);
        if (voiceSettings.lang === 'es' || voiceSettings.lang === 'ca') {
          const last = numbers.pop();
          groupedNumberString = `${numbers.join(', ')} y ${last}`;
        } else {
          const last = numbers.pop();
          groupedNumberString = `${numbers.join(', ')} and ${last}`;
        }
        if (deviceMode === 'server') {
          addServerLog(`Agrupación inteligente activada: Llamando tickets ${groupedNumberString} juntos.`, 'info');
        }
      }

      const mergedActiveTicket: Ticket = {
        id: promotedTickets[0].id,
        number: groupedNumberString,
        status: 'active' as const,
        createdAt: promotedTickets[0].createdAt,
        completedAt,
        isPriority: promotedTickets.some(t => t.isPriority),
      };

      setActiveTicket(mergedActiveTicket);
      setAnnouncementCount(1);

      setTransitionNotification({
        number: groupedNumberString,
        type: 'active',
        id: Date.now(),
      });

      triggerConfigSavedToast(`Llamando Ticket #${groupedNumberString}`);
      if (deviceMode === 'server') {
        addServerLog(`📢 Ticket #${groupedNumberString} llamado con éxito y transmitido a pantallas.`, 'success');
      }
    } catch (error: any) {
      console.error('Error in handleCallNext:', error);
      triggerConfigSavedToast(`Error al llamar ticket: ${error.message || error}`);
      if (deviceMode === 'server') {
        addServerLog(`❌ Fallo al llamar siguiente: ${error.message || error}`, 'error');
      }
      throw error;
    } finally {
      forceRefocusInput();
    }
  };

  const handleTogglePriority = async (id: string) => {
    if (sendClientAction('toggle_priority', { id })) return;
    const targetTicket = tickets.find((t) => t.id === id);
    if (!targetTicket) {
      forceRefocusInput();
      return;
    }

    const updatedTicket: Ticket = {
      ...targetTicket,
      isPriority: !targetTicket.isPriority,
    };
    await dbSaveTicket(updatedTicket);

    const updatedTickets = tickets.map((t) => (t.id === id ? updatedTicket : t));
    setTickets(updatedTickets);

    if (deviceMode === 'server') {
      addServerLog(`Ticket #${targetTicket.number} marcado como ${updatedTicket.isPriority ? 'PRIORITARIO VIP' : 'Normal'}.`, 'success');
    }

    forceRefocusInput();
  };

  const handleRaisePriority = async (id: string) => {
    if (sendClientAction('raise_priority', { id })) return;
    const selectedTicket = tickets.find((t) => t.id === id);
    if (!selectedTicket || selectedTicket.status !== 'waiting') {
      forceRefocusInput();
      return;
    }

    // Promote selected to active/Listo
    const newActive: Ticket = {
      ...selectedTicket,
      status: 'active',
      completedAt: Date.now(),
    };
    await dbSaveTicket(newActive);

    const updatedTickets = tickets.map((t) => (t.id === id ? newActive : t));
    setTickets(updatedTickets);
    setActiveTicket(newActive);
    setAnnouncementCount(1);

    setTransitionNotification({
      number: selectedTicket.number,
      type: 'active',
      id: Date.now(),
    });

    forceRefocusInput();
  };

  const handleDeleteTicket = async (id: string) => {
    if (sendClientAction('delete_ticket', { id })) return;
    await dbDeleteTicket(id);

    const updatedTickets = tickets.filter((t) => t.id !== id);
    setTickets(updatedTickets);

    if (activeTicket && activeTicket.id === id) {
      const remainingActive = updatedTickets.filter((t) => t.status === 'active');
      if (remainingActive.length > 0) {
        const newest = [...remainingActive].sort((a, b) => {
          const tA = a.completedAt || a.createdAt || 0;
          const tB = b.completedAt || b.createdAt || 0;
          return tB - tA;
        })[0];
        setActiveTicket(newest);
        setAnnouncementCount(1);
      } else {
        setActiveTicket(null);
        setAnnouncementCount(0);
      }
    }
    forceRefocusInput();
  };

  const handleClearHistory = async (status: 'delivered' | 'missing') => {
    await dbClearTickets(status);
    setTickets(tickets.filter((t) => t.status !== status));
  };

  const handleCustomAnnouncement = () => {
    if (!customTTSInput.trim()) return;
    musicController.startAnnouncement();
    if (voiceSettings.soundEnabled) {
      playNotificationSound();
    }
    speakText(customTTSInput.trim(), voiceSettings, undefined, () => {
      musicController.endAnnouncement();
    });
    triggerConfigSavedToast(`Anunciando por voz: "${customTTSInput.trim()}"`);
    setCustomTTSInput('');
  };

  const handleClearQueue = async () => {
    if (window.confirm('¿Deseas vaciar todos los tickets activos y en espera?')) {
      const remaining = tickets.filter((t) => t.status !== 'waiting' && t.status !== 'active');
      const toDelete = tickets.filter((t) => t.status === 'waiting' || t.status === 'active');
      for (const t of toDelete) {
        await dbDeleteTicket(t.id);
      }
      setTickets(remaining);
      setActiveTicket(null);
      setAnnouncementCount(0);
      triggerConfigSavedToast('Cola de tickets activos y en espera vaciada.');
    }
  };

  // 5. Config Saves
  const handleSaveVoiceSettings = async (settings: VoiceSettings) => {
    if (sendClientAction('save_voice_settings', { settings })) return;
    setVoiceSettings(settings);
    await dbSaveSettings('voice_settings', settings);
    triggerConfigSavedToast('Ajustes de voz guardados.');
  };

  const handleSaveShortcutConfig = async (shortcuts: ShortcutConfig) => {
    if (sendClientAction('save_shortcut_config', { shortcuts })) return;
    setShortcutConfig(shortcuts);
    await dbSaveSettings('shortcuts', shortcuts);
    triggerConfigSavedToast('Atajos de teclado guardados.');
  };

  const processAndSaveMedia = async (config: AppConfig): Promise<AppConfig> => {
    const updated = { ...config };
    
    // Process bg video
    if (updated.publicDisplayBgVideo && updated.publicDisplayBgVideo.startsWith('data:')) {
      await dbSaveSettings('media_bg_video', updated.publicDisplayBgVideo);
      updated.publicDisplayBgVideo = 'indexeddb:bg_video';
    }

    // Process bg videos list
    if (updated.publicDisplayBgVideos && Array.isArray(updated.publicDisplayBgVideos)) {
      const processedVideos = [];
      for (const vid of updated.publicDisplayBgVideos) {
        if (vid.url && vid.url.startsWith('data:')) {
          const idbKey = `media_bg_video_${vid.id}`;
          await dbSaveSettings(idbKey, vid.url);
          processedVideos.push({
            ...vid,
            url: `indexeddb:bg_video_${vid.id}`
          });
        } else {
          processedVideos.push(vid);
        }
      }
      updated.publicDisplayBgVideos = processedVideos;
    }

    // Process bg image
    if (updated.publicDisplayBgImage && updated.publicDisplayBgImage.startsWith('data:')) {
      await dbSaveSettings('media_bg_image', updated.publicDisplayBgImage);
      updated.publicDisplayBgImage = 'indexeddb:bg_image';
    }

    // Process logo
    if (updated.publicDisplayLogo && updated.publicDisplayLogo.startsWith('data:')) {
      await dbSaveSettings('media_logo', updated.publicDisplayLogo);
      updated.publicDisplayLogo = 'indexeddb:logo';
    }

    // Process standby images
    if (updated.publicDisplayStandbyImages && Array.isArray(updated.publicDisplayStandbyImages)) {
      const processedImages = [];
      for (const img of updated.publicDisplayStandbyImages) {
        if (img.url && img.url.startsWith('data:')) {
          const idbKey = `media_standby_image_${img.id}`;
          await dbSaveSettings(idbKey, img.url);
          processedImages.push({
            ...img,
            url: `indexeddb:standby_image_${img.id}`
          });
        } else {
          processedImages.push(img);
        }
      }
      updated.publicDisplayStandbyImages = processedImages;
    }

    return updated;
  };

  const handleSaveAppConfig = async (config: AppConfig) => {
    const cleanConfig = await processAndSaveMedia(config);
    if (sendClientAction('save_app_config', { config: cleanConfig })) return;
    setAppConfig(cleanConfig);
    await dbSaveSettings('app_config', cleanConfig);
    triggerConfigSavedToast('Configuración general guardada.');

    // Sync newly updated background images/videos to HTTP server for client TVs
    if (deviceMode === 'server' && pairingCode) {
      uploadAllMediaToServer(pairingCode);
    }
  };

  const handleSaveMusicConfig = async (config: MusicConfig) => {
    if (sendClientAction('save_music_config', { config })) return;
    setMusicConfig(config);
    musicController.setConfig(config);
    await dbSaveSettings('music_settings', config);
    triggerConfigSavedToast('Ajustes de música ambiental guardados.');
  };

  const handleImportBackup = async (data: { tickets: any[], voiceSettings: any, appConfig: any, musicConfig: any }) => {
    try {
      if (data.tickets) {
        setTickets(data.tickets);
        await dbSaveTicketsBulk(data.tickets);
      }
      if (data.voiceSettings) {
        setVoiceSettings(data.voiceSettings);
        await dbSaveSettings('voice_settings', data.voiceSettings);
      }
      if (data.appConfig) {
        setAppConfig(data.appConfig);
        await dbSaveSettings('app_config', data.appConfig);
      }
      if (data.musicConfig) {
        setMusicConfig(data.musicConfig);
        await dbSaveSettings('music_settings', data.musicConfig);
      }
      addServerLog(`📥 Copia de seguridad restaurada con éxito: ${data.tickets?.length || 0} tickets cargados.`, 'success');
    } catch (err: any) {
      addServerLog(`❌ Error al importar respaldo: ${err.message || err}`, 'error');
    }
  };

  const handleApproveDevice = (deviceId: string, deviceName: string, deviceType: string, remember: boolean) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'auth_decision',
        deviceId,
        approved: true,
        remember,
        deviceName,
        deviceType
      }));
    }
    // Approve locally on server
    setAuthorizedDevices(prev => {
      const exists = prev.some(d => d.id === deviceId);
      const newDevice = {
        id: deviceId,
        name: deviceName,
        type: deviceType || 'Tablet',
        status: 'authorized' as const,
        remember,
        lastConnected: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
      };
      if (exists) {
        return prev.map(d => d.id === deviceId ? newDevice : d);
      }
      return [...prev, newDevice];
    });

    setPendingAuthRequests(prev => prev.filter(r => r.deviceId !== deviceId));
    addServerLog(`Dispositivo "${deviceName}" PERMITIDO (Recordar: ${remember ? 'Sí' : 'No'})`, 'success');
  };

  const handleRejectDevice = (deviceId: string, deviceName: string, deviceType: string) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'auth_decision',
        deviceId,
        approved: false,
        remember: false,
        deviceName,
        deviceType
      }));
    }
    // Mark as blocked locally to reject automatically in future
    setAuthorizedDevices(prev => {
      const exists = prev.some(d => d.id === deviceId);
      const blockedDevice = {
        id: deviceId,
        name: deviceName,
        type: deviceType || 'Tablet',
        status: 'blocked' as const,
        remember: false,
        lastConnected: undefined
      };
      if (exists) {
        return prev.map(d => d.id === deviceId ? blockedDevice : d);
      }
      return [...prev, blockedDevice];
    });

    setPendingAuthRequests(prev => prev.filter(r => r.deviceId !== deviceId));
    addServerLog(`Dispositivo "${deviceName}" RECHAZADO y BLOQUEADO`, 'warn');
  };

  // Derived attributes
  const waitingTickets = [...tickets]
    .filter((t) => t.status === 'waiting')
    .sort((a, b) => {
      const aPri = a.isPriority ? 1 : 0;
      const bPri = b.isPriority ? 1 : 0;
      if (aPri !== bPri) {
        return bPri - aPri;
      }
      return a.createdAt - b.createdAt;
    });
  const nextTicketNumber = waitingTickets.length > 0 ? waitingTickets[0].number : null;

  const pendingMediaRequests = useRef<Set<string>>(new Set());

  const handleMediaMissing = (mediaKey: string) => {
    if (deviceMode === 'client') {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN && pairingStatus === 'paired') {
        socketRef.current.send(JSON.stringify({
          type: 'client_action',
          action: 'request_media',
          payload: { mediaKey },
          deviceName,
        }));
      } else {
        pendingMediaRequests.current.add(mediaKey);
      }
    }
  };

  // Flush pending media requests once paired/connected
  useEffect(() => {
    if (deviceMode === 'client' && pairingStatus === 'paired' && socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      if (pendingMediaRequests.current.size > 0) {
        pendingMediaRequests.current.forEach((mediaKey) => {
          socketRef.current?.send(JSON.stringify({
            type: 'client_action',
            action: 'request_media',
            payload: { mediaKey },
            deviceName,
          }));
        });
        pendingMediaRequests.current.clear();
      }
    }
  }, [pairingStatus, deviceMode]);

  if (isDBReady && deviceMode === 'client' && clientRole === 'pantalla') {
    return (
      <PublicDisplayView
        activeTicket={activeTicket}
        tickets={tickets}
        pairingStatus={pairingStatus}
        serverIP={serverIP}
        appConfig={appConfig}
        onSelectMode={(mode) => {
          handleSelectMode(mode);
        }}
        onMediaMissing={handleMediaMissing}
        syncVersion={syncVersion}
        lastSyncTime={lastSyncTime}
        lastLatency={lastLatency}
        lastReceivedEvent={lastReceivedEvent}
        onForceReconnect={handleForceReconnect}
      />
    );
  }

  return (
    <div 
      className="min-h-screen flex flex-col font-sans transition-colors duration-300"
      style={{
        backgroundColor: 'var(--theme-bg, #020617)',
        color: 'var(--theme-text, #f8fafc)',
      }}
    >
      
      {/* CABECERA FIJA SUPERIOR */}
      <header 
        className="border-b backdrop-blur-md sticky top-0 z-50 px-4 py-2.5 transition-colors duration-300"
        style={{
          backgroundColor: 'var(--theme-card-bg, #0f172a)',
          borderColor: 'var(--theme-card-border, rgba(255, 255, 255, 0.1))',
          color: 'var(--theme-text, #f8fafc)',
        }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 flex-wrap">
          
          {/* Izquierda: Logo + Gestor de Tickets + Estado Servidor */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center font-black font-mono text-base text-white shadow-md shadow-indigo-500/20">
              T
            </div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-extrabold tracking-tight leading-none" style={{ color: 'var(--theme-text, #f8fafc)' }}>
                Gestor de Tickets
              </h1>
              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-mono px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                {deviceMode === 'server' ? 'SERVIDOR OK' : deviceMode === 'client' ? 'CLIENTE OK' : 'LOCAL OK'}
              </span>
            </div>
          </div>

          {/* Centro: Indicadores pequeños con punto verde */}
          <div 
            className="hidden lg:flex items-center gap-2 px-3 py-1 border rounded-xl text-[10px] font-mono transition-colors"
            style={{
              backgroundColor: 'var(--theme-input-bg, #0f172a)',
              borderColor: 'var(--theme-card-border, rgba(255, 255, 255, 0.1))',
              color: 'var(--theme-text-muted, #94a3b8)',
            }}
          >
            <button onClick={() => setIsOcrPaused(!isOcrPaused)} className="flex items-center gap-1 hover:opacity-80 transition-opacity cursor-pointer">
              <span className={`w-1.5 h-1.5 rounded-full ${isOcrPaused ? 'bg-rose-500' : 'bg-emerald-400 animate-pulse'}`}></span>
              <span>OCR</span>
            </button>
            <span className="opacity-40">│</span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>IA</span>
            </span>
            <span className="opacity-40">│</span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span>Cámara</span>
            </span>
            <span className="opacity-40">│</span>
            <span className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${pairingStatus === 'paired' || deviceMode === 'server' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
              <span>TV</span>
            </span>
            <span className="opacity-40">│</span>
            <button onClick={() => setMusicConfig({ ...musicConfig, enabled: !musicConfig.enabled })} className="flex items-center gap-1 hover:opacity-80 transition-opacity cursor-pointer">
              <span className={`w-1.5 h-1.5 rounded-full ${musicConfig.enabled ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`}></span>
              <span>Música</span>
            </button>
            <span className="opacity-40">│</span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span>WebSocket</span>
            </span>
            <span className="opacity-40">│</span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span>Sync</span>
            </span>
          </div>

          {/* Derecha: Hora + Indicador Dispositivo + Dispositivos + Configuración + Fullscreen */}
          <div className="flex items-center gap-2 text-xs font-mono">
            {/* Badge de Detección de Dispositivo */}
            <span 
              className="inline-flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1 border rounded-lg uppercase cursor-pointer transition-colors"
              style={{
                backgroundColor: 'var(--theme-input-bg, #0f172a)',
                borderColor: 'var(--theme-card-border, rgba(255, 255, 255, 0.1))',
                color: 'var(--theme-text, #f8fafc)',
              }}
              onClick={() => setIsSettingsModalOpen(true)}
              title="Ajustes de Diseño Responsive Independiente"
            >
              {isPC && <Monitor size={13} className="text-indigo-400" />}
              {isTablet && <Tablet size={13} className="text-amber-400" />}
              {isMobile && <Smartphone size={13} className="text-emerald-400" />}
              <span>{deviceType}</span>
            </span>

            <span 
              className="font-bold px-2.5 py-1 border rounded-lg"
              style={{
                backgroundColor: 'var(--theme-input-bg, #0f172a)',
                borderColor: 'var(--theme-card-border, rgba(255, 255, 255, 0.1))',
                color: 'var(--theme-primary, #6366f1)',
              }}
            >
              {clockTime || '00:00:00'}
            </span>

            <span 
              className="hidden sm:inline-flex items-center gap-1 text-[10px] px-2.5 py-1 border rounded-lg"
              style={{
                backgroundColor: 'var(--theme-input-bg, #0f172a)',
                borderColor: 'var(--theme-card-border, rgba(255, 255, 255, 0.1))',
                color: 'var(--theme-text-muted, #94a3b8)',
              }}
            >
              <Smartphone size={12} className="text-emerald-400" />
              <span>{connectedClients.filter(c => c.connected).length || 1} Devs</span>
            </span>

            <button
              onClick={() => setIsSettingsModalOpen(true)}
              className="p-1.5 border rounded-lg cursor-pointer transition-all hover:brightness-125"
              style={{
                backgroundColor: 'var(--theme-input-bg, #0f172a)',
                borderColor: 'var(--theme-card-border, rgba(255, 255, 255, 0.1))',
                color: 'var(--theme-text, #f8fafc)',
              }}
              title="Configuración General"
            >
              <SettingsIcon size={14} />
            </button>

            <button
              onClick={toggleFullscreen}
              className="p-1.5 border rounded-lg cursor-pointer transition-all hover:brightness-125"
              style={{
                backgroundColor: 'var(--theme-input-bg, #0f172a)',
                borderColor: 'var(--theme-card-border, rgba(255, 255, 255, 0.1))',
                color: 'var(--theme-text, #f8fafc)',
              }}
              title={isFullscreen ? "Salir de pantalla completa" : "Modo Pantalla Completa"}
            >
              {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
            </button>
          </div>

        </div>
      </header>

      {/* MENÚ DE COMPONENTES REDUCIDO */}
      <div 
        className="border-b px-4 py-2 sticky top-[49px] z-40 transition-colors duration-300"
        style={{
          backgroundColor: 'var(--theme-bg, #020617)',
          borderColor: 'var(--theme-card-border, rgba(255, 255, 255, 0.1))',
          color: 'var(--theme-text, #f8fafc)',
        }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => { setActiveTab('board'); localStorage.setItem('activeTab', 'board'); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                activeTab === 'board' 
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20' 
                  : 'hover:brightness-110'
              }`}
              style={activeTab !== 'board' ? {
                backgroundColor: 'var(--theme-card-bg, #0f172a)',
                borderColor: 'var(--theme-card-border, rgba(255, 255, 255, 0.1))',
                color: 'var(--theme-text-muted, #94a3b8)',
              } : {}}
            >
              <LayoutGrid size={14} />
              <span>Panel (PC)</span>
            </button>

            <button
              onClick={() => { setActiveTab('tablet'); localStorage.setItem('activeTab', 'tablet'); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer border ${
                activeTab === 'tablet' 
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20' 
                  : 'hover:brightness-110'
              }`}
              style={activeTab !== 'tablet' ? {
                backgroundColor: 'var(--theme-card-bg, #0f172a)',
                borderColor: 'var(--theme-card-border, rgba(255, 255, 255, 0.1))',
                color: 'var(--theme-text-muted, #94a3b8)',
              } : {}}
            >
              <Tablet size={14} />
              <span>Modo Tablet</span>
            </button>

            <button
              onClick={() => setActiveTab('tv_view')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                activeTab === 'tv_view' 
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20' 
                  : 'hover:brightness-110'
              }`}
              style={activeTab !== 'tv_view' ? {
                backgroundColor: 'var(--theme-card-bg, #0f172a)',
                borderColor: 'var(--theme-card-border, rgba(255, 255, 255, 0.1))',
                color: 'var(--theme-text-muted, #94a3b8)',
              } : {}}
            >
              <Tv size={14} />
              <span>Pantalla TV</span>
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                activeTab === 'history' 
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20' 
                  : 'hover:brightness-110'
              }`}
              style={activeTab !== 'history' ? {
                backgroundColor: 'var(--theme-card-bg, #0f172a)',
                borderColor: 'var(--theme-card-border, rgba(255, 255, 255, 0.1))',
                color: 'var(--theme-text-muted, #94a3b8)',
              } : {}}
            >
              <History size={14} />
              <span>Historial</span>
            </button>

            <button
              onClick={() => setActiveTab('stats')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                activeTab === 'stats' 
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20' 
                  : 'hover:brightness-110'
              }`}
              style={activeTab !== 'stats' ? {
                backgroundColor: 'var(--theme-card-bg, #0f172a)',
                borderColor: 'var(--theme-card-border, rgba(255, 255, 255, 0.1))',
                color: 'var(--theme-text-muted, #94a3b8)',
              } : {}}
            >
              <BarChart2 size={14} />
              <span>Estadísticas</span>
            </button>

            <button
              onClick={() => setIsSettingsModalOpen(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer hover:brightness-110"
              style={{
                backgroundColor: 'var(--theme-card-bg, #0f172a)',
                borderColor: 'var(--theme-card-border, rgba(255, 255, 255, 0.1))',
                color: 'var(--theme-text-muted, #94a3b8)',
              }}
            >
              <SettingsIcon size={14} />
              <span>Configuración</span>
            </button>
          </div>

          {/* Botón flotante para música */}
          <button
            onClick={() => setIsMusicModalOpen(true)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
              musicConfig.enabled
                ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300 shadow-sm'
                : 'hover:brightness-110'
            }`}
            style={!musicConfig.enabled ? {
              backgroundColor: 'var(--theme-card-bg, #0f172a)',
              borderColor: 'var(--theme-card-border, rgba(255, 255, 255, 0.1))',
              color: 'var(--theme-text-muted, #94a3b8)',
            } : {}}
          >
            <Music size={14} className={musicConfig.enabled ? "text-emerald-400 animate-pulse" : ""} />
            <span>🎵 Música</span>
          </button>
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL ADAPTATIVO */}
      <main className={`flex-1 max-w-full lg:max-w-7xl w-full mx-auto p-3 md:p-4 overflow-x-hidden ${isMobile ? 'pb-24' : ''}`}>
        {!isDBReady ? (
          <div className="py-24 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-slate-400 text-sm">Cargando base de datos IndexedDB...</p>
          </div>
        ) : (
          <div className="h-full">
            
            {/* VISTA 0: MODO TABLET TÁCTIL CON ESCÁNER OCR INTEGRADO Y DISPENSADOR NUMÉRICO */}
            {activeTab === 'tablet' && (
              <TabletDashboardView
                tickets={tickets}
                activeTicket={activeTicket}
                onCallNext={handleCallNext}
                onAddTicket={handleAddTicket}
                onResolveTicket={handleMarkDelivered}
                onMarkMissing={handleMarkMissing}
                onRepeatCall={handleRepeatCall}
                onClearQueue={handleClearQueue}
                onDeliverTicket={handleMarkDelivered}
                onCallTicketNow={handleCallTicketNow}
                onReturnToWaiting={handleReturnToWaiting}
                onDeleteTicket={handleDeleteTicket}
                onTogglePriority={handleTogglePriority}
                selectedReadyTicketId={selectedReadyTicketId}
                onSelectReadyTicket={setSelectedReadyTicketId}
                selectedWaitingTicketId={selectedWaitingTicketId}
                onSelectWaitingTicket={setSelectedWaitingTicketId}
                isWaitlistPaused={isWaitlistPaused}
                onTogglePauseWaitlist={handleToggleWaitlistPause}
                isAutoCallActive={isAutonomousMode}
                onToggleAutoCall={handleToggleAutonomousMode}
                appConfig={appConfig}
                voiceSettings={voiceSettings}
                musicConfig={musicConfig}
                activeTab={activeTab}
                setActiveTab={(tab) => {
                  setActiveTab(tab);
                  localStorage.setItem('activeTab', tab);
                }}
                pairingCode={pairingCode}
                pairingStatus={pairingStatus}
                isOcrPaused={isOcrPaused}
                setIsOcrPaused={setIsOcrPaused}
                onOpenMusicModal={() => setIsMusicModalOpen(true)}
                onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
                setDeviceMode={setDeviceMode}
                deviceMode={deviceMode}
              />
            )}

            {/* VISTA 1: PANEL PRINCIPAL COMPACTO DE 3 COLUMNAS CON BARRA DE HERRAMIENTAS RÁPIDAS */}
            {activeTab === 'board' && (
              <div className="space-y-4">
                
                {/* BARRA DE HERRAMIENTAS RÁPIDAS DEL MENÚ PRINCIPAL */}
                <div 
                  className="rounded-2xl p-2.5 backdrop-blur-md shadow-xl flex flex-wrap items-center justify-between gap-3 border"
                  style={{
                    backgroundColor: 'var(--theme-card-bg, #0f172a)',
                    borderColor: 'var(--theme-card-border, rgba(255, 255, 255, 0.1))',
                    color: 'var(--theme-text, #f8fafc)',
                  }}
                >
                  
                  {/* Izquierda: Botón Prominente Llamar Siguiente + Campo de Megafonía */}
                  <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[300px]">
                    <button
                      onClick={handleCallNext}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-lg shadow-emerald-600/25 flex items-center gap-2 cursor-pointer transition-all active:scale-95 shrink-0"
                      title="Llamar al siguiente ticket en espera (Teclas N o Espacio)"
                    >
                      <Zap size={15} className="fill-current text-amber-300 animate-pulse" />
                      <span>LLAMAR SIGUIENTE</span>
                      {nextTicketNumber && (
                        <span className="bg-emerald-950/90 border border-emerald-400/40 text-emerald-200 font-mono text-[10px] px-2 py-0.5 rounded-md font-extrabold">
                          #{nextTicketNumber}
                        </span>
                      )}
                    </button>

                    {/* Megafonía TTS Directa */}
                    <div 
                      className="flex items-center gap-1.5 border rounded-xl px-2.5 py-1 flex-1 min-w-[220px]"
                      style={{
                        backgroundColor: 'var(--theme-input-bg, #0f172a)',
                        borderColor: 'var(--theme-card-border, rgba(255, 255, 255, 0.1))',
                      }}
                    >
                      <Megaphone size={14} className="text-indigo-400 shrink-0" />
                      <input
                        type="text"
                        value={customTTSInput}
                        onChange={(e) => setCustomTTSInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleCustomAnnouncement();
                          }
                        }}
                        placeholder="Escribe mensaje o ticket para anunciar..."
                        className="bg-transparent border-none text-xs focus:outline-none w-full px-1 py-0.5 font-medium"
                        style={{ color: 'var(--theme-text, #f8fafc)' }}
                      />
                      <button
                        type="button"
                        onClick={handleCustomAnnouncement}
                        disabled={!customTTSInput.trim()}
                        className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white font-bold text-[10px] rounded-lg transition-all cursor-pointer shrink-0"
                      >
                        Anunciar
                      </button>
                    </div>
                  </div>

                  {/* Derecha: Toggles y Controles de Herramientas */}
                  <div className="flex items-center gap-2 overflow-x-auto scrollbar-none shrink-0 text-xs font-mono">
                    <button
                      onClick={handleToggleAutonomousMode}
                      className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 font-bold transition-all cursor-pointer ${
                        isAutonomousMode
                          ? 'bg-amber-950/80 border-amber-500/50 text-amber-300 shadow-sm'
                          : 'hover:brightness-110'
                      }`}
                      style={!isAutonomousMode ? {
                        backgroundColor: 'var(--theme-input-bg, #0f172a)',
                        borderColor: 'var(--theme-card-border, rgba(255, 255, 255, 0.1))',
                        color: 'var(--theme-text-muted, #94a3b8)',
                      } : {}}
                      title="Auto-llamada inteligente de tickets"
                    >
                      <Brain size={13} className={isAutonomousMode ? "text-amber-400 animate-spin" : ""} />
                      <span>Auto-Llamador: {isAutonomousMode ? 'ON' : 'OFF'}</span>
                    </button>

                    <button
                      onClick={() => {
                        const next = !isOcrPaused;
                        setIsOcrPaused(next);
                        triggerConfigSavedToast(next ? 'Escáner OCR Pausado' : 'Escáner OCR Activo');
                      }}
                      className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 font-bold transition-all cursor-pointer ${
                        !isOcrPaused
                          ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300 shadow-sm'
                          : 'hover:brightness-110'
                      }`}
                      style={isOcrPaused ? {
                        backgroundColor: 'var(--theme-input-bg, #0f172a)',
                        borderColor: 'var(--theme-card-border, rgba(255, 255, 255, 0.1))',
                        color: 'var(--theme-text-muted, #94a3b8)',
                      } : {}}
                      title="Lector automático de cámara OCR"
                    >
                      <Camera size={13} className={!isOcrPaused ? "text-emerald-400 animate-pulse" : ""} />
                      <span>OCR: {!isOcrPaused ? 'ACTIVO' : 'PAUSA'}</span>
                    </button>

                    <button
                      onClick={handleToggleWaitlistPause}
                      className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 font-bold transition-all cursor-pointer ${
                        isWaitlistPaused
                          ? 'bg-rose-950/80 border-rose-500/50 text-rose-300 shadow-sm'
                          : 'hover:brightness-110'
                      }`}
                      style={!isWaitlistPaused ? {
                        backgroundColor: 'var(--theme-input-bg, #0f172a)',
                        borderColor: 'var(--theme-card-border, rgba(255, 255, 255, 0.1))',
                        color: 'var(--theme-text-muted, #94a3b8)',
                      } : {}}
                      title="Pausar o reanudar asignación de cola"
                    >
                      <Pause size={13} className={isWaitlistPaused ? "text-rose-400 animate-pulse" : ""} />
                      <span>Cola: {isWaitlistPaused ? 'PAUSADA' : 'OK'}</span>
                    </button>

                    <button
                      onClick={handleClearQueue}
                      className="px-3 py-1.5 rounded-xl hover:bg-rose-950/50 hover:text-rose-300 border hover:border-rose-800/60 font-bold transition-all cursor-pointer flex items-center gap-1.5"
                      style={{
                        backgroundColor: 'var(--theme-input-bg, #0f172a)',
                        borderColor: 'var(--theme-card-border, rgba(255, 255, 255, 0.1))',
                        color: 'var(--theme-text-muted, #94a3b8)',
                      }}
                      title="Vaciar tickets activos y en espera"
                    >
                      <RotateCcw size={13} />
                      <span>Vaciar</span>
                    </button>
                  </div>

                </div>

                {/* REJILLA DE 3 COLUMNAS */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                
                {/* COLUMNA 1 (Izquierda): ENTRADA RÁPIDA + LISTA ESPERA COMPACTA */}
                <div className="lg:col-span-3 space-y-4">
                  {/* Entrada Rápida de Tickets 3 Dígitos */}
                  <ManualInput onAddTicket={handleAddTicket} />

                  {/* Lista de Espera Compacta en Filas */}
                  <WaitingList
                    tickets={waitingTickets}
                    onRaisePriority={handleRaisePriority}
                    onDeleteTicket={handleDeleteTicket}
                    selectedWaitingTicketId={selectedWaitingTicketId}
                    onSelectWaitingTicket={setSelectedWaitingTicketId}
                    onAddDirectTicket={handleAddDirectWaitingTicket}
                    waitingSelectedColor={appConfig.waitingSelectedColor}
                    isWaitlistPaused={isWaitlistPaused}
                    onToggleWaitlistPause={handleToggleWaitlistPause}
                    onCallNow={handleCallTicketNow}
                    onTogglePriority={handleTogglePriority}
                  />
                </div>

                {/* COLUMNA 2 (Centro - Héroe): TICKET ACTIVO GIGANTE + PEDIDOS LISTOS */}
                <div className="lg:col-span-5 space-y-4">
                  {/* Ticket Activo Héroe Prominente */}
                  <ActiveTicket
                    activeTicket={activeTicket}
                    announcementCount={announcementCount}
                    onSpeakActive={handleRepeatCall}
                    onMarkDelivered={handleMarkDelivered}
                    onReturnToWaiting={handleReturnToWaiting}
                    onMarkMissing={handleMarkMissing}
                    onCallNext={handleCallNext}
                    nextTicketNumber={nextTicketNumber}
                    waitingCount={waitingTickets.length}
                    activeGlowColor={appConfig.activeGlowColor}
                    onDeleteTicket={handleDeleteTicket}
                  />

                  {/* Pedidos Listos Compacto en Filas */}
                  <ReadyList
                    tickets={tickets.filter((t) => t.status === 'active')}
                    onDeliver={handleMarkDelivered}
                    onCallNow={handleCallTicketNow}
                    onReturnToWaiting={handleReturnToWaiting}
                    onDeleteTicket={handleDeleteTicket}
                    activeGlowColor={appConfig.activeGlowColor}
                    selectedReadyTicketId={selectedReadyTicketId}
                    onSelectReadyTicket={setSelectedReadyTicketId}
                  />
                </div>

                {/* COLUMNA 3 (Derecha): ESCÁNER OCR WHATSAPP WEB + IA OCR + TV STATUS */}
                <div className="lg:col-span-4 space-y-4">
                  {/* Escáner OCR Compacto */}
                  <CameraOCR
                    onAddTicket={handleAddTicket}
                    existingTicketNumbers={new Set(tickets.map((t) => t.number))}
                    maxTicketsSimultaneous={appConfig.maxOcrSimultaneous}
                    isOcrPausedProps={isOcrPaused}
                    onToggleOcrPauseProps={setIsOcrPaused}
                    isEmbeddedMain={true}
                    onOpenFullOcrTab={() => setActiveTab('ocr')}
                  />

                  {/* Tarjeta IA OCR Autónoma */}
                  <div 
                    className="border rounded-2xl p-3.5 space-y-3"
                    style={{
                      backgroundColor: 'var(--theme-card-bg, #0f172a)',
                      borderColor: 'var(--theme-card-border, rgba(255, 255, 255, 0.1))',
                      color: 'var(--theme-text, #f8fafc)',
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
                          <Brain size={16} />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--theme-text, #f8fafc)' }}>IA OCR AUTÓNOMA</h4>
                          <p className="text-[10px]" style={{ color: 'var(--theme-text-muted, #94a3b8)' }}>Motor de aprendizaje continuo</p>
                        </div>
                      </div>
                      <span className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[9px] font-mono px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Aprendizaje: Activo
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                      <div 
                        className="p-2 rounded-xl border"
                        style={{
                          backgroundColor: 'var(--theme-input-bg, #0f172a)',
                          borderColor: 'var(--theme-card-border, rgba(255, 255, 255, 0.1))',
                        }}
                      >
                        <span className="text-[9px] block uppercase opacity-60" style={{ color: 'var(--theme-text-muted, #94a3b8)' }}>Tickets aprendidos</span>
                        <span className="text-indigo-300 font-bold">5420</span>
                      </div>
                      <div 
                        className="p-2 rounded-xl border"
                        style={{
                          backgroundColor: 'var(--theme-input-bg, #0f172a)',
                          borderColor: 'var(--theme-card-border, rgba(255, 255, 255, 0.1))',
                        }}
                      >
                        <span className="text-[9px] block uppercase opacity-60" style={{ color: 'var(--theme-text-muted, #94a3b8)' }}>Correcciones</span>
                        <span className="text-amber-400 font-bold">31</span>
                      </div>
                      <div 
                        className="p-2 rounded-xl border"
                        style={{
                          backgroundColor: 'var(--theme-input-bg, #0f172a)',
                          borderColor: 'var(--theme-card-border, rgba(255, 255, 255, 0.1))',
                        }}
                      >
                        <span className="text-[9px] block uppercase opacity-60" style={{ color: 'var(--theme-text-muted, #94a3b8)' }}>Precisión</span>
                        <span className="text-emerald-400 font-bold">99.7%</span>
                      </div>
                      <div 
                        className="p-2 rounded-xl border"
                        style={{
                          backgroundColor: 'var(--theme-input-bg, #0f172a)',
                          borderColor: 'var(--theme-card-border, rgba(255, 255, 255, 0.1))',
                        }}
                      >
                        <span className="text-[9px] block uppercase opacity-60" style={{ color: 'var(--theme-text-muted, #94a3b8)' }}>Velocidad</span>
                        <span className="text-emerald-300 font-bold">1.3 t/seg</span>
                      </div>
                    </div>
                  </div>

                  {/* Tarjeta TV Status & Sincronización */}
                  <div 
                    className="border rounded-2xl p-3.5 space-y-3"
                    style={{
                      backgroundColor: 'var(--theme-card-bg, #0f172a)',
                      borderColor: 'var(--theme-card-border, rgba(255, 255, 255, 0.1))',
                      color: 'var(--theme-text, #f8fafc)',
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
                          <Tv size={16} />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold" style={{ color: 'var(--theme-text, #f8fafc)' }}>Pantalla TV Pública</h4>
                          <p className="text-[10px]" style={{ color: 'var(--theme-text-muted, #94a3b8)' }}>Sincronización directa sin recargar</p>
                        </div>
                      </div>
                      <span className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[9px] font-mono px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        🟢 TV CONECTADA
                      </span>
                    </div>

                    <div 
                      className="flex items-center justify-between text-xs font-mono p-2.5 rounded-xl border"
                      style={{
                        backgroundColor: 'var(--theme-input-bg, #0f172a)',
                        borderColor: 'var(--theme-card-border, rgba(255, 255, 255, 0.1))',
                      }}
                    >
                      <div>
                        <span className="text-[9px] block uppercase opacity-60" style={{ color: 'var(--theme-text-muted, #94a3b8)' }}>Flujo OCR → TV</span>
                        <span className="text-emerald-400 font-bold">Listos (Directo)</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] block uppercase opacity-60" style={{ color: 'var(--theme-text-muted, #94a3b8)' }}>Estado Cola</span>
                        <span className="text-indigo-300 font-bold">Sincronizada</span>
                      </div>
                    </div>

                    <button
                      onClick={() => setActiveTab('tv_view')}
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md flex items-center justify-center gap-2"
                    >
                      <Tv size={14} />
                      <span>Abrir Pantalla TV</span>
                    </button>
                  </div>

                </div>
              </div>
            </div>
          )}

            {/* VISTA 2: PANTALLA TV COMPLETA */}
            {activeTab === 'tv_view' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center bg-slate-900 p-3 rounded-2xl border border-slate-800">
                  <span className="text-xs font-bold text-slate-300">Vista previa de Pantalla TV pública</span>
                  <button
                    onClick={() => setActiveTab('board')}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    ← Volver al Panel
                  </button>
                </div>
                <div className="aspect-video w-full rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
                  <PublicDisplayView
                    activeTicket={activeTicket}
                    tickets={tickets}
                    pairingStatus={pairingStatus}
                    serverIP={serverIP}
                    appConfig={appConfig}
                    onSelectMode={(mode) => handleSelectMode(mode)}
                    onMediaMissing={handleMediaMissing}
                    syncVersion={syncVersion}
                    lastSyncTime={lastSyncTime}
                    lastLatency={lastLatency}
                    lastReceivedEvent={lastReceivedEvent}
                    onForceReconnect={handleForceReconnect}
                  />
                </div>
              </div>
            )}

            {/* VISTA 3: ESCÁNER OCR MODO COMPLETO */}
            {activeTab === 'ocr' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-8">
                  <CameraOCR
                    onAddTicket={handleAddTicket}
                    existingTicketNumbers={new Set(tickets.map((t) => t.number))}
                    maxTicketsSimultaneous={appConfig.maxOcrSimultaneous}
                    isOcrPausedProps={isOcrPaused}
                    onToggleOcrPauseProps={setIsOcrPaused}
                  />
                </div>
                <div className="lg:col-span-4 space-y-6">
                  <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
                    <h3 className="font-bold text-slate-200 flex items-center gap-2 text-sm uppercase tracking-wider text-indigo-400">
                      <AlertCircle size={16} />
                      Instrucciones de Escaneo
                    </h3>
                    <ul className="text-xs text-slate-400 space-y-3 leading-relaxed list-disc list-inside">
                      <li>El escáner analiza la imagen en busca de números grandes de ticket de 1-3 dígitos.</li>
                      <li>Ignora automáticamente fechas, importes, monedas y teléfonos.</li>
                      <li>Evita duplicados automáticamente.</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* VISTA 4: HISTORIAL */}
            {activeTab === 'history' && (
              <HistoryPanel
                tickets={tickets}
                onDeleteTicket={handleDeleteTicket}
                onClearHistory={handleClearHistory}
              />
            )}

            {/* VISTA 5: ESTADÍSTICAS */}
            {activeTab === 'stats' && (
              <StatisticsPanel tickets={tickets} activeTicket={activeTicket} />
            )}

            {/* VISTA 6: CONFIGURACIÓN PANTALLA COMPLETA */}
            {activeTab === 'settings' && (
              <SettingsPanel
                voiceSettings={voiceSettings}
                shortcutConfig={shortcutConfig}
                appConfig={appConfig}
                musicConfig={musicConfig}
                onSaveVoiceSettings={handleSaveVoiceSettings}
                onSaveShortcutConfig={handleSaveShortcutConfig}
                onSaveAppConfig={handleSaveAppConfig}
                onSaveMusicConfig={handleSaveMusicConfig}
                tickets={tickets}
                onImportBackup={handleImportBackup}
                deviceMode={deviceMode}
                clientRole={clientRole}
                pairingCode={pairingCode}
                pairingStatus={pairingStatus}
                serverIP={serverIP}
                deviceName={deviceName}
                connectedClients={connectedClients}
                onSelectMode={handleSelectMode}
                onSetClientRole={handleSetClientRole}
                onSetDeviceName={handleSetDeviceName}
                onSetServerIP={handleSetServerIP}
                onStartPairing={handleStartPairing}
                onRenameClient={handleRenameClient}
                onRemoveClient={handleRemoveClient}
                onBlockClient={handleBlockDevice}
                onUnblockClient={handleUnblockDevice}
                onDisconnect={handleDisconnect}
                availableRooms={availableRooms}
                lastConnectionError={lastConnectionError}
              />
            )}

            {/* VISTA 7: DISPOSITIVOS */}
            {activeTab === 'devices' && (
              <DevicesPanel
                deviceMode={deviceMode}
                clientRole={clientRole}
                pairingCode={pairingCode}
                pairingStatus={pairingStatus}
                serverIP={serverIP}
                deviceName={deviceName}
                connectedClients={connectedClients}
                onSelectMode={handleSelectMode}
                onSetClientRole={handleSetClientRole}
                onSetDeviceName={handleSetDeviceName}
                onSetServerIP={handleSetServerIP}
                onStartPairing={handleStartPairing}
                onRenameClient={handleRenameClient}
                onRemoveClient={handleRemoveClient}
                onBlockClient={handleBlockDevice}
                onUnblockClient={handleUnblockDevice}
                onDisconnect={handleDisconnect}
                availableRooms={availableRooms}
                lastConnectionError={lastConnectionError}
              />
            )}

          </div>
        )}
      </main>

      {/* MODAL DE CONFIGURACIÓN GENERAL */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden shadow-2xl relative">
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950">
              <div className="flex items-center gap-2">
                <SettingsIcon size={18} className="text-indigo-400" />
                <h3 className="font-bold text-slate-100 text-sm">Configuración del Sistema</h3>
              </div>
              <button
                onClick={() => setIsSettingsModalOpen(false)}
                className="p-1.5 bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <SettingsPanel
                voiceSettings={voiceSettings}
                shortcutConfig={shortcutConfig}
                appConfig={appConfig}
                musicConfig={musicConfig}
                onSaveVoiceSettings={handleSaveVoiceSettings}
                onSaveShortcutConfig={handleSaveShortcutConfig}
                onSaveAppConfig={handleSaveAppConfig}
                onSaveMusicConfig={handleSaveMusicConfig}
                tickets={tickets}
                onImportBackup={handleImportBackup}
                deviceMode={deviceMode}
                clientRole={clientRole}
                pairingCode={pairingCode}
                pairingStatus={pairingStatus}
                serverIP={serverIP}
                deviceName={deviceName}
                connectedClients={connectedClients}
                onSelectMode={(mode) => {
                  setIsSettingsModalOpen(false);
                  handleSelectMode(mode);
                }}
                onSetClientRole={handleSetClientRole}
                onSetDeviceName={handleSetDeviceName}
                onSetServerIP={handleSetServerIP}
                onStartPairing={handleStartPairing}
                onRenameClient={handleRenameClient}
                onRemoveClient={handleRemoveClient}
                onBlockClient={handleBlockDevice}
                onUnblockClient={handleUnblockDevice}
                onDisconnect={handleDisconnect}
                availableRooms={availableRooms}
                lastConnectionError={lastConnectionError}
              />
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE MÚSICA FLOTANTE */}
      {isMusicModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden relative space-y-4 p-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Music size={18} className="text-emerald-400 animate-pulse" />
                <h3 className="font-bold text-slate-100 text-sm">Panel Flotante de Música Ambient</h3>
              </div>
              <button
                onClick={() => setIsMusicModalOpen(false)}
                className="p-1.5 bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <BackgroundMusicPlayer
              musicConfig={musicConfig}
              onSaveMusicConfig={handleSaveMusicConfig}
            />
          </div>
        </div>
      )}

      {/* Persistent Background Music Integrated Player across all tabs */}
      {musicConfig.enabled && musicConfig.integratedEnabled && (
        <BackgroundMusicPlayer
          musicConfig={musicConfig}
          onSaveMusicConfig={handleSaveMusicConfig}
        />
      )}



      {/* Subtle Footer bar */}
      <footer 
        className="border-t py-4 mt-8 transition-colors duration-300"
        style={{
          backgroundColor: 'var(--theme-card-bg, #0f172a)',
          borderColor: 'var(--theme-card-border, rgba(255, 255, 255, 0.1))',
          color: 'var(--theme-text-muted, #94a3b8)',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] font-mono">
          <span>Gestor y Pantalla de Tickets de Restaurante © 2026</span>
          <div className="flex gap-4">
            <span>IndexedDB activo</span>
            <span>Web Speech TTS</span>
            <span>Tesseract OCR</span>
          </div>
        </div>
      </footer>

      {/* Floating Keyboard Shortcut Activation Toast */}
      <AnimatePresence>
        {shortcutNotification && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-[9999] backdrop-blur-md border py-2.5 px-5 rounded-2xl shadow-2xl flex items-center gap-3.5"
            style={{
              backgroundColor: 'var(--theme-card-bg, #0f172a)',
              borderColor: 'var(--theme-card-border, rgba(255, 255, 255, 0.2))',
              color: 'var(--theme-text, #f8fafc)',
            }}
          >
            <div className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
              <Keyboard size={14} />
            </div>
            <div className="text-xs">
              <span style={{ color: 'var(--theme-text-muted, #94a3b8)' }}>Atajo activado: </span>
              <strong style={{ color: 'var(--theme-text, #f8fafc)' }}>{shortcutNotification.action}</strong>
              <span className="ml-2 font-mono border px-1.5 py-0.5 rounded font-extrabold text-[10px]" style={{ backgroundColor: 'var(--theme-input-bg, #0f172a)', borderColor: 'var(--theme-card-border, rgba(255, 255, 255, 0.1))', color: 'var(--theme-primary, #6366f1)' }}>
                {shortcutNotification.key}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Config Saved Toast */}
      <AnimatePresence>
        {configSavedToast && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-[99999] bg-emerald-900/90 backdrop-blur-md border border-emerald-500/30 text-emerald-100 py-3 px-5 rounded-2xl shadow-2xl flex items-center gap-2.5 font-sans"
          >
            <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white">
              <Check size={12} />
            </div>
            <span className="text-xs font-bold">{configSavedToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Handshake/Authorization request Modal overlay (PC Server view only) */}
      {deviceMode === 'server' && pendingAuthRequests.length > 0 && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[99999] px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full max-w-md border rounded-2xl p-6 shadow-2xl space-y-5"
            style={{
              backgroundColor: 'var(--theme-card-bg, #0f172a)',
              borderColor: 'var(--theme-card-border, rgba(255, 255, 255, 0.1))',
              color: 'var(--theme-text, #f8fafc)',
            }}
          >
            <div className="flex items-start gap-4">
              <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl">
                <Smartphone className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold" style={{ color: 'var(--theme-text, #f8fafc)' }}>Solicitud de Conexión</h3>
                <p className="text-xs font-sans" style={{ color: 'var(--theme-text-muted, #94a3b8)' }}>
                  Un nuevo dispositivo de tu red local está intentando vincularse.
                </p>
              </div>
            </div>

            <div 
              className="p-4 rounded-xl border font-mono text-xs space-y-2"
              style={{
                backgroundColor: 'var(--theme-input-bg, #0f172a)',
                borderColor: 'var(--theme-card-border, rgba(255, 255, 255, 0.1))',
              }}
            >
              <div className="flex justify-between">
                <span style={{ color: 'var(--theme-text-muted, #94a3b8)' }}>Nombre:</span>
                <span className="font-bold" style={{ color: 'var(--theme-text, #f8fafc)' }}>{pendingAuthRequests[0].deviceName}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--theme-text-muted, #94a3b8)' }}>Tipo de rol:</span>
                <span className="text-indigo-400 font-bold uppercase">{pendingAuthRequests[0].deviceType || 'Tablet'}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-mono text-[10px]" style={{ color: 'var(--theme-text-muted, #94a3b8)' }}>ID único:</span>
                <span className="font-mono text-[10px] truncate max-w-[180px]" style={{ color: 'var(--theme-text-muted, #94a3b8)' }}>{pendingAuthRequests[0].deviceId}</span>
              </div>
            </div>

            {/* Checkbox to remember device */}
            <label className="flex items-center gap-3 cursor-pointer select-none text-xs p-3 rounded-xl border hover:brightness-110 transition-colors" style={{ backgroundColor: 'var(--theme-input-bg, #0f172a)', borderColor: 'var(--theme-card-border, rgba(255, 255, 255, 0.1))', color: 'var(--theme-text, #f8fafc)' }}>
              <input
                type="checkbox"
                id="remember-device-checkbox"
                defaultChecked={true}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <span className="font-semibold">Recordar este dispositivo en el futuro</span>
            </label>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => handleRejectDevice(
                  pendingAuthRequests[0].deviceId,
                  pendingAuthRequests[0].deviceName,
                  pendingAuthRequests[0].deviceType
                )}
                className="flex-1 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
              >
                Rechazar
              </button>
              <button
                type="button"
                onClick={() => {
                  const chk = document.getElementById('remember-device-checkbox') as HTMLInputElement;
                  handleApproveDevice(
                    pendingAuthRequests[0].deviceId,
                    pendingAuthRequests[0].deviceName,
                    pendingAuthRequests[0].deviceType,
                    chk ? chk.checked : true
                  );
                }}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer text-center shadow-lg shadow-indigo-600/10"
              >
                Permitir conexión
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* NAVEGACIÓN INFERIOR EXCLUSIVA PARA MÓVIL (Uso con una sola mano, área táctil >= 44px) */}
      {isMobile && (
        <nav 
          className="fixed bottom-0 left-0 right-0 z-50 border-t backdrop-blur-xl p-1 shadow-2xl flex items-center justify-around pb-safe transition-colors duration-300"
          style={{
            backgroundColor: 'var(--theme-card-bg, #0f172a)',
            borderColor: 'var(--theme-card-border, rgba(255, 255, 255, 0.1))',
            color: 'var(--theme-text, #f8fafc)',
          }}
        >
          <button
            onClick={() => setActiveTab('board')}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl min-h-[44px] min-w-[56px] transition-all cursor-pointer border ${
              activeTab === 'board'
                ? 'font-extrabold shadow-sm'
                : 'hover:opacity-80'
            }`}
            style={activeTab === 'board' ? {
              backgroundColor: 'var(--theme-input-bg, #0f172a)',
              borderColor: 'var(--theme-card-border, rgba(255, 255, 255, 0.2))',
              color: 'var(--theme-primary, #6366f1)',
            } : {
              backgroundColor: 'transparent',
              borderColor: 'transparent',
              color: 'var(--theme-text-muted, #94a3b8)',
            }}
          >
            <LayoutGrid size={18} />
            <span className="text-[10px] mt-0.5">Tablero</span>
          </button>

          <button
            onClick={() => setActiveTab('tablet')}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl min-h-[44px] min-w-[56px] transition-all cursor-pointer border ${
              activeTab === 'tablet'
                ? 'font-extrabold shadow-sm'
                : 'hover:opacity-80'
            }`}
            style={activeTab === 'tablet' ? {
              backgroundColor: 'var(--theme-input-bg, #0f172a)',
              borderColor: 'var(--theme-card-border, rgba(255, 255, 255, 0.2))',
              color: 'var(--theme-primary, #6366f1)',
            } : {
              backgroundColor: 'transparent',
              borderColor: 'transparent',
              color: 'var(--theme-text-muted, #94a3b8)',
            }}
          >
            <Tablet size={18} />
            <span className="text-[10px] mt-0.5">Tablet</span>
          </button>

          <button
            onClick={() => setActiveTab('tv_view')}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl min-h-[44px] min-w-[56px] transition-all cursor-pointer border ${
              activeTab === 'tv_view'
                ? 'font-extrabold shadow-sm'
                : 'hover:opacity-80'
            }`}
            style={activeTab === 'tv_view' ? {
              backgroundColor: 'var(--theme-input-bg, #0f172a)',
              borderColor: 'var(--theme-card-border, rgba(255, 255, 255, 0.2))',
              color: 'var(--theme-primary, #6366f1)',
            } : {
              backgroundColor: 'transparent',
              borderColor: 'transparent',
              color: 'var(--theme-text-muted, #94a3b8)',
            }}
          >
            <Tv size={18} />
            <span className="text-[10px] mt-0.5">TV</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl min-h-[44px] min-w-[56px] transition-all cursor-pointer border ${
              activeTab === 'history'
                ? 'font-extrabold shadow-sm'
                : 'hover:opacity-80'
            }`}
            style={activeTab === 'history' ? {
              backgroundColor: 'var(--theme-input-bg, #0f172a)',
              borderColor: 'var(--theme-card-border, rgba(255, 255, 255, 0.2))',
              color: 'var(--theme-primary, #6366f1)',
            } : {
              backgroundColor: 'transparent',
              borderColor: 'transparent',
              color: 'var(--theme-text-muted, #94a3b8)',
            }}
          >
            <History size={18} />
            <span className="text-[10px] mt-0.5">Historial</span>
          </button>

          <button
            onClick={() => setActiveTab('stats')}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl min-h-[44px] min-w-[56px] transition-all cursor-pointer border ${
              activeTab === 'stats'
                ? 'font-extrabold shadow-sm'
                : 'hover:opacity-80'
            }`}
            style={activeTab === 'stats' ? {
              backgroundColor: 'var(--theme-input-bg, #0f172a)',
              borderColor: 'var(--theme-card-border, rgba(255, 255, 255, 0.2))',
              color: 'var(--theme-primary, #6366f1)',
            } : {
              backgroundColor: 'transparent',
              borderColor: 'transparent',
              color: 'var(--theme-text-muted, #94a3b8)',
            }}
          >
            <BarChart2 size={18} />
            <span className="text-[10px] mt-0.5">Stats</span>
          </button>

          <button
            onClick={() => setIsSettingsModalOpen(true)}
            className="flex flex-col items-center justify-center py-1 px-2.5 rounded-xl min-h-[44px] min-w-[56px] hover:opacity-80 transition-all cursor-pointer"
            style={{
              color: 'var(--theme-text-muted, #94a3b8)',
            }}
          >
            <SettingsIcon size={18} />
            <span className="text-[10px] mt-0.5">Ajustes</span>
          </button>
        </nav>
      )}
    </div>
  );
}
