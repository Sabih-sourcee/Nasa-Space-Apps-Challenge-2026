import { describe, expect, it } from 'vitest';
import {
  ALERT_TUNING, ARM, ARM_LIMITS, LEAKING, abandonExperiment, armAutopilot, armPoints, armSolve, canSeal, choosePlan, declareLeak,
  gaugeTrend, gaugesFor, inspectGauge, makeAlert, makeArm, operateGripper, sealLab, stepAlert, stepArm,
  type AlertState, type ArmState,
} from '../src/sim/station';
import { TIERS, type Tier } from '../src/sim/types';

const DT = 1 / 60;

function wait(s: AlertState, seconds: number, tier: Tier): AlertState {
  for (let i = 0; i < seconds * 60; i++) s = stepAlert(s, DT, tier);
  return s;
}

function driveArm(arm: ArmState, target: { x: number; y: number }, tier: Tier): { arm: ArmState; seconds: number } {
  const mode = ALERT_TUNING[tier].armMode;
  let i = 0;
  for (; i < 60 * 60; i++) {
    const input = armAutopilot(arm, target, mode);
    if (input.moveX === 0 && input.moveY === 0) break;
    arm = stepArm(arm, input, DT, mode);
  }
  return { arm, seconds: i / 60 };
}

describe('S04 module diagnostics', () => {
  it.each(TIERS)('%s: exactly one module is falling, and it is the lab', (tier) => {
    const falling = gaugesFor(tier).filter((g) => gaugeTrend(g) === 'falling');
    expect(falling.map((g) => g.module)).toEqual([LEAKING]);
  });

  it('Junior makes the leak the lowest reading; Middle and Advanced do not', () => {
    const lowest = (tier: Tier) => [...gaugesFor(tier)].sort((a, b) => a.now - b.now)[0].module;
    expect(lowest('junior')).toBe('lab');
    expect(lowest('middle')).toBe('crew');
    expect(lowest('advanced')).toBe('storage');
  });

  it('Advanced adds a second problem: a frozen sensor', () => {
    expect(gaugesFor('advanced').filter((g) => g.sensor === 'frozen').map((g) => g.module)).toEqual(['storage']);
    expect(gaugesFor('middle').every((g) => g.sensor === 'ok')).toBe(true);
  });

  it('a wrong call explains why, costs air, and can be corrected', () => {
    const tier: Tier = 'advanced';
    let s = makeAlert(tier);
    const wrong = declareLeak(s, 'storage', tier);
    expect(wrong.correct).toBe(false);
    expect(wrong.reason).toMatch(/frozen/);
    expect(wrong.state.reserve).toBe(100 - ALERT_TUNING[tier].wrongPenalty);
    expect(wrong.state.diagnosed).toBe(false);
    s = wrong.state;
    const steady = declareLeak(s, 'crew', tier);
    expect(steady.reason).toMatch(/steady/);
    const right = declareLeak(steady.state, 'lab', tier);
    expect(right.correct).toBe(true);
    expect(right.state.diagnosed).toBe(true);
    expect(right.state.wrongCalls).toBe(2);
  });

  it('inspection is recorded per module', () => {
    const s = inspectGauge(inspectGauge(makeAlert('middle'), 'lab'), 'crew');
    expect(s.inspected).toEqual({ lab: true, crew: true, storage: false });
  });
});

