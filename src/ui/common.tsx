import { useEffect, useRef, type ReactNode } from 'react';
import { playCue, type Cue } from '../game/audio';
import { input } from '../game/input';
import { useGame } from '../game/store';
import { sourceById } from '../sim/sources';
import { TIERS, TIER_LABEL, type Tier } from '../sim/types';
import { Icon } from './icons';

let openDialogs = 0;

/** Modal panel. Game input is suspended while it is open so Tab, Enter and Space work as usual. */
export function Dialog({ title, children, onClose, wide = false, tone = 'normal', labelledBy, icon, kicker }: {
  title: string; children: ReactNode; onClose?: () => void; wide?: boolean; tone?: 'normal' | 'alert' | 'good';
  labelledBy?: string; icon?: string; kicker?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    openDialogs += 1;
    input.setSuspended(true);
    const node = ref.current;
    const focusable = node?.querySelector<HTMLElement>('[data-autofocus]')
      ?? node?.querySelector<HTMLElement>('.dialog-body button:not([disabled]), .dialog-body input:not([disabled])');
    (focusable ?? node)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeRef.current) { e.stopPropagation(); closeRef.current(); }
      if (e.key === 'Tab' && node) {
        // Keep focus inside the panel.
        const items = Array.from(node.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), a[href], select, summary'));
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
  const mark = icon ?? (tone === 'alert' ? 'warning' : tone === 'good' ? 'check' : null);
  return (
    <div className="dialog-backdrop">
      <div ref={ref} className={`dialog ${wide ? 'wide' : ''} tone-${tone}`} role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1}>
        <header className="dialog-head">
          {mark && <span className="dialog-icon"><Icon name={mark} size={24} /></span>}
          <div className="dialog-titles">
            {kicker && <div className="kicker">{kicker}</div>}
            <h2 id={id}>{title}</h2>
          </div>
          {onClose && (
            <button type="button" className="icon-btn small dialog-close" aria-label="Close" title="Close (Esc)" onClick={() => { playCue('click'); onClose(); }}>
              <Icon name="x" size={18} />
            </button>
          )}
        </header>
        <div className="dialog-body">{children}</div>
      </div>
    </div>
  );
}

export function dialogOpen(): boolean {
  return openDialogs > 0;
}

export type BtnKind = 'primary' | 'blue' | 'ghost' | 'danger' | 'good';

/** The one button style used everywhere: chunky, with an edge that presses down. */
export function Btn({ children, onClick, kind = 'primary', disabled, autoFocus, title, icon, iconEnd, size = 'md', block = false, cue = 'click' }: {
  children: ReactNode; onClick: () => void; kind?: BtnKind; disabled?: boolean; autoFocus?: boolean; title?: string;
  icon?: string; iconEnd?: string; size?: 'sm' | 'md' | 'lg' | 'xl'; block?: boolean; cue?: Cue;
}) {
  const px = size === 'xl' ? 30 : size === 'lg' ? 24 : size === 'sm' ? 16 : 20;
  return (
    <button
      type="button" className={`btn ${kind} size-${size} ${block ? 'block' : ''}`} disabled={disabled} title={title}
      {...(autoFocus ? { 'data-autofocus': true } : {})}
      onClick={() => { playCue(cue); onClick(); }}
    >
      {icon && <Icon name={icon} size={px} />}
      <span className="btn-label">{children}</span>
      {iconEnd && <Icon name={iconEnd} size={px} />}
    </button>
  );
}

/** Round button that shows only an icon. The label is read by screen readers and shown as a tooltip. */
export function IconBtn({ icon, label, onClick, pressed, size = 'md', autoFocus, kind = '' }: {
  icon: string; label: string; onClick: () => void; pressed?: boolean; size?: 'small' | 'md' | 'large'; autoFocus?: boolean; kind?: string;
}) {
  return (
    <button
      type="button" className={`icon-btn ${size} ${kind}`} aria-label={label} title={label}
      {...(pressed === undefined ? {} : { 'aria-pressed': pressed })}
      {...(autoFocus ? { 'data-autofocus': true } : {})}
      onClick={() => { playCue('click'); onClick(); }}
    >
      <Icon name={icon} size={size === 'large' ? 26 : size === 'small' ? 18 : 22} />
    </button>
  );
}

