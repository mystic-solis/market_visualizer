import { useState, useEffect, useRef, createContext, useContext } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';
import { check } from '@tauri-apps/plugin-updater';
import TimelineVisualizer from './components/TimelineVisualizer';
import { ThemeProvider, useTheme } from './ThemeContext';
import { ThemeToggle } from './ThemeToggle';
import logoSvg from '../src-tauri/icons/logo.svg';

// Toast Context
interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info' | 'update';
  visible: boolean;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (message: string, type?: Toast['type']) => void;
  removeToast: (id: number) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

// Toast Component
function ToastContainer() {
  const { toasts, removeToast } = useToast();

  return (
    <div style={{
      position: 'fixed',
      top: 20,
      right: 20,
      zIndex: 10000,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      pointerEvents: 'none',
    }}>
      {toasts.map(toast => (
        <div
          key={toast.id}
          onClick={() => removeToast(toast.id)}
          style={{
            background: toast.type === 'update' ? '#4CAF50' : 
                       toast.type === 'success' ? '#2196F3' :
                       toast.type === 'error' ? '#f44336' : '#333',
            color: 'white',
            padding: '12px 20px',
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            cursor: 'pointer',
            pointerEvents: 'auto',
            minWidth: 250,
            maxWidth: 350,
            animation: toast.visible ? 'slideIn 0.3s ease-out' : 'slideOut 0.3s ease-in',
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          <span style={{ fontSize: 18 }}>
            {toast.type === 'update' ? '🎉' : 
             toast.type === 'success' ? '✅' :
             toast.type === 'error' ? '❌' : 'ℹ️'}
          </span>
          <span style={{ flex: 1 }}>{toast.message}</span>
        </div>
      ))}
    </div>
  );
}

// Custom Confirm Dialog
function ConfirmDialog({ 
  isOpen, 
  title, 
  message, 
  onConfirm, 
  onCancel 
}: { 
  isOpen: boolean; 
  title: string; 
  message: string; 
  onConfirm: () => void; 
  onCancel: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10001,
    }}>
      <div style={{
        background: 'var(--card, #1e1e1e)',
        borderRadius: 12,
        padding: '24px 28px',
        maxWidth: 400,
        width: '90%',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        border: '1px solid var(--border-primary, #333)',
      }}>
        <h3 style={{ margin: '0 0 12px', color: 'var(--text-primary, #fff)' }}>{title}</h3>
        <p style={{ margin: '0 0 20px', color: 'var(--text-secondary, #aaa)', whiteSpace: 'pre-line', lineHeight: 1.5 }}>
          {message}
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              border: '1px solid var(--border-primary, #333)',
              borderRadius: 6,
              background: 'transparent',
              color: 'var(--text-secondary, #aaa)',
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Отмена
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: 6,
              background: '#4CAF50',
              color: 'white',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Установить
          </button>
        </div>
      </div>
    </div>
  );
}

// Toast Provider
function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const addToast = (message: string, type: Toast['type'] = 'info') => {
    const id = nextId.current++;
    setToasts(prev => [...prev, { id, message, type, visible: true }]);
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, visible: false } : t));
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 300);
    }, 5000);
  };

  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer />
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100%); opacity: 0; }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

interface TimelineData {
  events: any[];
  corridor_groups: any[];
  connections: any[];
  deals: any[];
  stats: {
    total_events: number;
    total_corridors: number;
    total_deals: number;
    events_by_type: any;
    events_by_instrument: any;
    time_range: [string, string];
  };
}

const allInstruments = ['EURUSD', 'GBPUSD', 'BTCUSD'];
const allTypes = ['Corridors', 'Signals', 'Touchs', 'Risks', 'Tactics', 'Deals'];
type DataSourceType = 'json' | 'kafka';

function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ 
          width: 28, 
          height: 28, 
          border: '2px solid var(--border-primary)', 
          borderRadius: '50%', 
          cursor: 'pointer',
          padding: 0,
          background: 'none'
        }}
      />
      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
    </div>
  );
}

