/**
 * Reglas propias de The Haunting of Creech Manor (Poltergeist / Creech Manor / Alice / Selena):
 * Carolyn y Mr. Floppy, el Poltergeist invulnerable, pánico y bloqueos del movimiento, Víctimas Especiales,
 * Helicóptero, Candado, Escaleras y las cartas de Horror, Evento y Objeto únicas.
 * El resto del motor llama a estas funciones o las registra por id.
 */
import { ACTION_CARDS } from '../content';
import type { CardId, Effect, ZoneId } from '../content/types';
import {
  capitalize,
  changeTerror,
  changeTime,
  damageFG,
  damageKiller,
  has,
  increaseBloodlust,
  itemsWith,
  killerRow,
  killVictim,
  log,
  moveVictim,
  panicVictims,
  push,
  pushEffects,
  registerVictimEnters,
  registerVictimKilled,
  victimLabel,
} from './core';
import { damageMinionsAt, enemyZones } from './enemies';
import { discardItem, drawHorror, teleportKiller } from './effects';
import { victimsStepToward } from './carnival';
import { actionDef, adjacent, distances, fgDef, horrorDef, itemDef, killerDef, locationDef, neighbors, victimsIn, zoneDef, zoneName } from './lookup';
import { choice, registerChoice, registerEffect } from './registry';
import { pick, rollDie, shuffle } from './rng';
import type { CreechState, EffectSource, GameState, ItemInst, Victim } from './state';

const SRC_HORROR: EffectSource = { kind: 'horror' };
const eff = (id: string): Effect => ({ kind: 'custom', id });

export const creechInit = (): CreechState => ({
  lock: null,
  panicNext: false,
  panicNow: false,
  lockNext: null,
  lockNow: null,
  heliUsed: false,
  fiveDice: null,
  hunterDied: false,
  carolynFound: false,
  strike: null,
  psychicPaid: false,
});

/** Estado de Creech Manor (se crea al primer uso en partidas guardadas antiguas). */
export function cs(s: GameState): CreechState {
  return (s.creech ??= creechInit());
}

// ---------------------------------------------------------------- Carolyn y Mr. Floppy

export const hasCarolyn = (s: GameState) => s.fg.items.some((i) => i.id === 'carolyn');
export const hasFloppy = (s: GameState) => s.fg.items.some((i) => i.id === 'mr-floppy');

const darkPowerRevealed = (s: GameState) => s.killer.darkPowers.some((d) => d.revealed);
const epicInPlay = (s: GameState) => s.killer.darkPowers.some((d) => killerDef(s).darkPowers.find((x) => x.id === d.id)?.epic);
/** Mr. Floppy no se puede descartar antes de revelar el Poder Oscuro ni con el Poder Oscuro Épico en juego. */
const floppyProtected = (s: GameState) => !darkPowerRevealed(s) || epicInPlay(s);

/** Zonas de Búsqueda más cercanas a la Chica Final. */
function nearestDecks(s: GameState): ZoneId[] {
  const dist = distances(s, s.fg.zone, 'fg');
  const decks = locationDef(s).itemDecks;
  const best = Math.min(...decks.map((z) => dist.get(z) ?? 99));
  return decks.filter((z) => (dist.get(z) ?? 99) === best);
}

/** Baraja una carta en un mazo de Objetos. Barajar los deja todos bocabajo (no se revela la carta superior). */
function shuffleIntoDeck(s: GameState, zone: ZoneId, cardId: CardId): void {
  const deck = s.itemDecks[zone] ?? (s.itemDecks[zone] = []);
  const ids = shuffle(s.rng, [...deck.map((c) => c.id), cardId]);
  s.itemDecks[zone] = ids.map((id) => ({ id, faceUp: false }));
  s.infoSeq++;
  log(s, `${itemDef(s, cardId).name} se baraja en el mazo de ${zoneName(s, zone)}.`, 'killer');
}

function shuffleIntoNearest(s: GameState, cardId: CardId): void {
  const near = nearestDecks(s);
  if (near.length > 1) {
    return push(s, choice(`Empate: ¿en qué mazo de Objetos se baraja ${itemDef(s, cardId).name}?`, near.map((z) => ({ id: z, label: zoneName(s, z) })), { kind: 'custom', id: 'cm-shuffle-deck', data: { cardId } }));
  }
  shuffleIntoDeck(s, near[0]!, cardId);
}
registerChoice('cm-shuffle-deck', (s, option, data) => shuffleIntoDeck(s, option, data.cardId as string));

/** Carolyn nunca se descarta y Mr. Floppy vuelve a un mazo. Devuelve true si el descarte NO debe seguir adelante. */
export function creechDiscardGuard(s: GameState, it: ItemInst): boolean {
  const def = itemDef(s, it.id);
  if (def.custom === 'item-carolyn') {
    log(s, 'Carolyn no puede ser descartada: se ignora el efecto.', 'good');
    return true;
  }
  if (def.custom === 'item-floppy') {
    if (floppyProtected(s)) {
      log(s, 'Mr. Floppy no se puede descartar todavía: se ignora el efecto.', 'good');
      return true;
    }
    s.fg.items = s.fg.items.filter((i) => i !== it);
    shuffleIntoNearest(s, 'mr-floppy');
    return true;
  }
  return false;
}

/** Objetos que se pueden descartar por un efecto del juego (sin Carolyn ni un Mr. Floppy protegido). */
const discardable = (s: GameState) =>
  s.fg.items.filter((i) => {
    const c = itemDef(s, i.id).custom;
    return c !== 'item-carolyn' && !(c === 'item-floppy' && floppyProtected(s));
  });

