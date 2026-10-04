/**
 * Modelo de contenido del juego.
 *
 * Todo lo que viene impreso en cartas y tableros se describe aquí como datos.
 * Los efectos comunes son `Effect` declarativos que el motor sabe resolver;
 * las reglas únicas de una carta concreta usan `{ kind: 'custom', id }` y se
 * implementan en el registro de habilidades del motor con ese mismo `id`.
 */

export type ZoneId = string;
export type CardId = string;

/** Tirada de dado de 1 a 6. */
export type DieFace = 1 | 2 | 3 | 4 | 5 | 6;

// ---------------------------------------------------------------- Efectos

/** A quién apunta una Acción del Asesino. */
export type KillerTarget =
  | 'victim' // la Víctima más cercana
  | 'finalGirl' // la Chica Final
  | 'nearest' // quien esté más cerca, Víctima o Chica Final
  | 'farthestVictim' // la Víctima más lejana
  | 'victimElseFG'; // la Víctima más cercana; si no hay Víctimas, la Chica Final

export interface KillerAction {
  target: KillerTarget;
  /** Número de iconos de movimiento (cada uno mueve tantas zonas como el Valor de Movimiento). */
  moves: number;
  /** Número de iconos de ataque. */
  attacks: number;
  /** Efectos que se aplican una vez por cada Víctima muerta durante esta acción. */
  perVictimKilled?: Effect[];
}

export type Effect =
  // Chica Final
  | { kind: 'time'; amount: number } // + gana, − pierde
  | { kind: 'terror'; amount: number } // + sube, − baja
  | { kind: 'heal'; amount: number }
  | { kind: 'loseHealth'; amount: number } // pérdida inevitable (no se puede reaccionar)
  | { kind: 'move'; upTo: number }
  | { kind: 'endActionPhase' }
  | { kind: 'damage'; amount: number } // daño de la Chica Final a un Enemigo
  | { kind: 'bonusDiceNextRoll'; amount: number }
  | { kind: 'partialsAreSuccesses'; scope: 'nextRoll' | 'actionPhase' }
  | { kind: 'search'; draw: 1 | 2 } // 2 = robar 2 y quedarse 1
  | { kind: 'drawItemAnyDeck' }
  | { kind: 'takeActionCard'; maxCost?: number; cardId?: CardId }
  // Reacciones (contra un ataque a la Chica Final)
  | { kind: 'ignoreAttack' }
  | { kind: 'reduceAttack'; amount: number; min?: number }
  // Asesino / mundo
  | { kind: 'bloodlust'; amount: number }
  | { kind: 'killerAction'; action: KillerAction }
  | { kind: 'killerHeal'; amount: number }
  | { kind: 'drawEvent' }
  | { kind: 'drawHorror' }
  | { kind: 'placeVictims'; count: number; where: VictimPlacement }
  | { kind: 'panic'; who: 'killerZone' | 'notFinalGirlZone'; times: number }
  | { kind: 'victimsStepToward'; toward: 'nearestEnemy' }
  // Ira (Slaughter in the Groves)
  | { kind: 'wrath'; which: WrathTarget; op: 'increase' | 'reduce' | 'halve' | 'set'; amount?: number; by?: WrathAmount }
  | { kind: 'unleash'; which: WrathId }
  | { kind: 'discardRandomActions'; count: number }
  // Estructura
  | { kind: 'choice'; options: Effect[][] }
  | { kind: 'custom'; id: string };

/** Medidores de Ira: la Ira Asesina (Inkanyamba) y la Ira Divina (Sacred Groves). */
export type WrathId = 'killer' | 'divine';
/** 'choose' = el jugador elige entre las Iras en juego. */
export type WrathTarget = WrathId | 'choose';
/** Cantidades variables para Aumentar la Ira. */
export type WrathAmount =
  | 'sacredVictims' // Víctimas en espacios Sagrados
  | 'bloodlustLevel' // nivel de Sed de Sangre (casilla inicial = 1)
  | 'handSize' // cartas de Acción en tu mano
  | 'fgHealth' // tu Vida actual
  | 'saved' // Víctimas salvadas
  | 'terrorLevel' // tu Nivel de Terror (verde 0 … roja 7)
  | 'killedThisTurn' // Víctimas asesinadas este turno
  | 'damageSinceMark' // daño recibido desde la marca 'mark-damage'
  | 'dieRoll'; // tira un dado

