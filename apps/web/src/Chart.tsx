import { useState } from 'react';
import { formatNumber, type SeriesPoint } from '@stige/core';

const W = 340;
const H = 170;
const PAD = { top: 14, right: 44, bottom: 24, left: 8 };
const dateFormat = new Intl.DateTimeFormat('nb-NO', { day: 'numeric', month: 'short' });
const fullDate = new Intl.DateTimeFormat('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' });

function niceTicks(min: number, max: number): number[] {
  if (min === max) return [min];
  const span = max - min;
  const raw = span / 3;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  const ticks: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

/** Linjediagram med én serie. Trykk eller pek på diagrammet for å lese av en økt. */
export function LineChart({ title, unit, points }: { title: string; unit: string; points: SeriesPoint[] }) {
  const [active, setActive] = useState<number | null>(null);

  if (points.length === 0) {
    return (
      <figure className="chart">
        <figcaption>{title}</figcaption>
        <p className="muted small pad">Ingen data ennå.</p>
      </figure>
    );
  }

  const values = points.map((p) => p.value);
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  const margin = (hi - lo) * 0.15 || Math.max(1, hi * 0.05);
  lo = Math.max(0, lo - margin);
  hi = hi + margin;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - ((v - lo) / (hi - lo)) * innerH;
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const ticks = niceTicks(lo, hi);
  const last = points[points.length - 1]!;
  const shown = active !== null ? points[active] : undefined;

  const pick = (clientX: number, target: SVGSVGElement) => {
    const rect = target.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * W;
    let bestI = 0;
    for (let i = 1; i < points.length; i++) if (Math.abs(x(i) - px) < Math.abs(x(bestI) - px)) bestI = i;
    setActive(bestI);
  };

  return (
    <figure className="chart">
      <figcaption>
        <span>{title}</span>
        <span className="chart-readout">
          {shown
            ? `${fullDate.format(new Date(shown.date))}: ${formatNumber(Math.round(shown.value * 10) / 10)} ${unit}`
            : `Siste: ${formatNumber(Math.round(last.value * 10) / 10)} ${unit}`}
        </span>
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}, ${points.length} økter`}
        onPointerMove={(e) => pick(e.clientX, e.currentTarget)}
        onPointerDown={(e) => pick(e.clientX, e.currentTarget)}
        onPointerLeave={() => setActive(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line className="chart-grid" x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} />
            <text className="chart-tick" x={W - PAD.right + 6} y={y(t) + 4}>
              {formatNumber(t)}
            </text>
          </g>
        ))}
        {shown && active !== null && (
          <line className="chart-cross" x1={x(active)} x2={x(active)} y1={PAD.top} y2={H - PAD.bottom} />
        )}
        {points.length > 1 && <path className="chart-line" d={path} />}
        {points.map((p, i) => (
          <circle
            key={p.workoutId}
            className={`chart-dot${i === active ? ' chart-dot-on' : ''}`}
            cx={x(i)}
            cy={y(p.value)}
            r={i === active ? 6 : 4}
          />
        ))}
        <text className="chart-tick" x={PAD.left} y={H - 6}>
          {dateFormat.format(new Date(points[0]!.date))}
        </text>
        {points.length > 1 && (
          <text className="chart-tick" x={W - PAD.right} y={H - 6} textAnchor="end">
            {dateFormat.format(new Date(last.date))}
          </text>
        )}
      </svg>
    </figure>
  );
}
