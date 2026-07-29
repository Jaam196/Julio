import React from 'react';
import { useMediaResolver } from '../hooks/useMediaResolver';

export interface ResolvedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  mediaKeyOrUrl: string | undefined;
  onMediaMissing?: () => void;
  [key: string]: any;
}

export function ResolvedImage({ mediaKeyOrUrl, onMediaMissing, ...props }: ResolvedImageProps) {
  const src = useMediaResolver(mediaKeyOrUrl, onMediaMissing);
  if (!src) return null;
  return <img src={src} {...props} />;
}

export interface ResolvedVideoProps extends React.VideoHTMLAttributes<HTMLVideoElement> {
  mediaKeyOrUrl: string | undefined;
  onMediaMissing?: () => void;
  [key: string]: any;
}

export function ResolvedVideo({ mediaKeyOrUrl, onMediaMissing, className = '', style, ...props }: ResolvedVideoProps) {
  const src = useMediaResolver(mediaKeyOrUrl, onMediaMissing);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = React.useState(false);
  const [transcodeStage, setTranscodeStage] = React.useState(0);
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [lastError, setLastError] = React.useState<string | null>(null);

  const shouldLoop = props.loop !== false;

  // Emit a global diagnostic event so any monitor overlay can show it in real-time
  const dispatchDiagnostic = React.useCallback((event: string, extra = {}) => {
    if (typeof window === 'undefined' || !src) return;
    const video = videoRef.current;
    
    const detail = {
      event,
      src,
      mediaKeyOrUrl,
      isLoaded,
      readyState: video ? video.readyState : 0,
      paused: video ? video.paused : true,
      loop: video ? video.loop : shouldLoop,
      muted: video ? video.muted : true,
      currentTime: video ? video.currentTime : 0,
      duration: video ? video.duration : 0,
      error: lastError,
      timestamp: new Date().toLocaleTimeString(),
      ...extra
    };

    window.dispatchEvent(new CustomEvent('resolved-video-diagnostic', { detail }));
  }, [src, mediaKeyOrUrl, isLoaded, lastError]);

  // Validate codec and format capability
  const performPreflightChecks = (url: string): { canPlay: boolean; reason?: string } => {
    if (typeof document === 'undefined') return { canPlay: true };
    const tempVideo = document.createElement('video');
    
    // Check general MP4 support
    const canPlayMp4 = tempVideo.canPlayType('video/mp4');
    if (canPlayMp4 === '') {
      return { canPlay: false, reason: "Navegador no soporta contenedor MP4" };
    }

    // Check Tizen-specific codec compatibility (AVC / H.264 Main or Baseline profile)
    const canPlayH264 = tempVideo.canPlayType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"'); // H.264 Baseline, AAC-LC
    const canPlayH264Main = tempVideo.canPlayType('video/mp4; codecs="avc1.4D401E, mp4a.40.2"'); // H.264 Main, AAC-LC

    if (canPlayH264 === '' && canPlayH264Main === '') {
      return { canPlay: false, reason: "Navegador no soporta códecs H.264 AVC / AAC-LC" };
    }

    return { canPlay: true };
  };

  const triggerStepByStepFallback = async () => {
    if (isUpdating || !mediaKeyOrUrl || !mediaKeyOrUrl.startsWith('indexeddb:')) return;
    
    const key = mediaKeyOrUrl.substring(10);
    const roomCode = localStorage.getItem('pairedCode') || '';
    if (!roomCode) return;

    const nextStage = transcodeStage + 1;
    if (nextStage > 3) {
      const errMsg = "Maximum transcode recovery stages reached. Playback not possible.";
      console.error("[Tizen Recovery]", errMsg);
      setLastError(errMsg);
      dispatchDiagnostic('error-max-stages', { error: errMsg });
      return;
    }

    try {
      setIsUpdating(true);
      const warnMsg = `Playback failed or check rejected. Triggering transcoding Stage ${nextStage} for key '${key}'...`;
      console.warn(`[Tizen Recovery] ${warnMsg}`);
      setLastError(`Recuperando (Etapa ${nextStage})...`);
      dispatchDiagnostic('transcode-stage-trigger', { stage: nextStage });
      
      const response = await fetch(`/api/media/re-transcode/${roomCode}/${key}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ stage: nextStage })
      });

      if (response.ok) {
        console.log(`[Tizen Recovery] Stage ${nextStage} transcode completed successfully!`);
        setTranscodeStage(nextStage);
        setLastError(null);
      } else {
        const errorText = `Failed response on stage ${nextStage} transcode.`;
        console.error(`[Tizen Recovery] ${errorText}`);
        setLastError(errorText);
      }
    } catch (err: any) {
      console.error("[Tizen Recovery] Network or server error during recovery transcode:", err);
      setLastError(err?.message || "Error de red en transcodificación");
    } finally {
      setIsUpdating(false);
    }
  };

  React.useEffect(() => {
    setIsLoaded(false); // Reset when src changes
    setHasLoadedOnce(false); // Reset so new video can load cleanly
    setLastError(null);
    if (videoRef.current) {
      if (videoRef.current.readyState >= 1) {
        setIsLoaded(true);
        setHasLoadedOnce(true);
      }
    }
    dispatchDiagnostic('src-changed');
  }, [src]);

  // Periodic recovery check to ensure video is always playing
  React.useEffect(() => {
    let intervalId: any = null;
    
    if (src) {
      intervalId = setInterval(() => {
        const video = videoRef.current;
        if (video) {
          // Explicitly re-enforce muted & loops directly on the element
          video.muted = true;
          video.loop = shouldLoop;
          
          // If the video is paused, ended, or has 0 playback speed but should be playing, play it!
          if (video.paused && !video.seeking) {
            console.log("[Tizen Keeper] Video was paused or stopped. Forcing play...");
            video.play()
              .then(() => {
                setLastError(null);
                dispatchDiagnostic('keeper-resume-success');
              })
              .catch(err => {
                console.warn("[Tizen Keeper] Failed to auto-resume on check:", err);
                dispatchDiagnostic('keeper-resume-failed', { error: err.message });
              });
          } else {
            // Periodic update to keep diagnostics current
            dispatchDiagnostic('periodic-check');
          }
        }
      }, 1500);
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [src, dispatchDiagnostic]);

  React.useEffect(() => {
    if (src && videoRef.current) {
      const video = videoRef.current;
      
      // Perform preflight JavaScript capability check
      const checks = performPreflightChecks(src);
      if (!checks.canPlay) {
        console.warn(`[Preflight Warning] ${checks.reason}`);
        dispatchDiagnostic('preflight-warning', { reason: checks.reason });
      }

      // Explicitly set muted and attributes to bypass autoplay blocking policies on all browsers (TVs, tablets, PCs)
      video.muted = true;
      video.defaultMuted = true;
      video.loop = shouldLoop;
      video.setAttribute('muted', '');
      if (shouldLoop) {
        video.setAttribute('loop', 'true');
      } else {
        video.removeAttribute('loop');
      }
      video.setAttribute('playsinline', 'true');
      video.setAttribute('webkit-playsinline', 'true');
      
      video.load(); // Force source reload
      dispatchDiagnostic('load-called');
      
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          setIsLoaded(true); // Successfully playing means loaded!
          setHasLoadedOnce(true);
          setLastError(null);
          dispatchDiagnostic('play-promise-resolved');
        }).catch((error) => {
          console.warn("Autoplay was prevented, retrying on user click/interaction:", error);
          setLastError(`Autoplay bloqueado. Toque la pantalla o use el PC.`);
          dispatchDiagnostic('play-promise-rejected', { error: error.message });
          
          // Register fallback play trigger on document interaction
          const handleInteraction = () => {
            video.muted = true;
            video.play()
              .then(() => {
                setIsLoaded(true);
                setHasLoadedOnce(true);
                setLastError(null);
                dispatchDiagnostic('interaction-play-success');
              })
              .catch(e => {
                console.error("Play failed after interaction:", e);
                dispatchDiagnostic('interaction-play-failed', { error: e.message });
              });
            document.removeEventListener('click', handleInteraction);
            document.removeEventListener('keydown', handleInteraction);
          };
          document.addEventListener('click', handleInteraction);
          document.addEventListener('keydown', handleInteraction);
        });
      }
    }
  }, [src]);

  if (!src) return null;

  return (
    <video
      ref={videoRef}
      key={src}
      src={src}
      preload="auto"
      autoPlay
      muted
      loop={shouldLoop}
      playsInline
      onCanPlay={() => {
        setIsLoaded(true);
        setHasLoadedOnce(true);
        dispatchDiagnostic('oncanplay');
      }}
      onLoadedData={() => {
        setIsLoaded(true);
        setHasLoadedOnce(true);
        dispatchDiagnostic('onloadeddata');
      }}
      onLoadedMetadata={() => {
        setIsLoaded(true);
        setHasLoadedOnce(true);
        dispatchDiagnostic('onloadedmetadata');
      }}
      onPlay={() => {
        setIsLoaded(true);
        setHasLoadedOnce(true);
        dispatchDiagnostic('onplay');
      }}
      onPause={(e) => {
        // Automatically restart if paused and supposed to loop
        if (!shouldLoop) return;
        const video = e.currentTarget;
        video.muted = true;
        dispatchDiagnostic('onpause');
        video.play()
          .then(() => {
            setLastError(null);
          })
          .catch(err => {
            console.error("Error auto-resuming video on pause:", err);
            setLastError(`Pausado de forma externa: ${err.message}`);
          });
      }}
      onEnded={(e) => {
        dispatchDiagnostic('onended');
        if (props.onEnded) {
          props.onEnded(e);
          return;
        }
        if (shouldLoop) {
          const video = e.currentTarget;
          video.muted = true;
          video.play()
            .then(() => {
              setLastError(null);
            })
            .catch(err => {
              console.error("Error restarting video on end:", err);
              setLastError(`Bucle falló: ${err.message}`);
            });
        }
      }}
      onError={(e) => {
        const video = e.currentTarget;
        const errorCode = video.error?.code;
        let errorMsg = video.error?.message || "Error desconocido de reproducción de HTML5 Video";
        if (errorCode === 1) errorMsg = "Carga de vídeo abortada por el usuario o navegador.";
        if (errorCode === 2) errorMsg = "Error de red durante la descarga del vídeo.";
        if (errorCode === 3) errorMsg = "Error al decodificar: formato/códecs no soportados por el hardware de esta TV.";
        if (errorCode === 4) errorMsg = "El archivo de vídeo no existe o no es accesible por la TV.";
        
        console.warn(`Video playback error detected on Tizen browser! Code: ${errorCode}. Message: ${errorMsg}`);
        setLastError(errorMsg);
        dispatchDiagnostic('onerror', { errorCode, errorMsg });
        
        // Trigger progressive transcoding healing pipeline...
        triggerStepByStepFallback();
        
        // Indefinite automatic retry loader
        setTimeout(() => {
          if (videoRef.current) {
            console.log("[Tizen Recovery] Retrying video load and play after error...");
            videoRef.current.load();
            videoRef.current.play()
              .then(() => {
                setLastError(null);
              })
              .catch(err => console.error("Error retrying video load:", err));
          }
        }, 3000);
      }}
      className={`${className} transition-opacity duration-500`}
      style={{
        ...style,
        opacity: (isLoaded || hasLoadedOnce) ? undefined : 0
      }}
      {...props}
    />
  );
}

