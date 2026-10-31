/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface GlowKeys {
  tip: number;
  half: number;
  soft: number;
}

export const SCROLL_KEYS: Array<{ q: number } & GlowKeys> = [
  { q: 0.0, tip: 0.30, half: 0.34, soft: 0.22 },
  { q: 0.03, tip: 0.45, half: 0.38, soft: 0.26 },
  { q: 0.08, tip: 0.65, half: 0.38, soft: 0.22 },
  { q: 0.18, tip: 0.80, half: 0.38, soft: 0.22 },
  { q: 0.40, tip: 0.95, half: 0.38, soft: 0.19 },
  { q: 0.66, tip: 1.05, half: 0.46, soft: 0.16 },
  { q: 0.87, tip: 1.05, half: 0.66, soft: 0.13 },
  { q: 1.15, tip: 1.10, half: 0.90, soft: 0.10 },
  { q: 1.43, tip: 1.30, half: 1.60, soft: 0.10 },
  { q: 1.80, tip: 2.40, half: 3.00, soft: 0.10 },
  { q: 35.0, tip: 2.40, half: 3.00, soft: 0.10 },
];

export function clamp(val: number, min = 0, max = 1): number {
  return Math.min(Math.max(val, min), max);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstep(x: number): number {
  const c = clamp(x, 0, 1);
  return c * c * (3 - 2 * c);
}

export function interpolateScrollKeys(q: number): GlowKeys {
  if (q <= SCROLL_KEYS[0].q) {
    return { tip: SCROLL_KEYS[0].tip, half: SCROLL_KEYS[0].half, soft: SCROLL_KEYS[0].soft };
  }
  const last = SCROLL_KEYS[SCROLL_KEYS.length - 1];
  if (q >= last.q) {
    return { tip: last.tip, half: last.half, soft: last.soft };
  }

  for (let i = 0; i < SCROLL_KEYS.length - 1; i++) {
    const k0 = SCROLL_KEYS[i];
    const k1 = SCROLL_KEYS[i + 1];
    if (q >= k0.q && q <= k1.q) {
      const t = (q - k0.q) / (k1.q - k0.q);
      return {
        tip: lerp(k0.tip, k1.tip, t),
        half: lerp(k0.half, k1.half, t),
        soft: lerp(k0.soft, k1.soft, t),
      };
    }
  }
  return { tip: last.tip, half: last.half, soft: last.soft };
}

export interface Point {
  x: number;
  y: number;
}

export function buildBowlPolyline(tip: number, half: number, aspect: number, count = 48): Point[] {
  const poly: Point[] = new Array(count);
  const startY = -0.3;
  const safeTip = Math.max(tip, 0.001);

  for (let k = 0; k < count; k++) {
    const yy = startY + ((safeTip - startY) * k) / (count - 1);
    const ratio = Math.max(0, 1 - yy / safeTip);
    const cx = half * aspect * Math.pow(ratio, 0.72);
    poly[k] = { x: cx, y: yy };
  }
  return poly;
}

export function distToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    const ex = px - ax;
    const ey = py - ay;
    return Math.sqrt(ex * ex + ey * ey);
  }
  const u = clamp(((px - ax) * dx + (py - ay) * dy) / lenSq, 0, 1);
  const cx = ax + u * dx;
  const cy = ay + u * dy;
  const ex = px - cx;
  const ey = py - cy;
  return Math.sqrt(ex * ex + ey * ey);
}

const COLOR_WHITE: [number, number, number] = [255, 255, 255];
const COLOR_TURQUOISE: [number, number, number] = [0, 229, 192];
const COLOR_CHARTREUSE: [number, number, number] = [210, 245, 52];
const COLOR_OBSIDIAN_BLACK: [number, number, number] = [13, 16, 24];  // deep greyish black #0d1018

export function calculatePixelColor(
  px: number,
  py: number,
  tip: number,
  half: number,
  soft: number,
  aspect: number,
  poly: Point[]
): [number, number, number] {
  // Find min distance to polyline segments
  let minDist = Infinity;
  for (let i = 0; i < poly.length - 1; i++) {
    const d = distToSegment(px, py, poly[i].x, poly[i].y, poly[i + 1].x, poly[i + 1].y);
    if (d < minDist) minDist = d;
  }

  // Inside test: py < tip and px < half * aspect * (1 - py/tip)^0.72
  const safeTip = Math.max(tip, 0.001);
  let isInside = false;
  if (py < safeTip) {
    const wallX = half * aspect * Math.pow(Math.max(0, 1 - py / safeTip), 0.72);
    if (px < wallX) {
      isInside = true;
    }
  }

  const sdSigned = isInside ? -minDist : minDist;
  const sd = sdSigned - 0.25; // Round the bottom (RND = 0.25)
  const g = 1 - smoothstep((sd + soft) / (2 * soft));

  if (g <= 0) {
    return COLOR_WHITE;
  }
  if (g >= 1) {
    return COLOR_OBSIDIAN_BLACK;
  }

  // A narrow chartreuse rim blends into turquoise, then the dark central bowl.
  if (g < 0.14) {
    const t = smoothstep(g / 0.14);
    return COLOR_WHITE.map((channel, i) => Math.round(lerp(channel, COLOR_CHARTREUSE[i], t))) as RGB;
  }
  if (g < 0.42) {
    const t = smoothstep((g - 0.14) / 0.28);
    return [
      Math.round(lerp(COLOR_CHARTREUSE[0], COLOR_TURQUOISE[0], t)),
      Math.round(lerp(COLOR_CHARTREUSE[1], COLOR_TURQUOISE[1], t)),
      Math.round(lerp(COLOR_CHARTREUSE[2], COLOR_TURQUOISE[2], t)),
    ];
  } else {
    const t = smoothstep((g - 0.42) / 0.58);
    return [
      Math.round(lerp(COLOR_TURQUOISE[0], COLOR_OBSIDIAN_BLACK[0], t)),
      Math.round(lerp(COLOR_TURQUOISE[1], COLOR_OBSIDIAN_BLACK[1], t)),
      Math.round(lerp(COLOR_TURQUOISE[2], COLOR_OBSIDIAN_BLACK[2], t)),
    ];
  }
}

