mod grouping;
mod models;
mod parser;

use crate::models::{DataSourceConfig, LogEvent, ParserConfig, TimelineData};
use chrono::{DateTime, Utc};
use std::fs;
use std::io::Write;

#[tauri::command]
fn append_to_log(message: String) -> Result<(), String> {
    let log_path = std::env::current_dir()
        .map_err(|e| format!("Failed to get current dir: {}", e))?
        .join("update-errors.log");
    
    let mut file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
        .map_err(|e| format!("Failed to open log file: {}", e))?;
    
    let timestamp = chrono::Local::now().format("%Y-%m-%d %H:%M:%S");
    writeln!(file, "[{}] {}", timestamp, message)
        .map_err(|e| format!("Failed to write to log: {}", e))?;
    
    Ok(())
}

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

    // Генерируем коридоры (много данных для тестирования переполнения)
    let corridor_events = vec![
        // CR-001 - EURUSD
        ("CR-001".to_string(), EventType::Corridors, Instrument::EURUSD, 15, "1.1245"),
        ("CR-001".to_string(), EventType::Signals, Instrument::EURUSD, 30, "1.1250"),
        ("CR-001".to_string(), EventType::Touchs, Instrument::EURUSD, 45, "1.1248"),
        ("CR-001".to_string(), EventType::Risks, Instrument::EURUSD, 75, "1.1255"),
        // CR-002 - GBPUSD
        ("CR-002".to_string(), EventType::Corridors, Instrument::GBPUSD, 60, "1.3120"),
        ("CR-002".to_string(), EventType::Tactics, Instrument::GBPUSD, 75, "1.3125"),
        ("CR-002".to_string(), EventType::Signals, Instrument::GBPUSD, 90, "1.3130"),
        ("CR-002".to_string(), EventType::Touchs, Instrument::GBPUSD, 105, "1.3128"),
        // CR-003 - BTCUSD
        ("CR-003".to_string(), EventType::Corridors, Instrument::BTCUSD, 90, "68200"),
        ("CR-003".to_string(), EventType::Signals, Instrument::BTCUSD, 105, "68400"),
        ("CR-003".to_string(), EventType::Touchs, Instrument::BTCUSD, 120, "68150"),
        // CR-004 - GBPUSD
        ("CR-004".to_string(), EventType::Corridors, Instrument::GBPUSD, 30, "1.3110"),
        ("CR-004".to_string(), EventType::Signals, Instrument::GBPUSD, 50, "1.3118"),
        ("CR-004".to_string(), EventType::Risks, Instrument::GBPUSD, 70, "1.3123"),
        // CR-005 - EURUSD
        ("CR-005".to_string(), EventType::Corridors, Instrument::EURUSD, 130, "1.1260"),
        ("CR-005".to_string(), EventType::Signals, Instrument::EURUSD, 145, "1.1265"),
        ("CR-005".to_string(), EventType::Tactics, Instrument::EURUSD, 160, "1.1270"),
        ("CR-005".to_string(), EventType::Touchs, Instrument::EURUSD, 175, "1.1268"),
        // CR-006 - BTCUSD
        ("CR-006".to_string(), EventType::Corridors, Instrument::BTCUSD, 150, "68500"),
        ("CR-006".to_string(), EventType::Risks, Instrument::BTCUSD, 165, "68600"),
        ("CR-006".to_string(), EventType::Signals, Instrument::BTCUSD, 180, "68450"),
        // CR-007 - EURUSD
        ("CR-007".to_string(), EventType::Corridors, Instrument::EURUSD, 190, "1.1275"),
        ("CR-007".to_string(), EventType::Touchs, Instrument::EURUSD, 205, "1.1280"),
        ("CR-007".to_string(), EventType::Risks, Instrument::EURUSD, 220, "1.1278"),
        // CR-008 - GBPUSD
        ("CR-008".to_string(), EventType::Corridors, Instrument::GBPUSD, 210, "1.3135"),
        ("CR-008".to_string(), EventType::Signals, Instrument::GBPUSD, 225, "1.3140"),
        ("CR-008".to_string(), EventType::Tactics, Instrument::GBPUSD, 240, "1.3145"),
        // CR-009 - BTCUSD
        ("CR-009".to_string(), EventType::Corridors, Instrument::BTCUSD, 230, "68700"),
        ("CR-009".to_string(), EventType::Touchs, Instrument::BTCUSD, 245, "68800"),
        ("CR-009".to_string(), EventType::Signals, Instrument::BTCUSD, 260, "68650"),
        // CR-010 - EURUSD
        ("CR-010".to_string(), EventType::Corridors, Instrument::EURUSD, 250, "1.1285"),
        ("CR-010".to_string(), EventType::Risks, Instrument::EURUSD, 265, "1.1290"),
        ("CR-010".to_string(), EventType::Tactics, Instrument::EURUSD, 280, "1.1288"),
        // CR-011 - GBPUSD
        ("CR-011".to_string(), EventType::Corridors, Instrument::GBPUSD, 270, "1.3150"),
        ("CR-011".to_string(), EventType::Signals, Instrument::GBPUSD, 285, "1.3155"),
        ("CR-011".to_string(), EventType::Touchs, Instrument::GBPUSD, 300, "1.3152"),
        // CR-012 - BTCUSD
        ("CR-012".to_string(), EventType::Corridors, Instrument::BTCUSD, 290, "68900"),
        ("CR-012".to_string(), EventType::Risks, Instrument::BTCUSD, 305, "69000"),
        ("CR-012".to_string(), EventType::Signals, Instrument::BTCUSD, 320, "68850"),
        // CR-013 - EURUSD
        ("CR-013".to_string(), EventType::Corridors, Instrument::EURUSD, 310, "1.1295"),
        ("CR-013".to_string(), EventType::Tactics, Instrument::EURUSD, 325, "1.1300"),
        ("CR-013".to_string(), EventType::Touchs, Instrument::EURUSD, 340, "1.1298"),
        // CR-014 - GBPUSD
        ("CR-014".to_string(), EventType::Corridors, Instrument::GBPUSD, 330, "1.3160"),
        ("CR-014".to_string(), EventType::Signals, Instrument::GBPUSD, 345, "1.3165"),
        ("CR-014".to_string(), EventType::Risks, Instrument::GBPUSD, 360, "1.3162"),
        // CR-015 - BTCUSD
        ("CR-015".to_string(), EventType::Corridors, Instrument::BTCUSD, 350, "69100"),
        ("CR-015".to_string(), EventType::Touchs, Instrument::BTCUSD, 365, "69200"),
        ("CR-015".to_string(), EventType::Signals, Instrument::BTCUSD, 380, "69050"),
        // CR-016 - EURUSD
        ("CR-016".to_string(), EventType::Corridors, Instrument::EURUSD, 370, "1.1305"),
        ("CR-016".to_string(), EventType::Risks, Instrument::EURUSD, 385, "1.1310"),
        ("CR-016".to_string(), EventType::Tactics, Instrument::EURUSD, 400, "1.1308"),
        // CR-017 - GBPUSD
        ("CR-017".to_string(), EventType::Corridors, Instrument::GBPUSD, 390, "1.3170"),
        ("CR-017".to_string(), EventType::Signals, Instrument::GBPUSD, 405, "1.3175"),
        ("CR-017".to_string(), EventType::Touchs, Instrument::GBPUSD, 420, "1.3172"),
        // CR-018 - BTCUSD
        ("CR-018".to_string(), EventType::Corridors, Instrument::BTCUSD, 410, "69300"),
        ("CR-018".to_string(), EventType::Risks, Instrument::BTCUSD, 425, "69400"),
        ("CR-018".to_string(), EventType::Signals, Instrument::BTCUSD, 440, "69250"),
        // CR-019 - EURUSD
        ("CR-019".to_string(), EventType::Corridors, Instrument::EURUSD, 430, "1.1315"),
        ("CR-019".to_string(), EventType::Tactics, Instrument::EURUSD, 445, "1.1320"),
        ("CR-019".to_string(), EventType::Touchs, Instrument::EURUSD, 460, "1.1318"),
        // CR-020 - GBPUSD
        ("CR-020".to_string(), EventType::Corridors, Instrument::GBPUSD, 450, "1.3180"),
        ("CR-020".to_string(), EventType::Signals, Instrument::GBPUSD, 465, "1.3185"),
        ("CR-020".to_string(), EventType::Risks, Instrument::GBPUSD, 480, "1.3182"),
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

    // Генерируем сделки (много данных для тестирования)
    let deal_events = vec![
        (EventType::Deals, Instrument::EURUSD, 20, "1.1240"),
        (EventType::Deals, Instrument::GBPUSD, 35, "1.3115"),
        (EventType::Deals, Instrument::EURUSD, 50, "1.1249"),
        (EventType::Deals, Instrument::BTCUSD, 80, "68250"),
        (EventType::Deals, Instrument::GBPUSD, 95, "1.3132"),
        (EventType::Deals, Instrument::EURUSD, 110, "1.1252"),
        (EventType::Deals, Instrument::BTCUSD, 125, "68300"),
        (EventType::Deals, Instrument::EURUSD, 140, "1.1262"),
        (EventType::Deals, Instrument::GBPUSD, 155, "1.3128"),
        (EventType::Deals, Instrument::BTCUSD, 170, "68550"),
        (EventType::Deals, Instrument::EURUSD, 200, "1.1272"),
        (EventType::Deals, Instrument::GBPUSD, 215, "1.3138"),
        (EventType::Deals, Instrument::BTCUSD, 255, "68750"),
        (EventType::Deals, Instrument::EURUSD, 270, "1.1282"),
        (EventType::Deals, Instrument::GBPUSD, 295, "1.3148"),
        (EventType::Deals, Instrument::BTCUSD, 315, "68950"),
        (EventType::Deals, Instrument::EURUSD, 335, "1.1292"),
        (EventType::Deals, Instrument::GBPUSD, 355, "1.3158"),
        (EventType::Deals, Instrument::BTCUSD, 375, "69150"),
        (EventType::Deals, Instrument::EURUSD, 395, "1.1302"),
        (EventType::Deals, Instrument::GBPUSD, 415, "1.3168"),
        (EventType::Deals, Instrument::BTCUSD, 435, "69350"),
        (EventType::Deals, Instrument::EURUSD, 455, "1.1312"),
        (EventType::Deals, Instrument::GBPUSD, 475, "1.3178"),
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

    // Сортируем события по времени
    events.sort_by_key(|e| e.timestamp);

    // Группируем события
    let timeline_data = grouping::GroupingEngine::group_events(events);

    Ok(timeline_data)
}

// Таври модуль
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|_app| {
            Ok(())
        })
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            load_timeline_data_from_json,
            generate_test_timeline_data,
            append_to_log,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
