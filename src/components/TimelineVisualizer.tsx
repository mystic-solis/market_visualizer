import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

interface Event {
  id: string;
  timestamp: string;
  instrument: string;
  corridor_id?: string;
  event_type: string;
  value: string;
}

interface CorridorGroup {
  id: string;
  corridor_id: string;
  events: string[];
  instrument: string;
  color: string;
}

interface Connection {
  from_id: string;
  to_id: string;
  connection_type: string;
}

interface Stats {
  total_events: number;
  total_corridors: number;
  total_deals: number;
  events_by_type: Record<string, number>;
  events_by_instrument: Record<string, number>;
  time_range: [string, string];
}

interface TimelineData {
  events: Event[];
  corridor_groups: CorridorGroup[];
  connections: Connection[];
  deals: Event[];
  stats: Stats;
}

interface RowData {
  type: 'corridor' | 'deals';
  corridorId?: string;
  events: Event[];
}

interface TimelineVisualizerProps {
  data: TimelineData;
  activeInstruments: Set<string>;
  activeTypes: Set<string>;
}

const colors: Record<string, string> = {
  CR: '#2563eb',
  SG: '#16a34a',
  TC: '#dc2626',
  RK: '#f97316',
  TA: '#8b5cf6',
  DEAL: '#facc15'
};

function getEventTypeColor(type: string): string {
  switch (type) {
    case 'Corridors': return colors.CR;
    case 'Signals': return colors.SG;
    case 'Touchs': return colors.TC;
    case 'Risks': return colors.RK;
    case 'Tactics': return colors.TA;
    case 'Deals': return colors.DEAL;
    default: return '#888';
  }
}

function getTypeLabel(eventType: string): string {
  return eventType;
}

