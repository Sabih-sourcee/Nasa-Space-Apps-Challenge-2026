// Interface icons, drawn for this project as inline SVG. They inherit the text
// colour and are always decorative: the words next to them carry the meaning.

import type { ReactNode } from 'react';

const P: Record<string, ReactNode> = {
  play: <path d="M7 4.5v15a.6.6 0 0 0 .9.5l12.3-7.5a.6.6 0 0 0 0-1L7.9 4a.6.6 0 0 0-.9.5z" fill="currentColor" stroke="none" />,
  pause: <><rect x="5.5" y="4" width="4.6" height="16" rx="1.4" fill="currentColor" stroke="none" /><rect x="13.9" y="4" width="4.6" height="16" rx="1.4" fill="currentColor" stroke="none" /></>,
  gear: <><circle cx="12" cy="12" r="8" strokeWidth="3.6" strokeDasharray="3.14 3.14" strokeLinecap="butt" /><circle cx="12" cy="12" r="5.8" /><circle cx="12" cy="12" r="2.1" /></>,
  map: <><path d="M3 6.5l6-2.5 6 2.5 6-2.5v13.5l-6 2.5-6-2.5-6 2.5z" /><path d="M9 4v13.5M15 6.5V20" /></>,
  book: <><path d="M12 6.2C10 4.7 7.4 4.2 4 4.2v13.3c3.4 0 6 .5 8 2 2-1.5 4.600-2 8-2V4.200c-3.400 0-6 .5-8 2z" /><path d="M12 6.200v13.300" /></>,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2.200" /><path d="M8.200 11V7.600a3.800 3.800 0 0 1 7.600 0V11" /><path d="M12 15v2.200" /></>,
  check: <path d="M4.500 12.800l4.800 4.800L19.500 6.800" strokeWidth="2.800" />,
  x: <path d="M6 6l12 12M18 6L6 18" strokeWidth="2.600" />,
  star: <path d="M12 2.200l3 6.300 6.900.9-5 4.800 1.300 6.900L12 17.800l-6.200 3.300 1.300-6.900-5-4.800 6.900-.9z" fill="currentColor" stroke="currentColor" strokeWidth="1.200" />,
  rocket: <><path d="M12 2.500c3 2.400 4.500 5.800 4.500 9.700v4h-9v-4c0-3.900 1.500-7.300 4.500-9.700z" /><path d="M7.500 13l-3 3v3.200l3-1.400M16.500 13l3 3v3.200l-3-1.400" /><circle cx="12" cy="9.500" r="1.700" /><path d="M10.200 19.200c.4 1.400 1 2.200 1.800 2.500.8-.3 1.400-1.100 1.800-2.500" /></>,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.400" fill="currentColor" /></>,
  bolt: <path d="M13.500 2.500L4.500 13.700h6.300l-1.300 7.800 9-11.200h-6.300z" fill="currentColor" stroke="currentColor" strokeWidth="1.200" />,
  air: <><path d="M3 8.500h10.500a2.800 2.800 0 1 0-2.800-2.800" /><path d="M3 12.500h15.500a2.800 2.800 0 1 1-2.800 2.800" /><path d="M3 16.500h6.500a2.300 2.300 0 1 1-2.300 2.300" /></>,
  battery: <><rect x="2.500" y="7" width="16.500" height="10" rx="2.200" /><path d="M22 10.500v3" /><path d="M6.500 10v4M10.500 10v4" strokeWidth="2.400" /></>,
  leaf: <><path d="M5 19c-.5-8.500 4.500-14 15-14 .5 10-5 15-12.500 14.500" /><path d="M4 21c2.500-5.500 6-9 11.500-11" /></>,
  shield: <><path d="M12 3l8 3v6c0 4.800-3.300 7.800-8 9-4.700-1.200-8-4.200-8-9V6z" /><path d="M8.800 12.200l2.300 2.300 4.300-4.600" /></>,
  flask: <><path d="M9 3h6M10 3v6.200L5 18a2 2 0 0 0 1.800 3h10.400a2 2 0 0 0 1.800-3l-5-8.800V3" /><path d="M7.600 15h8.800" /></>,
  antenna: <><path d="M12 13v8M8 21h8" /><circle cx="12" cy="10" r="2" /><path d="M7.500 14.500a6.400 6.400 0 0 1 0-9M16.500 5.500a6.400 6.400 0 0 1 0 9" /></>,
  fuel: <path d="M12 3c4 4.800 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6.200 6-11z" />,
  gauge: <><path d="M4.600 17a8.500 8.500 0 1 1 14.800 0" /><path d="M12 14l3.600-5.200" strokeWidth="2.400" /><circle cx="12" cy="14" r="1.300" fill="currentColor" /></>,
  warning: <><path d="M12 3.200l9.800 17.300H2.200z" /><path d="M12 10v4.800" strokeWidth="2.400" /><path d="M12 17.700h.01" strokeWidth="2.800" /></>,
  info: <><circle cx="12" cy="12" r="9.300" /><path d="M12 11v6" strokeWidth="2.400" /><path d="M12 7.400h.01" strokeWidth="2.800" /></>,
  replay: <><path d="M4.200 12a7.800 7.800 0 1 0 2.500-5.700" /><path d="M4 3.800v4.700h4.700" /></>,
  home: <><path d="M3 11.500l9-8 9 8" /><path d="M5.500 10v10h13V10" /><path d="M10 20v-5.500h4V20" /></>,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" strokeWidth="2.400" />,
  back: <path d="M19 12H5M11 6l-6 6 6 6" strokeWidth="2.400" />,
  down: <path d="M6 9l6 6 6-6" strokeWidth="2.400" />,
  gamepad: <><path d="M7 8h10a5 5 0 0 1 0 10c-1.500 0-2.600-.8-3.500-2h-3c-.9 1.200-2 2-3.500 2A5 5 0 0 1 7 8z" /><path d="M7.600 11.400v3.200M6 13h3.200" /><path d="M15.300 11.800h.01M17.600 14h.01" strokeWidth="2.800" /></>,
  sound: <><path d="M4 9.200v5.600h3.800l5.200 4V5.200l-5.200 4z" /><path d="M16.200 9a4.200 4.200 0 0 1 0 6M18.800 6.400a7.800 7.800 0 0 1 0 11.200" /></>,
  mute: <><path d="M4 9.200v5.600h3.800l5.200 4V5.200l-5.200 4z" /><path d="M16.800 9.600l4.800 4.800M21.600 9.600l-4.800 4.800" /></>,
  medal: <><circle cx="12" cy="15" r="6" /><path d="M8.600 9.800L6 3h4l2 4 2-4h4l-2.600 6.800" /><path d="M12 12.300l.9 1.800 2 .3-1.450 1.400.35 2-1.800-.95-1.800.95.35-2-1.450-1.400 2-.3z" fill="currentColor" strokeWidth="0.600" /></>,
  headset: <><path d="M5 13.500V12a7 7 0 0 1 14 0v1.500" /><rect x="3.500" y="12.500" width="4" height="6" rx="1.600" /><rect x="16.500" y="12.500" width="4" height="6" rx="1.600" /><path d="M18.500 18.500c0 1.800-1.700 2.700-4.300 2.700" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2.500v2.300M12 19.200v2.300M2.500 12h2.300M19.200 12h2.300M5.300 5.300l1.600 1.600M17.100 17.100l1.600 1.600M5.300 18.700l1.600-1.600M17.100 6.900l1.600-1.600" /></>,
  keyboard: <><rect x="2.500" y="6" width="19" height="12" rx="2.200" /><path d="M6.500 10h.01M10 10h.01M13.500 10h.01M17 10h.01M7.500 14h9" strokeWidth="2.400" /></>,
  helmet: <><path d="M12 3a8 8 0 0 0-8 8v4.500A2.500 2.500 0 0 0 6.500 18h11a2.500 2.500 0 0 0 2.500-2.500V11a8 8 0 0 0-8-8z" /><path d="M7.200 11.200a4.800 4.800 0 0 1 9.600 0v1.600a2 2 0 0 1-2 2H9.200a2 2 0 0 1-2-2z" /><path d="M9 21h6" /></>,
  flag: <><path d="M5.500 21V3.500" /><path d="M5.500 4.500h12l-2.500 4 2.500 4h-12" /></>,
  eye: <><path d="M2.200 12c2.800-5 6.100-7.500 9.800-7.500s7 2.500 9.800 7.500c-2.800 5-6.100 7.500-9.800 7.500S5 17 2.200 12z" /><circle cx="12" cy="12" r="3" /></>,
  wrench: <path d="M15.200 4.600a4.300 4.300 0 0 0-5 5.900L4.300 16.400a2.300 2.300 0 0 0 3.300 3.300l5.900-5.900a4.300 4.300 0 0 0 5.900-5l-2.800 2.800-2.700-.7-.7-2.700z" />,
  list: <><path d="M8.500 6h11.500M8.500 12h11.500M8.500 18h11.500" /><path d="M4.200 6h.01M4.200 12h.01M4.200 18h.01" strokeWidth="2.800" /></>,
  box: <><path d="M3.500 8L12 3.500 20.500 8v8L12 20.500 3.500 16z" /><path d="M3.500 8l8.500 4.500L20.500 8M12 12.500v8" /></>,
  thermo: <><path d="M10 4.500a2 2 0 0 1 4 0v8.800a4.200 4.200 0 1 1-4 0z" /><path d="M12 9.500v7" strokeWidth="2.400" /></>,
  sparkle: <><path d="M11 3l1.900 5.100L18 10l-5.100 1.900L11 17l-1.900-5.100L4 10l5.100-1.900z" /><path d="M18.500 15.500l.8 2.200 2.200.8-2.200.8-.8 2.200-.8-2.200-2.200-.8 2.200-.8z" /></>,
  crew: <><circle cx="9" cy="7.800" r="3.400" /><path d="M2.600 20c0-3.500 2.900-6 6.400-6s6.400 2.500 6.400 6" /><path d="M16 4.600a3.400 3.400 0 0 1 0 6.400M18 14.400c2.200.8 3.400 2.900 3.400 5.600" /></>,
  clock: <><circle cx="12" cy="12" r="9.300" /><path d="M12 6.800V12l3.400 2.200" /></>,
  hand: <><path d="M8 12.500V5.800a1.500 1.500 0 0 1 3 0V11M11 10.500V4.600a1.500 1.500 0 0 1 3 0v6M14 11V6a1.500 1.500 0 0 1 3 0v8.500c0 3.600-2.300 6-5.600 6-2.400 0-3.900-1-5.200-3.200L4 13.600a1.500 1.500 0 0 1 2.500-1.600l1.500 2" /></>,
  bulb: <><path d="M8.500 15.200a6 6 0 1 1 7 0c-.6.500-1 1.200-1 2v.3h-5v-.3c0-.8-.4-1.500-1-2z" /><path d="M9.800 20.800h4.400" /></>,
  trophy: <><path d="M7.500 4h9v5.500a4.500 4.500 0 0 1-9 0z" /><path d="M7.500 5.500H4.200c0 3 1.400 4.600 3.600 4.900M16.500 5.500h3.300c0 3-1.400 4.600-3.600 4.900" /><path d="M12 14v3.500M8.500 20.500h7M9.500 17.500h5" /></>,
};

export type IconName = keyof typeof P;

export function Icon({ name, size = 22, className = '' }: { name: string; size?: number; className?: string }) {
  const body = P[name] ?? P.info;
  return (
    <svg
      className={`icon ${className}`} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    >
      {body}
    </svg>
  );
}

/** Icon for a HUD meter, chosen from its id. */
export function meterIcon(id: string): string {
  switch (id) {
    case 'pressure': case 'lab': case 'closing': case 'rate': return 'gauge';
    case 'oxygen': case 'o2': case 'air': case 'reserve': return 'air';
    case 'throttle': return 'rocket';
    case 'fuel': return 'fuel';
    case 'align': return 'target';
    case 'battery': return 'battery';
    case 'crop': return 'leaf';
    case 'protection': return 'shield';
    case 'science': return 'flask';
    default: return 'gauge';
  }
}
