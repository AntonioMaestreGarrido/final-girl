import type { KillerAction, ZoneId } from '../content/types';
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
import { discardItem, spendUse } from './effects';
import { choice, registerChoice } from './registry';
import { actionDef, distances, fgDef, killerDef, shortestPaths, victimsIn, zoneName } from './lookup';
import type { EffectSource, GameState, Input, Target, Task, Victim, VictimRole } from './state';

type KillerTask = Extract<Task, { t: 'killerAction' }>;
type AttackTask = Extract<Task, { t: 'attackFG' }>;

const kname = (s: GameState) => killerDef(s).name;

// ---------------------------------------------------------------- quién actúa

/** El Asesino, un Esbirro (Marioneta) o una Víctima que actúa como Marioneta (Gran Final "Hice a tus amigos"). */
type ActorRef = { kind: 'killer' } | { kind: 'minion'; id: string } | { kind: 'victim'; id: string };

function parseActor(a?: string): ActorRef {
  if (!a || a === 'killer' || a === 'wolf') return { kind: 'killer' };
  return a.startsWith('m:') ? { kind: 'minion', id: a.slice(2) } : { kind: 'victim', id: a.slice(2) };
}

const actorOf = (task: KillerTask) => parseActor(task.actor);

function actorEntity(s: GameState, task: KillerTask): { zone: ZoneId } | undefined {
  const a = actorOf(task);
  if (a.kind === 'killer') return s.killer;
  return a.kind === 'minion' ? s.minions.find((m) => m.id === a.id) : s.victims.find((v) => v.id === a.id);
}

const actorZone = (s: GameState, task: KillerTask): ZoneId => actorEntity(s, task)!.zone;

function actorName(s: GameState, task: KillerTask): string {
  const a = actorOf(task);
  if (a.kind === 'killer') return kname(s);
  return a.kind === 'minion' ? (killerDef(s).minion?.name ?? 'Esbirro') : 'Una Víctima-Marioneta';
}

/** Valor de Ataque del que actúa: el del Asesino o el del Esbirro (Injerto de armas: 2). */
function attackValue(s: GameState, task: KillerTask): number {
  const a = actorOf(task);
  if (a.kind === 'killer') return killerRow(s).attack + (has(s, 'mdp-wicked-rage') ? 1 : 0);
  const base = killerDef(s).minion?.attack ?? 1;
  return base + (has(s, 'dp-weapon-graft') ? 1 : 0);
}

/** Víctimas que se pueden apuntar o matar (el Hombre Lobo no puede ser apuntado ni asesinado). */
const targetableVictims = (s: GameState, except?: string): Victim[] => s.victims.filter((v) => v.role !== 'lobo' && v.id !== except);

// ---------------------------------------------------------------- iniciar una Acción del Asesino

/** Esbirros ordenados de la más cercana a la más lejana de la Chica Final (decisión del usuario: orden automático). */
function orderedMinions(s: GameState) {
  const dist = distances(s, s.fg.zone, 'enemy');
  return [...s.minions].sort((a, b) => (dist.get(a.zone) ?? 99) - (dist.get(b.zone) ?? 99) || a.id.localeCompare(b.id));
}

const newTask = (action: KillerAction, src: EffectSource, actor: string): KillerTask => ({
  t: 'killerAction',
  action,
  src,
  step: 'target',
  killed: 0,
  attackedFG: false,
  actor,
});

/**
 * Los Esbirros siempre actúan antes que el Asesino y cada Enemigo resuelve la acción completa (pág. 33).
 * Con "Hice a tus amigos", en la fase del Asesino también actúan las Víctimas como Marionetas.
 */
export function startKillerAction(s: GameState, action: KillerAction, src: EffectSource): void {
  const who = action.actor ?? 'all';
  const tasks: Task[] = [];
  if (who !== 'killer') {
    for (const m of orderedMinions(s)) tasks.push(newTask(action, src, `m:${m.id}`));
    if (has(s, 'finale-friends') && s.phase === 'killer') {
      for (const v of targetableVictims(s)) tasks.push(newTask(action, src, `v:${v.id}`));
    }
  }
  if (who !== 'minions') tasks.push(newTask(action, src, 'killer'));
  push(s, ...tasks);
}

