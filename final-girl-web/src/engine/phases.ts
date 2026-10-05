import type { CardId, ZoneId } from '../content/types';
import {
  applyDarkWaters,
  has,
  log,
  moveVictim,
  NEXT_PHASE,
  panicVictims,
  push,
  pushEffects,
  resetActionPhaseMods,
  revealDarkPowers,
  RuleError,
} from './core';
import { groovesEventRevealed, holyManUpkeep, miracleFinale, sacredGroundAtActionEnd, upkeepRoll } from './grooves';
import { choice, registerChoice } from './effects';
import { actionDef, boardDef, distances, eventDef, fgDef, horrorDef, killerDef, locationDef, shortestPaths, zoneName } from './lookup';
import { hasActionPhaseOptions, mainPrompt } from './player';
import { pick } from './rng';
import type { GameState, Input, Phase, Task } from './state';

type T<K extends Task['t']> = Extract<Task, { t: K }>;

const PHASE_NAMES: Record<Phase, string> = {
  setup: 'Preparación',
  action: 'Fase de Acción',
  planning: 'Fase de Planificación',
  killer: 'Fase del Asesino',
  panic: 'Fase de Huida',
  upkeep: 'Fase de Mantenimiento',
};

function goTo(s: GameState, task: T<'phase'>, next: Phase): 'done' {
  // La tarea de fase es la única que queda en la pila al terminar.
  s.stack = [];
  push(s, { t: 'phase', phase: next, step: 0 });
  void task;
  return 'done';
}

export function stepPhase(s: GameState, task: T<'phase'>): 'done' | 'continue' | 'wait' {
  if (task.step === 0) {
    s.phase = task.phase;
    if (task.phase === 'action') log(s, `— Turno ${s.turn} —`, 'phase');
    log(s, PHASE_NAMES[task.phase], 'phase');
  }
  switch (task.phase) {
    case 'action':
      return stepActionPhase(s, task);
    case 'planning':
      return stepPlanning(s, task);
    case 'killer':
      return stepKillerPhase(s, task);
    case 'panic':
      return stepPanic(s, task);
    case 'upkeep':
      return stepUpkeep(s, task);
    default:
      throw new RuleError(`Fase desconocida: ${task.phase}`);
  }
}

// ---------------------------------------------------------------- fase de Acción

function stepActionPhase(s: GameState, task: T<'phase'>): 'done' | 'continue' | 'wait' {
  if (task.step === 0) {
    task.step = 1;
    resetActionPhaseMods(s);
    if (s.mods.skipNextActionPhase) {
      s.mods.skipNextActionPhase = false;
      log(s, 'El Tiempo bajó de cero fuera de la fase de Acción: te saltas esta fase.', 'bad');
      return goTo(s, task, NEXT_PHASE.action);
    }
    if (s.mods.timeAtNextAction !== null) {
      s.fg.time = s.mods.timeAtNextAction;
      s.mods.timeAtNextAction = null;
      log(s, `Empiezas la fase de Acción con ${s.fg.time} de Tiempo.`, 'good');
    }
  }
  if (s.mods.actionPhaseEnding || s.fg.time < 0 || !hasActionPhaseOptions(s)) {
    resetActionPhaseMods(s);
    sacredGroundAtActionEnd(s);
    return goTo(s, task, NEXT_PHASE.action);
  }
  s.prompt = mainPrompt(s);
  return 'wait';
}

// ---------------------------------------------------------------- fase de Planificación

function buyable(s: GameState): CardId[] {
  if (s.fg.hand.length >= 10) return [];
  return Object.entries(s.actionTable)
    .filter(([id, n]) => n > 0 && actionDef(id).cost > 0 && actionDef(id).cost <= s.fg.time)
    .map(([id]) => id);
}

