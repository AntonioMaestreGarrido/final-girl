import { expect, it } from 'vitest';
import { createGame, dispatch, type GameState } from './index';
import { itemDef, locationDef } from './lookup';
import { botRng, checkInvariants, randomInput } from './testing';

/** Partidas aleatorias en Carnage at the Carnival con todos los objetos del Lugar en la mochila. */
it('Carnival of Blood: 120 partidas con todos los objetos terminan sin errores', () => {
  for (let seed = 1; seed <= 120; seed++) {
    const fgId = ['asami', 'charlie', 'laurie', 'adelaide'][seed % 4]!;
    let s: GameState = createGame({ killerId: 'geppetto', locationId: 'carnival-of-blood', finalGirlId: fgId, board: seed % 3 === 0 ? 'extreme' : 'normal', epicDarkPower: seed % 5 === 0, bonusItems: true, seed });
    const loc = locationDef(s);
    const tools = loc.items.filter((i) => !i.trap).map((i) => i.id);
    const bonus = fgId === 'asami' ? ['cinturon-de-cuchillos-de-asami'] : fgId === 'charlie' ? ['martillo-gigante-de-charlie'] : [];
    const ids = [...tools, ...bonus];
    s.fg.items = ids.map((id, i) => ({ uid: `t${i}`, id, inHands: false, ...(itemDef(s, id).uses ? { uses: itemDef(s, id).uses } : {}) }));
    const weapon = [['latigo', 'cuchillo'], ['hacha-arrojadiza'], ['bandolera-de-cuchillos'], ['martillo-de-forzudo'], ['pertiga'], bonus][seed % 6]!;
    for (const it of s.fg.items) it.inHands = weapon.includes(it.id);
    const totals = { actions: s.fg.hand.length + s.actionDiscard.length + Object.values(s.actionTable).reduce((a, b) => a + b, 0), items: 99 };
    const r = botRng(seed);
    let n = 0;
    while (!s.outcome && n++ < 4000) {
      const input = randomInput(s, r);
      try { s = dispatch(s, input); } catch (e) { throw new Error(`seed ${seed} ${JSON.stringify(input)} ${JSON.stringify(s.prompt)}: ${(e as Error).message}\n${s.log.slice(-12).map((l) => l.text).join('\n')}`); }
      const errs = checkInvariants(s, totals);
      if (errs.length) throw new Error(`seed ${seed}: ${errs.join('; ')}\n${s.log.slice(-12).map((l) => l.text).join('\n')}`);
    }
    if (!s.outcome) throw new Error(`seed ${seed} sin terminar\n${s.log.slice(-12).map((l) => l.text).join('\n')}`);
    expect(s.outcome).not.toBeNull();
  }
}, 180_000);
