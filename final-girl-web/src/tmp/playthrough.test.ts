import { writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { actionDef, createGame, dispatch, itemDef, zoneDef, type GameState, type Input } from '../engine';
import { distances } from '../engine/lookup';

/** Jugador con una estrategia sencilla: salvar Víctimas, buscar armas, curarse y atacar. */
const AGGRO = process.env.STRAT === 'aggro';

function decide(s: GameState): Input {
  const p = s.prompt!;
  const hp = s.fg.health.hp;
  const dist = distances(s, s.fg.zone, 'fg');
  const nearest = (pred: (z: string) => boolean) =>
    [...dist.entries()].filter(([z]) => pred(z)).sort((a, b) => a[1] - b[1])[0]?.[0];
  switch (p.type) {
    case 'main': {
      if (p.canRescue) return { type: 'startRescue' };
      const can = (id: string) => p.playable.find((c) => c.cardId === id);
      const best = (ids: string[]) => ids.map(can).find(Boolean);
      const sameZone = s.fg.zone === s.killer.zone;
      const armed = s.fg.items.some((i) => i.inHands && itemDef(s, i.id).damage);
      if (hp <= 2) {
        const rest = best(['descanso-largo', 'descanso-corto']);
        if (rest) return { type: 'playCard', cardId: rest.cardId };
      }
      if (AGGRO && p.ultimate && armed && hp >= 3) return { type: 'ultimate' };
      if (sameZone && (armed || s.killer.health.hp <= 4 || hp >= 4)) {
        const atk = best(['golpe-critico', 'golpe-furioso', 'ataque-debil']);
        if (atk) return { type: 'playCard', cardId: atk.cardId, ...(atk.weapons[0] ? { weaponUid: atk.weapons[0] } : {}) };
      }
      for (const a of p.itemActions) if (a.action === 'shoot' || a.action === 'place') return { type: 'useItem', uid: a.uid, action: a.action };
      if (zoneDef(s, s.fg.zone).search && !armed && s.itemDecks[s.fg.zone]?.length) {
        const search = can('buscar');
        if (search) return { type: 'playCard', cardId: 'buscar' };
      }
      if (s.fg.terror >= 5) {
        const calm = best(['distraccion', 'concentrarse']);
        if (calm && s.fg.time >= 2) return { type: 'playCard', cardId: calm.cardId };
      }
      const move = best(['correr', 'caminar']);
      if (move && s.fg.time >= 1) return { type: 'playCard', cardId: move.cardId };
      return { type: 'endActionPhase' };
    }
    case 'roll': {
      const partial = p.dice.findIndex((f, i) => (f === 3 || f === 4) && !p.converted.includes(i));
      const succ = p.dice.filter((f, i) => f >= 5 || p.converted.includes(i)).length;
      const spare = s.fg.hand.filter((c) => actionDef(c).cost === 0);
      if (succ < 2 && partial >= 0 && spare.length >= 2) return { type: 'convertPartial', die: partial, discard: [spare[0]!, spare[1]!] };
      return { type: 'confirmRoll' };
    }
    case 'move': {
      // Con Víctimas: hacia la salida más cercana. Sin ellas: hacia Víctimas, armas o el Asesino si vamos armados.
      const armed = s.fg.items.some((i) => i.inHands && itemDef(s, i.id).damage);
      const goal =
        (AGGRO && !armed && nearest((z) => !!zoneDef(s, z).search && !!s.itemDecks[z]?.length)) ||
        (p.followers.length && nearest((z) => !!zoneDef(s, z).exit)) ||
        (armed && s.killer.zone) ||
        nearest((z) => s.victims.some((v) => v.zone === z) && z !== s.fg.zone && z !== s.killer.zone) ||
        nearest((z) => !!zoneDef(s, z).search && z !== s.fg.zone);
      const options = p.to.filter((z) => z !== s.killer.zone || armed);
      if (!options.length) return p.mode === 'walk' ? { type: 'stopMoving' } : { type: 'moveTo', zone: p.to[0]!, bring: [] };
      const toGoal = (z: string) => (goal ? (distances(s, z, 'fg').get(goal) ?? 99) : 0);
      const zone = [...options].sort((a, b) => toGoal(a) - toGoal(b))[0]!;
      if (p.mode === 'walk' && goal && toGoal(zone) >= (dist.get(goal) ?? 99)) return { type: 'stopMoving' };
      const bring = zone === s.killer.zone ? [] : p.followers.slice(0, p.followLimit);
      return { type: 'moveTo', zone, bring };
    }
    case 'rescue':
      return { type: 'rescueOne', victimId: p.victims[0]!, slot: p.ultimate ? 0 : p.slots[0]! };
    case 'react':
      return p.cards[0] ? { type: 'react', cardId: p.cards[0] } : p.lid ? { type: 'useLid' } : { type: 'takeHit' };
    case 'search': {
      const score = (id: string) => itemDef(s, id).damage ?? 0;
      return { type: 'searchPick', keep: score(p.drawn[1]!) > score(p.drawn[0]!) ? 1 : 0, otherTo: 'top' };
    }
    case 'arrange': {
      const weapons = s.fg.items.filter((i) => itemDef(s, i.id).hands > 0).sort((a, b) => (itemDef(s, b.id).damage ?? 0) - (itemDef(s, a.id).damage ?? 0));
      const inHands: string[] = [];
      let used = 0;
      for (const w of weapons) if (used + itemDef(s, w.id).hands <= 2) (inHands.push(w.uid), (used += itemDef(s, w.id).hands));
      return { type: 'arrange', inHands };
    }
    case 'planning': {
      const prio = AGGRO ? ['golpe-critico', 'golpe-furioso', 'guardia', 'contraataque', 'buscar', 'descanso-largo', 'correr'] : ['golpe-furioso', 'golpe-critico', 'buscar', 'correr', 'guardia', 'descanso-largo', 'distraccion', 'contraataque'];
      const buy = prio.find((c) => p.buyable.includes(c));
      return buy ? { type: 'buy', cardId: buy } : { type: 'endPlanning' };
    }
    case 'choice':
      return { type: 'choose', option: p.options[0]!.id };
    case 'discardDown':
      return { type: 'discardDown', cardIds: s.fg.hand.slice(0, p.excess) };
  }
}

it('partida completa', () => {
  const seed = Number(process.env.SEED ?? 2026);
  let s = createGame({ killerId: 'hans', locationId: 'camp-happy-trails', finalGirlId: process.env.FG ?? 'laurie', board: 'normal', epicDarkPower: false, bonusItems: true, seed });
  const decisions: string[] = [];
  for (let i = 0; i < 3000 && !s.outcome; i++) {
    const input = decide(s);
    decisions.push(`${s.log.length}\t${JSON.stringify(input)}`);
    s = dispatch(s, input);
  }
  const text = s.log.map((l) => (l.tone === 'phase' ? `\n## ${l.text}` : `  ${l.text}`)).join('\n');
  writeFileSync(process.env.OUT ?? 'playthrough.log', text + `\n\nRESULTADO: ${s.outcome?.text ?? 'sin terminar'}\n`);
});
