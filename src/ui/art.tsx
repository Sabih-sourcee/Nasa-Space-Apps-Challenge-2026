// World emblems for the mission map, mission card and results screen. Drawn in
// code as inline SVG, like everything else in the game. Decorative only.

import { useId } from 'react';
import type { WorldId } from '../sim/types';

export const WORLD_TINT: Record<WorldId, string> = {
  earth: '#4da3ff',
  shuttle: '#ffb347',
  station: '#7fe7ff',
  moon: '#cfd6e4',
  mars: '#ff7a4d',
};

/** The Beyond Earth mission patch: an original emblem, not based on any agency insignia. */
export function MissionPatch({ size = 84 }: { size?: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <svg className="patch" width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={`pb-${uid}`} cx="50%" cy="30%" r="80%"><stop offset="0%" stopColor="#1d3f94" /><stop offset="100%" stopColor="#081434" /></radialGradient>
        <radialGradient id={`pe-${uid}`} cx="40%" cy="20%" r="90%"><stop offset="0%" stopColor="#8fd8ff" /><stop offset="60%" stopColor="#2a7fe0" /><stop offset="100%" stopColor="#0b2d70" /></radialGradient>
        <clipPath id={`pc-${uid}`}><circle cx="50" cy="50" r="42" /></clipPath>
      </defs>
      <circle cx="50" cy="50" r="48" fill="#ffc43d" />
      <circle cx="50" cy="50" r="44.500" fill="#0a1a44" />
      <circle cx="50" cy="50" r="42" fill={`url(#pb-${uid})`} />
      <g clipPath={`url(#pc-${uid})`}>
        <g fill="#fff"><circle cx="24" cy="30" r="1.300" /><circle cx="74" cy="22" r="1.100" /><circle cx="82" cy="46" r="1.300" /><circle cx="36" cy="18" r="0.900" /><circle cx="18" cy="52" r="1" /></g>
        <circle cx="50" cy="104" r="44" fill={`url(#pe-${uid})`} />
        <path d="M22 78c8-6 16-7 22-4 5 3 3 8 9 10" fill="none" stroke="#43c477" strokeWidth="5" strokeLinecap="round" opacity="0.9" />
        <ellipse cx="50" cy="52" rx="46" ry="15" fill="none" stroke="#ffc43d" strokeWidth="1.800" strokeDasharray="2 5" strokeLinecap="round" transform="rotate(-22 50 52)" />
        <g transform="translate(60 38) rotate(38)">
          <path d="M-3.500 11h7l1.500 13h-10z" fill="#ffae2b" />
          <path d="M0-17c4.500 4 6 9 6 15v13h-12V-2c0-6 1.500-11 6-15z" fill="#f4f6fa" />
          <path d="M0-17c2.800 2.500 4.400 5.400 5.300 8.500h-10.600c.9-3.100 2.500-6 5.300-8.500z" fill="#ff5a4d" />
          <path d="M-6 3l-5 5.500v5.500l5-2.200zM6 3l5 5.500v5.500l-5-2.200z" fill="#c9d2e0" />
          <circle cx="0" cy="-3" r="2.500" fill="#1c3f8f" stroke="#9fc4ff" strokeWidth="0.900" />
        </g>
      </g>
    </svg>
  );
}

