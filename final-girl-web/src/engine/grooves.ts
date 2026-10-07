/**
 * Reglas propias de Slaughter in the Groves (Inkanyamba / Sacred Groves / Adelaide / Barbara):
 * efectos únicos de cartas, Eventos, el Hombre Sagrado, objetos nuevos y Habilidades Definitivas.
 * El resto del motor llama a estas funciones o las registra por id.
 */
import type { WrathId, ZoneId } from '../content/types';
import {
  capitalize,
  changeTime,
  damageKiller,
  has,
  healFG,
  killVictim,
  log,
  moveVictim,
  onKillerEnter,
  registerKillerEnter,
  panicVictims,
  push,
  pushEffects,
  victimLabel,
  victimLeaves,
} from './core';
import { gainActionCard, spendUse, teleportKiller } from './effects';
import { choice, registerChoice, registerEffect } from './registry';
import { actionDef, closedZone, killerDef, locationDef, neighbors, shortestPaths, victimCanEnter, victimsIn, zoneDef, zoneName } from './lookup';
import { newRoll, registerEffectRoll } from './player';
import { rollDie } from './rng';
import type { GameState, Victim } from './state';
import { applyWrath, increaseWrath, reduceWrath, unleashWrath, wrathName, wrathOp, wrathsInPlay, type WrathOp } from './wrath';

// ---------------------------------------------------------------- Ira

registerChoice('wrath-op', (s, option, data) => wrathOp(s, option as WrathId, data.op as WrathOp, data.amount as number));

// ---------------------------------------------------------------- Tiradas de Terror pedidas por cartas

const ROLL_LABEL: Record<string, string> = {
  'caracter-voluble': 'Carácter voluble',
  'ira-hirviendo': 'Ira hirviendo',
  'temperamento-volatil': 'Temperamento volátil',
  volubilidad: 'La volubilidad de los dioses',
};

registerEffect('roll', (s, id) => {
  if (!id) return;
  log(s, `${ROLL_LABEL[id] ?? id}: haz una Tirada de Terror.`, 'killer');
  push(s, newRoll(s, { kind: 'effect', id, label: ROLL_LABEL[id] ?? id }));
});

registerEffectRoll('caracter-voluble', (s, n) => {
  if (n >= 2) return applyWrath(s, 'choose', 'halve', 0);
  if (n === 1) return applyWrath(s, 'choose', 'reduce', 1);
  pushEffects(s, [{ kind: 'unleash', which: 'killer' }, { kind: 'wrath', which: 'killer', op: 'increase', by: 'dieRoll' }], { kind: 'horror' });
});
registerEffectRoll('ira-hirviendo', (s, n) => {
  if (!n) increaseWrath(s, 'killer', 1);
});
registerEffectRoll('temperamento-volatil', (s, n) => {
  if (!n) unleashWrath(s, 'killer');
});
registerEffectRoll('volubilidad', (s, n) => {
  if (n >= 2) return applyWrath(s, 'choose', 'reduce', 1);
  if (n === 0) pushEffects(s, [{ kind: 'unleash', which: 'divine' }, { kind: 'wrath', which: 'divine', op: 'increase', by: 'sacredVictims' }], { kind: 'horror' });
});

// ---------------------------------------------------------------- efectos únicos

registerEffect('inka-initial-wrath', (s) => {
  const w = s.wrath.killer;
  if (w !== undefined && w <= 2) increaseWrath(s, 'killer', 1);
});

registerEffect('castigo-o-clemencia', (s) => {
  const w = s.wrath.killer;
  if (w === undefined) return log(s, 'No hay Ira Asesina en juego: sin efecto.');
  if (w <= 3) {
    increaseWrath(s, 'killer', 2);
    return unleashWrath(s, 'killer');
  }
  if (w <= 5) return increaseWrath(s, 'killer', 2);
  if (w <= 9) return reduceWrath(s, 'killer', 'halve');
  reduceWrath(s, 'killer', 'set', 1);
});

registerEffect('mark-damage', (s) => {
  s.mods.damageMark = s.mods.damageTaken;
});

