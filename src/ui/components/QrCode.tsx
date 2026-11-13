import { useMemo } from 'react';
import { qrMatrix } from '../qrMatrix';

// The QR specification asks for a light margin of 4 modules around the code; banking apps rely on it.
const QUIET_ZONE = 4;

/** One SVG path of the dark modules, built from coordinates only (never markup from a string). */
export function QrCode({ text }: { text: string }) {
  const { size, path } = useMemo(() => {
    const matrix = qrMatrix(text);
    const parts: string[] = [];
    matrix.forEach((row, y) =>
      row.forEach((dark, x) => {
        if (dark) parts.push(`M${x + QUIET_ZONE} ${y + QUIET_ZONE}h1v1h-1z`);
      }),
    );
    return { size: matrix.length + QUIET_ZONE * 2, path: parts.join('') };
  }, [text]);

  return (
    <div className="qr">
      <svg viewBox={`0 0 ${size} ${size}`} shapeRendering="crispEdges" role="img" aria-label="QR Platba">
        <rect width={size} height={size} fill="#fff" />
        <path d={path} />
      </svg>
    </div>
  );
}
