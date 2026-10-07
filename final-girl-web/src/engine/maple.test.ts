import { describe, expect, it } from 'vitest';
import { createGame, dispatch, run, type GameState } from './index';
import { brVisible, mapleInit } from './maple';
import { pushEffects } from './core';
import { neighbors } from './lookup';

const game = (over: Partial<Parameters<typeof createGame>[0]> = {}): GameState =>
  createGame({ killerId: 'dr-fright', locationId: 'maple-lane', finalGirlId: 'nancy', board: 'normal', epicDarkPower: false, bonusItems: false, seed: 11, setupId: 'un-sitio-tranquilo', ...over });

const q = (...pairs: [number, number][]) => pairs.map(([qx, qy]) => ({ qx, qy }));

describe('Sala de Calderas: deslizamiento (ejemplo del reglamento)', () => {
  it('arriba, arriba, izquierda, abajo revela mitad inferior, mitad inferior, mitad derecha y cuadrante superior derecho', () => {
    const placed = [{ id: 'dd', x: 0, y: 0 }];
    const add = (dx: number, dy: number) => {
      const last = placed[placed.length - 1]!;
      placed.push({ id: `c${placed.length}`, x: last.x + dx, y: last.y + dy });
      return brVisible(placed, placed.length - 1);
    };
    expect(add(0, 1)).toEqual(q([0, 1], [1, 1])); // arriba: mitad inferior
    expect(add(0, 1)).toEqual(q([0, 1], [1, 1])); // arriba otra vez: mitad inferior
    expect(add(1, 0)).toEqual(q([1, 0], [1, 1])); // izquierda: mitad derecha
    expect(add(0, -1)).toEqual(q([1, 0])); // abajo: cuadrante superior derecho
  });

  it('el Dr. Fright aparece una sola vez en cada cuadrante de las cuatro cartas', () => {
    const s = game();
    expect(new Set(s.maple!.br.deck)).toEqual(new Set(['br-1', 'br-2', 'br-3', 'br-4']));
    expect(mapleInit().br.deck).toHaveLength(4);
  });
});

describe('Despierta y Dormida', () => {
  it('se empieza Despierta y el Dr. Fright no puede ser atacado ni te ataca', () => {
    const s = game();
    expect(s.maple!.asleep).toBe(false);
    s.killer.zone = s.fg.zone;
    s.fg.hand = ['ataque-debil'];
    run(s);
    expect(s.prompt?.type === 'main' && s.prompt.playable.some((c) => c.cardId === 'ataque-debil')).toBe(false);
  });

  it('Dormida se puede atacar al Dr. Fright en su espacio', () => {
    const s = game();
    s.maple!.asleep = true;
    s.killer.zone = s.fg.zone;
    s.fg.hand = ['ataque-debil'];
    run(s);
    expect(s.prompt?.type === 'main' && s.prompt.playable.some((c) => c.cardId === 'ataque-debil')).toBe(true);
  });

  it('Dormida no se puede salvar a las Víctimas', () => {
    const s = game();
    s.maple!.asleep = true;
    s.fg.zone = 'salida-n';
    s.victims.push({ id: 'vx', zone: 'salida-n' });
    run(s);
    expect(s.prompt?.type === 'main' && s.prompt.canRescue).toBe(false);
  });

  it('«Jamás volver a dormir» te duerme y reinicia el mazo; resolver la Sala de Calderas pide dirección', () => {
    const s = game();
    pushEffects(s, [{ kind: 'custom', id: 'df-sleep' }], { kind: 'horror' });
    run(s);
    expect(s.maple!.asleep).toBe(true);
    expect(s.maple!.br.deck).toHaveLength(4);
    pushEffects(s, [{ kind: 'custom', id: 'df-resolve-br' }], { kind: 'horror' });
    run(s);
    expect(s.prompt?.type).toBe('choice');
  });

  it('al revelar las cuatro cartas despiertas', () => {
    let s = game();
    s.maple!.asleep = true;
    s.fg.health.hp = s.fg.health.max = 99;
    for (let i = 0; i < 4 && s.maple!.asleep; i++) {
      pushEffects(s, [{ kind: 'custom', id: 'df-resolve-br' }], { kind: 'horror' });
      run(s);
      let guard = 0;
      while (s.prompt && s.prompt.type !== 'main' && guard++ < 20) {
        s = dispatch(s, s.prompt.type === 'choice' ? { type: 'choose', option: s.prompt.options[0]!.id } : s.prompt.type === 'react' ? { type: 'takeHit' } : { type: 'confirmRoll' });
      }
    }
    expect(s.maple!.asleep).toBe(false);
  });
});

describe('Maple Lane: Casas y mapa', () => {
  it('no puedes entrar andando en una Casa ocupada pero sí en una vacía', () => {
    const s = game({ setupId: 'maple-lane' });
    s.fg.zone = 'calle-s';
    s.victims = [{ id: 'v1', zone: 'se-alto' }];
    s.stack.push({ t: 'fgMove', remaining: 1, src: { kind: 'system' }, mode: 'walk' });
    run(s);
    const to = (s.prompt as unknown as { to: string[] }).to;
    expect(to).not.toContain('se-alto');
    expect(to).toContain('salida-s');
    s.victims = [];
    s.stack.pop();
    s.stack.push({ t: 'fgMove', remaining: 1, src: { kind: 'system' }, mode: 'walk' });
    run(s);
    expect((s.prompt as unknown as { to: string[] }).to).toContain('se-alto');
  });

  it('«Convencer» permite entrar en la Casa ocupada adyacente', () => {
    const s = game({ setupId: 'maple-lane' });
    s.fg.zone = 'calle-s';
    s.victims = [{ id: 'v1', zone: 'se-alto' }];
    s.stack.push({ t: 'fgMove', remaining: 1, src: { kind: 'system' }, mode: 'convince' });
    run(s);
    expect((s.prompt as unknown as { to: string[] }).to).toEqual(['se-alto']);
    const n = dispatch(s, { type: 'moveTo', zone: 'se-alto', bring: [] });
    expect(n.fg.zone).toBe('se-alto');
  });

  it('el mapa tiene 21 espacios y cada Casa se conecta a una Calle o Salida', () => {
    const s = game();
    for (const z of ['no-alto', 'ne-top', 'so-centro']) expect(neighbors(s, z, 'enemy').length).toBeGreaterThan(0);
    expect(neighbors(s, 'interseccion', 'enemy').sort()).toEqual(['calle-e', 'calle-n', 'calle-o', 'calle-s']);
  });

  it('cada cuadrante tiene su mazo de 3 Objetos', () => {
    const s = game();
    expect(Object.keys(s.itemDecks).sort()).toEqual(['ne', 'no', 'se', 'so']);
    for (const d of Object.values(s.itemDecks)) expect(d).toHaveLength(3);
  });

  it('buscar con éxito en una Casa la marca con una X y no se puede repetir', () => {
    const s = game({ setupId: 'maple-lane' });
    s.fg.zone = 'no-centro';
    s.fg.hand = [];
    pushEffects(s, [{ kind: 'search', draw: 1 }], { kind: 'action', id: 'buscar' });
    run(s);
    expect(s.tokens.some((t) => t.id === 'x' && t.zone === 'no-centro')).toBe(true);
    pushEffects(s, [{ kind: 'search', draw: 1 }], { kind: 'action', id: 'buscar' });
    run(s);
    expect(s.log.some((l) => l.text.includes('ya no se puede buscar'))).toBe(true);
  });
});
