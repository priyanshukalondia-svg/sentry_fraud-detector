import { riskColor } from "../api";

/**
 * A radar/instrument-style arc gauge. The signature visual element of the
 * dashboard's header, reinforcing the "reading a live signal" concept that
 * SignalBar carries into every table row.
 */
export default function ScopeGauge({ value = 0, size = 76 }) {
  const band = value >= 75 ? "critical" : value >= 50 ? "high" : value >= 25 ? "medium" : "low";
  const color = riskColor(band);
  const r = size / 2 - 8;
  const cx = size / 2;
  const cy = size / 2;
  const startAngle = -215;
  const sweepAngle = 250;
  const angle = startAngle + (value / 100) * sweepAngle;

  const polar = (deg, radius) => {
    const rad = (deg * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  };
  const arcPath = (a0, a1, radius) => {
    const p0 = polar(a0, radius);
    const p1 = polar(a1, radius);
    const largeArc = a1 - a0 > 180 ? 1 : 0;
    return `M ${p0.x} ${p0.y} A ${radius} ${radius} 0 ${largeArc} 1 ${p1.x} ${p1.y}`;
  };
  const needle = polar(angle, r - 3);

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0">
        <path d={arcPath(startAngle, startAngle + sweepAngle, r)} fill="none" stroke="#232A38" strokeWidth="4" strokeLinecap="round" />
        <path d={arcPath(startAngle, angle, r)} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 4px ${color}88)`, transition: "d 0.6s ease" }} />
        <line x1={cx} y1={cy} x2={needle.x} y2={needle.y} stroke={color} strokeWidth="1.5" opacity="0.6"
          style={{ transition: "all 0.6s ease" }} />
        <circle cx={cx} cy={cy} r="2.5" fill={color} />
      </svg>
      <div className="flex flex-col items-center leading-none" style={{ marginTop: 2 }}>
        <span className="font-mono text-lg font-semibold tabular-nums" style={{ color }}>
          {value.toFixed(0)}
        </span>
        <span className="text-[8px] text-text-dim uppercase tracking-widest mt-0.5">avg risk</span>
      </div>
    </div>
  );
}
