/**
 * Generador aleatorio con semilla (mulberry32). Su estado vive dentro del
 * GameState, así una partida guardada continúa exactamente igual al cargarla.
 */
export interface RngState {
  seed: number;
  /** Número de valores generados (permite saber si una acción usó azar). */
  calls: number;
}

export function createRng(seed: number): RngState {
  return { seed: seed >>> 0, calls: 0 };
}

/** Devuelve un número en [0, 1) y avanza el estado. */
export function next(rng: RngState): number {
  rng.calls++;
  let t = (rng.seed = (rng.seed + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function rollDie(rng: RngState): 1 | 2 | 3 | 4 | 5 | 6 {
  return (Math.floor(next(rng) * 6) + 1) as 1 | 2 | 3 | 4 | 5 | 6;
}

export function shuffle<T>(rng: RngState, items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(next(rng) * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export function pick<T>(rng: RngState, items: readonly T[]): T {
  return items[Math.floor(next(rng) * items.length)]!;
}
