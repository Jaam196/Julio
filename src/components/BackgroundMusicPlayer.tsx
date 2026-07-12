import React, { useState, useEffect } from 'react';
import { musicController } from '../utils/musicController';
import { MusicConfig } from '../types';
import { 
  Play, Pause, SkipForward, SkipBack, Music, Volume2, Volume1, VolumeX,
  Youtube, List, Disc, ChevronDown, ChevronUp, Link2
} from 'lucide-react';

interface BackgroundMusicPlayerProps {
  musicConfig: MusicConfig;
  onSaveMusicConfig: (config: MusicConfig) => void;
}

export const YOUTUBE_PRESETS = [
  { id: 'lofi', label: '☕ Lofi Girl (Chill Beats)', url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk' },
  { id: 'jazz', label: '🎷 Cafe Smooth Jazz', url: 'https://www.youtube.com/watch?v=Dx5_wdKkpBY' },
  { id: 'bossa', label: '🏖️ Lounge Bossa Nova', url: 'https://www.youtube.com/watch?v=5grNis6L_oI' },
  { id: 'classical', label: '🎹 Piano Clásico Relajante', url: 'https://www.youtube.com/watch?v=y7e-GC6oGIZ' },
  { id: 'pop', label: '🍔 Pop Alegre Restaurante', url: 'https://www.youtube.com/watch?v=vV77mrc3lP0' },
  { id: 'synth', label: '🌌 Atmospheric Synthwave', url: 'https://www.youtube.com/watch?v=4xDzrJKXOOY' },
];

export const AUDIO_PRESETS = [
  { id: 'lofi_mp3', label: '☕ Café Lofi (MP3)', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
  { id: 'jazz_mp3', label: '🎷 Jazz Restaurante (MP3)', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3' },
  { id: 'chill_mp3', label: '🛋️ Chillout Lounge (MP3)', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3' },
  { id: 'rain_mp3', label: '🌧️ Lluvia Relajante (MP3)', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3' },
];

export default function BackgroundMusicPlayer({ musicConfig, onSaveMusicConfig }: BackgroundMusicPlayerProps) {
  const [playerState, setPlayerState] = useState(musicController.getState());
  const [showPlaylists, setShowPlaylists] = useState(true);
  const [customUrl, setCustomUrl] = useState(musicConfig.integratedUrl);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [showVideo, setShowVideo] = useState(true);

  // Sync state with musicController subscriptions
  useEffect(() => {
    const unsubscribe = musicController.subscribe((state) => {
      setPlayerState(state);
    });
    return () => unsubscribe();
  }, []);

  // Update custom input when url changes in controller
  useEffect(() => {
    setCustomUrl(musicConfig.integratedUrl);
  }, [musicConfig.integratedUrl]);

  // Set musicController's config change hook so clicking next/prev from controller triggers state save in React/IndexedDB
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
        
        // Make it visible and fill viewport
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
        // Return to body as a hidden background element
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

  if (!musicConfig.enabled || !musicConfig.integratedEnabled) {
    return null;
  }

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

  const selectPreset = (url: string) => {
    const wasPlaying = playerState.isPlaying;
    const updated = { ...musicConfig, integratedUrl: url };
    onSaveMusicConfig(updated);
    musicController.setConfig(updated);
    if (wasPlaying || !playerState.isPlaying) {
      // Auto play when preset is selected
      setTimeout(() => {
        musicController.play();
      }, 100);
    }
  };

  const submitCustomUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customUrl.trim()) return;
    selectPreset(customUrl.trim());
  };

  // Icon depending on volume level
  const VolumeIcon = () => {
    const vol = musicConfig.integratedVolume;
    if (vol === 0) return <VolumeX size={16} className="text-slate-500" />;
    if (vol < 40) return <Volume1 size={16} className="text-slate-400" />;
    return <Volume2 size={16} className="text-indigo-400" />;
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden group">
      {/* Dynamic background atmospheric light reflecting state */}
      <div className={`absolute -right-16 -top-16 w-36 h-36 rounded-full blur-3xl transition-all duration-1000 ${
        playerState.isPlaying 
          ? 'bg-indigo-500/10 group-hover:bg-indigo-500/15' 
          : 'bg-slate-500/5 group-hover:bg-slate-500/10'
      }`}></div>

      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800/60">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-500/10 text-indigo-400 rounded-lg shrink-0">
            <Music size={16} />
          </div>
          <div>
            <span className="text-[11px] font-mono text-indigo-400 uppercase tracking-widest font-bold">Música Ambiental</span>
            <h3 className="font-semibold text-slate-200 text-sm">Reproductor de Fondo</h3>
          </div>
        </div>

        {/* Live Status Indicators */}
        <div className="flex items-center gap-1.5">
          {playerState.isPlaying ? (
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

      {/* Album Art & Title Panel */}
      <div className="bg-slate-950 rounded-xl p-3 border border-slate-800/40 flex items-center gap-3.5 mb-4">
        {/* Vinyl Disc Icon */}
        <div className="relative shrink-0">
          <div className={`w-11 h-11 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 shadow-inner ${
            playerState.isPlaying && !playerState.isDucked ? 'animate-spin' : ''
          }`} style={{ animationDuration: '6s' }}>
            <Disc size={20} className={playerState.isPlaying ? 'text-indigo-400' : 'text-slate-500'} />
            <div className="absolute w-2.5 h-2.5 bg-slate-950 rounded-full border border-slate-800"></div>
          </div>
        </div>

        {/* Title Marquee / Description */}
        <div className="overflow-hidden flex-1">
          <span className="text-[9px] font-mono font-bold text-slate-500 uppercase flex items-center gap-1">
            {playerState.isYouTube ? (
              <>
                <Youtube size={10} className="text-red-500" />
                YouTube Oficial (IFrame Player)
              </>
            ) : (
              <>
                <Music size={10} className="text-indigo-400" />
                Archivo de Audio
              </>
            )}
          </span>
          <div className="text-xs font-semibold text-slate-100 truncate mt-0.5 tracking-tight">
            {playerState.trackTitle || 'Cargando pista...'}
          </div>
        </div>
      </div>

      {/* Official YouTube Video Viewport Area */}
      {playerState.isYouTube && (
        <div className="space-y-2 mb-4">
          <div className="flex justify-between items-center px-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono flex items-center gap-1">
              <Youtube size={11} className="text-red-500 animate-pulse" />
              Reproductor de Vídeo Incorporado
            </span>
            <button
              type="button"
              onClick={() => setShowVideo(!showVideo)}
              className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold underline underline-offset-2 cursor-pointer transition-colors"
            >
              {showVideo ? 'Minimizar Vídeo' : 'Ver Reproductor'}
            </button>
          </div>
          
          <div 
            id="yt-player-viewport" 
            className={`w-full bg-black border border-slate-800 rounded-xl overflow-hidden shadow-2xl relative transition-all duration-300 ${
              showVideo ? 'aspect-video h-[180px] sm:h-[280px] opacity-100 scale-100' : 'h-0 opacity-0 scale-95 pointer-events-none border-none'
            }`}
          >
            {showVideo && (!playerState.isPlaying && !playerState.activeUrl) && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950 text-slate-500">
                <span className="text-xs font-mono">Iniciando pantalla oficial...</span>
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
                ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/15 border border-indigo-500/50' 
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
            className="w-full accent-indigo-500 bg-slate-950 h-1.5 rounded-lg cursor-pointer"
          />
        </div>
      </div>

      {/* Playlists & Presets Selector Area */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setShowPlaylists(!showPlaylists)}
          className="flex items-center justify-between w-full text-[11px] font-bold text-slate-400 hover:text-slate-200 uppercase tracking-wider transition-colors py-1 cursor-pointer"
        >
          <span className="flex items-center gap-1.5">
            <List size={12} />
            Canales y Listas de Reproducción
          </span>
          {showPlaylists ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>

        {showPlaylists && (
          <div className="space-y-3 pt-1 animate-fadeIn">
            {/* YouTube Presets */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-red-400 font-mono flex items-center gap-1">
                <Youtube size={10} />
                YouTube Radios & Playlists
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {YOUTUBE_PRESETS.map((preset) => {
                  const isActive = musicConfig.integratedUrl === preset.url;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => selectPreset(preset.url)}
                      className={`px-2.5 py-1.5 rounded-lg text-left text-xs font-semibold transition-all border ${
                        isActive 
                          ? 'bg-red-950/40 border-red-800 text-red-300 shadow-sm'
                          : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-950/80'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Standard Audio Presets */}
            <div className="space-y-1 pt-1">
              <span className="text-[10px] font-bold text-indigo-400 font-mono flex items-center gap-1">
                <Music size={10} />
                Audio Directo (Lofi MP3)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {AUDIO_PRESETS.map((preset) => {
                  const isActive = musicConfig.integratedUrl === preset.url;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => selectPreset(preset.url)}
                      className={`px-2.5 py-1.5 rounded-lg text-left text-xs font-semibold transition-all border ${
                        isActive 
                          ? 'bg-indigo-950/40 border-indigo-800 text-indigo-300 shadow-sm'
                          : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-950/80'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom URL Option */}
            <div className="pt-1.5">
              <button
                type="button"
                onClick={() => setShowCustomInput(!showCustomInput)}
                className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold cursor-pointer underline underline-offset-2"
              >
                <Link2 size={10} />
                {showCustomInput ? 'Ocultar entrada de link' : 'Insertar enlace de YouTube personalizado u MP3...'}
              </button>

              {showCustomInput && (
                <form onSubmit={submitCustomUrl} className="mt-2 flex gap-1.5 animate-fadeIn">
                  <input
                    type="text"
                    placeholder="Pega link de YouTube, Shorts, Live, playlist o .mp3..."
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

      {/* Errors notifications */}
      {playerState.error && (
        <div className="mt-3.5 p-3 bg-red-950/20 border border-red-800/40 text-red-400 rounded-xl text-xs flex gap-2 animate-fadeIn">
          <span className="shrink-0">⚠️</span>
          <span className="leading-relaxed font-medium">{playerState.error}</span>
        </div>
      )}
    </div>
  );
}
