export interface TicketZone {
  id: string; // e.g. "504:cocina"
  zone: string; // e.g. "cocina", "linea", "barra", "manual"
  status: 'pending' | 'completed';
  createdAt: number;
  completedAt?: number;
}

export interface Ticket {
  id: string;
  number: string;
  createdAt: number;
  completedAt?: number;
  totalTime?: number; // in seconds
  status: 'waiting' | 'active' | 'delivered' | 'missing' | 'pending' | 'deleted_pending';
  // Pending specific history:
  pendingAt?: number;
  recoveredAt?: number;
  deliveredAt?: number;
  deletedAt?: number;
  isPriority?: boolean;
  createdByDevice?: string;
  source?: 'HIOPOS' | 'MANUAL' | 'OCR' | 'ANDROID' | string;
  zones?: TicketZone[];
  zone?: string;
}

export type PhraseTypeEs = 
  | 'ticket_numero'      // "Ticket número..."
  | 'pedido_numero'      // "Pedido número..."
  | 'cliente_numero'     // "Cliente con el número..."
  | 'preparado'          // "Su pedido está preparado..."
  | 'mostrador'          // "Acuda al mostrador..."
  | 'ninguno';           // Sin frase

export type PhraseTypeEn =
  | 'ticket_number'      // "Ticket number..."
  | 'order_number'       // "Order number..."
  | 'customer_number'    // "Customer number..."
  | 'ready'              // "Your order is ready..."
  | 'counter'            // "Please come to the counter..."
  | 'now_serving'        // "Now serving ticket number..."
  | 'none';              // No phrase

export interface VoiceSettings {
  lang: 'es' | 'en' | 'ca' | 'fr' | 'it' | 'de' | 'pt';
  voiceURI: string;
  rate: number;
  pitch: number;
  phraseType: string;
  announcementInterval: number; // in seconds
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  repeatPhraseInterval: number; // say full phrase every X announcements (default 3)
  customIntro: string;
  customTicketName: string;
  customOutro: string;
  voiceGender: 'all' | 'male' | 'female';
  voiceVolume: number; // 0 to 100, default 100
}

export interface ShortcutConfig {
  callNext: string;       // default: 'Space'
  markDelivered: string;  // default: 'KeyD' (or Enter)
  markMissing: string;    // default: 'KeyM'
  focusInput: string;     // default: 'Escape'
  pauseResumeOcr: string; // default: 'KeyP'
  activateSelected: string; // default: 'KeyA'
  pauseResumeWaitlist: string; // default: 'KeyQ'
}

export interface AppConfig {
  maxOcrSimultaneous: number; // default: 3
  theme: 'dark'; // only dark mode requested, very polished
  activeGlowColor?: string; // hex string, default indigo
  waitingSelectedColor?: string; // hex string, default indigo
  pendingSelectedColor?: string; // hex string, default amber
  demoteActivePosition?: 'start' | 'end'; // default: 'start'
  autoActivateFirstTicket?: boolean; // default: true
  ocrInputMode?: 'waiting' | 'direct_listos' | 'auto_ia'; // default: 'direct_listos'
  activeSwipeAction?: 'pending' | 'delivered'; // default: 'pending'
  missingRecoveryAction?: 'active' | 'waiting'; // default: 'active'
  publicDisplayTitle?: string; // default: '¡Pedido listo!'
  publicDisplayMessage?: string; // default: 'Puede recoger su pedido'
  publicDisplayThemePreset?: 'black-yellow' | 'black-white' | 'darkblue-white' | 'darkred-white' | 'darkgreen-white' | 'custom';
  publicDisplayBg?: string;
  publicDisplayTextColor?: string;
  publicDisplayTitleColor?: string;
  publicDisplayShowMessage?: boolean;
  
  // Enhanced Public Display and Standby settings:
  publicDisplayBgType?: 'color' | 'image' | 'video';
  publicDisplayBgImage?: string;
  publicDisplayBgVideo?: string;
  publicDisplayLogo?: string;
  publicDisplayFontFamily?: 'inter' | 'space-grotesk' | 'mono' | 'serif';
  publicDisplayNumberSize?: 'normal' | 'large' | 'massive';
  publicDisplayAnimation?: 'fade' | 'slide' | 'scale' | 'spring';
  publicDisplayNoTicketsMessage?: string;
  publicDisplayThemeMode?: 'dark' | 'light';
  publicDisplayLanguage?: 'en' | 'es' | 'ca' | 'fr' | 'it' | 'de' | 'pt';
  
  // Standby mode slideshow settings:
  publicDisplayStandbyEnabled?: boolean;
  publicDisplayStandbyImages?: { id: string; url: string; active: boolean }[];
  publicDisplayBgVideos?: { id: string; url: string; active: boolean; name: string }[];
  publicDisplayStandbyDuration?: number; // duration in seconds (3 to 30)
  publicDisplayStandbyFit?: 'cover' | 'contain';
  publicDisplayHideBgOnActive?: boolean;
  publicDisplayDiagnosticEnabled?: boolean;

  // Multi-Ticket Board settings:
  publicDisplayMainColor?: string;
  publicDisplayListColor?: string;
  publicDisplayNewColor?: string;
  publicDisplayOldColor?: string;
  publicDisplayMaxTickets?: number;
  publicDisplayColumns?: number;
  publicDisplayListNumberSize?: 'small' | 'medium' | 'large';
  publicDisplayListPosition?: 'bottom' | 'side-right' | 'side-left';
  publicDisplayShowMain?: boolean;
  publicDisplayLayoutMode?: 'list-only' | 'list-main' | 'restaurant-2.0';
}

export interface AuthorizedDevice {
  id: string;
  name: string;
  type: string; // 'Móvil' | 'Tablet' | 'TV' | 'PC'
  status: 'authorized' | 'blocked';
  remember: boolean;
  lastConnected?: string;
}

export interface YouTubeVideoItem {
  id: string; // Real YouTube Video or Playlist ID
  type?: 'video' | 'playlist';
  title: string;
  thumbnail: string;
  channel: string;
  duration?: string;
  url: string;
  dateAdded?: number;
}

export interface YouTubeHistoryItem extends YouTubeVideoItem {
  playedAt: number;
}

export interface YouTubeCustomPlaylist {
  id: string;
  name: string;
  createdAt: number;
  videos: YouTubeVideoItem[];
}

export interface MusicConfig {
  enabled: boolean;
  mode: 'duck20' | 'duck40' | 'duck60' | 'pause' | 'none'; // Lower to 20%, 40%, 60%, Pause, or Do nothing
  autoResume: boolean; // Reanudar automáticamente: true/false
  infinitePlay: boolean; // Reproducción infinita: true/false
  shuffle: boolean; // Playlist aleatoria: true/false
  resumePlaylistProgress?: boolean; // Recordar y reanudar punto de reproducción
  integratedEnabled: boolean;
  integratedUrl: string;
  integratedVolume: number; // 0 to 100, default 80
  apiKey?: string; // Opcional YouTube Data API key
  favorites?: YouTubeVideoItem[];
  history?: YouTubeHistoryItem[];
  customPlaylists?: YouTubeCustomPlaylist[];
}

export interface HistoryItem {
  id: string;
  number: string;
  createdAt: number;
  completedAt: number;
  totalTime: number; // in seconds
  status: 'delivered' | 'missing';
}
