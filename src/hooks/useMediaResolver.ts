import { useState, useEffect } from 'react';
import { dbGetSettings, dbSaveSettings } from '../utils/db';
import { buildApiUrl } from '../utils/urlHelper';

// Helper to convert base64 dataURI to Blob synchronously and safely
function dataURItoBlob(dataURI: string): Blob {
  const parts = dataURI.split(',');
  const byteString = atob(parts[1]);
  const mimeString = parts[0].split(':')[1].split(';')[0];
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeString });
}

export function useMediaResolver(mediaKeyOrUrl: string | undefined, onMediaMissing?: () => void) {
  const [resolvedUrl, setResolvedUrl] = useState<string>('');
  const [version, setVersion] = useState<number>(0);

  useEffect(() => {
    // Listen for custom event when media is updated/synced from server
    const handleUpdate = async (e: Event) => {
      const customEvent = e as CustomEvent;
      if (mediaKeyOrUrl && mediaKeyOrUrl.startsWith('indexeddb:')) {
        const key = mediaKeyOrUrl.substring(10);
        if (customEvent.detail?.key === key) {
          console.log(`[Media Cache Resolver] Real-time server update received for key: ${key}. Clearing cache.`);
          const idbKey = 'media_' + key;
          await dbSaveSettings(idbKey, null);
          setVersion(v => v + 1);
        }
      }
    };

    window.addEventListener('media-updated', handleUpdate);
    return () => {
      window.removeEventListener('media-updated', handleUpdate);
    };
  }, [mediaKeyOrUrl]);

  useEffect(() => {
    if (!mediaKeyOrUrl) {
      setResolvedUrl('');
      return;
    }

    const ip = localStorage.getItem('serverIP') || window.location.host;
    const mode = localStorage.getItem('deviceMode') || 'client';
    const code = localStorage.getItem('pairedCode') || '';
    
    // Check if the media represents a video file
    const lower = mediaKeyOrUrl.toLowerCase();
    const isVideo = lower.includes('video') || 
                    lower.endsWith('.mp4') || 
                    lower.endsWith('.webm') || 
                    lower.endsWith('.mov') || 
                    lower.endsWith('.mkv') || 
                    lower.endsWith('.m4v');

    let active = true;
    let objectUrl: string | null = null;

    if (mediaKeyOrUrl.startsWith('indexeddb:')) {
      const key = mediaKeyOrUrl.substring(10); // e.g. "bg_video"
      const idbKey = 'media_' + key;

      // Smart TVs (Samsung Tizen, LG WebOS, Android TV) CANNOT play Blob URLs for HTML5 Video.
      // Video streams MUST use HTTP Range (206) URLs.
      if (isVideo) {
        const httpUrl = buildApiUrl(ip, `/api/media/${encodeURIComponent(code || 'default')}/${encodeURIComponent(key)}`);
        console.log(`[Media Streamer] Streaming video '${key}' via direct HTTP Range URL: ${httpUrl}`);
        setResolvedUrl(httpUrl);
        return;
      }

      // For Images, check local IndexedDB cache or fetch and store
      const loadAndCacheImage = async () => {
        try {
          const cached = await dbGetSettings<string | Blob>(idbKey);
          if (!active) return;

          if (cached) {
            if (cached instanceof Blob) {
              objectUrl = URL.createObjectURL(cached);
              setResolvedUrl(objectUrl);
            } else if (typeof cached === 'string') {
              if (cached.startsWith('data:')) {
                const blob = dataURItoBlob(cached);
                await dbSaveSettings(idbKey, blob);
                objectUrl = URL.createObjectURL(blob);
                setResolvedUrl(objectUrl);
              } else {
                setResolvedUrl(cached);
              }
            }
            return;
          }

          // If not in local DB and in client/TV mode, fetch from server
          if (mode === 'client') {
            const httpUrl = buildApiUrl(ip, `/api/media/${encodeURIComponent(code || 'default')}/${encodeURIComponent(key)}`);
            const response = await fetch(httpUrl);
            if (response.ok) {
              const blob = await response.blob();
              await dbSaveSettings(idbKey, blob);
              if (active) {
                objectUrl = URL.createObjectURL(blob);
                setResolvedUrl(objectUrl);
              }
            } else {
              if (onMediaMissing) onMediaMissing();
            }
          } else {
            if (onMediaMissing) onMediaMissing();
          }
        } catch (err) {
          console.error(`[Media Resolver] Error loading image '${key}':`, err);
        }
      };

      loadAndCacheImage();

      return () => {
        active = false;
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl);
        }
      };
    } else {
      // It's a static path or URL (e.g. /custom_bg_video_xxx.mp4 or https://...)
      let httpUrl = mediaKeyOrUrl;
      if (mediaKeyOrUrl.startsWith('/')) {
        httpUrl = buildApiUrl(ip, mediaKeyOrUrl);
      }

      // If video, ALWAYS use direct HTTP URL. Never convert to Blob URL on Smart TV!
      if (isVideo) {
        console.log(`[Media Streamer] Direct video streaming URL: ${httpUrl}`);
        setResolvedUrl(httpUrl);
        return;
      }

      // For Images, cache in IndexedDB for instant offline recovery
      const urlCacheKey = 'url_cache_' + mediaKeyOrUrl.replace(/[^a-zA-Z0-9_-]/g, '_');

      const loadAndCacheUrlImage = async () => {
        try {
          const cached = await dbGetSettings<Blob>(urlCacheKey);
          if (!active) return;

          if (cached instanceof Blob) {
            objectUrl = URL.createObjectURL(cached);
            setResolvedUrl(objectUrl);
            return;
          }

          setResolvedUrl(httpUrl);

          const response = await fetch(httpUrl);
          if (response.ok) {
            const blob = await response.blob();
            await dbSaveSettings(urlCacheKey, blob);
            if (active) {
              if (objectUrl) URL.revokeObjectURL(objectUrl);
              objectUrl = URL.createObjectURL(blob);
              setResolvedUrl(objectUrl);
            }
          }
        } catch (err) {
          if (active) setResolvedUrl(httpUrl);
        }
      };

      loadAndCacheUrlImage();

      return () => {
        active = false;
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl);
        }
      };
    }
  }, [mediaKeyOrUrl, version]);

  return resolvedUrl;
}
