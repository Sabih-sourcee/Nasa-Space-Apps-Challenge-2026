import { useCallback, useRef, useState, type ReactNode } from 'react';
import { playCue } from '../game/audio';
import { useGame } from '../game/store';
import { GravityLabScene, type LabCmd } from '../missions/GravityLabScene';
import { CADET_MASS, DROP_HEIGHT, EARTH_G, EARTH_PRESSURE, LAB_WORLD, LAB_WORLDS, fallTime, jumpHeight, scaleReading, type LabEvent, type LabWorldId } from '../sim/gravityLab';
import { GameCanvas } from '../three/GameCanvas';
import { Bar, IconBtn, Keycap, SourceLink } from './common';
import { Icon } from './icons';

const fix = (n: number, d = 1) => n.toFixed(d);

/** A game button that gives focus back after a click, so Space and E keep working as game keys. */
function LabBtn({ kind, icon, onPress, children }: { kind: 'primary' | 'blue'; icon: string; onPress: () => void; children: ReactNode }) {
  return (
    <button type="button" className={`btn ${kind} size-lg`} onClick={(e) => { playCue('click'); onPress(); e.currentTarget.blur(); }}>
      <Icon name={icon} size={24} />
      <span className="btn-label">{children}</span>
    </button>
  );
}

/** What the last jump and drop measured, kept per world so they can be compared. */
type Results = Partial<Record<LabWorldId, { jump?: string; drop?: string }>>;

export function GravityLab() {
  const go = useGame((s) => s.go);
  const [world, setWorld] = useState<LabWorldId>('earth');
  const [results, setResults] = useState<Results>({});
  const cmd = useRef<LabCmd>({ jump: false, drop: false });
  const w = LAB_WORLD[world];

  const pick = useCallback((id: LabWorldId) => { playCue('click'); setWorld(id); }, []);
  const onEvent = useCallback((e: LabEvent, id: LabWorldId) => {
    const text = e.kind === 'jump'
      ? (e.height === null ? 'Kept drifting' : `${fix(e.height, 2)} m in ${fix(e.air, 1)} s`)
      : (e.time === null ? 'Did not fall' : `${fix(e.time, 2)} s`);
    setResults((r) => ({ ...r, [id]: { ...r[id], [e.kind]: text } }));
  }, []);

  const jump = jumpHeight(w);
  const fall = fallTime(w);
  const scale = scaleReading(w);
  const mine = results[world] ?? {};
  const tried = LAB_WORLDS.filter((x) => results[x.id]?.jump || results[x.id]?.drop);

  return (
    <div className="mission gravity-lab">
      <GameCanvas fov={44} envIntensity={0.5} background="#03050b">
        <GravityLabScene world={world} cmd={cmd} onPick={pick} onEvent={onEvent} />
      </GameCanvas>

      <div className="hud">
        <div className="hud-top">
          <div className="lab-col">
            <section className="hud-objective">
              <span className="obj-icon"><Icon name="flask" size={26} /></span>
              <div className="obj-main">
                <div className="obj-top"><span className="obj-phase">Gravity test chamber</span></div>
                <div className="lab-title">{w.name}</div>
                <div className="lab-tag">{w.tagline}</div>
              </div>
            </section>
            <section className="lab-card">
              <h3><Icon name="helmet" size={16} /> What happens to your body</h3>
              <ul>{w.body.map((b) => <li key={b}>{b}</li>)}</ul>
              <p className="lab-suit"><strong>You would need:</strong> {w.suit}</p>
              <p className="lab-source"><SourceLink id={w.sourceId} short /></p>
            </section>
          </div>

          <div className="lab-col right">
            <div className="lab-tools">
              <IconBtn icon="back" label="Back to the title screen" onClick={() => go('home')} />
            </div>
            <section className="lab-card">
              <div className="readout"><span className="readout-label">Gravity</span><span className="readout-value">{w.g === 0 ? 'You float' : `${fix(w.g, w.g < 10 ? 2 : 1)} m/s²`}</span></div>
              <Bar value={Math.min(w.g, 25)} max={25} status={w.g > 12 ? 'low' : 'ok'} />
              <div className="lab-note">{w.g === 0 ? 'Earth still pulls up here. You float because the station is falling round it.' : `${fix(w.g / EARTH_G, 2)} times Earth`}</div>

              <div className="readout"><span className="readout-label">Scale reads</span><span className="readout-value">{fix(scale, 1)} kg</span></div>
              <div className="lab-note">A {CADET_MASS} kg cadet. Your mass never changes, only your weight.</div>

              <div className="readout"><span className="readout-label">One jump</span><span className="readout-value">{jump === null ? 'No coming down' : `${fix(jump, 2)} m`}</span></div>
              <div className="readout"><span className="readout-label">Ball falls {DROP_HEIGHT} m in</span><span className="readout-value">{fall === null ? 'It does not fall' : `${fix(fall, 2)} s`}</span></div>

              <div className="readout"><span className="readout-label">Air pressure</span><span className="readout-value">{w.pressureKPa === null ? 'No ground' : `${w.pressureKPa < 10 ? fix(w.pressureKPa, 1) : Math.round(w.pressureKPa)} kPa`}</span></div>
              <Bar value={w.pressureKPa ?? EARTH_PRESSURE} max={EARTH_PRESSURE} status={w.pressureKPa === null ? 'low' : w.pressureKPa < 50 ? 'caution' : 'ok'} />
              <div className="lab-note">{w.pressureText}</div>
            </section>
            {(mine.jump || mine.drop || tried.length > 1) && (
              <section className="lab-card lab-results">
                <h3><Icon name="gauge" size={16} /> Your tests</h3>
                {tried.map((x) => (
                  <div key={x.id} className={`lab-row ${x.id === world ? 'now' : ''}`}>
                    <span>{x.name}</span>
                    <span>{results[x.id]?.jump ? `Jump ${results[x.id]?.jump}` : ''}{results[x.id]?.jump && results[x.id]?.drop ? ' · ' : ''}{results[x.id]?.drop ? `Ball ${results[x.id]?.drop}` : ''}</span>
                  </div>
                ))}
              </section>
            )}
          </div>
        </div>

        <div className="lab-bottom">
          <div className="lab-worlds" role="group" aria-label="Pick a world">
            {LAB_WORLDS.map((x) => (
              <button key={x.id} type="button" className={`lab-world ${x.id === world ? 'on' : ''}`} aria-pressed={x.id === world} onClick={(e) => { pick(x.id); e.currentTarget.blur(); }}>
                <span className="lab-dot" style={{ background: x.ground }} />{x.name}
              </button>
            ))}
          </div>
          <div className="lab-actions">
            <LabBtn kind="primary" icon="arrow" onPress={() => { cmd.current.jump = true; }}>{w.g === 0 ? 'Push off' : 'Jump'} <Keycap>Space</Keycap></LabBtn>
            <LabBtn kind="blue" icon="down" onPress={() => { cmd.current.drop = true; }}>Drop the ball <Keycap>E</Keycap></LabBtn>
          </div>
          <p className="lab-hint"><Icon name="hand" size={14} /> Click a planet, or pick one here. Try the same jump on each and compare.</p>
        </div>
      </div>
    </div>
  );
}
