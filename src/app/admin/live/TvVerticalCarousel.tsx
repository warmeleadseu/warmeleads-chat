'use client';

import { useEffect, useRef, type ReactNode } from 'react';

const SCROLL_PX_PER_FRAME = 0.22;

type SegmentKey = '' | 'a' | 'b';

export type TvVerticalCarouselRender = (segmentKey: SegmentKey) => ReactNode;

type Props = {
  reducedMotion: boolean;
  /** Bij wijziging: scroll reset + ResizeObserver herberekent. */
  contentKey: string;
  className?: string;
  gapClassName?: string;
  children: TvVerticalCarouselRender;
};

/**
 * Verticale “carousel” voor TV: rustig door-scrollen, naadloze loop via dubbele track.
 * Geen interactieve scrollbar; bij `prefers-reduced-motion` gewone scrollbare lijst.
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

    let raf = 0;

    const tick = () => {
      const loopH = first.offsetHeight;
      const viewH = outer.clientHeight;
      const needScroll = loopH > viewH + 2;

      if (!needScroll) {
        scroll.scrollTop = 0;
        raf = requestAnimationFrame(tick);
        return;
      }

      scroll.scrollTop += SCROLL_PX_PER_FRAME;
      if (scroll.scrollTop >= loopH - 0.75) {
        scroll.scrollTop -= loopH;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    const ro = new ResizeObserver(() => {
      const loopH = first.offsetHeight;
      if (loopH > 0 && scroll.scrollTop >= loopH) {
        scroll.scrollTop = Math.max(0, scroll.scrollTop - loopH);
      }
    });
    ro.observe(first);
    ro.observe(outer);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [reducedMotion, contentKey]);

  if (reducedMotion) {
    return (
      <div className={`min-h-0 flex-1 overflow-y-auto ${className}`}>
        <div className={`flex flex-col ${gapClassName}`}>{children('')}</div>
      </div>
    );
  }

  return (
    <div ref={outerRef} className={`relative min-h-0 flex-1 overflow-hidden ${className}`}>
      <div
        ref={scrollRef}
        className="h-full max-h-full overflow-y-auto overflow-x-hidden overscroll-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
