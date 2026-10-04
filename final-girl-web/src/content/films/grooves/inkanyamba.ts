import type { Effect, Killer, KillerAction, WrathAmount } from '../../types';

const base = 'assets/killers/inkanyamba';
const ka = (target: KillerAction['target'], moves: number, attacks: number): Effect => ({
  kind: 'killerAction',
  action: { target, moves, attacks },
});
const row = (attack: number, move: number, revealDarkPower = false) => ({
  attack,
  move,
  effects: [],
  ...(revealDarkPower ? { revealDarkPower } : {}),
});
const terror = (amount: number): Effect => ({ kind: 'terror', amount });
const heal = (amount: number): Effect => ({ kind: 'killerHeal', amount });
const unleash: Effect = { kind: 'unleash', which: 'killer' };
const wrathUp = (amount: number): Effect => ({ kind: 'wrath', which: 'killer', op: 'increase', amount });
const wrathBy = (by: WrathAmount): Effect => ({ kind: 'wrath', which: 'killer', op: 'increase', by });
const NO_VICTIMS_FG = 'Si no hay Víctimas, el objetivo pasa a ser la Chica Final.';

export const INKANYAMBA: Killer = {
  id: 'inkanyamba',
  name: 'Inkanyamba',
  film: 'grooves',
  icon: 'pickaxes',
  board: `${base}/board.webp`,
  cover: `${base}/cover.webp`,
  token: `${base}/token.webp`,
  select: `${base}/select.webp`,
  startTerror: 4,
  health: 9,
  // Medidor de Sed de Sangre, de abajo a arriba (leído del tablero).
  bloodlust: [
    row(1, 2),
    row(1, 2),
    row(1, 3),
    row(2, 3, true),
    row(2, 3),
    row(2, 3),
    row(2, 4),
    row(2, 4),
    row(3, 5),
  ],
  // "Descarta las siguientes 2 cartas de Terror"
  bloodlustMaxEffect: [{ kind: 'custom', id: 'discard-next-horror' }, { kind: 'custom', id: 'discard-next-horror' }],
  bloodlustMaxText: 'se descartan las 2 siguientes cartas de Horror',
  // Reverso del Gran Final: si la Ira Asesina está en 1-2, auméntala en 1 ▶ objetivo el más cercano ▶ ataque.
  initialAction: [{ kind: 'custom', id: 'inka-initial-wrath' }, ka('nearest', 0, 1)],
  finaleBack: `${base}/finale/back.webp`,
  darkPowerBack: `${base}/dark-power/back.webp`,
  wrath: {
    id: 'killer',
    name: 'Ira Asesina',
    image: `${base}/wrath/ira-asesina.webp`,
    back: `${base}/wrath/back.webp`,
    start: 2,
    levels: [
      { effects: [wrathUp(1)], text: 'Aumenta la Ira Asesina en 1.' },
      { effects: [wrathUp(2)], text: 'Aumenta la Ira Asesina en 2.' },
      { effects: [terror(1)], text: '+1 Terror.' },
      { effects: [terror(1), ka('nearest', 1, 0)], text: '+1 Terror ▶ objetivo el más cercano ▶ mover.' },
      { effects: [terror(2)], text: '+2 Terror.' },
      { effects: [ka('nearest', 1, 1)], text: 'Objetivo el más cercano ▶ mover ▶ atacar.' },
      { effects: [heal(1), ka('nearest', 1, 1)], text: 'Inkanyamba recupera 1 Vida ▶ objetivo el más cercano ▶ mover ▶ atacar.' },
      { effects: [heal(1), terror(1), ka('nearest', 1, 1)], text: 'Recupera 1 Vida ▶ +1 Terror ▶ objetivo el más cercano ▶ mover ▶ atacar.' },
      { effects: [heal(2), terror(1), ka('nearest', 1, 1)], text: 'Recupera 2 Vida ▶ +1 Terror ▶ objetivo el más cercano ▶ mover ▶ atacar.' },
      { effects: [heal(2), terror(1), ka('nearest', 1, 2)], text: 'Recupera 2 Vida ▶ +1 Terror ▶ objetivo el más cercano ▶ mover ▶ atacar ▶ atacar.' },
    ],
  },
  finales: [
    {
      id: 'ciclon-salvaje',
      name: 'Ciclón salvaje',
      image: `${base}/finale/ciclon-salvaje.webp`,
      finalAction: [unleash, wrathUp(1), ka('nearest', 1, 2)],
      text: 'Acción del Asesino: Desata la Ira Asesina ▶ auméntala en 1 ▶ objetivo el más cercano ▶ mover ▶ atacar ▶ atacar.',
    },
    {
      id: 'rabieta-violenta',
      name: 'Rabieta violenta',
      image: `${base}/finale/rabieta-violenta.webp`,
      finalAction: [unleash, wrathUp(3), ka('nearest', 1, 1)],
      text: 'Acción del Asesino: Desata la Ira Asesina ▶ auméntala en 3 ▶ objetivo el más cercano ▶ mover ▶ atacar.',
    },
    {
      id: 'necesitamos-un-milagro',
      name: 'Necesitamos un milagro',
      image: `${base}/finale/necesitamos-un-milagro.webp`,
      finalAction: [unleash, ka('nearest', 1, 1)],
      text: 'Cuando se revele, la Ira Asesina sube a 10; luego coge cartas de Acción a tu mano por un coste total de hasta 6. Acción del Asesino: Desata la Ira Asesina ▶ objetivo el más cercano ▶ mover ▶ atacar.',
      custom: 'finale-miracle',
    },
  ],
  darkPowers: [
    {
      id: 'fiesta-de-la-ira',
      name: 'Fiesta de la ira',
      image: `${base}/dark-power/fiesta-de-la-ira.webp`,
      text: 'Cada vez que la Ira Asesina aumente, Inkanyamba recupera 1 Vida.',
      custom: 'dp-wrath-feast',
    },
    {
      id: 'miedo-creciente',
      name: 'Miedo creciente',
      image: `${base}/dark-power/miedo-creciente.webp`,
      text: 'Cada vez que la Ira Asesina aumente, +1 Terror.',
      custom: 'dp-growing-fear',
    },
    {
      id: 'temperamento-volatil',
      name: 'Temperamento volátil',
      image: `${base}/dark-power/temperamento-volatil.webp`,
      text: 'Después de la fase de Mantenimiento, haz una Tirada de Terror: con algún éxito, sin efecto; sin éxitos, Desata la Ira Asesina.',
      custom: 'dp-volatile-temper',
    },
    {
      id: 'oscuro-relampago',
      name: 'Oscuro relámpago',
      image: `${base}/dark-power/oscuro-relampago.webp`,
      text: 'Poder Oscuro Épico. Cada vez que Inkanyamba mata a una Víctima, mata a una segunda Víctima en ese espacio o en uno adyacente.',
      epic: true,
      custom: 'dp-dark-lightning',
    },
  ],
  horror: [
    {
      id: 'viene-no-hay-nada',
      name: '«¡Viene, y no hay nada que podamos hacer!»',
      copies: 4,
      image: `${base}/horror/viene-no-hay-nada.webp`,
      text: 'Si no hay Víctimas en el tablero, descarta y roba la siguiente carta de Horror. En caso contrario: +1 Terror ▶ objetivo la Víctima más cercana ▶ mover ▶ atacar.',
      requiresVictims: true,
      effects: [terror(1), ka('victim', 1, 1)],
    },
    {
      id: 'caracter-voluble',
      name: 'Carácter voluble',
      copies: 2,
      image: `${base}/horror/caracter-voluble.webp`,
      text: `Haz una Tirada de Terror. 2+ éxitos: elige una Ira y redúcela a la mitad (redondeando al alza). 1 éxito: elige una Ira y redúcela en 1. Sin éxitos: Desata la Ira Asesina; luego tira un dado y auméntala en el valor del dado. ▶ Objetivo la Víctima más cercana ▶ mover ▶ atacar. ${NO_VICTIMS_FG}`,
      effects: [{ kind: 'custom', id: 'roll:caracter-voluble' }, ka('victimElseFG', 1, 1)],
    },
    {
      id: 'ira-de-la-sangre',
      name: 'Ira de la sangre',
      copies: 1,
      image: `${base}/horror/ira-de-la-sangre.webp`,
      text: `Desata la Ira Asesina ▶ auméntala tanto como el nivel de Sed de Sangre ▶ objetivo la Víctima más cercana ▶ mover ▶ atacar. ${NO_VICTIMS_FG}`,
      effects: [unleash, wrathBy('bloodlustLevel'), ka('victimElseFG', 1, 1)],
    },
    {
      id: 'ira-de-la-oportunidad',
      name: 'Ira de la oportunidad',
      copies: 1,
      image: `${base}/horror/ira-de-la-oportunidad.webp`,
      text: `Desata la Ira Asesina ▶ auméntala tanto como cartas de Acción tengas en la mano ▶ objetivo la Víctima más cercana ▶ mover ▶ atacar. ${NO_VICTIMS_FG}`,
      effects: [unleash, wrathBy('handSize'), ka('victimElseFG', 1, 1)],
    },
    {
      id: 'ira-de-la-muerte',
      name: 'Ira de la muerte',
      copies: 1,
      image: `${base}/horror/ira-de-la-muerte.webp`,
      text: `Desata la Ira Asesina ▶ auméntala tanto como tu Vida actual ▶ objetivo la Víctima más cercana ▶ mover ▶ atacar. ${NO_VICTIMS_FG}`,
      effects: [unleash, wrathBy('fgHealth'), ka('victimElseFG', 1, 1)],
    },
    {
      id: 'ira-de-los-profanadores',
      name: 'Ira de los profanadores',
      copies: 1,
      image: `${base}/horror/ira-de-los-profanadores.webp`,
      text: `Desata la Ira Asesina ▶ auméntala tanto como Víctimas hayas salvado ▶ objetivo la Víctima más cercana ▶ mover ▶ atacar. ${NO_VICTIMS_FG}`,
      effects: [unleash, wrathBy('saved'), ka('victimElseFG', 1, 1)],
    },
    {
      id: 'ira-del-horror',
      name: 'Ira del horror',
      copies: 1,
      image: `${base}/horror/ira-del-horror.webp`,
      text: `Desata la Ira Asesina ▶ auméntala tanto como tu Nivel de Terror (casilla verde = 0, roja = 7) ▶ objetivo la Víctima más cercana ▶ mover ▶ atacar. ${NO_VICTIMS_FG}`,
      effects: [unleash, wrathBy('terrorLevel'), ka('victimElseFG', 1, 1)],
    },
    {
      id: 'castigo-o-clemencia',
      name: 'Castigo o clemencia',
      copies: 1,
      image: `${base}/horror/castigo-o-clemencia.webp`,
      text: 'Según el nivel de la Ira Asesina: 1-3, auméntala en 2 y Desátala; 4-5, auméntala en 2; 6-9, redúcela a la mitad (redondeando al alza); 10, redúcela a 1.',
      effects: [{ kind: 'custom', id: 'castigo-o-clemencia' }],
    },
    {
      id: 'le-faltaron-al-respeto',
      name: '«Le faltaron al respeto, y ahora él quiere su sangre»',
      copies: 1,
      image: `${base}/horror/le-faltaron-al-respeto.webp`,
      text: 'Si no hay Víctimas en el tablero, descarta y roba la siguiente carta de Horror. En caso contrario: objetivo la Víctima más cercana ▶ mover ▶ atacar ▶ atacar ▶ aumenta la Ira Asesina tanto como Víctimas asesinadas este turno.',
      requiresVictims: true,
      effects: [ka('victim', 1, 2), wrathBy('killedThisTurn')],
    },
    {
      id: 'no-se-como',
      name: '«No sé cómo, pero le hemos enfadado»',
      copies: 1,
      image: `${base}/horror/no-se-como.webp`,
      text: 'Objetivo la Chica Final ▶ mover ▶ atacar ▶ atacar ▶ aumenta la Ira Asesina tanto como el daño infligido.',
      effects: [{ kind: 'custom', id: 'mark-damage' }, ka('finalGirl', 1, 2), wrathBy('damageSinceMark')],
    },
    {
      id: 'ira-hirviendo',
      name: 'Ira hirviendo',
      copies: 1,
      image: `${base}/horror/ira-hirviendo.webp`,
      text: 'Poder Oscuro Menor (2 Vidas). Una vez en cada fase de Mantenimiento, haz una Tirada de Terror: con algún éxito, sin efecto; sin éxitos, aumenta la Ira Asesina en 1.',
      effects: [],
      minorDarkPower: { health: 2, custom: 'mdp-boiling-wrath' },
    },
    {
      id: 'adicto-a-la-indignacion',
      name: 'Adicto a la indignación',
      copies: 1,
      image: `${base}/horror/adicto-a-la-indignacion.webp`,
      text: 'Poder Oscuro Menor (3 Vidas). Cada vez que la Ira Asesina aumente, auméntala 1 más.',
      effects: [],
      minorDarkPower: { health: 3, custom: 'mdp-outrage-addict' },
    },
  ],
  specialRules:
    'Ira Asesina: empieza en 2 (de 1 a 10). Al Desatarla se aplican los efectos de su nivel actual. Se reduce con las cartas de Acción Expiar (dos en la Tabla de Acciones).',
};
