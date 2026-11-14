// Authored outpost scenarios. Energy "units" are invented game units. Shift
// lengths are compressed. The lunar solar alert uses an archived NASA record
// for its date and identifier only; power and protection effects are game rules.

import type { ActionSpec, EventSpec, ScenarioSpec, TurnSpec } from './outpost';
import type { Tier } from './types';

// --------------------------------------------------------------------------
// Shared action builders
// --------------------------------------------------------------------------

const airFull = (locked: boolean, detail = 'Fans and scrubbers at full power. Air stays fresh.'): ActionSpec => ({
  id: 'air_full', label: 'Air support: full power', detail, cost: 3,
  ...(locked ? { locked: true } : { group: 'Air support' }),
  effects: [{ kind: 'res', res: 'air', delta: 10 }, { kind: 'flag', flag: 'air_eco', value: false }],
});

const airEco = (drop: number): ActionSpec => ({
  id: 'air_eco', label: 'Air support: eco mode', group: 'Air support', cost: 2,
  detail: `Saves 1 unit, but the air gets stuffy (Air -${drop}).`,
  effects: [{ kind: 'res', res: 'air', delta: -drop }, { kind: 'flag', flag: 'air_eco', value: true }],
  lesson: 'Eco air saves one unit now, and the crew pays for it with stuffier air.',
  blame: true,
});

const SOLAR_ALERT: EventSpec = {
  id: 'solar_alert', phase: 'start', trigger: { type: 'scheduled' }, level: 'alert',
  warning: 'SOLAR PARTICLE ALERT. Fast particles from the Sun are on the way. Choose a shelter plan.',
  symptom: 'The alert beacon is flashing and the shelter hatch is lit.',
  effects: [{ kind: 'flag', flag: 'alert_active', value: true }],
  debrief: 'A solar particle alert sent the crew to the shelter. The alert date and ID come from an archived NASA record. Its effects in the game are invented rules.',
  sourceId: 'donki_alert', highlight: 'shelter',
};

const shelterBasic = (airDrop: number): ActionSpec => ({
  id: 'shelter_basic', label: 'Basic shelter plan', group: 'Shelter plan', cost: 0,
  detail: `Crew moves behind the thick shelter walls. No fans, so the air gets stuffy (Air -${airDrop}).`,
  effects: [
    { kind: 'flag', flag: 'sheltered', value: true },
    { kind: 'flag', flag: 'shelter_fans', value: false },
    { kind: 'res', res: 'air', delta: -airDrop },
  ],
  lesson: 'The shelter walls protect the crew without power, but without fans the air gets stuffy.',
});

const shelterFans: ActionSpec = {
  id: 'shelter_fans', label: 'Upgraded shelter: powered fans', group: 'Shelter plan', cost: 2,
  detail: 'Same thick walls, plus powered ventilation so the air stays fresh. Needs 2 units.',
  effects: [
    { kind: 'flag', flag: 'sheltered', value: true },
    { kind: 'flag', flag: 'shelter_fans', value: true },
  ],
  lesson: 'Two banked units ran the shelter fans, so the crew stayed protected and comfortable.',
};

const keepWorking: ActionSpec = {
  id: 'keep_working', label: 'Keep working at the lab bench', group: 'Shelter plan', cost: 0,
  detail: 'Finish the experiment now (Science +1) and skip the shelter.',
  effects: [
    { kind: 'flag', flag: 'sheltered', value: false },
    { kind: 'res', res: 'protection', delta: -70 },
    { kind: 'res', res: 'science', delta: 1 },
  ],
  lesson: 'Staying outside the shelter during a solar particle alert leaves the crew unprotected.',
  blame: true,
};

// --------------------------------------------------------------------------
// L02 - Moon: Power Before Shadow
// --------------------------------------------------------------------------

const SHADOW_NEXT: EventSpec = {
  id: 'shadow_arrives', phase: 'resolve', trigger: { type: 'scheduled' }, level: 'caution',
  warning: 'SHADOW. The Sun has slipped behind the crater rim. The panels will make only 2 units next shift.',
  symptom: 'The window goes dark and the solar gauge drops.',
  effects: [{ kind: 'flag', flag: 'in_shadow', value: true }],
  debrief: 'Sunlight at the lunar south pole comes and goes as the Sun skims the horizon, so stored power matters.',
  sourceId: 'lunar_illum', highlight: 'power',
};

