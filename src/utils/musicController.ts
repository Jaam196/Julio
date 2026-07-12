import { MusicConfig } from '../types';

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export interface MusicPlayerState {
  isPlaying: boolean;
  isDucked: boolean;
  currentVolume: number; // 0 to 100
  error: string | null;
  activeUrl: string;
  isYouTube: boolean;
  trackTitle: string;
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
    enabled: false,
    mode: 'none',
    autoResume: true,
    infinitePlay: true,
    shuffle: false,
    integratedEnabled: false,
    integratedUrl: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
    integratedVolume: 80,
  };

  private isPlaying = false;
  private isDucked = false;
  private originalVolumeBeforeDucking = 80; // 0 to 100
  private activeAnnouncements = 0;
  private restoreTimeout: NodeJS.Timeout | null = null;
  private subscribers: Set<Subscriber> = new Set();
  private fadeInterval: NodeJS.Timeout | null = null;
  private errorState: string | null = null;
  private isTemporarilyPausedByAnnouncement = false;
  private onConfigChange: ((config: MusicConfig) => void) | null = null;

  private audioPresets = [
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3'
  ];

  private youtubePresets = [
    'https://www.youtube.com/watch?v=jfKfPfyJRdk',
    'https://www.youtube.com/watch?v=Dx5_wdKkpBY',
    'https://www.youtube.com/watch?v=5grNis6L_oI',
    'https://www.youtube.com/watch?v=y7e-GC6oGIZ',
    'https://www.youtube.com/watch?v=vV77mrc3lP0',
    'https://www.youtube.com/watch?v=4xDzrJKXOOY'
  ];

  // YouTube properties
  private ytPlayer: any = null;
  private ytReady = false;
  private ytApiLoading = false;
  private ytInitPromise: Promise<void> | null = null;
  private ytLoadedUrl: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.ensureWrapperCreated();
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
      
      // Sync initial volume
      this.audio.volume = this.config.integratedVolume / 100;
      this.originalVolumeBeforeDucking = this.config.integratedVolume;

      // Listeners
      this.audio.onplay = () => {
        this.isPlaying = true;
        this.errorState = null;
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
        this.errorState = 'No se pudo cargar la música. Verifica la URL o formato de audio.';
        this.isPlaying = false;
        this.notify();
      };
    } catch (err) {
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

      // Poll as backup
      const interval = setInterval(() => {
        if (window.YT && window.YT.Player) {
          clearInterval(interval);
          this.ytApiLoading = false;
          resolve();
        }
      }, 100);
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
        if (videoId && !playlistId) {
          playlistId = 'RD' + videoId;
        }

        const playerVars: any = {
          autoplay: 0,
          controls: 1, // Enable native controls
          enablejsapi: 1, // Enable YouTube IFrame API control
          disablekb: 0,
          fs: 1, // Enable fullscreen button
          loop: this.config.infinitePlay ? 1 : 0,
          modestbranding: 1,
          rel: 0,
          showinfo: 1,
        };

        if (playlistId) {
          playerVars.listType = 'playlist';
          playerVars.list = playlistId;
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
                  if (playlistId && typeof this.ytPlayer.setShuffle === 'function') {
                    this.ytPlayer.setShuffle(this.config.shuffle);
                  }
                } catch (e) {
                  console.warn('Failed to set volume/shuffle onReady:', e);
                }
                resolve();
              },
              onStateChange: (event: any) => {
                // YT.PlayerState.PLAYING = 1, PAUSED = 2, ENDED = 0, CUED = 5
                if (event.data === 1) {
                  this.isPlaying = true;
                  this.errorState = null;
                } else if (event.data === 2) {
                  if (!this.isTemporarilyPausedByAnnouncement) {
                    this.isPlaying = false;
                  }
                } else if (event.data === 0) {
                  // Ended
                  if (this.config.infinitePlay) {
                    if (playlistId) {
                      try {
                        const index = this.ytPlayer.getPlaylistIndex();
                        const list = this.ytPlayer.getPlaylist();
                        if (list && index === list.length - 1) {
                          this.ytPlayer.playVideoAt(0); // Loop playlist
                        } else {
                          this.ytPlayer.nextVideo();
                        }
                      } catch (e) {
                        this.ytPlayer.playVideo();
                      }
                    } else {
                      this.ytPlayer.seekTo(0);
                      this.ytPlayer.playVideo();
                    }
                    this.isPlaying = true;
                  } else {
                    this.isPlaying = false;
                  }
                }
                this.notify();
              },
              onError: (err: any) => {
                console.warn('YouTube Player error:', err);
                let errMsg = 'Ocurrió un error con el reproductor de YouTube.';
                if (err.data === 101 || err.data === 150) {
                  errMsg = 'Este vídeo no permite reproducción incrustada fuera de YouTube (restringido por el propietario). Por favor, prueba con otro enlace de vídeo o de playlist.';
                } else if (err.data === 100) {
                  errMsg = 'El vídeo de YouTube no existe, es privado o ha sido eliminado. Por favor, verifica el enlace.';
                } else if (err.data === 2) {
                  errMsg = 'Enlace de YouTube inválido o mal estructurado. Por favor, asegúrate de copiar la URL completa.';
                }
                this.errorState = errMsg;
                this.isPlaying = false;
                this.notify();
              }
            }
          });
        } catch (e) {
          console.warn('Error creating YT.Player:', e);
          this.ytInitPromise = null; // Reset to allow retry
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
    
    // Map legacy 'ducking' to 'duck20'
    let targetMode = newConfig.mode;
    if (targetMode === 'ducking') targetMode = 'duck20';

    this.config = {
      enabled: newConfig.enabled,
      mode: targetMode || 'none',
      autoResume: newConfig.autoResume !== undefined ? newConfig.autoResume : true,
      infinitePlay: newConfig.infinitePlay !== undefined ? newConfig.infinitePlay : true,
      shuffle: newConfig.shuffle !== undefined ? newConfig.shuffle : false,
      integratedEnabled: newConfig.integratedEnabled,
      integratedUrl: newConfig.integratedUrl,
      integratedVolume: newConfig.integratedVolume,
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
            if (videoId && !playlistId) {
              playlistId = 'RD' + videoId;
            }
            const wasPlaying = this.isPlaying;
            
            if (shuffleChanged) {
              try {
                this.ytPlayer.setShuffle(this.config.shuffle);
              } catch (e) {}
            }

            // Cue or load if the URL changed OR if it hasn't been loaded in this player instance yet
            if (urlChanged || !this.ytLoadedUrl || this.ytLoadedUrl !== this.config.integratedUrl) {
              this.ytLoadedUrl = this.config.integratedUrl;
              if (playlistId) {
                if (wasPlaying) {
                  this.ytPlayer.loadPlaylist({ listType: 'playlist', list: playlistId });
                } else {
                  this.ytPlayer.cuePlaylist({ listType: 'playlist', list: playlistId });
                }
              } else if (videoId) {
                if (wasPlaying) {
                  this.ytPlayer.loadVideoById(videoId);
                } else {
                  this.ytPlayer.cueVideoById(videoId);
                }
              }
            }

            if (!this.isDucked) {
              try {
                this.ytPlayer.setVolume(this.config.integratedVolume);
              } catch (e) {
                console.warn('Failed to set YouTube volume:', e);
              }
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
              this.audio.play().catch(err => {
                console.warn('Audio resume failed:', err);
              });
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

    if (isYT) {
      if (this.ytPlayer && this.ytReady) {
        try {
          vol = this.ytPlayer.getVolume();
        } catch (e) {
          vol = this.config.integratedVolume;
        }
      }
    } else {
      if (this.audio) {
        vol = Math.round(this.audio.volume * 100);
      }
    }

    return {
      isPlaying: this.isPlaying,
      isDucked: this.isDucked,
      currentVolume: vol,
      error: this.errorState,
      activeUrl: this.config.integratedUrl,
      isYouTube: isYT,
      trackTitle: this.getTrackTitle(),
    };
  }

  public play() {
    if (!this.config.integratedEnabled) return;

    this.isTemporarilyPausedByAnnouncement = false;
    const isYT = this.isYouTubeUrl(this.config.integratedUrl);

    if (isYT) {
      if (this.audio) {
        this.audio.pause();
      }

      this.initYouTubePlayer().then(() => {
        if (this.ytPlayer && this.ytReady) {
          let { videoId, playlistId } = parseYouTubeUrl(this.config.integratedUrl);
          if (videoId && !playlistId) {
            playlistId = 'RD' + videoId;
          }
          
          if (!this.ytLoadedUrl || this.ytLoadedUrl !== this.config.integratedUrl) {
            this.ytLoadedUrl = this.config.integratedUrl;
            if (playlistId) {
              this.ytPlayer.loadPlaylist({ listType: 'playlist', list: playlistId });
            } else if (videoId) {
              this.ytPlayer.loadVideoById(videoId);
            }
          } else {
            const state = typeof this.ytPlayer.getPlayerState === 'function' ? this.ytPlayer.getPlayerState() : -1;
            if (state === 5 || state === -1) {
              if (playlistId) {
                this.ytPlayer.loadPlaylist({ listType: 'playlist', list: playlistId });
              } else if (videoId) {
                this.ytPlayer.loadVideoById(videoId);
              }
            } else {
              this.ytPlayer.playVideo();
            }
          }

          this.isPlaying = true;
          this.errorState = null;
          this.notify();
        }
      }).catch(err => {
        console.warn('YouTube play failed:', err);
        this.errorState = 'No se pudo iniciar el reproductor de YouTube.';
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
      }

      this.audio.play().then(() => {
        this.isPlaying = true;
        this.errorState = null;
        this.notify();
      }).catch(err => {
        console.warn('Audio play failed:', err);
        this.errorState = 'Fallo de reproducción. Activa el sonido o haz clic en la página.';
        this.notify();
      });
    }
  }

  public pause() {
    this.isTemporarilyPausedByAnnouncement = false;
    const isYT = this.isYouTubeUrl(this.config.integratedUrl);

    if (isYT) {
      if (this.ytPlayer && this.ytReady) {
        this.ytPlayer.pauseVideo();
      }
    } else {
      if (this.audio) {
        this.audio.pause();
      }
    }
    this.isPlaying = false;
    this.notify();
  }

  public next() {
    const isYT = this.isYouTubeUrl(this.config.integratedUrl);
    if (isYT) {
      let { videoId, playlistId } = parseYouTubeUrl(this.config.integratedUrl);
      if (videoId && !playlistId) {
        playlistId = 'RD' + videoId;
      }
      if (playlistId && this.ytPlayer && this.ytReady && typeof this.ytPlayer.nextVideo === 'function') {
        try {
          this.ytPlayer.nextVideo();
          setTimeout(() => this.notify(), 800);
          return;
        } catch (e) {
          console.warn('Playlist next video skip failed, falling back to preset cycling:', e);
        }
      }
      const currentIndex = this.youtubePresets.indexOf(this.config.integratedUrl);
      const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % this.youtubePresets.length;
      this.changeTrack(this.youtubePresets[nextIndex]);
    } else {
      const currentIndex = this.audioPresets.indexOf(this.config.integratedUrl);
      const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % this.audioPresets.length;
      this.changeTrack(this.audioPresets[nextIndex]);
    }
  }

  public prev() {
    const isYT = this.isYouTubeUrl(this.config.integratedUrl);
    if (isYT) {
      let { videoId, playlistId } = parseYouTubeUrl(this.config.integratedUrl);
      if (videoId && !playlistId) {
        playlistId = 'RD' + videoId;
      }
      if (playlistId && this.ytPlayer && this.ytReady && typeof this.ytPlayer.previousVideo === 'function') {
        try {
          this.ytPlayer.previousVideo();
          setTimeout(() => this.notify(), 800);
          return;
        } catch (e) {
          console.warn('Playlist prev video skip failed, falling back to preset cycling:', e);
        }
      }
      const currentIndex = this.youtubePresets.indexOf(this.config.integratedUrl);
      const prevIndex = currentIndex === -1 ? 0 : (currentIndex - 1 + this.youtubePresets.length) % this.youtubePresets.length;
      this.changeTrack(this.youtubePresets[prevIndex]);
    } else {
      const currentIndex = this.audioPresets.indexOf(this.config.integratedUrl);
      const prevIndex = currentIndex === -1 ? 0 : (currentIndex - 1 + this.audioPresets.length) % this.audioPresets.length;
      this.changeTrack(this.audioPresets[prevIndex]);
    }
  }

  private changeTrack(newUrl: string) {
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
      if (this.config.integratedUrl.includes('jfKfPfyJRdk')) return '☕ Lofi Girl (Chill Beats)';
      if (this.config.integratedUrl.includes('Dx5_wdKkpBY')) return '🎷 Cafe Smooth Jazz';
      if (this.config.integratedUrl.includes('5grNis6L_oI')) return '🏖️ Lounge Bossa Nova';
      if (this.config.integratedUrl.includes('y7e-GC6oGIZ')) return '🎹 Relaxing Classical Piano';
      if (this.config.integratedUrl.includes('vV77mrc3lP0')) return '🍔 Upbeat Restaurant Pop';
      if (this.config.integratedUrl.includes('4xDzrJKXOOY')) return '🌌 Atmospheric Synthwave';
      
      return "Video de YouTube";
    } else {
      const url = this.config.integratedUrl;
      if (url.includes('SoundHelix-Song-1.mp3')) return '☕ Café Lofi';
      if (url.includes('SoundHelix-Song-4.mp3')) return '🎷 Jazz Restaurante';
      if (url.includes('SoundHelix-Song-8.mp3')) return '🛋️ Chillout Lounge';
      if (url.includes('SoundHelix-Song-12.mp3')) return '🌧️ Lluvia Relajante';
      
      try {
        const decoded = decodeURIComponent(url);
        const filename = decoded.substring(decoded.lastIndexOf('/') + 1);
        return filename || "Música Ambiental";
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
          this.ytPlayer.setVolume(volume);
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
      }, 1000); // Wait 1 second before restoring music
    }
  }

  private applyMusicMitigation() {
    if (!this.isPlaying) return;

    const isYT = this.isYouTubeUrl(this.config.integratedUrl);

    if (this.config.mode === 'pause') {
      this.isTemporarilyPausedByAnnouncement = true;
      if (isYT) {
        if (this.ytPlayer && this.ytReady) {
          this.ytPlayer.pauseVideo();
        }
      } else {
        if (this.audio) {
          this.audio.pause();
        }
      }
      this.isDucked = false;
      this.notify();
    } else {
      // Ducking mode (duck20, duck40, duck60)
      this.isDucked = true;
      this.originalVolumeBeforeDucking = this.config.integratedVolume;
      
      let multiplier = 0.20; // Default duck20
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
        // Only resume automatically if autoResume is enabled!
        if (this.config.autoResume) {
          if (isYT) {
            if (this.ytPlayer && this.ytReady) {
              this.ytPlayer.playVideo();
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
      // Ducking modes (duck20, duck40, duck60)
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
          this.ytPlayer.setVolume(clampedVolPercent);
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
            this.ytPlayer.setVolume(targetVolPercent);
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
