import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import TimelineVisualizer from './components/TimelineVisualizer';
import CandlestickChart from './components/CandlestickChart';
import logoSvg from '../src-tauri/icons/logo.svg';

interface Candle {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface TimelineData {
  events: any[];
  corridor_groups: any[];
  connections: any[];
  deals: any[];
  candles: Candle[];
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

function App() {
  const [timelineData, setTimelineData] = useState<TimelineData | null>(null);
  const [activeInstruments, setActiveInstruments] = useState<Set<string>>(new Set(allInstruments));
  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set(allTypes));
  const [dataSource, setDataSource] = useState<DataSourceType>(() => {
    return (localStorage.getItem('dataSource') as DataSourceType) || 'json';
  });
  const [instrumentDropdownOpen, setInstrumentDropdownOpen] = useState(false);
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [brushDomain, setBrushDomain] = useState<[Date, Date] | null>(null);
  const [candleData, setCandleData] = useState<{ date: Date; open: number; high: number; low: number; close: number }[]>([]);
  const [scrollLeft, setScrollLeft] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(1200);

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

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) setChartWidth(containerRef.current.clientWidth);
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  useEffect(() => {
    if (timelineData?.candles) {
      const data = timelineData.candles.map(c => ({
        date: new Date(c.timestamp),
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close
      }));
      setCandleData(data);
      if (data.length > 0) setBrushDomain([data[0].date, data[data.length - 1].date]);
    }
  }, [timelineData]);

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

        <div className="filter-group">
          <label>Источник данных:</label>
          <div className="data-source-toggle">
            <button className={`source-btn ${dataSource === 'json' ? 'active' : ''}`} onClick={() => setDataSource('json')}>📄 JSON-файл</button>
            <button className={`source-btn ${dataSource === 'kafka' ? 'active' : ''}`} onClick={() => setDataSource('kafka')}>🔌 Kafka</button>
          </div>
        </div>

        <div className="legend">
          {allTypes.map(type => {
            const color = type === 'Corridors' ? '#2563eb' : type === 'Signals' ? '#eab308' : type === 'Touchs' ? '#dc2626' : type === 'Risks' ? '#f97316' : type === 'Tactics' ? '#8b5cf6' : '#22c55e';
            return (
              <div key={type} className="legend-item">
                <span className="legend-color" style={{ background: color }}></span>
                <span className="legend-label">{type}</span>
              </div>
            );
          })}
        </div>
      </div>

      {candleData.length > 0 && (
        <div className="chart-section">
          <CandlestickChart
            data={candleData}
            width={chartWidth}
            height={200}
            onBrush={setBrushDomain}
            brushDomain={brushDomain}
            instrument={activeInstruments.size === 1 ? Array.from(activeInstruments)[0] : 'EURUSD'}
            onScroll={setScrollLeft}
            scrollLeft={scrollLeft}
          />
        </div>
      )}

      <main className="vis-container" id="vis-container" style={{ overflowX: 'auto' }} onScroll={(e) => {
        if (containerRef.current) {
          containerRef.current.scrollLeft = e.currentTarget.scrollLeft;
        }
      }}>
        <div id="tooltip" className="tooltip hidden"></div>
        {timelineData ? (
          <TimelineVisualizer data={timelineData} activeInstruments={activeInstruments} activeTypes={activeTypes} brushDomain={brushDomain} />
        ) : (
          <div className="loading-state">{dataSource === 'kafka' ? 'Подключение к Kafka...' : 'Загрузка данных...'}</div>
        )}
      </main>

      {settingsOpen && (
        <div className="modal-overlay" onClick={() => setSettingsOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>⚙️ Настройки</h2>
              <button className="modal-close" onClick={() => setSettingsOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="setting-item">
                <label>Экспорт данных:</label>
                <button className="export-btn" onClick={() => {
                  if (timelineData) {
                    const blob = new Blob([JSON.stringify(timelineData, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `market-visualizer-export-${new Date().toISOString().slice(0,19).replace(/:/g, '-')}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                  } else { alert('Нет данных для экспорта. Сначала загрузите данные.'); }
                }}>📥 Экспорт в JSON</button>
                <p className="setting-hint">Экспортирует все текущие данные (события, коридоры, сделки) в JSON файл</p>
              </div>
              <div className="setting-item">
                <label>О приложении:</label>
                <div className="about-info">
                  <p><strong>Market Visualizer</strong></p>
                  <p>Версия: 0.1.14</p>
                  <p>Платформа: Tauri + React + D3.js</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