export interface WrathTrack {
  id: WrathId;
  name: string;
  image: string;
  back: string;
  /** Nivel inicial del marcador. */
  start: number;
  /** Efectos de Desatar por nivel: levels[0] = nivel 1 … levels[9] = nivel 10. */
  levels: { effects: Effect[]; text: string }[];
}

export type VictimPlacement =
  | { zone: ZoneId }
  | { at: 'killerStart' } // donde empezó el Asesino
  | { at: 'finalGirlStart' }; // donde empezó la Chica Final

// ---------------------------------------------------------------- Cartas de Acción

/** Una línea de resultado; varias alternativas significan "o" (elige una). */
export type ResultLine = Effect[][];

export interface ActionCard {
  id: CardId;
  name: string;
  cost: number;
  copies: number;
  /** action = fase de Acción; reaction = solo contra un ataque; afterRoll = tras una Tirada de Terror. */
  timing: 'action' | 'reaction' | 'afterRoll';
  image: string;
  flavor: string;
  /** Líneas de éxito doble (2+), éxito simple (1) y fracaso. Vacío si la carta no hace Tirada. */
  results?: { triple?: ResultLine; double: ResultLine; single: ResultLine; fail: ResultLine };
  /** Solo entra en la Tabla de Acciones si se juega con alguno de estos Asesinos o Lugares. */
  onlyWith?: string[];
  /** Texto de reglas, ya corregido. */
  text: string;
  /** Reglas especiales no expresables con `results`. */
  custom?: string;
}

// ---------------------------------------------------------------- Tablero del jugador

export interface PlayerBoard {
  id: 'normal' | 'extreme';
  name: string;
  image: string;
  /**
   * Posiciones del medidor de Terror, de la verde (izquierda) a la roja (derecha).
   * `label` es el número impreso (null en las casillas de color sin número).
   */
  terrorTrack: { label: number | null; dice: number }[];
  startTime: number;
  maxTime: number;
}

// ---------------------------------------------------------------- Chicas Finales

export interface RescueSlot {
  effects: Effect[];
  text: string;
}

export interface FinalGirl {
  id: string;
  name: string;
  health: number;
  image: string;
  ultimateImage: string;
  /** Token redondo para el tablero. */
  token: string;
  rescueSlots: RescueSlot[];
  ultimate: { text: string; custom: string };
  /** Texto de la recompensa por Víctima salvada tras la Habilidad Definitiva. */
  extraRescueText?: string;
  /** Recompensa por cada Víctima salvada tras desbloquear la Habilidad Definitiva. */
  extraRescueReward: Effect[];
  bonusItem?: CardId;
  film: string;
}

// ---------------------------------------------------------------- Objetos

export interface ItemCard {
  id: CardId;
  name: string;
  image: string;
  flavor: string;
  text: string;
  hands: 0 | 1 | 2;
  /** Alcance del arma [mín, máx] en zonas. */
  range?: [number, number];
  /** Modificador de daño del arma. */
  damage?: number;
  /** Usos limitados (círculos de la carta). */
  uses?: number;
  /** Qué cartas de Acción puede modificar el arma: todas, ninguna (se usa sola) o una lista. */
  modifies?: 'any' | 'none' | CardId[];
  /** Ficha asociada. */
  token?: string;
  /** Solo puede usarla esta Chica Final (objetos bonus). */
  onlyFor?: string;
  custom?: string;
}

// ---------------------------------------------------------------- Asesino

export interface BloodlustRow {
  attack: number;
  move: number;
  /** Efectos inmediatos al llegar a esta fila. */
  effects: Effect[];
  revealDarkPower?: boolean;
}

export interface FinaleCard {
  id: CardId;
  name: string;
  image: string;
  /** Acción del Asesino tras revelar el Gran Final. */
  finalAction: Effect[];
  text?: string;
  /** Efecto al revelarse o continuo. */
  custom?: string;
}

export interface DarkPowerCard {
  id: CardId;
  name: string;
  image: string;
  text: string;
  epic?: boolean;
  custom: string;
}

