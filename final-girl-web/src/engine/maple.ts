/**
 * Reglas propias de Frightmare on Maple Lane (Dr. Fright / Maple Lane / Nancy / Sheila):
 * Despierta y Dormida, la Sala de Calderas (cartas que se deslizan), Casas ocupadas y «Convencer»,
 * cuadrantes con su mazo de Objetos, Eventos, cartas de Horror y Objetos únicos.
 * El resto del motor llama a estas funciones o las registra por id.
 */
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
  killerShielded,
  killVictim,
  log,
  moveVictim,
  panicVictims,
  placeVictims,
  push,
  pushEffects,
  registerDarkPowerReveal,
  registerFgDamaged,
  registerKillerDeath,
  registerTerrorGate,
  registerVictimEnters,
  registerVictimKilled,
  victimLabel,
  victimLeaves,
} from './core';
import { dealDamage, discardItem, drawHorror, gainItem, spendUse, teleportKiller } from './effects';
import { newRoll } from './player';
import { actionDef, deckOf, distances, fgDef, itemDef, locationDef, neighbors, shortestPaths, victimsIn, zoneDef, zoneName } from './lookup';
import { choice, registerChoice, registerEffect, registerEffectRoll } from './registry';
import { rollDie, shuffle } from './rng';
import type { EffectSource, GameState, MapleState, Victim } from './state';

const SRC_HORROR: EffectSource = { kind: 'horror' };
const eff = (id: string): Effect => ({ kind: 'custom', id });

export const BR_CARDS = ['br-1', 'br-2', 'br-3', 'br-4'] as const;
/** Cuadrante de cada carta de la Sala de Calderas donde aparece el Dr. Fright (qx, qy: 0 = izquierda / arriba). */
export const BR_FRIGHT: Record<string, { qx: number; qy: number }> = {
  'br-1': { qx: 1, qy: 0 },
  'br-2': { qx: 0, qy: 0 },
  'br-3': { qx: 1, qy: 1 },
  'br-4': { qx: 0, qy: 1 },
};
type Dir = 'up' | 'down' | 'left' | 'right';
const SHIFT: Record<Dir, [number, number]> = { up: [0, 1], down: [0, -1], left: [1, 0], right: [-1, 0] };
const DIR_NAME: Record<Dir, string> = { up: 'arriba', down: 'abajo', left: 'a la izquierda', right: 'a la derecha' };

// ---------------------------------------------------------------- estado

export const isFright = (s: GameState) => s.killer.id === 'dr-fright';

export function mapleInit(reserve: number[] = []): MapleState {
  return {
    asleep: false,
    br: { deck: [...BR_CARDS], placed: [{ id: 'dd', x: 0, y: 0 }] },
    blurred: false,
    marked: false,
    lockNext: false,
    lockNow: false,
    dimNext: false,
    dimNow: false,
    extraBR: 0,
    mark: 0,
    attackedFG: false,
    surprise: 0,
    reserve,
    revived: false,
    offBoard: false,
    policeTo: null,
  };
}

export const mp = (s: GameState): MapleState => (s.maple ??= mapleInit());

/** Preparación: estado de Maple Lane y orden de las cartas de la Sala de Calderas. */
export function mapleSetup(s: GameState, reserve: number[]): void {
  s.maple = mapleInit(reserve);
  resetBR(s, false);
}

function resetBR(s: GameState, announce = true): void {
  const m = mp(s);
  m.br = { deck: shuffle(s.rng, [...BR_CARDS]), placed: [{ id: 'dd', x: 0, y: 0 }] };
  if (announce) log(s, 'Se reinicia el mazo de la Sala de Calderas.', 'killer');
}

export const mapleAsleep = (s: GameState) => isFright(s) && mp(s).asleep;

/** ¿Puede el Dr. Fright dañarte ahora? Dormida, con Realidad borrosa o con La Frightsadilla es inevitable. */
export const mapleCanHitFG = (s: GameState) => !isFright(s) || mp(s).asleep || mp(s).blurred || has(s, 'dp-ml-frightsadilla');

// ---------------------------------------------------------------- Despierta / Dormida

const forcedSleep = (s: GameState) => has(s, 'mdp-ml-endless') || has(s, 'finale-ml-fear');

function fallAsleep(s: GameState): void {
  if (!isFright(s)) return;
  const m = mp(s);
  if (m.asleep) return;
  m.asleep = true;
  resetBR(s, false);
  log(s, '¡Caes Dormida! Entras en la Sala de Calderas: el Dr. Fright puede atacarte y tú a él; las Víctimas no te siguen ni se pueden salvar.', 'killer');
}

function wakeUp(s: GameState): void {
  const m = mp(s);
  resetBR(s, false);
  if (forcedSleep(s)) {
    log(s, 'Sales de la Sala de Calderas, pero sigues Dormida: el mazo se reinicia.', 'killer');
    return;
  }
  m.asleep = false;
  log(s, '¡Despiertas! Has revelado las cuatro cartas de la Sala de Calderas.', 'good');
}

registerEffect('df-sleep', (s) => fallAsleep(s));
registerEffect('df-reset-br', (s) => resetBR(s));

registerEffect('df-bloodlust-max', (s) => (mp(s).asleep ? resetBR(s) : fallAsleep(s)));

// ---------------------------------------------------------------- Sala de Calderas

type Placed = { id: string; x: number; y: number };

/** Cuadrantes de una carta colocada que siguen visibles (no cubiertos por las cartas anteriores). */
export function brVisible(placed: Placed[], index: number): { qx: number; qy: number }[] {
  const card = placed[index]!;
  const out: { qx: number; qy: number }[] = [];
  for (let qy = 0; qy < 2; qy++) {
    for (let qx = 0; qx < 2; qx++) {
      const cx = card.x + qx;
      const cy = card.y + qy;
      const covered = placed.slice(0, index).some((c) => cx >= c.x && cx < c.x + 2 && cy >= c.y && cy < c.y + 2);
      if (!covered) out.push({ qx, qy });
    }
  }
  return out;
}

function describeVisible(vis: { qx: number; qy: number }[]): string {
  if (vis.length === 4) return 'toda la carta';
  const xs = new Set(vis.map((v) => v.qx));
  const ys = new Set(vis.map((v) => v.qy));
  if (vis.length === 3) return 'tres cuartos de la carta';
  if (vis.length === 2) {
    if (xs.size === 1) return xs.has(0) ? 'la mitad izquierda' : 'la mitad derecha';
    if (ys.size === 1) return ys.has(0) ? 'la mitad superior' : 'la mitad inferior';
    return 'dos cuartos en diagonal';
  }
  if (vis.length === 1) return `el cuadrante ${vis[0]!.qy === 0 ? 'superior' : 'inferior'} ${vis[0]!.qx === 0 ? 'izquierdo' : 'derecho'}`;
  return 'nada';
}

