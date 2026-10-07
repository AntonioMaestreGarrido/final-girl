import type { CardId, ItemCard, ZoneId } from '../content/types';
import {
  adrenalineDice,
  changeTime,
  damageFG,
  damageKiller,
  has,
  itemsWith,
  killerShielded,
  log,
  moveVictim,
  push,
  pushEffects,
  RuleError,
  usable,
  victimLabel,
  victimLeaves,
} from './core';
import { increaseWrath } from './wrath';
import { dealDamage, describeEffects, discardItem, gainItem, spendUse, zappoSearchZones } from './effects';
import { charlieCanUltimate, charlieUltimate, junkSearchPenalty, mirrorsAfterRoll, onFgEnter, removeLegTrap, resolveTrapItem } from './carnival';
import { damageMinionsAt, enemyInRange, enemyZones, minionsAt } from './enemies';
import { birdsOnFgEnter, birdsOnSpecialSaved, birdsWallBlocks } from './birds';
import {
  convinceTargets,
  mapleAdjustDice,
  mapleAfterCard,
  mapleCanFollow,
  mapleCardPlayable,
  mapleFilterDestinations,
  mapleItemActions,
  mapleLockedHouses,
  mapleOnFgEnter,
  mapleRescuable,
  mapleUseItem,
  mp,
  mapleAsleep,
  searchableHere,
} from './maple';
import {
  creechAdjustDice,
  creechAfterRoll,
  creechAliceUltimate,
  creechBeforeAction,
  creechCanFollow,
  creechFilterDestinations,
  creechFollowKiller,
  creechItemActions,
  creechMustFollow,
  creechOnFgEnter,
  creechPanicDestination,
  creechPanicWhy,
  creechUseItem,
  cs,
  strikeVictims,
} from './creech';
import { actionDef, boardDef, distance, fgDef, horrorDef, isBirds, itemDef, killerDef, killerIn, locationDef, neighbors, victimsIn, zoneDef, zoneName } from './lookup';
import { rollDie } from './rng';
import { choice, effectRolls, registerChoice, registerEffectRoll } from './registry';
import * as grooves from './grooves';
import type { EffectSource, GameState, Input, Prompt, RollPurpose, Task } from './state';

type T<K extends Task['t']> = Extract<Task, { t: K }>;

const fgName = (s: GameState) => fgDef(s).name;

// ---------------------------------------------------------------- menú de la fase de Acción

const dealsDamage = (cardId: CardId) => {
  const r = actionDef(cardId).results;
  return !!r && [r.double, r.single, r.fail].some((line) => line.some((alt) => alt.some((e) => e.kind === 'damage')));
};

/** Armas en las manos que pueden modificar `cardId` a la distancia actual del Asesino. */
export function weaponsFor(s: GameState, cardId: CardId): string[] {
  return s.fg.items
    .filter((it) => {
      const def = itemDef(s, it.id);
      if (!def.range || !usable(s, it) || def.damage === undefined) return false;
      if (def.modifies === 'none') return false;
      if (Array.isArray(def.modifies) && !def.modifies.includes(cardId)) return false;
      // Martillos: hace falta Salud suficiente para blandirlos.
      if (def.custom === 'item-hammer' && s.fg.health.hp < 4) return false;
      if (def.custom === 'item-hammer-charlie' && s.fg.health.hp < 2) return false;
      const max = def.range[1] + (def.custom === 'item-old-rifle' && zoneDef(s, s.fg.zone).sacred ? 2 : 0);
      return enemyInRange(s, def.range[0], max) || ((has(s, 'finale-friends') || strikeVictims(s)) && s.victims.some((v) => v.role !== 'lobo' && distance(s, s.fg.zone, v.zone, 'fg') >= def.range![0] && distance(s, s.fg.zone, v.zone, 'fg') <= max));
    })
    .map((it) => it.uid);
}

/** ¿Hay alguien a quien golpear sin arma (un Enemigo en tu zona o, con "Hice a tus amigos", una Víctima)? */
const canPunch = (s: GameState) => enemyZones(s).includes(s.fg.zone) || ((has(s, 'finale-friends') || strikeVictims(s)) && victimsIn(s, s.fg.zone).some((v) => v.role !== 'lobo'));

export function playableCards(s: GameState): { cardId: CardId; weapons: string[] }[] {
  const out: { cardId: CardId; weapons: string[] }[] = [];
  for (const cardId of new Set(s.fg.hand)) {
    const def = actionDef(cardId);
    if (def.timing !== 'action') continue;
    if (!mapleCardPlayable(s, cardId)) continue;
    if (dealsDamage(cardId)) {
      const weapons = weaponsFor(s, cardId);
      if (!canPunch(s) && !weapons.length) continue;
      out.push({ cardId, weapons });
      continue;
    }
    if (def.results?.double.some((alt) => alt.some((e) => e.kind === 'search')) && !searchableHere(s) && !zappoSearchZones(s).length) continue;
    out.push({ cardId, weapons: [] });
  }
  return out;
}

interface ItemAction {
  uid: string;
  action: string;
  label: string;
}

