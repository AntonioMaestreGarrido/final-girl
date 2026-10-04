import { describe, expect, it } from 'vitest';
import { createGame, deserialize, dispatch, newGame, play, serialize, undo, canUndo, type GameConfig, type GameState } from './index';
import { actionDef, itemDef, locationDef } from './lookup';
import { botRng, checkInvariants, randomInput } from './testing';

const totalActions = (s: GameState) => s.fg.hand.length + s.actionDiscard.length + Object.values(s.actionTable).reduce((a, b) => a + b, 0);

function config(seed: number, extra: Partial<GameConfig> = {}): GameConfig {
  return {
    killerId: 'hans',
    locationId: 'camp-happy-trails',
    finalGirlId: seed % 2 ? 'laurie' : 'reiko',
    board: seed % 3 === 0 ? 'extreme' : 'normal',
    epicDarkPower: seed % 5 === 0,
    bonusItems: true,
    seed,
    ...extra,
  };
}

const KILLERS = ['hans', 'inkanyamba'];
const LOCATIONS = ['camp-happy-trails', 'sacred-groves'];
const GIRLS = ['laurie', 'reiko', 'adelaide', 'barbara'];

/** Todas las combinaciones de Asesino, Lugar y Chica Final (la semilla elige una). */
function mixed(seed: number): GameConfig {
  return config(seed, {
    killerId: KILLERS[seed % 2]!,
    locationId: LOCATIONS[Math.floor(seed / 2) % 2]!,
    finalGirlId: GIRLS[Math.floor(seed / 4) % 4]!,
  });
}

function playRandom(seed: number, maxSteps = 4000, cfg: GameConfig = config(seed)): { state: GameState; steps: number } {
  let s = createGame(cfg);
  const totals = { actions: totalActions(s), items: locationDef(s).items.length + 1 };
  const r = botRng(seed);
  let steps = 0;
  while (!s.outcome && steps < maxSteps) {
    const input = randomInput(s, r);
    try {
      s = dispatch(s, input);
    } catch (e) {
      throw new Error(`Semilla ${seed}, paso ${steps}, entrada ${JSON.stringify(input)}, pregunta ${JSON.stringify(s.prompt)}: ${(e as Error).message}\n${s.log.slice(-8).map((l) => l.text).join('\n')}`);
    }
    // El registro completo no hace falta en la simulación y ralentiza cada copia del estado.
    if (s.log.length > 100) s.log = s.log.slice(-100);
    const errors = checkInvariants(s, totals);
    if (errors.length) throw new Error(`Semilla ${seed}, paso ${steps}: ${errors.join('; ')}\n${s.log.slice(-8).map((l) => l.text).join('\n')}`);
    steps++;
  }
  return { state: s, steps };
}

describe('simulación con jugadas aleatorias', () => {
  it('300 partidas terminan sin errores ni bloqueos', () => {
    const outcomes = { finalGirl: 0, killer: 0, unfinished: 0 };
    for (let seed = 1; seed <= 300; seed++) {
      const { state } = playRandom(seed);
      if (!state.outcome) outcomes.unfinished++;
      else outcomes[state.outcome.winner]++;
    }
    expect(outcomes.unfinished).toBe(0);
    // Un jugador aleatorio debería perder casi siempre, pero ambos finales deben poder darse.
    expect(outcomes.killer).toBeGreaterThan(0);
  }, 120_000);

  it('400 partidas con todas las combinaciones de películas terminan sin errores', () => {
    const outcomes = { finalGirl: 0, killer: 0, unfinished: 0 };
    for (let seed = 1; seed <= 400; seed++) {
      const { state } = playRandom(seed, 4000, mixed(seed));
      if (!state.outcome) outcomes.unfinished++;
      else outcomes[state.outcome.winner]++;
    }
    expect(outcomes.unfinished).toBe(0);
    expect(outcomes.killer).toBeGreaterThan(0);
  }, 240_000);

  it('la misma semilla y las mismas decisiones dan la misma partida', () => {
    const a = playRandom(42).state;
    const b = playRandom(42).state;
    expect(b.log.map((l) => l.text)).toEqual(a.log.map((l) => l.text));
  });

  it('guardar y cargar continúa exactamente igual', () => {
    let game = newGame(config(7));
    const r1 = botRng(7);
    for (let i = 0; i < 40 && !game.state.outcome; i++) game = play(game, randomInput(game.state, r1));
    const loaded = deserialize(serialize(game));
    expect(loaded.state).toEqual(game.state);
  });
});

describe('deshacer', () => {
  it('no permite volver atrás tras una tirada', () => {
    let game = newGame(config(3, { finalGirlId: 'laurie' }));
    expect(game.state.prompt?.type).toBe('main');
    // Jugar una carta implica tirar dados: no se puede deshacer.
    const card = game.state.prompt?.type === 'main' ? game.state.prompt.playable.find((p) => !p.weapons.length && p.cardId !== 'ataque-debil') : undefined;
    game = play(game, { type: 'playCard', cardId: card!.cardId });
    expect(canUndo(game)).toBe(false);
  });

  it('permite deshacer decisiones sin azar', () => {
    let game = newGame(config(3));
    const before = game.state;
    game = play(game, { type: 'discardForTime', cardIds: [game.state.fg.hand[0]!] });
    expect(canUndo(game)).toBe(true);
    game = undo(game);
    expect(game.state).toBe(before);
  });
});

describe('preparación', () => {
  it('sigue el reglamento', () => {
    const s = createGame(config(11, { setupId: 'la-hoguera', finalGirlId: 'laurie' }));
    expect(s.fg.hand).toHaveLength(6);
    expect(s.fg.health.hp).toBe(5);
    expect(s.killer.health.hp).toBe(12);
    expect(s.fg.time).toBe(6);
    expect(s.fg.terror).toBe(4); // Hans empieza en Terror 4
    expect(s.horrorDeck.length + s.horrorDiscard.length).toBeLessThanOrEqual(10);
    expect(Object.values(s.itemDecks).every((d) => d.length === 4 || d.length === 3)).toBe(true);
    expect(s.fg.zone).toBe('pantano');
    expect(s.killer.zone).toBe('noroeste');
    expect(s.activeEvents.length + s.eventDiscard.length).toBe(1);
    // El objeto bonus de Laurie está en algún mazo de Objetos.
    const all = Object.values(s.itemDecks).flat().map((c) => c.id);
    expect(all.filter((id) => itemDef(s, id).onlyFor).every((id) => id === 'arco-de-laurie')).toBe(true);
  });
});

describe('sin cartas ni Tiempo', () => {
  it('la partida sigue sola: no se queda esperando en la Planificación', () => {
    const s = createGame(config(5, { finalGirlId: 'laurie' }));
    // Simula haber gastado todas las cartas (devueltas a la Tabla) y quedarse a 0 de Tiempo.
    s.actionDiscard.push(...s.fg.hand);
    s.fg.hand = [];
    s.fg.time = 0;
    for (const id of Object.keys(s.actionTable)) if (actionDef(id).cost === 0) s.actionDiscard.push(...Array<string>(s.actionTable[id]!).fill(id)), (s.actionTable[id] = 0);
    const after = dispatch(s, { type: 'endActionPhase' });
    expect(after.prompt?.type).not.toBe('planning');
    expect(after.log.some((l) => l.text.includes('No te queda Tiempo'))).toBe(true);
  });
});