/** Se consigue un Objeto del Lugar o del Poltergeist con efecto inmediato. */
export function creechOnGain(s: GameState, id: CardId): void {
  const def = itemDef(s, id);
  switch (def.custom) {
    case 'item-list': {
      log(s, `Consigues: ${def.name}.`, 'good', undefined, { kind: 'item', id });
      const face = rollDie(s.rng);
      const zone = face <= 2 ? 'garaje' : face <= 4 ? 'vestidor' : 'atico';
      log(s, `Dado ${face}: se revelan todas las cartas del mazo de ${zoneName(s, zone)}.`, 'info', { kind: 'dice', faces: [face] });
      for (const c of s.itemDecks[zone] ?? []) c.faceUp = true;
      s.infoSeq++;
      s.itemDiscard.push(id);
      return;
    }
    case 'item-carolyn':
      cs(s).carolynFound = true;
      if (s.killer.minors.length) log(s, 'Carolyn se une a ti: se retiran todos los Poderes Oscuros Menores del juego.', 'good');
      else log(s, 'Carolyn se une a ti. Ahora tienes que llevarla a una zona de Salida.', 'good');
      s.killer.minors = [];
      creechCheckWin(s);
      return;
    case 'item-floppy':
      log(s, 'Has encontrado a Mr. Floppy.', 'good');
      creechCheckWin(s);
      return;
  }
}

// ---------------------------------------------------------------- victoria

/** ¿Se gana al estar en una zona de Salida con Carolyn (y Mr. Floppy con el Poder Oscuro Épico)? */
export function creechWinConditions(s: GameState): boolean {
  if (!hasCarolyn(s)) return false;
  return !has(s, 'dp-forgot-something') || hasFloppy(s);
}

export function creechCheckWin(s: GameState): void {
  if (s.outcome || !s.fg.items.length) return;
  if (!zoneDef(s, s.fg.zone).exit || !hasCarolyn(s)) return;
  if (!creechWinConditions(s)) return void log(s, 'Tienes a Carolyn, pero falta Mr. Floppy para poder ganar.', 'bad');
  win(s, 'escapa con Carolyn. ¡El Poltergeist no puede detenerla!');
}

function win(s: GameState, how: string): void {
  s.outcome = { winner: 'finalGirl', text: `${fgDef(s).name} ${how}` };
  log(s, s.outcome.text, 'phase');
  s.stack = [];
  s.prompt = null;
}

/** La Chica Final entra en un espacio: Helicóptero y salida con Carolyn. */
export function creechOnFgEnter(s: GameState, zone: ZoneId): void {
  if (zone === 'helicoptero') {
    cs(s).heliUsed = true;
    if (hasCarolyn(s) && creechWinConditions(s)) return win(s, 'sube con Carolyn al Helicóptero. ¡Están a salvo!');
    pushEffects(s, [eff('cm-heli-return')], { kind: 'event', id: 'rescate-en-helicoptero' });
    return;
  }
  creechCheckWin(s);
}

registerEffect('cm-heli-return', (s) => {
  const from = 'helicoptero';
  for (const v of s.victims.filter((x) => x.zone === from)) moveVictim(s, v, 'atico');
  s.fg.zone = 'atico';
  s.tokens = s.tokens.filter((t) => t.id !== 'helicoptero');
  if (s.activeEvents.includes('rescate-en-helicoptero')) {
    s.activeEvents = s.activeEvents.filter((e) => e !== 'rescate-en-helicoptero');
    s.eventDiscard.push('rescate-en-helicoptero');
  }
  log(s, 'No has salvado a Carolyn: vuelves al Ático y se quita la ficha del Helicóptero.', 'bad', { kind: 'fgMove', path: [from, 'atico'] });
});

// ---------------------------------------------------------------- movimiento

/** «Ráfaga de viento»: los movimientos de 2 o más espacios se reducen en 1. */
export function creechMoveLimit(s: GameState, upTo: number): number {
  if (upTo >= 2 && has(s, 'dp-wind-gust')) {
    log(s, 'Ráfaga de viento: tu movimiento se reduce en 1 espacio.', 'bad');
    return upTo - 1;
  }
  return upTo;
}

/** Bloqueos de «¡Las ventanas y las puertas…!» y «Barrera invisible». */
export function creechFilterDestinations(s: GameState, zones: ZoneId[], mode: 'walk' | 'boat' | 'free' | 'convince'): ZoneId[] {
  if (mode === 'free') return zones;
  let out = zones;
  const lock = s.creech?.lockNow;
  if (lock === 'inside') return [];
  if (lock === 'outside') out = out.filter((z) => zoneDef(s, z).outside);
  if (has(s, 'dp-invisible-barrier') && hasCarolyn(s) && s.fg.health.hp < s.fg.health.max) out = out.filter((z) => !zoneDef(s, z).exit);
  return out;
}

/** ¿Es de pánico el próximo espacio que muevas? */
export function creechPanicWhy(s: GameState, mode: 'walk' | 'boat' | 'free' | 'convince'): 'cards' | 'forces' | null {
  if (mode !== 'walk') return null;
  if (s.creech?.panicNow) return 'cards';
  if (has(s, 'mdp-unseen-forces') && !s.mods.usedThisPhase.includes('unseen-forces')) return 'forces';
  return null;
}

/** Tirada de pánico de la Chica Final: se mueve según los números de huida de su espacio (o se queda). */
export function creechPanicDestination(s: GameState, why: 'cards' | 'forces', allowed: ZoneId[]): ZoneId | null {
  if (why === 'forces') s.mods.usedThisPhase.push('unseen-forces');
  const face = rollDie(s.rng);
  const exit = zoneDef(s, s.fg.zone).flee.find((f) => f.faces.includes(face));
  const ok = exit && allowed.includes(exit.to);
  log(
    s,
    ok
      ? `Pánico: dado ${face}, huyes a ${zoneName(s, exit!.to)}.`
      : `Pánico: dado ${face}${exit ? ', pero no puedes pasar' : ''}: te quedas en ${zoneName(s, s.fg.zone)}.`,
    'bad',
    { kind: 'dice', faces: [face] },
  );
  return ok ? exit!.to : null;
}

/** Quién puede seguirte: las Víctimas Especiales no, hasta que una de ellas muera. */
export function creechCanFollow(s: GameState, v: Victim): boolean {
  return !(v.role === 'cazador' && !s.creech?.hunterDied);
}

