import type { CardId, Effect, ZoneId } from '../content/types';
import {
  changeTerror,
  changeTime,
  damageFG,
  damageKiller,
  has,
  healFG,
  healKiller,
  increaseBloodlust,
  killerShielded,
  killVictim,
  log,
  moveVictim,
  placeVictims,
  discardRandomActions,
  panicVictims,
  push,
  pushEffects,
  onKillerEnter,
  RuleError,
  victimLabel,
} from './core';
import { applyWrath, unleashWrath, wrathAmount } from './wrath';
import { resolveTrapItem } from './carnival';
import { creechDiscardGuard, creechOnGain, creechMoveLimit, strikeVictims } from './creech';
import { mapleMarkSearched, mapleOnGain, searchableHere } from './maple';
import { startKillerAction } from './killer';
import { BIRDS_NOOP, birdsKillerAction, birdsPlaceKiller } from './birds';
import { damageMinionsAt, enemyZones, minionName, minionsAt } from './enemies';
import { actionDef, deckOf, distance, distances, fgDef, horrorDef, isBirds, itemDef, killerDef, locationDef, neighbors, shortestPaths, victimsIn, zoneDef, zoneName } from './lookup';
import { pick, rollDie } from './rng';
import { choice, customChoices, customEffects, registerChoice, registerEffect } from './registry';
import type { ChoiceHandler, EffectSource, GameState } from './state';

// ---------------------------------------------------------------- aplicar un efecto

export function applyEffect(s: GameState, e: Effect, src: EffectSource): void {
  switch (e.kind) {
    case 'time':
      return changeTime(s, e.amount);
    case 'terror':
      return changeTerror(s, e.amount);
    case 'heal':
      return healFG(s, e.amount, src);
    case 'loseHealth':
      return damageFG(s, e.amount);
    case 'move':
      if (s.fg.legTrap) return log(s, 'La trampa para osos te sujeta la pierna: no puedes moverte.', 'bad');
      return push(s, { t: 'fgMove', remaining: creechMoveLimit(s, e.upTo), src, mode: 'walk' });
    case 'endActionPhase':
      if (s.phase === 'action') s.mods.actionPhaseEnding = true;
      return;
    case 'damage':
      return dealDamage(s, e.amount, src);
    case 'bonusDiceNextRoll':
      s.mods.bonusDiceNextRoll += e.amount;
      return log(s, `+${e.amount} ${e.amount === 1 ? 'dado' : 'dados'} en la próxima Tirada de Terror.`, 'good');
    case 'partialsAreSuccesses':
      if (e.scope === 'actionPhase') s.mods.partialsThisPhase = true;
      else s.mods.partialsNextRoll = true;
      return log(s, e.scope === 'actionPhase' ? 'Hasta el final de la fase de Acción, los 3 y 4 son éxitos.' : 'En la próxima Tirada de Terror, los 3 y 4 son éxitos.', 'good');
    case 'search': {
      const zone = s.fg.zone;
      if (!zoneDef(s, zone).search) return searchFromAfar(s, e.draw);
      if (!searchableHere(s)) return log(s, 'Esta Casa ya no se puede buscar.', 'bad');
      push(s, { t: 'search', zone: deckOf(s, zone), drawn: [], draw: e.draw });
      return mapleMarkSearched(s);
    }
    case 'drawItemAnyDeck': {
      const decks = Object.entries(s.itemDecks).filter(([, d]) => d.length);
      if (!decks.length) return log(s, 'No quedan Objetos en ningún mazo.');
      return push(s, choice('¿De qué mazo de Objetos robas?', decks.map(([z]) => ({ id: z, label: zoneName(s, z) })), { kind: 'custom', id: 'draw-item-from-deck' }));
    }
    case 'takeActionCard':
      return takeActionCard(s, e.maxCost, e.cardId);
    case 'ignoreAttack':
    case 'reduceAttack': {
      const atk = [...s.stack].reverse().find((t) => t.t === 'attackFG');
      if (!atk || atk.t !== 'attackFG') return;
      if (e.kind === 'ignoreAttack') atk.damage = 0;
      else atk.damage = Math.max(e.min ?? 0, atk.damage - e.amount);
      return log(s, e.kind === 'ignoreAttack' ? 'Ignoras todo el daño del ataque.' : `El ataque queda en ${atk.damage} de daño.`, 'good');
    }
    case 'bloodlust':
      return increaseBloodlust(s, e.amount);
    case 'killerAction':
      return isBirds(s) ? birdsKillerAction(s, e.action) : startKillerAction(s, e.action, src);
    case 'killerHeal':
      return healKiller(s, e.amount);
    case 'drawEvent':
      return drawEvent(s);
    case 'drawHorror':
      return drawHorror(s);
    case 'placeVictims': {
      const w = e.where;
      const zone = 'zone' in w ? w.zone : w.at === 'killerStart' ? s.killer.startZone : s.fg.startZone;
      return placeVictims(s, zone, e.count);
    }
    case 'panic': {
      const victims = s.victims.filter((v) => (e.who === 'killerZone' ? v.zone === s.killer.zone : v.zone !== s.fg.zone));
      if (!victims.length) return;
      log(s, e.who === 'killerZone' ? 'Las Víctimas de la zona del Asesino huyen.' : 'Las Víctimas fuera de tu zona huyen.');
      return panicVictims(s, victims, e.times);
    }
    case 'wrath': {
      const amount = e.by ? wrathAmount(s, e.by) : (e.amount ?? 1);
      if (e.op === 'increase' && amount <= 0) return;
      return applyWrath(s, e.which, e.op, amount);
    }
    case 'unleash':
      return unleashWrath(s, e.which);
    case 'discardRandomActions':
      return discardRandomActions(s, e.count, 'Ira Divina');
    case 'victimsStepToward':
      return victimsStepTowardKiller(s);
    case 'choice':
      return push(
        s,
        choice(
          'Elige una opción',
          e.options.map((opt, i) => ({ id: String(i), label: describeEffects(s, opt) })),
          { kind: 'effects', options: Object.fromEntries(e.options.map((opt, i) => [String(i), opt])), src },
        ),
      );
    case 'custom':
      return runCustomEffect(s, e.id, src);
  }
}

