import { YouTubeVideoItem, YouTubeHistoryItem } from '../types';
import { youtubeStorage, YouTubeSavedPlaylistState, DEFAULT_INITIAL_PLAYLIST } from './youtubeStorage';

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export type YouTubePlayerStatus = 
  | 'IDLE' 
  | 'LOADING' 
  | 'READY' 
  | 'PLAYING' 
  | 'PAUSED' 
  | 'ENDED' 
  | 'BUFFERING' 
  | 'ERROR';

export interface YouTubePlayerState {
  status: YouTubePlayerStatus;
  isPlaying: boolean;
  isLoading: boolean;
  isDucked: boolean;
  currentVideo: YouTubeVideoItem | null;
  currentTime: number;
  duration: number;
  volume: number; // 0 to 100
  isMuted: boolean;
  playbackRate: number;
  playlist: YouTubeVideoItem[];
  currentIndex: number;
  isLooping: boolean;
  isShuffle: boolean;
  infiniteMix: boolean;
  suggestions: YouTubeVideoItem[];
  isLoadingSuggestions: boolean;
  searchState: {
    query: string;
    results: YouTubeVideoItem[];
    continuationToken: string | null;
    isLoading: boolean;
    isLoadingMore: boolean;
    error: string | null;
    lastQuery: string;
    lastSearchTime: number | null;
  };
  history: YouTubeHistoryItem[];
  favorites: YouTubeVideoItem[];
  searchHistory: string[];
  autoplayBlocked: boolean;
  autoplayEnabled: boolean;
  errorDetails: {
    code: number | string;
    message: string;
    timestamp: number;
  } | null;
}

type YouTubeStateSubscriber = (state: YouTubePlayerState) => void;

export function extractYouTubeId(urlOrId: string): { videoId: string | null; playlistId: string | null } {
  let videoId: string | null = null;
  let playlistId: string | null = null;

  if (!urlOrId) return { videoId, playlistId };
  const trimmed = urlOrId.trim();

  try {
    if (trimmed.includes('http://') || trimmed.includes('https://')) {
      const parsed = new URL(trimmed);
      playlistId = parsed.searchParams.get('list');

      if (parsed.hostname.includes('youtu.be')) {
        videoId = parsed.pathname.slice(1).split('?')[0];
      } else if (parsed.pathname.includes('/shorts/')) {
        videoId = parsed.pathname.split('/shorts/')[1]?.split('?')[0];
      } else if (parsed.pathname.includes('/live/')) {
        videoId = parsed.pathname.split('/live/')[1]?.split('?')[0];
      } else if (parsed.pathname.includes('/embed/')) {
        videoId = parsed.pathname.split('/embed/')[1]?.split('?')[0];
      } else if (parsed.pathname.includes('/watch')) {
        videoId = parsed.searchParams.get('v');
      }
    } else {
      if (trimmed.length === 11 && !trimmed.includes('/') && !trimmed.includes('.')) {
        videoId = trimmed;
      } else if (trimmed.length > 15 && !trimmed.includes('/') && !trimmed.includes('.')) {
        playlistId = trimmed;
      }
    }
  } catch (e) {
    console.warn('Failed parsing YouTube URL/ID:', e);
  }

  return { videoId, playlistId };
}

class YouTubePlayerController {
  private ytPlayer: any = null;
  private ytReady = false;
  private isApiLoading = false;
  private subscribers: Set<YouTubeStateSubscriber> = new Set();
  private state: YouTubePlayerState;
  
  private progressInterval: NodeJS.Timeout | null = null;
  private loadingTimeout: NodeJS.Timeout | null = null;
  private duckingTimeout: NodeJS.Timeout | null = null;
  private duckingRestoreVolume = 80;
  private userVolume = 80;
  private abortController: AbortController | null = null;
  private suggestionsAbortController: AbortController | null = null;

