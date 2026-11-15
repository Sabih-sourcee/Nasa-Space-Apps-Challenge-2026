// Beyond Earth mission service. It is the authority for crew membership,
// roles, shared items, incidents and replay: browsers send actions, the
// service runs the same reducer the tests use, and every browser polls the
// same snapshot. It runs inside the Vite dev server (see vite.config.ts), so
// `npm run dev` starts it. State is in memory: restarting the server ends
// every crew. No personal data: a cadet is a random token and a made-up name.

import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomBytes } from 'node:crypto';
import type { Plugin } from 'vite';
import type { CrewAction, CrewResult, CrewSession } from '../src/sim/crew';
import type { CrewCarry } from '../src/sim/crewData';

interface Engine {
  createSession: (code: string, host: { id: string; name: string }, solo?: boolean) => CrewSession;
  reduceCrew: (s: CrewSession, a: CrewAction) => CrewResult;
  cadetName: (seed: number) => string;
}

interface Crew { session: CrewSession; tokens: Map<string, string>; seen: Map<string, number> }

const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DROP_AFTER_MS = 12000;

export function crewService(): Plugin {
  const crews = new Map<string, Crew>();
  let seed = 1;

  const newCode = (): string => {
    for (;;) {
      const b = randomBytes(6);
      const code = `${Array.from(b.subarray(0, 3), (x: number) => LETTERS[x % LETTERS.length]).join('')}-${100 + (b.readUInt16BE(3) % 900)}`;
      if (!crews.has(code)) return code;
    }
  };

  const readBody = (req: IncomingMessage): Promise<Record<string, unknown>> => new Promise((resolve) => {
    let raw = '';
    req.on('data', (c: Buffer) => { raw += c; if (raw.length > 20000) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}') as Record<string, unknown>); } catch { resolve({}); } });
  });

  const send = (res: ServerResponse, status: number, body: unknown) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(body));
  };

  return {
    name: 'beyond-earth-crew-service',
    configureServer(server) {
      server.middlewares.use('/api/crew', (req, res) => {
        void (async () => {
          if (req.method !== 'POST') { send(res, 405, { ok: false, error: 'POST only.' }); return; }
          const engine = (await server.ssrLoadModule('/src/sim/crew.ts')) as unknown as Engine;
          const body = await readBody(req);
          const op = String(body.op ?? '');
          const now = Date.now();

          if (op === 'host') {
            const code = newCode();
            const id = `c${seed++}`;
            const token = randomBytes(12).toString('hex');
            const session = engine.createSession(code, { id, name: engine.cadetName(now + seed) });
            session.carry = (body.carry ?? {}) as CrewCarry;
            crews.set(code, { session, tokens: new Map([[token, id]]), seen: new Map([[id, now]]) });
            send(res, 200, { ok: true, code, memberId: id, token, session });
            return;
          }

          const code = String(body.code ?? '').toUpperCase().trim();
          const crew = crews.get(code);
          if (!crew) { send(res, 404, { ok: false, error: 'No crew has that join code. Check it with your host.' }); return; }

          if (op === 'join') {
            const id = `c${seed++}`;
            const token = randomBytes(12).toString('hex');
            const r = engine.reduceCrew(crew.session, { type: 'join', aid: `join-${id}`, id, name: engine.cadetName(now + seed * 13) });
            if (!r.ok) { send(res, 409, { ok: false, error: r.error }); return; }
            crew.session = r.session;
            crew.tokens.set(token, id);
            crew.seen.set(id, now);
            send(res, 200, { ok: true, code, memberId: id, token, session: crew.session });
            return;
          }

          // Everything else needs the cadet's own token. It decides who the action is from.
          const memberId = crew.tokens.get(String(body.token ?? ''));
          if (!memberId) { send(res, 403, { ok: false, error: 'This browser is not part of that crew.' }); return; }
          crew.seen.set(memberId, now);

          // A cadet who has not been heard from is marked as dropped: their task and item go back.
          for (const m of crew.session.members) {
            if (m.bot || !m.connected || m.id === memberId) continue;
            if (now - (crew.seen.get(m.id) ?? 0) > DROP_AFTER_MS) crew.session = engine.reduceCrew(crew.session, { type: 'leave', aid: `drop-${m.id}-${now}`, by: m.id }).session;
          }
          const me = crew.session.members.find((m) => m.id === memberId);
          if (me && !me.connected && op !== 'act') crew.session = engine.reduceCrew(crew.session, { type: 'rejoin', aid: `back-${memberId}-${now}`, by: memberId }).session;

          if (op === 'poll') {
            if (typeof body.x === 'number' && typeof body.z === 'number' && typeof body.room === 'string') {
              crew.session = engine.reduceCrew(crew.session, { type: 'move', by: memberId, x: body.x, z: body.z, room: body.room as never }).session;
            }
            send(res, 200, { ok: true, session: crew.session });
            return;
          }
          if (op === 'act') {
            if (typeof body.x === 'number' && typeof body.z === 'number' && typeof body.room === 'string') {
              crew.session = engine.reduceCrew(crew.session, { type: 'move', by: memberId, x: body.x, z: body.z, room: body.room as never }).session;
            }
            const action = { ...(body.action as Record<string, unknown>), by: memberId } as unknown as CrewAction;
            const r = engine.reduceCrew(crew.session, action);
            crew.session = r.session;
            if (crew.session.phase === 'ended') crews.delete(code);
            send(res, 200, { ok: r.ok, error: r.error, say: r.say, card: r.card, duplicate: r.duplicate, session: r.session });
            return;
          }
          send(res, 400, { ok: false, error: 'Unknown request.' });
        })().catch((e: unknown) => send(res, 500, { ok: false, error: String(e) }));
      });
    },
  };
}
