/**
 * Reglas propias de Carnage at the Carnival (Geppetto / Carnival of Blood / Asami / Charlie):
 * Marionetas (Esbirros), Trampas (fichas y objetos), Eventos y cartas de Horror únicas.
 * El resto del motor llama a estas funciones o las registra por id.
 */
import type { Effect, ZoneId } from '../content/types';
import {
  capitalize,
  changeTerror,
  changeTime,
  damageFG,
  damageKiller,
  has,
  healFG,
  increaseBloodlust,
  killVictim,
  log,
  moveVictim,
  nearestVictims,
  panicVictims,
  placeVictims,
  push,
  pushEffects,
  registerTerrorUp,
  registerVictimEnters,
  registerVictimKilled,
  victimLabel,
} from './core';
import { damageEnemiesIn, damageMinionsAt, enemyZones, minionName, minionsAt } from './enemies';
import { discardItem, drawHorror, gainItem, teleportKiller } from './effects';
import { startActorAction } from './killer';
import { actionDef, distance, distances, itemDef, killerDef, locationDef, neighbors, shortestPaths, victimsIn, zoneName } from './lookup';
import { assignRole } from './phases';
import { newRoll } from './player';
import { choice, registerChoice, registerEffect, registerEffectRoll } from './registry';
import { pick, rollDie, shuffle } from './rng';
import type { EffectSource, GameState, Victim } from './state';

const SRC_HORROR: EffectSource = { kind: 'horror' };
const mdef = (s: GameState) => killerDef(s).minion;
const eff = (id: string): Effect => ({ kind: 'custom', id });
const level = (s: GameState) => s.fg.terror; // nivel de Horror: casilla verde 0, 1-6, casilla roja 7

// ---------------------------------------------------------------- elegir Víctimas

const vkey = (v: Victim) => `${v.zone}|${v.role ?? ''}`;
const findVictim = (s: GameState, key: string) => s.victims.find((v) => vkey(v) === key);
const realVictims = (s: GameState) => s.victims.filter((v) => v.role !== 'lobo');

function victimOptions(s: GameState, pool: Victim[]) {
  const seen = new Map<string, Victim>();
  for (const v of pool) if (!seen.has(vkey(v))) seen.set(vkey(v), v);
  return [...seen.entries()].map(([id, v]) => ({ id, label: `${capitalize(victimLabel(v))} en ${zoneName(s, v.zone)}` }));
}

/** Pregunta qué Víctima (si hay varias distintas) y llama al manejador con la clave elegida. */
function askVictim(s: GameState, title: string, handler: string, pool: Victim[], data: Record<string, unknown> = {}, skip = false): void {
  const options = victimOptions(s, pool);
  if (!options.length) return;
  if (options.length === 1 && !skip) return void chosenVictim(s, handler, options[0]!.id, data);
  push(s, choice(title, skip ? [...options, { id: 'skip', label: 'Ninguna' }] : options, { kind: 'custom', id: `cn-victim:${handler}`, data }));
}

const victimHandlers = new Map<string, (s: GameState, key: string, data: Record<string, unknown>) => void>();
function chosenVictim(s: GameState, handler: string, key: string, data: Record<string, unknown>): void {
  if (key === 'skip') return;
  victimHandlers.get(handler)?.(s, key, data);
}
for (const h of ['kill', 'move', 'friend6', 'wolfkill']) {
  registerChoice(`cn-victim:${h}`, (s, option, data) => chosenVictim(s, h, option, data));
}

victimHandlers.set('kill', (s, key) => {
  const v = findVictim(s, key);
  if (v) killVictim(s, v, true);
});
registerEffect('cn-kill-pick', (s, arg) => {
  const pool = arg ? realVictims(s).filter((v) => v.zone === arg) : realVictims(s);
  if (pool.length) askVictim(s, '¿Qué Víctima muere?', 'kill', pool);
});

// ---------------------------------------------------------------- Marionetas

export function placeMinion(s: GameState, id: string, zone: ZoneId): void {
  const def = mdef(s);
  if (!def || s.minions.some((m) => m.id === id)) return;
  s.minions.push({ id, zone, hp: def.health });
}

/** Aparece una Marioneta (paso inicial de la línea M hasta el Gran Final) y las agotadas vuelven a Listo. */
registerEffect('minion-spawn', (s) => {
  const def = mdef(s);
  if (!def) return;
  const id = s.minionPool.ready.shift();
  if (id) {
    placeMinion(s, id, s.killer.zone);
    log(s, `Aparece una ${def.name} en ${zoneName(s, s.killer.zone)}.`, 'killer', { kind: 'killerMove', path: [s.killer.zone] });
  } else log(s, `No quedan ${def.plural} listas: no aparece ninguna.`, 'info');
  if (s.minionPool.exhausted.length) {
    log(s, `${s.minionPool.exhausted.length} ${s.minionPool.exhausted.length === 1 ? 'ficha agotada vuelve' : 'fichas agotadas vuelven'} a Listo.`);
    s.minionPool.ready.push(...s.minionPool.exhausted.splice(0));
  }
});

/** Coloca en el espacio de Geppetto las Marionetas que no están en el tablero. */
export function placeAllMinions(s: GameState, includeExhausted: boolean): void {
  const def = mdef(s);
  if (!def) return;
  const ids = [...s.minionPool.ready.splice(0), ...(includeExhausted ? s.minionPool.exhausted.splice(0) : [])];
  for (const id of ids) placeMinion(s, id, s.killer.zone);
  if (ids.length) log(s, `${ids.length} ${ids.length === 1 ? def.name : def.plural} en ${zoneName(s, s.killer.zone)}.`, 'killer');
}

export function carnivalFinaleRevealed(s: GameState, custom: string | undefined): void {
  if (custom === 'finale-remember') placeAllMinions(s, false);
}

/** Mueve un Esbirro 1 espacio hacia una zona (efectos especiales: no cuentan para el límite de 2 espacios). */
function stepMinion(s: GameState, id: string, target: ZoneId): void {
  const m = s.minions.find((x) => x.id === id);
  if (!m || m.zone === target) return;
  const next = [...new Set(shortestPaths(s, m.zone, target, 'enemy').map((p) => p[0]!))];
  if (!next.length) return;
  if (next.length > 1) {
    return push(s, choice(`Empate: ¿por dónde va ${minionName(s)}?`, next.map((z) => ({ id: z, label: zoneName(s, z) })), { kind: 'custom', id: 'cn-minion-step', data: { id } }));
  }
  m.zone = next[0]!;
  log(s, `${minionName(s)} avanza a ${zoneName(s, m.zone)}.`, 'killer', { kind: 'killerMove', path: [m.zone] });
}
registerChoice('cn-minion-step', (s, option, data) => {
  const m = s.minions.find((x) => x.id === data.id);
  if (!m) return;
  m.zone = option;
  log(s, `${minionName(s)} avanza a ${zoneName(s, option)}.`, 'killer');
});