registerEffect('divine-purge', (s) => {
  const discarded = s.fg.hand.filter((c) => c !== 'expiar');
  s.fg.hand = s.fg.hand.filter((c) => c === 'expiar');
  s.actionDiscard.push(...discarded);
  log(s, `Descartas ${discarded.length} ${discarded.length === 1 ? 'carta' : 'cartas'} de Acción.`, 'bad');
  if (discarded.length) reduceWrath(s, 'divine', 'reduce', discarded.length);
});

const sacredZones = (s: GameState) => locationDef(s).zones.filter((z) => z.sacred).map((z) => z.id);

/** Coloca al Asesino en el espacio Sagrado con más Víctimas (o en tu espacio si no quedan). */
registerEffect('killer-to-busiest-sacred', (s) => {
  const counts = sacredZones(s).map((z) => [z, victimsIn(s, z).length] as const).filter(([, n]) => n > 0);
  if (!counts.length) return teleportKiller(s, s.fg.zone);
  const most = Math.max(...counts.map(([, n]) => n));
  const tied = counts.filter(([, n]) => n === most).map(([z]) => z);
  if (tied.length === 1) return teleportKiller(s, tied[0]!);
  push(s, choice('Empate: ¿en qué espacio Sagrado aparece el Asesino?', tied.map((z) => ({ id: z, label: zoneName(s, z) })), { kind: 'custom', id: 'teleport-killer' }));
});

/** "Todas las Víctimas adyacentes a X se mueven allí" (X = una zona o cualquier espacio Sagrado). */
registerEffect('gather', (s, arg) => {
  const targets = arg === 'sacred' ? sacredZones(s) : [arg!];
  const groups = new Map<ZoneId, ZoneId[]>();
  for (const v of s.victims) {
    if (targets.includes(v.zone) || groups.has(v.zone)) continue;
    const dest = targets.filter((t) => neighbors(s, v.zone, 'enemy').includes(t) && victimCanEnter(s, v.zone, t));
    if (dest.length) groups.set(v.zone, dest);
  }
  for (const [from, dest] of groups) {
    if (dest.length > 1) {
      push(s, choice(`Empate: ¿a qué espacio Sagrado van las Víctimas de ${zoneName(s, from)}?`, dest.map((z) => ({ id: z, label: zoneName(s, z) })), { kind: 'custom', id: 'gather-to', data: { from } }));
      continue;
    }
    gatherFrom(s, from, dest[0]!);
  }
});

function gatherFrom(s: GameState, from: ZoneId, to: ZoneId): void {
  const vs = victimsIn(s, from);
  if (!vs.length) return;
  log(s, `${vs.length === 1 ? 'Una Víctima va' : `${vs.length} Víctimas van`} de ${zoneName(s, from)} a ${zoneName(s, to)}.`, 'info', { kind: 'victimMove', victim: vs[0]!.id, victims: vs.map((v) => v.id), path: [from, to] });
  for (const v of vs) moveVictim(s, v, to);
}
registerChoice('gather-to', (s, option, data) => gatherFrom(s, data.from as ZoneId, option));

// ---------------------------------------------------------------- coger cartas por coste

/** Coge cartas de Acción de la Tabla por un coste total de hasta `budget`. */
export function takeCardsByCost(s: GameState, budget: number): void {
  const options = Object.entries(s.actionTable)
    .filter(([id, n]) => n > 0 && actionDef(id).cost > 0 && actionDef(id).cost <= budget)
    .map(([id]) => ({ id, label: `${actionDef(id).name} (coste ${actionDef(id).cost})` }));
  if (!options.length || s.fg.hand.length >= 10) return;
  push(s, choice(`Coge cartas de Acción (te quedan ${budget} de coste)`, [...options, { id: 'done', label: 'No coger más' }], { kind: 'custom', id: 'cards-by-cost', data: { budget } }));
}
registerChoice('cards-by-cost', (s, option, data) => {
  if (option === 'done') return;
  gainActionCard(s, option);
  takeCardsByCost(s, (data.budget as number) - actionDef(option).cost);
});

/** Gran Final "Necesitamos un milagro": la Ira Asesina sube a 10 y coges cartas por coste 6. */
export function miracleFinale(s: GameState): void {
  if (s.wrath.killer !== undefined) {
    s.wrath.killer = 10;
    log(s, 'La Ira Asesina sube a 10.', 'killer');
  }
  takeCardsByCost(s, 6);
}

