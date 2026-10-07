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
/** Terror from Above: no hay Asesino, solo Pájaros (Esbirros). */
export const isBirds = (s: GameState): boolean => !!killerDef(s).birds;
/** ¿Está el Asesino en esta zona? (Con Pájaros nunca lo está.) */
export const killerIn = (s: GameState, zone: ZoneId): boolean => !isBirds(s) && s.killer.zone === zone;
export const boardDef = (s: GameState) => PLAYER_BOARDS[s.config.board];
export const actionDef = (id: CardId): ActionCard => byId(ACTION_CARDS, id, 'Carta de Acción');

export function itemDef(s: GameState, id: CardId): ItemCard {
  return byId([...locationDef(s).items, ...(killerDef(s).items ?? []), ...BONUS_ITEMS], id, 'Objeto');
}

export function horrorDef(s: GameState, id: CardId): HorrorCard {
  return byId([...killerDef(s).horror, ...locationDef(s).horror], id, 'Carta de Horror');
}

export const eventDef = (s: GameState, id: CardId): EventCard => byId(locationDef(s).events, id, 'Evento');
export const zoneDef = (s: GameState, id: ZoneId): Zone => byId(locationDef(s).zones, id, 'Zona');
/** Nombre de una zona o de un mazo de Objetos compartido (Maple Lane: uno por cuadrante). */
export const zoneName = (s: GameState, id: ZoneId): string => {
  const loc = locationDef(s);
  return loc.zones.find((z) => z.id === id)?.label ?? loc.deckNames?.[id] ?? id;
};

/** Mazo de Objetos al que pertenece una zona de Búsqueda. */
export const deckOf = (s: GameState, zone: ZoneId): ZoneId => zoneDef(s, zone).deck ?? zone;

/** Espacio cerrado por "Cerrado por mantenimiento" (las Víctimas no pueden entrar). */
export const closedZone = (s: GameState): ZoneId | undefined => s.tokens.find((t) => t.id === 'cerrado')?.zone;

/** ¿Puede una Víctima pasar de `from` a `to` por su cuenta? (Fuera de servicio y Cerrado). */
export function victimCanEnter(s: GameState, from: ZoneId, to: ZoneId): boolean {
  if (closedZone(s) === to) return false;
  return !(s.blocked ?? []).some(([a, b]) => (a === from && b === to) || (a === to && b === from));
}

/** ¿Está tapada esta unión por la Escalera Rota (Creech Manor)? */
function ladderBroken(s: GameState, a: ZoneId, b: ZoneId): boolean {
  const ladder = locationDef(s).ladder;
  return !!ladder && s.tokens.some((t) => t.id === 'escalera-rota') && ((a === ladder[0] && b === ladder[1]) || (a === ladder[1] && b === ladder[0]));
}

/** Uniones extra por fichas: Escalera de Cuerda (convierte un sentido único en doble) y Helicóptero. */
function extraLinks(s: GameState, zone: ZoneId): ZoneId[] {
  const out: ZoneId[] = [];
  const loc = locationDef(s);
  for (const t of s.tokens) {
    if (t.id !== 'escalera-de-cuerda') continue;
    for (const o of loc.oneWay ?? []) if (o.at === t.zone && o.to === zone) out.push(o.from);
  }
  if (s.tokens.some((t) => t.id === 'helicoptero') && !s.creech?.heliUsed) {
    if (zone === 'atico') out.push('helicoptero');
    if (zone === 'helicoptero') out.push('atico');
  }
  return out;
}

/** El Candado cierra su unión a Enemigos y Víctimas; solo la Chica Final (y quien la acompaña) la cruza. */
const padlocked = (s: GameState, a: ZoneId, b: ZoneId): boolean => {
  const l = s.creech?.lock;
  return !!l && ((l[0] === a && l[1] === b) || (l[0] === b && l[1] === a));
};

/**
 * Zonas a las que se puede ir desde `zone` (movimiento). Las uniones de un solo sentido (Creech Manor)
 * solo aparecen en la dirección permitida. La Chica Final puede usar el túnel secreto; los Enemigos no.
 */
export function neighbors(s: GameState, zone: ZoneId, who: 'fg' | 'enemy' | 'victim' = 'enemy'): ZoneId[] {
  let adj = zoneDef(s, zone).flee.map((f) => f.to);
  for (const z of extraLinks(s, zone)) if (!adj.includes(z)) adj.push(z);
  adj = adj.filter((z) => !ladderBroken(s, zone, z));
  if (who !== 'fg') adj = adj.filter((z) => !padlocked(s, zone, z));
  if (who === 'victim') adj = adj.filter((z) => victimCanEnter(s, zone, z));
  if (who === 'fg' && s.tunnel.includes(zone)) {
    for (const z of s.tunnel) if (z !== zone && !adj.includes(z)) adj.push(z);
  }
  return adj;
}

/** Espacios adyacentes en el tablero, en ambos sentidos (los de un solo sentido siguen siendo adyacentes). */
export function adjacent(s: GameState, zone: ZoneId): ZoneId[] {
  const out = new Set<ZoneId>(neighbors(s, zone, 'enemy'));
  for (const z of locationDef(s).zones) {
    if (z.id !== zone && neighbors(s, z.id, 'enemy').includes(zone)) out.add(z.id);
  }
  return [...out];
}

/** Zonas desde las que se puede llegar a `zone` en un paso. */
function incoming(s: GameState, zone: ZoneId, who: 'fg' | 'enemy' | 'victim'): ZoneId[] {
  return locationDef(s).zones.filter((z) => z.id !== zone && neighbors(s, z.id, who).includes(zone)).map((z) => z.id);
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

/** Distancias desde todas las zonas hasta `to` (recorrido inverso: importa con uniones de un solo sentido). */
function distancesTo(s: GameState, to: ZoneId, who: 'fg' | 'enemy' | 'victim'): Map<ZoneId, number> {
  const dist = new Map<ZoneId, number>([[to, 0]]);
  const queue = [to];
  while (queue.length) {
    const z = queue.shift()!;
    for (const n of incoming(s, z, who)) {
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
  const distTo = distancesTo(s, to, who);
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
