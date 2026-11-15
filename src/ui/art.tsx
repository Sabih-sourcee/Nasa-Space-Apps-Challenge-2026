// Plates for the mission map, mission card, briefings and results. Earth, the
// Moon and Mars are the real NASA globe maps from public/textures, shown as a
// lit disc in a thin frame with a caption. The shuttle, the station, the patch
// and Commander Reyes are hairline drawings. Decorative only.

import type { WorldId } from '../sim/types';

const PHOTO: Partial<Record<WorldId, { file: string; credit: string; at: string }>> = {
  earth: { file: 'earth', credit: 'NASA SVS 3615', at: '22%' },
  moon: { file: 'moon', credit: 'NASA SVS 4720 / LRO', at: '50%' },
  mars: { file: 'mars', credit: 'NASA 3D RESOURCES', at: '58%' },
};

const LABEL: Record<WorldId, string> = { earth: 'EARTH', shuttle: 'SHUTTLE', station: 'STATION', moon: 'MOON', mars: 'MARS' };

/** The Beyond Earth mark: an original hairline emblem, not based on any agency insignia. */
export function MissionPatch({ size = 84 }: { size?: number }) {
  return (
    <svg className="patch" width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <rect x="0.5" y="0.5" width="99" height="99" fill="none" stroke="#2A2A2A" />
      <circle cx="50" cy="50" r="14" fill="none" stroke="#E8E6DF" strokeWidth="1" />
      <ellipse cx="50" cy="50" rx="40" ry="13" fill="none" stroke="#FF3B1F" strokeWidth="1" transform="rotate(-24 50 50)" />
      <circle cx="84" cy="34" r="2.2" fill="#FF3B1F" />
      <path d="M50 4v8M50 88v8M4 50h8M88 50h8" stroke="#8A877E" strokeWidth="1" />
    </svg>
  );
}

function LineDrawing({ world }: { world: 'shuttle' | 'station' }) {
  const s = { fill: 'none', stroke: '#E8E6DF', strokeWidth: 1, vectorEffect: 'non-scaling-stroke' as const };
  if (world === 'shuttle') {
    return (
      <svg viewBox="0 0 120 120" width="100%" height="100%" aria-hidden="true" focusable="false">
        <path {...s} d="M60 14c7 7 10 17 10 30v44H50V44c0-13 3-23 10-30z" />
        <path {...s} d="M50 70l-16 18v8l16-6M70 70l16 18v8l-16-6" />
        <path {...s} d="M54 88l-3 12h18l-3-12" />
        <path {...s} d="M50 44h20M50 58h20" stroke="#8A877E" />
        <circle {...s} cx="60" cy="34" r="4" />
        <path d="M60 104v10" stroke="#FF3B1F" strokeWidth="1" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 120 120" width="100%" height="100%" aria-hidden="true" focusable="false">
      <path {...s} d="M14 60h92" />
      {[18, 34, 74, 90].map((x) => (
        <g key={x}>
          <rect {...s} x={x - 6} y="34" width="12" height="52" />
          <path {...s} d={`M${x - 6} 47h12M${x - 6} 60h12M${x - 6} 73h12`} stroke="#8A877E" />
        </g>
      ))}
      <rect {...s} x="50" y="48" width="20" height="24" />
      <rect {...s} x="54" y="38" width="12" height="10" />
      <circle {...s} cx="60" cy="60" r="3" />
    </svg>
  );
}

/** A plate: the world in a thin frame, with a mono caption under it when there is room. */
export function WorldArt({ world, size = 120, className = '' }: { world: WorldId; size?: number; className?: string }) {
  const photo = PHOTO[world];
  const caption = size >= 90;
  return (
    <figure className={`world-art plate ${className}`} style={{ width: size }} aria-hidden="true">
      <div className="plate-frame" style={{ height: size }}>
        {photo ? (
          <div
            className="planet-disc"
            style={{ backgroundImage: `url(${import.meta.env.BASE_URL}textures/${photo.file}.jpg)`, backgroundPosition: `${photo.at} 50%` }}
          />
        ) : (
          <div className="plate-drawing"><LineDrawing world={world as 'shuttle' | 'station'} /></div>
        )}
      </div>
      {caption && <figcaption>{LABEL[world]} / {photo ? photo.credit : 'LINE DRAWING'}</figcaption>}
    </figure>
  );
}

/** Commander Reyes, the recurring mission commander. An invented character, drawn as a personnel-file outline. */
export function ReyesPortrait({ size = 120 }: { size?: number }) {
  const s = { fill: 'none', stroke: '#E8E6DF', strokeWidth: 1, vectorEffect: 'non-scaling-stroke' as const };
  return (
    <svg className="reyes" width={size} height={size} viewBox="0 0 120 120" aria-hidden="true" focusable="false">
      <rect x="0.5" y="0.5" width="119" height="119" fill="#0A0A0A" stroke="#2A2A2A" />
      <path {...s} d="M18 120c2-24 18-34 42-34s40 10 42 34" />
      <path {...s} d="M46 86l14 12 14-12" stroke="#8A877E" />
      <ellipse {...s} cx="60" cy="52" rx="19" ry="23" />
      <path {...s} d="M38 54c-1-21 9-33 22-33s23 12 22 33" stroke="#8A877E" />
      <path {...s} d="M38 62c1 9 7 12 14 11" stroke="#8A877E" />
      <circle cx="53" cy="73" r="2" fill="#FF3B1F" />
      <path d="M6 6h10M6 6v10M114 6h-10M114 6v10M6 114h10M6 114v-10M114 114h-10M114 114v-10" stroke="#8A877E" strokeWidth="1" />
    </svg>
  );
}
