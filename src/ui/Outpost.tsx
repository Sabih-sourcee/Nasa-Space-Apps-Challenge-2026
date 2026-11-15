import { useMemo, useState } from 'react';
import { playCue } from '../game/audio';
import { useGame } from '../game/store';
import {
  RES_BOUNDS, RES_LABEL, budgetFor, compareRuns, currentTurn, defaultSelection, enumerateSelections, turnActions, validateSelection,
  type ActionSpec, type OutpostRun, type ResKey, type Resources, type ScenarioSpec, type TurnReport,
} from '../sim/outpost';
import { hintsOn } from '../sim/save';
import { LABELS } from '../sim/sources';
import { Btn, Comm, Dialog, SourceLink } from './common';
import { Icon } from './icons';

export function resText(res: ResKey, v: number): string {
  if (res === 'air' || res === 'protection') return `${Math.round(v)}%`;
  if (res === 'battery') return `${v} of ${RES_BOUNDS.battery.max} units`;
  if (res === 'crop') return `stage ${v} of ${RES_BOUNDS.crop.max}`;
  return `${v}`;
}

export function resStatus(scn: ScenarioSpec, res: ResKey, v: number): 'ok' | 'caution' | 'low' {
  if (res === 'air') {
    const crit = scn.critical.find((c) => c.res === 'air')?.below ?? 40;
    return v < crit + 10 ? 'low' : v < 75 ? 'caution' : 'ok';
  }
  if (res === 'battery') return v === 0 ? 'low' : v === 1 ? 'caution' : 'ok';
  if (res === 'crop') return v <= 1 ? 'caution' : 'ok';
  if (res === 'protection') return v < 50 ? 'low' : 'ok';
  return 'ok';
}

const RES_ICON: Record<ResKey, string> = { air: 'air', battery: 'battery', crop: 'leaf', protection: 'shield', science: 'flask' };

function actionIcon(a: ActionSpec): string {
  const id = a.id;
  if (id.startsWith('air')) return 'air';
  if (id.startsWith('shelter')) return 'shield';
  if (id === 'keep_working' || id.startsWith('run_experiment') || id.startsWith('dust_lab')) return 'flask';
  if (id.startsWith('lights')) return 'sun';
  if (id === 'bank_spare' || id === 'save_power') return 'battery';
  if (id === 'ask_earth') return 'antenna';
  if (id === 'sweep_now') return 'sparkle';
  if (id.startsWith('heater')) return 'thermo';
  return 'bolt';
}

/** The meter changes an action causes, as short chips. Flags and messages are explained in its text. */
function effectChips(a: ActionSpec): { text: string; up: boolean; res: ResKey }[] {
  return a.effects.flatMap((e) => (e.kind === 'res' && e.delta !== 0
    ? [{ text: `${RES_LABEL[e.res]} ${e.delta > 0 ? '+' : '−'}${Math.abs(e.delta)}`, up: e.delta > 0, res: e.res }]
    : []));
}

function shownResources(scn: ScenarioSpec): ResKey[] {
  const extra: ResKey[] = scn.missionId === 'L02' ? ['protection'] : [];
  const sci: ResKey[] = scn.tier === 'advanced' ? ['science'] : [];
  return [...scn.meters, ...extra, ...sci];
}

function Delta({ before, after, res }: { before: Resources; after: Resources; res: ResKey }) {
  const d = after[res] - before[res];
  return (
    <li className={`delta ${d === 0 ? 'same' : d > 0 ? 'up' : 'down'}`}>
      <span className="delta-icon"><Icon name={RES_ICON[res]} size={20} /></span>
      <span className="delta-label">{RES_LABEL[res]}</span>
      <span className="delta-vals">{resText(res, before[res])} <Icon name="arrow" size={14} /> <strong>{resText(res, after[res])}</strong></span>
      <span className="delta-chip">{d === 0 ? 'no change' : `${d > 0 ? '▲ up' : '▼ down'} ${Math.abs(d)}`}</span>
    </li>
  );
}

function Cost({ cost }: { cost: number }) {
  if (cost === 0) return <span className="choice-cost free">Free</span>;
  const n = Math.abs(cost);
  return (
    <span className={`choice-cost ${cost < 0 ? 'gain' : ''}`}>
      <span className="cost-bolts" aria-hidden="true">{Array.from({ length: n }, (_, i) => <Icon key={i} name="bolt" size={15} />)}</span>
      <span>{cost < 0 ? `adds ${n} ${n === 1 ? 'unit' : 'units'}` : `${n} ${n === 1 ? 'unit' : 'units'}`}</span>
    </span>
  );
}