/** Hace que un Enemigo concreto (p. ej. "m:m1") resuelva una acción completa. */
export function startActorAction(s: GameState, actor: string, action: KillerAction, src: EffectSource): void {
  push(s, newTask(action, src, actor));
}

// ---------------------------------------------------------------- objetivo

function computeTarget(s: GameState, task: KillerTask): Target | 'tie' {
  const a = actorOf(task);
  const kz = actorZone(s, task);
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

  const pool = targetableVictims(s, a.kind === 'victim' ? a.id : undefined);
  let { target } = task.action;
  if (target === 'victimElseFG') target = pool.length ? 'victim' : 'finalGirl';
  if (target === 'finalGirl') return { kind: 'zone', zone: s.fg.zone, who: 'finalGirl' };

  // Zonas candidatas con su número de Víctimas.
  const counts = new Map<ZoneId, number>();
  for (const v of pool) counts.set(v.zone, (counts.get(v.zone) ?? 0) + 1);
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
  push(s, choice('Empate: ¿a qué zona va el Enemigo?', tied.map((z) => ({ id: z, label: describeZone(s, z) })), { kind: 'custom', id: 'killer-target-zone', data: { who } }));
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
  t.step = afterTarget(t);
});
registerChoice('killer-target-zone', (s, option, data) => {
  const t = currentKillerTask(s);
  t.target = { kind: 'zone', zone: option, who: data.who as 'group' | 'victim' };
  t.step = afterTarget(t);
});
registerChoice('killer-path', (s, option, data) => {
  const t = currentKillerTask(s);
  t.path = (data.paths as ZoneId[][])[Number(option)]!;
  t.step = 'move';
});
/** Kit de maquillaje: el Enemigo apunta a la Víctima más cercana en lugar de a la Chica Final. */
registerChoice('makeup-kit', (s, option) => {
  if (option !== 'yes') return;
  const t = currentKillerTask(s);
  const pool = targetableVictims(s);
  if (!pool.length) return log(s, 'Kit de maquillaje: no hay Víctimas a las que desviar el ataque.');
  const dist = distances(s, actorZone(s, t), 'enemy');
  const best = Math.min(...pool.map((v) => dist.get(v.zone) ?? Infinity));
  const zones = [...new Set(pool.filter((v) => (dist.get(v.zone) ?? Infinity) === best).map((v) => v.zone))];
  log(s, 'Te haces pasar por una Víctima con el Kit de maquillaje.', 'good');
  if (zones.length > 1) return push(s, choice('Empate: ¿a qué zona va el Enemigo?', zones.map((z) => ({ id: z, label: describeZone(s, z) })), { kind: 'custom', id: 'killer-target-zone', data: { who: 'victim' } }));
  t.target = { kind: 'zone', zone: zones[0]!, who: 'victim' };
  t.step = afterTarget(t);
});

function currentKillerTask(s: GameState): KillerTask {
  const t = [...s.stack].reverse().find((x) => x.t === 'killerAction');
  if (!t || t.t !== 'killerAction') throw new RuleError('No hay ninguna Acción del Asesino en curso');
  return t;
}

/** Tras elegir objetivo: mover (o atacar primero si la acción lo indica). */
const afterTarget = (task: KillerTask): KillerTask['step'] => (task.action.attackFirst ? 'spray' : 'path');
/** Tras mover (o si no hay movimiento): atacar, o terminar si ya se atacó. */
const afterMove = (task: KillerTask): KillerTask['step'] => (task.action.attackFirst ? 'obsession' : 'spray');

// ---------------------------------------------------------------- Marionetas: movimiento atado a Geppetto

/**
 * Las Marionetas deben terminar su movimiento a menos de 2 espacios de Geppetto (pueden pasar más lejos
 * mientras terminen cerca). Si están más lejos, su objetivo pasa a ser Geppetto y se detienen al llegar
 * a 2 espacios; el movimiento sobrante se pierde.
 */
