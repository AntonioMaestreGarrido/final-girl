import type { ZoneId } from '../content/types';
import type { LogEntry } from '../engine';

/**
 * Resalte de movimientos y muertes (regla general para todas las películas).
 *
 * El motor resuelve cada acción de golpe, pero el registro se revela paso a paso. Mientras un paso no se ha
 * revelado, las piezas que se mueven en él se dibujan en su origen; al revelarlo recorren su camino casilla a casilla.
 */
export type Anim = NonNullable<LogEntry['anim']>;
export type MoveAnim = Extract<Anim, { kind: 'killerMove' | 'fgMove' | 'victimMove' }>;

/** Tiempo que tarda una pieza en cruzar un espacio. */
export const HOP_MS = 380;
/** Tiempo extra para que se vea el pulso del destino. */
const TAIL_MS = 600;
const DIE_MS = 1100;

export const isMoveAnim = (a: Anim | undefined): a is MoveAnim => !!a && (a.kind === 'killerMove' || a.kind === 'fgMove' || a.kind === 'victimMove');

/** Entradas del registro que se resaltan en el tablero. */
export const isFxAnim = (a: Anim | undefined): a is MoveAnim | Extract<Anim, { kind: 'victimDie' }> => isMoveAnim(a) || a?.kind === 'victimDie';

/** Bando de la pieza, para el color del resalte. */
export function fxSide(a: Anim): 'killer' | 'fg' | 'victim' {
  if (a.kind === 'fgMove') return 'fg';
  if (a.kind === 'killerMove') return a.victim ? 'victim' : 'killer';
  return 'victim';
}

/** Duración total del resalte de una entrada (0 si no se resalta). */
export function fxDuration(a: Anim | undefined): number {
  if (!isFxAnim(a)) return 0;
  if (a.kind === 'victimDie') return DIE_MS;
  return Math.max(0, a.path.length - 1) * HOP_MS + TAIL_MS;
}

/** Claves de las piezas que recorren el camino: 'fg', 'killer', 'm:<id>' (Esbirro) y 'v:<id>' (Víctima). */
export function moveActors(a: MoveAnim): string[] {
  if (a.kind === 'fgMove') return ['fg', ...(a.victims ?? []).map((id) => `v:${id}`)];
  if (a.kind === 'victimMove') return (a.victims ?? [a.victim]).map((id) => `v:${id}`);
  if (a.minion) return [`m:${a.minion}`];
  if (a.victim) return [`v:${a.victim}`];
  return ['killer'];
}

export interface Fx {
  /** Índice de la entrada del registro que se está resaltando. */
  key: number;
  entry: LogEntry;
  /** Casilla del camino en la que va la pieza. */
  step: number;
}

/**
 * Espacio en el que debe dibujarse cada pieza que se desvía de su posición real:
 * - pasos aún sin revelar → el origen de su primer movimiento pendiente;
 * - paso que se está resaltando → la casilla actual de su recorrido.
 */
export function displayZones(log: LogEntry[], shown: number, fx: Fx | null): Map<string, ZoneId> {
  const out = new Map<string, ZoneId>();
  for (let i = shown; i < log.length; i++) {
    const a = log[i]!.anim;
    if (!isMoveAnim(a) || a.path.length < 2) continue;
    for (const k of moveActors(a)) if (!out.has(k)) out.set(k, a.path[0]!);
  }
  const a = fx?.entry.anim;
  if (fx && isMoveAnim(a) && a.path.length >= 2) {
    const z = a.path[Math.min(fx.step, a.path.length - 1)]!;
    for (const k of moveActors(a)) out.set(k, z);
  }
  return out;
}