function slideOptions(s: GameState): { dir: Dir; vis: { qx: number; qy: number }[] }[] {
  const m = mp(s);
  const last = m.br.placed[m.br.placed.length - 1]!;
  const out: { dir: Dir; vis: { qx: number; qy: number }[] }[] = [];
  for (const dir of Object.keys(SHIFT) as Dir[]) {
    const [dx, dy] = SHIFT[dir];
    const trial: Placed[] = [...m.br.placed, { id: 'next', x: last.x + dx, y: last.y + dy }];
    const vis = brVisible(trial, trial.length - 1);
    if (vis.length) out.push({ dir, vis });
  }
  return out;
}

/** Resuelve una carta de la Sala de Calderas: eliges cómo deslizar el mazo y, si se ve al Dr. Fright, te ataca. */
registerEffect('df-resolve-br', (s) => {
  const m = mp(s);
  if (!isFright(s) || !m.asleep) return;
  if (!m.br.deck.length) return wakeUp(s);
  const options = slideOptions(s);
  if (!options.length) return revealBR(s, null);
  if (options.length === 1) return revealBR(s, options[0]!.dir);
  push(s, choice('Sala de Calderas: ¿hacia dónde deslizas el mazo?', options.map((o) => ({ id: o.dir, label: `Deslizar ${DIR_NAME[o.dir]} (verás ${describeVisible(o.vis)} de la siguiente carta)` })), { kind: 'custom', id: 'df-slide' }));
});
registerChoice('df-slide', (s, option) => revealBR(s, option as Dir));

function revealBR(s: GameState, dir: Dir | null): void {
  const m = mp(s);
  const id = m.br.deck.shift()!;
  const last = m.br.placed[m.br.placed.length - 1]!;
  const [dx, dy] = dir ? SHIFT[dir] : [0, 0];
  m.br.placed.push({ id, x: last.x + dx, y: last.y + dy });
  s.infoSeq++;
  const vis = brVisible(m.br.placed, m.br.placed.length - 1);
  const f = BR_FRIGHT[id]!;
  const seen = vis.some((v) => v.qx === f.qx && v.qy === f.qy);
  log(s, `Sala de Calderas: deslizas ${dir ? DIR_NAME[dir] : 'el mazo'} y ves ${describeVisible(vis)} de la carta (${m.br.placed.length - 1} de 4).${seen ? ' ¡Ahí está el Dr. Fright!' : ' Nada.'}`, seen ? 'bad' : 'info');
  const rest: Effect[] = [];
  if (seen) rest.push(eff('df-br-attack'));
  if (!m.br.deck.length) rest.push(eff('df-br-wake'));
  pushEffects(s, rest, SRC_HORROR);
}

registerEffect('df-br-attack', (s) => {
  const dmg = killerRow(s).attack;
  log(s, `El Dr. Fright te ataca desde la Sala de Calderas: ${dmg} de daño.`, 'killer');
  mp(s).attackedFG = true;
  push(s, { t: 'attackFG', damage: dmg, reduce: 0, ignore: false, by: 'killer' });
});
registerEffect('df-br-wake', (s) => {
  if (mp(s).asleep) wakeUp(s);
});

/** Al final de la fase del Asesino, Dormida debes resolver una carta de la Sala de Calderas (más las adicionales). */
export function mapleKillerPhaseEnd(s: GameState): void {
  if (!isFright(s)) return;
  const m = mp(s);
  if (!m.asleep) return;
  const n = 1 + (has(s, 'mdp-ml-search') ? 1 : 0) + m.extraBR;
  m.extraBR = 0;
  log(s, `Fin de la fase del Asesino: resuelves ${n === 1 ? 'una carta' : `${n} cartas`} de la Sala de Calderas.`, 'killer');
  pushEffects(s, Array.from({ length: n }, () => eff('df-resolve-br')), SRC_HORROR);
}

/** Inicio de la fase del Asesino: caducan Realidad borrosa y Marcado para la muerte. */
export function mapleKillerPhaseStart(s: GameState): void {
  if (!s.maple) return;
  s.maple.blurred = false;
  s.maple.marked = false;
}

// ---------------------------------------------------------------- Descanso: dormirse por decisión propia

export function mapleAfterCard(s: GameState, cardId: CardId): void {
  if (!isFright(s) || mp(s).asleep || (cardId !== 'descanso-corto' && cardId !== 'descanso-largo')) return;
  push(s, choice(`${actionDef(cardId).name}: ¿te duermes para entrar en la Sala de Calderas?`, [
    { id: 'yes', label: 'Sí: quedas Dormida' },
    { id: 'no', label: 'No' },
  ], { kind: 'custom', id: 'df-rest-sleep' }));
}
registerChoice('df-rest-sleep', (s, option) => {
  if (option === 'yes') fallAsleep(s);
});

// ---------------------------------------------------------------- Dark Powers y Vida Final

registerDarkPowerReveal((s, custom) => {
  if (custom !== 'dp-ml-never-dead') return;
  const h = s.killer.health;
  mp(s).reserve.push(h.hidden);
  h.token = 'white';
  h.hidden = 0;
  log(s, 'La ficha de Vida Final del Dr. Fright vuelve a la reserva y pasa a ser blanca.', 'killer');
});

registerKillerDeath((s) => {
  const m = s.maple;
  if (!m || m.revived || !has(s, 'dp-ml-never-dead') || s.killer.id !== 'dr-fright') return false;
  m.revived = true;
  s.infoSeq++;
  const picks = m.reserve.splice(0, 3);
  const total = picks.reduce((a, b) => a + b, 0);
  log(s, `Nunca realmente muerto: se revelan 3 fichas de Vida Final (${picks.join(', ') || '—'}).`, 'killer');
  if (total <= 0) return false;
  s.killer.health.hp = total;
  log(s, `El Dr. Fright se levanta con ${total} de Vida.`, 'killer');
  return true;
});

// Nancy (Habilidad Definitiva): al perder Vida normal puede cambiar su ficha de Vida Final negra.
registerFgDamaged((s) => {
  const m = s.maple;
  if (!m || !has(s, 'ult-nancy') || s.fg.health.token !== 'black' || !m.reserve.length) return;
  const v = m.reserve.shift()!;
  s.infoSeq++;
  push(s, choice(`Nancy: revelas una ficha de Vida Final negra de la reserva (${v === 0 ? 'en blanco' : `${v} ${v === 1 ? 'Vida' : 'Vidas'}`}). ¿La cambias por la tuya?`, [
    { id: 'swap', label: 'Sí: cambiarla (la tuya vuelve a la reserva)' },
    { id: 'drop', label: 'No: retirarla del juego' },
  ], { kind: 'custom', id: 'df-nancy', data: { v } }));
});
registerChoice('df-nancy', (s, option, data) => {
  if (option !== 'swap') return log(s, 'Retiras la ficha del juego.');
  const old = s.fg.health.hidden;
  s.fg.health.hidden = data.v as number;
  mp(s).reserve.push(old);
  log(s, 'Cambias tu ficha de Vida Final por la revelada.', 'good');
});

