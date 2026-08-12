import React, { useState, useEffect, useRef } from 'react';
import { musicController } from '../utils/musicController';
import { MusicConfig, YouTubeVideoItem, YouTubeHistoryItem, YouTubeCustomPlaylist } from '../types';
import { 
  Play, Pause, SkipForward, SkipBack, Music, Volume2, Volume1, VolumeX,
  Youtube, List, Disc, ChevronDown, ChevronUp, Link2, Search, Loader2, X,
  Star, Clock, Activity, Plus, Trash2, FolderPlus, RotateCcw, AlertTriangle, CheckCircle2, ShieldAlert
} from 'lucide-react';

interface BackgroundMusicPlayerProps {
  musicConfig: MusicConfig;
  onSaveMusicConfig: (config: MusicConfig) => void;
}

export default function BackgroundMusicPlayer({ musicConfig, onSaveMusicConfig }: BackgroundMusicPlayerProps) {
  const [playerState, setPlayerState] = useState(musicController.getState());
  const [showPlaylists, setShowPlaylists] = useState(true);
  const [customUrl, setCustomUrl] = useState(musicConfig.integratedUrl);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [showVideo, setShowVideo] = useState(true);

  // Tabs: 'search' | 'favorites' | 'playlists' | 'history' | 'diagnostic'
  const [activeTab, setActiveTab] = useState<'search' | 'favorites' | 'playlists' | 'history' | 'diagnostic'>('search');

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<YouTubeVideoItem[]>([]);
  const [continuationToken, setContinuationToken] = useState<string | null>(null);
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [lastSearchTime, setLastSearchTime] = useState<string | null>(null);

  // Custom Playlist Creation State
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [selectedPlaylistIdForAdd, setSelectedPlaylistIdForAdd] = useState<string | null>(null);
  const [videoToAdd, setVideoToAdd] = useState<YouTubeVideoItem | null>(null);

  const activeSearchAbortController = useRef<AbortController | null>(null);

  // Sync playerState with musicController
  useEffect(() => {
    const unsubscribe = musicController.subscribe((state) => {
      setPlayerState(state);
    });
    return () => unsubscribe();
  }, []);

  // Update musicController when musicConfig prop changes
  useEffect(() => {
    musicController.setConfig(musicConfig);
    setCustomUrl(musicConfig.integratedUrl);
  }, [musicConfig]);

  // Handle config changes originated inside controller
  useEffect(() => {
    musicController.setOnConfigChange((updatedConfig) => {
      onSaveMusicConfig(updatedConfig);
    });
    return () => musicController.setOnConfigChange(() => {});
  }, [onSaveMusicConfig]);

  // Attach YouTube Player Container to Viewport
  useEffect(() => {
    if (!playerState.isYouTube) return;

    const attachTimeout = setTimeout(() => {
      const ytContainer = document.getElementById('yt-music-player-container');
      const viewport = document.getElementById('yt-player-viewport');
      
      if (ytContainer && viewport) {
        viewport.appendChild(ytContainer);
        
        ytContainer.style.position = 'relative';
        ytContainer.style.width = '100%';
        ytContainer.style.height = '100%';
        ytContainer.style.opacity = '1';
        ytContainer.style.pointerEvents = 'auto';
        ytContainer.style.zIndex = '10';
        ytContainer.style.bottom = 'auto';
        ytContainer.style.right = 'auto';
      }
    }, 150);

    return () => {
      clearTimeout(attachTimeout);
      const ytContainer = document.getElementById('yt-music-player-container');
      if (ytContainer) {
        document.body.appendChild(ytContainer);
        ytContainer.style.position = 'fixed';
        ytContainer.style.bottom = '0';
        ytContainer.style.right = '0';
        ytContainer.style.width = '1px';
        ytContainer.style.height = '1px';
        ytContainer.style.opacity = '0';
        ytContainer.style.pointerEvents = 'none';
        ytContainer.style.zIndex = '-9999';
      }
    };
  }, [playerState.isYouTube]);

  // Perform search with race condition prevention
  const performSearch = async (query: string, isLoadMore = false) => {
    if (!query.trim()) return;

    if (activeSearchAbortController.current) {
      activeSearchAbortController.current.abort();
    }
    const abortController = new AbortController();
    activeSearchAbortController.current = abortController;

    if (isLoadMore) {
      if (isLoadingMore || !continuationToken) return;
      setIsLoadingMore(true);
    } else {
      if (isLoadingSearch) return;
      setIsLoadingSearch(true);
      setSearchError(null);
      localStorage.setItem('yt_last_search', query);
      setLastSearchTime(new Date().toLocaleTimeString());
    }

    try {
      let url = `/api/youtube/search?query=${encodeURIComponent(query)}`;
      if (isLoadMore && continuationToken) {
        url += `&continuation=${encodeURIComponent(continuationToken)}`;
      }

      const res = await fetch(url, { signal: abortController.signal });
      if (!res.ok) {
        throw new Error(`Error del servidor (${res.status})`);
      }
      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      if (isLoadMore) {
        setSearchResults(prev => [...prev, ...(data.items || [])]);
      } else {
        setSearchResults(data.items || []);
        setActiveTab('search');
      }
      setContinuationToken(data.continuationToken || null);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.warn('YouTube search API error:', err?.message || err);
      if (!isLoadMore) {
        setSearchError('No se pudo realizar la búsqueda de YouTube. Comprueba tu conexión a internet o intenta más tarde.');
        setSearchResults([]);
      }
    } finally {
      setIsLoadingSearch(false);
      setIsLoadingMore(false);
    }
  };

  // Debounce search input
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setContinuationToken(null);
      return;
    }

    const timer = setTimeout(() => {
      const saved = localStorage.getItem('yt_last_search') || '';
      if (searchQuery !== saved || searchResults.length === 0) {
        performSearch(searchQuery, false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load last search query on mount
  useEffect(() => {
    const saved = localStorage.getItem('yt_last_search');
    if (saved) {
      setSearchQuery(saved);
      performSearch(saved, false);
    }
  }, []);

  if (!musicConfig.enabled || !musicConfig.integratedEnabled) {
    return null;
  }

  // Add video to History
  const addToHistory = (item: YouTubeVideoItem) => {
    const currentHistory = musicConfig.history || [];
    const filtered = currentHistory.filter(h => h.id !== item.id);
    const newHistoryItem: YouTubeHistoryItem = {
      ...item,
      playedAt: Date.now()
    };
    const updatedHistory = [newHistoryItem, ...filtered].slice(0, 50); // Keep last 50
    const updatedConfig = { ...musicConfig, history: updatedHistory };
    onSaveMusicConfig(updatedConfig);
  };

  // Toggle Favorite
  const toggleFavorite = (item: YouTubeVideoItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentFavorites = musicConfig.favorites || [];
    const exists = currentFavorites.some(f => f.id === item.id);
    let updatedFavorites: YouTubeVideoItem[];
    
    if (exists) {
      updatedFavorites = currentFavorites.filter(f => f.id !== item.id);
    } else {
      updatedFavorites = [{ ...item, dateAdded: Date.now() }, ...currentFavorites];
    }

    const updatedConfig = { ...musicConfig, favorites: updatedFavorites };
    onSaveMusicConfig(updatedConfig);
  };

  const isFavorite = (id: string) => {
    return (musicConfig.favorites || []).some(f => f.id === id);
  };

  // Play video/url
  const playVideo = (item: YouTubeVideoItem) => {
    addToHistory(item);
    const updatedConfig = { ...musicConfig, integratedUrl: item.url };
    onSaveMusicConfig(updatedConfig);
    musicController.setConfig(updatedConfig);
    setTimeout(() => {
      musicController.play();
    }, 100);
  };

  const handlePlayPause = () => {
    if (playerState.isPlaying) {
      musicController.pause();
    } else {
      musicController.play();
    }
  };

  const handleNext = () => {
    musicController.next();
  };

  const handlePrev = () => {
    musicController.prev();
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseInt(e.target.value, 10);
    const updated = { ...musicConfig, integratedVolume: vol };
    onSaveMusicConfig(updated);
    musicController.setVolume(vol);
  };

  const submitCustomUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customUrl.trim()) return;
    
    const url = customUrl.trim();
    const item: YouTubeVideoItem = {
      id: url,
      title: 'Enlace Personalizado',
      thumbnail: '',
      channel: 'YouTube',
      url: url
    };
    playVideo(item);
  };

  // Create custom playlist
  const createPlaylist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;
    
    const newPlaylist: YouTubeCustomPlaylist = {
      id: 'pl_' + Date.now(),
      name: newPlaylistName.trim(),
      createdAt: Date.now(),
      videos: []
    };

    const currentPlaylists = musicConfig.customPlaylists || [];
    const updatedConfig = {
      ...musicConfig,
      customPlaylists: [...currentPlaylists, newPlaylist]
    };
    onSaveMusicConfig(updatedConfig);
    setNewPlaylistName('');
    setShowCreatePlaylist(false);
  };

  // Add video to custom playlist
  const addVideoToPlaylist = (playlistId: string) => {
    if (!videoToAdd) return;
    const currentPlaylists = musicConfig.customPlaylists || [];
    const updatedPlaylists = currentPlaylists.map(pl => {
      if (pl.id === playlistId) {
        if (pl.videos.some(v => v.id === videoToAdd.id)) return pl;
        return { ...pl, videos: [...pl.videos, videoToAdd] };
      }
      return pl;
    });

    const updatedConfig = { ...musicConfig, customPlaylists: updatedPlaylists };
    onSaveMusicConfig(updatedConfig);
    setVideoToAdd(null);
    setSelectedPlaylistIdForAdd(null);
  };

  // Remove video from custom playlist
  const removeVideoFromPlaylist = (playlistId: string, videoId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentPlaylists = musicConfig.customPlaylists || [];
    const updatedPlaylists = currentPlaylists.map(pl => {
      if (pl.id === playlistId) {
        return { ...pl, videos: pl.videos.filter(v => v.id !== videoId) };
      }
      return pl;
    });

    const updatedConfig = { ...musicConfig, customPlaylists: updatedPlaylists };
    onSaveMusicConfig(updatedConfig);
  };

  // Delete custom playlist
  const deletePlaylist = (playlistId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentPlaylists = musicConfig.customPlaylists || [];
    const updatedPlaylists = currentPlaylists.filter(pl => pl.id !== playlistId);
    const updatedConfig = { ...musicConfig, customPlaylists: updatedPlaylists };
    onSaveMusicConfig(updatedConfig);
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const VolumeIcon = () => {
    const vol = musicConfig.integratedVolume;
    if (vol === 0) return <VolumeX size={16} className="text-slate-500" />;
    if (vol < 40) return <Volume1 size={16} className="text-slate-400" />;
    return <Volume2 size={16} className="text-indigo-400" />;
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden group">
      {/* Dynamic background lighting */}
      <div className={`absolute -right-16 -top-16 w-36 h-36 rounded-full blur-3xl transition-all duration-1000 ${
        playerState.isPlaying 
          ? 'bg-indigo-500/10 group-hover:bg-indigo-500/15' 
          : 'bg-slate-500/5 group-hover:bg-slate-500/10'
      }`}></div>

      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800/60">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-red-500/10 text-red-400 rounded-lg shrink-0">
            <Youtube size={18} />
          </div>
          <div>
            <span className="text-[11px] font-mono text-red-400 uppercase tracking-widest font-bold">YouTube Integrado</span>
            <h3 className="font-semibold text-slate-200 text-sm">Reproductor de Música</h3>
          </div>
        </div>

        {/* Live Status Indicators */}
        <div className="flex items-center gap-1.5">
          {playerState.isLoading ? (
            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold font-mono bg-amber-950 text-amber-400 border border-amber-900/80 flex items-center gap-1">
              <Loader2 size={10} className="animate-spin text-amber-400" />
              Cargando...
            </span>
          ) : playerState.isPlaying ? (
            playerState.isDucked ? (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold font-mono bg-indigo-950 text-indigo-300 border border-indigo-900/80 animate-pulse flex items-center gap-1">
                <span className="w-1 h-1 bg-indigo-400 rounded-full"></span>
                Atenuado
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold font-mono bg-emerald-950 text-emerald-400 border border-emerald-900/80 flex items-center gap-1">
                <span className="w-1 h-1 bg-emerald-400 rounded-full animate-ping"></span>
                Sonando
              </span>
            )
          ) : (
            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold font-mono bg-slate-800 text-slate-500 border border-slate-700/50">
              Pausado
            </span>
          )}
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="mb-4">
        <form onSubmit={(e) => { e.preventDefault(); performSearch(searchQuery, false); }} className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="🔍 Buscar canciones, artistas o vídeos en YouTube..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-10 py-2.5 text-xs text-slate-100 outline-none focus:border-red-600 transition-colors placeholder:text-slate-500"
            />
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
              {isLoadingSearch ? (
                <Loader2 size={14} className="animate-spin text-red-500" />
              ) : (
                <Search size={14} />
              )}
            </div>
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                  setContinuationToken(null);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button
            type="submit"
            className="px-4 py-2.5 bg-red-600 hover:bg-red-500 border border-red-500/50 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-red-600/10 active:scale-95 shrink-0"
          >
            Buscar
          </button>
        </form>
      </div>

      {/* Album Art & Title Panel */}
      <div className="bg-slate-950 rounded-xl p-3 border border-slate-800/40 flex items-center gap-3.5 mb-4">
        {/* Vinyl Disc Icon or Thumbnail */}
        <div className="relative shrink-0">
          {playerState.thumbnailUrl ? (
            <div className="w-11 h-11 rounded-lg overflow-hidden border border-slate-800 bg-slate-900 shrink-0 relative">
              <img src={playerState.thumbnailUrl} alt="Thumbnail" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
              {playerState.isPlaying && (
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-ping"></div>
                </div>
              )}
            </div>
          ) : (
            <div className={`w-11 h-11 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 shadow-inner ${
              playerState.isPlaying && !playerState.isDucked ? 'animate-spin' : ''
            }`} style={{ animationDuration: '6s' }}>
              <Disc size={20} className={playerState.isPlaying ? 'text-red-400' : 'text-slate-500'} />
              <div className="absolute w-2.5 h-2.5 bg-slate-950 rounded-full border border-slate-800"></div>
            </div>
          )}
        </div>

        {/* Title & Metadata */}
        <div className="overflow-hidden flex-1 min-w-0">
          <span className="text-[9px] font-mono font-bold text-slate-500 uppercase flex items-center gap-1">
            <Youtube size={10} className="text-red-500" />
            {playerState.channelTitle || 'YouTube Oficial'}
          </span>
          <div className="text-xs font-semibold text-slate-100 truncate mt-0.5 tracking-tight">
            {playerState.trackTitle || 'Sin canción seleccionada'}
          </div>
          {playerState.duration > 0 && (
            <div className="text-[10px] font-mono text-slate-400 mt-0.5">
              {formatTime(playerState.currentTime)} / {formatTime(playerState.duration)}
            </div>
          )}
        </div>
      </div>

      {/* Official YouTube Video Viewport Area */}
      {playerState.isYouTube && (
        <div className="space-y-2 mb-4">
          <div className="flex justify-between items-center px-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono flex items-center gap-1">
              <Youtube size={11} className="text-red-500 animate-pulse" />
              Pantalla de Vídeo Integrada
            </span>
            <button
              type="button"
              onClick={() => setShowVideo(!showVideo)}
              className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold underline underline-offset-2 cursor-pointer transition-colors"
            >
              {showVideo ? 'Minimizar Vídeo' : 'Mostrar Vídeo'}
            </button>
          </div>
          
          <div 
            id="yt-player-viewport" 
            className={`w-full bg-black border border-slate-800 rounded-xl overflow-hidden shadow-2xl relative transition-all duration-300 ${
              showVideo ? 'aspect-video h-[180px] sm:h-[280px] opacity-100 scale-100' : 'h-0 opacity-0 scale-95 pointer-events-none border-none'
            }`}
          >
            {showVideo && playerState.isLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 text-slate-300 gap-2 z-20">
                <Loader2 size={24} className="animate-spin text-red-500" />
                <span className="text-xs font-mono">Cargando vídeo de YouTube...</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Control Buttons and Volume Row */}
      <div className="flex flex-col sm:flex-row items-center gap-4 justify-between bg-slate-950/30 p-3 rounded-xl border border-slate-850 mb-4">
        {/* Buttons */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handlePrev}
            title="Pista Anterior"
            className="w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 border border-slate-700/50 flex items-center justify-center text-slate-300 hover:text-white transition-all cursor-pointer active:scale-95"
          >
            <SkipBack size={14} fill="currentColor" />
          </button>

          <button
            type="button"
            onClick={handlePlayPause}
            title={playerState.isPlaying ? 'Pausar' : 'Reproducir'}
            className={`w-10 h-10 rounded-full flex items-center justify-center text-white transition-all cursor-pointer active:scale-95 shadow-lg ${
              playerState.isPlaying 
                ? 'bg-red-600 hover:bg-red-500 shadow-red-600/15 border border-red-500/50' 
                : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/15 border border-emerald-500/50'
            }`}
          >
            {playerState.isPlaying ? (
              <Pause size={16} fill="currentColor" />
            ) : (
              <Play size={16} fill="currentColor" className="ml-0.5" />
            )}
          </button>

          <button
            type="button"
            onClick={handleNext}
            title="Siguiente Pista"
            className="w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 border border-slate-700/50 flex items-center justify-center text-slate-300 hover:text-white transition-all cursor-pointer active:scale-95"
          >
            <SkipForward size={14} fill="currentColor" />
          </button>
        </div>

        {/* Volume */}
        <div className="flex items-center gap-2 w-full sm:w-auto sm:flex-1 sm:max-w-[150px]">
          <VolumeIcon />
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={musicConfig.integratedVolume}
            onChange={handleVolumeChange}
            title="Volumen"
            className="w-full accent-red-500 bg-slate-950 h-1.5 rounded-lg cursor-pointer"
          />
        </div>
      </div>

      {/* Autoplay block alert */}
      {playerState.autoplayBlocked && (
        <div className="mb-4 p-3 bg-amber-950/30 border border-amber-800/60 text-amber-300 rounded-xl text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldAlert size={16} className="text-amber-400 shrink-0" />
            <span>El navegador ha bloqueado la reproducción automática. Pulsa para iniciar el audio.</span>
          </div>
          <button
            onClick={() => musicController.play()}
            className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded-lg text-xs cursor-pointer shrink-0"
          >
            Iniciar Audio
          </button>
        </div>
      )}

      {/* Error notification & Timeout recovery */}
      {playerState.error && (
        <div className="mb-4 p-3 bg-red-950/30 border border-red-800/60 text-red-300 rounded-xl text-xs space-y-2 animate-fadeIn">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold leading-relaxed">{playerState.error}</span>
                {playerState.lastErrorDetail && (
                  <p className="text-[10px] text-red-400/80 mt-0.5 font-mono">{playerState.lastErrorDetail}</p>
                )}
              </div>
            </div>
            <button
              onClick={() => musicController.recoverPlayer()}
              className="px-2.5 py-1 bg-red-900/60 hover:bg-red-800 border border-red-700/60 rounded-lg text-[10px] font-bold text-white transition-all cursor-pointer flex items-center gap-1 shrink-0"
            >
              <RotateCcw size={10} />
              Reintentar
            </button>
          </div>
        </div>
      )}

      {/* Navigation Tabs Bar */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setShowPlaylists(!showPlaylists)}
          className="flex items-center justify-between w-full text-[11px] font-bold text-slate-400 hover:text-slate-200 uppercase tracking-wider transition-colors py-1 cursor-pointer"
        >
          <span className="flex items-center gap-1.5">
            <List size={12} />
            Módulo y Contenido de YouTube
          </span>
          {showPlaylists ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>

        {showPlaylists && (
          <div className="space-y-3 pt-1 animate-fadeIn">
            {/* Tabs Selector */}
            <div className="flex border-b border-slate-800/60 pb-1.5 overflow-x-auto gap-1 scrollbar-none">
              <button
                type="button"
                onClick={() => setActiveTab('search')}
                className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  activeTab === 'search'
                    ? 'bg-red-950/60 text-red-300 border border-red-800/60'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Search size={12} className={activeTab === 'search' ? 'text-red-400' : ''} />
                Búsqueda {searchResults.length > 0 ? `(${searchResults.length})` : ''}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('favorites')}
                className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  activeTab === 'favorites'
                    ? 'bg-amber-950/60 text-amber-300 border border-amber-800/60'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Star size={12} className={activeTab === 'favorites' ? 'text-amber-400 fill-amber-400' : ''} />
                Favoritos ({musicConfig.favorites?.length || 0})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('playlists')}
                className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  activeTab === 'playlists'
                    ? 'bg-indigo-950/60 text-indigo-300 border border-indigo-800/60'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <List size={12} className={activeTab === 'playlists' ? 'text-indigo-400' : ''} />
                Mis Listas ({musicConfig.customPlaylists?.length || 0})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  activeTab === 'history'
                    ? 'bg-slate-800 text-slate-200 border border-slate-700/60'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Clock size={12} />
                Historial ({musicConfig.history?.length || 0})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('diagnostic')}
                className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  activeTab === 'diagnostic'
                    ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Activity size={12} className={activeTab === 'diagnostic' ? 'text-emerald-400' : ''} />
                Diagnóstico
              </button>
            </div>

            {/* Tab 1: SEARCH */}
            {activeTab === 'search' && (
              <div className="space-y-3">
                {searchError ? (
                  <div className="text-center py-8 text-slate-400 text-xs flex flex-col items-center gap-2.5">
                    <AlertTriangle size={24} className="text-red-400" />
                    <p className="font-semibold leading-relaxed px-4 text-slate-300 max-w-sm">{searchError}</p>
                    <button
                      type="button"
                      onClick={() => performSearch(searchQuery, false)}
                      className="px-3.5 py-1.5 bg-red-950/60 hover:bg-red-950/80 border border-red-800/80 rounded-xl text-xs font-bold text-red-300 transition-colors cursor-pointer"
                    >
                      Reintentar búsqueda
                    </button>
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-xs">
                    {isLoadingSearch ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 size={24} className="animate-spin text-red-500" />
                        <span>Buscando contenido en YouTube...</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1.5">
                        <Youtube size={28} className="text-slate-600 mb-1" />
                        <span className="font-semibold text-slate-300">No hay contenido en la lista de búsqueda</span>
                        <p className="text-[11px] text-slate-500 max-w-xs">
                          Escribe un término en el buscador superior para buscar canciones, listas o artistas reales en YouTube.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div 
                    className="max-h-[300px] overflow-y-auto space-y-2 pr-1 scrollbar-thin"
                    onScroll={(e) => {
                      const target = e.currentTarget;
                      if (target.scrollHeight - target.scrollTop <= target.clientHeight + 40) {
                        if (continuationToken && !isLoadingMore) {
                          performSearch(searchQuery, true);
                        }
                      }
                    }}
                  >
                    {searchResults.map((item) => {
                      const isCurrentlyPlaying = musicConfig.integratedUrl === item.url;
                      const fav = isFavorite(item.id);

                      return (
                        <div
                          key={item.id}
                          onClick={() => playVideo(item)}
                          className={`w-full text-left p-2 rounded-xl transition-all border flex gap-3 text-xs items-start cursor-pointer group/item ${
                            isCurrentlyPlaying
                              ? 'bg-red-950/40 border-red-800 text-red-200 shadow-md'
                              : 'bg-slate-950/50 border-slate-900 text-slate-300 hover:bg-slate-900 hover:border-slate-800'
                          }`}
                        >
                          {/* Thumbnail */}
                          <div className="relative shrink-0 w-24 aspect-video rounded overflow-hidden bg-slate-900 border border-slate-850">
                            {item.thumbnail ? (
                              <img 
                                src={item.thumbnail} 
                                alt={item.title} 
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover" 
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-slate-900 text-slate-600">
                                <Youtube size={20} />
                              </div>
                            )}
                            {item.duration && (
                              <span className="absolute bottom-1 right-1 px-1 py-0.5 text-[8px] font-bold font-mono bg-black/80 text-slate-200 rounded">
                                {item.duration}
                              </span>
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-slate-100 leading-snug line-clamp-2" title={item.title}>
                              {item.title}
                            </h4>
                            <p className="text-[10px] text-slate-400 mt-1 truncate">
                              {item.channel}
                            </p>
                            {isCurrentlyPlaying && (
                              <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-[8px] font-bold font-mono bg-red-950 text-red-400 border border-red-900/60 animate-pulse">
                                <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                                Sonando
                              </span>
                            )}
                          </div>

                          {/* Quick Actions */}
                          <div className="flex flex-col gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => toggleFavorite(item, e)}
                              title={fav ? "Quitar de favoritos" : "Agregar a favoritos"}
                              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                                fav 
                                  ? 'bg-amber-950/60 border-amber-800 text-amber-400' 
                                  : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-amber-400 hover:border-slate-700'
                              }`}
                            >
                              <Star size={12} className={fav ? 'fill-amber-400' : ''} />
                            </button>

                            {(musicConfig.customPlaylists || []).length > 0 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setVideoToAdd(item);
                                }}
                                title="Agregar a lista..."
                                className="p-1.5 rounded-lg border bg-slate-900 border-slate-800 text-slate-500 hover:text-indigo-400 hover:border-slate-700 transition-all cursor-pointer"
                              >
                                <Plus size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {isLoadingMore && (
                      <div className="flex items-center justify-center gap-2 py-3 text-xs text-slate-400">
                        <Loader2 size={14} className="animate-spin text-red-500" />
                        <span>Cargando más resultados...</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: FAVORITES */}
            {activeTab === 'favorites' && (
              <div className="space-y-2">
                {(!musicConfig.favorites || musicConfig.favorites.length === 0) ? (
                  <div className="text-center py-8 text-slate-500 text-xs flex flex-col items-center gap-2">
                    <Star size={24} className="text-slate-600 mb-1" />
                    <span className="font-semibold text-slate-300">No hay favoritos guardados</span>
                    <p className="text-[11px] text-slate-500 max-w-xs">
                      Haz clic en la estrella de cualquier vídeo en los resultados de búsqueda para guardarlo aquí.
                    </p>
                  </div>
                ) : (
                  <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                    {musicConfig.favorites.map((item) => {
                      const isCurrentlyPlaying = musicConfig.integratedUrl === item.url;
                      return (
                        <div
                          key={item.id}
                          onClick={() => playVideo(item)}
                          className={`w-full text-left p-2 rounded-xl transition-all border flex gap-3 text-xs items-start cursor-pointer ${
                            isCurrentlyPlaying
                              ? 'bg-amber-950/40 border-amber-800 text-amber-200'
                              : 'bg-slate-950/50 border-slate-900 text-slate-300 hover:bg-slate-900'
                          }`}
                        >
                          <div className="relative shrink-0 w-24 aspect-video rounded overflow-hidden bg-slate-900 border border-slate-850">
                            {item.thumbnail ? (
                              <img src={item.thumbnail} alt={item.title} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-slate-900 text-slate-600">
                                <Youtube size={20} />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-slate-100 leading-snug line-clamp-2">{item.title}</h4>
                            <p className="text-[10px] text-slate-400 mt-1 truncate">{item.channel}</p>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => toggleFavorite(item, e)}
                            title="Quitar de favoritos"
                            className="p-1.5 rounded-lg border bg-amber-950/60 border-amber-800 text-amber-400 hover:bg-red-950 hover:border-red-800 hover:text-red-400 transition-all cursor-pointer shrink-0"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: CUSTOM PLAYLISTS */}
            {activeTab === 'playlists' && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-mono text-slate-400 font-bold uppercase">Listas Creadas</span>
                  <button
                    type="button"
                    onClick={() => setShowCreatePlaylist(!showCreatePlaylist)}
                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <FolderPlus size={12} />
                    Nueva Lista
                  </button>
                </div>

                {showCreatePlaylist && (
                  <form onSubmit={createPlaylist} className="flex gap-2 p-2 bg-slate-950 border border-slate-800 rounded-xl animate-fadeIn">
                    <input
                      type="text"
                      placeholder="Nombre de la lista (ej: Música para Cenas)"
                      value={newPlaylistName}
                      onChange={(e) => setNewPlaylistName(e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-100 outline-none focus:border-indigo-500"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold cursor-pointer"
                    >
                      Crear
                    </button>
                  </form>
                )}

                {(!musicConfig.customPlaylists || musicConfig.customPlaylists.length === 0) ? (
                  <div className="text-center py-8 text-slate-500 text-xs flex flex-col items-center gap-2">
                    <List size={24} className="text-slate-600 mb-1" />
                    <span className="font-semibold text-slate-300">No hay listas personalizadas</span>
                    <p className="text-[11px] text-slate-500 max-w-xs">
                      Crea tu propia lista para organizar vídeos de YouTube y reproducirlos cuando desees.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin">
                    {musicConfig.customPlaylists.map((pl) => (
                      <div key={pl.id} className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <List size={14} className="text-indigo-400" />
                            <h4 className="font-bold text-xs text-slate-200">{pl.name}</h4>
                            <span className="text-[10px] font-mono text-slate-500">({pl.videos.length} vídeos)</span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => deletePlaylist(pl.id, e)}
                            title="Eliminar lista"
                            className="p-1 text-slate-500 hover:text-red-400 cursor-pointer transition-colors"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>

                        {pl.videos.length > 0 ? (
                          <div className="space-y-1 pt-1 border-t border-slate-900">
                            {pl.videos.map((vid) => (
                              <div
                                key={vid.id}
                                onClick={() => playVideo(vid)}
                                className="p-1.5 rounded-lg bg-slate-900/50 hover:bg-slate-900 flex items-center justify-between text-[11px] text-slate-300 cursor-pointer border border-slate-850"
                              >
                                <span className="truncate pr-2">{vid.title}</span>
                                <button
                                  type="button"
                                  onClick={(e) => removeVideoFromPlaylist(pl.id, vid.id, e)}
                                  className="text-slate-500 hover:text-red-400 cursor-pointer p-0.5"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-500 italic">Lista vacía. Agrega vídeos desde la pestaña de Búsqueda.</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 4: HISTORY */}
            {activeTab === 'history' && (
              <div className="space-y-2">
                {(!musicConfig.history || musicConfig.history.length === 0) ? (
                  <div className="text-center py-8 text-slate-500 text-xs flex flex-col items-center gap-2">
                    <Clock size={24} className="text-slate-600 mb-1" />
                    <span className="font-semibold text-slate-300">El historial está vacío</span>
                    <p className="text-[11px] text-slate-500 max-w-xs">
                      Los vídeos reales que reproduzcas aparecerán automáticamente en tu historial.
                    </p>
                  </div>
                ) : (
                  <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                    {musicConfig.history.map((item, idx) => {
                      const isCurrentlyPlaying = musicConfig.integratedUrl === item.url;
                      return (
                        <div
                          key={`${item.id}_${idx}`}
                          onClick={() => playVideo(item)}
                          className={`w-full text-left p-2 rounded-xl transition-all border flex gap-3 text-xs items-center cursor-pointer ${
                            isCurrentlyPlaying
                              ? 'bg-slate-800 border-slate-700 text-slate-100'
                              : 'bg-slate-950/50 border-slate-900 text-slate-300 hover:bg-slate-900'
                          }`}
                        >
                          <div className="relative shrink-0 w-16 aspect-video rounded overflow-hidden bg-slate-900 border border-slate-850">
                            {item.thumbnail ? (
                              <img src={item.thumbnail} alt={item.title} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-slate-900 text-slate-600">
                                <Youtube size={16} />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-slate-100 truncate">{item.title}</h4>
                            <p className="text-[10px] text-slate-500 mt-0.5 truncate">{item.channel}</p>
                          </div>
                          <span className="text-[9px] font-mono text-slate-500 shrink-0">
                            {new Date(item.playedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Tab 5: DIAGNOSTIC */}
            {activeTab === 'diagnostic' && (
              <div className="space-y-3 bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-300">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="font-bold font-mono text-emerald-400 text-[11px] uppercase flex items-center gap-1.5">
                    <Activity size={14} />
                    Panel de Diagnóstico del Módulo YouTube
                  </span>
                  <button
                    type="button"
                    onClick={() => musicController.recoverPlayer()}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-[10px] font-bold text-slate-200 flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <RotateCcw size={10} />
                    Reinstanciar
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 font-mono text-[11px]">
                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/80">
                    <span className="text-slate-500 text-[10px] block uppercase">Conexión a Internet</span>
                    <span className="font-bold text-slate-100 flex items-center gap-1.5 mt-1">
                      {navigator.onLine ? (
                        <>
                          <CheckCircle2 size={12} className="text-emerald-400" />
                          <span className="text-emerald-400">Online (Conectado)</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle size={12} className="text-red-400" />
                          <span className="text-red-400">Offline (Sin Red)</span>
                        </>
                      )}
                    </span>
                  </div>

                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/80">
                    <span className="text-slate-500 text-[10px] block uppercase">Estado de API YouTube</span>
                    <span className="font-bold text-slate-100 flex items-center gap-1.5 mt-1">
                      <CheckCircle2 size={12} className="text-emerald-400" />
                      <span className="text-emerald-400">API Activa (IFrame Ready)</span>
                    </span>
                  </div>

                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/80">
                    <span className="text-slate-500 text-[10px] block uppercase">Estado del Reproductor</span>
                    <span className="font-bold text-slate-100 flex items-center gap-1.5 mt-1">
                      {playerState.isLoading ? (
                        <span className="text-amber-400 flex items-center gap-1">
                          <Loader2 size={12} className="animate-spin" /> Cargando Vídeo...
                        </span>
                      ) : playerState.error ? (
                        <span className="text-red-400 flex items-center gap-1">
                          <AlertTriangle size={12} /> Con Errores
                        </span>
                      ) : playerState.isPlaying ? (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 size={12} /> Sonando
                        </span>
                      ) : (
                        <span className="text-slate-400">Pausado / Listo</span>
                      )}
                    </span>
                  </div>

                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/80">
                    <span className="text-slate-500 text-[10px] block uppercase">Última Búsqueda</span>
                    <span className="font-bold text-slate-200 truncate block mt-1">
                      {localStorage.getItem('yt_last_search') || 'Ninguna'}
                      {lastSearchTime && <span className="text-slate-500 font-normal ml-1">({lastSearchTime})</span>}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/80 font-mono text-[11px]">
                  <span className="text-slate-500 text-[10px] block uppercase">Último Vídeo Cargado</span>
                  <div className="text-slate-200 mt-0.5 truncate">
                    <span className="font-bold text-slate-100">{playerState.trackTitle || 'Ninguno'}</span>
                    <span className="text-slate-500 block text-[10px] truncate mt-0.5">{playerState.activeUrl || 'Sin URL'}</span>
                  </div>
                </div>

                <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/80 font-mono text-[11px]">
                  <span className="text-slate-500 text-[10px] block uppercase">Último Error Registrado</span>
                  <div className="mt-0.5">
                    {playerState.error ? (
                      <div>
                        <span className="text-red-400 font-bold block">{playerState.error}</span>
                        {playerState.lastErrorDetail && (
                          <span className="text-red-400/70 text-[10px] block mt-0.5">{playerState.lastErrorDetail}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-emerald-400 font-bold">Sin errores registrados (Sistema Operativo 100%)</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Custom URL Option */}
            <div className="pt-2 border-t border-slate-800/60">
              <button
                type="button"
                onClick={() => setShowCustomInput(!showCustomInput)}
                className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold cursor-pointer underline underline-offset-2"
              >
                <Link2 size={10} />
                {showCustomInput ? 'Ocultar entrada de link' : 'Insertar enlace directo de YouTube o archivo de audio...'}
              </button>

              {showCustomInput && (
                <form onSubmit={submitCustomUrl} className="mt-2 flex gap-1.5 animate-fadeIn">
                  <input
                    type="text"
                    placeholder="Pega link de YouTube (watch, shorts, live, playlist)..."
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-100 outline-none focus:border-indigo-500 font-mono"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 border border-indigo-500/50 text-white rounded-lg text-[10px] font-bold cursor-pointer"
                  >
                    Cargar
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
