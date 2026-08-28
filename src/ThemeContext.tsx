import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface ThemeColors {
  // Backgrounds
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  bgHeader: string;
  bgLegend: string;
  
  // Text
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  
  // Borders
  borderPrimary: string;
  borderSecondary: string;
  
  // Event type colors
  Corridors: string;
  Signals: string;
  Touchs: string;
  Risks: string;
  Tactics: string;
  Deals: string;
  
  // Accent
  accent: string;
  accentHover: string;
  
  // Chart elements
  gridLine: string;
  rowLine: string;
  arrowColor: string;
  
  // Tooltip
  tooltipBg: string;
  tooltipText: string;
  
  // Interactive
  hoverHighlight: string;
  selectedHighlight: string;
  [key: string]: string;
}

const lightTheme: ThemeColors = {
  bgPrimary: '#ffffff',
  bgSecondary: '#f8fafc',
  bgTertiary: '#f1f5f9',
  bgHeader: '#f1f5f9',
  bgLegend: '#f8fafc',
  
  textPrimary: '#1e293b',
  textSecondary: '#475569',
  textMuted: '#94a3b8',
  
  borderPrimary: '#e2e8f0',
  borderSecondary: '#cbd5e1',
  
  Corridors: '#2563eb',
  Signals: '#eab308',
  Touchs: '#dc2626',
  Risks: '#f97316',
  Tactics: '#8b5cf6',
  Deals: '#22c55e',
  
  accent: '#3b82f6',
  accentHover: '#2563eb',
  
  gridLine: '#e9edf2',
  rowLine: '#f1f5f9',
  arrowColor: '#94a3b8',
  
  tooltipBg: '#0f172a',
  tooltipText: '#f1f5f9',
  
  hoverHighlight: '#000000',
  selectedHighlight: '#000000',
};

const darkTheme: ThemeColors = {
  bgPrimary: '#0a0f1a',
  bgSecondary: '#0f1629',
  bgTertiary: '#1a2332',
  bgHeader: '#0f1629',
  bgLegend: '#0f1629',
  
  textPrimary: '#e8eaed',
  textSecondary: '#b8c1cf',
  textMuted: '#6b7a8d',
  
  borderPrimary: '#2d3f50',
  borderSecondary: '#3d5060',
  
  Corridors: '#4a9eff',
  Signals: '#ffd93d',
  Touchs: '#ff6b6b',
  Risks: '#ff9f43',
  Tactics: '#a885e8',
  Deals: '#51cf66',
  
  accent: '#4a9eff',
  accentHover: '#1d8bf8',
  
  gridLine: '#15202d',
  rowLine: '#15202d',
  arrowColor: '#4a6080',
  
  tooltipBg: '#000000',
  tooltipText: '#ffffff',
  
  hoverHighlight: '#ffffff',
  selectedHighlight: '#4a9eff',
};

type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  mode: ThemeMode;
  colors: ThemeColors;
  toggleMode: () => void;
  updateColor: (key: keyof ThemeColors, value: string) => void;
  resetToDefaults: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [mode, setMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('theme-mode');
    return (saved as ThemeMode) || 'light';
  });

  const [colors, setColors] = useState<ThemeColors>(() => {
    const saved = localStorage.getItem('theme-colors');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...(mode === 'light' ? lightTheme : darkTheme), ...parsed };
      } catch {}
    }
    return mode === 'light' ? lightTheme : darkTheme;
  });

  const applyThemeToDocument = (colors: ThemeColors) => {
    const root = document.documentElement;
    
    Object.entries(colors).forEach(([key, value]) => {
      let varName = key;
      // Convert camelCase to kebab-case
      if (/[A-Z]/.test(key)) {
        varName = key.replace(/[A-Z]/g, m => '-' + m.toLowerCase());
      }
      root.style.setProperty(`--${varName}`, value);
    });
    
    document.documentElement.setAttribute('data-theme', mode);
  };

  useEffect(() => {
    applyThemeToDocument(colors);
    localStorage.setItem('theme-mode', mode);
    localStorage.setItem('theme-colors', JSON.stringify(colors));
  }, [mode, colors]);

  const toggleMode = () => {
    const newMode = mode === 'light' ? 'dark' : 'light';
    setMode(newMode);
    setColors(newMode === 'light' ? lightTheme : darkTheme);
  };

  const updateColor = (key: keyof ThemeColors, value: string) => {
    setColors(prev => ({ ...prev, [key]: value }));
  };

  const resetToDefaults = () => {
    setColors(mode === 'light' ? lightTheme : darkTheme);
  };

  return (
    <ThemeContext.Provider value={{ mode, colors, toggleMode, updateColor, resetToDefaults }}>
      {children}
    </ThemeContext.Provider>
  );
};

export { lightTheme, darkTheme };
