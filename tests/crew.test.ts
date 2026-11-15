import { describe, expect, it } from 'vitest';
import { CREW_CALLS, botTurn, compareCrew, createSession, liveTasks, reduceCrew, type CrewAction, type CrewSession } from '../src/sim/crew';
import { INCIDENTS, ROOMS, TASKS, VERTICAL_DOOR_COLS, type IncidentId } from '../src/sim/crewData';
import { sourceById } from '../src/sim/sources';
import { TIERS, type Tier } from '../src/sim/types';

let n = 0;
const aid = () => `a${n++}`;
type Act = Record<string, unknown> & { type: string };
function run(s: CrewSession, ...acts: Act[]): CrewSession {
  for (const a of acts) {
    const r = reduceCrew(s, { ...a, aid: aid() } as unknown as CrewAction);
    if (!r.ok) throw new Error(`${a.type}: ${r.error}`);
    s = r.session;
  }
  return s;
}
const tryIt = (s: CrewSession, a: Act) => reduceCrew(s, { ...a, aid: aid() } as unknown as CrewAction);
const at = (s: CrewSession, by: string, room: string) => reduceCrew(s, { type: 'move', by, x: 0, z: 0, room: room as never }).session;

/** Two cadets, ready, started and briefed on an incident. */
function crewOf(incident: IncidentId, tier: Tier = 'middle'): CrewSession {
  const s = createSession('KES-TEST', { id: 'h', name: 'Cadet Host' });
  return run(s, { type: 'join', id: 'g', name: 'Cadet Guest' }, { type: 'setup', by: 'h', incident, tier }, { type: 'ready', by: 'g', ready: true }, { type: 'start', by: 'h' }, { type: 'briefed', by: 'h' });
}
const correct = (s: CrewSession, key: string): unknown => {
  const t = liveTasks(s.state!).find((x) => x.key === key)!.spec;
  return t.kind === 'pick' ? t.options!.find((o) => o.correct)!.id : t.kind === 'order' ? t.steps : t.kind === 'count' ? t.answer : t.dial!.target;
};
const solve = (s: CrewSession, by: string, key: string, value?: unknown): CrewSession => {
  const room = liveTasks(s.state!).find((x) => x.key === key)!.spec.room;
  return run(at(s, by, room), { type: 'answer', by, key, value: value ?? correct(s, key) });
};
const endShifts = (s: CrewSession, k: number) => { for (let i = 0; i < k && s.phase === 'active'; i++) s = run(at(s, 'h', 'bridge'), { type: 'endShift', by: 'h' }); return s; };

describe('ship catalogue', () => {
  it('has 15 rooms around a central Galley with two loops', () => {
    expect(ROOMS.length).toBe(15);
    expect(new Set(ROOMS.map((r) => `${r.col},${r.row}`)).size).toBe(15);
    const galley = ROOMS.find((r) => r.id === 'galley')!;
    expect([galley.col, galley.row]).toEqual([2, 1]);
    // Three columns join the rows, which closes two loops through the Galley column.
    expect(VERTICAL_DOOR_COLS.length).toBe(3);
  });

  it('has 18 task types, each with a clue, an effect and a science card with a listed source', () => {
    expect(TASKS.length).toBe(18);
    expect(TASKS.map((t) => t.num)).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
    for (const t of TASKS) {
      expect(t.clue.length).toBeGreaterThan(15);
      expect(t.effect.length).toBeGreaterThan(15);
      expect(t.card.length).toBeGreaterThan(15);
      expect(sourceById(t.sourceId!)).toBeTruthy();
      expect(t.time).toBeGreaterThan(0);
      if (t.kind === 'pick') expect(t.options!.filter((o) => o.correct).length).toBe(1);
      if (t.kind === 'order') expect(t.steps!.length).toBeGreaterThanOrEqual(3);
    }
    expect(new Set(TASKS.map((t) => t.room)).size).toBe(15);
  });

  it('every emergency has panels, a trade-off and sourced science', () => {
    const emergencies = INCIDENTS.filter((x) => x.kind === 'emergency');
    expect(emergencies.length).toBe(5);
    for (const i of emergencies) {
      expect(i.panels.place && i.panels.change && i.panels.need).toBeTruthy();
      expect(i.tradeoff.length).toBeGreaterThan(20);
      expect(i.science.length).toBeGreaterThan(0);
      for (const c of i.science) expect(sourceById(c.sourceId)).toBeTruthy();
    }
  });
});

