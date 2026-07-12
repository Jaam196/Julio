import React, { useState, useEffect, useRef } from 'react';
import { Ticket, VoiceSettings, ShortcutConfig, AppConfig, MusicConfig } from './types';
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

import ManualInput from './components/ManualInput';
import ActiveTicket from './components/ActiveTicket';
import WaitingList from './components/WaitingList';
import PendingList from './components/PendingList';
import MissingList from './components/MissingList';
import CameraOCR from './components/CameraOCR';
import SettingsPanel from './components/SettingsPanel';
import HistoryPanel from './components/HistoryPanel';
import StatisticsPanel from './components/StatisticsPanel';
import BackgroundMusicPlayer from './components/BackgroundMusicPlayer';
import DevicesPanel from './components/DevicesPanel';

import { LayoutGrid, Camera, History, BarChart2, Settings as SettingsIcon, AlertCircle, Volume2, Keyboard, Play, Check, Trash2, ArrowRightLeft, Smartphone } from 'lucide-react';
import { matchesShortcut, shouldProcessShortcut, SHORTCUT_NAMES } from './utils/shortcutHelper';
import { AnimatePresence, motion } from 'motion/react';

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
};

const DEFAULT_APP_CONFIG: AppConfig = {
  maxOcrSimultaneous: 3,
  theme: 'dark',
  activeGlowColor: '#6366f1',
  waitingSelectedColor: '#4f46e5',
  pendingSelectedColor: '#f59e0b',
  demoteActivePosition: 'start',
};

const DEFAULT_MUSIC_CONFIG: MusicConfig = {
  enabled: false,
  mode: 'none',
  autoResume: true,
  infinitePlay: true,
  shuffle: false,
  integratedEnabled: false,
  integratedUrl: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
  integratedVolume: 80,
};

