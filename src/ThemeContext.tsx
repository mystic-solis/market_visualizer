// src/ThemeContext.tsx
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
  [key: string]: string; // Allow dynamic access
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
  bgPrimary: '#0f172a',
  bgSecondary: '#1e293b',
  bgTertiary: '#334155',
  bgHeader: '#1e293b',
  bgLegend: '#1e293b',
  
  textPrimary: '#f1f5f9',
  textSecondary: '#cbd5e1',
  textMuted: '#64748b',
  
  borderPrimary: '#334155',
  borderSecondary: '#475569',
  
  Corridors: '#3b82f6',
  Signals: '#fbbf24',
  Touchs: '#ef4444',
  Risks: '#fb923c',
  Tactics: '#a78bfa',
  Deals: '#4ade80',
  
  accent: '#60a5fa',
  accentHover: '#3b82f6',
  
  gridLine: '#1e293b',
  rowLine: '#1e293b',
  arrowColor: '#64748b',
  
  tooltipBg: '#0f172a',
  tooltipText: '#f1f5f9',
  
  hoverHighlight: '#ffffff',
  selectedHighlight: '#ffffff',
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
    
    // Backgrounds
    root.style.setProperty('--bg-primary', colors.bgPrimary);
    root.style.setProperty('--bg-secondary', colors.bgSecondary);
    root.style.setProperty('--bg-tertiary', colors.bgTertiary);
    root.style.setProperty('--bg-header', colors.bgHeader);
    root.style.setProperty('--bg-legend', colors.bgLegend);
    
    // Text
    root.style.setProperty('--text-primary', colors.textPrimary);
    root.style.setProperty('--text-secondary', colors.textSecondary);
    root.style.setProperty('--text-muted', colors.textMuted);
    
    // Borders
    root.style.setProperty('--border-primary', colors.borderPrimary);
    root.style.setProperty('--border-secondary', colors.borderSecondary);
    
    // Event types
    root.style.setProperty('--color-corridors', colors.Corridors);
    root.style.setProperty('--color-signals', colors.Signals);
    root.style.setProperty('--color-touchs', colors.Touchs);
    root.style.setProperty('--color-risks', colors.Risks);
    root.style.setProperty('--color-tactics', colors.Tactics);
    root.style.setProperty('--color-deals', colors.Deals);
    
    // Accent
    root.style.setProperty('--accent', colors.accent);
    root.style.setProperty('--accent-hover', colors.accentHover);
    
    // Chart
    root.style.setProperty('--grid-line', colors.gridLine);
    root.style.setProperty('--row-line', colors.rowLine);
    root.style.setProperty('--arrow-color', colors.arrowColor);
    
    // Tooltip
    root.style.setProperty('--tooltip-bg', colors.tooltipBg);
    root.style.setProperty('--tooltip-text', colors.tooltipText);
    
    // Interactive
    root.style.setProperty('--hover-highlight', colors.hoverHighlight);
    root.style.setProperty('--selected-highlight', colors.selectedHighlight);
    
    // Set data-theme attribute for CSS fallback
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