export function itemActions(s: GameState): ItemAction[] {
  const out: ItemAction[] = [];
  const time = s.fg.time;
  const once = (key: string) => s.mods.usedThisPhase.includes(key);
  for (const it of s.fg.items) {
    if (!usable(s, it)) continue;
    const def = itemDef(s, it.id);
    const add = (action: string, label: string) => out.push({ uid: it.uid, action, label });
    out.push(...creechItemActions(s, it, def.custom, time));
    out.push(...mapleItemActions(s, it, def.custom, time));
    switch (def.custom) {
      case 'item-whistle':
        if (time >= 1 && !once(it.uid)) add('use', 'Silbato (1 Tiempo)');
        break;
      case 'item-energy-drink':
        add('use', 'Bebida energética');
        break;
      case 'item-mystery-pills':
        add('use', 'Píldoras misteriosas');
        break;
      case 'item-rabbit-foot':
        add('use', 'Pata de conejo');
        break;
      case 'item-map':
        add('use', 'Mapa');
        break;
      case 'item-flashlight':
        if (time >= 1 && !once(it.uid) && s.horrorDeck.length) add('use', 'Linterna (1 Tiempo)');
        break;
      case 'item-motorboat': {
        const boat = s.tokens.find((t) => t.id === 'bote-a-motor');
        if (boat?.zone === s.fg.zone && time >= 2) add('travel', 'Viajar en bote (2 Tiempo)');
        break;
      }
      case 'item-bear-trap':
        if (time >= 2 && s.fg.zone !== 'lago') add('place', 'Colocar Trampa para osos (2 Tiempo)');
        break;
      case 'item-fireworks':
        if (time >= 2) add('place', 'Colocar Fuegos artificiales (2 Tiempo)');
        break;
      case 'item-shaman-bones':
        if ((it.uses ?? 0) > 0 && s.horrorDeck.length) add('use', 'Huesos del shamán (mirar el Horror)');
        break;
      case 'item-out-of-order':
        if (time >= 1 && grooves.outOfOrderOptions(s).length) add('use', 'Señales de fuera de servicio (1 Tiempo)');
        break;
      case 'item-air-horn':
        if (time >= 1) add('use', 'Bocina (1 Tiempo)');
        break;
      case 'item-bow': {
        const cost = bowCost(def);
        if (def.range && time >= cost && (it.uses ?? 0) > 0 && enemyInRange(s, def.range[0], def.range[1])) add('shoot', `Disparar ${def.name} (${cost} Tiempo)`);
        break;
      }
      case 'item-crystal-ball':
        if (!once(it.uid)) add('use', 'Bola de cristal (una vez por fase)');
        break;
    }
  }
  if (mapleAsleep(s) && mp(s).br.deck.length) out.push({ uid: 'ml:br', action: 'resolve', label: 'Sala de Calderas: resolver una carta' });
  if (s.fg.legTrap && time >= 2) out.push({ uid: 'cn:legtrap', action: 'remove', label: 'Quitar la trampa de tu pierna (2 Tiempo)' });
  if (s.activeHorror.includes('la-volubilidad-de-los-dioses') && time >= 3) {
    out.push({ uid: 'horror:la-volubilidad-de-los-dioses', action: 'discard', label: 'Descartar La volubilidad de los dioses (3 Tiempo)' });
  }
  return out;
}

const bowCost = (def: ItemCard) => (def.id === 'arco-de-laurie' ? 1 : 2);

function reikoCanMove(s: GameState): boolean {
  if (isBirds(s) || !has(s, 'ult-reiko') || s.mods.usedThisPhase.includes('ult-reiko')) return false;
  const d = distance(s, s.fg.zone, s.killer.zone, 'fg');
  return d > 0 && d <= 2;
}

/** Melanie: una vez por fase de Acción, con algún Enemigo en su espacio. */
function melanieCanUltimate(s: GameState): boolean {
  if (!has(s, 'ult-melanie') || s.mods.usedThisPhase.includes('ult-melanie')) return false;
  return minionsAt(s, s.fg.zone).length > 0 || (!isBirds(s) && s.killer.zone === s.fg.zone && !killerShielded(s));
}

function melanieUltimate(s: GameState): void {
  s.mods.usedThisPhase.push('ult-melanie');
  log(s, 'Habilidad Definitiva de Melanie: pierdes 1 Vida para repartir 2 de daño entre los Enemigos de tu espacio.', 'good');
  damageFG(s, 1);
  if (!s.outcome) melanieStrike(s, 2);
}

/** Reparte los puntos de daño de Melanie entre el Asesino (si está) y los Esbirros de su espacio. */
function melanieStrike(s: GameState, left: number): void {
  if (left <= 0 || s.outcome) return;
  const minions = minionsAt(s, s.fg.zone).length;
  const killer = !isBirds(s) && s.killer.zone === s.fg.zone && !killerShielded(s);
  if (killer && minions) {
    push(s, choice(`Melanie: ¿a quién va el siguiente punto de daño? (quedan ${left})`, [{ id: 'killer', label: killerDef(s).name }, { id: 'minions', label: `${killerDef(s).minion?.plural ?? 'Esbirros'} de tu espacio` }], { kind: 'custom', id: 'melanie-strike', data: { left } }));
    return;
  }
  if (killer) return damageKiller(s, left);
  if (minions) damageMinionsAt(s, s.fg.zone, left);
}

registerChoice('melanie-strike', (s, option, data) => {
  if (option === 'killer') damageKiller(s, 1);
  else damageMinionsAt(s, s.fg.zone, 1);
  melanieStrike(s, (data.left as number) - 1);
});

export const rescuableVictims = (s: GameState) =>
  (zoneDef(s, s.fg.zone).exit || s.fg.zone === 'helicoptero') && s.phase === 'action' && mapleRescuable(s, s.fg.zone) && !birdsWallBlocks(s, s.fg.zone)
    ? victimsIn(s, s.fg.zone).filter((v) => v.role !== 'lobo' && (v.role !== 'maldita' || s.victims.length === 1))
    : [];

export function mainPrompt(s: GameState): Prompt {
  return {
    type: 'main',
    playable: playableCards(s),
    itemActions: itemActions(s),
    ultimate: reikoCanMove(s) || charlieCanUltimate(s) || melanieCanUltimate(s),
    ...(charlieCanUltimate(s) ? { ultimateLabel: 'Habilidad Definitiva: pierde 3 Vida y coge Golpe crítico' } : {}),
    ...(melanieCanUltimate(s) ? { ultimateLabel: 'Habilidad Definitiva: pierde 1 Vida para repartir 2 de daño entre los Enemigos de tu espacio' } : {}),
    canRescue: rescuableVictims(s).length > 0,
  };
}

/** ¿Puede la Chica Final hacer algo más en esta fase de Acción? */
export function hasActionPhaseOptions(s: GameState): boolean {
  const p = mainPrompt(s);
  return p.type === 'main' && (s.fg.hand.length > 0 || p.itemActions.length > 0 || p.ultimate || p.canRescue);
}

