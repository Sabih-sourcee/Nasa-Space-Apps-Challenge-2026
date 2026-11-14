import { useEffect } from 'react';
import { hud, useHud } from './game/hud';
import { input } from './game/input';
import { probe } from './game/probe';
import { useGame } from './game/store';
import { EarthMission, HomeScene } from './missions/EarthMission';
import { MarsMission } from './missions/MarsMission';
import { ModuleAlertMission } from './missions/ModuleAlertMission';
import { MoonMission } from './missions/MoonMission';
import { ShuttleMission } from './missions/ShuttleMission';
import { StationMission } from './missions/StationMission';
import type { DemoMissionId } from './sim/types';
import { GameCanvas, simClock } from './three/GameCanvas';
import { Btn } from './ui/common';
import { Debrief } from './ui/Debrief';
import { Hud, PauseMenu, TouchControls } from './ui/Hud';
import { Atlas, Briefing, Credits, Home, SettingsDialog } from './ui/Screens';

const SCENES: Record<DemoMissionId, () => React.ReactNode> = {
  E02: EarthMission,
  F01: ShuttleMission,
  S01: StationMission,
  S04: ModuleAlertMission,
  L02: MoonMission,
  M04: MarsMission,
};

function MissionScreen() {
  const run = useGame((s) => s.run);
  if (!run) return null;
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
      <Btn kind="ghost" onClick={dismiss}>OK</Btn>
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
    (window as unknown as Record<string, unknown>).__beyondEarth = { game: useGame, hud: useHud, hudApi: hud, input, simClock, probe };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.reducedMotion = reduced ? 'true' : 'false';
  }, [reduced]);

  if (!ready) return <div className="loading">Loading Beyond Earth…</div>;

  return (
    <div className={`app screen-${screen}`}>
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
      <SettingsDialog />
      <Notes />
    </div>
  );
}
