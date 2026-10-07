import type { Effect, ItemCard, Killer, KillerAction } from '../../types';

const base = 'assets/killers/poltergeist';
const itemBase = 'assets/locations/creech-manor/items';
const ka = (target: KillerAction['target'], moves: number, attacks: number, opts: { killAlong?: boolean } = {}): Effect => ({
  kind: 'killerAction',
  action: { target, moves, attacks, ...(opts.killAlong ? { killAlong: true } : {}) },
});
const custom = (id: string): Effect => ({ kind: 'custom', id });
const terror = (amount: number): Effect => ({ kind: 'terror', amount });
const row = (attack: number, move: number, effects: Effect[] = [], revealDarkPower = false) => ({
  attack,
  move,
  effects,
  ...(revealDarkPower ? { revealDarkPower } : {}),
});

/** Carolyn y Mr. Floppy van siempre escondidas en los mazos de Objetos, con cualquier Lugar. */
const ITEMS: ItemCard[] = [
  {
    id: 'carolyn',
    name: 'Carolyn',
    image: `${itemBase}/carolyn.webp`,
    flavor: '«Pero… Mr. Floppy dijo que nos escondiéramos.»',
    text: 'Cuando Carolyn se une a ti, retira todos los Poderes Oscuros Menores del juego. Debes escapar con Carolyn para ganar. Carolyn no puede ser asesinada ni descartada por ninguna razón y no puedes ponerla en tu mochila.',
    hands: 0,
    custom: 'item-carolyn',
  },
  {
    id: 'mr-floppy',
    name: 'Mr. Floppy',
    image: `${itemBase}/mr-floppy.webp`,
    flavor: '«Parece el muñeco de Carolyn.»',
    text: 'Si el Poder Oscuro ha sido revelado, puedes retirar esta carta del juego para ignorar los efectos de «¿Carolyn, dónde estás?». Si esta carta se descarta por cualquier razón, mézclala con el mazo de Objetos más cercano. Nunca se puede descartar por un efecto del juego antes de que se revele el Poder Oscuro ni si el Poder Oscuro Épico está en juego.',
    hands: 0,
    custom: 'item-floppy',
  },
];

/**
 * El Poltergeist no tiene Vida y no puede ser atacado. La única forma de ganar es encontrar a Carolyn
 * y llevarla a un espacio de Salida.
 */
