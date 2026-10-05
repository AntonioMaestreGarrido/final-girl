import type { Effect, ZoneId } from '../content/types';
import { actionDef, boardDef, closedZone, distances, eventDef, fgDef, itemDef, killerDef, locationDef, neighbors, victimCanEnter, zoneDef, zoneName } from './lookup';
import { pick, rollDie } from './rng';
import type { EffectSource, GameState, LogEntry, Phase, Task, Victim } from './state';

// ---------------------------------------------------------------- utilidades

export function log(s: GameState, text: string, tone: LogEntry['tone'] = 'info', anim?: LogEntry['anim'], card?: LogEntry['card']): void {
  s.log.push({ turn: s.turn, phase: s.phase, text, tone, ...(anim ? { anim } : {}), ...(card ? { card } : {}) });
}

export const uid = (s: GameState, prefix: string) => `${prefix}${s.nextUid++}`;

/** Apila tareas; la primera de la lista se resuelve primero. */
export function push(s: GameState, ...tasks: Task[]): void {
  for (let i = tasks.length - 1; i >= 0; i--) s.stack.push(tasks[i]!);
}

export const pushEffects = (s: GameState, effects: Effect[], src: EffectSource) => {
  if (effects.length) push(s, { t: 'effects', effects, i: 0, src });
};

export class RuleError extends Error {}

// Reglas que se comprueban cada vez que el Asesino entra en una zona (El hombre sagrado).
const killerEnterHooks: ((s: GameState) => void)[] = [];
export const registerKillerEnter = (fn: (s: GameState) => void) => killerEnterHooks.push(fn);
export function onKillerEnter(s: GameState): void {
  for (const fn of killerEnterHooks) fn(s);
}

// Reglas que reaccionan a muertes, entradas de Víctimas y subidas de Terror (Carnage at the Carnival).
type VictimHook = (s: GameState, v: Victim, zone: ZoneId) => void;
const victimEnterHooks: VictimHook[] = [];
export const registerVictimEnters = (fn: VictimHook) => victimEnterHooks.push(fn);
const victimKilledHooks: ((s: GameState, v: Victim, zone: ZoneId, opts: KillOpts) => void)[] = [];
export const registerVictimKilled = (fn: (s: GameState, v: Victim, zone: ZoneId, opts: KillOpts) => void) => victimKilledHooks.push(fn);
const terrorUpHooks: ((s: GameState) => void)[] = [];
export const registerTerrorUp = (fn: (s: GameState) => void) => terrorUpHooks.push(fn);

const NEXT_PHASE: Record<Phase, Phase> = {
  setup: 'action',
  action: 'planning',
  planning: 'killer',
  killer: 'panic',
  panic: 'upkeep',
  upkeep: 'action',
};

/** Termina la fase en curso: descarta todo lo pendiente y pasa a la siguiente. */
export function endPhaseNow(s: GameState, reason?: string): void {
  if (reason) log(s, reason, 'phase');
  if (s.phase === 'action') resetActionPhaseMods(s);
  s.stack = [{ t: 'phase', phase: NEXT_PHASE[s.phase], step: 0 }];
  s.prompt = null;
}

export function resetActionPhaseMods(s: GameState): void {
  s.mods.partialsThisPhase = false;
  s.mods.usedThisPhase = [];
  s.mods.rescuedThisActionPhase = 0;
  s.mods.actionPhaseEnding = false;
}

export { NEXT_PHASE };

// ---------------------------------------------------------------- habilidades activas

/** Ids `custom` en juego: poderes, eventos, habilidad definitiva, objetos utilizables y Gran Final. */
export function activeCustoms(s: GameState): Set<string> {
  const out = new Set<string>();
  const k = killerDef(s);
  for (const dp of s.killer.darkPowers) if (dp.revealed) out.add(k.darkPowers.find((d) => d.id === dp.id)!.custom);
  for (const m of s.killer.minors) {
    const card = k.horror.find((h) => h.id === m.id) ?? locationDef(s).horror.find((h) => h.id === m.id);
    if (card?.minorDarkPower) out.add(card.minorDarkPower.custom);
  }
  for (const id of s.activeEvents) {
    const c = eventDef(s, id).custom;
    if (c) out.add(c);
  }
  if (s.fg.ultimate) out.add(fgDef(s).ultimate.custom);
  for (const it of s.fg.items) {
    const def = itemDef(s, it.id);
    if (def.custom && usable(s, it)) out.add(def.custom);
  }
  if (s.killer.finaleRevealed) {
    const f = k.finales.find((x) => x.id === s.killer.finale);
    if (f?.custom) out.add(f.custom);
  }
  for (const id of s.activeHorror ?? []) {
    const card = k.horror.find((h) => h.id === id) ?? locationDef(s).horror.find((h) => h.id === id);
    if (card?.stays) out.add(card.stays);
  }
  return out;
}