/** One selectable plan option. A real radio button or checkbox sits inside, so the keyboard works as usual. */
function Choice({ a, type, name, checked, onPick, short = false }: { a: ActionSpec; type: 'radio' | 'checkbox'; name: string; checked: boolean; onPick: () => void; short?: boolean }) {
  const chips = effectChips(a);
  return (
    <label className={`choice ${checked ? 'on' : ''} ${short ? 'short' : ''}`}>
      <input type={type} name={name} checked={checked} onChange={() => { playCue('select'); onPick(); }} />
      <span className="choice-icon"><Icon name={actionIcon(a)} size={24} /></span>
      <span className="choice-main">
        <strong>{a.label}</strong>
        <small>{a.detail}{short && ' Not enough power with the rest of this plan.'}</small>
        {chips.length > 0 && (
          <span className="choice-chips">
            {chips.map((c) => <span key={c.text} className={`effect ${c.up ? 'up' : 'down'}`}><Icon name={RES_ICON[c.res]} size={13} />{c.text}</span>)}
          </span>
        )}
      </span>
      <Cost cost={a.cost} />
      <span className="choice-check" aria-hidden="true"><Icon name="check" size={16} /></span>
    </label>
  );
}

/** Decision panel for the current outpost turn. Costs are shown before commitment. */
export function DecisionPanel({ scn, run, preferred, onCommitted, onClose }: {
  scn: ScenarioSpec; run: OutpostRun; preferred: string[]; onCommitted: (report: TurnReport) => void; onClose: () => void;
}) {
  const settings = useGame((s) => s.save.settings);
  const commit = useGame((s) => s.outpostCommit);
  const turn = currentTurn(scn, run.state);
  const actions = useMemo(() => turnActions(scn, run.state), [scn, run.state]);
  const [chosen, setChosen] = useState<string[]>(() => {
    const pick = defaultSelection(scn, run.state, preferred);
    if (validateSelection(scn, run.state, pick) === null) return pick;
    // Start from the affordable plan closest to that default, so the panel never opens on an impossible plan.
    const valid = enumerateSelections(scn, run.state);
    const overlap = (c: string[]) => c.filter((id) => pick.includes(id)).length - c.filter((id) => !pick.includes(id)).length;
    return valid.sort((x, y) => overlap(y) - overlap(x))[0] ?? pick;
  });
  const [error, setError] = useState<string | null>(null);
  if (!turn) return null;

  const budget = budgetFor(scn, run.state, chosen);
  const problem = validateSelection(scn, run.state, chosen);
  const groups = [...new Set(actions.filter((a) => a.group).map((a) => a.group as string))];
  const locked = actions.filter((a) => a.locked);
  const optional = actions.filter((a) => !a.group && !a.locked);
  const hints = hintsOn(settings, scn.tier);

  const pick = (a: ActionSpec) => {
    setError(null);
    if (a.group) setChosen((c) => [...c.filter((id) => !actions.some((x) => x.group === a.group && x.id === id)), a.id]);
    else setChosen((c) => (c.includes(a.id) ? c.filter((id) => id !== a.id) : [...c, a.id]));
  };

  const confirm = () => {
    const res = commit(chosen);
    if (!res) return;
    if (!res.ok) { setError(res.error); playCue('fail'); return; }
    playCue('ok');
    onCommitted(res.report);
  };

  // The power board: every unit is one light. Panel power is spent first, then the battery.
  const picked = actions.filter((a) => chosen.includes(a.id));
  const gain = picked.reduce((sum, a) => sum + Math.max(0, -a.cost), 0);
  const use = picked.reduce((sum, a) => sum + Math.max(0, a.cost), 0);
  const supply = budget.income + budget.reserve + gain;
  const pips = Array.from({ length: Math.max(supply, use) }, (_, i) => ({
    from: i < budget.income ? 'sun' : i < budget.income + budget.reserve ? 'cell' : i < supply ? 'extra' : 'missing',
    used: i < use,
  }));
  const after = Math.min(RES_BOUNDS.battery.max, budget.remaining);

  return (
    <Dialog title={turn.title} icon="bolt" kicker={`Power plan · shift ${run.state.turn + 1} of ${scn.turns.length}`} onClose={onClose} wide>
      <p className="lead">{turn.narrative}</p>

      <div className={`power-board sticky-top ${budget.remaining < 0 ? 'over' : ''}`} aria-live="polite">
        <div className="power-head">
          <span className="power-title"><Icon name="bolt" size={18} /> Power this shift</span>
          <span className="power-src sun"><Icon name="sun" size={16} /> {budget.income} from panels</span>
          <span className="power-src cell"><Icon name="battery" size={16} /> {budget.reserve} in battery</span>
          {gain > 0 && <span className="power-src extra"><Icon name="bolt" size={16} /> {gain} from backup cells</span>}
        </div>
        <div className="pips" role="img" aria-label={`The plan uses ${use} of ${supply} units`}>
          {pips.map((p, i) => <span key={i} className={`pip ${p.from} ${p.used ? 'used' : 'spare'}`}><Icon name="bolt" size={18} /></span>)}
          {pips.length === 0 && <span className="fine">No power available this shift.</span>}
          {pips.length > 0 && <span className="pip-key">Dark: used by this plan. Bright: saved.</span>}
        </div>
        <div className="power-result">
          {budget.remaining < 0
            ? <><Icon name="warning" size={18} /> Short by {-budget.remaining}. Choose a cheaper plan.</>
            : <><Icon name="battery" size={18} /> Plan uses <strong>{use}</strong>. Battery after this shift: <strong>{after}</strong>.</>}
        </div>
        {budget.bonusNotes.length > 0 && <p className="fine">{budget.bonusNotes.join(' · ')}</p>}
      </div>

      {locked.map((a) => (
        <div key={a.id} className="choice locked">
          <span className="choice-icon"><Icon name={actionIcon(a)} size={24} /></span>
          <span className="choice-main"><strong>{a.label}</strong><small>{a.detail}</small></span>
          <Cost cost={a.cost} />
          <span className="choice-lock"><Icon name="lock" size={14} /> always on</span>
        </div>
      ))}

      {groups.map((g) => (
        <fieldset key={g} className="choice-group">
          <legend>{g} <span>choose one</span></legend>
          <div className="choices">
            {actions.filter((a) => a.group === g).map((a) => {
              const others = chosen.filter((id) => !actions.some((x) => x.group === g && x.id === id));
              const affordable = budgetFor(scn, run.state, [...others, a.id]).remaining >= 0;
              return <Choice key={a.id} a={a} type="radio" name={g} checked={chosen.includes(a.id)} onPick={() => pick(a)} short={!affordable} />;
            })}
          </div>
        </fieldset>
      ))}

      {optional.length > 0 && (
        <fieldset className="choice-group">
          <legend>Extras <span>optional</span></legend>
          <div className="choices">
            {optional.map((a) => <Choice key={a.id} a={a} type="checkbox" name={a.id} checked={chosen.includes(a.id)} onPick={() => pick(a)} />)}
          </div>
        </fieldset>
      )}

      {hints && turn.hint && <Comm name="Tip" tone="tip">{turn.hint}</Comm>}
      <p className="fine center">No timer. Take as long as you like. {LABELS.units} {LABELS.time}</p>
      {/* Focus starts on the first choice, so the panel opens at the top with the power board in view. */}
      <div className="dialog-actions sticky-foot">
        {(error || problem) && <p className="error" role="alert"><Icon name="warning" size={18} /> {error ?? problem}</p>}
        <Btn size="lg" icon="check" onClick={confirm} disabled={!!problem}>Lock in this plan</Btn>
        <Btn kind="ghost" onClick={onClose}>Step back</Btn>
      </div>
    </Dialog>
  );
}