describe('S04 leak and the isolate-or-rescue decision', () => {
  it('the leak drains the reserve until the hatch is sealed', () => {
    const tier: Tier = 'middle';
    let s = declareLeak(makeAlert(tier), 'lab', tier).state;
    s = choosePlan(s, 'seal_now');
    s = wait(s, 10, tier);
    expect(s.reserve).toBeCloseTo(100 - 10 * ALERT_TUNING[tier].leakRate, 3);
    s = sealLab(s);
    const after = wait(s, 30, tier);
    expect(after.reserve).toBe(s.reserve);
    expect(after.status).toBe('success');
  });

  it('cannot seal before the leak is diagnosed and a plan is chosen', () => {
    const s = makeAlert('junior');
    expect(canSeal(s)).toBe(false);
    expect(sealLab(s)).toBe(s);
    const d = declareLeak(s, 'lab', 'junior').state;
    expect(canSeal(d)).toBe(false);
    expect(canSeal(choosePlan(d, 'seal_now'))).toBe(true);
  });

  it('sealing now loses the experiment; rescuing first saves it and costs more air', () => {
    const tier: Tier = 'middle';
    const start = wait(declareLeak(makeAlert(tier), 'lab', tier).state, 30, tier);

    const quick = sealLab(wait(choosePlan(start, 'seal_now'), 15, tier));
    expect(quick.experiment).toBe('lost');

    let slow = choosePlan(start, 'save_first');
    const toCan = driveArm(slow.arm, ARM.canister, tier);
    slow = wait({ ...slow, arm: toCan.arm }, toCan.seconds, tier);
    const grip = operateGripper(slow, tier);
    expect(grip.result).toBe('gripped');
    const toPort = driveArm(grip.state.arm, ARM.port, tier);
    slow = wait({ ...grip.state, arm: toPort.arm }, toPort.seconds, tier);
    const rel = operateGripper(slow, tier);
    expect(rel.result).toBe('released');
    slow = sealLab(wait(rel.state, 15, tier));
    expect(slow.experiment).toBe('safe');
    expect(slow.status).toBe('success');
    expect(slow.reserve).toBeLessThan(quick.reserve);
  });

  it.each(TIERS)('%s: both plans finish above the critical reserve at a steady pace', (tier) => {
    const tune = ALERT_TUNING[tier];
    const diagnosed = wait(declareLeak(makeAlert(tier), 'lab', tier).state, 60, tier);
    const quick = sealLab(wait(choosePlan(diagnosed, 'seal_now'), 20, tier));
    expect(quick.status).toBe('success');
    expect(quick.reserve).toBeGreaterThan(tune.critical);

    let s = choosePlan(diagnosed, 'save_first');
    const a = driveArm(s.arm, ARM.canister, tier);
    s = operateGripper(wait({ ...s, arm: a.arm }, a.seconds + 10, tier), tier).state;
    const b = driveArm(s.arm, ARM.port, tier);
    s = operateGripper(wait({ ...s, arm: b.arm }, b.seconds + 10, tier), tier).state;
    s = sealLab(wait(s, 20, tier));
    expect(s.experiment).toBe('safe');
    expect(s.reserve).toBeGreaterThan(tune.critical);
  });

  it('ignoring the leak ends in a recoverable critical outcome', () => {
    const tier: Tier = 'advanced';
    const s = wait(makeAlert(tier), 300, tier);
    expect(s.status).toBe('critical');
    expect(s.reserve).toBeLessThan(ALERT_TUNING[tier].critical);
    expect(makeAlert(tier).status).toBe('active'); // the checkpoint state is untouched
  });

  it('abandoning the rescue switches to sealing now', () => {
    const tier: Tier = 'middle';
    let s = choosePlan(declareLeak(makeAlert(tier), 'lab', tier).state, 'save_first');
    s = abandonExperiment(s);
    expect(s.plan).toBe('seal_now');
    expect(sealLab(s).experiment).toBe('lost');
  });

  it('is deterministic', () => {
    const run = () => wait(declareLeak(makeAlert('middle'), 'crew', 'middle').state, 12, 'middle');
    expect(run()).toEqual(run());
  });
});

