// Crews without a server. When the game is opened as a plain static copy there
// is no /api/crew to talk to, so the host's own browser window holds the crew
// (the same hub the server runs) and other windows on the same computer reach
// it over a BroadcastChannel. It is enough for two windows side by side. It
// does not cross computers: for that the game must be started with `npm start`.

import { createHub } from '../sim/crewHub';

type Reply = Record<string, unknown>;

const hub = createHub((n) => {
  const b = new Uint8Array(n);
  try { crypto.getRandomValues(b); } catch { for (let i = 0; i < n; i++) b[i] = Math.floor(Math.random() * 256); }
  return Array.from(b);
});

const waiting = new Map<string, (r: Reply) => void>();
let counter = 0;
let channel: BroadcastChannel | null = null;

function open(): BroadcastChannel | null {
  if (channel || typeof BroadcastChannel === 'undefined') return channel;
  channel = new BroadcastChannel('beyondEarth.crew.v1');
  channel.onmessage = (e: MessageEvent) => {
    const m = e.data as { type?: string; id?: string; body?: Record<string, unknown>; result?: Reply } | null;
    if (!m || typeof m.id !== 'string') return;
    // Another window is asking about a crew. Only the window that holds it answers.
    if (m.type === 'req' && m.body && hub.has(String(m.body.code ?? ''))) {
      channel?.postMessage({ type: 'res', id: m.id, result: hub.handle(m.body, Date.now()).body });
    } else if (m.type === 'res' && m.result) {
      waiting.get(m.id)?.(m.result);
      waiting.delete(m.id);
    }
  };
  return channel;
}

/** True when this window is holding a crew for other windows. Closing it ends that crew. */
export const hostingLocally = (): boolean => hub.size() > 0;

export function localCall(body: Record<string, unknown>): Promise<Reply> {
  const chan = open();
  if (body.op === 'host' || hub.has(String(body.code ?? ''))) return Promise.resolve(hub.handle(body, Date.now()).body);
  if (!chan) return Promise.resolve({ ok: false, error: 'This browser cannot share a crew between windows. Use Solo Training.' });
  return new Promise((resolve) => {
    const id = `${Date.now().toString(36)}-${(counter++).toString(36)}`;
    waiting.set(id, resolve);
    chan.postMessage({ type: 'req', id, body });
    window.setTimeout(() => {
      if (waiting.delete(id)) resolve({ ok: false, error: body.op === 'join'
        ? 'No crew on this computer has that join code. Check it with your host, and keep the host window open.'
        : 'The host window is not answering. It may have been closed.' });
    }, 1500);
  });
}
