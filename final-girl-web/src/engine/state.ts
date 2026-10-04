import type { CardId, DieFace, Effect, KillerAction, VictimColor, WrathId, ZoneId } from '../content/types';
import type { RngState } from './rng';

export type Phase = 'setup' | 'action' | 'planning' | 'killer' | 'panic' | 'upkeep';

export interface GameConfig {
  killerId: string;
  locationId: string;
  finalGirlId: string;
  board: 'normal' | 'extreme';
  /** Usar el Poder Oscuro Épico del Asesino. */
  epicDarkPower: boolean;
  /** Barajar el objeto bonus de la Chica Final en el mazo de Objetos. */
  bonusItems: boolean;
  seed: number;
  /** Para pruebas: fija la carta de Preparación en lugar de robarla al azar. */
  setupId?: string;
}

/**
 * Vida = marcadores normales + 1 por la ficha de Vida Final.
 * Al bajar a 0 se revela la ficha: si es negra con vidas, resucita con ellas (ficha blanca).
 */
export interface Health {
  hp: number;
  max: number;
  token: 'black' | 'white';
  /** Vidas al dorso de la ficha negra (oculto hasta revelarse). */
  hidden: number;
}

export interface Victim {
  id: string;
  zone: ZoneId;
  special?: VictimColor;
  /** Papel que le da un Evento. */
  role?: VictimRole;
}

export type VictimRole = 'novio' | 'novia' | 'maldita' | 'super' | 'hombre' | 'guia';

export interface ItemInst {
  uid: string;
  id: CardId;
  inHands: boolean;
  uses?: number;
}

export interface DeckCard {
  id: CardId;
  faceUp: boolean;
}

export interface Token {
  id: string;
  zone: ZoneId;
}

export interface FinalGirlState {
  id: string;
  zone: ZoneId;
  startZone: ZoneId;
  health: Health;
  time: number;
  /** Índice en el medidor de Terror (0 = verde, 7 = rojo). */
  terror: number;
  hand: CardId[];
  items: ItemInst[];
  /** Espacios de Víctima Salvada ocupados. */
  rescueSlots: boolean[];
  ultimate: boolean;
  saved: number;
}

export interface KillerState {
  id: string;
  zone: ZoneId;
  startZone: ZoneId;
  health: Health;
  bloodlust: number;
  finale: CardId;
  finaleRevealed: boolean;
  darkPowers: { id: CardId; revealed: boolean }[];
  /** Poderes Oscuros Menores en juego con sus Vidas. */
  minors: { id: CardId; hp: number }[];
}

export interface Mods {
  bonusDiceNextRoll: number;
  partialsNextRoll: boolean;
  partialsThisPhase: boolean;
  killedThisTurn: number;
  killedThisKillerPhase: number;
  rescuedThisActionPhase: number;
  /** Habilidades "una vez por fase de Acción" ya usadas. */
  usedThisPhase: string[];
  skipNextActionPhase: boolean;
  /** Tiempo con el que empieza la próxima fase de Acción (Novio). */
  timeAtNextAction: number | null;
  /** El Tiempo bajó de cero: la fase de Acción termina al acabar la acción en curso. */
  actionPhaseEnding: boolean;
  /** Habilidades "una vez por turno" ya usadas. */
  usedThisTurn: string[];
  /** Daño total recibido por la Chica Final (para "tanto como el daño infligido"). */
  damageTaken: number;
  damageMark: number;
}

export interface LogEntry {
  turn: number;
  phase: Phase;
  text: string;
  /** Datos para animar (dados, recorridos...). */
  anim?:
    | { kind: 'dice'; faces: number[] }
    | { kind: 'killerMove'; path: ZoneId[] }
    | { kind: 'fgMove'; path: ZoneId[] }
    | { kind: 'victimMove'; victim: string; path: ZoneId[] };
  tone?: 'info' | 'good' | 'bad' | 'killer' | 'phase';
}

// ---------------------------------------------------------------- Contexto de efectos

/** Origen de una secuencia de efectos (para modificar daño, curación, registro...). */
export interface EffectSource {
  kind: 'action' | 'horror' | 'event' | 'finale' | 'killer' | 'rescue' | 'item' | 'bloodlust' | 'system';
  id?: CardId;
  /** Arma elegida para modificar el daño de una carta de Acción. */
  weaponUid?: string;
  /** Ya se aplicaron los modificadores de daño de esta resolución. */
  damageBonusApplied?: boolean;
  /** Ya se aplicó el Kit de primeros auxilios en esta resolución. */
  healBonusApplied?: boolean;
}

// ---------------------------------------------------------------- Tareas

export type Task =
  | { t: 'phase'; phase: Phase; step: number }
  | { t: 'effects'; effects: Effect[]; i: number; src: EffectSource }
  | { t: 'playAction'; cardId: CardId; weaponUid?: string; step: 'roll' | 'resolve'; successes?: number; prayed?: boolean }
  | { t: 'roll'; purpose: RollPurpose; dice: number[]; converted: number[]; auto34: boolean; successes?: number }
  | { t: 'fgMove'; remaining: number; src: EffectSource; mode: 'walk' | 'boat' | 'free'; moved?: number }
  | { t: 'rescue' }
  | { t: 'killerAction'; action: KillerAction; src: EffectSource; step: 'target' | 'path' | 'move' | 'spray' | 'attack' | 'obsession' | 'done'; target?: Target; killed: number; attackedFG: boolean; attacksLeft?: number; path?: ZoneId[] }
  | { t: 'attackFG'; damage: number; reduce: number; ignore: boolean; resolved?: boolean }
  | { t: 'reaction'; cardId: CardId; attack: number; rolled?: boolean; successes?: number }
  | { t: 'search'; zone: ZoneId; drawn: DeckCard[]; draw: 1 | 2 }
  | { t: 'gainItem'; uid: string }
  | { t: 'arrange'; optional: boolean }
  | { t: 'horror'; cardId: CardId }
  | { t: 'event'; cardId: CardId }
  | { t: 'choice'; title: string; options: { id: string; label: string }[]; then: ChoiceHandler }
  | { t: 'discardDown' }
  | { t: 'custom'; id: string; data: Record<string, unknown> };