const TimelineVisualizer: React.FC<TimelineVisualizerProps> = ({ data, activeInstruments, activeTypes }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgHeight, setSvgHeight] = useState(500);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || data.events.length === 0) return;

    // Фильтрация данных
    const filteredEvents = data.events.filter(e =>
      activeInstruments.has(e.instrument) && activeTypes.has(getTypeLabel(e.event_type))
    );
    const filteredDeals = data.deals.filter(e =>
      activeInstruments.has(e.instrument) && activeTypes.has('Deals')
    );

    // Очистка предыдущего SVG
    d3.select(svgRef.current).selectAll('*').remove();

    const containerWidth = containerRef.current.clientWidth || 1200;

    const margin = { top: 40, right: 40, bottom: 50, left: 80 };
    const innerWidth = containerWidth - margin.left - margin.right;

    // Получаем временной диапазон
    const allTimes: Date[] = [];
    filteredEvents.forEach(e => allTimes.push(new Date(e.timestamp)));
    filteredDeals.forEach(e => allTimes.push(new Date(e.timestamp)));

    if (allTimes.length === 0) return;

    const minTime = new Date(Math.min(...allTimes.map(t => t.getTime())));
    const maxTime = new Date(Math.max(...allTimes.map(t => t.getTime())));
    const range = maxTime.getTime() - minTime.getTime();
    const padding = range * 0.05 || 5 * 60 * 1000;
    const timeStart = new Date(minTime.getTime() - padding);
    const timeEnd = new Date(maxTime.getTime() + padding);

    const xScale = d3.scaleTime()
      .domain([timeStart, timeEnd])
      .range([0, innerWidth]);

    // Создаем строки для коридоров и сделок
    const rows: RowData[] = [];

    data.corridor_groups.forEach(c => {
      const corridorEvents = filteredEvents.filter(e => e.corridor_id === c.corridor_id);
      if (corridorEvents.length > 0) {
        rows.push({ type: 'corridor', corridorId: c.corridor_id, events: corridorEvents });
      }
    });

    if (filteredDeals.length > 0) {
      rows.push({ type: 'deals', events: filteredDeals });
    }

    const rowHeight = 60;
    const totalRows = rows.length;
    const totalHeight = totalRows * rowHeight;
    const calculatedHeight = Math.max(500, totalHeight + margin.top + margin.bottom + 60);
    setSvgHeight(calculatedHeight);

    const svg = d3.select(svgRef.current)
      .attr('viewBox', `0 0 ${containerWidth} ${calculatedHeight}`)
      .style('width', '100%')
      .style('height', 'auto');

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Сетка и оси
    const xAxis = d3.axisBottom(xScale as any)
      .ticks(d3.timeMinute.every(10))
      .tickFormat(d3.timeFormat('%H:%M'))
      .tickSizeOuter(0);

    g.append('g')
      .attr('class', 'axis')
      .attr('transform', `translate(0, ${totalHeight + 10})`)
      .call(xAxis as any);

    const gridLines = g.append('g').attr('class', 'grid');
    const tickValues = xScale.ticks(d3.timeMinute.every(10));
    tickValues.forEach((t: Date) => {
      const x = xScale(t) ?? 0;
      gridLines.append('line')
        .attr('x1', x)
        .attr('y1', 0)
        .attr('x2', x)
        .attr('y2', totalHeight)
        .attr('stroke', '#e9edf2')
        .attr('stroke-dasharray', '3,3');
    });

    // Строки
    const rowGroups = g.selectAll('.row')
      .data(rows)
      .enter()
      .append('g')
      .attr('class', 'row')
      .attr('transform', (_d: RowData, i: number) => `translate(0, ${i * rowHeight})`);

    // Маркер стрелки
    if (!svg.select('defs').size()) {
      const defs = svg.append('defs');
      defs.append('marker')
        .attr('id', 'arrowhead')
        .attr('markerWidth', 8)
        .attr('markerHeight', 6)
        .attr('refX', 8)
        .attr('refY', 3)
        .attr('orient', 'auto')
        .append('polygon')
        .attr('points', '0 0, 8 3, 0 6')
        .attr('fill', '#94a3b8');
    }

    // Хранилище для тултипов и выделений
    let currentTooltip: HTMLElement | null = null;
    let hoveredElement: any = null;

    const showTooltip = (event: any, element: any, details: string) => {
      currentTooltip = document.getElementById('tooltip');
      if (currentTooltip) {
        currentTooltip.innerHTML = details;
        currentTooltip.classList.remove('hidden');

        const container = document.getElementById('vis-container');
        if (container) {
          const [tx, ty] = d3.pointer(event, container);
          currentTooltip.style.left = (tx + 12) + 'px';
          currentTooltip.style.top = (ty - 40) + 'px';
        }

        hoveredElement = element;
        hoveredElement.attr('stroke', '#000').attr('stroke-width', 2);
      }
    };

    const hideTooltip = () => {
      const tooltipDiv = document.getElementById('tooltip');
      if (tooltipDiv) {
        tooltipDiv.classList.add('hidden');
      }
      if (hoveredElement) {
        hoveredElement.attr('stroke', 'white').attr('stroke-width', 1.5);
        hoveredElement = null;
      }
    };

    // Коридоры
    const corridorGroups = rowGroups.filter((d: RowData) => d.type === 'corridor');
    corridorGroups.each(function(this: any, d: RowData) {
      const group = d3.select(this);
      const events = d.events;
      const corridorId = d.corridorId || '';

      if (events.length === 0) return;

      const firstX = xScale(new Date(events[0].timestamp)) ?? 0;
      const lastX = xScale(new Date(events[events.length-1].timestamp)) ?? 0;

      group.append('line')
        .attr('class', 'corridor-line')
        .attr('x1', firstX)
        .attr('y1', rowHeight/2)
        .attr('x2', lastX)
        .attr('y2', rowHeight/2);

      for (let i = 0; i < events.length - 1; i++) {
        const fromTime = new Date(events[i].timestamp);
        const toTime = new Date(events[i+1].timestamp);
        const x1 = xScale(fromTime) ?? 0;
        const x2 = xScale(toTime) ?? 0;
        const y = rowHeight/2;

        group.append('line')
          .attr('class', 'connection-line')
          .attr('x1', x1)
          .attr('y1', y)
          .attr('x2', x2)
          .attr('y2', y)
          .attr('marker-end', 'url(#arrowhead)');
      }

      group.append('text')
        .attr('class', 'corridor-label')
        .attr('x', -10)
        .attr('y', rowHeight/2 + 5)
        .attr('text-anchor', 'end')
        .text(corridorId);

      events.forEach((ev: Event) => {
        const time = new Date(ev.timestamp);
        const x = xScale(time) ?? 0;
        const y = rowHeight/2;
        const color = getEventTypeColor(ev.event_type);
        const typeLabel = getTypeLabel(ev.event_type);

        const circleSel = group.append('circle')
          .attr('class', 'event-circle')
          .attr('cx', x)
          .attr('cy', y)
          .attr('r', 7)
          .attr('fill', color)
          .attr('stroke', 'white')
          .attr('stroke-width', 1.5)
          .attr('data-id', ev.id)
          .attr('data-type', ev.event_type)
          .attr('data-instrument', ev.instrument)
          .attr('data-value', ev.value)
          .attr('data-corridor', ev.corridor_id || 'N/A');

        const tooltipDetails = `
          <div><strong>Событие</strong> <span class="type-badge">${typeLabel}</span></div>
          <div>Время: ${d3.timeFormat('%H:%M:%S')(time)}</div>
          <div>Инструмент: ${ev.instrument}</div>
          <div>Значение: ${ev.value}</div>
          ${ev.corridor_id ? `<div>Коридор: ${ev.corridor_id}</div>` : ''}
        `;

        circleSel
          .on('mouseover', function(this: SVGCircleElement, event: any) {
            showTooltip(event, d3.select(this), tooltipDetails);
          })
          .on('mouseout', function() {
            hideTooltip();
          });

        group.append('text')
          .attr('x', x)
          .attr('y', y - 12)
          .attr('text-anchor', 'middle')
          .style('font-size', '9px')
          .style('font-weight', '600')
          .style('fill', '#1e293b')
          .style('pointer-events', 'none')
          .text(typeLabel);
      });
    });

    // Сделки
    const dealsGroup = rowGroups.filter((d: RowData) => d.type === 'deals');
    dealsGroup.each(function(this: any, d: RowData) {
      const group = d3.select(this);
      const events = d.events;

      if (events.length === 0) return;

      group.append('text')
        .attr('class', 'corridor-label')
        .attr('x', -10)
        .attr('y', rowHeight/2 + 5)
        .attr('text-anchor', 'end')
        .text('DEALS')
        .style('fill', colors.DEAL);

      const firstX = xScale(new Date(events[0].timestamp)) ?? 0;
      const lastX = xScale(new Date(events[events.length-1].timestamp)) ?? 0;

      group.append('line')
        .attr('class', 'corridor-line')
        .attr('x1', firstX)
        .attr('y1', rowHeight/2)
        .attr('x2', lastX)
        .attr('y2', rowHeight/2)
        .style('stroke-dasharray', '2,4')
        .style('stroke', '#94a3b8');

      events.forEach((ev: Event) => {
        const time = new Date(ev.timestamp);
        const x = xScale(time) ?? 0;
        const y = rowHeight/2;
        const color = colors.DEAL || '#facc15';
        const size = 8;

        const points = [
          [x, y - size],
          [x + size, y],
          [x, y + size],
          [x - size, y]
        ].map(p => p.join(',')).join(' ');

        const diamondSel = group.append('polygon')
          .attr('class', 'deal-diamond')
          .attr('points', points)
          .attr('fill', color)
          .attr('stroke', 'white')
          .attr('stroke-width', 1.5)
          .attr('data-id', ev.id)
          .attr('data-type', 'Deals')
          .attr('data-instrument', ev.instrument)
          .attr('data-value', ev.value);

        const tooltipDetails = `
          <div><strong>Сделка</strong> <span class="type-badge">Deals</span></div>
          <div>Время: ${d3.timeFormat('%H:%M:%S')(time)}</div>
          <div>Инструмент: ${ev.instrument}</div>
          <div>Значение: ${ev.value}</div>
        `;

        diamondSel
          .on('mouseover', function(this: SVGPolygonElement, event: any) {
            showTooltip(event, d3.select(this), tooltipDetails);
          })
          .on('mouseout', function() {
            hideTooltip();
          });

        group.append('text')
          .attr('x', x)
          .attr('y', y + 18)
          .attr('text-anchor', 'middle')
          .style('font-size', '9px')
          .style('font-weight', '500')
          .style('fill', '#475569')
          .style('pointer-events', 'none')
          .text(ev.instrument);
      });
    });

  }, [data, activeInstruments, activeTypes]);

  return (
    <div className="vis-content" ref={containerRef}>
      <svg id="timeline-svg" width="100%" height={svgHeight} ref={svgRef}></svg>
    </div>
  );
};

export default TimelineVisualizer;