// ---------------------------------------------------------------- cartas de Horror del Dr. Fright

function skipRest(s: GameState): void {
  const t = s.stack[s.stack.length - 1];
  if (t?.t === 'effects') t.i = t.effects.length;
}
/** Descarta la carta en curso y resuelve la siguiente. */
function skipAndDraw(s: GameState, why: string): void {
  log(s, `${why}: se descarta y se resuelve la siguiente carta de Terror.`);
  skipRest(s);
  drawHorror(s);
}

const isHouse = (s: GameState, z: ZoneId) => !!zoneDef(s, z).house;
const isStreet = (s: GameState, z: ZoneId) => !!zoneDef(s, z).street;
const realVictims = (s: GameState) => s.victims;

registerEffect('df-panic-outside', (s) => {
  const vs = s.victims.filter((v) => !isHouse(s, v.zone));
  if (!vs.length) return;
  log(s, 'Las Víctimas que no están en una Casa entran en pánico.', 'killer');
  panicVictims(s, vs);
});

registerEffect('df-dead-count', (s) => {
  const n = s.dead.length;
  if (n === 0) return fallAsleep(s);
  log(s, `${n} ${n === 1 ? 'Víctima ha muerto' : 'Víctimas han muerto'}: +${n >= 4 ? 2 : 1} Sed de Sangre.`, 'killer');
  increaseBloodlust(s, n >= 4 ? 2 : 1);
});

registerEffect('df-crucifix-gate', (s) => {
  const cross = itemsWith(s, 'item-ml-crucifix')[0];
  if (!cross) return;
  push(s, choice('Coge tu crucifijo: ¿descartas el Crucifijo para ignorar el resto de la carta?', [
    { id: 'yes', label: 'Sí' },
    { id: 'no', label: 'No' },
  ], { kind: 'custom', id: 'df-crucifix', data: { uid: cross.uid } }));
});
registerChoice('df-crucifix', (s, option, data) => {
  if (option !== 'yes') return;
  discardItem(s, data.uid as string);
  log(s, 'El Crucifijo anula el resto de la carta.', 'good');
  // Quita lo que queda de los efectos de la carta (están debajo de esta elección).
  for (let i = s.stack.length - 1; i >= 0; i--) {
    const t = s.stack[i]!;
    if (t.t === 'effects') {
      t.i = t.effects.length;
      break;
    }
  }
});

registerEffect('df-omg', (s) => {
  if (s.killer.health.hp <= 1) return log(s, 'Al Dr. Fright solo le queda su ficha de Vida Final: no recibe daño.');
  log(s, 'El Dr. Fright se corta los dedos: recibe 1 de daño.', 'good');
  const before = s.killer.health.hp;
  damageKiller(s, 1, true);
  if (s.outcome || s.killer.health.hp >= before) return;
  log(s, 'Te estremeces: +3 Terror. Tú y las Víctimas de su espacio entráis en pánico.', 'bad');
  const near = victimsIn(s, s.killer.zone);
  changeTerror(s, 3);
  if (near.length) panicVictims(s, near);
  fgPanic(s);
});

/** La Chica Final entra en pánico: huye según los números de huida de su espacio. */
function fgPanic(s: GameState): void {
  const face = rollDie(s.rng);
  const exit = zoneDef(s, s.fg.zone).flee.find((f) => f.faces.includes(face));
  if (!exit || !neighbors(s, s.fg.zone, 'fg').includes(exit.to)) {
    return log(s, `Pánico: dado ${face}, te quedas en ${zoneName(s, s.fg.zone)}.`, 'bad', { kind: 'dice', faces: [face] });
  }
  log(s, `Pánico: dado ${face}, huyes a ${zoneName(s, exit.to)}.`, 'bad', { kind: 'dice', faces: [face] });
  s.fg.zone = exit.to;
  mapleOnFgEnter(s, exit.to);
}

registerEffect('df-lock-houses', (s) => {
  mp(s).lockNext = true;
  log(s, 'Durante la siguiente fase de Acción no podrás entrar en Casas ocupadas.', 'killer');
});

registerEffect('df-undead', (s) => {
  if (s.fg.saved === 0 || s.fg.ultimate) return skipAndDraw(s, 'No tienes Víctimas salvadas que perder');
  const i = s.fg.rescueSlots.lastIndexOf(true);
  if (i >= 0) s.fg.rescueSlots[i] = false;
  s.fg.saved--;
  s.dead.push({ id: `v${s.nextUid++}`, zone: s.fg.zone });
  log(s, 'Una Víctima que habías salvado vuelve a estar muerta: la quitas de tu carta de Chica Final.', 'bad');
});

registerEffect('df-better-awake', (s) => {
  if (!mp(s).asleep) {
    mp(s).dimNext = true;
    return log(s, 'Tirarás 1 dado menos en las Tiradas de Horror de la siguiente fase de Acción.', 'bad');
  }
  const n = mp(s).br.deck.length;
  log(s, `Mejor estar despierta: resuelves inmediatamente las ${n} cartas restantes de la Sala de Calderas.`, 'killer');
  pushEffects(s, Array.from({ length: n }, () => eff('df-resolve-br')), SRC_HORROR);
});

registerEffect('df-sleepy', (s) => {
  const m = mp(s);
  if (!m.asleep) {
    const face = rollDie(s.rng);
    const level = s.fg.terror;
    log(s, `Tengo tanto sueño: dado ${face} (nivel de Horror ${level}).`, 'info', { kind: 'dice', faces: [face] });
    if (face < level) fallAsleep(s);
    return;
  }
  m.mark = s.mods.damageTaken;
  pushEffects(s, [eff('df-resolve-br'), eff('df-sleepy-after')], SRC_HORROR);
});
registerEffect('df-sleepy-after', (s) => {
  if (s.mods.damageTaken > mp(s).mark) {
    log(s, 'Has recibido daño: +1 Terror.', 'bad');
    changeTerror(s, 1);
  }
});

registerEffect('df-blurred', (s) => {
  mp(s).blurred = true;
  log(s, 'Realidad borrosa: hasta la próxima fase de Terror, el Dr. Fright y tú podéis haceros daño aunque estés Despierta.', 'killer');
});

registerEffect('df-marked', (s) => {
  mp(s).marked = true;
  const here = victimsIn(s, s.fg.zone);
  log(s, 'Marcado para la muerte: las Víctimas de tu espacio entran en pánico.', 'killer');
  if (here.length) panicVictims(s, here);
});
registerEffect('df-attack-mark', (s) => {
  mp(s).attackedFG = false;
});
registerEffect('df-marked-after', (s) => {
  if (!mp(s).attackedFG && !mp(s).asleep) {
    log(s, 'El Dr. Fright no te ha atacado: caes inmediatamente Dormida.', 'killer');
    fallAsleep(s);
  }
});

