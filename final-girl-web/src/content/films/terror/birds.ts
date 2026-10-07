import type { Effect, Killer } from '../../types';

const base = 'assets/killers/birds';
const custom = (id: string): Effect => ({ kind: 'custom', id });
const terror = (amount: number): Effect => ({ kind: 'terror', amount });
const row = (effects: Effect[] = [], revealDarkPower = false) => ({
  attack: 0,
  move: 0,
  effects,
  ...(revealDarkPower ? { revealDarkPower } : {}),
});

const SPAWN = custom('birds-spawn');
const ATTACK = custom('birds-attack');

/**
 * Terror from Above: no hay Asesino. Los Pájaros son Esbirros (fichas de 1 o 3 pájaros) y la carta de Sed de Sangre
 * hace de tablero del Asesino. Todo el comportamiento vive en engine/birds.ts.
 */
export const BIRDS: Killer = {
  id: 'birds',
  name: 'Los Pájaros',
  film: 'terror',
  icon: 'bird',
  board: `${base}/board.webp`,
  cover: `${base}/cover.webp`,
  token: `${base}/tokens/bird-1.webp`,
  select: `${base}/select.webp`,
  startTerror: 4,
  health: 1,
  invulnerable: true,
  birds: true,
  // Carta de Sed de Sangre, de abajo a arriba: Inicio, Evento, +1 Terror, Poder Oscuro, +1 Terror.
  bloodlust: [row(), row([{ kind: 'drawEvent' }]), row([terror(1)]), row([], true), row([terror(1)])],
  // "Si se revela el Gran Final, pierdes 1 Vida (inevitable). Si no, descarta 1 carta de Terror."
  bloodlustMaxEffect: [custom('birds-bloodlust-max')],
  bloodlustMaxText: 'con el Gran Final revelado pierdes 1 Vida; si no, se descarta 1 carta de Terror',
  minion: {
    name: 'Pájaro',
    plural: 'Pájaros',
    count: 36,
    health: 1,
    attack: 1,
    tokens: [`${base}/tokens/bird-1.webp`],
    reference: `${base}/generar-pajaros.webp`,
    text:
      'Los Pájaros son Esbirros (1 Vida cada uno): se representan con fichas de 1 o 3 pájaros y nunca se mueven por sí mismos. ' +
      'No puede haber más de 3 en un espacio. Atacan a UN objetivo de su espacio causando tanto daño como Pájaros haya, y prefieren las Víctimas normales a la Chica Final. ' +
      'Cada punto de daño que hagas elimina 1 Pájaro. Pierdes si hay 3 Pájaros en cada espacio del tablero.',
  },
  // Reverso del Gran Final: ataque ▶ Generar Pájaros.
  initialMinionAction: [ATTACK, SPAWN],
  initialAction: [],
  finaleBack: `${base}/finale/back.webp`,
  darkPowerBack: `${base}/dark-power/back.webp`,
  finales: [
    {
      id: 'ataque-de-aves',
      name: 'Ataque de aves',
      image: `${base}/finale/ataque-de-aves.webp`,
      minionAction: [SPAWN, ATTACK, SPAWN],
      finalAction: [],
      text: 'Durante el resto de la partida, al generar Pájaros tira un dado y coloca ese número de Pájaros en tu espacio.',
      custom: 'finale-bird-attack',
    },
    {
      id: 'insufribles-bichos',
      name: 'Insufribles bichos',
      image: `${base}/finale/insufribles-bichos.webp`,
      minionAction: [SPAWN, ATTACK, SPAWN],
      finalAction: [],
      text: 'Al generar Pájaros, DEBES elegir el resultado más alto como número de Pájaros a colocar.',
      custom: 'finale-bird-highest',
    },
    {
      id: 'enjambre-interminable',
      name: 'Enjambre interminable',
      image: `${base}/finale/enjambre-interminable.webp`,
      minionAction: [SPAWN],
      finalAction: [],
      text: 'Al moverte a un espacio, pierdes 1 Vida (inevitable) si hay 3 Pájaros en ese espacio.',
      custom: 'finale-bird-swarm',
    },
  ],
  darkPowers: [
    {
      id: 'estan-esperando-para-atacar',
      name: 'Están esperando para atacar',
      image: `${base}/dark-power/estan-esperando-para-atacar.webp`,
      text: 'Durante el Mantenimiento, si hay 3 Pájaros en tu espacio: +2 Terror.',
      custom: 'dp-birds-waiting',
    },
    {
      id: 'birdnado',
      name: 'Birdnado',
      image: `${base}/dark-power/birdnado.webp`,
      text: 'Durante el Mantenimiento, si hay 10 o más Pájaros en total en tu espacio y los adyacentes, pierdes 3 Vidas (inevitable).',
      custom: 'dp-birdnado',
    },
    {
      id: 'corre-por-tu-vida',
      name: 'Corre por tu vida',
      image: `${base}/dark-power/corre-por-tu-vida.webp`,
      text: 'Durante el Mantenimiento, la Víctima más alejada de ti entra en pánico. Si entra en pánico a un espacio con 2 o más Pájaros, la Víctima muere.',
      custom: 'dp-run-for-life',
    },
  ],
  horror: [
    {
      id: 'pero-de-donde-salen',
      name: '«Pero ¿de dónde salen?»',
      copies: 3,
      image: `${base}/horror/de-donde-salen.webp`,
      text: 'Generar Pájaros. Si se generan 3 o menos Pájaros: Generar Pájaros otra vez.',
      effects: [SPAWN, custom('birds-spawn-if-few')],
    },
    {
      id: 'es-desesperante',
      name: '«Es desesperante»',
      copies: 4,
      image: `${base}/horror/es-desesperante.webp`,
      text: '+2 Terror. Si hay al menos una Víctima Especial en juego: Generar Pájaros.',
      effects: [terror(2), custom('birds-spawn-if-special')],
    },
    {
      id: 'los-pajaros-estan-atacando',
      name: '«Los pájaros están atacando»',
      copies: 6,
      image: `${base}/horror/pajaros-atacando.webp`,
      text: 'Ataque de Pájaros en tu espacio y en todos los espacios donde los Pájaros superen en número a las Víctimas. Si no se producen ataques: Generar Pájaros y +1 Sed de Sangre.',
      effects: [custom('birds-attack-outnumber'), custom('birds-if-no-attacks')],
    },
    {
      id: 'intentan-entrar',
      name: '«¡Intentan entrar!»',
      copies: 3,
      image: `${base}/horror/intentan-entrar.webp`,
      text: '+1 Terror. En lugar de generar Pájaros como es normal, tira un dado y coloca ese número de Pájaros en el espacio de Búsqueda más cercano a ti.',
      effects: [terror(1), custom('birds-spawn-search')],
    },
    {
      id: 'muro-de-aves',
      name: 'Muro de aves',
      copies: 1,
      image: `${base}/horror/muro-de-aves.webp`,
      text: 'Las Víctimas no pueden ser salvadas en una Salida si hay Pájaros en el espacio. Cada vez que se mata un Pájaro, coloca una ficha en esta carta. Con 5 o más, retírala del juego.',
      effects: [],
      stays: 'hr-bird-wall',
    },
  ],
  specialRules:
    'No hay Asesino: la carta de Sed de Sangre y la de Generar Pájaros van junto al tablero del Lugar. ' +
    'Ganas si salvas a TODAS las Víctimas Especiales; pierdes si hay 3 Pájaros en cada espacio o si la Chica Final muere.',
};
