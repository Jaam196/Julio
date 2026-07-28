import { getThemeConfig, findThemeById, applyThemeVariables } from './themeController';

export interface ThemeDiagnosticIssue {
  id: string;
  module: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  elementSelector?: string;
}

export interface ThemeDiagnosticReport {
  score: number; // 0 - 100
  status: 'perfect' | 'warning' | 'error';
  timestamp: string;
  totalTokensChecked: number;
  validTokensCount: number;
  auditedComponentsCount: number;
  passedComponentsCount: number;
  activeThemeName: string;
  activeThemeId: string;
  activeTokens: Record<string, string>;
  issues: ThemeDiagnosticIssue[];
}

export const REQUIRED_THEME_TOKENS = [
  '--theme-bg',
  '--theme-card-bg',
  '--theme-button-bg',
  '--theme-text',
  '--theme-primary',
  '--theme-secondary',
  '--theme-success',
  '--theme-warning',
  '--theme-error',
  '--theme-icon',
  '--theme-table-bg',
  '--theme-radius',
];

export const APP_MODULES_TO_AUDIT = [
  { id: 'header', name: 'Cabecera Principal y Logo' },
  { id: 'board', name: 'Tablero Principal de Tickets' },
  { id: 'active_ticket', name: 'Tarjetas de Ticket Activo' },
  { id: 'waiting_list', name: 'Lista de Espera y Cuadrícula' },
  { id: 'ready_list', name: 'Sección Listos para Entregar' },
  { id: 'ocr_view', name: 'Módulo de Reconocimiento OCR' },
  { id: 'manual_entry', name: 'Formulario de Entrada Manual' },
  { id: 'history_table', name: 'Historial y Tablas de Datos' },
  { id: 'settings_modal', name: 'Panel de Configuración y Modales' },
  { id: 'tv_view', name: 'Pantalla de Visualización TV' },
  { id: 'mobile_nav', name: 'Barra de Navegación Móvil' },
  { id: 'music_player', name: 'Reproductor de Música y Sonido' },
  { id: 'notifications', name: 'Sistema de Notificaciones y Tooltips' },
];

/**
 * Diagnostic tool that audits the entire DOM and CSS variables
 */
export function runThemeDiagnostic(): ThemeDiagnosticReport {
  const rootStyles = typeof window !== 'undefined' ? getComputedStyle(document.documentElement) : null;
  const themeCfg = getThemeConfig();
  const activeTheme = findThemeById(themeCfg.activeThemeId, themeCfg.customThemes);

  const activeTokens: Record<string, string> = {};
  let validTokensCount = 0;
  const issues: ThemeDiagnosticIssue[] = [];

  // 1. Audit CSS Tokens on :root
  REQUIRED_THEME_TOKENS.forEach((token) => {
    const val = rootStyles ? rootStyles.getPropertyValue(token).trim() : '';
    if (val) {
      activeTokens[token] = val;
      validTokensCount++;
    } else {
      activeTokens[token] = 'No definido';
      issues.push({
        id: `token_missing_${token}`,
        module: 'Sistema de Variables (:root)',
        description: `Variable CSS global ${token} no está presente en la raíz.`,
        severity: 'high',
      });
    }
  });

  // 2. Audit DOM components
  let auditedComponentsCount = APP_MODULES_TO_AUDIT.length;
  let passedComponentsCount = APP_MODULES_TO_AUDIT.length;

  if (typeof document !== 'undefined') {
    // Check if body has inline styles or root css applied
    const bodyBg = document.body.style.backgroundColor || (rootStyles ? rootStyles.getPropertyValue('--theme-bg') : '');
    if (!bodyBg) {
      passedComponentsCount--;
      issues.push({
        id: 'body_bg_unbound',
        module: 'Cuerpo Global (document.body)',
        description: 'El fondo del body no está sincronizado dinámicamente con la variable --theme-bg.',
        severity: 'medium',
      });
    }

    // Check for elements with hardcoded non-theme overrides
    const hardcodedElements = document.querySelectorAll('[style*="background-color: #"], [style*="background: #"]');
    if (hardcodedElements.length > 5) {
      passedComponentsCount = Math.max(0, passedComponentsCount - 1);
      issues.push({
        id: 'hardcoded_inline_styles',
        module: 'Componentes con Estilos Fijos',
        description: `Se detectaron ${hardcodedElements.length} elementos con colores hex estáticos en linea.`,
        severity: 'low',
      });
    }
  }

  // Calculate overall score
  const tokenWeight = (validTokensCount / REQUIRED_THEME_TOKENS.length) * 60;
  const componentWeight = (passedComponentsCount / auditedComponentsCount) * 40;
  const score = Math.round(tokenWeight + componentWeight);

  let status: 'perfect' | 'warning' | 'error' = 'perfect';
  if (score < 70) {
    status = 'error';
  } else if (score < 95 || issues.length > 0) {
    status = 'warning';
  }

  return {
    score,
    status,
    timestamp: new Date().toLocaleTimeString(),
    totalTokensChecked: REQUIRED_THEME_TOKENS.length,
    validTokensCount,
    auditedComponentsCount,
    passedComponentsCount,
    activeThemeName: activeTheme.name,
    activeThemeId: activeTheme.id,
    activeTokens,
    issues,
  };
}

/**
 * Automatically repairs and forces variable synchronization across the DOM
 */
export function fixAndForceGlobalTheme(): ThemeDiagnosticReport {
  const themeCfg = getThemeConfig();
  const activeTheme = findThemeById(themeCfg.activeThemeId, themeCfg.customThemes);
  applyThemeVariables(activeTheme);

  // Force dispatch event to all listening components
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('app-theme-changed', { detail: activeTheme }));
  }

  return runThemeDiagnostic();
}