function minionPaths(s: GameState, from: ZoneId, target: ZoneId, steps: number): ZoneId[][] {
  const unbound = has(s, 'finale-unbound');
  const leash = 2;
  const dG = distances(s, s.killer.zone, 'enemy');
  const dg = (z: ZoneId) => dG.get(z) ?? Infinity;
  if (!unbound && dg(from) > leash) {
    return shortestPaths(s, from, s.killer.zone, 'enemy').map((p) => {
      const out: ZoneId[] = [];
      for (const z of p.slice(0, steps)) {
        out.push(z);
        if (dg(z) <= leash) break;
      }
      return out;
    });
  }
  return shortestPaths(s, from, target, 'enemy').map((p) => {
    const reach = p.slice(0, steps);
    for (let i = reach.length; i >= 0; i--) {
      const pos = i === 0 ? from : reach[i - 1]!;
      if (unbound || dg(pos) <= leash) return reach.slice(0, i);
    }
    return [];
  });
}

// ---------------------------------------------------------------- Acción del Asesino

export function stepKillerAction(s: GameState, task: KillerTask): 'done' | 'continue' {
  const a = actorOf(task);
  if (!actorEntity(s, task)) return 'done';
  const name = actorName(s, task);
  switch (task.step) {
    case 'target': {
      // Sin iconos de movimiento el Asesino no va a ningún sitio: solo cuenta quién está en su zona.
      if (task.action.moves === 0) {
        const toFG = task.action.target === 'finalGirl' || (task.action.target === 'victimElseFG' && !targetableVictims(s).length);
        task.target = { kind: 'zone', zone: actorZone(s, task), who: toFG ? 'finalGirl' : 'group' };
        task.step = 'spray';
        return 'continue';
      }
      const target = computeTarget(s, task);
      if (target === 'tie') return 'continue';
      task.target = target;
      task.step = afterTarget(task);
      if (target.kind === 'zone') log(s, `${name} va a por ${describeTarget(s, target)}.`, 'killer');
      // Kit de maquillaje: solo cuando el Enemigo apunta específicamente a la Chica Final.
      const kit = itemsWith(s, 'item-makeup')[0];
      if (kit && task.action.target === 'finalGirl' && target.kind === 'zone' && target.who === 'finalGirl' && targetableVictims(s).length) {
        push(s, choice('Un Enemigo te apunta a ti. ¿Usas el Kit de maquillaje para hacerte pasar por una Víctima?', [
          { id: 'yes', label: 'Sí: apunta a la Víctima más cercana' },
          { id: 'no', label: 'No' },
        ], { kind: 'custom', id: 'makeup-kit' }));
      }
      return 'continue';
    }
    case 'path': {
      const t = task.target!;
      const here = actorZone(s, task);
      if (task.action.moves === 0 || t.kind === 'none' || t.zone === here) {
        task.step = afterMove(task);
        return 'continue';
      }
      const perIcon = killerRow(s).move + (a.kind === 'killer' && has(s, 'mdp-demonic-speed') ? 1 : 0);
      let steps = task.action.moves * perIcon;
      if (a.kind === 'minion') {
        if (has(s, 'finale-unbound')) steps += 1;
        if (has(s, 'finale-remember')) steps = Math.max(0, steps - 1);
      }
      const paths =
        a.kind === 'minion'
          ? minionPaths(s, here, t.zone, steps)
          : shortestPaths(s, here, t.zone, 'enemy').map((p) => p.slice(0, steps));
      // Solo se pregunta si los caminos llevan a sitios distintos o cruzan fichas distintas.
      const tokenZones = new Set(s.tokens.filter((x) => x.id === 'trampa-para-osos' || x.id === 'fuegos-artificiales').map((x) => x.zone));
      const key = (p: ZoneId[]) => `${p[p.length - 1]}|${p.filter((z) => tokenZones.has(z)).join(',')}`;
      const distinct = new Map<string, ZoneId[]>();
      for (const p of paths) if (!distinct.has(key(p))) distinct.set(key(p), p);
      const options = [...distinct.values()];
      if (options.length > 1) {
        push(s, choice(`Empate: ¿por dónde va ${name}?`, options.map((p, i) => ({ id: String(i), label: p.length ? p.map((z) => zoneName(s, z)).join(' → ') : 'Se queda donde está' })), { kind: 'custom', id: 'killer-path', data: { paths: options } }));
        return 'continue';
      }
      task.path = options[0] ?? [];
      task.step = 'move';
      return 'continue';
    }
    case 'move': {
      const path = task.path ?? [];
      const ent = actorEntity(s, task)!;
      const walked: ZoneId[] = [ent.zone];
      const anim = () => ({ kind: 'killerMove' as const, path: walked });
      for (const z of path) {
        // Corre, yo les entretendré: el Prometido muere en tu lugar y el Enemigo se queda donde está.
        const fiance = z === s.fg.zone ? s.victims.find((v) => v.role === 'prometido' && v.zone === z) : undefined;
        if (fiance && has(s, 'ev-fiance')) {
          log(s, `${name} quiere entrar en tu zona, pero tu Prometido se interpone y muere en tu lugar.`, 'killer');
          killVictim(s, fiance, true);
          break;
        }
        ent.zone = z;
        walked.push(z);
        if (a.kind !== 'killer') continue;
        const trap = s.tokens.find((x) => x.zone === z && x.id === 'trampa-para-osos');
        if (trap) {
          log(s, `${name} se mueve: ${walked.map((w) => zoneName(s, w)).join(' → ')}.`, 'killer', anim());
          s.tokens = s.tokens.filter((x) => x !== trap);
          log(s, `¡${name} cae en la Trampa para osos!`, 'good');
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
      if (walked.length > 1) log(s, `${name} se mueve: ${walked.map((w) => zoneName(s, w)).join(' → ')}.`, 'killer', anim());
      if (walked.length > 1 && a.kind === 'killer') onKillerEnter(s);
      task.step = afterMove(task);
      return 'continue';
    }
    case 'spray': {
      task.step = 'attack';
      task.attacksLeft = task.action.attacks;
      const spray = itemsWith(s, 'item-pepper-spray')[0];
      if (a.kind === 'killer' && spray && task.action.attacks > 0 && s.killer.zone === s.fg.zone && s.phase === 'killer') {
        push(s, choice(`${kname(s)} está en tu zona. ¿Usas el Spray de pimienta?`, [
          { id: 'yes', label: 'Sí: termina la fase del Asesino' },
          { id: 'no', label: 'No' },
        ], { kind: 'custom', id: 'pepper-spray', data: { uid: spray.uid } }));
      }
      return 'continue';
    }
    case 'attack': {
      if (!task.attacksLeft) {
        task.step = task.action.attackFirst && !task.moved ? 'path' : 'obsession';
        if (task.step === 'path') task.moved = true;
        return 'continue';
      }
      task.attacksLeft--;
      performAttack(s, task);
      return 'continue';
    }
    case 'obsession': {
      task.step = 'done';
      if (a.kind === 'killer' && task.attackedFG && has(s, 'dp-dark-obsession') && s.killer.zone === s.fg.zone) {
        log(s, 'Oscura obsesión: Hans ataca una vez más.', 'killer');
        push(s, attackFGTask(s, task));
      }
      return 'continue';
    }
    case 'done':
      if (a.kind === 'minion') joinTheFamily(s);
      return 'done';
  }
}

/** Únete a la familia (Poder Oscuro Épico): con las 3 Marionetas en tu espacio pierdes toda tu Vida restante. */
function joinTheFamily(s: GameState): void {
  const def = killerDef(s).minion;
  if (!def || s.phase !== 'killer' || s.outcome || !has(s, 'dp-join-family')) return;
  if (s.minions.length < def.count || !s.minions.every((m) => m.zone === s.fg.zone)) return;
  log(s, `¡Únete a la familia! Las ${def.count} ${def.plural} te rodean: pierdes toda tu Vida restante.`, 'killer');
  damageFG(s, s.fg.health.hp);
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

function attackFGTask(s: GameState, task: KillerTask): AttackTask {
  return { t: 'attackFG', damage: attackValue(s, task), reduce: 0, ignore: false, by: task.actor ?? 'killer' };
}

/** Un icono de ataque. */
function performAttack(s: GameState, task: KillerTask): void {
  const a = actorOf(task);
  const zone = actorZone(s, task);
  const name = actorName(s, task);
  const victims = victimsIn(s, zone).filter((v) => v.role !== 'lobo' && !(a.kind === 'victim' && v.id === a.id));
  const fgHere = s.fg.zone === zone;
  const customs = activeCustoms(s);

  if (a.kind === 'killer' && customs.has('dp-hammer-massacre')) {
    // Ataca a la Chica Final y a cada Víctima de su zona una vez.
    for (const v of victims) killByAttack(s, task, v);
    if (fgHere) {
      task.attackedFG = true;
      push(s, attackFGTask(s, task));
    }
    return;
  }

  const targetsFG = task.target?.kind === 'zone' && task.target.who === 'finalGirl';
  if (fgHere && (targetsFG || !victims.length)) {
    task.attackedFG = true;
    push(s, attackFGTask(s, task));
    return;
  }
  // Las Víctimas-Marioneta solo atacan a la Chica Final.
  if (a.kind === 'victim') return;
  if (!victims.length) return log(s, `${name} ataca, pero no hay nadie en su zona.`);
  // Si las Víctimas no son iguales (especiales), el jugador elige cuál (ambigüedad).
  const kinds = new Set(victims.map((v) => v.role ?? 'normal'));
  if (kinds.size > 1) {
    push(s, choice('¿A qué Víctima ataca el Enemigo?', [...kinds].map((k) => ({ id: k, label: k === 'normal' ? 'Una Víctima normal' : capitalize(victimLabel({ role: k as VictimRole })) })), { kind: 'custom', id: 'attack-victim' }));
    return;
  }
  killByAttack(s, task, victims[0]!);
}

registerChoice('attack-victim', (s, option) => {
  const task = currentKillerTask(s);
  const v = victimsIn(s, actorZone(s, task)).find((x) => (x.role ?? 'normal') === option);
  if (v) killByAttack(s, task, v);
});

function killByAttack(s: GameState, task: KillerTask, v: GameState['victims'][number]): void {
  task.killed++;
  killVictim(s, v, true);
  if (task.action.perVictimKilled) pushEffects(s, task.action.perVictimKilled, task.src);
}

// ---------------------------------------------------------------- ataque a la Chica Final

export function stepAttackFG(s: GameState, task: AttackTask): 'done' | 'wait' {
  const by = parseActor(task.by);
  const attacker = task.by === 'wolf' ? 'El Hombre Lobo' : by.kind === 'killer' ? kname(s) : by.kind === 'minion' ? (killerDef(s).minion?.name ?? 'Un Esbirro') : 'Una Víctima-Marioneta';
  if (task.damage <= 0) {
    log(s, `El ataque de ${attacker} no te hace daño.`, 'good');
    return 'done';
  }
  const opts = reactionOptions(s);
  if (!opts.cards.length && !opts.lid && !opts.spray) {
    log(s, `${attacker} te ataca: ${task.damage} de daño.`, 'killer');
    damageFG(s, task.damage);
    return 'done';
  }
  s.prompt = { type: 'react', damage: task.damage, cards: opts.cards, lid: opts.lid, spray: opts.spray };
  return 'wait';
}

function reactionOptions(s: GameState) {
  const cards = [...new Set(s.fg.hand.filter((c) => actionDef(c).timing === 'reaction'))];
  const lid = itemsWith(s, 'item-trash-lid')[0]?.uid ?? null;
  const spray = s.phase === 'killer' && s.killer.zone === s.fg.zone ? (itemsWith(s, 'item-pepper-spray')[0]?.uid ?? null) : null;
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
      log(s, `Te atacan: ${task.damage} de daño.`, 'killer');
      damageFG(s, task.damage);
      return 'done';
    default:
      throw new RuleError('Respuesta no válida para un ataque');
  }
}
