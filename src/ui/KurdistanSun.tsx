import { useId } from 'react';
import './KurdistanSun.css';

// Ported from pezkuwi-telegram-miniapp src/components/KurdistanSun.tsx (MIT): the same 21-ray sun with rotating
// kesk-sor-zer halos; its styles and keyframes live in KurdistanSun.css (the CSP allows no <style> element).
export function KurdistanSun({ size = 200, className = '' }: { size?: number; className?: string }) {
  const gradient = `ks-gradient-${useId().replace(/:/g, '')}`;
  return (
    <div className={`ks-container ${className}`.trim()} style={{ width: size, height: size }} aria-hidden="true">
      {/* Rotating colored halos - Kesk u Sor u Zer */}
      <div className="ks-halos">
        <div className="ks-halo ks-halo-green" />
        <div className="ks-halo ks-halo-red" />
        <div className="ks-halo ks-halo-yellow" />
      </div>

      {/* Kurdistan Sun with 21 rays */}
      <svg viewBox="0 0 200 200" className="ks-svg" style={{ width: '100%', height: '100%' }}>
        <g className="ks-rays">
          {Array.from({ length: 21 }).map((_, i) => (
            <line
              key={i}
              x1="100" y1="100" x2="100" y2="20"
              stroke="rgba(255, 255, 255, 0.9)" strokeWidth="3" strokeLinecap="round"
              transform={`rotate(${(i * 360) / 21} 100 100)`}
              className="ks-ray"
              style={{ animationDelay: `${i * 0.05}s` }}
            />
          ))}
        </g>
        <circle cx="100" cy="100" r="35" fill="white" className="ks-center" />
        <circle cx="100" cy="100" r="35" fill={`url(#${gradient})`} className="ks-glow" />
        <defs>
          <radialGradient id={gradient}>
            <stop offset="0%" stopColor="rgba(255, 255, 255, 0.8)" />
            <stop offset="100%" stopColor="rgba(255, 255, 255, 0.2)" />
          </radialGradient>
        </defs>
      </svg>
    </div>
  );
}