export { choice, registerChoice, registerEffect };

// ---------------------------------------------------------------- daño de la Chica Final

/** Contexto de un ataque ya calculado (serializable para las elecciones de objetivo). */
interface AttackCtx {
  total: number;
  weaponUid?: string;
  weaponId?: string;
  weaponCustom?: string;
  /** Es el primer daño de la carta (se aplican los efectos del arma una vez). */
  firstHit: boolean;
  /** Enemigo obligado (Contraataque contra quien te atacó). */
  forced?: string;
}

/** Alcance con el que ataca: el del arma elegida o tu propia zona. */
function attackRange(s: GameState, src: EffectSource): [number, number] {
  const weapon = src.weaponUid ? s.fg.items.find((i) => i.uid === src.weaponUid) : undefined;
  const def = weapon ? itemDef(s, weapon.id) : undefined;
  if (!def?.range) return [0, 0];
  return [def.range[0], def.range[1] + (def.custom === 'item-old-rifle' && zoneDef(s, s.fg.zone).sacred ? 2 : 0)];
}

/** Objetivos posibles de un ataque: el Asesino, grupos de Esbirros por zona y (Gran Final de Geppetto) Víctimas. */
export function attackCandidates(s: GameState, src: EffectSource): { id: string; label: string }[] {
  const [min, max] = attackRange(s, src);
  const dist = distances(s, s.fg.zone, 'fg');
  const inRange = (z: string) => {
    const d = dist.get(z);
    return d !== undefined && d >= min && d <= max;
  };
  const out: { id: string; label: string }[] = [];
  if (!killerShielded(s) && inRange(s.killer.zone)) out.push({ id: 'killer', label: `${killerDef(s).name} (${zoneName(s, s.killer.zone)})` });
  for (const z of new Set(s.minions.map((m) => m.zone))) {
    if (!inRange(z)) continue;
    const n = minionsAt(s, z).length;
    out.push({ id: `mz:${z}`, label: `${n} ${n === 1 ? minionName(s) : minionName(s, true)} en ${zoneName(s, z)}` });
  }
  if (has(s, 'finale-friends') || strikeVictims(s)) {
    for (const z of new Set(s.victims.filter((v) => v.role !== 'lobo').map((v) => v.zone))) {
      if (inRange(z)) out.push({ id: `vz:${z}`, label: `Matar a una Víctima en ${zoneName(s, z)} (sube la Sed de Sangre)` });
    }
  }
  return out;
}

