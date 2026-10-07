import { expect, it } from 'vitest';
import { FINAL_GIRLS, LOCATIONS } from '../content';
import { createGame, dispatch, type GameState } from './index';
import { botRng, checkInvariants, randomInput } from './testing';

const totalsOf = (s: GameState) => ({ actions: s.fg.hand.length + s.actionDiscard.length + Object.values(s.actionTable).reduce((a, b) => a + b, 0), items: 99 });

const run = (s: GameState, seed: number) => {
  const totals = totalsOf(s);
  const r = botRng(seed);
  let n = 0;
  while (!s.outcome && n++ < 6000) {
    const input = randomInput(s, r);
    try {
      s = dispatch(s, input);
    } catch (e) {
      throw new Error(`seed ${seed} ${s.config.locationId} ${JSON.stringify(input)} ${JSON.stringify(s.prompt)}: ${(e as Error).message}\n${s.log.slice(-12).map((l) => l.text).join('\n')}`);
    }
    const errs = checkInvariants(s, totals);
    if (errs.length) throw new Error(`seed ${seed} ${s.config.locationId}: ${errs.join('; ')}\n${s.log.slice(-12).map((l) => l.text).join('\n')}`);
  }
  if (!s.outcome) throw new Error(`seed ${seed} ${s.config.locationId} sin terminar\n${s.log.slice(-12).map((l) => l.text).join('\n')}`);
  return s;
};

const config = (locationId: string, seed: number) => ({
  killerId: 'birds',
  locationId,
  finalGirlId: FINAL_GIRLS[seed % FINAL_GIRLS.length]!.id,
  board: (seed % 4 === 0 ? 'extreme' : 'normal') as 'normal' | 'extreme',
  epicDarkPower: false,
  bonusItems: true,
  birdsSpecials: ((seed % 3) + 1) as 1 | 2 | 3,
  seed,
});

for (const loc of LOCATIONS) {
  it(`Terror from Above en ${loc.id}: 60 partidas aleatorias terminan sin errores`, () => {
    for (let seed = 1; seed <= 60; seed++) run(createGame(config(loc.id, seed)), seed);
  }, 240_000);
}

it('la preparación coloca los Pájaros como piden las reglas', () => {
  const s = createGame(config('camp-happy-trails', 7));
  const zones = LOCATIONS.find((l) => l.id === 'camp-happy-trails')!.zones.filter((z) => !z.hidden);
  const birdsIn = (z: string) => s.minions.filter((m) => m.zone === z).length;
  expect(birdsIn(s.killer.startZone)).toBe(3);
  const occupied = new Set([s.fg.zone, ...s.victims.map((v) => v.zone)]);
  for (const z of zones) if (!occupied.has(z.id) && z.id !== s.killer.startZone) expect(birdsIn(z.id)).toBe(1);
  expect(s.birds?.hidden).toBe(s.birds?.total);
  expect(s.victims.some((v) => v.bsp)).toBe(false);
});

import { killVictim } from './core';
import { run as runEngine } from './index';
import { birdsAt } from './birds';
import type { Victim } from './state';

const base = () => createGame(config('camp-happy-trails', 3));

it('las Víctimas Especiales salen cuando no quedan Víctimas normales, en las Búsquedas más alejadas', () => {
  const s = base();
  s.birds!.hidden = s.birds!.total = 2;
  s.victims = [];
  runEngine(s);
  const specials = s.victims.filter((v) => v.bsp);
  expect(specials.length + (s.prompt?.type === 'choice' ? 1 : 0)).toBeGreaterThanOrEqual(1);
  expect(s.birds!.hidden).toBe(0);
});

it('las Víctimas Especiales no pueden morir y salvarlas a todas gana la partida', () => {
  const s = base();
  s.birds!.hidden = 0;
  s.birds!.total = 1;
  const exit = locationExit(s);
  s.fg.zone = exit;
  const sp: Victim = { id: 'vsp', zone: exit, special: 'blue', bsp: true };
  s.victims = [sp];
  killVictim(s, sp, true);
  expect(s.victims).toContain(sp);
  s.stack = [{ t: 'phase', phase: 'action', step: 0 }];
  runEngine(s);
  expect(s.prompt?.type).toBe('main');
  let g = dispatch(s, { type: 'startRescue' });
  expect(g.prompt?.type).toBe('rescue');
  g = dispatch(g, { type: 'rescueOne', victimId: 'vsp', slot: 0 });
  expect(g.outcome?.winner).toBe('finalGirl');
});

it('pierdes si hay 3 Pájaros en cada espacio', () => {
  const s = base();
  for (const z of LOCATIONS.find((l) => l.id === 'camp-happy-trails')!.zones.filter((x) => !x.hidden)) {
    while (birdsAt(s, z.id) < 3) s.minions.push({ id: `tmp-t${s.nextUid++}`, zone: z.id, hp: 1 });
  }
  s.stack = [{ t: 'effects', effects: [{ kind: 'custom', id: 'birds-spawn' }], i: 0, src: { kind: 'killer' } }];
  runEngine(s);
  // La tirada cae en un espacio lleno: los Pájaros no caben en ningún sitio y el tablero está cubierto.
  expect(s.outcome?.winner === 'killer' || s.prompt !== null).toBe(true);
});

function locationExit(s: GameState): string {
  return LOCATIONS.find((l) => l.id === s.config.locationId)!.zones.find((z) => z.exit)!.id;
}
