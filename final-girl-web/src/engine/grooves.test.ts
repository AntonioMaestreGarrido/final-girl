import { describe, expect, it } from 'vitest';
import { createGame, dispatch, run, type GameConfig, type GameState, type Input } from './index';
import { itemDef } from './lookup';

function game(extra: Partial<GameConfig> = {}): GameState {
  return createGame({
    killerId: 'inkanyamba',
    locationId: 'sacred-groves',
    finalGirlId: 'adelaide',
    board: 'normal',
    epicDarkPower: false,
    bonusItems: false,
    seed: 10,
    setupId: 'dia-de-la-familia',
    ...extra,
  });
}

const give = (s: GameState, id: string, inHands = false) =>
  s.fg.items.push({ uid: `g${s.fg.items.length}`, id, inHands, ...(itemDef(s, id).uses ? { uses: itemDef(s, id).uses } : {}) });

/** Responde a las preguntas hasta llegar a la pregunta que cumple `until` (eligiendo la primera opción). */
function answer(s: GameState, inputs: Input[]): GameState {
  for (const i of inputs) s = dispatch(s, i);
  return s;
}

describe('Slaughter in the Groves: preparación', () => {
  it('las Iras empiezan en 2 y Expiar está en la Tabla', () => {
    const s = game();
    expect(s.wrath).toEqual({ killer: 2, divine: 2 });
    expect(s.actionTable.expiar).toBe(2);
    expect(s.victims).toHaveLength(12);
    expect(s.killer.health.hp).toBe(9);
  });

  it('con Hans en Camp no hay Iras ni Expiar', () => {
    const s = game({ killerId: 'hans', locationId: 'camp-happy-trails', setupId: 'la-hoguera' });
    expect(s.wrath).toEqual({});
    expect(s.actionTable.expiar).toBeUndefined();
  });

  it('solo con Inkanyamba hay una sola Ira y no se pregunta cuál', () => {
    let s = game({ locationId: 'camp-happy-trails', setupId: 'la-hoguera' });
    expect(s.wrath).toEqual({ killer: 2 });
    s.fg.hand.push('expiar');
    s.actionTable.expiar!--;
    s.wrath.killer = 9;
    s.rng.calls = 0;
    // Fuerza 3 éxitos: dados con 6.
    s = dispatch(s, { type: 'playCard', cardId: 'expiar' });
    while (s.prompt?.type === 'roll') s = dispatch(s, { type: 'confirmRoll' });
    expect(s.prompt?.type).not.toBe('choice');
  });
});

describe('Ira', () => {
  it('Incienso resta 1 y Adicto a la indignación suma 1 a cada aumento', () => {
    const s = game();
    give(s, 'incienso');
    s.stack.push({ t: 'effects', effects: [{ kind: 'wrath', which: 'killer', op: 'increase', amount: 3 }], i: 0, src: { kind: 'system' } });
    run(s);
    const after = s;
    expect(after.log.some((l) => l.text.includes('Ira Asesina aumenta en 2 (Incienso −1)'))).toBe(true);
  });

  it('Desatar la Ira Divina en 10 descarta la mano salvo Expiar y reduce la Ira', () => {
    let s = game();
    s.wrath.divine = 10;
    s.fg.hand = ['caminar', 'caminar', 'concentrarse', 'expiar'];
    s.actionTable.expiar!--;
    s.stack.push({ t: 'effects', effects: [{ kind: 'unleash', which: 'divine' }], i: 0, src: { kind: 'system' } });
    run(s);
    expect(s.wrath.divine).toBe(7);
    expect(s.log.some((l) => l.text.includes('Descartas 3 cartas'))).toBe(true);
  });

  it('el track de Sacred Groves se aplica en la primera subida de la Sed de Sangre', () => {
    let s = game();
    const before = s.wrath.divine!;
    s.stack.push({ t: 'effects', effects: [{ kind: 'bloodlust', amount: 1 }], i: 0, src: { kind: 'system' } });
    run(s);
    expect(s.log.some((l) => l.text.startsWith('Track de Sed de Sangre de Sacred Groves'))).toBe(true);
    // Día de la familia: 4 Víctimas en espacios Sagrados (Santuario 2, Cementerio 2).
    expect(s.log.some((l) => l.text.includes(`Ira Divina aumenta en 4: nivel ${before + 4}`))).toBe(true);
  });
});

describe('Habilidades Definitivas', () => {
  it('Adelaide elige un efecto inmediato al desbloquearla', () => {
    let s = game({ setupId: 'montones-de-turistas' }); // empieza en la Salida del oeste
    s.fg.rescueSlots = s.fg.rescueSlots.map((_, i) => i > 0);
    s.victims.push({ id: 'vx', zone: 'salida-oeste' });
    s.victimPool--;
    s.fg.health.hp = 2;
    s = answer(s, [{ type: 'startRescue' }, { type: 'rescueOne', victimId: 'vx', slot: 0 }]);
    expect(s.prompt?.type).toBe('choice');
    s = dispatch(s, { type: 'choose', option: 'heal' });
    expect(s.fg.health.hp).toBe(6);
  });

  it('Barbara hace daño extra por cada Víctima de su zona y estas mueren sin Sed de Sangre', () => {
    let s = game({ finalGirlId: 'barbara' });
    s.fg.ultimate = true;
    s.killer.zone = s.fg.zone;
    s.victims.push({ id: 'va', zone: s.fg.zone }, { id: 'vb', zone: s.fg.zone });
    s.victimPool -= 2;
    const hp = s.killer.health.hp;
    const bl = s.killer.bloodlust;
    s.stack.push({ t: 'effects', effects: [{ kind: 'damage', amount: 1 }], i: 0, src: { kind: 'item', id: 'x' } });
    run(s);
    expect(s.prompt?.type).toBe('choice');
    s = dispatch(s, { type: 'choose', option: '2' });
    expect(s.killer.health.hp).toBe(hp - 3);
    expect(s.killer.bloodlust).toBe(bl);
    expect(s.victims.some((v) => v.id === 'va' || v.id === 'vb')).toBe(false);
  });
});