export const has = (s: GameState, custom: string) => activeCustoms(s).has(custom);

/** Un objeto se puede usar si no necesita manos o está en las manos, y si es de su Chica Final. */
export function usable(s: GameState, it: GameState['fg']['items'][number]): boolean {
  const def = itemDef(s, it.id);
  if (def.onlyFor && def.onlyFor !== s.fg.id) return false;
  return def.hands === 0 || it.inHands;
}

export const itemsWith = (s: GameState, custom: string) =>
  s.fg.items.filter((it) => itemDef(s, it.id).custom === custom && usable(s, it));

// ---------------------------------------------------------------- Tiempo y Terror

export function changeTime(s: GameState, amount: number): void {
  const max = boardDef(s).maxTime;
  if (amount > 0) {
    if (s.fg.time < 0) return log(s, 'El Tiempo está bajo cero: no se puede recuperar.');
    s.fg.time = Math.min(max, s.fg.time + amount);
    log(s, `+${amount} Tiempo (${s.fg.time}).`, 'good');
  } else if (amount < 0) {
    s.fg.time = Math.max(-1, s.fg.time + amount);
    log(s, `${amount} Tiempo (${s.fg.time < 0 ? 'bajo cero' : s.fg.time}).`, 'bad');
    if (s.fg.time < 0) {
      if (s.phase === 'action') s.mods.actionPhaseEnding = true;
      else s.mods.skipNextActionPhase = true;
    }
  }
}

export function changeTerror(s: GameState, amount: number): void {
  const last = boardDef(s).terrorTrack.length - 1;
  for (let n = 0; n < Math.abs(amount); n++) {
    if (amount > 0) {
      if (s.fg.terror >= last) {
        log(s, 'El Terror ya está al máximo: aumenta la Sed de Sangre.', 'bad');
        increaseBloodlust(s, 1);
      } else s.fg.terror++;
    } else if (s.fg.terror <= 0) {
      log(s, 'El Terror ya está al mínimo: +1 Tiempo.', 'good');
      changeTime(s, 1);
    } else s.fg.terror--;
  }
  if (amount) log(s, `${amount > 0 ? '+' : ''}${amount} Terror (${terrorLabel(s)}).`, amount > 0 ? 'bad' : 'good');
  if (amount > 0) for (const fn of terrorUpHooks) fn(s);
}

/** Nivel de Terror como número: casilla verde 0, 1-6, casilla roja 7 (decisión del usuario). */
export const terrorPosition = (s: GameState): number => s.fg.terror;

export function terrorLabel(s: GameState): string {
  const pos = boardDef(s).terrorTrack[s.fg.terror]!;
  return pos.label === null ? (s.fg.terror === 0 ? 'casilla verde' : 'casilla roja') : `nivel ${pos.label}`;
}

// ---------------------------------------------------------------- Vida

export function healFG(s: GameState, amount: number, src?: EffectSource): void {
  if (s.fg.cobra && amount > 0) {
    s.fg.cobra = false;
    return log(s, 'La Cobra oculta se descarta en lugar de que recuperes Vida.', 'good');
  }
  let total = amount;
  if (src?.kind === 'action' && !src.healBonusApplied && has(s, 'item-first-aid')) {
    total++;
    src.healBonusApplied = true;
  }
  const before = s.fg.health.hp;
  s.fg.health.hp = Math.min(s.fg.health.max, s.fg.health.hp + total);
  log(s, `${fgDef(s).name} recupera ${s.fg.health.hp - before} Vida (${s.fg.health.hp}/${s.fg.health.max}).`, 'good');
}

