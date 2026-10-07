import type { DieFace, Effect, ItemCard, KillerAction, Location, Zone } from '../../types';

const base = 'assets/locations/maple-lane';
// Las posiciones se midieron sobre el tablero a 1800×1603; la imagen final es 2400×2137.
const MAP_W = 1800;
const MAP_H = 1603;

const ka = (target: KillerAction['target'], moves: number, attacks: number): Effect => ({
  kind: 'killerAction',
  action: { target, moves, attacks },
});
const custom = (id: string): Effect => ({ kind: 'custom', id });
const terror = (amount: number): Effect => ({ kind: 'terror', amount });
const event: Effect = { kind: 'drawEvent' };
const f = (...n: DieFace[]) => n;
const at = (x: number, y: number) => ({ x: (x / MAP_W) * 100, y: (y / MAP_H) * 100 });

/**
 * Mapa de Maple Lane: 21 espacios. 9 de Calle (4 Salidas, 4 calles y la Intersección) y 12 Casas repartidas
 * en 4 cuadrantes, cada uno con su mazo de Objetos. Las casas se buscan, pero no se puede entrar en una ocupada
 * por una Víctima sin «Convencer».
 */
const house = (id: string, label: string, deck: string, pos: { x: number; y: number }, flee: Zone['flee'], name?: string): Zone => ({
  id,
  label,
  ...(name ? { name } : {}),
  search: true,
  house: true,
  deck,
  pos,
  flee,
});

const ZONES: Zone[] = [
  // Salidas
  { id: 'salida-n', label: 'Salida Norte', exit: true, street: true, pos: at(880, 440),
    flee: [{ to: 'no-alto', faces: f(1, 2) }, { to: 'calle-n', faces: f(3, 4) }, { to: 'ne-top', faces: f(5, 6) }] },
  { id: 'salida-s', label: 'Salida Sur', exit: true, street: true, pos: at(880, 1440),
    flee: [{ to: 'so-bajo', faces: f(1, 2) }, { to: 'calle-s', faces: f(3, 4) }, { to: 'se-bajo', faces: f(5, 6) }] },
  { id: 'salida-o', label: 'Salida Oeste', exit: true, street: true, pos: at(190, 950),
    flee: [{ to: 'no-grande', faces: f(1, 2) }, { to: 'so-grande', faces: f(3, 4) }, { to: 'calle-o', faces: f(5, 6) }] },
  { id: 'salida-e', label: 'Salida Este', exit: true, street: true, pos: at(1560, 900),
    flee: [{ to: 'ne-grande', faces: f(1, 2) }, { to: 'se-grande', faces: f(3, 4) }, { to: 'calle-e', faces: f(5, 6) }] },
  // Calles
  { id: 'calle-n', label: 'Calle Norte', street: true, pos: at(910, 640),
    flee: [{ to: 'no-centro', faces: f(1, 2) }, { to: 'interseccion', faces: f(3, 4) }, { to: 'salida-n', faces: f(5, 6) }] },
  { id: 'calle-s', label: 'Calle Sur', street: true, pos: at(900, 1230),
    flee: [{ to: 'interseccion', faces: f(1, 2) }, { to: 'salida-s', faces: f(3, 4) }, { to: 'se-alto', faces: f(5, 6) }] },
  { id: 'calle-o', label: 'Calle Oeste', street: true, pos: at(520, 960),
    flee: [{ to: 'salida-o', faces: f(1, 2) }, { to: 'so-centro', faces: f(3, 4) }, { to: 'interseccion', faces: f(5, 6) }] },
  { id: 'calle-e', label: 'Calle Este', street: true, pos: at(1270, 960),
    flee: [{ to: 'salida-e', faces: f(1, 2) }, { to: 'ne-centro', faces: f(3, 4) }, { to: 'interseccion', faces: f(5, 6) }] },
  { id: 'interseccion', name: 'Intersección', label: 'Intersección', street: true, pos: at(910, 965),
    flee: [{ to: 'calle-n', faces: f(1) }, { to: 'calle-s', faces: f(2) }, { to: 'calle-o', faces: f(3, 4) }, { to: 'calle-e', faces: f(5, 6) }] },
  // Casas del Noroeste
  house('no-alto', 'Casa NO (arriba)', 'no', at(600, 450), [{ to: 'salida-n', faces: f(1, 2) }]),
  house('no-centro', 'Casa NO (centro)', 'no', at(590, 730), [{ to: 'calle-n', faces: f(1, 2, 3) }]),
  house('no-grande', 'Casa NO (grande)', 'no', at(230, 640), [{ to: 'salida-o', faces: f(1, 2) }]),
  // Casas del Noreste
  house('ne-top', 'Casa del Novio', 'ne', at(1230, 450), [{ to: 'salida-n', faces: f(1, 2) }], 'Casa del Novio'),
  house('ne-centro', 'Casa NE (centro)', 'ne', at(1230, 720), [{ to: 'calle-e', faces: f(1, 2, 3) }]),
  house('ne-grande', 'Casa NE (grande)', 'ne', at(1590, 630), [{ to: 'salida-e', faces: f(1, 2) }]),
  // Casas del Suroeste
  house('so-grande', 'Casa SO (grande)', 'so', at(230, 1330), [{ to: 'salida-o', faces: f(1, 2) }]),
  house('so-centro', 'Casa de los Smalley', 'so', at(610, 1210), [{ to: 'calle-o', faces: f(1, 2, 3) }], 'Casa de los Smalley'),
  house('so-bajo', 'Casa SO (abajo)', 'so', at(560, 1470), [{ to: 'salida-s', faces: f(1, 2) }]),
  // Casas del Sureste
  house('se-alto', 'Casa SE (arriba)', 'se', at(1230, 1190), [{ to: 'calle-s', faces: f(1, 2, 3) }]),
  house('se-bajo', 'Casa SE (abajo)', 'se', at(1220, 1470), [{ to: 'salida-s', faces: f(1, 2) }]),
  house('se-grande', 'Casa SE (grande)', 'se', at(1590, 1330), [{ to: 'salida-e', faces: f(1, 2) }]),
];

