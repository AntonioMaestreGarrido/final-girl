/**
 * Terror from Above: no hay Asesino, solo Pájaros. Los Pájaros son Esbirros (uno por ficha en el estado), nunca se mueven
 * solos, no puede haber más de 3 por espacio y atacan a UN objetivo de su espacio con tanto daño como Pájaros haya.
 *
 * Aquí viven: la preparación, Generar Pájaros, los ataques de Pájaros, las Víctimas Especiales (que son lo que hay que
 * salvar para ganar), las cartas propias (Terror, Gran Final y Poder Oscuro) y la traducción de las cartas del Lugar que
 * hablan del Asesino ("mover" = generar Pájaros, "colocar" = 3 Pájaros).
 */
import type { Effect, EventCard, HorrorCard, KillerAction, ZoneId } from '../content/types';
import { changeTerror, damageFG, has, killVictim, log, push, pushEffects, uid, victimFlees } from './core';
import { minionsAt } from './enemies';
import { choice, registerChoice, registerEffect } from './registry';
import { rollDie } from './rng';
import { adjacent, distances, locationDef, victimsIn, zoneName } from './lookup';
import type { GameState } from './state';

const MAX = 3;
const eff = (id: string): Effect => ({ kind: 'custom', id });
const SRC = { kind: 'killer' } as const;

const bs = (s: GameState) => s.birds!;
const boardZones = (s: GameState) => locationDef(s).zones.filter((z) => !z.hidden);
export const birdsAt = (s: GameState, zone: ZoneId): number => minionsAt(s, zone).length;
const plural = (n: number) => `${n} ${n === 1 ? 'Pájaro' : 'Pájaros'}`;
const label = (s: GameState, z: ZoneId) => `${zoneName(s, z)} (${birdsAt(s, z)}/${MAX})`;

// ---------------------------------------------------------------- preparación

export function birdsSetup(s: GameState, specials: 1 | 2 | 3): void {
  s.birds = { hidden: specials, total: specials, saved: 0, lastSpawned: 0, lastAttacks: 0, wall: 0 };
  // Una ficha de 3 Pájaros donde empezaría el Asesino y 1 Pájaro en cada espacio vacío (sin Víctimas ni Chica Final).
  const occupied = new Set<ZoneId>([s.fg.zone, ...s.victims.map((v) => v.zone)]);
  addBirds(s, s.killer.startZone, MAX);
  for (const z of boardZones(s)) if (!occupied.has(z.id) && !birdsAt(s, z.id)) addBirds(s, z.id, 1);
}

/** Cartas del Lugar que no tienen sentido sin Asesino (se dejan fuera del mazo de Terror). */
export function birdsHorrorOk(card: HorrorCard): boolean {
  const bad = (e: Effect): boolean =>
    (e.kind === 'panic' && e.who === 'killerZone') || e.kind === 'victimsStepToward' || (e.kind === 'choice' && e.options.some((o) => o.some(bad)));
  return !card.effects.some(bad);
}

/** Eventos que necesitan Víctimas Especiales o giran en torno al Asesino: se descartan y se roba otro. */
export function birdsEventOk(ev: EventCard): boolean {
  return !ev.specialVictim && !['ev-death-wish', 'ev-sister'].includes(ev.custom ?? '');
}

// ---------------------------------------------------------------- colocar Pájaros

function addBirds(s: GameState, zone: ZoneId, n: number): void {
  for (let i = 0; i < n; i++) s.minions.push({ id: `tmp-b${s.nextUid++}`, zone, hp: 1 });
}

/** Pierdes si hay 3 Pájaros en cada espacio del tablero. */
function checkLoss(s: GameState): void {
  if (s.outcome || !boardZones(s).every((z) => birdsAt(s, z.id) >= MAX)) return;
  s.outcome = { winner: 'killer', text: 'Hay 3 Pájaros en cada espacio del tablero: ¡los Pájaros lo cubren todo!' };
  log(s, s.outcome.text, 'phase');
  s.stack = [];
  s.prompt = null;
}