// ---------------------------------------------------------------- Trampas (fichas)

const TRAP_TOKENS = { red: 'trampa-red', acid: 'trampa-acido', saws: 'trampa-sierras' } as const;
type TrapKind = keyof typeof TRAP_TOKENS;
const trapKindOfToken = (id: string): TrapKind | undefined => (Object.keys(TRAP_TOKENS) as TrapKind[]).find((k) => TRAP_TOKENS[k] === id);
const trapsAt = (s: GameState, zone: ZoneId): TrapKind[] => s.tokens.filter((t) => t.zone === zone).flatMap((t) => trapKindOfToken(t.id) ?? []);
const trapZones = (s: GameState): ZoneId[] => s.tokens.filter((t) => trapKindOfToken(t.id)).map((t) => t.zone);

/** Efecto de una trampa sobre la Chica Final. `fromCard`: extras de la carta de Terror que la coloca. */
function trapOnFG(s: GameState, kind: TrapKind, fromCard: boolean): void {
  if (s.outcome) return;
  switch (kind) {
    case 'acid':
      log(s, 'La Trampa de ácido te quema: pierdes 1 Vida.', 'bad');
      return damageFG(s, 1);
    case 'red': {
      if (!s.fg.hand.length) return log(s, 'La Red de cuerda te atrapa, pero no tienes cartas de Acción que descartar.', 'info');
      const card = pick(s.rng, s.fg.hand);
      s.fg.hand.splice(s.fg.hand.indexOf(card), 1);
      s.actionDiscard.push(card);
      log(s, `La Red de cuerda te atrapa: descartas al azar ${actionDef(card).name}.`, 'bad');
      if (fromCard && (card === 'caminar' || card === 'correr')) {
        log(s, 'Has descartado una carta de Caminar o Correr: +2 Terror.', 'bad');
        changeTerror(s, 2);
      }
      return;
    }
    case 'saws': {
      const faces = [rollDie(s.rng), rollDie(s.rng)];
      log(s, `Sierras giratorias: dados ${faces.join(' y ')}.`, 'bad', { kind: 'dice', faces });
      let moves = 0;
      for (const f of faces) {
        if (f <= 4) {
          log(s, 'Una sierra te alcanza: 1 de daño.', 'bad');
          damageFG(s, 1);
          if (fromCard && !s.outcome) changeTerror(s, 1);
        } else moves++;
      }
      if (moves && !s.outcome) {
        log(s, `Puedes moverte hasta ${moves} ${moves === 1 ? 'espacio' : 'espacios'} para esquivarlas.`, 'good');
        push(s, { t: 'fgMove', remaining: moves, src: { kind: 'system' }, mode: 'walk' });
      }
    }
  }
}

/** Una carta de Terror coloca la ficha de Trampa en tu espacio: efecto inmediato en ti y en las Víctimas de allí. */
function placeTrap(s: GameState, kind: TrapKind): void {
  s.tokens.push({ id: TRAP_TOKENS[kind], zone: s.fg.zone });
  log(s, `Ficha de Trampa en ${zoneName(s, s.fg.zone)}.`, 'killer');
  trapOnFG(s, kind, true);
  for (const v of victimsIn(s, s.fg.zone)) if (!s.outcome) killVictim(s, v, false, { byTrap: true });
}
registerEffect('cn-trap', (s, arg) => placeTrap(s, arg as TrapKind));
registerEffect('cn-gain', (s, id) => gainItem(s, id!));

/** La Chica Final entra en un espacio con fichas de Trampa. */
export function onFgEnter(s: GameState, zone: ZoneId): void {
  for (const kind of trapsAt(s, zone)) trapOnFG(s, kind, false);
}

// Las Víctimas mueren al entrar en un espacio con Trampa (y en el Bosque de los Horrores con "No es real").
registerVictimEnters((s, v, zone) => {
  if (trapsAt(s, zone).length) {
    log(s, `${capitalize(victimLabel(v))} entra en una Trampa y muere.`, 'killer');
    return killVictim(s, v, false, { byTrap: true });
  }
  if (s.tokens.some((t) => t.id === 'calavera' && t.zone === zone)) {
    log(s, `${capitalize(victimLabel(v))} muere en el Bosque de los Horrores.`, 'killer');
    killVictim(s, v, false);
  }
});

// Muertes: Hermana (+2 Sed de Sangre), Prometido por una trampa (+5 Terror), Marionetas por doquier (+1 Terror).
registerVictimKilled((s, v, zone, opts) => {
  if (v.role === 'hermana') {
    log(s, 'Tu Hermana ha muerto: +2 Sed de Sangre.', 'killer');
    increaseBloodlust(s, 2);
  }
  if (v.role === 'prometido' && opts.byTrap) {
    log(s, 'Tu Prometido ha muerto en una trampa: +5 Terror.', 'bad');
    changeTerror(s, 5);
  }
  if (has(s, 'mdp-puppets-everywhere') && (zone === s.fg.zone || neighbors(s, zone, 'enemy').includes(s.fg.zone))) {
    log(s, 'Marionetas por doquier: una Víctima muere cerca de ti, +1 Terror.', 'bad');
    changeTerror(s, 1);
  }
});

// ¡Pánico animal!: cada vez que sube el nivel de Horror.
registerTerrorUp((s) => {
  if (has(s, 'ev-animal-panic')) pushEffects(s, [eff('cn-animal-panic')], { kind: 'event' });
});

registerEffect('cn-animal-panic', (s) => {
  const n = level(s);
  if (n <= 0 || !realVictims(s).length) return;
  const faces = Array.from({ length: n }, () => rollDie(s.rng));
  const stars = faces.filter((f) => f >= 5).length;
  const kills = Math.floor((n - stars) / 2);
  log(s, `¡Pánico animal! ${n} ${n === 1 ? 'dado' : 'dados'}: ${faces.join(' ')} → ${stars} ${stars === 1 ? 'éxito' : 'éxitos'}, mueren ${kills}.`, 'killer', { kind: 'dice', faces });
  const steps: Effect[] = [];
  for (let i = 0; i < stars; i++) steps.push(eff('cn-animal-move'));
  for (let i = 0; i < kills; i++) steps.push(eff('cn-kill-pick'));
  pushEffects(s, steps, { kind: 'event' });
});