/** Las Víctimas te siguen a la zona del Asesino con «Coraje líquido». */
export const creechFollowKiller = (s: GameState) => has(s, 'ev-liquid-courage');
/** «Víctimas pegajosas»: debes tener al menos 1 Víctima siguiéndote, si es posible. */
export const creechMustFollow = (s: GameState) => has(s, 'ev-clingy-victims');

// ---------------------------------------------------------------- tiradas

const allowsMovement = (cardId: CardId): boolean => {
  const r = actionDef(cardId).results;
  return !!r && [r.triple ?? [], r.double, r.single, r.fail].some((line) => line.some((alt) => alt.some((e) => e.kind === 'move')));
};

/** Ajusta el número de dados de una Tirada de Terror (Selena, Alice, Fuera luces, Confusión psíquica). */
export function creechAdjustDice(s: GameState, purpose: { kind: string; cardId?: string }, dice: number, extra: string[]): number {
  const cardId = purpose.kind === 'action' || purpose.kind === 'reaction' ? purpose.cardId : undefined;
  if (cardId === 'buscar') {
    if (has(s, 'ult-selena')) {
      dice += 2;
      extra.push('+2 por Selena');
    }
    if (has(s, 'mdp-psychic-confusion')) {
      if (cs(s).psychicPaid) {
        cs(s).psychicPaid = false;
        extra.push('Confusión psíquica ignorada');
      } else {
        dice -= 1;
        extra.push('−1 por Confusión psíquica');
      }
    }
  }
  if (purpose.kind === 'action' && cardId && has(s, 'ev-lights-out') && allowsMovement(cardId)) {
    const light = itemsWith(s, 'item-flashlight').length || itemsWith(s, 'item-selena-flashlight').length || itemsWith(s, 'item-candle').length;
    if (!light) {
      dice -= 1;
      extra.push('−1 por Fuera luces');
    }
  }
  dice = Math.max(1, dice);
  if (cardId && cs(s).fiveDice === cardId) {
    extra.length = 0;
    extra.push('Habilidad Definitiva de Alice: 5 dados');
    dice = 5;
  }
  return dice;
}

/** «Eterna desesperación»: por cada 1 que muestre un dado, pierdes 1 de Tiempo. */
export function creechAfterRoll(s: GameState, faces: number[]): void {
  if (!has(s, 'dp-eternal-despair')) return;
  const ones = faces.filter((f) => f === 1).length;
  if (!ones) return;
  log(s, `Eterna desesperación: ${ones} ${ones === 1 ? 'uno' : 'unos'}, pierdes ${ones} de Tiempo.`, 'bad');
  changeTime(s, -ones);
}

/** Antes de jugar Buscar con «Confusión psíquica»: ¿pagas 3 de Tiempo para ignorar la penalización? */
export function creechBeforeAction(s: GameState, cardId: CardId): void {
  if (cardId === 'buscar' && has(s, 'mdp-psychic-confusion') && s.fg.time >= 3) {
    push(s, choice('Confusión psíquica: ¿gastas 3 de Tiempo para tirar el dado extra en Buscar?', [
      { id: 'yes', label: 'Sí (−3 Tiempo)' },
      { id: 'no', label: 'No' },
    ], { kind: 'custom', id: 'cm-psychic' }));
  }
}
registerChoice('cm-psychic', (s, option) => {
  if (option !== 'yes') return;
  changeTime(s, -3);
  cs(s).psychicPaid = true;
});

/** Habilidad Definitiva de Alice: elige el tipo de carta con el que tirará siempre 5 dados. */
export function creechAliceUltimate(s: GameState): void {
  const ids = [...new Set(ACTION_CARDS.map((c) => c.id))].filter((id) => actionDef(id).results);
  push(s, choice('Habilidad Definitiva de Alice: ¿con qué tipo de carta tiras siempre 5 dados?', ids.map((id) => ({ id, label: actionDef(id).name })), { kind: 'custom', id: 'cm-alice' }));
}
registerChoice('cm-alice', (s, option) => {
  cs(s).fiveDice = option;
  log(s, `Alice tirará siempre exactamente 5 dados con ${actionDef(option).name}.`, 'good');
});

// ---------------------------------------------------------------- Chica Final: golpes fuera de la fase de Acción

export const strikeVictims = (s: GameState) => s.creech?.strike === 'victims';
export const strikeActive = (s: GameState) => !!s.creech?.strike;

// ---------------------------------------------------------------- planificación y fases

/** Coste de compra de una carta de Acción en la Planificación («Nada es fácil»: las de coste 0 valen 1). */
export function planCost(s: GameState, cardId: CardId): number {
  const c = actionDef(cardId).cost;
  return c === 0 && has(s, 'finale-nothing-easy') ? 1 : c;
}

export function creechTurnStart(s: GameState): void {
  const c = s.creech;
  if (!c) return;
  c.panicNow = c.panicNext;
  c.lockNow = c.lockNext;
  if (c.panicNow) log(s, 'Todos tus movimientos de esta fase de Acción tienen pánico.', 'bad');
  if (c.lockNow === 'inside') log(s, 'Las puertas y ventanas están cerradas: no puedes moverte esta fase de Acción.', 'bad');
  if (c.lockNow === 'outside') log(s, 'Las puertas y ventanas están cerradas: no puedes entrar en la casa esta fase de Acción.', 'bad');
  c.panicNext = false;
  c.lockNext = null;
}

/** Al revelarse «Pronto estará perdida»: añade 3 cartas de Terror al mazo. */
export function creechFinaleRevealed(s: GameState, custom: string | undefined): void {
  if (custom !== 'finale-lost') return;
  const all = [...killerDef(s).horror, ...locationDef(s).horror].flatMap((h) => Array<string>(h.copies).fill(h.id));
  const used = [...s.horrorDeck, ...s.horrorDiscard, ...s.killer.minors.map((m) => m.id), ...s.activeHorror];
  const pool = [...all];
  for (const u of used) {
    const i = pool.indexOf(u);
    if (i >= 0) pool.splice(i, 1);
  }
  const extra = shuffle(s.rng, pool).slice(0, 3);
  s.horrorDeck = shuffle(s.rng, [...s.horrorDeck, ...extra]);
  s.infoSeq++;
  log(s, `Se añaden ${extra.length} cartas de Terror al mazo (quedan ${s.horrorDeck.length}).`, 'killer');
}