describe('crew membership', () => {
  it('needs two ready cadets, gives each a role, and holds six at most', () => {
    let s = createSession('C1', { id: 'h', name: 'Cadet Host' });
    expect(tryIt(s, { type: 'start', by: 'h' }).ok).toBe(false);
    s = run(s, { type: 'join', id: 'g', name: 'Cadet Guest' });
    expect(tryIt(s, { type: 'start', by: 'h' }).error).toMatch(/ready/);
    expect(tryIt(s, { type: 'start', by: 'g' }).error).toMatch(/host/);
    expect(new Set(s.members.map((m) => m.role)).size).toBe(2);
    for (let i = 0; i < 4; i++) s = run(s, { type: 'join', id: `x${i}`, name: `Cadet ${i}` });
    expect(tryIt(s, { type: 'join', id: 'late', name: 'Cadet Late' }).error).toMatch(/full/);
  });

  it('roles are held by one cadet, and can be swapped by a handoff', () => {
    let s = run(createSession('C2', { id: 'h', name: 'A' }), { type: 'join', id: 'g', name: 'B' });
    const [a, b] = s.members.map((m) => m.role);
    expect(tryIt(s, { type: 'role', by: 'g', role: a }).ok).toBe(false);
    s = run(s, { type: 'handoff', by: 'h', to: 'g' });
    expect(s.members.map((m) => m.role)).toEqual([b, a]);
  });

  it('a repeated action id is applied once', () => {
    const s = crewOf('meals');
    const a: CrewAction = { type: 'answer', aid: 'same', by: 'h', key: 't08', value: 4 };
    const first = reduceCrew(at(s, 'h', 'galley'), a);
    const second = reduceCrew(first.session, a);
    expect(first.ok).toBe(true);
    expect(second.duplicate).toBe(true);
    expect(second.session).toBe(first.session);
    expect(first.session.state!.total).toBe(1);
  });

  it('only one cadet can pick up a shared item, and everyone sees who has it', () => {
    let s = crewOf('air');
    s = at(at(s, 'h', 'cargo'), 'g', 'cargo');
    s = run(s, { type: 'pickup', by: 'h', item: 'filter' });
    const second = tryIt(s, { type: 'pickup', by: 'g', item: 'filter' });
    expect(second.ok).toBe(false);
    expect(second.error).toMatch(/Cadet Host already has/);
    expect(s.state!.items.filter).toMatchObject({ at: 'held', holder: 'h' });
    expect(tryIt(s, { type: 'pickup', by: 'h', item: 'battery' }).error).toMatch(/hands are full/);
  });

  it('a task is claimed by one cadet at a time', () => {
    let s = crewOf('meals');
    s = run(at(s, 'h', 'galley'), { type: 'claim', by: 'h', key: 't08' });
    expect(tryIt(s, { type: 'claim', by: 'g', key: 't08' }).error).toMatch(/already working/);
    expect(tryIt(s, { type: 'answer', by: 'g', key: 't08', value: 4 }).error).toMatch(/already working/);
  });

  it('a cadet who drops out releases their task and their item, and can rejoin', () => {
    let s = crewOf('air');
    s = run(at(s, 'g', 'cargo'), { type: 'pickup', by: 'g', item: 'filter' }, { type: 'claim', by: 'g', key: 't01' });
    s = run(s, { type: 'leave', by: 'g' });
    expect(s.state!.items.filter).toMatchObject({ at: 'cargo', holder: null });
    expect(s.members.find((m) => m.id === 'g')).toMatchObject({ connected: false, claim: null });
    const done = s.state!.done.length;
    s = run(s, { type: 'rejoin', by: 'g' });
    expect(s.members.find((m) => m.id === 'g')!.connected).toBe(true);
    expect(s.state!.done.length).toBe(done);
    s = run(s, { type: 'leave', by: 'h' });
    expect(s.hostId).toBe('g');
  });

  it('only preset crew calls are accepted, and only the host ends the session', () => {
    let s = crewOf('meals');
    expect(tryIt(s, { type: 'call', by: 'g', text: 'my phone number is' }).ok).toBe(false);
    s = run(s, { type: 'call', by: 'g', text: CREW_CALLS[0] });
    expect(s.log.at(-1)!.kind).toBe('call');
    expect(tryIt(s, { type: 'end', by: 'g' }).ok).toBe(false);
    expect(run(s, { type: 'end', by: 'h' }).phase).toBe('debrief');
  });

  it('crews are separate sessions', () => {
    const a = crewOf('meals');
    const b = crewOf('meals');
    expect(solve(a, 'h', 't08').state!.done).toEqual(['t08']);
    expect(b.state!.done).toEqual([]);
  });
});

