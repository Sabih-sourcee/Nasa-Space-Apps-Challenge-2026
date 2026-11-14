import { useState } from 'react';
import { callSign, useGame } from '../game/store';
import { CATALOG, DEMO_MISSIONS, STATUS_LABEL, WORLD_INFO, missionStatus, nextMission, type MissionStatus } from '../sim/missions';
import { hintsOn } from '../sim/save';
import { LABELS, SOURCES } from '../sim/sources';
import { DEMO_ROUTE, PLAYABLE, TIER_LABEL, WORLDS, isDemoMission, type DemoMissionId, type WorldId } from '../sim/types';
import { Btn, Dialog, SourceLink, TierPicker } from './common';

// ---------------------------------------------------------------------------
// Home
// ---------------------------------------------------------------------------

export function Home() {
  const save = useGame((s) => s.save);
  const mode = useGame((s) => s.mode);
  const go = useGame((s) => s.go);
  const startCampaign = useGame((s) => s.startCampaign);
  const resume = useGame((s) => s.resumeCheckpoint);
  const openSettings = useGame((s) => s.openSettings);
  const setMode = useGame((s) => s.setMode);
  const done = PLAYABLE.filter((id) => save.completed[id]).length;
  const routeDone = DEMO_ROUTE.filter((id) => save.completed[id]).length;
  const cp = save.checkpoint;
  const next = nextMission(save.completed);
  const started = done > 0 || !!cp;

  return (
    <div className="home">
      <div className="home-panel">
        <h1 className="logo"><span>BEYOND</span> <span className="accent">EARTH</span></h1>
        <p className="tagline">Train. Launch. Explore. Survive.</p>
        <nav className="menu" aria-label="Main menu">
          {!started && <Btn autoFocus onClick={startCampaign}>Start Training</Btn>}
          {cp && (
            <Btn autoFocus onClick={() => { resume(); }}>
              Continue: {DEMO_MISSIONS[cp.missionId].title}
            </Btn>
          )}
          {started && !cp && next && <Btn autoFocus onClick={startCampaign}>Continue Campaign</Btn>}
          {started && !cp && !next && <Btn autoFocus onClick={() => go('atlas')}>Campaign complete: open the atlas</Btn>}
          <Btn kind="ghost" onClick={() => go('atlas')}>Mission Atlas</Btn>
          <Btn kind="ghost" onClick={() => openSettings(true)}>Settings</Btn>
          <Btn kind="ghost" onClick={() => go('credits')}>Science and Credits</Btn>
        </nav>
        <TierPicker compact />
        <p className="fine">Difficulty applies the next time a mission starts or restarts.</p>
        <div className="home-foot">
          <span>{callSign(save.profileId)} · guest profile · {done} of {PLAYABLE.length} missions complete ({routeDone} of 5 worlds)</span>
          <label className="switch">
            <input type="checkbox" checked={mode === 'judge'} onChange={(e) => setMode(e.target.checked ? 'judge' : 'campaign')} />
            <span>Judge Mode (opens every playable mission, separate progress)</span>
          </label>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mission Atlas
// ---------------------------------------------------------------------------

const WORLD_POS: Record<WorldId, { x: number; y: number; r: number }> = {
  earth: { x: 120, y: 190, r: 58 },
  shuttle: { x: 330, y: 110, r: 22 },
  station: { x: 530, y: 80, r: 30 },
  moon: { x: 720, y: 170, r: 40 },
  mars: { x: 900, y: 90, r: 46 },
};

const STATUS_ICON: Record<MissionStatus, string> = { completed: '✔', available: '▶', locked: '🔒', planned: '…' };

function RouteMap({ worldDone }: { worldDone: Record<WorldId, boolean> }) {
  const order = WORLDS.map((w) => WORLD_POS[w]);
  const path = order.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  return (
    <svg className="route" viewBox="0 0 1020 300" role="img" aria-label="Campaign route: Earth, Shuttle, Orbital Station, Moon, Mars">
      <defs>
        <filter id="rough"><feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="3" seed="4" /><feColorMatrix type="saturate" values="0" /><feComposite in2="SourceGraphic" operator="in" /><feBlend in="SourceGraphic" mode="multiply" /></filter>
        <radialGradient id="g-earth" cx="35%" cy="32%"><stop offset="0%" stopColor="#9fd6ff" /><stop offset="55%" stopColor="#2f77c4" /><stop offset="100%" stopColor="#0b2a5a" /></radialGradient>
        <radialGradient id="g-moon" cx="35%" cy="32%"><stop offset="0%" stopColor="#f1f1ee" /><stop offset="60%" stopColor="#a3a29f" /><stop offset="100%" stopColor="#4b4a49" /></radialGradient>
        <radialGradient id="g-mars" cx="35%" cy="32%"><stop offset="0%" stopColor="#f0a26c" /><stop offset="60%" stopColor="#b5522a" /><stop offset="100%" stopColor="#5a2412" /></radialGradient>
      </defs>
      <path d={path} className="route-line" />
      <ellipse cx="120" cy="190" rx="96" ry="34" className="orbit-ring" transform="rotate(-18 120 190)" />
      <circle cx={WORLD_POS.earth.x} cy={WORLD_POS.earth.y} r={WORLD_POS.earth.r} fill="url(#g-earth)" filter="url(#rough)" />
      <g transform={`translate(${WORLD_POS.shuttle.x} ${WORLD_POS.shuttle.y}) rotate(-28)`}>
        <rect x="-24" y="-7" width="40" height="14" rx="6" fill="#e8eaec" />
        <path d="M16 -7 L30 0 L16 7 Z" fill="#e8eaec" /><path d="M-18 -7 L-6 -20 L6 -7 Z M-18 7 L-6 20 L6 7 Z" fill="#c4c8cc" />
        <rect x="-28" y="-4" width="6" height="8" fill="#e23d3d" />
      </g>
      <g transform={`translate(${WORLD_POS.station.x} ${WORLD_POS.station.y})`}>
        <rect x="-44" y="-3" width="88" height="6" fill="#9aa0a6" />
        {[-40, -26, 14, 28].map((x) => <rect key={x} x={x} y="-24" width="12" height="48" fill="#1d3a7a" stroke="#b9c4d6" strokeWidth="1" />)}
        <rect x="-10" y="-9" width="20" height="18" rx="4" fill="#e8eaec" />
      </g>
      <circle cx={WORLD_POS.moon.x} cy={WORLD_POS.moon.y} r={WORLD_POS.moon.r} fill="url(#g-moon)" filter="url(#rough)" />
      <circle cx={WORLD_POS.mars.x} cy={WORLD_POS.mars.y} r={WORLD_POS.mars.r} fill="url(#g-mars)" filter="url(#rough)" />
      {WORLDS.map((w) => {
        const p = WORLD_POS[w];
        return (
          <g key={w}>
            <text x={p.x} y={p.y + p.r + 26} className="route-label">{WORLD_INFO[w].label.toUpperCase()}</text>
            <text x={p.x} y={p.y + p.r + 44} className="route-sub">{worldDone[w] ? 'Playable mission complete' : WORLD_INFO[w].blurb}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function Atlas() {
  const save = useGame((s) => s.save);
  const mode = useGame((s) => s.mode);
  const go = useGame((s) => s.go);
  const openBriefing = useGame((s) => s.openBriefing);
  const setMode = useGame((s) => s.setMode);
  const judge = mode === 'judge';
  const worldDone = Object.fromEntries(WORLDS.map((w) => [w, CATALOG.some((m) => m.world === w && m.demo && save.completed[m.id])])) as Record<WorldId, boolean>;
  const milestones = Object.values(DEMO_MISSIONS).map((m) => m.milestone).filter((m): m is { id: string; label: string } => !!m);

  return (
    <div className="screen atlas">
      <header className="screen-head">
        <div>
          <div className="kicker">Mission Control</div>
          <h1>Mission Atlas</h1>
        </div>
        <div className="head-actions">
          <label className="switch">
            <input type="checkbox" checked={judge} onChange={(e) => setMode(e.target.checked ? 'judge' : 'campaign')} />
            <span>Judge Mode</span>
          </label>
          <Btn kind="ghost" onClick={() => go('home')}>Home</Btn>
        </div>
      </header>
      {judge && <p className="banner">Judge Mode is on. Every playable mission is open. Progress here is saved separately from the campaign.</p>}
      <RouteMap worldDone={worldDone} />
      <div className="milestones" aria-label="Certification milestones">
        {milestones.map((m) => {
          const earned = save.milestones.includes(m.id);
          return <span key={m.id} className={`milestone ${earned ? 'earned' : ''}`}>{earned ? '★' : '☆'} {m.label}: {earned ? 'earned' : 'not yet earned'}</span>;
        })}
      </div>
      <div className="worlds">
        {WORLDS.map((w) => (
          <section key={w} className="world-col" aria-label={WORLD_INFO[w].label}>
            <h2>{WORLD_INFO[w].label}</h2>
            <ul>
              {CATALOG.filter((m) => m.world === w).map((m) => {
                const status = missionStatus(m.id, save.completed, judge);
                const playable = status === 'available' || status === 'completed';
                const body = (
                  <>
                    <span className="chip-top">
                      <span className="chip-id">{m.id}</span>
                      <span className={`chip-status ${status}`}><span aria-hidden="true">{STATUS_ICON[status]}</span> {STATUS_LABEL[status]}</span>
                    </span>
                    <span className="chip-title">{m.title}</span>
                    <span className="chip-task">{m.task}</span>
                    {status === 'locked' && isDemoMission(m.id) && <span className="chip-note">Complete {DEMO_MISSIONS[DEMO_MISSIONS[m.id].requires ?? 'E02'].title} to unlock.</span>}
                    {status === 'planned' && <span className="chip-note">Planned for the full campaign. Not in this prototype.</span>}
                  </>
                );
                return (
                  <li key={m.id}>
                    {playable && isDemoMission(m.id)
                      ? <button type="button" className={`chip ${status}`} onClick={() => openBriefing(m.id as DemoMissionId)}>{body}</button>
                      : <div className={`chip ${status}`} aria-disabled="true">{body}</div>}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Briefing
// ---------------------------------------------------------------------------

export function Briefing() {
  const id = useGame((s) => s.selected);
  const save = useGame((s) => s.save);
  const start = useGame((s) => s.startMission);
  const startAt = useGame((s) => s.startMissionAt);
  const mode = useGame((s) => s.mode);
  const resume = useGame((s) => s.resumeCheckpoint);
  const go = useGame((s) => s.go);
  const update = useGame((s) => s.updateSettings);
  if (!id) return null;
  const def = DEMO_MISSIONS[id];
  const tier = save.settings.tier;
  const cp = save.checkpoint && save.checkpoint.missionId === id ? save.checkpoint : null;
  const cpPhase = cp ? def.phases.find((p) => p.id === cp.phase) : null;
  const hints = hintsOn(save.settings, tier);
  return (
    <div className="screen briefing">
      <header className="screen-head">
        <div>
          <div className="kicker">{WORLD_INFO[def.world].label} · You are the {def.duty.toLowerCase()}</div>
          <h1>{def.title}</h1>
        </div>
        <div className="head-actions"><Btn kind="ghost" onClick={() => go('atlas')}>Mission Atlas</Btn></div>
      </header>
      <div className="brief-simple">
        <section className="card brief-main">
          <p className="brief-goal">{def.goal}</p>
          <ol className="brief-steps">
            {def.phases.map((p, i) => <li key={p.id}><span className="step-num">{i + 1}</span><span><strong>{p.label}</strong><br />{p.objective}</span></li>)}
          </ol>
          <h2>Controls</h2>
          <ul className="key-list">{def.controls.map((c) => {
            const cut = c.indexOf(':');
            return <li key={c}><span>{cut < 0 ? c : c.slice(0, cut)}</span>{cut >= 0 && <kbd>{c.slice(cut + 1).trim()}</kbd>}</li>;
          })}</ul>
          <details className="more">
            <summary>Science and details</summary>
            <p><strong>Skill:</strong> {def.skill}</p>
            <p><strong>You start with:</strong> {def.startingResources}</p>
            <p>{def.science.text}</p>
            <p><SourceLink id={def.science.sourceId} /></p>
            <p className="labels">{def.labels.join(' · ')}</p>
          </details>
        </section>
        <section className="card brief-side">
          <TierPicker compact />
          <p className="tier-detail">{def.tiers[tier]}</p>
          <label className="switch">
            <input type="checkbox" checked={hints} onChange={(e) => update({ hints: e.target.checked ? 'on' : 'off' })} />
            <span>Tips {hints ? 'on' : 'off'}</span>
          </label>
          <div className="stack">
            {cp && cpPhase && <Btn autoFocus onClick={() => { resume(); }}>Continue from: {cpPhase.checkpoint}</Btn>}
            <Btn autoFocus={!cp} kind={cp ? 'ghost' : 'primary'} onClick={() => start(id)}>{cp ? 'Start over' : 'Start mission'}</Btn>
          </div>
          {mode === 'judge' && def.phases.length > 1 && (
            <details className="more judge-jump" open>
              <summary>Judge Mode: jump ahead</summary>
              <div className="stack">
                {def.phases.slice(1).map((p) => <Btn key={p.id} kind="ghost" onClick={() => startAt(id, p.id)}>Start at: {p.label}</Btn>)}
              </div>
            </details>
          )}
        </section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export function SettingsDialog() {
  const open = useGame((s) => s.settingsOpen);
  const settings = useGame((s) => s.save.settings);
  const update = useGame((s) => s.updateSettings);
  const close = useGame((s) => s.openSettings);
  const reset = useGame((s) => s.resetProgress);
  const mode = useGame((s) => s.mode);
  const [confirm, setConfirm] = useState(false);
  if (!open) return null;
  const toggle = (key: 'reducedMotion' | 'audio' | 'captions', label: string, note: string) => (
    <label className="switch block">
      <input type="checkbox" checked={settings[key]} onChange={(e) => update({ [key]: e.target.checked })} />
      <span><strong>{label}</strong><br /><small>{note}</small></span>
    </label>
  );
  return (
    <Dialog title="Settings" onClose={() => { setConfirm(false); close(false); }} wide>
      <div className="settings-grid">
        <div>
          <TierPicker />
          <p className="fine">Applies to the next mission start or restart.</p>
          <label className="switch block">
            <input type="checkbox" checked={settings.hints !== 'off' && (settings.hints === 'on' || settings.tier === 'junior')}
              onChange={(e) => update({ hints: e.target.checked ? 'on' : 'off' })} />
            <span><strong>Hints</strong><br /><small>On by default for Junior. Optional for Middle and Advanced.</small></span>
          </label>
        </div>
        <div>
          {toggle('reducedMotion', 'Reduced motion', 'Fixed camera, no shake, no flashing or bobbing.')}
          {toggle('audio', 'Sound and spoken alerts', 'Off by default. The whole game can be played muted.')}
          {toggle('captions', 'Captions', 'Show spoken alerts as text.')}
          <label className="switch block">
            <input type="checkbox" checked={settings.graphics === 'low'} onChange={(e) => update({ graphics: e.target.checked ? 'low' : 'high' })} />
            <span><strong>Low graphics preset</strong><br /><small>No shadows, lower resolution. Use this if the picture stutters.</small></span>
          </label>
        </div>
      </div>
      <div className="danger-zone">
        {!confirm
          ? <Btn kind="danger" onClick={() => setConfirm(true)}>Reset Progress</Btn>
          : (
            <div role="alertdialog" aria-label="Confirm reset">
              <p><strong>Reset {mode === 'judge' ? 'Judge Mode' : 'campaign'} progress?</strong> Completed missions, milestones and the saved checkpoint will be erased. This cannot be undone.</p>
              <div className="row">
                <Btn kind="danger" onClick={() => { reset(); setConfirm(false); close(false); }}>Yes, erase progress</Btn>
                <Btn kind="ghost" onClick={() => setConfirm(false)}>Keep my progress</Btn>
              </div>
            </div>
          )}
      </div>
      <div className="stack"><Btn autoFocus onClick={() => { setConfirm(false); close(false); }}>Done</Btn></div>
      <p className="fine">Progress is stored only in this browser. The game does not ask for or collect names, emails or other personal details.</p>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Science and credits
// ---------------------------------------------------------------------------

export function Credits() {
  const go = useGame((s) => s.go);
  return (
    <div className="screen credits">
      <header className="screen-head">
        <div><div className="kicker">Science Center</div><h1>Science and Credits</h1></div>
        <div className="head-actions"><Btn kind="ghost" autoFocus onClick={() => go('home')}>Home</Btn></div>
      </header>
      <section className="card">
        <h2>What is real and what is invented</h2>
        <ul>
          <li><strong>Real, sourced:</strong> gravity on the Moon and Mars, why astronauts float in orbit, why crews shelter during solar particle events, signal delay to the Moon and Mars, the thin Martian atmosphere.</li>
          <li><strong>Archived record:</strong> the lunar solar alert is labelled with a dated NASA DONKI alert. {LABELS.archived}</li>
          <li><strong>Compressed time:</strong> launches, landings and outpost shifts are shortened so a mission fits in a few minutes.</li>
          <li><strong>Invented game values:</strong> energy units, crop stages, fuel budgets, the Air comfort score and every vehicle, station and habitat.</li>
        </ul>
      </section>
      <section className="card">
        <h2>Sources</h2>
        <table className="sources">
          <thead><tr><th>Source</th><th>What the game uses</th><th>What the game simplifies or invents</th></tr></thead>
          <tbody>
            {SOURCES.map((s) => (
              <tr key={s.id}>
                <td><SourceLink id={s.id} /></td>
                <td>{s.use}</td>
                <td>{s.simplified}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="card">
        <h2>Assets and code</h2>
        <ul>
          <li>All 3D models, textures, sounds and the Beyond Earth mission patch are generated in code for this project. No third-party models, images or audio files are included.</li>
          <li>No NASA insignia or national flags are used. Beyond Earth is a student hackathon project and is not endorsed by NASA.</li>
          <li>Open-source libraries: React, React DOM, three.js, React Three Fiber and Zustand (all MIT licensed). Built with Vite and TypeScript.</li>
          <li>The game works offline once loaded. It makes no network requests while you play.</li>
        </ul>
      </section>
    </div>
  );
}