describe('S04 robotic arm', () => {
  it('forward and inverse kinematics agree', () => {
    for (const target of [ARM.canister, ARM.port, { x: 1.2, y: 2.4 }]) {
      const p = armPoints(armSolve(target.x, target.y));
      expect(p.x).toBeCloseTo(target.x, 5);
      expect(p.y).toBeCloseTo(target.y, 5);
    }
  });

  it('both targets sit inside the joint limits, with room to spare', () => {
    for (const target of [ARM.canister, ARM.port]) {
      const j = armSolve(target.x, target.y);
      expect(j.shoulder).toBeGreaterThan(ARM_LIMITS.shoulder[0] + 0.1);
      expect(j.shoulder).toBeLessThan(ARM_LIMITS.shoulder[1] - 0.1);
      expect(j.elbow).toBeGreaterThan(ARM_LIMITS.elbow[0] + 0.1);
      expect(j.elbow).toBeLessThan(ARM_LIMITS.elbow[1] - 0.1);
    }
  });

  it.each(TIERS)('%s: a steady operator finishes each arm move in a few seconds', (tier) => {
    const a = driveArm(makeArm(), ARM.canister, tier);
    const b = driveArm(a.arm, ARM.port, tier);
    expect(a.seconds).toBeLessThan(8);
    expect(b.seconds).toBeLessThan(8);
    const p = armPoints(b.arm);
    expect(Math.hypot(p.x - ARM.port.x, p.y - ARM.port.y)).toBeLessThan(0.1);
  });

  it('player input moves the arm, and no input holds it still', () => {
    const a = makeArm();
    expect(stepArm(a, { moveX: 0, moveY: 0 }, DT, 'joints')).toBe(a);
    const swung = stepArm(a, { moveX: 1, moveY: 0 }, 0.5, 'joints');
    expect(swung.shoulder).toBeLessThan(a.shoulder);
    expect(armPoints(swung).x).toBeGreaterThan(armPoints(a).x);
    const bent = stepArm(a, { moveX: 0, moveY: -1 }, 0.5, 'joints');
    expect(bent.elbow).toBeLessThan(a.elbow);
    const tip = stepArm(a, { moveX: 1, moveY: 0 }, 0.5, 'tip');
    expect(armPoints(tip).x - armPoints(a).x).toBeCloseTo(ARM.tipSpeed * 0.5, 2);
  });

  it.each(TIERS)('%s: the arm can reach the canister and the transfer port', (tier) => {
    const tol = ALERT_TUNING[tier].gripTol;
    const a = driveArm(makeArm(), ARM.canister, tier);
    const pa = armPoints(a.arm);
    expect(Math.hypot(pa.x - ARM.canister.x, pa.y - ARM.canister.y)).toBeLessThan(tol);
    const b = driveArm(a.arm, ARM.port, tier);
    const pb = armPoints(b.arm);
    expect(Math.hypot(pb.x - ARM.port.x, pb.y - ARM.port.y)).toBeLessThan(tol);
  });

  it('the gripper only grips at the canister and only releases at the port', () => {
    const tier: Tier = 'middle';
    let s = choosePlan(declareLeak(makeAlert(tier), 'lab', tier).state, 'save_first');
    expect(operateGripper(s, tier).result).toBe('too_far');
    s = { ...s, arm: armSolve(ARM.canister.x, ARM.canister.y) };
    const grip = operateGripper(s, tier);
    expect(grip.result).toBe('gripped');
    expect(operateGripper(grip.state, tier).result).toBe('not_over_port');
    const atPort = { ...grip.state, arm: armSolve(ARM.port.x, ARM.port.y) };
    const rel = operateGripper(atPort, tier);
    expect(rel.result).toBe('released');
    expect(rel.state.experiment).toBe('safe');
    expect(operateGripper(rel.state, tier).result).toBe('none');
  });

  it('Junior steers the gripper directly; higher tiers steer the joints', () => {
    expect(ALERT_TUNING.junior.armMode).toBe('tip');
    expect(ALERT_TUNING.middle.armMode).toBe('joints');
    expect(ALERT_TUNING.advanced.armMode).toBe('joints');
  });
});
