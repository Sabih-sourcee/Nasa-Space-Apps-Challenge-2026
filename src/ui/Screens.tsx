import { useState } from 'react';
import { callSign, useGame } from '../game/store';
import { CATALOG, DEMO_MISSIONS, STATUS_LABEL, WORLD_INFO, missionStatus, nextMission, type CatalogEntry, type MissionStatus } from '../sim/missions';
import { hintsOn } from '../sim/save';
import { MAX_STARS, STAR_GOAL, rankFor, starsOf, totalStars } from '../sim/score';
import { LABELS, SOURCES } from '../sim/sources';
import { DEMO_ROUTE, PLAYABLE, WORLDS, isDemoMission, type DemoMissionId, type WorldId } from '../sim/types';
import { MissionPatch, WorldArt } from './art';
import { MissionLog } from './Commander';
import { Btn, Chip, ControlList, Dialog, IconBtn, SourceLink, Stars, TierPicker, Tile, Toggle } from './common';
import { Icon } from './icons';

// ---------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------

/** Who is playing: call sign, rank and stars. No personal details, only the random guest id. */
function Profile({ compact = false }: { compact?: boolean }) {
  const save = useGame((s) => s.save);
  const stars = totalStars(save.completed);
  const rank = rankFor(stars);
  const span = rank.next ? rank.next.at - rank.at : 1;
  const into = rank.next ? stars - rank.at : 1;
  return (
    <div className={`profile ${compact ? 'compact' : ''}`}>
      <span className="profile-avatar"><Icon name="helmet" size={compact ? 22 : 26} /></span>
      <div className="profile-main">
        <div className="profile-rank">{rank.title}</div>
        {!compact && <div className="profile-name">{callSign(save.profileId)} · guest profile</div>}
        {!compact && (
          <div className="profile-next">
            <span className="rank-bar" aria-hidden="true"><span style={{ width: `${Math.round((into / span) * 100)}%` }} /></span>
            <span>{rank.next ? `${rank.next.at - stars} more ${rank.next.at - stars === 1 ? 'star' : 'stars'} to ${rank.next.title}` : 'Top rank reached'}</span>
          </div>
        )}
      </div>
      <div className="profile-stars" role="img" aria-label={`${stars} of ${MAX_STARS} stars`}>
        <Icon name="star" size={compact ? 18 : 22} /><strong>{stars}</strong><small>/{MAX_STARS}</small>
      </div>
    </div>
  );
}

function JudgeSwitch() {
  const mode = useGame((s) => s.mode);
  const setMode = useGame((s) => s.setMode);
  return (
    <label className={`judge-switch ${mode === 'judge' ? 'on' : ''}`} title="Opens every playable mission. Progress is saved separately.">
      <input type="checkbox" checked={mode === 'judge'} onChange={(e) => setMode(e.target.checked ? 'judge' : 'campaign')} />
      <Icon name="trophy" size={16} />
      <span>Judge Mode {mode === 'judge' ? 'on' : 'off'}</span>
    </label>
  );
}

function SoundButton() {
  const audio = useGame((s) => s.save.settings.audio);
  const update = useGame((s) => s.updateSettings);
  return <IconBtn icon={audio ? 'sound' : 'mute'} label={audio ? 'Sound on. Press to mute' : 'Sound off. Press to turn on'} pressed={audio} onClick={() => update({ audio: !audio })} />;
}

// ---------------------------------------------------------------------------
// Title screen
// ---------------------------------------------------------------------------

