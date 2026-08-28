mod grouping;
mod models;
mod parser;

use crate::models::{DataSourceConfig, LogEvent, ParserConfig, TimelineData};
use chrono::{DateTime, Utc};
use std::fs;

// Функция для парсинга данных из JSON файла (для удобства разработки и тестирования)
#[tauri::command]
fn load_timeline_data_from_json(json_content: String, _parser_config: Option<ParserConfig>) -> Result<TimelineData, String> {
    // Создаем парсер
    let parser = parser::EventParser::new();

    // Парсим данные из JSON
    let events_array: Vec<serde_json::Value> = match serde_json::from_str(&json_content) {
        Ok(events) => events,
        Err(e) => return Err(format!("Failed to parse JSON data: {}", e)),
    };

    let mut events: Vec<LogEvent> = Vec::new();
    for event_val in events_array {
        if let Some(event) = parser.parse_json_event(&event_val) {
            events.push(event);
        }
    }

    // Сортируем события по времени
    events.sort_by_key(|e| e.timestamp);

    // Группируем события
    let timeline_data = grouping::GroupingEngine::group_events(events);

    Ok(timeline_data)
}

// Функция для генерации тестовых данных
#[tauri::command]
fn generate_test_timeline_data() -> Result<TimelineData, String> {
    use crate::models::{EventType, Instrument};

    // Создаем базовое время
    let base_time = DateTime::<Utc>::from_timestamp(1724265600, 0).unwrap_or_else(Utc::now); // Пример: 21 августа 2026

    // Генерируем коридоры
    let corridor_events = vec![
        (
            "CR-001".to_string(),
            EventType::Corridors,
            Instrument::EURUSD,
            15,
            "1.1245",
        ),
        (
            "CR-001".to_string(),
            EventType::Signals,
            Instrument::EURUSD,
            30,
            "1.1250",
        ),
        (
            "CR-001".to_string(),
            EventType::Touchs,
            Instrument::EURUSD,
            45,
            "1.1248",
        ),
        (
            "CR-001".to_string(),
            EventType::Risks,
            Instrument::EURUSD,
            75,
            "1.1255",
        ),
        (
            "CR-002".to_string(),
            EventType::Corridors,
            Instrument::GBPUSD,
            60,
            "1.3120",
        ),
        (
            "CR-002".to_string(),
            EventType::Tactics,
            Instrument::GBPUSD,
            75,
            "1.3125",
        ),
        (
            "CR-002".to_string(),
            EventType::Signals,
            Instrument::GBPUSD,
            90,
            "1.3130",
        ),
        (
            "CR-002".to_string(),
            EventType::Touchs,
            Instrument::GBPUSD,
            105,
            "1.3128",
        ),
        (
            "CR-003".to_string(),
            EventType::Corridors,
            Instrument::BTCUSD,
            90,
            "68200",
        ),
        (
            "CR-003".to_string(),
            EventType::Signals,
            Instrument::BTCUSD,
            105,
            "68400",
        ),
        (
            "CR-003".to_string(),
            EventType::Touchs,
            Instrument::BTCUSD,
            120,
            "68150",
        ),
        (
            "CR-004".to_string(),
            EventType::Corridors,
            Instrument::GBPUSD,
            30,
            "1.3110",
        ),
        (
            "CR-004".to_string(),
            EventType::Signals,
            Instrument::GBPUSD,
            50,
            "1.3118",
        ),
        (
            "CR-004".to_string(),
            EventType::Risks,
            Instrument::GBPUSD,
            70,
            "1.3123",
        ),
    ];

    let mut events: Vec<LogEvent> = Vec::new();
    for (i, (corridor_id, event_type, instrument, time_offset, value)) in
        corridor_events.iter().enumerate()
    {
        let timestamp = base_time + chrono::Duration::minutes(*time_offset);
        let id = format!("c-{}", i);

        events.push(LogEvent {
            id,
            timestamp,
            instrument: instrument.clone(),
            corridor_id: Some(corridor_id.clone()),
            event_type: event_type.clone(),
            value: value.to_string(),
            raw_line: format!(
                "Raw line for {} at {} with value {}",
                corridor_id, timestamp, value
            ),
            metadata: serde_json::Value::Object(serde_json::map::Map::new()),
        });
    }

    // Генерируем сделки
    let deal_events = vec![
        (EventType::Deals, Instrument::EURUSD, 20, "1.1240"),
        (EventType::Deals, Instrument::GBPUSD, 35, "1.3115"),
        (EventType::Deals, Instrument::EURUSD, 50, "1.1249"),
        (EventType::Deals, Instrument::BTCUSD, 80, "68250"),
        (EventType::Deals, Instrument::GBPUSD, 95, "1.3132"),
        (EventType::Deals, Instrument::EURUSD, 110, "1.1252"),
        (EventType::Deals, Instrument::BTCUSD, 125, "68300"),
    ];

    for (i, (event_type, instrument, time_offset, value)) in
        deal_events.iter().enumerate()
    {
        let timestamp = base_time + chrono::Duration::minutes(*time_offset);
        let id = format!("d-{}", i);

        events.push(LogEvent {
            id,
            timestamp,
            instrument: instrument.clone(),
            corridor_id: None,
            event_type: event_type.clone(),
            value: value.to_string(),
            raw_line: format!(
                "Deal raw line at {} with value {}",
                timestamp, value
            ),
            metadata: serde_json::Value::Object(serde_json::map::Map::new()),
        });
    }

    // Генерация свечей (реалистичные, рандомизированные)
    let mut candles = Vec::new();
    use rand::Rng;
    use rand::SeedableRng;
    use rand::rngs::StdRng;
    
    let seed = 42u64;
    let mut rng = StdRng::seed_from_u64(seed);
    
    let base_price = match Instrument::EURUSD { _ => 1.1200 };
    let volatility = 0.0008;
    let mut current_price = base_price;
    
    for i in 0..200 {
        let timestamp = base_time + chrono::Duration::minutes(i * 5);
        
        let change: f64 = rng.gen_range(-volatility..=volatility);
        let open = current_price;
        let close = open * (1.0 + change);
        
        let wick_range = (close - open).abs() * 0.5;
        let high_add: f64 = rng.gen_range(0.0..=wick_range);
        let low_sub: f64 = rng.gen_range(0.0..=wick_range);
        
        let high = open.max(close) + high_add;
        let low = open.min(close) - low_sub;
        
        let volume: f64 = rng.gen_range(100.0..=10000.0);
        
        candles.push(crate::models::Candle {
            timestamp,
            open,
            high,
            low,
            close,
            volume,
        });
        
        current_price = close;
    }

    // Сортируем события по времени
    events.sort_by_key(|e| e.timestamp);

    // Группируем события
    let mut timeline_data = grouping::GroupingEngine::group_events(events);
    timeline_data.candles = candles;

    Ok(timeline_data)
}

// Таври модуль
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|_app| {
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            load_timeline_data_from_json,
            generate_test_timeline_data,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
