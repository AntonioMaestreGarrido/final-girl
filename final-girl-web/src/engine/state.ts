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
  /** Terror from Above: Víctimas Especiales a salvar (1 Fácil, 2 Normal, 3 Difícil). */
  birdsSpecials?: 1 | 2 | 3;
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
  /** Víctima Especial de Terror from Above: nunca puede ser atacada ni asesinada; hay que salvarlas a todas. */
  bsp?: true;
}

/** Estado propio de Terror from Above. */
export interface BirdsState {
  /** Víctimas Especiales que aún no han salido de su escondite. */
  hidden: number;
  /** Víctimas Especiales en total (las que hay que salvar para ganar) y las ya salvadas. */
  total: number;
  saved: number;
  /** Pájaros generados en la última tirada de Generar Pájaros. */
  lastSpawned: number;
  /** Ataques de Pájaros que se han producido en el efecto en curso. */
  lastAttacks: number;
  /** Fichas de pájaro sobre la carta Muro de aves. */
  wall: number;
}

export type VictimRole = 'novio-ml' | 'smalley' | 'cazador' | 'novio' | 'novia' | 'maldita' | 'super' | 'hombre' | 'guia' | 'prometido' | 'hermana' | 'lobo';

/** Esbirro en el tablero (Marioneta). */
export interface Minion {
  id: string;
  zone: ZoneId;
  hp: number;
  /** Ya recibió daño este turno (Abominación masiva ignora el primero). */
  hit?: boolean;
}

/** Estado propio de The Haunting of Creech Manor. */
export interface CreechState {
  /** Candado: unión bloqueada para Enemigos y Víctimas que no te acompañan. */
  lock: [ZoneId, ZoneId] | null;
  /** Los movimientos de la próxima / actual fase de Acción tienen pánico. */
  panicNext: boolean;
  panicNow: boolean;
  /** No puedes moverte ('inside') o entrar en la casa ('outside'): próxima / actual fase de Acción. */
  lockNext: 'inside' | 'outside' | null;
  lockNow: 'inside' | 'outside' | null;
  /** El Helicóptero ya se usó. */
  heliUsed: boolean;
  /** Alice: tipo de carta de Acción con el que siempre tira 5 dados. */
  fiveDice: CardId | null;
  /** Alguna Víctima Especial (Cazadores de fantasmas) ya ha muerto: las demás te siguen. */
  hunterDied: boolean;
  /** Carolyn ya se ha unido a la Chica Final alguna vez. */
  carolynFound: boolean;
  /** Una carta permite jugar cartas de Acción que hagan daño ahora mismo. */
  strike: 'enemy' | 'victims' | null;
  /** Confusión psíquica: ya se pagó el Tiempo para ignorar la penalización de la próxima carta de Buscar. */
  psychicPaid: boolean;
}

/** Estado propio de Frightmare on Maple Lane (Dr. Fright / Maple Lane). */
export interface MapleState {
  /** Estás Dormida en la Sala de Calderas. */
  asleep: boolean;
  /**
   * Sala de Calderas: cartas aún por revelar y las ya colocadas. Posiciones en medias cartas desde la carta
   * de Despierto/Dormido ('dd'), que cubre el mazo.
   */
  br: { deck: string[]; placed: { id: string; x: number; y: number }[] };
  /** Realidad borrosa: puedes dañar al Dr. Fright (y él a ti) aunque estés Despierta, hasta la próxima fase de Terror. */
  blurred: boolean;
  /** Marcado para la muerte: las Víctimas de tu espacio entran en pánico hasta la próxima fase de Terror. */
  marked: boolean;
  /** No puedes entrar en Casas ocupadas (siguiente / actual fase de Acción). */
  lockNext: boolean;
  lockNow: boolean;
  /** −1 dado en las Tiradas de Horror (siguiente / actual fase de Acción). */
  dimNext: boolean;
  dimNow: boolean;
  /** Cartas adicionales de la Sala de Calderas al final de la próxima fase del Asesino. */
  extraBR: number;
  /** Marca para comparar (muertes, daño recibido) dentro de una carta. */
  mark: number;
  /** El Dr. Fright atacó a la Chica Final durante la carta en curso. */
  attackedFG: boolean;
  /** Factor sorpresa: Víctimas muertas por pánico este turno. */
  surprise: number;
  /** Fichas negras de Vida Final en la reserva general (valores al dorso). */
  reserve: number[];
  /** Nunca realmente muerto ya se ha usado. */
  revived: boolean;
  /** Deben morir todos: el Dr. Fright está sobre su carta (siempre "en tu espacio" para atacarlo). */
  offBoard: boolean;
  /** Salida a la que se dirige el Coche de Policía. */
  policeTo: ZoneId | null;
}

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
  /** Trampa para osos de acero en la pierna (no puedes moverte hasta gastar 2 Tiempo). */
  legTrap?: boolean;
  /** Cobra oculta junto a tu carta: pierdes 1 Vida cada Mantenimiento hasta que recuperes salud. */
  cobra?: boolean;
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
    /** Recorrido del Asesino (o del Esbirro / Víctima-Marioneta que actúa, si se indica). Con un solo espacio: aparece ahí. */
    | { kind: 'killerMove'; path: ZoneId[]; minion?: string; victim?: string }
    /** `victims`: las Víctimas que la acompañan en el movimiento. */
    | { kind: 'fgMove'; path: ZoneId[]; victims?: string[] }
    | { kind: 'victimMove'; victim: string; path: ZoneId[]; victims?: string[] }
    | { kind: 'victimDie'; zone: ZoneId };
  tone?: 'info' | 'good' | 'bad' | 'killer' | 'phase';
  /** Carta que se revela con esta entrada (la UI la muestra girándose en el centro). */
  card?: { kind: 'horror' | 'event' | 'finale' | 'darkPower' | 'item'; id: CardId };
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
  /** Enemigo que debe recibir el daño (Contraataque contra quien te atacó). */
  target?: string;
}