export default function App() {
  // Application states
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [announcementCount, setAnnouncementCount] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'board' | 'ocr' | 'history' | 'stats' | 'settings' | 'devices'>('board');
  const [isDBReady, setIsDBReady] = useState(false);

  // Client-Server and WebSocket states
  const [deviceMode, setDeviceMode] = useState<'local' | 'server' | 'client'>(() => {
    return (localStorage.getItem('deviceMode') as any) || 'local';
  });
  const [pairingCode, setPairingCode] = useState<string>(() => {
    return localStorage.getItem('pairedCode') || '';
  });
  const [pairingStatus, setPairingStatus] = useState<'unpaired' | 'pairing' | 'paired' | 'failed' | 'searching'>('unpaired');
  const [deviceName, setDeviceName] = useState<string>(() => {
    return localStorage.getItem('deviceName') || 'Tablet ' + Math.floor(100 + Math.random() * 900);
  });
  const [serverIP, setServerIP] = useState<string>(() => {
    return localStorage.getItem('serverIP') || window.location.host;
  });
  const [connectedClients, setConnectedClients] = useState<{ id: string; name: string; connected: boolean }[]>([]);
  const [authorizedDevices, setAuthorizedDevices] = useState<{ id: string; name: string; approved: boolean }[]>(() => {
    const saved = localStorage.getItem('authorizedDevices');
    return saved ? JSON.parse(saved) : [];
  });

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);

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

  // Keyboard navigation & highlight state for the waiting queue
  const [selectedWaitingTicketId, setSelectedWaitingTicketId] = useState<string | null>(null);

  // Keyboard navigation & highlight state for the pending list
  const [selectedPendingTicketId, setSelectedPendingTicketId] = useState<string | null>(null);

  // Keyboard navigation & highlight state for the missing list
  const [selectedMissingTicketId, setSelectedMissingTicketId] = useState<string | null>(null);

  // Track the last focused list to route Arrow keys and Enter
  const [lastFocusedList, setLastFocusedList] = useState<'waiting' | 'pending' | 'missing'>('waiting');

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

  // Configuration states
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>(DEFAULT_VOICE_SETTINGS);
  const [shortcutConfig, setShortcutConfig] = useState<ShortcutConfig>(DEFAULT_SHORTCUTS);
  const [appConfig, setAppConfig] = useState<AppConfig>(DEFAULT_APP_CONFIG);
  const [musicConfig, setMusicConfig] = useState<MusicConfig>(DEFAULT_MUSIC_CONFIG);

  // Refs for tracking announcement timers and background loops
  const announcementTimerRef = useRef<NodeJS.Timeout | null>(null);
  const voiceSettingsRef = useRef<VoiceSettings>(voiceSettings);
  const announcementCountRef = useRef<number>(announcementCount);
  const activeTicketRef = useRef<Ticket | null>(activeTicket);
  
  const ticketsRef = useRef<Ticket[]>(tickets);
  const selectedWaitingTicketIdRef = useRef<string | null>(null);
  const selectedPendingTicketIdRef = useRef<string | null>(null);
  const selectedMissingTicketIdRef = useRef<string | null>(null);
  const lastFocusedListRef = useRef<'waiting' | 'pending' | 'missing'>('waiting');

  const authorizedDevicesRef = useRef(authorizedDevices);
  const deviceNameRef = useRef(deviceName);
  const handleRemoteActionRef = useRef<any>(null);

  // Sync refs to avoid closures in setInterval and global listeners
  useEffect(() => {
    authorizedDevicesRef.current = authorizedDevices;
  }, [authorizedDevices]);

  useEffect(() => {
    deviceNameRef.current = deviceName;
  }, [deviceName]);

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

  // Client-Server actions and WebSocket management
  const connectWebSocket = (mode: 'server' | 'client', code: string, ip: string) => {
    if (socketRef.current) {
      try {
        socketRef.current.close();
      } catch (e) {}
      socketRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    setPairingStatus('searching');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socketHost = mode === 'server' ? window.location.host : ip;
    const wsUrl = `${protocol}//${socketHost}`;

    console.log(`Connecting to WebSocket at ${wsUrl}`);
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      if (mode === 'server') {
        ws.send(JSON.stringify({ type: 'register_server' }));
      } else {
        ws.send(JSON.stringify({
          type: 'register_client',
          code,
          deviceId: getOrCreateDeviceId(),
          deviceName: deviceNameRef.current,
        }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('WebSocket message received:', data);

        if (data.type === 'server_registered') {
          setPairingCode(data.code);
          localStorage.setItem('pairedCode', data.code);
          setPairingStatus('paired');
        }

        else if (data.type === 'pairing_success') {
          setPairingCode(data.code);
          localStorage.setItem('pairedCode', data.code);
          setPairingStatus('paired');
          setServerIP(ip);
          localStorage.setItem('serverIP', ip);
        }

        else if (data.type === 'pairing_failed') {
          setPairingStatus('failed');
          alert(`Error de emparejamiento: ${data.reason}`);
        }

        else if (data.type === 'client_joined') {
          // PC Server checks if this client is deauthorized
          const wasDeauthorized = authorizedDevicesRef.current.length > 0 && !authorizedDevicesRef.current.some(d => d.id === data.deviceId);
          if (wasDeauthorized) {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: 'deauthorize_client',
                deviceId: data.deviceId
              }));
            }
            return;
          }

          // Approve and save/update client device on PC Server
          setAuthorizedDevices(prev => {
            const exists = prev.some(d => d.id === data.deviceId);
            if (exists) {
              return prev.map(d => d.id === data.deviceId ? { ...d, name: data.deviceName } : d);
            }
            return [...prev, { id: data.deviceId, name: data.deviceName, approved: true }];
          });

          setConnectedClients(prev => {
            const exists = prev.some(c => c.id === data.deviceId);
            if (exists) {
              return prev.map(c => c.id === data.deviceId ? { ...c, name: data.deviceName, connected: true } : c);
            }
            return [...prev, { id: data.deviceId, name: data.deviceName, connected: true }];
          });
        }

        else if (data.type === 'client_left') {
          setConnectedClients(prev => {
            return prev.map(c => c.id === data.deviceId ? { ...c, connected: false } : c);
          });
        }

        else if (data.type === 'sync_state') {
          if (mode === 'client') {
            setTickets(data.tickets);
            setActiveTicket(data.activeTicket);
            setAnnouncementCount(data.announcementCount);
            setAppConfig(data.appConfig);
            setVoiceSettings(data.voiceSettings);
            setMusicConfig(data.musicConfig);
            setPairingStatus('paired');
          }
        }

        else if (data.type === 'deauthorized') {
          ws.close();
          setDeviceMode('local');
          localStorage.setItem('deviceMode', 'local');
          setPairingStatus('unpaired');
          alert('Tu tablet ha sido desvinculada por el PC Servidor.');
        }

        else if (data.type === 'rename') {
          setDeviceName(data.name);
          localStorage.setItem('deviceName', data.name);
        }

        else if (data.type === 'server_disconnected') {
          setPairingStatus('failed');
          if (mode === 'client') {
            console.log('Server disconnected. Reconnecting in 3 seconds...');
            reconnectTimeoutRef.current = setTimeout(() => {
              connectWebSocket('client', code, ip);
            }, 3000);
          }
        }

        else if (data.type === 'client_action') {
          if (mode === 'server') {
            if (handleRemoteActionRef.current) {
              handleRemoteActionRef.current(data.action, data.payload);
            }
          }
        }
      } catch (err) {
        console.warn('Error processing websocket message:', err);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket closed');
      if (pairingStatus === 'paired') {
        setPairingStatus('failed');
      }
      
      // Auto reconnect
      reconnectTimeoutRef.current = setTimeout(() => {
        const m = localStorage.getItem('deviceMode');
        if (m && m !== 'local') {
          const c = localStorage.getItem('pairedCode') || '';
          const i = localStorage.getItem('serverIP') || window.location.host;
          connectWebSocket(m as 'server' | 'client', c, i);
        }
      }, 4000);
    };

    ws.onerror = (err) => {
      console.warn('WebSocket connection error (this is normal during setup or local scanning):', err);
    };
  };

  const sendClientAction = (action: string, payload: any = {}) => {
    if (deviceMode === 'client' && socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'client_action',
        action,
        payload,
        deviceName,
      }));
      return true; // Action routed remotely, skip local state updates
    }
    return false; // Run locally
  };

  const handleRemoteAction = (action: string, payload: any) => {
    console.log(`Executing remote client action: ${action}`, payload);
    switch (action) {
      case 'add_ticket':
        handleAddTicket(payload.number);
        break;
      case 'mark_delivered':
        handleMarkDelivered(payload.id);
        break;
      case 'mark_pending':
        handleMarkPending(payload.id);
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
      case 'deliver_from_pause':
        handleDeliverFromPause(payload.id);
        break;
      default:
        console.warn(`Unknown remote action: ${action}`);
    }
  };

  handleRemoteActionRef.current = handleRemoteAction;

  const handleSelectMode = (mode: 'local' | 'server' | 'client') => {
    if (socketRef.current) {
      try {
        socketRef.current.close();
      } catch (e) {}
      socketRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    setDeviceMode(mode);
    localStorage.setItem('deviceMode', mode);

    if (mode === 'local') {
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
      connectWebSocket('server', '', window.location.host);
    } else if (mode === 'client') {
      setPairingStatus('unpaired');
      setTickets([]);
      setActiveTicket(null);
    }
  };

  const handleStartPairing = (code: string) => {
    connectWebSocket('client', code, serverIP);
  };

  const handleSetDeviceName = (name: string) => {
    setDeviceName(name);
    localStorage.setItem('deviceName', name);
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

  const handleRemoveClient = (id: string) => {
    setConnectedClients(prev => prev.filter(c => c.id !== id));
    setAuthorizedDevices(prev => prev.filter(d => d.id !== id));
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
        };
      });
    });
  }, [authorizedDevices]);

  // Establish initial connections on start
  useEffect(() => {
    if (deviceMode === 'server') {
      connectWebSocket('server', '', window.location.host);
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

  // Server state broadcast effect: broadcast server state updates to clients
  useEffect(() => {
    if (deviceMode !== 'server' || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    
    const statePayload = {
      type: 'state_broadcast',
      tickets,
      activeTicket,
      announcementCount,
      appConfig,
      voiceSettings,
      musicConfig,
    };
    socketRef.current.send(JSON.stringify(statePayload));
  }, [tickets, activeTicket, announcementCount, appConfig, voiceSettings, musicConfig, deviceMode]);

  // 1. Initial boot and IndexedDB fetch
  useEffect(() => {
    async function loadAppState() {
      if (deviceMode === 'client') {
        setIsDBReady(true);
        return;
      }
      try {
        await initDB();
        
        // Load voice configurations
        const savedVoice = await dbGetSettings<VoiceSettings>('voice_settings');
        if (savedVoice) setVoiceSettings(savedVoice);
        
        const savedShortcuts = await dbGetSettings<ShortcutConfig>('shortcuts');
        if (savedShortcuts) setShortcutConfig(savedShortcuts);

        const savedAppConfig = await dbGetSettings<AppConfig>('app_config');
        if (savedAppConfig) setAppConfig(savedAppConfig);

        const savedMusic = await dbGetSettings<MusicConfig>('music_settings');
        if (savedMusic) {
          setMusicConfig(savedMusic);
          musicController.setConfig(savedMusic);
        } else {
          musicController.setConfig(DEFAULT_MUSIC_CONFIG);
        }

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

  // 2. TTS Announcement Loop Controller
  useEffect(() => {
    // Clear any active timer first
    if (announcementTimerRef.current) {
      clearInterval(announcementTimerRef.current);
      announcementTimerRef.current = null;
    }

    if (!activeTicket || deviceMode === 'client') return;

    // Local function to execute single speech call
    const runSpeechCall = async (count: number) => {
      const settings = voiceSettingsRef.current;
      const ticket = activeTicketRef.current;
      if (!ticket) return;

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
      const msgText = formatAnnouncementText(ticket.number, settings, count);
      speakText(msgText, settings, undefined, () => {
        // Notify music controller that speech is finished
        musicController.endAnnouncement();
      });
    };

    // First instant announcement
    runSpeechCall(announcementCount);

    // Setup periodic repetition loop
    announcementTimerRef.current = setInterval(() => {
      const nextCount = announcementCountRef.current + 1;
      setAnnouncementCount(nextCount);
      runSpeechCall(nextCount);
    }, voiceSettings.announcementInterval * 1000);

    return () => {
      if (announcementTimerRef.current) {
        clearInterval(announcementTimerRef.current);
      }
    };
  }, [activeTicket]);

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
          let nextVal: 'waiting' | 'pending' | 'missing' = 'waiting';
          if (e.key === 'ArrowLeft') {
            if (prev === 'waiting') nextVal = 'missing';
            else if (prev === 'pending') nextVal = 'waiting';
            else if (prev === 'missing') nextVal = 'pending';
          } else {
            if (prev === 'waiting') nextVal = 'pending';
            else if (prev === 'pending') nextVal = 'missing';
            else if (prev === 'missing') nextVal = 'waiting';
          }
          const listNameEs = nextVal === 'waiting' ? 'En espera' : nextVal === 'pending' ? 'Pausa' : 'Desaparecidos';
          triggerShortcutNotification(`Enfoque: ${listNameEs}`, 'Navegación');
          return nextVal;
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
  const handleAddTicket = async (number: string) => {
    if (sendClientAction('add_ticket', { number })) return;
    // 3-digit normalization helper
    const normalizedNum = String(parseInt(number, 10));

    // Guard: check for active or waiting duplicates
    const isDuplicate = tickets.some(
      (t) => t.number === normalizedNum && (t.status === 'active' || t.status === 'waiting')
    );
    if (isDuplicate) {
      // Just shake input or return silently (as per specs, do not block the active screen flow with popups)
      forceRefocusInput();
      return;
    }

    const newTicket: Ticket = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
      number: normalizedNum,
      createdAt: Date.now(),
      status: 'waiting',
    };

    // If no active ticket is present, and autoActivateFirstTicket is true, it goes active immediately
    const shouldActivate = !activeTicket && (appConfig.autoActivateFirstTicket !== false);
    if (shouldActivate) {
      newTicket.status = 'active';
      
      const updatedTickets = [...tickets, newTicket];
      setTickets(updatedTickets);
      setActiveTicket(newTicket);
      setAnnouncementCount(1);
      
      await dbSaveTicket(newTicket);
    } else {
      const updatedTickets = [...tickets, newTicket];
      setTickets(updatedTickets);
      
      await dbSaveTicket(newTicket);
    }
    forceRefocusInput();
  };

  const handleMarkDelivered = async (id: string) => {
    if (sendClientAction('mark_delivered', { id })) return;
    const completedAt = Date.now();
    const currentActive = activeTicket;
    if (!currentActive || currentActive.id !== id) {
      forceRefocusInput();
      return;
    }

    // Update old active to delivered
    const updatedOldActive: Ticket = {
      ...currentActive,
      status: 'delivered',
      completedAt,
      totalTime: Math.max(0, Math.floor((completedAt - currentActive.createdAt) / 1000)),
    };

    await dbSaveTicket(updatedOldActive);

    // FIFO: Fetch next in line
    const waitingList = tickets.filter((t) => t.status === 'waiting');
    let nextActive: Ticket | null = null;
    let nextWaiting: Ticket[] = [];

    if (waitingList.length > 0) {
      // First waiting becomes active
      const first = waitingList[0];
      nextActive = { ...first, status: 'active' };
      nextWaiting = waitingList.slice(1).map((t) => ({ ...t }));
      
      await dbSaveTicket(nextActive);
    }

    // Merge other existing tickets
    const finishedTickets = tickets.filter((t) => t.status !== 'waiting' && t.status !== 'active');
    const finalTickets = [...finishedTickets, updatedOldActive, ...nextWaiting];

    setTickets(finalTickets);
    setActiveTicket(nextActive);
    setAnnouncementCount(nextActive ? 1 : 0);
    forceRefocusInput();
  };

  const handleMarkPending = async (id: string) => {
    if (sendClientAction('mark_pending', { id })) return;
    const pausedAt = Date.now();
    const currentActive = activeTicket;
    if (!currentActive || currentActive.id !== id) {
      forceRefocusInput();
      return;
    }

    // Update old active to pending (Pausado)
    const updatedOldActive: Ticket = {
      ...currentActive,
      status: 'pending',
      pendingAt: pausedAt,
    };

    await dbSaveTicket(updatedOldActive);

    // FIFO: Fetch next in line
    const waitingList = tickets.filter((t) => t.status === 'waiting');
    let nextActive: Ticket | null = null;
    let nextWaiting: Ticket[] = [];

    if (waitingList.length > 0) {
      const first = waitingList[0];
      nextActive = { ...first, status: 'active' };
      nextWaiting = waitingList.slice(1).map((t) => ({ ...t }));
      
      await dbSaveTicket(nextActive);
    }

    const finishedTickets = tickets.filter((t) => t.status !== 'waiting' && t.status !== 'active');
    const finalTickets = [...finishedTickets, updatedOldActive, ...nextWaiting];

    setTickets(finalTickets);
    setActiveTicket(nextActive);
    setAnnouncementCount(nextActive ? 1 : 0);

    setTransitionNotification({
      number: currentActive.number,
      type: 'pending',
      id: Date.now(),
    });

    forceRefocusInput();
  };

  const handleMarkMissing = async (id: string) => {
    if (sendClientAction('mark_missing', { id })) return;
    const missingAt = Date.now();
    const currentActive = activeTicket;
    if (!currentActive || currentActive.id !== id) {
      forceRefocusInput();
      return;
    }

    // Update old active to missing (Desaparecido)
    const updatedOldActive: Ticket = {
      ...currentActive,
      status: 'missing',
      completedAt: missingAt,
    };

    await dbSaveTicket(updatedOldActive);

    // FIFO: Fetch next in line
    const waitingList = tickets.filter((t) => t.status === 'waiting');
    let nextActive: Ticket | null = null;
    let nextWaiting: Ticket[] = [];

    if (waitingList.length > 0) {
      const first = waitingList[0];
      nextActive = { ...first, status: 'active' };
      nextWaiting = waitingList.slice(1).map((t) => ({ ...t }));
      
      await dbSaveTicket(nextActive);
    }

    const finishedTickets = tickets.filter((t) => t.status !== 'waiting' && t.status !== 'active');
    const finalTickets = [...finishedTickets, updatedOldActive, ...nextWaiting];

    setTickets(finalTickets);
    setActiveTicket(nextActive);
    setAnnouncementCount(nextActive ? 1 : 0);

    setTransitionNotification({
      number: currentActive.number,
      type: 'missing',
      id: Date.now(),
    });

    forceRefocusInput();
  };

  const handleAddDirectWaitingTicket = async (number: string) => {
    if (sendClientAction('add_direct_waiting', { number })) return;
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
    };

    const updatedTickets = [...tickets, newTicket];
    setTickets(updatedTickets);
    await dbSaveTicket(newTicket);
    forceRefocusInput();
  };

  const handleAddDirectPendingTicket = async (number: string) => {
    if (sendClientAction('add_direct_pending', { number })) return;
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

      // Place demoted active ticket at index 0 of the waiting list
      newWaitingList = [demotedActive, ...waitingList];
    } else {
      newWaitingList = waitingList;
    }

    // Promote paused ticket to active
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

  const handleReturnToWaiting = async (id: string) => {
    if (sendClientAction('return_to_waiting', { id })) return;
    const ticket = tickets.find((t) => t.id === id);
    if (!ticket) return;

    const updatedTicket: Ticket = {
      ...ticket,
      status: 'waiting',
    };
    await dbSaveTicket(updatedTicket);

    const otherTickets = tickets.filter((t) => t.id !== id);
    setTickets([...otherTickets, updatedTicket]);
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

    const otherTickets = tickets.filter((t) => t.id !== id);
    setTickets([...otherTickets, updatedTicket]);

    setTransitionNotification({
      number: ticket.number,
      type: 'delivered',
      id: Date.now(),
    });
    forceRefocusInput();
  };

  const handleCallNext = async () => {
    if (sendClientAction('call_next')) return;
    // Rotate operation: Active goes to the END of waiting list, next waiting becomes active
    const currentActive = activeTicket;
    if (!currentActive) {
      forceRefocusInput();
      return;
    }

    const waitingList = tickets.filter((t) => t.status === 'waiting');
    
    if (waitingList.length === 0) {
      // Nothing to rotate with, just replay announcement count
      setAnnouncementCount((prev) => prev + 1);
      forceRefocusInput();
      return;
    }

    // Demote current active to waiting
    const demotedActive: Ticket = {
      ...currentActive,
      status: 'waiting',
    };

    // Promote first waiting to active
    const promotedFirst = waitingList[0];
    const newActive: Ticket = {
      ...promotedFirst,
      status: 'active',
    };

    // New waiting is remaining waiting list PLUS the demoted active ticket at the end
    const remainingWaiting = waitingList.slice(1);
    const newWaitingList = [...remainingWaiting, demotedActive];

    // Save changes to db
    await dbSaveTicket(demotedActive);
    await dbSaveTicket(newActive);

    const finishedTickets = tickets.filter((t) => t.status !== 'waiting' && t.status !== 'active');
    const finalTickets = [...finishedTickets, newActive, ...newWaitingList];

    setTickets(finalTickets);
    setActiveTicket(newActive);
    setAnnouncementCount(1);
    forceRefocusInput();
  };

  const handleRaisePriority = async (id: string) => {
    if (sendClientAction('raise_priority', { id })) return;
    // Boost operation: Selected waiting ticket goes active immediately.
    // Old active goes to the very FIRST position of the waiting list.
    const selectedTicket = tickets.find((t) => t.id === id);
    if (!selectedTicket || selectedTicket.status !== 'waiting') {
      forceRefocusInput();
      return;
    }

    const currentActive = activeTicket;
    const waitingList = tickets.filter((t) => t.status === 'waiting');

    // Remove selected ticket from waiting list
    const filteredWaiting = waitingList.filter((t) => t.id !== id);

    let newWaitingList: Ticket[] = [];

    if (currentActive) {
      // Demote active to waiting status
      const demotedActive: Ticket = {
        ...currentActive,
        status: 'waiting',
      };
      await dbSaveTicket(demotedActive);

      // Place demoted active ticket at index 0 of the waiting list
      newWaitingList = [demotedActive, ...filteredWaiting];
    } else {
      newWaitingList = filteredWaiting;
    }

    // Promote selected to active
    const newActive: Ticket = {
      ...selectedTicket,
      status: 'active',
    };
    await dbSaveTicket(newActive);

    const finishedTickets = tickets.filter((t) => t.status !== 'waiting' && t.status !== 'active');
    const finalTickets = [...finishedTickets, newActive, ...newWaitingList];

    setTickets(finalTickets);
    setActiveTicket(newActive);
    setAnnouncementCount(1);
    forceRefocusInput();
  };

  const handleDeleteTicket = async (id: string) => {
    if (sendClientAction('delete_ticket', { id })) return;
    await dbDeleteTicket(id);

    // If it was the active ticket, trigger next in queue
    if (activeTicket && activeTicket.id === id) {
      const waitingList = tickets.filter((t) => t.status === 'waiting');
      let nextActive: Ticket | null = null;
      let nextWaiting: Ticket[] = [];

      if (waitingList.length > 0) {
        const first = waitingList[0];
        nextActive = { ...first, status: 'active' };
        nextWaiting = waitingList.slice(1);
        await dbSaveTicket(nextActive);
      }

      const finishedTickets = tickets.filter((t) => t.id !== id && t.status !== 'waiting' && t.status !== 'active');
      setTickets([...finishedTickets, ...nextWaiting]);
      setActiveTicket(nextActive);
      setAnnouncementCount(nextActive ? 1 : 0);
    } else {
      setTickets(tickets.filter((t) => t.id !== id));
    }
    forceRefocusInput();
  };

  const handleClearHistory = async (status: 'delivered' | 'missing') => {
    await dbClearTickets(status);
    setTickets(tickets.filter((t) => t.status !== status));
  };

  // 5. Config Saves
  const handleSaveVoiceSettings = async (settings: VoiceSettings) => {
    setVoiceSettings(settings);
    await dbSaveSettings('voice_settings', settings);
  };

  const handleSaveShortcutConfig = async (shortcuts: ShortcutConfig) => {
    setShortcutConfig(shortcuts);
    await dbSaveSettings('shortcuts', shortcuts);
  };

  const handleSaveAppConfig = async (config: AppConfig) => {
    setAppConfig(config);
    await dbSaveSettings('app_config', config);
  };

  const handleSaveMusicConfig = async (config: MusicConfig) => {
    setMusicConfig(config);
    musicController.setConfig(config);
    await dbSaveSettings('music_settings', config);
  };

  // Derived attributes
  const waitingTickets = tickets.filter((t) => t.status === 'waiting');
  const nextTicketNumber = waitingTickets.length > 0 ? waitingTickets[0].number : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {/* Universal Top Navigation Header */}
      <header className="border-b border-slate-900 bg-slate-900/40 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center font-black font-mono text-xl tracking-tighter text-white shadow-lg shadow-indigo-500/25">
              T
            </div>
            <div>
              <h1 className="text-base font-extrabold text-white tracking-tight leading-none">
                Gestor de Tickets
              </h1>
              <span className="text-[10px] text-indigo-400 font-mono tracking-wider uppercase">
                Sistema de cola & OCR Web
              </span>
            </div>
          </div>

          {/* Nav Tabs */}
          <nav className="flex bg-slate-950/80 p-1 border border-slate-900 rounded-xl max-w-full overflow-x-auto scrollbar-none">
            <button
              onClick={() => setActiveTab('board')}
              className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'board' ? 'bg-slate-900 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LayoutGrid size={14} />
              Panel Principal
            </button>
            <button
              onClick={() => setActiveTab('ocr')}
              className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'ocr' ? 'bg-slate-900 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Camera size={14} />
              Escáner OCR
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'history' ? 'bg-slate-900 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <History size={14} />
              Historial
            </button>
            <button
              onClick={() => setActiveTab('stats')}
              className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'stats' ? 'bg-slate-900 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BarChart2 size={14} />
              Métricas
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'settings' ? 'bg-slate-900 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <SettingsIcon size={14} />
              Ajustes
            </button>
            <button
              onClick={() => setActiveTab('devices')}
              className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'devices' ? 'bg-slate-900 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Smartphone size={14} />
              Dispositivos
              {deviceMode === 'server' && connectedClients.some(c => c.connected) && (
                <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
              )}
              {deviceMode === 'client' && pairingStatus === 'paired' && (
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
              )}
            </button>
          </nav>
        </div>
      </header>

      {/* Main Container Section */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 lg:p-8">
        
        {!isDBReady ? (
          <div className="py-24 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-slate-400 text-sm">Cargando base de datos IndexedDB...</p>
          </div>
        ) : (
          <div className="h-full">
            
            {/* View Tab router */}
            {activeTab === 'board' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* Left Side: Rapid Keyboard Input & Call Next area */}
                <div className="lg:col-span-5 space-y-6">
                  
                  {/* Rapid input component */}
                  <ManualInput onAddTicket={handleAddTicket} />

                  {/* Active call board component */}
                  <ActiveTicket
                    activeTicket={activeTicket}
                    announcementCount={announcementCount}
                    onSpeakActive={handleRepeatCall}
                    onMarkDelivered={handleMarkDelivered}
                    onMarkPending={handleMarkPending}
                    onMarkMissing={handleMarkMissing}
                    onCallNext={handleCallNext}
                    nextTicketNumber={nextTicketNumber}
                    waitingCount={waitingTickets.length}
                    activeGlowColor={appConfig.activeGlowColor}
                  />

                </div>

                {/* Middle-Left: Waiting queue manager */}
                <div className="lg:col-span-3 h-full">
                  <WaitingList
                    tickets={waitingTickets}
                    onRaisePriority={handleRaisePriority}
                    onDeleteTicket={handleDeleteTicket}
                    selectedWaitingTicketId={selectedWaitingTicketId}
                    onSelectWaitingTicket={setSelectedWaitingTicketId}
                    onAddDirectTicket={handleAddDirectWaitingTicket}
                    waitingSelectedColor={appConfig.waitingSelectedColor}
                  />
                </div>

                {/* Middle-Right: Pause queue manager */}
                <div className="lg:col-span-2 h-full">
                  <PendingList
                    tickets={tickets.filter((t) => t.status === 'pending')}
                    onSendToActive={handleActivateFromPause}
                    onReturnToWaiting={handleReturnToWaiting}
                    onCallNow={handleCallTicketNow}
                    onDeliver={handleDeliverFromPause}
                    onDeleteTicket={handleDeleteTicket}
                    selectedPendingTicketId={selectedPendingTicketId}
                    onSelectPendingTicket={setSelectedPendingTicketId}
                    onAddDirectTicket={handleAddDirectPendingTicket}
                    pendingSelectedColor={appConfig.pendingSelectedColor}
                  />
                </div>

                {/* Right: Missing queue manager */}
                <div className="lg:col-span-2 h-full">
                  <MissingList
                    tickets={tickets.filter((t) => t.status === 'missing')}
                    onSendToActive={handleActivateFromMissing}
                    onReturnToWaiting={handleReturnToWaitingFromMissing}
                    onDeleteTicket={handleDeleteTicket}
                    selectedMissingTicketId={selectedMissingTicketId}
                    onSelectMissingTicket={setSelectedMissingTicketId}
                  />
                </div>
              </div>
            )}

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
                  {/* Informative instructions sidebar */}
                  <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
                    <h3 className="font-bold text-slate-200 flex items-center gap-2 text-sm uppercase tracking-wider text-indigo-400">
                      <AlertCircle size={16} />
                      Instrucciones de Escaneo
                    </h3>
                    <ul className="text-xs text-slate-400 space-y-3 leading-relaxed list-disc list-inside">
                      <li>El escáner analiza la imagen en busca de números grandes de ticket de 1-3 dígitos.</li>
                      <li>Ignora automáticamente fechas (dd/mm/aaaa), importes, monedas, números de teléfono o IVA.</li>
                      <li>Evita duplicados: los tickets ya activos o en lista de espera se ignorarán automáticamente.</li>
                      <li>Utiliza el <strong className="text-slate-300">Simulador</strong> si estás probando la app en una pantalla sin tickets físicos.</li>
                    </ul>
                  </div>

                  {/* Live Mini status */}
                  <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex items-center justify-between">
                    <div>
                      <h4 className="text-xs text-slate-400">Cola actual</h4>
                      <p className="text-xl font-bold font-mono text-white mt-0.5">{waitingTickets.length} esperando</p>
                    </div>
                    <button
                      onClick={() => setActiveTab('board')}
                      className="px-3.5 py-1.5 bg-indigo-950 hover:bg-indigo-900 border border-indigo-900 text-indigo-300 rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      Ver cola
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'history' && (
              <HistoryPanel
                tickets={tickets}
                onDeleteTicket={handleDeleteTicket}
                onClearHistory={handleClearHistory}
              />
            )}

            {activeTab === 'stats' && (
              <StatisticsPanel tickets={tickets} activeTicket={activeTicket} />
            )}

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
              />
            )}

            {activeTab === 'devices' && (
              <DevicesPanel
                deviceMode={deviceMode}
                pairingCode={pairingCode}
                pairingStatus={pairingStatus}
                serverIP={serverIP}
                deviceName={deviceName}
                connectedClients={connectedClients}
                onSelectMode={handleSelectMode}
                onSetDeviceName={handleSetDeviceName}
                onSetServerIP={handleSetServerIP}
                onStartPairing={handleStartPairing}
                onRenameClient={handleRenameClient}
                onRemoveClient={handleRemoveClient}
                onDisconnect={handleDisconnect}
              />
            )}

            {/* Persistent Background Music Integrated Player across all tabs */}
            {musicConfig.enabled && musicConfig.integratedEnabled && (
              <BackgroundMusicPlayer
                musicConfig={musicConfig}
                onSaveMusicConfig={handleSaveMusicConfig}
              />
            )}

          </div>
        )}
      </main>



      {/* Subtle Footer bar */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 mt-8">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-600 font-mono">
          <span>Gestor de Tickets para Restaurante © 2026</span>
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
            className="fixed top-24 left-1/2 -translate-x-1/2 z-[9999] bg-slate-900/90 backdrop-blur-md border border-indigo-500/30 text-white py-2.5 px-5 rounded-2xl shadow-2xl shadow-indigo-500/10 flex items-center gap-3.5"
          >
            <div className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
              <Keyboard size={14} />
            </div>
            <div className="text-xs">
              <span className="text-slate-400">Atajo activado: </span>
              <strong className="text-slate-100">{shortcutNotification.action}</strong>
              <span className="ml-2 font-mono bg-slate-950 border border-slate-800 px-1.5 py-0.5 rounded text-indigo-400 font-extrabold text-[10px]">
                {shortcutNotification.key}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