/** Daño o pérdida de Vida de la Chica Final. Devuelve false si la partida ha terminado. */
export function damageFG(s: GameState, amount: number): void {
  if (amount <= 0 || s.outcome) return;
  s.fg.health.hp -= amount;
  s.mods.damageTaken = (s.mods.damageTaken ?? 0) + amount;
  log(s, `${fgDef(s).name} pierde ${amount} Vida.`, 'bad');
  if (has(s, 'item-tribal-mask')) {
    log(s, `Máscara tribal: reduces una Ira en ${amount}.`, 'good');
    pushEffects(s, [{ kind: 'wrath', which: 'choose', op: 'reduce', amount }], { kind: 'item', id: 'mascara-tribal' });
  }
  if (s.fg.health.hp > 0) return;
  revealFinalLife(s, 'fg');
}

export function healKiller(s: GameState, amount: number): void {
  const before = s.killer.health.hp;
  s.killer.health.hp = Math.min(s.killer.health.max, s.killer.health.hp + amount);
  log(s, `${killerDef(s).name} recupera ${s.killer.health.hp - before} Vida (${s.killer.health.hp}).`, 'killer');
}

/** Daño de la Chica Final al Asesino: primero a los Poderes Oscuros Menores. */
export function damageKiller(s: GameState, amount: number): void {
  if (amount <= 0 || s.outcome) return;
  log(s, `¡${amount} de daño a ${killerDef(s).name}!`, 'good');
  let left = amount;
  while (left > 0 && s.killer.minors.length) {
    const m = s.killer.minors[0]!;
    const hit = Math.min(left, m.hp);
    m.hp -= hit;
    left -= hit;
    if (m.hp <= 0) {
      s.killer.minors.shift();
      s.horrorDiscard.push(m.id);
      log(s, `El Poder Oscuro Menor se descarta.`, 'good');
    }
  }
  if (left <= 0) return;
  s.killer.health.hp -= left;
  if (s.killer.health.hp > 0) return;
  // Maestro inmortal: con todas las Marionetas en el tablero, Geppetto no puede perder su ficha de Vida Final.
  const def = killerDef(s).minion;
  if (def && s.minions.length >= def.count && has(s, 'dp-immortal-master')) {
    s.killer.health.hp = 1;
    return log(s, `Maestro inmortal: con las ${def.count} ${def.plural} en el tablero, ${killerDef(s).name} ignora el daño que lo mataría.`, 'killer');
  }
  revealFinalLife(s, 'killer');
}

function revealFinalLife(s: GameState, who: 'fg' | 'killer'): void {
  const h = who === 'fg' ? s.fg.health : s.killer.health;
  const name = who === 'fg' ? fgDef(s).name : killerDef(s).name;
  s.infoSeq++;
  if (h.token === 'black' && h.hidden > 0) {
    h.token = 'white';
    h.hp = h.hidden;
    log(s, `Se revela la ficha de Vida Final de ${name}: ¡${h.hidden} ${h.hidden === 1 ? 'Vida' : 'Vidas'}! Vuelve a levantarse.`, who === 'fg' ? 'good' : 'killer');
    h.hidden = 0;
    if (!s.outcome) endPhaseNow(s, 'La fase termina inmediatamente.');
    return;
  }
  h.hp = 0;
  if (h.token === 'black') log(s, `Se revela la ficha de Vida Final de ${name}: está en blanco.`, 'phase');
  if (who === 'killer') {
    s.outcome = { winner: 'finalGirl', text: `${name} ha muerto. ¡${fgDef(s).name} sobrevive!` };
  } else if (s.killer.health.hp <= 0) {
    s.outcome = { winner: 'finalGirl', text: `${name} se ha sacrificado para acabar con ${killerDef(s).name}.` };
  } else {
    s.outcome = { winner: 'killer', text: `${name} ha muerto. ${killerDef(s).name} gana.` };
  }
  log(s, s.outcome.text, 'phase');
  s.stack = [];
  s.prompt = null;
}

/** Subidón de adrenalina: +1 dado por cada uno (Chica Final / Asesino) al que solo le quede la Vida Final. */
export function adrenalineDice(s: GameState): number {
  return (s.fg.health.hp === 1 ? 1 : 0) + (s.killer.health.hp === 1 ? 1 : 0);
}

// ---------------------------------------------------------------- Sed de Sangre

