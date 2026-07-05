'use client';

import { useId, useMemo, useState } from 'react';
import { motion } from 'framer-motion';

const chartWidth = 680;
const chartHeight = 250;
const padding = { top: 18, right: 18, bottom: 36, left: 38 };

export default function SgpaChart({ rows }) {
  const gradientId = useId().replace(/:/g, '');
  const [activeIndex, setActiveIndex] = useState(null);

  const chart = useMemo(() => {
    const chartRows = (rows || [])
      .map((row) => {
        const rawValue = String(row.sgpa ?? '').trim();
        const value = Number.parseFloat(rawValue);
        if (!Number.isFinite(value) || value <= 0) return null;
        return {
          label: row.label || row.key,
          semester: row.fullLabel || row.label || row.key,
          value,
          displayValue: rawValue
        };
      })
      .filter(Boolean);

    if (!chartRows.length) return null;

    const values = chartRows.map((row) => row.value);
    const minValue = Math.min(...values);
    const yMin = Math.max(0, Math.floor(minValue - 0.5));
    const yMax = 10;
    const plotWidth = chartWidth - padding.left - padding.right;
    const plotHeight = chartHeight - padding.top - padding.bottom;
    const xStep = chartRows.length > 1 ? plotWidth / (chartRows.length - 1) : 0;

    const points = chartRows.map((row, index) => {
      const x = padding.left + index * xStep;
      const y = padding.top + ((yMax - row.value) / (yMax - yMin)) * plotHeight;
      return { ...row, x, y };
    });

    const linePoints = points.map((point) => `${point.x},${point.y}`).join(' ');
    const areaPath = [
      `M ${points[0].x} ${points[0].y}`,
      ...points.slice(1).map((point) => `L ${point.x} ${point.y}`),
      `L ${points[points.length - 1].x} ${chartHeight - padding.bottom}`,
      `L ${points[0].x} ${chartHeight - padding.bottom}`,
      'Z'
    ].join(' ');

    const tickStep = Math.max(1, Math.ceil((yMax - yMin) / 4));
    const ticks = [];
    for (let tick = yMax; tick >= yMin; tick -= tickStep) ticks.push(tick);
    if (!ticks.includes(yMin)) ticks.push(yMin);

    return { areaPath, linePoints, points, ticks, yMin, yMax };
  }, [rows]);

  if (!chart) {
    return <p className="empty-state">No semester data available for chart.</p>;
  }

  const activePoint = activeIndex === null ? null : chart.points[activeIndex];
  const chartKey = chart.points.map((point) => `${point.label}-${point.displayValue}`).join('|');

  return (
    <div className="sgpa-chart-shell" onMouseLeave={() => setActiveIndex(null)}>
      <svg
        className="sgpa-chart-svg"
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        role="img"
        aria-label="Semester-wise SGPA line chart"
      >
        <defs>
          <linearGradient id={`${gradientId}-area`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--ink)" stopOpacity="0.14" />
            <stop offset="100%" stopColor="var(--ink)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {chart.ticks.map((tick) => {
          const y = padding.top + ((chart.yMax - tick) / (chart.yMax - chart.yMin)) * (chartHeight - padding.top - padding.bottom);
          return (
            <g key={tick}>
              <line className="sgpa-grid-line" x1={padding.left} x2={chartWidth - padding.right} y1={y} y2={y} />
              <text className="sgpa-axis-text" x={padding.left - 12} y={y + 4} textAnchor="end">{tick}</text>
            </g>
          );
        })}

        <motion.path
          className="sgpa-area"
          d={chart.areaPath}
          fill={`url(#${gradientId}-area)`}
          key={`${chartKey}-area`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.36, delay: 0.16 }}
        />
        <motion.polyline
          className="sgpa-line"
          points={chart.linePoints}
          key={`${chartKey}-line`}
          initial={{ pathLength: 0, opacity: 0.4 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        />

        {chart.points.map((point, index) => (
          <motion.g
            className="sgpa-point-group"
            key={`${point.label}-${point.displayValue}`}
            onMouseEnter={() => setActiveIndex(index)}
            onFocus={() => setActiveIndex(index)}
            onBlur={() => setActiveIndex(null)}
            tabIndex={0}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.18 + index * 0.045, duration: 0.24 }}
          >
            <line className="sgpa-hover-line" x1={point.x} x2={point.x} y1={padding.top} y2={chartHeight - padding.bottom} />
            <motion.circle
              className="sgpa-dot-ring"
              cx={point.x}
              cy={point.y}
              initial={{ r: 0 }}
              animate={{ r: activeIndex === index ? 8 : 6 }}
              transition={{ duration: 0.16 }}
            />
            <motion.circle
              className="sgpa-dot"
              cx={point.x}
              cy={point.y}
              initial={{ r: 0 }}
              animate={{ r: activeIndex === index ? 4.5 : 3.5 }}
              transition={{ duration: 0.16 }}
            />
            <text
              className={`sgpa-axis-text sgpa-label ${activeIndex === index ? 'active' : ''}`}
              x={point.x}
              y={chartHeight - 12}
              textAnchor="middle"
            >
              {point.label}
            </text>
          </motion.g>
        ))}
      </svg>

      {activePoint ? (
        <div
          className="sgpa-chart-tooltip"
          style={{
            left: `${(activePoint.x / chartWidth) * 100}%`,
            top: `${(activePoint.y / chartHeight) * 100}%`
        }}
      >
          <span>Sem: {activePoint.label}</span>
          <strong>SGPA: {activePoint.displayValue}</strong>
        </div>
      ) : null}
    </div>
  );
}
