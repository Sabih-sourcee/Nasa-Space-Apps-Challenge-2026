// Beyond Earth mission service. Browsers send requests to /api/crew, the crew
// hub answers them (see src/sim/crewHub.ts), and every browser polls the same
// snapshot. It runs inside the game's own server in both modes:
//   npm run dev     the development server
//   npm start       the built game, served to the whole network
// State is in memory: restarting the server ends every crew.

import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomBytes } from 'node:crypto';
import type { Connect, Plugin } from 'vite';
import { createHub } from '../src/sim/crewHub';

export function crewService(): Plugin {
  const hub = createHub((n) => Array.from(randomBytes(n)));

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

  const route: Connect.NextHandleFunction = (req, res) => {
    void (async () => {
      if (req.method !== 'POST') { send(res, 405, { ok: false, error: 'POST only.' }); return; }
      const reply = hub.handle(await readBody(req), Date.now());
      send(res, reply.status, reply.body);
    })().catch((e: unknown) => send(res, 500, { ok: false, error: String(e) }));
  };

  return {
    name: 'beyond-earth-crew-service',
    configureServer(server) { server.middlewares.use('/api/crew', route); },
    configurePreviewServer(server) { server.middlewares.use('/api/crew', route); },
  };
}
