// Self-defending patch to make window.fetch writable.
// Some third-party libraries (or testing polyfills) try to assign to window.fetch.
// In sandboxed iframe environments, window.fetch might be a read-only getter, which throws a TypeError.
try {
  if (typeof window !== 'undefined') {
    const desc = Object.getOwnPropertyDescriptor(window, 'fetch');
    if (desc && !desc.writable && desc.configurable) {
      const originalFetch = window.fetch;
      Object.defineProperty(window, 'fetch', {
        value: originalFetch,
        writable: true,
        configurable: true,
        enumerable: true
      });
    }
  }
} catch (e) {
  console.warn('Polyfill patch for window.fetch failed:', e);
}

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