registerEffect('pg-lost-draw', (s) => {
  if (!s.horrorDeck.length) {
    s.outcome = { winner: 'killer', text: 'No quedan cartas de Terror: Carolyn está perdida para siempre.' };
    log(s, s.outcome.text, 'phase');
    s.stack = [];
    s.prompt = null;
    return;
  }
  drawHorror(s);
});

// ---------------------------------------------------------------- cartas de Horror

/** Salta una carta de Horror según tenga o no a Carolyn contigo. */
export function creechSkipsHorror(s: GameState, skipIf: 'carolyn' | 'noCarolyn' | undefined): boolean {
  if (!skipIf) return false;
  return skipIf === 'carolyn' ? hasCarolyn(s) : !hasCarolyn(s);
}

/** Crucifijo: ignorar una carta de Terror. Devuelve true si se ha pedido una decisión. */
export function creechHorrorGate(s: GameState, cardId: CardId): boolean {
  const cross = itemsWith(s, 'item-crucifix')[0];
  if (!cross) return false;
  push(s, choice(`Ha salido «${horrorDef(s, cardId).name}». ¿Descartas el Crucifijo para ignorar la carta?`, [
    { id: 'yes', label: 'Sí: se ignora la carta de Terror' },
    { id: 'no', label: 'No: resolverla' },
  ], { kind: 'custom', id: 'cm-crucifix', data: { cardId, uid: cross.uid } }));
  return true;
}
registerChoice('cm-crucifix', (s, option, data) => {
  const cardId = data.cardId as string;
  if (option === 'yes') {
    discardItem(s, data.uid as string);
    s.horrorDiscard.push(cardId);
    return log(s, 'El Crucifijo anula la carta de Terror.', 'good');
  }
  push(s, { t: 'horror', cardId, asked: true });
});

/** Salta el resto de efectos de la carta que se está resolviendo. */
function skipRest(s: GameState): void {
  const t = s.stack[s.stack.length - 1];
  if (t?.t === 'effects') t.i = t.effects.length;
}

const normalFirst = (vs: Victim[]) => [...vs].sort((a, b) => (a.role ? 1 : 0) - (b.role ? 1 : 0));
const realVictims = (s: GameState) => s.victims.filter((v) => v.role !== 'lobo');

// -- Poltergeist ------------------------------------------------------

registerEffect('pg-place-fg', (s) => teleportKiller(s, s.fg.zone));

registerEffect('pg-place-victim', (s) => {
  const dist = distances(s, s.killer.zone, 'enemy');
  const pool = realVictims(s);
  if (!pool.length) return teleportKiller(s, s.fg.zone);
  const best = Math.min(...pool.map((v) => dist.get(v.zone) ?? 99));
  const zones = [...new Set(pool.filter((v) => (dist.get(v.zone) ?? 99) === best).map((v) => v.zone))];
  if (zones.length > 1) return push(s, choice('Empate: ¿con qué Víctima aparece el Poltergeist?', zones.map((z) => ({ id: z, label: zoneName(s, z) })), { kind: 'custom', id: 'teleport-killer' }));
  teleportKiller(s, zones[0]!);
});

registerEffect('pg-mark', (s) => {
  s.mods.damageMark = s.mods.damageTaken;
});
registerEffect('pg-panic-if-hurt', (s) => {
  if (s.mods.damageTaken <= s.mods.damageMark) return;
  cs(s).panicNext = true;
  log(s, 'Has recibido daño: todos tus movimientos de la próxima fase de Acción tendrán pánico.', 'bad');
});

registerEffect('pg-bloodlust-max', (s) => {
  log(s, 'La Sed de Sangre del Poltergeist está al máximo: recibes 1 de daño.', 'killer');
  push(s, { t: 'attackFG', damage: 1, reduce: 0, ignore: false, by: 'killer' });
});

/** «¿Carolyn, dónde estás?»: Carolyn vuelve a esconderse (Mr. Floppy puede impedirlo). */
registerEffect('pg-carolyn', (s) => {
  if (!hasCarolyn(s)) return;
  if (hasFloppy(s) && darkPowerRevealed(s) && !epicInPlay(s)) {
    return push(s, choice('«¿Carolyn, dónde estás?»: ¿retiras a Mr. Floppy del juego para ignorar la carta?', [
      { id: 'yes', label: 'Sí: retirar a Mr. Floppy' },
      { id: 'no', label: 'No: Carolyn desaparece' },
    ], { kind: 'custom', id: 'cm-floppy' }));
  }
  hideCarolyn(s);
});
registerChoice('cm-floppy', (s, option) => {
  if (option === 'yes') {
    s.fg.items = s.fg.items.filter((i) => i.id !== 'mr-floppy');
    return log(s, 'Mr. Floppy se retira del juego: Carolyn sigue contigo.', 'good');
  }
  hideCarolyn(s);
});
function hideCarolyn(s: GameState): void {
  s.fg.items = s.fg.items.filter((i) => i.id !== 'carolyn');
  log(s, 'Carolyn desaparece de tu lado y vuelve a esconderse.', 'killer');
  shuffleIntoNearest(s, 'carolyn');
}

/** Maldad imparable: daño igual a la tirada o morir ese número de Víctimas. */
registerEffect('pg-evil', (s) => {
  const n = rollDie(s.rng);
  log(s, `Maldad imparable: dado ${n}.`, 'killer', { kind: 'dice', faces: [n] });
  const canKill = realVictims(s).length >= n;
  if (!canKill) {
    log(s, 'No hay Víctimas suficientes: debes recibir el daño.', 'bad');
    return void push(s, { t: 'attackFG', damage: n, reduce: 0, ignore: false, by: 'killer' });
  }
  push(s, choice(`Maldad imparable (${n}): ¿qué eliges?`, [
    { id: 'dmg', label: `Recibir ${n} de daño (te puedes defender)` },
    { id: 'kill', label: `Mueren ${n} ${n === 1 ? 'Víctima' : 'Víctimas'} (tú eliges cuáles)` },
  ], { kind: 'custom', id: 'pg-evil-choice', data: { n } }));
});
registerChoice('pg-evil-choice', (s, option, data) => {
  const n = data.n as number;
  if (option === 'dmg') return void push(s, { t: 'attackFG', damage: n, reduce: 0, ignore: false, by: 'killer' });
  pushEffects(s, Array.from({ length: n }, () => eff('cn-kill-pick')), SRC_HORROR);
});

