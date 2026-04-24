'use client';

import {
  CSSProperties,
  ElementType,
  ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';

type FadeOnViewProps = {
  children: ReactNode;
  /** HTML element/tag to render. Defaults to `div`. */
  as?: ElementType;
  /** Delay in milliseconds before the animation starts. */
  delay?: number;
  /** Additional className forwarded to the wrapper element. */
  className?: string;
  /** IntersectionObserver rootMargin. */
  rootMargin?: string;
  /** Extra inline styles forwarded to the wrapper. */
  style?: CSSProperties;
};

/**
 * FadeOnView
 *
 * Cheap, CSS-driven replacement for framer-motion's `whileInView` pattern.
 * Uses IntersectionObserver to toggle a `is-visible` class that triggers the
 * `fade-up` keyframe animation declared in `globals.css`. Fires once per
 * mount so the animation does not replay on re-scroll.
 */
export function FadeOnView({
  children,
  as,
  delay = 0,
  className = '',
  rootMargin = '0px 0px -10% 0px',
  style,
}: FadeOnViewProps) {
  const Tag = (as || 'div') as ElementType;
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin, threshold: 0 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [rootMargin]);

  useEffect(() => {
    if (!visible) return;
    const totalMs = 550 + (delay || 0);
    const id = window.setTimeout(() => setDone(true), totalMs + 80);
    return () => window.clearTimeout(id);
  }, [visible, delay]);

  const mergedStyle: CSSProperties = {
    ...(delay ? { animationDelay: `${delay}ms` } : null),
    ...style,
  };

  const classes = [
    'fade-on-view',
    visible ? 'is-visible' : '',
    done ? 'has-animated' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Tag ref={ref} className={classes} style={mergedStyle}>
      {children}
    </Tag>
  );
}

export default FadeOnView;
