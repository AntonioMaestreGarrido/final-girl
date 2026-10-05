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
} from './core';
import { applyWrath, unleashWrath, wrathAmount } from './wrath';
import { actionDef, distance, distances, horrorDef, itemDef, killerDef, locationDef, neighbors, shortestPaths, victimsIn, zoneDef, zoneName } from './lookup';
import { pick, rollDie } from './rng';
import type { ChoiceHandler, EffectSource, GameState, Task } from './state';

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
      return push(s, { t: 'fgMove', remaining: e.upTo, src, mode: 'walk' });
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
      if (!zoneDef(s, zone).search) return log(s, 'No estás en una zona de Búsqueda.');
      return push(s, { t: 'search', zone, drawn: [], draw: e.draw });
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
      return push(s, { t: 'killerAction', action: e.action, src, step: 'target', killed: 0, attackedFG: false });
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

export function choice(title: string, options: { id: string; label: string }[], then: ChoiceHandler): Task {
  return { t: 'choice', title, options, then };
}

// ---------------------------------------------------------------- daño de la Chica Final

/** Daño infligido por la Chica Final con una carta: añade arma y Habilidad Definitiva (una vez). */
export function dealDamage(s: GameState, amount: number, src: EffectSource): void {
  if (amount <= 0) return;
  let total = amount;
  const weapon = src.kind === 'action' && src.weaponUid ? s.fg.items.find((i) => i.uid === src.weaponUid) : undefined;
  const weaponDef = weapon ? itemDef(s, weapon.id) : undefined;
  const firstHit = src.kind === 'action' && !src.damageBonusApplied;
  if (src.kind === 'action' && !src.damageBonusApplied) {
    src.damageBonusApplied = true;
    if (weapon) {
      const def = itemDef(s, weapon.id);
      total += def.damage ?? 0;
      log(s, `${def.name}: +${def.damage} de daño.`, 'good');
    }
    if (has(s, 'ult-laurie') && s.fg.zone === s.killer.zone) {
      total++;
      log(s, 'Habilidad Definitiva de Laurie: +1 de daño.', 'good');
    }
  }
  const weaponIsBat = src.weaponUid && s.fg.items.find((i) => i.uid === src.weaponUid && i.id === 'bate-metalico');
  damageKiller(s, total);
  if (!s.outcome) afterFgDamage(s, total, weapon && firstHit ? weapon.uid : undefined, weaponDef?.custom);
  if (weaponIsBat && s.killer.minors.length && !s.outcome) {
    push(
      s,
      choice(
        'Bate metálico: ¿descartas un Poder Oscuro Menor?',
        [
          ...s.killer.minors.map((m) => ({ id: m.id, label: `Descartar ${horrorDef(s, m.id).name}` })),
          { id: 'no', label: 'No' },
        ],
        { kind: 'custom', id: 'bat-discard-minor' },
      ),
    );
  }
}

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
  const inst = { uid: `i${s.nextUid++}`, id, inHands: false, ...(def.uses ? { uses: def.uses } : {}) };
  // Si caben en las manos, se colocan ahí; si no, va a la mochila y el jugador reorganiza.
  const fits = def.hands > 0 && handsUsed(s) + def.hands <= 2;
  s.fg.items.push(inst);
  inst.inHands = fits;
  const where = def.hands === 0 ? 'a la mochila' : fits ? 'a las manos' : 'a la mochila (no te caben en las manos)';
  log(s, `Consigues: ${def.name} (va ${where}; mira «Tu equipo» abajo a la derecha).`, 'good', undefined, { kind: 'item', id });
  if (def.custom === 'item-motorboat') placeBoat(s);
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
      const [name, arg] = id.split(':') as [string, string | undefined];
      const fn = customEffects.get(name);
      if (!fn) throw new RuleError(`Efecto especial sin implementar: ${id} (${src.kind})`);
      return fn(s, arg, src);
    }
  }
}

// Efectos únicos de otras películas (definidos en sus módulos). Ids con parámetro: "nombre:arg".
type CustomEffect = (s: GameState, arg: string | undefined, src: EffectSource) => void;
const customEffects = new Map<string, CustomEffect>();
export const registerEffect = (id: string, fn: CustomEffect) => customEffects.set(id, fn);

export function teleportKiller(s: GameState, zone: ZoneId): void {
  s.killer.zone = zone;
  log(s, `¡${killerDef(s).name} aparece en ${zoneName(s, zone)}!`, 'killer', { kind: 'killerMove', path: [zone] });
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

// Elecciones de objetos, eventos y fases (definidas en sus módulos).
type CustomChoice = (s: GameState, option: string, data: Record<string, unknown>) => void;
const customChoices = new Map<string, CustomChoice>();
export const registerChoice = (id: string, fn: CustomChoice) => customChoices.set(id, fn);

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
