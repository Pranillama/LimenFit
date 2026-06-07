import { bmiToAngle } from '@/lib/body-metrics/derive';

// Semicircle gauge geometry (SVG user units). The arc is the upper half of a
// circle centred at (CX, CY); angles follow bmiToAngle (180° left → 0° right).
const CX = 110;
const CY = 110;
const R = 84; // centre-line radius of the coloured band stroke
const STROKE = 16;
const NEEDLE = 70;
const LABEL_R = 104;

interface Band {
  from: number;
  to: number;
  color: string;
}

const BANDS: Band[] = [
  { from: 16, to: 18.5, color: '#3b82f6' }, // blue   — underweight
  { from: 18.5, to: 25, color: '#22c55e' }, // green  — normal
  { from: 25, to: 30, color: '#eab308' }, // yellow — overweight
  { from: 30, to: 35, color: '#f97316' }, // orange — obese I
  { from: 35, to: 40, color: '#ef4444' }, // red    — obese II
];

const TICKS = [16, 18.5, 25, 30, 35, 40];

function polar(r: number, angleDeg: number): { x: number; y: number } {
  const a = (angleDeg * Math.PI) / 180;
  return { x: CX + r * Math.cos(a), y: CY - r * Math.sin(a) };
}

function arcPath(fromBmi: number, toBmi: number): string {
  const a0 = bmiToAngle(fromBmi); // larger angle (toward the left)
  const a1 = bmiToAngle(toBmi); // smaller angle (toward the right)
  const p0 = polar(R, a0);
  const p1 = polar(R, a1);
  const largeArc = a0 - a1 > 180 ? 1 : 0;
  return `M ${p0.x} ${p0.y} A ${R} ${R} 0 ${largeArc} 1 ${p1.x} ${p1.y}`;
}

export interface BmiGaugeProps {
  bmi: number;
}

export function BmiGauge({ bmi }: BmiGaugeProps) {
  const tip = polar(NEEDLE, bmiToAngle(bmi));

  return (
    <svg
      viewBox="0 0 220 128"
      className="h-auto w-full max-w-[320px]"
      role="img"
      aria-label={`BMI gauge: ${bmi}`}
    >
      {BANDS.map((b) => (
        <path
          key={b.from}
          d={arcPath(b.from, b.to)}
          stroke={b.color}
          strokeWidth={STROKE}
          fill="none"
        />
      ))}

      {TICKS.map((t) => {
        const p = polar(LABEL_R, bmiToAngle(t));
        return (
          <text
            key={t}
            x={p.x}
            y={p.y}
            fontSize="9"
            textAnchor="middle"
            dominantBaseline="middle"
            fill="hsl(var(--muted-foreground))"
          >
            {t}
          </text>
        );
      })}

      {/* needle + hub */}
      <line
        x1={CX}
        y1={CY}
        x2={tip.x}
        y2={tip.y}
        stroke="hsl(var(--foreground))"
        strokeWidth={3}
        strokeLinecap="round"
      />
      <circle cx={CX} cy={CY} r={6} fill="hsl(var(--foreground))" />
    </svg>
  );
}
