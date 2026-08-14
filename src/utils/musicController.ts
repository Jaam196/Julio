import { MusicConfig } from '../types';

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export interface MusicPlayerState {
  isPlaying: boolean;
  isLoading: boolean;
  isDucked: boolean;
  currentVolume: number; // 0 to 100
  error: string | null;
  lastErrorDetail: string | null;
  activeUrl: string;
  isYouTube: boolean;
  trackTitle: string;
  channelTitle: string;
  thumbnailUrl: string;
  duration: number;
  currentTime: number;
  autoplayBlocked: boolean;
}

type Subscriber = (state: MusicPlayerState) => void;

export function parseYouTubeUrl(url: string): { videoId: string | null; playlistId: string | null } {
  let videoId: string | null = null;
  let playlistId: string | null = null;

  if (!url) return { videoId, playlistId };

  try {
    if (url.includes('http://') || url.includes('https://')) {
      const urlObj = new URL(url);
      
      // Extract playlist ID
      playlistId = urlObj.searchParams.get('list');

      if (urlObj.hostname.includes('youtu.be')) {
        videoId = urlObj.pathname.slice(1).split('?')[0];
      } else if (urlObj.pathname.includes('/shorts/')) {
        videoId = urlObj.pathname.split('/shorts/')[1]?.split('?')[0];
      } else if (urlObj.pathname.includes('/live/')) {
        videoId = urlObj.pathname.split('/live/')[1]?.split('?')[0];
      } else if (urlObj.pathname.includes('/embed/')) {
        videoId = urlObj.pathname.split('/embed/')[1]?.split('?')[0];
      } else if (urlObj.pathname.includes('/playlist')) {
        videoId = null;
      } else {
        videoId = urlObj.searchParams.get('v');
      }
    } else {
      if (url.length === 11 && !url.includes('/') && !url.includes('.')) {
        videoId = url;
      } else if (url.length > 15 && !url.includes('/') && !url.includes('.')) {
        playlistId = url;
      }
    }
  } catch (e) {
    console.warn('Failed parsing YouTube URL:', e);
  }

  return { videoId, playlistId };
}

class MusicController {
  private audio: HTMLAudioElement | null = null;
  private config: MusicConfig = {
    enabled: true,
    mode: 'duck40',
    autoResume: true,
    infinitePlay: true,
    shuffle: false,
    resumePlaylistProgress: true,
    integratedEnabled: true,
    integratedUrl: '',
    integratedVolume: 80,
    favorites: [],
    history: [],
    customPlaylists: []
  };

  private isPlaying = false;
  private isLoading = false;
  private isDucked = false;
  private originalVolumeBeforeDucking = 80;
  private activeAnnouncements = 0;
  private restoreTimeout: NodeJS.Timeout | null = null;
  private subscribers: Set<Subscriber> = new Set();
  private fadeInterval: NodeJS.Timeout | null = null;
  private errorState: string | null = null;
  private lastErrorDetail: string | null = null;
  private autoplayBlocked = false;
  private isTemporarilyPausedByAnnouncement = false;
  private onConfigChange: ((config: MusicConfig) => void) | null = null;

  // YouTube properties
  private ytPlayer: any = null;
  private ytReady = false;
  private ytApiLoading = false;
  private ytInitPromise: Promise<void> | null = null;
  private ytLoadedUrl: string | null = null;
  private loadingTimeout: NodeJS.Timeout | null = null;

