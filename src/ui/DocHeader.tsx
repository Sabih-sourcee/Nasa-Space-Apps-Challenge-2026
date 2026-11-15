import { useCrew } from '../game/crewStore';
import { useGame, type Screen } from '../game/store';
import { DEMO_MISSIONS, WORLD_INFO } from '../sim/missions';

const SCREEN_CODE: Record<Screen, string> = {
  home: 'SCR.00 / TITLE',
  atlas: 'SCR.01 / MISSION INDEX',
  briefing: 'SCR.02 / MISSION CARD',
  mission: 'SCR.03 / LIVE TELEMETRY',
  debrief: 'SCR.04 / DEBRIEF',
  credits: 'SCR.05 / SOURCES',
  crew: 'SCR.06 / CREW SHIP',
  gravity: 'SCR.07 / GRAVITY LAB',
};

/** The document header on every screen: what file this is on the left, which screen on the right. */
export function DocHeader() {
  const screen = useGame((s) => s.screen);
  const mode = useGame((s) => s.mode);
  const selected = useGame((s) => s.selected);
  const run = useGame((s) => s.run);
  const result = useGame((s) => s.result);
  const crew = useCrew((s) => s.session);

  let file = 'BEYOND EARTH / TRAINING DOSSIER';
  const id = screen === 'mission' ? run?.missionId : screen === 'debrief' ? result?.missionId : screen === 'briefing' ? selected : null;
  if (id) {
    const def = DEMO_MISSIONS[id];
    const phase = screen === 'mission' && run ? def.phases.findIndex((p) => p.id === run.phase) : -1;
    file = `MSN ${def.id} / ${WORLD_INFO[def.world].label}${phase >= 0 ? ` / PHASE ${phase + 1} OF ${def.phases.length}` : ''}`;
  } else if (screen === 'atlas') file = 'CAMPAIGN / 5 WORLDS / 20 MISSIONS';
  else if (screen === 'credits') file = 'APPENDIX A / SCIENCE AND CREDITS';
  else if (screen === 'gravity') file = 'TEST CHAMBER / 5 GRAVITY PROFILES';
  else if (screen === 'crew') file = crew ? `KESTREL / CREW ${crew.code}` : 'KESTREL / 15 ROOMS';

  return (
    <header className="doc-head" aria-hidden="true">
      <span className="doc-file">{file}</span>
      {mode === 'judge' && <span className="doc-flag">JUDGE MODE</span>}
      <span className="doc-screen">{SCREEN_CODE[screen]}</span>
    </header>
  );
}