  constructor() {
    const savedPlaylist = youtubeStorage.getPlaylist();
    const savedHistory = youtubeStorage.getHistory();
    const savedFavorites = youtubeStorage.getFavorites();
    const savedSearch = youtubeStorage.getSearch();
    const savedSearchHistory = youtubeStorage.getSearchHistory();
    const savedPrefs = youtubeStorage.getPlayerPrefs();
    const lastVideo = youtubeStorage.getLastVideo() || (savedPlaylist.items.length > 0 ? savedPlaylist.items[savedPlaylist.currentIndex] : null);

    this.userVolume = savedPrefs.volume;
    this.duckingRestoreVolume = savedPrefs.volume;

    this.state = {
      status: 'IDLE',
      isPlaying: false,
      isLoading: false,
      isDucked: false,
      currentVideo: lastVideo,
      currentTime: 0,
      duration: 0,
      volume: savedPrefs.volume,
      isMuted: savedPrefs.isMuted,
      playbackRate: savedPrefs.playbackRate || 1,
      playlist: savedPlaylist.items,
      currentIndex: savedPlaylist.currentIndex,
      isLooping: savedPlaylist.isLooping,
      isShuffle: savedPlaylist.isShuffle,
      infiniteMix: savedPlaylist.infiniteMix,
      suggestions: [],
      isLoadingSuggestions: false,
      searchState: {
        query: savedSearch ? savedSearch.query : '',
        results: savedSearch ? savedSearch.results : [],
        continuationToken: savedSearch ? savedSearch.continuationToken : null,
        isLoading: false,
        isLoadingMore: false,
        error: null,
        lastQuery: savedSearch ? savedSearch.query : '',
        lastSearchTime: savedSearch ? savedSearch.timestamp : null,
      },
      history: savedHistory,
      favorites: savedFavorites,
      searchHistory: savedSearchHistory,
      autoplayBlocked: false,
      autoplayEnabled: savedPrefs.autoplayEnabled,
      errorDetails: null,
    };

    if (typeof window !== 'undefined') {
      this.ensureIframeWrapper();
      this.setupWindowListeners();
      // Load initial suggestions
      setTimeout(() => {
        const initialVideoId = this.state.currentVideo?.id || 'jfKfPfyJRdk';
        this.fetchSuggestions(initialVideoId);
      }, 500);
    }
  }

  public subscribe(fn: YouTubeStateSubscriber): () => void {
    this.subscribers.add(fn);
    fn(this.getState());
    return () => {
      this.subscribers.delete(fn);
    };
  }

  public getState(): YouTubePlayerState {
    return { ...this.state };
  }

  private emitState() {
    const currentState = this.getState();
    this.subscribers.forEach(sub => {
      try {
        sub(currentState);
      } catch (err) {
        console.error('Error in YouTube subscriber:', err);
      }
    });
  }

  public ensureIframeWrapper() {
    if (typeof window === 'undefined') return;
    let container = document.getElementById('yt-music-player-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'yt-music-player-container';
      container.style.position = 'fixed';
      container.style.bottom = '0';
      container.style.right = '0';
      container.style.width = '1px';
      container.style.height = '1px';
      container.style.opacity = '0';
      container.style.pointerEvents = 'none';
      container.style.zIndex = '-9999';
      container.style.overflow = 'hidden';

      const target = document.createElement('div');
      target.id = 'yt-player-target';
      target.style.width = '100%';
      target.style.height = '100%';

      container.appendChild(target);
      document.body.appendChild(container);
    }
  }