export type RollPurpose =
  | { kind: 'action'; cardId: CardId; weaponUid?: string }
  | { kind: 'reaction'; cardId: CardId }
  | { kind: 'item'; id: CardId }
  /** Tirada de Terror pedida por una carta del Asesino, Lugar o Poder (se resuelve con su id). */
  | { kind: 'effect'; id: string; label: string };

/** Qué hace una `choice` con la opción elegida (serializable). */
export type ChoiceHandler =
  | { kind: 'effects'; options: Record<string, Effect[]>; src: EffectSource }
  | { kind: 'custom'; id: string; data?: Record<string, unknown> };

export type Target =
  | { kind: 'zone'; zone: ZoneId; who: 'victim' | 'finalGirl' | 'group' | 'token' }
  | { kind: 'none' };

// ---------------------------------------------------------------- Preguntas al jugador

export interface Option {
  id: string;
  label: string;
  disabled?: string;
}

export type Prompt =
  | { type: 'main'; playable: { cardId: CardId; weapons: string[] }[]; itemActions: { uid: string; action: string; label: string }[]; ultimate: boolean; canRescue: boolean }
  | { type: 'roll'; purpose: RollPurpose; dice: number[]; converted: number[]; auto34: boolean; canCloseCall: boolean; canLuckyDice: boolean }
  | { type: 'choice'; title: string; options: Option[] }
  | { type: 'move'; remaining: number; to: ZoneId[]; followers: string[]; followLimit: number; mode: 'walk' | 'boat' | 'free' }
  | { type: 'rescue'; victims: string[]; slots: number[]; ultimate: boolean }
  | { type: 'react'; damage: number; cards: CardId[]; lid: string | null; spray: string | null }
  | { type: 'search'; drawn: CardId[] }
  | { type: 'arrange'; optional: boolean }
  | { type: 'planning'; buyable: CardId[] }
  | { type: 'discardDown'; excess: number };

export type Input =
  // fase de Acción
  | { type: 'playCard'; cardId: CardId; weaponUid?: string }
  | { type: 'discardForTime'; cardIds: CardId[] }
  | { type: 'useItem'; uid: string; action: string }
  | { type: 'ultimate' }
  | { type: 'startRescue' }
  | { type: 'endActionPhase' }
  // tiradas
  | { type: 'convertPartial'; die: number; discard: [CardId, CardId] }
  | { type: 'closeCall'; die?: number }
  | { type: 'luckyDice'; dice: number[] }
  | { type: 'confirmRoll' }
  // genéricas
  | { type: 'choose'; option: string }
  | { type: 'moveTo'; zone: ZoneId; bring: string[] }
  | { type: 'stopMoving' }
  | { type: 'rescueOne'; victimId: string; slot: number }
  | { type: 'rescueDone' }
  | { type: 'react'; cardId: CardId }
  | { type: 'useLid' }
  | { type: 'pepperSpray' }
  | { type: 'takeHit' }
  | { type: 'searchPick'; keep: number; otherTo: 'top' | 'bottom' }
  | { type: 'arrange'; inHands: string[] }
  | { type: 'buy'; cardId: CardId }
  | { type: 'endPlanning' }
  | { type: 'discardDown'; cardIds: CardId[] };

// ---------------------------------------------------------------- Estado completo

export interface GameState {
  version: 1;
  config: GameConfig;
  rng: RngState;
  turn: number;
  phase: Phase;
  fg: FinalGirlState;
  killer: KillerState;
  victims: Victim[];
  dead: Victim[];
  /** Víctimas retiradas del tablero sin morir ni salvarse (El hombre sagrado). */
  gone?: number;
  /** Víctimas amarillas que quedan en la caja. */
  victimPool: number;
  horrorDeck: CardId[];
  horrorDiscard: CardId[];
  eventDeck: CardId[];
  activeEvents: CardId[];
  eventDiscard: CardId[];
  itemDecks: Record<ZoneId, DeckCard[]>;
  itemDiscard: CardId[];
  actionTable: Record<CardId, number>;
  /** Cartas de Acción jugadas o descartadas desde la última fase de Planificación. */
  actionDiscard: CardId[];
  tokens: Token[];
  tunnel: ZoneId[];
  /** Niveles de Ira en juego (1-10). */
  wrath: Partial<Record<WrathId, number>>;
  /** Cartas de Horror que se quedan en juego (La volubilidad de los dioses). */
  activeHorror: CardId[];
  /** Uniones bloqueadas para las Víctimas (Señales de fuera de servicio). */
  blocked: [ZoneId, ZoneId][];
  setupCard: CardId;
  mods: Mods;
  stack: Task[];
  prompt: Prompt | null;
  log: LogEntry[];
  outcome: null | { winner: 'finalGirl' | 'killer'; text: string };
  nextUid: number;
  /** Se incrementa cada vez que se revela información oculta (robos, fichas...). */
  infoSeq: number;
}

export type { DieFace };
