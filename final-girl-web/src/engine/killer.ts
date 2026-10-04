import type { ZoneId } from '../content/types';
import {
  activeCustoms,
  capitalize,
  damageFG,
  damageKiller,
  endPhaseNow,
  has,
  itemsWith,
  killerRow,
  killVictim,
  log,
  onKillerEnter,
  push,
  pushEffects,
  RuleError,
  victimLabel,
} from './core';
import { choice, discardItem, registerChoice, spendUse } from './effects';
import { actionDef, distances, fgDef, killerDef, shortestPaths, victimsIn, zoneName } from './lookup';
import type { GameState, Input, Target, Task, VictimRole } from './state';

type KillerTask = Extract<Task, { t: 'killerAction' }>;
type AttackTask = Extract<Task, { t: 'attackFG' }>;

const kname = (s: GameState) => killerDef(s).name;

// ---------------------------------------------------------------- objetivo

function computeTarget(s: GameState, task: KillerTask): Target | 'tie' {
  const kz = s.killer.zone;
  const dist = distances(s, kz, 'enemy');
  const d = (z: ZoneId) => dist.get(z) ?? Infinity;

  // Anulaciones: Fuegos artificiales, la Maldita y el Super Turista atraen al Asesino.
  const overrides: Target[] = [];
  const labels: string[] = [];
  let fw = s.tokens.find((t) => t.id === 'fuegos-artificiales');
  // Si el Asesino ya está con los Fuegos, los ha alcanzado: se descartan (si no, nunca se moverían).
  if (fw && fw.zone === kz) {
    s.tokens = s.tokens.filter((t) => t !== fw);
    log(s, 'Los Fuegos artificiales se apagan.');
    fw = undefined;
  }
  if (fw) overrides.push({ kind: 'zone', zone: fw.zone, who: 'token' }), labels.push('Los Fuegos artificiales');
  const maldita = s.victims.find((v) => v.role === 'maldita');
  if (maldita && s.activeEvents.includes('venganza')) overrides.push({ kind: 'zone', zone: maldita.zone, who: 'victim' }), labels.push('La Maldita');
  const superT = s.victims.find((v) => v.role === 'super');
  if (superT && s.activeEvents.includes('el-super-turista')) overrides.push({ kind: 'zone', zone: superT.zone, who: 'victim' }), labels.push('El Super Turista');
  if (overrides.length === 1) return overrides[0]!;
  if (overrides.length > 1) {
    const zones = Object.fromEntries(overrides.map((o, i) => [String(i), o]));
    push(s, choice('Empate: ¿qué atrae al Asesino?', overrides.map((o, i) => ({ id: String(i), label: `${labels[i]} (${zoneName(s, (o as { zone: ZoneId }).zone)})` })), { kind: 'custom', id: 'killer-target', data: { zones } }));
    return 'tie';
  }

  let { target } = task.action;
  if (target === 'victimElseFG') target = s.victims.length ? 'victim' : 'finalGirl';
  if (target === 'finalGirl') return { kind: 'zone', zone: s.fg.zone, who: 'finalGirl' };

  // Zonas candidatas con su número de Víctimas.
  const counts = new Map<ZoneId, number>();
  for (const v of s.victims) counts.set(v.zone, (counts.get(v.zone) ?? 0) + 1);
  if (target === 'nearest' && !counts.has(s.fg.zone)) counts.set(s.fg.zone, 0);
  if (!counts.size) return { kind: 'none' };

  const zones = [...counts.keys()];
  const best = target === 'farthestVictim' ? Math.max(...zones.map(d)) : Math.min(...zones.map(d));
  let tied = zones.filter((z) => d(z) === best);
  // Empate de distancia: el grupo con más Víctimas (la Chica Final no cuenta).
  const most = Math.max(...tied.map((z) => counts.get(z)!));
  tied = tied.filter((z) => counts.get(z) === most);
  const who = target === 'nearest' ? 'group' : 'victim';
  if (tied.length === 1) return { kind: 'zone', zone: tied[0]!, who };
  push(s, choice('Empate: ¿a qué zona va el Asesino?', tied.map((z) => ({ id: z, label: describeZone(s, z) })), { kind: 'custom', id: 'killer-target-zone', data: { who } }));
  return 'tie';
}

