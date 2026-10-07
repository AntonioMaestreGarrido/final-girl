/** Utilidades de prueba: un jugador aleatorio que solo hace jugadas válidas. */
import { enemyZones } from './enemies';
import { itemDef, killerDef } from './lookup';
import { createRng, next, type RngState } from './rng';
import type { GameState, Input } from './state';

const rand = (r: RngState, n: number) => Math.floor(next(r) * n);
const pickOne = <T>(r: RngState, xs: readonly T[]): T => xs[rand(r, xs.length)]!;

export function randomInput(s: GameState, r: RngState): Input {
  const p = s.prompt!;
  switch (p.type) {
    case 'main': {
      const opts: Input[] = [{ type: 'endActionPhase' }];
      for (const c of p.playable) {
        const weapon = c.weapons.length ? pickOne(r, c.weapons) : undefined;
        if (!enemyZones(s).includes(s.fg.zone) && !weapon) continue;
        opts.push({ type: 'playCard', cardId: c.cardId, ...(weapon ? { weaponUid: weapon } : {}) }, { type: 'playCard', cardId: c.cardId });
      }
      for (const a of p.itemActions) opts.push({ type: 'useItem', uid: a.uid, action: a.action });
      if (p.ultimate) opts.push({ type: 'ultimate' });
      if (p.canRescue) opts.push({ type: 'startRescue' }, { type: 'startRescue' });
      if (!p.strike && s.fg.hand.length && next(r) < 0.1) opts.push({ type: 'discardForTime', cardIds: [s.fg.hand[0]!] });
      const pick = pickOne(r, opts);
      return pick.type === 'playCard' && !enemyZones(s).includes(s.fg.zone) && !pick.weaponUid ? { type: 'endActionPhase' } : pick;
    }
    case 'roll': {
      const partial = p.dice.findIndex((f, i) => (f === 3 || f === 4) && !p.converted.includes(i));
      if (partial >= 0 && s.fg.hand.length >= 2 && next(r) < 0.3) {
        return { type: 'convertPartial', die: partial, discard: [s.fg.hand[0]!, s.fg.hand[1]!] };
      }
      if (p.canCloseCall && next(r) < 0.2) return { type: 'closeCall', ...(next(r) < 0.5 ? { die: 0 } : {}) };
      if (p.canLuckyDice && next(r) < 0.2) return { type: 'luckyDice', dice: [0] };
      if (p.canSister && next(r) < 0.3) return { type: 'sisterReroll', die: 0 };
      return { type: 'confirmRoll' };
    }
    case 'choice':
      return { type: 'choose', option: pickOne(r, p.options).id };
    case 'move': {
      if (p.mode === 'walk' && (next(r) < 0.15 || !p.to.length)) return { type: 'stopMoving' };
      const zone = pickOne(r, p.to);
      const killerThere = !s.birds && zone === s.killer.zone;
      const followers = s.victims.filter((v) => p.followers.includes(v.id) && (!killerThere || v.role === 'novia'));
      const bring = followers.slice(0, rand(r, Math.min(p.followLimit, followers.length) + 1)).map((v) => v.id);
      return { type: 'moveTo', zone, bring };
    }
    case 'rescue':
      if (next(r) < 0.1) return { type: 'rescueDone' };
      return { type: 'rescueOne', victimId: pickOne(r, p.victims), slot: p.ultimate ? 0 : pickOne(r, p.slots) };
    case 'react': {
      const opts: Input[] = [{ type: 'takeHit' }];
      for (const c of p.cards) opts.push({ type: 'react', cardId: c });
      if (p.lid) opts.push({ type: 'useLid' });
      if (p.spray && next(r) < 0.3) opts.push({ type: 'pepperSpray' });
      return pickOne(r, opts);
    }
    case 'search':
      return { type: 'searchPick', keep: rand(r, p.drawn.length), otherTo: next(r) < 0.5 ? 'top' : 'bottom' };
    case 'arrange': {
      let hands = 0;
      const inHands: string[] = [];
      // Los martillos no se pueden llevar en la mochila: van siempre en las manos.
      const hammers = s.fg.items.filter((i) => ['item-hammer', 'item-hammer-charlie'].includes(itemDef(s, i.id).custom ?? ''));
      for (const it of hammers) {
        if (hands + itemDef(s, it.id).hands > 2) continue;
        inHands.push(it.uid);
        hands += itemDef(s, it.id).hands;
      }
      for (const it of s.fg.items) {
        if (hammers.includes(it)) continue;
        const h = itemDef(s, it.id).hands;
        if (h > 0 && hands + h <= 2 && next(r) < 0.8) {
          inHands.push(it.uid);
          hands += h;
        }
      }
      return { type: 'arrange', inHands };
    }
    case 'planning':
      if (p.buyable.length && next(r) < 0.7) return { type: 'buy', cardId: pickOne(r, p.buyable) };
      return { type: 'endPlanning' };
    case 'discardDown':
      return { type: 'discardDown', cardIds: s.fg.hand.slice(0, p.excess) };
  }
}

