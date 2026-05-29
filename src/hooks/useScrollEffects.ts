import { useState, useEffect, useRef, useCallback, RefObject } from 'react';

/* ─────────── useScroll ─────────── */
export function useScroll() {
  const [scrollY, setScrollY] = useState(0);
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setScrollY(window.scrollY));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);
  return scrollY;
}

/* ─────────── useScrollProgress ─────────── */
export function useScrollProgress() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(100, Math.max(0, (window.scrollY / max) * 100)) : 0;
      setProgress(p);
    };
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);
  return progress;
}

/* ─────────── useInView ─────────── */
export function useInView<T extends HTMLElement>(
  options: IntersectionObserverInit = { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      options,
    );
    obs.observe(el);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { ref, inView };
}

/* ─────────── useParallax (per-element, viewport-relative) ─────────── */
export function useParallax<T extends HTMLElement>(strength = 0.2) {
  const ref = useRef<T | null>(null);
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const center = rect.top + rect.height / 2;
      const viewportCenter = window.innerHeight / 2;
      const delta = (center - viewportCenter) * -strength;
      setOffset(delta);
    };
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [strength]);
  return { ref, offset };
}

/* ─────────── useMouseTilt — 3D tilt that follows cursor ─────────── */
export function useMouseTilt<T extends HTMLElement>(maxDeg = 7) {
  const ref = useRef<T | null>(null);
  const onMove = useCallback(
    (e: MouseEvent) => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      const rx = (0.5 - y) * maxDeg;
      const ry = (x - 0.5) * maxDeg;
      el.style.transform = `perspective(1200px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
    },
    [maxDeg],
  );
  const onLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = 'perspective(1200px) rotateX(0deg) rotateY(0deg)';
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.transformStyle = 'preserve-3d';
    el.style.transition = 'transform 300ms cubic-bezier(.21,.94,.4,1)';
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, [onMove, onLeave]);
  return ref as RefObject<T>;
}

/* ─────────── useCountUp ─────────── */
export function useCountUp(target: number, duration = 1600, start = false) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!start) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, start]);
  return value;
}

/* ─────────── useMousePosition (raw, container-relative) ─────────── */
export function useMousePosition<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      setPos({ x: e.clientX - r.left, y: e.clientY - r.top });
    };
    const onLeave = () => setPos(null);
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, []);
  return { ref, pos };
}
