import type { DieFace, Effect, ItemCard, KillerAction, Location, Zone } from '../../types';

const base = 'assets/locations/carnival-of-blood';
// Las posiciones se midieron sobre el tablero a 2000×1766; la imagen final es 2400×2119.
const MAP_W = 2000;
const MAP_H = 1766;

const ka = (
  target: KillerAction['target'],
  moves: number,
  attacks: number,
  opts: { attackFirst?: boolean } = {},
): Effect => ({
  kind: 'killerAction',
  action: { target, moves, attacks, ...(opts.attackFirst ? { attackFirst: true } : {}) },
});
const custom = (id: string): Effect => ({ kind: 'custom', id });
const f = (...n: DieFace[]) => n;
const at = (x: number, y: number) => ({ x: (x / MAP_W) * 100, y: (y / MAP_H) * 100 });

/**
 * Mapa de Carnival of Blood: 17 zonas.
 * `flee` = números de huida impresos en el extremo de cada conexión que toca a la zona.
 * Salidas: Entrada del Carnaval, Coche de Payaso y Salida. Búsqueda: Casa de los Espejos,
 * Bosque de los Horrores y Cosas Alucinantes. Esquinas: Entrada, Bosque, Salida y Noria.
 */
const ZONES: Zone[] = [
  { id: 'entrada', name: 'Carnival', label: 'Entrada del Carnaval', exit: true, pos: at(220, 560),
    flee: [{ to: 'montana-rusa', faces: f(1, 2, 3) }, { to: 'plaza-oeste', faces: f(4, 5, 6) }] },
  { id: 'plaza-oeste', label: 'Plaza del oeste', pos: at(380, 750),
    flee: [{ to: 'tiro-al-blanco', faces: f(1, 2) }, { to: 'taquilla', faces: f(3, 4) }, { to: 'entrada', faces: f(5, 6) }] },
  { id: 'tiro-al-blanco', label: 'Tiro al blanco', pos: at(210, 1190),
    flee: [{ to: 'bosque-horrores', faces: f(1, 2) }, { to: 'plaza-oeste', faces: f(3, 4, 5, 6) }] },
  { id: 'casa-espejos', name: 'Casa de los Espejos', label: 'Casa de los Espejos', search: true, pos: at(590, 1010),
    flee: [{ to: 'taquilla', faces: f(4, 5) }, { to: 'gran-carpa', faces: f(1, 2, 3) }, { to: 'coche-payaso', faces: f(6) }] },
  { id: 'coche-payaso', name: 'Coche de Payaso', label: 'Coche de Payaso', exit: true, pos: at(480, 1330),
    flee: [{ to: 'casa-espejos', faces: f(1, 2, 3, 4, 5) }, { to: 'explanada', faces: f(6) }] },
  { id: 'bosque-horrores', name: 'Bosque de los Horrores', label: 'Bosque de los Horrores', search: true, pos: at(280, 1560),
    flee: [{ to: 'tiro-al-blanco', faces: f(3, 4, 5, 6) }, { to: 'sendero-sur', faces: f(1, 2) }] },
  { id: 'montana-rusa', label: 'Montaña rusa', pos: at(1100, 520),
    flee: [{ to: 'entrada', faces: f(1, 2, 3) }, { to: 'noria', faces: f(4, 5, 6) }] },
  { id: 'taquilla', label: 'Taquilla', pos: at(1000, 840),
    flee: [{ to: 'plaza-oeste', faces: f(1) }, { to: 'casa-espejos', faces: f(2) }, { to: 'gran-carpa', faces: f(3, 4) }, { to: 'plaza-este', faces: f(5) }, { to: 'jaulas-animales', faces: f(6) }] },
  { id: 'gran-carpa', name: 'La Gran Carpa', label: 'La Gran Carpa', pos: at(990, 1130),
    flee: [{ to: 'taquilla', faces: f(1) }, { to: 'plaza-este', faces: f(2) }, { to: 'explanada', faces: f(5) }, { to: 'casa-espejos', faces: f(6) }] },
  { id: 'explanada', label: 'Explanada del sur', pos: at(1050, 1420),
    flee: [{ to: 'gran-carpa', faces: f(1, 2, 3) }, { to: 'coche-payaso', faces: f(4) }, { to: 'sendero-sur', faces: f(5) }, { to: 'cosas-alucinantes', faces: f(6) }] },
  { id: 'sendero-sur', label: 'Sendero del sur', pos: at(850, 1600),
    flee: [{ to: 'bosque-horrores', faces: f(4, 5, 6) }, { to: 'explanada', faces: f(2, 3) }, { to: 'salida', faces: f(1) }] },
  { id: 'jaulas-animales', name: 'Jaulas de los Animales', label: 'Jaulas de los Animales', pos: at(1490, 770),
    flee: [{ to: 'noria', faces: f(5, 6) }, { to: 'taquilla', faces: f(3, 4) }, { to: 'casa-palomitas', faces: f(1, 2) }] },
  { id: 'noria', label: 'Noria', pos: at(1700, 510),
    flee: [{ to: 'montana-rusa', faces: f(5, 6) }, { to: 'jaulas-animales', faces: f(3, 4) }, { to: 'salida', faces: f(1, 2) }] },
  { id: 'plaza-este', label: 'Plaza del este', pos: at(1320, 1070),
    flee: [{ to: 'taquilla', faces: f(5, 6) }, { to: 'gran-carpa', faces: f(3, 4) }, { to: 'casa-palomitas', faces: f(1) }, { to: 'cosas-alucinantes', faces: f(2) }] },
  { id: 'casa-palomitas', label: 'Puesto de palomitas', pos: at(1645, 1040),
    flee: [{ to: 'jaulas-animales', faces: f(1) }, { to: 'plaza-este', faces: f(2, 3, 4, 5) }, { to: 'cosas-alucinantes', faces: f(6) }] },
  { id: 'cosas-alucinantes', name: 'Cosas Alucinantes', label: 'Cosas Alucinantes', search: true, pos: at(1490, 1380),
    flee: [{ to: 'plaza-este', faces: f(2, 3, 4, 5) }, { to: 'casa-palomitas', faces: f(1) }, { to: 'explanada', faces: f(6) }] },
  { id: 'salida', name: 'Exit', label: 'Salida', exit: true, pos: at(1790, 1560),
    flee: [{ to: 'noria', faces: f(4, 5, 6) }, { to: 'sendero-sur', faces: f(1, 2, 3) }] },
];