registerEffect('cn-animal-move', (s) => {
  const pool = realVictims(s);
  if (pool.length) askVictim(s, 'Pánico animal: ¿qué Víctima mueves 1 espacio?', 'move', pool, {}, true);
});
victimHandlers.set('move', (s, key) => {
  const v = findVictim(s, key);
  if (!v) return;
  const options = neighbors(s, v.zone, 'victim').map((z) => ({ id: `${v.id}>${z}`, label: `A ${zoneName(s, z)}` }));
  if (!options.length) return;
  push(s, choice('¿Hacia dónde la mueves?', options, { kind: 'custom', id: 'cn-victim-dest' }));
});
registerChoice('cn-victim-dest', (s, option) => {
  const [id, to] = option.split('>') as [string, ZoneId];
  const v = s.victims.find((x) => x.id === id);
  if (v) moveVictim(s, v, to);
});

// ---------------------------------------------------------------- Trampas (objetos)

const trapHorror = new Set(['estoy-atrapada', 'quema-quema', 'de-donde-salen-las-cuchillas']);
const findTape = (s: GameState) => s.fg.items.find((i) => i.id === 'cinta-encontrada');

/** Cinta encontrada: antes de resolver una Trampa de Terror se puede cancelar entera. */
export function carnivalHorrorGate(s: GameState, cardId: string, effects: Effect[]): boolean {
  if (!trapHorror.has(cardId)) return false;
  const tape = findTape(s);
  if (!tape) return false;
  push(s, choice('Ha salido una carta de Trampa de Terror. ¿Descartas la Cinta encontrada para cancelarla del todo?', [
    { id: 'yes', label: 'Sí: se descarta sin aplicar NINGÚN efecto' },
    { id: 'no', label: 'No: resolverla' },
  ], { kind: 'custom', id: 'cn-tape-horror', data: { effects, cardId } }));
  return true;
}
registerChoice('cn-tape-horror', (s, option, data) => {
  if (option === 'yes') {
    const tape = findTape(s);
    if (tape) discardItem(s, tape.uid);
    return log(s, 'La Cinta encontrada cancela la Trampa de Terror.', 'good');
  }
  pushEffects(s, data.effects as Effect[], { kind: 'horror', id: data.cardId as string });
});

/** Se ha robado un Objeto Trampa. `viaZappo`: la búsqueda se hizo con Zappo, que huye despavorido. */
export function resolveTrapItem(s: GameState, cardId: string, viaZappo = false): void {
  log(s, `¡Es una trampa! ${itemDef(s, cardId).name}.`, 'bad', undefined, { kind: 'item', id: cardId });
  if (viaZappo) {
    const zappo = s.fg.items.find((i) => i.id === 'zappo');
    if (zappo) discardItem(s, zappo.uid);
    s.itemDiscard.push(cardId);
    return log(s, 'Zappo huye despavorido: ignoras los efectos de la trampa y lo descartas.', 'good');
  }
  if (has(s, 'ult-asami')) {
    s.itemDiscard.push(cardId);
    return log(s, 'Asami es inmune a los Objetos Trampa.', 'good');
  }
  if (findTape(s)) {
    push(s, choice(`¿Descartas la Cinta encontrada para cancelar ${itemDef(s, cardId).name}?`, [
      { id: 'yes', label: 'Sí' },
      { id: 'no', label: 'No: resolver la trampa' },
    ], { kind: 'custom', id: 'cn-tape-item', data: { cardId } }));
    return;
  }
  applyTrapItem(s, cardId);
}
registerChoice('cn-tape-item', (s, option, data) => {
  const cardId = data.cardId as string;
  if (option === 'yes') {
    const tape = findTape(s);
    if (tape) discardItem(s, tape.uid);
    s.itemDiscard.push(cardId);
    return log(s, 'La Cinta encontrada cancela la trampa.', 'good');
  }
  applyTrapItem(s, cardId);
});

function applyTrapItem(s: GameState, cardId: string): void {
  switch (cardId) {
    case 'trampa-para-osos-de-acero':
      log(s, 'Una trampa para osos te atrapa la pierna: pierdes 1 Vida y no puedes moverte hasta gastar 2 Tiempo en quitártela.', 'bad');
      s.fg.legTrap = true;
      return damageFG(s, 1);
    case 'trampa-de-gas-somnifero':
      log(s, '¡Gas somnífero! Caes dormida: termina tu fase de Acción, el Tiempo baja a cero y recuperas 1 Vida con la siesta.', 'bad');
      s.itemDiscard.push(cardId);
      s.fg.time = 0;
      if (s.phase === 'action') s.mods.actionPhaseEnding = true;
      return healFG(s, 1);
    case 'trampa-de-la-cobra-oculta':
      log(s, 'Una cobra oculta te ataca: pierde 1 Vida en cada Mantenimiento hasta que recuperes salud.', 'bad');
      s.fg.cobra = true;
      return;
  }
}

/** Quitar la trampa de la pierna (2 Tiempo). */
export function removeLegTrap(s: GameState): void {
  changeTime(s, -2);
  s.fg.legTrap = false;
  s.itemDiscard.push('trampa-para-osos-de-acero');
  log(s, 'Te sueltas la trampa de la pierna.', 'good');
}

// ---------------------------------------------------------------- cartas de Horror de Geppetto

registerEffect('cn-spare-parts', (s) => {
  const near = nearestVictims(s, s.killer.zone).filter((v) => v.role !== 'lobo');
  const zones = [...new Set(near.map((v) => v.zone))];
  if (!zones.length) return log(s, 'No hay Víctimas: Geppetto no se mueve.');
  if (zones.length > 1) return push(s, choice('Empate: ¿dónde aparece Geppetto?', zones.map((z) => ({ id: z, label: zoneName(s, z) })), { kind: 'custom', id: 'teleport-killer' }));
  teleportKiller(s, zones[0]!);
});

registerEffect('cn-loca-risa', (s) => {
  const killedBefore = s.mods.killedThisTurn;
  const dmgBefore = s.mods.damageTaken;
  const around = [s.fg.zone, ...neighbors(s, s.fg.zone, 'enemy')];
  const vs = s.victims.filter((v) => around.includes(v.zone));
  if (vs.length) log(s, 'La risa os rodea: las Víctimas de tu zona y las adyacentes entran en pánico.', 'killer');
  panicVictims(s, vs);
  const here = enemyZones(s);
  for (const v of s.victims.filter((x) => here.includes(x.zone))) killVictim(s, v, true);
  if (distance(s, s.fg.zone, s.killer.zone, 'enemy') <= 1 && !s.outcome) {
    const n = killerDef(s).bloodlust[s.killer.bloodlust]!.attack;
    log(s, `Estás cerca de Geppetto: pierdes ${n} Vida.`, 'bad');
    damageFG(s, n);
  }
  if (!s.outcome && s.mods.killedThisTurn === killedBefore && s.mods.damageTaken === dmgBefore) {
    log(s, 'Nadie ha muerto y no has sufrido daño: se resuelve la siguiente carta de Terror.');
    drawHorror(s);
  }
});