describe('Last Meals on Board', () => {
  it('starts with 8 packs for 4 crew: a four-pack shortfall in Shift 3', () => {
    const s = crewOf('meals');
    expect(s.state).toMatchObject({ crew: 4, shift: 1 });
    expect(s.state!.res.meals).toBe(8);
    const bridge = liveTasks(s.state!).find((t) => t.key === 't01')!.spec;
    expect(bridge.options!.find((o) => o.correct)!.why).toMatch(/short by 4/);
  });

  it('stock and consumption scale together with a bigger crew', () => {
    let s = createSession('BIG', { id: 'h', name: 'H' });
    for (let i = 0; i < 5; i++) s = run(s, { type: 'join', id: `m${i}`, name: `M${i}` }, { type: 'ready', by: `m${i}`, ready: true });
    s = run(s, { type: 'setup', by: 'h', incident: 'meals', tier: 'middle' }, { type: 'start', by: 'h' }, { type: 'briefed', by: 'h' });
    expect(s.state!.crew).toBe(6);
    expect(s.state!.res.meals).toBe(12);
    expect(liveTasks(s.state!).find((t) => t.key === 't08')!.spec.answer).toBe(6);
  });

  it.each(TIERS)('%s: the cargo route feeds Shift 3 and costs crew time, not fuel', (tier) => {
    let s = crewOf('meals', tier);
    s = solve(s, 'h', 't08'); s = solve(s, 'g', 't01');
    if (tier === 'advanced') s = solve(s, 'g', 't04');
    s = solve(s, 'h', 't11');
    expect(s.state!.items.meal_crate).toMatchObject({ holder: 'h' });
    expect(tryIt(at(s, 'h', 'bridge'), { type: 'deliver', by: 'h' }).error).toMatch(/not needed in the Bridge/);
    s = run(at(s, 'h', 'galley'), { type: 'deliver', by: 'h' });
    // On Advanced the short shifts mean Shift 1 has already ended, and its meal eaten, by the time the crate arrives.
    expect(s.state!.res.meals).toBe(tier === 'advanced' ? 8 : 12);
    s = endShifts(s, 3);
    expect(s.phase).toBe('debrief');
    expect(s.outcome).toMatchObject({ stars: 3 });
    expect(s.outcome!.res).toMatchObject({ readiness: 100, fuel: 100 });
    expect(s.outcome!.cause).toMatch(/manifest/);
  });

  it.each(TIERS)('%s: the comms route brings the dock forward and costs fuel', (tier) => {
    let s = crewOf('meals', tier);
    s = solve(s, 'h', 't08'); s = solve(s, 'g', 't01');
    if (tier === 'advanced') s = solve(s, 'g', 't04');
    s = solve(s, 'g', 't12');
    s = endShifts(s, 3);
    expect(s.phase).toBe('debrief');
    expect(s.outcome!.res.readiness).toBe(100);
    expect(s.outcome!.res.fuel).toBe(tier === 'advanced' ? 70 : 80);
    expect(s.log.some((l) => /docked at the end of Shift 2/.test(l.text))).toBe(true);
  });

  it('a crew that misses the action goes hungry in Shift 3, and still finishes', () => {
    let s = crewOf('meals');
    s = solve(s, 'h', 't09');
    expect(s.state!.res.crops).toBe(4);
    s = endShifts(s, 3);
    expect(s.phase).toBe('debrief');
    expect(s.outcome!.res.readiness).toBe(70);
    expect(s.outcome!.stars).toBe(2);
    expect(s.outcome!.cause).toMatch(/plants take weeks/);
  });

  it('a wrong answer costs one clock step, explains itself and can be retried', () => {
    const s = crewOf('meals');
    const wrong = tryIt(at(s, 'h', 'galley'), { type: 'answer', by: 'h', key: 't08', value: 8 });
    expect(wrong.ok).toBe(false);
    expect(wrong.error).toMatch(/more than one pack each/);
    expect(wrong.session.state).toMatchObject({ total: 1, misses: 1, done: [] });
    expect(solve(wrong.session, 'h', 't08').state!.done).toEqual(['t08']);
  });

  it('Junior is guided one step at a time', () => {
    const s = crewOf('meals', 'junior');
    const t = (k: string) => liveTasks(s.state!).find((x) => x.key === k)!;
    expect(t('t08').available).toBe(true);
    expect(t('t01').available).toBe(false);
    expect(tryIt(at(s, 'h', 'bridge'), { type: 'answer', by: 'h', key: 't01', value: 's3' }).error).toMatch(/comes first/);
  });

  it('Crew Replay forks the checkpoint, keeps the first outcome and shows what changed', () => {
    let s = crewOf('meals');
    s = solve(s, 'h', 't08'); s = solve(s, 'g', 't01'); s = solve(s, 'g', 't12');
    s = endShifts(s, 3);
    const first = s.outcome!;
    s = run(s, { type: 'replay', by: 'h' });
    expect(s.state).toEqual(s.checkpoint);
    expect(s.original).toEqual(first);
    s = solve(s, 'h', 't08'); s = solve(s, 'g', 't01'); s = solve(s, 'h', 't11');
    s = run(at(s, 'h', 'galley'), { type: 'deliver', by: 'h' });
    s = endShifts(s, 3);
    expect(s.original).toEqual(first);
    const cmp = compareCrew(s.original!, s.originalLog, s.outcome!, s.log);
    expect(cmp.same).toBe(false);
    expect(cmp.firstRoom).toBe('cargo');
    expect(cmp.rows.find((r) => r.label === 'Fuel')!.delta).toBe(20);
    expect(cmp.rows.find((r) => r.label === 'Crew readiness')!.delta).toBe(0);
  });

  it('the same moves give the same outcome', () => {
    const play = () => { let s = crewOf('meals'); s = solve(s, 'h', 't08'); s = solve(s, 'g', 't01'); s = solve(s, 'g', 't12'); return endShifts(s, 3); };
    const a = play();
    const b = play();
    expect(b.outcome).toEqual(a.outcome);
    expect(compareCrew(a.outcome!, a.log, b.outcome!, b.log).same).toBe(true);
  });
});

