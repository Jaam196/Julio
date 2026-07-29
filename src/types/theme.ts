export type DesignStyle = 
  | 'material'
  | 'ios'
  | 'windows11'
  | 'oneui'
  | 'minimal'
  | 'pro-dark'
  | 'futuristic'
  | 'glass'
  | 'neumorphism'
  | 'industrial'
  | 'gaming-rgb'
  | 'retro';

export interface ThemeColors {
  primary: string;
  secondary: string;
  success: string;
  warning: string;
  error: string;
  bg: string;
  cardBg: string;
  buttonBg: string;
  text: string;
  icon: string;
  tableBg: string;
  // Enhanced theme styling tokens
  bgGradient?: string;
  cardBorder?: string;
  buttonGradient?: string;
  headerBg?: string;
  glowColor?: string;
  textMuted?: string;
  cardHoverBg?: string;
  inputBg?: string;
  sidebarBg?: string;
}

export interface ThemeAdvanced {
  borderRadius: 'none' | 'sm' | 'md' | 'lg' | 'full'; // '0px', '4px', '8px', '16px', '9999px'
  buttonSize: 'sm' | 'md' | 'lg';
  fontSize: 'sm' | 'md' | 'lg';
  spacing: 'compact' | 'normal' | 'relaxed';
  shadow: 'none' | 'subtle' | 'medium' | 'glow' | 'neumorphic' | 'retro3d';
  glassmorphism: boolean;
  glassBlur: number; // in px, e.g. 12
  animationIntensity: 'none' | 'subtle' | 'normal' | 'high';
  transitionDuration: 'fast' | 'normal' | 'slow';
  fontFamily?: string;
}

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  category: 'dark' | 'light' | 'neon' | 'glass' | 'corporate' | 'vibrant' | 'system' | 'retro' | 'industrial';
  designStyle: DesignStyle;
  colors: ThemeColors;
  advanced: ThemeAdvanced;
  isCustom?: boolean;
  author?: string;
}

export type AppModuleName = 'panel' | 'tv' | 'mobile' | 'settings' | 'ocr' | 'history';

export type ModuleThemes = Record<AppModuleName, string>; // Maps module -> theme preset ID or custom theme ID

export interface AutoThemeSchedule {
  enabled: boolean;
  mode: 'schedule' | 'system' | 'daynight';
  dayThemeId: string; // Theme ID for daytime / light
  nightThemeId: string; // Theme ID for nighttime / dark
  startHour: number; // e.g. 7 (07:00)
  endHour: number; // e.g. 20 (20:00)
}

export interface CustomTheme extends ThemePreset {
  createdAt: number;
  updatedAt: number;
}

export interface AppThemeConfig {
  activeThemeId: string;
  customThemes: CustomTheme[];
  moduleThemes: ModuleThemes;
  autoSchedule: AutoThemeSchedule;
  overrides?: Partial<ThemeColors>;
  advancedOverrides?: Partial<ThemeAdvanced>;
}
