import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

interface CandleData {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface CandlestickChartProps {
  data: CandleData[];
  width: number;
  height: number;
  onBrush?: (domain: [Date, Date] | null) => void;
  brushDomain?: [Date, Date] | null;
  instrument: string;
  onScroll?: (scrollLeft: number) => void;
  scrollLeft?: number;
}

const CandlestickChart = ({ data, width, height, onBrush, brushDomain, instrument, onScroll, scrollLeft }: CandlestickChartProps) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; candle: CandleData } | null>(null);
  const [crosshair, setCrosshair] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!svgRef.current || !gRef.current || data.length === 0) return;

    const g = d3.select(gRef.current);
    g.selectAll('*').remove();

    const margin = { top: 40, right: 40, bottom: 50, left: 80 };
    const chartWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const xScale = d3.scaleTime()
      .domain(d3.extent(data, (d: CandleData) => d.date) as [Date, Date])
      .range([0, chartWidth]);

    const yMin = d3.min(data, (d: CandleData) => d.low) || 0;
    const yMax = d3.max(data, (d: CandleData) => d.high) || 100;
    const yPadding = (yMax - yMin) * 0.1;
    const yScale = d3.scaleLinear()
      .domain([yMin - yPadding, yMax + yPadding])
      .range([innerHeight, 0]);

    // Grid
    const gridLines = g.append('g').attr('class', 'grid');
    yScale.ticks(5).forEach((tick: number) => {
      gridLines.append('line')
        .attr('x1', 0)
        .attr('x2', chartWidth)
        .attr('y1', yScale(tick))
        .attr('y2', yScale(tick))
        .attr('stroke', '#e9edf2')
        .attr('stroke-dasharray', '3,3');
    });

    // Candles
    const candleWidthScaled = Math.max(2, chartWidth / data.length * 0.7);

    const candles = g.selectAll('.candle')
      .data(data)
      .enter()
      .append('g')
      .attr('class', 'candle')
      .attr('transform', (d: CandleData) => `translate(${xScale(d.date)}, 0)`);

    candles.append('line')
      .attr('x1', 0)
      .attr('x2', 0)
      .attr('y1', (d: CandleData) => yScale(d.high))
      .attr('y2', (d: CandleData) => yScale(d.low))
      .attr('stroke', (d: CandleData) => d.close >= d.open ? '#22c55e' : '#ef4444')
      .attr('stroke-width', 1);

    candles.append('rect')
      .attr('x', -candleWidthScaled / 2)
      .attr('width', candleWidthScaled)
      .attr('y', (d: CandleData) => yScale(Math.max(d.open, d.close)))
      .attr('height', (d: CandleData) => Math.max(1, Math.abs(yScale(d.open) - yScale(d.close))))
      .attr('fill', (d: CandleData) => d.close >= d.open ? '#22c55e' : '#ef4444')
      .attr('stroke', (d: CandleData) => d.close >= d.open ? '#16a34a' : '#dc2626')
      .attr('stroke-width', 0.5)
      .style('cursor', 'pointer')
      .on('mouseenter', function(event: MouseEvent, d: CandleData) {
        const [mx, my] = d3.pointer(event, containerRef.current);
        setTooltip({ x: mx, y: my, candle: d });
        d3.select(this).attr('stroke-width', 2);
      })
      .on('mouseleave', function() {
        setTooltip(null);
        d3.select(this).attr('stroke-width', 0.5);
      });

    // Y axis
    g.append('g').attr('class', 'axis')
      .call(d3.axisLeft(yScale).ticks(5).tickFormat((d: number | { valueOf(): number }) => {
        const val = typeof d === 'number' ? d : d.valueOf();
        return val >= 10000 ? (val / 1000).toFixed(0) + 'k' : val.toFixed(2);
      }));

    // X axis
    g.append('g').attr('class', 'axis')
      .attr('transform', `translate(0, ${innerHeight})`)
      .call(d3.axisBottom(xScale).ticks(Math.floor(chartWidth / 80)).tickFormat(d3.timeFormat('%H:%M')));

    // Crosshair group
    const crosshairG = g.append('g').attr('class', 'crosshair').style('display', 'none');
    crosshairG.append('line').attr('class', 'crosshair-x').attr('y1', 0).attr('y2', innerHeight).attr('stroke', '#64748b').attr('stroke-dasharray', '3,3').attr('stroke-width', 1);
    crosshairG.append('line').attr('class', 'crosshair-y').attr('x1', 0).attr('x2', chartWidth).attr('stroke', '#64748b').attr('stroke-dasharray', '3,3').attr('stroke-width', 1);

    // Price label on right
    const priceLabel = g.append('g').attr('class', 'price-label').style('display', 'none');
    priceLabel.append('rect').attr('x', chartWidth + 5).attr('y', -10).attr('width', 50).attr('height', 18).attr('fill', '#0f172a').attr('rx', '3');
    priceLabel.append('text').attr('x', chartWidth + 10).attr('y', 3).attr('fill', '#fff').style('font-size', '11px');

    // Mouse events for crosshair
    const overlay = g.append('rect')
      .attr('width', chartWidth)
      .attr('height', innerHeight)
      .attr('fill', 'transparent')
      .style('cursor', 'crosshair');

    overlay.on('mousemove', (event: MouseEvent) => {
      const [mx, my] = d3.pointer(event, gRef.current);
      setCrosshair({ x: mx, y: my });
      crosshairG.style('display', null);
      crosshairG.select('.crosshair-x').attr('x1', mx).attr('x2', mx);
      crosshairG.select('.crosshair-y').attr('y1', my).attr('y2', my);
      
      const price = yScale.invert(my);
      priceLabel.style('display', null);
      priceLabel.select('text').text(price.toFixed(4));
      priceLabel.attr('transform', `translate(0, ${my - 10})`);
    });

    overlay.on('mouseleave', () => {
      setCrosshair(null);
      crosshairG.style('display', 'none');
      priceLabel.style('display', 'none');
    });

    // Brush for zoom
    if (onBrush) {
      const brush = d3.brushX()
        .extent([[0, 0], [chartWidth, innerHeight]])
        .on('end', (event: any) => {
          if (!event.selection) { onBrush(null); return; }
          const sel = event.selection as [number, number];
          onBrush([xScale.invert(sel[0]), xScale.invert(sel[1])]);
        });
      g.append('g').attr('class', 'brush').call(brush);
    }

  }, [data, width, height, brushDomain, onBrush, instrument]);

  useEffect(() => {
    if (containerRef.current && scrollLeft !== undefined) {
      containerRef.current.scrollLeft = scrollLeft;
    }
  }, [scrollLeft]);

  const handleScroll = () => {
    if (containerRef.current && onScroll) {
      onScroll(containerRef.current.scrollLeft);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleString('ru-RU', { 
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit' 
    });
  };

  return (
    <div 
      ref={containerRef}
      className="candlestick-container"
      onScroll={handleScroll}
    >
      <svg ref={svgRef} width={width} height={height} className="candlestick-chart">
        <text x={10} y={15} className="chart-title">
          {instrument} — свечи (прокрутите для просмотра)
        </text>
        <g ref={gRef} transform={`translate(${80}, ${40})`} />
      </svg>
      
      {tooltip && (
        <div 
          className="candlestick-tooltip"
          style={{
            left: tooltip.x + 10,
            top: tooltip.y - 10,
            position: 'absolute',
            background: '#0f172a',
            color: '#f1f5f9',
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            pointerEvents: 'none',
            zIndex: 100,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{formatDate(tooltip.candle.date)}</div>
          <div>O: {tooltip.candle.open.toFixed(4)}</div>
          <div>H: {tooltip.candle.high.toFixed(4)}</div>
          <div>L: {tooltip.candle.low.toFixed(4)}</div>
          <div>C: {tooltip.candle.close.toFixed(4)}</div>
          <div style={{ color: tooltip.candle.close >= tooltip.candle.open ? '#22c55e' : '#ef4444' }}>
            {tooltip.candle.close >= tooltip.candle.open ? '▲' : '▼'} {((tooltip.candle.close - tooltip.candle.open) / tooltip.candle.open * 100).toFixed(2)}%
          </div>
        </div>
      )}
    </div>
  );
};

export default CandlestickChart;