function moonJunior(): TurnSpec[] {
  return [
    {
      id: 'shadow', title: 'Shadow shift', station: 'power', income: 2,
      narrative: 'Earlier, the crew banked 3 units in the battery. Now the panels are in shadow and make only 2 units. Air support needs 3.',
      hint: 'The battery holds saved power. You can move 1 unit to the air system, or keep it for later.',
      actions: [
        {
          id: 'air_reroute', label: 'Send 1 battery unit to air support', group: 'Air support', cost: 3,
          detail: 'Air support runs at full power. The battery goes down by 1.',
          effects: [{ kind: 'flag', flag: 'air_eco', value: false }],
          lesson: 'Sending battery power to the air system kept the air fresh and left less power saved.',
        },
        {
          id: 'air_save', label: 'Save the battery', group: 'Air support', cost: 2,
          detail: 'Air support runs on panel power only. The air gets stuffy (Air -25).',
          effects: [{ kind: 'res', res: 'air', delta: -25 }, { kind: 'flag', flag: 'air_eco', value: true }],
          lesson: 'Saving the battery kept more power for later and made the air stuffier.',
        },
      ],
      events: [
        {
          id: 'low_generation', phase: 'start', trigger: { type: 'scheduled' }, level: 'caution',
          warning: 'LOW POWER. The Sun is behind the crater rim. Panels make 2 units. Go to the power console.',
          symptom: 'The window is dark and the power console is flashing.',
          effects: [{ kind: 'flag', flag: 'in_shadow', value: true }],
          debrief: 'Sunlight at the lunar south pole comes and goes, so stored power matters.',
          sourceId: 'lunar_illum', highlight: 'power',
        },
      ],
    },
    {
      id: 'solar_alert', title: 'Solar alert', station: 'shelter', income: 0,
      narrative: 'A solar particle alert arrives. The shelter walls protect the crew. Fans inside the shelter need battery power.',
      hint: 'The walls do the protecting. Power only runs the fans.',
      actions: [shelterBasic(15), shelterFans],
      events: [SOLAR_ALERT],
    },
  ];
}

function moonMiddle(): TurnSpec[] {
  return [
    {
      id: 'sunny', title: 'Sunny shift', station: 'power', income: 6,
      narrative: 'The panels are in full sunlight and make 6 units. Air support uses 3. What happens to the rest?',
      hint: 'Shadow is coming. Anything you do not spend is banked in the battery.',
      actions: [
        airFull(true),
        {
          id: 'lights_on', label: 'Run the grow lights', group: 'Grow lights', cost: 2,
          detail: 'Crops grow this shift (Crops +2). 1 unit is left to bank.',
          effects: [{ kind: 'res', res: 'crop', delta: 2 }, { kind: 'flag', flag: 'lights_ran', value: true }],
          lesson: 'Running the grow lights grew the crops and left two fewer battery units for the shadow.',
        },
        {
          id: 'lights_off', label: 'Skip the lights and bank power', group: 'Grow lights', cost: 0,
          detail: 'All 3 spare units go to the battery. The crop milestone is delayed.',
          effects: [{ kind: 'flag', flag: 'lights_ran', value: false }],
          lesson: 'Banking power left two more battery units for the shadow, and the plants had to wait.',
        },
      ],
      events: [SHADOW_NEXT],
    },
    {
      id: 'solar_alert', title: 'Shadow and solar alert', station: 'shelter', income: 2,
      narrative: 'Panels make 2 units in shadow. A separate solar particle alert has arrived. Plan the air system and the shelter.',
      actions: [airFull(false), airEco(25), shelterBasic(20), shelterFans, keepWorking],
      events: [SOLAR_ALERT],
    },
    {
      id: 'harvest', title: 'Harvest check', station: 'grow', income: 4,
      narrative: 'The alert has passed and a little sunlight is back: 4 units. Check the plants.',
      actions: [
        airFull(true),
        {
          id: 'lights_catchup', label: 'Run the grow lights now', group: 'Grow rack', cost: 1,
          detail: 'A short catch-up session (Crops +1).',
          effects: [{ kind: 'res', res: 'crop', delta: 1 }, { kind: 'flag', flag: 'lights_ran', value: true }],
        },
        {
          id: 'bank_spare', label: 'Bank the spare unit', group: 'Grow rack', cost: 0,
          detail: 'Leave the lights off and keep the power.',
          effects: [{ kind: 'flag', flag: 'lights_ran', value: false }],
        },
      ],
      events: [
        {
          id: 'harvest_ready', phase: 'resolve', trigger: { type: 'atLeast', res: 'crop', value: 3 }, level: 'info',
          warning: 'HARVEST READY. The lettuce reached its milestone on time.',
          symptom: 'The grow rack is full of green leaves.',
          effects: [{ kind: 'flag', flag: 'harvest', value: true }],
          debrief: 'The crops reached their milestone because the lights ran during the sunny shift.',
          sourceId: 'veggie', highlight: 'grow',
        },
        {
          id: 'harvest_delayed', phase: 'resolve', trigger: { type: 'below', res: 'crop', value: 3 }, level: 'caution',
          warning: 'HARVEST DELAYED. The plants need another sunny shift.',
          symptom: 'The grow rack holds small seedlings.',
          effects: [{ kind: 'flag', flag: 'harvest', value: false }],
          debrief: 'The harvest is late because the lights stayed off during the sunny shift.',
          sourceId: 'veggie', highlight: 'grow',
        },
      ],
    },
  ];
}

