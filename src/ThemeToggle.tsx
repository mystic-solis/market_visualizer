// src/ThemeToggle.tsx
import { useTheme } from './ThemeContext';

export const ThemeToggle = () => {
  const { mode, toggleMode } = useTheme();

  return (
    <button
      onClick={toggleMode}
      title={mode === 'light' ? 'Переключить на тёмную тему' : 'Переключить на светлую тему'}
      style={{
        background: 'var(--bg-tertiary)',
        border: '1px solid var(--border-primary)',
        borderRadius: 8,
        padding: '6px 10px',
        fontSize: 18,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.3s ease',
      }}
    >
      {mode === 'light' ? '🌙' : '☀️'}
    </button>
  );
};