function SettingsModal({ 
  isOpen, 
  onClose, 
  dataSource, 
  setDataSource, 
  colors, 
  updateColor, 
  resetToDefaults,
  appVersion
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  dataSource: string; 
  setDataSource: (v: 'json' | 'kafka') => void;
  colors: any;
  updateColor: (key: string, value: string) => void;
  resetToDefaults: () => void;
  appVersion: string;
}) {
  const [activeTab, setActiveTab] = useState<'data' | 'general' | 'chart' | 'about'>('data');
  
  if (!isOpen) return null;

  const tabs = [
    { id: 'data' as const, label: 'Данные' },
    { id: 'general' as const, label: 'Общее' },
    { id: 'chart' as const, label: 'Графика' },
    { id: 'about' as const, label: 'О приложении' },
  ];

  const eventColorKeys = ['Corridors', 'Signals', 'Touchs', 'Risks', 'Tactics', 'Deals'];
  const bgColorKeys = [
    { key: 'bgPrimary', label: 'Основной фон' },
    { key: 'bgSecondary', label: 'Вторичный фон' },
    { key: 'bgTertiary', label: 'Третичный фон' },
    { key: 'bgHeader', label: 'Фон заголовка' },
    { key: 'bgLegend', label: 'Фон легенды' },
  ];
  const textColorKeys = [
    { key: 'textPrimary', label: 'Основной текст' },
    { key: 'textSecondary', label: 'Вторичный текст' },
    { key: 'textMuted', label: 'Приглушенный текст' },
  ];
  const borderColorKeys = [
    { key: 'borderPrimary', label: 'Основная граница' },
    { key: 'borderSecondary', label: 'Вторичная граница' },
  ];
  const accentColorKeys = [
    { key: 'accent', label: 'Акцент' },
    { key: 'accentHover', label: 'Акцент (наведение)' },
  ];
  const chartColorKeys = [
    { key: 'gridLine', label: 'Линии сетки' },
    { key: 'rowLine', label: 'Линии рядов' },
    { key: 'arrowColor', label: 'Стрелки' },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'data':
        return (
          <>
            <div className="setting-item">
              <label>Источник данных:</label>
              <div className="data-source-toggle">
                <button className={`source-btn ${dataSource === 'json' ? 'active' : ''}`} onClick={() => setDataSource('json')}>📄 JSON-файл</button>
                <button className={`source-btn ${dataSource === 'kafka' ? 'active' : ''}`} onClick={() => setDataSource('kafka')}>🔌 Kafka</button>
              </div>
              <p className="setting-hint">Переключение между файлом и потоком данных</p>
            </div>
            <div className="setting-item">
              <label>Экспорт данных:</label>
              <button className="export-btn">📥 Экспорт в JSON</button>
              <p className="setting-hint">Экспортирует все текущие данные (события, коридоры, сделки) в JSON файл</p>
            </div>
          </>
        );
      
      case 'general':
        return (
          <>
            <div className="setting-item">
              <label>Цвета событий:</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px 16px' }}>
                {eventColorKeys.map(key => (
                  <ColorPicker key={key} label={key} value={colors[key]} onChange={(v) => updateColor(key, v)} />
                ))}
              </div>
            </div>
            <div className="setting-item">
              <label>Акцентные цвета:</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
                {accentColorKeys.map(({ key, label }) => (
                  <ColorPicker key={key} label={label} value={colors[key]} onChange={(v) => updateColor(key, v)} />
                ))}
              </div>
            </div>
            <div className="setting-item">
              <label>Фоновые цвета:</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
                {bgColorKeys.map(({ key, label }) => (
                  <ColorPicker key={key} label={label} value={colors[key]} onChange={(v) => updateColor(key, v)} />
                ))}
              </div>
            </div>
            <div className="setting-item">
              <label>Цвета текста:</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px 16px' }}>
                {textColorKeys.map(({ key, label }) => (
                  <ColorPicker key={key} label={label} value={colors[key]} onChange={(v) => updateColor(key, v)} />
                ))}
              </div>
            </div>
            <div className="setting-item">
              <label>Цвета границ:</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
                {borderColorKeys.map(({ key, label }) => (
                  <ColorPicker key={key} label={label} value={colors[key]} onChange={(v) => updateColor(key, v)} />
                ))}
              </div>
            </div>
            <button 
              onClick={resetToDefaults}
              style={{
                marginTop: 8,
                padding: '6px 16px',
                fontSize: 12,
                border: '1px solid var(--border-primary)',
                borderRadius: 4,
                background: 'var(--bg-tertiary)',
                color: 'var(--text-secondary)',
                cursor: 'pointer'
              }}
            >
              Сбросить все цвета к стандартным
            </button>
          </>
        );
      
      case 'chart':
        return (
          <>
            <div className="setting-item">
              <label>Цвета графика:</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px 16px' }}>
                {chartColorKeys.map(({ key, label }) => (
                  <ColorPicker key={key} label={label} value={colors[key]} onChange={(v) => updateColor(key, v)} />
                ))}
              </div>
            </div>
            <div className="setting-item">
              <label>Цвета границ:</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
                {borderColorKeys.map(({ key, label }) => (
                  <ColorPicker key={key} label={label} value={colors[key]} onChange={(v) => updateColor(key, v)} />
                ))}
              </div>
            </div>
          </>
        );
      
      case 'about':
        return (
          <div className="setting-item">
            <label>О приложении:</label>
            <div className="about-info">
              <p><strong>Market Visualizer</strong></p>
              <p>Версия: {appVersion}</p>
              <p>Платформа: Tauri + React + D3.js</p>
              <p>Дата сборки: {new Date().toLocaleDateString()}</p>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 700, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header">
          <h2>⚙️ Настройки</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        
        {/* Tabs */}
        <div style={{ 
          display: 'flex', 
          borderBottom: '1px solid var(--border-primary)',
          background: 'var(--bg-secondary)'
        }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '10px 20px',
                border: 'none',
                background: activeTab === tab.id ? 'var(--accent)' : 'transparent',
                color: activeTab === tab.id ? 'white' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: activeTab === tab.id ? 600 : 400,
                transition: 'all 0.2s'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        
        <div className="modal-body" style={{ overflow: 'auto', flex: 1 }}>
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
}

function AppContent() {
  const [timelineData, setTimelineData] = useState<TimelineData | null>(null);
  const [activeInstruments, setActiveInstruments] = useState<Set<string>>(new Set(allInstruments));
  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set(allTypes));
  const [dataSource, setDataSource] = useState<DataSourceType>(() => {
    return (localStorage.getItem('dataSource') as DataSourceType) || 'json';
  });
  const [instrumentDropdownOpen, setInstrumentDropdownOpen] = useState(false);
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [brushDomain] = useState<[Date, Date] | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { colors, updateColor, resetToDefaults } = useTheme();
  const { addToast } = useToast();
  const [appVersion, setAppVersion] = useState<string>('...');
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<{ version: string; body: string } | null>(null);

  useEffect(() => {
    getVersion().then(v => setAppVersion(v)).catch(() => setAppVersion('unknown'));
  }, []);

  const handleCheckForUpdates = async () => {
    setIsCheckingUpdate(true);
    try {
      const update = await check();
      if (update) {
        setUpdateInfo({ version: update.version, body: update.body || '' });
        setShowConfirm(true);
      } else {
        addToast('Обновлений не найдено', 'info');
      }
    } catch (error) {
      const errorMessage = String(error);
      if (
        errorMessage.includes('404') ||
        errorMessage.includes('No updates') ||
        errorMessage.includes('Could not fetch') ||
        errorMessage.includes('up to date') ||
        errorMessage.includes('latest')
      ) {
        addToast('Обновлений не найдено', 'info');
      } else {
        addToast(`Ошибка обновления: ${errorMessage.substring(0, 80)}`, 'error');
        invoke('append_to_log', { message: `Update error: ${errorMessage}` }).catch(() => {});
      }
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleConfirmInstall = async () => {
    setShowConfirm(false);
    if (!updateInfo) return;
    
    addToast(`Загрузка версии ${updateInfo.version}...`, 'info');
    
    try {
      const update = await check();
      if (update) {
        await update.downloadAndInstall((event) => {
          switch (event.event) {
            case 'Started':
              addToast(`Загрузка: ${event.data.contentLength} байт`, 'info');
              break;
            case 'Finished':
              addToast('Установка обновления...', 'info');
              break;
          }
        });
        addToast('Обновление установлено! Перезапустите приложение.', 'success');
      }
    } catch (error) {
      addToast(`Ошибка установки: ${String(error).substring(0, 80)}`, 'error');
    }
  };

  const handleTestUpdate = () => {
    // Simulate finding an update for testing
    setUpdateInfo({ 
      version: '99.99.99', 
      body: '🎉 Тестовое обновление!\n\nЭто тестовое уведомление для проверки UI.\n\nНовая фича: красивые уведомления!' 
    });
    setShowConfirm(true);
  };

  useEffect(() => {
    loadTestData();
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('#instrument-dropdown')) setInstrumentDropdownOpen(false);
      if (!target.closest('#type-dropdown')) setTypeDropdownOpen(false);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => { localStorage.setItem('dataSource', dataSource); }, [dataSource]);

  const loadTestData = async () => {
    try {
      const data = await invoke<TimelineData>('generate_test_timeline_data');
      setTimelineData(data);
    } catch (error) {
      console.error('Failed to load test data:', error);
    }
  };

  const handleInstrumentToggle = (instrument: string) => {
    const newSet = new Set(activeInstruments);
    if (newSet.has(instrument)) newSet.delete(instrument); else newSet.add(instrument);
    setActiveInstruments(newSet);
  };

  const handleTypeToggle = (type: string) => {
    const newSet = new Set(activeTypes);
    if (newSet.has(type)) newSet.delete(type); else newSet.add(type);
    setActiveTypes(newSet);
  };

  const getLabelForInstruments = () => {
    if (activeInstruments.size === allInstruments.length) return 'Все';
    if (activeInstruments.size === 0) return 'Ничего';
    return Array.from(activeInstruments).join(', ');
  };

  const getLabelForTypes = () => {
    if (activeTypes.size === allTypes.length) return 'Все';
    if (activeTypes.size === 0) return 'Ничего';
    return Array.from(activeTypes).join(', ');
  };

  const filteredEvents = timelineData ? timelineData.events.filter(e =>
    activeInstruments.has(e.instrument) && activeTypes.has(e.event_type)
  ).length : 0;
  const filteredCorridors = timelineData ? timelineData.corridor_groups.filter(c =>
    activeInstruments.has(c.instrument)
  ).length : 0;
  const filteredDeals = timelineData ? timelineData.deals.filter(e =>
    activeInstruments.has(e.instrument)
  ).length : 0;

  const totalEvents = timelineData?.stats.total_events || 0;
  const totalCorridors = timelineData?.stats.total_corridors || 0;
  const totalDeals = timelineData?.stats.total_deals || 0;

  return (
    <div className="app-container" ref={containerRef}>
      <header className="app-header">
        <div className="title-section">
          <img src={logoSvg} alt="Market Visualizer" className="app-logo" />
          <h1 className="title">Временная линия событий</h1>
        </div>
        <div className="header-right">
          <div className="stats" id="stats-bar">
            <span>Событий: <span className="filtered-count">{filteredEvents}</span><span className="total-count">/{totalEvents}</span></span>
            <span>Коридоров: <span className="filtered-count">{filteredCorridors}</span><span className="total-count">/{totalCorridors}</span></span>
            <span>Сделок: <span className="filtered-count">{filteredDeals}</span><span className="total-count">/{totalDeals}</span></span>
          </div>
          <button
            className="update-btn"
            onClick={handleCheckForUpdates}
            disabled={isCheckingUpdate}
            title="Проверить обновления"
            style={{
              background: 'none',
              border: '1px solid var(--border-primary)',
              borderRadius: 4,
              padding: '4px 8px',
              fontSize: 16,
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              transition: 'all 0.2s'
            }}
          >
            🔄
          </button>
          <button
            className="update-btn"
            onClick={handleTestUpdate}
            title="Тест обновления (эмуляция)"
            style={{
              background: 'none',
              border: '1px solid var(--border-primary)',
              borderRadius: 4,
              padding: '4px 8px',
              fontSize: 16,
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              transition: 'all 0.2s'
            }}
          >
            🧪
          </button>
          <ThemeToggle />
          <button className="settings-btn" onClick={() => setSettingsOpen(true)} title="Настройки">⚙️</button>
        </div>
      </header>

      <div className="filters" id="filters-panel">
        <div className="filter-group">
          <label>Инструменты:</label>
          <div className="dropdown" id="instrument-dropdown">
            <div className={`dropdown-toggle ${instrumentDropdownOpen ? 'open' : ''}`} id="instrument-toggle"
              onClick={(e) => { e.stopPropagation(); setInstrumentDropdownOpen(!instrumentDropdownOpen); setTypeDropdownOpen(false); }}>
              <span id="instrument-label">{getLabelForInstruments()}</span>
              <span className="dropdown-arrow">▾</span>
            </div>
            {instrumentDropdownOpen && (
              <div className="dropdown-menu open" id="instrument-menu">
                {allInstruments.map(inst => (
                  <div key={inst} className="dropdown-item">
                    <input type="checkbox" id={`inst-${inst}`} checked={activeInstruments.has(inst)} onChange={() => handleInstrumentToggle(inst)} />
                    <label htmlFor={`inst-${inst}`}>{inst}</label>
                    <span className="count">{timelineData?.events.filter(e => e.instrument === inst).length || 0}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="filter-group">
          <label>Типы событий:</label>
          <div className="dropdown" id="type-dropdown">
            <div className={`dropdown-toggle ${typeDropdownOpen ? 'open' : ''}`} id="type-toggle"
              onClick={(e) => { e.stopPropagation(); setTypeDropdownOpen(!typeDropdownOpen); setInstrumentDropdownOpen(false); }}>
              <span id="type-label">{getLabelForTypes()}</span>
              <span className="dropdown-arrow">▾</span>
            </div>
            {typeDropdownOpen && (
              <div className="dropdown-menu open" id="type-menu">
                {allTypes.map(type => (
                  <div key={type} className="dropdown-item">
                    <input type="checkbox" id={`type-${type}`} checked={activeTypes.has(type)} onChange={() => handleTypeToggle(type)} />
                    <label htmlFor={`type-${type}`}>{type}</label>
                    <span className="count">{timelineData?.events.filter(e => e.event_type === type || e.type === type).length || 0}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <main className="vis-container" id="vis-container">
        <div id="tooltip" className="tooltip hidden"></div>
        {timelineData ? (
          <TimelineVisualizer data={timelineData} activeInstruments={activeInstruments} activeTypes={activeTypes} brushDomain={brushDomain} />
        ) : (
          <div className="loading-state">{dataSource === 'kafka' ? 'Подключение к Kafka...' : 'Загрузка данных...'}</div>
        )}
      </main>

      {/* Legend - small, centered, below chart */}
      <div className="legend-bottom">
        {allTypes.map(type => {
          const colorVar = `var(--color-${type.toLowerCase()})`;
          return (
            <div key={type} className="legend-bottom-item">
              <span className="legend-bottom-color" style={{ background: colorVar } as any}></span>
              <span className="legend-bottom-label">{type}</span>
            </div>
          );
        })}
      </div>

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        dataSource={dataSource}
        setDataSource={setDataSource}
        colors={colors}
        updateColor={updateColor}
        resetToDefaults={resetToDefaults}
        appVersion={appVersion}
      />

      <ConfirmDialog
        isOpen={showConfirm}
        title="Доступно обновление"
        message={updateInfo ? `Версия ${updateInfo.version}\n\n${updateInfo.body || 'Нет описания'}` : ''}
        onConfirm={handleConfirmInstall}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
