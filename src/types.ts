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
}

export interface AppConfig {
  maxOcrSimultaneous: number; // default: 3
  theme: 'dark'; // only dark mode requested, very polished
  activeGlowColor?: string; // hex string, default indigo
  waitingSelectedColor?: string; // hex string, default indigo
  pendingSelectedColor?: string; // hex string, default amber
  demoteActivePosition?: 'start' | 'end'; // default: 'start'
  autoActivateFirstTicket?: boolean; // default: true
}

export interface MusicConfig {
  enabled: boolean;
  mode: 'duck20' | 'duck40' | 'duck60' | 'pause' | 'none'; // Lower to 20%, 40%, 60%, Pause, or Do nothing
  autoResume: boolean; // Reanudar automáticamente: true/false
  infinitePlay: boolean; // Reproducción infinita: true/false
  shuffle: boolean; // Playlist aleatoria: true/false
  integratedEnabled: boolean;
  integratedUrl: string;
  integratedVolume: number; // 0 to 100, default 80
}

export interface HistoryItem {
  id: string;
  number: string;
  createdAt: number;
  completedAt: number;
  totalTime: number; // in seconds
  status: 'delivered' | 'missing';
}
