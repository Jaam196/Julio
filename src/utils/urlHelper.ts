/**
 * Sanitizes host/IP and constructs clean HTTP or WebSocket URLs.
 * Safely strips duplicate protocols (e.g. "http://http://...", "ws://https://...")
 */
export function buildCleanHost(ipOrHost: string | undefined): string {
  if (!ipOrHost) return typeof window !== 'undefined' ? window.location.host : '';
  
  const clean = ipOrHost
    .trim()
    .replace(/^wss?:\/\//i, '')
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '');
    
  return clean || (typeof window !== 'undefined' ? window.location.host : '');
}

export function buildApiUrl(ipOrHost: string | undefined, path: string): string {
  const cleanHost = buildCleanHost(ipOrHost);
  const protocol = typeof window !== 'undefined' ? window.location.protocol : 'http:';
  const cleanPath = path.startsWith('/') ? path : '/' + path;
  return `${protocol}//${cleanHost}${cleanPath}`;
}

export function buildWsUrl(ipOrHost: string | undefined): string {
  const cleanHost = buildCleanHost(ipOrHost);
  const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${cleanHost}`;
}