/** La tormenta: cae un rayo en tu espacio y en los adyacentes. */
registerEffect('pg-storm', (s) => {
  const zones = [s.fg.zone, ...adjacent(s, s.fg.zone)];
  log(s, 'El rayo cae en tu espacio y en los adyacentes.', 'killer');
  for (const z of zones) {
    const v = normalFirst(victimsIn(s, z).filter((x) => x.role !== 'lobo'))[0];
    if (v) killVictim(s, v, true);
  }
  const n = killerRow(s).attack;
  log(s, `Pierdes ${n} de Vida por el rayo.`, 'bad');
  damageFG(s, n);
});

/** Nada es lo que parece: baraja los mazos de Objetos y revela la carta superior de cada uno. */
registerEffect('pg-nothing', (s) => {
  let found = false;
  for (const zone of locationDef(s).itemDecks) {
    const deck = s.itemDecks[zone] ?? [];
    if (!deck.length) continue;
    const ids = shuffle(s.rng, deck.map((c) => c.id));
    s.itemDecks[zone] = ids.map((id, i) => ({ id, faceUp: i === 0 }));
    s.infoSeq++;
    const top = ids[0]!;
    log(s, `Se baraja el mazo de ${zoneName(s, zone)} y se revela ${itemDef(s, top).name}.`, 'killer', undefined, { kind: 'item', id: top });
    if (top === 'carolyn' || top === 'mr-floppy') found = true;
  }
  if (found) {
    log(s, 'Se ha revelado a Carolyn o a Mr. Floppy: +2 Sed de Sangre.', 'killer');
    increaseBloodlust(s, 2);
  }
});

// «¡Tengo que matarte!»
registerEffect('pg-kill-1', (s) => {
  const here = s.fg.zone;
  for (const z of adjacent(s, here)) {
    if (!neighbors(s, z, 'victim').includes(here)) continue;
    for (const v of victimsIn(s, z).filter((x) => x.role !== 'lobo')) moveVictim(s, v, here);
  }
  log(s, 'Todas las Víctimas de espacios adyacentes se mueven a tu espacio.', 'killer');
});
registerEffect('pg-kill-2', (s) => {
  if (!victimsIn(s, s.fg.zone).some((v) => v.role !== 'lobo')) return;
  cs(s).strike = 'victims';
  push(s, { t: 'strike', mode: 'victims', left: 1 });
});
registerEffect('pg-kill-3', (s) => {
  const n = victimsIn(s, s.fg.zone).filter((v) => v.role !== 'lobo').length;
  if (!n) return;
  log(s, `Quedan ${n} ${n === 1 ? 'Víctima' : 'Víctimas'} en tu espacio: recibes ${n} de daño.`, 'killer');
  push(s, { t: 'attackFG', damage: n, reduce: 0, ignore: false, by: 'killer' });
});
registerEffect('pg-kill-4', (s) => {
  const vs = victimsIn(s, s.fg.zone).filter((v) => v.role !== 'lobo');
  if (!vs.length) return;
  log(s, 'Las Víctimas de tu espacio entran en pánico.', 'killer');
  panicVictims(s, vs);
});

// Gigante y Muñeco Payaso: Enemigos temporales que aparecen en tu espacio.
const ENEMIES = { giant: { name: 'el Gigante', hp: 2, bonus: 1 }, clown: { name: 'el Muñeco Payaso', hp: 1, bonus: 0 } } as const;
registerEffect('pg-enemy', (s, kind) => {
  const def = ENEMIES[kind as keyof typeof ENEMIES];
  s.minions.push({ id: `tmp-${kind}`, zone: s.fg.zone, hp: def.hp });
  log(s, `¡Aparece ${def.name} en tu espacio (${def.hp} ${def.hp === 1 ? 'Vida' : 'Vidas'})!`, 'killer', { kind: 'killerMove', path: [s.fg.zone] });
  pushEffects(s, [eff('pg-mark'), eff(`pg-enemy-strike:${kind}`), eff(`pg-enemy-hit:${kind}`), eff(`pg-enemy-end:${kind}`)], SRC_HORROR);
});
registerEffect('pg-enemy-strike', (s) => {
  cs(s).strike = 'enemy';
  push(s, { t: 'strike', mode: 'enemy', left: 99 });
});
registerEffect('pg-enemy-hit', (s, kind) => {
  const m = s.minions.find((x) => x.id === `tmp-${kind}`);
  if (!m) return;
  const def = ENEMIES[kind as keyof typeof ENEMIES];
  const dmg = killerRow(s).attack + def.bonus;
  log(s, `${capitalize(def.name)} te ataca: ${dmg} de daño.`, 'killer');
  push(s, { t: 'attackFG', damage: dmg, reduce: 0, ignore: false, by: `m:${m.id}` });
});
registerEffect('pg-enemy-end', (s, kind) => {
  const def = ENEMIES[kind as keyof typeof ENEMIES];
  const m = s.minions.find((x) => x.id === `tmp-${kind}`);
  s.minions = s.minions.filter((x) => x.id !== `tmp-${kind}`);
  if (!m) return;
  log(s, `${capitalize(def.name)} desaparece.`, 'killer');
  if (s.mods.damageTaken <= s.mods.damageMark) return;
  if (kind === 'clown') {
    log(s, 'El Muñeco Payaso te ha herido: +1 Sed de Sangre.', 'killer');
    return increaseBloodlust(s, 1);
  }
  const items = discardable(s);
  if (!items.length) return;
  push(s, choice('El Gigante te ha herido: elige un Objeto que descartar', items.map((i) => ({ id: i.uid, label: itemDef(s, i.id).name })), { kind: 'custom', id: 'cm-discard-item' }));
});
registerChoice('cm-discard-item', (s, option) => discardItem(s, option));

