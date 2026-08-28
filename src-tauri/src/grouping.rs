use crate::models::{Connection, ConnectionType, CorridorGroup, Instrument, LogEvent, TimelineData, TimelineStats};
use chrono::{DateTime, Utc};
use std::collections::HashMap;
use uuid::Uuid;

pub struct GroupingEngine;

impl GroupingEngine {
    pub fn group_events(events: Vec<LogEvent>) -> TimelineData {
        // Разделяем на коридоры и сделки
        let total_events = events.len();
        let mut corridors_map: HashMap<String, Vec<LogEvent>> = HashMap::new();
        let mut deals: Vec<LogEvent> = Vec::new();
        
        for event in &events {
            if let Some(corridor_id) = &event.corridor_id {
                corridors_map.entry(corridor_id.clone()).or_default().push(event.clone());
            } else {
                deals.push(event.clone());
            }
        }

        // Сортируем события в каждом коридоре по времени
        for corridor_events in corridors_map.values_mut() {
            corridor_events.sort_by_key(|e| e.timestamp);
        }

        // Создаем группы коридоров и связи между событиями
        let mut corridor_groups: Vec<CorridorGroup> = Vec::new();
        let mut connections: Vec<Connection> = Vec::new();

        for (corridor_id, corridor_events) in &corridors_map {
            let group_id = Uuid::new_v4().to_string();
            
            // Определяем инструмент из первого события в коридоре
            let instrument = corridor_events.first().map_or(Instrument::EURUSD, |e| e.instrument.clone());
            
            // Выбираем цвет на основе типа события или инструмента
            let color = Self::get_corridor_color(&instrument);
            
            let event_ids: Vec<String> = corridor_events.iter().map(|e| e.id.clone()).collect();
            
            let group = CorridorGroup {
                id: group_id,
                corridor_id: corridor_id.clone(),
                events: event_ids,
                instrument: instrument.clone(),
                color: color.to_string(),
            };
            corridor_groups.push(group);

            // Создаем связи между соседними событиями
            for i in 0..corridor_events.len().saturating_sub(1) {
                connections.push(Connection {
                    from_id: corridor_events[i].id.clone(),
                    to_id: corridor_events[i + 1].id.clone(),
                    connection_type: ConnectionType::Sequence,
                });
            }
        }

        // Считаем статистику
        let total_events = events.len();
        let total_corridors = corridors_map.len();
        let total_deals = deals.len();

        let mut events_by_type: HashMap<String, usize> = HashMap::new();
        let mut events_by_instrument: HashMap<String, usize> = HashMap::new();
        
        let mut min_time = None;
        let mut max_time = None;

        for event in &events {
            // Подсчет по типам событий
            let type_name = Self::event_type_to_string(&event.event_type);
            *events_by_type.entry(type_name).or_insert(0) += 1;
            
            // Подсчет по инструментам
            let instrument_name = Self::instrument_to_string(&event.instrument);
            *events_by_instrument.entry(instrument_name).or_insert(0) += 1;
            
            // Диапазон времени
            if min_time.is_none() || event.timestamp < min_time.unwrap() {
                min_time = Some(event.timestamp);
            }
            if max_time.is_none() || event.timestamp > max_time.unwrap() {
                max_time = Some(event.timestamp);
            }
        }

        let time_range = match (min_time, max_time) {
            (Some(start), Some(end)) => (start, end),
            _ => (Utc::now(), Utc::now()),
        };

        TimelineData {
            events,
            corridor_groups,
            connections,
            deals,
            candles: Vec::new(),
            stats: TimelineStats {
                total_events,
                total_corridors,
                total_deals,
                events_by_type: serde_json::to_value(events_by_type).unwrap_or_default(),
                events_by_instrument: serde_json::to_value(events_by_instrument).unwrap_or_default(),
                time_range,
            },
        }
    }

    fn get_corridor_color(instrument: &Instrument) -> &'static str {
        match instrument {
            Instrument::EURUSD => "#2563eb", // синий
            Instrument::GBPUSD => "#16a34a", // зеленый
            Instrument::BTCUSD => "#f97316", // оранжевый
        }
    }

    fn event_type_to_string(event_type: &crate::models::EventType) -> String {
        match event_type {
            crate::models::EventType::Deals => "Deals".to_string(),
            crate::models::EventType::Corridors => "Corridors".to_string(),
            crate::models::EventType::Signals => "Signals".to_string(),
            crate::models::EventType::Touchs => "Touchs".to_string(),
            crate::models::EventType::Tactics => "Tactics".to_string(),
            crate::models::EventType::Risks => "Risks".to_string(),
            crate::models::EventType::Service => "Service".to_string(),
            crate::models::EventType::Specifications => "Specifications".to_string(),
        }
    }

    fn instrument_to_string(instrument: &Instrument) -> String {
        match instrument {
            Instrument::EURUSD => "EURUSD".to_string(),
            Instrument::GBPUSD => "GBPUSD".to_string(),
            Instrument::BTCUSD => "BTCUSD".to_string(),
        }
    }
}