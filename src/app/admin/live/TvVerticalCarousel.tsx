'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/** Rustig TV-tempo (~21 px/s bij 60fps) */
const SCROLL_PX_PER_FRAME = 0.35;
/** Na wheel/touch/klik pauzeren we auto-scroll zodat je handmatig verder kunt scrollen */
const USER_PAUSE_MS = 4500;

type SegmentKey = '' | 'a' | 'b';

export type TvVerticalCarouselRender = (segmentKey: SegmentKey) => ReactNode;

type Props = {
  reducedMotion: boolean;
  /** Bij wijziging: scroll reset. */
  contentKey: string;
  className?: string;
  gapClassName?: string;
  children: TvVerticalCarouselRender;
};

/**
 * TV: rustig auto-scroll met naadloze loop (dubbele track).
 * - Handmatig scrollen (wiel, touch, sleep) pauzeert auto-scroll kort.
 * - Standaard zichtbare scrollbar (geen verbergen).
 * - `prefers-reduced-motion`: alleen handmatig scrollen.
 */
export function TvVerticalCarousel({
  reducedMotion,
  contentKey,
  className = '',
  gapClassName = 'gap-2',
  children,
}: Props) {
  const outerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const firstRef = useRef<HTMLDivElement>(null);
  const pauseUntilRef = useRef(0);
  const rafRef = useRef(0);
  const stoppedRef = useRef(false);

  const bumpUserPause = () => {
    pauseUntilRef.current = Date.now() + USER_PAUSE_MS;
  };

  useEffect(() => {
    const scroll = scrollRef.current;
    if (scroll) scroll.scrollTop = 0;
  }, [contentKey]);

  useEffect(() => {
    if (reducedMotion) return;
    const scroll = scrollRef.current;
    const outer = outerRef.current;
    const first = firstRef.current;
    if (!scroll || !outer || !first) return;

    const opts: AddEventListenerOptions = { passive: true };

    const onUserIntent = () => bumpUserPause();
    scroll.addEventListener('wheel', onUserIntent, opts);
    scroll.addEventListener('touchstart', onUserIntent, opts);
    scroll.addEventListener('pointerdown', onUserIntent);
    scroll.addEventListener('keydown', onUserIntent);

    stoppedRef.current = false;

    const tick = () => {
      if (stoppedRef.current) return;

      const loopH = first.offsetHeight;
      const viewH = scroll.clientHeight;
      const needScroll = loopH > viewH + 2;

      if (!needScroll) {
        scroll.scrollTop = 0;
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const paused = Date.now() < pauseUntilRef.current;
      if (!paused) {
        scroll.scrollTop += SCROLL_PX_PER_FRAME;
        if (scroll.scrollTop >= loopH - 0.75) {
          scroll.scrollTop -= loopH;
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    const ro = new ResizeObserver(() => {
      const loopH = first.offsetHeight;
      if (loopH > 0 && scroll.scrollTop >= loopH) {
        scroll.scrollTop = Math.max(0, scroll.scrollTop - loopH);
      }
    });
    ro.observe(first);
    ro.observe(outer);

    return () => {
      stoppedRef.current = true;
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      scroll.removeEventListener('wheel', onUserIntent, opts);
      scroll.removeEventListener('touchstart', onUserIntent, opts);
      scroll.removeEventListener('pointerdown', onUserIntent);
      scroll.removeEventListener('keydown', onUserIntent);
    };
  }, [reducedMotion, contentKey]);

  if (reducedMotion) {
    return (
      <div className={`min-h-0 flex-1 overflow-y-auto overscroll-y-contain ${className}`}>
        <div className={`flex flex-col ${gapClassName}`}>{children('')}</div>
      </div>
    );
  }

  return (
    <div ref={outerRef} className={`relative flex min-h-0 flex-1 flex-col overflow-hidden ${className}`}>
      <div
        ref={scrollRef}
        tabIndex={0}
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain pr-0.5 outline-none focus-visible:ring-1 focus-visible:ring-white/20"
        style={{ scrollbarGutter: 'stable' }}
      >
        <div ref={firstRef} className={`flex flex-col ${gapClassName}`}>
          {children('a')}
        </div>
        <div className={`flex flex-col ${gapClassName}`} aria-hidden>
          {children('b')}
        </div>
      </div>
    </div>
  );
}