export function inputMain(s: GameState, input: Input): 'done' | 'continue' {
  switch (input.type) {
    case 'playCard': {
      const p = playableCards(s).find((c) => c.cardId === input.cardId);
      if (!p) throw new RuleError('No puedes jugar esa carta ahora');
      if (input.weaponUid && !p.weapons.includes(input.weaponUid)) throw new RuleError('Esa arma no sirve para esta carta');
      if (!canPunch(s) && dealsDamage(input.cardId) && !input.weaponUid) throw new RuleError('Necesitas un arma a distancia para atacar desde aquí');
      s.fg.hand.splice(s.fg.hand.indexOf(input.cardId), 1);
      s.actionDiscard.push(input.cardId);
      log(s, `${fgName(s)} juega ${actionDef(input.cardId).name}.`);
      push(s, { t: 'playAction', cardId: input.cardId, ...(input.weaponUid ? { weaponUid: input.weaponUid } : {}), step: 'roll' });
      creechBeforeAction(s, input.cardId);
      return 'continue';
    }
    case 'discardForTime': {
      if (!input.cardIds.length) throw new RuleError('Elige al menos una carta');
      const hand = [...s.fg.hand];
      for (const c of input.cardIds) {
        const i = hand.indexOf(c);
        if (i < 0) throw new RuleError('No tienes esas cartas');
        hand.splice(i, 1);
      }
      s.fg.hand = hand;
      s.actionDiscard.push(...input.cardIds);
      log(s, `Descartas ${input.cardIds.length} ${input.cardIds.length === 1 ? 'carta' : 'cartas'} para ganar Tiempo.`);
      changeTime(s, input.cardIds.length * (has(s, 'ult-sheila') ? 2 : 1));
      return 'continue';
    }
    case 'useItem':
      useItem(s, input.uid, input.action);
      return 'continue';
    case 'ultimate': {
      if (charlieCanUltimate(s)) {
        charlieUltimate(s);
        return 'continue';
      }
      if (melanieCanUltimate(s)) {
        melanieUltimate(s);
        return 'continue';
      }
      if (!reikoCanMove(s)) throw new RuleError('No puedes usar la Habilidad Definitiva ahora');
      s.mods.usedThisPhase.push('ult-reiko');
      log(s, `Habilidad Definitiva de Reiko: se lanza hacia ${killerDef(s).name}.`, 'good');
      push(s, { t: 'fgMove', remaining: 1, src: { kind: 'system' }, mode: 'free' });
      return 'continue';
    }
    case 'startRescue':
      if (!rescuableVictims(s).length) throw new RuleError('No hay Víctimas que salvar aquí');
      push(s, { t: 'rescue' });
      return 'continue';
    case 'endActionPhase':
      s.mods.actionPhaseEnding = true;
      return 'continue';
    default:
      throw new RuleError('Acción no válida en la fase de Acción');
  }
}

// ---------------------------------------------------------------- carta de Acción

export function stepPlayAction(s: GameState, task: T<'playAction'>): 'done' | 'continue' {
  if (task.step === 'roll') {
    task.step = 'resolve';
    push(s, newRoll(s, { kind: 'action', cardId: task.cardId, ...(task.weaponUid ? { weaponUid: task.weaponUid } : {}) }));
    return 'continue';
  }
  const def = actionDef(task.cardId);
  const n = task.successes ?? 0;
  // Libro de oración: +1 éxito al jugar Expiar.
  const book = task.cardId === 'expiar' && !task.prayed && n < 3 ? itemsWith(s, 'item-prayer-book')[0] : undefined;
  if (book) {
    task.prayed = true;
    push(s, choice(`Expiar: ${n} ${n === 1 ? 'éxito' : 'éxitos'}. ¿Usas el Libro de oración (+1 éxito)?`, [
      { id: 'yes', label: `Sí (${book.uses} ${book.uses === 1 ? 'uso' : 'usos'})` },
      { id: 'no', label: 'No' },
    ], { kind: 'custom', id: 'prayer-book', data: { uid: book.uid } }));
    return 'continue';
  }
  const triple = n >= 3 && def.results!.triple;
  const line = triple ? def.results!.triple! : n >= 2 ? def.results!.double : n === 1 ? def.results!.single : def.results!.fail;
  log(s, `${def.name}: ${triple ? 'éxito triple' : n >= 2 ? 'éxito doble' : n === 1 ? 'éxito' : 'fracaso'}.`, n ? 'good' : 'bad');
  const src: EffectSource = { kind: 'action', id: task.cardId, ...(task.weaponUid ? { weaponUid: task.weaponUid } : {}) };
  resolveLine(s, line, src);
  mapleAfterCard(s, task.cardId);
  return 'done';
}

function resolveLine(s: GameState, line: NonNullable<ReturnType<typeof actionDef>['results']>['double'], src: EffectSource): void {
  if (line.length > 1) {
    push(s, choice('Elige el resultado', line.map((alt, i) => ({ id: String(i), label: describeEffects(s, alt) })), {
      kind: 'effects',
      options: Object.fromEntries(line.map((alt, i) => [String(i), alt])),
      src,
    }));
  } else pushEffects(s, line[0] ?? [], src);
}

export function stepReaction(s: GameState, task: T<'reaction'>): 'done' | 'continue' {
  if (!task.rolled) {
    task.rolled = true;
    push(s, newRoll(s, { kind: 'reaction', cardId: task.cardId }));
    return 'continue';
  }
  const def = actionDef(task.cardId);
  const n = task.successes ?? 0;
  log(s, `${def.name}: ${n >= 2 ? 'éxito doble' : n === 1 ? 'éxito' : 'fracaso'}.`, n ? 'good' : 'bad');
  // Las armas cuerpo a cuerpo modifican el daño de Contraataque (FAQ); se elige la mejor.
  const melee = weaponsFor(s, task.cardId).map((u) => s.fg.items.find((i) => i.uid === u)!).sort((a, b) => (itemDef(s, b.id).damage ?? 0) - (itemDef(s, a.id).damage ?? 0));
  // El contraataque va contra quien te atacó.
  const attack = [...s.stack].reverse().find((x) => x.t === 'attackFG');
  const by = attack && attack.t === 'attackFG' ? attack.by : undefined;
  const minion = by?.startsWith('m:') ? s.minions.find((m) => m.id === by.slice(2)) : undefined;
  const target = minion ? `mz:${minion.zone}` : by === 'killer' || !by ? 'killer' : undefined;
  const src: EffectSource = { kind: 'action', id: task.cardId, ...(melee[0] ? { weaponUid: melee[0].uid } : {}), ...(target ? { target } : {}) };
  resolveLine(s, n >= 2 ? def.results!.double : n === 1 ? def.results!.single : def.results!.fail, src);
  // Bate y escudo de Adelaide: con algún éxito en Guardia, 1 de daño al Enemigo que te atacó.
  if (task.cardId === 'guardia' && n >= 1 && has(s, 'item-adelaide-bat')) {
    log(s, 'Bate y escudo de Adelaide: devuelves el golpe.', 'good');
    dealDamage(s, 1, { kind: 'item', id: 'bate-y-escudo-de-adelaide' });
  }
  return 'done';
}

registerChoice('prayer-book', (s, option, data) => {
  if (option !== 'yes') return;
  const task = [...s.stack].reverse().find((t) => t.t === 'playAction');
  if (!task || task.t !== 'playAction') return;
  task.successes = (task.successes ?? 0) + 1;
  log(s, 'Libro de oración: +1 éxito.', 'good');
  spendUse(s, data.uid as string);
});

// Tiradas pedidas por cartas (Carácter voluble, Ira hirviendo...): se resuelven por id.
export { registerEffectRoll };