/** Daño infligido por la Chica Final con una carta: añade arma y Habilidad Definitiva (una vez). */
export function dealDamage(s: GameState, amount: number, src: EffectSource): void {
  if (amount <= 0) return;
  let total = amount;
  const weapon = src.weaponUid ? s.fg.items.find((i) => i.uid === src.weaponUid) : undefined;
  const firstHit = src.kind === 'action' && !src.damageBonusApplied;
  if (src.kind === 'action' && !src.damageBonusApplied) {
    src.damageBonusApplied = true;
    if (weapon) {
      const def = itemDef(s, weapon.id);
      total += def.damage ?? 0;
      log(s, `${def.name}: +${def.damage} de daño.`, 'good');
    }
    if (has(s, 'ult-laurie') && enemyZones(s).includes(s.fg.zone)) {
      total++;
      log(s, 'Habilidad Definitiva de Laurie: +1 de daño.', 'good');
    }
  }
  const weaponDef = weapon ? itemDef(s, weapon.id) : undefined;
  const ctx: AttackCtx = {
    total,
    ...(weapon && firstHit ? { weaponUid: weapon.uid } : {}),
    ...(weaponDef ? { weaponId: weaponDef.id } : {}),
    ...(weaponDef?.custom ? { weaponCustom: weaponDef.custom } : {}),
    firstHit,
    ...(src.target ? { forced: src.target } : {}),
  };
  chooseAttackTarget(s, ctx, src);
}

function chooseAttackTarget(s: GameState, ctx: AttackCtx, src: EffectSource): void {
  const all = attackCandidates(s, src);
  const forced = ctx.forced ? all.find((c) => c.id === ctx.forced) : undefined;
  const candidates = forced ? [forced] : all;
  // Cinturón/Bandolera de cuchillos: el daño se reparte punto a punto entre los Enemigos a su alcance.
  const split = ctx.weaponCustom === 'item-knife-belt' && ctx.total > 1 && candidates.length > 1;
  if (!candidates.length) return hitEnemy(s, 'killer', ctx);
  if (candidates.length === 1 && !split) return hitEnemy(s, candidates[0]!.id, ctx);
  push(
    s,
    choice(
      split ? `Cuchillos: reparte el daño (quedan ${ctx.total} puntos). ¿A quién va el primero?` : `¿A quién atacas? (${ctx.total} de daño)`,
      candidates,
      { kind: 'custom', id: 'fg-attack-target', data: { ctx: { ...ctx }, split, srcWeaponUid: src.weaponUid ?? null } },
    ),
  );
}

registerChoice('fg-attack-target', (s, option, data) => {
  const ctx = data.ctx as AttackCtx;
  const src: EffectSource = { kind: 'action', ...(data.srcWeaponUid ? { weaponUid: data.srcWeaponUid as string } : {}) };
  if (data.split) {
    const point = { ...ctx, total: 1 };
    delete point.weaponUid;
    hitEnemy(s, option, point, true);
    const left = ctx.total - 1;
    if (left > 0 && !s.outcome) chooseAttackTarget(s, { ...ctx, total: left, firstHit: false }, src);
    else finishAttack(s, ctx);
    return;
  }
  hitEnemy(s, option, ctx);
});

