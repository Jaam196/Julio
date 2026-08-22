import { YouTubeVideoItem, YouTubeHistoryItem } from '../types';

export interface YouTubeSavedPlaylistState {
  items: YouTubeVideoItem[];
  currentIndex: number;
  isLooping: boolean;
  isShuffle: boolean;
  infiniteMix: boolean;
}

export interface YouTubeSavedSearchState {
  query: string;
  results: YouTubeVideoItem[];
  continuationToken: string | null;
  timestamp: number;
}

export interface YouTubeSavedPlayerPrefs {
  volume: number;
  isMuted: boolean;
  autoplayEnabled: boolean;
  playbackRate: number;
  theaterMode: boolean;
}

const STORAGE_KEYS = {
  PLAYLIST: 'yt_persistent_playlist_v2',
  HISTORY: 'yt_persistent_history_v2',
  SEARCH: 'yt_persistent_search_v2',
  SEARCH_HISTORY: 'yt_persistent_search_history_v2',
  FAVORITES: 'yt_persistent_favorites_v2',
  LAST_VIDEO: 'yt_persistent_last_video_v2',
  PREFS: 'yt_persistent_player_prefs_v2',
  SAVED_PLAYLISTS: 'yt_persistent_saved_playlists_v2'
};

// Seed / Initial Curated Playlist
export const DEFAULT_INITIAL_PLAYLIST: YouTubeVideoItem[] = [
  {
    id: "jfKfPfyJRdk",
    type: "video",
    title: "lofi hip hop radio 📚 - beats to relax/study to",
    channel: "Lofi Girl",
    duration: "LIVE",
    url: "https://www.youtube.com/watch?v=jfKfPfyJRdk",
    thumbnail: "https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg",
    dateAdded: Date.now() - 50000
  },
  {
    id: "DWcJFNfaw9c",
    type: "video",
    title: "Warm Jazz Music - Relaxing Background Music for Coffee & Dining",
    channel: "Cafe Music BGM",
    duration: "3:24:10",
    url: "https://www.youtube.com/watch?v=DWcJFNfaw9c",
    thumbnail: "https://i.ytimg.com/vi/DWcJFNfaw9c/hqdefault.jpg",
    dateAdded: Date.now() - 40000
  },
  {
    id: "lTRiuFIWV54",
    type: "video",
    title: "Relaxing Bossa Nova Music - Acoustic Guitar & Smooth Jazz",
    channel: "Bossa Nova Cafe",
    duration: "3:02:15",
    url: "https://www.youtube.com/watch?v=lTRiuFIWV54",
    thumbnail: "https://i.ytimg.com/vi/lTRiuFIWV54/hqdefault.jpg",
    dateAdded: Date.now() - 30000
  },
  {
    id: "WPni755-Krg",
    type: "video",
    title: "Chillstep Dreams - Melodic Electronic Lounge Music",
    channel: "Ambient Beats",
    duration: "1:45:30",
    url: "https://www.youtube.com/watch?v=WPni755-Krg",
    thumbnail: "https://i.ytimg.com/vi/WPni755-Krg/hqdefault.jpg",
    dateAdded: Date.now() - 20000
  },
  {
    id: "5qap5aO4i9A",
    type: "video",
    title: "lofi hip hop radio 💤 - beats to sleep/chill to",
    channel: "Lofi Girl",
    duration: "LIVE",
    url: "https://www.youtube.com/watch?v=5qap5aO4i9A",
    thumbnail: "https://i.ytimg.com/vi/5qap5aO4i9A/hqdefault.jpg",
    dateAdded: Date.now() - 10000
  }
];

