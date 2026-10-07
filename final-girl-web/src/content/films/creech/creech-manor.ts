import type { DieFace, Effect, ItemCard, KillerAction, Location, Zone } from '../../types';

const base = 'assets/locations/creech-manor';
// Las posiciones se midieron sobre el tablero a 1800×1590; la imagen final es 2400×2119.
const MAP_W = 1800;
const MAP_H = 1590;

const ka = (target: KillerAction['target'], moves: number, attacks: number, opts: { killAlong?: boolean } = {}): Effect => ({
  kind: 'killerAction',
  action: { target, moves, attacks, ...(opts.killAlong ? { killAlong: true } : {}) },
});
const custom = (id: string): Effect => ({ kind: 'custom', id });
const f = (...n: DieFace[]) => n;
const at = (x: number, y: number) => ({ x: (x / MAP_W) * 100, y: (y / MAP_H) * 100 });

/**
 * Mapa de Creech Manor: 21 espacios (+ el Helicóptero, que solo existe con su Evento).
 * `flee` = números de huida impresos en cada conexión que sale del espacio. Las uniones de un solo
 * sentido solo aparecen en el espacio de origen. Plantas: 0 = fuera, 1 = planta baja … 5 = Ático.
 */
const ZONES: Zone[] = [
  // Ático
  { id: 'atico', name: 'Ático', label: 'Ático', search: true, floor: 5, pos: at(800, 430),
    flee: [{ to: 'cuarto-escalera', faces: f(5, 6) }] },
  // 4.ª planta
  { id: 'cuarto-tele', label: 'Cuarto de la tele', floor: 4, pos: at(500, 620),
    flee: [{ to: 'cuarto-escalera', faces: f(3, 4, 5, 6) }, { to: 'lavabo-izq', faces: f(1, 2) }] },
  { id: 'cuarto-escalera', label: 'Cuarto de la escalera', floor: 4, pos: at(800, 610),
    flee: [{ to: 'cuarto-tele', faces: f(1) }, { to: 'dormitorio', faces: f(2) }, { to: 'atico', faces: f(3, 4, 5, 6) }] },
  { id: 'dormitorio', label: 'Dormitorio', floor: 4, pos: at(1060, 610),
    flee: [{ to: 'pasillo-escalera', faces: f(1) }, { to: 'cuarto-escalera', faces: f(2, 3, 4) }, { to: 'vestidor', faces: f(5, 6) }] },
  { id: 'vestidor', name: 'Vestidor', label: 'Vestidor', search: true, floor: 4, pos: at(1320, 630),
    flee: [{ to: 'dormitorio', faces: f(3, 4, 5, 6) }] },
  // 3.ª planta
  { id: 'lavabo-izq', label: 'Lavabo de la izquierda', window: true, floor: 3, pos: at(400, 830),
    flee: [{ to: 'trofeos', faces: f(1, 2, 3, 4) }, { to: 'ext-izq', faces: f(5, 6) }] },
  { id: 'trofeos', name: 'Sala de Trofeos', label: 'Sala de Trofeos', floor: 3, pos: at(720, 800),
    flee: [{ to: 'rellano', faces: f(1, 2) }, { to: 'estudio', faces: f(3, 4, 5) }, { to: 'lavabo-izq', faces: f(6) }] },
  { id: 'estudio', label: 'Estudio', floor: 3, pos: at(980, 800),
    flee: [{ to: 'rellano', faces: f(1) }, { to: 'trofeos', faces: f(2) }, { to: 'pasillo-escalera', faces: f(3, 4, 5, 6) }] },
  { id: 'pasillo-escalera', label: 'Pasillo de la escalera', floor: 3, pos: at(1220, 800),
    flee: [{ to: 'estudio', faces: f(1, 2) }, { to: 'despacho', faces: f(3, 4) }, { to: 'dormitorio', faces: f(5, 6) }] },
  { id: 'despacho', label: 'Despacho', window: true, floor: 3, pos: at(1400, 790),
    flee: [{ to: 'pasillo-escalera', faces: f(1, 2, 3, 4) }, { to: 'ext-der', faces: f(5, 6) }] },
  // 2.ª planta
  { id: 'dormitorio-largo', label: 'Dormitorio de las camas', floor: 2, pos: at(460, 1020),
    flee: [{ to: 'rellano', faces: f(3, 4, 5, 6) }] },
  { id: 'rellano', label: 'Rellano de la escalera principal', floor: 2, pos: at(900, 1030),
    flee: [{ to: 'trofeos', faces: f(1, 2) }, { to: 'estudio', faces: f(3) }, { to: 'sala', faces: f(4) }, { to: 'dormitorio-largo', faces: f(5) }, { to: 'vestibulo', faces: f(6) }] },
  { id: 'sala', label: 'Sala del ventanal', floor: 2, pos: at(1230, 1020),
    flee: [{ to: 'rellano', faces: f(1, 2, 3) }, { to: 'lavabo-der', faces: f(4, 5, 6) }] },
  { id: 'lavabo-der', label: 'Lavabo de la derecha', window: true, floor: 2, pos: at(1400, 1010),
    flee: [{ to: 'sala', faces: f(1, 2, 3, 4) }, { to: 'ext-der', faces: f(5, 6) }] },
  // Planta baja
  { id: 'garaje', name: 'Garaje', label: 'Garaje', search: true, floor: 1, pos: at(370, 1230),
    flee: [{ to: 'cuarto-cortinas', faces: f(3, 4, 5, 6) }] },
  { id: 'cuarto-cortinas', label: 'Cuarto de las cortinas', floor: 1, pos: at(590, 1220),
    flee: [{ to: 'vestibulo', faces: f(1, 2) }, { to: 'garaje', faces: f(4, 5, 6) }] },
  { id: 'vestibulo', name: 'Vestíbulo', label: 'Vestíbulo', floor: 1, pos: at(900, 1210),
    flee: [{ to: 'rellano', faces: f(1, 2) }, { to: 'cuarto-cortinas', faces: f(3) }, { to: 'salon-baile', faces: f(4) }, { to: 'ext-centro', faces: f(5, 6) }] },
  { id: 'salon-baile', name: 'Salón de Baile', label: 'Salón de Baile', floor: 1, pos: at(1290, 1220),
    flee: [{ to: 'vestibulo', faces: f(3, 4, 5, 6) }] },
  // Fuera (las tres son zonas de Salida)
  { id: 'ext-izq', label: 'Exterior izquierdo (Escalera)', exit: true, outside: true, floor: 0, pos: at(120, 1410),
    flee: [{ to: 'lavabo-izq', faces: f(1, 2) }, { to: 'ext-centro', faces: f(3, 4, 5, 6) }] },
  { id: 'ext-centro', label: 'Entrada principal', exit: true, outside: true, floor: 0, pos: at(900, 1430),
    flee: [{ to: 'ext-izq', faces: f(1, 2) }, { to: 'ext-der', faces: f(3, 4) }, { to: 'vestibulo', faces: f(5, 6) }] },
  { id: 'ext-der', label: 'Exterior derecho (Columpio)', exit: true, outside: true, floor: 0, pos: at(1640, 1410),
    flee: [{ to: 'ext-centro', faces: f(3, 4, 5, 6) }] },
  // Solo existe con el Evento «Rescate en helicóptero».
  { id: 'helicoptero', name: 'Helicóptero', label: 'Helicóptero', hidden: true, floor: 6, pos: at(1000, 335), flee: [] },
];

