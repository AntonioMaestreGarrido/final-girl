import type { DieFace, Effect, KillerAction, Location, Zone } from '../../types';

const base = 'assets/locations/camp-happy-trails';
const BOARD_W = 2400;
const BOARD_H = 2168;

const ka = (target: KillerAction['target'], moves: number, attacks: number): Effect => ({
  kind: 'killerAction',
  action: { target, moves, attacks },
});
const faces = (from: DieFace, to: DieFace): DieFace[] =>
  Array.from({ length: to - from + 1 }, (_, i) => (from + i) as DieFace);
const at = (x: number, y: number) => ({ x: (x / BOARD_W) * 100, y: (y / BOARD_H) * 100 });

/**
 * Mapa de Camp Happy Trails: 18 zonas.
 * `flee` = números de huida impresos en el lado de cada zona (revisado con el usuario).
 * Las zonas sin nombre impreso llevan un `label` descriptivo para la interfaz.
 */
const ZONES: Zone[] = [
  {
    id: 'noroeste', label: 'Bosque del noroeste', pos: at(230, 640),
    flee: [{ to: 'cabanas', faces: faces(1, 4) }, { to: 'pistas', faces: [5] }, { to: 'camino-norte', faces: [6] }],
  },
  {
    id: 'cabanas', name: 'Cabañas', label: 'Cabañas', search: true, water: true, pos: at(500, 900),
    flee: [{ to: 'noroeste', faces: [3, 4] }, { to: 'camino-norte', faces: [5, 6] }],
  },
  {
    id: 'camino-norte', label: 'Camino del norte', pos: at(800, 580),
    flee: [{ to: 'cabanas', faces: faces(1, 3) }, { to: 'noroeste', faces: [4, 5] }, { to: 'entrada', faces: [6] }],
  },
  {
    id: 'entrada', label: 'Entrada del campamento', exit: true, pos: at(1230, 560),
    flee: [{ to: 'camino-norte', faces: [1, 2] }, { to: 'bosque-norte', faces: faces(3, 6) }],
  },
  {
    id: 'bosque-norte', label: 'Bosque del norte', pos: at(1700, 640),
    flee: [{ to: 'acantilado', faces: faces(1, 4) }, { to: 'entrada', faces: [5] }, { to: 'camino-este', faces: [6] }],
  },
  {
    id: 'cobertizo', name: 'Cobertizo de servicios', label: 'Cobertizo de servicios', search: true, pos: at(2120, 760),
    flee: [{ to: 'camino-este', faces: faces(3, 6) }],
  },
  {
    id: 'camino-este', label: 'Camino del este', water: true, pos: at(2010, 1150),
    flee: [{ to: 'bosque-norte', faces: faces(1, 4) }, { to: 'cobertizo', faces: [5] }, { to: 'pantano', faces: [6] }],
  },
  {
    id: 'pantano', label: 'Pantano', water: true, pos: at(2080, 1560),
    flee: [{ to: 'salida-sureste', faces: faces(1, 4) }, { to: 'camino-este', faces: [5, 6] }],
  },
  {
    id: 'salida-sureste', label: 'Salida del sureste', exit: true, pos: at(1950, 1960),
    flee: [{ to: 'muelle', faces: faces(1, 4) }, { to: 'camino-sur', faces: [5] }, { to: 'pantano', faces: [6] }],
  },
  {
    id: 'muelle', name: 'Muelle', label: 'Muelle', search: true, water: true, pos: at(1480, 1640),
    flee: [{ to: 'lago', faces: faces(1, 4) }, { to: 'camino-sur', faces: [5] }, { to: 'salida-sureste', faces: [6] }],
  },
  {
    id: 'lago', name: 'Lago', label: 'Lago', pos: at(1830, 1420),
    flee: [{ to: 'muelle', faces: [5] }, { to: 'acantilado', faces: [6] }],
  },
  {
    id: 'acantilado', name: 'Acantilado', label: 'Acantilado', water: true, pos: at(1330, 960),
    flee: [{ to: 'lago', faces: faces(1, 4) }, { to: 'punto-encuentro', faces: [5] }, { to: 'bosque-norte', faces: [6] }],
  },
  {
    id: 'punto-encuentro', name: 'Punto de Encuentro', label: 'Punto de Encuentro', water: true, pos: at(1000, 960),
    flee: [{ to: 'acantilado', faces: faces(3, 6) }],
  },
  {
    id: 'camino-sur', label: 'Camino del sur', pos: at(1200, 1880),
    flee: [{ to: 'muelle', faces: faces(1, 3) }, { to: 'fogon', faces: [4] }, { to: 'cabana-lago', faces: [5] }, { to: 'salida-sureste', faces: [6] }],
  },
  {
    id: 'fogon', name: 'Fogón', label: 'Fogón', pos: at(720, 1940),
    flee: [{ to: 'camino-sur', faces: faces(2, 5) }, { to: 'cabana-lago', faces: [6] }],
  },
  {
    id: 'cabana-lago', label: 'Cabaña del lago', water: true, pos: at(820, 1480),
    flee: [{ to: 'camino-sur', faces: faces(1, 4) }, { to: 'fogon', faces: [5] }, { to: 'pistas', faces: [6] }],
  },
  {
    id: 'pistas', label: 'Pistas deportivas', water: true, pos: at(300, 1380),
    flee: [{ to: 'cabana-lago', faces: faces(1, 3) }, { to: 'noroeste', faces: [4, 5] }, { to: 'salida-suroeste', faces: [6] }],
  },
  {
    id: 'salida-suroeste', label: 'Salida del suroeste', exit: true, pos: at(190, 1880),
    flee: [{ to: 'pistas', faces: faces(1, 6) }],
  },
];