function stepPlanning(s: GameState, task: T<'phase'>): 'done' | 'wait' {
  if (task.step === 0) {
    task.step = 1;
    // Las cartas de Coste Cero de la Tabla se compran siempre (si cabe en la mano).
    for (const [id, n] of Object.entries(s.actionTable)) {
      if (actionDef(id).cost !== 0) continue;
      for (let i = 0; i < n && s.fg.hand.length < 10; i++) {
        s.actionTable[id]!--;
        s.fg.hand.push(id);
        log(s, `Recuperas ${actionDef(id).name} (coste cero).`);
      }
    }
  }
  if (task.step === 1) {
    const options = buyable(s);
    if (options.length) {
      s.prompt = { type: 'planning', buyable: options };
      return 'wait';
    }
    // Sin nada que comprar no hay decisión que tomar: la Planificación termina sola.
    log(s, s.fg.hand.length >= 10 ? 'Tienes 10 cartas: no puedes comprar más.' : 'No te queda Tiempo para comprar ninguna carta.');
    task.step = 2;
  }
  // Paso 2: fin de la Planificación.
  s.fg.time = boardDef(s).startTime;
  for (const id of s.actionDiscard) s.actionTable[id] = (s.actionTable[id] ?? 0) + 1;
  s.actionDiscard = [];
  log(s, `El Tiempo vuelve a ${s.fg.time} y las cartas usadas regresan a la Tabla de Acciones.`);
  return goTo(s, task, 'killer');
}

export function inputPlanning(s: GameState, task: T<'phase'>, input: Input): 'continue' {
  if (input.type === 'endPlanning') {
    task.step = 2;
    return 'continue';
  }
  if (input.type !== 'buy') throw new RuleError('Respuesta no válida en la Planificación');
  if (!buyable(s).includes(input.cardId)) throw new RuleError('No puedes comprar esa carta');
  const def = actionDef(input.cardId);
  s.actionTable[input.cardId]!--;
  s.fg.hand.push(input.cardId);
  s.fg.time -= def.cost;
  log(s, `Compras ${def.name} por ${def.cost} de Tiempo (quedan ${s.fg.time}).`);
  return 'continue';
}

// ---------------------------------------------------------------- fase del Asesino

function stepKillerPhase(s: GameState, task: T<'phase'>): 'done' | 'continue' {
  const k = killerDef(s);
  if (task.step === 0) {
    task.step = 1;
    s.mods.killedThisKillerPhase = 0;
    const finale = k.finales.find((f) => f.id === s.killer.finale)!;
    const action = s.killer.finaleRevealed ? finale.finalAction : k.initialAction;
    log(s, `Acción del Asesino${s.killer.finaleRevealed ? ` (${finale.name})` : ''}.`, 'killer');
    pushEffects(s, action, { kind: s.killer.finaleRevealed ? 'finale' : 'killer' });
    return 'continue';
  }
  if (task.step === 1) {
    task.step = 2;
    const token = locationDef(s).finaleToken;
    if (s.killer.finaleRevealed && token) {
      log(s, `Ficha de Final de ${locationDef(s).name}: ${token.text}`, 'killer');
      pushEffects(s, token.effects, { kind: 'finale' });
    }
    if (!s.killer.finaleRevealed) {
      const id = s.horrorDeck.shift();
      if (id) {
        s.infoSeq++;
        push(s, { t: 'horror', cardId: id });
      }
    }
    return 'continue';
  }
  return goTo(s, task, 'panic');
}

export function stepHorror(s: GameState, task: T<'horror'>): 'done' {
  const card = horrorDef(s, task.cardId);
  log(s, `Carta de Horror: ${card.name}.`, 'killer', undefined, { kind: 'horror', id: card.id });
  if (card.requiresVictims && !s.victims.length) {
    log(s, 'No hay Víctimas en el tablero: se descarta y se roba la siguiente.');
    s.horrorDiscard.push(card.id);
    const next = s.horrorDeck.shift();
    if (next) {
      s.infoSeq++;
      push(s, { t: 'horror', cardId: next });
    }
    return 'done';
  }
  if (card.minorDarkPower) {
    s.killer.minors.push({ id: card.id, hp: card.minorDarkPower.health });
    log(s, `Poder Oscuro Menor en juego (${card.minorDarkPower.health} Vidas). ${card.text}`, 'killer');
    return 'done';
  }
  if (card.stays) {
    s.activeHorror.push(card.id);
    log(s, `La carta se queda en juego. ${card.text}`, 'killer');
    pushEffects(s, card.effects, { kind: 'horror', id: card.id });
    return 'done';
  }
  s.horrorDiscard.push(card.id);
  pushEffects(s, card.effects, { kind: 'horror', id: card.id });
  return 'done';
}

// ---------------------------------------------------------------- Eventos