registerEffect('cn-trapped', (s) => {
  const mz = [...new Set(s.minions.map((m) => m.zone))];
  const zones = new Set<ZoneId>(mz);
  for (const z of mz) for (const n of neighbors(s, z, 'enemy')) zones.add(n);
  const vs = s.victims.filter((v) => zones.has(v.zone));
  if (!vs.length) return log(s, 'No hay Víctimas cerca de las Marionetas.');
  log(s, 'Las Víctimas cercanas a las Marionetas entran en pánico: si huyen hacia una Marioneta, mueren.', 'killer');
  panicVictims(s, vs, 1, { deathZones: mz });
});

registerEffect('cn-do-or-die', (s) => {
  const d = rollDie(s.rng);
  const half = Math.ceil(d / 2);
  log(s, `Hacer o romper: sacas un ${d}.`, 'killer', { kind: 'dice', faces: [d] });
  const canKill = realVictims(s).length >= d;
  const options = [
    { id: 'life', label: `Pierdes ${half} Vida` },
    ...(canKill ? [{ id: 'kill', label: `Mueren ${d} ${d === 1 ? 'Víctima' : 'Víctimas'} en tu lugar` }] : []),
  ];
  push(s, choice(`Hacer o romper (dado ${d})`, options, { kind: 'custom', id: 'cn-dod', data: { d, half } }));
});
registerChoice('cn-dod', (s, option, data) => {
  if (option === 'life') return damageFG(s, data.half as number);
  pushEffects(s, Array.from({ length: data.d as number }, () => eff('cn-kill-pick')), SRC_HORROR);
});

/** No hay salida: Geppetto y cada Marioneta a una Salida, repartidos por igual. */
registerEffect('cn-no-exit', (s) => {
  const queue = ['killer', ...s.minions.map((m) => m.id)];
  assignExits(s, queue, {});
});
function assignExits(s: GameState, queue: string[], assigned: Record<string, ZoneId>): void {
  const exits = locationDef(s).zones.filter((z) => z.exit).map((z) => z.id);
  if (!exits.length) return;
  let q = [...queue];
  const done = { ...assigned };
  while (q.length) {
    const counts = new Map(exits.map((z) => [z, Object.values(done).filter((x) => x === z).length] as const));
    const min = Math.min(...counts.values());
    const cands = exits.filter((z) => counts.get(z) === min);
    if (cands.length > 1) {
      push(s, choice(`No hay salida: ¿a qué Salida va ${q[0] === 'killer' ? killerDef(s).name : minionName(s)}?`, cands.map((z) => ({ id: z, label: zoneName(s, z) })), { kind: 'custom', id: 'cn-exit-pick', data: { queue: q, assigned: done } }));
      return;
    }
    done[q[0]!] = cands[0]!;
    q = q.slice(1);
  }
  for (const [who, zone] of Object.entries(done)) {
    if (who === 'killer') teleportKiller(s, zone);
    else {
      const m = s.minions.find((x) => x.id === who);
      if (m) m.zone = zone;
    }
  }
  log(s, 'Los Enemigos aparecen en las Salidas.', 'killer');
}
registerChoice('cn-exit-pick', (s, option, data) => {
  const queue = data.queue as string[];
  assignExits(s, queue.slice(1), { ...(data.assigned as Record<string, ZoneId>), [queue[0]!]: option });
});

/** ¡Traédmela!: la Marioneta más cercana va a por ti y, si te hiere, te arrastra hacia Geppetto. */
registerEffect('cn-bring-her', (s, arg) => {
  const iter = Number(arg ?? 0);
  if (!s.minions.length) return log(s, 'No hay Marionetas en el tablero.');
  const dist = distances(s, s.fg.zone, 'enemy');
  const m = [...s.minions].sort((a, b) => (dist.get(a.zone) ?? 99) - (dist.get(b.zone) ?? 99) || a.id.localeCompare(b.id))[0]!;
  pushEffects(s, [eff(`cn-bring-her-after:${m.id}:${s.mods.damageTaken}:${iter}`)], SRC_HORROR);
  startActorAction(s, `m:${m.id}`, { target: 'finalGirl', moves: 1, attacks: 1, actor: 'minions' }, SRC_HORROR);
});
registerEffect('cn-bring-her-after', (s, arg) => {
  const [, before, iter] = (arg ?? '').split(':');
  const hurt = s.mods.damageTaken > Number(before);
  if (hurt && s.fg.zone !== s.killer.zone && !s.outcome) {
    const next = [...new Set(shortestPaths(s, s.fg.zone, s.killer.zone, 'fg').map((p) => p[0]!))];
    if (next.length) {
      push(s, choice('La Marioneta te arrastra 1 espacio hacia Geppetto. ¿Por dónde?', next.map((z) => ({ id: z, label: zoneName(s, z) })), { kind: 'custom', id: 'cn-drag-fg', data: { iter: Number(iter) } }));
      return;
    }
  }
  bringHerAgain(s, Number(iter));
});
registerChoice('cn-drag-fg', (s, option, data) => {
  s.fg.zone = option;
  log(s, `Te arrastran a ${zoneName(s, option)}.`, 'bad', { kind: 'fgMove', path: [option] });
  onFgEnter(s, option);
  bringHerAgain(s, data.iter as number);
});
function bringHerAgain(s: GameState, iter: number): void {
  if (s.outcome || iter >= 8) return;
  if (s.fg.zone === s.killer.zone || !minionsAt(s, s.fg.zone).length) return log(s, '¡Traédmela! se descarta.');
  log(s, 'Hay Marionetas en tu espacio y no estás con Geppetto: se resuelve la carta de nuevo.', 'killer');
  pushEffects(s, [eff(`cn-bring-her:${iter + 1}`)], SRC_HORROR);
}

/** Showman maestro: Geppetto a tu espacio y una Marioneta en cada espacio adyacente, si es posible. */
registerEffect('cn-showman', (s) => {
  teleportKiller(s, s.fg.zone);
  const adj = neighbors(s, s.fg.zone, 'enemy');
  placeShowmanMinions(s, adj, s.minionPool.ready.length);
});
function placeShowmanMinions(s: GameState, adj: ZoneId[], left: number): void {
  if (left <= 0 || !adj.length) return;
  if (left >= adj.length) {
    for (const z of adj) {
      const id = s.minionPool.ready.shift();
      if (id) placeMinion(s, id, z);
    }
    return void log(s, 'Una Marioneta en cada espacio adyacente.', 'killer');
  }
  push(s, choice(`Showman maestro: ¿dónde pones la Marioneta? (quedan ${left})`, adj.map((z) => ({ id: z, label: zoneName(s, z) })), { kind: 'custom', id: 'cn-showman-pick', data: { adj, left } }));
}
registerChoice('cn-showman-pick', (s, option, data) => {
  const id = s.minionPool.ready.shift();
  if (id) placeMinion(s, id, option);
  placeShowmanMinions(s, (data.adj as ZoneId[]).filter((z) => z !== option), (data.left as number) - 1);
});