registerEffect('df-dream', (s) => {
  if (!mp(s).asleep) return skipAndDraw(s, 'Estás Despierta');
  push(s, choice('«Si esto es un sueño…»: ¿aumentas la Sed de Sangre en 1 para elegir una ventaja?', [
    { id: 'item', label: 'Sed de Sangre +1 y coger el Objeto superior de cualquier mazo' },
    { id: 'move', label: 'Sed de Sangre +1 y moverte a cualquier espacio' },
    { id: 'time', label: 'Sed de Sangre +1 y ganar 4 de Tiempo' },
    { id: 'no', label: 'No hacer nada' },
  ], { kind: 'custom', id: 'df-dream-pick' }));
});
registerChoice('df-dream-pick', (s, option) => {
  if (option === 'no') return;
  const rest: Effect[] = [{ kind: 'bloodlust', amount: 1 }];
  if (option === 'item') rest.push({ kind: 'drawItemAnyDeck' });
  if (option === 'time') rest.push({ kind: 'time', amount: 4 });
  pushEffects(s, rest, SRC_HORROR);
  if (option === 'move') {
    const zones = locationDef(s).zones.filter((z) => z.id !== s.fg.zone && !isLocked(s, z.id));
    push(s, choice('Muévete a cualquier espacio', zones.map((z) => ({ id: z.id, label: z.label })), { kind: 'custom', id: 'df-dream-move' }));
  }
});
registerChoice('df-dream-move', (s, option) => {
  log(s, `Te mueves a ${zoneName(s, option)}.`, 'good', { kind: 'fgMove', path: [s.fg.zone, option] });
  s.fg.zone = option;
  mapleOnFgEnter(s, option);
});

registerEffect('df-frankie', (s) => {
  const n = victimsIn(s, s.killer.zone).length ? 2 : 1;
  log(s, `Frankie viene a por ti: +${n} Terror.`, 'bad');
  changeTerror(s, n);
});

registerEffect('df-never-sleep', (s) => {
  const m = mp(s);
  if (!m.asleep) return fallAsleep(s);
  push(s, choice('Jamás volver a dormir: ya estás Dormida.', [
    { id: 'reset', label: 'Reiniciar el mazo de la Sala de Calderas' },
    { id: 'extra', label: 'Resolver una carta adicional al final de la fase del Asesino' },
  ], { kind: 'custom', id: 'df-never-sleep-pick' }));
});
registerChoice('df-never-sleep-pick', (s, option) => {
  if (option === 'reset') resetBR(s);
  else mp(s).extraBR++;
});

registerEffect('df-kill-two', (s) => {
  const n = Math.min(2, realVictims(s).length);
  if (!n) {
    log(s, 'No hay Víctimas a las que matar: pierdes 4 Vidas.', 'killer');
    return damageFG(s, 4);
  }
  log(s, `Deben morir todos: mueren ${n} ${n === 1 ? 'Víctima' : 'Víctimas'} (tú eliges).`, 'killer');
  pushEffects(s, Array.from({ length: n }, () => eff('cn-kill-pick')), SRC_HORROR);
});

// ---------------------------------------------------------------- Grandes Finales

export function mapleFinaleRevealed(s: GameState, custom: string | undefined): void {
  if (!isFright(s)) return;
  if (custom === 'finale-ml-fear') {
    if (!mp(s).asleep) fallAsleep(s);
    else resetBR(s);
  }
  if (custom === 'finale-ml-everyone-dies') {
    mp(s).offBoard = true;
    s.killer.zone = s.fg.zone;
    log(s, 'El Dr. Fright sale del tablero y pasa a su carta: Dormida puedes atacarlo desde cualquier espacio.', 'killer');
  }
}

// ---------------------------------------------------------------- Casas, Salidas y movimiento

const isOccupied = (s: GameState, zone: ZoneId) => s.victims.some((v) => v.zone === zone);
const fireAt = (s: GameState, zone: ZoneId) => s.tokens.some((t) => t.id === 'fuego' && t.zone === zone);
export const isLocked = (s: GameState, zone: ZoneId) => fireAt(s, zone);
const searched = (s: GameState, zone: ZoneId) => s.tokens.some((t) => t.id === 'x' && t.zone === zone);

/** ¿Se puede buscar en el espacio donde estás? (Casas con X o en llamas, no). */
export function searchableHere(s: GameState): boolean {
  const z = zoneDef(s, s.fg.zone);
  if (!z.search) return false;
  return !searched(s, z.id) && !fireAt(s, z.id);
}

/** Destinos a pie: no puedes entrar en una Casa ocupada (hay que «Convencer») ni en una en llamas. */
export function mapleFilterDestinations(s: GameState, zones: ZoneId[], mode: 'walk' | 'boat' | 'free' | 'convince'): ZoneId[] {
  if (mode === 'free' || !locationDef(s).zones.some((z) => z.house)) return zones;
  return zones.filter((z) => {
    if (!isHouse(s, z)) return true;
    if (fireAt(s, z)) return false;
    return !isOccupied(s, z);
  });
}

/** Casas a las que puedes entrar con «Convencer» (adyacentes; no si hay Casas ocupadas bloqueadas ni en llamas). */
export function convinceTargets(s: GameState): ZoneId[] {
  const locked = mp(s).lockNow;
  return neighbors(s, s.fg.zone, 'fg').filter((z) => isHouse(s, z) && !fireAt(s, z) && !(locked && isOccupied(s, z)));
}

export function convincePlayable(s: GameState): boolean {
  return convinceTargets(s).some((z) => isOccupied(s, z));
}

export function mapleCardPlayable(s: GameState, cardId: CardId): boolean {
  return cardId !== 'convencer' || convincePlayable(s);
}

/** «Mejor cerrar la puerta»: tampoco puedes entrar en Casas ocupadas. En Maple Lane las casas ocupadas ya están cerradas. */
export function mapleLockedHouses(s: GameState, zones: ZoneId[]): ZoneId[] {
  return mp(s).lockNow ? zones.filter((z) => !(isHouse(s, z) && isOccupied(s, z))) : zones;
}

/** Las Víctimas no te siguen Dormida ni mientras llevas un Machete. */
export function mapleCanFollow(s: GameState, v: Victim): boolean {
  void v;
  if (isFright(s) && mp(s).asleep) return false;
  return !(has(s, 'item-ml-machete') || has(s, 'item-nancy-machetes'));
}

/** Víctimas que se pueden salvar: no Dormida y no en una Salida con Barrera. */
export function mapleRescuable(s: GameState, zone: ZoneId): boolean {
  if (isFright(s) && mp(s).asleep) return false;
  return !s.tokens.some((t) => t.id === 'barrera' && t.zone === zone);
}

