import { AppThemeConfig, CustomTheme, ThemeColors, ThemePreset, AppModuleName } from '../types/theme';
import { PRESET_THEMES } from '../data/presetThemes';

const CUSTOM_THEMES_KEY = 'app_custom_themes_v1';
const THEME_CONFIG_KEY = 'app_theme_config_v1';

export const DEFAULT_THEME_CONFIG: AppThemeConfig = {
  activeThemeId: 'dark-premium',
  customThemes: [],
  moduleThemes: {
    panel: 'dark-premium',
    tv: 'dark-premium',
    mobile: 'dark-premium',
    settings: 'dark-premium',
    ocr: 'dark-premium',
    history: 'dark-premium',
  },
  autoSchedule: {
    enabled: false,
    mode: 'schedule',
    dayThemeId: 'light-premium',
    nightThemeId: 'dark-premium',
    startHour: 8,
    endHour: 20,
  },
};

export function getCustomThemes(): CustomTheme[] {
  try {
    const raw = localStorage.getItem(CUSTOM_THEMES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to load custom themes from localStorage', e);
    return [];
  }
}

export function saveCustomThemes(themes: CustomTheme[]) {
  try {
    localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(themes));
  } catch (e) {
    console.error('Failed to save custom themes to localStorage', e);
  }
}

export function getThemeConfig(): AppThemeConfig {
  try {
    const raw = localStorage.getItem(THEME_CONFIG_KEY);
    const customThemes = getCustomThemes();
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_THEME_CONFIG,
        ...parsed,
        customThemes,
      };
    }
  } catch (e) {
    console.error('Failed to load theme config', e);
  }
  return { ...DEFAULT_THEME_CONFIG, customThemes: getCustomThemes() };
}

export function saveThemeConfig(config: AppThemeConfig) {
  try {
    const { customThemes, ...rest } = config;
    localStorage.setItem(THEME_CONFIG_KEY, JSON.stringify(rest));
    saveCustomThemes(customThemes);
  } catch (e) {
    console.error('Failed to save theme config', e);
  }
}

export function getAllThemes(customThemes: CustomTheme[]): ThemePreset[] {
  return [...PRESET_THEMES, ...customThemes];
}

export function findThemeById(id: string, customThemes: CustomTheme[] = []): ThemePreset {
  const all = getAllThemes(customThemes);
  return all.find((t) => t.id === id) || PRESET_THEMES[0];
}

export function applyThemeVariables(theme: ThemePreset, element: HTMLElement = document.documentElement) {
  if (!theme || !theme.colors) return;
  const { colors, advanced, designStyle = 'material' } = theme;

  // Set design style attribute on both documentElement and body for CSS targeting
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-design-theme', designStyle);
    if (document.body) {
      document.body.setAttribute('data-design-theme', designStyle);
    }
  }

  // Derive smart defaults for rich theme attributes if not explicitly defined
  const bgGradient = colors.bgGradient || `radial-gradient(ellipse 120% 80% at 50% -20%, ${colors.primary}22, ${colors.bg} 85%)`;
  const cardBorder = colors.cardBorder || `${colors.primary}30`;
  const buttonGradient = colors.buttonGradient || `linear-gradient(135deg, ${colors.buttonBg}, ${colors.primary})`;
  const headerBg = colors.headerBg || `${colors.bg}ee`;
  const glowColor = colors.glowColor || `${colors.primary}40`;
  const textMuted = colors.textMuted || `${colors.text}88`;
  const inputBg = colors.inputBg || colors.cardBg;
  const cardHoverBg = colors.cardHoverBg || colors.cardBg;

  // Apply CSS Custom Properties
  element.style.setProperty('--theme-primary', colors.primary);
  element.style.setProperty('--theme-secondary', colors.secondary);
  element.style.setProperty('--theme-success', colors.success);
  element.style.setProperty('--theme-warning', colors.warning);
  element.style.setProperty('--theme-error', colors.error);
  element.style.setProperty('--theme-bg', colors.bg);
  element.style.setProperty('--theme-bg-gradient', bgGradient);
  element.style.setProperty('--theme-card-bg', colors.cardBg);
  element.style.setProperty('--theme-card-hover-bg', cardHoverBg);
  element.style.setProperty('--theme-card-border', cardBorder);
  element.style.setProperty('--theme-button-bg', colors.buttonBg);
  element.style.setProperty('--theme-button-gradient', buttonGradient);
  element.style.setProperty('--theme-header-bg', headerBg);
  element.style.setProperty('--theme-glow-color', glowColor);
  element.style.setProperty('--theme-text', colors.text);
  element.style.setProperty('--theme-text-muted', textMuted);
  element.style.setProperty('--theme-icon', colors.icon);
  element.style.setProperty('--theme-table-bg', colors.tableBg);
  element.style.setProperty('--theme-input-bg', inputBg);

  // Directly set body inline style so background and text adapt instantly across whole app
  if (typeof document !== 'undefined' && document.body) {
    document.body.style.backgroundColor = colors.bg;
    document.body.style.backgroundImage = bgGradient;
    document.body.style.backgroundAttachment = 'fixed';
    document.body.style.color = colors.text;
  }

  // Advanced CSS Properties
  const radiusMap: Record<string, string> = {
    none: '0px',
    sm: '6px',
    md: '12px',
    lg: '16px',
    full: '9999px',
  };
  element.style.setProperty('--theme-radius', radiusMap[advanced?.borderRadius] || '16px');

  if (advanced?.fontFamily) {
    element.style.setProperty('--theme-font-family', advanced.fontFamily);
  } else {
    element.style.removeProperty('--theme-font-family');
  }

  if (advanced?.glassmorphism) {
    element.style.setProperty('--theme-glass-blur', `${advanced.glassBlur || 16}px`);
  } else {
    element.style.setProperty('--theme-glass-blur', '0px');
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('app-theme-changed', { detail: theme }));
  }
}