/** ¡Baila muñeco!: tirada de Terror. */
registerEffect('cn-dance', (s) => {
  log(s, '¡Baila muñeco!: haz una Tirada de Terror.', 'killer');
  push(s, newRoll(s, { kind: 'effect', id: 'baila-muneco', label: '¡Baila muñeco!' }));
});
registerEffectRoll('baila-muneco', (s, n) => {
  if (n >= 1) {
    if (!s.minions.length) return log(s, 'No hay Marionetas que mover.');
    return push(s, choice('Éxito: las Marionetas se mueven 1 espacio hacia…', [
      { id: 'fg', label: 'Hacia ti' },
      { id: 'victim', label: 'Hacia la Víctima más cercana' },
    ], { kind: 'custom', id: 'cn-dance-dir' }));
  }
  if (victimsIn(s, s.fg.zone).some((v) => v.role !== 'lobo')) {
    log(s, 'Fracaso: muere una Víctima de tu espacio.', 'killer');
    return pushEffects(s, [eff(`cn-kill-pick:${s.fg.zone}`)], SRC_HORROR);
  }
  log(s, 'Fracaso y no hay Víctimas en tu espacio: +2 Terror.', 'bad');
  changeTerror(s, 2);
});
registerChoice('cn-dance-dir', (s, option) => {
  const steps: Effect[] = s.minions.map((m) => eff(`cn-dance-step:${m.id}:${option}`));
  pushEffects(s, steps, SRC_HORROR);
});
registerEffect('cn-dance-step', (s, arg) => {
  const [id, dir] = (arg ?? '').split(':');
  const m = s.minions.find((x) => x.id === id);
  if (!m) return;
  if (dir === 'fg') return stepMinion(s, m.id, s.fg.zone);
  const dist = distances(s, m.zone, 'enemy');
  const pool = realVictims(s);
  if (!pool.length) return;
  const best = Math.min(...pool.map((v) => dist.get(v.zone) ?? Infinity));
  const zones = [...new Set(pool.filter((v) => (dist.get(v.zone) ?? Infinity) === best).map((v) => v.zone))];
  if (zones.length === 1) return stepMinion(s, m.id, zones[0]!);
  push(s, choice('Empate: ¿hacia qué Víctima va la Marioneta?', zones.map((z) => ({ id: z, label: zoneName(s, z) })), { kind: 'custom', id: 'cn-dance-target', data: { id: m.id } }));
});
registerChoice('cn-dance-target', (s, option, data) => stepMinion(s, data.id as string, option));

/** ¡Vienen por todas partes!: si el dado es menor que el nivel de Horror, aparecen las Marionetas restantes. */
registerEffect('cn-everywhere', (s) => {
  const face = rollDie(s.rng);
  log(s, `Dado ${face} (nivel de Horror ${level(s)}).`, 'info', { kind: 'dice', faces: [face] });
  if (face < level(s)) placeAllMinions(s, true);
  else log(s, 'No aparecen más Marionetas.');
});

/** ¡Me están ganando!: si el dado es menor que el nivel de Horror, pierdes Tiempo igual al nivel. */
registerEffect('cn-winning', (s) => {
  const face = rollDie(s.rng);
  log(s, `Dado ${face} (nivel de Horror ${level(s)}).`, 'info', { kind: 'dice', faces: [face] });
  if (face < level(s)) changeTime(s, -level(s));
});

/** ¡Cielo santo!: cada Víctima con o adyacente a una Marioneta tira un dado. */
registerEffect('cn-friends', (s) => {
  if (!s.minions.length) return;
  const mz = new Set(s.minions.map((m) => m.zone));
  const near = (z: ZoneId) => mz.has(z) || neighbors(s, z, 'enemy').some((n) => mz.has(n));
  const steps = realVictims(s).filter((v) => near(v.zone)).map((v) => eff(`cn-friend-roll:${v.id}`));
  pushEffects(s, steps, SRC_HORROR);
});
registerEffect('cn-friend-roll', (s, id) => {
  const v = s.victims.find((x) => x.id === id);
  if (!v || !s.minions.length) return;
  const face = rollDie(s.rng);
  log(s, `${capitalize(victimLabel(v))} en ${zoneName(s, v.zone)}: dado ${face}.`, 'info', { kind: 'dice', faces: [face] });
  const adj = neighbors(s, v.zone, 'victim');
  if (face === 6) {
    if (!adj.length) return;
    return push(s, choice('Un 6: mueves a la Víctima 1 espacio en cualquier dirección', [...adj.map((z) => ({ id: `${v.id}>${z}`, label: `A ${zoneName(s, z)}` })), { id: 'none', label: 'Se queda' }], { kind: 'custom', id: 'cn-victim-dest' }));
  }
  // Hacia la Marioneta más cercana.
  const dist = distances(s, v.zone, 'victim');
  const best = Math.min(...s.minions.map((m) => dist.get(m.zone) ?? Infinity));
  if (!Number.isFinite(best) || best === 0) return;
  const targets = s.minions.filter((m) => (dist.get(m.zone) ?? Infinity) === best);
  const next = [...new Set(targets.flatMap((m) => shortestPaths(s, v.zone, m.zone, 'victim').map((p) => p[0]!)))];
  if (next.length === 1) return moveVictim(s, v, next[0]!);
  push(s, choice('La Víctima se acerca a la Marioneta: ¿por dónde?', next.map((z) => ({ id: `${v.id}>${z}`, label: `A ${zoneName(s, z)}` })), { kind: 'custom', id: 'cn-victim-dest' }));
});