/** A keyboard key. */
export function Keycap({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return <kbd className={`key ${wide ? 'wide' : ''}`}>{children}</kbd>;
}

const KEY_WORDS = /\b(W A S D|A and D|W and S|Space|Enter|Esc|Tab|[EXR])\b/g;

/** Turn key names inside a sentence into keycaps: "press E" becomes "press [E]". */
export function withKeys(text: string): ReactNode {
  const out: ReactNode[] = [];
  let last = 0;
  let n = 0;
  for (const m of text.matchAll(KEY_WORDS)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    const word = m[0];
    if (word === 'W A S D') out.push(<span key={n++} className="key-group">{['W', 'A', 'S', 'D'].map((k) => <Keycap key={k}>{k}</Keycap>)}</span>);
    else if (word.includes(' and ')) {
      const [a, b] = word.split(' and ');
      out.push(<Keycap key={n++}>{a}</Keycap>, ' and ', <Keycap key={n++}>{b}</Keycap>);
    } else out.push(<Keycap key={n++} wide={word.length > 1}>{word}</Keycap>);
    last = at + word.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Mission controls as a list: what you do on the left, the keys on the right. */
export function ControlList({ controls }: { controls: string[] }) {
  return (
    <ul className="control-list">
      {controls.map((c) => {
        const cut = c.indexOf(':');
        return (
          <li key={c}>
            <span className="control-what">{cut < 0 ? c : c.slice(0, cut)}</span>
            {cut >= 0 && <span className="control-keys">{withKeys(c.slice(cut + 1).trim())}</span>}
          </li>
        );
      })}
    </ul>
  );
}

/** Large square button with an icon, a title and an optional note. */
export function Tile({ icon, label, note, onClick, autoFocus, disabled }: { icon: string; label: string; note?: string; onClick: () => void; autoFocus?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button" className="tile" disabled={disabled}
      {...(autoFocus ? { 'data-autofocus': true } : {})}
      onClick={() => { playCue('click'); onClick(); }}
    >
      <span className="tile-icon"><Icon name={icon} size={26} /></span>
      <span className="tile-label">{label}</span>
      {note && <span className="tile-note">{note}</span>}
    </button>
  );
}

/** A row of keys followed by what they do. */
export function KeyHint({ keys, label }: { keys: string[]; label: string }) {
  return (
    <span className="key-hint">
      <span className="key-group">{keys.map((k) => <Keycap key={k} wide={k.length > 1}>{k}</Keycap>)}</span>
      <span className="key-what">{label}</span>
    </span>
  );
}

/** Star rating. `pop` plays the earn animation, one star after another. */
export function Stars({ value, max = 3, size = 22, pop = false, label = true }: { value: number; max?: number; size?: number; pop?: boolean; label?: boolean }) {
  return (
    <span className={`stars ${pop ? 'pop' : ''}`} {...(label ? { role: 'img', 'aria-label': `${value} of ${max} stars` } : { 'aria-hidden': true })}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={`star ${i < value ? 'on' : 'off'}`} style={pop ? { animationDelay: `${0.35 + i * 0.38}s` } : undefined}>
          <Icon name="star" size={size} />
        </span>
      ))}
    </span>
  );
}

/** A message from Mission Control: the voice the game uses for tips and explanations. */
export function Comm({ children, name = 'Mission Control', tone = 'info', live }: { children: ReactNode; name?: string; tone?: 'info' | 'tip' | 'good'; live?: 'polite' | 'assertive' }) {
  return (
    <div className={`comm ${tone}`} {...(live ? { 'aria-live': live } : {})}>
      <span className="comm-avatar"><Icon name="headset" size={22} /></span>
      <div className="comm-body">
        <div className="comm-name">{name}</div>
        <div className="comm-text">{children}</div>
      </div>
    </div>
  );
}

/** Small labelled value, used for mission facts and results. */
export function Chip({ children, icon, tone = '' }: { children: ReactNode; icon?: string; tone?: string }) {
  return <span className={`pill ${tone}`}>{icon && <Icon name={icon} size={15} />}{children}</span>;
}

/** On/off switch with a title and a one-line note. */
export function Toggle({ checked, onChange, label, note, icon }: { checked: boolean; onChange: (on: boolean) => void; label: string; note?: string; icon?: string }) {
  return (
    <label className={`toggle ${checked ? 'on' : ''}`}>
      {icon && <span className="toggle-icon"><Icon name={icon} size={20} /></span>}
      <span className="toggle-text"><strong>{label}</strong>{note && <small>{note}</small>}</span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => { playCue('select'); onChange(e.target.checked); }} />
      <span className="toggle-track" aria-hidden="true"><span className="toggle-thumb" /></span>
      <span className="toggle-state" aria-hidden="true">{checked ? 'On' : 'Off'}</span>
    </label>
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

const TIER_BLURB: Record<Tier, string> = {
  junior: 'One step at a time, with tips switched on.',
  middle: 'Fewer tips. Your choices change what happens later.',
  advanced: 'Several problems at once, and slow replies from Earth.',
};

/** Difficulty as three big buttons. Arrow keys move between them, as with any radio group. */
export function TierPicker({ compact = false }: { compact?: boolean }) {
  const tier = useGame((s) => s.save.settings.tier);
  const update = useGame((s) => s.updateSettings);
  return (
    <fieldset className={`tiers ${compact ? 'compact' : ''}`}>
      <legend>Difficulty</legend>
      <div className="tier-row">
        {TIERS.map((t, i) => (
          <label key={t} className={`tier ${tier === t ? 'on' : ''}`}>
            <input type="radio" name="tier" value={t} checked={tier === t} onChange={() => { playCue('select'); update({ tier: t }); }} />
            <span className="tier-pips" aria-hidden="true">{Array.from({ length: 3 }, (_, k) => <i key={k} className={k <= i ? 'on' : ''} />)}</span>
            <span className="tier-name">{TIER_LABEL[t]}</span>
          </label>
        ))}
      </div>
      {!compact && <p className="tier-blurb">{TIER_BLURB[tier]}</p>}
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
