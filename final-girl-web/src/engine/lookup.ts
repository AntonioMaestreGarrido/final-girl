import { ACTION_CARDS, BONUS_ITEMS, FINAL_GIRLS, KILLERS, LOCATIONS, PLAYER_BOARDS } from '../content';
import type { ActionCard, CardId, EventCard, FinalGirl, HorrorCard, ItemCard, Killer, Location, Zone, ZoneId } from '../content/types';
import type { GameState } from './state';

const byId = <T extends { id: string }>(list: T[], id: string, what: string): T => {
  const found = list.find((x) => x.id === id);
  if (!found) throw new Error(`${what} desconocido: ${id}`);
  return found;
};

export const killerDef = (s: GameState): Killer => byId(KILLERS, s.config.killerId, 'Asesino');
export const locationDef = (s: GameState): Location => byId(LOCATIONS, s.config.locationId, 'Lugar');
export const fgDef = (s: GameState): FinalGirl => byId(FINAL_GIRLS, s.config.finalGirlId, 'Chica Final');
export const boardDef = (s: GameState) => PLAYER_BOARDS[s.config.board];
export const actionDef = (id: CardId): ActionCard => byId(ACTION_CARDS, id, 'Carta de Acción');

export function itemDef(s: GameState, id: CardId): ItemCard {
  return byId([...locationDef(s).items, ...BONUS_ITEMS], id, 'Objeto');
}

export function horrorDef(s: GameState, id: CardId): HorrorCard {
  return byId([...killerDef(s).horror, ...locationDef(s).horror], id, 'Carta de Horror');
}

export const eventDef = (s: GameState, id: CardId): EventCard => byId(locationDef(s).events, id, 'Evento');
export const zoneDef = (s: GameState, id: ZoneId): Zone => byId(locationDef(s).zones, id, 'Zona');
export const zoneName = (s: GameState, id: ZoneId): string => zoneDef(s, id).label;

/** Espacio cerrado por "Cerrado por mantenimiento" (las Víctimas no pueden entrar). */
export const closedZone = (s: GameState): ZoneId | undefined => s.tokens.find((t) => t.id === 'cerrado')?.zone;

/** ¿Puede una Víctima pasar de `from` a `to` por su cuenta? (Fuera de servicio y Cerrado). */
export function victimCanEnter(s: GameState, from: ZoneId, to: ZoneId): boolean {
  if (closedZone(s) === to) return false;
  return !(s.blocked ?? []).some(([a, b]) => (a === from && b === to) || (a === to && b === from));
}

/** Zonas adyacentes. La Chica Final puede usar el túnel secreto; los Enemigos no. */
export function neighbors(s: GameState, zone: ZoneId, who: 'fg' | 'enemy' | 'victim' = 'enemy'): ZoneId[] {
  let adj = zoneDef(s, zone).flee.map((f) => f.to);
  if (who === 'victim') adj = adj.filter((z) => victimCanEnter(s, zone, z));
  if (who === 'fg' && s.tunnel.includes(zone)) {
    for (const z of s.tunnel) if (z !== zone && !adj.includes(z)) adj.push(z);
  }
  return adj;
}

/** Distancias (en zonas) desde `from` a todas las zonas. */
export function distances(s: GameState, from: ZoneId, who: 'fg' | 'enemy' | 'victim' = 'enemy'): Map<ZoneId, number> {
  const dist = new Map<ZoneId, number>([[from, 0]]);
  const queue = [from];
  while (queue.length) {
    const z = queue.shift()!;
    for (const n of neighbors(s, z, who)) {
      if (!dist.has(n)) {
        dist.set(n, dist.get(z)! + 1);
        queue.push(n);
      }
    }
  }
  return dist;
}

export const distance = (s: GameState, a: ZoneId, b: ZoneId, who: 'fg' | 'enemy' | 'victim' = 'enemy'): number =>
  distances(s, a, who).get(b) ?? Infinity;

/** Todos los caminos más cortos de `from` a `to` (listas de zonas sin incluir `from`). */
export function shortestPaths(s: GameState, from: ZoneId, to: ZoneId, who: 'fg' | 'enemy' | 'victim' = 'enemy'): ZoneId[][] {
  const distTo = distances(s, to, who);
  const total = distTo.get(from);
  if (total === undefined) return [];
  const out: ZoneId[][] = [];
  const walk = (zone: ZoneId, path: ZoneId[]) => {
    if (zone === to) return void out.push(path);
    for (const n of neighbors(s, zone, who)) {
      if (distTo.get(n) === distTo.get(zone)! - 1) walk(n, [...path, n]);
    }
  };
  walk(from, []);
  return out;
}

export const victimsIn = (s: GameState, zone: ZoneId) => s.victims.filter((v) => v.zone === zone);
