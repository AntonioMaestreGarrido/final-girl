import { ACTION_CARDS, BONUS_ITEMS, FINAL_GIRLS, FINAL_LIFE_TOKENS, HORROR_DECK_SIZE, ITEM_DECK_SIZE, KILLERS, LOCATIONS, PLAYER_BOARDS, VICTIM_POOL } from '../content';
import { applyEffect } from './effects';
import { inputAttackFG, stepAttackFG, stepKillerAction } from './killer';
import { log, RuleError } from './core';
import { inputPlanning, stepEvent, stepHorror, stepPhase } from './phases';
import {
  inputArrange,
  inputDiscardDown,
  inputFgMove,
  inputMain,
  inputRescue,
  inputRoll,
  inputSearch,
  stepArrange,
  stepDiscardDown,
  stepFgMove,
  stepPlayAction,
  stepReaction,
  stepRescue,
  stepRoll,
  stepSearch,
} from './player';
import { resolveChoice } from './effects';
import { createRng, pick, shuffle } from './rng';
import type { GameConfig, GameState, Input, Task } from './state';

export * from './state';
export { RuleError, killerRow, terrorLabel } from './core';
export { actionDef, boardDef, eventDef, fgDef, horrorDef, itemDef, killerDef, locationDef, zoneDef, zoneName } from './lookup';

// ---------------------------------------------------------------- preparación

