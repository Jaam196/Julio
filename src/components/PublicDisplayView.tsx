import React, { useEffect, useState } from 'react';
import { Tv, Wifi, WifiOff, X, Maximize, Minimize, Activity, AlertCircle, CheckCircle, Clock, Terminal, Settings } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Ticket, AppConfig } from '../types';
import { isActiveTicket } from '../utils/ticketUtils';
import { BackgroundVideo } from './BackgroundVideo';

interface PublicDisplayViewProps {
  activeTicket: Ticket | null;
  tickets?: Ticket[];
  pairingStatus: 'unpaired' | 'pairing' | 'paired' | 'failed' | 'searching';
  serverIP: string;
  onSelectMode: (mode: 'local' | 'server' | 'mobile_control' | 'public_display') => void;
  appConfig: AppConfig;
  onMediaMissing?: (mediaKey: string) => void;
  syncVersion?: number;
  lastSyncTime?: string;
  lastLatency?: number | null;
  lastReceivedEvent?: string;
  onForceReconnect?: () => void;
}

const fontStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700;900&family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=Fira+Code:wght@500;700&family=Inter:wght@400;600;800;900&display=swap');
`;

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

export default function PublicDisplayView({
  activeTicket,
  tickets = [],
  pairingStatus,
  serverIP,
  onSelectMode,
  appConfig,
  onMediaMissing,
  syncVersion = 1,
  lastSyncTime = 'Nunca',
  lastLatency = null,
  lastReceivedEvent = 'Ninguno',
  onForceReconnect,
}: PublicDisplayViewProps) {
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [diagTab, setDiagTab] = useState<'conn' | 'video'>('conn');

  // Multi-video background playlist state
  const activeVideos = (appConfig.publicDisplayBgVideos || []).filter(v => v.active !== false);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);

  // Automatically reset index if the list of active videos changes
  useEffect(() => {
    setCurrentVideoIndex(0);
  }, [activeVideos.length]);

  const handleVideoEnded = () => {
    if (activeVideos.length > 1) {
      setCurrentVideoIndex(prev => (prev + 1) % activeVideos.length);
    }
  };

  const hasBgVideos = activeVideos.length > 0;
  const currentVideo = hasBgVideos ? activeVideos[currentVideoIndex % activeVideos.length] : null;
  const currentVideoUrl = currentVideo ? currentVideo.url : (appConfig.publicDisplayBgVideo || (appConfig.publicDisplayBgType === 'video' ? '/demo.mp4' : ''));

  const shouldRenderVideo = Boolean(
    currentVideoUrl && (
      appConfig.publicDisplayBgType === 'video' ||
      !appConfig.publicDisplayBgType ||
      (appConfig.publicDisplayBgType !== 'image' && (Boolean(appConfig.publicDisplayBgVideo) || activeVideos.length > 0))
    )
  );

  // Language resolution
  const lang = appConfig.publicDisplayLanguage || 'en';
  const t = DISPLAY_TRANSLATIONS[lang] || DISPLAY_TRANSLATIONS.en;

  // Header texts with smart language defaults if the settings values match Spanish/English defaults or are empty
  const isDefaultTitle = !appConfig.publicDisplayTitle || 
    appConfig.publicDisplayTitle === 'PEDIDO LISTO' || 
    appConfig.publicDisplayTitle === 'ORDER READY' ||
    appConfig.publicDisplayTitle === 'PEDIDOS LISTOS' ||
    appConfig.publicDisplayTitle === 'PEDIDO LISTO / ORDER READY';

  const isDefaultMessage = !appConfig.publicDisplayMessage || 
    appConfig.publicDisplayMessage === 'Puede recoger su pedido' || 
    appConfig.publicDisplayMessage === 'Please pick up your order' ||
    appConfig.publicDisplayMessage === 'POR FAVOR, RECOJA SU PEDIDO EN EL MOSTRADOR';

  const isDefaultNoTickets = !appConfig.publicDisplayNoTicketsMessage || 
    appConfig.publicDisplayNoTicketsMessage === 'Siguiente turno en preparación...' || 
    appConfig.publicDisplayNoTicketsMessage === 'Next ticket in preparation...' ||
    appConfig.publicDisplayNoTicketsMessage === 'Esperando Turno...';

  const displayTitle = isDefaultTitle ? t.defaultTitle : appConfig.publicDisplayTitle;
  const displayMessage = isDefaultMessage ? t.defaultMessage : appConfig.publicDisplayMessage;
  const displayNoTicketsMessage = isDefaultNoTickets ? t.defaultNoTicketsMessage : appConfig.publicDisplayNoTicketsMessage;

  // Digital clock state for professional looking TV display
  const [currentTime, setCurrentTime] = useState('');
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString(lang === 'es' ? 'es-ES' : lang === 'pt' ? 'pt-PT' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, [lang]);

  // Real-time video diagnostic states
  const [videoDiagnostic, setVideoDiagnostic] = useState<any>(null);
  const [videoLogs, setVideoLogs] = useState<string[]>([]);
  const [showDiagnosticPanel, setShowDiagnosticPanel] = useState(false);

  useEffect(() => {
    const handleDiagnostic = (e: Event) => {
      const customEvent = e as CustomEvent<any>;
      const data = customEvent.detail;
      setVideoDiagnostic(data);
      setVideoLogs(prev => {
        const time = new Date().toLocaleTimeString();
        const logLine = `[${time}] ${data.event.toUpperCase()}`;
        // Prevent duplicate periodic-check spam
        if (data.event === 'periodic-check' && prev.length > 0 && prev[0].includes('PERIODIC-CHECK')) {
          return prev;
        }
        return [logLine, ...prev].slice(0, 20); // Keep last 20 logs
      });
    };

    window.addEventListener('resolved-video-diagnostic', handleDiagnostic);
    return () => window.removeEventListener('resolved-video-diagnostic', handleDiagnostic);
  }, []);

  // Monitor fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Request/exit fullscreen helper
  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error('Error toggling fullscreen:', err);
    }
  };

  // Auto reset exit confirmation after 3 seconds of inactivity
  useEffect(() => {
    if (showExitConfirm) {
      const t = setTimeout(() => setShowExitConfirm(false), 3000);
      return () => clearTimeout(t);
    }
  }, [showExitConfirm]);

  // Listen for escape or F11 keys to handle exit gracefully
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'F11') {
        if (e.key === 'F11') {
          e.preventDefault(); // Prevent standard browser fullscreen so we handle cleanly
          toggleFullscreen();
        } else {
          if (showExitConfirm) {
            onSelectMode('local');
          } else {
            setShowExitConfirm(true);
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSelectMode, showExitConfirm]);

  // Active automatic reconnect pulse for Smart TV
  useEffect(() => {
    if (pairingStatus !== 'paired' && onForceReconnect) {
      const timer = setInterval(() => {
        onForceReconnect();
      }, 2500);
      return () => clearInterval(timer);
    }
  }, [pairingStatus, onForceReconnect]);

  // Standby mode image slideshow indexing
  const activeSlides = (appConfig.publicDisplayStandbyImages || []).filter(img => img.active);

  useEffect(() => {
    if (activeSlides.length <= 1) {
      setCurrentSlideIndex(0);
      return;
    }
    const durationMs = (appConfig.publicDisplayStandbyDuration || 5) * 1000;
    const interval = setInterval(() => {
      setCurrentSlideIndex(prev => (prev + 1) % activeSlides.length);
    }, durationMs);
    return () => clearInterval(interval);
  }, [activeSlides.length, appConfig.publicDisplayStandbyDuration]);

  // Determine active colors based on theme settings and mode (dark/light)
  const preset = appConfig.publicDisplayThemePreset || 'black-yellow';
  const isLightMode = appConfig.publicDisplayThemeMode === 'light';
  
  let bg = isLightMode ? '#ffffff' : '#000000';
  let text = isLightMode ? '#1e1b4b' : '#fbbf24'; // navy vs amber yellow
  let titleColor = isLightMode ? '#0f172a' : '#ffffff';
  let subtitleColor = isLightMode ? '#475569' : '#94a3b8';
  
  if (preset === 'black-yellow') {
    bg = isLightMode ? '#fef08a' : '#000000';
    text = isLightMode ? '#000000' : '#fbbf24';
    titleColor = isLightMode ? '#1e1b4b' : '#ffffff';
    subtitleColor = isLightMode ? '#3f3f46' : '#a1a1aa';
  } else if (preset === 'black-white') {
    bg = isLightMode ? '#ffffff' : '#000000';
    text = isLightMode ? '#000000' : '#ffffff';
    titleColor = isLightMode ? '#3f3f46' : '#a1a1aa';
    subtitleColor = isLightMode ? '#71717a' : '#71717a';
  } else if (preset === 'darkblue-white') {
    bg = isLightMode ? '#f0f9ff' : '#030712';
    text = isLightMode ? '#0369a1' : '#38bdf8';
    titleColor = isLightMode ? '#0f172a' : '#ffffff';
    subtitleColor = isLightMode ? '#475569' : '#94a3b8';
  } else if (preset === 'darkred-white') {
    bg = isLightMode ? '#fef2f2' : '#110000';
    text = isLightMode ? '#991b1b' : '#fca5a5';
    titleColor = isLightMode ? '#1e1b4b' : '#ffffff';
    subtitleColor = isLightMode ? '#7f1d1d' : '#fca5a588';
  } else if (preset === 'darkgreen-white') {
    bg = isLightMode ? '#f0fdf4' : '#011c10';
    text = isLightMode ? '#166534' : '#4ade80';
    titleColor = isLightMode ? '#14532d' : '#ffffff';
    subtitleColor = isLightMode ? '#15803d' : '#4ade8088';
  } else if (preset === 'custom') {
    bg = appConfig.publicDisplayBg || (isLightMode ? '#ffffff' : '#000000');
    text = appConfig.publicDisplayTextColor || (isLightMode ? '#1e1b4b' : '#fbbf24');
    titleColor = appConfig.publicDisplayTitleColor || (isLightMode ? '#0f172a' : '#ffffff');
    subtitleColor = `${titleColor}cc`;
  }

  const textGlowColor = text.startsWith('#') ? text : '#fbbf24';

  // Font family resolution
  let fontFamily = '"Inter", sans-serif';
  if (appConfig.publicDisplayFontFamily === 'space-grotesk') {
    fontFamily = '"Space Grotesk", sans-serif';
  } else if (appConfig.publicDisplayFontFamily === 'mono') {
    fontFamily = '"Fira Code", monospace';
  } else if (appConfig.publicDisplayFontFamily === 'serif') {
    fontFamily = '"Playfair Display", serif';
  }

  // Animation variants mapping
  const animationVariants = {
    fade: {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      transition: { duration: 0.4 }
    },
    slide: {
      initial: { opacity: 0, y: 100 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: -100 },
      transition: { type: 'tween', ease: 'easeInOut', duration: 0.5 }
    },
    scale: {
      initial: { opacity: 0, scale: 0.5 },
      animate: { opacity: 1, scale: 1 },
      exit: { opacity: 0, scale: 0.5 },
      transition: { duration: 0.4 }
    },
    spring: {
      initial: { opacity: 0, scale: 0.6 },
      animate: { opacity: 1, scale: 1 },
      exit: { opacity: 0, scale: 0.6 },
      transition: { type: "spring", damping: 15, stiffness: 85, duration: 0.5 }
    }
  };

  const activeAnim = animationVariants[appConfig.publicDisplayAnimation || 'spring'] || animationVariants.spring;

  // Number size mapping for ready list grid items
  const numberSize = appConfig.publicDisplayListNumberSize || 'medium';
  let numberSizeClassList = 'text-4xl sm:text-5xl md:text-6xl';
  if (numberSize === 'small') {
    numberSizeClassList = 'text-2xl sm:text-3xl md:text-4xl';
  } else if (numberSize === 'large') {
    numberSizeClassList = 'text-5xl sm:text-6xl md:text-7xl';
  }

  // Centralized active tickets evaluation (waiting, active, pending, missing)
  // Delivered, deleted_pending, and archived tickets are strictly excluded.
  const activeTicketsList = (tickets || []).filter(isActiveTicket);
  const isMainTicketActive = isActiveTicket(activeTicket);
  const hasActiveTickets = isMainTicketActive || activeTicketsList.length > 0;

  // Filter and sort ready tickets specifically for the public display board (status === 'active')
  const readyTickets = (tickets || []).filter(t => t.status === 'active');
  const sortedReadyTickets = [...readyTickets].sort((a, b) => {
    const timeA = a.completedAt || a.createdAt || 0;
    const timeB = b.completedAt || b.createdAt || 0;
    return timeB - timeA; // newest first
  });

  // Determine the main ticket to show on the public display
  const mainTicket = (activeTicket && isMainTicketActive)
    ? activeTicket
    : (sortedReadyTickets.length > 0 ? sortedReadyTickets[0] : null);

  // Remaining ready tickets in the sidebar/bottom list (excluding the main one)
  const otherReadyTickets = mainTicket 
    ? sortedReadyTickets.filter(t => t.id !== mainTicket.id)
    : sortedReadyTickets;

  // Determine if Standby Slideshow is currently active
  const hasDisplayTickets = sortedReadyTickets.length > 0 || !!mainTicket;
  const isStandbyActive = !hasDisplayTickets && Boolean(appConfig.publicDisplayStandbyEnabled) && activeSlides.length > 0;
  const currentSlide = isStandbyActive ? activeSlides[currentSlideIndex] : null;

  // Option "Sustituir temporalmente el fondo al mostrar un Ticket Activo" (publicDisplayHideBgOnActive):
  // When enabled (true) and AT LEAST ONE active ticket exists in the system:
  // hide the media background smoothly (opacity: 0) to reveal the solid theme background.
  // When all active tickets are delivered/cleared or when disabled: show the media background (opacity: 100).
  const shouldHideMediaBg = Boolean(appConfig.publicDisplayHideBgOnActive && hasActiveTickets);
  const showMediaBackground = !shouldHideMediaBg;

  // Helper function to color ticket numbers based on age/recency
  const getTicketColor = (ticket: Ticket) => {
    const now = Date.now();
    const ageMs = now - (ticket.completedAt || ticket.createdAt || now);
    
    // Newly called: under 20 seconds
    if (ageMs < 20000) {
      return appConfig.publicDisplayNewColor || '#10b981';
    }
    // Older: older than 5 minutes (300,000 ms)
    if (ageMs > 300000) {
      return appConfig.publicDisplayOldColor || '#94a3b8';
    }
    // Standard list color
    return appConfig.publicDisplayListColor || '#ffffff';
  };

  // Helper function to check if ticket is newly called
  const isTicketNew = (ticket: Ticket) => {
    const now = Date.now();
    const ageMs = now - (ticket.completedAt || ticket.createdAt || now);
    return ageMs < 20000;
  };

  // Resolve grid columns styling
  const colCount = appConfig.publicDisplayColumns || 4;
  let gridColsClass = 'grid-cols-4';
  if (colCount === 1) gridColsClass = 'grid-cols-1';
  else if (colCount === 2) gridColsClass = 'grid-cols-2';
  else if (colCount === 3) gridColsClass = 'grid-cols-3';
  else if (colCount === 4) gridColsClass = 'grid-cols-4';
  else if (colCount === 5) gridColsClass = 'grid-cols-5';
  else if (colCount === 6) gridColsClass = 'grid-cols-6';
  else if (colCount === 8) gridColsClass = 'grid-cols-8';

  // Helper to render the top header and real-time clock
  const renderHeaderComponent = () => (
    <div className="w-full flex items-center justify-between border-b border-white/10 pb-4 mb-4 select-none shrink-0">
      <div className="flex items-center gap-3">
        {appConfig.publicDisplayLogo && (
          <img 
            src={appConfig.publicDisplayLogo} 
            className="h-10 w-auto object-contain bg-black/20 p-1.5 rounded-xl border border-white/5" 
            alt="Logo"
            referrerPolicy="no-referrer"
          />
        )}
        <div className="text-left">
          <h1 className="text-lg sm:text-xl md:text-2xl font-black uppercase tracking-widest text-indigo-400">
            {displayTitle}
          </h1>
          <p className="text-[10px] sm:text-xs text-slate-400 font-semibold tracking-wider">
            {displayMessage}
          </p>
        </div>
      </div>
      
      {/* Digital clock displaying current time */}
      <div className="bg-black/40 backdrop-blur-md border border-white/10 px-4 py-2 rounded-2xl flex items-center gap-2 font-mono text-sm sm:text-base font-bold text-slate-300 shadow-xl">
        <Clock size={16} className="text-indigo-400 animate-pulse" />
        <span>{currentTime}</span>
      </div>
    </div>
  );

  // Helper to render only grid-list board
  const renderListOnlyLayout = () => {
    const maxTickets = appConfig.publicDisplayMaxTickets || 20;
    const visibleTickets = sortedReadyTickets.slice(0, maxTickets);

    const getAdaptiveFontSizeClass = (count: number) => {
      if (count <= 2) return 'text-[10rem] sm:text-[12rem] md:text-[14rem]';
      if (count <= 4) return 'text-[7rem] sm:text-[8rem] md:text-[9rem]';
      if (count <= 8) return 'text-6xl sm:text-7xl md:text-8xl';
      if (count <= 12) return 'text-5xl sm:text-6xl md:text-7xl';
      return 'text-4xl sm:text-5xl md:text-6xl';
    };

    const getAdaptiveGridColsClass = (count: number) => {
      if (count <= 1) return 'grid-cols-1 max-w-xl';
      if (count === 2) return 'grid-cols-1 md:grid-cols-2 max-w-4xl';
      if (count <= 4) return 'grid-cols-2 max-w-5xl';
      if (count <= 8) return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 max-w-7xl';
      return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 max-w-7xl';
    };

    const fontSizeClass = getAdaptiveFontSizeClass(visibleTickets.length);
    const adaptiveColsClass = getAdaptiveGridColsClass(visibleTickets.length);

    return (
      <div className="w-full h-full flex flex-col justify-between p-8 z-10 pointer-events-auto">
        {renderHeaderComponent()}
        
        {/* Main Grid Area */}
        <div className="flex-1 flex items-center justify-center py-4">
          {visibleTickets.length > 0 ? (
            <div className={`grid ${adaptiveColsClass} gap-6 w-full max-h-[70vh] overflow-y-auto pr-2 mx-auto justify-center`}>
              <AnimatePresence mode="popLayout">
                {visibleTickets.map((ticket) => {
                  const tColor = getTicketColor(ticket);
                  const isNew = isTicketNew(ticket);
                  return (
                    <motion.div
                      layout
                      key={ticket.id}
                      initial={{ opacity: 0, scale: 0.75, y: 15 }}
                      animate={{ 
                        opacity: 1, 
                        scale: 1, 
                        y: 0,
                        boxShadow: isNew ? `0 0 35px ${tColor}44` : '0 10px 15px -3px rgba(0, 0, 0, 0.3)'
                      }}
                      exit={{ opacity: 0, scale: 0.75, y: -15 }}
                      transition={{ 
                        type: 'spring', 
                        stiffness: 240, 
                        damping: 24,
                        layout: { type: 'spring', stiffness: 300, damping: 30 }
                      }}
                      className={`relative flex flex-col items-center justify-center p-8 bg-black/65 backdrop-blur-md border ${
                        isNew ? 'border-emerald-500/50 ring-2 ring-emerald-500/20' : 'border-white/10'
                      } rounded-[28px]`}
                    >
                      {isNew && (
                        <span 
                          className="absolute -top-3 px-3 py-0.5 rounded-full text-[9px] font-black tracking-widest text-white uppercase"
                          style={{ backgroundColor: tColor }}
                        >
                          {t.ready}
                        </span>
                      )}
                      
                      <span 
                        className={`font-mono font-black ${fontSizeClass} tracking-tighter leading-none`}
                        style={{ color: tColor }}
                      >
                        {ticket.number}
                      </span>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="px-8 py-10 bg-black/50 backdrop-blur-md border border-white/5 rounded-3xl shadow-2xl flex flex-col items-center gap-4 text-center max-w-md"
            >
              <div className="w-12 h-12 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center animate-pulse">
                <CheckCircle size={24} />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">{t.allDelivered}</h3>
                <p className="text-xs text-slate-400">{t.noTicketsWaiting}</p>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    );
  };

  // Helper to render split layout with giant main ticket + ready list
  const renderListMainLayout = () => {
    const listPosition = appConfig.publicDisplayListPosition || 'bottom';
    const showMainEnabled = appConfig.publicDisplayShowMain !== false;
    
    const maxTickets = appConfig.publicDisplayMaxTickets || 20;
    const visibleListTickets = otherReadyTickets.slice(0, maxTickets);
    const mainColor = appConfig.publicDisplayMainColor || '#fbbf24';

    // The giant called ticket panel helper
    const renderMainTicketPanel = () => {
      if (!mainTicket || !showMainEnabled) {
        return (
          <div className="flex-1 flex items-center justify-center h-full">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="px-8 py-8 bg-black/40 backdrop-blur-md border border-white/5 rounded-3xl shadow-xl flex flex-col items-center gap-3 max-w-sm"
            >
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                <span className="text-slate-300 font-mono text-xs tracking-[0.15em] uppercase font-semibold">
                  {displayNoTicketsMessage}
                </span>
              </div>
              <p className="text-slate-400 text-xs font-medium">
                {t.autoAppear}
              </p>
            </motion.div>
          </div>
        );
      }

      return (
        <div className="flex-1 flex flex-col items-center justify-center h-full p-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={mainTicket.id}
              initial={activeAnim.initial}
              animate={activeAnim.animate}
              exit={activeAnim.exit}
              transition={activeAnim.transition}
              className="w-full max-w-2xl px-8 py-8 md:px-16 md:py-12 bg-black/65 backdrop-blur-md border border-white/10 rounded-[32px] shadow-2xl flex flex-col items-center justify-center text-center"
            >
              <div className="uppercase tracking-[0.2em] font-black text-xs md:text-sm text-indigo-400 mb-1">
                {t.nowServing}
              </div>

              {/* Massive displaying number */}
              <motion.div 
                animate={{ scale: [1, 1.03, 1] }}
                transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                className="font-mono font-black text-[22vw] md:text-[28vh] leading-none tracking-tighter my-2"
                style={{
                  color: mainColor,
                  textShadow: `0 0 45px ${mainColor}44, 0 10px 30px rgba(0,0,0,0.5)`,
                }}
              >
                {mainTicket.number}
              </motion.div>

              {appConfig.publicDisplayShowMessage !== false && (
                <div className="font-bold text-xs md:text-sm tracking-wide text-slate-200 mt-1 uppercase max-w-lg">
                  {displayMessage}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      );
    };

    // The other ready list panel helper
    const renderReadyListPanel = (orientation: 'vertical' | 'horizontal') => {
      const isVertical = orientation === 'vertical';
      
      const containerClass = isVertical 
        ? 'w-full md:w-[38%] border-t md:border-t-0 md:border-l border-white/10 bg-black/35 backdrop-blur-sm p-4 md:p-6 flex flex-col h-full overflow-hidden rounded-2xl md:rounded-none'
        : 'w-full border-t border-white/10 bg-black/35 backdrop-blur-sm p-4 md:p-6 flex flex-col h-[32vh] overflow-hidden rounded-t-2xl';

      return (
        <div className={`${containerClass} select-none`}>
          <div className="flex items-center justify-between border-b border-white/5 pb-2.5 mb-4 shrink-0">
            <span className="text-[10px] sm:text-xs font-black tracking-widest text-indigo-400 uppercase">
              {t.readyList}
            </span>
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-bold">
              {visibleListTickets.length} {t.readyCount}
            </span>
          </div>

          <div className="flex-1 overflow-hidden">
            {visibleListTickets.length > 0 ? (
              <div className={
                isVertical
                  ? `grid ${colCount === 1 ? 'grid-cols-1' : colCount === 2 ? 'grid-cols-2' : 'grid-cols-3'} gap-4 max-h-[70vh] overflow-y-auto pr-1`
                  : `grid ${gridColsClass} gap-4 max-h-[22vh] overflow-y-auto pr-1`
              }>
                <AnimatePresence mode="popLayout">
                  {visibleListTickets.map((ticket) => {
                    const tColor = getTicketColor(ticket);
                    const isNew = isTicketNew(ticket);
                    return (
                      <motion.div
                        layout
                        key={ticket.id}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ 
                          opacity: 1, 
                          scale: 1,
                          boxShadow: isNew ? `0 0 15px ${tColor}22` : 'none'
                        }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ 
                          type: 'spring', 
                          stiffness: 260, 
                          damping: 25,
                          layout: { type: 'spring', stiffness: 300, damping: 30 }
                        }}
                        className={`relative flex flex-col items-center justify-center py-4 px-3 bg-black/60 backdrop-blur-md border ${
                          isNew ? 'border-emerald-500/40 ring-1 ring-emerald-500/10' : 'border-white/5'
                        } rounded-xl`}
                      >
                        {isNew && (
                          <span 
                            className="absolute -top-2 px-1.5 py-0.5 rounded-full text-[7px] font-black tracking-wider text-white uppercase"
                            style={{ backgroundColor: tColor }}
                          >
                            {t.new}
                          </span>
                        )}
                        <span 
                          className={`font-mono font-black ${numberSizeClassList} tracking-tight leading-none`}
                          style={{ color: tColor }}
                        >
                          {ticket.number}
                        </span>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-[11px] py-8">
                {t.noOtherReady}
              </div>
            )}
          </div>
        </div>
      );
    };

    // Render orientation-specific layout
    if (listPosition === 'side-right') {
      return (
        <div className="w-full h-full flex flex-col p-8 z-10 pointer-events-auto">
          {renderHeaderComponent()}
          <div className="flex-1 flex flex-col md:flex-row gap-6 overflow-hidden">
            {renderMainTicketPanel()}
            {renderReadyListPanel('vertical')}
          </div>
        </div>
      );
    }

    if (listPosition === 'side-left') {
      return (
        <div className="w-full h-full flex flex-col p-8 z-10 pointer-events-auto">
          {renderHeaderComponent()}
          <div className="flex-1 flex flex-col md:flex-row-reverse gap-6 overflow-hidden">
            {renderMainTicketPanel()}
            {renderReadyListPanel('vertical')}
          </div>
        </div>
      );
    }

    // Default 'bottom' horizontal positioning
    return (
      <div className="w-full h-full flex flex-col p-8 z-10 pointer-events-auto justify-between">
        {renderHeaderComponent()}
        <div className="flex-1 flex flex-col justify-between overflow-hidden">
          {renderMainTicketPanel()}
          {renderReadyListPanel('horizontal')}
        </div>
      </div>
    );
  };

  // Helper to render Restaurant 2.0 layout (the ultimate professional queuing display)
  const renderRestaurant2Layout = () => {
    const mainColor = appConfig.publicDisplayMainColor || '#fbbf24';
    const titleText = appConfig.publicDisplayTitle || 'FERRETTI SMART FOOD';
    const subTitleText = appConfig.publicDisplayMessage || 'AHORA LISTO PARA RECOGER';

    // Get up to 10 recently called other tickets
    const maxRecent = 10;
    const visibleRecent = otherReadyTickets.slice(0, maxRecent);

    return (
      <div className="w-full h-full flex flex-col justify-between p-6 sm:p-8 md:p-10 z-10 pointer-events-auto">
        
        {/* Top Header Section */}
        <div className="w-full flex flex-col md:flex-row items-center justify-between border-b-2 border-white/15 pb-4 md:pb-6 mb-4 select-none shrink-0 bg-black/45 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-white/5 shadow-2xl">
          <div className="flex items-center gap-4">
            {appConfig.publicDisplayLogo ? (
              <img 
                src={appConfig.publicDisplayLogo} 
                className="h-12 w-auto object-contain bg-black/30 p-2 rounded-xl border border-white/10" 
                alt="Logo"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-amber-500 flex items-center justify-center font-black text-white text-base tracking-wider shadow-inner">
                F
              </div>
            )}
            <div className="text-left">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-black uppercase tracking-widest text-indigo-400 font-sans">
                {titleText}
              </h1>
              <p className="text-[10px] sm:text-xs text-slate-400 font-bold tracking-widest uppercase mt-0.5">
                SISTEMA INTELIGENTE DE TURNOS
              </p>
            </div>
          </div>
          
          {/* Digital clock & system health */}
          <div className="flex items-center gap-3 mt-3 md:mt-0">
            <div className="bg-black/60 backdrop-blur-md border border-white/10 px-5 py-2 rounded-2xl flex items-center gap-2 font-mono text-base sm:text-lg font-black text-slate-200 shadow-xl">
              <Clock size={18} className="text-indigo-400 animate-pulse" />
              <span>{currentTime}</span>
            </div>
          </div>
        </div>

        {/* Middle Section - Current Active Ticket Display */}
        <div className="flex-1 flex flex-col items-center justify-center py-4 select-none">
          {mainTicket ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={mainTicket.id}
                initial={{ opacity: 0, scale: 0.75, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.75, y: -30 }}
                transition={{ type: "spring", damping: 15, stiffness: 95 }}
                className="w-full max-w-4xl px-8 py-8 md:px-12 md:py-10 bg-black/75 backdrop-blur-md border border-white/15 rounded-[36px] shadow-2xl flex flex-col items-center justify-center text-center relative overflow-hidden"
              >
                {/* Visual Accent Corners */}
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-indigo-500 rounded-tl-3xl opacity-60" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-indigo-500 rounded-tr-3xl opacity-60" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-indigo-500 rounded-bl-3xl opacity-60" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-indigo-500 rounded-br-3xl opacity-60" />

                <div className="uppercase tracking-[0.25em] font-black text-xs md:text-sm text-indigo-400 mb-2">
                  {subTitleText}
                </div>

                {/* Massive called number with zoom and subtle glow entry */}
                <motion.div 
                  animate={{ scale: [1, 1.04, 1] }}
                  transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
                  className="font-mono font-black text-[28vw] md:text-[32vh] leading-none tracking-tighter my-1 text-center"
                  style={{
                    color: mainColor,
                    textShadow: `0 0 55px ${mainColor}55, 0 15px 40px rgba(0,0,0,0.6)`,
                  }}
                >
                  {mainTicket.number}
                </motion.div>

                {/* Subtitle / Pickup desk instruction */}
                <div className="font-extrabold text-sm md:text-base tracking-widest text-slate-300 mt-2 uppercase max-w-2xl border-t border-white/10 pt-3">
                  POR FAVOR RECOJA SU PEDIDO EN MOSTRADOR
                </div>
              </motion.div>
            </AnimatePresence>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="px-10 py-10 bg-black/70 backdrop-blur-md border border-white/10 rounded-3xl shadow-2xl flex flex-col items-center gap-4 text-center max-w-lg"
            >
              <div className="w-14 h-14 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center animate-pulse border border-indigo-500/20">
                <Clock size={28} />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-black text-slate-200 uppercase tracking-widest">SIGUIENTE TURNO EN PREPARACIÓN</h3>
                <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                  Los números de ticket listos aparecerán aquí automáticamente en tiempo real.
                </p>
              </div>
            </motion.div>
          )}
        </div>

        {/* Lower Section - Recently Called List ("RECIÉN LLAMADOS") */}
        <div className="w-full bg-black/65 backdrop-blur-md border border-white/10 rounded-[28px] p-5 sm:p-6 mt-4 select-none shrink-0 shadow-2xl animate-fade-in">
          <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
            <span className="text-xs sm:text-sm font-black tracking-[0.2em] text-indigo-400 uppercase">
              RECIÉN LLAMADOS / RECENTLY CALLED
            </span>
            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 font-black font-mono">
              HISTÓRICO
            </span>
          </div>

          <div className="overflow-x-auto">
            {visibleRecent.length > 0 ? (
              <div className="flex items-center gap-4 pb-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                <AnimatePresence mode="popLayout">
                  {visibleRecent.map((ticket, index) => {
                    const tColor = getTicketColor(ticket);
                    const isNew = isTicketNew(ticket);
                    return (
                      <motion.div
                        layout
                        key={ticket.id}
                        initial={{ opacity: 0, scale: 0.75, x: 30 }}
                        animate={{ 
                          opacity: 1, 
                          scale: 1,
                          x: 0,
                          boxShadow: isNew ? `0 0 20px ${tColor}33` : 'none'
                        }}
                        exit={{ opacity: 0, scale: 0.75, x: -30 }}
                        transition={{ 
                          type: 'spring', 
                          stiffness: 280, 
                          damping: 26,
                          layout: { type: 'spring', stiffness: 300, damping: 30 }
                        }}
                        className={`relative flex flex-col items-center justify-center min-w-[120px] sm:min-w-[140px] py-3.5 px-4 bg-black/50 backdrop-blur-sm border ${
                          isNew ? 'border-emerald-500/40 ring-1 ring-emerald-500/20' : 'border-white/5'
                        } rounded-2xl`}
                      >
                        {isNew && (
                          <span 
                            className="absolute -top-2.5 px-2 py-0.5 rounded-full text-[8px] font-black tracking-widest text-white uppercase animate-pulse"
                            style={{ backgroundColor: tColor }}
                          >
                            NUEVO
                          </span>
                        )}
                        <span 
                          className="font-mono font-black text-3xl sm:text-4xl tracking-tight leading-none"
                          style={{ color: tColor }}
                        >
                          {ticket.number}
                        </span>
                        <span className="text-[9px] text-slate-500 font-mono font-bold mt-1.5 uppercase">
                          PEDIDO #{index + 2}
                        </span>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            ) : (
              <div className="text-center py-4 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                No hay otros pedidos en la lista de llamados recientemente
              </div>
            )}
          </div>
        </div>

      </div>
    );
  };

  return (
    <div 
      className="fixed inset-0 flex flex-col items-center justify-center overflow-hidden select-none z-[9999] transition-all duration-500"
      style={{ 
        backgroundColor: bg,
        fontFamily: fontFamily
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: fontStyles }} />

      {/* Background Permanent Layer - Stays permanently mounted to prevent video buffer loss or playback restart */}
      <div 
        className={`absolute inset-0 w-full h-full pointer-events-none z-0 transition-opacity duration-700 ease-in-out ${
          showMediaBackground ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          transitionProperty: 'opacity',
          transitionDuration: '650ms',
        }}
      >
        <BackgroundVideo
          bgType={appConfig.publicDisplayBgType}
          bgVideo={appConfig.publicDisplayBgVideo}
          bgVideos={appConfig.publicDisplayBgVideos}
          bgImage={appConfig.publicDisplayBgImage}
          standbyEnabled={appConfig.publicDisplayStandbyEnabled}
          standbyImages={appConfig.publicDisplayStandbyImages}
          standbyDuration={appConfig.publicDisplayStandbyDuration}
          standbyFit={appConfig.publicDisplayStandbyFit}
          showStandbyOverlay={!hasDisplayTickets}
          isVisible={showMediaBackground}
          onMediaMissing={onMediaMissing}
        />
      </div>

      {/* Background ambient light - subtle glow matching number color when solid theme background is shown */}
      {!isStandbyActive && shouldHideMediaBg && (
        <div 
          className="absolute inset-0 pointer-events-none opacity-[0.05] z-5"
          style={{
            background: `radial-gradient(circle at center, ${textGlowColor} 0%, transparent 70%)`
          }}
        />
      )}

      {/* Mini status indicator at top left */}
      <button 
        onClick={() => setShowDiagnosticPanel(prev => !prev)}
        className="absolute top-6 left-6 flex items-center gap-2.5 opacity-60 hover:opacity-100 border px-3 py-1.5 rounded-xl transition-all z-50 cursor-pointer text-left backdrop-blur-md"
        style={{
          backgroundColor: 'var(--theme-card-bg, rgba(2, 6, 23, 0.6))',
          borderColor: 'var(--theme-card-border, rgba(255, 255, 255, 0.15))',
          color: 'var(--theme-text, #f8fafc)',
        }}
        title="Clic para mostrar diagnóstico de vídeo"
      >
        <Tv size={15} style={{ color: text }} />
        <span className="text-[11px] font-mono tracking-wider uppercase" style={{ color: 'var(--theme-text-muted, #94a3b8)' }}>PANTALLA PÚBLICA</span>
        <div className={`w-2 h-2 rounded-full ${pairingStatus === 'paired' ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'}`} />
        <span className="text-[9px] font-mono border px-1 rounded font-bold" style={{ backgroundColor: 'var(--theme-input-bg, #020617)', borderColor: 'var(--theme-card-border, rgba(255, 255, 255, 0.1))', color: 'var(--theme-primary, #6366f1)' }}>DEBUG</span>
      </button>

      {/* Helper Fullscreen banner if not fullscreen */}
      {!isFullscreen && (
        <button
          onClick={toggleFullscreen}
          className="absolute top-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-indigo-600/30 border border-indigo-500/40 hover:bg-indigo-600/50 text-white rounded-full text-xs font-bold transition-all shadow-lg flex items-center gap-2 cursor-pointer z-[10000] animate-bounce"
        >
          <Maximize size={13} />
          <span>Pantalla Completa (TV)</span>
        </button>
      )}

      {/* Floating control buttons on top-right */}
      <div className="absolute top-6 right-6 z-[10000] flex items-center gap-3">
        {/* Diagnostic Toggle Button */}
        <button
          onClick={() => setShowDiagnosticPanel(prev => !prev)}
          className="p-2.5 border rounded-xl text-xs font-bold transition-all shadow-lg backdrop-blur-sm cursor-pointer"
          style={showDiagnosticPanel || appConfig.publicDisplayDiagnosticEnabled ? {
            backgroundColor: 'var(--theme-primary, #6366f1)',
            borderColor: 'var(--theme-primary, #6366f1)',
            color: '#ffffff',
          } : {
            backgroundColor: 'var(--theme-card-bg, rgba(2, 6, 23, 0.8))',
            borderColor: 'var(--theme-card-border, rgba(255, 255, 255, 0.15))',
            color: 'var(--theme-text, #f8fafc)',
          }}
          title="Panel de Diagnóstico de Vídeo"
        >
          <Activity size={14} />
        </button>

        {/* Fullscreen manual toggle button */}
        <button
          onClick={toggleFullscreen}
          className="p-2.5 border rounded-xl text-xs font-bold transition-all shadow-lg backdrop-blur-sm cursor-pointer"
          style={{
            backgroundColor: 'var(--theme-card-bg, rgba(2, 6, 23, 0.8))',
            borderColor: 'var(--theme-card-border, rgba(255, 255, 255, 0.15))',
            color: 'var(--theme-text, #f8fafc)',
          }}
          title={isFullscreen ? "Salir de Pantalla Completa" : "Pantalla Completa"}
        >
          {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
        </button>

        {/* Exit Button */}
        <button
          onClick={() => {
            if (showExitConfirm) {
              onSelectMode('local');
            } else {
              setShowExitConfirm(true);
            }
          }}
          className="px-4 py-2 border rounded-xl text-xs font-bold transition-all shadow-lg backdrop-blur-sm cursor-pointer flex items-center gap-2"
          style={showExitConfirm ? {
            backgroundColor: '#dc2626',
            borderColor: '#ef4444',
            color: '#ffffff',
          } : {
            backgroundColor: 'var(--theme-card-bg, rgba(2, 6, 23, 0.8))',
            borderColor: 'var(--theme-card-border, rgba(255, 255, 255, 0.15))',
            color: 'var(--theme-text, #f8fafc)',
          }}
        >
          <X size={14} />
          <span>{showExitConfirm ? '¿Seguro que desea salir?' : 'Salir del Modo Pantalla'}</span>
        </button>
      </div>

      {/* Hidden double-click to exit */}
      <div 
        onDoubleClick={() => {
          onSelectMode('local');
        }}
        className="absolute top-0 right-0 w-24 h-24 bg-transparent cursor-default z-40"
        title="Doble clic para salir"
      />

      {/* Primary Content Layers depending on selected layout mode */}
      <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center z-10 pointer-events-none">
        {isStandbyActive && currentSlide ? (
          /* Slideshow display standby is active - overlay details if requested */
          <div className="absolute bottom-10 left-10 p-4 bg-black/60 backdrop-blur-sm border border-white/5 rounded-2xl flex flex-col gap-1 z-20 pointer-events-auto max-w-sm">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">Publicidad Activa</span>
            </div>
            <p className="text-xs text-slate-200">Por favor, preste atención a la pantalla cuando su pedido esté listo.</p>
          </div>
        ) : appConfig.publicDisplayLayoutMode === 'list-only' ? (
          renderListOnlyLayout()
        ) : appConfig.publicDisplayLayoutMode === 'restaurant-2.0' ? (
          renderRestaurant2Layout()
        ) : (
          renderListMainLayout()
        )}
      </div>

      {/* Real-time connection auto-reconnect banner when disconnected */}
      {pairingStatus !== 'paired' && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-5 py-2.5 bg-amber-950/90 border border-amber-500/40 rounded-full flex items-center gap-3 text-amber-300 text-xs font-bold shadow-2xl backdrop-blur-md z-[99999]">
          <div className="flex items-center gap-2 animate-pulse">
            <WifiOff size={14} className="text-amber-400" />
            <span>Reconectando con el Servidor (comprobando cada 1s)...</span>
          </div>
          {onForceReconnect && (
            <button
              onClick={onForceReconnect}
              className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold rounded-full text-[11px] transition-all cursor-pointer shadow-md"
            >
              Forzar Conexión Activa
            </button>
          )}
        </div>
      )}

      {/* Real-time Video Diagnostic Panel */}
      {(showDiagnosticPanel || appConfig.publicDisplayDiagnosticEnabled) && (
        <div className="absolute bottom-6 right-6 w-96 bg-slate-950/95 backdrop-blur-md border border-slate-800 rounded-2xl p-4 shadow-2xl z-[100000] text-left font-mono text-[10px] text-slate-300 pointer-events-auto flex flex-col gap-3 max-h-[80vh] overflow-y-auto">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex gap-1.5">
              <button
                onClick={() => setDiagTab('conn')}
                className={`px-3 py-1 rounded-lg text-[9px] font-bold uppercase transition-all flex items-center gap-1.5 cursor-pointer ${
                  diagTab === 'conn' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Wifi size={12} />
                Conexión
              </button>
              <button
                onClick={() => setDiagTab('video')}
                className={`px-3 py-1 rounded-lg text-[9px] font-bold uppercase transition-all flex items-center gap-1.5 cursor-pointer ${
                  diagTab === 'video' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Terminal size={12} />
                Vídeo
              </button>
            </div>
            <button
              onClick={() => setShowDiagnosticPanel(false)}
              className="text-slate-500 hover:text-slate-300 cursor-pointer"
              title="Cerrar Panel"
            >
              <X size={14} />
            </button>
          </div>

          {diagTab === 'conn' ? (
            <div className="space-y-2.5">
              {/* Status Banner */}
              <div className={`p-2.5 rounded-xl border flex items-center justify-between gap-2.5 ${
                pairingStatus === 'paired' 
                  ? 'bg-emerald-950/30 border-emerald-800/40 text-emerald-400' 
                  : 'bg-rose-950/30 border-rose-800/40 text-rose-400 animate-pulse'
              }`}>
                <div className="flex items-center gap-2.5">
                  <div className={`h-2.5 w-2.5 rounded-full ${pairingStatus === 'paired' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                  <div>
                    <span className="text-[8px] uppercase block text-slate-500 font-sans">Estado de Red</span>
                    <span className="font-bold text-[10px]">{pairingStatus === 'paired' ? 'CONECTADA Y VINCULADA' : 'BUSCANDO PC SERVIDOR...'}</span>
                  </div>
                </div>
                {onForceReconnect && (
                  <button
                    onClick={onForceReconnect}
                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-[9px] transition-all cursor-pointer shrink-0"
                  >
                    Reconectar
                  </button>
                )}
              </div>

              {/* Grid of details */}
              <div className="bg-slate-900/40 p-3 rounded-xl border border-slate-800/50 space-y-2 text-slate-300">
                <div className="flex justify-between border-b border-slate-800/40 pb-1.5">
                  <span className="text-slate-500 font-sans">IP del Servidor:</span>
                  <span className="font-bold">{serverIP || 'Desconocido'}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800/40 pb-1.5">
                  <span className="text-slate-500 font-sans">Última Actualización:</span>
                  <span className="font-bold">{lastSyncTime}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800/40 pb-1.5">
                  <span className="text-slate-500 font-sans">Ticket Activo:</span>
                  <span className="font-bold text-violet-400">#{activeTicket?.number || 'Ninguno'}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800/40 pb-1.5">
                  <span className="text-slate-500 font-sans">Versión Sincronización:</span>
                  <span className="font-bold text-amber-400">v{syncVersion}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800/40 pb-1.5">
                  <span className="text-slate-500 font-sans">Calidad Conexión:</span>
                  <span className={`font-bold ${
                    lastLatency === null ? 'text-slate-500' : lastLatency < 50 ? 'text-emerald-400' : lastLatency < 150 ? 'text-amber-400' : 'text-rose-400'
                  }`}>
                    {lastLatency === null ? 'Desconectado' : lastLatency < 50 ? 'Estable (Excelente)' : lastLatency < 150 ? 'Estable (Estándar)' : 'Inestable (Alta Latencia)'}
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-800/40 pb-1.5">
                  <span className="text-slate-500 font-sans">Latencia:</span>
                  <span className="font-bold">{lastLatency !== null ? `${lastLatency} ms` : 'N/D'}</span>
                </div>
                <div className="flex justify-between pb-0.5">
                  <span className="text-slate-500 font-sans">Último Evento Recibido:</span>
                  <span className="font-bold text-indigo-400">{lastReceivedEvent}</span>
                </div>
              </div>

              {/* Heartbeat feedback visualization */}
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/50 flex items-center justify-between text-[8px] text-slate-500">
                <span className="font-sans">Canal de Eventos en tiempo real:</span>
                <span className="flex items-center gap-1.5">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                  </span>
                  <span className="font-bold uppercase tracking-wider text-slate-400 font-sans">WSS ESCUCHANDO</span>
                </span>
              </div>
            </div>
          ) : (
            videoDiagnostic ? (
              <div className="space-y-2.5">
                {/* Error warning if any */}
                {videoDiagnostic.error && (
                  <div className="p-2.5 bg-rose-950/40 border border-rose-800/50 rounded-xl text-rose-300 flex items-start gap-1.5 leading-relaxed">
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block text-[10px] uppercase">Error de Reproducción:</span>
                      {videoDiagnostic.error}
                    </div>
                  </div>
                )}

                {/* Status Pills */}
                <div className="grid grid-cols-2 gap-1.5 text-center">
                  <div className={`p-1.5 rounded-lg border ${videoDiagnostic.isLoaded ? 'bg-emerald-950/30 border-emerald-800/40 text-emerald-400' : 'bg-amber-950/30 border-amber-800/40 text-amber-400'}`}>
                    <span className="text-[8px] uppercase block text-slate-500">Estado</span>
                    <span className="font-bold">{videoDiagnostic.isLoaded ? 'REPRODUCIENDO' : 'CARGANDO'}</span>
                  </div>
                  <div className="p-1.5 rounded-lg border bg-slate-900/60 border-slate-800 text-indigo-400">
                    <span className="text-[8px] uppercase block text-slate-500">Último Evento</span>
                    <span className="font-bold truncate block">{videoDiagnostic.event.toUpperCase()}</span>
                  </div>
                </div>

                {/* Tech details table */}
                <div className="space-y-1 bg-slate-900/40 p-2.5 rounded-xl border border-slate-850 text-slate-400 leading-normal">
                  <div>
                    <span className="font-bold text-slate-300">Config:</span> {appConfig.publicDisplayBgType === 'video' ? 'Video' : 'Otro'}
                  </div>
                  <div className="truncate" title={videoDiagnostic.mediaKeyOrUrl}>
                    <span className="font-bold text-slate-300">Ruta Config:</span> {videoDiagnostic.mediaKeyOrUrl}
                  </div>
                  <div className="truncate" title={videoDiagnostic.src}>
                    <span className="font-bold text-slate-300">Ruta Servidor:</span> {videoDiagnostic.src}
                  </div>
                  <div className="h-px bg-slate-800/60 my-1.5" />
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                    <div><span className="font-bold text-slate-300">Muted:</span> {videoDiagnostic.muted ? 'Sí (Mute)' : 'No'}</div>
                    <div><span className="font-bold text-slate-300">Loop:</span> {videoDiagnostic.loop ? 'Sí (Loop)' : 'No'}</div>
                    <div><span className="font-bold text-slate-300">Pausado:</span> {videoDiagnostic.paused ? 'Sí' : 'No'}</div>
                    <div><span className="font-bold text-slate-300">CanPlay:</span> {videoDiagnostic.readyState >= 3 ? 'Sí' : 'No'}</div>
                  </div>
                  <div className="h-px bg-slate-800/60 my-1.5" />
                  <div>
                    <span className="font-bold text-slate-300">Progreso:</span> {videoDiagnostic.currentTime.toFixed(1)}s / {videoDiagnostic.duration ? `${videoDiagnostic.duration.toFixed(1)}s` : 'Infinito'}
                  </div>
                  <div>
                    <span className="font-bold text-slate-300">ReadyState:</span> {videoDiagnostic.readyState} - <span className="text-slate-500 text-[8px] font-sans">{getReadyStateText(videoDiagnostic.readyState)}</span>
                  </div>
                </div>

                {/* Logs terminal */}
                <div className="space-y-1.5">
                  <span className="font-bold text-slate-400 text-[9px] uppercase flex items-center gap-1">
                    <Terminal size={11} />
                    Registro de Eventos (Event Loop)
                  </span>
                  <div className="bg-black/80 rounded-xl p-2 border border-slate-900 h-28 overflow-y-auto font-mono text-[8px] text-slate-400 space-y-1 leading-normal select-text">
                    {videoLogs.length === 0 ? (
                      <div className="text-slate-600 text-center py-8">Esperando eventos del reproductor...</div>
                    ) : (
                      videoLogs.map((log, index) => (
                        <div key={index} className="truncate">
                          {log.includes('ERROR') ? (
                            <span className="text-rose-400">{log}</span>
                          ) : log.includes('PLAY') || log.includes('SUCCESS') ? (
                            <span className="text-emerald-400">{log}</span>
                          ) : log.includes('TRANSCODE') ? (
                            <span className="text-indigo-400">{log}</span>
                          ) : (
                            log
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-slate-900/40 rounded-xl border border-slate-850 text-slate-500 text-center py-10 space-y-2">
                <Activity className="animate-pulse text-slate-600 mx-auto" size={24} />
                <p>Esperando telemetría del reproductor ResolvedVideo...</p>
                <p className="text-[8px] font-sans max-w-xs mx-auto leading-relaxed text-slate-600">
                  Asegúrese de que el fondo esté configurado como Vídeo y haya un archivo cargado.
                </p>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

const getReadyStateText = (state: number) => {
  switch (state) {
    case 0: return 'HAVE_NOTHING (Sin datos)';
    case 1: return 'HAVE_METADATA (Metadatos cargados)';
    case 2: return 'HAVE_CURRENT_DATA (Frame actual listo)';
    case 3: return 'HAVE_FUTURE_DATA (Frames futuros cargando)';
    case 4: return 'HAVE_ENOUGH_DATA (Carga completa / Búfer óptimo)';
    default: return 'Desconocido';
  }
};