/** Coloca `n` Pájaros: lo que no cabe (máximo 3) pasa a un espacio adyacente de tu elección, ampliando si hace falta. */
export function placeBirds(s: GameState, zone: ZoneId, n: number): void {
  if (n <= 0 || s.outcome) return;
  const put = Math.min(n, MAX - birdsAt(s, zone));
  if (put > 0) {
    addBirds(s, zone, put);
    log(s, `${plural(put)} en ${zoneName(s, zone)} (${birdsAt(s, zone)}/${MAX}).`, 'killer', { kind: 'killerMove', path: [zone] });
  }
  checkLoss(s);
  const rest = n - put;
  if (rest <= 0 || s.outcome) return;
  // Espacios con sitio, del anillo más cercano al lleno.
  const seen = new Set<ZoneId>([zone]);
  let ring = [zone];
  while (ring.length) {
    const next: ZoneId[] = [];
    for (const z of ring) {
      for (const a of adjacent(s, z)) {
        if (seen.has(a) || locationDef(s).zones.find((x) => x.id === a)?.hidden) continue;
        seen.add(a);
        next.push(a);
      }
    }
    const open = next.filter((z) => birdsAt(s, z) < MAX);
    if (open.length === 1) return placeBirds(s, open[0]!, rest);
    if (open.length > 1) {
      push(s, choice(`${plural(rest)} no caben en ${zoneName(s, zone)}: ¿en qué espacio cercano los colocas?`, open.map((z) => ({ id: z, label: label(s, z) })), { kind: 'custom', id: 'birds-place-at', data: { n: rest } }));
      return;
    }
    ring = next;
  }
}

registerChoice('birds-place-at', (s, option, data) => placeBirds(s, option, data.n as number));

function placeNearest(s: GameState, zones: ZoneId[], n: number, what: string): void {
  if (!zones.length) return placeBirds(s, s.fg.zone, n);
  const dist = distances(s, s.fg.zone, 'fg');
  const best = Math.min(...zones.map((z) => dist.get(z) ?? 99));
  const near = zones.filter((z) => (dist.get(z) ?? 99) === best);
  if (near.length === 1) return placeBirds(s, near[0]!, n);
  push(s, choice(`Empate: ¿en cuál de los espacios (${what}) más cercanos colocas ${plural(n)}?`, near.map((z) => ({ id: z, label: label(s, z) })), { kind: 'custom', id: 'birds-place-at', data: { n } }));
}

function distribute(s: GameState, left: number): void {
  if (left <= 0 || s.outcome) return;
  const open = boardZones(s).filter((z) => birdsAt(s, z.id) < MAX);
  if (!open.length) return;
  if (open.length === 1) return placeBirds(s, open[0]!.id, left);
  push(s, choice(`Distribuidos: ¿dónde va el siguiente Pájaro? (quedan ${left})`, open.map((z) => ({ id: z.id, label: label(s, z.id) })), { kind: 'custom', id: 'birds-distribute', data: { left } }));
}
registerChoice('birds-distribute', (s, option, data) => {
  placeBirds(s, option, 1);
  distribute(s, (data.left as number) - 1);
});

// ---------------------------------------------------------------- tiradas (con la Habilidad Definitiva de Paula)

type DieCont = (s: GameState, value: number) => void;
const dieConts: Record<string, DieCont> = {
  // Ataque de aves (Gran Final): un dado y esos Pájaros en tu espacio.
  'finale-attack': (s, n) => {
    bs(s).lastSpawned = n;
    log(s, `Ataque de aves: ${plural(n)} en tu espacio.`, 'killer');
    placeBirds(s, s.fg.zone, n);
  },
  // ¡Intentan entrar!: un dado y esos Pájaros en el espacio de Búsqueda más cercano.
  search: (s, n) => {
    bs(s).lastSpawned = n;
    log(s, `¡Intentan entrar!: ${plural(n)} en el espacio de Búsqueda más cercano.`, 'killer');
    placeNearest(s, boardZones(s).filter((z) => z.search).map((z) => z.id), n, 'Búsqueda');
  },
};

/** Tira 1 dado; con Paula (Habilidad Definitiva) lanza 2 y eliges cuál usar. */
function rollOne(s: GameState, k: keyof typeof dieConts & string): void {
  const a = rollDie(s.rng);
  if (!has(s, 'ult-paula')) {
    log(s, `Dado: ${a}.`, 'killer', { kind: 'dice', faces: [a] });
    return dieConts[k]!(s, a);
  }
  const b = rollDie(s.rng);
  log(s, `Paula lanza 2 dados en lugar de 1: ${a} y ${b}.`, 'killer', { kind: 'dice', faces: [a, b] });
  if (a === b) return dieConts[k]!(s, a);
  push(s, choice(`Paula: dados ${a} y ${b}. ¿Cuál usas?`, [{ id: String(a), label: `El ${a}` }, { id: String(b), label: `El ${b}` }], { kind: 'custom', id: 'birds-paula-die', data: { k } }));
}
registerChoice('birds-paula-die', (s, option, data) => dieConts[data.k as string]!(s, Number(option)));

// ---------------------------------------------------------------- Generar Pájaros