function hitEnemy(s: GameState, key: string, ctx: AttackCtx, partial = false): void {
  if (s.outcome) return;
  if (key === 'killer') {
    damageKiller(s, ctx.total);
    if (!s.outcome) afterFgDamage(s, ctx.total, ctx.weaponUid, ctx.weaponCustom);
    if (ctx.weaponCustom === 'item-metal-bat' && s.killer.minors.length && !s.outcome) {
      push(
        s,
        choice(
          'Bate: ¿descartas un Poder Oscuro Menor?',
          [
            ...s.killer.minors.map((m) => ({ id: m.id, label: `Descartar ${horrorDef(s, m.id).name}` })),
            { id: 'no', label: 'No' },
          ],
          { kind: 'custom', id: 'bat-discard-minor' },
        ),
      );
    }
  } else if (key.startsWith('mz:')) {
    const zone = key.slice(3);
    log(s, `¡${ctx.total} de daño a ${minionName(s, true)} en ${zoneName(s, zone)}!`, 'good');
    damageMinionsAt(s, zone, ctx.total);
    if (ctx.weaponCustom === 'item-whip') whipMinion(s, zone);
    if (ctx.weaponUid) {
      const it = s.fg.items.find((i) => i.uid === ctx.weaponUid);
      if (it && it.uses !== undefined) spendUse(s, ctx.weaponUid);
    }
  } else if (key.startsWith('vz:')) {
    const zone = key.slice(3);
    // «¡Tengo que matarte!»: cada punto de daño mata a una Víctima y no sube la Sed de Sangre.
    const n = strikeVictims(s) ? ctx.total : 1;
    for (let i = 0; i < n; i++) {
      const v = [...victimsIn(s, zone)].filter((x) => x.role !== 'lobo').sort((a, b) => (a.role ? 1 : 0) - (b.role ? 1 : 0))[0];
      if (!v) break;
      log(s, `${fgDef(s).name} ataca a ${victimLabel(v)}.`, 'bad');
      killVictim(s, v, false, strikeVictims(s) ? { noBloodlust: true } : {});
    }
  }
  if (!partial) finishAttack(s, ctx, key);
}

/** Efectos al terminar de resolver un ataque con un arma (Hacha arrojadiza, Martillos). */
function finishAttack(s: GameState, ctx: AttackCtx, key?: string): void {
  if (!ctx.weaponUid || s.outcome) return;
  if (ctx.weaponCustom === 'item-throwing-axe') {
    const zone = key === 'killer' || !key ? s.killer.zone : key.slice(3);
    if (zone !== s.fg.zone) {
      log(s, 'Hacha arrojadiza: la lanzas y la descartas.', 'info');
      discardItem(s, ctx.weaponUid);
    }
  }
  if (ctx.weaponCustom === 'item-hammer' || ctx.weaponCustom === 'item-hammer-charlie') {
    log(s, 'El martillo te pasa factura: pierdes 1 Vida y termina la fase de Acción.', 'bad');
    damageFG(s, 1);
    if (!s.outcome && s.phase === 'action') s.mods.actionPhaseEnding = true;
  }
}

/** Látigo contra Esbirros: puedes moverlos 1 espacio. */
function whipMinion(s: GameState, zone: string): void {
  const alive = minionsAt(s, zone);
  if (!alive.length) return;
  const options = neighbors(s, zone, 'enemy').map((z) => ({ id: `${zone}>${z}`, label: `Mover ${minionName(s)} a ${zoneName(s, z)}` }));
  push(s, choice('Látigo: ¿mueves un Esbirro 1 espacio?', [...options, { id: 'no', label: 'No' }], { kind: 'custom', id: 'whip-minion' }));
}

