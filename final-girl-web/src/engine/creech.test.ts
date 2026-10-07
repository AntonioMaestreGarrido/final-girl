import { describe, expect, it } from 'vitest';
import { createGame, dispatch, run, type GameState } from './index';
import { distance, neighbors, shortestPaths } from './lookup';
import { creechOnGain } from './creech';
import { pushEffects } from './core';

const game = (over: Partial<Parameters<typeof createGame>[0]> = {}): GameState =>
  createGame({ killerId: 'poltergeist', locationId: 'creech-manor', finalGirlId: 'alice', board: 'normal', epicDarkPower: false, bonusItems: false, seed: 7, setupId: 'extranos-trofeos', ...over });

const carolyn = () => ({ uid: 'carolyn1', id: 'carolyn', inHands: false });
const floppy = () => ({ uid: 'floppy1', id: 'mr-floppy', inHands: false });

const startMove = (s: GameState, mode: 'walk' = 'walk', remaining = 1) => {
  s.stack.push({ t: 'fgMove', remaining, src: { kind: 'system' }, mode });
  run(s);
};

describe('Creech Manor: tablero', () => {
  it('las uniones de un solo sentido solo se cruzan en su sentido', () => {
    const s = game();
    expect(neighbors(s, 'cuarto-tele', 'fg')).toContain('lavabo-izq');
    expect(neighbors(s, 'lavabo-izq', 'fg')).not.toContain('cuarto-tele');
    expect(neighbors(s, 'despacho', 'victim')).toContain('ext-der');
    expect(neighbors(s, 'ext-der', 'victim')).not.toContain('despacho');
    // Para ir del Lavabo izquierdo al Cuarto de la tele hay que dar la vuelta.
    expect(distance(s, 'cuarto-tele', 'lavabo-izq')).toBe(1);
    expect(distance(s, 'lavabo-izq', 'cuarto-tele')).toBeGreaterThan(1);
    expect(shortestPaths(s, 'lavabo-izq', 'cuarto-tele', 'enemy').every((p) => p.length > 1)).toBe(true);
  });

  it('la Escalera Rota corta la unión y la Escalera de cuerda convierte un sentido único en doble', () => {
    const s = game();
    expect(neighbors(s, 'ext-izq', 'fg')).toContain('lavabo-izq');
    s.tokens.push({ id: 'escalera-rota', zone: 'ext-izq' });
    expect(neighbors(s, 'ext-izq', 'fg')).not.toContain('lavabo-izq');
    expect(neighbors(s, 'lavabo-izq', 'fg')).not.toContain('ext-izq');
    s.tokens.push({ id: 'escalera-de-cuerda', zone: 'lavabo-izq' });
    expect(neighbors(s, 'lavabo-izq', 'fg')).toContain('cuarto-tele');
  });

  it('el Candado cierra la unión a Enemigos y Víctimas pero no a la Chica Final', () => {
    const s = game();
    s.creech!.lock = ['vestibulo', 'salon-baile'];
    expect(neighbors(s, 'vestibulo', 'enemy')).not.toContain('salon-baile');
    expect(neighbors(s, 'salon-baile', 'victim')).not.toContain('vestibulo');
    expect(neighbors(s, 'vestibulo', 'fg')).toContain('salon-baile');
  });
});