// ---------------------------------------------------------------- Habilidades Definitivas

export function adelaideUltimate(s: GameState): void {
  push(s, choice('Habilidad Definitiva de Adelaide: elige un efecto', [
    { id: 'wrath', label: 'Reduce una Ira a 1', ...(wrathsInPlay(s).length ? {} : { disabled: 'No hay ninguna Ira en juego' }) },
    { id: 'heal', label: 'Recupera toda tu Vida' },
    { id: 'cards', label: 'Coge cartas de Acción por un coste total de hasta 6' },
  ].filter((o) => !('disabled' in o)), { kind: 'custom', id: 'adelaide-ult' }));
}
registerChoice('adelaide-ult', (s, option) => {
  if (option === 'wrath') return applyWrath(s, 'choose', 'set', 1);
  if (option === 'heal') return healFG(s, s.fg.health.max);
  takeCardsByCost(s, 6);
});

/** Habilidad Definitiva de Barbara: cada punto de daño extra mata a una Víctima (sin Sed de Sangre). */
registerChoice('barbara-extra', (s, option) => {
  const n = Number(option);
  if (!n) return;
  const vs = [...victimsIn(s, s.fg.zone)].sort((a, b) => (a.role ? 1 : 0) - (b.role ? 1 : 0)).slice(0, n);
  for (const v of vs) killVictim(s, v, false, { noBloodlust: true });
  log(s, `Barbara hace ${n} de daño adicional.`, 'good');
  damageKiller(s, n);
});

registerChoice('whip-move', (s, option) => {
  if (option === 'no') return;
  const from = s.killer.zone;
  s.killer.zone = option;
  log(s, `El Látigo arrastra a ${killerDef(s).name} a ${zoneName(s, option)}.`, 'good', { kind: 'killerMove', path: [from, option] });
  onKillerEnter(s);
});

registerChoice('dark-lightning', (s, option) => {
  const [zone, role] = option.split('|') as [ZoneId, string];
  const v = s.victims.find((x) => x.zone === zone && (x.role ?? '') === role);
  if (!v) return;
  log(s, 'Oscuro relámpago: cae otra Víctima.', 'killer');
  killVictim(s, v, true, { chained: true });
});

// ---------------------------------------------------------------- Eventos

const DIE_TO_SACRED = (face: number): ZoneId => (face <= 2 ? 'cementerio' : face <= 4 ? 'santuario' : 'arboles-sagrados');

/** Efectos al revelarse los Eventos de Sacred Groves. */
export function groovesEventRevealed(s: GameState, custom: string, eventId: string): void {
  switch (custom) {
    case 'ev-fire-brimstone':
    case 'ev-sacred-ground': {
      const face = rollDie(s.rng);
      const zone = DIE_TO_SACRED(face);
      const token = custom === 'ev-fire-brimstone' ? 'fuego-y-azufre' : 'suelo-sagrado';
      s.tokens.push({ id: token, zone });
      log(s, `Dado ${face}: la ficha va a ${zoneName(s, zone)}.`, 'info', { kind: 'dice', faces: [face] });
      return;
    }
    case 'ev-closed': {
      const cost = s.fg.hand.filter((c) => c !== 'expiar').length;
      const options = sacredZones(s).map((z) => ({ id: z, label: `Cerrar ${zoneName(s, z)} (descartas ${cost} ${cost === 1 ? 'carta' : 'cartas'})` }));
      push(s, choice('Cerrado por mantenimiento: ¿descartas tus cartas de Acción (salvo Expiar) para cerrar un espacio Sagrado?', [...options, { id: 'no', label: 'No' }], { kind: 'custom', id: 'close-sacred', data: { eventId } }));
      return;
    }
  }
}

