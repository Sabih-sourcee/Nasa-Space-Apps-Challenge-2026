import { useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import { playCue } from '../game/audio';
import { useHud, type HudState } from '../game/hud';
import { input, type Action } from '../game/input';
import { useGame } from '../game/store';
import { DEMO_MISSIONS, WORLD_INFO } from '../sim/missions';
import { COMMANDER } from '../sim/story';
import { Bar, Btn, Comm, ControlList, Dialog, IconBtn, KeyHint, Keycap, SourceLink, STATUS_WORD, Tile, dialogOpen, withKeys } from './common';
import { Icon, meterIcon } from './icons';

function TouchButton({ action, label, className = '', children }: { action: Action; label: string; className?: string; children?: React.ReactNode }) {
  const down = (e: React.PointerEvent) => {
    e.preventDefault();
    input.setVirtual(action, true);
    // Capture keeps the button held if the finger slides off it. Not every pointer can be captured.
    try { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); } catch { /* ignore */ }
  };
  const up = (e: React.PointerEvent) => { e.preventDefault(); input.setVirtual(action, false); };
  return (
    <button
      type="button" tabIndex={-1} className={`touch-btn ${className}`} aria-label={label}
      onPointerDown={down} onPointerUp={up} onPointerCancel={up} onPointerLeave={up}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children ?? label}
    </button>
  );
}

/** Player choices about how much HUD to show. Kept for the session. */
const useHudPrefs = create<{ buttons: boolean; details: boolean }>(() => ({
  // On-screen buttons start visible on touch devices and hidden where a keyboard is likely.
  buttons: typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(pointer: coarse)').matches,
  details: false,
}));

const plainLabel = (label: string) => label.replace(/\s*\([A-Z]\)$/, '');

/** Labelled on-screen controls for pointer and touch. Every one mirrors a keyboard key. */
export function TouchControls() {
  const layout = useHud((s) => s.touch);
  const labels = useHud((s) => s.touchLabels);
  const show = useHudPrefs((s) => s.buttons);
  if (layout === 'none' || !show) return null;
  return (
    <div className="touch" aria-label="On-screen controls">
      <div className="touch-pad">
        <TouchButton action="up" label="Up" className="up"><Icon name="down" size={26} className="flip" /></TouchButton>
        <TouchButton action="left" label="Left" className="left"><Icon name="back" size={24} /></TouchButton>
        <TouchButton action="right" label="Right" className="right"><Icon name="arrow" size={24} /></TouchButton>
        <TouchButton action="down" label="Down" className="down"><Icon name="down" size={26} /></TouchButton>
      </div>
      <div className="touch-actions">
        {labels.recover && <TouchButton action="recover" label={plainLabel(labels.recover)} className="small" />}
        {labels.brake && <TouchButton action="brake" label={labels.brake} />}
        <TouchButton action="use" label={labels.use} />
        <TouchButton action="primary" label={labels.primary} className="big" />
      </div>
    </div>
  );
}

/** The keys that work right now, for keyboard players. Built from the same labels as the on-screen buttons. */
function KeyLegend({ layout, labels }: { layout: HudState['touch']; labels: HudState['touchLabels'] }) {
  const moveKeys = layout === 'drift' && !labels.move ? ['A', 'D'] : ['W', 'A', 'S', 'D'];
  const move = labels.move ?? (layout === 'walk' ? 'Move' : layout === 'flight' ? 'Steer' : 'Aim');
  const sameKey = labels.use === labels.primary;
  return (
    <div className="hud-keys" aria-label="Controls">
      <KeyHint keys={moveKeys} label={move} />
      {!sameKey && <KeyHint keys={['Space']} label={labels.primary} />}
      {labels.brake && <KeyHint keys={['X']} label={labels.brake} />}
      {(layout !== 'flight' || labels.use !== 'Use') && <KeyHint keys={['E']} label={labels.use} />}
      {labels.recover && <KeyHint keys={['R']} label={plainLabel(labels.recover)} />}
      {layout === 'walk' && <span className="key-hint mouse-hint"><Icon name="hand" size={16} /><span className="key-what">Click the ground to walk</span></span>}
    </div>
  );
}