// ---------------------------------------------------------------- Tiradas de Terror

export function newRoll(s: GameState, purpose: RollPurpose): T<'roll'> {
  let dice = boardDef(s).terrorTrack[s.fg.terror]!.dice;
  const extra: string[] = [];
  if (s.mods.bonusDiceNextRoll) {
    dice += s.mods.bonusDiceNextRoll;
    extra.push(`+${s.mods.bonusDiceNextRoll} por Planear`);
    s.mods.bonusDiceNextRoll = 0;
  }
  const adr = adrenalineDice(s);
  if (adr) {
    dice += adr;
    extra.push(`+${adr} por subidón de adrenalina`);
  }
  if (has(s, 'ev-girlfriend') && s.victims.some((v) => v.role === 'novia' && v.zone === s.fg.zone)) {
    dice++;
    extra.push('+1 por la Novia');
  }
  if (purpose.kind === 'action' && purpose.cardId === 'ataque-debil' && has(s, 'item-reiko-axe')) {
    dice++;
    extra.push('+1 por el Hacha de Reiko');
  }
  if (purpose.kind === 'action') {
    const junk = junkSearchPenalty(s, purpose.cardId);
    if (junk) {
      dice -= junk;
      extra.push('−1 por perder a Zappo');
    }
  }
  dice = mapleAdjustDice(s, purpose, dice, extra);
  dice = creechAdjustDice(s, purpose, dice, extra);
  const auto34 = s.mods.partialsNextRoll || (s.phase === 'action' && s.mods.partialsThisPhase);
  s.mods.partialsNextRoll = false;
  const faces = Array.from({ length: dice }, () => rollDie(s.rng));
  log(s, `Tirada de Terror (${dice} ${dice === 1 ? 'dado' : 'dados'}${extra.length ? `, ${extra.join(', ')}` : ''}): ${faces.join(' ')}.`, 'info', { kind: 'dice', faces });
  return { t: 'roll', purpose, dice: faces, converted: [], auto34 };
}

const isPartial = (f: number) => f === 3 || f === 4;

export function rollSuccesses(task: T<'roll'>): number {
  return task.dice.reduce((n, f, i) => n + (f >= 5 || task.converted.includes(i) || (task.auto34 && isPartial(f)) ? 1 : 0), 0);
}

function rollOptions(s: GameState, task: T<'roll'>) {
  const convertible = !task.auto34 && s.fg.hand.length >= 2 && task.dice.some((f, i) => isPartial(f) && !task.converted.includes(i));
  const canCloseCall = s.fg.hand.includes('por-los-pelos');
  const canLuckyDice = itemsWith(s, 'item-lucky-dice').length > 0 || itemsWith(s, 'item-super-lucky-dice').length > 0;
  const canSister = has(s, 'ev-sister') && s.fg.time >= 2 && s.victims.some((v) => v.role === 'hermana' && v.zone === s.fg.zone);
  return { convertible, canCloseCall, canLuckyDice, canSister };
}

export function stepRoll(s: GameState, task: T<'roll'>): 'done' | 'wait' {
  const o = rollOptions(s, task);
  if (!o.convertible && !o.canCloseCall && !o.canLuckyDice && !o.canSister) return finishRoll(s, task);
  s.prompt = { type: 'roll', purpose: task.purpose, dice: task.dice, converted: task.converted, auto34: task.auto34, canCloseCall: o.canCloseCall, canLuckyDice: o.canLuckyDice, canSister: o.canSister };
  return 'wait';
}

function finishRoll(s: GameState, task: T<'roll'>): 'done' {
  task.successes = rollSuccesses(task);
  creechAfterRoll(s, task.dice);
  if (task.purpose.kind === 'action' && dealsDamage(task.purpose.cardId)) mirrorsAfterRoll(s, task.dice);
  const idx = s.stack.indexOf(task);
  const parent = s.stack[idx - 1];
  if (task.purpose.kind === 'effect') {
    const n = task.successes;
    log(s, `${task.purpose.label}: ${n} ${n === 1 ? 'éxito' : 'éxitos'}.`, n ? 'good' : 'bad');
    s.stack.splice(idx, 1);
    effectRolls.get(task.purpose.id)?.(s, n);
    s.stack.push(task);
  } else if (parent && (parent.t === 'playAction' || parent.t === 'reaction')) parent.successes = task.successes;
  else if (task.purpose.kind === 'item') afterItemRoll(s, task);
  if (task.successes === 0 && has(s, 'ev-gods-hate-failure') && s.wrath.divine !== undefined) {
    log(s, 'Los dioses odian los fallos: has fallado del todo la tirada.', 'killer');
    increaseWrath(s, 'divine', 1);
  }
  return 'done';
}

