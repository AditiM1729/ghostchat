import { useEffect, useRef } from 'react';
import { createFluidScene, type FluidScene } from './fluidScene';

/** Decorative only: message selection, scrolling and controls keep their normal input events. */
export function FluidBackdrop({ paused }: { paused: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<FluidScene | undefined>(undefined);
  const pausedRef = useRef(paused);
  useEffect(() => { pausedRef.current = paused; scene.current?.setPaused(paused); }, [paused]);
  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    function setup() {
      scene.current?.dispose(); scene.current = undefined;
      if (motion.matches || !host.current?.parentElement) return;
      try {
        scene.current = createFluidScene(host.current, host.current.parentElement);
        scene.current.setPaused(pausedRef.current);
      } catch { /* The CSS fallback remains available if WebGL is unsupported. */ }
    }
    motion.addEventListener('change', setup); setup();
    return () => { motion.removeEventListener('change', setup); scene.current?.dispose(); scene.current = undefined; };
  // Recreate the GPU material when the scene module changes during development.
  }, [createFluidScene]);
  return <div className="ms-fluid-backdrop" ref={host} aria-hidden="true"/>;
}