export function createGame(config: GameConfig): GameState {
  const killer = KILLERS.find((k) => k.id === config.killerId);
  const location = LOCATIONS.find((l) => l.id === config.locationId);
  const fg = FINAL_GIRLS.find((f) => f.id === config.finalGirlId);
  if (!killer || !location || !fg) throw new RuleError('Configuración de partida no válida');
  const board = PLAYER_BOARDS[config.board];
  const rng = createRng(config.seed);

  // Cartas de Acción: las de Coste Cero a la mano, el resto a la Tabla.
  const hand: string[] = [];
  const actionTable: Record<string, number> = {};
  for (const c of ACTION_CARDS) {
    if (c.onlyWith && !c.onlyWith.includes(killer.id) && !c.onlyWith.includes(location.id)) continue;
    if (c.cost === 0) for (let i = 0; i < c.copies; i++) hand.push(c.id);
    else actionTable[c.id] = c.copies;
  }

  // Gran Final y Poder Oscuro.
  const finale = pick(rng, killer.finales).id;
  const normalPowers = killer.darkPowers.filter((d) => !d.epic);
  const epic = killer.darkPowers.find((d) => d.epic);
  const darkPower = config.epicDarkPower && epic ? epic : pick(rng, normalPowers);

  // Mazo de Horror: Asesino + Lugar barajados, se usan 10.
  const horrorPool = [...killer.horror, ...location.horror].flatMap((h) => Array<string>(h.copies).fill(h.id));
  const horrorDeck = shuffle(rng, horrorPool).slice(0, HORROR_DECK_SIZE);

  // Objetos: tres montones de cuatro con la carta superior bocarriba.
  const bonus = config.bonusItems ? BONUS_ITEMS.filter((b) => b.onlyFor === fg.id).map((b) => b.id) : [];
  const items = shuffle(rng, [...location.items.map((i) => i.id), ...bonus]);
  const itemDecks: GameState['itemDecks'] = {};
  location.itemDecks.forEach((zone, n) => {
    itemDecks[zone] = items.slice(n * ITEM_DECK_SIZE, (n + 1) * ITEM_DECK_SIZE).map((id, i) => ({ id, faceUp: i === 0 }));
  });

  // Carta de Preparación.
  const setup = config.setupId ? location.setups.find((x) => x.id === config.setupId)! : pick(rng, location.setups);

  // Fichas de Vida Final (sin mirarlas).
  const tokens = shuffle(rng, FINAL_LIFE_TOKENS);

  let nextUid = 1;
  const victims = Object.entries(setup.victims).flatMap(([zone, n]) => Array.from({ length: n }, () => ({ id: `v${nextUid++}`, zone })));

  const s: GameState = {
    version: 1,
    config,
    rng,
    turn: 1,
    phase: 'setup',
    fg: {
      id: fg.id,
      zone: setup.finalGirl,
      startZone: setup.finalGirl,
      health: { hp: fg.health, max: fg.health, token: 'black', hidden: tokens[1]! },
      time: board.startTime,
      terror: board.terrorTrack.findIndex((p) => p.label === killer.startTerror),
      hand,
      items: [],
      rescueSlots: fg.rescueSlots.map(() => false),
      ultimate: false,
      saved: 0,
    },
    killer: {
      id: killer.id,
      zone: setup.killer,
      startZone: setup.killer,
      health: { hp: killer.health, max: killer.health, token: 'black', hidden: tokens[0]! },
      bloodlust: 0,
      finale,
      finaleRevealed: false,
      darkPowers: [{ id: darkPower.id, revealed: false }],
      minors: [],
    },
    victims,
    dead: [],
    victimPool: VICTIM_POOL - victims.length,
    horrorDeck,
    horrorDiscard: [],
    eventDeck: shuffle(rng, location.events.map((e) => e.id)),
    activeEvents: [],
    eventDiscard: [],
    itemDecks,
    itemDiscard: [],
    actionTable,
    actionDiscard: [],
    tokens: [],
    tunnel: [],
    wrath: {
      ...(killer.wrath ? { killer: killer.wrath.start } : {}),
      ...(location.wrath ? { divine: location.wrath.start } : {}),
    },
    activeHorror: [],
    blocked: [],
    setupCard: setup.id,
    mods: {
      bonusDiceNextRoll: 0,
      partialsNextRoll: false,
      partialsThisPhase: false,
      killedThisTurn: 0,
      killedThisKillerPhase: 0,
      rescuedThisActionPhase: 0,
      usedThisPhase: [],
      skipNextActionPhase: false,
      timeAtNextAction: null,
      actionPhaseEnding: false,
      usedThisTurn: [],
      damageTaken: 0,
      damageMark: 0,
    },
    stack: [],
    prompt: null,
    log: [],
    outcome: null,
    nextUid,
    infoSeq: 0,
  };

  log(s, `${fg.name} contra ${killer.name} en ${location.name}. Preparación: ${setup.name}.`, 'phase');
  if (config.board === 'extreme') log(s, 'Modo Terror Extremo.', 'phase');
  // Se roba el primer Evento y empieza el turno 1.
  const firstEvent = s.eventDeck.shift()!;
  s.stack = [{ t: 'phase', phase: 'action', step: 0 }, { t: 'event', cardId: firstEvent }];
  run(s);
  return s;
}

// ---------------------------------------------------------------- bucle

type StepResult = 'done' | 'continue' | 'wait';

function step(s: GameState, task: Task): StepResult {
  switch (task.t) {
    case 'phase':
      return stepPhase(s, task);
    case 'effects': {
      const e = task.effects[task.i];
      if (!e) return 'done';
      task.i++;
      applyEffect(s, e, task.src);
      return 'continue';
    }
    case 'playAction':
      return stepPlayAction(s, task);
    case 'roll':
      return stepRoll(s, task);
    case 'fgMove':
      return stepFgMove(s, task);
    case 'rescue':
      return stepRescue(s);
    case 'killerAction':
      return stepKillerAction(s, task);
    case 'attackFG':
      return stepAttackFG(s, task);
    case 'reaction':
      return stepReaction(s, task);
    case 'search':
      return stepSearch(s, task);
    case 'arrange':
      return stepArrange(s, task);
    case 'horror':
      return stepHorror(s, task);
    case 'event':
      return stepEvent(s, task);
    case 'choice':
      s.prompt = { type: 'choice', title: task.title, options: task.options };
      return 'wait';
    case 'discardDown':
      return stepDiscardDown(s);
    case 'gainItem':
    case 'custom':
      throw new RuleError(`Tarea no soportada: ${task.t}`);
  }
}