registerChoice('whip-minion', (s, option) => {
  if (option === 'no') return;
  const [from, to] = option.split('>') as [string, string];
  const m = minionsAt(s, from)[0];
  if (!m) return;
  m.zone = to;
  log(s, `El Látigo arrastra ${minionName(s)} a ${zoneName(s, to)}.`, 'good');
});

/** Efectos que se disparan al hacer daño al Asesino (objetos de Sacred Groves, Barbara). */
function afterFgDamage(s: GameState, total: number, weaponUid: string | undefined, weaponCustom: string | undefined): void {
  if (has(s, 'item-ceremonial-dagger')) {
    log(s, 'Daga ceremonial: reduces una Ira en 1.', 'good');
    pushEffects(s, [{ kind: 'wrath', which: 'choose', op: 'reduce', amount: 1 }], { kind: 'item', id: 'daga-ceremonial' });
  }
  if (weaponCustom === 'item-war-club') {
    log(s, `Palo de guerra: reduces una Ira en ${total}.`, 'good');
    pushEffects(s, [{ kind: 'wrath', which: 'choose', op: 'reduce', amount: total }], { kind: 'item', id: 'palo-de-guerra' });
  }
  if (weaponCustom === 'item-whip') {
    const options = neighbors(s, s.killer.zone, 'enemy').map((z) => ({ id: z, label: `Mover a ${killerDef(s).name} a ${zoneName(s, z)}` }));
    push(s, choice('Látigo: ¿mueves al Asesino 1 espacio?', [...options, { id: 'no', label: 'No' }], { kind: 'custom', id: 'whip-move' }));
  }
  if (has(s, 'ult-barbara') && s.fg.zone === s.killer.zone) {
    const n = victimsIn(s, s.fg.zone).length;
    if (n) {
      push(s, choice(`Barbara: ¿cuánto daño adicional haces? (cada punto mata a una Víctima de tu zona)`,
        Array.from({ length: n + 1 }, (_, i) => ({ id: String(i), label: i === 0 ? 'Ninguno' : `+${i} de daño (mueren ${i} ${i === 1 ? 'Víctima' : 'Víctimas'})` })),
        { kind: 'custom', id: 'barbara-extra' }));
    }
  }
  // Las armas con usos (Rifle de Barbara) gastan uno por ataque.
  if (weaponUid) {
    const it = s.fg.items.find((i) => i.uid === weaponUid);
    if (it && it.uses !== undefined) spendUse(s, weaponUid);
  }
}

// ---------------------------------------------------------------- cartas

export function takeActionCard(s: GameState, maxCost?: number, cardId?: CardId): void {
  const available = Object.entries(s.actionTable).filter(([id, n]) => n > 0 && (cardId ? id === cardId : actionDef(id).cost <= (maxCost ?? 99)));
  if (!available.length) return log(s, 'No hay ninguna carta de Acción disponible para coger.');
  if (available.length === 1) return gainActionCard(s, available[0]![0]);
  push(s, choice('¿Qué carta de Acción coges?', available.map(([id]) => ({ id, label: `${actionDef(id).name} (coste ${actionDef(id).cost})` })), { kind: 'custom', id: 'gain-action-card' }));
}

export function gainActionCard(s: GameState, id: CardId): void {
  s.actionTable[id]!--;
  s.fg.hand.push(id);
  log(s, `Coges la carta de Acción ${actionDef(id).name}.`, 'good');
  if (s.fg.hand.length > 10) push(s, { t: 'discardDown' });
}

/** Zappo: puedes jugar Buscar hasta a 2 espacios de una zona de Búsqueda. */
export function zappoSearchZones(s: GameState): string[] {
  if (!s.fg.items.some((i) => i.id === 'zappo')) return [];
  const dist = distances(s, s.fg.zone, 'fg');
  return locationDef(s).itemDecks.filter((z) => (s.itemDecks[z]?.length ?? 0) > 0 && (dist.get(z) ?? 99) <= 2);
}