/** What happened after a committed turn: events, meter changes and messages. */
export function TurnReportCard({ scn, report, onContinue }: { scn: ScenarioSpec; report: TurnReport; onContinue: () => void }) {
  const turn = scn.turns.find((t) => t.id === report.turnId);
  const picked = turn?.actions.filter((a) => report.chosen.includes(a.id)) ?? [];
  const worst = report.events.some((e) => e.level === 'alert') ? 'alert' : 'normal';
  return (
    <Dialog title={`${turn?.title ?? 'Shift'}: what happened`} icon="list" kicker="Shift report" wide tone={worst === 'alert' ? 'alert' : 'normal'}>
      <p className="lead">You ran: {picked.map((a) => a.label).join(', ')}. Panels gave {report.income} units and the plan used {report.spent}.</p>
      <ul className="deltas">
        {shownResources(scn).map((res) => <Delta key={res} res={res} before={report.before} after={report.after} />)}
      </ul>
      {report.queued.map((m) => (
        <Comm key={m.id} name="Message sent to Earth"><span>A reply is on its way and will arrive after your next decision. <SourceLink id="comms" short /></span></Comm>
      ))}
      {report.delivered.map((m) => (
        <Comm key={m.id} name={`Reply from ${m.from}`} tone="good">“{m.text}”</Comm>
      ))}
      {report.events.map((e) => (
        <div key={e.id} className={`event ${e.level}`}>
          <span className="event-icon"><Icon name={e.level === 'info' ? 'info' : 'warning'} size={22} /></span>
          <div>
            <strong>{e.warning}</strong>
            <span>What you can see: {e.symptom}</span>
            {e.sourceId && <SourceLink id={e.sourceId} />}
          </div>
        </div>
      ))}
      <div className="dialog-actions"><Btn autoFocus size="lg" iconEnd="arrow" onClick={onContinue}>Continue</Btn></div>
    </Dialog>
  );
}