/** Cuerdas cuchilla de Marioneta. */
registerEffect('cn-blades', (s) => {
  const killedBefore = s.mods.killedThisTurn;
  const dmgBefore = s.mods.damageTaken;
  const around = [s.killer.zone, ...neighbors(s, s.killer.zone, 'enemy')];
  for (const v of s.victims.filter((x) => around.includes(x.zone))) killVictim(s, v, true);
  pushEffects(s, [eff('cn-blades-damage'), eff(`cn-blades-end:${killedBefore}:${dmgBefore}`)], SRC_HORROR);
});
registerEffect('cn-blades-damage', (s) => {
  if (s.outcome || distance(s, s.fg.zone, s.killer.zone, 'enemy') > 1) return;
  const cards = s.fg.hand.filter((c) => c === 'caminar' || c === 'correr').length;
  if (!cards) return damageFG(s, 2);
  const max = Math.min(2, cards);
  push(s, choice('Cuerdas cuchilla: pierdes 2 Vida. ¿Descartas cartas de Caminar o Correr para reducir el daño?', Array.from({ length: max + 1 }, (_, k) => ({ id: String(k), label: k === 0 ? 'No: pierdo 2 Vida' : `Descartar ${k} ${k === 1 ? 'carta' : 'cartas'}: pierdo ${2 - k}` })), { kind: 'custom', id: 'cn-blades-reduce' }));
});
registerChoice('cn-blades-reduce', (s, option) => {
  const k = Number(option);
  for (let i = 0; i < k; i++) {
    const c = s.fg.hand.find((x) => x === 'caminar' || x === 'correr');
    if (!c) break;
    s.fg.hand.splice(s.fg.hand.indexOf(c), 1);
    s.actionDiscard.push(c);
  }
  damageFG(s, 2 - k);
});
registerEffect('cn-blades-end', (s, arg) => {
  const [killedBefore, dmgBefore] = (arg ?? '0:0').split(':').map(Number);
  if (s.outcome) return;
  if (s.mods.killedThisTurn === killedBefore && s.mods.damageTaken === dmgBefore) {
    log(s, 'Nadie ha muerto y no has sufrido daño: se resuelve la siguiente carta de Terror.');
    drawHorror(s);
  }
});

// ---------------------------------------------------------------- cartas de Horror de Carnival of Blood

registerEffect('cn-ambush', (s) => {
  const forest = 'bosque-horrores';
  const zones = [forest, ...neighbors(s, forest, 'enemy')];
  const vs = s.victims.filter((v) => zones.includes(v.zone));
  const killedBefore = s.mods.killedThisTurn;
  if (vs.length) log(s, 'Todas las Víctimas cerca del Bosque de los Horrores entran en pánico: con un 1 mueren.', 'killer');
  panicVictims(s, vs, 1, { deathFace: 1 });
  if (s.mods.killedThisTurn > killedBefore) {
    log(s, 'Ha muerto alguien: +1 Terror.', 'bad');
    changeTerror(s, 1);
  } else {
    log(s, 'No ha muerto nadie: se resuelve la siguiente carta de Terror.');
    drawHorror(s);
  }
});

registerEffect('cn-panic-all', (s) => {
  if (!s.victims.length) return;
  log(s, 'Todas las Víctimas entran en pánico.', 'killer');
  panicVictims(s, [...s.victims]);
});

/** ¿Cómo puede haber tantas trampas?: rebaraja los mazos con los Objetos Trampa descartados. */
registerEffect('cn-rebuild', (s) => {
  const traps = s.itemDiscard.filter((id) => itemDef(s, id).trap);
  if (!traps.length) {
    log(s, 'No hay Objetos Trampa en el descarte: se descarta la carta y se roba la siguiente.');
    return drawHorror(s);
  }
  const decks = locationDef(s).itemDecks;
  const pool: string[] = [];
  for (const z of decks) {
    const deck = s.itemDecks[z] ?? [];
    pool.push(...deck.filter((c) => !c.faceUp).map((c) => c.id));
    s.itemDecks[z] = deck.filter((c) => c.faceUp);
  }
  s.itemDiscard = s.itemDiscard.filter((id) => !itemDef(s, id).trap);
  pool.push(...traps);
  const shuffled = shuffle(s.rng, pool);
  shuffled.forEach((id, i) => s.itemDecks[decks[i % decks.length]!]!.push({ id, faceUp: false }));
  for (const z of decks) {
    const deck = s.itemDecks[z]!;
    if (deck.length && !deck[0]!.faceUp) deck[0]!.faceUp = true;
  }
  s.infoSeq++;
  log(s, 'Los mazos de Objetos se rebarajan con los Objetos Trampa descartados.', 'killer');
  pushEffects(s, [{ kind: 'killerAction', action: { target: 'victim', moves: 1, attacks: 1 } }, { kind: 'terror', amount: 1 }], SRC_HORROR);
});

/** ¿Esto es un apoyo?: descartas un Objeto al azar o, si no tienes, la carta superior del mazo más cercano. */
registerEffect('cn-support', (s) => {
  if (s.fg.items.length) {
    const it = pick(s.rng, s.fg.items);
    log(s, `Descartas al azar ${itemDef(s, it.id).name}.`, 'bad');
    return discardItem(s, it.uid);
  }
  const dist = distances(s, s.fg.zone, 'fg');
  const decks = locationDef(s).itemDecks.filter((z) => s.itemDecks[z]?.length);
  if (!decks.length) return log(s, 'No tienes Objetos ni quedan mazos.');
  const best = Math.min(...decks.map((z) => dist.get(z) ?? 99));
  const near = decks.filter((z) => (dist.get(z) ?? 99) === best);
  if (near.length > 1) return push(s, choice('Empate: ¿de qué mazo se descarta la carta superior?', near.map((z) => ({ id: z, label: zoneName(s, z) })), { kind: 'custom', id: 'cn-support-deck' }));
  discardTop(s, near[0]!);
});
registerChoice('cn-support-deck', (s, option) => discardTop(s, option));
function discardTop(s: GameState, zone: ZoneId): void {
  const c = s.itemDecks[zone]!.shift();
  if (!c) return;
  s.infoSeq++;
  s.itemDiscard.push(c.id);
  if (s.itemDecks[zone]![0]) s.itemDecks[zone]![0]!.faceUp = true;
  log(s, `Se descarta ${itemDef(s, c.id).name} del mazo de ${zoneName(s, zone)}.`, 'bad');
}

/** Todas las Víctimas se mueven 1 espacio hacia una zona. */
registerEffect('cn-victims-toward', (s, zone) => victimsStepToward(s, [zone!]));
function victimsStepToward(s: GameState, targets: ZoneId[]): void {
  const groups = new Map<ZoneId, Victim[]>();
  for (const v of s.victims) if (!targets.includes(v.zone)) groups.set(v.zone, [...(groups.get(v.zone) ?? []), v]);
  for (const [from, vs] of groups) {
    const paths = targets.flatMap((t) => shortestPaths(s, from, t, 'victim'));
    if (!paths.length) continue;
    const shortest = Math.min(...paths.map((p) => p.length));
    const next = [...new Set(paths.filter((p) => p.length === shortest).map((p) => p[0]!))];
    if (next.length > 1) {
      push(s, choice(`Empate: ¿hacia dónde van las Víctimas de ${zoneName(s, from)}?`, next.map((z) => ({ id: z, label: zoneName(s, z) })), { kind: 'custom', id: 'victims-step', data: { from } }));
      continue;
    }
    for (const v of vs) moveVictim(s, v, next[0]!);
  }
}

registerEffect('cn-killer-to', (s, zone) => teleportKiller(s, zone!));

