import { expect, it } from 'vitest';
import { createGame, dispatch, type GameState } from './index';
import { itemDef, locationDef } from './lookup';
import { botRng, checkInvariants, randomInput } from './testing';
/** Partidas aleatorias en las que la Chica Final empieza con todos los objetos de Sacred Groves. */
it('Sacred Groves: 150 partidas con todos los objetos terminan sin errores', () => {
  for (let seed = 1; seed <= 150; seed++) {
    const fgId = seed % 2 ? 'adelaide' : 'barbara';
    let s: GameState = createGame({ killerId: 'inkanyamba', locationId: 'sacred-groves', finalGirlId: fgId, board: 'normal', epicDarkPower: false, bonusItems: true, seed });
    // Todos los objetos del Lugar (más el bonus) en la mochila; dos armas en las manos.
    const ids = [...locationDef(s).items.map((i) => i.id), fgId === 'adelaide' ? 'bate-y-escudo-de-adelaide' : 'rifle-de-barbara'];
    const pick = seed % 4;
    s.fg.items = ids.map((id, i) => ({ uid: `t${i}`, id, inHands: false, ...(itemDef(s, id).uses ? { uses: itemDef(s, id).uses } : {}) }));
    const weapon = [['latigo', 'daga-ceremonial'], ['palo-de-guerra'], [ids[ids.length - 1]!], ['huesos-del-shaman', 'tapadera']][pick]!;
    for (const it of s.fg.items) it.inHands = weapon.includes(it.id);
    for (const d of Object.values(s.itemDecks)) d.length = 0;
    s.fg.rescueSlots = s.fg.rescueSlots.map((_, i) => i > 0);
    s.fg.hand.push('expiar', 'guardia');
    s.actionTable.expiar!--; s.actionTable.guardia!--;
    const totals = { actions: s.fg.hand.length + s.actionDiscard.length + Object.values(s.actionTable).reduce((a, b) => a + b, 0), items: 99 };
    const r = botRng(seed);
    let n = 0;
    while (!s.outcome && n++ < 4000) {
      const input = randomInput(s, r);
      try { s = dispatch(s, input); } catch (e) { throw new Error(`seed ${seed} ${JSON.stringify(input)} ${JSON.stringify(s.prompt)}: ${(e as Error).message}\n${s.log.slice(-10).map((l) => l.text).join('\n')}`); }
      const errs = checkInvariants(s, totals);
      if (errs.length) throw new Error(`seed ${seed}: ${errs.join('; ')}\n${s.log.slice(-10).map((l) => l.text).join('\n')}`);
    }
    if (!s.outcome) throw new Error(`seed ${seed} sin terminar`);
    expect(s.outcome).not.toBeNull();
  }
}, 120_000);