// ---------------------------------------------------------------- Tareas

export type Task =
  | { t: 'phase'; phase: Phase; step: number }
  | { t: 'effects'; effects: Effect[]; i: number; src: EffectSource }
  | { t: 'playAction'; cardId: CardId; weaponUid?: string; step: 'roll' | 'resolve'; successes?: number; prayed?: boolean }
  | { t: 'roll'; purpose: RollPurpose; dice: number[]; converted: number[]; auto34: boolean; successes?: number }
  | { t: 'fgMove'; remaining: number; src: EffectSource; mode: 'walk' | 'boat' | 'free' | 'convince'; moved?: number }
  | { t: 'rescue' }
  | { t: 'killerAction'; action: KillerAction; src: EffectSource; step: 'target' | 'path' | 'move' | 'spray' | 'attack' | 'obsession' | 'done'; target?: Target; killed: number; attackedFG: boolean; attacksLeft?: number; path?: ZoneId[]; actor?: string; moved?: boolean; stopChecked?: boolean }
  | { t: 'attackFG'; damage: number; reduce: number; ignore: boolean; resolved?: boolean; by?: string; victim?: string }
  | { t: 'reaction'; cardId: CardId; attack: number; rolled?: boolean; successes?: number }
  | { t: 'search'; zone: ZoneId; drawn: DeckCard[]; draw: 1 | 2; zappo?: boolean }
  | { t: 'gainItem'; uid: string }
  | { t: 'arrange'; optional: boolean }
  | { t: 'horror'; cardId: CardId; asked?: boolean }
  /** Una Chica Final puede jugar cartas de Acción que hagan daño fuera de su fase (Gigante, Muñeco Payaso, «¡Tengo que matarte!»). */
  | { t: 'strike'; mode: 'enemy' | 'victims'; left: number }
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
  | { type: 'main'; strike?: 'enemy' | 'victims'; playable: { cardId: CardId; weapons: string[] }[]; itemActions: { uid: string; action: string; label: string }[]; ultimate: boolean; ultimateLabel?: string; canRescue: boolean }
  | { type: 'roll'; purpose: RollPurpose; dice: number[]; converted: number[]; auto34: boolean; canCloseCall: boolean; canLuckyDice: boolean; canSister?: boolean }
  | { type: 'choice'; title: string; options: Option[] }
  | { type: 'move'; remaining: number; to: ZoneId[]; followers: string[]; followLimit: number; mode: 'walk' | 'boat' | 'free' | 'convince' }
  | { type: 'rescue'; victims: string[]; slots: number[]; ultimate: boolean }
  | { type: 'react'; damage: number; cards: CardId[]; lid: string | null; spray: string | null; trident?: string | null }
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
  | { type: 'sisterReroll'; die: number }
  | { type: 'confirmRoll' }
  // genéricas
  | { type: 'choose'; option: string }
  | { type: 'moveTo'; zone: ZoneId; bring: string[] }
  | { type: 'stopMoving' }
  | { type: 'rescueOne'; victimId: string; slot: number }
  | { type: 'rescueDone' }
  | { type: 'react'; cardId: CardId }
  | { type: 'useLid' }
  | { type: 'useTrident' }
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
  /** Esbirros en el tablero y fichas en las casillas Listo / Agotado de su carta. */
  minions: Minion[];
  minionPool: { ready: string[]; exhausted: string[] };
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
  creech?: CreechState;
  maple?: MapleState;
  birds?: BirdsState;
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