const item = (it: Omit<ItemCard, 'image'> & { file: string }): ItemCard => {
  const { file, ...rest } = it;
  return { ...rest, image: `${base}/items/${file}.webp` };
};

export const CARNIVAL_OF_BLOOD: Location = {
  id: 'carnival-of-blood',
  name: 'Carnival of Blood',
  film: 'carnival',
  icon: 'tent',
  board: `${base}/board.webp`,
  cover: `${base}/cover.webp`,
  select: `${base}/select.webp`,
  boardSize: { w: 2400, h: 2119 },
  zones: ZONES,
  itemDecks: ['casa-espejos', 'bosque-horrores', 'cosas-alucinantes'],
  setupBack: `${base}/setup/back.webp`,
  setups: [
    {
      id: 'encerrados-en-caja', name: 'Encerrados en caja', image: `${base}/setup/encerrados-en-caja.webp`,
      finalGirl: 'plaza-oeste', killer: 'noria',
      victims: { 'bosque-horrores': 2, 'tiro-al-blanco': 3, 'sendero-sur': 2, explanada: 1, 'gran-carpa': 2, 'casa-palomitas': 2 },
    },
    {
      id: 'no-tiene-gracia', name: 'No tiene gracia', image: `${base}/setup/no-tiene-gracia.webp`,
      finalGirl: 'cosas-alucinantes', killer: 'coche-payaso',
      victims: { 'bosque-horrores': 2, 'tiro-al-blanco': 2, 'sendero-sur': 2, 'gran-carpa': 2, 'plaza-este': 4 },
    },
    {
      id: 'escenario-central', name: 'Escenario central', image: `${base}/setup/escenario-central.webp`,
      finalGirl: 'gran-carpa', killer: 'taquilla',
      victims: { 'bosque-horrores': 3, explanada: 1, 'jaulas-animales': 2, 'casa-palomitas': 2, noria: 4 },
    },
    {
      id: 'corro-alrededor-de-rosie', name: 'Corro alrededor de Rosie', image: `${base}/setup/corro-alrededor-de-rosie.webp`,
      finalGirl: 'cosas-alucinantes', killer: 'tiro-al-blanco',
      victims: { 'bosque-horrores': 1, 'plaza-oeste': 1, 'casa-espejos': 1, 'sendero-sur': 2, 'gran-carpa': 3, explanada: 1, taquilla: 1, 'plaza-este': 1, 'casa-palomitas': 2 },
    },
    {
      id: 'tarde-para-el-show', name: 'Tarde para el show', image: `${base}/setup/tarde-para-el-show.webp`,
      finalGirl: 'salida', killer: 'gran-carpa',
      victims: { 'bosque-horrores': 2, 'tiro-al-blanco': 1, 'coche-payaso': 1, 'cosas-alucinantes': 1, 'jaulas-animales': 2, 'casa-palomitas': 3, noria: 2 },
    },
  ],
  eventBack: `${base}/events/back.webp`,
  events: [
    {
      id: 'transporte-de-empleados', name: 'Transporte de empleados', image: `${base}/events/transporte-de-empleados.webp`,
      flavor: '«Parece que alguien se ha dejado las llaves puestas en el carro…»',
      text: 'Pon la ficha del Carro de Golf en uno de los 4 espacios de esquina. Durante el Mantenimiento: tú y/o hasta 2 Víctimas del espacio del Carro podéis conducirlo hasta 2 espacios, pero debe quedarse en el lado más externo. Si el Carro llega a un espacio con un Enemigo, puedes descartarlo para hacerle 3 de daño. Si se elimina la ficha, descarta esta carta.',
      token: 'carro-de-golf', onReveal: [], persistent: true, custom: 'ev-golf-cart',
    },
    {
      id: 'no-es-real', name: 'No es real', image: `${base}/events/no-es-real.webp`,
      flavor: '«Estos efectos especiales están locos, ¡eso parece realmente un cadáver!»',
      text: 'Pon 4 nuevas Víctimas en la Casa de los Espejos. Coloca la ficha de la Calavera en el Bosque de los Horrores. Cualquier Víctima en o moviéndose al Bosque de los Horrores es asesinada inmediatamente.',
      token: 'calavera', onReveal: [], persistent: true, custom: 'ev-not-real',
    },
    {
      id: 'me-seguiste-hasta-aqui', name: '¿Me seguiste hasta aquí?', image: `${base}/events/me-seguiste-hasta-aqui.webp`,
      flavor: '«¿¡Por qué siempre te me pegas?!»',
      text: 'Coloca 4 nuevas Víctimas en la Gran Carpa. Una de ellas es una Víctima Especial: tu osada Hermana menor. Mientras tu Hermana esté en tu espacio, puedes gastar 2 Tiempo para volver a lanzar un dado. Si la Hermana muere, +2 Sed de Sangre. Si la Hermana deja de jugar, descarta esta carta.',
      onReveal: [], persistent: true, custom: 'ev-sister',
    },
    {
      id: 'corre-yo-les-entretendre', name: '¡Corre, yo les entretendré!', image: `${base}/events/corre-yo-les-entretendre.webp`,
      flavor: '«Hay una delgada línea entre el coraje y la idiotez.»',
      text: 'La Víctima más cercana a ti es tu Prometido. Si un Enemigo quisiera entrar en tu espacio mientras tu Prometido está allí, mata en su lugar a tu Prometido y el Enemigo se queda donde está. Si tu Prometido muere por una trampa, +5 Terror. Si el Prometido abandona el juego, descarta esta carta.',
      specialVictim: 'blue', onReveal: [], persistent: true, custom: 'ev-fiance',
    },
    {
      id: 'luna-llena', name: 'Luna llena', image: `${base}/events/luna-llena.webp`,
      flavor: '«No oía ese aullido desde que estaba en mi tierra…»',
      text: 'La Víctima más lejana a ti es ¡un Hombre Lobo! No te seguirá y no puede ser apuntado, salvado ni asesinado. Durante el Mantenimiento: el Hombre Lobo entra en pánico y luego hace 2 de daño a un objetivo en su espacio por esta prioridad: Víctima ▶ tú ▶ Esbirro ▶ Asesino.',
      specialVictim: 'orange', onReveal: [], persistent: true, custom: 'ev-werewolf',
    },
    {
      id: 'espejos-por-todas-partes', name: 'Espejos por todas partes', image: `${base}/events/espejos-por-todas-partes.webp`,
      flavor: '«¡Creo que los tengo! Oh no…»',
      text: 'Si atacas y hay una o más Víctimas en tu espacio, una Víctima muere por cada 1 que saques.',
      onReveal: [], persistent: true, custom: 'ev-mirrors',
    },
    {
      id: 'demasiada-basura', name: 'Demasiada basura', image: `${base}/events/demasiada-basura.webp`,
      flavor: '«Seguro que alguien necesita una intervención por acumulación de trastos.»',
      text: 'Cuando se revele, busca la carta de Objeto de Zappo y ponla en tu mochila (rebarajando el mazo si es necesario). Si pierdes a Zappo, tira un dado menos (mínimo 1) cuando resuelvas una carta de Acción de Buscar el resto de la partida.',
      onReveal: [], persistent: true, custom: 'ev-too-much-junk',
    },
    {
      id: 'como-puede-ser-de-peligroso', name: '¿Cómo puede ser de peligroso?', image: `${base}/events/como-puede-ser-de-peligroso.webp`,
      flavor: '«Sostenme la cerveza.»',
      text: 'Durante el Mantenimiento cada Víctima se mueve 1 espacio hacia la ficha de Trampa más cercana.',
      onReveal: [], persistent: true, custom: 'ev-so-dangerous',
    },
    {
      id: 'payasos-por-doquier', name: 'Payasos por doquier', image: `${base}/events/payasos-por-doquier.webp`,
      flavor: '«¿Has oído un bocinazo?»',
      text: 'Durante el Mantenimiento las Víctimas en la Gran Carpa y espacios adyacentes entran en pánico. Si entran en un espacio con un Enemigo, mueren inmediatamente.',
      onReveal: [], persistent: true, custom: 'ev-clowns',
    },
    {
      id: 'panico-animal', name: '¡Pánico animal!', image: `${base}/events/panico-animal.webp`,
      flavor: '«Leones y tigres y osos, ¡por favor!»',
      text: 'Cada vez que el nivel de Horror aumente, tira tantos dados como el nuevo nivel de Horror: por cada éxito puedes mover una Víctima de tu elección 1 espacio; por cada dos dados que no sean éxito, muere una Víctima.',
      onReveal: [], persistent: true, custom: 'ev-animal-panic',
    },
  ],
  horror: [
    {
      id: 'estoy-atrapada', name: '«¡Estoy atrapada y no puedo salir!»', copies: 1,
      image: `${base}/horror/estoy-atrapada.webp`,
      text: 'Objetivo la Chica Final ▶ mover ▶ atacar. Pon la ficha de Trampa de Red de Cuerda en tu zona y aplica sus efectos a ti y a las Víctimas de tu espacio. Si descartas una carta de Caminar o Correr: +2 Terror.',
      effects: [ka('finalGirl', 1, 1), custom('cn-trap:red')],
    },
    {
      id: 'quema-quema', name: '«¡Quema, quema!»', copies: 1,
      image: `${base}/horror/quema-quema.webp`,
      text: 'Pon la ficha de Trampa de Ácido en tu zona y aplica sus efectos a ti y a todas las Víctimas de tu espacio. +2 Terror.',
      effects: [custom('cn-trap:acid'), { kind: 'terror', amount: 2 }],
    },
    {
      id: 'de-donde-salen-las-cuchillas', name: '«¿De dónde diablos salen las cuchillas?»', copies: 1,
      image: `${base}/horror/de-donde-salen-las-cuchillas.webp`,
      text: 'Pon la ficha de Trampa de Sierras Giratorias en tu zona y aplica sus efectos a ti y a todas las Víctimas de tu espacio. Por cada 1-4 que saques: +1 Terror.',
      effects: [custom('cn-trap:saws')],
    },
    {
      id: 'brumosa-emboscada', name: 'Brumosa emboscada', copies: 1,
      image: `${base}/horror/brumosa-emboscada.webp`,
      text: 'Todas las Víctimas en o adyacentes al Bosque de los Horrores entran en pánico; por cada 1 que saques, la Víctima muere. Si al menos una Víctima muere: +1 Terror. Si ninguna muere, resuelve la siguiente carta de Terror.',
      effects: [custom('cn-ambush')],
    },
    {
      id: 'como-puede-haber-tantas-trampas', name: '«¿Cómo puede haber tantas trampas?»', copies: 1,
      image: `${base}/horror/como-puede-haber-tantas-trampas.webp`,
      text: 'Si no hay cartas de Objeto Trampa en el descarte de Objetos, descarta y roba la siguiente carta de Terror. Si no: baraja todas las cartas bocabajo de los mazos de Objeto con los Objetos Trampa descartados, repártelas de nuevo y pon los Objetos superiores bocarriba. Objetivo la Víctima más cercana ▶ mover ▶ atacar. +1 Terror.',
      effects: [custom('cn-rebuild')],
    },
    {
      id: 'esto-es-un-apoyo', name: '«¿Esto es un apoyo?»', copies: 1,
      image: `${base}/horror/esto-es-un-apoyo.webp`,
      text: 'Roba un Evento. Descarta al azar una carta de Objeto; si no tienes ninguno, descarta la carta superior del mazo de Objeto más cercano. Objetivo la Víctima más cercana ▶ mover ▶ atacar.',
      effects: [{ kind: 'drawEvent' }, custom('cn-support'), ka('victim', 1, 1)],
    },
    {
      id: 'bienvenidos-al-mayor-show', name: 'Bienvenidos al mayor show', copies: 1,
      image: `${base}/horror/bienvenidos-al-mayor-show.webp`,
      text: 'Roba un Evento. Todas las Víctimas se mueven 1 espacio hacia la Gran Carpa. Pon al Asesino en la Gran Carpa. Objetivo el más cercano ▶ atacar ▶ mover.',
      effects: [{ kind: 'drawEvent' }, custom('cn-victims-toward:gran-carpa'), custom('cn-killer-to:gran-carpa'), ka('nearest', 1, 1, { attackFirst: true })],
    },
    {
      id: 'como-se-ha-escapado-el-leon', name: '«¿Cómo se ha escapado el león?»', copies: 1,
      image: `${base}/horror/como-se-ha-escapado-el-leon.webp`,
      text: 'Si no hay Víctimas en el tablero, descarta y roba la siguiente carta de Terror. Si no: todas las Víctimas entran en pánico. Objetivo la Víctima más cercana ▶ mover ▶ atacar. En las Jaulas de los Animales y adyacentes: las Víctimas mueren, los Enemigos reciben 1 de daño y, si estás allí, pierdes 1 Vida.',
      requiresVictims: true,
      effects: [custom('cn-panic-all'), ka('victim', 1, 1), custom('cn-lion')],
    },
  ],
  items: [
    item({
      file: 'martillo-de-forzudo', id: 'martillo-de-forzudo', name: 'Martillo de forzudo',
      flavor: '«Es hora de demostrarles quién vale y puede jugar a un mega "atrapa-el-topo".»',
      text: 'Arma: alcance 0, +3 de daño. Debes tener 4 o más de Vida para atacar con él y no puedes llevarlo en la mochila. Después de resolver un ataque con este arma: pierdes 1 Vida y termina tu fase de Acción.',
      hands: 2, range: [0, 0], damage: 3, modifies: 'any', custom: 'item-hammer',
    }),
    item({
      file: 'zappo', id: 'zappo', name: 'Zappo, el mono del carnaval',
      flavor: '«Qué mono más majo, siempre preparado para echar una mano.»',
      text: 'Puedes usar a Zappo para jugar una carta de Buscar hasta a 2 espacios de distancia de una zona de Búsqueda. Si usas a Zappo y se revela un Objeto Trampa, huye despavorido: ignora los efectos de la trampa y descarta a Zappo.',
      hands: 0, custom: 'item-zappo',
    }),
    item({
      file: 'bebida-energetica', id: 'bebida-energetica', name: 'Bebida energética',
      flavor: '«Preparada para correr con los toros, cazar un monstruo y fiestear como una estrella de rock.»',
      text: 'Descártala durante la fase de Acción y elige: +3 Tiempo o muévete 1 zona.',
      hands: 0, custom: 'item-energy-drink',
    }),
    item({
      file: 'cuchillo', id: 'cuchillo', name: 'Cuchillo',
      flavor: '«Nunca antes había estado en una pelea de navajas.»',
      text: 'Arma: alcance 0, +1 de daño.',
      hands: 1, range: [0, 0], damage: 1, modifies: 'any',
    }),
    item({
      file: 'super-dados-de-la-suerte', id: 'super-dados-de-la-suerte', name: 'Super dados de la suerte',
      flavor: '«Suerte, sé mi dama esta noche.»',
      text: 'Úsalos para volver a tirar uno o todos los dados. Después tira un dado: 1-4 descarta esta carta; 5-6 guárdala.',
      hands: 0, custom: 'item-super-lucky-dice',
    }),
    item({
      file: 'bate-de-aluminio', id: 'bate-de-aluminio', name: 'Bate de aluminio',
      flavor: '«Casi como si alguien respodiera las oraciones de estos campeones del softball.»',
      text: 'Arma: alcance 0, +1 de daño. Siempre que hagas daño al Asesino con el Bate de aluminio, puedes descartar inmediatamente un Poder Oscuro Menor, incluidas las fichas de Vida que le queden.',
      hands: 2, range: [0, 0], damage: 1, modifies: 'any', custom: 'item-metal-bat',
    }),
    item({
      file: 'kit-de-primeros-auxilios', id: 'kit-de-primeros-auxilios', name: 'Kit de primeros auxilios',
      flavor: '«Calma. Hay que parar la hemorragia. ¡Hoy no vas a morir!»',
      text: 'Cada vez que uses una carta de Acción para recuperar Vida, recupera 1 más.',
      hands: 1, custom: 'item-first-aid',
    }),
    item({
      file: 'pertiga', id: 'pertiga-de-10', name: "Pértiga de 10'",
      flavor: '«Nunca fui una estrella del atletismo, pero qué mejor momento para aprender que ahora.»',
      text: 'Una vez por fase de Acción puedes saltar un espacio al moverte. No se activa ningún efecto del espacio que saltas y ninguna Víctima puede seguirte dentro ni más allá del espacio saltado.',
      hands: 2, custom: 'item-pole',
    }),
    item({
      file: 'latigo', id: 'latigo', name: 'Látigo',
      flavor: '«Igual no es el momento de estar cantando para mí misma sobre azotar algo.»',
      text: 'Arma: alcance 0, +1 de daño. Si dañas a un Enemigo con el Látigo, puedes moverle 1 espacio.',
      hands: 1, range: [0, 0], damage: 1, modifies: 'any', custom: 'item-whip',
    }),
    item({
      file: 'cinta-encontrada', id: 'cinta-encontrada', name: 'Cinta encontrada',
      flavor: '«Parece que quien estuvo aquí antes no lo consiguió…»',
      text: 'Descarta la Cinta encontrada para cancelar los efectos de un Objeto Trampa o de una carta de Trampa de Terror. Si cancelas una carta de Trampa de Terror, descártala sin aplicar NINGUNO de sus efectos.',
      hands: 0, custom: 'item-tape',
    }),
    item({
      file: 'pildoras-misteriosas', id: 'pildoras-misteriosas', name: 'Píldoras misteriosas',
      flavor: '«Espero que calmen mis nervios y sofoquen el dolor.»',
      text: 'Descártalas durante la fase de Acción y elige: −1 Terror o recupera 2 Vida.',
      hands: 0, custom: 'item-mystery-pills',
    }),
    item({
      file: 'hacha-arrojadiza', id: 'hacha-arrojadiza', name: 'Hacha arrojadiza',
      flavor: '«Les voy a cortar con el hacha para que me dejen en paz.»',
      text: 'Arma: alcance 0-1, +1 de daño. Puedes usarla para atacar a un Enemigo en un espacio adyacente; si lo haces, descártala después de resolver el ataque.',
      hands: 1, range: [0, 1], damage: 1, modifies: 'any', custom: 'item-throwing-axe',
    }),
    item({
      file: 'bola-de-cristal', id: 'bola-de-cristal', name: 'Bola de cristal',
      flavor: '«La fortuna favorece a los osados.»',
      text: 'Una vez por fase de Acción tira un dado. 1-4: no pasa nada. 5-6: mira la siguiente carta de Terror y ponla arriba o debajo del todo del mazo de Terror.',
      hands: 0, custom: 'item-crystal-ball',
    }),
    item({
      file: 'viejo-revolver', id: 'viejo-revolver', name: 'Viejo revólver',
      flavor: '«Espero que aún funcione; tengo que hacer que cada disparo cuente.»',
      text: 'Arma: alcance 1, +1 de daño. Solo puede modificar la carta de Acción Ataque débil.',
      hands: 1, range: [1, 1], damage: 1, modifies: ['ataque-debil'],
    }),
    item({
      file: 'tapadera', id: 'tapadera', name: 'Tapadera',
      flavor: '«No esperaba hacer cosplay de un héroe americano…»',
      text: 'Ignora 1 punto de daño de un ataque. 3 usos.',
      hands: 1, uses: 3, custom: 'item-trash-lid',
    }),
    item({
      file: 'kit-de-maquillaje', id: 'kit-de-maquillaje', name: 'Kit de maquillaje y disfraz',
      flavor: '«¡Sabía que el teatro serviría para algo!»',
      text: 'Cuando un Enemigo apunte específicamente a la Chica Final, puedes usar el Kit para hacerte pasar por una Víctima: el Enemigo apuntará entonces a la Víctima más cercana.',
      hands: 0, custom: 'item-makeup',
    }),
    item({
      file: 'bandolera-de-cuchillos', id: 'bandolera-de-cuchillos', name: 'Bandolera de cuchillos',
      flavor: '«Creo que son demasiados cuchillos… Nah, no tantos.»',
      text: 'Arma: alcance 0-1, +1 de daño, 4 usos. Cuando uses la Bandolera de cuchillos, puedes dividir el daño como prefieras entre cualquier Enemigo de su alcance.',
      hands: 1, range: [0, 1], damage: 1, uses: 4, modifies: 'any', custom: 'item-knife-belt',
    }),
    item({
      file: 'spray-de-pimienta', id: 'spray-de-pimienta', name: 'Spray de pimienta',
      flavor: '«Suficientemente fuerte para un oso pardo, ¿suficientemente bueno para un psicópata?»',
      text: 'Si el Asesino está en tu espacio, puedes descartarlo para terminar inmediatamente la fase del Asesino. Ignora su movimiento restante, sus ataques y demás efectos.',
      hands: 1, custom: 'item-pepper-spray',
    }),
    item({
      file: 'trampa-para-osos-de-acero', id: 'trampa-para-osos-de-acero', name: 'Trampa para osos de acero',
      flavor: '«¡Es una trampa! Una trampa para osos te atrapa mientras buscas.»',
      text: 'Objeto Trampa. Pierdes 1 Vida. Debes gastar 2 Tiempo para quitarte esta trampa de la pierna y no puedes moverte hasta que lo hagas. Cuando se elimine la trampa, descarta esta carta.',
      hands: 0, trap: true,
    }),
    item({
      file: 'trampa-de-gas-somnifero', id: 'trampa-de-gas-somnifero', name: 'Trampa de gas somnífero',
      flavor: '«¡Es una trampa! Mientras buscas, gas adormecedor te explota en la cara.»',
      text: 'Objeto Trampa. ¡Caes dormida! Termina inmediatamente tu fase de Acción y pon el marcador de Tiempo a cero. Recuperas 1 Vida de una buena siesta. Descarta esta carta.',
      hands: 0, trap: true,
    }),
    item({
      file: 'trampa-de-la-cobra-oculta', id: 'trampa-de-la-cobra-oculta', name: 'Trampa de la cobra oculta',
      flavor: '«¡Es una trampa! ¡Una cobra oculta te ataca!»',
      text: 'Objeto Trampa. Ponla junto a tu carta de Chica Final. Durante el Mantenimiento pierdes 1 Vida. La próxima vez que recuperes Vida, descarta esta carta en su lugar.',
      hands: 0, trap: true,
    }),
  ],
  tokens: {
    'trampa-acido': `${base}/tokens/trampa-acido.webp`,
    'trampa-red': `${base}/tokens/trampa-red.webp`,
    'trampa-sierras': `${base}/tokens/trampa-sierras.webp`,
    'carro-de-golf': `${base}/tokens/carro-de-golf.webp`,
    calavera: `${base}/tokens/calavera.webp`,
  },
  tokenInfo: {
    'trampa-acido': { text: 'Trampa de ácido: toda Víctima que entre o esté aquí muere. Cada vez que tú entres, pierdes 1 Vida. Los Enemigos la ignoran.', image: `${base}/special/referencia-trampa.webp` },
    'trampa-red': { text: 'Trampa de red de cuerda: toda Víctima que entre o esté aquí muere. Cada vez que tú entres, descartas 1 carta de Acción al azar. Los Enemigos la ignoran.', image: `${base}/special/referencia-trampa.webp` },
    'trampa-sierras': { text: 'Trampa de sierras giratorias: toda Víctima que entre o esté aquí muere. Cada vez que tú entres, tira 2 dados: con 1-4 recibes 1 de daño; con 5-6 puedes moverte 1 espacio. Los Enemigos la ignoran.', image: `${base}/special/referencia-trampa.webp` },
    'carro-de-golf': { text: 'Carro de Golf: en el Mantenimiento, tú y/o hasta 2 Víctimas de su espacio podéis conducirlo hasta 2 espacios por el borde del recinto. Si llega a un Enemigo, puedes descartarlo para hacerle 3 de daño.' },
    calavera: { text: 'Calavera: cualquier Víctima en o moviéndose al Bosque de los Horrores es asesinada inmediatamente.' },
  },
  specialRules:
    'Objetos Trampa: hay uno escondido en cada mazo de Objetos; se resuelve al robarlo. Terrores Trampa: 3 cartas de Terror colocan una ficha de Trampa que permanece en el tablero: toda Víctima que entre o esté allí muere y tú sufres su efecto cada vez que entres. Los Enemigos ignoran las fichas de Trampa.',
};
