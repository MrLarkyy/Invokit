import { Eyes } from './Eyes';
import type { EyesMood } from './Eyes';

interface LogoProps {
  size?: number;
  onDark?: boolean;
  mood?: EyesMood;
}

export function Logo({ size = 30, onDark = false, mood = 'watch' }: LogoProps) {
  return (
    <span className={`logo${onDark ? ' logo--dark' : ''}`} style={{ fontSize: size }}>
      <span className="visually-hidden">Invoo</span>
      <span aria-hidden="true">inv</span>
      <Eyes size={Math.round(size * 0.6)} mood={mood} variant={onDark ? 'solid' : 'outline'} />
    </span>
  );
}