describe('the other emergencies', () => {
  it.each(TIERS)('%s: stale air needs both clues, then the filter', (tier) => {
    let s = crewOf('air', tier);
    expect(liveTasks(s.state!).find((t) => t.key === 't06a')!.available).toBe(false);
    s = solve(s, 'h', 't01'); s = solve(s, 'g', 't06a');
    s = run(at(s, 'h', 'cargo'), { type: 'pickup', by: 'h', item: 'battery' });
    s = run(at(s, 'h', 'power'), { type: 'answer', by: 'h', key: 't05', value: true });
    expect(s.state!.res.power).toBe(75);
    expect(s.state!.items.battery!.at).toBe('used');
    s = run(at(s, 'g', 'cargo'), { type: 'pickup', by: 'g', item: 'filter' });
    s = run(at(s, 'g', 'life'), { type: 'answer', by: 'g', key: 't06', value: true });
    expect(s.state!.res.air).toBe(100);
    s = solve(s, 'h', 't01b');
    expect(s.phase).toBe('debrief');
    expect(s.outcome!.stars).toBe(3);
    expect(s.outcome!.cause).toMatch(/Oxygen was never short/);
  });

  it('stale air: closing the bay costs time and no power; doing neither dips the air', () => {
    let s = crewOf('air');
    s = solve(s, 'h', 't01'); s = solve(s, 'g', 't06a'); s = solve(s, 'h', 't10');
    expect(s.state!.res.power).toBe(100);
    expect(s.state!.flags.held).toBe(true);
    let u = crewOf('air');
    u = solve(u, 'h', 't01'); u = solve(u, 'g', 't06a');
    u = run(at(u, 'g', 'cargo'), { type: 'pickup', by: 'g', item: 'filter' });
    u = run(at(u, 'g', 'life'), { type: 'answer', by: 'g', key: 't06', value: true });
    expect(u.state!.res.air).toBe(90);
  });

  it('stale air remembers a reserve battery spent on the Moon', () => {
    let s = run(createSession('CARRY', { id: 'h', name: 'H' }), { type: 'join', id: 'g', name: 'G' }, { type: 'ready', by: 'g', ready: true }, { type: 'setup', by: 'h', incident: 'air', tier: 'middle' });
    s = { ...s, carry: { reserveSpent: true } };
    s = run(s, { type: 'start', by: 'h' });
    expect(s.state!.res.power).toBe(60);
  });

  it('water: the cartridge must arrive before the repair, and the water goes one way or the other', () => {
    for (const choice of ['crew', 'crops']) {
      let s = crewOf('water');
      expect(tryIt(at(s, 'h', 'water'), { type: 'answer', by: 'h', key: 't07', value: [] }).error).toMatch(/comes first/);
      s = run(at(s, 'g', 'cargo'), { type: 'pickup', by: 'g', item: 'cartridge' });
      s = run(at(s, 'g', 'water'), { type: 'deliver', by: 'g' });
      s = solve(s, 'h', 't07');
      s = solve(s, 'g', 'alloc', choice);
      expect(s.phase).toBe('debrief');
      expect(s.outcome!.res.water).toBe(choice === 'crew' ? 80 : 60);
      expect(s.outcome!.res.crops).toBe(choice === 'crew' ? 2 : 3);
    }
  });

  it('relay: the reply arrives a shift late and only if the relay stayed on', () => {
    let s = crewOf('relay');
    s = solve(s, 'g', 't12'); s = solve(s, 'h', 't13'); s = solve(s, 'h', 'relaypower', 'relay');
    expect(liveTasks(s.state!).find((t) => t.key === 'compare')!.available).toBe(false);
    s = run(at(s, 'h', 'bridge'), { type: 'endShift', by: 'h' });
    expect(s.state!.flags.reply).toBe(true);
    const adapt = solve(s, 'h', 'compare', 'adapt');
    const follow = solve(s, 'h', 'compare', 'follow');
    expect(adapt.outcome!.res.readiness).toBe(100);
    expect(follow.outcome!.res.readiness).toBe(80);
    expect(follow.outcome!.cause).toMatch(/before your recovery/);
    let off = crewOf('relay');
    off = solve(off, 'g', 't12'); off = solve(off, 'h', 't13'); off = solve(off, 'h', 'relaypower', 'habitat');
    expect(off.phase).toBe('debrief');
    expect(off.outcome!.res.power).toBe(90);
  });

  it('docking: the Pilot needs the backup thruster, and the approach sets the margin', () => {
    let s = crewOf('docking');
    s = solve(s, 'h', 'approach', 'quick');
    expect(tryIt(at(s, 'h', 'bridge'), { type: 'answer', by: 'h', key: 't02', value: 0 }).error).toMatch(/backup thruster/);
    s = solve(s, 'g', 't14');
    expect(tryIt(at(s, 'h', 'bridge'), { type: 'answer', by: 'h', key: 't02', value: 3 }).ok).toBe(false);
    let g = crewOf('docking');
    g = solve(g, 'g', 't14'); g = solve(g, 'g', 't10'); g = solve(g, 'h', 'approach', 'guided');
    g = run(at(g, 'h', 'bridge'), { type: 'answer', by: 'h', key: 't02', value: 3 });
    expect(g.phase).toBe('debrief');
    expect(g.outcome!.res.fuel).toBe(90);
    expect(g.outcome!.flags.cargoSecured).toBe(true);
    expect(g.outcome!.stars).toBe(3);
  });

  it('quick games finish and count mistakes', () => {
    let s = crewOf('docking_drill');
    s = solve(s, 'g', 't14'); s = solve(s, 'h', 't02');
    expect(s.outcome).toMatchObject({ stars: 3, misses: 0 });
    let c = crewOf('cargo_relay');
    c = solve(c, 'h', 't11'); c = run(at(c, 'h', 'galley'), { type: 'deliver', by: 'h' }); c = solve(c, 'g', 't10');
    expect(c.phase).toBe('debrief');
    let h = crewOf('signal_hunt');
    h = solve(h, 'h', 't13'); h = solve(h, 'g', 't12');
    expect(h.phase).toBe('debrief');
  });

  it('the tour lets the drills be tried and repeated', () => {
    let s = crewOf('tour');
    expect(liveTasks(s.state!).length).toBe(18);
    const keys = liveTasks(s.state!).filter((t) => t.spec.kind !== 'carry').map((t) => t.key);
    for (const k of keys) s = solve(s, 'h', k);
    s = solve(s, 'h', 't08');
    expect(s.phase).toBe('active');
    expect(run(s, { type: 'end', by: 'h' }).outcome!.summary).toMatch(/16 of 18/);
  });
});

describe('solo training', () => {
  it('scripted crew do the jobs at their own stations and leave the decisions to the cadet', () => {
    let s = createSession('SOLO', { id: 'me', name: 'Cadet Me' }, true);
    for (let i = 0; i < 3; i++) s = run(s, { type: 'join', id: `bot${i}`, name: `Crew ${i}`, bot: true });
    s = run(s, { type: 'role', by: 'me', role: 'logistics' }, { type: 'setup', by: 'me', incident: 'meals', tier: 'middle' }, { type: 'start', by: 'me' }, { type: 'briefed', by: 'me' });
    const r = botTurn(s, 1)!;
    expect(r.ok).toBe(true);
    expect(r.session.state!.done).toEqual(['t01']);
    expect(botTurn(r.session, 2)).toBeNull();
    expect(r.session.state!.flags.earlyDock).toBeUndefined();
  });
});