export function CriticalCard({ run, scn, onRecover }: { run: OutpostRun; scn: ScenarioSpec; onRecover: () => void }) {
  const crit = run.state.critical;
  if (!crit) return null;
  const turn = scn.turns[crit.turn];
  return (
    <Dialog title="Shift stopped by Mission Control" tone="alert" icon="warning" kicker="Everyone is safe">
      <p className="reset-reason"><strong>What happened:</strong> {crit.explanation}</p>
      <p><strong>The decision that led here:</strong> “{crit.causeLabel}” during {turn.title}.</p>
      <Comm name="Try this" tone="tip">Go back to the checkpoint before that decision and try a different plan.</Comm>
      <Btn autoFocus size="lg" block icon="replay" onClick={onRecover}>Recover from checkpoint: {turn.title}</Btn>
    </Dialog>
  );
}

function choiceLabel(scn: ScenarioSpec, turnIndex: number, ids: string[]): string {
  const turn = scn.turns[turnIndex];
  const names = turn.actions.filter((a) => ids.includes(a.id) && !a.locked).map((a) => a.label);
  return names.length ? names.join(' + ') : 'Air support only';
}

/** Turn-by-turn record for the debrief. */
export function OutpostSummary({ scn, run }: { scn: ScenarioSpec; run: OutpostRun }) {
  const cols = shownResources(scn);
  return (
    <div className="table-wrap">
      <table className="summary">
        <thead><tr><th>Decision</th><th>You chose</th>{cols.map((c) => <th key={c}>{RES_LABEL[c]} after</th>)}</tr></thead>
        <tbody>
          {run.state.history.map((h, i) => (
            <tr key={h.turnId}>
              <th scope="row">{scn.turns[i].title}</th>
              <td>{choiceLabel(scn, i, h.chosen)}</td>
              {cols.map((c) => <td key={c}>{resText(c, h.after[c])}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ReplayPicker({ scn, run, onPick, onClose }: { scn: ScenarioSpec; run: OutpostRun; onPick: (turn: number) => void; onClose: () => void }) {
  return (
    <Dialog title="Replay a decision" icon="replay" kicker="Mission Replay" onClose={onClose} wide>
      <p className="lead">Pick a checkpoint. The habitat goes back to exactly how it was: same air, same battery, same crops, same events on the way and the same messages in the queue. Then change one choice and compare.</p>
      <div className="stack">
        {run.snapshots.map((snap, i) => (
          <button key={i} type="button" className="pick-card" {...(i === 0 ? { 'data-autofocus': true } : {})} onClick={() => { playCue('start'); onPick(i); }}>
            <span className="pick-num">{i + 1}</span>
            <span className="pick-main">
              <span className="pick-title">Checkpoint {i + 1}: before “{scn.turns[i].title}”</span>
              <span className="pick-meta">Last time you chose: {choiceLabel(scn, i, run.decisions[i] ?? [])}</span>
              <span className="pick-meta">Restores Air {resText('air', snap.resources.air)}, Battery {snap.resources.battery}, Crops stage {snap.resources.crop}</span>
            </span>
            <Icon name="replay" size={22} />
          </button>
        ))}
      </div>
      <div className="dialog-actions"><Btn kind="ghost" onClick={onClose}>Cancel</Btn></div>
    </Dialog>
  );
}

/** Side-by-side comparison of the first run and the replay. */
export function ComparisonView({ scn, original, replay }: { scn: ScenarioSpec; original: OutpostRun; replay: OutpostRun }) {
  const cmp = compareRuns(scn, original, replay);
  const cols = shownResources(scn);
  if (!cmp) {
    return (
      <div className="compare same">
        <h3 className="mini-head"><Icon name="replay" size={16} /> Same choices, same result</h3>
        <p>You made the same decisions from the same checkpoint and the outcome matched exactly. The habitat follows fixed rules: the same actions always give the same result.</p>
      </div>
    );
  }
  const nextTitle = scn.turns[cmp.changedTurn + 1]?.title;
  const units = (n: number) => `${n} ${n === 1 ? 'unit' : 'units'}`;
  const hasReserve = cmp.reserveOriginal !== null && cmp.reserveReplay !== null;
  const reserveNote = `in the battery ${nextTitle ? `going into “${nextTitle}”` : 'at the next checkpoint'}`;
  return (
    <div className="compare">
      <h3 className="mini-head"><Icon name="replay" size={16} /> First run and replay, side by side</h3>
      <div className="versus">
        <div className="versus-side">
          <span className="versus-tag">First run · {cmp.changedTitle}</span>
          <strong>{cmp.originalChoice}</strong>
          {hasReserve && <span className="versus-val"><Icon name="battery" size={20} /> {units(cmp.reserveOriginal as number)}</span>}
          {hasReserve && <span className="versus-note">{reserveNote}</span>}
        </div>
        <span className="versus-vs" aria-hidden="true">VS</span>
        <div className="versus-side replay">
          <span className="versus-tag">Replay · {cmp.changedTitle}</span>
          <strong>{cmp.replayChoice}</strong>
          {hasReserve && <span className="versus-val"><Icon name="battery" size={20} /> {units(cmp.reserveReplay as number)}</span>}
          {hasReserve && <span className="versus-note">{reserveNote}</span>}
        </div>
      </div>
      <div className="table-wrap">
        <table className="compare-table">
          <thead><tr><th></th><th>First run</th><th>Replay</th><th>Difference</th></tr></thead>
          <tbody>
            <tr><th scope="row">{cmp.changedTitle}</th><td>{cmp.originalChoice}</td><td>{cmp.replayChoice}</td><td>changed</td></tr>
            {cmp.reserveOriginal !== null && cmp.reserveReplay !== null && (
              <tr className="key-row">
                <th scope="row">Battery {nextTitle ? `before “${nextTitle}”` : 'at the next checkpoint'}</th>
                <td>{units(cmp.reserveOriginal)}</td><td>{units(cmp.reserveReplay)}</td>
                <td>{cmp.reserveReplay === cmp.reserveOriginal ? 'same' : `${cmp.reserveReplay > cmp.reserveOriginal ? '▲' : '▼'} ${Math.abs(cmp.reserveReplay - cmp.reserveOriginal)} units`}</td>
              </tr>
            )}
            {scn.turns.slice(cmp.changedTurn + 1).map((t, k) => {
              const i = cmp.changedTurn + 1 + k;
              const a = original.decisions[i];
              const b = replay.decisions[i];
              if (!a && !b) return null;
              return <tr key={t.id}><th scope="row">{t.title}</th><td>{a ? choiceLabel(scn, i, a) : 'not reached'}</td><td>{b ? choiceLabel(scn, i, b) : 'not reached'}</td><td>{a && b && [...a].sort().join() === [...b].sort().join() ? 'same' : 'changed'}</td></tr>;
            })}
            {cmp.rows.filter((r) => cols.includes(r.res)).map((r) => (
              <tr key={r.res} className={r.delta === 0 ? '' : r.delta > 0 ? 'up' : 'down'}>
                <th scope="row">Final {r.label.toLowerCase()}</th>
                <td>{resText(r.res, r.original)}</td><td>{resText(r.res, r.replay)}</td>
                <td>{r.delta === 0 ? 'same' : `${r.delta > 0 ? '▲ up' : '▼ down'} ${Math.abs(r.delta)}`}</td>
              </tr>
            ))}
            {scn.missionId === 'L02' && cols.includes('crop') && (
              <tr>
                <th scope="row">Harvest</th>
                <td>{original.state.flags.harvest ? 'on time' : 'delayed'}</td>
                <td>{replay.state.flags.harvest ? 'on time' : 'delayed'}</td>
                <td>{!!original.state.flags.harvest === !!replay.state.flags.harvest ? 'same' : 'changed'}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Comm name="Why" tone="tip">{cmp.explanation}</Comm>
    </div>
  );
}
