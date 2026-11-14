import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { useHud } from '../game/hud';
import { input, type Action } from '../game/input';
import { useGame } from '../game/store';
import { DEMO_MISSIONS } from '../sim/missions';
import { Bar, Btn, Dialog, SourceLink, STATUS_WORD, dialogOpen } from './common';

function TouchButton({ action, label, className = '' }: { action: Action; label: string; className?: string }) {
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
      {label}
    </button>
  );
}

/** Player choices about how much HUD to show. Kept for the session. */
const useHudPrefs = create<{ buttons: boolean; details: boolean }>(() => ({
  // On-screen buttons start visible on touch devices and hidden where a keyboard is likely.
  buttons: typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(pointer: coarse)').matches,
  details: false,
}));

/** Labelled on-screen controls for pointer and touch. Every one mirrors a keyboard key. */
export function TouchControls() {
  const layout = useHud((s) => s.touch);
  const labels = useHud((s) => s.touchLabels);
  const show = useHudPrefs((s) => s.buttons);
  if (layout === 'none' || !show) return null;
  return (
    <div className="touch" aria-label="On-screen controls">
      <div className="touch-pad">
        <TouchButton action="up" label="▲" className="up" />
        <TouchButton action="left" label="◀" className="left" />
        <TouchButton action="right" label="▶" className="right" />
        <TouchButton action="down" label="▼" className="down" />
      </div>
      <div className="touch-actions">
        {labels.recover && <TouchButton action="recover" label={labels.recover} className="small" />}
        {labels.brake && <TouchButton action="brake" label={labels.brake} />}
        <TouchButton action="use" label={labels.use} />
        <TouchButton action="primary" label={labels.primary} className="big" />
      </div>
    </div>
  );
}

export function Hud() {
  const h = useHud();
  const run = useGame((s) => s.run);
  const setPaused = useGame((s) => s.setPaused);
  const captions = useGame((s) => s.save.settings.captions);
  const mode = useGame((s) => s.mode);
  const prefs = useHudPrefs();
  const [captionGone, setCaptionGone] = useState(false);

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

  if (!run) return null;
  const def = DEMO_MISSIONS[run.missionId];
  const phase = def.phases.find((p) => p.id === run.phase);
  // Readouts that need attention are always shown. The rest wait behind "More info".
  const urgent = h.readouts.filter((r) => r.status === 'caution' || r.status === 'low');
  const readouts = prefs.details ? h.readouts : urgent;
  const warningText = h.warning ? `${h.warning.title}. ${h.warning.text}` : null;
  const caption = captions && h.caption && !captionGone && h.caption !== warningText ? h.caption : null;
  const tags = [run.replayBaseline ? 'Replay' : null, mode === 'judge' ? 'Judge Mode' : null].filter((t): t is string => !!t);
  return (
    <div className="hud">
      <div className="hud-top">
        <section className="hud-card objective" aria-live="polite">
          <div className="hud-phase">
            {phase?.label}
            {tags.map((t) => <span key={t} className="hud-chip">{t}</span>)}
          </div>
          <div className="hud-objective">
            {h.objective || phase?.objective}
            {h.distance != null && <span className="hud-distance"> · {Math.round(h.distance)} m</span>}
          </div>
        </section>

        <section className="hud-right">
          <div className="hud-buttons">
            {h.touch !== 'none' && (
              <button type="button" className="pause-btn" aria-pressed={prefs.buttons} onClick={() => useHudPrefs.setState({ buttons: !prefs.buttons })}>
                {prefs.buttons ? 'Hide buttons' : 'Show buttons'}
              </button>
            )}
            {h.readouts.length > 0 && (
              <button type="button" className="pause-btn" aria-pressed={prefs.details} title="More info (I)" onClick={() => useHudPrefs.setState({ details: !prefs.details })}>
                {prefs.details ? 'Less info' : 'More info'}
              </button>
            )}
            <button type="button" className="pause-btn" onClick={() => setPaused(true)} aria-label="Pause (Escape)">❚❚ Pause</button>
          </div>
          {h.meters.length > 0 && (
            <div className="hud-card meters">
              {h.meters.map((m) => (
                <div key={m.id} className={`meter ${m.status}`}>
                  <div className="meter-head">
                    <span className="meter-label">{m.label}</span>
                    <span className="meter-value">{m.text}</span>
                    {m.status !== 'ok' && <span className="meter-status">{STATUS_WORD[m.status]}</span>}
                  </div>
                  <Bar value={m.value} max={m.max} status={m.status} />
                  {m.note && (m.status !== 'ok' || prefs.details) && <div className="meter-note">{m.note}</div>}
                </div>
              ))}
            </div>
          )}
          {(readouts.length > 0 || prefs.details) && (
            <div className="hud-card readouts">
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

      {h.warning && (
        <div className={`hud-warning ${h.warning.level}`} role="alert">
          <span className="warn-icon" aria-hidden="true">{h.warning.level === 'info' ? 'i' : '!'}</span>
          <div>
            <div className="warn-title">{h.warning.title}</div>
            <div className="warn-text">{h.warning.text}</div>
            {h.warning.sourceId && <div className="warn-source"><SourceLink id={h.warning.sourceId} short /></div>}
          </div>
        </div>
      )}

      {h.crosshair && <div className="crosshair" aria-hidden="true"><span /><span /></div>}

      {/* One helper line at a time: a fresh caption first, otherwise the tip. */}
      <div className={`hud-bottom ${prefs.buttons && h.touch !== 'none' ? 'with-buttons' : ''}`}>
        {h.prompt && <div className="hud-prompt">{h.prompt}</div>}
        {caption
          ? <div className="hud-caption" aria-live="assertive">{caption}</div>
          : h.hint && <div className="hud-hint"><span className="hud-tag">Tip</span> {h.hint}</div>}
      </div>
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
    <Dialog title="Paused" onClose={() => setPaused(false)}>
      <p className="muted">{def.title} · {phase?.label}. Last checkpoint: <strong>{phase?.checkpoint}</strong>.</p>
      <div className="stack">
        <Btn autoFocus onClick={() => setPaused(false)}>Resume</Btn>
        <Btn kind="ghost" onClick={() => { setPaused(false); restartCp(); }}>Restart from checkpoint</Btn>
        {!run.replayBaseline && <Btn kind="ghost" onClick={() => { setPaused(false); restart(); }}>Restart mission</Btn>}
        <Btn kind="ghost" onClick={() => openSettings(true)}>Settings</Btn>
        <Btn kind="ghost" onClick={quit}>Return to Mission Atlas</Btn>
      </div>
      <details className="more">
        <summary>Controls</summary>
        <ul className="controls-list">{def.controls.map((c) => <li key={c}>{c}</li>)}</ul>
        <p className="labels">{def.labels.join(' · ')}</p>
      </details>
      <p className="fine">Your checkpoint is saved.</p>
    </Dialog>
  );
}

/** Card shown when a flight attempt ends early. Explains the cause and offers the checkpoint. */
export function ResetCard({ title, reason, tip, onRetry, retryLabel = 'Try again from the checkpoint' }: { title: string; reason: string; tip: string; onRetry: () => void; retryLabel?: string }) {
  return (
    <Dialog title={title} tone="alert">
      <p><strong>What happened:</strong> {reason}</p>
      <p><strong>Try this:</strong> {tip}</p>
      <div className="stack"><Btn autoFocus onClick={onRetry}>{retryLabel}</Btn></div>
      <p className="fine">Training resets are part of practice. Nothing is lost.</p>
    </Dialog>
  );
}
