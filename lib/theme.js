import { useColorScheme } from 'react-native';

const lightColors = {
  brand: '#8752FE',
  brandDark: '#6d3df2',
  brandLight: '#a78bfa',
  mint: '#1fc7aa',
  ink: '#1e2847',
  muted: '#6b7a9a',
  bg: '#f7f6ff',
  card: '#ffffff',
  border: '#e6dfff',
  success: '#047857',
  warning: '#b45309',
  error: '#991b1b',
  errorBg: 'rgba(255,80,80,0.06)',
  white: '#ffffff',
  inputBg: '#ffffff',
};

const darkColors = {
  brand: '#a78bfa',
  brandDark: '#8752FE',
  brandLight: '#c4b5fd',
  mint: '#34d399',
  ink: '#e2e8f0',
  muted: '#94a3b8',
  bg: '#0f172a',
  card: '#1e293b',
  border: '#334155',
  success: '#34d399',
  warning: '#fbbf24',
  error: '#f87171',
  errorBg: 'rgba(248,113,113,0.1)',
  white: '#ffffff',
  inputBg: '#1e293b',
};

export function useThemeColors() {
  const scheme = useColorScheme();
  return scheme === 'dark' ? darkColors : lightColors;
}

// Static fallback for non-hook contexts
export const colors = lightColors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const fontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 18,
  xl: 22,
  xxl: 28,
};