// -- Cartas de Horror del Lugar ---------------------------------------

registerEffect('cm-fake', (s) => {
  const items = discardable(s);
  if (!items.length) {
    log(s, 'No tienes Objetos: se descarta la carta y se roba la siguiente.');
    skipRest(s);
    return drawHorror(s);
  }
  const it = pick(s.rng, items);
  log(s, `Descartas al azar ${itemDef(s, it.id).name}.`, 'bad');
  discardItem(s, it.uid);
});

registerEffect('cm-wall', (s) => {
  if (!s.victims.length) return;
  log(s, 'Todas las Víctimas entran en pánico. Las que salten por una ventana mueren.', 'killer');
  panicVictims(s, [...s.victims], 1, { jumpDeath: true });
});

registerEffect('cm-doors', (s) => {
  const inside = !zoneDef(s, s.fg.zone).outside;
  cs(s).lockNext = inside ? 'inside' : 'outside';
  log(s, inside ? 'Las puertas y ventanas se cierran: no podrás moverte la próxima fase de Acción.' : 'Las puertas y ventanas se cierran: no podrás entrar en la casa la próxima fase de Acción.', 'killer');
});

registerEffect('cm-broken-ladder', (s) => {
  const ladder = locationDef(s).ladder;
  if (!ladder) return;
  s.tokens = s.tokens.filter((t) => t.id !== 'escalera-rota');
  s.tokens.push({ id: 'escalera-rota', zone: ladder[0] });
  log(s, 'La Escalera se rompe: ya no se puede usar y sus espacios dejan de ser adyacentes.', 'killer');
});

registerEffect('cm-unholy', (s) => {
  const face = rollDie(s.rng);
  const zone: ZoneId = face <= 2 ? 'atico' : face <= 4 ? 'vestidor' : 'salon-baile';
  log(s, `Dado ${face}: el Asesino aparece en ${zoneName(s, zone)}.`, 'killer', { kind: 'dice', faces: [face] });
  teleportKiller(s, zone);
});

/** «¡Voces… oigo voces!»: cada Víctima sube al piso siguiente. */
registerEffect('cm-voices', (s) => {
  const groups = new Map<ZoneId, Victim[]>();
  for (const v of s.victims) groups.set(v.zone, [...(groups.get(v.zone) ?? []), v]);
  log(s, 'Todas las Víctimas suben al siguiente piso.', 'killer');
  for (const [from, vs] of groups) {
    const floor = zoneDef(s, from).floor ?? 0;
    const up = neighbors(s, from, 'victim').filter((z) => (zoneDef(s, z).floor ?? 0) > floor && !zoneDef(s, z).hidden);
    if (!up.length) continue;
    const lowest = Math.min(...up.map((z) => zoneDef(s, z).floor ?? 0));
    const next = up.filter((z) => (zoneDef(s, z).floor ?? 0) === lowest);
    if (next.length > 1) {
      push(s, choice(`Empate: ¿a dónde suben las Víctimas de ${zoneName(s, from)}?`, next.map((z) => ({ id: z, label: zoneName(s, z) })), { kind: 'custom', id: 'victims-step', data: { from } }));
      continue;
    }
    for (const v of vs) moveVictim(s, v, next[0]!);
  }
});

registerEffect('cm-trees', (s) => {
  if (zoneDef(s, s.fg.zone).window) {
    log(s, 'Los árboles te arañan en la ventana: pierdes 1 Vida.', 'bad');
    damageFG(s, 1);
  }
  let died = 0;
  for (const v of s.victims.filter((x) => zoneDef(s, x.zone).window)) {
    killVictim(s, v, false);
    died++;
  }
  if (died && !s.outcome) {
    log(s, 'Ha muerto al menos una Víctima en una ventana: +1 Terror.', 'bad');
    changeTerror(s, 1);
  }
});

// ---------------------------------------------------------------- Eventos

export function creechEventRevealed(s: GameState, custom: string): void {
  switch (custom) {
    case 'ev-helicopter':
      cs(s).heliUsed = false;
      s.tokens = s.tokens.filter((t) => t.id !== 'helicoptero');
      s.tokens.push({ id: 'helicoptero', zone: 'helicoptero' });
      log(s, 'El Helicóptero aparece sobre el tejado, adyacente al Ático.', 'phase');
      break;
    case 'ev-nobody-returns': {
      s.tokens = s.tokens.filter((t) => t.id !== 'calavera');
      s.tokens.push({ id: 'calavera', zone: 'atico' });
      for (const v of s.victims.filter((x) => x.zone === 'atico')) {
        log(s, 'Nadie vuelve: una Víctima del Ático muere.', 'killer');
        killVictim(s, v, false);
      }
      break;
    }
    case 'ev-ghost-hunters':
      pickHunters(s, 3, 0);
      break;
  }
}

const HUNTER_COLORS = ['white', 'blue', 'orange'] as const;

function pickHunters(s: GameState, remaining: number, idx: number): void {
  if (remaining <= 0) return;
  const pool = s.victims.filter((v) => !v.role);
  if (!pool.length) return;
  const dist = distances(s, s.fg.zone, 'fg');
  const best = Math.min(...pool.map((v) => dist.get(v.zone) ?? 99));
  const zones = [...new Set(pool.filter((v) => (dist.get(v.zone) ?? 99) === best).map((v) => v.zone))];
  if (zones.length > 1) {
    return void push(s, choice('Empate: ¿qué Víctima pasa a ser Especial?', zones.map((z) => ({ id: z, label: zoneName(s, z) })), { kind: 'custom', id: 'cm-hunter', data: { remaining, idx } }));
  }
  assignHunter(s, zones[0]!, idx);
  pickHunters(s, remaining - 1, idx + 1);
}
function assignHunter(s: GameState, zone: ZoneId, idx: number): void {
  const v = s.victims.find((x) => x.zone === zone && !x.role);
  if (!v) return;
  v.role = 'cazador';
  v.special = HUNTER_COLORS[idx % HUNTER_COLORS.length]!;
  log(s, `Una Víctima de ${zoneName(s, zone)} pasa a ser una Víctima Especial.`);
}
registerChoice('cm-hunter', (s, option, data) => {
  assignHunter(s, option, data.idx as number);
  pickHunters(s, (data.remaining as number) - 1, (data.idx as number) + 1);
});