export function getEffectiveModuleTheme(
  module: AppModuleName,
  config: AppThemeConfig
): ThemePreset {
  // Check auto schedule
  if (config.autoSchedule.enabled) {
    const now = new Date();
    const currentHour = now.getHours();

    if (config.autoSchedule.mode === 'system') {
      const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      const targetId = isDark ? config.autoSchedule.nightThemeId : config.autoSchedule.dayThemeId;
      return findThemeById(targetId, config.customThemes);
    } else if (config.autoSchedule.mode === 'schedule') {
      const isDay = currentHour >= config.autoSchedule.startHour && currentHour < config.autoSchedule.endHour;
      const targetId = isDay ? config.autoSchedule.dayThemeId : config.autoSchedule.nightThemeId;
      return findThemeById(targetId, config.customThemes);
    }
  }

  // Module specific or fallback activeThemeId
  const moduleThemeId = config.moduleThemes[module] || config.activeThemeId;
  return findThemeById(moduleThemeId, config.customThemes);
}

export function exportThemeToJSON(theme: ThemePreset): string {
  return JSON.stringify(theme, null, 2);
}

export function importThemeFromJSON(jsonString: string): CustomTheme | null {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed.name || !parsed.colors) {
      throw new Error('Formato de tema inválido');
    }
    const newTheme: CustomTheme = {
      id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: parsed.name + ' (Importado)',
      description: parsed.description || 'Tema personalizado importado.',
      category: parsed.category || 'dark',
      designStyle: parsed.designStyle || 'material',
      colors: {
        primary: parsed.colors.primary || '#6366f1',
        secondary: parsed.colors.secondary || '#38bdf8',
        success: parsed.colors.success || '#10b981',
        warning: parsed.colors.warning || '#f59e0b',
        error: parsed.colors.error || '#ef4444',
        bg: parsed.colors.bg || '#0f172a',
        cardBg: parsed.colors.cardBg || '#1e293b',
        buttonBg: parsed.colors.buttonBg || '#4f46e5',
        text: parsed.colors.text || '#f8fafc',
        icon: parsed.colors.icon || '#818cf8',
        tableBg: parsed.colors.tableBg || '#020617',
      },
      advanced: parsed.advanced || {
        borderRadius: 'lg',
        buttonSize: 'md',
        fontSize: 'md',
        spacing: 'normal',
        shadow: 'medium',
        glassmorphism: false,
        glassBlur: 12,
        animationIntensity: 'normal',
        transitionDuration: 'normal',
      },
      isCustom: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    return newTheme;
  } catch (e) {
    console.error('Error al importar tema', e);
    return null;
  }
}