function describeZone(s: GameState, z: ZoneId): string {
  const n = victimsIn(s, z).length;
  const parts = [zoneName(s, z)];
  if (n) parts.push(`${n} ${n === 1 ? 'Víctima' : 'Víctimas'}`);
  if (s.fg.zone === z) parts.push(fgDef(s).name);
  return parts.join(' · ');
}

registerChoice('killer-target', (s, option, data) => {
  const t = currentKillerTask(s);
  t.target = (data.zones as Record<string, Target>)[option]!;
  t.step = 'path';
});
registerChoice('killer-target-zone', (s, option, data) => {
  const t = currentKillerTask(s);
  t.target = { kind: 'zone', zone: option, who: data.who as 'group' | 'victim' };
  t.step = 'path';
});
registerChoice('killer-path', (s, option, data) => {
  const t = currentKillerTask(s);
  t.path = (data.paths as ZoneId[][])[Number(option)]!;
  t.step = 'move';
});

function currentKillerTask(s: GameState): KillerTask {
  const t = [...s.stack].reverse().find((x) => x.t === 'killerAction');
  if (!t || t.t !== 'killerAction') throw new RuleError('No hay ninguna Acción del Asesino en curso');
  return t;
}

// ---------------------------------------------------------------- Acción del Asesino

export function stepKillerAction(s: GameState, task: KillerTask): 'done' | 'continue' {
  switch (task.step) {
    case 'target': {
      // Sin iconos de movimiento el Asesino no va a ningún sitio: solo cuenta quién está en su zona.
      if (task.action.moves === 0) {
        const toFG = task.action.target === 'finalGirl' || (task.action.target === 'victimElseFG' && !s.victims.length);
        task.target = { kind: 'zone', zone: s.killer.zone, who: toFG ? 'finalGirl' : 'group' };
        task.step = 'spray';
        return 'continue';
      }
      const target = computeTarget(s, task);
      if (target === 'tie') return 'continue';
      task.target = target;
      task.step = 'path';
      if (target.kind === 'zone') log(s, `${kname(s)} va a por ${describeTarget(s, target)}.`, 'killer');
      return 'continue';
    }
    case 'path': {
      const t = task.target!;
      if (task.action.moves === 0 || t.kind === 'none' || t.zone === s.killer.zone) {
        task.step = 'spray';
        return 'continue';
      }
      const perIcon = killerRow(s).move + (has(s, 'mdp-demonic-speed') ? 1 : 0);
      const steps = task.action.moves * perIcon;
      const paths = shortestPaths(s, s.killer.zone, t.zone, 'enemy').map((p) => p.slice(0, steps));
      // Solo se pregunta si los caminos llevan a sitios distintos o cruzan fichas distintas.
      const tokenZones = new Set(s.tokens.filter((x) => x.id === 'trampa-para-osos' || x.id === 'fuegos-artificiales').map((x) => x.zone));
      const key = (p: ZoneId[]) => `${p[p.length - 1]}|${p.filter((z) => tokenZones.has(z)).join(',')}`;
      const distinct = new Map<string, ZoneId[]>();
      for (const p of paths) if (!distinct.has(key(p))) distinct.set(key(p), p);
      const options = [...distinct.values()];
      if (options.length > 1) {
        push(s, choice('Empate: ¿por dónde va el Asesino?', options.map((p, i) => ({ id: String(i), label: p.map((z) => zoneName(s, z)).join(' → ') })), { kind: 'custom', id: 'killer-path', data: { paths: options } }));
        return 'continue';
      }
      task.path = options[0] ?? [];
      task.step = 'move';
      return 'continue';
    }
    case 'move': {
      const path = task.path ?? [];
      const walked: ZoneId[] = [s.killer.zone];
      for (const z of path) {
        s.killer.zone = z;
        walked.push(z);
        const trap = s.tokens.find((x) => x.zone === z && x.id === 'trampa-para-osos');
        if (trap) {
          log(s, `${kname(s)} se mueve: ${walked.map((w) => zoneName(s, w)).join(' → ')}.`, 'killer', { kind: 'killerMove', path: walked });
          s.tokens = s.tokens.filter((x) => x !== trap);
          log(s, `¡${kname(s)} cae en la Trampa para osos!`, 'good');
          damageKiller(s, 2);
          if (!s.outcome && s.phase === 'killer') endPhaseNow(s, 'La fase del Asesino termina inmediatamente.');
          return 'continue';
        }
        const fw = s.tokens.find((x) => x.zone === z && x.id === 'fuegos-artificiales');
        if (fw) {
          s.tokens = s.tokens.filter((x) => x !== fw);
          log(s, 'Los Fuegos artificiales se apagan.');
        }
      }
      if (walked.length > 1) log(s, `${kname(s)} se mueve: ${walked.map((w) => zoneName(s, w)).join(' → ')}.`, 'killer', { kind: 'killerMove', path: walked });
      if (walked.length > 1) onKillerEnter(s);
      task.step = 'spray';
      return 'continue';
    }
    case 'spray': {
      task.step = 'attack';
      task.attacksLeft = task.action.attacks;
      const spray = itemsWith(s, 'item-pepper-spray')[0];
      if (spray && task.action.attacks > 0 && s.killer.zone === s.fg.zone && s.phase === 'killer') {
        push(s, choice(`${kname(s)} está en tu zona. ¿Usas el Spray de pimienta?`, [
          { id: 'yes', label: 'Sí: termina la fase del Asesino' },
          { id: 'no', label: 'No' },
        ], { kind: 'custom', id: 'pepper-spray', data: { uid: spray.uid } }));
      }
      return 'continue';
    }
    case 'attack': {
      if (!task.attacksLeft) {
        task.step = 'obsession';
        return 'continue';
      }
      task.attacksLeft--;
      performAttack(s, task);
      return 'continue';
    }
    case 'obsession': {
      task.step = 'done';
      if (task.attackedFG && has(s, 'dp-dark-obsession') && s.killer.zone === s.fg.zone) {
        log(s, 'Oscura obsesión: Hans ataca una vez más.', 'killer');
        push(s, attackFGTask(s));
      }
      return 'continue';
    }
    case 'done':
      return 'done';
  }
}

