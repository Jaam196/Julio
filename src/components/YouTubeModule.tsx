import React, { useState, useEffect, useRef } from 'react';
import { 
  Youtube, 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack, 
  Volume2, 
  VolumeX, 
  Volume1, 
  Repeat, 
  Shuffle, 
  Sparkles, 
  Search, 
  List, 
  Star, 
  Clock, 
  Activity, 
  RotateCcw, 
  Plus, 
  Trash2, 
  X, 
  ChevronUp, 
  ChevronDown, 
  Loader2, 
  Radio, 
  ExternalLink, 
  Maximize2, 
  Minimize2, 
  ShieldAlert, 
  AlertTriangle, 
  Check, 
  Flame, 
  Music,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { YouTubeVideoItem, YouTubeHistoryItem } from '../types';
import { youtubePlayerController, YouTubePlayerState } from '../utils/youtubePlayerController';

interface YouTubeModuleProps {
  onClose?: () => void;
  isCompact?: boolean;
}

export const YouTubeModule: React.FC<YouTubeModuleProps> = ({ onClose, isCompact = false }) => {
  const [playerState, setPlayerState] = useState<YouTubePlayerState>(youtubePlayerController.getState());
  const [activeTab, setActiveTab] = useState<'search' | 'playlists_yt' | 'suggestions' | 'playlist' | 'favorites' | 'history' | 'diagnostic'>('search');
  const [searchInput, setSearchInput] = useState('');
  const [isHoveringSeek, setIsHoveringSeek] = useState(false);
  const [seekHoverTime, setSeekHoverTime] = useState<number | null>(null);
  const [showAddUrlModal, setShowAddUrlModal] = useState(false);
  const [manualUrlInput, setManualUrlInput] = useState('');
  const [manualUrlTitle, setManualUrlTitle] = useState('');
  const [customSpeed, setCustomSpeed] = useState<number>(1);
  const [isExpandedVideo, setIsExpandedVideo] = useState(false);
  const [customPlaylistUrlInput, setCustomPlaylistUrlInput] = useState('');
  const [isLoadingPlaylistUrl, setIsLoadingPlaylistUrl] = useState(false);
  const [playlistUrlError, setPlaylistUrlError] = useState<string | null>(null);
  const [playlistSuccessMsg, setPlaylistSuccessMsg] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Subscribe to YouTube engine
  useEffect(() => {
    const unsubscribe = youtubePlayerController.subscribe((newState) => {
      setPlayerState(newState);
      setCustomSpeed(newState.playbackRate);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  // Sync search input with last query
  useEffect(() => {
    if (playerState.searchState.lastQuery && !searchInput) {
      setSearchInput(playerState.searchState.lastQuery);
    }
  }, [playerState.searchState.lastQuery]);

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    if (hrs > 0) {
      return `${hrs}:${remMins < 10 ? '0' : ''}${remMins}:${secs < 10 ? '0' : ''}${secs}`;
    }
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = searchInput.trim();
    if (query) {
      youtubePlayerController.search(query, false);
      setActiveTab('search');
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    youtubePlayerController.seekTo(val);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    youtubePlayerController.setVolume(val);
  };

  const handleSpeedChange = (rate: number) => {
    setCustomSpeed(rate);
    youtubePlayerController.setPlaybackRate(rate);
  };

  const handleAddManualUrl = (e: React.FormEvent) => {
    e.preventDefault();
    const url = manualUrlInput.trim();
    if (!url) return;

    let id = '';
    try {
      if (url.includes('v=')) id = url.split('v=')[1].split('&')[0];
      else if (url.includes('youtu.be/')) id = url.split('youtu.be/')[1].split('?')[0];
      else id = url;
    } catch (err) {
      id = url;
    }

    const newItem: YouTubeVideoItem = {
      id: id || String(Date.now()),
      type: 'video',
      title: manualUrlTitle.trim() || 'Vídeo personalizado',
      channel: 'Añadido manualmente',
      duration: '',
      url,
      thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      dateAdded: Date.now()
    };

    youtubePlayerController.addToPlaylist(newItem, true);
    setManualUrlInput('');
    setManualUrlTitle('');
    setShowAddUrlModal(false);
  };

  const isFav = (id: string) => playerState.favorites.some(f => f.id === id);

  const quickSearchSuggestions = [
    'Música Chillout Restaurante',
    'Lofi Hip Hop Beats',
    'Jazz Suave para Cenar',
    'Bossa Nova Acústica',
    'Éxitos Pop en Español',
    'Deep House Lounge'
  ];

  return (
    <div id="youtube-module-root" className="bg-slate-900 border border-slate-800 text-slate-100 rounded-2xl shadow-2xl flex flex-col overflow-hidden w-full max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="p-3.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-500 shadow-inner">
            <Youtube size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-black text-sm text-slate-100 tracking-wide uppercase">
                Reproductor Multimedia YouTube
              </h2>
              {/* Status Badge */}
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono tracking-wider flex items-center gap-1.5 ${
                playerState.isPlaying 
                  ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/80'
                  : playerState.isLoading
                  ? 'bg-amber-950/80 text-amber-300 border border-amber-800/80 animate-pulse'
                  : playerState.status === 'ERROR'
                  ? 'bg-red-950/80 text-red-400 border border-red-800/80'
                  : 'bg-slate-800 text-slate-400 border border-slate-700/80'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  playerState.isPlaying 
                    ? 'bg-emerald-400 animate-ping'
                    : playerState.isLoading
                    ? 'bg-amber-400'
                    : playerState.status === 'ERROR'
                    ? 'bg-red-400'
                    : 'bg-slate-500'
                }`} />
                {playerState.isPlaying ? 'EN REPRODUCCIÓN' : playerState.isLoading ? 'CARGANDO...' : playerState.status === 'ERROR' ? 'ERROR' : 'EN PAUSA'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Sistema desacoplado con persistencia total y reproducción continua</p>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => youtubePlayerController.recoverPlayer()}
            title="Reinstanciar reproductor"
            className="px-2.5 py-1.5 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-slate-100 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <RotateCcw size={13} />
            <span className="hidden sm:inline">Reiniciar Motor</span>
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-100 bg-slate-800/60 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Autoplay Block Warning Banner */}
      {playerState.autoplayBlocked && (
        <div className="p-3 bg-amber-950/40 border-b border-amber-800/60 text-amber-200 text-xs flex items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-2">
            <ShieldAlert size={18} className="text-amber-400 shrink-0" />
            <span>El navegador ha pausado el audio por política de reproducción automática. Haz clic para activar el sonido.</span>
          </div>
          <button
            type="button"
            onClick={() => youtubePlayerController.play()}
            className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs transition-colors cursor-pointer shrink-0"
          >
            Activar Sonido Ahora
          </button>
        </div>
      )}

      {/* Error Notification */}
      {playerState.errorDetails && (
        <div className="p-3 bg-red-950/40 border-b border-red-800/60 text-red-200 text-xs flex items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-start gap-2">
            <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">{playerState.errorDetails.message}</p>
              <p className="text-[10px] text-red-300/80 font-mono mt-0.5">Código de error: {playerState.errorDetails.code}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => youtubePlayerController.recoverPlayer()}
            className="px-3 py-1 bg-red-800 hover:bg-red-700 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer shrink-0"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Main Viewport & Player Control Center */}
      <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex flex-col md:flex-row gap-4 items-stretch">
        {/* Left/Top: Video & Artwork Preview */}
        <div className="w-full md:w-72 shrink-0 flex flex-col gap-2">
          <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-950 border border-slate-800 group shadow-lg">
            {playerState.currentVideo?.thumbnail ? (
              <img 
                src={playerState.currentVideo.thumbnail} 
                alt={playerState.currentVideo.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 text-slate-600 gap-2">
                <Music size={32} />
                <span className="text-xs">Sin pista cargada</span>
              </div>
            )}

            {/* Video overlay badge */}
            <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/80 backdrop-blur text-[10px] font-mono text-slate-200 border border-white/10 flex items-center gap-1.5">
              <Youtube size={12} className="text-red-500" />
              <span>YouTube Live Audio</span>
            </div>

            {/* Equalizer animation when playing */}
            {playerState.isPlaying && (
              <div className="absolute bottom-2 left-2 px-2 py-1 rounded bg-black/80 backdrop-blur border border-white/10 flex items-center gap-1">
                <span className="w-1 h-3 bg-red-500 rounded animate-bounce" style={{ animationDuration: '0.6s' }} />
                <span className="w-1 h-4 bg-red-400 rounded animate-bounce" style={{ animationDuration: '0.4s' }} />
                <span className="w-1 h-2 bg-red-600 rounded animate-bounce" style={{ animationDuration: '0.8s' }} />
                <span className="text-[10px] font-bold text-red-400 ml-1 font-mono">EN VIVO</span>
              </div>
            )}

            {playerState.currentVideo?.duration && (
              <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-mono font-bold text-slate-200">
                {playerState.currentVideo.duration}
              </div>
            )}
          </div>

          {/* Quick External Link */}
          {playerState.currentVideo?.url && (
            <a
              href={playerState.currentVideo.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-slate-400 hover:text-red-400 flex items-center justify-center gap-1 transition-colors py-0.5"
            >
              <span>Abrir en YouTube Oficial</span>
              <ExternalLink size={11} />
            </a>
          )}
        </div>

        {/* Right: Metadata & Advanced Controls */}
        <div className="flex-1 flex flex-col justify-between gap-3">
          {/* Metadata */}
          <div>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-bold text-sm sm:text-base text-slate-100 line-clamp-2 leading-tight">
                  {playerState.currentVideo?.title || 'Selecciona una pista para reproducir'}
                </h3>
                <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                  <span>{playerState.currentVideo?.channel || 'YouTube'}</span>
                  {playerState.playlist.length > 0 && (
                    <span className="text-[10px] font-mono text-slate-500">
                      Pista {playerState.currentIndex + 1} de {playerState.playlist.length}
                    </span>
                  )}
                </p>
              </div>

              {/* Favorite Toggle */}
              {playerState.currentVideo && (
                <button
                  type="button"
                  onClick={() => youtubePlayerController.toggleFavorite(playerState.currentVideo!)}
                  title={isFav(playerState.currentVideo.id) ? 'Quitar de favoritos' : 'Añadir a favoritos'}
                  className={`p-2 rounded-xl border transition-all cursor-pointer ${
                    isFav(playerState.currentVideo.id)
                      ? 'bg-amber-950/60 border-amber-800 text-amber-400'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-amber-400'
                  }`}
                >
                  <Star size={16} className={isFav(playerState.currentVideo.id) ? 'fill-amber-400' : ''} />
                </button>
              )}
            </div>
          </div>

          {/* Progress & Scrub Bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>{formatTime(playerState.currentTime)}</span>
              <span>{formatTime(playerState.duration)}</span>
            </div>
            <input
              type="range"
              min="0"
              max={playerState.duration || 100}
              step="1"
              value={playerState.currentTime}
              onChange={handleSeek}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-red-500 hover:accent-red-400 transition-all"
            />
          </div>

          {/* Main Controls Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            {/* Primary Transport Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => youtubePlayerController.previousVideo()}
                disabled={playerState.playlist.length === 0}
                title="Pista anterior"
                className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-slate-100 hover:bg-slate-800 disabled:opacity-40 transition-all cursor-pointer"
              >
                <SkipBack size={16} />
              </button>

              <button
                type="button"
                onClick={() => youtubePlayerController.togglePlay()}
                title={playerState.isPlaying ? 'Pausar' : 'Reproducir'}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold shadow-lg shadow-red-950/50 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {playerState.isLoading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : playerState.isPlaying ? (
                  <Pause size={18} className="fill-white" />
                ) : (
                  <Play size={18} className="fill-white" />
                )}
                <span className="text-xs font-black">{playerState.isPlaying ? 'PAUSAR' : 'REPRODUCIR'}</span>
              </button>

              <button
                type="button"
                onClick={() => youtubePlayerController.nextVideo()}
                disabled={playerState.playlist.length === 0 && playerState.suggestions.length === 0}
                title="Siguiente pista"
                className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-slate-100 hover:bg-slate-800 disabled:opacity-40 transition-all cursor-pointer"
              >
                <SkipForward size={16} />
              </button>
            </div>

            {/* Mode Toggles: Loop, Shuffle, Infinite Mix */}
            <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800/80 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => youtubePlayerController.toggleLoop()}
                title={playerState.isLooping ? 'Repetición: Activada' : 'Repetición: Desactivada'}
                className={`p-2 rounded-lg transition-all cursor-pointer ${
                  playerState.isLooping 
                    ? 'bg-red-950 text-red-400 border border-red-800' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Repeat size={14} />
              </button>

              <button
                type="button"
                onClick={() => youtubePlayerController.toggleShuffle()}
                title={playerState.isShuffle ? 'Aleatorio: Activado' : 'Aleatorio: Desactivado'}
                className={`p-2 rounded-lg transition-all cursor-pointer ${
                  playerState.isShuffle 
                    ? 'bg-red-950 text-red-400 border border-red-800' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Shuffle size={14} />
              </button>

              <button
                type="button"
                onClick={() => youtubePlayerController.toggleInfiniteMix()}
                title={playerState.infiniteMix ? 'Mix Infinito (Auto-sugerencias): Activado' : 'Mix Infinito: Desactivado'}
                className={`p-2 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                  playerState.infiniteMix 
                    ? 'bg-indigo-950 text-indigo-300 border border-indigo-800' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Radio size={14} />
                <span className="text-[10px] font-bold hidden sm:inline">Mix Infinito</span>
              </button>
            </div>

            {/* Volume Control */}
            <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800/80 px-3 py-1.5 rounded-xl">
              <button
                type="button"
                onClick={() => youtubePlayerController.toggleMute()}
                className="text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              >
                {playerState.isMuted || playerState.volume === 0 ? (
                  <VolumeX size={16} className="text-red-400" />
                ) : playerState.volume < 50 ? (
                  <Volume1 size={16} />
                ) : (
                  <Volume2 size={16} />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={playerState.isMuted ? 0 : playerState.volume}
                onChange={handleVolumeChange}
                className="w-20 sm:w-24 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-red-500"
              />
              <span className="text-[11px] font-mono text-slate-400 w-7 text-right">
                {playerState.isMuted ? '0%' : `${playerState.volume}%`}
              </span>
            </div>

            {/* Playback Rate Selector */}
            <div className="flex items-center gap-1 text-[11px] font-mono">
              {[0.75, 1, 1.25, 1.5].map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => handleSpeedChange(rate)}
                  className={`px-2 py-1 rounded-lg border transition-all cursor-pointer ${
                    customSpeed === rate
                      ? 'bg-slate-800 border-slate-700 text-slate-100 font-bold'
                      : 'bg-slate-950 border-slate-900 text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {rate}x
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation Bar */}
      <div className="flex border-b border-slate-800 bg-slate-950 px-3 pt-2 gap-1 overflow-x-auto scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveTab('search')}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 border-t border-x shrink-0 cursor-pointer ${
            activeTab === 'search'
              ? 'bg-slate-900 text-red-400 border-slate-800 border-b-slate-900'
              : 'bg-transparent text-slate-400 hover:text-slate-200 border-transparent'
          }`}
        >
          <Search size={14} />
          <span>Búsqueda</span>
          {playerState.searchState.results.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-red-950 text-red-400 border border-red-900 font-mono">
              {playerState.searchState.results.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('playlists_yt')}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 border-t border-x shrink-0 cursor-pointer ${
            activeTab === 'playlists_yt'
              ? 'bg-slate-900 text-red-500 border-slate-800 border-b-slate-900 shadow-sm'
              : 'bg-transparent text-slate-400 hover:text-slate-200 border-transparent'
          }`}
        >
          <Youtube size={14} className="text-red-500" />
          <span>Listas Originales YouTube</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('suggestions')}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 border-t border-x shrink-0 cursor-pointer ${
            activeTab === 'suggestions'
              ? 'bg-slate-900 text-indigo-400 border-slate-800 border-b-slate-900'
              : 'bg-transparent text-slate-400 hover:text-slate-200 border-transparent'
          }`}
        >
          <Sparkles size={14} />
          <span>Sugerencias</span>
          {playerState.suggestions.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-900 font-mono">
              {playerState.suggestions.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('playlist')}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 border-t border-x shrink-0 cursor-pointer ${
            activeTab === 'playlist'
              ? 'bg-slate-900 text-slate-100 border-slate-800 border-b-slate-900'
              : 'bg-transparent text-slate-400 hover:text-slate-200 border-transparent'
          }`}
        >
          <List size={14} />
          <span>Lista de Reproducción</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300 border border-slate-700 font-mono">
            {playerState.playlist.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('favorites')}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 border-t border-x shrink-0 cursor-pointer ${
            activeTab === 'favorites'
              ? 'bg-slate-900 text-amber-400 border-slate-800 border-b-slate-900'
              : 'bg-transparent text-slate-400 hover:text-slate-200 border-transparent'
          }`}
        >
          <Star size={14} />
          <span>Favoritos</span>
          {playerState.favorites.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-950 text-amber-400 border border-amber-900 font-mono">
              {playerState.favorites.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 border-t border-x shrink-0 cursor-pointer ${
            activeTab === 'history'
              ? 'bg-slate-900 text-slate-200 border-slate-800 border-b-slate-900'
              : 'bg-transparent text-slate-400 hover:text-slate-200 border-transparent'
          }`}
        >
          <Clock size={14} />
          <span>Historial</span>
          {playerState.history.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-400 font-mono">
              {playerState.history.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('diagnostic')}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 border-t border-x shrink-0 cursor-pointer ${
            activeTab === 'diagnostic'
              ? 'bg-slate-900 text-emerald-400 border-slate-800 border-b-slate-900'
              : 'bg-transparent text-slate-400 hover:text-slate-200 border-transparent'
          }`}
        >
          <Activity size={14} />
          <span>Diagnóstico</span>
        </button>
      </div>

      {/* Tabs Content Container */}
      <div className="p-4 bg-slate-900 flex-1 min-h-[380px] overflow-y-auto">
        {/* ================= TAB 1: BÚSQUEDA ================= */}
        {activeTab === 'search' && (
          <div className="space-y-4">
            {/* Search Input Bar */}
            <form onSubmit={handleSearchSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Buscar canciones, artistas, géneros o listas en YouTube (ej: Lofi, Jazz, Pop)..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 outline-none transition-colors pr-8"
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchInput('');
                      if (searchInputRef.current) searchInputRef.current.focus();
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1 cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <button
                type="submit"
                disabled={playerState.searchState.isLoading || !searchInput.trim()}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer shrink-0 shadow-md shadow-red-950/40"
              >
                {playerState.searchState.isLoading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Search size={14} />
                )}
                <span>Buscar</span>
              </button>
            </form>

            {/* Previous Searches History Section */}
            {playerState.searchHistory && playerState.searchHistory.length > 0 && (
              <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5 font-mono uppercase tracking-wider">
                    <Clock size={12} className="text-red-400" />
                    Búsquedas Anteriores Guardadas
                  </span>
                  <button
                    type="button"
                    onClick={() => youtubePlayerController.clearSearchHistory()}
                    className="text-[10px] text-slate-500 hover:text-red-400 transition-colors cursor-pointer font-medium"
                  >
                    Limpiar todas
                  </button>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {playerState.searchHistory.slice(0, 15).map((queryItem) => (
                    <div
                      key={queryItem}
                      className="inline-flex items-center gap-1 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-300 transition-all group"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setSearchInput(queryItem);
                          youtubePlayerController.search(queryItem, false);
                        }}
                        className="text-[11px] font-medium text-slate-300 hover:text-red-400 cursor-pointer"
                      >
                        {queryItem}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          youtubePlayerController.removeSearchHistoryItem(queryItem);
                        }}
                        title="Eliminar de búsquedas anteriores"
                        className="text-slate-600 hover:text-red-400 p-0.5 rounded transition-colors cursor-pointer"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Suggestions Chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-mono text-slate-500 uppercase mr-1">Sugeridos:</span>
              {quickSearchSuggestions.map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => {
                    setSearchInput(term);
                    youtubePlayerController.search(term, false);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800/80 hover:border-slate-700 text-slate-400 hover:text-slate-200 text-[11px] transition-all cursor-pointer flex items-center gap-1"
                >
                  <Flame size={11} className="text-amber-500" />
                  <span>{term}</span>
                </button>
              ))}
            </div>

            {/* Search Results List */}
            {playerState.searchState.error ? (
              <div className="text-center py-12 text-slate-400 text-xs flex flex-col items-center gap-3">
                <AlertTriangle size={32} className="text-red-400" />
                <p className="font-semibold text-slate-200">{playerState.searchState.error}</p>
                <button
                  type="button"
                  onClick={() => youtubePlayerController.search(searchInput || 'musica variada', false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Reintentar búsqueda
                </button>
              </div>
            ) : playerState.searchState.results.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs flex flex-col items-center gap-2.5">
                {playerState.searchState.isLoading ? (
                  <>
                    <Loader2 size={32} className="animate-spin text-red-500" />
                    <span className="font-semibold text-slate-300">Buscando pistas en YouTube...</span>
                  </>
                ) : (
                  <>
                    <Youtube size={36} className="text-slate-700 mb-1" />
                    <span className="font-semibold text-slate-300">No hay resultados en pantalla</span>
                    <p className="text-[11px] text-slate-500 max-w-sm leading-relaxed">
                      Introduce un término arriba, pulsa una búsqueda anterior o haz clic en las sugerencias rápidas.
                    </p>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pb-1">
                  <span>Resultados para: "{playerState.searchState.lastQuery}"</span>
                  <span>{playerState.searchState.results.length} elementos encontrados</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {playerState.searchState.results.map((item) => {
                    const isPlaylist = item.type === 'playlist' || (item.url && item.url.includes('list='));
                    const isCurrent = playerState.currentVideo?.id === item.id;
                    const inPlaylist = playerState.playlist.some(p => p.id === item.id);
                    const fav = isFav(item.id);

                    return (
                      <div
                        key={item.id}
                        onClick={() => youtubePlayerController.playVideo(item)}
                        className={`p-2.5 rounded-xl border flex gap-3 text-xs items-start cursor-pointer transition-all ${
                          isPlaylist
                            ? 'bg-red-950/20 border-red-900/60 hover:border-red-600 text-slate-200'
                            : isCurrent
                            ? 'bg-red-950/40 border-red-800 shadow-md text-red-100'
                            : 'bg-slate-950/70 border-slate-800/80 hover:bg-slate-950 hover:border-slate-700 text-slate-300'
                        }`}
                      >
                        {/* Thumbnail */}
                        <div className="relative shrink-0 w-28 aspect-video rounded-lg overflow-hidden bg-slate-900 border border-slate-800">
                          {item.thumbnail ? (
                            <img src={item.thumbnail} alt={item.title} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-600">
                              <Youtube size={20} />
                            </div>
                          )}
                          {item.duration && (
                            <span className="absolute bottom-1 right-1 px-1 py-0.5 text-[9px] font-bold font-mono bg-black/85 text-slate-200 rounded">
                              {item.duration}
                            </span>
                          )}
                          {isPlaylist && (
                            <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[8px] font-mono font-bold bg-red-600 text-white flex items-center gap-1">
                              <List size={9} />
                              <span>LISTA YOUTUBE</span>
                            </div>
                          )}
                          {isCurrent && !isPlaylist && (
                            <div className="absolute inset-0 bg-red-950/60 flex items-center justify-center">
                              <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" />
                            </div>
                          )}
                        </div>

                        {/* Metadata */}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-slate-100 line-clamp-2 leading-snug" title={item.title}>
                            {item.title}
                          </h4>
                          <p className="text-[10px] text-slate-400 mt-1 truncate flex items-center gap-1.5">
                            <span>{item.channel}</span>
                            {isPlaylist && (
                              <span className="text-red-400 font-bold font-mono">• Lista Original</span>
                            )}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                          {isPlaylist ? (
                            <button
                              type="button"
                              onClick={() => youtubePlayerController.loadYouTubePlaylist(item.id || item.url, true)}
                              title="Reproducir Lista de YouTube Completa"
                              className="p-1.5 rounded-lg border bg-red-600 hover:bg-red-500 border-red-500 text-white font-bold transition-all cursor-pointer flex items-center gap-1"
                            >
                              <Play size={13} className="fill-white" />
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => youtubePlayerController.toggleFavorite(item)}
                                title={fav ? 'Quitar favorito' : 'Guardar en favoritos'}
                                className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                                  fav 
                                    ? 'bg-amber-950/60 border-amber-800 text-amber-400' 
                                    : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-amber-400'
                                }`}
                              >
                                <Star size={13} className={fav ? 'fill-amber-400' : ''} />
                              </button>

                              <button
                                type="button"
                                onClick={() => youtubePlayerController.addToPlaylist(item, false)}
                                title={inPlaylist ? 'Ya en lista' : 'Añadir a lista'}
                                className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                                  inPlaylist
                                    ? 'bg-emerald-950/60 border-emerald-800 text-emerald-400'
                                    : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-emerald-400'
                                }`}
                              >
                                {inPlaylist ? <Check size={13} /> : <Plus size={13} />}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Load More Button */}
                {playerState.searchState.continuationToken && (
                  <div className="pt-3 text-center">
                    <button
                      type="button"
                      onClick={() => youtubePlayerController.search(playerState.searchState.lastQuery, true)}
                      disabled={playerState.searchState.isLoadingMore}
                      className="px-6 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold rounded-xl text-xs transition-all cursor-pointer flex items-center gap-2 mx-auto"
                    >
                      {playerState.searchState.isLoadingMore ? (
                        <>
                          <Loader2 size={14} className="animate-spin text-red-500" />
                          <span>Cargando más resultados...</span>
                        </>
                      ) : (
                        <span>Cargar más resultados</span>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ================= TAB: LISTAS ORIGINALES YOUTUBE ================= */}
        {activeTab === 'playlists_yt' && (
          <div className="space-y-5">
            {/* Direct Playlist URL / ID Input Form */}
            <div className="bg-slate-950 p-4 rounded-xl border border-red-900/40 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-xs text-slate-200 flex items-center gap-2">
                  <Youtube size={16} className="text-red-500" />
                  Importar y Reproducir Lista Original de YouTube
                </h4>
                <span className="text-[10px] font-mono text-slate-500">Formato: list=PL... o enlace completo</span>
              </div>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!customPlaylistUrlInput.trim()) return;
                  setIsLoadingPlaylistUrl(true);
                  setPlaylistUrlError(null);
                  setPlaylistSuccessMsg(null);
                  try {
                    const ok = await youtubePlayerController.loadYouTubePlaylist(customPlaylistUrlInput.trim(), true);
                    if (ok) {
                      setPlaylistSuccessMsg('¡Lista de YouTube cargada y en reproducción correctamente!');
                      setCustomPlaylistUrlInput('');
                    } else {
                      setPlaylistUrlError('No se pudo cargar la lista. Verifica que el ID o enlace de la lista sea público.');
                    }
                  } catch (err: any) {
                    setPlaylistUrlError(err?.message || 'Error al conectar con YouTube');
                  } finally {
                    setIsLoadingPlaylistUrl(false);
                  }
                }}
                className="space-y-2.5"
              >
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Pega aquí la URL de la lista (ej: https://www.youtube.com/playlist?list=PLrAl5_...) o el ID de lista (PL...)"
                    value={customPlaylistUrlInput}
                    onChange={(e) => {
                      setCustomPlaylistUrlInput(e.target.value);
                      setPlaylistUrlError(null);
                    }}
                    className="flex-1 bg-slate-900 border border-slate-800 focus:border-red-500 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 outline-none transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={isLoadingPlaylistUrl || !customPlaylistUrlInput.trim()}
                    className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0 shadow-md shadow-red-950/50"
                  >
                    {isLoadingPlaylistUrl ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} className="fill-white" />}
                    <span>Cargar y Reproducir</span>
                  </button>
                  <button
                    type="button"
                    disabled={isLoadingPlaylistUrl || !customPlaylistUrlInput.trim()}
                    onClick={async () => {
                      if (!customPlaylistUrlInput.trim()) return;
                      setIsLoadingPlaylistUrl(true);
                      setPlaylistUrlError(null);
                      try {
                        const ok = await youtubePlayerController.loadYouTubePlaylist(customPlaylistUrlInput.trim(), false, true);
                        if (ok) {
                          setPlaylistSuccessMsg('¡Canciones de la lista añadidas a la cola actual!');
                          setCustomPlaylistUrlInput('');
                        } else {
                          setPlaylistUrlError('No se pudo cargar la lista.');
                        }
                      } finally {
                        setIsLoadingPlaylistUrl(false);
                      }
                    }}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0 border border-slate-700"
                  >
                    <Plus size={13} />
                    <span>Añadir a Cola</span>
                  </button>
                </div>

                {playlistUrlError && (
                  <p className="text-xs text-red-400 flex items-center gap-1.5 animate-fadeIn">
                    <AlertTriangle size={13} />
                    <span>{playlistUrlError}</span>
                  </p>
                )}
                {playlistSuccessMsg && (
                  <p className="text-xs text-emerald-400 flex items-center gap-1.5 animate-fadeIn">
                    <Check size={13} />
                    <span>{playlistSuccessMsg}</span>
                  </p>
                )}
              </form>
            </div>

            {/* Official Curated YouTube Playlists Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                <h4 className="font-bold text-xs text-slate-200 flex items-center gap-2">
                  <Sparkles size={14} className="text-amber-400" />
                  Listas Oficiales Recomendadas para Restaurantes y Locales
                </h4>
                <span className="text-[11px] text-slate-400 font-mono">1 Clic para reproducir</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  {
                    id: 'PL_RESTAURANT_JAZZ',
                    title: '🎷 Jazz Restaurante & Café Oficial',
                    desc: 'Ambiente elegante, cálido y relajante para cenas y comidas',
                    tracks: '30+ pistas',
                    tag: 'Jazz & Swing',
                    color: 'from-amber-950/40 to-slate-950 border-amber-800/40 hover:border-amber-600',
                  },
                  {
                    id: 'PL_BOSSA_NOVA',
                    title: '☕ Bossa Nova Café Acústico Oficial',
                    desc: 'Guitarras suaves, ritmos brasileños y calidez acústica',
                    tracks: '25+ pistas',
                    tag: 'Bossa & Acústico',
                    color: 'from-emerald-950/40 to-slate-950 border-emerald-800/40 hover:border-emerald-600',
                  },
                  {
                    id: 'PL_LOFI_CAFE',
                    title: '🎧 Lofi Beats & Chillhop Oficial',
                    desc: 'Beats tranquilos, sin estridencias, ideal para ambientación moderna',
                    tracks: '40+ pistas',
                    tag: 'Lo-Fi Chill',
                    color: 'from-indigo-950/40 to-slate-950 border-indigo-800/40 hover:border-indigo-600',
                  },
                  {
                    id: 'PL_LOUNGE_CHILLOUT',
                    title: '🍸 Lounge & Deep House Restaurante',
                    desc: 'Electrónica sofisticada, ritmos deep house y ambiente chillout',
                    tracks: '35+ pistas',
                    tag: 'Lounge Bar',
                    color: 'from-purple-950/40 to-slate-950 border-purple-800/40 hover:border-purple-600',
                  },
                  {
                    id: 'PL_POP_ESPANOL',
                    title: '🇪🇸 Éxitos Pop Español & Latino',
                    desc: 'Música pop conocida, alegre y apta para todo público',
                    tracks: '30+ pistas',
                    tag: 'Pop Latino',
                    color: 'from-rose-950/40 to-slate-950 border-rose-800/40 hover:border-rose-600',
                  },
                  {
                    id: 'PL_PIANO_DINNER',
                    title: '🎹 Piano Relajante para Cenas',
                    desc: 'Melodías de piano acústico suaves sin percusión',
                    tracks: '20+ pistas',
                    tag: 'Piano Clásico',
                    color: 'from-sky-950/40 to-slate-950 border-sky-800/40 hover:border-sky-600',
                  }
                ].map((pl) => (
                  <div
                    key={pl.id}
                    className={`bg-gradient-to-b ${pl.color} p-3.5 rounded-xl border flex flex-col justify-between gap-3 transition-all hover:scale-[1.01] shadow-lg`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-slate-900/80 text-slate-300 border border-slate-700/60">
                          {pl.tag}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">{pl.tracks}</span>
                      </div>
                      <h5 className="font-bold text-xs text-slate-100 leading-snug">{pl.title}</h5>
                      <p className="text-[11px] text-slate-400 mt-1 leading-tight">{pl.desc}</p>
                    </div>

                    <div className="flex items-center gap-2 pt-1 border-t border-slate-800/60">
                      <button
                        type="button"
                        onClick={() => youtubePlayerController.loadYouTubePlaylist(pl.id, true)}
                        className="flex-1 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow"
                      >
                        <Play size={12} className="fill-white" />
                        <span>Reproducir Ahora</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => youtubePlayerController.loadYouTubePlaylist(pl.id, false, true)}
                        title="Añadir a cola"
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg text-xs transition-colors cursor-pointer"
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 2: SUGERENCIAS ================= */}
        {activeTab === 'suggestions' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-1 border-b border-slate-800 text-xs text-slate-400">
              <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                <Sparkles size={14} className="text-indigo-400" />
                Sugerencias automáticas y recomendaciones en tiempo real
              </span>
              <button
                type="button"
                onClick={() => youtubePlayerController.fetchSuggestions()}
                disabled={playerState.isLoadingSuggestions}
                className="px-3 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-[11px] font-bold text-indigo-300 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                {playerState.isLoadingSuggestions ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                <span>Actualizar</span>
              </button>
            </div>

            {playerState.suggestions.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs flex flex-col items-center gap-2">
                <Loader2 size={28} className="animate-spin text-indigo-500 mb-1" />
                <span className="font-semibold text-slate-300">Generando recomendaciones...</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {playerState.suggestions.map((item) => {
                  const isCurrent = playerState.currentVideo?.id === item.id;
                  const inPlaylist = playerState.playlist.some(p => p.id === item.id);
                  const fav = isFav(item.id);

                  return (
                    <div
                      key={item.id}
                      onClick={() => youtubePlayerController.playVideo(item)}
                      className={`p-2.5 rounded-xl border flex gap-3 text-xs items-start cursor-pointer transition-all ${
                        isCurrent
                          ? 'bg-indigo-950/40 border-indigo-800 shadow-md text-indigo-100'
                          : 'bg-slate-950/70 border-slate-800/80 hover:bg-slate-950 hover:border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="relative shrink-0 w-28 aspect-video rounded-lg overflow-hidden bg-slate-900 border border-slate-800">
                        {item.thumbnail ? (
                          <img src={item.thumbnail} alt={item.title} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-600">
                            <Youtube size={20} />
                          </div>
                        )}
                        {item.duration && (
                          <span className="absolute bottom-1 right-1 px-1 py-0.5 text-[9px] font-bold font-mono bg-black/85 text-slate-200 rounded">
                            {item.duration}
                          </span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-slate-100 line-clamp-2 leading-snug">{item.title}</h4>
                        <p className="text-[10px] text-slate-400 mt-1 truncate">{item.channel}</p>
                      </div>

                      <div className="flex flex-col gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => youtubePlayerController.toggleFavorite(item)}
                          className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                            fav 
                              ? 'bg-amber-950/60 border-amber-800 text-amber-400' 
                              : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-amber-400'
                          }`}
                        >
                          <Star size={13} className={fav ? 'fill-amber-400' : ''} />
                        </button>

                        <button
                          type="button"
                          onClick={() => youtubePlayerController.addToPlaylist(item, false)}
                          className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                            inPlaylist
                              ? 'bg-emerald-950/60 border-emerald-800 text-emerald-400'
                              : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-emerald-400'
                          }`}
                        >
                          {inPlaylist ? <Check size={13} /> : <Plus size={13} />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 3: LISTA DE REPRODUCCIÓN ================= */}
        {activeTab === 'playlist' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
              <div>
                <h4 className="font-bold text-xs text-slate-200">Cola Activa ({playerState.playlist.length} canciones)</h4>
                <p className="text-[11px] text-slate-400">Totalmente persistente al recargar o cambiar de pestaña</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddUrlModal(true)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Plus size={13} />
                  <span>Añadir Enlace / ID</span>
                </button>

                <button
                  type="button"
                  onClick={() => youtubePlayerController.resetPlaylistToDefaults()}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                >
                  Restaurar Colección Base
                </button>

                <button
                  type="button"
                  onClick={() => youtubePlayerController.clearPlaylist()}
                  disabled={playerState.playlist.length === 0}
                  className="px-3 py-1.5 bg-red-950/50 hover:bg-red-950 border border-red-900/60 text-red-400 rounded-lg text-xs font-semibold transition-all cursor-pointer disabled:opacity-40"
                >
                  Vaciar Cola
                </button>
              </div>
            </div>

            {/* Manual URL Add Modal */}
            {showAddUrlModal && (
              <form onSubmit={handleAddManualUrl} className="p-3 bg-slate-950 border border-indigo-800/80 rounded-xl space-y-2.5 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-300">Añadir vídeo directamente por URL de YouTube</span>
                  <button type="button" onClick={() => setShowAddUrlModal(false)} className="text-slate-500 hover:text-slate-300">
                    <X size={14} />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Enlace o ID (ej: https://youtube.com/watch?v=...)"
                    value={manualUrlInput}
                    onChange={(e) => setManualUrlInput(e.target.value)}
                    required
                    className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-indigo-500"
                  />
                  <input
                    type="text"
                    placeholder="Título descriptivo (opcional)"
                    value={manualUrlTitle}
                    onChange={(e) => setManualUrlTitle(e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddUrlModal(false)}
                    className="px-3 py-1 rounded-lg text-xs text-slate-400 hover:text-slate-200"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs"
                  >
                    Añadir y Reproducir
                  </button>
                </div>
              </form>
            )}

            {playerState.playlist.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs flex flex-col items-center gap-2">
                <List size={32} className="text-slate-700 mb-1" />
                <span className="font-semibold text-slate-300">La cola de reproducción está vacía</span>
                <p className="text-[11px] text-slate-500 max-w-sm">
                  Busca canciones en la pestaña de Búsqueda o haz clic en "Restaurar Colección Base" para cargar la lista inicial de audio para restaurantes.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {playerState.playlist.map((item, index) => {
                  const isCurrent = playerState.currentIndex === index;

                  return (
                    <div
                      key={`${item.id}_${index}`}
                      onClick={() => youtubePlayerController.playPlaylistIndex(index)}
                      className={`p-2 rounded-xl border flex items-center gap-3 text-xs cursor-pointer transition-all group ${
                        isCurrent
                          ? 'bg-red-950/50 border-red-800 text-red-100 font-semibold shadow-md'
                          : 'bg-slate-950/60 border-slate-850 hover:bg-slate-950 hover:border-slate-750 text-slate-300'
                      }`}
                    >
                      {/* Index Badge */}
                      <span className="w-6 text-center font-mono text-[11px] text-slate-500 shrink-0">
                        {isCurrent ? (
                          <span className="w-2 h-2 rounded-full bg-red-500 inline-block animate-pulse" />
                        ) : (
                          index + 1
                        )}
                      </span>

                      {/* Thumbnail */}
                      <div className="relative shrink-0 w-16 aspect-video rounded overflow-hidden bg-slate-900 border border-slate-800">
                        {item.thumbnail ? (
                          <img src={item.thumbnail} alt={item.title} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-600">
                            <Youtube size={14} />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <h5 className="truncate leading-tight">{item.title}</h5>
                        <p className="text-[10px] text-slate-500 mt-0.5 truncate">{item.channel}</p>
                      </div>

                      {/* Duration */}
                      {item.duration && (
                        <span className="text-[10px] font-mono text-slate-500 shrink-0">{item.duration}</span>
                      )}

                      {/* Reordering & Delete Controls */}
                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => youtubePlayerController.reorderPlaylist(index, index - 1)}
                          disabled={index === 0}
                          title="Subir"
                          className="p-1 text-slate-500 hover:text-slate-200 disabled:opacity-20 cursor-pointer"
                        >
                          <ArrowUp size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => youtubePlayerController.reorderPlaylist(index, index + 1)}
                          disabled={index === playerState.playlist.length - 1}
                          title="Bajar"
                          className="p-1 text-slate-500 hover:text-slate-200 disabled:opacity-20 cursor-pointer"
                        >
                          <ArrowDown size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => youtubePlayerController.removeFromPlaylist(index)}
                          title="Eliminar de la lista"
                          className="p-1 text-slate-500 hover:text-red-400 cursor-pointer ml-1"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 4: FAVORITOS ================= */}
        {activeTab === 'favorites' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs text-slate-400">
              <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                <Star size={14} className="text-amber-400 fill-amber-400" />
                Colección de Vídeos Favoritos ({playerState.favorites.length})
              </span>
            </div>

            {playerState.favorites.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs flex flex-col items-center gap-2">
                <Star size={32} className="text-slate-700 mb-1" />
                <span className="font-semibold text-slate-300">No hay favoritos guardados</span>
                <p className="text-[11px] text-slate-500 max-w-sm">
                  Haz clic en el icono de la estrella de cualquier canción para guardarla aquí y acceder a ella rápidamente.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {playerState.favorites.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => youtubePlayerController.playVideo(item)}
                    className="p-2.5 rounded-xl border bg-slate-950/60 border-slate-800 hover:border-amber-800/80 flex gap-3 text-xs items-start cursor-pointer transition-all"
                  >
                    <div className="relative shrink-0 w-24 aspect-video rounded-lg overflow-hidden bg-slate-900 border border-slate-800">
                      {item.thumbnail ? (
                        <img src={item.thumbnail} alt={item.title} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-600">
                          <Youtube size={16} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-slate-100 line-clamp-2 leading-snug">{item.title}</h4>
                      <p className="text-[10px] text-slate-400 mt-1 truncate">{item.channel}</p>
                    </div>
                    <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => youtubePlayerController.toggleFavorite(item)}
                        className="p-1.5 rounded-lg border bg-amber-950/60 border-amber-800 text-amber-400 hover:bg-red-950 hover:border-red-800 hover:text-red-400 transition-all cursor-pointer"
                        title="Eliminar de favoritos"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 5: HISTORIAL ================= */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs text-slate-400">
              <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                <Clock size={14} />
                Historial cronológico de reproducción ({playerState.history.length})
              </span>
              {playerState.history.length > 0 && (
                <button
                  type="button"
                  onClick={() => youtubePlayerController.clearHistory()}
                  className="px-3 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-red-400 text-[11px] font-semibold transition-all cursor-pointer"
                >
                  Limpiar historial
                </button>
              )}
            </div>

            {playerState.history.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs flex flex-col items-center gap-2">
                <Clock size={32} className="text-slate-700 mb-1" />
                <span className="font-semibold text-slate-300">Historial vacío</span>
                <p className="text-[11px] text-slate-500 max-w-sm">
                  Las canciones que se reproduzcan se registrarán automáticamente aquí.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {playerState.history.map((item, idx) => (
                  <div
                    key={`${item.id}_${idx}`}
                    onClick={() => youtubePlayerController.playVideo(item, false)}
                    className="p-2 rounded-xl bg-slate-950/60 border border-slate-850 hover:border-slate-750 flex items-center gap-3 text-xs cursor-pointer transition-all"
                  >
                    <div className="relative shrink-0 w-16 aspect-video rounded overflow-hidden bg-slate-900 border border-slate-800">
                      {item.thumbnail ? (
                        <img src={item.thumbnail} alt={item.title} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-600">
                          <Youtube size={14} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h5 className="truncate text-slate-200">{item.title}</h5>
                      <p className="text-[10px] text-slate-500 mt-0.5 truncate">{item.channel}</p>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 shrink-0">
                      {new Date(item.playedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 6: DIAGNÓSTICO ================= */}
        {activeTab === 'diagnostic' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs">
              <span className="font-bold font-mono text-emerald-400 flex items-center gap-1.5 uppercase tracking-wider">
                <Activity size={14} />
                Panel de Diagnóstico y Telemetría del Motor YouTube
              </span>
              <button
                type="button"
                onClick={() => youtubePlayerController.recoverPlayer()}
                className="px-3 py-1 bg-emerald-950 border border-emerald-800 text-emerald-300 font-bold rounded-lg text-xs transition-all cursor-pointer flex items-center gap-1"
              >
                <RotateCcw size={12} />
                <span>Reinstanciar Iframe</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 font-mono text-xs">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-500 text-[10px] uppercase block">Estado del Motor</span>
                <span className="text-sm font-bold text-slate-100 mt-1 block">{playerState.status}</span>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-500 text-[10px] uppercase block">Conexión a Red</span>
                <span className="text-sm font-bold text-emerald-400 mt-1 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  {navigator.onLine ? 'Conectado (Online)' : 'Desconectado (Offline)'}
                </span>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-500 text-[10px] uppercase block">Atenuación por Tickets (Ducking)</span>
                <span className="text-sm font-bold text-indigo-400 mt-1 block">
                  {playerState.isDucked ? 'Atenuado (Voz Activa)' : 'Normal (100%)'}
                </span>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-500 text-[10px] uppercase block">Posición del Buffer</span>
                <span className="text-sm font-bold text-slate-100 mt-1 block">
                  {formatTime(playerState.currentTime)} / {formatTime(playerState.duration)}
                </span>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-500 text-[10px] uppercase block">Pistas en Cola</span>
                <span className="text-sm font-bold text-slate-100 mt-1 block">{playerState.playlist.length} pistas</span>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-500 text-[10px] uppercase block">Bloqueo de Autoplay</span>
                <span className={`text-sm font-bold mt-1 block ${playerState.autoplayBlocked ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {playerState.autoplayBlocked ? 'Bloqueado por navegador' : 'Permitido'}
                </span>
              </div>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
              <h5 className="font-bold text-xs text-slate-200">Vídeo Activo Actual</h5>
              <p className="text-xs text-slate-400 font-mono break-all">
                {playerState.currentVideo?.url || 'Ninguno'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