  // Autoplay, Keep-Alive, & Progress Tracking properties
  private autoplayPending = false;
  private autoplayHasFired = false;
  private progressInterval: NodeJS.Timeout | null = null;
  private keepAliveInterval: NodeJS.Timeout | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.ensureWrapperCreated();
      this.setupNetworkListeners();
      this.startKeepAlive();
    }
  }

  public ensureWrapperCreated() {
    if (typeof window === 'undefined') return;
    let target = document.getElementById('yt-player-target');
    if (!target) {
      const wrapper = document.createElement('div');
      wrapper.id = 'yt-music-player-container';
      wrapper.style.position = 'fixed';
      wrapper.style.bottom = '0';
      wrapper.style.right = '0';
      wrapper.style.width = '1px';
      wrapper.style.height = '1px';
      wrapper.style.opacity = '0';
      wrapper.style.pointerEvents = 'none';
      wrapper.style.zIndex = '-9999';
      wrapper.style.overflow = 'hidden';

      target = document.createElement('div');
      target.id = 'yt-player-target';
      target.style.width = '100%';
      target.style.height = '100%';
      
      wrapper.appendChild(target);
      document.body.appendChild(wrapper);
    }
  }

  public playUrl(url: string) {
    if (!url) return;
    if (typeof window !== 'undefined') {
      localStorage.setItem('yt_last_video_url', url);
    }
    this.setConfig({ ...this.config, integratedUrl: url });
    setTimeout(() => {
      this.play();
    }, 100);
  }

  public triggerAutoplay() {
    if (this.autoplayHasFired) return;
    if (!this.config.enabled || !this.config.integratedEnabled) return;

    if (typeof window !== 'undefined') {
      const currentTab = localStorage.getItem('activeTab');
      if (currentTab === 'tablet') {
        console.log("Autoplay skipped because app is in Tablet mode.");
        return;
      }
      const isAutoplayEnabled = localStorage.getItem('yt_autoplay_enabled') !== 'false';
      if (!isAutoplayEnabled) {
        console.log("Autoplay is disabled by user setting ('Reproducción Automática' off).");
        return;
      }
      const lastUrl = localStorage.getItem('yt_last_video_url');
      if (lastUrl) {
        this.config.integratedUrl = lastUrl;
      }
    }

    if (!this.config.integratedUrl) return;

    console.log("Attempting background music autoplay with last video:", this.config.integratedUrl);
    this.autoplayHasFired = true;

    this.play();
    this.autoplayPending = true;
    this.setupAutoplayListeners();
  }

  private setupAutoplayListeners() {
    if (typeof window === 'undefined') return;
    
    const triggerAutoplayOnGesture = () => {
      if (this.autoplayPending && this.config.enabled && this.config.integratedEnabled && !this.isPlaying) {
        console.log('User gesture detected, triggering pending autoplay...');
        this.play();
      }
      this.autoplayPending = false;
      this.autoplayBlocked = false;
      cleanup();
    };

    const cleanup = () => {
      window.removeEventListener('click', triggerAutoplayOnGesture, true);
      window.removeEventListener('keydown', triggerAutoplayOnGesture, true);
      window.removeEventListener('touchstart', triggerAutoplayOnGesture, true);
    };

    window.addEventListener('click', triggerAutoplayOnGesture, true);
    window.addEventListener('keydown', triggerAutoplayOnGesture, true);
    window.addEventListener('touchstart', triggerAutoplayOnGesture, true);
  }

  private startProgressTracking() {
    if (this.progressInterval) clearInterval(this.progressInterval);
    this.progressInterval = setInterval(() => {
      this.saveProgress();
      this.notify();
    }, 1000);
  }

  private stopProgressTracking() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }

  private getProgressStorageKey(): string {
    if (!this.config.integratedUrl) return '';
    try {
      return 'yt_progress_' + btoa(encodeURIComponent(this.config.integratedUrl));
    } catch (e) {
      return 'yt_progress_default';
    }
  }

  private saveProgress() {
    if (typeof window === 'undefined' || !this.isPlaying || !this.config.integratedEnabled) return;
    const key = this.getProgressStorageKey();
    if (!key) return;

    const isYT = this.isYouTubeUrl(this.config.integratedUrl);
    if (isYT && this.ytPlayer && this.ytReady) {
      try {
        let index = 0;
        if (typeof this.ytPlayer.getPlaylistIndex === 'function') {
          index = this.ytPlayer.getPlaylistIndex() || 0;
        }
        let time = 0;
        if (typeof this.ytPlayer.getCurrentTime === 'function') {
          time = this.ytPlayer.getCurrentTime() || 0;
        }
        const duration = typeof this.ytPlayer.getDuration === 'function' ? this.ytPlayer.getDuration() : 0;
        
        if (duration > 0 && duration - time < 5) {
          return;
        }

        localStorage.setItem(key, JSON.stringify({ index, time }));
      } catch (e) {
        console.warn('Failed to save YouTube progress:', e);
      }
    } else if (!isYT && this.audio) {
      try {
        const time = this.audio.currentTime || 0;
        const duration = this.audio.duration || 0;
        if (duration > 0 && duration - time < 5) {
          return;
        }
        localStorage.setItem(key, JSON.stringify({ index: 0, time }));
      } catch (e) {}
    }
  }

  private getSavedProgress(): { index: number; time: number } | null {
    if (typeof window === 'undefined') return null;
    const key = this.getProgressStorageKey();
    if (!key) return null;

    try {
      const dataStr = localStorage.getItem(key);
      if (dataStr) {
        return JSON.parse(dataStr);
      }
    } catch (e) {
      console.warn('Failed to read saved progress:', e);
    }
    return null;
  }

  private setupNetworkListeners() {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      console.log('Network connection restored. Checking background music...');
      if (this.config.enabled && this.config.integratedEnabled && !this.isPlaying) {
        const wasPlaySupposedToBeActive = localStorage.getItem('music_should_be_playing') === 'true';
        if (wasPlaySupposedToBeActive) {
          console.log('Resuming music playback post-network restoration...');
          this.play();
        }
      }
    });
  }

  private startKeepAlive() {
    if (this.keepAliveInterval) clearInterval(this.keepAliveInterval);
    this.keepAliveInterval = setInterval(() => {
      this.checkKeepAlive();
    }, 8000);
  }

  private stopKeepAlive() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }

  private checkKeepAlive() {
    if (typeof window === 'undefined') return;
    if (!this.config.enabled || !this.config.integratedEnabled) return;
    if (this.activeAnnouncements > 0 || this.isTemporarilyPausedByAnnouncement) return;

    const shouldBePlaying = localStorage.getItem('music_should_be_playing') === 'true';
    if (shouldBePlaying && !this.isPlaying && !this.isLoading && !this.errorState && !this.autoplayBlocked) {
      console.log('Keep-alive heartbeat: Music was supposed to be playing but is stopped. Re-triggering...');
      this.play();
    }
  }

  public setOnConfigChange(cb: (config: MusicConfig) => void) {
    this.onConfigChange = cb;
  }

  private isYouTubeUrl(url: string): boolean {
    if (!url) return false;
    return url.includes('youtube.com') || url.includes('youtu.be') || (url.length === 11 && !url.includes('/') && !url.includes('.'));
  }

  private initAudio() {
    if (this.audio) {
      this.audio.loop = this.config.infinitePlay;
      return;
    }
    
    try {
      this.audio = new Audio();
      this.audio.loop = this.config.infinitePlay;
      
      this.audio.volume = this.config.integratedVolume / 100;
      this.originalVolumeBeforeDucking = this.config.integratedVolume;

      this.audio.onplay = () => {
        this.isPlaying = true;
        this.isLoading = false;
        this.errorState = null;
        this.lastErrorDetail = null;
        this.autoplayBlocked = false;
        this.notify();
      };

      this.audio.onpause = () => {
        if (!this.isTemporarilyPausedByAnnouncement) {
          this.isPlaying = false;
        }
        this.notify();
      };

      this.audio.onended = () => {
        if (this.config.infinitePlay) {
          this.audio?.play().catch(err => console.warn('Audio loop retry failed:', err));
        } else {
          this.isPlaying = false;
          this.notify();
        }
      };

      this.audio.onerror = () => {
        if (!this.audio?.src || this.audio.src === window.location.href) return;
        console.warn('Music controller audio error');
        this.errorState = 'No se pudo cargar el archivo de audio. Verifica la URL.';
        this.lastErrorDetail = 'Audio element error event fired.';
        this.isPlaying = false;
        this.isLoading = false;
        this.notify();
      };
    } catch (err: any) {
      console.warn('Failed to initialize Audio Element:', err);
    }
  }

  private loadYouTubeAPI(): Promise<void> {
    if (window.YT && window.YT.Player) {
      return Promise.resolve();
    }
    if (this.ytApiLoading) {
      return new Promise<void>((resolve) => {
        const interval = setInterval(() => {
          if (window.YT && window.YT.Player) {
            clearInterval(interval);
            resolve();
          }
        }, 100);
      });
    }

    this.ytApiLoading = true;
    return new Promise<void>((resolve) => {
      const existing = document.getElementById('youtube-iframe-api');
      if (!existing) {
        const tag = document.createElement('script');
        tag.id = 'youtube-iframe-api';
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
      }

      const prevCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (prevCallback) prevCallback();
        this.ytApiLoading = false;
        resolve();
      };

      const interval = setInterval(() => {
        if (window.YT && window.YT.Player) {
          clearInterval(interval);
          this.ytApiLoading = false;
          resolve();
        }
      }, 100);
    });
  }

  private startLoadingTimeout() {
    this.clearLoadingTimeout();
    this.isLoading = true;
    this.loadingTimeout = setTimeout(() => {
      if (this.isLoading && !this.isPlaying) {
        console.warn("YouTube video load timed out (>12s)");
        this.isLoading = false;
        this.errorState = "El vídeo está tardando demasiado en cargar.";
        this.lastErrorDetail = "Excedido el tiempo de espera de respuesta del reproductor de YouTube.";
        this.notify();
      }
    }, 12000);
  }

  private clearLoadingTimeout() {
    if (this.loadingTimeout) {
      clearTimeout(this.loadingTimeout);
      this.loadingTimeout = null;
    }
  }

  public recoverPlayer(): Promise<void> {
    console.log("Recovering YouTube player...");
    if (this.ytPlayer && typeof this.ytPlayer.destroy === 'function') {
      try {
        this.ytPlayer.destroy();
      } catch (e) {}
    }
    this.ytPlayer = null;
    this.ytReady = false;
    this.ytInitPromise = null;
    this.ytLoadedUrl = null;
    this.clearLoadingTimeout();
    
    const container = document.getElementById('yt-music-player-container');
    if (container) {
      container.innerHTML = '<div id="yt-player-target" style="width: 100%; height: 100%;"></div>';
    } else {
      this.ensureWrapperCreated();
    }

    this.errorState = null;
    this.lastErrorDetail = null;
    this.isLoading = false;
    
    return this.initYouTubePlayer().then(() => {
      if (this.isPlaying) {
        this.play();
      }
      this.notify();
    });
  }

  private initYouTubePlayer(): Promise<void> {
    if (this.ytInitPromise) {
      return this.ytInitPromise;
    }

    this.ytInitPromise = this.loadYouTubeAPI().then(() => {
      return new Promise<void>((resolve, reject) => {
        this.ensureWrapperCreated();

        let { videoId, playlistId } = parseYouTubeUrl(this.config.integratedUrl);

        const playerVars: any = {
          autoplay: 0,
          controls: 1,
          enablejsapi: 1,
          disablekb: 0,
          fs: 1,
          modestbranding: 1,
          rel: 0,
          showinfo: 1,
        };

        if (playlistId) {
          playerVars.listType = 'playlist';
          playerVars.list = playlistId;
        } else if (videoId && this.config.infinitePlay !== false) {
          playerVars.listType = 'playlist';
          playerVars.list = 'RD' + videoId;
        }

        try {
          this.ytPlayer = new window.YT.Player('yt-player-target', {
            height: '100%',
            width: '100%',
            videoId: videoId || undefined,
            playerVars,
            events: {
              onReady: () => {
                this.ytReady = true;
                try {
                  this.ytPlayer.setVolume(this.config.integratedVolume);
                  if (typeof this.ytPlayer.setShuffle === 'function') {
                    this.ytPlayer.setShuffle(this.config.shuffle);
                  }
                } catch (e) {}
                resolve();
              },
              onStateChange: (event: any) => {
                // YT.PlayerState.PLAYING = 1, PAUSED = 2, ENDED = 0, CUED = 5, BUFFERING = 3
                if (event.data === 1) { // PLAYING
                  this.isPlaying = true;
                  this.isLoading = false;
                  this.clearLoadingTimeout();
                  this.errorState = null;
                  this.lastErrorDetail = null;
                  this.autoplayBlocked = false;
                  this.startProgressTracking();

                  // Update current video URL & metadata when YouTube auto-advances to a suggested video
                  if (typeof this.ytPlayer.getVideoData === 'function') {
                    try {
                      const data = this.ytPlayer.getVideoData();
                      if (data && data.video_id) {
                        const currentUrl = `https://www.youtube.com/watch?v=${data.video_id}`;
                        if (this.config.integratedUrl !== currentUrl && !currentUrl.includes('undefined')) {
                          console.log("🎵 YouTube avanzó automáticamente a un vídeo sugerido:", data.title, currentUrl);
                          this.config.integratedUrl = currentUrl;
                          this.ytLoadedUrl = currentUrl;
                          if (typeof window !== 'undefined') {
                            localStorage.setItem('yt_last_video_url', currentUrl);
                          }
                          if (this.onConfigChange) {
                            this.onConfigChange({ ...this.config });
                          }
                        }
                      }
                    } catch (e) {}
                  }
                } else if (event.data === 2) { // PAUSED
                  if (!this.isTemporarilyPausedByAnnouncement) {
                    this.isPlaying = false;
                    this.stopProgressTracking();
                    this.saveProgress();
                  }
                } else if (event.data === 5) { // CUED
                  this.isLoading = false;
                  this.clearLoadingTimeout();
                } else if (event.data === 0) { // ENDED
                  this.stopProgressTracking();
                  if (this.config.infinitePlay !== false) {
                    let advanced = false;
                    try {
                      if (this.ytPlayer && typeof this.ytPlayer.nextVideo === 'function') {
                        this.ytPlayer.nextVideo();
                        advanced = true;
                      }
                    } catch (e) {
                      console.warn('nextVideo failed on ENDED:', e);
                    }

                    if (!advanced && this.ytPlayer) {
                      let { videoId } = parseYouTubeUrl(this.config.integratedUrl);
                      if (videoId && typeof this.ytPlayer.loadPlaylist === 'function') {
                        try {
                          this.ytPlayer.loadPlaylist({
                            listType: 'playlist',
                            list: 'RD' + videoId,
                            index: 1
                          });
                          advanced = true;
                        } catch (e) {}
                      }
                    }

                    if (!advanced && this.ytPlayer) {
                      try {
                        this.ytPlayer.playVideo();
                      } catch (e) {}
                    }
                    this.isPlaying = true;
                    this.startProgressTracking();
                  } else {
                    this.isPlaying = false;
                  }
                }
                this.notify();
              },
              onError: (err: any) => {
                console.warn('YouTube Player error code:', err?.data);
                this.isLoading = false;
                this.clearLoadingTimeout();
                let errMsg = 'Ocurrió un error con el reproductor de YouTube.';
                let detail = `Código de error de YouTube: ${err?.data}`;

                if (err.data === 101 || err.data === 150) {
                  errMsg = 'Este vídeo no permite reproducción integrada fuera de YouTube.';
                  detail = 'Restricción de inserción del propietario del vídeo (error 101/150).';
                } else if (err.data === 100) {
                  errMsg = 'El vídeo de YouTube no existe, fue eliminado o es privado.';
                  detail = 'Vídeo no encontrado o privado (error 100).';
                } else if (err.data === 2) {
                  errMsg = 'Enlace de YouTube inválido o parámetro erróneo.';
                  detail = 'Identificador de vídeo no válido (error 2).';
                } else if (err.data === 5) {
                  errMsg = 'Error de reproducción HTML5 en YouTube.';
                  detail = 'Error en el reproductor HTML5 interno de YouTube (error 5).';
                }

                this.errorState = errMsg;
                this.lastErrorDetail = detail;
                this.isPlaying = false;
                this.stopProgressTracking();
                this.notify();
              }
            }
          });
        } catch (e: any) {
          console.warn('Error creating YT.Player:', e);
          this.ytInitPromise = null;
          this.isLoading = false;
          this.clearLoadingTimeout();
          this.errorState = 'Error al inicializar el marco del reproductor de YouTube.';
          this.lastErrorDetail = e?.message || String(e);
          reject(e);
        }
      });
    });

    return this.ytInitPromise;
  }

  public setConfig(newConfig: any) {
    const prevIntegratedEnabled = this.config.integratedEnabled;
    const urlChanged = this.config.integratedUrl !== newConfig.integratedUrl;
    const shuffleChanged = this.config.shuffle !== newConfig.shuffle;
    
    let targetMode = newConfig.mode;
    if (targetMode === 'ducking') targetMode = 'duck20';

    this.config = {
      enabled: newConfig.enabled,
      mode: targetMode || 'none',
      autoResume: newConfig.autoResume !== undefined ? newConfig.autoResume : true,
      infinitePlay: newConfig.infinitePlay !== undefined ? newConfig.infinitePlay : true,
      shuffle: newConfig.shuffle !== undefined ? newConfig.shuffle : false,
      resumePlaylistProgress: newConfig.resumePlaylistProgress !== undefined ? newConfig.resumePlaylistProgress : true,
      integratedEnabled: newConfig.integratedEnabled,
      integratedUrl: newConfig.integratedUrl,
      integratedVolume: newConfig.integratedVolume,
      apiKey: newConfig.apiKey || this.config.apiKey,
      favorites: newConfig.favorites || this.config.favorites || [],
      history: newConfig.history || this.config.history || [],
      customPlaylists: newConfig.customPlaylists || this.config.customPlaylists || []
    };

    if (this.audio) {
      this.audio.loop = this.config.infinitePlay;
    }

    if (this.config.integratedEnabled) {
      const isYT = this.isYouTubeUrl(this.config.integratedUrl);
      
      if (isYT) {
        if (this.audio) {
          this.audio.pause();
        }

        this.initYouTubePlayer().then(() => {
          if (this.ytPlayer && this.ytReady) {
            let { videoId, playlistId } = parseYouTubeUrl(this.config.integratedUrl);
            const wasPlaying = this.isPlaying;
            
            if (shuffleChanged) {
              try {
                this.ytPlayer.setShuffle(this.config.shuffle);
              } catch (e) {}
            }

            if (urlChanged || !this.ytLoadedUrl || this.ytLoadedUrl !== this.config.integratedUrl) {
              this.ytLoadedUrl = this.config.integratedUrl;
              
              const saved = this.config.resumePlaylistProgress !== false ? this.getSavedProgress() : null;
              const savedIndex = saved ? saved.index : 0;
              const savedTime = saved ? saved.time : 0;

              if (playlistId) {
                if (wasPlaying) {
                  this.startLoadingTimeout();
                  this.ytPlayer.loadPlaylist({
                    listType: 'playlist',
                    list: playlistId,
                    index: savedIndex,
                    startSeconds: savedTime
                  });
                } else {
                  this.ytPlayer.cuePlaylist({
                    listType: 'playlist',
                    list: playlistId,
                    index: savedIndex,
                    startSeconds: savedTime
                  });
                }
              } else if (videoId) {
                if (this.config.infinitePlay !== false) {
                  try {
                    if (wasPlaying) {
                      this.startLoadingTimeout();
                      this.ytPlayer.loadPlaylist({
                        listType: 'playlist',
                        list: 'RD' + videoId,
                        startSeconds: savedTime
                      });
                    } else {
                      this.ytPlayer.cuePlaylist({
                        listType: 'playlist',
                        list: 'RD' + videoId,
                        startSeconds: savedTime
                      });
                    }
                  } catch (e) {
                    if (wasPlaying) {
                      this.startLoadingTimeout();
                      this.ytPlayer.loadVideoById({ videoId, startSeconds: savedTime });
                    } else {
                      this.ytPlayer.cueVideoById({ videoId, startSeconds: savedTime });
                    }
                  }
                } else {
                  if (wasPlaying) {
                    this.startLoadingTimeout();
                    this.ytPlayer.loadVideoById({ videoId, startSeconds: savedTime });
                  } else {
                    this.ytPlayer.cueVideoById({ videoId, startSeconds: savedTime });
                  }
                }
              }
            }

            if (!this.isDucked) {
              try {
                this.ytPlayer.setVolume(this.config.integratedVolume);
              } catch (e) {}
              this.originalVolumeBeforeDucking = this.config.integratedVolume;
            }
          }
        }).catch(err => {
          console.warn('Failed to update YouTube settings:', err);
        });

      } else {
        if (this.ytPlayer && this.ytReady) {
          try {
            this.ytPlayer.pauseVideo();
          } catch (e) {}
        }

        this.initAudio();

        if (this.audio) {
          if (urlChanged) {
            const wasPlaying = this.isPlaying;
            this.audio.src = this.config.integratedUrl;
            this.audio.load();
            if (wasPlaying) {
              this.audio.play().catch(err => console.warn('Audio resume failed:', err));
            }
          }

          if (!this.isDucked) {
            this.audio.volume = this.config.integratedVolume / 100;
            this.originalVolumeBeforeDucking = this.config.integratedVolume;
          }
        }
      }
    } else {
      if (prevIntegratedEnabled) {
        this.pause();
      }
    }
    this.notify();
  }

  public subscribe(sub: Subscriber) {
    this.subscribers.add(sub);
    sub(this.getState());
    return () => {
      this.subscribers.delete(sub);
    };
  }

  private notify() {
    const state = this.getState();
    this.subscribers.forEach(sub => sub(state));
  }

  public getState(): MusicPlayerState {
    const isYT = this.isYouTubeUrl(this.config.integratedUrl);
    let vol = this.config.integratedVolume;
    let title = this.getTrackTitle();
    let channel = '';
    let duration = 0;
    let currentTime = 0;

    if (isYT) {
      if (this.ytPlayer && this.ytReady) {
        try {
          vol = this.ytPlayer.getVolume();
          duration = typeof this.ytPlayer.getDuration === 'function' ? this.ytPlayer.getDuration() : 0;
          currentTime = typeof this.ytPlayer.getCurrentTime === 'function' ? this.ytPlayer.getCurrentTime() : 0;
          
          if (typeof this.ytPlayer.getVideoData === 'function') {
            const data = this.ytPlayer.getVideoData();
            if (data) {
              if (data.title) title = data.title;
              if (data.author) channel = data.author;
            }
          }
        } catch (e) {
          vol = this.config.integratedVolume;
        }
      }
    } else {
      if (this.audio) {
        vol = Math.round(this.audio.volume * 100);
        duration = this.audio.duration || 0;
        currentTime = this.audio.currentTime || 0;
      }
    }

    let { videoId } = parseYouTubeUrl(this.config.integratedUrl);
    let thumbnail = videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : '';

    return {
      isPlaying: this.isPlaying,
      isLoading: this.isLoading,
      isDucked: this.isDucked,
      currentVolume: vol,
      error: this.errorState,
      lastErrorDetail: this.lastErrorDetail,
      activeUrl: this.config.integratedUrl,
      isYouTube: isYT,
      trackTitle: title,
      channelTitle: channel,
      thumbnailUrl: thumbnail,
      duration,
      currentTime,
      autoplayBlocked: this.autoplayBlocked
    };
  }

  public play() {
    if (!this.config.integratedEnabled || !this.config.integratedUrl) return;

    if (typeof window !== 'undefined') {
      localStorage.setItem('music_should_be_playing', 'true');
    }

    this.isTemporarilyPausedByAnnouncement = false;
    const isYT = this.isYouTubeUrl(this.config.integratedUrl);

    if (isYT) {
      if (this.audio) {
        this.audio.pause();
      }

      this.startLoadingTimeout();

      this.initYouTubePlayer().then(() => {
        if (this.ytPlayer && this.ytReady) {
          let { videoId, playlistId } = parseYouTubeUrl(this.config.integratedUrl);
          
          const saved = this.config.resumePlaylistProgress !== false ? this.getSavedProgress() : null;
          const savedIndex = saved ? saved.index : 0;
          const savedTime = saved ? saved.time : 0;

          if (!this.ytLoadedUrl || this.ytLoadedUrl !== this.config.integratedUrl) {
            this.ytLoadedUrl = this.config.integratedUrl;
            if (playlistId) {
              this.ytPlayer.loadPlaylist({
                listType: 'playlist',
                list: playlistId,
                index: savedIndex,
                startSeconds: savedTime
              });
            } else if (videoId) {
              if (this.config.infinitePlay !== false) {
                try {
                  this.ytPlayer.loadPlaylist({
                    listType: 'playlist',
                    list: 'RD' + videoId,
                    startSeconds: savedTime
                  });
                } catch (e) {
                  this.ytPlayer.loadVideoById({ videoId, startSeconds: savedTime });
                }
              } else {
                this.ytPlayer.loadVideoById({ videoId, startSeconds: savedTime });
              }
            }
          } else {
            const state = typeof this.ytPlayer.getPlayerState === 'function' ? this.ytPlayer.getPlayerState() : -1;
            if (state === 5 || state === -1) {
              if (playlistId) {
                this.ytPlayer.loadPlaylist({
                  listType: 'playlist',
                  list: playlistId,
                  index: savedIndex,
                  startSeconds: savedTime
                });
              } else if (videoId) {
                if (this.config.infinitePlay !== false) {
                  try {
                    this.ytPlayer.loadPlaylist({
                      listType: 'playlist',
                      list: 'RD' + videoId,
                      startSeconds: savedTime
                    });
                  } catch (e) {
                    this.ytPlayer.loadVideoById({ videoId, startSeconds: savedTime });
                  }
                } else {
                  this.ytPlayer.loadVideoById({ videoId, startSeconds: savedTime });
                }
              }
            } else {
              this.ytPlayer.playVideo();
            }
          }

          this.isPlaying = true;
          this.errorState = null;
          this.lastErrorDetail = null;
          this.startProgressTracking();
          this.notify();
        }
      }).catch(err => {
        console.warn('YouTube play failed:', err);
        this.isLoading = false;
        this.clearLoadingTimeout();
        this.errorState = 'No se pudo iniciar la reproducción en YouTube.';
        this.lastErrorDetail = err?.message || String(err);
        this.notify();
      });
    } else {
      if (this.ytPlayer && this.ytReady) {
        try {
          this.ytPlayer.pauseVideo();
        } catch (e) {}
      }

      this.initAudio();
      if (!this.audio) return;

      if (this.audio.src !== this.config.integratedUrl) {
        this.audio.src = this.config.integratedUrl;
        this.audio.load();

        const saved = this.config.resumePlaylistProgress !== false ? this.getSavedProgress() : null;
        if (saved && saved.time > 0) {
          this.audio.currentTime = saved.time;
        }
      }

      this.audio.play().then(() => {
        this.isPlaying = true;
        this.isLoading = false;
        this.errorState = null;
        this.lastErrorDetail = null;
        this.autoplayBlocked = false;
        this.startProgressTracking();
        this.notify();
      }).catch(err => {
        if (err.name === 'AbortError' || err.message?.includes('interrupted') || err.message?.includes('load request')) {
          console.log('Audio play interrupted by new load request.');
          return;
        }
        console.warn('Audio play failed:', err);
        this.isLoading = false;
        if (err.name === 'NotAllowedError') {
          this.autoplayBlocked = true;
          this.errorState = null;
        } else {
          this.errorState = 'Fallo de reproducción. Activa el sonido o haz clic en la página.';
          this.lastErrorDetail = err?.message || String(err);
        }
        this.notify();
      });
    }
  }

  public pause() {
    this.isTemporarilyPausedByAnnouncement = false;
    this.clearLoadingTimeout();
    this.isLoading = false;
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('music_should_be_playing', 'false');
    }

    const isYT = this.isYouTubeUrl(this.config.integratedUrl);

    if (isYT) {
      if (this.ytPlayer && this.ytReady) {
        try {
          this.ytPlayer.pauseVideo();
        } catch (e) {}
      }
    } else {
      if (this.audio) {
        this.audio.pause();
      }
    }
    
    this.isPlaying = false;
    this.stopProgressTracking();
    this.saveProgress();
    this.notify();
  }

  public next() {
    const isYT = this.isYouTubeUrl(this.config.integratedUrl);
    if (isYT && this.ytPlayer && this.ytReady) {
      try {
        if (typeof this.ytPlayer.nextVideo === 'function') {
          this.ytPlayer.nextVideo();
          setTimeout(() => this.notify(), 800);
          return;
        }
      } catch (e) {
        console.warn('Playlist next video skip failed:', e);
      }

      let { videoId } = parseYouTubeUrl(this.config.integratedUrl);
      if (videoId && typeof this.ytPlayer.loadPlaylist === 'function') {
        try {
          this.ytPlayer.loadPlaylist({
            listType: 'playlist',
            list: 'RD' + videoId,
            index: 1
          });
          setTimeout(() => this.notify(), 800);
        } catch (err) {
          console.warn('Failed loading RD mix on next():', err);
        }
      }
    }
  }

  public prev() {
    const isYT = this.isYouTubeUrl(this.config.integratedUrl);
    if (isYT && this.ytPlayer && this.ytReady && typeof this.ytPlayer.previousVideo === 'function') {
      try {
        this.ytPlayer.previousVideo();
        setTimeout(() => this.notify(), 800);
        return;
      } catch (e) {
        console.warn('Playlist prev video skip failed:', e);
      }
    }
  }

  public changeTrack(newUrl: string) {
    const wasPlaying = this.isPlaying;
    this.config.integratedUrl = newUrl;
    
    if (this.onConfigChange) {
      this.onConfigChange({ ...this.config });
    } else {
      this.setConfig(this.config);
      if (wasPlaying) {
        this.play();
      }
    }
  }

  public getTrackTitle(): string {
    const isYT = this.isYouTubeUrl(this.config.integratedUrl);
    if (isYT) {
      if (this.ytPlayer && typeof this.ytPlayer.getVideoData === 'function') {
        try {
          const data = this.ytPlayer.getVideoData();
          if (data && data.title) {
            return data.title;
          }
        } catch (e) {}
      }
      return "Contenido de YouTube";
    } else {
      const url = this.config.integratedUrl;
      try {
        const decoded = decodeURIComponent(url);
        const filename = decoded.substring(decoded.lastIndexOf('/') + 1);
        return filename || "Música de fondo";
      } catch (e) {
        return "Música de fondo";
      }
    }
  }

  public setVolume(volume: number) {
    this.config.integratedVolume = volume;
    const isYT = this.isYouTubeUrl(this.config.integratedUrl);

    if (!this.isDucked) {
      if (isYT) {
        if (this.ytPlayer && this.ytReady) {
          try {
            this.ytPlayer.setVolume(volume);
          } catch (e) {}
        }
      } else {
        if (this.audio) {
          this.audio.volume = volume / 100;
        }
      }
      this.originalVolumeBeforeDucking = volume;
    }
    this.notify();
  }

  public startAnnouncement() {
    if (!this.config.enabled || this.config.mode === 'none') return;

    if (this.restoreTimeout) {
      clearTimeout(this.restoreTimeout);
      this.restoreTimeout = null;
    }

    this.activeAnnouncements++;

    if (this.activeAnnouncements === 1) {
      this.applyMusicMitigation();
    }
  }

  public endAnnouncement() {
    if (!this.config.enabled || this.config.mode === 'none') return;

    if (this.activeAnnouncements > 0) {
      this.activeAnnouncements--;
    }

    if (this.activeAnnouncements === 0) {
      if (this.restoreTimeout) {
        clearTimeout(this.restoreTimeout);
      }

      this.restoreTimeout = setTimeout(() => {
        this.restoreMusicMitigation();
        this.restoreTimeout = null;
      }, 1000);
    }
  }

  private applyMusicMitigation() {
    if (!this.isPlaying) return;

    const isYT = this.isYouTubeUrl(this.config.integratedUrl);

    if (this.config.mode === 'pause') {
      this.isTemporarilyPausedByAnnouncement = true;
      if (isYT) {
        if (this.ytPlayer && this.ytReady) {
          try {
            this.ytPlayer.pauseVideo();
          } catch (e) {}
        }
      } else {
        if (this.audio) {
          this.audio.pause();
        }
      }
      this.isDucked = false;
      this.notify();
    } else {
      this.isDucked = true;
      this.originalVolumeBeforeDucking = this.config.integratedVolume;
      
      let multiplier = 0.20;
      if (this.config.mode === 'duck40') multiplier = 0.40;
      if (this.config.mode === 'duck60') multiplier = 0.60;

      const targetVolPercent = this.originalVolumeBeforeDucking * multiplier;
      this.fadeVolume(targetVolPercent, 400);
    }
  }

  private restoreMusicMitigation() {
    const isYT = this.isYouTubeUrl(this.config.integratedUrl);

    if (this.config.mode === 'pause') {
      if (this.isTemporarilyPausedByAnnouncement && this.config.integratedEnabled) {
        if (this.config.autoResume) {
          if (isYT) {
            if (this.ytPlayer && this.ytReady) {
              try {
                this.ytPlayer.playVideo();
              } catch (e) {}
            }
          } else {
            if (this.audio) {
              this.audio.play().catch(err => {
                console.warn('Failed to auto-resume audio after announcement:', err);
              });
            }
          }
          this.isPlaying = true;
        }
      }
      this.isTemporarilyPausedByAnnouncement = false;
      this.isDucked = false;
      this.notify();
    } else {
      this.isDucked = false;
      if (this.config.autoResume) {
        this.fadeVolume(this.originalVolumeBeforeDucking, 1000);
      }
    }
  }

  private fadeVolume(targetVolPercent: number, durationMs: number) {
    if (this.fadeInterval) {
      clearInterval(this.fadeInterval);
    }

    const isYT = this.isYouTubeUrl(this.config.integratedUrl);
    const steps = 20;
    const stepTime = durationMs / steps;

    let startVol = 0;
    if (isYT) {
      startVol = (this.ytPlayer && this.ytReady) ? this.ytPlayer.getVolume() : this.config.integratedVolume;
    } else {
      startVol = this.audio ? this.audio.volume * 100 : this.config.integratedVolume;
    }

    const volDiff = targetVolPercent - startVol;
    let currentStep = 0;

    this.fadeInterval = setInterval(() => {
      currentStep++;
      const nextVolPercent = startVol + (volDiff * (currentStep / steps));
      const clampedVolPercent = Math.max(0, Math.min(100, nextVolPercent));

      if (isYT) {
        if (this.ytPlayer && this.ytReady) {
          try {
            this.ytPlayer.setVolume(clampedVolPercent);
          } catch (e) {}
        }
      } else {
        if (this.audio) {
          this.audio.volume = clampedVolPercent / 100;
        }
      }

      if (currentStep >= steps) {
        if (this.fadeInterval) {
          clearInterval(this.fadeInterval);
          this.fadeInterval = null;
        }
        
        if (isYT) {
          if (this.ytPlayer && this.ytReady) {
            try {
              this.ytPlayer.setVolume(targetVolPercent);
            } catch (e) {}
          }
        } else {
          if (this.audio) {
            this.audio.volume = targetVolPercent / 100;
          }
        }
        this.notify();
      }
    }, stepTime);
  }
}

export const musicController = new MusicController();
