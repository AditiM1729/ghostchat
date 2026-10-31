import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const storageKey = 'ghostchat.inbox-width';
const minimum = 230;
const defaultWidth = 260;

/** A keyboard and pointer accessible divider; only the list width is persisted. */
export function InboxResize() {
  const divider = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; width: number } | null>(null);
  const [width, setWidth] = useState(() => {
    try { const saved = Number(localStorage.getItem(storageKey)); return Number.isFinite(saved) && saved >= minimum ? Math.min(saved, 480) : defaultWidth; }
    catch { return defaultWidth; }
  });
  const [maximum, setMaximum] = useState(480);
  const [dragging, setDragging] = useState(false);
  useLayoutEffect(() => {
    const frame = divider.current?.closest<HTMLElement>('.ms-app-frame');
    frame?.style.setProperty('--ms-inbox-width', `${width}px`);
  }, [width]);
  useEffect(() => {
    const frame = divider.current?.closest<HTMLElement>('.ms-app-frame');
    if (!frame) return;
    const resize = () => {
      const max = Math.max(minimum, Math.min(480, frame.clientWidth - 56 - 320));
      setMaximum(max); setWidth(value => Math.min(value, max));
    };
    const observer = new ResizeObserver(resize); observer.observe(frame); resize();
    return () => { observer.disconnect(); frame.style.removeProperty('--ms-inbox-width'); };
  }, []);
  useEffect(() => {
    if (dragging) return;
    try { localStorage.setItem(storageKey, String(width)); } catch { /* Resizing also works without storage. */ }
  }, [width, dragging]);
  const change = (value: number) => setWidth(Math.max(minimum, Math.min(maximum, value)));
  function finish() { drag.current = null; setDragging(false); }
  return <div ref={divider} className={`ms-inbox-resize${dragging ? ' is-dragging' : ''}`}
    role="separator" tabIndex={0} aria-label="Resize chats list" aria-orientation="vertical"
    aria-valuemin={minimum} aria-valuemax={maximum} aria-valuenow={Math.round(width)}
    title="Drag to resize chats · double-click to reset"
    onPointerDown={event => {
      if (event.button !== 0) return;
      event.preventDefault(); event.currentTarget.focus();
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = { id: event.pointerId, x: event.clientX, width }; setDragging(true);
    }}
    onPointerMove={event => { if (drag.current?.id === event.pointerId) change(drag.current.width + event.clientX - drag.current.x); }}
    onPointerUp={event => { if (drag.current?.id === event.pointerId) { event.currentTarget.releasePointerCapture(event.pointerId); finish(); } }}
    onPointerCancel={finish} onLostPointerCapture={finish}
    onDoubleClick={() => change(defaultWidth)}
    onKeyDown={event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      change(event.key === 'Home' ? minimum : event.key === 'End' ? maximum : width + (event.key === 'ArrowLeft' ? -1 : 1) * (event.shiftKey ? 40 : 10));
    }}/>
}