/** La Chica Final entra en un espacio. */
export function mapleOnFgEnter(s: GameState, zone: ZoneId): void {
  const m = s.maple;
  if (!m) return;
  if (m.offBoard) s.killer.zone = zone;
  if (has(s, 'item-nancy-machetes') && s.killer.zone === zone && fgDef(s).id === 'nancy') {
    log(s, 'Entras en el espacio del Asesino con los Machetes de Nancy: +1 Sed de Sangre.', 'killer');
    increaseBloodlust(s, 1);
  }
  if (m.marked) {
    const here = victimsIn(s, zone);
    if (here.length) {
      log(s, 'Marcado para la muerte: las Víctimas de tu espacio entran en pánico.', 'killer');
      panicVictims(s, here);
    }
  }
}

registerEffect('ml-enter', (s) => {
  const dest = convinceTargets(s);
  if (!dest.length) return log(s, 'No hay ninguna Casa adyacente a la que entrar.');
  push(s, { t: 'fgMove', remaining: 1, src: SRC_HORROR, mode: 'convince' });
});
registerEffect('ml-enter:take', (s) => {
  pushEffects(s, [eff('ml-enter'), eff('ml-take-top')], SRC_HORROR);
});
registerEffect('ml-take-top', (s) => {
  const zone = zoneDef(s, s.fg.zone);
  if (!zone.house || searched(s, zone.id) || fireAt(s, zone.id) || !(s.itemDecks[deckOf(s, zone.id)]?.length)) return;
  push(s, choice('Convencer: ¿coges el Objeto superior de esta Casa?', [
    { id: 'yes', label: 'Sí (se marca la Casa con una X)' },
    { id: 'no', label: 'No' },
  ], { kind: 'custom', id: 'ml-take-top' }));
});
registerChoice('ml-take-top', (s, option) => {
  if (option !== 'yes') return;
  const zone = s.fg.zone;
  const deck = s.itemDecks[deckOf(s, zone)];
  const card = deck?.shift();
  if (!card) return;
  s.infoSeq++;
  if (deck?.[0]) deck[0].faceUp = true;
  s.tokens.push({ id: 'x', zone });
  gainItem(s, card.id);
});

registerEffect('ml-return-card', (s, _arg, src) => {
  const id = src.id;
  if (!id) return;
  const i = s.actionDiscard.lastIndexOf(id);
  if (i < 0) return;
  s.actionDiscard.splice(i, 1);
  s.actionTable[id] = (s.actionTable[id] ?? 0) + 1;
  log(s, `Devuelves ${actionDef(id).name} al tablero de cartas de Acción.`);
});

/** Buscar con éxito en una Casa: se marca con una X. */
export function mapleMarkSearched(s: GameState): void {
  const z = zoneDef(s, s.fg.zone);
  if (!z.house || searched(s, z.id)) return;
  s.tokens.push({ id: 'x', zone: z.id });
  log(s, `${z.label}: se marca con una X; ya no se podrá buscar.`);
}

/** Objeto nuevo: Bicicleta (se pone en una Calle adyacente). */
export function mapleOnGain(s: GameState, id: CardId): void {
  if (itemDef(s, id).custom !== 'item-ml-bike') return;
  const streets = [...neighbors(s, s.fg.zone, 'fg'), s.fg.zone].filter((z) => isStreet(s, z));
  if (!streets.length) return;
  s.tokens = s.tokens.filter((t) => t.id !== 'bicicleta');
  if (streets.length === 1) {
    s.tokens.push({ id: 'bicicleta', zone: streets[0]! });
    return void log(s, `La Bicicleta está en ${zoneName(s, streets[0]!)}.`);
  }
  push(s, choice('Bicicleta: ¿en qué Calle adyacente colocas el token?', streets.map((z) => ({ id: z, label: zoneName(s, z) })), { kind: 'custom', id: 'ml-bike-place' }));
}
registerChoice('ml-bike-place', (s, option) => {
  s.tokens = s.tokens.filter((t) => t.id !== 'bicicleta');
  s.tokens.push({ id: 'bicicleta', zone: option });
  log(s, `Colocas la Bicicleta en ${zoneName(s, option)}.`);
});

// ---------------------------------------------------------------- tiradas

const dealsDamage = (cardId: CardId) => {
  const r = actionDef(cardId).results;
  return !!r && [r.double, r.single, r.fail].some((line) => line.some((alt) => alt.some((e) => e.kind === 'damage')));
};

export function mapleAdjustDice(s: GameState, purpose: { kind: string; cardId?: string; weaponUid?: string }, dice: number, extra: string[]): number {
  if (purpose.kind === 'action' && purpose.cardId === 'convencer') {
    if (has(s, 'ev-ml-friendly')) {
      dice++;
      extra.push('+1 por Amables vecinos');
    }
    if (has(s, 'item-ml-bible')) {
      dice += 2;
      extra.push('+2 por la Biblia');
    }
  }
  if (purpose.kind === 'action' && purpose.cardId && dealsDamage(purpose.cardId) && purpose.weaponUid) {
    const w = s.fg.items.find((i) => i.uid === purpose.weaponUid);
    if (w?.id === 'cuchillo-de-sheila') {
      dice++;
      extra.push('+1 por el Cuchillo de Sheila');
    }
  }
  if (s.maple?.dimNow && (purpose.kind === 'action' || purpose.kind === 'reaction' || purpose.kind === 'effect')) {
    dice--;
    extra.push('−1 por Mejor estar despierta');
  }
  return dice;
}

// ---------------------------------------------------------------- Crucifijo

registerTerrorGate((s, amount) => {
  const cross = itemsWith(s, 'item-ml-crucifix')[0];
  if (!cross || gateBypass) return false;
  push(s, choice(`+${amount} Terror: ¿descartas el Crucifijo para ignorar el aumento?`, [
    { id: 'yes', label: 'Sí: ignorar el aumento' },
    { id: 'no', label: `No: +${amount} Terror` },
  ], { kind: 'custom', id: 'ml-crucifix-terror', data: { uid: cross.uid, amount } }));
  return true;
});
let gateBypass = false;
registerChoice('ml-crucifix-terror', (s, option, data) => {
  if (option === 'yes') {
    discardItem(s, data.uid as string);
    return log(s, 'El Crucifijo anula el aumento del nivel de Horror.', 'good');
  }
  gateBypass = true;
  try {
    changeTerror(s, data.amount as number);
  } finally {
    gateBypass = false;
  }
});

/** Un Enemigo se va a mover cerca de ti: el Crucifijo puede detenerlo. Devuelve el recorte del camino, si lo pides. */
export function mapleStopOptions(s: GameState, path: ZoneId[]): number | null {
  const cross = itemsWith(s, 'item-ml-crucifix')[0];
  if (!cross) return null;
  const adj = neighbors(s, s.fg.zone, 'fg');
  const i = path.findIndex((z) => adj.includes(z));
  return i >= 0 && i < path.length - 1 ? i : null;
}