export function inputRoll(s: GameState, task: T<'roll'>, input: Input): 'done' | 'continue' {
  switch (input.type) {
    case 'convertPartial': {
      const f = task.dice[input.die];
      if (f === undefined || !isPartial(f) || task.converted.includes(input.die)) throw new RuleError('Ese dado no es un éxito parcial');
      const hand = [...s.fg.hand];
      for (const c of input.discard) {
        const i = hand.indexOf(c);
        if (i < 0) throw new RuleError('No tienes esas cartas');
        hand.splice(i, 1);
      }
      s.fg.hand = hand;
      s.actionDiscard.push(...input.discard);
      task.converted.push(input.die);
      log(s, `Descartas ${input.discard.map((c) => actionDef(c).name).join(' y ')} para convertir un ${f} en éxito.`);
      return 'continue';
    }
    case 'closeCall': {
      const i = s.fg.hand.indexOf('por-los-pelos');
      if (i < 0) throw new RuleError('No tienes Por los pelos');
      s.fg.hand.splice(i, 1);
      s.actionDiscard.push('por-los-pelos');
      if (input.die !== undefined) {
        if (task.dice[input.die] === undefined) throw new RuleError('Dado no válido');
        task.dice[input.die] = rollDie(s.rng);
        task.converted = task.converted.filter((d) => d !== input.die);
        log(s, `Por los pelos: vuelves a tirar un dado (${task.dice[input.die]}).`, 'info', { kind: 'dice', faces: task.dice });
      } else {
        task.dice = task.dice.map(() => rollDie(s.rng));
        task.converted = [];
        log(s, `Por los pelos: vuelves a tirar todos los dados (${task.dice.join(' ')}).`, 'info', { kind: 'dice', faces: task.dice });
        changeTime(s, -2);
      }
      return 'continue';
    }
    case 'luckyDice': {
      const plain = itemsWith(s, 'item-lucky-dice')[0];
      const dice = plain ?? itemsWith(s, 'item-super-lucky-dice')[0];
      if (!dice) throw new RuleError('No tienes los Dados de la suerte');
      if (!input.dice.length || input.dice.some((d) => task.dice[d] === undefined)) throw new RuleError('Elige qué dados repetir');
      for (const d of input.dice) task.dice[d] = rollDie(s.rng);
      task.converted = task.converted.filter((d) => !input.dice.includes(d));
      log(s, `Dados de la suerte: repites ${input.dice.length} ${input.dice.length === 1 ? 'dado' : 'dados'} (${task.dice.join(' ')}).`, 'info', { kind: 'dice', faces: task.dice });
      if (plain) discardItem(s, dice.uid);
      else {
        // Super dados de la suerte: después tiras un dado; con 1-4 se descartan, con 5-6 los conservas.
        const keep = rollDie(s.rng);
        log(s, `Super dados de la suerte: dado ${keep}. ${keep >= 5 ? 'Los conservas.' : 'Se descartan.'}`, keep >= 5 ? 'good' : 'bad', { kind: 'dice', faces: [keep] });
        if (keep <= 4) discardItem(s, dice.uid);
      }
      return 'continue';
    }
    case 'sisterReroll': {
      if (!has(s, 'ev-sister') || !s.victims.some((v) => v.role === 'hermana' && v.zone === s.fg.zone)) throw new RuleError('Tu Hermana no está contigo');
      if (task.dice[input.die] === undefined) throw new RuleError('Dado no válido');
      changeTime(s, -2);
      task.dice[input.die] = rollDie(s.rng);
      task.converted = task.converted.filter((d) => d !== input.die);
      log(s, `Tu Hermana te ayuda (−2 Tiempo): vuelves a tirar un dado (${task.dice[input.die]}).`, 'info', { kind: 'dice', faces: task.dice });
      return 'continue';
    }
    case 'confirmRoll':
      return finishRoll(s, task);
    default:
      throw new RuleError('Respuesta no válida para la tirada');
  }
}

// ---------------------------------------------------------------- movimiento

export function followLimit(s: GameState): number {
  let n = 2;
  if (has(s, 'ev-stubborn-kids')) n--;
  if (s.fg.items.some((i) => itemDef(s, i.id).custom === 'item-whistle')) n++;
  return Math.max(0, n);
}

function moveDestinations(s: GameState, mode: T<'fgMove'>['mode']): ZoneId[] {
  if (mode === 'free') return [s.killer.zone];
  if (mode === 'convince') return convinceTargets(s);
  const zones = mapleLockedHouses(s, mapleFilterDestinations(s, baseDestinations(s, mode), mode));
  return creechFilterDestinations(s, zones, mode);
}

function baseDestinations(s: GameState, mode: 'walk' | 'boat' | 'free'): ZoneId[] {
  if (mode === 'boat') return locationDef(s).zones.filter((z) => z.water && z.id !== s.fg.zone).map((z) => z.id);
  if (s.fg.legTrap) return [];
  const adj = neighbors(s, s.fg.zone, 'fg');
  // Pértiga de 10': una vez por fase de Acción puedes saltar un espacio.
  if (mode === 'walk' && has(s, 'item-pole') && !s.mods.usedThisPhase.includes('pole')) {
    const far = new Set<ZoneId>();
    for (const a of adj) for (const b of neighbors(s, a, 'fg')) if (b !== s.fg.zone && !adj.includes(b)) far.add(b);
    return [...adj, ...far];
  }
  return adj;
}

export function stepFgMove(s: GameState, task: T<'fgMove'>): 'done' | 'wait' | 'continue' {
  if (task.remaining <= 0) return 'done';
  // Pánico (Creech Manor): el espacio se decide con una tirada de huida.
  const why = creechPanicWhy(s, task.mode);
  const allowed = why ? moveDestinations(s, task.mode) : [];
  if (why && allowed.length) {
    const dest = creechPanicDestination(s, why, allowed);
    if (!dest) {
      task.remaining--;
      return task.remaining <= 0 ? 'done' : 'continue';
    }
    return inputFgMove(s, task, { type: 'moveTo', zone: dest, bring: [] });
  }
  s.prompt = {
    type: 'move',
    remaining: task.remaining,
    to: moveDestinations(s, task.mode),
    followers: victimsIn(s, s.fg.zone).filter((v) => v.role !== 'hombre' && v.role !== 'lobo' && creechCanFollow(s, v) && mapleCanFollow(s, v)).map((v) => v.id),
    followLimit: followLimit(s),
    mode: task.mode,
  };
  return 'wait';
}

export function inputFgMove(s: GameState, task: T<'fgMove'>, input: Input): 'done' | 'continue' {
  if (input.type === 'stopMoving') {
    if (task.mode !== 'walk') throw new RuleError('Elige un destino');
    offerGuideMove(s, task);
    return 'done';
  }
  if (input.type !== 'moveTo') throw new RuleError('Respuesta no válida para el movimiento');
  if (!moveDestinations(s, task.mode).includes(input.zone)) throw new RuleError('No puedes moverte ahí');
  const from = s.fg.zone;
  const here = victimsIn(s, from);
  const killerThere = killerIn(s, input.zone);
  const jump = task.mode === 'walk' && !neighbors(s, from, 'fg').includes(input.zone);
  let bring = here.filter((v) => input.bring.includes(v.id));
  if (bring.length !== input.bring.length) throw new RuleError('Esas Víctimas no están contigo');
  if (bring.some((v) => v.role === 'hombre' || v.role === 'lobo' || !creechCanFollow(s, v) || !mapleCanFollow(s, v))) throw new RuleError('Esa Víctima no te sigue');
  if (jump) {
    if (bring.length) log(s, 'Saltas con la pértiga: ninguna Víctima puede seguirte.', 'bad');
    bring = [];
    s.mods.usedThisPhase.push('pole');
    log(s, 'Pértiga de 10 pies: saltas un espacio.', 'good');
  }
  if (bring.length > followLimit(s)) throw new RuleError(`Solo te pueden seguir ${followLimit(s)} Víctimas`);
  // Las Víctimas no te siguen a la zona del Asesino (salvo la Novia o con la Habilidad de Barbara).
  // «Víctimas pegajosas»: debes tener al menos 1 Víctima siguiéndote, si es posible.
  if (!jump && !bring.length && creechMustFollow(s)) {
    const first = here.find((v) => v.role !== 'hombre' && v.role !== 'lobo' && creechCanFollow(s, v) && mapleCanFollow(s, v));
    if (first && followLimit(s) > 0) {
      bring = [first];
      log(s, 'Víctimas pegajosas: una Víctima se pega a ti y te sigue.', 'bad');
    }
  }
  if (killerThere && !has(s, 'ult-barbara') && !creechFollowKiller(s) && bring.some((v) => v.role !== 'novia')) {
    bring = bring.filter((v) => v.role === 'novia');
    log(s, 'Las Víctimas no te siguen a la zona del Asesino: se quedan atrás.', 'bad');
  }
  if (bring.length && !grooves.followerCanEnter(s, input.zone)) {
    bring = [];
    log(s, `${zoneName(s, input.zone)} está cerrado: las Víctimas no pueden entrar.`, 'bad');
  }
  s.fg.zone = input.zone;
  task.remaining--;
  task.moved = (task.moved ?? 0) + 1;
  if (task.mode === 'boat') {
    const boat = s.tokens.find((t) => t.id === 'bote-a-motor');
    if (boat) boat.zone = input.zone;
  }
  const who = bring.length ? ` con ${bring.length === 1 ? victimLabel(bring[0]!) : `${bring.length} Víctimas`}` : '';
  log(s, `${fgName(s)} va a ${zoneName(s, input.zone)}${who}.`, 'info', { kind: 'fgMove', path: [from, input.zone], ...(bring.length ? { victims: bring.map((v) => v.id) } : {}) });
  for (const v of bring) moveVictim(s, v, input.zone);
  onFgEnter(s, input.zone);
  creechOnFgEnter(s, input.zone);
  mapleOnFgEnter(s, input.zone);
  birdsOnFgEnter(s);
  if (task.mode !== 'walk') task.remaining = 0;
  if (task.remaining <= 0) offerGuideMove(s, task);
  if (rescuableVictims(s).length) push(s, { t: 'rescue' });
  return task.remaining > 0 && !s.outcome ? 'continue' : 'done';
}

