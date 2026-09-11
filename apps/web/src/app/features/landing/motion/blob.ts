/**
 * The landing's organism: a Pix charge drawn as a living shape.
 *
 * Each payment state is a mood — a handful of numbers — and the shape is a
 * smooth closed curve whose radius those numbers bend over time. Moving
 * between states is just mixing moods, so every transition morphs.
 */

export type MoodName = 'idle' | 'pending' | 'confirmed' | 'failed' | 'expired';

export interface Mood {
  /** Overall size, as a share of the base radius. */
  readonly scale: number;
  /** Slow, soft undulation. */
  readonly wobble: number;
  /** Alternating in/out thorns. */
  readonly spikes: number;
  /** How much the lower half droops. */
  readonly sag: number;
  /** How fast its time runs. */
  readonly speed: number;
}

/** A bulge toward a direction (radians), 0..1 strong. */
export interface Lean {
  readonly angle: number;
  readonly amount: number;
}

export const MOODS: Readonly<Record<MoodName, Mood>> = {
  idle: { scale: 0.74, wobble: 0.05, spikes: 0, sag: 0, speed: 0.35 },
  pending: { scale: 0.86, wobble: 0.1, spikes: 0, sag: 0, speed: 1 },
  confirmed: { scale: 1, wobble: 0.06, spikes: 0, sag: 0, speed: 0.55 },
  failed: { scale: 0.9, wobble: 0.04, spikes: 0.17, sag: 0, speed: 1.7 },
  expired: { scale: 0.78, wobble: 0.03, spikes: 0, sag: 0.24, speed: 0.18 },
};

export const BLOB_POINTS = 18;

const NO_LEAN: Lean = { angle: 0, amount: 0 };

export function mixMood(from: Mood, to: Mood, t: number): Mood {
  // a·(1−t) + b·t, e não a + (b−a)·t: exato nas duas pontas, sem resto de ponto flutuante.
  const mix = (a: number, b: number) => a * (1 - t) + b * t;
  return {
    scale: mix(from.scale, to.scale),
    wobble: mix(from.wobble, to.wobble),
    spikes: mix(from.spikes, to.spikes),
    sag: mix(from.sag, to.sag),
    speed: mix(from.speed, to.speed),
  };
}

/** The shape at `time`, centered on the origin, as an SVG path (Catmull-Rom → cubic Bézier). */
export function blobPath(mood: Mood, time: number, radius: number, lean: Lean = NO_LEAN): string {
  const points: [number, number][] = [];

  for (let i = 0; i < BLOB_POINTS; i++) {
    const angle = (i / BLOB_POINTS) * Math.PI * 2;
    const wave =
      Math.sin(angle * 3 + time * 1.3) * 0.5 +
      Math.sin(angle * 5 - time * 0.9 + 1.7) * 0.3 +
      Math.sin(angle * 2 + time * 0.6 + 4.1) * 0.2;
    const thorn = (i % 2 === 0 ? 1 : -0.55) * (0.8 + 0.2 * Math.sin(time * 5 + i * 1.7));
    const toLean = Math.atan2(Math.sin(angle - lean.angle), Math.cos(angle - lean.angle));
    const bulge = lean.amount * 0.12 * Math.exp(-(toLean * toLean) / 0.35);

    const r = radius * mood.scale * (1 + mood.wobble * wave + mood.spikes * thorn + bulge);
    const below = Math.max(0, Math.sin(angle));
    const x = Math.cos(angle) * r - Math.cos(angle) * radius * mood.sag * 0.3 * below;
    const y = Math.sin(angle) * r + radius * mood.sag * below * below;
    points.push([x, y]);
  }

  const n = BLOB_POINTS;
  let d = `M${fixed(points[0][0])} ${fixed(points[0][1])}`;
  for (let i = 0; i < n; i++) {
    const [x0, y0] = points[(i - 1 + n) % n];
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % n];
    const [x3, y3] = points[(i + 2) % n];
    d +=
      `C${fixed(x1 + (x2 - x0) / 6)} ${fixed(y1 + (y2 - y0) / 6)} ` +
      `${fixed(x2 - (x3 - x1) / 6)} ${fixed(y2 - (y3 - y1) / 6)} ${fixed(x2)} ${fixed(y2)}`;
  }
  return `${d}Z`;
}

function fixed(n: number): string {
  return n.toFixed(1);
}