export const youtubeStorage = {
  // Playlist persistence
  getPlaylist(): YouTubeSavedPlaylistState {
    if (typeof window === 'undefined') {
      return { items: DEFAULT_INITIAL_PLAYLIST, currentIndex: 0, isLooping: true, isShuffle: false, infiniteMix: true };
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.PLAYLIST);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
          return {
            items: parsed.items,
            currentIndex: typeof parsed.currentIndex === 'number' ? parsed.currentIndex : 0,
            isLooping: parsed.isLooping !== false,
            isShuffle: !!parsed.isShuffle,
            infiniteMix: parsed.infiniteMix !== false,
          };
        }
      }
    } catch (e) {
      console.warn('Failed reading YouTube playlist from localStorage:', e);
    }
    return { items: DEFAULT_INITIAL_PLAYLIST, currentIndex: 0, isLooping: true, isShuffle: false, infiniteMix: true };
  },

  savePlaylist(state: YouTubeSavedPlaylistState) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEYS.PLAYLIST, JSON.stringify(state));
    } catch (e) {
      console.warn('Failed saving YouTube playlist to localStorage:', e);
    }
  },

  // History persistence
  getHistory(): YouTubeHistoryItem[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.HISTORY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Failed reading YouTube history from localStorage:', e);
    }
    return [];
  },

  saveHistory(history: YouTubeHistoryItem[]) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history.slice(0, 100)));
    } catch (e) {
      console.warn('Failed saving YouTube history to localStorage:', e);
    }
  },

  addToHistory(item: YouTubeVideoItem): YouTubeHistoryItem[] {
    const current = this.getHistory();
    const filtered = current.filter(h => h.id !== item.id);
    const newEntry: YouTubeHistoryItem = {
      ...item,
      playedAt: Date.now()
    };
    const updated = [newEntry, ...filtered].slice(0, 100);
    this.saveHistory(updated);
    return updated;
  },

  clearHistory() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(STORAGE_KEYS.HISTORY);
    } catch (e) {}
  },

  // Search persistence
  getSearch(): YouTubeSavedSearchState | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SEARCH);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.query === 'string' && Array.isArray(parsed.results)) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed reading YouTube search state:', e);
    }
    return null;
  },

  saveSearch(query: string, results: YouTubeVideoItem[], continuationToken: string | null = null) {
    if (typeof window === 'undefined') return;
    try {
      const data: YouTubeSavedSearchState = {
        query,
        results: results.slice(0, 60),
        continuationToken,
        timestamp: Date.now()
      };
      localStorage.setItem(STORAGE_KEYS.SEARCH, JSON.stringify(data));
      localStorage.setItem('yt_last_search', query);
      this.addSearchHistory(query);
    } catch (e) {
      console.warn('Failed saving YouTube search state:', e);
    }
  },

  // Search History persistence
  getSearchHistory(): string[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SEARCH_HISTORY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
      // Fallback: check if single last search exists
      const last = localStorage.getItem('yt_last_search');
      if (last) return [last];
    } catch (e) {
      console.warn('Failed reading YouTube search history:', e);
    }
    return [];
  },

  addSearchHistory(query: string): string[] {
    if (!query || !query.trim() || typeof window === 'undefined') return this.getSearchHistory();
    const clean = query.trim();
    try {
      const current = this.getSearchHistory();
      const filtered = current.filter(q => q.toLowerCase() !== clean.toLowerCase());
      const updated = [clean, ...filtered].slice(0, 30);
      localStorage.setItem(STORAGE_KEYS.SEARCH_HISTORY, JSON.stringify(updated));
      return updated;
    } catch (e) {
      console.warn('Failed updating YouTube search history:', e);
      return [];
    }
  },

  removeSearchHistory(query: string): string[] {
    if (typeof window === 'undefined') return [];
    try {
      const current = this.getSearchHistory();
      const updated = current.filter(q => q.toLowerCase() !== query.toLowerCase());
      localStorage.setItem(STORAGE_KEYS.SEARCH_HISTORY, JSON.stringify(updated));
      return updated;
    } catch (e) {
      return [];
    }
  },

  clearSearchHistory() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(STORAGE_KEYS.SEARCH_HISTORY);
    } catch (e) {}
  },

  // Favorites persistence
  getFavorites(): YouTubeVideoItem[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.FAVORITES);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Failed reading YouTube favorites:', e);
    }
    return [];
  },

  saveFavorites(favorites: YouTubeVideoItem[]) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favorites));
    } catch (e) {
      console.warn('Failed saving YouTube favorites:', e);
    }
  },

  toggleFavorite(item: YouTubeVideoItem): { favorites: YouTubeVideoItem[]; isFav: boolean } {
    const list = this.getFavorites();
    const exists = list.some(f => f.id === item.id);
    let updated: YouTubeVideoItem[];
    if (exists) {
      updated = list.filter(f => f.id !== item.id);
    } else {
      updated = [item, ...list];
    }
    this.saveFavorites(updated);
    return { favorites: updated, isFav: !exists };
  },

  // Last video
  getLastVideo(): YouTubeVideoItem | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.LAST_VIDEO);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {}
    return null;
  },

  saveLastVideo(item: YouTubeVideoItem) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEYS.LAST_VIDEO, JSON.stringify(item));
      if (item.url) {
        localStorage.setItem('yt_last_video_url', item.url);
      }
    } catch (e) {}
  },

  // Preferences
  getPlayerPrefs(): YouTubeSavedPlayerPrefs {
    const defaults: YouTubeSavedPlayerPrefs = {
      volume: 80,
      isMuted: false,
      autoplayEnabled: true,
      playbackRate: 1,
      theaterMode: false,
    };
    if (typeof window === 'undefined') return defaults;
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.PREFS);
      if (raw) {
        return { ...defaults, ...JSON.parse(raw) };
      }
    } catch (e) {}
    return defaults;
  },

  savePlayerPrefs(prefs: Partial<YouTubeSavedPlayerPrefs>) {
    if (typeof window === 'undefined') return;
    try {
      const current = this.getPlayerPrefs();
      const updated = { ...current, ...prefs };
      localStorage.setItem(STORAGE_KEYS.PREFS, JSON.stringify(updated));
      if (typeof prefs.autoplayEnabled === 'boolean') {
        localStorage.setItem('yt_autoplay_enabled', String(prefs.autoplayEnabled));
      }
    } catch (e) {}
  }
};
