'use client';

import { useEffect, useRef, useState } from 'react';

type Options = {
  /** Fire the callback only on the first intersection and then disconnect. */
  once?: boolean;
  /** IntersectionObserver rootMargin, defaults to 200px so we warm up slightly before visibility. */
  rootMargin?: string;
  /** Threshold, defaults to 0 (any pixel visible). */
  threshold?: number | number[];
};

/**
 * useInViewport
 *
 * Thin wrapper around IntersectionObserver that gives back a ref and an
 * `isInView` boolean. Use to pause always-running animations off-screen,
 * lazy-mount heavy children, or trigger one-shot entrance animations.
 *
 * Falls back to `isInView = true` when IntersectionObserver is not supported.
 */
export function useInViewport<T extends HTMLElement = HTMLDivElement>(
  { once = false, rootMargin = '200px 0px', threshold = 0 }: Options = {}
) {
  const ref = useRef<T | null>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        if (entry.isIntersecting) {
          setIsInView(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setIsInView(false);
        }
      },
      { rootMargin, threshold }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [once, rootMargin, threshold]);

  return { ref, isInView } as const;
}
