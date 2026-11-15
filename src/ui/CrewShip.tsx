import { useEffect, useMemo, useState } from 'react';
import { playCue, speak } from '../game/audio';
import { lastCrew, meOf, useCrew } from '../game/crewStore';
import { useHud } from '../game/hud';
import { input } from '../game/input';
import { useGame } from '../game/store';
import { CrewShipScene, type ShipUse } from '../missions/CrewShipScene';
import { CREW_CALLS, compareCrew, liveTasks, type CrewSession, type LiveTask } from '../sim/crew';
import {
  INCIDENTS, INCIDENT_BY_ID, ITEM_LABEL, RES_NAME, RES_UNIT, ROLES, ROLE_LABEL, ROOM_BY_ID,
  type CrewCarry, type IncidentId, type ItemId, type Res, type Role,
} from '../sim/crewData';
import { GLOSSARY, TOUR_SPOTS } from '../sim/shipTour';
import { COMMANDER } from '../sim/story';
import { TIERS, TIER_LABEL, type Tier } from '../sim/types';
import { GameCanvas } from '../three/GameCanvas';
import { ReyesPortrait, WorldArt } from './art';
import { Bar, Btn, Chip, Comm, Dialog, IconBtn, Keycap, SourceLink, Stars, withKeys } from './common';
import { Icon } from './icons';

const ROLE_ICON: Record<Role, string> = { pilot: 'rocket', engineer: 'bolt', life: 'air', logistics: 'box', science: 'flask', comms: 'antenna' };
const RES_ICON: Record<keyof Res, string> = { meals: 'box', fuel: 'fuel', power: 'battery', water: 'fuel', air: 'air', crops: 'leaf', readiness: 'shield' };
/** The meters that matter for each mission. */
const SHOWN: Record<IncidentId, (keyof Res)[]> = {
  tour: ['readiness'], meals: ['meals', 'fuel', 'readiness'], air: ['air', 'power', 'readiness'], water: ['water', 'crops', 'readiness'],
  relay: ['power', 'readiness'], docking: ['fuel', 'readiness'], cargo_relay: ['meals'], docking_drill: ['fuel'], signal_hunt: ['power'],
};

/** What earlier missions left behind, read from the campaign save. */
function useCarry(): CrewCarry {
  const flags = useGame((s) => s.save.completed.L03?.flags);
  return useMemo(() => ({ reserveSpent: flags?.reserveSpent }), [flags]);
}

// ---------------------------------------------------------------------------
// Lobby
// ---------------------------------------------------------------------------

function Entry() {
  const crew = useCrew();
  const go = useGame((s) => s.go);
  const carry = useCarry();
  const [code, setCode] = useState('');
  const last = useMemo(lastCrew, []);
  return (
    <div className="screen crew-entry">
      <header className="top-bar">
        <IconBtn icon="back" label="Back to the title screen" onClick={() => go('home')} />
        <div className="top-title"><div className="kicker">The Kestrel · 15 rooms · 2 to 6 cadets</div><h1>Crew Ship</h1></div>
      </header>
      <div className="crew-cards">
        <section className="panel crew-card">
          <span className="crew-card-icon"><Icon name="crew" size={34} /></span>
          <h2>Host a crew</h2>
          <p>Start a ship and get a join code. Give the code to the cadets you want aboard. Nobody else can find your ship.</p>
          <Btn autoFocus size="lg" block icon="rocket" disabled={crew.busy} onClick={() => { void crew.host(carry); }}>Host a crew</Btn>
        </section>
        <section className="panel crew-card">
          <span className="crew-card-icon"><Icon name="lock" size={34} /></span>
          <h2>Join with a code</h2>
          <p>Type the code your host read out. It looks like ABC-123.</p>
          <label className="code-field">
            <span className="sr">Join code</span>
            <input value={code} maxLength={7} placeholder="ABC-123" autoCapitalize="characters" spellCheck={false} onChange={(e) => setCode(e.target.value.toUpperCase())} onKeyDown={(e) => { if (e.key === 'Enter' && code.length >= 7) void crew.join(code); }} />
          </label>
          <Btn kind="blue" size="lg" block icon="arrow" disabled={crew.busy || code.trim().length < 7} onClick={() => { void crew.join(code); }}>Join</Btn>
          {last && <Btn kind="ghost" size="sm" block icon="replay" onClick={() => { void crew.rejoin().then((ok) => { if (!ok) useCrew.setState({ error: 'That crew has ended.' }); }); }}>Rejoin crew {last.code}</Btn>}
        </section>
        <section className="panel crew-card">
          <span className="crew-card-icon"><Icon name="helmet" size={34} /></span>
          <h2>Solo training</h2>
          <p>Fly the same ship alone. Three scripted crew members work their own stations and leave the decisions to you. Works offline.</p>
          <Btn kind="good" size="lg" block icon="play" onClick={() => crew.solo(carry)}>Solo training</Btn>
          <Btn kind="blue" block icon="eye" onClick={() => { crew.solo(carry); void (async () => { const c = useCrew.getState(); await c.act({ type: 'setup', incident: 'tour', tier: 'junior' }); await c.act({ type: 'start' }); await c.act({ type: 'briefed' }); })(); }}>3D ship tour</Btn>
        </section>
      </div>
      {crew.error && <p className="error center" role="alert"><Icon name="warning" size={18} /> {crew.error}</p>}
      <p className="fine center">Cadet names are made up by the game. No real names, no chat box: crews talk with preset calls. A shared crew needs the game started with <code>npm run dev</code>, which also runs the mission service.</p>
    </div>
  );
}