export const POLTERGEIST: Killer = {
  id: 'poltergeist',
  name: 'El Poltergeist',
  film: 'creech',
  icon: 'ghost',
  board: `${base}/board.webp`,
  cover: `${base}/cover.webp`,
  token: `${base}/token.webp`,
  select: `${base}/select.webp`,
  startTerror: 3,
  health: 0,
  invulnerable: true,
  items: ITEMS,
  // Medidor de Sed de Sangre, de abajo a arriba (leído del tablero).
  bloodlust: [
    row(1, 2),
    row(1, 2, [terror(1)]),
    row(1, 2, [], true),
    row(1, 2),
    row(2, 2, [terror(2)]),
    row(2, 3),
    row(2, 3),
    row(2, 4, [terror(1)]),
    row(3, 4),
  ],
  // "Recibes 1 de daño ▶ Descarta la siguiente carta de Terror"
  bloodlustMaxEffect: [custom('pg-bloodlust-max'), custom('discard-next-horror')],
  bloodlustMaxText: 'recibes 1 de daño y se descarta la siguiente carta de Terror',
  // Reverso del Gran Final: el más cercano ▶ mover ▶ atacar.
  initialAction: [ka('nearest', 1, 1)],
  finaleBack: `${base}/finale/back.webp`,
  darkPowerBack: `${base}/dark-power/back.webp`,
  finales: [
    {
      id: 'nada-es-facil',
      name: 'Nada es fácil',
      image: `${base}/finale/nada-es-facil.webp`,
      finalAction: [custom('pg-place-fg'), ka('nearest', 0, 1)],
      text: 'Las cartas de Acción de coste 0 valen 1 de Tiempo.',
      custom: 'finale-nothing-easy',
    },
    {
      id: 'asalto-implacable',
      name: 'Asalto implacable',
      image: `${base}/finale/asalto-implacable.webp`,
      finalAction: [custom('pg-place-fg'), ka('nearest', 0, 2)],
    },
    {
      id: 'pronto-estara-perdida',
      name: 'Pronto estará perdida',
      image: `${base}/finale/pronto-estara-perdida.webp`,
      finalAction: [custom('pg-lost-draw')],
      text: 'Roba una carta de Terror cada fase del Asesino; si no puedes, pierdes la partida inmediatamente. Se añaden 3 cartas al mazo de Terror al revelarse.',
      custom: 'finale-lost',
    },
  ],
  darkPowers: [
    {
      id: 'eterna-desesperacion',
      name: 'Eterna desesperación',
      image: `${base}/dark-power/eterna-desesperacion.webp`,
      text: 'Cada vez que resuelvas una Tirada de Terror, pierdes 1 de Tiempo por cada dado que muestre un 1 (después de volver a tirar).',
      custom: 'dp-eternal-despair',
    },
    {
      id: 'barrera-invisible',
      name: 'Barrera invisible',
      image: `${base}/dark-power/barrera-invisible.webp`,
      text: 'No puedes entrar en una zona de Salida con Carolyn a menos que tengas toda tu Vida.',
      custom: 'dp-invisible-barrier',
    },
    {
      id: 'rafaga-de-viento',
      name: 'Ráfaga de viento',
      image: `${base}/dark-power/rafaga-de-viento.webp`,
      text: 'Todos tus movimientos de 2 o más espacios se reducen en 1 espacio.',
      custom: 'dp-wind-gust',
    },
    {
      id: 'olvidando-algo',
      name: '¿Olvidando algo?',
      image: `${base}/dark-power/olvidando-algo.webp`,
      text: 'Poder Oscuro Épico. No puedes ganar la partida a menos que llegues a una zona de Salida con Carolyn y con la carta de Objeto de Mr. Floppy.',
      epic: true,
      custom: 'dp-forgot-something',
    },
  ],
  horror: [
    {
      id: 'carolyn-donde-estas',
      name: '«¿Carolyn, dónde estás?»',
      copies: 2,
      image: `${base}/horror/carolyn-donde-estas.webp`,
      text: 'Si Carolyn no está contigo, descarta y roba la siguiente carta de Terror. Si no: baraja a Carolyn en el mazo de Objetos de la zona de Búsqueda más cercana. NO reveles la carta superior de ese mazo.',
      skipIf: 'noCarolyn',
      effects: [custom('pg-carolyn')],
    },
    {
      id: 'las-sombras-se-acercan',
      name: '«Las sombras se acercan»',
      copies: 2,
      image: `${base}/horror/las-sombras-se-acercan.webp`,
      text: 'Si no hay Víctimas en el tablero, descarta y roba la siguiente carta de Terror. Si no: +2 Terror. Objetivo la Víctima más cercana ▶ mover ▶ atacar.',
      requiresVictims: true,
      effects: [terror(2), ka('victim', 1, 1)],
    },
    {
      id: 'todo-alrededor-estaba-volando',
      name: '«¡Todo alrededor estaba volando!»',
      copies: 2,
      image: `${base}/horror/todo-alrededor-estaba-volando.webp`,
      text: 'Coloca al Poltergeist con la Víctima más cercana, o en tu espacio si no hay Víctimas. Objetivo el más cercano ▶ atacar.',
      effects: [custom('pg-place-victim'), ka('nearest', 0, 1)],
    },
    {
      id: 'el-suelo-esta-temblando',
      name: '«¡El suelo está temblando!»',
      copies: 2,
      image: `${base}/horror/el-suelo-esta-temblando.webp`,
      text: 'Pon al Poltergeist en tu espacio. Objetivo el más cercano ▶ atacar. Si recibes cualquier daño, todos tus movimientos durante la siguiente fase de Acción tienen pánico.',
      effects: [custom('pg-place-fg'), custom('pg-mark'), ka('nearest', 0, 1), custom('pg-panic-if-hurt')],
    },
    {
      id: 'maldad-imparable',
      name: 'Maldad imparable',
      copies: 1,
      image: `${base}/horror/maldad-imparable.webp`,
      text: 'Tira un dado. Recibe daño igual a tu tirada (te puedes defender) O mata ese mismo número de Víctimas (tú eliges cuáles). Si no hay suficientes Víctimas, debes elegir recibir el daño.',
      effects: [custom('pg-evil')],
    },
    {
      id: 'de-donde-ha-salido-esta-tormenta',
      name: '«¿De dónde diablos ha salido esta tormenta?»',
      copies: 1,
      image: `${base}/horror/de-donde-ha-salido-esta-tormenta.webp`,
      text: '¡El rayo impacta en tu espacio y en todos los adyacentes! Una Víctima en cada espacio muere, y tú pierdes tanta Vida como el valor de ataque actual del Poltergeist.',
      effects: [custom('pg-storm')],
    },
    {
      id: 'nada-es-lo-que-parece',
      name: 'Nada es lo que parece',
      copies: 1,
      image: `${base}/horror/nada-es-lo-que-parece.webp`,
      text: 'Si Carolyn está contigo, descarta y roba la siguiente carta de Terror. Si no: baraja cada mazo de Objetos y revela la carta superior de cada uno. Si se revela Carolyn o Mr. Floppy, +2 Sed de Sangre.',
      skipIf: 'carolyn',
      effects: [custom('pg-nothing')],
    },
    {
      id: 'tengo-que-matarte',
      name: '«¡Tengo que matarte! ¡Me dijo que te matara!»',
      copies: 1,
      image: `${base}/horror/tengo-que-matarte.webp`,
      text: 'Si no hay Víctimas en el tablero, descarta y roba la siguiente carta de Terror. Si no: todas las Víctimas de espacios adyacentes se mueven a tu espacio. Si hay Víctimas en tu espacio, puedes jugar UNA carta de Acción que haga daño: mata 1 Víctima por cada punto de daño (NO sube la Sed de Sangre). Recibes daño por cada Víctima en tu espacio (te puedes defender). Luego todas entran en pánico.',
      requiresVictims: true,
      effects: [custom('pg-kill-1'), custom('pg-kill-2'), custom('pg-kill-3'), custom('pg-kill-4')],
    },
    {
      id: 'forma-corporea',
      name: 'Forma corpórea',
      copies: 1,
      image: `${base}/horror/forma-corporea.webp`,
      text: '¡Aparece un Gigante (2 Vidas) en tu espacio! Puedes jugar cartas de Acción que hagan daño si quieres. Después, si el Gigante sigue vivo: recibes daño igual al ataque del Asesino +1 (te puedes defender); si recibes daño, descarta un Objeto de tu elección. El Gigante desaparece.',
      effects: [custom('pg-enemy:giant')],
    },
    {
      id: 'ese-payaso-se-ha-movido',
      name: '«Ese payaso… ¿se ha movido?»',
      copies: 1,
      image: `${base}/horror/ese-payaso-se-ha-movido.webp`,
      text: '¡Aparece un Muñeco Payaso (1 Vida) en tu espacio! Puedes jugar cartas de Acción que hagan daño si quieres. Después, si el Muñeco Payaso sigue vivo: recibes daño igual al ataque del Asesino (te puedes defender); si recibes daño, +1 Sed de Sangre. El Muñeco Payaso desaparece.',
      effects: [custom('pg-enemy:clown')],
    },
    {
      id: 'fuerzas-nunca-vistas',
      name: 'Fuerzas nunca vistas',
      copies: 1,
      image: `${base}/horror/fuerzas-nunca-vistas.webp`,
      text: 'Poder Oscuro Menor. Si Carolyn está contigo, descarta y roba la siguiente carta de Terror. Tu primer espacio que muevas cada fase de Acción es de pánico. Descarta esta carta cuando encuentres a Carolyn.',
      skipIf: 'carolyn',
      effects: [],
      minorDarkPower: { health: 0, custom: 'mdp-unseen-forces' },
    },
    {
      id: 'confusion-psiquica',
      name: 'Confusión psíquica',
      copies: 1,
      image: `${base}/horror/confusion-psiquica.webp`,
      text: 'Poder Oscuro Menor. Si Carolyn está contigo, descarta y roba la siguiente carta de Terror. Tira 1 dado menos cuando resuelvas una carta de Buscar; antes de jugarla puedes gastar 3 de Tiempo para ignorar esta penalización. Descarta esta carta cuando encuentres a Carolyn.',
      skipIf: 'carolyn',
      effects: [],
      minorDarkPower: { health: 0, custom: 'mdp-psychic-confusion' },
    },
  ],
  specialRules:
    'El Poltergeist no tiene Vida y no puede ser atacado, dañado ni eliminado. La única forma de ganar es encontrar a Carolyn (escondida en los mazos de Objetos) y llevarla a una zona de Salida. Si se revela «¿Olvidando algo?», también necesitas a Mr. Floppy. Carolyn nunca puede ser descartada, muerta ni retirada del juego.',
};