/** El guía turístico: una vez por turno, tras moverte, puedes moverte 1 espacio más. */
function offerGuideMove(s: GameState, task: T<'fgMove'>): void {
  if (task.mode !== 'walk' || !task.moved || !has(s, 'ev-tour-guide') || s.mods.usedThisTurn.includes('guia')) return;
  if (!s.victims.some((v) => v.role === 'guia' && v.zone === s.fg.zone)) return;
  s.mods.usedThisTurn.push('guia');
  push(s, choice('El Guía Turístico está contigo: ¿te mueves 1 espacio más?', [{ id: 'yes', label: 'Sí' }, { id: 'no', label: 'No' }], { kind: 'custom', id: 'guide-move' }));
}

registerChoice('guide-move', (s, option) => {
  if (option === 'yes') push(s, { t: 'fgMove', remaining: 1, src: { kind: 'system' }, mode: 'walk' });
});

// ---------------------------------------------------------------- rescate

export function stepRescue(s: GameState): 'done' | 'wait' {
  const victims = rescuableVictims(s);
  if (!victims.length) return 'done';
  const slots = s.fg.rescueSlots.map((used, i) => (used ? -1 : i)).filter((i) => i >= 0);
  s.prompt = { type: 'rescue', victims: victims.map((v) => v.id), slots, ultimate: s.fg.ultimate };
  return 'wait';
}

export function inputRescue(s: GameState, input: Input): 'done' | 'continue' {
  if (input.type === 'rescueDone') return 'done';
  if (input.type !== 'rescueOne') throw new RuleError('Respuesta no válida para el rescate');
  const v = rescuableVictims(s).find((x) => x.id === input.victimId);
  if (!v) throw new RuleError('No puedes salvar a esa Víctima');
  const fg = fgDef(s);
  if (!s.fg.ultimate && s.fg.rescueSlots[input.slot] !== false) throw new RuleError('Ese espacio no está libre');

  s.victims = s.victims.filter((x) => x !== v);
  s.fg.saved++;
  s.mods.rescuedThisActionPhase++;
  log(s, `¡${fgName(s)} salva ${victimLabel(v) === 'el Novio' ? 'al Novio' : `a ${victimLabel(v)}`}!`, 'good');
  victimLeaves(s, v);
  if (v.role === 'super') {
    log(s, 'Has salvado al Super Turista: reduce una Ira en 4.', 'good');
    pushEffects(s, [{ kind: 'wrath', which: 'choose', op: 'reduce', amount: 4 }], { kind: 'rescue' });
  }
  if (has(s, 'ev-clingy-campers') && s.mods.rescuedThisActionPhase > 1) {
    log(s, 'Campistas pegajosos: pierdes 1 Vida.', 'bad');
    damageFG(s, 1);
  }
  if (s.fg.ultimate) {
    pushEffects(s, fg.extraRescueReward, { kind: 'rescue' });
  } else {
    s.fg.rescueSlots[input.slot] = true;
    const slot = fg.rescueSlots[input.slot]!;
    log(s, `Recompensa: ${slot.text}.`, 'good');
    if (s.fg.rescueSlots.every(Boolean)) {
      s.fg.ultimate = true;
      log(s, `¡Habilidad Definitiva desbloqueada! ${fg.ultimate.text}`, 'good');
      if (fg.ultimate.custom === 'ult-adelaide') grooves.adelaideUltimate(s);
      if (fg.ultimate.custom === 'ult-alice') creechAliceUltimate(s);
    }
    pushEffects(s, slot.effects, { kind: 'rescue' });
  }
  if (v.bsp) birdsOnSpecialSaved(s);
  return 'continue';
}

// ---------------------------------------------------------------- búsqueda e inventario

export function stepSearch(s: GameState, task: T<'search'>): 'done' | 'wait' {
  const deck = s.itemDecks[task.zone] ?? [];
  if (!task.drawn.length) {
    if (!deck.length) {
      log(s, `No quedan Objetos en ${zoneName(s, task.zone)}.`);
      return 'done';
    }
    // Asami (Habilidad Definitiva): robas 1 carta adicional y eliges una.
    const extra = has(s, 'ult-asami') ? 1 : 0;
    task.drawn = deck.splice(0, task.draw + extra);
    s.infoSeq++;
    // Objeto Trampa: se resuelve primero y, si salió otro Objeto, te lo quedas.
    const trap = task.drawn.find((c) => itemDef(s, c.id).trap);
    if (trap) {
      const rest = task.drawn.filter((c) => c !== trap);
      if (rest.length === 1) pushEffects(s, [{ kind: 'custom', id: `cn-gain:${rest[0]!.id}` }], { kind: 'system' });
      resolveTrapItem(s, trap.id, !!task.zappo);
      if (rest.length > 1) {
        task.drawn = rest;
        s.prompt = { type: 'search', drawn: rest.map((c) => c.id) };
        return 'wait';
      }
      return 'done';
    }
    if (task.drawn.length === 1) {
      gainItem(s, task.drawn[0]!.id);
      return 'done';
    }
  }
  s.prompt = { type: 'search', drawn: task.drawn.map((c) => c.id) };
  return 'wait';
}