registerEffect('cm-toward-attic', (s) => {
  log(s, 'Cada Víctima se mueve un espacio hacia el Ático.', 'phase');
  victimsStepToward(s, ['atico']);
});

registerEffect('cm-pushed', (s) => {
  for (const v of s.victims.filter((x) => zoneDef(s, x.zone).window)) {
    const face = rollDie(s.rng);
    const bad = face <= 4;
    log(s, `Empujados hasta el borde: dado ${face}. ${bad ? 'La Víctima salta y muere.' : 'La Víctima se salva.'}`, bad ? 'killer' : 'good', { kind: 'dice', faces: [face] });
    if (bad) killVictim(s, v, false);
  }
});

registerEffect('cm-panic-vestibule', (s) => {
  const fresh = s.victims.filter((v) => v.zone === 'vestibulo').slice(-3);
  if (!fresh.length) return;
  log(s, 'Las nuevas Víctimas entran en pánico.', 'killer');
  panicVictims(s, fresh);
});

// Nadie vuelve: toda Víctima que entre en el Ático muere.
registerVictimEnters((s, v, zone) => {
  if (zone === 'atico' && has(s, 'ev-nobody-returns')) {
    log(s, `${capitalize(victimLabel(v))} entra en el Ático y muere.`, 'killer');
    killVictim(s, v, false);
  }
});

// Cazadores de fantasmas: cada Víctima Especial que muere suma +1 Sed de Sangre y libera a las demás.
registerVictimKilled((s, v) => {
  if (v.role !== 'cazador') return;
  cs(s).hunterDied = true;
  log(s, 'Ha muerto una Víctima Especial: +1 Sed de Sangre.', 'killer');
  increaseBloodlust(s, 1);
});

// ---------------------------------------------------------------- Candado

const padlockCancels = (s: GameState): boolean => {
  const l = s.creech?.lock;
  return !!l && (s.fg.zone === l[0] || s.fg.zone === l[1]);
};

/** El Candado anula un ataque contra ti en una habitación adyacente a él y se quita. */
export function creechCancelAttack(s: GameState): boolean {
  if (!padlockCancels(s)) return false;
  log(s, 'El Candado detiene el ataque: se ignora y se quita la ficha.', 'good');
  s.creech!.lock = null;
  s.tokens = s.tokens.filter((t) => t.id !== 'candado');
  return true;
}

// ---------------------------------------------------------------- objetos con acciones

interface ItemAct {
  uid: string;
  action: string;
  label: string;
}

/** Acciones de Objeto propias de Creech Manor. */
export function creechItemActions(s: GameState, it: ItemInst, custom: string | undefined, time: number): ItemAct[] {
  const out: ItemAct[] = [];
  const add = (action: string, label: string) => out.push({ uid: it.uid, action, label });
  const once = (key: string) => s.mods.usedThisPhase.includes(key);
  switch (custom) {
    case 'item-padlock':
      if (adjacent(s, s.fg.zone).length) add('place', 'Colocar el Candado');
      break;
    case 'item-ritual-dagger':
      if (victimsIn(s, s.fg.zone).some((v) => v.role !== 'lobo')) add('sacrifice', 'Daga ritual: sacrificar a una Víctima de tu zona');
      break;
    case 'item-ancient-text':
      if (!once(it.uid) && s.fg.health.hp > 1) add('use', 'Texto antigüo (pierdes 1 Vida, +2 Tiempo)');
      break;
    case 'item-candle':
      if (!once(it.uid) && candleZones(s).length) add('use', 'Vela: traer una Víctima de un espacio adyacente');
      break;
    case 'item-rifle':
    case 'item-alice-rifle': {
      const need = custom === 'item-rifle' ? 2 : 1;
      if (!s.mods.usedThisTurn.includes(it.uid) && s.fg.hand.length >= need && enemyZones(s).includes(s.fg.zone)) add('shoot', `Disparar (descartas ${need} ${need === 1 ? 'carta' : 'cartas'})`);
      break;
    }
    case 'item-rope-ladder':
      if (s.tokens.some((t) => t.id === 'escalera-rota')) add('fix', 'Escalera de cuerda: quitar la Escalera Rota');
      if (ropeSpots(s).length) add('place', 'Escalera de cuerda: poner la ficha en un espacio con flecha');
      break;
    case 'item-selena-flashlight':
      if (!once(it.uid) && s.horrorDeck.length) add('look', 'Linterna de Selena: mirar la carta superior del Terror');
      if (zoneDef(s, s.fg.zone).search && (s.itemDecks[s.fg.zone]?.length ?? 0) > 0) add('take', 'Linterna de Selena: descartar para coger la carta superior de Objeto');
      break;
  }
  void time;
  return out;
}

const candleZones = (s: GameState): ZoneId[] =>
  adjacent(s, s.fg.zone).filter((z) => victimsIn(s, z).some((v) => v.role !== 'lobo') && neighbors(s, z, 'victim').includes(s.fg.zone));
const ropeSpots = (s: GameState): ZoneId[] => [...new Set((locationDef(s).oneWay ?? []).map((o) => o.at))].filter((z) => !s.tokens.some((t) => t.id === 'escalera-de-cuerda' && t.zone === z));