function moonAdvanced(): TurnSpec[] {
  const base = moonMiddle();
  const sunny = base[0];
  sunny.narrative = 'Full sunlight: 6 units. Air support uses 3. Grow lights, a question for Earth and the battery all want the rest.';
  sunny.actions.push({
    id: 'ask_earth', label: 'Ask Earth for the solar forecast', cost: 1,
    detail: 'Power the relay dish and send a question. The reply arrives after your next decision.',
    effects: [{
      kind: 'message', id: 'earth_forecast', from: 'Mission Control, Earth', delayTurns: 1, setsFlag: 'earth_reply',
      text: 'Our archive check says particle levels stay high for one more shift. Keep the crew in the shelter. Try our low-power air schedule: full air for 2 units.',
    }, { kind: 'flag', flag: 'asked_earth', value: true }],
    lesson: 'Asking Earth cost one unit early. The answer came late, and it made the last shift cheaper.',
  });
  const alert = base[1];
  alert.narrative = 'Shadow and a solar particle alert at the same time. Panels make 2 units. Any reply from Earth has not arrived yet.';
  alert.actions.push({
    id: 'run_experiment', label: 'Run the dust experiment', cost: 1,
    detail: 'Optional research (Science +1).',
    effects: [{ kind: 'res', res: 'science', delta: 1 }],
    lesson: 'The experiment earned science and used a unit the crew could have saved.',
  });
  const last: TurnSpec = {
    id: 'alert_continues', title: 'Alert continues', station: 'air', income: 3,
    narrative: 'The alert lasts one more shift. Panels make 3 units. Decide how to run the air, the plants and the lab.',
    actions: [
      airFull(false),
      airEco(25),
      {
        id: 'air_smart', label: "Air support: Earth's low-power schedule", group: 'Air support', cost: 2, requiresFlag: 'earth_reply',
        detail: 'Full fresh air for 2 units, thanks to the plan Earth sent.',
        effects: [{ kind: 'res', res: 'air', delta: 10 }, { kind: 'flag', flag: 'air_eco', value: false }],
        lesson: "Earth's reply arrived after the shelter decision and still saved a unit on the last shift.",
      },
      {
        id: 'lights_catchup', label: 'Run the grow lights', cost: 1,
        detail: 'A short session for the plants (Crops +1).',
        effects: [{ kind: 'res', res: 'crop', delta: 1 }, { kind: 'flag', flag: 'lights_ran', value: true }],
      },
      {
        id: 'run_experiment_2', label: 'Run the dust experiment', cost: 1,
        detail: 'Optional research (Science +1).',
        effects: [{ kind: 'res', res: 'science', delta: 1 }],
      },
    ],
    events: base[2].events,
  };
  return [sunny, alert, last];
}

// --------------------------------------------------------------------------
// M04 - Mars: Dust Storm Outpost
// --------------------------------------------------------------------------

const DUST_FRONT: EventSpec = {
  id: 'dust_front', phase: 'start', trigger: { type: 'scheduled' }, level: 'caution',
  warning: 'DUST STORM. Dust is covering the solar panels. Power is dropping. Go to the power console.',
  symptom: 'The sky outside turns dark orange and the solar gauge falls.',
  effects: [{ kind: 'flag', flag: 'storm', value: true }],
  debrief: 'Dust in the Martian sky and on the panels blocks sunlight, so the outpost makes less power.',
  sourceId: 'mars_dust', highlight: 'power',
};