export function increaseBloodlust(s: GameState, amount: number): void {
  const k = killerDef(s);
  const effects: Effect[] = [];
  for (let n = 0; n < amount; n++) {
    const last = k.bloodlust.length - 1;
    if (s.killer.bloodlust >= last) {
      log(s, 'La Sed de Sangre está al máximo: se aplica el efecto final.', 'killer');
      effects.push(...k.bloodlustMaxEffect);
      continue;
    }
    s.killer.bloodlust++;
    const row = k.bloodlust[s.killer.bloodlust]!;
    log(s, `La Sed de Sangre aumenta (Ataque ${row.attack}, Movimiento ${row.move}).`, 'killer');
    effects.push(...row.effects);
    if (row.revealDarkPower) revealDarkPowers(s);
    const extra = locationDef(s).bloodlustTrack?.rows[s.killer.bloodlust - 1];
    if (extra?.effects.length) {
      log(s, `Track de Sed de Sangre de ${locationDef(s).name}: ${extra.text}`, 'killer');
      effects.push(...extra.effects);
    }
  }
  pushEffects(s, effects, { kind: 'bloodlust' });
}

export function revealDarkPowers(s: GameState): void {
  for (const dp of s.killer.darkPowers) {
    if (dp.revealed) continue;
    dp.revealed = true;
    s.infoSeq++;
    const def = killerDef(s).darkPowers.find((d) => d.id === dp.id)!;
    log(s, `¡Se revela el Poder Oscuro: ${def.name}! ${def.text}`, 'killer', undefined, { kind: 'darkPower', id: def.id });
  }
}

export const killerRow = (s: GameState) => killerDef(s).bloodlust[s.killer.bloodlust]!;

// ---------------------------------------------------------------- Víctimas

export function placeVictims(s: GameState, zone: ZoneId, count: number): void {
  if (closedZone(s) === zone) return log(s, `${zoneName(s, zone)} está cerrado: no se colocan Víctimas.`);
  const n = Math.min(count, s.victimPool);
  if (n < count) log(s, `No quedan Víctimas suficientes en la caja (${n} de ${count}).`);
  const placed: Victim[] = [];
  for (let i = 0; i < n; i++) {
    const v = { id: uid(s, 'v'), zone };
    s.victims.push(v);
    placed.push(v);
  }
  s.victimPool -= n;
  if (n) log(s, `${n} ${n === 1 ? 'nueva Víctima' : 'nuevas Víctimas'} en ${zoneName(s, zone)}.`);
  if (zone === 'lago' && n) applyDarkWaters(s);
  for (const v of placed) for (const fn of victimEnterHooks) if (s.victims.includes(v)) fn(s, v, zone);
}

const ROLE_LABEL = {
  novio: 'el Novio',
  novia: 'la Novia',
  maldita: 'la Maldita',
  super: 'el Super Turista',
  hombre: 'el Hombre Sagrado',
  guia: 'el Guía Turístico',
  prometido: 'tu Prometido',
  hermana: 'tu Hermana',
  lobo: 'el Hombre Lobo',
} as const;

export const victimLabel = (v: Pick<Victim, 'role'>) => (v.role ? ROLE_LABEL[v.role] : 'una Víctima');

/** Evento asociado a cada papel especial. */
export const ROLE_EVENT = {
  novio: 'novio',
  novia: 'novia',
  maldita: 'venganza',
  super: 'el-super-turista',
  hombre: 'el-hombre-sagrado',
  guia: 'el-guia-turistico',
  prometido: 'corre-yo-les-entretendre',
  hermana: 'me-seguiste-hasta-aqui',
  lobo: 'luna-llena',
} as const;

/** Una Víctima abandona la partida (muerta o salvada): descarta su Evento asociado. */
export function victimLeaves(s: GameState, v: Victim): void {
  const eventFor = ROLE_EVENT;
  if (!v.role) return;
  const ev = eventFor[v.role];
  if (s.activeEvents.includes(ev)) {
    s.activeEvents = s.activeEvents.filter((e) => e !== ev);
    s.eventDiscard.push(ev);
    log(s, `Se descarta el Evento ${eventDef(s, ev).name}.`);
  }
}

export interface KillOpts {
  /** No aumenta la Sed de Sangre (Habilidad Definitiva de Barbara). */
  noBloodlust?: boolean;
  /** Segunda muerte de Oscuro relámpago (no encadena otra). */
  chained?: boolean;
  /** Muerta por una trampa (Prometido: +5 Terror). */
  byTrap?: boolean;
}