export function Home() {
  const save = useGame((s) => s.save);
  const go = useGame((s) => s.go);
  const startCampaign = useGame((s) => s.startCampaign);
  const resume = useGame((s) => s.resumeCheckpoint);
  const openSettings = useGame((s) => s.openSettings);
  const done = PLAYABLE.filter((id) => save.completed[id]).length;
  const routeDone = DEMO_ROUTE.filter((id) => save.completed[id]).length;
  const cp = save.checkpoint;
  const next = nextMission(save.completed);
  const started = done > 0 || !!cp;

  const cpDef = cp ? DEMO_MISSIONS[cp.missionId] : null;
  const cpPhase = cp && cpDef ? cpDef.phases.find((p) => p.id === cp.phase) : null;
  const play = !started ? { label: 'Play', note: 'Start astronaut training on Earth', act: startCampaign }
    : cp && cpDef ? { label: 'Continue', note: `${cpDef.title} · checkpoint: ${cpPhase?.checkpoint ?? 'mission start'}`, act: () => { resume(); } }
      : next ? { label: 'Continue', note: `Next mission: ${DEMO_MISSIONS[next].title}`, act: startCampaign }
        : { label: 'Mission map', note: 'All five worlds complete. Go for three stars everywhere!', act: () => go('atlas') };

  return (
    <div className="home">
      <div className="home-top">
        <Profile />
        <div className="home-top-actions">
          <SoundButton />
          <IconBtn icon="gear" label="Settings" onClick={() => openSettings(true)} />
        </div>
      </div>

      <div className="home-main">
        <div className="home-brand">
          <MissionPatch size={88} />
          <div>
            <h1 className="logo"><span>Beyond</span> <span className="accent">Earth</span></h1>
            <p className="tagline">Train · Launch · Explore · Survive</p>
          </div>
        </div>

        <nav className="home-menu" aria-label="Main menu">
          <Btn autoFocus size="xl" icon="play" cue="start" onClick={play.act}>{play.label}</Btn>
          <p className="home-next">{play.note}</p>
          <div className="tile-row">
            <Tile icon="map" label="Missions" note={`${done} of ${PLAYABLE.length} done`} onClick={() => go('atlas')} />
            <Tile icon="flask" label="Gravity Lab" note="Test five worlds" onClick={() => go('gravity')} />
            <Tile icon="gear" label="Settings" note="Sound and comfort" onClick={() => openSettings(true)} />
            <Tile icon="book" label="Science" note="What is real" onClick={() => go('credits')} />
          </div>
          <Btn kind="blue" size="lg" block icon="crew" onClick={() => go('crew')}>Crew Ship · play together</Btn>
          <TierPicker compact />
        </nav>
      </div>

      <div className="home-foot">
        <JudgeSwitch />
        <span className="fine">{routeDone} of 5 worlds visited · progress is saved in this browser only</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mission map
// ---------------------------------------------------------------------------

const STATUS_ICON: Record<MissionStatus, string> = { completed: 'check', available: 'play', locked: 'lock', planned: 'clock' };

/** The route between worlds, drawn behind the planets. Finished legs turn gold. */
function RoutePath({ worldDone }: { worldDone: Record<WorldId, boolean> }) {
  const pts = WORLDS.map((_, i) => ({ x: 100 + i * 200, y: i % 2 === 0 ? 70 : 118 }));
  return (
    <svg className="map-path" viewBox="0 0 1000 190" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      {pts.slice(0, -1).map((a, i) => {
        const b = pts[i + 1];
        const mid = (a.x + b.x) / 2;
        return <path key={i} d={`M${a.x} ${a.y} C ${mid} ${a.y}, ${mid} ${b.y}, ${b.x} ${b.y}`} className={worldDone[WORLDS[i]] ? 'done' : ''} vectorEffect="non-scaling-stroke" />;
      })}
    </svg>
  );
}

function MissionNode({ m, status, isNext }: { m: CatalogEntry; status: MissionStatus; isNext: boolean }) {
  const save = useGame((s) => s.save);
  const openBriefing = useGame((s) => s.openBriefing);
  const playable = (status === 'available' || status === 'completed') && isDemoMission(m.id);
  const stars = starsOf(save.completed[m.id]);
  const body = (
    <>
      <span className="node-badge"><Icon name={STATUS_ICON[status]} size={status === 'planned' ? 18 : 22} /></span>
      <span className="node-main">
        <span className="node-top">
          <span className="node-id">{m.id}</span>
          <span className={`node-status ${status}`}>{isNext ? 'Up next' : STATUS_LABEL[status]}</span>
        </span>
        <span className="node-title">{m.title}</span>
        {status === 'locked' && isDemoMission(m.id)
          ? <span className="node-note">Finish {DEMO_MISSIONS[DEMO_MISSIONS[m.id].requires ?? 'E02'].title} to unlock.</span>
          : status === 'planned'
            ? <span className="node-note">{m.task} Planned for the full campaign.</span>
            : <span className="node-note">{m.task}</span>}
        {playable && <Stars value={stars} size={17} />}
      </span>
    </>
  );
  return playable
    ? <button type="button" className={`node ${status} ${isNext ? 'next' : ''}`} onClick={() => openBriefing(m.id as DemoMissionId)}>{body}</button>
    : <div className={`node ${status}`} aria-disabled="true">{body}</div>;
}

export function Atlas() {
  const save = useGame((s) => s.save);
  const mode = useGame((s) => s.mode);
  const go = useGame((s) => s.go);
  const [all, setAll] = useState(false);
  const [log, setLog] = useState(false);
  const judge = mode === 'judge';
  const worldDone = Object.fromEntries(WORLDS.map((w) => [w, CATALOG.some((m) => m.world === w && m.demo && save.completed[m.id])])) as Record<WorldId, boolean>;
  const milestones = Object.values(DEMO_MISSIONS).map((m) => m.milestone).filter((m): m is { id: string; label: string } => !!m);
  const next = nextMission(save.completed);

  return (
    <div className="screen map-screen">
      <header className="top-bar">
        <IconBtn icon="back" label="Back to the title screen" onClick={() => go('home')} />
        <div className="top-title">
          <div className="kicker">Mission Control</div>
          <h1>Mission Map</h1>
        </div>
        <div className="top-right">
          <Btn kind="ghost" size="sm" icon="book" onClick={() => setLog(true)}>Mission Log</Btn>
          <JudgeSwitch />
          <Profile compact />
        </div>
      </header>

      {judge && <p className="banner"><Icon name="trophy" size={18} /> Judge Mode is on. Every playable mission is open. Progress here is saved separately from the campaign.</p>}

      <div className="map">
        <RoutePath worldDone={worldDone} />
        {WORLDS.map((w, i) => {
          const missions = CATALOG.filter((m) => m.world === w);
          const shown = missions.filter((m) => all || m.demo);
          const planned = missions.length - missions.filter((m) => m.demo).length;
          return (
            <section key={w} className={`world ${i % 2 === 1 ? 'low' : ''} ${worldDone[w] ? 'done' : ''}`} aria-label={WORLD_INFO[w].label}>
              <div className="world-art-wrap"><WorldArt world={w} size={140} /></div>
              <h2 className="world-name">{WORLD_INFO[w].label}</h2>
              <p className="world-blurb">{WORLD_INFO[w].blurb}</p>
              <ul className="nodes">
                {shown.map((m) => (
                  <li key={m.id}><MissionNode m={m} status={missionStatus(m.id, save.completed, judge)} isNext={m.id === next && !save.completed[m.id]} /></li>
                ))}
              </ul>
              {!all && planned > 0 && <p className="world-more">+{planned} more planned</p>}
            </section>
          );
        })}
      </div>

      {log && <MissionLog onClose={() => setLog(false)} />}

      <footer className="map-foot">
        <div className="badges" aria-label="Badges">
          {milestones.map((m) => {
            const earned = save.milestones.includes(m.id);
            return (
              <span key={m.id} className={`badge ${earned ? 'earned' : ''}`}>
                <Icon name="medal" size={22} />
                <span><strong>{m.label}</strong><small>{earned ? 'Badge earned' : 'Not yet earned'}</small></span>
              </span>
            );
          })}
        </div>
        <Btn kind="ghost" size="sm" icon="list" onClick={() => setAll(!all)}>{all ? 'Show playable missions only' : `Show all ${CATALOG.length} missions`}</Btn>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mission card
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
  const record = save.completed[id];
  const best = starsOf(record);
  return (
    <div className={`screen brief-screen world-${def.world}`}>
      <header className="top-bar">
        <IconBtn icon="back" label="Back to the mission map" onClick={() => go('atlas')} />
        <div className="top-title">
          <div className="kicker">{WORLD_INFO[def.world].label} · Mission {def.id}</div>
          <h1>{def.title}</h1>
        </div>
        <div className="top-right"><Profile compact /></div>
      </header>

      <div className="brief">
        <section className="panel brief-main">
          <div className="brief-hero">
            <WorldArt world={def.world} size={132} />
            <div className="brief-hero-text">
              <Chip icon="helmet" tone="cyan">You are the {def.duty.toLowerCase()}</Chip>
              <p className="brief-goal">{def.goal}</p>
              <div className="brief-best">
                <Stars value={best} size={24} />
                <span>{record ? `Your best · flown ${record.completions} ${record.completions === 1 ? 'time' : 'times'}` : 'Not flown yet'}</span>
              </div>
              <p className="star-goal"><Icon name="star" size={16} /><span><strong>3-star goal:</strong> {STAR_GOAL[id]}</span></p>
            </div>
          </div>

          <h2 className="mini-head"><Icon name="flag" size={16} /> Your mission</h2>
          <ol className="steps-row">
            {def.phases.map((p, i) => (
              <li key={p.id} className="step-card">
                <span className="step-num">{i + 1}</span>
                <span className="step-text"><strong>{p.label}</strong><span>{p.objective}</span></span>
              </li>
            ))}
          </ol>

          <h2 className="mini-head"><Icon name="keyboard" size={16} /> Controls</h2>
          <ControlList controls={def.controls} />

          <details className="more">
            <summary><Icon name="flask" size={16} /> The science behind this mission</summary>
            <p>{def.science.text}</p>
            <p><SourceLink id={def.science.sourceId} /></p>
            <p><strong>Skill:</strong> {def.skill}</p>
            <p><strong>You start with:</strong> {def.startingResources}</p>
            <p className="labels">{def.labels.join(' · ')}</p>
          </details>
        </section>

        <aside className="panel brief-go">
          <TierPicker />
          <p className="tier-detail">{def.tiers[tier]}</p>
          <Toggle icon="bulb" label="Tips" note="Mission Control tells you what to try next." checked={hints} onChange={(on) => update({ hints: on ? 'on' : 'off' })} />
          <div className="brief-actions">
            {cp && cpPhase && (
              <>
                <Btn autoFocus size="xl" block icon="play" cue="start" onClick={() => { resume(); }}>Continue</Btn>
                <p className="fine center">From checkpoint: {cpPhase.checkpoint}</p>
              </>
            )}
            <Btn autoFocus={!cp} kind={cp ? 'ghost' : 'primary'} size={cp ? 'md' : 'xl'} block icon={cp ? 'replay' : 'rocket'} cue="start" onClick={() => start(id)}>
              {cp ? 'Start over' : 'Start mission'}
            </Btn>
          </div>
          {mode === 'judge' && def.phases.length > 1 && (
            <div className="judge-jump">
              <h3 className="mini-head"><Icon name="trophy" size={16} /> Judge Mode: jump ahead</h3>
              <div className="stack">
                {def.phases.slice(1).map((p) => <Btn key={p.id} kind="ghost" size="sm" block icon="arrow" onClick={() => startAt(id, p.id)}>Start at: {p.label}</Btn>)}
              </div>
            </div>
          )}
        </aside>
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
  const done = () => { setConfirm(false); close(false); };
  return (
    <Dialog title="Settings" icon="gear" onClose={done} wide>
      <div className="settings-grid">
        <section>
          <h3 className="mini-head"><Icon name="rocket" size={16} /> Game</h3>
          <TierPicker />
          <p className="fine">Difficulty applies the next time a mission starts or restarts.</p>
          <Toggle icon="bulb" label="Tips" note="On by default for Junior. Optional for Middle and Advanced."
            checked={hintsOn(settings, settings.tier)} onChange={(on) => update({ hints: on ? 'on' : 'off' })} />
          <h3 className="mini-head"><Icon name="eye" size={16} /> Comfort</h3>
          <Toggle icon="eye" label="Reduced motion" note="Fixed camera, no shake, no flashing or bobbing." checked={settings.reducedMotion} onChange={(on) => update({ reducedMotion: on })} />
          <Toggle icon="sparkle" label="Low graphics" note="No shadows, lower resolution. Use this if the picture stutters." checked={settings.graphics === 'low'} onChange={(on) => update({ graphics: on ? 'low' : 'high' })} />
        </section>
        <section>
          <h3 className="mini-head"><Icon name="sound" size={16} /> Sound</h3>
          <Toggle icon="sound" label="Sound effects" note="Clicks, alerts and rewards. The whole game can be played muted." checked={settings.audio} onChange={(on) => update({ audio: on })} />
          <Toggle icon="headset" label="Spoken alerts" note="Reads warnings and radio calls aloud. Off by default." checked={settings.speech} onChange={(on) => update({ speech: on })} />
          <Toggle icon="list" label="Captions" note="Show radio calls and spoken alerts as text." checked={settings.captions} onChange={(on) => update({ captions: on })} />
          <div className="danger-zone">
            {!confirm
              ? <Btn kind="danger" size="sm" icon="warning" onClick={() => setConfirm(true)}>Reset Progress</Btn>
              : (
                <div role="alertdialog" aria-label="Confirm reset">
                  <p><strong>Reset {mode === 'judge' ? 'Judge Mode' : 'campaign'} progress?</strong> Completed missions, stars, badges and the saved checkpoint will be erased. This cannot be undone.</p>
                  <div className="row">
                    <Btn kind="danger" size="sm" onClick={() => { reset(); done(); }}>Yes, erase progress</Btn>
                    <Btn kind="ghost" size="sm" onClick={() => setConfirm(false)}>Keep my progress</Btn>
                  </div>
                </div>
              )}
          </div>
        </section>
      </div>
      <div className="dialog-actions"><Btn autoFocus size="lg" icon="check" onClick={done}>Done</Btn></div>
      <p className="fine center">Progress is stored only in this browser. The game does not ask for or collect names, emails or other personal details.</p>
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
      <header className="top-bar">
        <IconBtn icon="back" label="Back to the title screen" autoFocus onClick={() => go('home')} />
        <div className="top-title"><div className="kicker">Science Center</div><h1>Science and Credits</h1></div>
      </header>
      <div className="credits-body">
        <section className="panel">
          <h2 className="mini-head"><Icon name="flask" size={16} /> What is real and what is invented</h2>
          <ul className="real-list">
            <li><Chip tone="good" icon="check">Real, sourced</Chip> Gravity on the Moon and Mars, why astronauts float in orbit, why crews shelter during solar particle events, signal delay to the Moon and Mars, the thin Martian atmosphere.</li>
            <li><Chip tone="cyan" icon="book">Archived record</Chip> The lunar solar alert is labelled with a dated NASA DONKI alert. {LABELS.archived}</li>
            <li><Chip tone="amber" icon="clock">Compressed time</Chip> Launches, landings and outpost shifts are shortened so a mission fits in a few minutes.</li>
            <li><Chip tone="amber" icon="sparkle">Invented game values</Chip> Energy units, crop stages, fuel budgets, star ratings, the Air comfort score and every vehicle, station and habitat.</li>
          </ul>
        </section>
        <section className="panel">
          <h2 className="mini-head"><Icon name="book" size={16} /> Sources</h2>
          <div className="table-wrap">
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
          </div>
        </section>
        <section className="panel">
          <h2 className="mini-head"><Icon name="gear" size={16} /> Assets and code</h2>
          <ul>
            <li>All 3D models, textures, sounds, icons, planet art and the Beyond Earth mission patch are generated in code for this project. No third-party models, images or audio files are included.</li>
            <li>Typeface: Exo 2, copyright The Exo 2 Project Authors, used under the SIL Open Font License 1.1 and bundled with the game.</li>
            <li>No NASA insignia or national flags are used. Beyond Earth is a student hackathon project and is not endorsed by NASA.</li>
            <li>Open-source libraries: React, React DOM, three.js, React Three Fiber and Zustand (all MIT licensed). Built with Vite and TypeScript.</li>
            <li>The game works offline once loaded. It makes no network requests while you play.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