/** ¿Cómo se ha escapado el león?: en las Jaulas y adyacentes mueren las Víctimas, los Enemigos reciben 1 de daño y tú pierdes 1 Vida. */
registerEffect('cn-lion', (s) => {
  const cages = 'jaulas-animales';
  const zones = [cages, ...neighbors(s, cages, 'enemy')];
  log(s, 'El león ataca en las Jaulas de los Animales y alrededores.', 'killer');
  for (const v of s.victims.filter((x) => zones.includes(x.zone))) killVictim(s, v, false);
  damageEnemiesIn(s, zones, 1);
  if (!s.outcome && zones.includes(s.fg.zone)) {
    log(s, 'Estás cerca de las Jaulas: pierdes 1 Vida.', 'bad');
    damageFG(s, 1);
  }
});

// ---------------------------------------------------------------- Eventos

export function carnivalEventRevealed(s: GameState, custom: string): void {
  switch (custom) {
    case 'ev-golf-cart': {
      const corners = ['entrada', 'bosque-horrores', 'salida', 'noria'];
      return push(s, choice('Transporte de empleados: ¿en qué esquina colocas el Carro de Golf?', corners.map((z) => ({ id: z, label: zoneName(s, z) })), { kind: 'custom', id: 'cn-cart-place' }));
    }
    case 'ev-not-real': {
      placeVictims(s, 'casa-espejos', 4);
      s.tokens.push({ id: 'calavera', zone: 'bosque-horrores' });
      log(s, 'La calavera marca el Bosque de los Horrores: cualquier Víctima que esté o entre allí muere.', 'killer');
      for (const v of victimsIn(s, 'bosque-horrores')) killVictim(s, v, false);
      return;
    }
    case 'ev-sister': {
      const before = new Set(s.victims.map((v) => v.id));
      placeVictims(s, 'gran-carpa', 4);
      const fresh = s.victims.find((v) => !before.has(v.id));
      if (fresh) {
        fresh.role = 'hermana';
        fresh.special = 'white';
        log(s, 'Una de ellas es tu osada Hermana menor.', 'good');
      }
      return;
    }
    case 'ev-fiance':
      return assignRole(s, 'prometido', s.fg.zone, false);
    case 'ev-werewolf':
      return assignRole(s, 'lobo', s.fg.zone, true);
    case 'ev-too-much-junk':
      return fetchZappo(s);
  }
}

registerChoice('cn-cart-place', (s, option) => {
  s.tokens.push({ id: 'carro-de-golf', zone: option });
  log(s, `El Carro de Golf está en ${zoneName(s, option)}.`);
});

/** Demasiada basura: Zappo va a tu mochila (se busca en los mazos o en el descarte). */
function fetchZappo(s: GameState): void {
  if (s.fg.items.some((i) => i.id === 'zappo')) return log(s, 'Ya tienes a Zappo.');
  let found = false;
  for (const z of locationDef(s).itemDecks) {
    const deck = s.itemDecks[z] ?? [];
    const i = deck.findIndex((c) => c.id === 'zappo');
    if (i < 0) continue;
    deck.splice(i, 1);
    if (deck[0] && !deck[0].faceUp) deck[0].faceUp = true;
    found = true;
    break;
  }
  if (!found) {
    const i = s.itemDiscard.indexOf('zappo');
    if (i >= 0) {
      s.itemDiscard.splice(i, 1);
      found = true;
    }
  }
  if (!found) return log(s, 'Zappo ya no está en la partida.');
  s.infoSeq++;
  s.fg.items.push({ uid: `i${s.nextUid++}`, id: 'zappo', inHands: false });
  log(s, 'Zappo, el mono del carnaval, se sube a tu mochila.', 'good', undefined, { kind: 'item', id: 'zappo' });
}

/** Si pierdes a Zappo, tiras un dado menos al jugar Buscar. */
export function junkSearchPenalty(s: GameState, cardId: string): number {
  return cardId === 'buscar' && has(s, 'ev-too-much-junk') && !s.fg.items.some((i) => i.id === 'zappo') ? 1 : 0;
}

// ---------------------------------------------------------------- Mantenimiento y turno

export function carnivalUpkeep(s: GameState): void {
  const steps: Effect[] = [];
  if (s.fg.cobra) steps.push(eff('cn-cobra'));
  if (s.tokens.some((t) => t.id === 'carro-de-golf')) steps.push(eff('cn-cart'));
  if (s.victims.some((v) => v.role === 'lobo') && has(s, 'ev-werewolf')) steps.push(eff('cn-wolf'));
  if (has(s, 'ev-so-dangerous')) steps.push(eff('cn-so-dangerous'));
  if (has(s, 'ev-clowns')) steps.push(eff('cn-clowns'));
  if (steps.length) pushEffects(s, steps, { kind: 'event' });
}

registerEffect('cn-cobra', (s) => {
  log(s, 'La Cobra oculta te muerde: pierdes 1 Vida.', 'bad');
  damageFG(s, 1);
});

registerEffect('cn-so-dangerous', (s) => {
  const traps = trapZones(s);
  if (!traps.length) return;
  log(s, '¿Cómo puede ser de peligroso?: las Víctimas se acercan a la Trampa más cercana.', 'killer');
  victimsStepToward(s, traps);
});

registerEffect('cn-clowns', (s) => {
  const zones = ['gran-carpa', ...neighbors(s, 'gran-carpa', 'enemy')];
  const vs = s.victims.filter((v) => zones.includes(v.zone));
  if (!vs.length) return;
  log(s, 'Payasos por doquier: las Víctimas de la Gran Carpa y alrededores entran en pánico.', 'killer');
  panicVictims(s, vs, 1, { deathZones: enemyZones(s) });
});

/** Luna llena: el Hombre Lobo entra en pánico y ataca (Víctima ▶ tú ▶ Esbirro ▶ Asesino). */
registerEffect('cn-wolf', (s) => {
  const w = s.victims.find((v) => v.role === 'lobo');
  if (!w) return;
  panicVictims(s, [w]);
  const zone = w.zone;
  const prey = victimsIn(s, zone).filter((v) => v !== w && v.role !== 'lobo');
  if (prey.length) return askVictim(s, 'El Hombre Lobo ataca: ¿qué Víctima de su espacio muere?', 'wolfkill', prey, {});
  if (s.fg.zone === zone) {
    log(s, 'El Hombre Lobo te ataca: 2 de daño.', 'killer');
    return push(s, { t: 'attackFG', damage: 2, reduce: 0, ignore: false, by: 'wolf' });
  }
  if (minionsAt(s, zone).length) {
    log(s, `El Hombre Lobo ataca a ${minionName(s, true)}.`, 'good');
    return void damageMinionsAt(s, zone, 2);
  }
  if (s.killer.zone === zone) {
    log(s, 'El Hombre Lobo ataca a Geppetto.', 'good');
    damageKiller(s, 2);
  }
});
victimHandlers.set('wolfkill', (s, key) => {
  const v = findVictim(s, key);
  if (v) killVictim(s, v, true);
});