const TABLE: Record<number, string> = {
  1: 'distribuidos en cualquier espacio',
  2: 'cualquier espacio individual',
  3: 'el espacio de Búsqueda más cercano a ti',
  4: 'la Salida más cercana a ti',
  5: 'el espacio de la Víctima más cercana',
  6: 'tu espacio',
};

function applyTable(s: GameState, n: number, t: number): void {
  const zones = boardZones(s);
  switch (t) {
    case 1:
      return distribute(s, n);
    case 2:
      return void push(s, choice(`Cualquier espacio individual: ¿dónde colocas ${plural(n)}?`, zones.map((z) => ({ id: z.id, label: label(s, z.id) })), { kind: 'custom', id: 'birds-place-at', data: { n } }));
    case 3:
      return placeNearest(s, zones.filter((z) => z.search).map((z) => z.id), n, 'Búsqueda');
    case 4:
      return placeNearest(s, zones.filter((z) => z.exit).map((z) => z.id), n, 'Salida');
    case 5:
      return placeNearest(s, [...new Set(s.victims.map((v) => v.zone))], n, 'Víctima');
    default:
      return placeBirds(s, s.fg.zone, n);
  }
}

function resolveSpawn(s: GameState, n: number, t: number): void {
  bs(s).lastSpawned = n;
  log(s, `Generar Pájaros: ${plural(n)}, ${TABLE[t]}.`, 'killer');
  applyTable(s, n, t);
}

function spawn(s: GameState): void {
  if (has(s, 'finale-bird-attack')) return rollOne(s, 'finale-attack');
  const d1 = rollDie(s.rng);
  const d2 = rollDie(s.rng);
  log(s, `Generar Pájaros: dados ${d1} y ${d2}.`, 'killer', { kind: 'dice', faces: [d1, d2] });
  // Insufribles bichos: DEBES usar el resultado más alto como número de Pájaros.
  if (d1 === d2 || has(s, 'finale-bird-highest')) return resolveSpawn(s, Math.max(d1, d2), Math.min(d1, d2));
  push(s, choice(`Generar Pájaros (dados ${d1} y ${d2}): uno es el número de Pájaros y el otro decide dónde. ¿Cuál es el número?`, [
    { id: 'a', label: `${d1} Pájaros, colocación según el ${d2} (${TABLE[d2]})` },
    { id: 'b', label: `${d2} Pájaros, colocación según el ${d1} (${TABLE[d1]})` },
  ], { kind: 'custom', id: 'birds-pick-die', data: { d1, d2 } }));
}
registerChoice('birds-pick-die', (s, option, data) => {
  const d1 = data.d1 as number;
  const d2 = data.d2 as number;
  if (option === 'a') resolveSpawn(s, d1, d2);
  else resolveSpawn(s, d2, d1);
});

registerEffect('birds-spawn', (s) => spawn(s));
registerEffect('birds-spawn-search', (s) => rollOne(s, 'search'));
registerEffect('birds-spawn-if-few', (s) => {
  if (bs(s).lastSpawned <= 3) {
    log(s, `Se generaron ${bs(s).lastSpawned} Pájaros (3 o menos): se generan otra vez.`, 'killer');
    spawn(s);
  }
});
registerEffect('birds-spawn-if-special', (s) => {
  if (s.victims.some((v) => v.bsp)) {
    log(s, 'Hay una Víctima Especial en juego: se generan Pájaros.', 'killer');
    spawn(s);
  }
});
registerEffect('birds-if-no-attacks', (s) => {
  if (bs(s).lastAttacks > 0) return;
  log(s, 'No se han producido ataques: se generan Pájaros y +1 Sed de Sangre.', 'killer');
  pushEffects(s, [eff('birds-spawn'), { kind: 'bloodlust', amount: 1 }], SRC);
});
registerEffect('birds-bloodlust-max', (s) => {
  if (s.killer.finaleRevealed) {
    log(s, 'Sed de Sangre al máximo con el Gran Final revelado: pierdes 1 Vida.', 'killer');
    return damageFG(s, 1);
  }
  const card = s.horrorDeck.shift();
  if (card) {
    s.horrorDiscard.push(card);
    log(s, 'Sed de Sangre al máximo: se descarta la siguiente carta de Terror.', 'good');
  }
});

// ---------------------------------------------------------------- ataques de Pájaros

function runAttacks(s: GameState, zones: ZoneId[]): void {
  bs(s).lastAttacks = 0;
  const ordered = [...new Set(zones)].filter((z) => birdsAt(s, z) > 0).sort((a, b) => Number(b === s.fg.zone) - Number(a === s.fg.zone));
  pushEffects(s, ordered.map((z) => eff(`birds-hit:${z}`)), SRC);
}