function describeTarget(s: GameState, t: Target): string {
  if (t.kind !== 'zone') return 'nadie';
  if (t.who === 'finalGirl') return fgDef(s).name;
  if (t.who === 'token') return `los Fuegos artificiales (${zoneName(s, t.zone)})`;
  if (t.who === 'victim' && s.victims.some((v) => v.role === 'super' && v.zone === t.zone) && s.activeEvents.includes('el-super-turista')) return `el Super Turista en ${zoneName(s, t.zone)}`;
  return `${t.who === 'victim' ? 'las Víctimas' : 'lo que hay'} en ${zoneName(s, t.zone)}`;
}

registerChoice('pepper-spray', (s, option, data) => {
  if (option !== 'yes') return;
  discardItem(s, data.uid as string);
  endPhaseNow(s, '¡Spray de pimienta! La fase del Asesino termina.');
});

function attackFGTask(s: GameState): AttackTask {
  const damage = killerRow(s).attack + (has(s, 'mdp-wicked-rage') ? 1 : 0);
  return { t: 'attackFG', damage, reduce: 0, ignore: false };
}

/** Un icono de ataque. */
function performAttack(s: GameState, task: KillerTask): void {
  const zone = s.killer.zone;
  const victims = victimsIn(s, zone);
  const fgHere = s.fg.zone === zone;
  const customs = activeCustoms(s);

  if (customs.has('dp-hammer-massacre')) {
    // Ataca a la Chica Final y a cada Víctima de su zona una vez.
    for (const v of victims) killByAttack(s, task, v);
    if (fgHere) {
      task.attackedFG = true;
      push(s, attackFGTask(s));
    }
    return;
  }

  const targetsFG = task.target?.kind === 'zone' && task.target.who === 'finalGirl';
  if (fgHere && (targetsFG || !victims.length)) {
    task.attackedFG = true;
    push(s, attackFGTask(s));
    return;
  }
  if (!victims.length) return log(s, `${kname(s)} ataca, pero no hay nadie en su zona.`);
  // Si las Víctimas no son iguales (especiales), el jugador elige cuál (ambigüedad).
  const kinds = new Set(victims.map((v) => v.role ?? 'normal'));
  if (kinds.size > 1) {
    push(s, choice('¿A qué Víctima ataca el Asesino?', [...kinds].map((k) => ({ id: k, label: k === 'normal' ? 'Una Víctima normal' : capitalize(victimLabel({ role: k as VictimRole })) })), { kind: 'custom', id: 'attack-victim' }));
    return;
  }
  killByAttack(s, task, victims[0]!);
}