function searchFromAfar(s: GameState, draw: 1 | 2): void {
  const zones = zappoSearchZones(s);
  if (!zones.length) return log(s, 'No estás en una zona de Búsqueda.');
  if (zones.length === 1) return push(s, { t: 'search', zone: zones[0]!, drawn: [], draw, zappo: true });
  push(s, choice('Zappo busca por ti: ¿en qué mazo?', zones.map((z) => ({ id: z, label: zoneName(s, z) })), { kind: 'custom', id: 'zappo-search', data: { draw } }));
}
registerChoice('zappo-search', (s, option, data) => {
  push(s, { t: 'search', zone: option, drawn: [], draw: data.draw as 1 | 2, zappo: true });
});

export function drawHorror(s: GameState): void {
  const id = s.horrorDeck.shift();
  if (!id) return log(s, 'El mazo de Horror está vacío.');
  s.infoSeq++;
  push(s, { t: 'horror', cardId: id });
}

export function drawEvent(s: GameState): void {
  const id = s.eventDeck.shift();
  if (!id) return log(s, 'No quedan cartas de Evento.');
  s.infoSeq++;
  push(s, { t: 'event', cardId: id });
}

/** Coge un Objeto del mundo y lo da a la Chica Final. */
export function gainItem(s: GameState, id: CardId): void {
  const def = itemDef(s, id);
  if (def.trap) return resolveTrapItem(s, id);
  if (def.custom === 'item-list') return creechOnGain(s, id);
  const inst = { uid: `i${s.nextUid++}`, id, inHands: false, ...(def.uses ? { uses: def.uses } : {}) };
  // Si caben en las manos, se colocan ahí; si no, va a la mochila y el jugador reorganiza.
  const fits = def.hands > 0 && handsUsed(s) + def.hands <= 2;
  s.fg.items.push(inst);
  inst.inHands = fits;
  const where = def.custom === 'item-carolyn' ? 'contigo, no en la mochila' : def.hands === 0 ? 'a la mochila' : fits ? 'a las manos' : 'a la mochila (no te caben en las manos)';
  log(s, `Consigues: ${def.name} (va ${where}; mira «Tu equipo» abajo a la derecha).`, 'good', undefined, { kind: 'item', id });
  if (def.custom === 'item-motorboat') placeBoat(s);
  creechOnGain(s, id);
  mapleOnGain(s, id);
  if (def.hands > 0 && !fits) push(s, { t: 'arrange', optional: false });
}

export const handsUsed = (s: GameState) => s.fg.items.filter((i) => i.inHands).reduce((n, i) => n + itemDef(s, i.id).hands, 0);

function placeBoat(s: GameState): void {
  const dist = distances(s, s.fg.zone, 'fg');
  const water = locationDef(s).zones.filter((z) => z.water).sort((a, b) => (dist.get(a.id) ?? 99) - (dist.get(b.id) ?? 99));
  const best = water[0];
  if (!best) return;
  s.tokens = s.tokens.filter((t) => t.id !== 'bote-a-motor');
  s.tokens.push({ id: 'bote-a-motor', zone: best.id });
  log(s, `El Bote a motor está en ${best.label}.`);
}

export function discardItem(s: GameState, uid: string): void {
  const it = s.fg.items.find((i) => i.uid === uid);
  if (!it) return;
  // Carolyn nunca se descarta; Mr. Floppy vuelve a un mazo (o no se puede descartar todavía).
  if (creechDiscardGuard(s, it)) return;
  s.fg.items = s.fg.items.filter((i) => i !== it);
  s.itemDiscard.push(it.id);
  log(s, `Se descarta ${itemDef(s, it.id).name}.`);
}

/** Gasta un uso; si no quedan, descarta el objeto. */
export function spendUse(s: GameState, uid: string): void {
  const it = s.fg.items.find((i) => i.uid === uid);
  if (!it || it.uses === undefined) return;
  it.uses--;
  if (it.uses <= 0) discardItem(s, uid);
}

