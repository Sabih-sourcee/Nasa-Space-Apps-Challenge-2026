import { useEffect, useMemo, useState } from 'react';
import { playCue, speak } from '../game/audio';
import { input } from '../game/input';
import { useGame } from '../game/store';
import { DEMO_MISSIONS, WORLD_INFO, missionStatus } from '../sim/missions';
import { starsOf } from '../sim/score';
import { COMMANDER, briefingFor, type Carry } from '../sim/story';
import { PLAYABLE, type DemoMissionId, type Tier } from '../sim/types';
import { ReyesPortrait, WorldArt } from './art';
import { Btn, Dialog, Stars } from './common';
import { Icon } from './icons';

/** Story facts earlier missions left in the save, for the briefing that follows them. */
export function useCarry(): Carry {
  const flags = useGame((s) => s.save.completed.F03?.flags);
  return useMemo(() => ({ batterySecured: flags?.batterySecured }), [flags]);
}

/**
 * Commander Reyes opens a mission in three comic panels: where we are, what
 * changed, your assignment. The panels advance by hand, can be skipped, and
 * read fully without sound. Gameplay keeps its realistic 3D look.
 */
export function CommanderBriefing({ missionId, tier, onDone, replay = false }: { missionId: DemoMissionId; tier: Tier; onDone: () => void; replay?: boolean }) {
  const carry = useCarry();
  const brief = useMemo(() => briefingFor(missionId, tier, carry), [missionId, tier, carry]);
  const def = DEMO_MISSIONS[missionId];
  const [shown, setShown] = useState(0);
  const last = shown >= brief.panels.length - 1;

  // The radio voiceover is optional (Spoken alerts in Settings). The caption always carries the same words.
  useEffect(() => { speak(brief.panels[shown].caption); }, [brief, shown]);

  useEffect(() => {
    input.setSuspended(true);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onDone(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); setShown((n) => Math.min(brief.panels.length - 1, n + 1)); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); setShown((n) => Math.max(0, n - 1)); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => { window.removeEventListener('keydown', onKey, true); input.setSuspended(false); input.clear(); };
  }, [brief, onDone]);

  // Keyboard focus follows the main button, so Enter turns the page.
  useEffect(() => { document.querySelector<HTMLElement>('.comic [data-autofocus]')?.focus(); }, [shown]);

  const next = () => { if (last) { playCue('start'); onDone(); } else { playCue('select'); setShown(shown + 1); } };

  return (
    <div className="comic" role="dialog" aria-modal="true" aria-label={`Briefing from ${COMMANDER}: ${def.title}`}>
      <header className="comic-head">
        <ReyesPortrait size={64} />
        <div className="comic-titles">
          <div className="kicker">{COMMANDER} · {WORLD_INFO[def.world].label} · Mission {def.id}</div>
          <h1>{def.title}</h1>
        </div>
        <Btn kind="ghost" size="sm" icon="x" onClick={onDone}>{replay ? 'Close' : 'Skip briefing'}</Btn>
      </header>

      <ol className="comic-strip">
        {brief.panels.map((p, i) => (
          <li key={p.kind} className={`comic-panel ${p.kind} ${i === shown ? 'now' : i < shown ? 'seen' : 'later'}`} aria-hidden={i > shown}>
            <span className="comic-num">{i + 1}</span>
            <div className="comic-art">
              {p.kind === 'place' && <WorldArt world={brief.world} size={150} />}
              {p.kind === 'change' && <span className="comic-burst"><Icon name={p.icon ?? 'warning'} size={72} /></span>}
              {p.kind === 'assignment' && <ReyesPortrait size={150} />}
            </div>
            <h2>{p.heading}</h2>
            {i <= shown ? <p className="comic-caption">{p.caption}</p> : <p className="comic-caption muted">…</p>}
          </li>
        ))}
      </ol>

      <footer className="comic-foot">
        <span className="comic-dots" role="img" aria-label={`Panel ${shown + 1} of ${brief.panels.length}`}>
          {brief.panels.map((p, i) => <i key={p.kind} className={i <= shown ? 'on' : ''} />)}
        </span>
        <div className="row">
          {shown > 0 && <Btn kind="ghost" icon="back" onClick={() => setShown(shown - 1)}>Back</Btn>}
          <Btn key={last ? 'go' : 'next'} autoFocus size="lg" icon={last ? 'rocket' : undefined} iconEnd={last ? undefined : 'arrow'} cue="click" onClick={next}>
            {last ? (replay ? 'Done' : 'Take Control') : 'Next'}
          </Btn>
        </div>
        <p className="fine">{last && !replay ? `First: ${brief.firstAction}` : 'Enter or the arrow keys turn the page. Esc skips.'}</p>
      </footer>
    </div>
  );
}

/** Mission Log: every briefing the player has unlocked, to watch again, with Reyes's last debrief line. */
export function MissionLog({ onClose }: { onClose: () => void }) {
  const save = useGame((s) => s.save);
  const judge = useGame((s) => s.mode === 'judge');
  const [watch, setWatch] = useState<DemoMissionId | null>(null);
  const open = PLAYABLE.filter((id) => missionStatus(id, save.completed, judge) !== 'locked');
  if (watch) return <CommanderBriefing missionId={watch} tier={save.settings.tier} replay onDone={() => setWatch(null)} />;
  return (
    <Dialog title="Mission Log" icon="book" kicker={`Briefings from ${COMMANDER}`} onClose={onClose} wide>
      <p className="lead">Watch any briefing again. Missions you have not unlocked yet stay sealed.</p>
      <ul className="log-list">
        {open.map((id) => {
          const def = DEMO_MISSIONS[id];
          const rec = save.completed[id];
          return (
            <li key={id} className="log-row">
              <WorldArt world={def.world} size={56} />
              <div className="log-main">
                <strong>{def.id} · {def.title}</strong>
                <span className="log-note">{rec ? `Last debrief: ${rec.summary}` : 'Not flown yet.'}</span>
                {rec && <Stars value={starsOf(rec)} size={15} />}
              </div>
              <Btn kind="blue" size="sm" icon="play" onClick={() => setWatch(id)}>Briefing</Btn>
            </li>
          );
        })}
      </ul>
      <div className="dialog-actions"><Btn autoFocus icon="check" onClick={onClose}>Done</Btn></div>
    </Dialog>
  );
}
