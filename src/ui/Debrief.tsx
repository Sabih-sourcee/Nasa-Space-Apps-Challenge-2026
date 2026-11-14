import { useEffect, useState } from 'react';
import { playCue } from '../game/audio';
import { useGame } from '../game/store';
import { DEMO_MISSIONS, missionAfter } from '../sim/missions';
import { scenarioById } from '../sim/outpostScenarios';
import { TIER_LABEL } from '../sim/types';
import { Btn, SourceLink } from './common';
import { ComparisonView, OutpostSummary, ReplayPicker } from './Outpost';

export function Debrief() {
  const result = useGame((s) => s.result);
  const mode = useGame((s) => s.mode);
  const go = useGame((s) => s.go);
  const cont = useGame((s) => s.continueAfterDebrief);
  const start = useGame((s) => s.startMission);
  const startReplay = useGame((s) => s.startReplay);
  const [picking, setPicking] = useState(false);

  useEffect(() => { playCue('complete'); }, []);
  if (!result) return null;
  const def = DEMO_MISSIONS[result.missionId];
  const next = missionAfter(result.missionId);
  const scn = result.outpost ? scenarioById(result.outpost.scenarioId) : null;
  const isReplay = !!result.baseline;
  const replaySource = result.baseline ?? result.outpost;

  return (
    <div className="screen debrief">
      <header className="screen-head">
        <div>
          <div className="kicker">Debrief · {def.id} · {TIER_LABEL[result.tier]}{mode === 'judge' ? ' · Judge Mode' : ''}</div>
          <h1>{isReplay ? 'Replay complete' : 'Mission complete'}: {def.title}</h1>
        </div>
      </header>

      {result.milestone && <p className="banner good">★ Milestone earned: {result.milestone}</p>}

      <div className="debrief-grid">
        <section className="card">
          <h2>Crew status</h2>
          <p className="status-line">{result.crewStatus}</p>
          <h2>Objectives</h2>
          <ul className="checklist">
            {result.objectives.map((o) => (
              <li key={o.label} className={o.done ? 'done' : 'missed'}>
                <span aria-hidden="true">{o.done ? '✔' : '○'}</span> {o.label} <span className="sr">{o.done ? '(achieved)' : '(not achieved)'}</span>
              </li>
            ))}
          </ul>
          {result.stats.length > 0 && (
            <>
              <h2>Flight record</h2>
              <dl className="stats">
                {result.stats.map((s) => <div key={s.label}><dt>{s.label}</dt><dd>{s.value}</dd></div>)}
              </dl>
            </>
          )}
        </section>

        <section className="card">
          <h2>Cause and effect</h2>
          <p>{result.consequence}</p>
          <h2>Space fact</h2>
          <p>{def.fact.text}</p>
          <p><SourceLink id={def.fact.sourceId} /></p>
          <p className="labels">{def.labels.join(' · ')}</p>
        </section>
      </div>

      {scn && result.outpost && (
        <section className="card">
          {isReplay && result.baseline
            ? <ComparisonView scn={scn} original={result.baseline} replay={result.outpost} />
            : (
              <>
                <h2>Habitat log</h2>
                <OutpostSummary scn={scn} run={result.outpost} />
                <p className="fine">Energy units are invented game units. Time is compressed.</p>
              </>
            )}
        </section>
      )}

      <div className="row actions">
        {!isReplay && next && <Btn autoFocus onClick={cont}>Continue to {DEMO_MISSIONS[next].title}</Btn>}
        {!isReplay && !next && <Btn autoFocus onClick={() => go('atlas')}>Campaign route complete: open the atlas</Btn>}
        {scn && replaySource && (
          <Btn kind={isReplay ? 'primary' : 'ghost'} autoFocus={isReplay} onClick={() => setPicking(true)}>
            {isReplay ? 'Replay another decision' : 'Replay a Decision'}
          </Btn>
        )}
        {isReplay && next && <Btn kind="ghost" onClick={cont}>Continue to {DEMO_MISSIONS[next].title}</Btn>}
        <Btn kind="ghost" onClick={() => start(result.missionId)}>Retry mission</Btn>
        <Btn kind="ghost" onClick={() => go('atlas')}>Mission Atlas</Btn>
      </div>

      {picking && scn && replaySource && (
        <ReplayPicker scn={scn} run={replaySource} onClose={() => setPicking(false)} onPick={(turn) => { setPicking(false); startReplay(turn); }} />
      )}
    </div>
  );
}
