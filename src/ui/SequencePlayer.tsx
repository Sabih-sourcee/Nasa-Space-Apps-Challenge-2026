import { useCallback, useEffect, useRef, useState } from 'react';
import { playCue, speak } from '../game/audio';
import { input } from '../game/input';
import { useGame } from '../game/store';
import { SequenceDriver, SequenceScene, sequenceFamily } from '../missions/SequenceScenes';
import { SEQUENCES, shotStart, type SequenceId } from '../sim/sequences';
import { GameCanvas } from '../three/GameCanvas';
import { Icon } from './icons';

const SKY = { pad: '#cfe2f3', space: '#02030a', moon: '#000003', mars: '#d9ad85' };

/**
 * Plays one film. It only shows things: nothing in the save or the mission
 * changes, so Skip, the end of the film and a reload all lead to the same
 * place. Game keys are switched off while it plays.
 *
 * The picture is left clear. Captions are off until the viewer turns them on
 * with the CC button (or C), and the narration is read aloud when speech is
 * switched on in Settings.
 */
export function SequencePlayer({ id, onDone, replay = false }: { id: SequenceId; onDone: () => void; replay?: boolean }) {
  const def = SEQUENCES[id];
  const reduced = useGame((s) => s.save.settings.reducedMotion);
  const speech = useGame((s) => s.save.settings.speech);
  const clock = useRef(0);
  const [shot, setShot] = useState(0);
  const [cc, setCc] = useState(false);
  const ended = useRef(false);

  const finish = useCallback(() => {
    if (ended.current) return;
    ended.current = true;
    onDone();
  }, [onDone]);

  /** Jump to the start of a shot. */
  const jump = useCallback((i: number) => {
    if (i >= def.shots.length) { finish(); return; }
    clock.current = shotStart(def, i) + 0.001;
    setShot(i);
  }, [def, finish]);

  useEffect(() => {
    input.setSuspended(true);
    playCue('start');
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') { e.preventDefault(); finish(); }
      else if (e.code === 'KeyC') setCc((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); input.setSuspended(false); };
  }, [finish]);

  const s = def.shots[shot];
  useEffect(() => { if (speech) speak(s.caption); }, [speech, s.caption]);

  return (
    <div className="sequence" data-sequence={id} data-shot={s.id}>
      <GameCanvas fov={50} far={6000} envIntensity={0.4} background={SKY[sequenceFamily(id)]}>
        <SequenceScene def={def} clock={clock} still={reduced} />
        <SequenceDriver def={def} clock={clock} onShot={(i) => { setShot(i); playCue('select'); }} onDone={finish} />
      </GameCanvas>

      <div className="seq-top">
        <span className="seq-kicker"><Icon name={def.urgent ? 'warning' : 'rocket'} size={13} /> {def.urgent ? 'Alert' : def.when === 'after' ? 'Mission complete' : 'Journey'}{replay ? ' · replay' : ''}</span>
        <strong>{def.title}</strong>
      </div>

      <div className="seq-tools">
        <button type="button" className={`seq-btn ${cc ? 'on' : ''}`} aria-pressed={cc} title="Captions (C)" onClick={(e) => { setCc(!cc); e.currentTarget.blur(); }}>CC</button>
        <button type="button" className="seq-btn" title="Next shot" aria-label="Next shot" onClick={(e) => { jump(shot + 1); e.currentTarget.blur(); }}><Icon name="arrow" size={16} /></button>
        <button type="button" className="seq-btn wide" title="Skip the film (Esc)" onClick={finish}>Skip <kbd className="key wide">Esc</kbd></button>
      </div>

      {cc && (
        <div className="seq-caption" aria-live="polite">
          <span className="seq-speaker">{s.speaker}</span>
          <p>{s.caption}</p>
        </div>
      )}
      <span className="seq-dots" role="img" aria-label={`Shot ${shot + 1} of ${def.shots.length}`}>
        {def.shots.map((x, i) => <i key={x.id} className={i <= shot ? 'on' : ''} />)}
      </span>
    </div>
  );
}