function Lobby({ s }: { s: CrewSession }) {
  const crew = useCrew();
  const me = meOf(s, crew.memberId);
  const host = s.hostId === crew.memberId;
  const spec = INCIDENT_BY_ID[s.incident];
  const openL03 = useGame((g) => g.openBriefing);
  const others = s.members.filter((m) => !m.bot && m.connected && m.id !== s.hostId);
  const canStart = s.solo || (others.length >= 1 && others.every((m) => m.ready));
  return (
    <div className="screen crew-lobby">
      <header className="top-bar">
        <IconBtn icon="back" label="Leave this crew" onClick={crew.leave} />
        <div className="top-title"><div className="kicker">{s.solo ? 'Solo training' : 'Crew lobby'}</div><h1>The Kestrel</h1></div>
        {!s.solo && <div className="join-code" aria-label={`Join code ${s.code}`}><small>Join code</small><strong>{s.code}</strong></div>}
      </header>
      <div className="lobby-grid">
        <section className="panel">
          <h2 className="mini-head"><Icon name="crew" size={16} /> Crew ({s.members.length} of 6)</h2>
          <ul className="crew-list">
            {s.members.map((m) => (
              <li key={m.id} className={`crew-row ${m.id === crew.memberId ? 'me' : ''}`}>
                <span className="crew-role"><Icon name={m.role ? ROLE_ICON[m.role] : 'helmet'} size={20} /></span>
                <span className="crew-name"><strong>{m.name}{m.id === crew.memberId ? ' (you)' : ''}</strong><small>{m.role ? ROLE_LABEL[m.role] : 'No station yet'}{m.id === s.hostId ? ' · host' : ''}</small></span>
                <span className={`pill ${m.ready || m.id === s.hostId ? 'good' : 'amber'}`}>{m.bot ? 'Scripted' : !m.connected ? 'Away' : m.id === s.hostId ? 'Host' : m.ready ? 'Ready' : 'Not ready'}</span>
              </li>
            ))}
          </ul>
          <h2 className="mini-head"><Icon name="helmet" size={16} /> Your station</h2>
          <div className="role-grid" role="radiogroup" aria-label="Your station">
            {ROLES.map((r) => {
              const holder = s.members.find((m) => m.role === r);
              const mine = me?.role === r;
              const taken = !!holder && !mine && !holder.bot;
              return (
                <button key={r} type="button" role="radio" aria-checked={mine} className={`role-btn ${mine ? 'on' : ''}`} disabled={taken} onClick={() => { void crew.act({ type: 'role', role: r }); }}>
                  <Icon name={ROLE_ICON[r]} size={22} /><span>{ROLE_LABEL[r]}</span>{taken && <small>{holder?.name}</small>}
                </button>
              );
            })}
          </div>
          <p className="fine">Smaller crews switch stations during the mission. Anyone may work any station.</p>
        </section>

        <section className="panel">
          <h2 className="mini-head"><Icon name="flag" size={16} /> Mission {host ? '' : '(the host chooses)'}</h2>
          <div className="incident-list" role="radiogroup" aria-label="Mission">
            {INCIDENTS.map((i) => (
              <button key={i.id} type="button" role="radio" aria-checked={s.incident === i.id} disabled={!host} className={`incident ${s.incident === i.id ? 'on' : ''}`} onClick={() => { void crew.act({ type: 'setup', incident: i.id, tier: s.tier }); }}>
                <strong>{i.kind === 'emergency' ? `${i.n} · ` : ''}{i.title}</strong><small>{i.blurb}</small>
              </button>
            ))}
            <button type="button" className="incident" onClick={() => openL03('L03')}>
              <strong>3 · The Last Battery</strong><small>The lunar emergency. It plays in the campaign, on the Moon, and opens from the mission map.</small>
            </button>
          </div>
          <p className="star-goal"><Icon name="bulb" size={16} /><span><strong>The trade-off:</strong> {spec.tradeoff}</span></p>
          <div className="tier-row" role="radiogroup" aria-label="Difficulty">
            {TIERS.map((t: Tier) => (
              <button key={t} type="button" role="radio" aria-checked={s.tier === t} disabled={!host} className={`tier ${s.tier === t ? 'on' : ''}`} onClick={() => { void crew.act({ type: 'setup', incident: s.incident, tier: t }); }}>
                <span className="tier-name">{TIER_LABEL[t]}</span>
              </button>
            ))}
          </div>
          <div className="brief-actions">
            {host
              ? <Btn size="xl" block icon="rocket" cue="start" disabled={!canStart} onClick={() => { void crew.act({ type: 'start' }); }}>Start</Btn>
              : <Btn size="xl" block icon={me?.ready ? 'check' : 'play'} kind={me?.ready ? 'good' : 'primary'} onClick={() => { void crew.act({ type: 'ready', ready: !me?.ready }); }}>{me?.ready ? 'Ready. Waiting for the host' : 'I am ready'}</Btn>}
            {host && !canStart && <p className="fine center">{others.length === 0 ? 'Waiting for another cadet to join with the code.' : 'Waiting for everyone to press Ready.'}</p>}
            {host && !s.solo && <Btn kind="danger" size="sm" block icon="x" onClick={() => { void crew.act({ type: 'end' }).then(crew.leave); }}>End the session</Btn>}
          </div>
          {crew.error && <p className="error" role="alert"><Icon name="warning" size={18} /> {crew.error}</p>}
        </section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Story scene
// ---------------------------------------------------------------------------

function StoryScene({ s }: { s: CrewSession }) {
  const crew = useCrew();
  const spec = INCIDENT_BY_ID[s.incident];
  const me = meOf(s, crew.memberId);
  const host = s.hostId === crew.memberId;
  const [shown, setShown] = useState(0);
  const change = s.incident === 'air' && s.carry.reserveSpent
    ? `${spec.panels.change} And remember the Moon: we spent the reserve battery there, so backup power starts at 60%.`
    : spec.panels.change;
  const panels = [
    { kind: 'place', heading: 'Where we are', caption: spec.panels.place },
    { kind: 'change', heading: 'What changed', caption: change },
    { kind: 'assignment', heading: 'What we do', caption: `“${spec.panels.need}”` },
  ];
  const last = shown >= 2;
  useEffect(() => { speak(panels[shown].caption); /* optional voiceover */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown]);
  useEffect(() => { document.querySelector<HTMLElement>('.comic [data-autofocus]')?.focus(); }, [shown]);
  const done = () => { void crew.act({ type: 'briefed' }); };
  return (
    <div className="comic" role="dialog" aria-modal="true" aria-label={`Briefing from ${COMMANDER}: ${spec.title}`}>
      <header className="comic-head">
        <ReyesPortrait size={64} />
        <div className="comic-titles"><div className="kicker">{COMMANDER} · the Kestrel · {TIER_LABEL[s.tier]}</div><h1>{spec.title}</h1></div>
        {host && <Btn kind="ghost" size="sm" icon="x" onClick={done}>Skip briefing</Btn>}
      </header>
      <ol className="comic-strip">
        {panels.map((p, i) => (
          <li key={p.kind} className={`comic-panel ${p.kind} ${i === shown ? 'now' : i < shown ? 'seen' : 'later'}`} aria-hidden={i > shown}>
            <span className="comic-num">{i + 1}</span>
            <div className="comic-art">
              {p.kind === 'place' && <WorldArt world="station" size={150} />}
              {p.kind === 'change' && <span className="comic-burst"><Icon name="warning" size={72} /></span>}
              {p.kind === 'assignment' && <ReyesPortrait size={150} />}
            </div>
            <h2>{p.heading}</h2>
            {i <= shown ? <p className="comic-caption">{p.caption}</p> : <p className="comic-caption muted">…</p>}
            {p.kind === 'assignment' && i <= shown && (
              <ul className="role-lines">
                {s.members.filter((m) => m.role && spec.assignments[m.role]).map((m) => (
                  <li key={m.id} className={m.id === me?.id ? 'me' : ''}><Icon name={ROLE_ICON[m.role as Role]} size={15} /><span><strong>{ROLE_LABEL[m.role as Role]}{m.id === me?.id ? ' (you)' : ''}:</strong> {spec.assignments[m.role as Role]}</span></li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
      <footer className="comic-foot">
        <div className="row">
          {shown > 0 && <Btn kind="ghost" icon="back" onClick={() => setShown(shown - 1)}>Back</Btn>}
          {!last && <Btn key="next" autoFocus size="lg" iconEnd="arrow" onClick={() => { playCue('select'); setShown(shown + 1); }}>Next</Btn>}
          {last && host && <Btn key="go" autoFocus size="lg" icon="rocket" cue="start" onClick={done}>Take Control</Btn>}
          {last && !host && <Btn key="wait" size="lg" disabled onClick={() => undefined}>Waiting for the host</Btn>}
        </div>
        <p className="fine">{spec.labels.join(' · ')}</p>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Task panel: predict, do, explain
// ---------------------------------------------------------------------------

function TaskPanel({ task, onClose }: { task: LiveTask; onClose: () => void }) {
  const crew = useCrew();
  const spec = task.spec;
  const [order, setOrder] = useState<string[]>([]);
  const [count, setCount] = useState(0);
  const [dial, setDial] = useState(spec.dial?.start ?? 0);
  const [why, setWhy] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  // The steps are shown in a fixed scrambled order, the same for every cadet.
  const shuffled = useMemo(() => [...(spec.steps ?? [])].sort((a, b) => ((a.length * 7 + a.charCodeAt(1)) % 11) - ((b.length * 7 + b.charCodeAt(1)) % 11)), [spec.steps]);
  const held = crew.session?.state ? (Object.entries(crew.session.state.items) as [ItemId, { holder: string | null }][]).find(([, it]) => it.holder === crew.memberId)?.[0] : undefined;

  useEffect(() => { void crew.act({ type: 'claim', key: task.key }); return () => { void useCrew.getState().act({ type: 'release' }); }; // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.key]);

  const submit = async (value: unknown) => {
    const r = await crew.act({ type: 'answer', key: task.key, value });
    if (r.ok) { setWhy(null); setResult(r.say ?? spec.effect); } else { setWhy(r.error ?? 'Try again.'); setOrder([]); void crew.act({ type: 'claim', key: task.key }); }
  };

  if (result) {
    return (
      <Dialog title={spec.title} icon="check" tone="good" kicker={`${ROOM_BY_ID[spec.room].name} · done`} onClose={onClose}>
        <p className="lead">{result}</p>
        <div className="fact-card"><h3><Icon name="bulb" size={18} /> Why it works</h3><p>{spec.card}</p>{spec.sourceId && <p><SourceLink id={spec.sourceId} /></p>}</div>
        <div className="dialog-actions"><Btn autoFocus size="lg" icon="check" onClick={onClose}>Back to the ship</Btn></div>
      </Dialog>
    );
  }
  const d = spec.dial;
  return (
    <Dialog title={spec.title} icon={ROLE_ICON[spec.role]} kicker={`${ROOM_BY_ID[spec.room].name} · task ${String(spec.num).padStart(2, '0')} · ${ROLE_LABEL[spec.role]}`} onClose={onClose} wide={spec.kind === 'order'}>
      <Comm name="Clue" tone="tip">{spec.clue}</Comm>
      <p className="lead">{spec.prompt}</p>

      {spec.kind === 'pick' && <div className="stack">{spec.options?.map((o, i) => <Btn key={o.id} kind="blue" block autoFocus={i === 0 && false} onClick={() => { void submit(o.id); }}>{o.label}</Btn>)}</div>}

      {spec.kind === 'order' && (
        <div className="order-game">
          <div className="order-col"><h3 className="mini-head">Steps</h3>{shuffled.filter((x) => !order.includes(x)).map((x) => <Btn key={x} kind="ghost" block onClick={() => { playCue('select'); setOrder([...order, x]); }}>{x}</Btn>)}</div>
          <div className="order-col"><h3 className="mini-head">Your order</h3>
            <ol className="order-list">{order.map((x) => <li key={x}>{x}</li>)}{order.length === 0 && <li className="muted">Press the steps in the order you would do them.</li>}</ol>
            <div className="row"><Btn kind="ghost" size="sm" icon="replay" disabled={order.length === 0} onClick={() => setOrder([])}>Start again</Btn>
              <Btn size="sm" icon="check" disabled={order.length !== shuffled.length} onClick={() => { void submit(order); }}>Run it</Btn></div>
          </div>
        </div>
      )}

      {spec.kind === 'count' && (
        <div className="count-game">
          <IconBtn icon="back" label="One fewer" onClick={() => setCount(Math.max(0, count - 1))} />
          <div className="count-value" aria-live="polite"><strong>{count}</strong><small>{spec.countLabel}</small><span className="count-pips" aria-hidden="true">{Array.from({ length: count }, (_, i) => <Icon key={i} name="box" size={18} />)}</span></div>
          <IconBtn icon="arrow" label="One more" onClick={() => setCount(Math.min(spec.max ?? 12, count + 1))} />
          <Btn icon="check" onClick={() => { void submit(count); }}>Set them out</Btn>
        </div>
      )}

      {spec.kind === 'dial' && d && (
        <div className="dial-game">
          <div className="dial-track" role="img" aria-label={`${d.label}: ${dial}${d.unit}. Target ${d.target}${d.unit}.`}>
            <span className="dial-band" style={{ left: `${((d.target - d.tol - d.min) / (d.max - d.min)) * 100}%`, width: `${((2 * d.tol) / (d.max - d.min)) * 100}%` }} />
            <span className="dial-knob" style={{ left: `${((dial - d.min) / (d.max - d.min)) * 100}%` }} />
          </div>
          <div className="dial-read"><strong>{dial}{d.unit}</strong><small>{d.label} · the green band is the target · signal {Math.max(0, 5 - Math.round(Math.abs(dial - d.target) / Math.max(1, (d.max - d.min) / 12)))} of 5</small></div>
          <div className="row">
            <Btn kind="ghost" onClick={() => setDial(Math.max(d.min, dial - 5))}>◀◀ 5</Btn><Btn kind="ghost" onClick={() => setDial(Math.max(d.min, dial - 1))}>◀ 1</Btn>
            <Btn kind="ghost" onClick={() => setDial(Math.min(d.max, dial + 1))}>1 ▶</Btn><Btn kind="ghost" onClick={() => setDial(Math.min(d.max, dial + 5))}>5 ▶▶</Btn>
            <Btn icon="check" onClick={() => { void submit(dial); }}>Hold it here</Btn>
          </div>
        </div>
      )}

      {spec.kind === 'carry' && spec.item && (
        <div className="stack">
          <p className={held === spec.item ? 'hint-line' : 'note'}>{held === spec.item ? `You are carrying the ${ITEM_LABEL[spec.item]}.` : `You need the ${ITEM_LABEL[spec.item]} in your hands. Find it on the ship and bring it here. There is only one.`}</p>
          <Btn icon="check" disabled={held !== spec.item} onClick={() => { void submit(true); }}>Fit the {ITEM_LABEL[spec.item]}</Btn>
        </div>
      )}

      {why && <p className="note" role="alert">{why}</p>}
      <div className="dialog-actions"><Btn kind="ghost" onClick={onClose}>Step back</Btn></div>
    </Dialog>
  );
}


// ---------------------------------------------------------------------------
// Ship tour: what a piece of equipment is, and the word a real crew uses for it
// ---------------------------------------------------------------------------

function InfoCard({ id, onClose }: { id: string; onClose: () => void }) {
  const spot = TOUR_SPOTS.find((s) => s.id === id);
  if (!spot) return null;
  return (
    <Dialog title={spot.name} icon="info" kicker={`${ROOM_BY_ID[spot.room].name} · ship tour`} onClose={onClose}>
      <p className="lead">{spot.what}</p>
      <Comm name="How it is used" tone="tip">{spot.use}</Comm>
      <div className="term-card"><span className="term-word">{spot.term}</span><p>{spot.meaning}</p><p><SourceLink id={spot.sourceId} /></p></div>
      <div className="dialog-actions"><Btn autoFocus size="lg" icon="check" onClick={onClose}>Got it</Btn></div>
      <p className="fine center">The Kestrel is an invented ship. The explanation is how real spacecraft work, in plain words.</p>
    </Dialog>
  );
}

function Glossary({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title="Words to know" icon="book" kicker={`${GLOSSARY.length} terms a crew uses`} onClose={onClose} wide>
      <p className="lead">Each word belongs to something on the ship. Find it on the tour and click it.</p>
      <dl className="glossary">
        {GLOSSARY.map((g) => <div key={g.term}><dt>{g.term}</dt><dd>{g.meaning}<small>On the ship: {g.where}</small></dd></div>)}
      </dl>
      <div className="dialog-actions"><Btn autoFocus icon="check" onClick={onClose}>Done</Btn></div>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// In the ship
// ---------------------------------------------------------------------------

function Ship({ s }: { s: CrewSession }) {
  const crew = useCrew();
  const prompt = useHud((h) => h.prompt);
  const [open, setOpen] = useState<string | null>(null);
  const [calls, setCalls] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [words, setWords] = useState(false);
  const [seen, setSeen] = useState<string[]>([]);
  const st = s.state;
  const spec = INCIDENT_BY_ID[s.incident];
  const tasks = st ? liveTasks(st) : [];
  const host = s.hostId === crew.memberId;
  const task = tasks.find((t) => t.key === open) ?? null;
  const len = spec.shiftLen[s.tier];

  const onUse = (u: ShipUse) => {
    if (u.kind === 'info') { playCue('click'); setInfo(u.id); setSeen((v) => (v.includes(u.id) ? v : [...v, u.id])); }
    else if (u.kind === 'task') { playCue('click'); setOpen(u.id); }
    else if (u.kind === 'pickup') void crew.act({ type: 'pickup', item: u.id });
    else if (u.kind === 'deliver') void crew.act({ type: 'deliver' });
    else void crew.act({ type: 'endShift' });
  };
  useEffect(() => { input.setSuspended(false); return () => { useHud.setState({ prompt: null }); }; }, []);
  if (!st) return null;
  const m = /^Press ([A-Za-z]+): (.+)$/.exec(prompt ?? '');
  const lastLines = s.log.slice(-3);

  return (
    <div className="mission crew-ship">
      <GameCanvas fov={46} envIntensity={0.45} background="#03050b">
        <CrewShipScene onUse={onUse} frozen={!!open || !!info || words} />
      </GameCanvas>

      <div className="hud">
        <div className="hud-top">
          <div className="hud-left">
            <section className="hud-objective">
              <span className="obj-icon"><Icon name="target" size={26} /></span>
              <div className="obj-main">
                <div className="obj-top"><span className="obj-phase">{spec.title}</span>{s.replay && <span className="hud-chip">Crew Replay</span>}{s.solo && <span className="hud-chip">Solo</span>}
                  {spec.shifts > 1 && <span>Shift {st.shift} of {spec.shifts} · step {st.clock} of {len}</span>}</div>
                <ul className="crew-tasks">
                  {tasks.filter((t) => s.incident !== 'tour').map((t) => (
                    <li key={t.key} className={t.done ? 'done' : t.available ? 'open' : 'locked'}>
                      <Icon name={t.done ? 'check' : t.available ? 'play' : 'lock'} size={13} />
                      <span>{t.spec.title} <small>· {ROOM_BY_ID[t.spec.room].name}{t.optional ? ' · a choice' : ''}</small></span>
                    </li>
                  ))}
                  {s.incident === 'tour' && <li className="open"><Icon name="info" size={13} /><span>Click any equipment, or walk up to a blue marker and press E. {seen.length} of {TOUR_SPOTS.length} seen.</span></li>}
                  {s.incident === 'tour' && <li className="open"><Icon name="play" size={13} /><span>Gold stations are short drills. {st.done.length} of 18 tried.</span></li>}
                </ul>
              </div>
            </section>
            {(crew.error || crew.say) && (
              <div className={`hud-warning ${crew.error ? 'caution' : 'info'}`} role="status">
                <span className="warn-icon"><Icon name={crew.error ? 'warning' : 'info'} size={24} /></span>
                <div><div className="warn-text">{crew.error ?? crew.say}</div></div>
                <button type="button" className="icon-btn small" aria-label="Dismiss" onClick={crew.clearSay}><Icon name="x" size={16} /></button>
              </div>
            )}
          </div>

          <section className="hud-right">
            <div className="hud-buttons">
              <IconBtn icon="book" label="Words to know" onClick={() => setWords(true)} />
              <IconBtn icon="headset" label="Crew calls" pressed={calls} onClick={() => setCalls(!calls)} />
              {host && <IconBtn icon="flag" label="End the mission now (host)" onClick={() => { void crew.act({ type: 'end' }); }} />}
              <IconBtn icon="x" label="Leave the crew" kind="gold" onClick={crew.leave} />
            </div>
            {calls && <div className="readouts call-list">{CREW_CALLS.map((c) => <Btn key={c} kind="ghost" size="sm" block onClick={() => { void crew.act({ type: 'call', text: c }); setCalls(false); }}>{c}</Btn>)}</div>}
            <div className="gauges">
              {SHOWN[s.incident].map((k) => {
                const max = k === 'meals' ? Math.max(st.res.meals, 3 * st.crew) : k === 'crops' ? 4 : 100;
                const status = k === 'meals' ? (st.res.meals < st.crew ? 'low' : 'ok') : st.res[k] < 40 ? 'low' : st.res[k] < 70 ? 'caution' : 'ok';
                return (
                  <div key={k} className={`gauge ${status}`}>
                    <span className="gauge-icon"><Icon name={RES_ICON[k]} size={20} /></span>
                    <div className="gauge-main"><div className="gauge-head"><span className="gauge-label">{RES_NAME[k]}</span><span className="gauge-value">{st.res[k]} {RES_UNIT[k]}</span></div><Bar value={st.res[k]} max={max} status={status} /></div>
                  </div>
                );
              })}
            </div>
            <div className="readouts">
              {s.members.map((mm) => {
                const carrying = (Object.entries(st.items) as [ItemId, { holder: string | null }][]).find(([, it]) => it.holder === mm.id)?.[0];
                return (
                  <div key={mm.id} className={`readout ${mm.connected ? 'ok' : 'caution'}`}>
                    <span className="readout-label">{mm.role ? ROLE_LABEL[mm.role] : 'Crew'}{mm.id === crew.memberId ? ' (you)' : ''}</span>
                    <span className="readout-value">{mm.connected ? ROOM_BY_ID[mm.id === crew.memberId ? (crew.mode === 'solo' ? mm.room : mm.room) : mm.room].name : 'Away'}</span>
                    <span className="readout-note">{mm.name.replace(' (scripted)', '')}{carrying ? ` · carrying the ${ITEM_LABEL[carrying]}` : ''}{mm.claim ? ' · at a station' : ''}</span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <div className="hud-bottom">
          {prompt && !open && <div className="hud-prompt">{m ? <><Keycap>{m[1]}</Keycap><span>{m[2]}</span></> : <span>{withKeys(prompt)}</span>}</div>}
          {lastLines.length > 0 && <Comm name="Ship log" live="polite">{lastLines.map((l) => <span key={l.n} className={`log-line log-${l.kind}`}>{l.text}</span>)}</Comm>}
        </div>
      </div>

      {task && <TaskPanel key={task.key} task={task} onClose={() => setOpen(null)} />}
      {info && <InfoCard id={info} onClose={() => setInfo(null)} />}
      {words && <Glossary onClose={() => setWords(false)} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Debrief and Crew Replay
// ---------------------------------------------------------------------------

function CrewDebrief({ s }: { s: CrewSession }) {
  const crew = useCrew();
  const host = s.hostId === crew.memberId;
  const spec = INCIDENT_BY_ID[s.incident];
  const out = s.outcome;
  useEffect(() => { playCue('complete'); }, []);
  if (!out) return null;
  const cmp = s.replay && s.original ? compareCrew(s.original, s.originalLog, out, s.log) : null;
  return (
    <div className="screen results">
      <section className="results-hero">
        <div className="kicker">The Kestrel · {TIER_LABEL[s.tier]}{s.solo ? ' · solo training' : ` · crew ${s.code}`}</div>
        <h1 className="results-title">{s.replay ? 'Crew Replay complete' : spec.kind === 'drill' ? 'Drill complete' : 'Mission complete'}!</h1>
        <div className="results-mission">{spec.title}</div>
        <div className="results-stars"><Stars value={out.stars} size={58} pop /></div>
        <p className="results-status">{out.summary}</p>
        {s.replay && s.original && <Chip tone="cyan" icon="flag">First run kept: {s.original.stars} of 3 stars</Chip>}
        <div className="results-actions">
          {host && spec.kind === 'emergency' && <Btn size="lg" icon="replay" kind={s.replay ? 'blue' : 'primary'} cue="start" onClick={() => { void crew.act({ type: 'replay' }); }}>{s.replay ? 'Replay again' : 'Crew Replay'}</Btn>}
          {host && <Btn size="lg" kind="blue" icon="map" onClick={() => { void crew.act({ type: 'setup', incident: s.incident, tier: s.tier }); }}>Choose another mission</Btn>}
          <Btn kind="ghost" icon="x" onClick={crew.leave}>Leave the crew</Btn>
        </div>
        {!host && <p className="fine center">The host chooses what the crew does next.</p>}
      </section>

      {cmp && (
        <section className="panel">
          <div className="compare">
            <h3 className="mini-head"><Icon name="replay" size={16} /> First run and replay, side by side</h3>
            <p className="lead">{cmp.same ? 'Same moves, same result: the ship follows fixed rules.' : <>The first room where the crew did something different: <strong>{cmp.firstRoom ? ROOM_BY_ID[cmp.firstRoom].name : 'none'}</strong>. {cmp.firstChange}</>}</p>
            <div className="table-wrap"><table className="compare-table">
              <thead><tr><th></th><th>First run</th><th>Replay</th><th>Difference</th></tr></thead>
              <tbody>{cmp.rows.filter((r) => r.first !== 0 || r.replay !== 0).map((r) => (
                <tr key={r.label} className={r.delta === 0 ? '' : r.delta > 0 ? 'up' : 'down'}><th scope="row">{r.label}</th><td>{r.first}</td><td>{r.replay}</td><td>{r.delta === 0 ? 'same' : `${r.delta > 0 ? '▲ up' : '▼ down'} ${Math.abs(r.delta)}`}</td></tr>
              ))}</tbody>
            </table></div>
          </div>
        </section>
      )}

      <div className="results-grid">
        <section className="panel">
          <h2 className="mini-head"><Icon name="headset" size={16} /> Cause and effect</h2>
          <Comm name={COMMANDER}>{out.cause}</Comm>
          {spec.science.map((c) => <div key={c.sourceId} className="fact-card"><h3><Icon name="bulb" size={18} /> Space fact</h3><p>{c.text}</p><p><SourceLink id={c.sourceId} /></p></div>)}
          <p className="labels">{spec.labels.join(' · ')}</p>
        </section>
        <section className="panel">
          <h2 className="mini-head"><Icon name="list" size={16} /> Mission log</h2>
          <ol className="mission-log">{s.log.filter((l) => l.kind !== 'call').map((l) => <li key={l.n} className={`log-${l.kind}`}><small>{l.shift ? `Shift ${l.shift}` : ''}{l.room ? ` · ${ROOM_BY_ID[l.room].name}` : ''}</small>{l.text}</li>)}</ol>
        </section>
      </div>
    </div>
  );
}

/** Crew Ship: host or join a shared ship, or train alone with scripted crew. */
export function CrewShip() {
  const session = useCrew((s) => s.session);
  const offline = useCrew((s) => s.offline);
  const leave = useCrew((s) => s.leave);
  if (!session) return <Entry />;
  if (session.phase === 'ended') {
    return (
      <div className="screen"><div className="panel crew-ended"><h1>Session ended</h1><p>The host ended this crew&apos;s session.</p><Btn autoFocus icon="back" onClick={leave}>Back to Crew Ship</Btn></div></div>
    );
  }
  return (
    <>
      {session.phase === 'lobby' && <Lobby s={session} />}
      {session.phase === 'briefing' && <div className="mission"><StoryScene s={session} /></div>}
      {session.phase === 'active' && <Ship s={session} />}
      {session.phase === 'debrief' && <CrewDebrief s={session} />}
      {offline && <div className="notes" role="status"><p>The mission service is not answering. Your place is kept: this page will catch up when it comes back.</p></div>}
    </>
  );
}