const item = (it: Omit<ItemCard, 'image'> & { file: string }): ItemCard => {
  const { file, ...rest } = it;
  return { ...rest, image: `${base}/items/${file}.webp` };
};

const crucifix = (id: string, file: string) =>
  item({
    file, id, name: 'Crucifijo',
    flavor: '«¡Eh, calla, que en las pelis funciona!»',
    text: 'Descártalo para ignorar cualquier aumento en el nivel de Horror O para terminar el movimiento de un Enemigo cuando está en un espacio adyacente.',
    hands: 1, custom: 'item-ml-crucifix',
  });

export const MAPLE_LANE: Location = {
  id: 'maple-lane',
  name: 'Maple Lane',
  film: 'maple',
  icon: 'houses',
  board: `${base}/board.webp`,
  cover: `${base}/cover.webp`,
  select: `${base}/select.webp`,
  boardSize: { w: 2400, h: 2137 },
  zones: ZONES,
  // Un mazo por cuadrante, en el orden de los huecos del tablero.
  itemDecks: ['no', 'so', 'ne', 'se'],
  deckNames: { no: 'Noroeste', so: 'Suroeste', ne: 'Noreste', se: 'Sureste' },
  setupBack: `${base}/setup/back.webp`,
  setups: [
    {
      id: 'un-sitio-tranquilo', name: 'Un sitio tranquilo', image: `${base}/setup/un-sitio-tranquilo.webp`,
      finalGirl: 'salida-n', killer: 'salida-s',
      victims: { 'ne-top': 1, 'ne-centro': 1, 'ne-grande': 1, 'no-centro': 2, interseccion: 2, 'so-grande': 1, 'so-centro': 1, 'so-bajo': 1, 'se-alto': 2 },
    },
    {
      id: 'hora-de-juego', name: 'Hora de juego', image: `${base}/setup/hora-de-juego.webp`,
      finalGirl: 'salida-e', killer: 'salida-o',
      victims: { 'calle-n': 1, 'no-centro': 2, 'ne-centro': 2, 'calle-o': 1, 'calle-e': 1, 'so-centro': 2, 'se-alto': 2, 'calle-s': 1 },
    },
    {
      id: 'fiesta-en-el-bloque', name: 'Fiesta en el bloque', image: `${base}/setup/fiesta-en-el-bloque.webp`,
      finalGirl: 'so-centro', killer: 'ne-centro',
      victims: { 'ne-top': 1, 'ne-grande': 1, interseccion: 6, 'so-grande': 1, 'se-alto': 2, 'so-bajo': 1 },
    },
    {
      id: 'venganza', name: 'Venganza', image: `${base}/setup/venganza.webp`,
      finalGirl: 'no-centro', killer: 'interseccion',
      victims: { 'ne-top': 1, 'calle-n': 1, 'no-grande': 1, 'ne-centro': 2, 'calle-o': 1, 'calle-e': 1, 'so-centro': 2, 'se-grande': 1, 'calle-s': 1, 'so-bajo': 1 },
    },
    {
      id: 'maple-lane', name: 'Maple Lane', image: `${base}/setup/maple-lane.webp`,
      finalGirl: 'calle-s', killer: 'calle-n',
      victims: { 'no-alto': 1, 'ne-top': 1, 'no-centro': 3, interseccion: 2, 'se-alto': 3, 'so-bajo': 1, 'se-bajo': 1 },
    },
  ],
  eventBack: `${base}/events/back.webp`,
  events: [
    {
      id: 'oficial-de-poli', name: 'Oficial de poli', image: `${base}/events/oficial-de-poli.webp`,
      flavor: '«Si tienes miedo, me encantaría escoltarte hasta el final de la zona.»',
      text: 'Pon el token del Coche de Policía en la Salida que quieras. Cada fase de Mantenimiento, muévelo un espacio hacia la Salida contraria. Las Víctimas en el espacio del Coche de Policía se moverán con él y se consideran salvadas si llegan a la Salida. Quita el Coche de Policía y descarta esta carta cuando llegue a la Salida.',
      token: 'coche-de-policia', onReveal: [], persistent: true, custom: 'ev-ml-police',
    },
    {
      id: 'fuego', name: 'Fuego', image: `${base}/events/fuego.webp`,
      flavor: '«¿No hueles a humo?»',
      text: 'Tira un dado y coloca el token del Fuego en: 1-3 la Casa del Novio, 4-6 la Casa de los Smalley. Cualquier Víctima en esa Casa o que entre en pánico en ella es asesinada. Tú o tus Enemigos en ella recibiréis 1 daño. Ya no se puede buscar ni entrar más en la Casa.',
      token: 'fuego', onReveal: [], persistent: true, custom: 'ev-ml-fire',
    },
    {
      id: 'zona-en-obras', name: 'Zona en obras', image: `${base}/events/zona-en-obras.webp`,
      flavor: '«Un socavón o algo. No dejan que pase nadie hasta que esté arreglado.»',
      text: 'Tira un dado y pon el token de Barrera en la siguiente Salida: 1 Oeste, 2 Este, 3 Norte, 4 Sur, 5 Este u Oeste, 6 Norte o Sur. Las Víctimas no pueden ser salvadas en ese espacio.',
      token: 'barrera', onReveal: [custom('ml-works')], persistent: false,
    },
    {
      id: 'novio', name: 'Novio', image: `${base}/events/novio.webp`,
      flavor: '«Es un poco pegajoso y siempre quiere hablar.»',
      text: 'Pon esta Víctima Especial en la Casa del Novio. ¡Éste es tu novio! Si el Asesino va a por ti, en tu lugar va a por tu Novio. Durante el Mantenimiento, mueve al Novio 2 espacios hacia ti; luego, si el Novio está en tu espacio, +2 Tiempo. Si el Novio deja de jugar, descarta esta carta.',
      specialVictim: 'blue', onReveal: [], persistent: true, custom: 'ev-ml-boyfriend',
    },
    {
      id: 'los-smalleys', name: 'Los Smalleys', image: `${base}/events/los-smalleys.webp`,
      flavor: '«¿Un asesino suelto? Deben ser cotilleos… ¿no te parece?»',
      text: 'Pon 2 Víctimas Especiales en la Casa de los Smalleys. Cada vez que uno de los Smalleys muera, +1 Sed de Sangre. Descarta esta carta cuando los Smalleys ya no estén en el tablero.',
      specialVictim: 'orange', onReveal: [], persistent: true, custom: 'ev-ml-smalleys',
    },
    {
      id: 'que-pasa-por-ahi', name: '¿Qué pasa por ahí?', image: `${base}/events/que-pasa-por-ahi.webp`,
      flavor: '«Hay revuelo en Maple Lane. ¡Voy a ver qué pasa!»',
      text: 'Pon una nueva Víctima en cada Salida. Descarta esta carta.',
      onReveal: [custom('ml-everyone-exit')], persistent: false,
    },
    {
      id: 'amables-vecinos', name: 'Amables vecinos', image: `${base}/events/amables-vecinos.webp`,
      flavor: '«¡Aquí todos somos familia en Maple Lane!»',
      text: 'Tira +1 dado cuando juegues cartas de Acción de Convencer.',
      onReveal: [], persistent: true, custom: 'ev-ml-friendly',
    },
    {
      id: 'fiesta-por-el-barrio', name: '¡De fiesta por el barrio!', image: `${base}/events/fiesta-por-el-barrio.webp`,
      flavor: '«Asando, relajado y un buen rato pasando.»',
      text: 'Coloca 4 nuevas Víctimas en cualquier Casa que contenga al menos una Víctima. Si no hay nadie, colócalas en la Intersección. Descarta esta carta.',
      onReveal: [custom('ml-party')], persistent: false,
    },
    {
      id: 'esta-lloviendo', name: 'Está lloviendo', image: `${base}/events/esta-lloviendo.webp`,
      flavor: '«¡Todo el mundo dentro, antes de que se empape!»',
      text: 'Todas las Víctimas en la Intersección entran en pánico. Después mueve cada Víctima que esté en un espacio de Calle a la Casa adyacente. Descarta esta carta.',
      onReveal: [custom('ml-rain')], persistent: false,
    },
    {
      id: 'es-el-4-de-julio', name: '¡Es el 4 de Julio!', image: `${base}/events/es-el-4-de-julio.webp`,
      flavor: '«¡El espectáculo está a punto de comenzar! ¿Tienes nuestras bengalas?»',
      text: 'Mueve a todas las Víctimas dentro de una Casa a un espacio de Calle adyacente. Descarta esta carta.',
      onReveal: [custom('ml-july')], persistent: false,
    },
  ],
  horror: [
    {
      id: 'dije-no-mires-atras', name: '«¡Dije que no mires atrás!»', copies: 1,
      image: `${base}/horror/dije-no-mires-atras.webp`,
      text: 'Si no hay una Salida con al menos 1 Víctima, descarta y roba la siguiente carta de Terror. Si no: coloca al Asesino en cualquier Salida que tenga al menos 1 Víctima. El más cercano ▶ atacar.',
      effects: [custom('ml-killer-to-exit'), ka('nearest', 0, 1)],
    },
    {
      id: 'carretera-cortada', name: 'Carretera cortada por obras', copies: 1,
      image: `${base}/horror/carretera-cortada.webp`,
      text: 'Coloca un token de Barrera en la Salida más cercana a ti. Las Víctimas no pueden ser salvadas en esa Salida. Roba un Evento.',
      effects: [custom('ml-barrier'), event],
    },
    {
      id: 'todos-vamos-a-morir', name: '«¡Todos vamos a morir!»', copies: 1,
      image: `${base}/horror/todos-vamos-a-morir.webp`,
      text: 'La Víctima más cercana ▶ mover ▶ atacar, y otra vez: la Víctima más cercana ▶ mover ▶ atacar. Si ninguna Víctima fue asesinada, +2 Sed de Sangre.',
      effects: [custom('ml-mark-kills'), ka('victim', 1, 1), ka('victim', 1, 1), custom('ml-all-die')],
    },
    {
      id: 'justo-entro-por-el-patio', name: '«Justo entró por el patio»', copies: 1,
      image: `${base}/horror/justo-entro-por-el-patio.webp`,
      text: 'El más cercano ▶ mover ▶ atacar. Si el Asesino está en una Casa, muévelo a cualquier otra Casa en un cuadrante con una Víctima. Después: el más cercano ▶ atacar. Roba un Evento.',
      effects: [ka('nearest', 1, 1), custom('ml-patio'), ka('nearest', 0, 1), event],
    },
    {
      id: 'golpeados-por-un-coche', name: '«¡Fueron golpeados por un coche!»', copies: 1,
      image: `${base}/horror/golpeados-por-un-coche.webp`,
      text: 'Si no hay Víctimas en ninguna Calle, descarta y roba la siguiente carta de Terror. Si no: 1 Víctima en una Calle que escojas muere. La Víctima más cercana ▶ mover ▶ atacar.',
      effects: [custom('ml-car'), ka('victim', 1, 1)],
    },
    {
      id: 'oiste-lo-que-paso', name: '«¿Oíste lo que pasó en Maple Lane?»', copies: 1,
      image: `${base}/horror/oiste-lo-que-paso.webp`,
      text: 'Roba un Evento. Roba otro Evento. Roba la siguiente carta de Terror.',
      effects: [event, event, { kind: 'drawHorror' }],
    },
    {
      id: 'es-tan-sigiloso', name: '«¡Es tan sigiloso…!»', copies: 1,
      image: `${base}/horror/es-tan-sigiloso.webp`,
      text: '+1 Terror. La Chica Final ▶ mover ▶ mover. Si el Asesino está en el mismo espacio que tú, +1 Terror.',
      effects: [terror(1), ka('finalGirl', 2, 0), custom('ml-sneaky')],
    },
    {
      id: 'nos-dijeron-que-nos-escondieramos', name: '«Nos dijeron que nos escondiéramos»', copies: 1,
      image: `${base}/horror/nos-dijeron-que-nos-escondieramos.webp`,
      text: '+1 Terror. Coloca 1 nueva Víctima en cada Casa que no esté conectada a una Salida. Roba un Evento.',
      effects: [terror(1), custom('ml-hide'), event],
    },
  ],
  items: [
    item({
      file: 'rifle', id: 'rifle', name: 'Rifle',
      flavor: '«Si esto no lo mata, ¿qué lo hará?»',
      text: 'El Rifle no puede modificar una carta de Acción y debe usarse sin ella. Gasta 1 de Tiempo para hacer una Tirada de Horror. Éxito: haz 2 de daño a cualquier Enemigo en un espacio de Calle dentro del alcance (1-3). 2 usos.',
      hands: 2, range: [1, 3], damage: 2, uses: 2, modifies: 'none', custom: 'item-ml-rifle',
    }),
    item({
      file: 'cuchillo', id: 'cuchillo', name: 'Cuchillo',
      flavor: '«¡Al menos es mejor que intentar darle un puñetazo…!»',
      text: 'Arma: alcance 0, +1 de daño.',
      hands: 1, range: [0, 0], damage: 1, modifies: 'any',
    }),
    item({
      file: 'tridente', id: 'tridente', name: 'Tridente',
      flavor: '«Lo haré en un tris. Esto habría sonado mucho más guay si se llamara Trisdente.»',
      text: 'Arma: alcance 0, +1 de daño. Descártalo en cualquier momento para evitar el daño de un ataque simple.',
      hands: 2, range: [0, 0], damage: 1, modifies: 'any', custom: 'item-ml-trident',
    }),
    crucifix('crucifijo', 'crucifijo'),
    item({
      file: 'tapadera', id: 'tapadera', name: 'Tapadera',
      flavor: '«En realidad no son escudos tirados por el vecindario, pero es mejor que nada.»',
      text: 'Ignora 1 punto de daño de un ataque. 3 usos.',
      hands: 1, uses: 3, custom: 'item-trash-lid',
    }),
    item({
      file: 'dados-de-la-suerte', id: 'dados-de-la-suerte', name: 'Dados de la suerte',
      flavor: '«Quedarían tan bien en mi coche, si salgo de ésta…»',
      text: 'Descártalos para volver a tirar todos o cualquiera de tus dados.',
      hands: 0, custom: 'item-lucky-dice',
    }),
    item({
      file: 'arco-de-competicion', id: 'arco-de-competicion', name: 'Arco de competición',
      flavor: '«No soy una amazona, pero en esta peli hago de una.»',
      text: 'El Arco de Competición no puede usarse para modificar una carta de Acción. Cuesta 2 de Tiempo tirar una flecha a un espacio de Calle dentro de su rango (1-2). 3 usos.',
      hands: 2, range: [1, 2], damage: 1, uses: 3, modifies: 'none', custom: 'item-bow',
    }),
    crucifix('crucifijo-2', 'crucifijo-2'),
    item({
      file: 'machete', id: 'machete', name: 'Machete',
      flavor: '«¿Quién es el asesino ahora?»',
      text: 'Arma: alcance 0, +2 de daño. Las Víctimas no te seguirán mientras lleves el Machete en la mano.',
      hands: 1, range: [0, 0], damage: 2, modifies: 'any', custom: 'item-ml-machete',
    }),
    item({
      file: 'biblia', id: 'biblia', name: 'Biblia',
      flavor: '«Apelaré a su lado religioso. ¡Seguro que puedo entrar!»',
      text: '+2 dados cuando resuelvas una carta de Acción de Convencer.',
      hands: 0, custom: 'item-ml-bible',
    }),
    item({
      file: 'bebida-energetica', id: 'bebida-energetica', name: 'Bebida energética',
      flavor: '«Las bebidas energéticas te matarán. Sí, pero creo que correré el riesgo.»',
      text: 'Descártala durante la fase de Acción y elige: +3 Tiempo o muévete 1 espacio.',
      hands: 0, custom: 'item-energy-drink',
    }),
    item({
      file: 'megafono', id: 'megafono', name: 'Megáfono',
      flavor: '«¡Eh tú, por ahí! ¡No, no por ahí! ¡Por el otro lado!»',
      text: 'Una vez por fase de Acción puedes mover a cualquier Víctima del tablero 1 espacio. Después: la Chica Final ▶ mover (los Enemigos se acercan 1 espacio hacia ti).',
      hands: 1, custom: 'item-ml-megaphone',
    }),
    item({
      file: 'bicicleta', id: 'bicicleta', name: 'Bicicleta',
      flavor: '«¡Hi Ho! ¡Arre!»',
      text: 'Cuando cojas esta carta coloca el token de Bicicleta en un espacio de Calle adyacente a ti. Si no tienes otros objetos en las manos y estás con la Bicicleta, podéis moveros tú y la bici a otro espacio de Calle del tablero una vez por turno.',
      hands: 2, custom: 'item-ml-bike', token: 'bicicleta',
    }),
    item({
      file: 'fuegos-artificiales', id: 'fuegos-artificiales', name: 'Fuegos artificiales',
      flavor: '«Podrían ser una buena distracción, aunque ojalá fueran más grandes.»',
      text: 'Gasta 2 de Tiempo para colocar el token de Fuegos Artificiales en tu espacio o en uno adyacente (no en una Casa). Cada vez que el Asesino deba escoger un objetivo, en su lugar escoge los Fuegos Artificiales. Descarta el token cuando el Asesino entre en su espacio.',
      hands: 0, custom: 'item-fireworks', token: 'fuegos-artificiales',
    }),
    item({
      file: 'trastos', id: 'trastos', name: 'Trastos',
      flavor: '«Puedo hacer una fila hasta aquí… eso disparará esto… y luego esto ¡lo golpeará con fuerza!»',
      text: 'Si estás en una Casa, puedes poner un token de Trampa para tontos allí (uno por Casa). Si un Enemigo se mueve dentro de esa Casa, descarta el token y el Enemigo recibe 2 de daño. 3 usos.',
      hands: 0, uses: 3, custom: 'item-ml-junk',
    }),
    crucifix('crucifijo-3', 'crucifijo-3'),
  ],
  tokens: {
    'coche-de-policia': `${base}/tokens/coche-de-policia.webp`,
    fuego: `${base}/tokens/fuego.webp`,
    barrera: `${base}/tokens/barrera.webp`,
    bicicleta: `${base}/tokens/bicicleta.webp`,
    'fuegos-artificiales': `${base}/tokens/fuegos-artificiales.webp`,
    'trampa-para-tontos': `${base}/tokens/trampa-para-tontos.webp`,
    x: `${base}/tokens/x.webp`,
  },
  tokenInfo: {
    'coche-de-policia': { text: 'Coche de Policía: cada Mantenimiento avanza 1 espacio hacia la Salida contraria con las Víctimas que haya en su espacio; si llega a la Salida se salvan.' },
    fuego: { text: 'Fuego: toda Víctima en la Casa (o que entre en pánico en ella) muere, tú o tus Enemigos en ella recibís 1 daño, y ya no se puede buscar ni entrar.' },
    barrera: { text: 'Barrera: las Víctimas no pueden ser salvadas en esta Salida.' },
    bicicleta: { text: 'Bicicleta: si no tienes otros objetos en las manos y estás con ella, podéis ir tú y la bici a otro espacio de Calle una vez por turno.' },
    'fuegos-artificiales': { text: 'Fuegos artificiales: el Asesino los elige como objetivo en vez de a ti o a las Víctimas. Se descartan cuando entra en su espacio.' },
    'trampa-para-tontos': { text: 'Trampa para tontos: si un Enemigo entra en la Casa, se descarta el token y el Enemigo recibe 2 de daño.' },
    x: { text: 'X: esta Casa ya ha sido buscada y no se puede volver a buscar.' },
  },
  specialRules:
    'Espacios de Calle: las Salidas, las calles y la Intersección. Casas: 12, en 4 cuadrantes con un mazo de Objetos cada uno (3 cartas); se busca la Casa y se pone una ficha X (ya no se podrá volver a buscar). No puedes entrar en una Casa ocupada por una Víctima caminando: hay que «Convencer». Las Víctimas en pánico y los Enemigos no tienen esa restricción.',
};