const STORM_PEAK: EventSpec = {
  id: 'storm_peak', phase: 'start', trigger: { type: 'scheduled' }, level: 'alert',
  warning: 'STORM PEAK. The panels are making very little power. Plan the air system.',
  symptom: 'The window is almost dark. The battery gauge is the brightest light in the room.',
  effects: [],
  debrief: 'At the peak of the storm the outpost had to live on stored power.',
  sourceId: 'mars_dust', highlight: 'air',
};

const sweepNow: ActionSpec = {
  id: 'sweep_now', label: 'Run the panel brush now', group: 'Solar panels', cost: 1,
  detail: 'Costs 1 unit today. Clean panels make 2 extra units in each later shift.',
  effects: [{ kind: 'flag', flag: 'swept', value: true }],
  lesson: 'Spending one unit on the brush early brought back two units in every later shift.',
};

const savePower: ActionSpec = {
  id: 'save_power', label: 'Save the unit', group: 'Solar panels', cost: 0,
  detail: 'Keep the power in the battery. The panels stay dusty.',
  effects: [{ kind: 'flag', flag: 'swept', value: false }],
  lesson: 'Saving the unit left the panels dusty, so every later shift made less power.',
};

const backupCells: ActionSpec = {
  id: 'backup_cells', label: "Plug in the lander's backup cells", cost: -2, forbidsFlag: 'backup_used',
  detail: 'Adds 2 units right now. The sample drill cannot run tomorrow.',
  effects: [{ kind: 'flag', flag: 'backup_used', value: true }],
  lesson: 'The backup cells rescued the air system and cost the crew tomorrow\'s drilling.',
};

const SWEPT_BONUS = [{ flag: 'swept', amount: 2, note: 'Clean panels: +2 units' }];

const heaterOn: ActionSpec = {
  id: 'heater_on', label: 'Crop heater on', group: 'Crop heater', cost: 1,
  detail: 'Keeps the plants warm through the cold storm.',
  effects: [{ kind: 'flag', flag: 'lights_ran', value: true }],
};
const heaterOff: ActionSpec = {
  id: 'heater_off', label: 'Crop heater off', group: 'Crop heater', cost: 0,
  detail: 'Saves 1 unit. The plants get cold (Crops -1).',
  effects: [{ kind: 'res', res: 'crop', delta: -1 }, { kind: 'flag', flag: 'lights_ran', value: false }],
  lesson: 'Turning the heater off saved a unit and set the crops back.',
};