/** Comprueba invariantes del estado; devuelve la lista de problemas. */
export function checkInvariants(s: GameState, totals: { actions: number; items: number }): string[] {
  const errors: string[] = [];
  const cards = s.fg.hand.length + s.actionDiscard.length + Object.values(s.actionTable).reduce((a, b) => a + b, 0);
  if (cards !== totals.actions) errors.push(`cartas de Acción: ${cards} ≠ ${totals.actions}`);
  // Las Víctimas Especiales de Terror from Above no salen de la reserva de 21.
  const specials = s.birds ? s.victims.filter((v) => v.bsp).length + s.birds.saved : 0;
  const victims = s.victims.length + s.dead.length + s.fg.saved + s.victimPool + (s.gone ?? 0) - specials;
  if (victims !== 21) errors.push(`Víctimas: ${victims} ≠ 21`);
  const items = s.fg.items.length + s.itemDiscard.length + Object.values(s.itemDecks).reduce((n, d) => n + d.length, 0);
  if (items > totals.items) errors.push(`Objetos: ${items} > ${totals.items}`);
  if (s.fg.health.hp > s.fg.health.max) errors.push('Vida de la Chica Final por encima del máximo');
  if (s.killer.health.hp > s.killer.health.max) errors.push('Vida del Asesino por encima del máximo');
  if (s.fg.terror < 0 || s.fg.terror > 7) errors.push(`Terror fuera de rango: ${s.fg.terror}`);
  if (s.fg.time < -1 || s.fg.time > 12) errors.push(`Tiempo fuera de rango: ${s.fg.time}`);
  for (const [w, v] of Object.entries(s.wrath)) if (v! < 1 || v! > 10) errors.push(`Ira ${w} fuera de rango: ${v}`);
  if (new Set(s.victims.map((v) => v.id)).size !== s.victims.length) errors.push('Víctimas duplicadas');
  if (s.killer.bloodlust < 0 || s.killer.bloodlust >= killerDef(s).bloodlust.length) errors.push('Sed de Sangre fuera de rango');
  if (s.fg.items.filter((i) => i.inHands).reduce((n, i) => n + itemDef(s, i.id).hands, 0) > 2) errors.push('Más de dos manos ocupadas');
  const minion = killerDef(s).minion;
  if (s.birds) {
    for (const z of new Set(s.minions.map((m) => m.zone))) if (s.minions.filter((m) => m.zone === z).length > 3) errors.push(`Más de 3 Pájaros en ${z}`);
    if (s.victims.some((v) => v.bsp) && s.birds.hidden > 0) errors.push('Víctimas Especiales a la vez escondidas y en juego');
  } else if (minion) {
    const total = s.minions.length + s.minionPool.ready.length + s.minionPool.exhausted.length;
    if (total !== minion.count) errors.push(`Esbirros: ${total} ≠ ${minion.count}`);
    if (new Set(s.minions.map((m) => m.id)).size !== s.minions.length) errors.push('Esbirros duplicados');
  }
  if (!s.outcome && !s.prompt) errors.push('El motor se ha parado sin preguntar nada');
  return errors;
}

export const botRng = (seed: number) => createRng(seed ^ 0x9e3779b9);
