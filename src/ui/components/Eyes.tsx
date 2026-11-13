import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

/**
 * Oči jsou značka Invoo: „oo“ v logu, které hlídá splatnost.
 * - watch  = dívají se nahoru doprava (výchozí)
 * - read   = čtou fakturu (dolů)
 * - follow = sledují kurzor
 * - happy  = zaplaceno (přivřené, usměvavé)
 */
export type EyesMood = 'watch' | 'read' | 'follow' | 'happy';

interface EyesProps {
  size?: number;
  mood?: EyesMood;
  /** solid = bílé oči na barevném podkladu, outline = s obrysem na světlém podkladu */
  variant?: 'solid' | 'outline';
  className?: string;
}

const FIXED: Record<'watch' | 'read', [number, number]> = {
  watch: [0.75, -0.45],
  read: [0, 0.9],
};

export function Eyes({ size = 24, mood = 'watch', variant = 'solid', className = '' }: EyesProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [direction, setDirection] = useState<[number, number]>(FIXED.watch);

  useEffect(() => {
    if (mood !== 'follow') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let frame = 0;
    const onMove = (event: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const element = ref.current;
        if (!element) return;
        const rect = element.getBoundingClientRect();
        const dx = event.clientX - (rect.left + rect.width / 2);
        const dy = event.clientY - (rect.top + rect.height / 2);
        const distance = Math.hypot(dx, dy) || 1;
        const reach = Math.min(1, distance / 140);
        setDirection([(dx / distance) * reach, (dy / distance) * reach]);
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
    };
  }, [mood]);

  const style = { '--eye': `${size}px` } as CSSProperties;
  const classes = `eyes eyes--${variant} ${className}`.trim();

  if (mood === 'happy') {
    return (
      <span className={classes} style={style} aria-hidden="true">
        {[0, 1].map((index) => (
          <svg key={index} className="eye-happy" viewBox="0 0 40 40">
            <path d="M6 27 Q20 7 34 27" />
          </svg>
        ))}
      </span>
    );
  }

  const [x, y] = mood === 'follow' ? direction : FIXED[mood];
  const travel = size * (variant === 'outline' ? 0.17 : 0.22);
  const pupil = { transform: `translate(${(x * travel).toFixed(1)}px, ${(y * travel).toFixed(1)}px)` };

  return (
    <span ref={ref} className={classes} style={style} aria-hidden="true">
      <span className="eye">
        <span className="pupil" style={pupil} />
      </span>
      <span className="eye">
        <span className="pupil" style={pupil} />
      </span>
    </span>
  );
}
