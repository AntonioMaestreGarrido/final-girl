import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ACTION_BACK, ACTION_CARDS, CORE_ASSETS, FILMS, PLAYER_BOARDS } from './index';
import type { Effect } from './types';

const PUBLIC = join(__dirname, '..', '..', 'public');
const exists = (path: string) => existsSync(join(PUBLIC, path));

const count = <T extends { copies: number }>(cards: T[]) => cards.reduce((n, c) => n + c.copies, 0);

/** Recorre todas las rutas de imagen de un objeto de contenido. */
function imagePaths(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string' && value.startsWith('assets/')) out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => imagePaths(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => imagePaths(v, out));
  return out;
}

describe('Caja básica', () => {
  it('tiene 23 cartas de Acción, 6 de ellas de coste cero', () => {
    const core = ACTION_CARDS.filter((c) => !c.onlyWith);
    expect(count(core)).toBe(23);
    expect(count(core.filter((c) => c.cost === 0))).toBe(6);
  });

  it('las cartas con Tirada tienen las tres líneas de resultado', () => {
    for (const card of ACTION_CARDS.filter((c) => c.timing !== 'afterRoll')) {
      expect(card.results, card.id).toBeDefined();
    }
  });

  it('el Asesino empieza en una casilla numerada del medidor de Terror', () => {
    for (const board of Object.values(PLAYER_BOARDS)) {
      expect(board.terrorTrack).toHaveLength(8);
      for (const film of FILMS) {
        expect(board.terrorTrack.some((p) => p.label === film.killer.startTerror)).toBe(true);
      }
    }
  });

  it('todas las imágenes existen', () => {
    const paths = imagePaths([ACTION_CARDS, ACTION_BACK, CORE_ASSETS, PLAYER_BOARDS]);
    expect(paths.filter((p) => !exists(p))).toEqual([]);
  });
});

describe.each(FILMS.map((f) => [f.id, f] as const))('Película %s', (_, film) => {
  const { killer, location } = film;
  const zoneIds = new Set(location.zones.map((z) => z.id));

  it('todas las imágenes existen', () => {
    expect(imagePaths(film).filter((p) => !exists(p))).toEqual([]);
  });

  it('los números de huida de cada zona no se solapan', () => {
    for (const zone of location.zones) {
      const faces = zone.flee.flatMap((f) => f.faces);
      expect(new Set(faces).size, zone.id).toBe(faces.length);
    }
  });

  it('las adyacencias son simétricas y apuntan a zonas existentes', () => {
    for (const zone of location.zones) {
      for (const { to } of zone.flee) {
        expect(zoneIds.has(to), `${zone.id} → ${to}`).toBe(true);
        const back = location.zones.find((z) => z.id === to)!;
        expect(back.flee.some((f) => f.to === zone.id), `${to} ↛ ${zone.id}`).toBe(true);
      }
    }
  });

  it('el mapa está conectado', () => {
    const seen = new Set([location.zones[0]!.id]);
    const queue = [location.zones[0]!.id];
    while (queue.length) {
      const id = queue.shift()!;
      for (const { to } of location.zones.find((z) => z.id === id)!.flee) {
        if (!seen.has(to)) seen.add(to), queue.push(to);
      }
    }
    expect(seen.size).toBe(location.zones.length);
  });

  it('cada mazo de Objetos corresponde a una zona de Búsqueda', () => {
    const search = location.zones.filter((z) => z.search).map((z) => z.id).sort();
    expect([...location.itemDecks].sort()).toEqual(search);
  });

  it('las preparaciones usan zonas válidas y colocan las mismas Víctimas (10 o más)', () => {
    const total = (v: Record<string, number>) => Object.values(v).reduce((a, b) => a + b, 0);
    const n = total(location.setups[0]!.victims);
    expect(n).toBeGreaterThanOrEqual(10);
    for (const setup of location.setups) {
      expect(zoneIds.has(setup.finalGirl), setup.id).toBe(true);
      expect(zoneIds.has(setup.killer), setup.id).toBe(true);
      for (const zone of Object.keys(setup.victims)) expect(zoneIds.has(zone), `${setup.id}: ${zone}`).toBe(true);
      expect(total(setup.victims), setup.id).toBe(n);
    }
  });

  it('los efectos solo mencionan zonas existentes', () => {
    const zonesIn = (effects: Effect[]): string[] =>
      effects.flatMap((e) =>
        e.kind === 'placeVictims' && 'zone' in e.where ? [e.where.zone] : e.kind === 'choice' ? e.options.flatMap(zonesIn) : [],
      );
    const all = [...location.horror, ...killer.horror].flatMap((h) => zonesIn(h.effects));
    all.push(...location.events.flatMap((e) => zonesIn(e.onReveal)));
    expect(all.filter((z) => !zoneIds.has(z))).toEqual([]);
  });

  it('el tablero del Asesino tiene una fila de Poder Oscuro', () => {
    expect(killer.bloodlust.filter((r) => r.revealDarkPower)).toHaveLength(1);
  });
});

describe('Happy Trails Horror: recuento de componentes', () => {
  const film = FILMS.find((f) => f.id === 'happy-trails')!;
  it('coincide con las hojas de componentes', () => {
    expect(count(film.killer.horror)).toBe(16);
    expect(film.killer.finales).toHaveLength(3);
    expect(film.killer.darkPowers.filter((d) => !d.epic)).toHaveLength(3);
    expect(film.killer.darkPowers.filter((d) => d.epic)).toHaveLength(1);
    expect(count(film.location.horror)).toBe(8);
    expect(film.location.events).toHaveLength(10);
    expect(film.location.setups).toHaveLength(5);
    expect(film.location.items).toHaveLength(18);
    expect(film.location.zones).toHaveLength(18);
    expect(film.finalGirls).toHaveLength(2);
  });
});

describe('Slaughter in the Groves: recuento de componentes', () => {
  const film = FILMS.find((f) => f.id === 'grooves')!;
  it('coincide con las hojas de componentes', () => {
    expect(count(film.killer.horror)).toBe(16);
    expect(film.killer.finales).toHaveLength(3);
    expect(film.killer.darkPowers.filter((d) => !d.epic)).toHaveLength(3);
    expect(film.killer.darkPowers.filter((d) => d.epic)).toHaveLength(1);
    expect(count(film.location.horror)).toBe(8);
    expect(film.location.events).toHaveLength(10);
    expect(film.location.setups).toHaveLength(5);
    expect(film.location.items).toHaveLength(17);
    expect(film.location.zones).toHaveLength(19);
    expect(film.location.zones.filter((z) => z.sacred)).toHaveLength(3);
    expect(film.killer.wrath?.levels).toHaveLength(10);
    expect(film.location.wrath?.levels).toHaveLength(10);
    expect(film.location.bloodlustTrack?.rows).toHaveLength(7);
    expect(count(ACTION_CARDS.filter((c) => c.onlyWith?.includes('inkanyamba')))).toBe(2);
  });
});
