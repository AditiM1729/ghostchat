/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import {
  interpolateScrollKeys,
  buildBowlPolyline,
  calculatePixelColor,
  smoothstep,
  lerp,
} from '../utils/glowMath';

export const AtmosphereCanvas: React.FC<{ paused: boolean }> = ({ paused }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: false });
    if (!ctx) return;

    const width = 96;
    const height = 60;
    const imgData = ctx.createImageData(width, height);
    const data32 = new Uint32Array(imgData.data.buffer);

    let animId: number;
    let startTime: number | null = null;

    // Current state values
    let curTip = -0.3;
    let curHalf = 0.3;
    let curSoft = 0.1;

    const INTRO_DELAY = 250; // 0.25s
    const INTRO_DURATION = 1050; // 1.05s

    const render = (time: number) => {
      if (startTime === null) {
        startTime = time;
      }
      const elapsed = time - startTime;

      // 1. Scroll target
      const scrollY = window.scrollY || window.pageYOffset || 0;
      const innerHeight = window.innerHeight || 1;
      const innerWidth = window.innerWidth || 1;
      const q = scrollY / innerHeight;
      const aspect = innerWidth / innerHeight;

      const tgt = interpolateScrollKeys(q);

      // 2. Intro vs Scroll chasing
      if (elapsed < INTRO_DELAY) {
        curTip = -0.3;
        curHalf = 0.3;
        curSoft = 0.1;
      } else if (elapsed < INTRO_DELAY + INTRO_DURATION) {
        const introT = smoothstep((elapsed - INTRO_DELAY) / INTRO_DURATION);
        // Ease to q=0 values
        const q0 = interpolateScrollKeys(0);
        curTip = lerp(-0.3, q0.tip, introT);
        curHalf = lerp(0.3, q0.half, introT);
        curSoft = lerp(0.1, q0.soft, introT);
      } else {
        // Normal chase with inertia
        curTip += (tgt.tip - curTip) * 0.12;
        curHalf += (tgt.half - curHalf) * 0.12;
        curSoft += (tgt.soft - curSoft) * 0.12;
      }

      // 3. Idle drift
      const driftTip = curTip + Math.sin(time * 0.00033 + 1.3) * 0.02;
      const driftHalf = curHalf + Math.sin(time * 0.0005) * 0.015;
      const soft = curSoft;

      // 4. Build bowl polyline
      const poly = buildBowlPolyline(driftTip, driftHalf, aspect, 48);

      // 5. Draw pixels
      let pIdx = 0;
      for (let y = 0; y < height; y++) {
        const py = (y + 0.5) / height;
        for (let x = 0; x < width; x++) {
          const px = Math.abs((x + 0.5) / width - 0.5) * aspect;
          const [r, g, b] = calculatePixelColor(px, py, driftTip, driftHalf, soft, aspect, poly);
          // Little-endian ABGR: 0xFF000000 | (b << 16) | (g << 8) | r
          data32[pIdx++] = 0xff000000 | (b << 16) | (g << 8) | r;
        }
      }

      ctx.putImageData(imgData, 0, 0);
      if (!paused) animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [paused]);

  return (
    <div className="atmo" aria-hidden="true">
      <canvas id="bg" ref={canvasRef} width={96} height={60} />
    </div>
  );
};