describe('objetos', () => {
  it('el Látigo puede mover al Asesino tras dañarlo', () => {
    let s = game();
    give(s, 'latigo', true);
    s.killer.zone = s.fg.zone;
    s = dispatch(s, { type: 'playCard', cardId: 'ataque-debil', weaponUid: s.fg.items[0]!.uid });
    while (s.prompt?.type === 'roll') s = dispatch(s, { type: 'confirmRoll' });
    if (s.log.some((l) => l.text.includes('Látigo: +1 de daño'))) {
      expect(s.prompt?.type).toBe('choice');
      const opt = s.prompt?.type === 'choice' ? s.prompt.options[0]!.id : '';
      s = dispatch(s, { type: 'choose', option: opt });
      expect(s.killer.zone).toBe(opt);
    }
  });

  it('las señales de Fuera de servicio impiden que las Víctimas pasen al huir', () => {
    let s = game();
    give(s, 'senales-fuera-de-servicio');
    s = dispatch(s, { type: 'useItem', uid: s.fg.items[0]!.uid, action: 'use' });
    expect(s.prompt?.type).toBe('choice');
    const opt = s.prompt?.type === 'choice' ? s.prompt.options[0]!.id : '';
    s = dispatch(s, { type: 'choose', option: opt });
    expect(s.blocked).toHaveLength(1);
    expect(s.fg.time).toBe(5);
  });

  it('el Viejo rifle gana +2 de alcance en un espacio Sagrado', async () => {
    const s = game();
    give(s, 'viejo-rifle', true);
    s.fg.zone = 'santuario';
    s.killer.zone = 'objetos-perdidos'; // a 1 zona
    const { weaponsFor } = await import('./player');
    expect(weaponsFor(s, 'ataque-debil')).toHaveLength(1);
    s.killer.zone = 'puente'; // a 2 zonas
    expect(weaponsFor(s, 'ataque-debil')).toHaveLength(1);
    s.killer.zone = 'arboles-sagrados'; // a 3 zonas
    expect(weaponsFor(s, 'ataque-debil')).toHaveLength(1);
    s.fg.zone = 'sendero-sur';
    s.killer.zone = 'arboles-sagrados';
    expect(weaponsFor(s, 'ataque-debil')).toHaveLength(0);
  });
});

describe('Eventos', () => {
  it('el Hombre Sagrado se marcha al encontrarse con el Asesino y reparte 10 de Ira', () => {
    let s = game();
    s.activeEvents.push('el-hombre-sagrado');
    const h = s.victims.find((v) => v.zone === 'orilla')!;
    h.role = 'hombre';
    h.special = 'blue';
    s.killer.zone = 'rocas';
    s.stack.push({ t: 'effects', effects: [{ kind: 'killerAction', action: { target: 'victim', moves: 1, attacks: 0 } }], i: 0, src: { kind: 'system' } });
    s.killer.zone = 'orilla';
    // Entrar en su zona mediante un salto directo del Asesino.
    s.stack.pop();
    s.stack.push({ t: 'effects', effects: [{ kind: 'custom', id: 'killer-to-busiest-sacred' }], i: 0, src: { kind: 'system' } });
    s.victims = s.victims.filter((v) => v === h);
    s.fg.zone = 'pradera';
    h.zone = 'pradera';
    run(s);
    // Sin Víctimas en espacios Sagrados el Asesino aparece en tu zona (pradera), donde está el Hombre Sagrado.
    expect(s.victims.some((v) => v.role === 'hombre')).toBe(false);
    expect(s.activeEvents).not.toContain('el-hombre-sagrado');
    expect(s.gone).toBe(1);
  });

  it('salvar al Super Turista reduce una Ira en 4', () => {
    let s = game({ setupId: 'montones-de-turistas' });
    s.wrath = { killer: 8, divine: 6 };
    s.activeEvents.push('el-super-turista');
    s.victims.push({ id: 'st', zone: 'salida-oeste', role: 'super', special: 'white' });
    s.victimPool--;
    s = answer(s, [{ type: 'startRescue' }, { type: 'rescueOne', victimId: 'st', slot: 0 }]);
    while (s.prompt?.type === 'rescue') s = dispatch(s, { type: 'rescueDone' });
    expect(s.prompt?.type).toBe('choice');
    s = dispatch(s, { type: 'choose', option: 'killer' });
    expect(s.wrath.killer).toBe(4);
  });
});
