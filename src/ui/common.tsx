import { useEffect, useRef, type ReactNode } from 'react';
import { playCue } from '../game/audio';
import { input } from '../game/input';
import { useGame } from '../game/store';
import { sourceById } from '../sim/sources';
import { TIERS, TIER_LABEL, type Tier } from '../sim/types';

let openDialogs = 0;

/** Modal panel. Game input is suspended while it is open so Tab, Enter and Space work as usual. */
export function Dialog({ title, children, onClose, wide = false, tone = 'normal', labelledBy }: {
  title: string; children: ReactNode; onClose?: () => void; wide?: boolean; tone?: 'normal' | 'alert' | 'good'; labelledBy?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    openDialogs += 1;
    input.setSuspended(true);
    const node = ref.current;
    const focusable = node?.querySelector<HTMLElement>('[data-autofocus], button:not([disabled]), input:not([disabled])');
    (focusable ?? node)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeRef.current) { e.stopPropagation(); closeRef.current(); }
      if (e.key === 'Tab' && node) {
        // Keep focus inside the panel.
        const items = Array.from(node.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), a[href], select'));
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      openDialogs = Math.max(0, openDialogs - 1);
      if (openDialogs === 0) input.setSuspended(false);
    };
  }, []);

  const id = labelledBy ?? 'dialog-title';
  return (
    <div className="dialog-backdrop">
      <div ref={ref} className={`dialog ${wide ? 'wide' : ''} tone-${tone}`} role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1}>
        <h2 id={id}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function dialogOpen(): boolean {
  return openDialogs > 0;
}

export function Btn({ children, onClick, kind = 'primary', disabled, autoFocus, title }: {
  children: ReactNode; onClick: () => void; kind?: 'primary' | 'ghost' | 'danger'; disabled?: boolean; autoFocus?: boolean; title?: string;
}) {
  return (
    <button
      type="button" className={`btn ${kind}`} disabled={disabled} title={title}
      {...(autoFocus ? { 'data-autofocus': true } : {})}
      onClick={() => { playCue('click'); onClick(); }}
    >
      {children}
    </button>
  );
}

export function SourceLink({ id, short = false }: { id: string; short?: boolean }) {
  const s = sourceById(id);
  if (!s) return null;
  const kind = s.kind === 'archived-record' ? 'Archived NASA record' : s.kind === 'challenge' ? 'Challenge brief' : 'NASA reference';
  return (
    <span className="source">
      <span className="source-kind">{kind}</span>{' '}
      <a href={s.url} target="_blank" rel="noreferrer noopener">{short ? s.org : `${s.org}: ${s.title}`}</a>
    </span>
  );
}

export function TierPicker({ compact = false }: { compact?: boolean }) {
  const tier = useGame((s) => s.save.settings.tier);
  const update = useGame((s) => s.updateSettings);
  const blurb: Record<Tier, string> = {
    junior: 'One step at a time, hints on, two meters.',
    middle: 'Fewer hints. Choices change later checkpoints.',
    advanced: 'Several problems at once. Delayed replies from Earth.',
  };
  return (
    <fieldset className={`tiers ${compact ? 'compact' : ''}`}>
      <legend>Difficulty</legend>
      {TIERS.map((t) => (
        <label key={t} className={tier === t ? 'on' : ''}>
          <input type="radio" name="tier" value={t} checked={tier === t} onChange={() => update({ tier: t })} />
          <span className="tier-name">{TIER_LABEL[t]}</span>
          {!compact && <span className="tier-blurb">{blurb[t]}</span>}
        </label>
      ))}
    </fieldset>
  );
}

export function Bar({ value, max, status }: { value: number; max: number; status: 'ok' | 'caution' | 'low' }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <span className={`bar ${status}`} aria-hidden="true">
      <span style={{ width: `${pct}%` }} />
    </span>
  );
}

export const STATUS_WORD = { ok: 'OK', caution: 'CAUTION', low: 'LOW' } as const;