// ---------------------------------------------------------------- cartas de Horror de Maple Lane

registerEffect('ml-killer-to-exit', (s) => {
  const exits = locationDef(s).zones.filter((z) => z.exit && s.victims.some((v) => v.zone === z.id));
  if (!exits.length) return skipAndDraw(s, 'No hay Salidas con Víctimas');
  if (exits.length === 1) return teleportKiller(s, exits[0]!.id);
  push(s, choice('¿En qué Salida con Víctimas aparece el Asesino?', exits.map((z) => ({ id: z.id, label: z.label })), { kind: 'custom', id: 'teleport-killer' }));
});

registerEffect('ml-barrier', (s) => {
  const dist = distances(s, s.fg.zone, 'fg');
  const exits = locationDef(s).zones.filter((z) => z.exit);
  const best = Math.min(...exits.map((z) => dist.get(z.id) ?? 99));
  const near = exits.filter((z) => (dist.get(z.id) ?? 99) === best);
  if (near.length > 1) {
    return push(s, choice('Empate: ¿en qué Salida pones la Barrera?', near.map((z) => ({ id: z.id, label: z.label })), { kind: 'custom', id: 'ml-barrier-place' }));
  }
  placeBarrier(s, near[0]!.id);
});
registerChoice('ml-barrier-place', (s, option) => placeBarrier(s, option));
function placeBarrier(s: GameState, zone: ZoneId): void {
  s.tokens.push({ id: 'barrera', zone });
  log(s, `Barrera en ${zoneName(s, zone)}: no se puede salvar a nadie allí.`, 'killer');
}

registerEffect('ml-mark-kills', (s) => {
  mp(s).mark = s.mods.killedThisTurn;
});
registerEffect('ml-all-die', (s) => {
  if (s.mods.killedThisTurn > mp(s).mark) return;
  log(s, 'Ninguna Víctima ha muerto: +2 Sed de Sangre.', 'killer');
  increaseBloodlust(s, 2);
});

registerEffect('ml-patio', (s) => {
  const here = zoneDef(s, s.killer.zone);
  if (!here.house) return;
  const quadrantsWithVictims = new Set(s.victims.map((v) => zoneDef(s, v.zone)).filter((z) => z.house).map((z) => z.deck));
  const houses = locationDef(s).zones.filter((z) => z.house && z.id !== here.id && quadrantsWithVictims.has(z.deck) && !fireAt(s, z.id));
  if (!houses.length) return;
  push(s, choice('Justo entró por el patio: ¿a qué otra Casa se mueve el Asesino?', houses.map((z) => ({ id: z.id, label: z.label })), { kind: 'custom', id: 'teleport-killer' }));
});

registerEffect('ml-car', (s) => {
  const vs = s.victims.filter((v) => isStreet(s, v.zone));
  if (!vs.length) return skipAndDraw(s, 'No hay Víctimas en ninguna Calle');
  const zones = [...new Set(vs.map((v) => v.zone))];
  if (zones.length === 1) return killIn(s, zones[0]!);
  push(s, choice('¡Golpeados por un coche!: ¿en qué Calle muere una Víctima?', zones.map((z) => ({ id: z, label: `${zoneName(s, z)} (${s.victims.filter((v) => v.zone === z).length})` })), { kind: 'custom', id: 'ml-car-pick' }));
});
registerChoice('ml-car-pick', (s, option) => killIn(s, option));
function killIn(s: GameState, zone: ZoneId): void {
  const v = victimsIn(s, zone).sort((a, b) => (a.role ? 1 : 0) - (b.role ? 1 : 0))[0];
  if (v) killVictim(s, v, false);
}

registerEffect('ml-sneaky', (s) => {
  if (s.killer.zone !== s.fg.zone) return;
  log(s, 'El Asesino está en tu espacio: +1 Terror.', 'bad');
  changeTerror(s, 1);
});

registerEffect('ml-hide', (s) => {
  const exits = new Set(locationDef(s).zones.filter((z) => z.exit).map((z) => z.id));
  for (const z of locationDef(s).zones.filter((x) => x.house)) {
    const linked = z.flee.some((f) => exits.has(f.to));
    if (!linked) placeVictims(s, z.id, 1);
  }
});

// ---------------------------------------------------------------- Eventos

export function mapleEventRevealed(s: GameState, custom: string): void {
  const loc = locationDef(s);
  switch (custom) {
    case 'ev-ml-police': {
      const exits = loc.zones.filter((z) => z.exit);
      push(s, choice('Oficial de poli: ¿en qué Salida pones el Coche de Policía?', exits.map((z) => ({ id: z.id, label: z.label })), { kind: 'custom', id: 'ml-police-place' }));
      break;
    }
    case 'ev-ml-fire': {
      const face = rollDie(s.rng);
      const zone = face <= 3 ? 'ne-top' : 'so-centro';
      s.tokens.push({ id: 'fuego', zone });
      log(s, `¡Fuego! Dado ${face}: arde ${zoneName(s, zone)}.`, 'killer', { kind: 'dice', faces: [face] });
      for (const v of victimsIn(s, zone)) killVictim(s, v, false);
      if (s.fg.zone === zone) damageFG(s, 1);
      if (!s.outcome && s.killer.zone === zone) damageKiller(s, 1);
      for (const m of s.minions.filter((x) => x.zone === zone)) m.hp -= 1;
      break;
    }
    case 'ev-ml-boyfriend':
      specialVictims(s, 'ne-top', 1, 'novio-ml');
      break;
    case 'ev-ml-smalleys':
      specialVictims(s, 'so-centro', 2, 'smalley');
      break;
  }
}

function specialVictims(s: GameState, zone: ZoneId, n: number, role: 'novio-ml' | 'smalley'): void {
  const before = new Set(s.victims.map((v) => v.id));
  placeVictims(s, zone, n);
  const fresh = s.victims.filter((v) => !before.has(v.id));
  fresh.forEach((v, i) => {
    v.role = role;
    v.special = role === 'novio-ml' ? 'blue' : i === 0 ? 'orange' : 'white';
  });
}

registerChoice('ml-police-place', (s, option) => {
  s.tokens = s.tokens.filter((t) => t.id !== 'coche-de-policia');
  s.tokens.push({ id: 'coche-de-policia', zone: option });
  const opposite: Record<string, string> = { 'salida-n': 'salida-s', 'salida-s': 'salida-n', 'salida-o': 'salida-e', 'salida-e': 'salida-o' };
  mp(s).policeTo = opposite[option] ?? option;
  log(s, `El Coche de Policía está en ${zoneName(s, option)} y va hacia ${zoneName(s, mp(s).policeTo!)}.`);
});

