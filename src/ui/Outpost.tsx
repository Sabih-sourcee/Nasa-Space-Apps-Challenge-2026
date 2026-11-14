import { useMemo, useState } from 'react';
import { playCue } from '../game/audio';
import { useGame } from '../game/store';
import {
  RES_BOUNDS, RES_LABEL, budgetFor, compareRuns, currentTurn, defaultSelection, enumerateSelections, turnActions, validateSelection,
  type ActionSpec, type OutpostRun, type ResKey, type Resources, type ScenarioSpec, type TurnReport,
} from '../sim/outpost';
import { hintsOn } from '../sim/save';
import { LABELS } from '../sim/sources';
import { Btn, Dialog, SourceLink } from './common';

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

function shownResources(scn: ScenarioSpec): ResKey[] {
  const extra: ResKey[] = scn.missionId === 'L02' ? ['protection'] : [];
  const sci: ResKey[] = scn.tier === 'advanced' ? ['science'] : [];
  return [...scn.meters, ...extra, ...sci];
}

function Delta({ before, after, res }: { before: Resources; after: Resources; res: ResKey }) {
  const d = after[res] - before[res];
  return (
    <tr className={d === 0 ? '' : d > 0 ? 'up' : 'down'}>
      <th scope="row">{RES_LABEL[res]}</th>
      <td>{resText(res, before[res])}</td>
      <td aria-hidden="true">→</td>
      <td>{resText(res, after[res])}</td>
      <td>{d === 0 ? 'no change' : `${d > 0 ? '▲ up' : '▼ down'} ${Math.abs(d)}`}</td>
    </tr>
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

  const costText = (a: ActionSpec) => (a.cost < 0 ? `adds ${-a.cost} units` : a.cost === 0 ? 'free' : `${a.cost} ${a.cost === 1 ? 'unit' : 'units'}`);

  const confirm = () => {
    const res = commit(chosen);
    if (!res) return;
    if (!res.ok) { setError(res.error); playCue('fail'); return; }
    playCue('ok');
    onCommitted(res.report);
  };

  return (
    <Dialog title={`${turn.title}: power plan`} onClose={onClose} wide>
      <p>{turn.narrative}</p>
      <div className="budget" aria-live="polite">
        <span><strong>{budget.income}</strong> from panels</span>
        <span>+ <strong>{budget.reserve}</strong> in battery</span>
        <span>= <strong>{budget.available}</strong> to use</span>
        <span className={budget.remaining < 0 ? 'over' : ''}>Plan uses <strong>{budget.spent}</strong></span>
        <span className={budget.remaining < 0 ? 'over' : 'good'}>
          {budget.remaining < 0 ? `Short by ${-budget.remaining}` : `Battery after: ${Math.min(RES_BOUNDS.battery.max, budget.remaining)}`}
        </span>
      </div>
      {budget.bonusNotes.length > 0 && <p className="fine">{budget.bonusNotes.join(' · ')}</p>}
      <p className="fine">{LABELS.units} {LABELS.time}</p>

      {locked.map((a) => (
        <div key={a.id} className="action locked">
          <span className="action-main"><strong>{a.label}</strong> <em>always on</em><br /><small>{a.detail}</small></span>
          <span className="action-cost">{costText(a)}</span>
        </div>
      ))}

      {groups.map((g) => (
        <fieldset key={g} className="action-group">
          <legend>{g}: choose one</legend>
          {actions.filter((a) => a.group === g).map((a) => {
            const others = chosen.filter((id) => !actions.some((x) => x.group === g && x.id === id));
            const affordable = budgetFor(scn, run.state, [...others, a.id]).remaining >= 0;
            return (
              <label key={a.id} className={`action ${chosen.includes(a.id) ? 'on' : ''} ${affordable ? '' : 'short'}`}>
                <input type="radio" name={g} checked={chosen.includes(a.id)} onChange={() => pick(a)} />
                <span className="action-main"><strong>{a.label}</strong><br /><small>{a.detail}{!affordable && ' Not enough power with the rest of this plan.'}</small></span>
                <span className="action-cost">{costText(a)}</span>
              </label>
            );
          })}
        </fieldset>
      ))}

      {optional.length > 0 && (
        <fieldset className="action-group">
          <legend>Optional</legend>
          {optional.map((a) => (
            <label key={a.id} className={`action ${chosen.includes(a.id) ? 'on' : ''}`}>
              <input type="checkbox" checked={chosen.includes(a.id)} onChange={() => pick(a)} />
              <span className="action-main"><strong>{a.label}</strong><br /><small>{a.detail}</small></span>
              <span className="action-cost">{costText(a)}</span>
            </label>
          ))}
        </fieldset>
      )}

      {hints && turn.hint && <p className="hint-line"><strong>Hint:</strong> {turn.hint}</p>}
      {(error || problem) && <p className="error" role="alert">{error ?? problem}</p>}
      <div className="row">
        <Btn autoFocus onClick={confirm} disabled={!!problem}>Commit this plan</Btn>
        <Btn kind="ghost" onClick={onClose}>Step back</Btn>
      </div>
      <p className="fine">No timer. Take as long as you like.</p>
    </Dialog>
  );
}

/** What happened after a committed turn: events, meter changes and messages. */
export function TurnReportCard({ scn, report, onContinue }: { scn: ScenarioSpec; report: TurnReport; onContinue: () => void }) {
  const turn = scn.turns.find((t) => t.id === report.turnId);
  const picked = turn?.actions.filter((a) => report.chosen.includes(a.id)) ?? [];
  const worst = report.events.some((e) => e.level === 'alert') ? 'alert' : 'normal';
  return (
    <Dialog title={`${turn?.title ?? 'Shift'}: what happened`} wide tone={worst === 'alert' ? 'alert' : 'normal'}>
      <p>You ran: {picked.map((a) => a.label).join(', ')}. Panels gave {report.income} units and the plan used {report.spent}.</p>
      <table className="deltas">
        <tbody>{shownResources(scn).map((res) => <Delta key={res} res={res} before={report.before} after={report.after} />)}</tbody>
      </table>
      {report.queued.map((m) => (
        <p key={m.id} className="msg queued"><strong>Message sent to Earth.</strong> A reply is on its way and will arrive after your next decision. <SourceLink id="comms" short /></p>
      ))}
      {report.delivered.map((m) => (
        <p key={m.id} className="msg"><strong>Reply from {m.from}:</strong> “{m.text}”</p>
      ))}
      {report.events.map((e) => (
        <div key={e.id} className={`event ${e.level}`}>
          <strong>{e.warning}</strong>
          <span>What you can see: {e.symptom}</span>
          {e.sourceId && <SourceLink id={e.sourceId} />}
        </div>
      ))}
      <div className="row"><Btn autoFocus onClick={onContinue}>Continue</Btn></div>
    </Dialog>
  );
}

export function CriticalCard({ run, scn, onRecover }: { run: OutpostRun; scn: ScenarioSpec; onRecover: () => void }) {
  const crit = run.state.critical;
  if (!crit) return null;
  const turn = scn.turns[crit.turn];
  return (
    <Dialog title="Shift stopped by Mission Control" tone="alert">
      <p><strong>What happened:</strong> {crit.explanation}</p>
      <p><strong>The decision that led here:</strong> “{crit.causeLabel}” during {turn.title}.</p>
      <p>Everyone is safe. Go back to the checkpoint before that decision and try a different plan.</p>
      <div className="row"><Btn autoFocus onClick={onRecover}>Recover from checkpoint: {turn.title}</Btn></div>
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
  );
}

export function ReplayPicker({ scn, run, onPick, onClose }: { scn: ScenarioSpec; run: OutpostRun; onPick: (turn: number) => void; onClose: () => void }) {
  return (
    <Dialog title="Replay a decision" onClose={onClose} wide>
      <p>Pick a checkpoint. The habitat goes back to exactly how it was: same air, same battery, same crops, same events on the way and the same messages in the queue. Then change one choice and compare.</p>
      <div className="stack">
        {run.snapshots.map((snap, i) => (
          <button key={i} type="button" className="replay-row" {...(i === 0 ? { 'data-autofocus': true } : {})} onClick={() => onPick(i)}>
            <span className="replay-title">Checkpoint {i + 1}: before “{scn.turns[i].title}”</span>
            <span className="replay-meta">Last time you chose: {choiceLabel(scn, i, run.decisions[i] ?? [])}</span>
            <span className="replay-meta">Restores Air {resText('air', snap.resources.air)}, Battery {snap.resources.battery}, Crops stage {snap.resources.crop}</span>
          </button>
        ))}
      </div>
      <div className="row"><Btn kind="ghost" onClick={onClose}>Cancel</Btn></div>
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
        <h3>Same choices, same result</h3>
        <p>You made the same decisions from the same checkpoint and the outcome matched exactly. The habitat follows fixed rules: the same actions always give the same result.</p>
      </div>
    );
  }
  const nextTitle = scn.turns[cmp.changedTurn + 1]?.title;
  return (
    <div className="compare">
      <h3>First run and replay, side by side</h3>
      <table className="compare-table">
        <thead><tr><th></th><th>First run</th><th>Replay</th><th>Difference</th></tr></thead>
        <tbody>
          <tr><th scope="row">{cmp.changedTitle}</th><td>{cmp.originalChoice}</td><td>{cmp.replayChoice}</td><td>changed</td></tr>
          {cmp.reserveOriginal !== null && cmp.reserveReplay !== null && (
            <tr className="key-row">
              <th scope="row">Battery {nextTitle ? `before “${nextTitle}”` : 'at the next checkpoint'}</th>
              <td>{cmp.reserveOriginal} {cmp.reserveOriginal === 1 ? 'unit' : 'units'}</td><td>{cmp.reserveReplay} {cmp.reserveReplay === 1 ? 'unit' : 'units'}</td>
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
      <p className="explain"><strong>Why:</strong> {cmp.explanation}</p>
    </div>
  );
}