const RING = ['entrada', 'plaza-oeste', 'tiro-al-blanco', 'bosque-horrores', 'sendero-sur', 'salida', 'noria', 'montana-rusa'];

/** Transporte de empleados: tú y/o hasta 2 Víctimas conducís el Carro hasta 2 espacios por el borde del recinto. */
registerEffect('cn-cart', (s) => {
  const cart = s.tokens.find((t) => t.id === 'carro-de-golf');
  if (!cart) return;
  const fgHere = s.fg.zone === cart.zone;
  const vs = realVictims(s).filter((v) => v.zone === cart.zone);
  if (!fgHere && !vs.length) return;
  const options: { id: string; label: string }[] = [{ id: 'no', label: 'No lo conduzco' }];
  for (let n = 0; n <= Math.min(2, vs.length); n++) {
    if (fgHere) options.push({ id: `fg|${n}`, label: `Conduzco yo${n ? ` con ${n} ${n === 1 ? 'Víctima' : 'Víctimas'}` : ''}` });
    if (n > 0) options.push({ id: `no|${n}`, label: `Lo conducen ${n} ${n === 1 ? 'Víctima' : 'Víctimas'}` });
  }
  if (options.length === 1) return;
  push(s, choice(`Carro de Golf en ${zoneName(s, cart.zone)}: ¿quién lo conduce?`, options, { kind: 'custom', id: 'cn-cart-riders' }));
});
registerChoice('cn-cart-riders', (s, option) => {
  if (option === 'no') return;
  const cart = s.tokens.find((t) => t.id === 'carro-de-golf');
  if (!cart) return;
  const i = RING.indexOf(cart.zone);
  const dests = [1, 2, -1, -2].map((d) => RING[(i + d + RING.length * 2) % RING.length]!);
  push(s, choice('¿Hasta dónde lo llevas? (máximo 2 espacios por el borde)', [...new Set(dests)].map((z) => ({ id: z, label: zoneName(s, z) })), { kind: 'custom', id: 'cn-cart-dest', data: { riders: option } }));
});
registerChoice('cn-cart-dest', (s, option, data) => {
  const cart = s.tokens.find((t) => t.id === 'carro-de-golf');
  if (!cart) return;
  const [who, n] = (data.riders as string).split('|') as [string, string];
  const from = cart.zone;
  const riders = realVictims(s).filter((v) => v.zone === from).slice(0, Number(n));
  cart.zone = option;
  log(s, `El Carro de Golf va de ${zoneName(s, from)} a ${zoneName(s, option)}.`, 'info', { kind: 'fgMove', path: [from, option] });
  if (who === 'fg') {
    s.fg.zone = option;
    onFgEnter(s, option);
  }
  for (const v of riders) moveVictim(s, v, option);
  const targets: { id: string; label: string }[] = [];
  if (s.killer.zone === option) targets.push({ id: 'killer', label: killerDef(s).name });
  if (minionsAt(s, option).length) targets.push({ id: 'minion', label: minionName(s, true) });
  if (targets.length && !s.outcome) {
    push(s, choice('El Carro de Golf llega a un Enemigo. ¿Lo descartas para hacerle 3 de daño?', [...targets.map((t) => ({ id: t.id, label: `Sí: 3 de daño a ${t.label}` })), { id: 'no', label: 'No' }], { kind: 'custom', id: 'cn-cart-hit', data: { zone: option } }));
  }
});
registerChoice('cn-cart-hit', (s, option, data) => {
  if (option === 'no') return;
  s.tokens = s.tokens.filter((t) => t.id !== 'carro-de-golf');
  s.activeEvents = s.activeEvents.filter((e) => e !== 'transporte-de-empleados');
  s.eventDiscard.push('transporte-de-empleados');
  log(s, 'El Carro de Golf se estrella y se descarta.', 'good');
  if (option === 'killer') damageKiller(s, 3);
  else damageMinionsAt(s, data.zone as string, 3);
});

/** Inicio del turno: ¿Soy una marioneta? */
export function carnivalTurnStart(s: GameState): void {
  if (has(s, 'mdp-am-i-puppet')) pushEffects(s, [eff('cn-puppet-check')], { kind: 'killer' });
}

registerEffect('cn-puppet-check', (s) => {
  if (distance(s, s.fg.zone, s.killer.zone, 'enemy') <= 2) return;
  const n = killerDef(s).bloodlust[s.killer.bloodlust]!.attack;
  log(s, `¿Soy una marioneta?: empiezas el turno a más de 2 espacios de Geppetto, pierdes ${n} Vida.`, 'bad');
  damageFG(s, n);
});

export function carnivalTurnEnd(s: GameState): void {
  for (const m of s.minions) m.hit = false;
}

// ---------------------------------------------------------------- Espejos por todas partes

/** Tras una tirada de ataque: por cada 1 muere una Víctima de tu espacio. */
export function mirrorsAfterRoll(s: GameState, dice: number[]): void {
  if (!has(s, 'ev-mirrors')) return;
  const ones = dice.filter((d) => d === 1).length;
  if (!ones) return;
  const here = victimsIn(s, s.fg.zone).filter((v) => v.role !== 'lobo');
  if (!here.length) return;
  const n = Math.min(ones, here.length);
  log(s, `Espejos por todas partes: ${ones} ${ones === 1 ? 'uno' : 'unos'}, mueren ${n} ${n === 1 ? 'Víctima' : 'Víctimas'} de tu espacio.`, 'killer');
  pushEffects(s, Array.from({ length: n }, () => eff(`cn-kill-pick:${s.fg.zone}`)), { kind: 'event' });
}

// ---------------------------------------------------------------- Habilidades de las Chicas Finales

/** Charlie: pierde 3 Vida para poner Golpe Crítico en tu mano. */
export function charlieCanUltimate(s: GameState): boolean {
  return has(s, 'ult-charlie') && !s.mods.usedThisPhase.includes('ult-charlie') && s.fg.health.hp > 3 && (s.actionTable['golpe-critico'] ?? 0) > 0 && s.fg.hand.length < 10;
}
export function charlieUltimate(s: GameState): void {
  s.mods.usedThisPhase.push('ult-charlie');
  log(s, 'Habilidad Definitiva de Charlie: pierdes 3 Vida y coges Golpe crítico.', 'good');
  damageFG(s, 3);
  if (s.outcome) return;
  s.actionTable['golpe-critico']!--;
  s.fg.hand.push('golpe-critico');
}