function removeTask(s: GameState, task: Task): void {
  const i = s.stack.lastIndexOf(task);
  if (i >= 0) s.stack.splice(i, 1);
}

/** Avanza el motor hasta que necesite una decisión del jugador o termine la partida. */
export function run(s: GameState): void {
  for (let guard = 0; guard < 100_000; guard++) {
    if (s.outcome) {
      s.prompt = null;
      return;
    }
    s.prompt = null;
    const task = s.stack[s.stack.length - 1];
    if (!task) return;
    const r = step(s, task);
    if (r === 'wait') return;
    if (r === 'done') removeTask(s, task);
  }
  throw new Error('El motor no avanza (bucle infinito)');
}

function handleInput(s: GameState, task: Task, input: Input): 'done' | 'continue' {
  switch (task.t) {
    case 'phase':
      if (task.phase === 'action') return inputMain(s, input);
      if (task.phase === 'planning') return inputPlanning(s, task, input);
      break;
    case 'roll':
      return inputRoll(s, task, input);
    case 'fgMove':
      return inputFgMove(s, task, input);
    case 'rescue':
      return inputRescue(s, input);
    case 'attackFG':
      return inputAttackFG(s, task, input);
    case 'search':
      return inputSearch(s, task, input);
    case 'arrange':
      return inputArrange(s, input);
    case 'discardDown':
      return inputDiscardDown(s, input);
    case 'choice': {
      if (input.type !== 'choose' || !task.options.some((o) => o.id === input.option)) throw new RuleError('Opción no válida');
      removeTask(s, task);
      resolveChoice(s, task.then, input.option);
      return 'continue';
    }
  }
  throw new RuleError('No se esperaba esa acción ahora');
}

/** Aplica una decisión del jugador y devuelve el nuevo estado (no modifica el original). */
export function dispatch(state: GameState, input: Input): GameState {
  if (state.outcome) throw new RuleError('La partida ha terminado');
  if (!state.prompt) throw new RuleError('El juego no está esperando ninguna decisión');
  const s = structuredClone(state);
  const task = s.stack[s.stack.length - 1]!;
  const r = handleInput(s, task, input);
  if (r === 'done') removeTask(s, task);
  run(s);
  return s;
}

// ---------------------------------------------------------------- partida con deshacer

export interface Game {
  state: GameState;
  /** Estados anteriores a los que se puede volver (sin cruzar tiradas ni robos). */
  history: GameState[];
}

export const newGame = (config: GameConfig): Game => ({ state: createGame(config), history: [] });

export function play(game: Game, input: Input): Game {
  const next = dispatch(game.state, input);
  const usedChance = next.rng.calls !== game.state.rng.calls || next.infoSeq !== game.state.infoSeq;
  return { state: next, history: usedChance ? [] : [...game.history, game.state].slice(-50) };
}

export const canUndo = (game: Game) => game.history.length > 0;

export function undo(game: Game): Game {
  const prev = game.history[game.history.length - 1];
  if (!prev) return game;
  return { state: prev, history: game.history.slice(0, -1) };
}

export const serialize = (game: Game): string => JSON.stringify({ state: game.state });

export function deserialize(json: string): Game {
  const data = JSON.parse(json) as { state: GameState };
  if (data.state?.version !== 1) throw new RuleError('Partida guardada no compatible');
  // Partidas guardadas antes de Slaughter in the Groves.
  const s = data.state;
  s.wrath ??= {};
  s.activeHorror ??= [];
  s.blocked ??= [];
  s.mods.usedThisTurn ??= [];
  s.mods.damageTaken ??= 0;
  s.mods.damageMark ??= 0;
  return { state: s, history: [] };
}