registerEffect('birds-hit', (s, zone) => {
  const z = zone!;
  const n = birdsAt(s, z);
  if (!n || s.outcome) return;
  const victims = victimsIn(s, z).filter((v) => !v.bsp && v.role !== 'lobo');
  const fgHere = s.fg.zone === z;
  if (victims.length) {
    // Las Víctimas normales tienen prioridad sobre la Chica Final.
    const v = [...victims].sort((a, b) => (a.role ? 1 : 0) - (b.role ? 1 : 0))[0]!;
    bs(s).lastAttacks++;
    log(s, `${plural(n)} atacan a una Víctima en ${zoneName(s, z)}.`, 'killer');
    // Para proteger a una Víctima de tu espacio hay que evitar TODO el daño (con 1 basta para matarla).
    if (fgHere) push(s, { t: 'attackFG', damage: n, reduce: 0, ignore: false, by: 'm:birds', victim: v.id });
    else killVictim(s, v, true);
  } else if (fgHere) {
    bs(s).lastAttacks++;
    push(s, { t: 'attackFG', damage: n, reduce: 0, ignore: false, by: 'm:birds' });
  }
});

/** Icono de ataque: en el espacio de la Chica Final (si hay algún Pájaro) y en todos los de 3 Pájaros. */
registerEffect('birds-attack', (s) => {
  runAttacks(s, [s.fg.zone, ...boardZones(s).filter((z) => birdsAt(s, z.id) >= MAX).map((z) => z.id)]);
});

/** «Los pájaros están atacando»: tu espacio y los espacios donde los Pájaros superan en número a las Víctimas. */
registerEffect('birds-attack-outnumber', (s) => {
  runAttacks(s, [s.fg.zone, ...boardZones(s).filter((z) => birdsAt(s, z.id) > victimsIn(s, z.id).length).map((z) => z.id)]);
});

/** Una carta del Lugar con Acción del Asesino: cada icono de movimiento genera Pájaros y cada ataque es un ataque de Pájaros. */
export function birdsKillerAction(s: GameState, a: KillerAction): void {
  const moves = Array.from({ length: a.moves }, () => eff('birds-spawn'));
  const attacks = Array.from({ length: a.attacks }, () => eff('birds-attack'));
  pushEffects(s, a.attackFirst ? [...attacks, ...moves] : [...moves, ...attacks], SRC);
}

/** El Asesino «aparece» en un espacio: se colocan allí 3 Pájaros. */
export function birdsPlaceKiller(s: GameState, zone: ZoneId): void {
  log(s, `Donde iría el Asesino aparecen 3 Pájaros: ${zoneName(s, zone)}.`, 'killer');
  placeBirds(s, zone, MAX);
}

/** Efectos de las cartas del Lugar que no significan nada sin Asesino. */
export const BIRDS_NOOP = new Set(['ml-patio', 'ml-sneaky']);

// ---------------------------------------------------------------- Víctimas Especiales

/** Salen de su escondite al desbloquear tu Habilidad Definitiva o cuando no quedan Víctimas normales. */
export function birdsCheckSpecials(s: GameState): void {
  const b = s.birds;
  if (!b || b.hidden <= 0 || s.outcome) return;
  const normal = s.victims.some((v) => !v.bsp);
  if (!s.fg.ultimate && normal) return;
  const n = b.hidden;
  b.hidden = 0;
  log(s, s.fg.ultimate ? '¡Habilidad Definitiva desbloqueada! Salen las Víctimas Especiales de su escondite.' : 'No quedan Víctimas normales: salen las Víctimas Especiales de su escondite.', 'phase');
  placeSpecial(s, n, []);
}

function placeSpecial(s: GameState, left: number, used: ZoneId[]): void {
  if (left <= 0) return;
  const search = boardZones(s).filter((z) => z.search).map((z) => z.id);
  let pool = search.filter((z) => !used.includes(z));
  if (!pool.length) pool = search.length ? search : [s.fg.zone];
  const dist = distances(s, s.fg.zone, 'fg');
  const far = Math.max(...pool.map((z) => dist.get(z) ?? 0));
  const far2 = pool.filter((z) => (dist.get(z) ?? 0) === far);
  if (far2.length === 1) return putSpecial(s, far2[0]!, left, used);
  push(s, choice('Empate: ¿en qué espacio de Búsqueda, de los más alejados de ti, sale una Víctima Especial?', far2.map((z) => ({ id: z, label: zoneName(s, z) })), { kind: 'custom', id: 'birds-special-place', data: { left, used } }));
}
registerChoice('birds-special-place', (s, option, data) => putSpecial(s, option, data.left as number, data.used as ZoneId[]));

