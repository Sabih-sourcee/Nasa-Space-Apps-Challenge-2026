// Crew Ship client state. Solo training runs the mission engine in this
// browser. A shared crew talks to the mission service, which runs the same
// engine and is the authority: this store only sends actions and shows the
// snapshot it gets back.

import { create } from 'zustand';
import { botTurn, cadetName, createSession, reduceCrew, type CrewAction, type CrewSession, type Member } from '../sim/crew';
import type { CrewCarry, RoomId } from '../sim/crewData';
import { playCue } from './audio';

type Send = Record<string, unknown> & { type: CrewAction['type'] };

interface CrewStore {
  mode: 'none' | 'solo' | 'online';
  session: CrewSession | null;
  memberId: string | null;
  token: string | null;
  busy: boolean;
  /** Last answer from the engine: what Reyes or the station said. */
  say: string | null;
  error: string | null;
  /** True once the service has stopped answering. */
  offline: boolean;
  host: (carry: CrewCarry) => Promise<void>;
  join: (code: string) => Promise<void>;
  solo: (carry: CrewCarry) => void;
  act: (action: Send) => Promise<{ ok: boolean; error?: string; say?: string; card?: boolean }>;
  leave: () => void;
  clearSay: () => void;
  /** Rejoin the crew this browser was last in, from the service's snapshot. */
  rejoin: () => Promise<boolean>;
}

const KEY = 'beyondEarth.crew.v1';
let counter = 0;
let botN = 0;
let timer = 0;
const aid = () => `${Date.now().toString(36)}-${(counter++).toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/** Where this cadet is standing. The ship scene writes it, the poll sends it. */
export const crewPos: { x: number; z: number; room: RoomId } = { x: 0, z: 0, room: 'galley' };

async function call(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch('/api/crew', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const text = await res.text();
  try { return JSON.parse(text) as Record<string, unknown>; } catch { return { ok: false, error: 'The mission service is not running. Start the game with "npm run dev" to play with a crew, or use Solo Training.' }; }
}

function remember(code: string, token: string, memberId: string): void {
  try { window.localStorage.setItem(KEY, JSON.stringify({ code, token, memberId })); } catch { /* storage is optional */ }
}
export function lastCrew(): { code: string; token: string; memberId: string } | null {
  try { const v = JSON.parse(window.localStorage.getItem(KEY) ?? 'null') as { code?: string; token?: string; memberId?: string } | null; return v && v.code && v.token && v.memberId ? { code: v.code, token: v.token, memberId: v.memberId } : null; } catch { return null; }
}

export const useCrew = create<CrewStore>((set, get) => {
  const stopPolling = () => { window.clearInterval(timer); timer = 0; };
  const startPolling = () => {
    stopPolling();
    timer = window.setInterval(() => {
      const { session, token, mode } = get();
      if (mode !== 'online' || !session || !token) return;
      call({ op: 'poll', code: session.code, token, x: crewPos.x, z: crewPos.z, room: crewPos.room })
        .then((r) => {
          if (r.ok && r.session) set({ session: r.session as CrewSession, offline: false });
          else if (r.error) set({ offline: true, error: String(r.error) });
        })
        .catch(() => set({ offline: true }));
    }, 600);
  };
  const enter = (r: Record<string, unknown>) => {
    if (!r.ok) { set({ busy: false, error: String(r.error ?? 'Could not reach the mission service.') }); return; }
    remember(String(r.code), String(r.token), String(r.memberId));
    set({ mode: 'online', session: r.session as CrewSession, memberId: String(r.memberId), token: String(r.token), busy: false, error: null, say: null, offline: false });
    startPolling();
  };

  return {
    mode: 'none', session: null, memberId: null, token: null, busy: false, say: null, error: null, offline: false,

    host: async (carry) => { set({ busy: true, error: null }); enter(await call({ op: 'host', carry }).catch(() => ({ ok: false, error: 'The mission service is not running. Use Solo Training, or start the game with "npm run dev".' }))); },
    join: async (code) => { set({ busy: true, error: null }); enter(await call({ op: 'join', code }).catch(() => ({ ok: false, error: 'The mission service is not running.' }))); },

    solo: (carry) => {
      stopPolling();
      const seed = Math.floor(Math.random() * 1000);
      let s = createSession('SOLO', { id: 'me', name: cadetName(seed) }, true);
      // Three scripted crew fill the other stations.
      for (let i = 1; i <= 3; i++) s = reduceCrew(s, { type: 'join', aid: aid(), id: `crew${i}`, name: `${cadetName(seed + i * 5)} (scripted)`, bot: true }).session;
      set({ mode: 'solo', session: { ...s, carry }, memberId: 'me', token: null, error: null, say: null, offline: false });
    },

    act: async (action) => {
      const { mode, session, memberId, token } = get();
      if (!session || !memberId) return { ok: false, error: 'Not in a crew.' };
      const full = { ...action, aid: aid(), by: memberId } as unknown as CrewAction;
      if (mode === 'solo') {
        const here = reduceCrew(session, { type: 'move', by: memberId, x: crewPos.x, z: crewPos.z, room: crewPos.room }).session;
        let r = reduceCrew(here, full);
        let next = r.session;
        // After each of the cadet's jobs, one scripted crew member does one of theirs.
        if (r.ok && (action.type === 'answer' || action.type === 'deliver' || action.type === 'briefed' || action.type === 'endShift' || action.type === 'replay')) {
          const b = botTurn(next, botN++);
          if (b?.ok) { next = b.session; r = { ...r, say: `${r.say ?? ''} ${next.log.at(-1)?.text ?? ''}`.trim() }; }
        }
        set({ session: next, say: r.say ?? null, error: r.ok ? null : r.error ?? null });
        playCue(r.ok ? 'ok' : 'caution');
        return { ok: r.ok, error: r.error, say: r.say, card: r.card };
      }
      const r: Record<string, unknown> = await call({ op: 'act', code: session.code, token, action: full, x: crewPos.x, z: crewPos.z, room: crewPos.room }).catch(() => ({ ok: false, error: 'The mission service did not answer. Your action was not applied.' }));
      if (r.session) set({ session: r.session as CrewSession });
      set({ say: (r.say as string) ?? null, error: r.ok ? null : String(r.error ?? '') });
      playCue(r.ok ? 'ok' : 'caution');
      return { ok: !!r.ok, error: r.error as string | undefined, say: r.say as string | undefined, card: !!r.card };
    },

    leave: () => {
      const { mode, session, token, memberId } = get();
      if (mode === 'online' && session && token) void call({ op: 'act', code: session.code, token, action: { type: 'leave', aid: aid(), by: memberId } }).catch(() => undefined);
      stopPolling();
      try { window.localStorage.removeItem(KEY); } catch { /* optional */ }
      set({ mode: 'none', session: null, memberId: null, token: null, say: null, error: null });
    },

    clearSay: () => set({ say: null, error: null }),

    rejoin: async () => {
      const last = lastCrew();
      if (!last) return false;
      const r = await call({ op: 'poll', code: last.code, token: last.token }).catch(() => ({ ok: false } as Record<string, unknown>));
      if (!r.ok || !r.session) return false;
      set({ mode: 'online', session: r.session as CrewSession, memberId: last.memberId, token: last.token, error: null, offline: false });
      startPolling();
      return true;
    },
  };
});

export const meOf = (s: CrewSession | null, id: string | null): Member | null => s?.members.find((m) => m.id === id) ?? null;
