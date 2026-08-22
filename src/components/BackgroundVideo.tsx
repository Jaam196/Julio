import React, { useEffect, useRef, useState, memo, useCallback } from 'react';
import { useMediaResolver } from '../hooks/useMediaResolver';
import { ResolvedImage } from './ResolvedMedia';

export interface BackgroundVideoProps {
  bgType?: string;
  bgVideo?: string;
  bgVideos?: { id: string; url: string; active?: boolean }[];
  bgImage?: string;
  standbyEnabled?: boolean;
  standbyImages?: { id: string; url: string; active?: boolean }[];
  standbyDuration?: number;
  standbyFit?: 'cover' | 'contain' | 'fill';
  showStandbyOverlay?: boolean;
  onMediaMissing?: (mediaKey: string) => void;
  isVisible?: boolean;
}

function BackgroundVideoComponent({
  bgType = 'video',
  bgVideo,
  bgVideos = [],
  bgImage,
  standbyEnabled = false,
  standbyImages = [],
  standbyDuration = 5,
  standbyFit = 'cover',
  showStandbyOverlay = false,
  onMediaMissing,
  isVisible = true,
}: BackgroundVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const prevSrcRef = useRef<string>('');
  const stalledTicksRef = useRef<number>(0);
  const retryTimeoutRef = useRef<any>(null);

  // 1. Resolve active playlist videos
  const activeVideos = (bgVideos || []).filter(v => v.active !== false);
  const hasBgVideos = activeVideos.length > 0;
  const currentVideo = hasBgVideos ? activeVideos[currentVideoIndex % activeVideos.length] : null;
  const rawVideoUrl = currentVideo
    ? currentVideo.url
    : (bgVideo || (bgType === 'video' ? '/demo.mp4' : ''));

  const shouldLoop = activeVideos.length <= 1;

  // Callback when onMediaMissing fires for video
  const handleVideoMissing = useCallback(() => {
    if (onMediaMissing) {
      onMediaMissing(currentVideo ? `bg_video_${currentVideo.id}` : 'bg_video');
    }
  }, [onMediaMissing, currentVideo]);

  // 2. Resolve URL through hook (translates indexeddb: to direct HTTP Range stream on Tizen)
  const resolvedSrc = useMediaResolver(rawVideoUrl, handleVideoMissing);

  // Standby slideshow active slides
  const activeSlides = (standbyImages || []).filter(img => img.active);
  const isStandbyActive = standbyEnabled && activeSlides.length > 0 && showStandbyOverlay;
  const currentSlide = isStandbyActive ? activeSlides[currentSlideIndex % activeSlides.length] : null;

  const shouldShowVideo = Boolean(
    resolvedSrc && (
      bgType === 'video' ||
      !bgType ||
      (bgType !== 'image' && (Boolean(bgVideo) || activeVideos.length > 0))
    ) && !isStandbyActive
  );

  // Standby slideshow interval
  useEffect(() => {
    if (!isStandbyActive || activeSlides.length <= 1) {
      setCurrentSlideIndex(0);
      return;
    }
    const durationMs = Math.max(2, standbyDuration) * 1000;
    const interval = setInterval(() => {
      setCurrentSlideIndex(prev => (prev + 1) % activeSlides.length);
    }, durationMs);
    return () => clearInterval(interval);
  }, [isStandbyActive, activeSlides.length, standbyDuration]);

  // Handle video playlist progression
  const handleVideoEnded = useCallback(() => {
    if (activeVideos.length > 1) {
      setCurrentVideoIndex(prev => (prev + 1) % activeVideos.length);
    }
  }, [activeVideos.length]);

  // Emit telemetry diagnostic for TV monitor overlay
  const dispatchDiagnostic = useCallback((event: string, extra = {}) => {
    if (typeof window === 'undefined') return;
    const video = videoRef.current;
    const detail = {
      event,
      src: resolvedSrc,
      mediaKeyOrUrl: rawVideoUrl,
      isLoaded,
      readyState: video ? video.readyState : 0,
      paused: video ? video.paused : true,
      loop: video ? video.loop : shouldLoop,
      muted: video ? video.muted : true,
      currentTime: video ? video.currentTime : 0,
      duration: video ? video.duration : 0,
      error: lastError,
      timestamp: new Date().toLocaleTimeString(),
      ...extra,
    };
    window.dispatchEvent(new CustomEvent('resolved-video-diagnostic', { detail }));
  }, [resolvedSrc, rawVideoUrl, isLoaded, lastError, shouldLoop]);

  // Autonomous playback function with automatic self-retry (zero user click/touch required)
  const attemptPlayback = useCallback(() => {
    const video = videoRef.current;
    if (!video || !resolvedSrc) return;

    video.muted = true;
    video.defaultMuted = true;
    video.loop = shouldLoop;
    video.playsInline = true;
    video.setAttribute('playsinline', 'true');
    video.setAttribute('webkit-playsinline', 'true');
    video.setAttribute('muted', '');

    if (video.error || video.readyState < 2 || !video.src) {
      if (video.src !== resolvedSrc) {
        video.src = resolvedSrc;
      }
      video.load();
    }

    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setIsLoaded(true);
          setLastError(null);
          stalledTicksRef.current = 0;
          if (retryTimeoutRef.current) {
            clearTimeout(retryTimeoutRef.current);
            retryTimeoutRef.current = null;
          }
          dispatchDiagnostic('play-success');
        })
        .catch((err) => {
          if (err.name === 'AbortError' || err.message?.includes('interrupted')) {
            return;
          }
          console.warn('[BackgroundVideo] Autoplay note, auto-retrying in background:', err);
          dispatchDiagnostic('play-retry-scheduled', { error: err.message });

          // Autonomous aggressive retry: no user click required!
          if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
          retryTimeoutRef.current = setTimeout(() => {
            attemptPlayback();
          }, 1000);
        });
    }
  }, [resolvedSrc, shouldLoop, dispatchDiagnostic]);

  // Clean up retry timers on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  // Initialize and maintain video element playback strictly without re-creating DOM
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !resolvedSrc) return;

    // Only update video source if resolvedSrc actually changed
    if (prevSrcRef.current !== resolvedSrc) {
      prevSrcRef.current = resolvedSrc;
      stalledTicksRef.current = 0;
      attemptPlayback();
    } else {
      // If src is unchanged, just ensure playback is running smoothly
      video.loop = shouldLoop;
      if (video.paused && !video.seeking) {
        video.play().catch(() => {
          attemptPlayback();
        });
      }
    }
  }, [resolvedSrc, shouldLoop, attemptPlayback]);

  // Immediate wake-up / resume when isVisible becomes true (e.g. active ticket cleared/delivered)
  useEffect(() => {
    if (isVisible !== false && resolvedSrc) {
      const video = videoRef.current;
      if (video) {
        video.muted = true;
        video.loop = shouldLoop;
        // If paused, ended, or stalled, immediately wake up and play without waiting for heartbeat
        if (video.paused || video.ended || video.readyState < 2 || video.error) {
          if (video.error || video.readyState < 2) {
            video.src = resolvedSrc;
            video.load();
          }
          video.play()
            .then(() => {
              setIsLoaded(true);
              setLastError(null);
              stalledTicksRef.current = 0;
              dispatchDiagnostic('wake-up-resume-success');
            })
            .catch(() => {
              attemptPlayback();
            });
        }
      }
    }
  }, [isVisible, resolvedSrc, shouldLoop, attemptPlayback, dispatchDiagnostic]);

  // Periodic lightweight heartbeat keeper for 24/7 kitchen screen stability
  useEffect(() => {
    if (!resolvedSrc) return;
    const interval = setInterval(() => {
      const video = videoRef.current;
      if (video && isVisible !== false) {
        video.muted = true;
        video.loop = shouldLoop;

        // Detect if the video has an explicit error or is stalled (readyState < 2 and not seeking)
        const hasExplicitError = Boolean(video.error);
        const isStalled = (video.readyState < 2 && !video.seeking) || (video.paused && !video.seeking);

        if (isStalled) {
          stalledTicksRef.current += 1;
        } else {
          stalledTicksRef.current = 0;
        }

        // Force a real reload if there is an explicit error or if it has been stalled for >= 2 ticks (~7s)
        if (hasExplicitError || stalledTicksRef.current >= 2) {
          stalledTicksRef.current = 0;
          video.src = resolvedSrc;
          video.load();
          video.play()
            .then(() => {
              setIsLoaded(true);
              setLastError(null);
              dispatchDiagnostic('heartbeat-reload-success');
            })
            .catch((err) => {
              dispatchDiagnostic('heartbeat-reload-failed', { error: err.message });
            });
        } else if (video.paused && !video.seeking && video.readyState >= 2) {
          // Resume if paused unexpectedly (without calling .load() to prevent video reset)
          video.play()
            .then(() => {
              setLastError(null);
              dispatchDiagnostic('keeper-resume-success');
            })
            .catch(() => {});
        } else {
          dispatchDiagnostic('periodic-check');
        }
      }
    }, 3500);

    return () => clearInterval(interval);
  }, [resolvedSrc, shouldLoop, isVisible, dispatchDiagnostic]);

  // Immediately reload and play video stream when network connection returns (window online event)
  useEffect(() => {
    if (!resolvedSrc) return;
    const handleOnline = () => {
      const video = videoRef.current;
      if (video && resolvedSrc) {
        stalledTicksRef.current = 0;
        video.src = resolvedSrc;
        video.load();
        video.play()
          .then(() => {
            setIsLoaded(true);
            setLastError(null);
            dispatchDiagnostic('online-reload-success');
          })
          .catch((err) => {
            dispatchDiagnostic('online-reload-failed', { error: err.message });
            attemptPlayback();
          });
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [resolvedSrc, attemptPlayback, dispatchDiagnostic]);

  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden z-0 select-none">
      {/* 1. Standby Slideshow Image Layer */}
      {isStandbyActive && currentSlide && (
        <div className="absolute inset-0 w-full h-full z-10">
          <ResolvedImage
            mediaKeyOrUrl={currentSlide.url}
            onMediaMissing={() => onMediaMissing?.(`standby_image_${currentSlide.id}`)}
            className="w-full h-full pointer-events-none"
            style={{ objectFit: standbyFit }}
            alt="Standby"
            referrerPolicy="no-referrer"
          />
        </div>
      )}

      {/* 2. Static Background Image Layer (when configured) */}
      {!isStandbyActive && (bgType === 'image' || (!bgType && bgImage)) && bgImage && (
        <div className="absolute inset-0 w-full h-full z-5 opacity-40">
          <ResolvedImage
            mediaKeyOrUrl={bgImage}
            onMediaMissing={() => onMediaMissing?.('bg_image')}
            className="w-full h-full object-cover pointer-events-none"
            alt="Fondo de pantalla"
            referrerPolicy="no-referrer"
          />
        </div>
      )}

      {/* 3. HTML5 Video Layer - Stays persistently mounted in the DOM to prevent buffering resets */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        preload="auto"
        onEnded={handleVideoEnded}
        onLoadedData={() => {
          setIsLoaded(true);
          setLastError(null);
          dispatchDiagnostic('loadeddata');
        }}
        onError={(e) => {
          const err = (e.target as HTMLVideoElement).error;
          const msg = err ? `Error ${err.code}: ${err.message}` : 'Error de vídeo';
          setLastError(msg);
          dispatchDiagnostic('video-error', { error: msg });
        }}
        className={`absolute inset-0 w-full h-full object-cover pointer-events-none transition-opacity duration-700 ${
          shouldShowVideo ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        style={{
          visibility: resolvedSrc ? 'visible' : 'hidden',
        }}
      />
    </div>
  );
}

// Custom comparison function for React.memo to guarantee zero re-renders on ticket changes
function areBackgroundVideoPropsEqual(prevProps: BackgroundVideoProps, nextProps: BackgroundVideoProps) {
  return (
    prevProps.bgType === nextProps.bgType &&
    prevProps.bgVideo === nextProps.bgVideo &&
    prevProps.bgImage === nextProps.bgImage &&
    prevProps.standbyEnabled === nextProps.standbyEnabled &&
    prevProps.standbyDuration === nextProps.standbyDuration &&
    prevProps.standbyFit === nextProps.standbyFit &&
    prevProps.showStandbyOverlay === nextProps.showStandbyOverlay &&
    prevProps.isVisible === nextProps.isVisible &&
    JSON.stringify(prevProps.bgVideos) === JSON.stringify(nextProps.bgVideos) &&
    JSON.stringify(prevProps.standbyImages) === JSON.stringify(nextProps.standbyImages)
  );
}

export const BackgroundVideo = memo(BackgroundVideoComponent, areBackgroundVideoPropsEqual);
