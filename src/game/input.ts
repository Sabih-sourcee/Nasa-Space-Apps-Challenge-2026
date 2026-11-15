// One input layer for keyboard, pointer and touch. Scenes read actions, never
// raw keys, so every control has a keyboard key and a labelled on-screen button.

export type Action = 'up' | 'down' | 'left' | 'right' | 'primary' | 'use' | 'brake' | 'recover';

const KEY_MAP: Record<string, Action> = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  Space: 'primary',
  KeyE: 'use', Enter: 'use', NumpadEnter: 'use',
  KeyX: 'brake', KeyB: 'brake',
  KeyR: 'recover',
};

const keyHeld = new Set<Action>();
const virtualHeld = new Set<Action>();
const pressed = new Set<Action>();
let suspended = false;
let attached = false;

function isFormTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === 'BUTTON' || tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || tag === 'A' || el.isContentEditable;
}

function onKeyDown(e: KeyboardEvent): void {
  const action = KEY_MAP[e.code];
  if (!action || suspended) return;
  // Let focused buttons and form controls keep their normal keyboard behaviour.
  if (isFormTarget(e.target) && (action === 'use' || action === 'primary')) return;
  if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  if (!keyHeld.has(action)) pressed.add(action);
  keyHeld.add(action);
}

function onKeyUp(e: KeyboardEvent): void {
  const action = KEY_MAP[e.code];
  if (action) keyHeld.delete(action);
}

function clearAll(): void {
  keyHeld.clear();
  virtualHeld.clear();
  pressed.clear();
}

export const input = {
  attach(): void {
    if (attached) return;
    attached = true;
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearAll);
  },
  /** While a dialog is open the game ignores input so Tab, Enter and Space work natively. */
  setSuspended(value: boolean): void {
    suspended = value;
    if (value) clearAll();
  },
  isSuspended: (): boolean => suspended,
  held(a: Action): boolean {
    return !suspended && (keyHeld.has(a) || virtualHeld.has(a));
  },
  /** True while any game key or on-screen button is still down. */
  anyHeld: (): boolean => keyHeld.size > 0 || virtualHeld.size > 0,
  /** True once per press. */
  consume(a: Action): boolean {
    if (suspended) { pressed.delete(a); return false; }
    const had = pressed.has(a);
    pressed.delete(a);
    return had;
  },
  axisX(): number {
    return (input.held('right') ? 1 : 0) - (input.held('left') ? 1 : 0);
  },
  axisY(): number {
    return (input.held('up') ? 1 : 0) - (input.held('down') ? 1 : 0);
  },
  setVirtual(a: Action, down: boolean): void {
    if (suspended) return;
    if (down) {
      if (!virtualHeld.has(a)) pressed.add(a);
      virtualHeld.add(a);
    } else {
      virtualHeld.delete(a);
    }
  },
  clear: clearAll,
};