const item = (it: Omit<ItemCard, 'image'> & { file: string }): ItemCard => {
  const { file, ...rest } = it;
  return { ...rest, image: `${base}/items/${file}.webp` };
};

export const CREECH_MANOR: Location = {
  id: 'creech-manor',
  name: 'Creech Manor',
  film: 'creech',
  icon: 'house',
  board: `${base}/board.webp`,
  cover: `${base}/cover.webp`,
  select: `${base}/select.webp`,
  boardSize: { w: 2400, h: 2119 },
  zones: ZONES,
  itemDecks: ['garaje', 'atico', 'vestidor'],
  // Las flechas (un solo sentido): Cuarto de la tele ▶ Lavabo izquierdo, Despacho ▶ Exterior derecho, Lavabo derecho ▶ Exterior derecho.
  oneWay: [
    { from: 'cuarto-tele', to: 'lavabo-izq', at: 'lavabo-izq' },
    { from: 'despacho', to: 'ext-der', at: 'despacho' },
    { from: 'lavabo-der', to: 'ext-der', at: 'lavabo-der' },
  ],
  ladder: ['ext-izq', 'lavabo-izq'],
  setupBack: `${base}/setup/back.webp`,
  setups: [
    {
      id: 'extranos-trofeos', name: 'Extraños trofeos', image: `${base}/setup/extranos-trofeos.webp`,
      finalGirl: 'trofeos', killer: 'vestibulo',
      victims: { atico: 2, 'cuarto-tele': 1, 'cuarto-escalera': 1, dormitorio: 1, vestidor: 1, despacho: 1, rellano: 2, 'lavabo-der': 1 },
    },
    {
      id: 'la-escalera', name: 'La escalera', image: `${base}/setup/la-escalera.webp`,
      finalGirl: 'lavabo-izq', killer: 'salon-baile',
      victims: { atico: 2, 'cuarto-tele': 1, vestidor: 1, trofeos: 2, despacho: 1, rellano: 1, 'lavabo-der': 1, 'cuarto-cortinas': 1 },
    },
    {
      id: 'dancing-queen', name: 'Dancing Queen', image: `${base}/setup/dancing-queen.webp`,
      finalGirl: 'salon-baile', killer: 'garaje',
      victims: { atico: 2, 'lavabo-izq': 1, 'pasillo-escalera': 1, despacho: 1, rellano: 1, 'lavabo-der': 1, vestibulo: 1, 'salon-baile': 2 },
    },
    {
      id: 'la-zona-muerta', name: 'La zona muerta', image: `${base}/setup/la-zona-muerta.webp`,
      finalGirl: 'atico', killer: 'lavabo-izq',
      victims: { 'cuarto-escalera': 2, vestidor: 2, despacho: 1, 'dormitorio-largo': 1, rellano: 1, 'cuarto-cortinas': 1, 'salon-baile': 2 },
    },
    {
      id: 'creepshow', name: 'Creepshow', image: `${base}/setup/creepshow.webp`,
      finalGirl: 'ext-centro', killer: 'vestidor',
      victims: { atico: 3, 'cuarto-tele': 1, 'cuarto-escalera': 1, despacho: 1, 'lavabo-der': 1, garaje: 1, 'salon-baile': 2 },
    },
  ],
  eventBack: `${base}/events/back.webp`,
  events: [
    {
      id: 'rescate-en-helicoptero', name: 'Rescate en helicóptero', image: `${base}/events/rescate-en-helicoptero.webp`,
      flavor: '«¡¡Estamos salvados!!»',
      text: 'Pon la ficha del Helicóptero en el tejado de la casa. Una vez durante la partida puedes moverte del Ático al Helicóptero, ya que están adyacentes. Cualquier Víctima (o Carolyn) que esté contigo puede ser salvada. A menos que hayas salvado a Carolyn, debes volver al Ático y quitar la ficha. El Helicóptero no se considera una zona de Salida. Descarta esta carta cuando la ficha del Helicóptero ya no juegue.',
      token: 'helicoptero', onReveal: [], persistent: true, custom: 'ev-helicopter',
    },
    {
      id: 'nadie-vuelve', name: 'Nadie vuelve', image: `${base}/events/nadie-vuelve.webp`,
      flavor: '«Lo que sube, no baja»',
      text: 'Pon la ficha de la Calavera en el Ático. Todas las Víctimas que estén en el Ático mueren. Cada vez que una Víctima entre en el Ático muere inmediatamente.',
      token: 'calavera', onReveal: [], persistent: true, custom: 'ev-nobody-returns',
    },
    {
      id: 'cazadores-de-fantasmas', name: 'Cazadores de fantasmas', image: `${base}/events/cazadores-de-fantasmas.webp`,
      flavor: '«¡Los niveles de EMF están desbordados… ¡Bingo!»',
      text: 'Cambia las 3 Víctimas más cercanas a ti (o todas las posibles) por Víctimas Especiales. Estas Víctimas no te seguirán hasta que una de ellas muera. Cada vez que una de estas Víctimas muera, +1 Sed de Sangre. Descarta esta carta cuando la última Víctima Especial ya no juegue.',
      onReveal: [], persistent: true, custom: 'ev-ghost-hunters',
    },
    {
      id: 'congelado-por-el-miedo', name: 'Congelado por el miedo', image: `${base}/events/congelado-por-el-miedo.webp`,
      flavor: '«Lo único que podía mover eran mis globos oculares. ¡Era terrorífico!»',
      text: 'Las Víctimas ya no sufren pánico durante la fase de Huida.',
      onReveal: [], persistent: true, custom: 'ev-frozen-fear',
    },
    {
      id: 'no-tengo-miedo-de-ningun-fantasma', name: 'No tengo miedo de ningún fantasma', image: `${base}/events/no-tengo-miedo-de-ningun-fantasma.webp`,
      flavor: '«Viene de ahí arriba. ¡Vamos a comprobarlo!»',
      text: 'Mueve cada Víctima un espacio hacia el Ático. Descarta esta carta.',
      onReveal: [custom('cm-toward-attic')], persistent: false,
    },
    {
      id: 'empujados-hasta-el-borde', name: 'Empujados hasta el borde', image: `${base}/events/empujados-hasta-el-borde.webp`,
      flavor: '«Me miraron sobriamente. Entonces, sin decir nada, caminaron hacia la ventana… y saltaron.»',
      text: 'Tira un dado por cada Víctima en un espacio con ventana. Si la tirada sale mal (1-4), esa Víctima salta y muere. Descarta esta carta.',
      onReveal: [custom('cm-pushed')], persistent: false,
    },
    {
      id: 'fuera-luces', name: 'Fuera luces', image: `${base}/events/fuera-luces.webp`,
      flavor: '«¿Quién apagó las luces? ¿Qué fue eso?»',
      text: 'Tira 1 dado menos (mínimo 1) cuando resuelvas una carta de Acción que permita movimiento. Ignora este efecto si tienes la Linterna o la Vela.',
      onReveal: [], persistent: true, custom: 'ev-lights-out',
    },
    {
      id: 'victimas-pegajosas', name: 'Víctimas pegajosas', image: `${base}/events/victimas-pegajosas.webp`,
      flavor: '«¡No me dejes!»',
      text: 'Debes tener al menos 1 Víctima siguiéndote, si es posible.',
      onReveal: [], persistent: true, custom: 'ev-clingy-victims',
    },
    {
      id: 'coraje-liquido', name: 'Coraje líquido', image: `${base}/events/coraje-liquido.webp`,
      flavor: '«¿De qué estabas hablando… que eso es un fantasma? Muesstrámelo.»',
      text: 'Las Víctimas te seguirán a la zona del Asesino.',
      onReveal: [], persistent: true, custom: 'ev-liquid-courage',
    },
    {
      id: 'la-curiosidad-mato-a-la-gente', name: 'La curiosidad mató a la gente', image: `${base}/events/la-curiosidad-mato-a-la-gente.webp`,
      flavor: '«¡Hemos oído que este sitio está embrujado!»',
      text: 'Pon 3 nuevas Víctimas en el Vestíbulo y ponlas en modo pánico inmediatamente. Descarta esta carta.',
      onReveal: [{ kind: 'placeVictims', count: 3, where: { zone: 'vestibulo' } }, custom('cm-panic-vestibule')], persistent: false,
    },
  ],
  horror: [
    {
      id: 'es-falso', name: '«¡Es falso!»', copies: 1,
      image: `${base}/horror/es-falso.webp`,
      text: 'Descarta un Objeto aleatoriamente. Si no tienes Objetos, descarta y roba la siguiente carta de Terror. Objetivo el más cercano ▶ mover ▶ atacar.',
      effects: [custom('cm-fake'), ka('nearest', 1, 1)],
    },
    {
      id: 'algo-viene-a-traves-de-la-pared', name: '«¡Algo viene a través de la pared!»', copies: 1,
      image: `${base}/horror/algo-viene-a-traves-de-la-pared.webp`,
      text: 'Si no hay Víctimas en el tablero, descarta y roba la siguiente carta de Terror. Si no: todas las Víctimas entran en pánico; cualquier Víctima que salte por una ventana muere. Roba un Evento.',
      requiresVictims: true,
      effects: [custom('cm-wall'), { kind: 'drawEvent' }],
    },
    {
      id: 'ventanas-y-puertas-cerradas', name: '«¡Las ventanas y las puertas se han cerrado de golpe!»', copies: 1,
      image: `${base}/horror/ventanas-y-puertas-cerradas.webp`,
      text: 'Si estás dentro, no puedes moverte durante la siguiente fase de Acción. Si estás fuera, no puedes entrar en la casa durante la siguiente fase de Acción. Roba un Evento.',
      effects: [custom('cm-doors'), { kind: 'drawEvent' }],
    },
    {
      id: 'esta-rota', name: '«¡Está rota!»', copies: 1,
      image: `${base}/horror/esta-rota.webp`,
      text: 'Pon la ficha de Escalera Rota cubriendo la escalera del tablero. La escalera ya no se puede usar y los espacios conectados a ella ya no se consideran adyacentes. +1 Terror.',
      effects: [custom('cm-broken-ladder'), { kind: 'terror', amount: 1 }],
    },
    {
      id: 'algo-impio-paso', name: '«Algo impío pasó en el…»', copies: 1,
      image: `${base}/horror/algo-impio-paso.webp`,
      text: 'Tira un dado y coloca al Asesino en esa habitación: 1-2 Ático, 3-4 Vestidor, 5-6 Salón de Baile. Objetivo el más cercano ▶ atacar. Después: objetivo el más cercano ▶ mover ▶ atacar.',
      effects: [custom('cm-unholy'), ka('nearest', 0, 1), ka('nearest', 1, 1)],
    },
    {
      id: 'voces-oigo-voces', name: '«¡Voces… oigo voces!»', copies: 1,
      image: `${base}/horror/voces-oigo-voces.webp`,
      text: 'Si no hay Víctimas en el tablero, descarta y roba la siguiente carta de Terror. Si no: todas las Víctimas suben al siguiente piso. +1 Terror. Objetivo la Víctima más cercana ▶ mover ▶ atacar.',
      requiresVictims: true,
      effects: [custom('cm-voices'), { kind: 'terror', amount: 1 }, ka('victim', 1, 1)],
    },
    {
      id: 'que-viene-que-viene', name: '«¡Que viene, que viene!»', copies: 1,
      image: `${base}/horror/que-viene-que-viene.webp`,
      text: 'Objetivo la Víctima más cercana ▶ mover ×3. Mata a una Víctima en cada espacio por el que pase el Asesino, incluidos su espacio inicial y final.',
      effects: [ka('victim', 3, 0, { killAlong: true })],
    },
    {
      id: 'los-arboles-estan-vivos', name: '«¡Los árboles están vivos!»', copies: 1,
      image: `${base}/horror/los-arboles-estan-vivos.webp`,
      text: 'Si estás en un espacio con ventana, pierdes 1 Vida. Las Víctimas en espacios con ventana mueren. Si al menos una Víctima muere, +1 Terror. Roba un Evento.',
      effects: [custom('cm-trees'), { kind: 'drawEvent' }],
    },
  ],
  items: [
    item({
      file: 'dado-de-la-suerte', id: 'dado-de-la-suerte', name: 'Dado de la suerte',
      flavor: '«Prefiero ser afortunada que buena.»',
      text: 'Descarta para volver a tirar alguno o todos tus dados.',
      hands: 0, custom: 'item-lucky-dice',
    }),
    item({
      file: 'candado', id: 'candado', name: 'Candado',
      flavor: '«¿Para guardar algo dentro… o fuera?»',
      text: 'Coloca la ficha del Candado entre dos habitaciones. Solo tú y las Víctimas que te acompañen podéis cruzar el Candado. Si un Enemigo te ataca en una habitación adyacente al Candado, ignora el ataque y quita la ficha en su lugar.',
      hands: 0, custom: 'item-padlock', token: 'candado',
    }),
    item({
      file: 'lista-de-cosas', id: 'lista-de-cosas', name: 'Una lista de cosas en el…',
      flavor: '«La pregunta es: ¿esto me ayudará?»',
      text: 'Al conseguirla, tira un dado inmediatamente: 1-2 Garaje, 3-4 Vestidor, 5-6 Ático. Revela todas las cartas de Objeto de ese mazo manteniendo el orden. Después, descarta esta carta.',
      hands: 0, custom: 'item-list',
    }),
    item({
      file: 'kit-de-primeros-auxilios', id: 'kit-de-primeros-auxilios', name: 'Kit de primeros auxilios',
      flavor: '«¡Tengo que ponerme estas vendas si quiero sobrevivir!»',
      text: 'Cada vez que uses una carta de Acción para recuperar Vida, recupera 1 más.',
      hands: 1, custom: 'item-first-aid',
    }),
    item({
      file: 'pata-de-conejo', id: 'pata-de-conejo', name: 'Pata de conejo de la suerte',
      flavor: '«¿Cómo funciona esto?»',
      text: 'Descártala durante la fase de Acción para hacer una Tirada de Terror. Por cada éxito elige una opción: +2 Tiempo, recupera 1 Vida, −1 Terror o muévete 1 zona.',
      hands: 0, custom: 'item-rabbit-foot',
    }),
    item({
      file: 'daga-ritual', id: 'daga-ritual', name: 'Daga ritual',
      flavor: '«Casi puedo sentir el mal.»',
      text: 'Arma: alcance 0, +1 de daño. Puedes descartarla para matar a una Víctima de tu zona (sube la Sed de Sangre como siempre). Si lo haces, retira todos los Poderes Oscuros Menores o haz 1 de daño al Asesino.',
      hands: 1, range: [0, 0], damage: 1, modifies: 'any', custom: 'item-ritual-dagger',
    }),
    item({
      file: 'texto-antiguo', id: 'texto-antiguo', name: 'Texto antigüo',
      flavor: '«¿Hay respuestas dentro?»',
      text: 'Una vez por fase de Acción puedes perder 1 Vida para ganar 2 Tiempo.',
      hands: 0, custom: 'item-ancient-text',
    }),
    item({
      file: 'linterna', id: 'linterna', name: 'Linterna',
      flavor: '«Espero que estas baterías duren…»',
      text: 'Una vez por fase de Acción, por 1 Tiempo, puedes mirar la carta superior del mazo de Terror. Déjala ahí o ponla debajo, al fondo del mazo.',
      hands: 0, custom: 'item-flashlight',
    }),
    item({
      file: 'mapa', id: 'mapa', name: 'Mapa',
      flavor: '«Parecen unas breves instrucciones para una compañía de transporte.»',
      text: 'Descártalo durante la fase de Acción y, por cada mazo de Objetos: si la carta superior está bocabajo, puedes ponerla bocarriba; si está bocarriba, puedes retirarla del juego y poner la siguiente bocarriba.',
      hands: 0, custom: 'item-map',
    }),
    item({
      file: 'escalera-de-cuerda', id: 'escalera-de-cuerda', name: 'Escalera de cuerda',
      flavor: '«Puede que sea mi única salida de aquí…»',
      text: 'Descarta esta carta para quitar la ficha de Escalera Rota, O para poner la ficha de Escalera de Cuerda en una habitación con una flecha de movimiento de un solo sentido: el movimiento es ahora de doble sentido desde y hacia ese espacio.',
      hands: 0, custom: 'item-rope-ladder', token: 'escalera-de-cuerda',
    }),
    item({
      file: 'vela', id: 'vela', name: 'Vela',
      flavor: '«Llámame Ebenezer Scrooge.»',
      text: 'Una vez por fase de Acción puedes mover una Víctima de un espacio adyacente a tu espacio.',
      hands: 0, custom: 'item-candle',
    }),
    item({
      file: 'cuchillo', id: 'cuchillo', name: 'Cuchillo',
      flavor: '«Puede ser útil… mientras sangra…»',
      text: 'Arma: alcance 0, +1 de daño.',
      hands: 1, range: [0, 0], damage: 1, modifies: 'any',
    }),
    item({
      file: 'pildoras-misteriosas', id: 'pildoras-misteriosas', name: 'Píldoras misteriosas',
      flavor: '«Pueden hacerme alucinar, pero ¿qué alucinación puede ser peor que esta?»',
      text: 'Descártalas durante la fase de Acción y elige: −1 Terror o recupera 2 Vida.',
      hands: 0, custom: 'item-mystery-pills',
    }),
    item({
      file: 'rifle', id: 'rifle', name: 'Rifle',
      flavor: '«¡Sí! Ahora ESTO es un arma.»',
      text: 'El Rifle no puede modificar una carta de Acción y se usa sin ella. Una vez por turno puedes descartar 2 cartas de tu mano y tirar 6 dados: haz 1 de daño a cada Enemigo de tu espacio por cada éxito. Si al menos la mitad de los dados salen en blanco, descarta el Rifle.',
      hands: 2, custom: 'item-rifle',
    }),
    item({
      file: 'crucifijo', id: 'crucifijo', name: 'Crucifijo',
      flavor: '«Padre Nuestro que estás en el cielo…»',
      text: 'Descártalo para ignorar una carta de Terror.',
      hands: 0, custom: 'item-crucifix',
    }),
    item({
      file: 'viejo-revolver', id: 'viejo-revolver', name: 'Viejo revólver',
      flavor: '«Casa vieja. Viejo revólver. Claro.»',
      text: 'Arma: alcance 1, +1 de daño. Solo puede modificar la carta de Acción Ataque débil.',
      hands: 1, range: [1, 1], damage: 1, modifies: ['ataque-debil'],
    }),
    item({
      file: 'tapadera', id: 'tapadera', name: 'Tapadera',
      flavor: '«Puede que me proteja, si no me mata antes el olor.»',
      text: 'Ignora 1 punto de daño de un ataque. 3 usos.',
      hands: 1, uses: 3, custom: 'item-trash-lid',
    }),
    item({
      file: 'bebida-energetica', id: 'bebida-energetica', name: 'Bebida energética',
      flavor: '«¿Energía fabricada? ¡Qué demonios!»',
      text: 'Descártala durante la fase de Acción y elige: +3 Tiempo o muévete 1 zona.',
      hands: 0, custom: 'item-energy-drink',
    }),
  ],
  tokens: {
    helicoptero: `${base}/tokens/helicoptero.webp`,
    calavera: `${base}/tokens/calavera.webp`,
    'escalera-rota': `${base}/tokens/escalera-rota.webp`,
    'escalera-de-cuerda': `${base}/tokens/escalera-de-cuerda.webp`,
    candado: `${base}/tokens/candado.webp`,
  },
  tokenInfo: {
    helicoptero: { text: 'Helicóptero: una vez puedes moverte del Ático al tejado; las Víctimas (o Carolyn) que estén contigo se salvan. Si no salvas a Carolyn, vuelves al Ático.' },
    calavera: { text: 'Calavera: toda Víctima que esté o entre en el Ático muere inmediatamente.' },
    'escalera-rota': { text: 'Escalera Rota: la escalera exterior ya no se puede usar y sus espacios dejan de ser adyacentes.' },
    'escalera-de-cuerda': { text: 'Escalera de Cuerda: la unión de un solo sentido de este espacio pasa a ser de doble sentido.' },
    candado: { text: 'Candado: solo tú y las Víctimas que te acompañen podéis cruzar esta unión. Si un Enemigo te ataca junto a él, se anula el ataque y se quita.' },
  },
  specialRules:
    'Movimiento en un sentido: tres uniones tienen una flecha y solo se cruzan en ese sentido (siguen siendo adyacentes). Espacios con ventana: 3. Exteriores: los 3 espacios verdes (todos son de Salida). La Escalera es la exterior que une el Exterior izquierdo con el Lavabo de la izquierda.',
};