export function killVictim(s: GameState, v: Victim, byKiller: boolean, opts: KillOpts = {}): void {
  if (!s.victims.includes(v)) return;
  if (v.role === 'lobo') return log(s, 'El Hombre Lobo no puede ser asesinado.', 'info');
  const zoneBefore = v.zone;
  const othersBefore = s.victims.filter((x) => x.zone === zoneBefore && x !== v);
  s.victims = s.victims.filter((x) => x !== v);
  s.dead.push(v);
  s.mods.killedThisTurn++;
  if (s.phase === 'killer') s.mods.killedThisKillerPhase++;
  log(s, `Muere ${victimLabel(v)} en ${zoneName(s, zoneBefore)}.`, 'killer');
  victimLeaves(s, v);

  const customs = activeCustoms(s);
  const inFgZone = zoneBefore === s.fg.zone;
  for (const fn of victimKilledHooks) fn(s, v, zoneBefore, opts);
  if (v.role === 'novio' && inFgZone) {
    s.mods.timeAtNextAction = 12;
    log(s, 'El Novio ha muerto en tu zona: empezarás la próxima fase de Acción con 12 de Tiempo.', 'good');
  }
  if (v.role === 'novia' && inFgZone) {
    log(s, 'La Novia ha muerto en tu zona: +5 Terror.', 'bad');
    changeTerror(s, 5);
  }
  if (v.role === 'maldita') {
    log(s, 'La Maldita ha muerto: +2 Sed de Sangre.', 'killer');
    increaseBloodlust(s, 2);
  }
  if (v.role === 'super') {
    log(s, 'El Super Turista ha muerto: la Ira Divina aumenta en 4.', 'killer');
    pushEffects(s, [{ kind: 'wrath', which: 'divine', op: 'increase', amount: 4 }], { kind: 'event' });
  }
  if (v.role === 'guia') {
    log(s, 'El Guía Turístico ha muerto: la Ira Divina aumenta en 6.', 'killer');
    pushEffects(s, [{ kind: 'wrath', which: 'divine', op: 'increase', amount: 6 }], { kind: 'event' });
  }
  if (customs.has('ev-unholy-slaughter') && zoneDef(s, zoneBefore).sacred) {
    log(s, 'Matanza impía: una Víctima muere en un espacio Sagrado.', 'killer');
    pushEffects(s, [{ kind: 'unleash', which: 'divine' }], { kind: 'event' });
  }
  if (byKiller && !opts.chained && customs.has('dp-dark-lightning')) darkLightning(s, zoneBefore);
  if (opts.noBloodlust) return;
  increaseBloodlust(s, 1);
  if (byKiller && customs.has('dp-blood-frenzy')) increaseBloodlust(s, 1);
  if (byKiller && customs.has('dp-feed')) healKiller(s, 1);
  if (customs.has('ev-star-crossed-lovers') && othersBefore.length === 1) {
    log(s, 'Desafortunados amantes: la otra Víctima muere también.', 'killer');
    killVictim(s, othersBefore[0]!, false);
  }
}

/** Oscuro relámpago: mata a una segunda Víctima en ese espacio o en uno adyacente. */
function darkLightning(s: GameState, zone: ZoneId): void {
  const zones = [zone, ...neighbors(s, zone, 'enemy')].filter((z) => s.victims.some((v) => v.zone === z));
  if (!zones.length) return;
  if (zones.length === 1 && new Set(s.victims.filter((v) => v.zone === zones[0]).map((v) => v.role ?? '')).size === 1) {
    log(s, 'Oscuro relámpago: cae otra Víctima.', 'killer');
    return killVictim(s, s.victims.find((v) => v.zone === zones[0])!, true, { chained: true });
  }
  const options = zones.flatMap((z) =>
    [...new Set(s.victims.filter((v) => v.zone === z).map((v) => v.role ?? ''))].map((r) => ({
      id: `${z}|${r}`,
      label: `${capitalize(victimLabel({ role: r || undefined }))} en ${zoneName(s, z)}`,
    })),
  );
  push(s, { t: 'choice', title: 'Oscuro relámpago: ¿qué otra Víctima muere?', options, then: { kind: 'custom', id: 'dark-lightning' } });
}