registerChoice('attack-victim', (s, option) => {
  const task = currentKillerTask(s);
  const v = victimsIn(s, s.killer.zone).find((x) => (x.role ?? 'normal') === option);
  if (v) killByAttack(s, task, v);
});

function killByAttack(s: GameState, task: KillerTask, v: GameState['victims'][number]): void {
  task.killed++;
  killVictim(s, v, true);
  if (task.action.perVictimKilled) pushEffects(s, task.action.perVictimKilled, task.src);
}

// ---------------------------------------------------------------- ataque a la Chica Final

export function stepAttackFG(s: GameState, task: AttackTask): 'done' | 'wait' {
  if (task.damage <= 0) {
    log(s, `El ataque de ${kname(s)} no te hace daño.`, 'good');
    return 'done';
  }
  const opts = reactionOptions(s);
  if (!opts.cards.length && !opts.lid && !opts.spray) {
    log(s, `${kname(s)} te ataca: ${task.damage} de daño.`, 'killer');
    damageFG(s, task.damage);
    return 'done';
  }
  s.prompt = { type: 'react', damage: task.damage, cards: opts.cards, lid: opts.lid, spray: opts.spray };
  return 'wait';
}

function reactionOptions(s: GameState) {
  const cards = [...new Set(s.fg.hand.filter((c) => actionDef(c).timing === 'reaction'))];
  const lid = itemsWith(s, 'item-trash-lid')[0]?.uid ?? null;
  const spray = s.phase === 'killer' ? (itemsWith(s, 'item-pepper-spray')[0]?.uid ?? null) : null;
  return { cards, lid, spray };
}

export function inputAttackFG(s: GameState, task: AttackTask, input: Input): 'done' | 'continue' {
  switch (input.type) {
    case 'react': {
      const i = s.fg.hand.indexOf(input.cardId);
      if (i < 0 || actionDef(input.cardId).timing !== 'reaction') throw new RuleError('No tienes esa carta de Reacción');
      s.fg.hand.splice(i, 1);
      s.actionDiscard.push(input.cardId);
      log(s, `Reaccionas con ${actionDef(input.cardId).name}.`);
      push(s, { t: 'reaction', cardId: input.cardId, attack: task.damage });
      return 'continue';
    }
    case 'useLid': {
      const lid = itemsWith(s, 'item-trash-lid')[0];
      if (!lid) throw new RuleError('No tienes la Tapadera en las manos');
      task.damage = Math.max(0, task.damage - 1);
      log(s, `La Tapadera para 1 punto de daño (queda ${task.damage}).`, 'good');
      spendUse(s, lid.uid);
      return 'continue';
    }
    case 'pepperSpray': {
      const spray = itemsWith(s, 'item-pepper-spray')[0];
      if (!spray || s.phase !== 'killer') throw new RuleError('No puedes usar el Spray de pimienta ahora');
      discardItem(s, spray.uid);
      endPhaseNow(s, '¡Spray de pimienta! La fase del Asesino termina.');
      return 'continue';
    }
    case 'takeHit':
      log(s, `${kname(s)} te ataca: ${task.damage} de daño.`, 'killer');
      damageFG(s, task.damage);
      return 'done';
    default:
      throw new RuleError('Respuesta no válida para un ataque');
  }
}
