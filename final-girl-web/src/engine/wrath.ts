import type { WrathAmount, WrathId, WrathTarget } from '../content/types';
import { changeTerror, has, healKiller, log, push, pushEffects, terrorPosition } from './core';
import { killerDef, locationDef, victimsIn } from './lookup';
import { rollDie } from './rng';
import type { GameState } from './state';

export const WRATH_MIN = 1;
export const WRATH_MAX = 10;

export function wrathTrack(s: GameState, id: WrathId) {
  return id === 'killer' ? killerDef(s).wrath : locationDef(s).wrath;
}

export const wrathName = (id: WrathId) => (id === 'killer' ? 'Ira Asesina' : 'Ira Divina');
export const wrathsInPlay = (s: GameState): WrathId[] => (['killer', 'divine'] as const).filter((w) => s.wrath[w] !== undefined);

/** Víctimas en espacios Sagrados (con Fuego y azufre, las de su espacio cuentan doble). */
export function sacredVictims(s: GameState): number {
  const fire = s.activeEvents.includes('fuego-y-azufre') ? s.tokens.find((t) => t.id === 'fuego-y-azufre')?.zone : undefined;
  let n = 0;
  for (const z of locationDef(s).zones) {
    if (!z.sacred) continue;
    n += victimsIn(s, z.id).length * (z.id === fire ? 2 : 1);
  }
  return n;
}

export function wrathAmount(s: GameState, by: WrathAmount): number {
  switch (by) {
    case 'sacredVictims': return sacredVictims(s);
    case 'bloodlustLevel': return s.killer.bloodlust + 1;
    case 'handSize': return s.fg.hand.length;
    case 'fgHealth': return Math.max(0, s.fg.health.hp);
    case 'saved': return s.fg.saved;
    case 'terrorLevel': return terrorPosition(s);
    case 'killedThisTurn': return s.mods.killedThisTurn;
    case 'damageSinceMark': return s.mods.damageTaken - s.mods.damageMark;
    case 'dieRoll': {
      const face = rollDie(s.rng);
      log(s, `Tiras un dado: ${face}.`, 'info', { kind: 'dice', faces: [face] });
      return face;
    }
  }
}

/** Aumenta una Ira aplicando Incienso, Adicto a la indignación y Ruidosos y odiosos. */
export function increaseWrath(s: GameState, id: WrathId, base: number): void {
  const now = s.wrath[id];
  if (now === undefined || base <= 0) return;
  let amount = base;
  const extras: string[] = [];
  if (id === 'killer' && has(s, 'mdp-outrage-addict')) {
    amount++;
    extras.push('Adicto a la indignación +1');
  }
  if (id === 'divine' && has(s, 'ev-loud-obnoxious')) {
    amount++;
    extras.push('Ruidosos y odiosos +1');
  }
  if (has(s, 'item-incense') && amount > 1) {
    amount--;
    extras.push('Incienso −1');
  }
  const next = Math.min(WRATH_MAX, now + amount);
  s.wrath[id] = next;
  log(s, `${wrathName(id)} aumenta en ${amount}${extras.length ? ` (${extras.join(', ')})` : ''}: nivel ${next}.`, 'killer');
  if (next === now || id !== 'killer') return;
  if (has(s, 'dp-wrath-feast')) {
    log(s, 'Fiesta de la ira: Inkanyamba se cura.', 'killer');
    healKiller(s, 1);
  }
  if (has(s, 'dp-growing-fear')) {
    log(s, 'Miedo creciente: +1 Terror.', 'killer');
    changeTerror(s, 1);
  }
}

function setWrath(s: GameState, id: WrathId, value: number, verb: string): void {
  if (s.wrath[id] === undefined) return;
  s.wrath[id] = Math.max(WRATH_MIN, Math.min(WRATH_MAX, value));
  log(s, `${wrathName(id)} ${verb} ${s.wrath[id]}.`, verb === 'baja a' ? 'good' : 'killer');
}

/** Reduce una Ira: en `amount`, a la mitad (redondeando al alza) o hasta un valor. */
export function reduceWrath(s: GameState, id: WrathId, op: 'reduce' | 'halve' | 'set', amount = 1): void {
  const now = s.wrath[id];
  if (now === undefined) return;
  const next = op === 'reduce' ? now - amount : op === 'halve' ? Math.ceil(now / 2) : amount;
  setWrath(s, id, Math.min(now, next), 'baja a');
}

export type WrathOp = 'increase' | 'reduce' | 'halve' | 'set';

export function wrathOp(s: GameState, id: WrathId, op: WrathOp, amount: number): void {
  if (op === 'increase') increaseWrath(s, id, amount);
  else reduceWrath(s, id, op, amount);
}

/** Aplica una operación a una Ira; con 'choose' pregunta si hay dos en juego. */
export function applyWrath(s: GameState, which: WrathTarget, op: WrathOp, amount: number): void {
  const inPlay = wrathsInPlay(s);
  const targets = which === 'choose' ? inPlay : inPlay.filter((w) => w === which);
  if (!targets.length) return;
  if (targets.length === 1) return wrathOp(s, targets[0]!, op, amount);
  const verb = op === 'increase' ? `aumentar en ${amount}` : op === 'reduce' ? `reducir en ${amount}` : op === 'halve' ? 'reducir a la mitad' : `dejar en ${amount}`;
  push(s, {
    t: 'choice',
    title: `¿Qué Ira quieres ${verb}?`,
    options: targets.map((w) => ({ id: w, label: `${wrathName(w)} (nivel ${s.wrath[w]})` })),
    then: { kind: 'custom', id: 'wrath-op', data: { op, amount } },
  });
}

/** Desata: aplica los efectos del nivel actual de la Ira. */
export function unleashWrath(s: GameState, id: WrathId): void {
  const level = s.wrath[id];
  const track = wrathTrack(s, id);
  if (level === undefined || !track) return;
  const row = track.levels[level - 1]!;
  log(s, `¡Se Desata la ${wrathName(id)} (nivel ${level})! ${row.text}`, 'killer');
  pushEffects(s, row.effects, { kind: 'killer' });
}