/** Descarta al azar cartas de Acción de la mano. */
export function discardRandomActions(s: GameState, count: number, why: string): void {
  for (let i = 0; i < count && s.fg.hand.length; i++) {
    const card = pick(s.rng, s.fg.hand);
    s.fg.hand.splice(s.fg.hand.indexOf(card), 1);
    s.actionDiscard.push(card);
    log(s, `${why}: descartas al azar ${actionDef(card).name}.`, 'bad');
  }
}

/** Huida de varias Víctimas (con Fotografía con flash si alguna estaba en tu zona). */
export function panicVictims(s: GameState, victims: Victim[], times = 1, opts: FleeOpts = {}): void {
  const inFgZone = victims.some((v) => v.zone === s.fg.zone);
  for (let n = 0; n < times; n++) for (const v of victims) if (s.victims.includes(v)) victimFlees(s, v, opts);
  if (inFgZone && victims.length && has(s, 'ev-flash-photo')) discardRandomActions(s, 1, 'Fotografía con flash');
}

/** Aguas oscuras: toda Víctima que esté o entre en el Lago muere. */
export function applyDarkWaters(s: GameState): void {
  if (!s.activeEvents.includes('aguas-oscuras')) return;
  for (const v of s.victims.filter((x) => x.zone === 'lago')) {
    log(s, 'Aguas oscuras se cobra una Víctima en el Lago.', 'killer');
    killVictim(s, v, false);
  }
}

export function moveVictim(s: GameState, v: Victim, to: ZoneId): void {
  v.zone = to;
  if (to === 'lago') applyDarkWaters(s);
  for (const fn of victimEnterHooks) if (s.victims.includes(v)) fn(s, v, to);
}

/** Huida: tira un dado y mueve la Víctima según los números de su zona. */
export interface FleeOpts {
  /** La Víctima muere si saca este número en lugar de huir (Brumosa emboscada). */
  deathFace?: number;
  /** La Víctima muere si huye a una de estas zonas (Marionetas, Payasos por doquier). */
  deathZones?: ZoneId[];
}

export function victimFlees(s: GameState, v: Victim, opts: FleeOpts = {}): void {
  const face = rollDie(s.rng);
  if (opts.deathFace === face) {
    log(s, `${capitalize(victimLabel(v))} entra en pánico (dado ${face}) y no sobrevive.`, 'killer', { kind: 'dice', faces: [face] });
    return killVictim(s, v, false);
  }
  const exit = zoneDef(s, v.zone).flee.find((f) => f.faces.includes(face));
  const from = v.zone;
  if (exit && !victimCanEnter(s, from, exit.to)) {
    log(s, `${capitalize(victimLabel(v))} huye (dado ${face}) hacia ${zoneName(s, exit.to)}, pero no puede pasar: se queda.`, 'info', { kind: 'dice', faces: [face] });
    return;
  }
  if (!exit) {
    log(s, `${capitalize(victimLabel(v))} huye (dado ${face}) pero se queda en ${zoneName(s, from)}.`, 'info', { kind: 'dice', faces: [face] });
    return;
  }
  log(s, `${capitalize(victimLabel(v))} huye (dado ${face}) de ${zoneName(s, from)} a ${zoneName(s, exit.to)}.`, 'info', {
    kind: 'victimMove',
    victim: v.id,
    path: [from, exit.to],
  });
  moveVictim(s, v, exit.to);
  if (s.victims.includes(v) && opts.deathZones?.includes(exit.to)) {
    log(s, `${capitalize(victimLabel(v))} huye hacia un Enemigo y muere.`, 'killer');
    killVictim(s, v, false);
  }
}

export const capitalize = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** Víctimas más cercanas a una zona (excluyendo opcionalmente la propia zona). */
export function nearestVictims(s: GameState, from: ZoneId, opts: { farthest?: boolean; excludeZone?: boolean } = {}): Victim[] {
  const dist = distances(s, from, 'enemy');
  const pool = s.victims.filter((v) => !(opts.excludeZone && v.zone === from));
  if (!pool.length) return [];
  const ds = pool.map((v) => dist.get(v.zone) ?? Infinity);
  const best = opts.farthest ? Math.max(...ds) : Math.min(...ds);
  return pool.filter((_, i) => ds[i] === best);
}