registerEffect('ml-works', (s) => {
  const face = rollDie(s.rng);
  log(s, `Zona en obras: dado ${face}.`, 'killer', { kind: 'dice', faces: [face] });
  const exitOf: Record<number, string[]> = { 1: ['salida-o'], 2: ['salida-e'], 3: ['salida-n'], 4: ['salida-s'], 5: ['salida-e', 'salida-o'], 6: ['salida-n', 'salida-s'] };
  const opts = exitOf[face]!;
  if (opts.length === 1) return placeBarrier(s, opts[0]!);
  push(s, choice('Zona en obras: ¿en qué Salida pones la Barrera?', opts.map((z) => ({ id: z, label: zoneName(s, z) })), { kind: 'custom', id: 'ml-barrier-place' }));
});

registerEffect('ml-everyone-exit', (s) => {
  for (const z of locationDef(s).zones.filter((x) => x.exit)) placeVictims(s, z.id, 1);
});

registerEffect('ml-party', (s) => {
  const houses = [...new Set(s.victims.filter((v) => isHouse(s, v.zone)).map((v) => v.zone))];
  if (!houses.length) return placeVictims(s, 'interseccion', 4);
  if (houses.length === 1) return placeVictims(s, houses[0]!, 4);
  push(s, choice('¡De fiesta por el barrio!: ¿en qué Casa pones las 4 Víctimas?', houses.map((z) => ({ id: z, label: zoneName(s, z) })), { kind: 'custom', id: 'ml-party-pick' }));
});
registerChoice('ml-party-pick', (s, option) => placeVictims(s, option, 4));

registerEffect('ml-rain', (s) => {
  const inter = victimsIn(s, 'interseccion');
  if (inter.length) panicVictims(s, inter);
  const groups = [...new Set(s.victims.filter((v) => isStreet(s, v.zone)).map((v) => v.zone))];
  for (const z of groups) {
    const houses = neighbors(s, z, 'enemy').filter((h) => isHouse(s, h) && !fireAt(s, h));
    if (!houses.length) continue;
    if (houses.length === 1) {
      for (const v of victimsIn(s, z)) moveVictim(s, v, houses[0]!);
      continue;
    }
    push(s, choice(`Está lloviendo: ¿a qué Casa corren las Víctimas de ${zoneName(s, z)}?`, houses.map((h) => ({ id: h, label: zoneName(s, h) })), { kind: 'custom', id: 'ml-rain-pick', data: { from: z } }));
  }
});
registerChoice('ml-rain-pick', (s, option, data) => {
  for (const v of victimsIn(s, data.from as string)) moveVictim(s, v, option);
});

registerEffect('ml-july', (s) => {
  for (const v of s.victims.filter((x) => isHouse(s, x.zone))) {
    const streets = neighbors(s, v.zone, 'victim').filter((z) => isStreet(s, z));
    if (streets[0]) moveVictim(s, v, streets[0]);
  }
});

// Fuego: las Víctimas que entran en la Casa en llamas mueren.
registerVictimEnters((s, v, zone) => {
  if (fireAt(s, zone)) {
    log(s, `${capitalize(victimLabel(v))} entra en la Casa en llamas y muere.`, 'killer');
    killVictim(s, v, false);
  }
});

// Smalleys: cada muerte suma Sed de Sangre. El Novio y los Smalleys dejan de jugar al morir.
registerVictimKilled((s, v) => {
  if (v.role === 'smalley') {
    log(s, 'Ha muerto uno de los Smalleys: +1 Sed de Sangre.', 'killer');
    increaseBloodlust(s, 1);
  }
});

// ---------------------------------------------------------------- Mantenimiento y turno

function streetPath(s: GameState, from: ZoneId, to: ZoneId): ZoneId[] {
  const q = [from];
  const prev = new Map<ZoneId, ZoneId | null>([[from, null]]);
  while (q.length) {
    const z = q.shift()!;
    if (z === to) break;
    for (const n of neighbors(s, z, 'enemy').filter((x) => isStreet(s, x))) {
      if (!prev.has(n)) {
        prev.set(n, z);
        q.push(n);
      }
    }
  }
  const path: ZoneId[] = [];
  for (let z: ZoneId | null | undefined = to; z; z = prev.get(z)) path.unshift(z);
  return path.slice(1);
}

export function mapleUpkeep(s: GameState): void {
  const steps: Effect[] = [];
  if (s.tokens.some((t) => t.id === 'coche-de-policia')) steps.push(eff('ml-police-step'));
  if (has(s, 'ev-ml-boyfriend') && s.victims.some((v) => v.role === 'novio-ml')) steps.push(eff('ml-boyfriend'));
  if (has(s, 'finale-ml-time') && isFright(s) && !mp(s).asleep) steps.push(eff('df-time-to-die'));
  if (steps.length) pushEffects(s, steps, { kind: 'event' });
}

registerEffect('df-time-to-die', (s) => {
  log(s, 'Hora de morir: estás Despierta en el Mantenimiento, pierdes 2 Vidas y caes Dormida.', 'killer');
  damageFG(s, 2);
  if (!s.outcome) fallAsleep(s);
});

registerEffect('ml-police-step', (s) => {
  const car = s.tokens.find((t) => t.id === 'coche-de-policia');
  const to = s.maple?.policeTo;
  if (!car || !to) return;
  const next = streetPath(s, car.zone, to)[0];
  if (!next) return;
  const riders = victimsIn(s, car.zone);
  car.zone = next;
  for (const v of riders) v.zone = next;
  log(s, `El Coche de Policía avanza a ${zoneName(s, next)}${riders.length ? ` con ${riders.length} ${riders.length === 1 ? 'Víctima' : 'Víctimas'}` : ''}.`, 'good');
  if (next !== to) return;
  for (const v of riders) {
    s.victims = s.victims.filter((x) => x !== v);
    s.fg.saved++;
    victimLeaves(s, v);
  }
  if (riders.length) log(s, `${riders.length} ${riders.length === 1 ? 'Víctima se salva' : 'Víctimas se salvan'} gracias a la policía.`, 'good');
  s.tokens = s.tokens.filter((t) => t !== car);
  s.maple!.policeTo = null;
  if (s.activeEvents.includes('oficial-de-poli')) {
    s.activeEvents = s.activeEvents.filter((e) => e !== 'oficial-de-poli');
    s.eventDiscard.push('oficial-de-poli');
  }
});

registerEffect('ml-boyfriend', (s) => {
  const nv = s.victims.find((v) => v.role === 'novio-ml');
  if (!nv) return;
  for (let i = 0; i < 2 && nv.zone !== s.fg.zone; i++) {
    const next = shortestPaths(s, nv.zone, s.fg.zone, 'victim')[0]?.[0];
    if (!next) break;
    moveVictim(s, nv, next);
    if (!s.victims.includes(nv)) return;
  }
  log(s, `Tu Novio se acerca a ${zoneName(s, nv.zone)}.`);
  if (nv.zone === s.fg.zone) {
    log(s, 'Tu Novio está contigo: +2 Tiempo.', 'good');
    changeTime(s, 2);
  }
});