/** Usa un Objeto de Creech Manor. Devuelve true si lo ha gestionado. */
export function creechUseItem(s: GameState, uid: string, custom: string | undefined, action: string): boolean {
  switch (custom) {
    case 'item-padlock': {
      const zones = adjacent(s, s.fg.zone);
      push(s, choice('Candado: ¿qué unión de tu espacio cierras?', zones.map((z) => ({ id: z, label: `${zoneName(s, s.fg.zone)} ↔ ${zoneName(s, z)}` })), { kind: 'custom', id: 'cm-padlock', data: { uid } }));
      return true;
    }
    case 'item-ritual-dagger': {
      discardItem(s, uid);
      pushEffects(s, [eff(`cn-kill-pick:${s.fg.zone}`), eff('cm-dagger-after')], { kind: 'item', id: 'daga-ritual' });
      return true;
    }
    case 'item-ancient-text':
      s.mods.usedThisPhase.push(uid);
      log(s, 'Texto antigüo: pierdes 1 Vida y ganas 2 de Tiempo.', 'info');
      damageFG(s, 1);
      if (!s.outcome) changeTime(s, 2);
      return true;
    case 'item-candle': {
      const zones = candleZones(s);
      s.mods.usedThisPhase.push(uid);
      if (zones.length === 1) return candleMove(s, zones[0]!), true;
      push(s, choice('Vela: ¿de qué espacio traes una Víctima?', zones.map((z) => ({ id: z, label: zoneName(s, z) })), { kind: 'custom', id: 'cm-candle' }));
      return true;
    }
    case 'item-rifle':
    case 'item-alice-rifle': {
      s.mods.usedThisTurn.push(uid);
      rifleDiscard(s, custom === 'item-rifle' ? 2 : 1, uid);
      return true;
    }
    case 'item-rope-ladder': {
      if (action === 'fix') {
        s.tokens = s.tokens.filter((t) => t.id !== 'escalera-rota');
        discardItem(s, uid);
        log(s, 'Arreglas la Escalera con la Escalera de cuerda: vuelve a poder usarse.', 'good');
        return true;
      }
      const spots = ropeSpots(s);
      push(s, choice('Escalera de cuerda: ¿en qué espacio con flecha pones la ficha?', spots.map((z) => ({ id: z, label: zoneName(s, z) })), { kind: 'custom', id: 'cm-rope', data: { uid } }));
      return true;
    }
    case 'item-selena-flashlight': {
      if (action === 'take') {
        const deck = s.itemDecks[s.fg.zone];
        const card = deck?.shift();
        discardItem(s, uid);
        if (!card) return true;
        s.infoSeq++;
        if (deck?.[0]) deck[0].faceUp = true;
        pushEffects(s, [eff(`cn-gain:${card.id}`)], { kind: 'item', id: 'linterna-de-selena' });
        return true;
      }
      s.mods.usedThisPhase.push(uid);
      const top = s.horrorDeck[0]!;
      s.infoSeq++;
      push(s, choice(`Linterna de Selena: la carta superior del Terror es «${horrorDef(s, top).name}»`, [
        { id: 'keep', label: 'Dejarla encima' },
        { id: 'bottom', label: 'Ponerla en el fondo del mazo' },
      ], { kind: 'custom', id: 'flashlight' }));
      return true;
    }
  }
  return false;
}

registerEffect('cm-dagger-after', (s) => {
  if (s.killer.minors.length) {
    s.killer.minors = [];
    log(s, 'La Daga ritual retira todos los Poderes Oscuros Menores del juego.', 'good');
  } else {
    damageKiller(s, 1);
  }
});

registerChoice('cm-padlock', (s, option, data) => {
  s.tokens = s.tokens.filter((t) => t.id !== 'candado');
  s.tokens.push({ id: 'candado', zone: s.fg.zone });
  cs(s).lock = [s.fg.zone, option];
  log(s, `Colocas el Candado entre ${zoneName(s, s.fg.zone)} y ${zoneName(s, option)}.`, 'good');
  discardItem(s, data.uid as string);
});

function candleMove(s: GameState, zone: ZoneId): void {
  const v = victimsIn(s, zone).filter((x) => x.role !== 'lobo')[0];
  if (!v) return;
  log(s, `La Vela guía a una Víctima de ${zoneName(s, zone)} hasta tu espacio.`, 'good');
  moveVictim(s, v, s.fg.zone);
}
registerChoice('cm-candle', (s, option) => candleMove(s, option));

registerChoice('cm-rope', (s, option, data) => {
  s.tokens.push({ id: 'escalera-de-cuerda', zone: option });
  log(s, `Pones la Escalera de cuerda en ${zoneName(s, option)}: su movimiento es ahora de doble sentido.`, 'good');
  discardItem(s, data.uid as string);
});

/** Rifle: descarta cartas de tu mano una a una y luego tira 6 dados. */
function rifleDiscard(s: GameState, left: number, uid: string): void {
  if (left <= 0) return rifleShoot(s, uid);
  const cards = [...new Set(s.fg.hand)];
  push(s, choice(`Rifle: descarta una carta de Acción (${left} por descartar)`, cards.map((c) => ({ id: c, label: actionDef(c).name })), { kind: 'custom', id: 'cm-rifle-discard', data: { left, uid } }));
}
registerChoice('cm-rifle-discard', (s, option, data) => {
  const i = s.fg.hand.indexOf(option);
  if (i >= 0) {
    s.fg.hand.splice(i, 1);
    s.actionDiscard.push(option);
  }
  rifleDiscard(s, (data.left as number) - 1, data.uid as string);
});

function rifleShoot(s: GameState, uid: string): void {
  const faces = Array.from({ length: 6 }, () => rollDie(s.rng));
  const stars = faces.filter((f) => f >= 5).length;
  const blanks = faces.filter((f) => f <= 2).length;
  log(s, `Disparo (6 dados): ${faces.join(' ')} → ${stars} ${stars === 1 ? 'éxito' : 'éxitos'}, ${blanks} en blanco.`, 'info', { kind: 'dice', faces });
  if (stars) {
    const zone = s.fg.zone;
    if (s.killer.zone === zone && !killerDef(s).invulnerable) damageKiller(s, stars);
    if (!s.outcome) damageMinionsAt(s, zone, stars);
  }
  if (blanks * 2 >= 6) {
    log(s, 'La mitad o más de los dados están en blanco: pierdes el Rifle.', 'bad');
    discardItem(s, uid);
  }
}

