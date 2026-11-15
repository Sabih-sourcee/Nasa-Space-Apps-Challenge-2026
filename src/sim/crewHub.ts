// The crew hub: the one place that holds live crews and answers requests about
// them. It is the authority for membership, roles, shared items and replay.
//
// The same hub runs in two places:
//   - inside the game's server (`npm run dev`, `npm start`), where every
//     computer on the network reaches it at /api/crew;
//   - inside the host's own browser when there is no server (a plain static
//     copy of the game), where other windows on the same computer reach it.
// No personal data: a cadet is a random token and a made-up name.

import { cadetName, createSession, reduceCrew, type CrewAction, type CrewSession } from './crew';
import type { CrewCarry } from './crewData';

interface Crew { session: CrewSession; tokens: Map<string, string>; seen: Map<string, number> }

export interface HubReply { status: number; body: Record<string, unknown> }

const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
/** A cadet not heard from for this long is marked as away, and their task and item go back. */
export const DROP_AFTER_MS = 12000;

export interface Hub {
  handle: (body: Record<string, unknown>, now: number) => HubReply;
  /** True when this hub is the one holding the crew with that join code. */
  has: (code: string) => boolean;
  size: () => number;
}

/** `randomBytes(n)` must return n unpredictable bytes: the join code and the cadet tokens come from it. */
export function createHub(randomBytes: (n: number) => number[]): Hub {
  const crews = new Map<string, Crew>();
  let seed = 1;

  const hex = (n: number) => randomBytes(n).map((b) => (b & 255).toString(16).padStart(2, '0')).join('');
  const newCode = (): string => {
    for (;;) {
      const b = randomBytes(6);
      const code = `${[b[0], b[1], b[2]].map((x) => LETTERS[(x & 255) % LETTERS.length]).join('')}-${100 + ((((b[3] & 255) << 8) | (b[4] & 255)) % 900)}`;
      if (!crews.has(code)) return code;
    }
  };
  const norm = (code: unknown) => String(code ?? '').toUpperCase().trim();

  const handle = (body: Record<string, unknown>, now: number): HubReply => {
    const op = String(body.op ?? '');

    if (op === 'host') {
      const code = newCode();
      const id = `c${seed++}`;
      const token = hex(12);
      const session = createSession(code, { id, name: cadetName(now + seed) });
      session.carry = (body.carry ?? {}) as CrewCarry;
      crews.set(code, { session, tokens: new Map([[token, id]]), seen: new Map([[id, now]]) });
      return { status: 200, body: { ok: true, code, memberId: id, token, session } };
    }

    const code = norm(body.code);
    const crew = crews.get(code);
    if (!crew) return { status: 404, body: { ok: false, error: 'No crew has that join code. Check it with your host.' } };

    if (op === 'join') {
      const id = `c${seed++}`;
      const token = hex(12);
      const r = reduceCrew(crew.session, { type: 'join', aid: `join-${id}`, id, name: cadetName(now + seed * 13) });
      if (!r.ok) return { status: 409, body: { ok: false, error: r.error } };
      crew.session = r.session;
      crew.tokens.set(token, id);
      crew.seen.set(id, now);
      return { status: 200, body: { ok: true, code, memberId: id, token, session: crew.session } };
    }

    // Everything else needs the cadet's own token. It decides who the action is from.
    const memberId = crew.tokens.get(String(body.token ?? ''));
    if (!memberId) return { status: 403, body: { ok: false, error: 'This browser is not part of that crew.' } };
    crew.seen.set(memberId, now);

    // A cadet who has not been heard from is marked as dropped: their task and item go back.
    for (const m of crew.session.members) {
      if (m.bot || !m.connected || m.id === memberId) continue;
      if (now - (crew.seen.get(m.id) ?? 0) > DROP_AFTER_MS) crew.session = reduceCrew(crew.session, { type: 'leave', aid: `drop-${m.id}-${now}`, by: m.id }).session;
    }
    const me = crew.session.members.find((m) => m.id === memberId);
    if (me && !me.connected && op !== 'act') crew.session = reduceCrew(crew.session, { type: 'rejoin', aid: `back-${memberId}-${now}`, by: memberId }).session;

    const moved = typeof body.x === 'number' && typeof body.z === 'number' && typeof body.room === 'string';
    if ((op === 'poll' || op === 'act') && moved) {
      crew.session = reduceCrew(crew.session, { type: 'move', by: memberId, x: body.x as number, z: body.z as number, room: body.room as never }).session;
    }
    if (op === 'poll') return { status: 200, body: { ok: true, session: crew.session } };
    if (op === 'act') {
      const action = { ...(body.action as Record<string, unknown>), by: memberId } as unknown as CrewAction;
      const r = reduceCrew(crew.session, action);
      crew.session = r.session;
      if (crew.session.phase === 'ended') crews.delete(code);
      return { status: 200, body: { ok: r.ok, error: r.error, say: r.say, card: r.card, duplicate: r.duplicate, session: r.session } };
    }
    return { status: 400, body: { ok: false, error: 'Unknown request.' } };
  };

  return { handle, has: (code) => crews.has(norm(code)), size: () => crews.size };
}
