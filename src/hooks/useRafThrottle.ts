'use client';

import { useEffect, useRef } from 'react';

/**
 * useRafThrottle
 *
 * Schedules the given callback on the next animation frame and coalesces
 * subsequent calls into the same frame. Intended for high-frequency events
 * like `scroll` / `resize` so we never do more work than the browser can
 * paint.
 *
 * Returns a stable `schedule` function. The latest callback is always used
 * when the frame fires, without re-binding the listener.
 */
export function useRafThrottle(callback: () => void) {
  const cbRef = useRef(callback);
  const frameRef = useRef(0);

  useEffect(() => {
    cbRef.current = callback;
  }, [callback]);

  useEffect(() => {
    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = 0;
      }
    };
  }, []);

  const schedule = () => {
    if (frameRef.current) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = 0;
      cbRef.current();
    });
  };

  return schedule;
}