export const CAMP_HAPPY_TRAILS: Location = {
  id: 'camp-happy-trails',
  name: 'Camp Happy Trails',
  film: 'happy-trails',
  icon: 'tent',
  board: `${base}/board.webp`,
  cover: `${base}/cover.webp`,
  select: `${base}/select.webp`,
  boardSize: { w: BOARD_W, h: BOARD_H },
  zones: ZONES,
  itemDecks: ['cabanas', 'muelle', 'cobertizo'],
  setupBack: `${base}/setup/back.webp`,
  setups: [
    {
      id: 'caza-del-tesoro', name: 'Caza del tesoro', image: `${base}/setup/caza-del-tesoro.webp`,
      finalGirl: 'pistas', killer: 'pantano',
      victims: { cobertizo: 2, 'bosque-norte': 1, cabanas: 2, 'punto-encuentro': 1, 'cabana-lago': 1, muelle: 2, fogon: 1 },
    },
    {
      id: 'captura-la-bandera', name: 'Captura la bandera', image: `${base}/setup/captura-la-bandera.webp`,
      finalGirl: 'punto-encuentro', killer: 'camino-sur',
      victims: { noroeste: 2, 'camino-norte': 1, cobertizo: 1, 'camino-este': 2, pistas: 2, pantano: 2 },
    },
    {
      id: 'hora-de-la-meditacion', name: 'Hora de la meditación', image: `${base}/setup/hora-de-la-meditacion.webp`,
      finalGirl: 'pistas', killer: 'lago',
      victims: { noroeste: 1, cobertizo: 1, 'punto-encuentro': 2, acantilado: 1, 'camino-este': 1, 'cabana-lago': 1, muelle: 1, pantano: 1, fogon: 1 },
    },
    {
      id: 'el-bano-de-la-piel', name: 'El baño de la piel', image: `${base}/setup/el-bano-de-la-piel.webp`,
      finalGirl: 'muelle', killer: 'camino-este',
      victims: { noroeste: 1, 'camino-norte': 1, cabanas: 1, 'punto-encuentro': 2, acantilado: 2, lago: 1, fogon: 2 },
    },
    {
      id: 'la-hoguera', name: 'La hoguera', image: `${base}/setup/la-hoguera.webp`,
      finalGirl: 'pantano', killer: 'noroeste',
      victims: { 'punto-encuentro': 2, 'cabana-lago': 1, fogon: 6, 'camino-sur': 1 },
    },
  ],
  eventBack: `${base}/events/back.webp`,
  events: [
    {
      id: 'desafortunados-amantes', name: 'Desafortunados amantes', image: `${base}/events/desafortunados-amantes.webp`,
      flavor: '«¡Y de este modo con un beso muero!»',
      text: 'Cuando haya exactamente 2 Víctimas en una zona y una de ellas sea asesinada, la otra muere inmediatamente también.',
      onReveal: [], persistent: true, custom: 'ev-star-crossed-lovers',
    },
    {
      id: 'novio', name: 'Novio', image: `${base}/events/novio.webp`,
      flavor: '«Si desea morir por mí, ¿quién soy yo para pararle?»',
      text: 'La Víctima más cercana a ti es ahora tu Novio. Si el Novio muere en tu zona, empieza la siguiente fase de Acción con 12 de Tiempo. Si el Novio sale de la partida, descarta esta carta.',
      specialVictim: 'blue', onReveal: [], persistent: true, custom: 'ev-boyfriend',
    },
    {
      id: 'carne-fresca', name: 'Carne fresca', image: `${base}/events/carne-fresca.webp`,
      flavor: '«¡Bienvenidos a Happy Trails, donde tendréis recuerdos que durarán hasta la muerte!»',
      text: 'Coloca 2 nuevas Víctimas en las Cabañas, 2 en el Muelle y 2 en el Fogón. Descarta esta carta.',
      onReveal: [
        { kind: 'placeVictims', count: 2, where: { zone: 'cabanas' } },
        { kind: 'placeVictims', count: 2, where: { zone: 'muelle' } },
        { kind: 'placeVictims', count: 2, where: { zone: 'fogon' } },
      ],
      persistent: false,
    },
    {
      id: 'crios-cabezotas', name: 'Críos cabezotas', image: `${base}/events/crios-cabezotas.webp`,
      flavor: '«¡Malditos adolescentes, creen que lo saben todo!»',
      text: 'Te seguirá 1 Víctima menos.',
      onReveal: [], persistent: true, custom: 'ev-stubborn-kids',
    },
    {
      id: 'campistas-pegajosos', name: 'Campistas pegajosos', image: `${base}/events/campistas-pegajosos.webp`,
      flavor: '«¡Si agarras mi brazo más fuerte, acabarás arrancándomelo!»',
      text: 'No hay penalización por la primera Víctima que salves durante la fase de Acción. Por cada Víctima adicional que salves en esa fase, pierde 1 Vida.',
      onReveal: [], persistent: true, custom: 'ev-clingy-campers',
    },
    {
      id: 'novia', name: 'Novia', image: `${base}/events/novia.webp`,
      flavor: '«Es guapa, divertida y la más impresionante que he conocido»',
      text: 'La Víctima más cercana a ti es ahora tu Novia. Te seguirá incluso a la zona del Asesino. Mientras esté en tu zona, tira +1 dado en cada Tirada de Terror. Si la Novia muere mientras está en tu zona, +5 Terror. Si la Novia sale de la partida, descarta esta carta.',
      specialVictim: 'white', onReveal: [], persistent: true, custom: 'ev-girlfriend',
    },
    {
      id: 'aguas-oscuras', name: 'Aguas oscuras', image: `${base}/events/aguas-oscuras.webp`,
      flavor: '«Si vas a darte un baño, no volverás jamás»',
      text: 'Coloca la ficha de Aguas Oscuras en el Lago. Todas las Víctimas del Lago mueren. Cada vez que una Víctima entre en el Lago, muere inmediatamente.',
      token: 'aguas-oscuras', onReveal: [], persistent: true, custom: 'ev-dark-waters',
    },
    {
      id: 'tunel-secreto', name: 'Túnel secreto', image: `${base}/events/tunel-secreto.webp`,
      flavor: '«Este túnel fue el secreto mejor guardado de los adolescentes salidos, pero ahora puede salvarme la vida.»',
      text: 'Elige dos de estas zonas (Cobertizo de servicios, Cabañas o Muelle) y coloca una ficha de Túnel Secreto en cada una. Puedes moverte entre ellas como si fueran adyacentes. Los Enemigos no pueden usar el túnel secreto.',
      token: 'tunel-secreto', onReveal: [], persistent: true, custom: 'ev-secret-tunnel',
    },
    {
      id: 'deseo-mortal', name: 'Deseo mortal', image: `${base}/events/deseo-mortal.webp`,
      flavor: '«¡Tengo que acercarme a ver más, aunque eso me cueste la vida!»',
      text: 'Durante la fase de Mantenimiento, mueve la Víctima más cercana al Asesino 1 zona hacia él. No cuentes las Víctimas que ya estén en la zona del Asesino.',
      onReveal: [], persistent: true, custom: 'ev-death-wish',
    },
    {
      id: 'venganza', name: 'Venganza', image: `${base}/events/venganza.webp`,
      flavor: '«No sé por qué le he cabreado, y no me importa. ¡Sálvame!»',
      // Texto de la versión comercial (la Maldita).
      text: 'La Víctima más alejada del Asesino es ahora la Maldita. Siempre que el Asesino deba elegir un objetivo, elige a la Maldita en su lugar. La Maldita solo puede salvarse si es la última Víctima con vida. Si la Maldita muere, +2 Sed de Sangre. Si la Maldita sale de la partida, descarta esta carta.',
      specialVictim: 'orange', onReveal: [], persistent: true, custom: 'ev-revenge',
    },
  ],
  horror: [
    {
      id: 'veamos-si-son-ciertos-los-rumores', name: '«Veamos si son ciertos los rumores»', copies: 1,
      image: `${base}/horror/veamos-si-son-ciertos-los-rumores.webp`,
      text: 'Coloca 2 nuevas Víctimas en la zona donde empezó el Asesino. +1 Terror. Roba un Evento.',
      effects: [{ kind: 'placeVictims', count: 2, where: { at: 'killerStart' } }, { kind: 'terror', amount: 1 }, { kind: 'drawEvent' }],
    },
    {
      id: 'puede-que-las-cosas-empiecen', name: '«Puede que las cosas empiecen a ir a nuestra manera»', copies: 1,
      image: `${base}/horror/puede-que-las-cosas-empiecen.webp`,
      text: 'Roba la carta superior de cualquier mazo de Objetos.',
      effects: [{ kind: 'drawItemAnyDeck' }],
    },
    {
      id: 'corre-por-tu-vida', name: '«¡Corre por tu vida!»', copies: 1,
      image: `${base}/horror/corre-por-tu-vida.webp`,
      text: 'Si no hay Víctimas en el tablero, descarta y roba la siguiente carta de Horror. En caso contrario: todas las Víctimas que no estén en tu zona huyen. Objetivo el más cercano ▶ atacar. Objetivo la Víctima más cercana ▶ mover.',
      requiresVictims: true,
      effects: [{ kind: 'panic', who: 'notFinalGirlZone', times: 1 }, ka('nearest', 0, 1), ka('victim', 1, 0)],
    },
    {
      id: 'esa-chica-como-se-llama', name: '«Esa chica, ¿cómo se llama?… Puede ayudarnos»', copies: 1,
      image: `${base}/horror/esa-chica-como-se-llama.webp`,
      text: 'Coloca 2 nuevas Víctimas en la zona donde empezaste la partida. +1 Terror. Roba un Evento.',
      effects: [{ kind: 'placeVictims', count: 2, where: { at: 'finalGirlStart' } }, { kind: 'terror', amount: 1 }, { kind: 'drawEvent' }],
    },
    {
      id: 'que-ruido-es-ese', name: '«¿Qué ruido es ese? ¡Vamos a ver!»', copies: 1,
      image: `${base}/horror/que-ruido-es-ese.webp`,
      text: 'Si no hay Víctimas en el tablero, descarta y roba la siguiente carta de Horror. En caso contrario: todas las Víctimas se mueven 1 zona hacia el Enemigo más cercano. Objetivo el más cercano ▶ atacar. Objetivo la Víctima más cercana ▶ mover.',
      requiresVictims: true,
      effects: [{ kind: 'victimsStepToward', toward: 'nearestEnemy' }, ka('nearest', 0, 1), ka('victim', 1, 0)],
    },
    {
      id: 'fuego', name: '«¡Fuego!»', copies: 1,
      image: `${base}/horror/fuego.webp`,
      text: 'Tira un dado para ver qué zona arde: 1-2 Cabañas, 3-4 Cobertizo de servicios, 5-6 Muelle. Todas las Víctimas de esa zona mueren y se descartan todas las cartas de su mazo de Objetos. Si tú o un Enemigo estáis allí, cada uno pierde 1 Vida.',
      effects: [{ kind: 'custom', id: 'camp-fire' }],
    },
    {
      id: 'me-quede-dormido', name: '«Me quedé dormido. ¿Qué me perdí?»', copies: 1,
      image: `${base}/horror/me-quede-dormido.webp`,
      text: 'Coloca 1 nueva Víctima en las Cabañas. +2 Terror.',
      effects: [{ kind: 'placeVictims', count: 1, where: { zone: 'cabanas' } }, { kind: 'terror', amount: 2 }],
    },
    {
      id: 'no-puedes-salvarnos', name: '«No puedes salvarnos… ¡Nadie puede!»', copies: 1,
      image: `${base}/horror/no-puedes-salvarnos.webp`,
      text: 'Si no hay Víctimas en el tablero, descarta y roba la siguiente carta de Horror. En caso contrario: todas las Víctimas de la zona del Asesino huyen dos veces. Objetivo el más cercano ▶ atacar. Objetivo la Víctima más cercana ▶ mover.',
      requiresVictims: true,
      effects: [{ kind: 'panic', who: 'killerZone', times: 2 }, ka('nearest', 0, 1), ka('victim', 1, 0)],
    },
  ],
  items: [
    {
      id: 'bate-metalico', name: 'Bate metálico', image: `${base}/items/bate-metalico.webp`,
      flavor: '«Arriba bateadores, estoy listo para hacer un gran slam.»',
      text: 'Siempre que hagas daño al Asesino con el Bate metálico, puedes descartar inmediatamente un Poder Oscuro Menor, incluidas las fichas de Vida que le queden.',
      hands: 2, range: [0, 0], damage: 1, modifies: 'any', custom: 'item-metal-bat',
    },
    {
      id: 'silbato', name: 'Silbato', image: `${base}/items/silbato.webp`,
      flavor: '«Estúpidos turistas. Tengo que llamar su atención de alguna forma, por arriesgado que sea.»',
      text: 'Una vez por fase de Acción, gasta 1 Tiempo: todas las Víctimas adyacentes se mueven a tu zona y después todos los Enemigos toman como objetivo a la Chica Final ▶ mover. Mientras tengas el Silbato, te seguirá 1 Víctima adicional.',
      hands: 0, custom: 'item-whistle',
    },
    {
      id: 'bebida-energetica', name: 'Bebida energética', image: `${base}/items/bebida-energetica.webp`,
      flavor: '«No hay forma de que estas cosas te sienten bien, pero es mejor esto que morir.»',
      text: 'Descártala durante la fase de Acción y elige: +3 Tiempo o muévete 1 zona.',
      hands: 0, custom: 'item-energy-drink',
    },
    {
      id: 'tapadera', name: 'Tapadera', image: `${base}/items/tapadera.webp`,
      flavor: '«No va a parar mucho, pero es mejor que nada.»',
      text: 'Ignora 1 punto de daño de un ataque. 3 usos.',
      hands: 1, uses: 3, custom: 'item-trash-lid',
    },
    {
      id: 'cuchillo', name: 'Cuchillo', image: `${base}/items/cuchillo.webp`,
      flavor: '«Bueno para tallar. También genial para apuñalar maníacos.»',
      text: 'Arma: alcance 0, +1 de daño.',
      hands: 1, range: [0, 0], damage: 1, modifies: 'any',
    },
    {
      id: 'llaves-del-bote-a-motor', name: 'Llaves del bote a motor', image: `${base}/items/llaves-del-bote-a-motor.webp`,
      flavor: '«Al viejo Man Jackson no le importará si cojo el bote, porque estoy bastante seguro de que está muerto.»',
      text: 'Coloca la ficha de Bote a motor en la zona más cercana a ti que bordee el agua. Gasta 2 Tiempo para usar el bote y viajar a cualquier otra zona que bordee el agua. Las Víctimas pueden acompañarte.',
      hands: 0, token: 'bote-a-motor', custom: 'item-motorboat',
    },
    {
      id: 'arco', name: 'Arco', image: `${base}/items/arco.webp`,
      flavor: '«Adopta la posición. Ajusta la flecha. Tensa. Apunta. Suelta la cuerda. Diana.»',
      text: 'El Arco no puede modificar una carta de Acción y se usa sin ella. Disparar una flecha cuesta 2 Tiempo. Alcance 1-2, +1 de daño, 3 usos.',
      hands: 2, range: [1, 2], damage: 1, uses: 3, modifies: 'none', custom: 'item-bow',
    },
    {
      id: 'fuegos-artificiales', name: 'Fuegos artificiales', image: `${base}/items/fuegos-artificiales.webp`,
      flavor: '«Nada como unos cuantos cohetes y petardos para atraer la atención.»',
      // Versión comercial: la carta se descarta al usarla.
      text: 'Gasta 2 Tiempo para colocar la ficha de Fuegos artificiales en tu zona o en una adyacente (que no sea el Lago). Descarta esta carta. Cuando el Asesino tenga que elegir un objetivo, elegirá los Fuegos artificiales. Descarta la ficha cuando el Asesino entre en su zona.',
      hands: 0, token: 'fuegos-artificiales', custom: 'item-fireworks',
    },
    {
      id: 'dados-de-la-suerte', name: 'Dados de la suerte', image: `${base}/items/dados-de-la-suerte.webp`,
      flavor: '«Mi papi tenía un par de estos, decía que le traían suerte. Puede que a mí también.»',
      text: 'Descártalos para volver a tirar los dados que quieras.',
      hands: 0, custom: 'item-lucky-dice',
    },
    {
      id: 'pildoras-misteriosas', name: 'Píldoras misteriosas', image: `${base}/items/pildoras-misteriosas.webp`,
      flavor: '«No pone qué demonios son, pero estoy sin opciones. Por el gaznate y a cruzar los dedos.»',
      text: 'Descártalas durante la fase de Acción y elige: −1 Terror o recupera 2 Vida.',
      hands: 0, custom: 'item-mystery-pills',
    },
    {
      id: 'hacha', name: 'Hacha', image: `${base}/items/hacha.webp`,
      flavor: '«Espera un segundo, mientras entierro esto en tu cara.»',
      text: 'Arma: alcance 0, +2 de daño.',
      hands: 2, range: [0, 0], damage: 2, modifies: 'any',
    },
    {
      id: 'kit-de-primeros-auxilios', name: 'Kit de primeros auxilios', image: `${base}/items/kit-de-primeros-auxilios.webp`,
      flavor: '«Paso 1: dejar de sangrar. Paso 2: seguir viva.»',
      text: 'Cada vez que uses una carta de Acción para recuperar Vida, recupera 1 más.',
      hands: 1, custom: 'item-first-aid',
    },
    {
      id: 'pata-de-conejo', name: 'Pata de conejo de la suerte', image: `${base}/items/pata-de-conejo.webp`,
      flavor: '«No soy del tipo supersticioso, pero tomaré toda la ayuda posible.»',
      text: 'Descártala durante la fase de Acción para hacer una Tirada de Terror. Por cada éxito, elige: +2 Tiempo, recupera 1 Vida, −1 Terror o muévete 1 zona.',
      hands: 0, custom: 'item-rabbit-foot',
    },
    {
      id: 'viejo-revolver', name: 'Viejo revólver', image: `${base}/items/viejo-revolver.webp`,
      flavor: '«Un poco oxidado, pero todavía coloca una bala entre los ojos.»',
      text: 'Arma: alcance 1, +1 de daño. Solo puede modificar la carta de Acción Ataque débil.',
      hands: 1, range: [1, 1], damage: 1, modifies: ['ataque-debil'],
    },
    {
      id: 'trampa-para-osos', name: 'Trampa para osos', image: `${base}/items/trampa-para-osos.webp`,
      flavor: '«Quien pise esto va a pasar un rato muy, muy malo.»',
      // Versión comercial: la carta se descarta al usarla.
      text: 'Gasta 2 Tiempo para colocar la ficha de Trampa para osos en tu zona (que no sea el Lago). Descarta esta carta. Si el Asesino entra en la zona de la Trampa, descarta la ficha y termina inmediatamente la fase del Asesino. El Asesino recibe 2 de daño.',
      hands: 0, token: 'trampa-para-osos', custom: 'item-bear-trap',
    },
    {
      id: 'linterna', name: 'Linterna', image: `${base}/items/linterna.webp`,
      flavor: '«Mami siempre decía que ahuyentaría los monstruos bajo mi cama. Espero que tuviera razón.»',
      text: 'Una vez por fase de Acción, gasta 1 Tiempo para mirar la carta superior del mazo de Horror. Déjala o ponla en el fondo del mazo.',
      hands: 0, custom: 'item-flashlight',
    },
    {
      id: 'mapa', name: 'Mapa', image: `${base}/items/mapa.webp`,
      flavor: '«Si voy a sobrevivir esta noche, necesito saber por dónde ando.»',
      text: 'Descártalo durante la fase de Acción y, por cada mazo de Objetos: si la carta superior está bocabajo, revélala; si está bocarriba, puedes retirarla de la partida y revelar la siguiente.',
      hands: 0, custom: 'item-map',
    },
    {
      id: 'spray-pimienta', name: 'Spray de pimienta', image: `${base}/items/spray-pimienta.webp`,
      flavor: '«Un par de chorros en los ojos y se lo pensarán dos veces antes de molestar a esta chica.»',
      text: 'Si el Asesino está en tu zona, puedes descartarlo para terminar inmediatamente la fase del Asesino. Ignora su movimiento restante, sus ataques y cualquier otro efecto.',
      hands: 1, custom: 'item-pepper-spray',
    },
  ],
  tokens: {
    'bote-a-motor': `${base}/tokens/bote-a-motor.webp`,
    'trampa-para-osos': `${base}/tokens/trampa-para-osos.webp`,
    'fuegos-artificiales': `${base}/tokens/fuegos-artificiales.webp`,
    'tunel-secreto': `${base}/tokens/tunel-secreto-1.webp`,
    'aguas-oscuras': `${base}/tokens/aguas-oscuras.webp`,
  },
  specialRules: 'No hay reglas especiales para Camp Happy Trails.',
};
