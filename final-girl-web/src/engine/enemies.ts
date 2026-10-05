/**
 * Enemigos = el Asesino y sus Esbirros (reglamento pág. 32-33).
 * Las Marionetas de Geppetto son Esbirros: 1 Vida, 1 de Ataque y el Movimiento de Geppetto.
 */
import type { ZoneId } from '../content/types';
import { damageKiller, has, log } from './core';
import { distances, killerDef, zoneName } from './lookup';
import type { GameState, Minion } from './state';

export const minionsAt = (s: GameState, zone: ZoneId): Minion[] => s.minions.filter((m) => m.zone === zone);

/** Zonas con algún Enemigo (el Asesino o un Esbirro). */
export const enemyZones = (s: GameState): ZoneId[] => [...new Set([s.killer.zone, ...s.minions.map((m) => m.zone)])];

export const minionName = (s: GameState, plural = false): string => {
  const def = killerDef(s).minion;
  return def ? (plural ? def.plural : def.name) : plural ? 'Esbirros' : 'Esbirro';
};

/** Distancia (para armas) desde la Chica Final hasta el Enemigo más cercano. */
export function nearestEnemyDistance(s: GameState): number {
  const dist = distances(s, s.fg.zone, 'fg');
  return Math.min(...enemyZones(s).map((z) => dist.get(z) ?? Infinity));
}

/** ¿Hay algún Enemigo a una distancia dentro de [min, max] de la Chica Final? */
export function enemyInRange(s: GameState, min: number, max: number): boolean {
  const dist = distances(s, s.fg.zone, 'fg');
  return enemyZones(s).some((z) => {
    const d = dist.get(z);
    return d !== undefined && d >= min && d <= max;
  });
}

/** Un Esbirro muere: su ficha pasa a la casilla Agotado. */
export function killMinion(s: GameState, m: Minion): void {
  s.minions = s.minions.filter((x) => x !== m);
  s.minionPool.exhausted.push(m.id);
  log(s, `${minionName(s)} destruida en ${zoneName(s, m.zone)}.`, 'good');
}

/**
 * Daño a los Esbirros de una zona (se reparte como se quiera, no se puede repartir con el Asesino).
 * Abominación masiva: cada Esbirro ignora el primer daño que recibe cada turno.
 */
export function damageMinionsAt(s: GameState, zone: ZoneId, amount: number): number {
  let killed = 0;
  let left = amount;
  const shield = has(s, 'dp-massive-abomination');
  while (left > 0) {
    const here = minionsAt(s, zone);
    if (!here.length) break;
    // Se prefiere el Esbirro que ya gastó su escudo (muere con este punto).
    const m = here.find((x) => x.hit) ?? here[0]!;
    left--;
    if (shield && !m.hit) {
      m.hit = true;
      log(s, `Abominación masiva: ${minionName(s)} ignora el primer daño del turno.`, 'killer');
      continue;
    }
    m.hp -= 1;
    if (m.hp <= 0) {
      killMinion(s, m);
      killed++;
    }
  }
  if (left === amount && !minionsAt(s, zone).length) log(s, 'No hay Esbirros ahí.');
  return killed;
}

/** Daño de efectos del mundo a todos los Enemigos de un conjunto de zonas (león, etc.). */
export function damageEnemiesIn(s: GameState, zones: ZoneId[], amount: number): void {
  for (const z of zones) {
    if (s.outcome) return;
    if (s.killer.zone === z) damageKiller(s, amount);
    damageMinionsAt(s, z, amount);
  }
}