describe('Creech Manor: Carolyn y victoria', () => {
  it('Carolyn y Mr. Floppy se esconden en los mazos (nunca bocarriba) y hay 12 cartas en total', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const s = game({ seed });
      const all = Object.values(s.itemDecks).flat();
      expect(all).toHaveLength(12);
      expect(all.filter((c) => c.faceUp)).toHaveLength(3);
      expect(all.filter((c) => c.faceUp).some((c) => c.id === 'carolyn' || c.id === 'mr-floppy')).toBe(false);
      expect(all.some((c) => c.id === 'carolyn')).toBe(true);
      expect(all.some((c) => c.id === 'mr-floppy')).toBe(true);
    }
  });

  it('se gana al entrar en una zona de Salida con Carolyn', () => {
    const s = game();
    s.fg.zone = 'vestibulo';
    s.fg.items.push(carolyn());
    startMove(s);
    const n = dispatch(s, { type: 'moveTo', zone: 'ext-centro', bring: [] });
    expect(n.outcome?.winner).toBe('finalGirl');
  });

  it('sin Carolyn, entrar en la Salida no gana', () => {
    const s = game();
    s.fg.zone = 'vestibulo';
    startMove(s);
    const n = dispatch(s, { type: 'moveTo', zone: 'ext-centro', bring: [] });
    expect(n.outcome).toBeNull();
  });

  it('Barrera invisible: sin toda la Vida no puedes entrar en la Salida con Carolyn', () => {
    const s = game();
    s.killer.darkPowers = [{ id: 'barrera-invisible', revealed: true }];
    s.fg.zone = 'vestibulo';
    s.fg.items.push(carolyn());
    s.fg.health.hp = s.fg.health.max - 1;
    startMove(s);
    const dest = () => (s.prompt as unknown as { to: string[] }).to;
    expect(dest()).not.toContain('ext-centro');
    s.fg.health.hp = s.fg.health.max;
    s.stack.pop();
    startMove(s);
    expect(dest()).toContain('ext-centro');
  });

  it('¿Olvidando algo?: hace falta también a Mr. Floppy', () => {
    const s = game({ epicDarkPower: true });
    s.killer.darkPowers = [{ id: 'olvidando-algo', revealed: true }];
    s.fg.zone = 'vestibulo';
    s.fg.items.push(carolyn());
    startMove(s);
    expect(dispatch(s, { type: 'moveTo', zone: 'ext-centro', bring: [] }).outcome).toBeNull();
    const s2 = game({ epicDarkPower: true });
    s2.killer.darkPowers = [{ id: 'olvidando-algo', revealed: true }];
    s2.fg.zone = 'vestibulo';
    s2.fg.items.push(carolyn(), floppy());
    startMove(s2);
    expect(dispatch(s2, { type: 'moveTo', zone: 'ext-centro', bring: [] }).outcome?.winner).toBe('finalGirl');
  });

  it('al unirse Carolyn se retiran los Poderes Oscuros Menores', () => {
    const s = game();
    s.killer.minors = [{ id: 'fuerzas-nunca-vistas', hp: 0 }];
    s.fg.items.push(carolyn());
    creechOnGain(s, 'carolyn');
    expect(s.killer.minors).toHaveLength(0);
  });

  it('«¿Carolyn, dónde estás?» baraja a Carolyn de nuevo en un mazo y no revela la carta superior', () => {
    const s = game();
    s.fg.zone = 'garaje';
    s.fg.items.push(carolyn());
    pushEffects(s, [{ kind: 'custom', id: 'pg-carolyn' }], { kind: 'horror' });
    run(s);
    expect(s.fg.items.some((i) => i.id === 'carolyn')).toBe(false);
    expect(s.itemDecks.garaje!.some((c) => c.id === 'carolyn')).toBe(true);
    expect(s.itemDecks.garaje!.every((c) => !c.faceUp)).toBe(true);
  });

  it('Carolyn no se puede descartar', () => {
    const s = game();
    s.fg.items.push(carolyn());
    pushEffects(s, [{ kind: 'custom', id: 'cm-fake' }], { kind: 'horror' });
    run(s);
    expect(s.fg.items.some((i) => i.id === 'carolyn')).toBe(true);
  });
});

describe('Creech Manor: Poltergeist', () => {
  it('no se le puede atacar ni dañar', () => {
    const s = game();
    s.fg.zone = s.killer.zone;
    s.fg.hand = ['ataque-debil'];
    const prompt = s.prompt;
    expect(prompt?.type).toBe('main');
    // Con el Poltergeist en tu zona no hay a quién golpear.
    run(s);
    expect(s.prompt?.type === 'main' && s.prompt.playable.some((c) => c.cardId === 'ataque-debil')).toBe(false);
  });

  it('el pánico mueve a la Chica Final según la tirada de huida', () => {
    const s = game();
    s.creech!.panicNow = true;
    s.fg.zone = 'rellano';
    s.stack.push({ t: 'fgMove', remaining: 1, src: { kind: 'system' }, mode: 'walk' });
    run(s);
    // Con pánico no se pregunta el destino: o se ha movido o se ha quedado.
    expect(s.prompt?.type).not.toBe('move');
    expect(s.log.some((l) => l.text.startsWith('Pánico:'))).toBe(true);
  });

  it('el Candado anula un ataque y se quita', () => {
    const s = game();
    s.fg.zone = 'vestibulo';
    s.creech!.lock = ['vestibulo', 'salon-baile'];
    s.tokens.push({ id: 'candado', zone: 'vestibulo' });
    s.stack.push({ t: 'attackFG', damage: 3, reduce: 0, ignore: false, by: 'killer' });
    const hp = s.fg.health.hp;
    run(s);
    expect(s.fg.health.hp).toBe(hp);
    expect(s.creech!.lock).toBeNull();
  });

  it('«Pronto estará perdida»: sin cartas de Terror se pierde', () => {
    const s = game();
    s.horrorDeck = [];
    pushEffects(s, [{ kind: 'custom', id: 'pg-lost-draw' }], { kind: 'finale' });
    run(s);
    expect(s.outcome?.winner).toBe('killer');
  });

  it('Helicóptero: con Carolyn se gana; sin ella se vuelve al Ático', () => {
    const s = game();
    s.fg.zone = 'atico';
    s.fg.items.push(carolyn());
    s.tokens.push({ id: 'helicoptero', zone: 'helicoptero' });
    startMove(s);
    expect(s.prompt?.type === 'move' && s.prompt.to).toContain('helicoptero');
    expect(dispatch(s, { type: 'moveTo', zone: 'helicoptero', bring: [] }).outcome?.winner).toBe('finalGirl');

    const s2 = game();
    s2.fg.zone = 'atico';
    s2.tokens.push({ id: 'helicoptero', zone: 'helicoptero' });
    startMove(s2);
    let n = dispatch(s2, { type: 'moveTo', zone: 'helicoptero', bring: [] });
    expect(n.outcome).toBeNull();
    expect(n.fg.zone).toBe('atico');
    expect(n.tokens.some((t) => t.id === 'helicoptero')).toBe(false);
    n = structuredClone(n);
  });
});
