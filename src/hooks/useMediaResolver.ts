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
          console.log(`[Media Cache Resolver] Real-time server update received for key: ${key}. Clearing cache to trigger re-download.`);
          const idbKey = 'media_' + key;
          await dbSaveSettings(idbKey, null); // Clear local cache to force download of newer version
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

    if (mediaKeyOrUrl.startsWith('indexeddb:')) {
      const key = mediaKeyOrUrl.substring(10); // e.g. "bg_video"
      const mode = localStorage.getItem('deviceMode');
      const idbKey = 'media_' + key;
      let active = true;
      let objectUrl: string | null = null;

      if (mode === 'client') {
        const ip = localStorage.getItem('serverIP') || window.location.host;
        const code = localStorage.getItem('pairedCode') || '';
        const httpUrl = buildApiUrl(ip, `/api/media/${code}/${key}`);

        const loadAndCacheClientMedia = async () => {
          try {
            // 1. Attempt to load from IndexedDB cache first
            const cached = await dbGetSettings<string | Blob>(idbKey);
            if (!active) return;

            if (cached) {
              console.log(`[Media Cache] TV playing cached file for key '${key}' locally (Offline Resilient)`);
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

            // 2. If not cached, fetch from server in background and save to IndexedDB
            console.log(`[Media Cache] Fetching media key '${key}' from server for the first time: ${httpUrl}`);
            const response = await fetch(httpUrl);
            if (!response.ok) {
              throw new Error(`Server returned HTTP ${response.status}`);
            }

            const blob = await response.blob();
            await dbSaveSettings(idbKey, blob);
            console.log(`[Media Cache] Successfully cached media key '${key}' in TV browser IndexedDB.`);

            if (active) {
              objectUrl = URL.createObjectURL(blob);
              setResolvedUrl(objectUrl);
            }
          } catch (err) {
            console.error(`[Media Cache Error] Failed to fetch/cache client media key '${key}'. Falling back to direct streaming URL:`, err);
            if (active) {
              setResolvedUrl(httpUrl);
            }
          }
        };

        loadAndCacheClientMedia();

        return () => {
          active = false;
          if (objectUrl) {
            URL.revokeObjectURL(objectUrl);
          }
        };
      }

      const loadFromDB = async () => {
        try {
          const stored = await dbGetSettings<string | Blob>(idbKey);
          if (!active) return;

          if (stored) {
            if (stored instanceof Blob) {
              objectUrl = URL.createObjectURL(stored);
              setResolvedUrl(objectUrl);
            } else if (typeof stored === 'string') {
              if (stored.startsWith('data:')) {
                // If it is a giant string, clear/avoid processing to prevent crash
                if (stored.length > 10 * 1024 * 1024) { // 10MB
                  console.warn(`[Media Limit] Media '${idbKey}' is stored as a giant base64 string (${(stored.length / 1024 / 1024).toFixed(1)}MB). Clearing to prevent browser crash.`);
                  await dbSaveSettings(idbKey, null);
                  if (onMediaMissing) onMediaMissing();
                  return;
                }
                try {
                  // Synchronous conversion to avoid sandbox restrictions on fetching data: URIs
                  const blob = dataURItoBlob(stored);
                  // Save as Blob to prevent parsing overhead next time!
                  await dbSaveSettings(idbKey, blob);
                  objectUrl = URL.createObjectURL(blob);
                  setResolvedUrl(objectUrl);
                } catch (err) {
                  console.warn('Fallback: could not convert dataURI to Blob synchronously. Using direct dataURI.', err);
                  setResolvedUrl(stored);
                }
              } else {
                setResolvedUrl(stored);
              }
            }
          } else {
            // Media is missing in local IndexedDB. Trigger callback so client can request it!
            if (onMediaMissing) {
              onMediaMissing();
            }
          }
        } catch (e) {
          console.error('Error loading media from IndexedDB:', e);
        }
      };

      loadFromDB();

      return () => {
        active = false;
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl);
        }
      };
    } else {
      // It's a URL or file path!
      let active = true;
      let objectUrl: string | null = null;
      
      const mode = localStorage.getItem('deviceMode');
      const ip = localStorage.getItem('serverIP') || window.location.host;
      
      // Determine correct URL
      let httpUrl = mediaKeyOrUrl;
      if (mediaKeyOrUrl.startsWith('/')) {
        if (mode === 'client') {
          // Point to PC Server
          httpUrl = buildApiUrl(ip, mediaKeyOrUrl);
        } else {
          // Local/Server mode
          httpUrl = `${window.location.origin}${mediaKeyOrUrl}`;
        }
      }

      // Generate a unique ID based on the URL or filename
      const urlCacheKey = 'url_cache_' + mediaKeyOrUrl.replace(/[^a-zA-Z0-9_-]/g, '_');

      const loadAndCacheUrlMedia = async () => {
        try {
          // 1. Check IndexedDB cache first
          const cached = await dbGetSettings<Blob>(urlCacheKey);
          if (!active) return;

          if (cached instanceof Blob) {
            console.log(`[Smart Cache] TV playing cached URL file: ${mediaKeyOrUrl}`);
            objectUrl = URL.createObjectURL(cached);
            setResolvedUrl(objectUrl);
            return;
          }

          // 2. Not cached yet. Resolve to direct HTTP URL first so it starts playing immediately
          console.log(`[Smart Cache] First time loading URL. Playing from network: ${httpUrl}`);
          setResolvedUrl(httpUrl);

          // 3. Download in background and cache it for future occasions
          const response = await fetch(httpUrl);
          if (!response.ok) {
            throw new Error(`Server returned HTTP ${response.status}`);
          }
          const blob = await response.blob();
          await dbSaveSettings(urlCacheKey, blob);
          console.log(`[Smart Cache] Cached URL successfully in IndexedDB: ${mediaKeyOrUrl} (${blob.size} bytes)`);

          // Update resolved URL to use the local cached object URL
          if (active) {
            if (objectUrl) {
              URL.revokeObjectURL(objectUrl);
            }
            objectUrl = URL.createObjectURL(blob);
            setResolvedUrl(objectUrl);
          }
        } catch (err) {
          console.warn(`[Smart Cache Error] Failed to cache URL: ${mediaKeyOrUrl}. Playing from network.`, err);
          if (active) {
            setResolvedUrl(httpUrl);
          }
        }
      };

      loadAndCacheUrlMedia();

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