export interface HorrorCard {
  id: CardId;
  name: string;
  copies: number;
  image: string;
  text: string;
  /** "Si no hay Víctimas en el tablero, descarta y roba la siguiente carta de Horror." */
  requiresVictims?: boolean;
  effects: Effect[];
  /** Poder Oscuro Menor: se coloca sobre el tablero del Asesino con fichas de Vida. */
  minorDarkPower?: { health: number; custom: string };
  /** Se queda en juego junto a la carta de Ira (efecto continuo con este id). */
  stays?: string;
}

export interface Killer {
  id: string;
  name: string;
  film: string;
  icon: string;
  board: string;
  cover: string;
  /** Token redondo para el tablero. */
  token: string;
  /** Imagen para el menú de selección. */
  select: string;
  startTerror: number;
  health: number;
  /** Filas de Sed de Sangre, de abajo (inicio) a arriba (máximo). */
  bloodlust: BloodlustRow[];
  /** Efecto que se repite cada vez que la Sed de Sangre sube estando al máximo. */
  bloodlustMaxEffect: Effect[];
  /** Acción inicial del Asesino (reverso de las cartas de Gran Final). */
  initialAction: Effect[];
  finaleBack: string;
  darkPowerBack: string;
  finales: FinaleCard[];
  darkPowers: DarkPowerCard[];
  horror: HorrorCard[];
  /** Medidor de Ira propio (Inkanyamba). */
  wrath?: WrathTrack;
  /** Texto del efecto al subir la Sed de Sangre estando al máximo. */
  bloodlustMaxText?: string;
  specialRules?: string;
}

// ---------------------------------------------------------------- Lugar

export interface Zone {
  id: ZoneId;
  /** Nombre impreso en el tablero (si lo tiene). */
  name?: string;
  /** Nombre descriptivo para la interfaz cuando la zona no tiene nombre impreso. */
  label: string;
  search?: boolean;
  exit?: boolean;
  water?: boolean;
  /** Espacio Sagrado (Sacred Groves). */
  sacred?: boolean;
  /** Posición del centro de la zona en el tablero, en % (para la interfaz). */
  pos: { x: number; y: number };
  /** Huida: a qué zona adyacente huye una Víctima según la tirada. Caras ausentes = se queda. */
  flee: { to: ZoneId; faces: DieFace[] }[];
}

export interface SetupCard {
  id: CardId;
  name: string;
  image: string;
  finalGirl: ZoneId;
  killer: ZoneId;
  victims: Record<ZoneId, number>;
}

export interface EventCard {
  id: CardId;
  name: string;
  image: string;
  flavor: string;
  text: string;
  /** Víctima Especial asociada (color de la figura). */
  specialVictim?: VictimColor;
  token?: string;
  /** Efectos al revelarse. */
  onReveal: Effect[];
  /** true si queda en juego (efecto continuo); false si se descarta tras aplicarse. */
  persistent: boolean;
  custom?: string;
}

export interface Location {
  id: string;
  name: string;
  film: string;
  icon: string;
  board: string;
  cover: string;
  /** Imagen para el menú de selección. */
  select: string;
  /** Tamaño en píxeles de la imagen del tablero (para escalar posiciones). */
  boardSize: { w: number; h: number };
  zones: Zone[];
  /** Zonas de Búsqueda con mazo de Objetos, en el orden de los huecos del tablero. */
  itemDecks: ZoneId[];
  setups: SetupCard[];
  setupBack: string;
  events: EventCard[];
  eventBack: string;
  horror: HorrorCard[];
  items: ItemCard[];
  tokens: Record<string, string>;
  /** Medidor de Ira propio (Sacred Groves). */
  wrath?: WrathTrack;
  /** Track extra de Sed de Sangre: bloodlustTrack.rows[0] se aplica al subir a la casilla 1, etc. */
  bloodlustTrack?: { image: string; rows: { effects: Effect[]; text: string }[] };
  /** Ficha de Final: efectos tras la Acción del Asesino cuando el Gran Final está revelado. */
  finaleToken?: { image: string; effects: Effect[]; text: string };
  specialRules?: string;
}

export type VictimColor = 'white' | 'orange' | 'blue' | 'green';

// ---------------------------------------------------------------- Película

export interface FeatureFilm {
  id: string;
  name: string;
  killer: Killer;
  location: Location;
  finalGirls: FinalGirl[];
  bonusItems: ItemCard[];
}