/** "Press E: Take the pouch" is drawn as a big key and the action. Other prompts get keycaps in place. */
function Prompt({ text }: { text: string }) {
  const m = /^Press ([A-Za-z]+): (.+)$/.exec(text);
  return (
    <div className="hud-prompt">
      {m ? <><Keycap wide={m[1].length > 1}>{m[1]}</Keycap><span>{m[2]}</span></> : <span>{withKeys(text)}</span>}
    </div>
  );
}

interface Intro { kicker: string; title: string; sub: string }

export function Hud() {
  const h = useHud();
  const run = useGame((s) => s.run);
  const setPaused = useGame((s) => s.setPaused);
  const captions = useGame((s) => s.save.settings.captions);
  const audio = useGame((s) => s.save.settings.audio);
  const update = useGame((s) => s.updateSettings);
  const mode = useGame((s) => s.mode);
  const prefs = useHudPrefs();
  const [captionGone, setCaptionGone] = useState(false);
  const [intro, setIntro] = useState<Intro | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const seen = useRef<{ attempt: number; phase: string } | null>(null);

  // A caption stays for a few seconds, then makes room for the tip again.
  useEffect(() => {
    setCaptionGone(false);
    if (!h.caption) return;
    const t = window.setTimeout(() => setCaptionGone(true), 7000);
    return () => window.clearTimeout(t);
  }, [h.caption]);

  // "I" opens and closes the extra details.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyI' || dialogOpen() || useGame.getState().screen !== 'mission') return;
      useHudPrefs.setState((p) => ({ details: !p.details }));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const attempt = run?.attempt;
  const phaseId = run?.phase;
  const introTimer = useRef(0);
  const toastTimer = useRef(0);

  // A title card when a mission (or a checkpoint) starts, and a short note each time a new checkpoint is saved.
  useEffect(() => {
    const r = useGame.getState().run;
    if (!r) return;
    const def = DEMO_MISSIONS[r.missionId];
    const index = def.phases.findIndex((p) => p.id === r.phase);
    const phase = def.phases[index];
    const prev = seen.current;
    seen.current = { attempt: r.attempt, phase: r.phase };
    if (!prev || prev.attempt !== r.attempt) {
      window.clearTimeout(toastTimer.current);
      window.clearTimeout(introTimer.current);
      setToast(null);
      setIntro(r.replayBaseline || r.batteryBaseline
        ? { kicker: 'Mission Replay', title: 'Change one choice', sub: 'Same checkpoint, same events. See what a different plan does.' }
        : index <= 0
          ? { kicker: `${WORLD_INFO[def.world].label} · Mission ${def.id}`, title: def.title, sub: `You are the ${def.duty.toLowerCase()}` }
          : { kicker: `${def.title} · Checkpoint`, title: phase?.checkpoint ?? def.title, sub: phase?.label ?? '' });
      introTimer.current = window.setTimeout(() => setIntro(null), 2800);
      return;
    }
    if (prev.phase !== r.phase && phase && !r.replayBaseline && !r.batteryBaseline) {
      window.clearTimeout(toastTimer.current);
      setToast(phase.checkpoint);
      playCue('checkpoint');
      toastTimer.current = window.setTimeout(() => setToast(null), 3800);
    }
  }, [attempt, phaseId]);

  // Timers are owned by the component, not by one run of the effect above, so a quick phase change cannot strand a card on screen.
  useEffect(() => () => {
    window.clearTimeout(introTimer.current);
    window.clearTimeout(toastTimer.current);
    seen.current = null;
  }, []);

  if (!run) return null;
  const def = DEMO_MISSIONS[run.missionId];
  const phaseIndex = def.phases.findIndex((p) => p.id === run.phase);
  const phase = def.phases[phaseIndex];
  // Readouts that need attention are always shown. The rest wait behind the info button.
  const urgent = h.readouts.filter((r) => r.status === 'caution' || r.status === 'low');
  const readouts = prefs.details ? h.readouts : urgent;
  const warningText = h.warning ? `${h.warning.title}. ${h.warning.text}` : null;
  const caption = captions && h.caption && !captionGone && h.caption !== warningText ? h.caption : null;
  const tags = [run.replayBaseline || run.batteryBaseline ? 'Replay' : null, mode === 'judge' ? 'Judge Mode' : null].filter((t): t is string => !!t);
  const objective = h.objective || phase?.objective || '';
  const showButtons = prefs.buttons && h.touch !== 'none';

  return (
    <div className="hud">
      <div className="hud-top">
        <div className="hud-left">
          <section className="hud-objective">
            <span className="obj-icon"><Icon name="target" size={26} /></span>
            <div className="obj-main">
              <div className="obj-top">
                {def.phases.length > 1 && (
                  <span className="obj-pips" role="img" aria-label={`Step ${phaseIndex + 1} of ${def.phases.length}`}>
                    {def.phases.map((p, i) => <i key={p.id} className={i < phaseIndex ? 'done' : i === phaseIndex ? 'now' : ''} />)}
                  </span>
                )}
                <span className="obj-phase">{phase?.label}</span>
                {tags.map((t) => <span key={t} className="hud-chip">{t}</span>)}
                {toast && <span className="obj-toast" role="status"><Icon name="flag" size={14} /> Checkpoint saved: {toast}</span>}
              </div>
              <div className="obj-text" key={objective} aria-live="polite">{objective}</div>
            </div>
            {h.distance != null && <span className="obj-distance" aria-label={`${Math.round(h.distance)} metres away`}><Icon name="arrow" size={16} />{Math.round(h.distance)} m</span>}
          </section>

          {/* Alerts sit directly under the objective, so the two can never cover each other. */}
          {h.warning && (
            <div className={`hud-warning ${h.warning.level}`} role="alert">
              <span className="warn-icon"><Icon name={h.warning.level === 'info' ? 'info' : 'warning'} size={26} /></span>
              <div>
                <div className="warn-title">{h.warning.title}</div>
                <div className="warn-text">{h.warning.text}</div>
                {h.warning.sourceId && <div className="warn-source"><SourceLink id={h.warning.sourceId} short /></div>}
              </div>
            </div>
          )}
        </div>

        <section className="hud-right">
          {/* After a mouse or touch press the button gives focus back, so Space and E keep driving the game. */}
          <div className="hud-buttons" onClick={(e) => { if (e.detail > 0) (document.activeElement as HTMLElement | null)?.blur(); }}>
            <IconBtn icon={audio ? 'sound' : 'mute'} label={audio ? 'Sound on. Press to mute' : 'Sound off. Press to turn on'} pressed={audio} onClick={() => update({ audio: !audio })} />
            {h.touch !== 'none' && (
              <IconBtn icon="gamepad" label={prefs.buttons ? 'Hide the on-screen buttons' : 'Show on-screen buttons'} pressed={prefs.buttons} onClick={() => useHudPrefs.setState({ buttons: !prefs.buttons })} />
            )}
            {h.readouts.length > 0 && (
              <IconBtn icon="info" label={prefs.details ? 'Less info (I)' : 'More info (I)'} pressed={prefs.details} onClick={() => useHudPrefs.setState({ details: !prefs.details })} />
            )}
            <IconBtn icon="pause" label="Pause (Esc)" kind="gold" onClick={() => setPaused(true)} />
          </div>
          {h.meters.length > 0 && (
            <div className="gauges">
              {h.meters.map((m) => (
                <div key={m.id} className={`gauge ${m.status}`}>
                  <span className="gauge-icon"><Icon name={meterIcon(m.id)} size={20} /></span>
                  <div className="gauge-main">
                    <div className="gauge-head">
                      <span className="gauge-label">{m.label}</span>
                      {m.status !== 'ok' && <span className="gauge-flag">{STATUS_WORD[m.status]}</span>}
                      <span className="gauge-value">{m.text}</span>
                    </div>
                    <Bar value={m.value} max={m.max} status={m.status} />
                    {m.note && (m.status !== 'ok' || prefs.details) && <div className="gauge-note">{m.note}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
          {(readouts.length > 0 || (prefs.details && h.labels.length > 0)) && (
            <div className="readouts">
              {readouts.map((r) => (
                <div key={r.label} className={`readout ${r.status ?? 'ok'}`}>
                  <span className="readout-label">{r.label}</span>
                  <span className="readout-value">{r.value}</span>
                  {r.note && <span className="readout-note">{r.note}</span>}
                </div>
              ))}
              {prefs.details && h.labels.length > 0 && <div className="hud-labels">{h.labels.join(' · ')}</div>}
            </div>
          )}
        </section>
      </div>

      {h.crosshair &&<div className="crosshair" aria-hidden="true"><span /><span /></div>}

      {intro && (
        <div className="hud-intro" aria-hidden="true">
          <div className="intro-kicker">{intro.kicker}</div>
          <div className="intro-title">{intro.title}</div>
          {intro.sub && <div className="intro-sub">{intro.sub}</div>}
        </div>
      )}

      {/* One helper line at a time: a fresh caption first, otherwise the tip. */}
      <div className={`hud-bottom ${showButtons ? 'with-buttons' : ''}`}>
        {h.prompt && <Prompt key={h.prompt} text={h.prompt} />}
        {caption
          ? <Comm name={COMMANDER} live="assertive">{withKeys(caption)}</Comm>
          : h.hint && <Comm name="Tip" tone="tip">{withKeys(h.hint)}</Comm>}
      </div>

      {!showButtons && h.touch !== 'none' && <KeyLegend layout={h.touch} labels={h.touchLabels} />}
    </div>
  );
}

export function PauseMenu() {
  const paused = useGame((s) => s.paused);
  const setPaused = useGame((s) => s.setPaused);
  const run = useGame((s) => s.run);
  const restartCp = useGame((s) => s.restartFromCheckpoint);
  const restart = useGame((s) => s.restartMission);
  const quit = useGame((s) => s.quitToAtlas);
  const openSettings = useGame((s) => s.openSettings);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' && e.code !== 'KeyP') return;
      if (useGame.getState().screen !== 'mission') return;
      if (dialogOpen()) return;
      e.preventDefault();
      useGame.getState().setPaused(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!paused || !run) return null;
  const def = DEMO_MISSIONS[run.missionId];
  const phase = def.phases.find((p) => p.id === run.phase);
  return (
    <Dialog title="Paused" icon="pause" kicker={`${def.title} · ${phase?.label ?? ''}`} onClose={() => setPaused(false)}>
      <Btn autoFocus size="lg" block icon="play" onClick={() => setPaused(false)}>Resume</Btn>
      <div className="tile-grid">
        <Tile icon="flag" label="Restart checkpoint" note={phase?.checkpoint} onClick={() => { setPaused(false); restartCp(); }} />
        {!run.replayBaseline && !run.batteryBaseline && <Tile icon="replay" label="Restart mission" note="From the beginning" onClick={() => { setPaused(false); restart(); }} />}
        <Tile icon="gear" label="Settings" note="Sound, tips, comfort" onClick={() => openSettings(true)} />
        <Tile icon="map" label="Mission map" note="Checkpoint is saved" onClick={quit} />
      </div>
      <h3 className="mini-head"><Icon name="keyboard" size={16} /> Controls</h3>
      <ControlList controls={def.controls} />
      <p className="fine">{def.labels.join(' · ')}</p>
    </Dialog>
  );
}

/** Card shown when a flight attempt ends early. Explains the cause and offers the checkpoint. */
export function ResetCard({ title, reason, tip, onRetry, retryLabel = 'Try again from the checkpoint' }: { title: string; reason: string; tip: string; onRetry: () => void; retryLabel?: string }) {
  return (
    <Dialog title={title} tone="alert" icon="replay" kicker="Let's try that again">
      <p className="reset-reason"><strong>What happened:</strong> {reason}</p>
      <Comm name="Try this" tone="tip">{withKeys(tip)}</Comm>
      <Btn autoFocus size="lg" block icon="replay" onClick={onRetry}>{retryLabel}</Btn>
      <p className="fine center">Training resets are part of practice. Nothing is lost.</p>
    </Dialog>
  );
}