export type RGB = [number, number, number];

export function getLetterProgress(p: number, index: number, total: number, spread: number): number {
  if (total <= 1) return clamp(p);
  const ratio = index / total;
  return clamp((p * (1 + spread) - ratio) / spread);
}

export function computeLetterStyle(
  t: number,
  isFlaggedAccent: boolean,
  ghostRgb: RGB,
  accentRgb: RGB,
  finalRgb: RGB
): { opacity: number; color: string; blur: number } {
  const targetFinal: RGB = isFlaggedAccent ? accentRgb : finalRgb;

  if (t <= 0) {
    return {
      opacity: 0,
      color: `rgb(${ghostRgb[0]}, ${ghostRgb[1]}, ${ghostRgb[2]})`,
      blur: 8,
    };
  }

  if (t <= 0.35) {
    const local = t / 0.35;
    const opacity = local;
    const blur = lerp(8, 1.5, local);
    return {
      opacity,
      color: `rgb(${ghostRgb[0]}, ${ghostRgb[1]}, ${ghostRgb[2]})`,
      blur,
    };
  }

  if (t <= 0.70) {
    const local = (t - 0.35) / 0.35;
    const blur = lerp(1.5, 0, local);
    const r = Math.round(lerp(ghostRgb[0], accentRgb[0], local));
    const g = Math.round(lerp(ghostRgb[1], accentRgb[1], local));
    const b = Math.round(lerp(ghostRgb[2], accentRgb[2], local));
    return {
      opacity: 1,
      color: `rgb(${r}, ${g}, ${b})`,
      blur,
    };
  }

  const local = (t - 0.70) / 0.30;
  const r = Math.round(lerp(accentRgb[0], targetFinal[0], local));
  const g = Math.round(lerp(accentRgb[1], targetFinal[1], local));
  const b = Math.round(lerp(accentRgb[2], targetFinal[2], local));
  return {
    opacity: 1,
    color: `rgb(${r}, ${g}, ${b})`,
    blur: 0,
  };
}

export function computeStatementMotion(
  q: number,
  innerHeight: number
): { translateY: number; revealP: number; navOn: boolean } {
  const s = clamp((q - 0.69) / 0.74, 0, 1);
  const translateY = 0.205 * Math.pow(1 - s, 2) * innerHeight;
  const revealP = clamp((q - 0.56) / 2.03, 0, 1);
  const navOn = revealP > 0.4;
  return { translateY, revealP, navOn };
}

export function computeDarkSplitMotion(
  splitTop: number,
  innerHeight: number
): { p2: number; shipScale: number; rowVisible: boolean } {
  const p2 = clamp((0.8 - splitTop / innerHeight) / 0.65, 0, 1);
  const shipProgress = clamp(1 - splitTop / innerHeight, 0, 1);
  const shipScale = 1.08 - 0.08 * shipProgress;
  const rowVisible = p2 > 0.92;
  return { p2, shipScale, rowVisible };
}

export interface SlideState {
  index: number;
  revealP: number;
  opacity: number;
  translateY: number;
  isActive: boolean;
}

export function computeSlidesMotion(
  q: number,
  totalSlides = 5
): {
  slides: SlideState[];
  navOn: boolean;
} {
  const SLIDE_DURATION = 2.0;
  const SLIDE_GAP = 0.1;
  const START_Q = 0.56;

  const slides: SlideState[] = [];
  let firstSlideRevealP = 0;

  for (let i = 0; i < totalSlides; i++) {
    const slideStart = START_Q + i * (SLIDE_DURATION + SLIDE_GAP);
    const local = (q - slideStart) / SLIDE_DURATION;

    const revealP = clamp(local * 1.3, 0, 1);
    if (i === 0) firstSlideRevealP = revealP;

    let opacity = 0;
    if (local >= -0.08 && (i === totalSlides - 1 || local <= 1.08)) {
      if (local < 0.15) {
        opacity = smoothstep(clamp((local + 0.08) / 0.23, 0, 1));
      } else if (local > 0.85 && i !== totalSlides - 1) {
        opacity = 1 - smoothstep(clamp((local - 0.85) / 0.23, 0, 1));
      } else {
        opacity = 1;
      }
    }

    // Subtle upward rise
    const translateY = (1 - clamp(local * 1.5, 0, 1)) * 30 - clamp((local - 0.8) / 0.2, 0, 1) * 20;

    slides.push({
      index: i,
      revealP,
      opacity,
      translateY,
      isActive: opacity > 0.001,
    });
  }

  const navOn = q > 0.95 || firstSlideRevealP > 0.4;
  return { slides, navOn };
}

