import { useColorScheme } from 'react-native';

export interface ThemeColors {
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  primary: string;
  error: string;
  success: string;
  warning: string;
  placeholder: string;
  cardBackground: string;
  shadow: string;
}

const lightColors: ThemeColors = {
  background: '#f5f5f5',
  surface: '#ffffff',
  text: '#333333',
  textSecondary: '#666666',
  border: '#e0e0e0',
  primary: '#007AFF',
  error: '#F44336',
  success: '#4CAF50',
  warning: '#FF9800',
  placeholder: '#999999',
  cardBackground: '#ffffff',
  shadow: '#000000',
};

const darkColors: ThemeColors = {
  background: '#121212',
  surface: '#1e1e1e',
  text: '#ffffff',
  textSecondary: '#b0b0b0',
  border: '#333333',
  primary: '#0a84ff',
  error: '#ff453a',
  success: '#30d158',
  warning: '#ff9f0a',
  placeholder: '#666666',
  cardBackground: '#2c2c2e',
  shadow: '#000000',
};

export function useTheme() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  return {
    colors: isDark ? darkColors : lightColors,
    isDark,
    colorScheme: colorScheme || 'light',
  };
}

export function getThemeColors(isDark: boolean): ThemeColors {
  return isDark ? darkColors : lightColors;
}