export function mapleTurnStart(s: GameState): void {
  const m = s.maple;
  if (!m) return;
  m.lockNow = m.lockNext;
  m.dimNow = m.dimNext;
  m.lockNext = false;
  m.dimNext = false;
  if (m.lockNow) log(s, 'No puedes entrar en Casas ocupadas durante esta fase de Acción.', 'bad');
  if (m.dimNow) log(s, 'Tiras 1 dado menos en las Tiradas de Horror durante esta fase de Acción.', 'bad');
}

export function mapleTurnEnd(s: GameState): void {
  if (s.maple) s.maple.surprise = 0;
}

// ---------------------------------------------------------------- Objetos con acciones

interface ItemAct {
  uid: string;
  action: string;
  label: string;
}

export function mapleItemActions(s: GameState, it: { uid: string; id: string; uses?: number }, custom: string | undefined, time: number): ItemAct[] {
  const out: ItemAct[] = [];
  const add = (action: string, label: string) => out.push({ uid: it.uid, action, label });
  const once = (key: string) => s.mods.usedThisPhase.includes(key);
  switch (custom) {
    case 'item-ml-rifle':
      if (time >= 1 && (it.uses ?? 0) > 0 && streetEnemyInRange(s, 1, 3)) add('shoot', 'Disparar el Rifle (1 Tiempo)');
      break;
    case 'item-ml-megaphone':
      if (!once(it.uid) && s.victims.length) add('use', 'Megáfono: mover una Víctima 1 espacio');
      break;
    case 'item-ml-bike': {
      const bike = s.tokens.find((t) => t.id === 'bicicleta');
      if (bike?.zone === s.fg.zone && !s.mods.usedThisTurn.includes(it.uid)) add('ride', 'Montar en la Bicicleta a otra Calle');
      break;
    }
    case 'item-ml-junk':
      if ((it.uses ?? 0) > 0 && isHouse(s, s.fg.zone) && !s.tokens.some((t) => t.id === 'trampa-para-tontos' && t.zone === s.fg.zone)) add('trap', 'Trastos: poner una Trampa para tontos aquí');
      break;
  }
  return out;
}

function streetEnemyInRange(s: GameState, min: number, max: number): boolean {
  if (killerShielded(s)) return s.minions.some((m) => isStreet(s, m.zone) && inRangeOf(s, m.zone, min, max));
  return [s.killer.zone, ...s.minions.map((m) => m.zone)].some((z) => isStreet(s, z) && inRangeOf(s, z, min, max));
}
function inRangeOf(s: GameState, zone: ZoneId, min: number, max: number): boolean {
  const d = distances(s, s.fg.zone, 'fg').get(zone);
  return d !== undefined && d >= min && d <= max;
}

export function mapleUseItem(s: GameState, uid: string, custom: string | undefined, _action: string): boolean {
  switch (custom) {
    case 'item-ml-rifle': {
      changeTime(s, -1);
      spendUse(s, uid);
      log(s, 'Disparas el Rifle: Tirada de Horror.', 'info');
      push(s, newRoll(s, { kind: 'effect', id: 'ml-rifle', label: 'Rifle' }));
      return true;
    }
    case 'item-ml-megaphone': {
      s.mods.usedThisPhase.push(uid);
      const zones = [...new Set(s.victims.map((v) => v.zone))];
      push(s, choice('Megáfono: ¿de qué espacio mueves una Víctima?', zones.map((z) => ({ id: z, label: `${zoneName(s, z)} (${victimsIn(s, z).length})` })), { kind: 'custom', id: 'ml-mega-from' }));
      return true;
    }
    case 'item-ml-bike': {
      s.mods.usedThisTurn.push(uid);
      const streets = locationDef(s).zones.filter((z) => z.street && z.id !== s.fg.zone);
      push(s, choice('Bicicleta: ¿a qué espacio de Calle vas?', streets.map((z) => ({ id: z.id, label: z.label })), { kind: 'custom', id: 'ml-bike-ride' }));
      return true;
    }
    case 'item-ml-junk':
      s.tokens.push({ id: 'trampa-para-tontos', zone: s.fg.zone });
      spendUse(s, uid);
      log(s, `Colocas una Trampa para tontos en ${zoneName(s, s.fg.zone)}.`, 'good');
      return true;
  }
  return false;
}

registerEffectRoll('ml-rifle', (s, successes) => {
  if (!successes) return log(s, 'El disparo falla.', 'bad');
  const rifle = s.fg.items.find((i) => i.id === 'rifle');
  dealDamage(s, 2, { kind: 'item', id: 'rifle', ...(rifle ? { weaponUid: rifle.uid } : {}) });
});

registerChoice('ml-mega-from', (s, option) => {
  const dests = neighbors(s, option, 'victim');
  if (!dests.length) return log(s, 'Esa Víctima no se puede mover.');
  push(s, choice(`Megáfono: ¿a dónde se mueve la Víctima de ${zoneName(s, option)}?`, dests.map((z) => ({ id: z, label: zoneName(s, z) })), { kind: 'custom', id: 'ml-mega-to', data: { from: option } }));
});
registerChoice('ml-mega-to', (s, option, data) => {
  const v = victimsIn(s, data.from as string).sort((a, b) => (a.role ? 1 : 0) - (b.role ? 1 : 0))[0];
  if (!v) return;
  log(s, `Una Víctima corre de ${zoneName(s, data.from as string)} a ${zoneName(s, option)}.`, 'info', { kind: 'victimMove', victim: v.id, path: [v.zone, option] });
  moveVictim(s, v, option);
  pushEffects(s, [{ kind: 'killerAction', action: { target: 'finalGirl', moves: 1, attacks: 0 } }], { kind: 'item', id: 'megafono' });
});

registerChoice('ml-bike-ride', (s, option) => {
  const bike = s.tokens.find((t) => t.id === 'bicicleta');
  log(s, `Montas en la Bicicleta hasta ${zoneName(s, option)}.`, 'good', { kind: 'fgMove', path: [s.fg.zone, option] });
  s.fg.zone = option;
  if (bike) bike.zone = option;
  mapleOnFgEnter(s, option);
});

/** Tridente: ignora el daño de un ataque. */
export const tridentUid = (s: GameState): string | null => itemsWith(s, 'item-ml-trident')[0]?.uid ?? null;

/** Asalto del tridente: cada vez que el Dr. Fright te daña, +1 Terror. */
export function mapleAfterAttack(s: GameState, byKiller: boolean, hpBefore: number): void {
  if (!byKiller || !isFright(s) || !has(s, 'dp-ml-trident') || s.fg.health.hp >= hpBefore) return;
  log(s, 'Asalto del tridente: +1 Terror.', 'bad');
  changeTerror(s, 1);
}
