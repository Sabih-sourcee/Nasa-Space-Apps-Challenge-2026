import { useEffect, useState } from 'react';
import { playCue } from '../game/audio';
import { useGame } from '../game/store';
import { DEMO_MISSIONS, WORLD_INFO, missionAfter } from '../sim/missions';
import { compareBattery } from '../sim/lastBattery';
import { scenarioById } from '../sim/outpostScenarios';
import { COMMANDER } from '../sim/story';
import { TIER_LABEL } from '../sim/types';
import { WorldArt } from './art';
import { Btn, Chip, Comm, SourceLink, Stars } from './common';
import { Icon } from './icons';
import { ComparisonView, OutpostSummary, ReplayPicker } from './Outpost';

/** Results screen: the stars first, then what happened and why. */
export function Debrief() {
  const result = useGame((s) => s.result);
  const mode = useGame((s) => s.mode);
  const go = useGame((s) => s.go);
  const cont = useGame((s) => s.continueAfterDebrief);
  const start = useGame((s) => s.startMission);
  const startReplay = useGame((s) => s.startReplay);
  const startChoiceReplay = useGame((s) => s.startChoiceReplay);
  const openBriefing = useGame((s) => s.openBriefing);
  const [picking, setPicking] = useState(false);

  const stars = result?.stars ?? 0;
  const badge = result?.milestone ?? null;
  // The fanfare, then one chime per star in time with the animation, then the badge.
  useEffect(() => {
    playCue('complete');
    const timers: number[] = [];
    for (let i = 0; i < stars; i++) timers.push(window.setTimeout(() => playCue('star', i), 700 + i * 380));
    if (badge) timers.push(window.setTimeout(() => playCue('badge'), 900 + stars * 380));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [stars, badge]);

  if (!result) return null;
  const def = DEMO_MISSIONS[result.missionId];
  const next = missionAfter(result.missionId);
  const scn = result.outpost ? scenarioById(result.outpost.scenarioId) : null;
  const isReplay = !!result.baseline || !!result.batteryBaseline;
  const cmp = result.battery && result.batteryBaseline ? compareBattery(result.batteryBaseline, result.battery) : null;
  const replaySource = result.baseline ?? result.outpost;
  const canReplay = !!scn && !!replaySource;

  const outpostPanel = scn && result.outpost && (
    <section className="panel">
      {isReplay && result.baseline
        ? <ComparisonView scn={scn} original={result.baseline} replay={result.outpost} />
        : (
          <>
            <h2 className="mini-head"><Icon name="list" size={16} /> Habitat log</h2>
            <OutpostSummary scn={scn} run={result.outpost} />
            <p className="fine">Energy units are invented game units. Time is compressed.</p>
          </>
        )}
    </section>
  );

  const batteryPanel = cmp && (
    <section className="panel">
      <div className="compare">
        <h3 className="mini-head"><Icon name="replay" size={16} /> First run and replay, side by side</h3>
        <div className="versus">
          <div className="versus-side"><span className="versus-tag">First run</span><strong>{cmp.rows[0].first}</strong><span className="versus-val"><Icon name="battery" size={20} /> {cmp.rows[3].first}</span><span className="versus-note">left in the battery</span></div>
          <span className="versus-vs" aria-hidden="true">VS</span>
          <div className="versus-side replay"><span className="versus-tag">Replay</span><strong>{cmp.rows[0].replay}</strong><span className="versus-val"><Icon name="battery" size={20} /> {cmp.rows[3].replay}</span><span className="versus-note">left in the battery</span></div>
        </div>
        <div className="table-wrap">
          <table className="compare-table">
            <thead><tr><th></th><th>First run</th><th>Replay</th><th>Difference</th></tr></thead>
            <tbody>
              {cmp.rows.map((r, i) => (
                <tr key={r.label} className={i === 0 ? 'key-row' : r.delta === 0 ? '' : r.delta > 0 ? 'up' : 'down'}>
                  <th scope="row">{r.label}</th><td>{r.first}</td><td>{r.replay}</td>
                  <td>{r.first === r.replay ? 'same' : r.delta === 0 ? 'changed' : `${r.delta > 0 ? '▲ up' : '▼ down'} ${Math.abs(r.delta)}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Comm name="Why" tone="tip">{cmp.why}</Comm>
        <p className="fine">Same starting charge, same cargo status, same alert timing. Charge units and crop stages are invented game units.</p>
      </div>
    </section>
  );

  return (
    <div className={`screen results world-${def.world}`}>
      <section className="results-hero">
        <div className="results-art"><WorldArt world={def.world} size={104} /></div>
        <div className="kicker">{WORLD_INFO[def.world].label} · Mission {def.id} · {TIER_LABEL[result.tier]}{mode === 'judge' ? ' · Judge Mode' : ''}</div>
        <h1 className="results-title">{isReplay ? 'Replay complete' : 'Mission complete'}!</h1>
        <div className="results-mission">{def.title}</div>
        <div className="results-stars"><Stars value={result.stars} size={62} pop /></div>
        {result.newBest && <Chip tone="gold" icon="star">{isReplay ? 'New best for this mission' : 'New best'}</Chip>}
        <p className="results-status">{result.crewStatus}</p>
        {result.starTip && <p className="star-goal"><Icon name="star" size={16} /><span>{result.starTip}</span></p>}
        {badge && (
          <div className="badge-banner" role="status">
            <Icon name="medal" size={30} />
            <span><strong>Badge earned</strong>{badge}</span>
          </div>
        )}

        <div className="results-actions">
          {!isReplay && next && <Btn autoFocus size="lg" iconEnd="arrow" cue="start" onClick={cont}>Next: {DEMO_MISSIONS[next].title}</Btn>}
          {!isReplay && !next && <Btn autoFocus size="lg" icon="map" onClick={() => go('atlas')}>Route complete: open the map</Btn>}
          {canReplay && (
            <Btn kind={isReplay ? 'primary' : 'blue'} size="lg" icon="replay" autoFocus={isReplay} onClick={() => setPicking(true)}>
              {isReplay ? 'Replay another decision' : 'Replay a Decision'}
            </Btn>
          )}
          {/* The ship mission leads into the lunar one that uses its battery. */}
          {result.missionId === 'F03' && <Btn kind="blue" size="lg" icon="battery" cue="start" onClick={() => openBriefing('L03')}>Story: {DEMO_MISSIONS.L03.title}</Btn>}
          {result.battery && (
            <Btn kind={isReplay ? 'primary' : 'blue'} size="lg" icon="replay" autoFocus={isReplay} cue="start" onClick={startChoiceReplay}>
              {isReplay ? 'Replay the choice again' : 'Replay the Choice'}
            </Btn>
          )}
          {isReplay && next && <Btn kind="blue" size="lg" iconEnd="arrow" cue="start" onClick={cont}>Next: {DEMO_MISSIONS[next].title}</Btn>}
          <Btn kind="ghost" icon="rocket" cue="start" onClick={() => start(result.missionId)}>Retry mission</Btn>
          <Btn kind="ghost" icon="map" onClick={() => go('atlas')}>Mission map</Btn>
        </div>
        {(canReplay || result.battery) && !isReplay && <p className="fine center">Replay takes you back to a checkpoint. Change one choice, then compare both endings.</p>}
      </section>

      {isReplay && outpostPanel}
      {batteryPanel}

      <div className="results-grid">
        <section className="panel">
          {result.stats.length > 0 && (
            <>
              <h2 className="mini-head"><Icon name="gauge" size={16} /> Flight record</h2>
              <dl className="stat-tiles">
                {result.stats.map((s) => <div key={s.label} className="stat-tile"><dd>{s.value}</dd><dt>{s.label}</dt></div>)}
              </dl>
            </>
          )}
          <h2 className="mini-head"><Icon name="target" size={16} /> Objectives</h2>
          <ul className="checklist">
            {result.objectives.map((o) => (
              <li key={o.label} className={o.done ? 'done' : 'missed'}>
                <span className="check-mark" aria-hidden="true"><Icon name={o.done ? 'check' : 'x'} size={14} /></span>
                <span>{o.label} <span className="sr">{o.done ? '(achieved)' : '(not achieved)'}</span></span>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <h2 className="mini-head"><Icon name="headset" size={16} /> Cause and effect</h2>
          <Comm name={COMMANDER}>{result.consequence}</Comm>
          <div className="fact-card">
            <h3><Icon name="bulb" size={18} /> Space fact</h3>
            <p>{def.fact.text}</p>
            <p><SourceLink id={def.fact.sourceId} /></p>
          </div>
          <p className="labels">{def.labels.join(' · ')}</p>
        </section>
      </div>

      {!isReplay && outpostPanel}

      {picking && scn && replaySource && (
        <ReplayPicker scn={scn} run={replaySource} onClose={() => setPicking(false)} onPick={(turn) => { setPicking(false); startReplay(turn); }} />
      )}
    </div>
  );
}
