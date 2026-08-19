'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** Measure a container so charts can size to it without scaling their type. */
export function useMeasure<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(720);

  const setRef = useCallback((node: T | null) => {
    ref.current = node;
    if (node) setWidth(node.clientWidth);
  }, []);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { setRef, width };
}
