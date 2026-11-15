import { describe, expect, it } from 'vitest';
import type { CrewSession } from '../src/sim/crew';
import { DROP_AFTER_MS, createHub } from '../src/sim/crewHub';

// A repeatable byte source, so codes and tokens differ between calls without real randomness.
function bytes() {
  let n = 7;
  return (len: number) => Array.from({ length: len }, () => (n = (n * 73 + 41) % 251));
}

const members = (s: unknown) => (s as CrewSession).members;

describe('crew hub', () => {
  it('hosts a crew with a join code and lets a second cadet join with it', () => {
    const hub = createHub(bytes());
    const host = hub.handle({ op: 'host' }, 1000).body;
    expect(host.ok).toBe(true);
    expect(String(host.code)).toMatch(/^[A-Z]{3}-\d{3}$/);
    expect(hub.has(String(host.code))).toBe(true);
    expect(hub.has(String(host.code).toLowerCase())).toBe(true);

    const guest = hub.handle({ op: 'join', code: String(host.code).toLowerCase() }, 1100).body;
    expect(guest.ok).toBe(true);
    expect(guest.token).not.toBe(host.token);
    expect(guest.memberId).not.toBe(host.memberId);
    expect(members(guest.session).filter((m) => !m.bot).length).toBe(2);
  });

  it('refuses an unknown code, and a token from another crew', () => {
    const hub = createHub(bytes());
    const a = hub.handle({ op: 'host' }, 0).body;
    const b = hub.handle({ op: 'host' }, 0).body;
    expect(a.code).not.toBe(b.code);
    expect(hub.handle({ op: 'join', code: 'ZZZ-000' }, 0)).toMatchObject({ status: 404, body: { ok: false } });
    expect(hub.handle({ op: 'poll', code: b.code, token: a.token }, 0)).toMatchObject({ status: 403, body: { ok: false } });
    expect(hub.handle({ op: 'poll', code: a.code, token: a.token }, 0).body.ok).toBe(true);
    expect(hub.size()).toBe(2);
  });

  it('gives every poll the same snapshot, including where each cadet is standing', () => {
    const hub = createHub(bytes());
    const host = hub.handle({ op: 'host' }, 0).body;
    const guest = hub.handle({ op: 'join', code: host.code }, 10).body;
    hub.handle({ op: 'poll', code: host.code, token: guest.token, x: 3, z: -2, room: 'bridge' }, 20);
    const seen = hub.handle({ op: 'poll', code: host.code, token: host.token }, 30).body;
    const g = members(seen.session).find((m) => m.id === guest.memberId);
    expect(g).toMatchObject({ x: 3, z: -2, room: 'bridge' });
  });

  it('drops a cadet who has gone silent, so the crew is not left waiting for them', () => {
    const hub = createHub(bytes());
    const host = hub.handle({ op: 'host' }, 0).body;
    const guest = hub.handle({ op: 'join', code: host.code }, 0).body;
    const here = (s: unknown) => members(s).filter((m) => !m.bot && m.connected).map((m) => m.id);
    expect(here(hub.handle({ op: 'poll', code: host.code, token: host.token }, DROP_AFTER_MS - 500).body.session)).toContain(guest.memberId);
    const later = hub.handle({ op: 'poll', code: host.code, token: host.token }, DROP_AFTER_MS + 500).body;
    expect(here(later.session)).toEqual([host.memberId]);
  });

  it('takes the cadet from the token, not from what the request claims', () => {
    const hub = createHub(bytes());
    const host = hub.handle({ op: 'host' }, 0).body;
    const guest = hub.handle({ op: 'join', code: host.code }, 0).body;
    // The guest tries to start the mission while pretending to be the host.
    const r = hub.handle({ op: 'act', code: host.code, token: guest.token, action: { type: 'start', aid: 'x1', by: host.memberId } }, 5).body;
    expect(r.ok).toBe(false);
    expect((r.session as CrewSession).phase).toBe('lobby');
  });

  it('rejects requests it does not know', () => {
    const hub = createHub(bytes());
    const host = hub.handle({ op: 'host' }, 0).body;
    expect(hub.handle({ op: 'dance', code: host.code, token: host.token }, 0).status).toBe(400);
  });
});