// ---------------------------------------------------------------- movimiento de Víctimas

/** Cada Víctima se mueve 1 zona hacia el Enemigo más cercano (camino más corto). */
function victimsStepTowardKiller(s: GameState): void {
  const groups = new Map<ZoneId, typeof s.victims>();
  for (const v of s.victims) if (v.zone !== s.killer.zone) groups.set(v.zone, [...(groups.get(v.zone) ?? []), v]);
  log(s, 'Todas las Víctimas se acercan al Asesino.');
  for (const [zone, vs] of groups) {
    const next = [...new Set(shortestPaths(s, zone, s.killer.zone, 'victim').map((p) => p[0]!))];
    if (!next.length) continue;
    if (next.length > 1) {
      push(s, choice(`Empate: ¿hacia dónde van las Víctimas de ${zoneName(s, zone)}?`, next.map((z) => ({ id: z, label: zoneName(s, z) })), { kind: 'custom', id: 'victims-step', data: { from: zone } }));
      continue;
    }
    for (const v of vs) moveVictim(s, v, next[0]!);
  }
}

// ---------------------------------------------------------------- efectos únicos

function runCustomEffect(s: GameState, id: string, src: EffectSource): void {
  if (isBirds(s) && BIRDS_NOOP.has(id)) return;
  switch (id) {
    case 'discard-next-horror': {
      const card = s.horrorDeck.shift();
      if (card) {
        s.horrorDiscard.push(card);
        log(s, 'Se descarta la siguiente carta de Horror.', 'good');
      }
      return;
    }
    case 'hans-teleport-farthest-victim': {
      if (!s.victims.length) return log(s, 'No hay Víctimas: Hans no se mueve.');
      const dist = distances(s, s.killer.zone, 'enemy');
      const far = Math.max(...s.victims.map((v) => dist.get(v.zone) ?? 0));
      const zones = [...new Set(s.victims.filter((v) => (dist.get(v.zone) ?? 0) === far).map((v) => v.zone))];
      if (zones.length > 1) {
        return push(s, choice('Empate: ¿dónde aparece Hans?', zones.map((z) => ({ id: z, label: zoneName(s, z) })), { kind: 'custom', id: 'teleport-killer' }));
      }
      return teleportKiller(s, zones[0]!);
    }
    case 'bloodlust-per-victim-killed-this-killer-phase': {
      const n = s.mods.killedThisKillerPhase;
      if (n) increaseBloodlust(s, n);
      return;
    }
    case 'killer-heal-per-dead-victim': {
      if (s.dead.length) healKiller(s, s.dead.length);
      return;
    }
    case 'camp-fire': {
      const face = rollDie(s.rng);
      const zone: ZoneId = face <= 2 ? 'cabanas' : face <= 4 ? 'cobertizo' : 'muelle';
      log(s, `¡Fuego! Dado ${face}: arde ${zoneName(s, zone)}.`, 'killer', { kind: 'dice', faces: [face] });
      for (const v of s.victims.filter((x) => x.zone === zone)) killVictim(s, v, false);
      const deck = s.itemDecks[zone];
      if (deck?.length) {
        s.itemDiscard.push(...deck.map((c) => c.id));
        s.itemDecks[zone] = [];
        log(s, `Se descartan todos los Objetos de ${zoneName(s, zone)}.`, 'bad');
      }
      if (s.fg.zone === zone) damageFG(s, 1);
      if (s.killer.zone === zone && !s.outcome) {
        log(s, `${killerDef(s).name} también está en el fuego.`, 'good');
        damageKiller(s, 1);
      }
      return;
    }
    default: {
      const at = id.indexOf(':');
      const name = at < 0 ? id : id.slice(0, at);
      const arg = at < 0 ? undefined : id.slice(at + 1);
      const fn = customEffects.get(name);
      if (!fn) throw new RuleError(`Efecto especial sin implementar: ${id} (${src.kind})`);
      return fn(s, arg, src);
    }
  }
}