export function inputSearch(s: GameState, task: T<'search'>, input: Input): 'done' {
  if (input.type !== 'searchPick') throw new RuleError('Respuesta no válida para la búsqueda');
  const keep = task.drawn[input.keep];
  const others = task.drawn.filter((_, i) => i !== input.keep);
  if (!keep || !others.length) throw new RuleError('Elige uno de los Objetos');
  const deck = s.itemDecks[task.zone]!;
  if (input.otherTo === 'top') deck.unshift(...others.map((c, i) => ({ id: c.id, faceUp: i === 0 })));
  else deck.push(...others.map((c) => ({ id: c.id, faceUp: false })));
  log(s, `Dejas ${others.map((c) => itemDef(s, c.id).name).join(' y ')} ${input.otherTo === 'top' ? 'encima del mazo, bocarriba' : 'debajo del mazo, bocabajo'}.`);
  gainItem(s, keep.id);
  return 'done';
}

export function stepArrange(s: GameState, task: T<'arrange'>): 'done' | 'wait' {
  if (!s.fg.items.some((i) => itemDef(s, i.id).hands > 0)) return 'done';
  s.prompt = { type: 'arrange', optional: task.optional };
  return 'wait';
}

export function inputArrange(s: GameState, input: Input): 'done' {
  if (input.type !== 'arrange') throw new RuleError('Respuesta no válida');
  const chosen = s.fg.items.filter((i) => input.inHands.includes(i.uid));
  if (chosen.length !== input.inHands.length) throw new RuleError('Objeto desconocido');
  if (chosen.some((i) => itemDef(s, i.id).hands === 0)) throw new RuleError('Ese objeto no se lleva en las manos');
  if (chosen.reduce((n, i) => n + itemDef(s, i.id).hands, 0) > 2) throw new RuleError('Solo tienes dos manos');
  // Los martillos no se pueden llevar en la mochila: el que no vaya en las manos se descarta.
  for (const hammer of s.fg.items.filter((i) => ['item-hammer', 'item-hammer-charlie'].includes(itemDef(s, i.id).custom ?? '') && !input.inHands.includes(i.uid))) {
    log(s, `${itemDef(s, hammer.id).name} no cabe en la mochila: se descarta.`, 'bad');
    discardItem(s, hammer.uid);
  }
  for (const it of s.fg.items) it.inHands = input.inHands.includes(it.uid);
  log(s, `En las manos: ${chosen.map((i) => itemDef(s, i.id).name).join(' y ') || 'nada'}.`);
  return 'done';
}

export function stepDiscardDown(s: GameState): 'done' | 'wait' {
  const excess = s.fg.hand.length - 10;
  if (excess <= 0) return 'done';
  s.prompt = { type: 'discardDown', excess };
  return 'wait';
}

export function inputDiscardDown(s: GameState, input: Input): 'done' {
  if (input.type !== 'discardDown') throw new RuleError('Respuesta no válida');
  if (input.cardIds.length !== s.fg.hand.length - 10) throw new RuleError('Descarta el número exacto de cartas');
  for (const c of input.cardIds) {
    const i = s.fg.hand.indexOf(c);
    if (i < 0) throw new RuleError('No tienes esa carta');
    s.fg.hand.splice(i, 1);
    s.actionDiscard.push(c);
  }
  return 'done';
}

// ---------------------------------------------------------------- uso de objetos