registerChoice('close-sacred', (s, option, data) => {
  if (option === 'no') {
    s.activeEvents = s.activeEvents.filter((e) => e !== data.eventId);
    s.eventDiscard.push(data.eventId as string);
    return;
  }
  const discarded = s.fg.hand.filter((c) => c !== 'expiar');
  s.fg.hand = s.fg.hand.filter((c) => c === 'expiar');
  s.actionDiscard.push(...discarded);
  s.tokens.push({ id: 'cerrado', zone: option });
  log(s, `Descartas ${discarded.length} ${discarded.length === 1 ? 'carta' : 'cartas'} y cierras ${zoneName(s, option)}.`, 'good');
  // Las Víctimas de allí se reparten entre los espacios adyacentes.
  const adj = neighbors(s, option, 'enemy');
  victimsIn(s, option).forEach((v, i) => {
    const to = adj[i % adj.length]!;
    log(s, `${capitalize(victimLabel(v))} sale de ${zoneName(s, option)} hacia ${zoneName(s, to)}.`, 'info', { kind: 'victimMove', victim: v.id, path: [option, to] });
    moveVictim(s, v, to);
  });
});

/** Suelo sagrado: +2 Tiempo si terminas la fase de Acción en su espacio. */
export function sacredGroundAtActionEnd(s: GameState): void {
  if (!has(s, 'ev-sacred-ground')) return;
  const zone = s.tokens.find((t) => t.id === 'suelo-sagrado')?.zone;
  if (zone && s.fg.zone === zone) {
    log(s, 'Suelo sagrado: terminas la fase de Acción allí y ganas 2 Tiempo.', 'good');
    changeTime(s, 2);
  }
}

// ---------------------------------------------------------------- el Hombre Sagrado

const holyMan = (s: GameState): Victim | undefined => s.victims.find((v) => v.role === 'hombre');

/** Si el Hombre Sagrado está con el Asesino, sale del tablero y aplica su efecto. */
function checkHolyMan(s: GameState): void {
  const h = holyMan(s);
  if (!h || h.zone !== s.killer.zone || s.outcome) return;
  s.victims = s.victims.filter((v) => v !== h);
  s.gone = (s.gone ?? 0) + 1;
  const withYou = s.fg.zone === h.zone;
  log(s, `El Hombre Sagrado se encuentra con ${killerDef(s).name} y desaparece del tablero.`, 'phase');
  victimLeaves(s, h);
  if (withYou) {
    log(s, 'Estabas allí: reduces una Ira a 4.', 'good');
    return applyWrath(s, 'choose', 'set', 4);
  }
  const inPlay = wrathsInPlay(s);
  if (inPlay.length === 1) return increaseWrath(s, inPlay[0]!, 10);
  if (!inPlay.length) return;
  push(s, choice('El Hombre Sagrado: reparte 10 de aumento entre la Ira Asesina y la Divina', Array.from({ length: 11 }, (_, k) => ({
    id: String(k),
    label: `Ira Asesina +${k} · Ira Divina +${10 - k}`,
  })), { kind: 'custom', id: 'holy-split' }));
}
registerKillerEnter(checkHolyMan);

registerChoice('holy-split', (s, option) => {
  const k = Number(option);
  if (k) increaseWrath(s, 'killer', k);
  if (10 - k) increaseWrath(s, 'divine', 10 - k);
});

/** Mantenimiento: el Hombre Sagrado se mueve un espacio hacia el Asesino. */
export function holyManUpkeep(s: GameState): void {
  const h = holyMan(s);
  if (!h || !has(s, 'ev-holy-man')) return;
  if (h.zone === s.killer.zone) return checkHolyMan(s);
  const next = [...new Set(shortestPaths(s, h.zone, s.killer.zone, 'victim').map((p) => p[0]!))];
  if (!next.length) return log(s, 'El Hombre Sagrado no encuentra camino hacia el Asesino.');
  if (next.length > 1) {
    push(s, choice('Empate: ¿por dónde va el Hombre Sagrado?', next.map((z) => ({ id: z, label: zoneName(s, z) })), { kind: 'custom', id: 'holy-step' }));
    return;
  }
  holyStep(s, next[0]!);
}
function holyStep(s: GameState, to: ZoneId): void {
  const h = holyMan(s);
  if (!h) return;
  log(s, `El Hombre Sagrado camina hacia el Asesino: ${zoneName(s, h.zone)} → ${zoneName(s, to)}.`, 'info', { kind: 'victimMove', victim: h.id, path: [h.zone, to] });
  moveVictim(s, h, to);
  checkHolyMan(s);
}
registerChoice('holy-step', (s, option) => holyStep(s, option));

// ---------------------------------------------------------------- Mantenimiento

