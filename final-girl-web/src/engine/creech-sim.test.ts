import { expect, it } from 'vitest';
import { createGame, dispatch, type GameState } from './index';
import { itemDef, locationDef } from './lookup';
import { botRng, checkInvariants, randomInput } from './testing';

const run = (s: GameState, seed: number, totals: { actions: number; items: number }) => {
  const r = botRng(seed);
  let n = 0;
  while (!s.outcome && n++ < 4000) {
    const input = randomInput(s, r);
    try {
      s = dispatch(s, input);
    } catch (e) {
      throw new Error(`seed ${seed} ${JSON.stringify(input)} ${JSON.stringify(s.prompt)}: ${(e as Error).message}\n${s.log.slice(-12).map((l) => l.text).join('\n')}`);
    }
    const errs = checkInvariants(s, totals);
    if (errs.length) throw new Error(`seed ${seed}: ${errs.join('; ')}\n${s.log.slice(-12).map((l) => l.text).join('\n')}`);
  }
  if (!s.outcome) throw new Error(`seed ${seed} sin terminar\n${s.log.slice(-12).map((l) => l.text).join('\n')}`);
  return s;
};

const totalsOf = (s: GameState) => ({ actions: s.fg.hand.length + s.actionDiscard.length + Object.values(s.actionTable).reduce((a, b) => a + b, 0), items: 99 });

it('Creech Manor: 120 partidas aleatorias terminan sin errores', () => {
  const outcomes = { finalGirl: 0, killer: 0 };
  for (let seed = 1; seed <= 120; seed++) {
    const fgId = ['alice', 'selena'][seed % 2]!;
    const s = createGame({ killerId: 'poltergeist', locationId: 'creech-manor', finalGirlId: fgId, board: seed % 3 === 0 ? 'extreme' : 'normal', epicDarkPower: seed % 5 === 0, bonusItems: true, seed });
    outcomes[run(s, seed, totalsOf(s)).outcome!.winner]++;
  }
  expect(outcomes.finalGirl + outcomes.killer).toBe(120);
}, 180_000);

it('Creech Manor: 120 partidas con todos los objetos en la mochila terminan sin errores', () => {
  for (let seed = 1; seed <= 120; seed++) {
    const fgId = ['alice', 'selena', 'asami', 'laurie'][seed % 4]!;
    const s = createGame({ killerId: 'poltergeist', locationId: 'creech-manor', finalGirlId: fgId, board: 'normal', epicDarkPower: seed % 4 === 0, bonusItems: true, seed });
    const loc = locationDef(s);
    const bonus = fgId === 'alice' ? ['rifle-de-alice'] : fgId === 'selena' ? ['linterna-de-selena'] : [];
    const ids = [...loc.items.map((i) => i.id), ...bonus];
    s.fg.items = ids.map((id, i) => ({ uid: `t${i}`, id, inHands: false, ...(itemDef(s, id).uses ? { uses: itemDef(s, id).uses } : {}) }));
    const weapon = [['cuchillo'], ['daga-ritual'], ['viejo-revolver'], ['rifle'], bonus, ['vela']][seed % 6]!;
    for (const it of s.fg.items) it.inHands = weapon.includes(it.id) && itemDef(s, it.id).hands <= 1;
    run(s, seed, totalsOf(s));
  }
}, 180_000);

it('Creech Manor: otros Asesinos y Lugares se pueden mezclar', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const s = createGame({ killerId: seed % 2 ? 'poltergeist' : 'hans', locationId: seed % 2 ? 'camp-happy-trails' : 'creech-manor', finalGirlId: 'selena', board: 'normal', epicDarkPower: false, bonusItems: true, seed });
    run(s, seed, totalsOf(s));
  }
}, 120_000);