function useItem(s: GameState, uid: string, action: string): void {
  const opt = itemActions(s).find((o) => o.uid === uid && o.action === action);
  if (!opt) throw new RuleError('No puedes usar ese objeto ahora');
  if (uid === 'ml:br') return pushEffects(s, [{ kind: 'custom', id: 'df-resolve-br' }], { kind: 'system' });
  if (uid === 'horror:la-volubilidad-de-los-dioses') return grooves.discardFickleGods(s);
  if (uid === 'cn:legtrap') return removeLegTrap(s);
  const it = s.fg.items.find((i) => i.uid === uid)!;
  const def = itemDef(s, it.id);
  if (grooves.useGroovesItem(s, uid, def.custom)) return;
  if (creechUseItem(s, uid, def.custom, action)) return;
  if (mapleUseItem(s, uid, def.custom, action)) return;
  switch (def.custom) {
    case 'item-whistle': {
      s.mods.usedThisPhase.push(uid);
      changeTime(s, -1);
      const adj = neighbors(s, s.fg.zone, 'fg');
      const called = s.victims.filter((v) => adj.includes(v.zone));
      for (const v of called) moveVictim(s, v, s.fg.zone);
      log(s, `¡Silbato! ${called.length} ${called.length === 1 ? 'Víctima acude' : 'Víctimas acuden'} a tu zona. Los Enemigos van a por ti.`);
      pushEffects(s, [{ kind: 'killerAction', action: { target: 'finalGirl', moves: 1, attacks: 0 } }], { kind: 'item', id: it.id });
      return;
    }
    case 'item-energy-drink':
      discardItem(s, uid);
      push(s, choice('Bebida energética', [{ id: 'time', label: '+3 Tiempo' }, { id: 'move', label: 'Muévete 1 zona' }], {
        kind: 'effects',
        options: { time: [{ kind: 'time', amount: 3 }], move: [{ kind: 'move', upTo: 1 }] },
        src: { kind: 'item', id: it.id },
      }));
      return;
    case 'item-mystery-pills':
      discardItem(s, uid);
      push(s, choice('Píldoras misteriosas', [{ id: 'terror', label: '−1 Terror' }, { id: 'heal', label: 'Recupera 2 Vida' }], {
        kind: 'effects',
        options: { terror: [{ kind: 'terror', amount: -1 }], heal: [{ kind: 'heal', amount: 2 }] },
        src: { kind: 'item', id: it.id },
      }));
      return;
    case 'item-rabbit-foot':
      discardItem(s, uid);
      push(s, newRoll(s, { kind: 'item', id: it.id }));
      return;
    case 'item-map':
      discardItem(s, uid);
      for (const zone of locationDef(s).itemDecks) {
        const deck = s.itemDecks[zone];
        if (!deck?.length) continue;
        if (!deck[0]!.faceUp) {
          deck[0]!.faceUp = true;
          s.infoSeq++;
          log(s, `Mapa: se revela ${itemDef(s, deck[0]!.id).name} en ${zoneName(s, zone)}.`, 'info', undefined, { kind: 'item', id: deck[0]!.id });
        } else if (deck.length > 1) {
          push(s, choice(`Mapa: ¿retiras ${itemDef(s, deck[0]!.id).name} de ${zoneName(s, zone)} y revelas la siguiente?`, [
            { id: 'yes', label: 'Sí' },
            { id: 'no', label: 'No' },
          ], { kind: 'custom', id: 'map-remove', data: { zone } }));
        }
      }
      return;
    case 'item-flashlight': {
      s.mods.usedThisPhase.push(uid);
      changeTime(s, -1);
      const top = s.horrorDeck[0]!;
      s.infoSeq++;
      push(s, choice(`Linterna: la carta superior de Horror es «${horrorDef(s, top).name}»`, [
        { id: 'keep', label: 'Dejarla encima' },
        { id: 'bottom', label: 'Ponerla en el fondo del mazo' },
      ], { kind: 'custom', id: 'flashlight' }));
      return;
    }
    case 'item-motorboat':
      changeTime(s, -2);
      push(s, { t: 'fgMove', remaining: 1, src: { kind: 'item', id: it.id }, mode: 'boat' });
      return;
    case 'item-bear-trap':
      changeTime(s, -2);
      s.tokens.push({ id: 'trampa-para-osos', zone: s.fg.zone });
      log(s, `Colocas la Trampa para osos en ${zoneName(s, s.fg.zone)}.`);
      discardItem(s, uid);
      return;
    case 'item-fireworks': {
      const options = [s.fg.zone, ...neighbors(s, s.fg.zone, 'fg')].filter((z) => z !== 'lago' && !zoneDef(s, z).house);
      push(s, choice('¿Dónde colocas los Fuegos artificiales?', options.map((z) => ({ id: z, label: zoneName(s, z) })), { kind: 'custom', id: 'place-fireworks', data: { uid } }));
      return;
    }
    case 'item-bow': {
      changeTime(s, -bowCost(def));
      log(s, `${fgName(s)} dispara una flecha con ${def.name}.`);
      spendUse(s, uid);
      dealDamage(s, def.damage ?? 1, { kind: 'item', id: it.id, weaponUid: uid });
      return;
    }
    case 'item-crystal-ball': {
      s.mods.usedThisPhase.push(uid);
      const face = rollDie(s.rng);
      log(s, `Bola de cristal: dado ${face}.`, 'info', { kind: 'dice', faces: [face] });
      if (face < 5 || !s.horrorDeck.length) return log(s, 'La bola de cristal no muestra nada.');
      const top = s.horrorDeck[0]!;
      s.infoSeq++;
      push(s, choice(`Bola de cristal: la carta superior de Horror es «${horrorDef(s, top).name}»`, [
        { id: 'keep', label: 'Dejarla encima' },
        { id: 'bottom', label: 'Ponerla en el fondo del mazo' },
      ], { kind: 'custom', id: 'flashlight' }));
      return;
    }
  }
}

registerChoice('map-remove', (s, option, data) => {
  if (option !== 'yes') return;
  const deck = s.itemDecks[data.zone as string]!;
  const removed = deck.shift()!;
  s.itemDiscard.push(removed.id);
  if (deck[0]) {
    deck[0].faceUp = true;
    s.infoSeq++;
    log(s, `Mapa: retiras ${itemDef(s, removed.id).name} y se revela ${itemDef(s, deck[0].id).name}.`, 'info', undefined, { kind: 'item', id: deck[0].id });
  }
});

registerChoice('flashlight', (s, option) => {
  if (option === 'bottom') {
    s.horrorDeck.push(s.horrorDeck.shift()!);
    log(s, 'Pones la carta de Horror en el fondo del mazo.');
  }
});

registerChoice('place-fireworks', (s, option, data) => {
  changeTime(s, -2);
  s.tokens = s.tokens.filter((t) => t.id !== 'fuegos-artificiales');
  s.tokens.push({ id: 'fuegos-artificiales', zone: option });
  log(s, `Colocas los Fuegos artificiales en ${zoneName(s, option)}.`);
  discardItem(s, data.uid as string);
});

/** Pata de conejo: por cada éxito, elige una recompensa. */
function afterItemRoll(s: GameState, task: T<'roll'>): void {
  const n = task.successes ?? 0;
  log(s, `Pata de conejo: ${n} ${n === 1 ? 'éxito' : 'éxitos'}.`, n ? 'good' : 'bad');
  for (let i = 0; i < n; i++) {
    push(s, choice(`Pata de conejo (${i + 1}/${n})`, [
      { id: 'time', label: '+2 Tiempo' },
      { id: 'heal', label: 'Recupera 1 Vida' },
      { id: 'terror', label: '−1 Terror' },
      { id: 'move', label: 'Muévete 1 zona' },
    ], {
      kind: 'effects',
      options: {
        time: [{ kind: 'time', amount: 2 }],
        heal: [{ kind: 'heal', amount: 1 }],
        terror: [{ kind: 'terror', amount: -1 }],
        move: [{ kind: 'move', upTo: 1 }],
      },
      src: { kind: 'item', id: 'pata-de-conejo' },
    }));
  }
}

// ---------------------------------------------------------------- golpes fuera de la fase de Acción

function strikePrompt(s: GameState, task: T<'strike'>): Prompt {
  return {
    type: 'main',
    strike: task.mode,
    playable: playableCards(s).filter((c) => dealsDamage(c.cardId)),
    itemActions: [],
    ultimate: false,
    canRescue: false,
  };
}

/** Gigante, Muñeco Payaso, «¡Tengo que matarte!»: puedes jugar cartas de Acción que hagan daño. */
export function stepStrike(s: GameState, task: T<'strike'>): 'done' | 'wait' {
  const prompt = strikePrompt(s, task);
  if (task.left <= 0 || prompt.type !== 'main' || !prompt.playable.length) {
    cs(s).strike = null;
    return 'done';
  }
  s.prompt = prompt;
  return 'wait';
}

export function inputStrike(s: GameState, task: T<'strike'>, input: Input): 'done' | 'continue' {
  if (input.type === 'endActionPhase') {
    cs(s).strike = null;
    return 'done';
  }
  if (input.type !== 'playCard') throw new RuleError('Solo puedes jugar una carta de Acción que haga daño o terminar');
  if (!dealsDamage(input.cardId)) throw new RuleError('Esa carta no hace daño');
  const r = inputMain(s, input);
  task.left--;
  return r;
}