/** Tiradas de Mantenimiento de Inkanyamba y Sacred Groves, en orden. */
export function upkeepRoll(s: GameState, which: 'boiling' | 'fickle' | 'volatile'): void {
  const id = which === 'boiling' ? 'ira-hirviendo' : which === 'fickle' ? 'volubilidad' : 'temperamento-volatil';
  const custom = which === 'boiling' ? 'mdp-boiling-wrath' : which === 'fickle' ? 'hz-fickle-gods' : 'dp-volatile-temper';
  if (!has(s, custom)) return;
  pushEffects(s, [{ kind: 'custom', id: `roll:${id}` }], { kind: 'killer' });
}

// ---------------------------------------------------------------- objetos

export function outOfOrderOptions(s: GameState): { id: string; label: string }[] {
  const here = s.fg.zone;
  const placed = s.blocked.length;
  return neighbors(s, here, 'enemy').flatMap((z) => {
    const blocked = s.blocked.some(([a, b]) => (a === here && b === z) || (a === z && b === here));
    if (blocked) return [{ id: `del|${z}`, label: `Retirar la ficha entre ${zoneName(s, here)} y ${zoneName(s, z)}` }];
    return placed < 2 ? [{ id: `add|${z}`, label: `Colocar una ficha entre ${zoneName(s, here)} y ${zoneName(s, z)}` }] : [];
  });
}

registerChoice('out-of-order', (s, option) => {
  const [op, z] = option.split('|') as ['add' | 'del', ZoneId];
  const here = s.fg.zone;
  changeTime(s, -1);
  if (op === 'add') {
    s.blocked.push([here, z]);
    log(s, `Colocas una señal de Fuera de servicio entre ${zoneName(s, here)} y ${zoneName(s, z)}.`);
  } else {
    s.blocked = s.blocked.filter(([a, b]) => !((a === here && b === z) || (a === z && b === here)));
    log(s, `Retiras la señal de Fuera de servicio entre ${zoneName(s, here)} y ${zoneName(s, z)}.`);
  }
});

/** Usos de los objetos nuevos desde el menú de la fase de Acción. Devuelve false si no es suyo. */
export function useGroovesItem(s: GameState, uid: string, custom: string | undefined): boolean {
  switch (custom) {
    case 'item-shaman-bones': {
      const top = s.horrorDeck[0]!;
      s.infoSeq++;
      spendUse(s, uid);
      push(s, choice(`Huesos del shamán: la carta superior de Horror es «${horrorName(s, top)}»`, [
        { id: 'keep', label: 'Dejarla encima' },
        { id: 'bottom', label: 'Ponerla en el fondo del mazo' },
      ], { kind: 'custom', id: 'flashlight' }));
      return true;
    }
    case 'item-out-of-order':
      push(s, choice('Señales de fuera de servicio (1 Tiempo)', outOfOrderOptions(s), { kind: 'custom', id: 'out-of-order' }));
      return true;
    case 'item-air-horn': {
      changeTime(s, -1);
      const zones = [s.fg.zone, ...neighbors(s, s.fg.zone, 'enemy')];
      const vs = s.victims.filter((v) => zones.includes(v.zone));
      log(s, `¡Bocina! ${vs.length} ${vs.length === 1 ? 'Víctima huye' : 'Víctimas huyen'}.`);
      panicVictims(s, vs);
      return true;
    }
  }
  return false;
}

const horrorName = (s: GameState, id: string) =>
  [...killerDef(s).horror, ...locationDef(s).horror].find((h) => h.id === id)?.name ?? id;

/** Descartar "La volubilidad de los dioses" por 3 Tiempo. */
export function discardFickleGods(s: GameState): void {
  changeTime(s, -3);
  s.activeHorror = s.activeHorror.filter((h) => h !== 'la-volubilidad-de-los-dioses');
  s.horrorDiscard.push('la-volubilidad-de-los-dioses');
  log(s, 'Gastas 3 Tiempo y descartas La volubilidad de los dioses.', 'good');
}

/** ¿Puede entrar una Víctima que te sigue en esa zona? (Cerrado por mantenimiento). */
export const followerCanEnter = (s: GameState, zone: ZoneId) => closedZone(s) !== zone;

export { wrathName, zoneDef };