export function teleportKiller(s: GameState, zone: ZoneId): void {
  if (isBirds(s)) return birdsPlaceKiller(s, zone);
  const from = s.killer.zone;
  s.killer.zone = zone;
  log(s, `¡${killerDef(s).name} aparece en ${zoneName(s, zone)}!`, 'killer', { kind: 'killerMove', path: from === zone ? [zone] : [from, zone] });
  onKillerEnter(s);
}

// ---------------------------------------------------------------- respuesta a `choice`

export function resolveChoice(s: GameState, then: ChoiceHandler, option: string): void {
  if (then.kind === 'effects') return pushEffects(s, then.options[option] ?? [], then.src);
  const data = then.data ?? {};
  switch (then.id) {
    case 'draw-item-from-deck': {
      const card = s.itemDecks[option]?.shift();
      if (!card) return;
      s.infoSeq++;
      return gainItem(s, card.id);
    }
    case 'gain-action-card':
      return gainActionCard(s, option);
    case 'teleport-killer':
      return teleportKiller(s, option);
    case 'victims-step':
      for (const v of s.victims.filter((x) => x.zone === data.from)) moveVictim(s, v, option);
      return;
    case 'bat-discard-minor': {
      if (option === 'no') return;
      s.killer.minors = s.killer.minors.filter((m) => m.id !== option);
      s.horrorDiscard.push(option);
      return log(s, 'El Bate metálico destroza el Poder Oscuro Menor.', 'good');
    }
    default:
      return resolveCustomChoice(s, then.id, option, data);
  }
}

function resolveCustomChoice(s: GameState, id: string, option: string, data: Record<string, unknown>): void {
  const fn = customChoices.get(id);
  if (!fn) throw new RuleError(`Elección sin implementar: ${id}`);
  fn(s, option, data);
}

// ---------------------------------------------------------------- textos

export function describeEffects(s: GameState, effects: Effect[]): string {
  if (!effects.length) return 'Sin efecto';
  return effects.map((e) => describeEffect(s, e)).join(', ');
}

function describeEffect(_s: GameState, e: Effect): string {
  const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);
  switch (e.kind) {
    case 'time': return `${signed(e.amount)} Tiempo`;
    case 'terror': return `${signed(e.amount)} Terror`;
    case 'heal': return `recupera ${e.amount} Vida`;
    case 'loseHealth': return `pierde ${e.amount} Vida`;
    case 'move': return `muévete hasta ${e.upTo} ${e.upTo === 1 ? 'zona' : 'zonas'}`;
    case 'endActionPhase': return 'termina la fase de Acción';
    case 'damage': return `${e.amount} de daño`;
    case 'search': return e.draw === 2 ? 'busca (2 Objetos, elige 1)' : 'roba 1 Objeto';
    case 'takeActionCard': return e.cardId ? `coge ${actionDef(e.cardId).name}` : `coge una carta de Acción (coste ≤ ${e.maxCost})`;
    case 'bloodlust': return `${signed(e.amount)} Sed de Sangre`;
    case 'placeVictims': return `${e.count} Víctimas nuevas`;
    case 'wrath': {
      const which = e.which === 'choose' ? 'una Ira' : e.which === 'killer' ? 'la Ira Asesina' : 'la Ira Divina';
      if (e.op === 'increase') return `aumenta ${which}${e.amount ? ` en ${e.amount}` : ''}`;
      if (e.op === 'halve') return `reduce ${which} a la mitad`;
      if (e.op === 'set') return `reduce ${which} a ${e.amount}`;
      return `reduce ${which} en ${e.amount ?? 1}`;
    }
    case 'unleash': return `Desata la ${e.which === 'killer' ? 'Ira Asesina' : 'Ira Divina'}`;
    default: return e.kind;
  }
}

export const randomFrom = pick;
export { distance };
