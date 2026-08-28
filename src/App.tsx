import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { check } from '@tauri-apps/plugin-updater';
import TimelineVisualizer from './components/TimelineVisualizer';

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

// Состояние фильтров
const allInstruments = ['EURUSD', 'GBPUSD', 'BTCUSD'];
const allTypes = ['Corridors', 'Signals', 'Touchs', 'Risks', 'Tactics', 'Deals'];
type DataSourceType = 'json' | 'kafka';

function App() {
  const [timelineData, setTimelineData] = useState<TimelineData | null>(null);
  const [activeInstruments, setActiveInstruments] = useState<Set<string>>(new Set(allInstruments));
  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set(allTypes));
  const [dataSource, setDataSource] = useState<DataSourceType>('json');
  const [instrumentDropdownOpen, setInstrumentDropdownOpen] = useState(false);
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);

  useEffect(() => {
    loadTestData();
    
    // Закрытие дропдаунов при клике вне
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('#instrument-dropdown')) {
        setInstrumentDropdownOpen(false);
      }
      if (!target.closest('#type-dropdown')) {
        setTypeDropdownOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    
    // Проверка обновлений при запуске приложения
    checkForUpdates();
    
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

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
    if (newSet.has(instrument)) {
      newSet.delete(instrument);
    } else {
      newSet.add(instrument);
    }
    setActiveInstruments(newSet);
  };

  const handleTypeToggle = (type: string) => {
    const newSet = new Set(activeTypes);
    if (newSet.has(type)) {
      newSet.delete(type);
    } else {
      newSet.add(type);
    }
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

  // Функция для проверки и установки обновлений
  const checkForUpdates = async () => {
    try {
      console.log('Checking for updates...');
      const update = await check();
      console.log('Update check result:', update);
      if (update) {
        console.log(`Update available: ${update.version}`);
        
        // Запрашиваем у пользователя установку обновления
        const shouldInstall = window.confirm(
          `Доступна новая версия приложения (${update.version}). Установить сейчас?`
        );
        
        if (shouldInstall) {
          let downloaded = 0;
          let contentLength = 0;

          await update.downloadAndInstall((event) => {
            switch (event.event) {
              case 'Started':
                contentLength = event.data.contentLength || 0;
                console.log(`Starting download of ${contentLength} bytes...`);
                break;
              case 'Progress':
                downloaded += event.data.chunkLength;
                console.log(`Downloaded ${downloaded} from ${contentLength}`);
                break;
              case 'Finished':
                console.log('Download finished, installing...');
                break;
            }
          });

          alert('Обновление установлено. Пожалуйста, перезапустите приложение вручную.');
        }
      } else {
        console.log('No updates available.');
      }
    } catch (error) {
      console.error('Error checking for updates:', error);
    }
  };

  // Статистика
  const totalEvents = timelineData?.stats.total_events || 0;
  const totalCorridors = timelineData?.stats.total_corridors || 0;
  const totalDeals = timelineData?.stats.total_deals || 0;
  const currentVersion = '0.1.8';

  return (
    <div className="app-container">
      <header className="app-header">
        <h1 className="title">📊 Временная линия событий</h1>
        <div className="stats" id="stats-bar">
          <span>Всего: <span id="total-events">{totalEvents}</span></span>
          <span>Коридоров: <span id="total-corridors">{totalCorridors}</span></span>
          <span>Сделок: <span id="total-deals">{totalDeals}</span></span>
        </div>
      </header>

      {/* Фильтры с выпадающими списками */}
      <div className="filters" id="filters-panel">
        {/* Инструменты */}
        <div className="filter-group">
          <label>Инструменты:</label>
          <div className="dropdown" id="instrument-dropdown">
            <div 
              className={`dropdown-toggle ${instrumentDropdownOpen ? 'open' : ''}`} 
              id="instrument-toggle"
              onClick={(e) => {
                e.stopPropagation();
                setInstrumentDropdownOpen(!instrumentDropdownOpen);
                setTypeDropdownOpen(false);
              }}
            >
              <span id="instrument-label">{getLabelForInstruments()}</span>
              <span className="dropdown-arrow">▾</span>
            </div>
            {instrumentDropdownOpen && (
              <div className="dropdown-menu open" id="instrument-menu">
                {allInstruments.map(inst => {
                  const count = timelineData?.events.filter((e: any) => e.instrument === inst).length || 0;
                  return (
                    <div key={inst} className="dropdown-item">
                      <input
                        type="checkbox"
                        id={`inst-${inst}`}
                        checked={activeInstruments.has(inst)}
                        onChange={() => handleInstrumentToggle(inst)}
                      />
                      <label htmlFor={`inst-${inst}`}>{inst}</label>
                      <span className="count">{count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Типы событий */}
        <div className="filter-group">
          <label>Типы событий:</label>
          <div className="dropdown" id="type-dropdown">
            <div 
              className={`dropdown-toggle ${typeDropdownOpen ? 'open' : ''}`} 
              id="type-toggle"
              onClick={(e) => {
                e.stopPropagation();
                setTypeDropdownOpen(!typeDropdownOpen);
                setInstrumentDropdownOpen(false);
              }}
            >
              <span id="type-label">{getLabelForTypes()}</span>
              <span className="dropdown-arrow">▾</span>
            </div>
            {typeDropdownOpen && (
              <div className="dropdown-menu open" id="type-menu">
                {allTypes.map(type => {
                  const count = timelineData?.events.filter((e: any) => e.event_type === type || e.type === type).length || 0;
                  return (
                    <div key={type} className="dropdown-item">
                      <input
                        type="checkbox"
                        id={`type-${type}`}
                        checked={activeTypes.has(type)}
                        onChange={() => handleTypeToggle(type)}
                      />
                      <label htmlFor={`type-${type}`}>{type}</label>
                      <span className="count">{count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Источник данных */}
        <div className="filter-group">
          <label>Источник данных:</label>
          <div className="data-source-toggle">
            <button 
              className={`source-btn ${dataSource === 'json' ? 'active' : ''}`}
              onClick={() => setDataSource('json')}
            >
              JSON-файл
            </button>
            <button 
              className={`source-btn ${dataSource === 'kafka' ? 'active' : ''}`}
              onClick={() => setDataSource('kafka')}
            >
              Kafka
            </button>
          </div>
        </div>
      </div>

      <main className="vis-container" id="vis-container">
        <div id="tooltip" className="tooltip hidden"></div>
        {timelineData ? (
          <TimelineVisualizer 
            data={timelineData}
            activeInstruments={activeInstruments}
            activeTypes={activeTypes}
          />
        ) : (
          <div className="loading-state">
            {dataSource === 'kafka' ? 'Подключение к Kafka...' : 'Загрузка данных...'}
          </div>
        )}
      </main>

      <footer className="footer">
        <span>Наведите на событие для деталей · Клик для информации</span>
        <span className="footer-version">v{currentVersion}</span>
        <button className="check-updates-btn" onClick={checkForUpdates}>Проверить обновления</button>
      </footer>
    </div>
  );
}

export default App;