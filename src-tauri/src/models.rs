use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum EventType {
    Deals,          // Сделки (не привязаны к коридорам)
    Corridors,      // События коридоров
    Signals,
    Touchs,
    Tactics,
    Risks,
    Service,
    Specifications,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Instrument {
    EURUSD,
    GBPUSD,
    BTCUSD,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEvent {
    pub id: String,
    pub timestamp: DateTime<Utc>,
    pub instrument: Instrument,
    pub corridor_id: Option<String>,   // None для сделок
    pub event_type: EventType,
    pub value: String,
    pub raw_line: String,
    pub metadata: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CorridorGroup {
    pub id: String,
    pub corridor_id: String,
    pub events: Vec<String>,
    pub instrument: Instrument,
    pub color: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ConnectionType {
    Sequence,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Connection {
    pub from_id: String,
    pub to_id: String,
    pub connection_type: ConnectionType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Candle {
    pub timestamp: DateTime<Utc>,
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    pub volume: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimelineData {
    pub events: Vec<LogEvent>,
    pub corridor_groups: Vec<CorridorGroup>,
    pub connections: Vec<Connection>,
    pub deals: Vec<LogEvent>,
    pub candles: Vec<Candle>,
    pub stats: TimelineStats,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimelineStats {
    pub total_events: usize,
    pub total_corridors: usize,
    pub total_deals: usize,
    pub events_by_type: serde_json::Value,
    pub events_by_instrument: serde_json::Value,
    pub time_range: (DateTime<Utc>, DateTime<Utc>),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DataSourceType {
    File,
    Kafka,
    JsonFile, // Для удобства разработки и тестирования
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KafkaConfig {
    pub broker: String,
    pub topic: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeFilter {
    pub start_time: Option<DateTime<Utc>>,
    pub end_time: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParserConfig {
    pub name: String,
    pub datetime_regex: String,
    pub datetime_format: String,
    pub symbol_regex: String,          // Инструмент
    pub corridor_id_regex: String,     // ID коридора (опционально)
    pub event_type_regex: String,      // Тип события
    pub timeframe_regex: String,
    pub open_regex: String,
    pub high_regex: String,
    pub low_regex: String,
    pub close_regex: String,
    pub volume_regex: String,
    pub timezone: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DataSourceConfig {
    pub source_type: DataSourceType,
    pub file_path: Option<String>,
    pub kafka_config: Option<KafkaConfig>,
    pub parser_config: ParserConfig,
    pub time_filter: TimeFilter,
}