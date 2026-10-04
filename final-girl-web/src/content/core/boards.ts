import type { PlayerBoard } from '../types';

/**
 * Tablero del jugador por sus dos caras.
 * Medidor de Terror leído del tablero: 8 casillas (verde sin número, 1–6, roja sin número).
 * Los dados de cada casilla los marca la cuña interior del medidor.
 * Bajar del extremo verde da +1 Tiempo; subir del extremo rojo da +1 Sed de Sangre.
 */
export const PLAYER_BOARDS: Record<PlayerBoard['id'], PlayerBoard> = {
  normal: {
    id: 'normal',
    name: 'Normal',
    image: 'assets/core/player-board-normal.webp',
    terrorTrack: [
      { label: null, dice: 3 },
      { label: 1, dice: 3 },
      { label: 2, dice: 2 },
      { label: 3, dice: 2 },
      { label: 4, dice: 2 },
      { label: 5, dice: 2 },
      { label: 6, dice: 2 },
      { label: null, dice: 1 },
    ],
    startTime: 6,
    maxTime: 12,
  },
  extreme: {
    id: 'extreme',
    name: 'Terror Extremo',
    image: 'assets/core/player-board-extreme.webp',
    terrorTrack: [
      { label: null, dice: 3 },
      { label: 1, dice: 2 },
      { label: 2, dice: 2 },
      { label: 3, dice: 2 },
      { label: 4, dice: 2 },
      { label: 5, dice: 1 },
      { label: 6, dice: 1 },
      { label: null, dice: 1 },
    ],
    startTime: 5,
    maxTime: 12,
  },
};

/** Fichas de Vida Final: 9 negras, 6 en blanco y 3 con 1, 2 y 3 Vidas al dorso. */
export const FINAL_LIFE_TOKENS = [0, 0, 0, 0, 0, 0, 1, 2, 3] as const;

export const HAND_LIMIT = 10;
/** Víctimas amarillas de la Caja Básica; si se agotan, no se añaden más (FAQ). */
export const VICTIM_POOL = 21;
/** Mazo de Horror: cartas que se roban de la mezcla Asesino + Lugar. */
export const HORROR_DECK_SIZE = 10;
/** Mazos de Objeto: número de montones y cartas por montón. */
export const ITEM_DECK_SIZE = 4;
export const MAX_DICE_PER_THROW = 6;

export const CORE_ASSETS = {
  cover: 'assets/core/cover.webp',
  dice: [1, 2, 3, 4, 5, 6].map((n) => `assets/core/dice/face-${n}.webp`),
  finalLifeBlack: 'assets/core/tokens/final-life-black.webp',
  finalLifeWhite: 'assets/core/tokens/final-life-white.webp',
  finalLifeReveal: [0, 1, 2, 3].map((n) => `assets/core/tokens/final-life-reveal-${n}.webp`),
} as const;