export function stepEvent(s: GameState, task: T<'event'>): 'done' {
  const ev = eventDef(s, task.cardId);
  log(s, `Evento: ${ev.name}. ${ev.text}`, 'phase', undefined, { kind: 'event', id: ev.id });
  if (ev.specialVictim && !s.victims.length) {
    log(s, 'No hay Víctimas en el tablero: el Evento se ignora.');
    s.eventDiscard.push(ev.id);
    return 'done';
  }
  if (ev.persistent) s.activeEvents.push(ev.id);
  else s.eventDiscard.push(ev.id);
  pushEffects(s, ev.onReveal, { kind: 'event', id: ev.id });
  switch (ev.custom) {
    case 'ev-boyfriend':
    case 'ev-girlfriend':
      assignRole(s, ev.custom === 'ev-boyfriend' ? 'novio' : 'novia', s.fg.zone, false);
      break;
    case 'ev-revenge':
      assignRole(s, 'maldita', s.killer.zone, true);
      break;
    case 'ev-super-tourist':
      assignRole(s, 'super', s.killer.zone, true);
      break;
    case 'ev-holy-man':
      assignRole(s, 'hombre', s.killer.zone, true);
      break;
    case 'ev-tour-guide':
      assignRole(s, 'guia', s.fg.zone, false);
      break;
    case 'ev-fire-brimstone':
    case 'ev-sacred-ground':
    case 'ev-closed':
      groovesEventRevealed(s, ev.custom, ev.id);
      break;
    case 'ev-dark-waters':
      s.tokens.push({ id: 'aguas-oscuras', zone: 'lago' });
      applyDarkWaters(s);
      break;
    case 'ev-secret-tunnel':
      push(s, choice('Túnel secreto: ¿qué dos zonas conecta?', [
        { id: 'cobertizo,cabanas', label: 'Cobertizo de servicios y Cabañas' },
        { id: 'cobertizo,muelle', label: 'Cobertizo de servicios y Muelle' },
        { id: 'cabanas,muelle', label: 'Cabañas y Muelle' },
      ], { kind: 'custom', id: 'secret-tunnel' }));
      break;
  }
  return 'done';
}

const ROLE_COLOR = { novio: 'blue', novia: 'white', maldita: 'orange', super: 'white', hombre: 'blue', guia: 'green' } as const;
const ROLE_NAME = { novio: 'el Novio', novia: 'la Novia', maldita: 'la Maldita', super: 'el Super Turista', hombre: 'el Hombre Sagrado', guia: 'el Guía Turístico' } as const;
type Role = keyof typeof ROLE_COLOR;

function assignRole(s: GameState, role: Role, from: ZoneId, farthest: boolean): void {
  const dist = distances(s, from, farthest ? 'enemy' : 'fg');
  const ds = s.victims.map((v) => dist.get(v.zone) ?? Infinity);
  const best = farthest ? Math.max(...ds) : Math.min(...ds);
  const zones = [...new Set(s.victims.filter((_, i) => ds[i] === best).map((v) => v.zone))];
  if (zones.length > 1) {
    push(s, choice(`Empate: ¿qué Víctima pasa a ser ${ROLE_NAME[role]}?`, zones.map((z) => ({ id: z, label: zoneName(s, z) })), { kind: 'custom', id: 'assign-role', data: { role } }));
    return;
  }
  setRole(s, role, zones[0]!);
}

function setRole(s: GameState, role: Role, zone: ZoneId): void {
  const v = s.victims.find((x) => x.zone === zone && !x.role);
  if (!v) return;
  v.role = role;
  v.special = ROLE_COLOR[role];
  log(s, `Una Víctima de ${zoneName(s, zone)} pasa a ser ${ROLE_NAME[role]}.`);
}

registerChoice('assign-role', (s, option, data) => setRole(s, data.role as Role, option));
registerChoice('secret-tunnel', (s, option) => {
  s.tunnel = option.split(',');
  for (const z of s.tunnel) s.tokens.push({ id: 'tunel-secreto', zone: z });
  log(s, `El túnel secreto conecta ${s.tunnel.map((z) => zoneName(s, z)).join(' y ')}.`);
});

// ---------------------------------------------------------------- Huida y Mantenimiento

