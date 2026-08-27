use crate::models::{EventType, Instrument, LogEvent};
use chrono::{DateTime, Utc};
use uuid::Uuid;

pub struct EventParser {
    // В текущей версии данные приходят из JSON или стримов кафки напрямую,
    // поэтому парсер строки логов не используется.
}

impl EventParser {
    pub fn new() -> Self {
        Self {}
    }

    /// Парсинг JSON-события в LogEvent (для удобства разработки и тестирования)
    pub fn parse_json_event(&self, event_data: &serde_json::Value) -> Option<LogEvent> {
        let id = event_data.get("id")?.as_str()?.to_string();
        
        let timestamp_str = event_data.get("timestamp")?.as_str()?;
        let timestamp = match DateTime::parse_from_rfc3339(timestamp_str) {
            Ok(dt) => dt.with_timezone(&Utc),
            Err(_) => return None,
        };

        let instrument_str = event_data.get("instrument")?.as_str()?;
        let instrument = match instrument_str {
            "EURUSD" | "EUR/USD" => Instrument::EURUSD,
            "GBPUSD" | "GBP/USD" => Instrument::GBPUSD,
            "BTCUSD" | "BTC/USD" => Instrument::BTCUSD,
            _ => return None,
        };

        let corridor_id = event_data.get("corridor_id").and_then(|v| v.as_str()).map(String::from);

        let event_type_str = event_data.get("event_type")?.as_str()?;
        let event_type = match event_type_str {
            "DEALS" | "Deals" => EventType::Deals,
            "CR" | "CORRIDOR" | "Corridors" => EventType::Corridors,
            "SG" | "SIGNAL" | "Signals" => EventType::Signals,
            "TC" | "TOUCH" | "Touchs" => EventType::Touchs,
            "TA" | "TACTIC" | "Tactics" => EventType::Tactics,
            "RK" | "RISK" | "Risks" => EventType::Risks,
            "SV" | "SERVICE" | "Service" => EventType::Service,
            "SP" | "SPECIFICATION" | "Specifications" => EventType::Specifications,
            _ => EventType::Corridors,
        };

        let value = event_data.get("value").and_then(|v| v.as_str()).unwrap_or("N/A").to_string();
        
        let raw_line = event_data.get("raw_line").and_then(|v| v.as_str()).map(String::from).unwrap_or_default();
        
        let metadata = event_data.get("metadata").cloned().unwrap_or(serde_json::Value::Object(serde_json::map::Map::new()));

        Some(LogEvent {
            id,
            timestamp,
            instrument,
            corridor_id,
            event_type,
            value,
            raw_line,
            metadata,
        })
    }
}