export function WorldArt({ world, size = 120, className = '' }: { world: WorldId; size?: number; className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const id = (name: string) => `${name}-${uid}`;
  const url = (name: string) => `url(#${id(name)})`;
  const shade = (
    <radialGradient id={id('shade')} cx="32%" cy="28%" r="82%">
      <stop offset="52%" stopColor="#000" stopOpacity="0" />
      <stop offset="100%" stopColor="#020716" stopOpacity="0.78" />
    </radialGradient>
  );
  const clip = <clipPath id={id('clip')}><circle cx="60" cy="60" r="44" /></clipPath>;

  let body: React.ReactNode;
  if (world === 'earth') {
    body = (
      <>
        <defs>
          <radialGradient id={id('base')} cx="35%" cy="30%" r="78%"><stop offset="0%" stopColor="#8fd8ff" /><stop offset="52%" stopColor="#2a7fe0" /><stop offset="100%" stopColor="#0b2d70" /></radialGradient>
          {shade}{clip}
        </defs>
        <circle cx="60" cy="60" r="51" fill="#58c7ff" opacity="0.16" />
        <circle cx="60" cy="60" r="47" fill="#7fd6ff" opacity="0.18" />
        <circle cx="60" cy="60" r="44" fill={url('base')} />
        <g clipPath={url('clip')}>
          <g fill="#43c477">
            <path d="M27 42c7-9 20-12 27-6 4 4-2 8 2 13 5 6 13 3 13 11 0 8-11 8-14 15-2 6 4 11-3 14-8 3-15-6-16-15-1-7-8-9-10-17-1-6-2-11 1-15z" />
            <path d="M74 27c8 0 15 6 19 13-4 4-10 1-13 6-3 5 2 9-2 12-6 2-10-4-10-11 0-7 0-14 6-20z" />
            <path d="M80 76c6-2 12 1 15 6-3 6-9 10-15 12-4-5-4-13 0-18z" />
          </g>
          <g fill="#2f9d5c" opacity="0.7">
            <path d="M36 50c5-3 10-2 13 2-2 5-8 6-12 4z" />
            <path d="M78 36c4-1 7 1 9 4-3 2-7 2-9-1z" />
          </g>
          <g fill="#fff" opacity="0.8">
            <ellipse cx="45" cy="31" rx="15" ry="3.200" />
            <ellipse cx="80" cy="63" rx="13" ry="2.800" />
            <ellipse cx="42" cy="86" rx="17" ry="3" />
          </g>
        </g>
        <circle cx="60" cy="60" r="44" fill={url('shade')} />
      </>
    );
  } else if (world === 'moon') {
    body = (
      <>
        <defs>
          <radialGradient id={id('base')} cx="35%" cy="30%" r="78%"><stop offset="0%" stopColor="#fbfbf7" /><stop offset="55%" stopColor="#b9bcc4" /><stop offset="100%" stopColor="#5d6170" /></radialGradient>
          {shade}{clip}
        </defs>
        <circle cx="60" cy="60" r="50" fill="#dfe6f5" opacity="0.1" />
        <circle cx="60" cy="60" r="44" fill={url('base')} />
        <g clipPath={url('clip')}>
          <g fill="#8b8f9c" opacity="0.55">
            <ellipse cx="44" cy="46" rx="15" ry="11" />
            <ellipse cx="74" cy="72" rx="19" ry="13" />
            <ellipse cx="80" cy="38" rx="8" ry="6" />
          </g>
          {[[40, 70, 7], [66, 44, 5], [86, 58, 4], [52, 88, 5], [30, 52, 3.500], [72, 90, 3], [58, 28, 3.500]].map(([x, y, r]) => (
            <g key={`${x}-${y}`}>
              <circle cx={x} cy={y} r={r} fill="#6f7382" opacity="0.85" />
              <circle cx={x - r * 0.18} cy={y - r * 0.18} r={r * 0.74} fill="#a4a8b3" />
            </g>
          ))}
        </g>
        <circle cx="60" cy="60" r="44" fill={url('shade')} />
      </>
    );
  } else if (world === 'mars') {
    body = (
      <>
        <defs>
          <radialGradient id={id('base')} cx="35%" cy="30%" r="78%"><stop offset="0%" stopColor="#ffbe8a" /><stop offset="52%" stopColor="#d9623a" /><stop offset="100%" stopColor="#6b2414" /></radialGradient>
          {shade}{clip}
        </defs>
        <circle cx="60" cy="60" r="50" fill="#ff8a5c" opacity="0.14" />
        <circle cx="60" cy="60" r="44" fill={url('base')} />
        <g clipPath={url('clip')}>
          <g fill="#8a3219" opacity="0.6">
            <path d="M22 58c10-7 24-8 34-2 7 4 15 2 21 7-8 7-21 6-31 9-9 3-19 0-24-14z" />
            <path d="M66 34c8-3 18 0 24 7-6 5-15 4-22 1z" />
            <path d="M58 86c9-4 20-2 27 3-6 8-19 11-27-3z" />
          </g>
          <ellipse cx="60" cy="18" rx="24" ry="7" fill="#fff4ea" opacity="0.92" />
          <ellipse cx="60" cy="104" rx="15" ry="4.500" fill="#fff4ea" opacity="0.7" />
          <circle cx="42" cy="78" r="4" fill="#7b2b15" opacity="0.6" />
          <circle cx="84" cy="60" r="3" fill="#7b2b15" opacity="0.6" />
        </g>
        <circle cx="60" cy="60" r="44" fill={url('shade')} />
      </>
    );
  } else if (world === 'shuttle') {
    body = (
      <>
        <defs>
          <linearGradient id={id('base')} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#081a4a" /><stop offset="60%" stopColor="#2563c9" /><stop offset="100%" stopColor="#8fd0ff" /></linearGradient>
          <linearGradient id={id('flame')} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fff6c2" /><stop offset="45%" stopColor="#ffae2b" /><stop offset="100%" stopColor="#ff5a1f" stopOpacity="0" /></linearGradient>
          {clip}
        </defs>
        <circle cx="60" cy="60" r="50" fill="#ffb347" opacity="0.14" />
        <circle cx="60" cy="60" r="44" fill={url('base')} />
        <g clipPath={url('clip')}>
          <g fill="#fff">
            <circle cx="30" cy="30" r="1.200" /><circle cx="86" cy="24" r="1" /><circle cx="94" cy="46" r="1.300" /><circle cx="42" cy="20" r="0.900" /><circle cx="24" cy="52" r="1" />
          </g>
          <g fill="#fff" opacity="0.9">
            <ellipse cx="34" cy="96" rx="20" ry="7" /><ellipse cx="86" cy="100" rx="22" ry="8" /><ellipse cx="60" cy="106" rx="18" ry="6" />
          </g>
          <g transform="translate(60 56) rotate(24)">
            <path d="M-7 22h14l3 30h-20z" fill={url('flame')} />
            <path d="M0-34c8 7 11 17 11 28v28h-22V-6c0-11 3-21 11-28z" fill="#f4f6fa" />
            <path d="M0-34c5 4.500 8 10 9.600 16h-19.200c1.600-6 4.600-11.500 9.600-16z" fill="#ff5a4d" />
            <path d="M-11 6l-9 10v10l9-4zM11 6l9 10v10l-9-4z" fill="#c9d2e0" />
            <circle cx="0" cy="-6" r="4.500" fill="#1c3f8f" stroke="#9fc4ff" strokeWidth="1.500" />
            <path d="M-11 14h22" stroke="#c9d2e0" strokeWidth="2" />
          </g>
        </g>
      </>
    );
  } else {
    body = (
      <>
        <defs>
          <radialGradient id={id('base')} cx="50%" cy="20%" r="90%"><stop offset="0%" stopColor="#16306b" /><stop offset="100%" stopColor="#050a1e" /></radialGradient>
          <linearGradient id={id('panel')} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#3f7dff" /><stop offset="100%" stopColor="#173a94" /></linearGradient>
          {clip}
        </defs>
        <circle cx="60" cy="60" r="50" fill="#7fe7ff" opacity="0.12" />
        <circle cx="60" cy="60" r="44" fill={url('base')} />
        <g clipPath={url('clip')}>
          <g fill="#fff">
            <circle cx="28" cy="34" r="1.200" /><circle cx="90" cy="30" r="1" /><circle cx="76" cy="20" r="1.300" /><circle cx="40" cy="22" r="0.900" /><circle cx="98" cy="62" r="1" /><circle cx="22" cy="66" r="1" />
          </g>
          <ellipse cx="60" cy="132" rx="70" ry="40" fill="#2a7fe0" />
          <ellipse cx="60" cy="130" rx="70" ry="40" fill="none" stroke="#9fe0ff" strokeWidth="2" opacity="0.7" />
          <g transform="translate(60 56) rotate(-14)">
            <rect x="-40" y="-2" width="80" height="4" rx="2" fill="#aab3c4" />
            {[-38, -24, 12, 26].map((x) => (
              <g key={x}>
                <rect x={x} y="-22" width="12" height="44" rx="1.500" fill={url('panel')} stroke="#bcd3ff" strokeWidth="1" />
                <path d={`M${x} -8h12M${x} 0h12M${x} 8h12`} stroke="#bcd3ff" strokeWidth="0.700" opacity="0.7" />
              </g>
            ))}
            <rect x="-9" y="-10" width="18" height="20" rx="5" fill="#f1f4f9" />
            <rect x="-5" y="-17" width="10" height="8" rx="3" fill="#d5dbe7" />
            <circle cx="0" cy="0" r="3.200" fill="#1c3f8f" stroke="#9fc4ff" strokeWidth="1.200" />
          </g>
        </g>
      </>
    );
  }

  return (
    <svg className={`world-art ${className}`} width={size} height={size} viewBox="0 0 120 120" aria-hidden="true" focusable="false">
      {body}
    </svg>
  );
}

/** Commander Reyes, the recurring mission commander. An invented character, drawn in code. */
export function ReyesPortrait({ size = 120 }: { size?: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <svg className="reyes" width={size} height={size} viewBox="0 0 120 120" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={`rb-${uid}`} cx="50%" cy="30%" r="80%"><stop offset="0%" stopColor="#2b59c9" /><stop offset="100%" stopColor="#0a1a44" /></radialGradient>
        <clipPath id={`rc-${uid}`}><circle cx="60" cy="60" r="54" /></clipPath>
      </defs>
      <circle cx="60" cy="60" r="58" fill="#ffc43d" />
      <circle cx="60" cy="60" r="54" fill={`url(#rb-${uid})`} />
      <g clipPath={`url(#rc-${uid})`}>
        {/* flight suit and collar */}
        <path d="M14 122c2-26 20-36 46-36s44 10 46 36z" fill="#f08a24" />
        <path d="M44 88l16 14 16-14-6-6H50z" fill="#e9eef7" />
        <path d="M22 104h20v8H22z" fill="#1d3f94" /><circle cx="90" cy="106" r="7" fill="#ffc43d" stroke="#0a1a44" strokeWidth="2" />
        {/* neck, head, hair */}
        <rect x="51" y="70" width="18" height="16" rx="6" fill="#b5764a" />
        <ellipse cx="60" cy="52" rx="21" ry="24" fill="#c98a5c" />
        <path d="M38 50c-2-20 9-31 23-31s25 10 22 30c-4-9-9-13-22-13s-19 5-23 14z" fill="#2a1c14" />
        <path d="M39 47c4-7 10-9 21-9" fill="none" stroke="#b9c0cc" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
        {/* face */}
        <ellipse cx="51" cy="53" rx="2.6" ry="3" fill="#1b1410" /><ellipse cx="69" cy="53" rx="2.6" ry="3" fill="#1b1410" />
        <path d="M45 46c3-2 7-2 10 0M65 46c3-2 7-2 10 0" fill="none" stroke="#2a1c14" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M52 64c5 4 11 4 16 0" fill="none" stroke="#6e3a22" strokeWidth="2.4" strokeLinecap="round" />
        {/* headset */}
        <path d="M37 54c-1-22 10-34 23-34s24 12 23 34" fill="none" stroke="#dfe6f5" strokeWidth="4" strokeLinecap="round" />
        <rect x="32" y="48" width="9" height="16" rx="4" fill="#dfe6f5" /><rect x="79" y="48" width="9" height="16" rx="4" fill="#dfe6f5" />
        <path d="M36 64c1 9 8 12 16 11" fill="none" stroke="#dfe6f5" strokeWidth="2.6" strokeLinecap="round" /><circle cx="53" cy="75" r="3" fill="#0a1a44" stroke="#dfe6f5" strokeWidth="1.5" />
      </g>
    </svg>
  );
}
