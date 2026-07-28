import { ShortcutConfig } from '../types';

export const SHORTCUT_NAMES: Record<keyof ShortcutConfig, string> = {
  callNext: 'Rotar ticket activo',
  markDelivered: 'Entregar ticket activo',
  markMissing: 'Desaparecer ticket activo',
  focusInput: 'Enfocar entrada rápida',
  pauseResumeOcr: 'Pausar/Reanudar OCR',
  activateSelected: 'Enviar a Ticket Activo',
  pauseResumeWaitlist: 'Pausar/Reanudar Lista de Espera'
};

/**
 * Formats a key event into a standardized, readable string representation.
 * Supports modifiers like Ctrl, Shift, Alt, Meta and special keys.
 */
export function formatKeyEventString(e: {
  key: string;
  code: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
}): string {
  const parts: string[] = [];
  
  if (e.ctrlKey) parts.push('Ctrl');
  if (e.shiftKey) parts.push('Shift');
  if (e.altKey) parts.push('Alt');
  if (e.metaKey) parts.push('Meta');

  let keyName = e.key;

  // Handle special keys
  if (keyName === ' ') {
    keyName = 'Espacio';
  } else if (keyName === 'Control' || keyName === 'Shift' || keyName === 'Alt' || keyName === 'Meta') {
    // If only modifier is pressed, don't output keyName to avoid "Ctrl+Control"
    keyName = '';
  } else if (keyName === 'ArrowUp') {
    keyName = 'Arriba';
  } else if (keyName === 'ArrowDown') {
    keyName = 'Abajo';
  } else if (keyName === 'ArrowLeft') {
    keyName = 'Izquierda';
  } else if (keyName === 'ArrowRight') {
    keyName = 'Derecha';
  } else if (keyName === 'Delete') {
    keyName = 'Supr';
  } else if (keyName === 'Backspace') {
    keyName = 'Retroceso';
  } else if (keyName === 'Tab') {
    keyName = 'Tab';
  } else if (keyName === 'Home') {
    keyName = 'Inicio';
  } else if (keyName === 'End') {
    keyName = 'Fin';
  } else if (keyName === 'PageUp') {
    keyName = 'RePág';
  } else if (keyName === 'PageDown') {
    keyName = 'AvPág';
  } else if (keyName === 'Insert') {
    keyName = 'Insert';
  } else if (keyName === 'Escape') {
    keyName = 'Escape';
  } else if (keyName === 'Enter') {
    keyName = 'Enter';
  }

  // If there's a character and we have modifiers, uppercase it to look standard (e.g. "Ctrl+A")
  if (keyName && keyName.length === 1) {
    keyName = keyName.toUpperCase();
  }

  if (keyName) {
    parts.push(keyName);
  }

  // If we only have modifiers pressed (e.g. just Ctrl), return it alone
  if (parts.length === 0) {
    if (e.ctrlKey) return 'Ctrl';
    if (e.shiftKey) return 'Shift';
    if (e.altKey) return 'Alt';
    if (e.metaKey) return 'Meta';
    return '';
  }

  return parts.join('+');
}

/**
 * Checks if a keydown event matches a configured shortcut string value.
 * Supports legacy formats (like 'Space', 'KeyD', 'KeyM', 'Escape', 'KeyP') as well as new combos.
 */
export function matchesShortcut(e: KeyboardEvent, configVal: string): boolean {
  if (!configVal) return false;

  // Format current event in our standard format
  const currentFormatted = formatKeyEventString(e);
  if (currentFormatted.toLowerCase() === configVal.toLowerCase()) {
    return true;
  }

  // Legacy compatibility fallbacks (e.g. Space, Enter, Escape, KeyD, KeyM, KeyP)
  const normConfig = configVal.toLowerCase();
  const pressedCode = e.code;
  const pressedKey = e.key;

  const codeMatch = pressedCode && pressedCode.toLowerCase() === normConfig;
  const keyMatch = pressedKey && pressedKey.toLowerCase() === normConfig;

  let keyCharMatch = false;
  if (normConfig.startsWith('key') && normConfig.length === 4) {
    const char = normConfig.charAt(3);
    keyCharMatch = pressedKey && pressedKey.toLowerCase() === char;
  } else if (normConfig.startsWith('digit') && normConfig.length === 6) {
    const char = normConfig.charAt(5);
    keyCharMatch = pressedKey && pressedKey.toLowerCase() === char;
  }

  const spaceMatch = (normConfig === 'space' || normConfig === 'espacio') && (pressedKey === ' ' || pressedCode === 'Space');
  const enterMatch = normConfig === 'enter' && (pressedKey === 'Enter' || pressedCode === 'Enter');
  const escapeMatch = normConfig === 'escape' && (pressedKey === 'Escape' || pressedCode === 'Escape');

  return codeMatch || keyMatch || keyCharMatch || spaceMatch || enterMatch || escapeMatch;
}

/**
 * Determines whether a keyboard shortcut should be processed given the currently focused element.
 * We want shortcuts to work everywhere, EXCEPT simple un-modified keys (letters, numbers, space, enter)
 * when typing inside a text field, select, or textarea.
 */
export function shouldProcessShortcut(e: KeyboardEvent, configVal: string): boolean {
  const target = e.target as HTMLElement;

  // Custom: The fast ticket input must NEVER block shortcuts!
  if (target && target.id === 'fast-ticket-input') {
    return true;
  }

  const isTextInput = 
    target && (
      target.tagName === 'INPUT' || 
      target.tagName === 'TEXTAREA' || 
      target.getAttribute('contenteditable') === 'true'
    );

  if (!isTextInput) {
    return true;
  }

  // If focused on an input/textarea, we only allow:
  // 1. Combos with modifiers (Ctrl, Alt, Meta)
  // 2. Special keys like F1-F12, Escape, Tab
  if (e.ctrlKey || e.altKey || e.metaKey) {
    return true;
  }

  // F-keys and Escape are allowed even inside inputs
  if (/^F\d+$/.test(e.key) || e.key === 'Escape') {
    return true;
  }

  // If it's a simple key and we are typing inside an input, do not intercept
  return false;
}
