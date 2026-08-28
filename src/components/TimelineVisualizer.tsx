import { useEffect, useRef, useState, useCallback } from 'react';
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

interface TimelineData {
  events: Event[];
  corridor_groups: CorridorGroup[];
  deals: Event[];
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
  brushDomain?: [Date, Date] | null;
}

const colors: Record<string, string> = {
  Corridors: '#2563eb',
  Signals: '#eab308',
  Touchs: '#dc2626',
  Risks: '#f97316',
  Tactics: '#8b5cf6',
  Deals: '#22c55e'
};

const ROW_HEIGHT = 60;
const MIN_TIME_ZOOM = 0.5;
const MAX_TIME_ZOOM = 50;

function getEventTypeColor(type: string): string {
  return colors[type] || '#888';
}

function getTypeLabel(eventType: string): string {
  return eventType;
}

const TimelineVisualizer: React.FC<TimelineVisualizerProps> = ({ data, activeInstruments, activeTypes, brushDomain }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1200);
  const [timeZoom, setTimeZoom] = useState(1);
  const [timePan, setTimePan] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startPan: 0 });

  // Track container width
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(Math.max(entry.contentRect.width, 400));
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Filter and group data
  const filteredEvents = data.events.filter(e =>
    activeInstruments.has(e.instrument) && activeTypes.has(getTypeLabel(e.event_type))
  );
  const filteredDeals = data.deals.filter(e =>
    activeInstruments.has(e.instrument) && activeTypes.has('Deals')
  );

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

  const svgHeight = rows.length * ROW_HEIGHT;

  // Compute time domain
  const allTimes: Date[] = [];
  rows.forEach(r => r.events.forEach(e => allTimes.push(new Date(e.timestamp))));
  let minTime: Date, maxTime: Date;
  if (allTimes.length === 0) {
    minTime = new Date();
    maxTime = new Date(minTime.getTime() + 3600000);
  } else if (brushDomain) {
    minTime = brushDomain[0];
    maxTime = brushDomain[1];
  } else {
    minTime = new Date(Math.min(...allTimes.map(t => t.getTime())));
    maxTime = new Date(Math.max(...allTimes.map(t => t.getTime())));
    const range = maxTime.getTime() - minTime.getTime();
    const padding = range * 0.05 || 5 * 60 * 1000;
    minTime = new Date(minTime.getTime() - padding);
    maxTime = new Date(maxTime.getTime() + padding);
  }

  const baseTimeRange = maxTime.getTime() - minTime.getTime();
  const margin = { top: 40, right: 40, bottom: 50, left: 80 };
  const innerWidth = containerWidth - margin.left - margin.right;

  // Visible time range
  const visibleRange = baseTimeRange / timeZoom;
  const centerTime = minTime.getTime() + baseTimeRange / 2 + timePan;
  const viewMinTime = new Date(centerTime - visibleRange / 2);
  const viewMaxTime = new Date(centerTime + visibleRange / 2);

  const xScale = d3.scaleTime().domain([viewMinTime, viewMaxTime]).range([0, innerWidth]);

  // Reset zoom/pan
  const resetView = useCallback(() => {
    setTimeZoom(1);
    setTimePan(0);
  }, []);

  // Zoom in/out
  const zoomIn = useCallback(() => {
    setTimeZoom(prev => Math.min(MAX_TIME_ZOOM, prev * 1.3));
  }, []);

  const zoomOut = useCallback(() => {
    setTimeZoom(prev => Math.max(MIN_TIME_ZOOM, prev / 1.3));
  }, []);

  // Wheel handler
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) return;
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left - margin.left;
      const mouseTime = xScale.invert(mouseX).getTime();
      
      if (e.shiftKey) {
        const pixelsPerMs = innerWidth / visibleRange;
        const timeDelta = -e.deltaY / pixelsPerMs;
        setTimePan(prev => prev + timeDelta);
      } else {
        const zoomFactor = e.deltaY > 0 ? 0.85 : 1.18;
        const newZoom = Math.max(MIN_TIME_ZOOM, Math.min(MAX_TIME_ZOOM, timeZoom * zoomFactor));
        const newCenterTime = mouseTime + (centerTime - mouseTime) * (newZoom / timeZoom);
        const newPan = newCenterTime - (minTime.getTime() + baseTimeRange / 2);
        setTimeZoom(newZoom);
        setTimePan(newPan);
      }
    };
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [timeZoom, timePan, containerWidth, visibleRange, innerWidth, centerTime, minTime, baseTimeRange]);

  // Drag handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - dragRef.current.startX;
      const pixelsPerMs = innerWidth / visibleRange;
      const timeDelta = -deltaX / pixelsPerMs;
      setTimePan(dragRef.current.startPan + timeDelta);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, innerWidth, visibleRange]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as Element;
    if (target.closest('.event-circle, .deal-diamond, .connection-line, .corridor-line')) return;
    dragRef.current = { startX: e.clientX, startPan: timePan };
    setIsDragging(true);
  }, [timePan]);

  // Draw SVG
  useEffect(() => {
    if (!svgRef.current || rows.length === 0) return;
    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3.select(svgRef.current)
      .attr('width', containerWidth)
      .attr('height', svgHeight)
      .style('display', 'block');

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Grid lines
    const gridLines = g.append('g').attr('class', 'grid');
    xScale.ticks(d3.timeMinute.every(10)).forEach((t: Date) => {
      const x = xScale(t) ?? 0;
      gridLines.append('line')
        .attr('x1', x).attr('x2', x)
        .attr('y1', 0).attr('y2', svgHeight - margin.top - margin.bottom)
        .attr('stroke', '#e9edf2').attr('stroke-dasharray', '3,3');
    });

    // X axis
    g.append('g').attr('class', 'axis')
      .attr('transform', `translate(0, ${svgHeight - margin.top - margin.bottom})`)
      .call(d3.axisBottom(xScale).ticks(Math.floor(innerWidth / 80)).tickFormat(d3.timeFormat('%H:%M')));

    // Horizontal row lines
    const hGridLines = g.append('g').attr('class', 'h-grid');
    rows.forEach((_r, i) => {
      const y = i * ROW_HEIGHT + ROW_HEIGHT / 2;
      hGridLines.append('line')
        .attr('x1', 0).attr('x2', innerWidth)
        .attr('y1', y).attr('y2', y)
        .attr('stroke', '#f1f5f9').attr('stroke-dasharray', '2,4');
    });

    // Arrow marker
    const defs = svg.append('defs');
    defs.append('marker')
      .attr('id', 'arrowhead')
      .attr('markerWidth', 8).attr('markerHeight', 6)
      .attr('refX', 8).attr('refY', 3).attr('orient', 'auto')
      .append('polygon').attr('points', '0 0, 8 3, 0 6').attr('fill', '#94a3b8');

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
      if (tooltipDiv) tooltipDiv.classList.add('hidden');
      if (hoveredElement) {
        hoveredElement.attr('stroke', 'white').attr('stroke-width', 1.5);
        hoveredElement = null;
      }
    };

    // Draw rows
    const rowGroups = g.selectAll('.row').data(rows).enter().append('g')
      .attr('class', 'row')
      .attr('transform', (_d: RowData, i: number) => `translate(0, ${i * ROW_HEIGHT})`);

    // Corridors
    rowGroups.filter((d: RowData) => d.type === 'corridor').each(function(this: any, d: RowData) {
      const group = d3.select(this);
      const events = d.events;
      const corridorId = d.corridorId || '';
      const y = ROW_HEIGHT / 2;
      const circleR = 7;

      const firstX = xScale(new Date(events[0].timestamp)) ?? 0;
      const lastX = xScale(new Date(events[events.length - 1].timestamp)) ?? 0;

      group.append('line').attr('class', 'corridor-line')
        .attr('x1', firstX).attr('x2', lastX).attr('y1', y).attr('y2', y);

      for (let i = 0; i < events.length - 1; i++) {
        const x1 = xScale(new Date(events[i].timestamp)) ?? 0;
        const x2 = xScale(new Date(events[i + 1].timestamp)) ?? 0;
        group.append('line').attr('class', 'connection-line')
          .attr('x1', x1).attr('y1', y).attr('x2', x2).attr('y2', y)
          .attr('marker-end', 'url(#arrowhead)');
      }

      group.append('text').attr('class', 'corridor-label')
        .attr('x', -10).attr('y', y + 5).attr('text-anchor', 'end').text(corridorId);

      events.forEach((ev: Event) => {
        const time = new Date(ev.timestamp);
        const x = xScale(time) ?? 0;
        const color = getEventTypeColor(ev.event_type);
        const typeLabel = getTypeLabel(ev.event_type);

        const circleSel = group.append('circle').attr('class', 'event-circle')
          .attr('cx', x).attr('cy', y).attr('r', circleR)
          .attr('fill', color).attr('stroke', 'white').attr('stroke-width', 1.5)
          .attr('data-id', ev.id).attr('data-type', ev.event_type)
          .attr('data-instrument', ev.instrument).attr('data-value', ev.value);

        const tooltipDetails = `
          <div><strong>Событие</strong> <span class="type-badge">${typeLabel}</span></div>
          <div>Время: ${d3.timeFormat('%H:%M:%S')(time)}</div>
          <div>Инструмент: ${ev.instrument}</div>
          <div>Значение: ${ev.value}</div>
          ${ev.corridor_id ? `<div>Коридор: ${ev.corridor_id}</div>` : ''}
        `;

        circleSel.on('mouseover', function(this: SVGCircleElement, event: any) {
          showTooltip(event, d3.select(this), tooltipDetails);
        }).on('mouseout', hideTooltip);

        group.append('text').attr('x', x).attr('y', y - circleR - 3)
          .attr('text-anchor', 'middle')
          .style('font-size', '9px').style('font-weight', '600')
          .style('fill', '#1e293b').style('pointer-events', 'none').text(typeLabel);
      });
    });

    // Deals
    rowGroups.filter((d: RowData) => d.type === 'deals').each(function(this: any, d: RowData) {
      const group = d3.select(this);
      const events = d.events;
      const y = ROW_HEIGHT / 2;
      const diamondSize = 8;

      group.append('text').attr('class', 'corridor-label')
        .attr('x', -10).attr('y', y + 5).attr('text-anchor', 'end')
        .text('DEALS').style('fill', colors.Deals);

      const firstX = xScale(new Date(events[0].timestamp)) ?? 0;
      const lastX = xScale(new Date(events[events.length - 1].timestamp)) ?? 0;

      group.append('line').attr('class', 'corridor-line')
        .attr('x1', firstX).attr('x2', lastX).attr('y1', y).attr('y2', y)
        .style('stroke-dasharray', '2,4').style('stroke', '#94a3b8');

      events.forEach((ev: Event) => {
        const time = new Date(ev.timestamp);
        const x = xScale(time) ?? 0;

        const points = [
          [x, y - diamondSize], [x + diamondSize, y],
          [x, y + diamondSize], [x - diamondSize, y]
        ].map(p => p.join(',')).join(' ');

        const diamondSel = group.append('polygon').attr('class', 'deal-diamond')
          .attr('points', points).attr('fill', colors.Deals)
          .attr('stroke', 'white').attr('stroke-width', 1.5)
          .attr('data-id', ev.id).attr('data-type', 'Deals')
          .attr('data-instrument', ev.instrument).attr('data-value', ev.value);

        const tooltipDetails = `
          <div><strong>Сделка</strong> <span class="type-badge">Deals</span></div>
          <div>Время: ${d3.timeFormat('%H:%M:%S')(time)}</div>
          <div>Инструмент: ${ev.instrument}</div>
          <div>Значение: ${ev.value}</div>
        `;

        diamondSel.on('mouseover', function(this: SVGPolygonElement, event: any) {
          showTooltip(event, d3.select(this), tooltipDetails);
        }).on('mouseout', hideTooltip);

        group.append('text').attr('x', x).attr('y', y + diamondSize + 10)
          .attr('text-anchor', 'middle')
          .style('font-size', '9px').style('font-weight', '500')
          .style('fill', '#475569').style('pointer-events', 'none').text(ev.instrument);
      });
    });

  }, [data, activeInstruments, activeTypes, brushDomain, containerWidth, timeZoom, timePan, svgHeight, rows, minTime, maxTime, baseTimeRange, viewMinTime, viewMaxTime, innerWidth]);

  return (
    <div 
      ref={containerRef}
      style={{ 
        height: '100%', 
        overflowY: 'auto', 
        overflowX: 'hidden',
        cursor: isDragging ? 'grabbing' : 'default',
        position: 'relative',
        userSelect: 'none'
      }}
      onMouseDown={handleMouseDown}
    >
      <svg ref={svgRef} id="timeline-svg" style={{ touchAction: 'none' }}></svg>
      
      {/* Zoom controls */}
      <div style={{
        position: 'absolute',
        top: 10,
        right: 10,
        display: 'flex',
        gap: 4,
        background: 'rgba(255,255,255,0.9)',
        borderRadius: 6,
        padding: 4,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <button onClick={zoomOut} title="Zoom out" style={{
          width: 28, height: 28, border: '1px solid #e2e8f0', borderRadius: 4,
          background: 'white', cursor: 'pointer', fontSize: 16, display: 'flex',
          alignItems: 'center', justifyContent: 'center'
        }}>−</button>
        <span style={{
          minWidth: 40, textAlign: 'center', fontSize: 11, color: '#64748b',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>{timeZoom.toFixed(1)}x</span>
        <button onClick={zoomIn} title="Zoom in" style={{
          width: 28, height: 28, border: '1px solid #e2e8f0', borderRadius: 4,
          background: 'white', cursor: 'pointer', fontSize: 16, display: 'flex',
          alignItems: 'center', justifyContent: 'center'
        }}>+</button>
        <button onClick={resetView} title="Reset view" style={{
          width: 28, height: 28, border: '1px solid #e2e8f0', borderRadius: 4,
          background: 'white', cursor: 'pointer', fontSize: 12, display: 'flex',
          alignItems: 'center', justifyContent: 'center'
        }}>⟲</button>
      </div>
    </div>
  );
};

export default TimelineVisualizer;