  private loadYouTubeAPI(): Promise<void> {
    if (typeof window === 'undefined') return Promise.resolve();
    if (window.YT && window.YT.Player) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      if (this.isApiLoading) {
        const checkInterval = setInterval(() => {
          if (window.YT && window.YT.Player) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
        return;
      }

      this.isApiLoading = true;
      const prevCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (typeof prevCallback === 'function') prevCallback();
        this.isApiLoading = false;
        resolve();
      };

      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        tag.async = true;
        document.head.appendChild(tag);
      }
    });
  }

  public initPlayer(): Promise<void> {
    this.ensureIframeWrapper();
    return this.loadYouTubeAPI().then(() => {
      return new Promise<void>((resolve) => {
        if (this.ytPlayer && this.ytReady) {
          resolve();
          return;
        }

        const initialVideoId = this.state.currentVideo?.id || 'jfKfPfyJRdk';

        const playerVars: any = {
          autoplay: 0,
          controls: 1,
          enablejsapi: 1,
          disablekb: 0,
          fs: 1,
          modestbranding: 1,
          rel: 0,
          showinfo: 1,
          origin: window.location.origin,
        };

        try {
          this.ytPlayer = new window.YT.Player('yt-player-target', {
            height: '100%',
            width: '100%',
            videoId: initialVideoId,
            playerVars,
            events: {
              onReady: () => {
                this.ytReady = true;
                try {
                  this.ytPlayer.setVolume(this.state.volume);
                  if (this.state.isMuted) this.ytPlayer.mute();
                } catch (e) {}
                this.state.status = 'READY';
                this.emitState();
                resolve();
              },
              onStateChange: (event: any) => {
                this.handlePlayerStateChange(event.data);
              },
              onError: (event: any) => {
                this.handlePlayerError(event.data);
              }
            }
          });
        } catch (e: any) {
          console.error('Failed creating YT.Player instance:', e);
          this.state.status = 'ERROR';
          this.state.errorDetails = {
            code: 'INIT_FAIL',
            message: 'No se pudo iniciar el reproductor de YouTube. Intenta reinstanciarlo.',
            timestamp: Date.now()
          };
          this.emitState();
          resolve();
        }
      });
    });
  }

  private handlePlayerStateChange(stateCode: number) {
    // YT.PlayerState: PLAYING = 1, PAUSED = 2, ENDED = 0, BUFFERING = 3, CUED = 5, UNSTARTED = -1
    this.clearLoadingTimeout();

    switch (stateCode) {
      case 1: // PLAYING
        this.state.status = 'PLAYING';
        this.state.isPlaying = true;
        this.state.isLoading = false;
        this.state.autoplayBlocked = false;
        this.state.errorDetails = null;
        this.startProgressTracking();
        this.syncCurrentVideoMetadata();
        this.emitState();
        break;

      case 2: // PAUSED
        this.state.status = 'PAUSED';
        this.state.isPlaying = false;
        this.state.isLoading = false;
        this.stopProgressTracking();
        this.emitState();
        break;

      case 3: // BUFFERING
        this.state.status = 'BUFFERING';
        this.state.isLoading = true;
        this.emitState();
        break;

      case 5: // CUED
        this.state.status = 'READY';
        this.state.isLoading = false;
        this.emitState();
        break;

      case 0: // ENDED
        this.state.status = 'ENDED';
        this.state.isPlaying = false;
        this.stopProgressTracking();
        this.handleTrackEnded();
        break;

      default:
        break;
    }
  }

  private handleTrackEnded() {
    console.log('🎵 YouTube track ended. Moving to next track in queue/playlist...');
    const { playlist, currentIndex, isLooping, infiniteMix, suggestions } = this.state;

    // Advance in playlist
    if (playlist.length > 0) {
      const nextIndex = currentIndex + 1;
      if (nextIndex < playlist.length) {
        this.playPlaylistIndex(nextIndex);
        return;
      } else if (isLooping) {
        this.playPlaylistIndex(0);
        return;
      }
    }

    // If infinite mix is on and we have suggestions, play first suggestion
    if (infiniteMix && suggestions.length > 0) {
      const nextSuggestion = suggestions[0];
      console.log('🎵 Infinite Mix active: Playing next recommended video:', nextSuggestion.title);
      this.playVideo(nextSuggestion, true);
      return;
    }

    this.emitState();
  }

  private handlePlayerError(errorCode: number) {
    this.clearLoadingTimeout();
    this.state.status = 'ERROR';
    this.state.isPlaying = false;
    this.state.isLoading = false;

    let message = 'Error al reproducir el vídeo de YouTube.';
    switch (errorCode) {
      case 2:
        message = 'El parámetro del vídeo no es válido o tiene formato incorrecto.';
        break;
      case 5:
        message = 'Error de reproducción en el reproductor HTML5.';
        break;
      case 100:
        message = 'El vídeo solicitado no existe o ha sido eliminado.';
        break;
      case 101:
      case 150:
        message = 'El propietario del vídeo no permite reproducirlo en aplicaciones integradas. Saltando al siguiente...';
        break;
    }

    this.state.errorDetails = {
      code: errorCode,
      message,
      timestamp: Date.now()
    };
    this.emitState();

    // If embedding is disallowed (101 or 150), automatically skip to next video after a brief notice
    if (errorCode === 101 || errorCode === 150) {
      setTimeout(() => {
        this.nextVideo();
      }, 1500);
    }
  }

  private syncCurrentVideoMetadata() {
    if (!this.ytPlayer || !this.ytReady) return;
    try {
      if (typeof this.ytPlayer.getVideoData === 'function') {
        const data = this.ytPlayer.getVideoData();
        if (data && data.video_id) {
          const videoId = data.video_id;
          const currentUrl = `https://www.youtube.com/watch?v=${videoId}`;
          
          if (!this.state.currentVideo || this.state.currentVideo.id !== videoId) {
            const updatedVideo: YouTubeVideoItem = {
              id: videoId,
              type: 'video',
              title: data.title || this.state.currentVideo?.title || 'Vídeo de YouTube',
              channel: data.author || this.state.currentVideo?.channel || 'YouTube',
              thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
              url: currentUrl,
              duration: this.state.currentVideo?.duration || ''
            };
            this.state.currentVideo = updatedVideo;
            youtubeStorage.saveLastVideo(updatedVideo);
            this.fetchSuggestions(videoId);
          }
        }
      }

      if (typeof this.ytPlayer.getDuration === 'function') {
        this.state.duration = this.ytPlayer.getDuration() || 0;
      }
    } catch (e) {}
  }

  private startProgressTracking() {
    if (this.progressInterval) clearInterval(this.progressInterval);
    this.progressInterval = setInterval(() => {
      if (this.ytPlayer && this.ytReady && this.state.isPlaying) {
        try {
          if (typeof this.ytPlayer.getCurrentTime === 'function') {
            this.state.currentTime = this.ytPlayer.getCurrentTime() || 0;
          }
          if (typeof this.ytPlayer.getDuration === 'function') {
            const dur = this.ytPlayer.getDuration() || 0;
            if (dur > 0) this.state.duration = dur;
          }
          this.emitState();
        } catch (e) {}
      }
    }, 1000);
  }

  private stopProgressTracking() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }

  private startLoadingTimeout() {
    this.clearLoadingTimeout();
    this.loadingTimeout = setTimeout(() => {
      if (this.state.status === 'LOADING') {
        console.warn('YouTube playback initialization timed out.');
        this.state.status = 'READY';
        this.state.isLoading = false;
        this.emitState();
      }
    }, 12000);
  }

  private clearLoadingTimeout() {
    if (this.loadingTimeout) {
      clearTimeout(this.loadingTimeout);
      this.loadingTimeout = null;
    }
  }

  private setupWindowListeners() {
    // Network reconnect listener
    window.addEventListener('online', () => {
      console.log('Network back online. Checking YouTube player state...');
      if (this.state.isPlaying) {
        this.play();
      }
    });

    // User interaction unlock for autoplay policy
    const unlockAutoplay = () => {
      if (this.state.autoplayBlocked && this.state.autoplayEnabled) {
        console.log('User gesture detected, unlocking blocked autoplay...');
        this.play();
      }
    };
    window.addEventListener('click', unlockAutoplay, { once: false, passive: true });
    window.addEventListener('keydown', unlockAutoplay, { once: false, passive: true });
  }

  // --- PLAYBACK CONTROLS ---

  public async play() {
    this.state.isLoading = true;
    this.state.status = 'LOADING';
    this.startLoadingTimeout();
    this.emitState();

    await this.initPlayer();

    if (this.ytPlayer && this.ytReady) {
      try {
        const { videoId } = extractYouTubeId(this.state.currentVideo?.url || this.state.currentVideo?.id || 'jfKfPfyJRdk');
        
        // If player has no video or a different video, load it
        if (videoId) {
          this.ytPlayer.loadVideoById(videoId);
        } else {
          this.ytPlayer.playVideo();
        }
      } catch (err: any) {
        console.warn('playVideo failed (autoplay policy or load error):', err);
        this.state.autoplayBlocked = true;
        this.state.status = 'PAUSED';
        this.state.isLoading = false;
        this.emitState();
      }
    }
  }

  public pause() {
    if (this.ytPlayer && this.ytReady) {
      try {
        this.ytPlayer.pauseVideo();
      } catch (e) {}
    }
    this.state.isPlaying = false;
    this.state.status = 'PAUSED';
    this.stopProgressTracking();
    this.emitState();
  }

  public togglePlay() {
    if (this.state.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  public playVideo(item: YouTubeVideoItem, addToHistory = true) {
    // If it's a YouTube playlist, load and play the playlist
    if (item.type === 'playlist' || (item.url && item.url.includes('list='))) {
      const { playlistId } = extractYouTubeId(item.url || item.id);
      if (playlistId) {
        this.loadYouTubePlaylist(playlistId, true);
        return;
      }
    }

    this.state.currentVideo = item;
    youtubeStorage.saveLastVideo(item);

    if (addToHistory) {
      const updatedHistory = youtubeStorage.addToHistory(item);
      this.state.history = updatedHistory;
    }

    // Check if this video is in the current playlist
    const foundIndex = this.state.playlist.findIndex(p => p.id === item.id);
    if (foundIndex !== -1) {
      this.state.currentIndex = foundIndex;
      this.savePlaylistState();
    }

    this.play();
    this.fetchSuggestions(item.id, item.title);
  }

  public async loadYouTubePlaylist(listIdOrUrl: string, playNow = true, append = false): Promise<boolean> {
    if (!listIdOrUrl) return false;
    const { playlistId } = extractYouTubeId(listIdOrUrl);
    const targetId = playlistId || listIdOrUrl.trim();

    this.state.isLoading = true;
    this.emitState();

    try {
      const res = await fetch(`/api/youtube/playlist?listId=${encodeURIComponent(targetId)}`);
      const data = await res.json();

      if (data && data.items && Array.isArray(data.items) && data.items.length > 0) {
        const playlistVideos: YouTubeVideoItem[] = data.items.map((vid: any) => ({
          id: vid.id,
          type: 'video' as const,
          title: vid.title,
          channel: vid.channel || data.playlist?.title || 'YouTube',
          thumbnail: vid.thumbnail,
          url: vid.url || `https://www.youtube.com/watch?v=${vid.id}`,
          duration: vid.duration,
          dateAdded: Date.now()
        }));

        if (append) {
          const currentIds = new Set(this.state.playlist.map(x => x.id));
          const filteredNew = playlistVideos.filter(x => !currentIds.has(x.id));
          this.state.playlist = [...this.state.playlist, ...filteredNew];
        } else {
          this.state.playlist = playlistVideos;
          this.state.currentIndex = 0;
        }

        this.savePlaylistState();

        if (playNow && playlistVideos.length > 0) {
          this.playPlaylistIndex(append ? this.state.playlist.length - playlistVideos.length : 0);
        } else {
          this.state.isLoading = false;
          this.emitState();
        }
        return true;
      }
    } catch (err) {
      console.warn('Failed to load YouTube playlist:', err);
    }

    this.state.isLoading = false;
    this.emitState();
    return false;
  }

  public async importYouTubeUrl(url: string): Promise<boolean> {
    if (!url || !url.trim()) return false;
    const trimmed = url.trim();
    const { videoId, playlistId } = extractYouTubeId(trimmed);

    if (playlistId) {
      return await this.loadYouTubePlaylist(playlistId, true);
    }

    if (videoId) {
      const item: YouTubeVideoItem = {
        id: videoId,
        type: 'video',
        title: 'Vídeo Enlace YouTube',
        channel: 'YouTube Oficial',
        thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        url: `https://www.youtube.com/watch?v=${videoId}`
      };
      this.playVideo(item, true);
      return true;
    }

    return false;
  }

  public playPlaylistIndex(index: number) {
    if (index < 0 || index >= this.state.playlist.length) return;
    this.state.currentIndex = index;
    const item = this.state.playlist[index];
    this.savePlaylistState();
    this.playVideo(item, true);
  }

  public nextVideo() {
    const { playlist, currentIndex, isLooping } = this.state;
    if (playlist.length === 0) return;

    let nextIdx = currentIndex + 1;
    if (nextIdx >= playlist.length) {
      if (isLooping) {
        nextIdx = 0;
      } else {
        return;
      }
    }
    this.playPlaylistIndex(nextIdx);
  }

  public previousVideo() {
    const { playlist, currentIndex, isLooping } = this.state;
    if (playlist.length === 0) return;

    let prevIdx = currentIndex - 1;
    if (prevIdx < 0) {
      if (isLooping) {
        prevIdx = playlist.length - 1;
      } else {
        prevIdx = 0;
      }
    }
    this.playPlaylistIndex(prevIdx);
  }

  public seekTo(seconds: number) {
    if (this.ytPlayer && this.ytReady) {
      try {
        this.ytPlayer.seekTo(seconds, true);
        this.state.currentTime = seconds;
        this.emitState();
      } catch (e) {}
    }
  }

  public setVolume(vol: number) {
    const clamped = Math.max(0, Math.min(100, vol));
    this.userVolume = clamped;
    this.state.volume = clamped;
    this.state.isMuted = clamped === 0;

    if (this.ytPlayer && this.ytReady && !this.state.isDucked) {
      try {
        this.ytPlayer.setVolume(clamped);
        if (this.state.isMuted) this.ytPlayer.mute();
        else this.ytPlayer.unMute();
      } catch (e) {}
    }

    youtubeStorage.savePlayerPrefs({ volume: clamped, isMuted: this.state.isMuted });
    this.emitState();
  }

  public toggleMute() {
    this.state.isMuted = !this.state.isMuted;
    if (this.ytPlayer && this.ytReady) {
      try {
        if (this.state.isMuted) {
          this.ytPlayer.mute();
        } else {
          this.ytPlayer.unMute();
          this.ytPlayer.setVolume(this.state.volume || 80);
        }
      } catch (e) {}
    }
    youtubeStorage.savePlayerPrefs({ isMuted: this.state.isMuted });
    this.emitState();
  }

  public setPlaybackRate(rate: number) {
    this.state.playbackRate = rate;
    if (this.ytPlayer && this.ytReady) {
      try {
        this.ytPlayer.setPlaybackRate(rate);
      } catch (e) {}
    }
    youtubeStorage.savePlayerPrefs({ playbackRate: rate });
    this.emitState();
  }

  // --- PLAYLIST MANAGEMENT ---

  public addToPlaylist(item: YouTubeVideoItem, playNow = false) {
    const existingIndex = this.state.playlist.findIndex(x => x.id === item.id);
    let updatedPlaylist = [...this.state.playlist];

    if (existingIndex === -1) {
      const withDate = { ...item, dateAdded: Date.now() };
      updatedPlaylist.push(withDate);
    }

    this.state.playlist = updatedPlaylist;
    this.savePlaylistState();

    if (playNow) {
      const idx = existingIndex !== -1 ? existingIndex : updatedPlaylist.length - 1;
      this.playPlaylistIndex(idx);
    } else {
      this.emitState();
    }
  }

  public removeFromPlaylist(indexOrId: number | string) {
    let updatedPlaylist: YouTubeVideoItem[];
    if (typeof indexOrId === 'number') {
      updatedPlaylist = this.state.playlist.filter((_, idx) => idx !== indexOrId);
    } else {
      updatedPlaylist = this.state.playlist.filter(item => item.id !== indexOrId);
    }

    if (this.state.currentIndex >= updatedPlaylist.length) {
      this.state.currentIndex = Math.max(0, updatedPlaylist.length - 1);
    }

    this.state.playlist = updatedPlaylist;
    this.savePlaylistState();
    this.emitState();
  }

  public reorderPlaylist(fromIndex: number, toIndex: number) {
    if (fromIndex < 0 || fromIndex >= this.state.playlist.length || toIndex < 0 || toIndex >= this.state.playlist.length) return;
    const updated = [...this.state.playlist];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);

    // Adjust currentIndex
    if (this.state.currentIndex === fromIndex) {
      this.state.currentIndex = toIndex;
    } else if (fromIndex < this.state.currentIndex && toIndex >= this.state.currentIndex) {
      this.state.currentIndex--;
    } else if (fromIndex > this.state.currentIndex && toIndex <= this.state.currentIndex) {
      this.state.currentIndex++;
    }

    this.state.playlist = updated;
    this.savePlaylistState();
    this.emitState();
  }

  public clearPlaylist() {
    this.state.playlist = [];
    this.state.currentIndex = 0;
    this.savePlaylistState();
    this.emitState();
  }

  public resetPlaylistToDefaults() {
    this.state.playlist = DEFAULT_INITIAL_PLAYLIST;
    this.state.currentIndex = 0;
    this.savePlaylistState();
    this.emitState();
  }

  public toggleLoop() {
    this.state.isLooping = !this.state.isLooping;
    this.savePlaylistState();
    this.emitState();
  }

  public toggleShuffle() {
    this.state.isShuffle = !this.state.isShuffle;
    this.savePlaylistState();
    this.emitState();
  }

  public toggleInfiniteMix() {
    this.state.infiniteMix = !this.state.infiniteMix;
    this.savePlaylistState();
    this.emitState();
  }

  public toggleAutoplay() {
    this.state.autoplayEnabled = !this.state.autoplayEnabled;
    youtubeStorage.savePlayerPrefs({ autoplayEnabled: this.state.autoplayEnabled });
    this.emitState();
  }

  private savePlaylistState() {
    youtubeStorage.savePlaylist({
      items: this.state.playlist,
      currentIndex: this.state.currentIndex,
      isLooping: this.state.isLooping,
      isShuffle: this.state.isShuffle,
      infiniteMix: this.state.infiniteMix,
    });
  }

  // --- SEARCH & SUGGESTIONS ---

  public async search(query: string, isLoadMore = false) {
    if (!query.trim()) return;

    if (this.abortController) {
      this.abortController.abort();
    }
    const ac = new AbortController();
    this.abortController = ac;

    if (isLoadMore) {
      if (this.state.searchState.isLoadingMore || !this.state.searchState.continuationToken) return;
      this.state.searchState.isLoadingMore = true;
    } else {
      this.state.searchState.isLoading = true;
      this.state.searchState.error = null;
      this.state.searchState.query = query;
      this.state.searchState.lastQuery = query;
      this.state.searchState.lastSearchTime = Date.now();
    }
    this.emitState();

    try {
      let endpoint = `/api/youtube/search?query=${encodeURIComponent(query)}`;
      if (isLoadMore && this.state.searchState.continuationToken) {
        endpoint += `&continuation=${encodeURIComponent(this.state.searchState.continuationToken)}`;
      }

      const res = await fetch(endpoint, { signal: ac.signal });
      const data = await res.json();

      if (ac.signal.aborted) return;

      if (data.error) {
        this.state.searchState.error = data.error;
        this.state.searchState.isLoading = false;
        this.state.searchState.isLoadingMore = false;
        this.emitState();
        return;
      }

      const newItems: YouTubeVideoItem[] = data.items || [];
      const token = data.continuationToken || null;

      let mergedResults: YouTubeVideoItem[];
      if (isLoadMore) {
        mergedResults = [...this.state.searchState.results, ...newItems];
      } else {
        mergedResults = newItems;
      }

      this.state.searchState.results = mergedResults;
      this.state.searchState.continuationToken = token;
      this.state.searchState.isLoading = false;
      this.state.searchState.isLoadingMore = false;
      this.state.searchState.error = null;

      youtubeStorage.saveSearch(query, mergedResults, token);
      this.state.searchHistory = youtubeStorage.getSearchHistory();
      this.emitState();
    } catch (err: any) {
      if (ac.signal.aborted) return;
      console.warn('Search request failed:', err);
      this.state.searchState.isLoading = false;
      this.state.searchState.isLoadingMore = false;
      this.state.searchState.error = 'No se pudieron cargar los resultados de búsqueda. Inténtalo de nuevo.';
      this.emitState();
    }
  }

  public removeSearchHistoryItem(query: string) {
    const updated = youtubeStorage.removeSearchHistory(query);
    this.state.searchHistory = updated;
    this.emitState();
  }

  public clearSearchHistory() {
    youtubeStorage.clearSearchHistory();
    this.state.searchHistory = [];
    this.emitState();
  }

  public async fetchSuggestions(videoId?: string, query?: string) {
    if (this.suggestionsAbortController) {
      this.suggestionsAbortController.abort();
    }
    const ac = new AbortController();
    this.suggestionsAbortController = ac;

    this.state.isLoadingSuggestions = true;
    this.emitState();

    try {
      const targetVideoId = videoId || this.state.currentVideo?.id || 'jfKfPfyJRdk';
      const endpoint = `/api/youtube/suggestions?videoId=${encodeURIComponent(targetVideoId)}&query=${encodeURIComponent(query || '')}`;
      const res = await fetch(endpoint, { signal: ac.signal });
      const data = await res.json();

      if (ac.signal.aborted) return;

      if (data.items && Array.isArray(data.items)) {
        this.state.suggestions = data.items;
      }
      this.state.isLoadingSuggestions = false;
      this.emitState();
    } catch (e: any) {
      if (ac.signal.aborted) return;
      this.state.isLoadingSuggestions = false;
      this.emitState();
    }
  }

  public toggleFavorite(item: YouTubeVideoItem) {
    const { favorites } = youtubeStorage.toggleFavorite(item);
    this.state.favorites = favorites;
    this.emitState();
  }

  public clearHistory() {
    youtubeStorage.clearHistory();
    this.state.history = [];
    this.emitState();
  }

  // --- RECOVERY & DUCKING ---

  public recoverPlayer(): Promise<void> {
    console.log('Reinstantiating YouTube player...');
    if (this.ytPlayer && typeof this.ytPlayer.destroy === 'function') {
      try {
        this.ytPlayer.destroy();
      } catch (e) {}
    }
    this.ytPlayer = null;
    this.ytReady = false;

    const container = document.getElementById('yt-music-player-container');
    if (container) {
      container.innerHTML = '<div id="yt-player-target" style="width: 100%; height: 100%;"></div>';
    } else {
      this.ensureIframeWrapper();
    }

    this.state.status = 'IDLE';
    this.state.errorDetails = null;
    this.emitState();

    return this.initPlayer().then(() => {
      if (this.state.isPlaying) {
        this.play();
      }
    });
  }

  public startAnnouncementDucking(duckPercent = 30) {
    if (this.duckingTimeout) {
      clearTimeout(this.duckingTimeout);
      this.duckingTimeout = null;
    }

    if (!this.state.isDucked) {
      this.duckingRestoreVolume = this.state.volume;
      this.state.isDucked = true;
      const duckedVolume = Math.round((this.duckingRestoreVolume * duckPercent) / 100);

      if (this.ytPlayer && this.ytReady && !this.state.isMuted) {
        try {
          this.ytPlayer.setVolume(duckedVolume);
        } catch (e) {}
      }
      this.emitState();
    }
  }

  public stopAnnouncementDucking() {
    if (this.duckingTimeout) clearTimeout(this.duckingTimeout);
    this.duckingTimeout = setTimeout(() => {
      if (this.state.isDucked) {
        this.state.isDucked = false;
        if (this.ytPlayer && this.ytReady && !this.state.isMuted) {
          try {
            this.ytPlayer.setVolume(this.duckingRestoreVolume);
          } catch (e) {}
        }
        this.emitState();
      }
    }, 600);
  }
}

export const youtubePlayerController = new YouTubePlayerController();