function stepPanic(s: GameState, task: T<'phase'>): 'done' {
  if (s.mods.killedThisTurn > 0) {
    const fleeing = s.victims.filter((v) => v.zone === s.killer.zone);
    if (fleeing.length) log(s, 'Ha muerto alguien este turno: las Víctimas de la zona del Asesino huyen.');
    panicVictims(s, fleeing);
  }
  return goTo(s, task, 'upkeep');
}

function stepUpkeep(s: GameState, task: T<'phase'>): 'done' | 'continue' | 'wait' {
  if (task.step === 0) {
    task.step = 1;
    if (!s.horrorDeck.length && !s.killer.finaleRevealed) revealFinale(s);
    return 'continue';
  }
  if (task.step === 1) {
    task.step = 2;
    if (has(s, 'ev-death-wish')) deathWish(s);
    return 'continue';
  }
  if (task.step === 2) {
    task.step = 3;
    holyManUpkeep(s);
    return 'continue';
  }
  if (task.step === 3) {
    task.step = 4;
    upkeepRoll(s, 'boiling');
    return 'continue';
  }
  if (task.step === 4) {
    task.step = 5;
    push(s, { t: 'arrange', optional: true });
    return 'continue';
  }
  if (task.step === 5) {
    // Al final de la fase de Mantenimiento.
    task.step = 6;
    upkeepRoll(s, 'fickle');
    return 'continue';
  }
  if (task.step === 6) {
    // Después de la fase de Mantenimiento.
    task.step = 7;
    upkeepRoll(s, 'volatile');
    return 'continue';
  }
  s.turn++;
  s.mods.killedThisTurn = 0;
  s.mods.usedThisTurn = [];
  return goTo(s, task, 'action');
}

export function revealFinale(s: GameState): void {
  const k = killerDef(s);
  const finale = k.finales.find((f) => f.id === s.killer.finale)!;
  s.killer.finaleRevealed = true;
  s.infoSeq++;
  log(s, `¡GRAN FINAL! ${finale.name}.${finale.text ? ` ${finale.text}` : ''}`, 'killer', undefined, { kind: 'finale', id: finale.id });
  revealDarkPowers(s);
  if (finale.custom === 'finale-miracle') miracleFinale(s);
  if (finale.custom === 'finale-second-dark-power') {
    const pool = k.darkPowers.filter((d) => !d.epic && !s.killer.darkPowers.some((x) => x.id === d.id));
    if (pool.length) {
      const extra = pick(s.rng, pool);
      s.killer.darkPowers.push({ id: extra.id, revealed: true });
      log(s, `Segundo Poder Oscuro: ${extra.name}. ${extra.text}`, 'killer', undefined, { kind: 'darkPower', id: extra.id });
    }
  }
}

/** Deseo mortal: la Víctima más cercana al Asesino (fuera de su zona) se acerca 1 zona. */
function deathWish(s: GameState): void {
  const dist = distances(s, s.killer.zone, 'enemy');
  const pool = s.victims.filter((v) => v.zone !== s.killer.zone);
  if (!pool.length) return;
  const best = Math.min(...pool.map((v) => dist.get(v.zone) ?? Infinity));
  const zones = [...new Set(pool.filter((v) => dist.get(v.zone) === best).map((v) => v.zone))];
  const options: { id: string; label: string }[] = [];
  for (const z of zones) {
    for (const next of new Set(shortestPaths(s, z, s.killer.zone, 'victim').map((p) => p[0]!))) {
      options.push({ id: `${z}>${next}`, label: `De ${zoneName(s, z)} a ${zoneName(s, next)}` });
    }
  }
  if (options.length === 1) return applyDeathWish(s, options[0]!.id);
  push(s, choice('Deseo mortal: empate, ¿qué Víctima se acerca al Asesino?', options, { kind: 'custom', id: 'death-wish' }));
}

function applyDeathWish(s: GameState, option: string): void {
  const [from, to] = option.split('>') as [ZoneId, ZoneId];
  const v = s.victims.find((x) => x.zone === from);
  if (!v) return;
  log(s, `Deseo mortal: una Víctima se acerca al Asesino (${zoneName(s, from)} → ${zoneName(s, to)}).`, 'killer', { kind: 'victimMove', victim: v.id, path: [from, to] });
  moveVictim(s, v, to);
}

registerChoice('death-wish', (s, option) => applyDeathWish(s, option));

export { fgDef };
