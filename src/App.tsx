import { useEffect } from 'react';
import { crewPos, useCrew } from './game/crewStore';
import { hud, useHud } from './game/hud';
import { input } from './game/input';
import { probe } from './game/probe';
import { useGame } from './game/store';
import { EarthMission, HomeScene } from './missions/EarthMission';
import { MarsMission } from './missions/MarsMission';
import { LastBatteryMission } from './missions/LastBatteryMission';
import { ModuleAlertMission } from './missions/ModuleAlertMission';
import { MoonMission } from './missions/MoonMission';
import { ShipMission } from './missions/ShipMission';
import { ShuttleMission } from './missions/ShuttleMission';
import { StationMission } from './missions/StationMission';
import type { DemoMissionId } from './sim/types';
import { GameCanvas, simClock } from './three/GameCanvas';
import { Btn, dialogOpen } from './ui/common';
import { CommanderBriefing } from './ui/Commander';
import { CrewShip } from './ui/CrewShip';
import { GravityLab } from './ui/GravityLab';
import { Debrief } from './ui/Debrief';
import { DocHeader } from './ui/DocHeader';
import { Hud, PauseMenu, TouchControls } from './ui/Hud';
import { Atlas, Briefing, Credits, Home, SettingsDialog } from './ui/Screens';

const SCENES: Record<DemoMissionId, () => React.ReactNode> = {
  E02: EarthMission,
  F01: ShuttleMission,
  F03: ShipMission,
  S01: StationMission,
  S04: ModuleAlertMission,
  L02: MoonMission,
  L03: LastBatteryMission,
  M04: MarsMission,
};

function MissionScreen() {
  const run = useGame((s) => s.run);
  const intro = useGame((s) => s.intro);
  const endIntro = useGame((s) => s.endIntro);
  if (!run) return null;
  // The scene is not started until the player takes control, so nothing happens behind the briefing.
  if (intro) return <div className="mission"><CommanderBriefing missionId={run.missionId} tier={run.tier} onDone={endIntro} /></div>;
  const Scene = SCENES[run.missionId];
  return (
    <div className="mission" data-mission={run.missionId} data-phase={run.phase}>
      <Scene key={`${run.missionId}-${run.attempt}`} />
      <Hud />
      <TouchControls />
      <PauseMenu />
    </div>
  );
}

function Notes() {
  const notes = useGame((s) => s.notes);
  const dismiss = useGame((s) => s.dismissNotes);
  if (notes.length === 0) return null;
  return (
    <div className="notes" role="status">
      {notes.map((n) => <p key={n}>{n}</p>)}
      <Btn kind="ghost" size="sm" icon="check" onClick={dismiss}>OK</Btn>
    </div>
  );
}

export function App() {
  const ready = useGame((s) => s.ready);
  const screen = useGame((s) => s.screen);
  const reduced = useGame((s) => s.save.settings.reducedMotion);

  useEffect(() => {
    input.attach();
    useGame.getState().init();
    // Test hook for automated browser checks. It only exposes state the page already has.
    (window as unknown as Record<string, unknown>).__beyondEarth = { game: useGame, hud: useHud, hudApi: hud, input, simClock, probe, crew: useCrew, crewPos };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.reducedMotion = reduced ? 'true' : 'false';
  }, [reduced]);

  // Each menu screen puts keyboard focus on its main button, so Enter always means "go on".
  // On the results screen this waits for the stars, and for any key still held from the
  // mission to be released, so a held Space cannot skip the results.
  useEffect(() => {
    if (!ready || screen === 'mission') return;
    let timer = 0;
    let tries = 0;
    const focusMain = () => {
      if (dialogOpen()) return;
      if (input.anyHeld() && tries++ < 40) { timer = window.setTimeout(focusMain, 250); return; }
      const main = document.querySelector<HTMLElement>('.app [data-autofocus]');
      const idle = document.activeElement === document.body || document.activeElement === null;
      if (main && idle) main.focus({ preventScroll: true });
    };
    timer = window.setTimeout(focusMain, screen === 'debrief' ? 1500 : 80);
    return () => window.clearTimeout(timer);
  }, [ready, screen]);

  if (!ready) return <div className="loading">Loading Beyond Earth</div>;

  return (
    <div className={`app screen-${screen}`}>
      <DocHeader />
      {screen === 'home' && (
        <>
          <div className="backdrop"><GameCanvas fov={52} envIntensity={0.55} background="#cfe2f3"><HomeScene /></GameCanvas></div>
          <Home />
        </>
      )}
      {screen === 'atlas' && <Atlas />}
      {screen === 'briefing' && <Briefing />}
      {screen === 'mission' && <MissionScreen />}
      {screen === 'debrief' && <Debrief />}
      {screen === 'credits' && <Credits />}
      {screen === 'crew' && <CrewShip />}
      {screen === 'gravity' && <GravityLab />}
      <SettingsDialog />
      <Notes />
    </div>
  );
}
