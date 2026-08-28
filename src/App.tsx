import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import TimelineVisualizer from './components/TimelineVisualizer';
import { ThemeProvider, useTheme } from './ThemeContext';
import { ThemeToggle } from './ThemeToggle';
import logoSvg from '../src-tauri/icons/logo.svg';

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
        style={{ width: 32, height: 24, border: 'none', borderRadius: 4, cursor: 'pointer' }}
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
  resetToDefaults 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  dataSource: string; 
  setDataSource: (v: 'json' | 'kafka') => void;
  colors: any;
    updateColor: (key: string, value: string) => void;
  resetToDefaults: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
        <div className="modal-header">
          <h2>⚙️ Настройки</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="setting-item">
            <label>Источник данных:</label>
            <div className="data-source-toggle">
              <button className={`source-btn ${dataSource === 'json' ? 'active' : ''}`} onClick={() => setDataSource('json')}>📄 JSON-файл</button>
              <button className={`source-btn ${dataSource === 'kafka' ? 'active' : ''}`} onClick={() => setDataSource('kafka')}>🔌 Kafka</button>
            </div>
            <p className="setting-hint">Переключение между файлом и потоком данных</p>
          </div>

          <div className="setting-item">
            <label>Цвета событий:</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
              {allTypes.map(type => (
                <ColorPicker
                  key={type}
                  label={type}
                  value={colors[type]}
                  onChange={(v) => updateColor(type, v)}
                />
              ))}
            </div>
            <button 
              onClick={resetToDefaults}
              style={{
                marginTop: 8,
                padding: '4px 12px',
                fontSize: 11,
                border: '1px solid var(--border-primary)',
                borderRadius: 4,
                background: 'var(--bg-tertiary)',
                color: 'var(--text-secondary)',
                cursor: 'pointer'
              }}
            >
              Сбросить к стандартным
            </button>
          </div>

          <div className="setting-item">
            <label>Экспорт данных:</label>
            <button className="export-btn">📥 Экспорт в JSON</button>
            <p className="setting-hint">Экспортирует все текущие данные (события, коридоры, сделки) в JSON файл</p>
          </div>

          <div className="setting-item">
            <label>О приложении:</label>
            <div className="about-info">
              <p><strong>Market Visualizer</strong></p>
              <p>Версия: 0.1.16</p>
              <p>Платформа: Tauri + React + D3.js</p>
            </div>
          </div>
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
          const colorVar = `--color-${type.toLowerCase()}`;
          const color = getComputedStyle(document.documentElement).getPropertyValue(colorVar).trim() || colors[type];
          return (
            <div key={type} className="legend-bottom-item">
              <span className="legend-bottom-color" style={{ background: color, '--legend-color': color } as any}></span>
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
      />
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;