function putSpecial(s: GameState, zone: ZoneId, left: number, used: ZoneId[]): void {
  s.victims.push({ id: uid(s, 'v'), zone, special: 'blue', bsp: true });
  log(s, `Una Víctima Especial sale en ${zoneName(s, zone)}.`, 'phase');
  placeSpecial(s, left - 1, [...used, zone]);
}

/** Salvaste a una Víctima Especial: si eran todas, ganas. */
export function birdsOnSpecialSaved(s: GameState): void {
  const b = bs(s);
  b.saved++;
  log(s, `Víctimas Especiales salvadas: ${b.saved} de ${b.total}.`, 'good');
  if (b.saved < b.total) return;
  s.outcome = { winner: 'finalGirl', text: '¡Has salvado a todas las Víctimas Especiales! Sobrevives a los Pájaros.' };
  log(s, s.outcome.text, 'phase');
  s.stack = [];
  s.prompt = null;
}

/** No se puede salvar a nadie en una Salida con Pájaros mientras el Muro de aves esté en juego. */
export const birdsWallBlocks = (s: GameState, zone: ZoneId): boolean => !!s.birds && has(s, 'hr-bird-wall') && birdsAt(s, zone) > 0;

/** Cada Pájaro que muere pone una ficha en el Muro de aves; con 5, se retira del juego. */
export function birdsOnKilled(s: GameState): void {
  if (!s.birds || !has(s, 'hr-bird-wall')) return;
  s.birds.wall++;
  if (s.birds.wall < 5) return;
  s.birds.wall = 0;
  const id = 'muro-de-aves';
  s.activeHorror = s.activeHorror.filter((c) => c !== id);
  log(s, 'El Muro de aves tiene 5 fichas: se retira del juego.', 'good');
}

// ---------------------------------------------------------------- Gran Final y Poder Oscuro

/** Enjambre interminable: al moverte a un espacio con 3 Pájaros pierdes 1 Vida. */
export function birdsOnFgEnter(s: GameState): void {
  if (!s.birds || !has(s, 'finale-bird-swarm') || birdsAt(s, s.fg.zone) < MAX) return;
  log(s, 'Enjambre interminable: entras en un espacio con 3 Pájaros y pierdes 1 Vida.', 'killer');
  damageFG(s, 1);
}

/** Poderes Oscuros durante el Mantenimiento. */
export function birdsUpkeep(s: GameState): void {
  if (!s.birds || s.outcome) return;
  const here = birdsAt(s, s.fg.zone);
  if (has(s, 'dp-birds-waiting') && here >= MAX) {
    log(s, 'Están esperando para atacar: 3 Pájaros en tu espacio, +2 Terror.', 'killer');
    changeTerror(s, 2);
  }
  if (has(s, 'dp-birdnado') && !s.outcome) {
    const total = here + adjacent(s, s.fg.zone).reduce((n, z) => n + birdsAt(s, z), 0);
    if (total >= 10) {
      log(s, `Birdnado: ${total} Pájaros en tu espacio y los adyacentes, pierdes 3 Vidas.`, 'killer');
      damageFG(s, 3);
    }
  }
  if (has(s, 'dp-run-for-life') && !s.outcome && s.victims.length) {
    const dist = distances(s, s.fg.zone, 'fg');
    const far = Math.max(...s.victims.map((v) => dist.get(v.zone) ?? 0));
    const zones = [...new Set(s.victims.filter((v) => (dist.get(v.zone) ?? 0) === far).map((v) => v.zone))];
    if (zones.length === 1) return runForLife(s, zones[0]!);
    push(s, choice('Corre por tu vida: empate, ¿qué Víctima, de las más alejadas, entra en pánico?', zones.map((z) => ({ id: z, label: zoneName(s, z) })), { kind: 'custom', id: 'birds-run' }));
  }
}
registerChoice('birds-run', (s, option) => runForLife(s, option));

function runForLife(s: GameState, zone: ZoneId): void {
  const v = victimsIn(s, zone).sort((a, b) => (a.bsp ? 1 : 0) - (b.bsp ? 1 : 0))[0];
  if (!v) return;
  log(s, 'Corre por tu vida: la Víctima más alejada entra en pánico.', 'killer');
  victimFlees(s, v, { deathZones: boardZones(s).filter((z) => birdsAt(s, z.id) >= 2).map((z) => z.id) });
}