function marsTurns(tier: Tier): TurnSpec[] {
  const junior = tier === 'junior';
  const eco = junior ? 25 : 30;
  const heater = junior ? [] : [heaterOn, heaterOff];
  const t0: TurnSpec = {
    id: 'dust_front', title: 'Dust front', station: 'power', income: junior ? 3 : 4,
    narrative: junior
      ? 'The storm is here. Dusty panels make 3 units and the battery holds 2. Air support uses 3.'
      : 'The storm is here. Dusty panels make 4 units and the battery holds 2. Air support uses 3.',
    hint: 'A clean panel makes more power later. A full battery helps right now.',
    actions: [airFull(true), sweepNow, savePower, ...heater],
    events: [DUST_FRONT],
  };
  const t1: TurnSpec = {
    id: 'storm_peak', title: 'Storm peak', station: 'air', income: 1, incomeBonuses: SWEPT_BONUS,
    narrative: 'Storm peak. Dusty panels make only 1 unit. Clean panels make 3.',
    actions: [airFull(false), airEco(eco), ...heater],
    events: [STORM_PEAK],
  };
  const t2: TurnSpec = {
    id: 'storm_tail', title: 'Last storm shift', station: 'power', income: 1,
    incomeBonuses: [...SWEPT_BONUS, { flag: 'earth_reply', amount: 1, note: "Earth's panel tilt: +1 unit" }],
    narrative: 'One more dusty shift before the sky clears. If power runs short, the lander has backup cells.',
    hint: 'If you cannot pay for air, plug in the backup cells first.',
    actions: [airFull(false), airEco(eco), ...heater, backupCells],
    events: [
      {
        id: 'storm_tail', phase: 'start', trigger: { type: 'scheduled' }, level: 'caution',
        warning: 'STORM CONTINUES. One more low-power shift. Go to the power console.',
        symptom: 'Dust still streams past the window.',
        effects: [], debrief: 'The storm lasted longer than one shift, so early choices kept mattering.',
        sourceId: 'mars_dust', highlight: 'power',
      },
      {
        id: 'storm_clears', phase: 'resolve', trigger: { type: 'scheduled' }, level: 'info',
        warning: 'STORM CLEARING. Sunlight is returning to the panels.',
        symptom: 'The window brightens to a pale orange.',
        effects: [{ kind: 'flag', flag: 'storm', value: false }],
        debrief: 'The outpost made it through the storm on the power plan you chose.',
        sourceId: 'mars_dust',
      },
    ],
  };
  if (tier === 'advanced') {
    t0.narrative = 'The storm is here. Dusty panels make 4 units and the battery holds 2. Air, panels, crops and a message to Earth all want power.';
    t0.actions.push({
      id: 'ask_earth', label: 'Ask Earth for storm advice', cost: 1,
      detail: 'Send a question. A radio signal takes 4 to 24 minutes to cross to Earth, so the reply arrives after your next decision.',
      effects: [{
        kind: 'message', id: 'earth_storm', from: 'Mission Control, Earth', delayTurns: 1, setsFlag: 'earth_reply',
        text: 'Storm models show a bright gap coming. We sent a new tilt angle to your panels: expect 1 extra unit next shift.',
      }, { kind: 'flag', flag: 'asked_earth', value: true }],
      lesson: 'The message to Earth cost a unit, and the reply came too late for the storm peak, but it helped the last shift.',
    });
    const sample: ActionSpec = {
      id: 'dust_lab', label: 'Analyse a dust sample', cost: 1,
      detail: 'Optional research (Science +1).',
      effects: [{ kind: 'res', res: 'science', delta: 1 }],
    };
    t1.actions.push(sample);
    t2.actions.push({ ...sample, id: 'dust_lab_2' });
  }
  return [t0, t1, t2];
}

// --------------------------------------------------------------------------

export function buildScenario(missionId: 'L02' | 'M04', tier: Tier): ScenarioSpec {
  if (missionId === 'L02') {
    const junior = tier === 'junior';
    return {
      id: `L02-${tier}`, missionId, tier, world: 'moon',
      meters: junior ? ['air', 'battery'] : ['air', 'battery', 'crop'],
      start: { air: 100, battery: junior ? 3 : 0, crop: junior ? 2 : 1, protection: 100, science: 0 },
      startFlags: { lights_ran: false },
      turns: junior ? moonJunior() : tier === 'middle' ? moonMiddle() : moonAdvanced(),
      critical: [
        { res: 'protection', below: 50, explanation: 'The crew was outside the shelter during the solar particle alert, so Mission Control stopped the shift.' },
        { res: 'air', below: 40, explanation: 'The air got too stuffy to keep working, so Mission Control stopped the shift.' },
      ],
      intro: 'Run the lunar habitat through a drop in solar power and a solar particle alert.',
    };
  }
  const junior = tier === 'junior';
  return {
    id: `M04-${tier}`, missionId, tier, world: 'mars',
    meters: junior ? ['air', 'battery'] : ['air', 'battery', 'crop'],
    start: { air: 100, battery: 2, crop: 2, protection: 100, science: 0 },
    startFlags: { lights_ran: true },
    turns: marsTurns(tier),
    critical: [
      { res: 'air', below: junior ? 40 : 45, explanation: 'The air got too thin and stuffy to keep working, so the crew moved back to the lander.' },
    ],
    intro: 'Keep the Mars outpost running while a dust storm cuts solar power.',
  };
}

const cache = new Map<string, ScenarioSpec>();
export function getScenario(missionId: 'L02' | 'M04', tier: Tier): ScenarioSpec {
  const key = `${missionId}-${tier}`;
  let scn = cache.get(key);
  if (!scn) { scn = buildScenario(missionId, tier); cache.set(key, scn); }
  return scn;
}

export function scenarioById(id: string): ScenarioSpec | null {
  const [mission, tier] = id.split('-');
  if ((mission === 'L02' || mission === 'M04') && (tier === 'junior' || tier === 'middle' || tier === 'advanced')) {
    return getScenario(mission, tier);
  }
  return null;
}
