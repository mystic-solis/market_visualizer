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
  const candleWidth = 10;
  const [innerWidth, setInnerWidth] = useState(width);

  useEffect(() => {
    const calculatedWidth = Math.max(width + 200, data.length * candleWidth * 3);
    setInnerWidth(calculatedWidth);
  }, [data.length, width]);

  useEffect(() => {
    if (!svgRef.current || !gRef.current || data.length === 0) return;

    const g = d3.select(gRef.current);
    g.selectAll('*').remove();

    const margin = { top: 40, right: 40, bottom: 50, left: 80 };
    const chartWidth = innerWidth - margin.left - margin.right;
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
      .attr('stroke-width', 0.5);

    g.append('g').attr('class', 'axis')
      .call(d3.axisLeft(yScale).ticks(5).tickFormat((d: number | { valueOf(): number }) => {
        const val = typeof d === 'number' ? d : d.valueOf();
        return val >= 10000 ? (val / 1000).toFixed(0) + 'k' : val.toFixed(2);
      }));

    g.append('g').attr('class', 'axis')
      .attr('transform', `translate(0, ${innerHeight})`)
      .call(d3.axisBottom(xScale).ticks(Math.floor(chartWidth / 80)).tickFormat(d3.timeFormat('%H:%M')));

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

  }, [data, innerWidth, height, brushDomain, onBrush, instrument]);

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

  return (
    <div 
      ref={containerRef}
      className="candlestick-container"
      onScroll={handleScroll}
    >
      <svg ref={svgRef} width={innerWidth} height={height} className="candlestick-chart" style={{ minHeight: '160px' }}>
        <text x={10} y={15} style={{ fontSize: '11px', fill: '#64748b', fontWeight: 500 }}>
          {instrument} — свечи (прокрутите для просмотра)
        </text>
        <g ref={gRef} transform={`translate(${80}, ${40})`} />
      </svg>
    </div>
  );
};

export default CandlestickChart;
