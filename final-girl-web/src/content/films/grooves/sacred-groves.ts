import type { DieFace, Effect, KillerAction, Location, Zone } from '../../types';

const base = 'assets/locations/sacred-groves';
// Las posiciones se midieron sobre el tablero a 2000×1775; la imagen final es 2400×2130.
const MAP_W = 2000;
const MAP_H = 1775;

const ka = (target: KillerAction['target'], moves: number, attacks: number): Effect => ({
  kind: 'killerAction',
  action: { target, moves, attacks },
});
const f = (...n: DieFace[]) => n;
const at = (x: number, y: number) => ({ x: (x / MAP_W) * 100, y: (y / MAP_H) * 100 });
const divineBySacred: Effect = { kind: 'wrath', which: 'divine', op: 'increase', by: 'sacredVictims' };
const unleash: Effect = { kind: 'unleash', which: 'divine' };
const terror = (amount: number): Effect => ({ kind: 'terror', amount });
const time = (amount: number): Effect => ({ kind: 'time', amount });
const discard = (count: number): Effect => ({ kind: 'discardRandomActions', count });

/**
 * Mapa de Sacred Groves: 19 zonas.
 * `flee` = números de huida impresos en cada extremo de las conexiones.
 * Espacios Sagrados: Cementerio, Santuario Sagrado y Árboles Sagrados.
 */
const ZONES: Zone[] = [
  { id: 'mirador', label: 'Cabaña del mirador', pos: at(560, 470),
    flee: [{ to: 'bosque-oeste', faces: f(1) }, { to: 'rocas', faces: f(2) }, { to: 'cementerio', faces: f(3, 4, 5, 6) }] },
  { id: 'bosque-oeste', label: 'Bosque del oeste', pos: at(230, 700),
    flee: [{ to: 'centro-bienvenida', faces: f(1) }, { to: 'mirador', faces: f(2) }, { to: 'cementerio', faces: f(3, 4, 5, 6) }] },
  { id: 'cementerio', name: 'Cementerio', label: 'Cementerio', sacred: true, pos: at(720, 780),
    flee: [{ to: 'bosque-oeste', faces: f(3) }, { to: 'mirador', faces: f(4) }, { to: 'rocas', faces: f(5) }, { to: 'pradera', faces: f(6) }] },
  { id: 'rocas', label: 'Las rocas', pos: at(1080, 560),
    flee: [{ to: 'salida-norte', faces: f(1) }, { to: 'mirador', faces: f(2) }, { to: 'orilla', faces: f(3) }, { to: 'pradera', faces: f(4) }, { to: 'cementerio', faces: f(5, 6) }] },
  { id: 'salida-norte', label: 'Salida del norte', exit: true, pos: at(1390, 440),
    flee: [{ to: 'rocas', faces: f(1, 2, 3) }, { to: 'orilla', faces: f(4, 5, 6) }] },
  { id: 'cobertizo-jardinero', name: 'Cobertizo del jardinero', label: 'Cobertizo del jardinero', search: true, pos: at(1780, 560),
    flee: [{ to: 'orilla', faces: f(3, 4, 5, 6) }] },
  { id: 'orilla', label: 'Orilla del lago', pos: at(1620, 700),
    flee: [{ to: 'cobertizo-jardinero', faces: f(1) }, { to: 'poblado', faces: f(2) }, { to: 'salida-norte', faces: f(3) }, { to: 'rocas', faces: f(4) }, { to: 'arboles-sagrados', faces: f(5, 6) }] },
  { id: 'poblado', label: 'Poblado', pos: at(1800, 960),
    flee: [{ to: 'orilla', faces: f(1) }, { to: 'bosque-este', faces: f(2) }, { to: 'arboles-sagrados', faces: f(3, 4, 5, 6) }] },
  { id: 'arboles-sagrados', name: 'Árboles Sagrados', label: 'Árboles Sagrados', sacred: true, pos: at(1530, 1200),
    flee: [{ to: 'orilla', faces: f(3) }, { to: 'poblado', faces: f(4) }, { to: 'bosque-este', faces: f(5) }, { to: 'puente', faces: f(6) }] },
  { id: 'bosque-este', label: 'Bosque del este', pos: at(1840, 1290),
    flee: [{ to: 'poblado', faces: f(1) }, { to: 'salida-sureste', faces: f(2) }, { to: 'puente', faces: f(3) }, { to: 'arboles-sagrados', faces: f(4, 5, 6) }] },
  { id: 'salida-sureste', label: 'Salida del sureste', exit: true, pos: at(1880, 1600),
    flee: [{ to: 'bosque-este', faces: f(1, 2, 3, 4, 5, 6) }] },
  { id: 'puente', label: 'El puente', pos: at(1480, 1560),
    flee: [{ to: 'objetos-perdidos', faces: f(1) }, { to: 'bosque-este', faces: f(2) }, { to: 'arboles-sagrados', faces: f(3, 4, 5, 6) }] },
  { id: 'objetos-perdidos', name: 'Objetos perdidos', label: 'Objetos perdidos', search: true, pos: at(1080, 1620),
    flee: [{ to: 'sendero-sur', faces: f(1) }, { to: 'puente', faces: f(2) }, { to: 'pradera', faces: f(3) }, { to: 'santuario', faces: f(4, 5, 6) }] },
  { id: 'pradera', label: 'La pradera', pos: at(1080, 1120),
    flee: [{ to: 'objetos-perdidos', faces: f(1) }, { to: 'rocas', faces: f(2) }, { to: 'santuario', faces: f(3, 4) }, { to: 'cementerio', faces: f(5, 6) }] },
  { id: 'santuario', name: 'Santuario Sagrado', label: 'Santuario Sagrado', sacred: true, pos: at(730, 1370),
    flee: [{ to: 'sendero-suroeste', faces: f(3) }, { to: 'objetos-perdidos', faces: f(4) }, { to: 'sendero-sur', faces: f(5) }, { to: 'pradera', faces: f(6) }] },
  { id: 'centro-bienvenida', name: 'Centro de bienvenida', label: 'Centro de bienvenida', search: true, pos: at(400, 1100),
    flee: [{ to: 'salida-oeste', faces: f(1) }, { to: 'bosque-oeste', faces: f(2, 3, 4) }, { to: 'sendero-suroeste', faces: f(5, 6) }] },
  { id: 'salida-oeste', label: 'Salida del oeste', exit: true, pos: at(120, 1180),
    flee: [{ to: 'centro-bienvenida', faces: f(1, 2, 3, 4, 5, 6) }] },
  { id: 'sendero-suroeste', label: 'Sendero del suroeste', pos: at(300, 1430),
    flee: [{ to: 'centro-bienvenida', faces: f(1) }, { to: 'sendero-sur', faces: f(2) }, { to: 'santuario', faces: f(3, 4, 5, 6) }] },
  { id: 'sendero-sur', label: 'Sendero del sur', pos: at(600, 1620),
    flee: [{ to: 'sendero-suroeste', faces: f(1) }, { to: 'objetos-perdidos', faces: f(2) }, { to: 'santuario', faces: f(3, 4, 5, 6) }] },
];

export const SACRED_GROVES: Location = {
  id: 'sacred-groves',
  name: 'Sacred Groves',
  film: 'grooves',
  icon: 'tombstone',
  board: `${base}/board.webp`,
  cover: `${base}/cover.webp`,
  select: `${base}/select.webp`,
  boardSize: { w: 2400, h: 2130 },
  zones: ZONES,
  itemDecks: ['centro-bienvenida', 'objetos-perdidos', 'cobertizo-jardinero'],
  setupBack: `${base}/setup/back.webp`,
  setups: [
    {
      id: 'dia-de-la-familia', name: 'Día de la familia', image: `${base}/setup/dia-de-la-familia.webp`,
      finalGirl: 'pradera', killer: 'sendero-suroeste',
      victims: { 'centro-bienvenida': 2, mirador: 2, santuario: 2, cementerio: 2, puente: 2, orilla: 2 },
    },
    {
      id: 'la-cosa-del-pantano', name: 'La cosa del pantano', image: `${base}/setup/la-cosa-del-pantano.webp`,
      finalGirl: 'pradera', killer: 'arboles-sagrados',
      victims: { 'sendero-suroeste': 1, mirador: 1, santuario: 1, cementerio: 1, 'objetos-perdidos': 2, rocas: 2, 'bosque-este': 1, poblado: 1, 'cobertizo-jardinero': 2 },
    },
    {
      id: 'guia-turistico-del-duelo', name: 'Guía turístico del duelo', image: `${base}/setup/guia-turistico-del-duelo.webp`,
      finalGirl: 'salida-sureste', killer: 'cobertizo-jardinero',
      victims: { santuario: 1, cementerio: 1, 'objetos-perdidos': 4, rocas: 4, puente: 1, orilla: 1 },
    },
    {
      id: 'montones-de-turistas', name: 'Montones de turistas', image: `${base}/setup/montones-de-turistas.webp`,
      finalGirl: 'salida-oeste', killer: 'salida-sureste',
      victims: { 'centro-bienvenida': 1, santuario: 1, cementerio: 1, 'objetos-perdidos': 1, pradera: 6, rocas: 1, orilla: 1 },
    },
    {
      id: 'servicio-de-culto', name: 'Servicio de culto', image: `${base}/setup/servicio-de-culto.webp`,
      finalGirl: 'sendero-suroeste', killer: 'pradera',
      victims: { 'bosque-oeste': 1, mirador: 1, puente: 2, 'arboles-sagrados': 2, orilla: 2, 'bosque-este': 2, poblado: 2 },
    },
  ],
  eventBack: `${base}/events/back.webp`,
  events: [
    {
      id: 'cerrado-por-mantenimiento', name: 'Cerrado por mantenimiento', image: `${base}/events/cerrado-por-mantenimiento.webp`,
      flavor: '«Menos mal que hay un espacio sagrado menos para que desfilen estos pringados.»',
      text: 'Cuando se revele, puedes descartar TODAS tus cartas de Acción excepto Expiar para cerrar un espacio Sagrado: coloca allí la ficha de Cerrado y mueve sus Víctimas a los espacios adyacentes (repartidas). Las Víctimas ya no pueden entrar allí por ninguna razón; tú y los Enemigos sí podéis entrar y salir.',
      token: 'cerrado', onReveal: [], persistent: true, custom: 'ev-closed',
    },
    {
      id: 'fuego-y-azufre', name: 'Fuego y azufre', image: `${base}/events/fuego-y-azufre.webp`,
      flavor: '«Aparentemente este sitio es mega sagrado, así que mejor trabajo extra duro para mantener a esta gentuza alejada.»',
      text: 'Tira un dado y coloca la ficha de Fuego y azufre en: 1-2 Cementerio, 3-4 Santuario Sagrado, 5-6 Árboles Sagrados. Cada Víctima de ese espacio cuenta como 2 Víctimas al calcular los Aumentos de la Ira Divina.',
      token: 'fuego-y-azufre', onReveal: [], persistent: true, custom: 'ev-fire-brimstone',
    },
    {
      id: 'suelo-sagrado', name: 'Suelo sagrado', image: `${base}/events/suelo-sagrado.webp`,
      flavor: '«No invierto demasiado en lo sobrenatural pero aún así siento que este lugar es diferente.»',
      text: 'Tira un dado y coloca la ficha de Suelo sagrado en: 1-2 Cementerio, 3-4 Santuario Sagrado, 5-6 Árboles Sagrados. Cada vez que terminas una fase de Acción en ese espacio, ganas 2 Tiempo.',
      token: 'suelo-sagrado', onReveal: [], persistent: true, custom: 'ev-sacred-ground',
    },
    {
      id: 'el-super-turista', name: 'El super turista', image: `${base}/events/el-super-turista.webp`,
      flavor: '«¡HULA! ¡MI NOMBRE ES FRANZ! ¡NO, NO ESTOY GRITANDO! ¡MI VOZ ES ASÍ!»',
      text: 'La Víctima más alejada del Asesino es ahora el Super Turista. Cada vez que el Asesino elija Objetivo, elige al Super Turista. Si el Super Turista es salvado, reduce la Ira Divina o la Asesina en 4. Si muere, aumenta la Ira Divina en 4. Si el Super Turista deja de jugar, descarta esta carta.',
      specialVictim: 'white', onReveal: [], persistent: true, custom: 'ev-super-tourist',
    },
    {
      id: 'el-hombre-sagrado', name: 'El hombre sagrado', image: `${base}/events/el-hombre-sagrado.webp`,
      flavor: '«¿Qué tipo de peregrino demente es este tipo?»',
      text: 'La Víctima más alejada del Asesino es ahora el Hombre Sagrado. No te sigue. En cada fase de Mantenimiento se mueve un espacio hacia el Asesino. Cuando esté en el mismo espacio que el Asesino, quítalo del tablero: si estabas en su espacio, reduce la Ira Asesina o la Divina a 4; si no, aumenta la Ira Asesina y la Divina 10 en total (tú eliges). Si el Hombre Sagrado deja de jugar, descarta esta carta.',
      specialVictim: 'blue', onReveal: [], persistent: true, custom: 'ev-holy-man',
    },
    {
      id: 'el-guia-turistico', name: 'El guía turístico', image: `${base}/events/el-guia-turistico.webp`,
      flavor: '«Y si miran a su derecha verán… Oh cielos… eso es terrorífico. ¿Quizá deberíamos tomar una ruta distinta?»',
      text: 'La Víctima más cercana a ti es el Guía Turístico. Mientras esté contigo, una vez por turno, cuando te muevas al menos 1 espacio, puedes moverte otro adicional. Si el Guía Turístico muere, aumenta la Ira Divina en 6. Si deja de jugar, descarta esta carta.',
      specialVictim: 'green', onReveal: [], persistent: true, custom: 'ev-tour-guide',
    },
    {
      id: 'ruidosos-y-odiosos', name: 'Ruidosos y odiosos', image: `${base}/events/ruidosos-y-odiosos.webp`,
      flavor: '«Estos turistas son tan molestos que me dan ganas de matarlos a mí misma.»',
      text: 'Cada vez que la Ira Divina aumente, auméntala 1 más.',
      onReveal: [], persistent: true, custom: 'ev-loud-obnoxious',
    },
    {
      id: 'los-dioses-odian-los-fallos', name: 'Los dioses odian los fallos', image: `${base}/events/los-dioses-odian-los-fallos.webp`,
      flavor: '«Igual podríamos añadir a los dioses a la lista de la gente que piensa que soy un desastre.»',
      text: 'Cada vez que falles del todo una Tirada de Terror (después de modificaciones), aumenta la Ira Divina en 1.',
      onReveal: [], persistent: true, custom: 'ev-gods-hate-failure',
    },
    {
      id: 'matanza-impia', name: 'Matanza impía', image: `${base}/events/matanza-impia.webp`,
      flavor: '«Supongo que los dioses no se tomen a bien la sangría de estos turistas sobre sus altares sagrados.»',
      text: 'Cada vez que una Víctima es asesinada en un espacio Sagrado, Desata la Ira Divina.',
      onReveal: [], persistent: true, custom: 'ev-unholy-slaughter',
    },
    {
      id: 'fotografia-con-flash', name: 'Fotografía con flash', image: `${base}/events/fotografia-con-flash.webp`,
      flavor: '«¡Apunta con esa cámara a otra parte, aprendiz de paparazzi!»',
      text: 'Cada vez que al menos 1 Víctima de tu espacio huya, descarta al azar 1 carta de Acción de tu mano.',
      onReveal: [], persistent: true, custom: 'ev-flash-photo',
    },
  ],
  horror: [
    {
      id: 'la-ira-de-los-dioses', name: 'La ira de los dioses', copies: 1,
      image: `${base}/horror/la-ira-de-los-dioses.webp`,
      text: 'Roba un Evento ▶ aumenta la Ira Divina tanto como Víctimas haya en espacios Sagrados ▶ coloca al Asesino en el espacio Sagrado con más Víctimas (o en tu espacio si no quedan) ▶ objetivo el más cercano ▶ atacar ▶ atacar.',
      effects: [{ kind: 'drawEvent' }, divineBySacred, { kind: 'custom', id: 'killer-to-busiest-sacred' }, ka('nearest', 0, 2)],
    },
    {
      id: 'la-furia-de-los-dioses', name: 'La furia de los dioses', copies: 1,
      image: `${base}/horror/la-furia-de-los-dioses.webp`,
      text: 'Roba un Evento ▶ aumenta la Ira Divina tanto como Víctimas haya en espacios Sagrados ▶ Desata la Ira Divina ▶ vuelve a aumentarla tanto como Víctimas haya en espacios Sagrados.',
      effects: [{ kind: 'drawEvent' }, divineBySacred, unleash, divineBySacred],
    },
    {
      id: 'dejame-grabar-mis-iniciales', name: '«Déjame grabar mis iniciales justo aquí…»', copies: 1,
      image: `${base}/horror/dejame-grabar-mis-iniciales.webp`,
      text: 'Aumenta la Ira Divina tanto como Víctimas haya en espacios Sagrados ▶ Desata la Ira Divina ▶ coloca 2 nuevas Víctimas en el Santuario Sagrado ▶ todas las Víctimas adyacentes al Santuario Sagrado se mueven allí.',
      effects: [divineBySacred, unleash, { kind: 'placeVictims', count: 2, where: { zone: 'santuario' } }, { kind: 'custom', id: 'gather:santuario' }],
    },
    {
      id: 'nadie-se-dara-cuenta', name: '«Nadie se dará cuenta si rompo una de estas preciosas ramas»', copies: 1,
      image: `${base}/horror/nadie-se-dara-cuenta.webp`,
      text: 'Aumenta la Ira Divina tanto como Víctimas haya en espacios Sagrados ▶ Desata la Ira Divina ▶ coloca 2 nuevas Víctimas en los Árboles Sagrados ▶ todas las Víctimas adyacentes a los Árboles Sagrados se mueven allí.',
      effects: [divineBySacred, unleash, { kind: 'placeVictims', count: 2, where: { zone: 'arboles-sagrados' } }, { kind: 'custom', id: 'gather:arboles-sagrados' }],
    },
    {
      id: 'trampa-de-turistas', name: 'Trampa de turistas', copies: 1,
      image: `${base}/horror/trampa-de-turistas.webp`,
      text: 'Todas las Víctimas adyacentes a un espacio Sagrado se mueven allí ▶ aumenta la Ira Divina tanto como Víctimas haya en espacios Sagrados ▶ objetivo el más cercano ▶ mover ▶ atacar.',
      effects: [{ kind: 'custom', id: 'gather:sacred' }, divineBySacred, ka('nearest', 1, 1)],
    },
    {
      id: 'si-me-subo-a-esa-estatua', name: '«Si me subo a lo alto de esa estatua puedo hacerme un selfie que te mueres»', copies: 1,
      image: `${base}/horror/si-me-subo-a-esa-estatua.webp`,
      text: 'Aumenta la Ira Divina tanto como Víctimas haya en espacios Sagrados ▶ Desata la Ira Divina ▶ coloca 2 nuevas Víctimas en el Cementerio ▶ todas las Víctimas adyacentes al Cementerio se mueven allí.',
      effects: [divineBySacred, unleash, { kind: 'placeVictims', count: 2, where: { zone: 'cementerio' } }, { kind: 'custom', id: 'gather:cementerio' }],
    },
    {
      id: 'castigo-divino', name: 'Castigo divino', copies: 1,
      image: `${base}/horror/castigo-divino.webp`,
      text: 'Desata la Ira Divina ▶ Desátala otra vez ▶ objetivo el más cercano ▶ mover ▶ atacar ▶ roba un Evento.',
      effects: [unleash, unleash, ka('nearest', 1, 1), { kind: 'drawEvent' }],
    },
    {
      id: 'la-volubilidad-de-los-dioses', name: 'La volubilidad de los dioses', copies: 1,
      image: `${base}/horror/la-volubilidad-de-los-dioses.webp`,
      text: 'Queda en juego junto a la Ira Divina. Al final de cada fase de Mantenimiento, haz una Tirada de Terror. 2+ éxitos: reduce la Ira Divina o la Asesina en 1. 1 éxito: sin efecto. Sin éxitos: Desata la Ira Divina y auméntala tanto como Víctimas haya en espacios Sagrados. Puedes gastar 3 Tiempo durante la fase de Acción para descartar esta carta.',
      effects: [],
      stays: 'hz-fickle-gods',
    },
  ],
  items: [
    {
      id: 'tapadera', name: 'Tapadera', image: `${base}/items/tapadera.webp`,
      flavor: '«Discúlpame mientras ¡SACO LA BASURA! Je je, ¿lo pillas?»',
      text: 'Ignora 1 punto de daño de un ataque. 3 usos.',
      hands: 1, uses: 3, custom: 'item-trash-lid',
    },
    {
      id: 'daga-ceremonial', name: 'Daga ceremonial', image: `${base}/items/daga-ceremonial.webp`,
      flavor: '«A los dioses siempre les gustó un poco de sangría, así que no sería bueno decepcionarles.»',
      text: 'Arma: alcance 0, +1 de daño. Cada vez que haces daño al Asesino, elige la Ira Asesina o la Divina y redúcela en 1.',
      hands: 1, range: [0, 0], damage: 1, modifies: 'any', custom: 'item-ceremonial-dagger',
    },
    {
      id: 'pildoras-misteriosas', name: 'Píldoras misteriosas', image: `${base}/items/pildoras-misteriosas.webp`,
      flavor: '«Por favor, que no sean un laxante.»',
      text: 'Descártalas durante la fase de Acción y elige: −1 Terror o recupera 2 Vida.',
      hands: 0, custom: 'item-mystery-pills',
    },
    {
      id: 'huesos-del-shaman', name: 'Huesos del shamán', image: `${base}/items/huesos-del-shaman.webp`,
      flavor: '«Nada como los huesos de un tipo sagrado cuando necesitas asomarte al futuro.»',
      text: 'Mira la siguiente carta de Horror y colócala encima o debajo del todo del mazo de Horror. 3 usos.',
      hands: 1, uses: 3, custom: 'item-shaman-bones',
    },
    {
      id: 'mascara-tribal', name: 'Máscara tribal', image: `${base}/items/mascara-tribal.webp`,
      flavor: '«¿Por qué solo van a divertirse con las máscaras los maníacos?»',
      text: 'Cada vez que recibes daño, elige la Ira Asesina o la Divina y redúcela tanto como el daño recibido.',
      hands: 0, custom: 'item-tribal-mask',
    },
    {
      id: 'bebida-energetica', name: 'Bebida energética', image: `${base}/items/bebida-energetica.webp`,
      flavor: '«Zoom zoom, baby, ¡mira cómo voy!»',
      text: 'Descártala durante la fase de Acción y elige: +3 Tiempo o muévete 1 zona.',
      hands: 0, custom: 'item-energy-drink',
    },
    {
      id: 'viejo-rifle', name: 'Viejo rifle', image: `${base}/items/viejo-rifle.webp`,
      flavor: '«Este cacharro no se ha limpiado en una década, pero ¡rayos, aún puede disparar!»',
      text: 'Arma: alcance 1-2, sin daño adicional. Solo puede modificar la carta de Acción Ataque débil. Si estás en un espacio Sagrado, +2 al alcance máximo.',
      hands: 2, range: [1, 2], damage: 0, modifies: ['ataque-debil'], custom: 'item-old-rifle',
    },
    {
      id: 'palo-de-guerra', name: 'Palo de guerra', image: `${base}/items/palo-de-guerra.webp`,
      flavor: '«Este palo es solo de exposición, pero es hora de ponerlo a funcionar.»',
      text: 'Arma: alcance 0, +1 de daño. Cada vez que haces daño con el Palo de guerra, elige la Ira Asesina o la Divina y redúcela tanto como el daño infligido.',
      hands: 2, range: [0, 0], damage: 1, modifies: 'any', custom: 'item-war-club',
    },
    {
      id: 'kit-de-primeros-auxilios', name: 'Kit de primeros auxilios', image: `${base}/items/kit-de-primeros-auxilios.webp`,
      flavor: '«Tengo que parar la hemorragia antes de perder la consciencia.»',
      text: 'Cada vez que uses una carta de Acción para recuperar Vida, recupera 1 más.',
      hands: 1, custom: 'item-first-aid',
    },
    {
      id: 'senales-fuera-de-servicio', name: 'Señales de fuera de servicio', image: `${base}/items/senales-fuera-de-servicio.webp`,
      flavor: '«Un poco de confusión vendrá bien.»',
      text: 'Por 1 Tiempo, coloca o retira una ficha de Fuera de servicio en la unión entre tu espacio y uno adyacente (2 fichas). Las Víctimas no pasarán por ella, a menos que te estén siguiendo.',
      hands: 0, token: 'fuera-de-servicio', custom: 'item-out-of-order',
    },
    {
      id: 'bocina', name: 'Bocina', image: `${base}/items/bocina.webp`,
      flavor: '«La herramienta perfecta para pastorear a estos cabeza-huecas de turistas.»',
      text: 'Por 1 Tiempo, todas las Víctimas de tu espacio y de los adyacentes huyen.',
      hands: 0, custom: 'item-air-horn',
    },
    {
      id: 'incienso', name: 'Incienso', image: `${base}/items/incienso.webp`,
      flavor: '«Parece ser que a los dioses les gusta el humo que huele bien. Oye, lo que sea, ¡funciona!»',
      text: 'Cada vez que la Ira Asesina o la Divina aumente, auméntala 1 menos (aumento mínimo de 1).',
      hands: 0, custom: 'item-incense',
    },
    {
      id: 'spray-pimienta', name: 'Spray de pimienta', image: `${base}/items/spray-pimienta.webp`,
      flavor: '«Se supone que esto puede dejar clavado a un oso, así que seguro que funciona a marchas forzadas en este show de locos.»',
      text: 'Si el Asesino está en tu zona, puedes descartarlo para terminar inmediatamente la fase del Asesino. Ignora su movimiento restante, sus ataques y cualquier otro efecto.',
      hands: 1, custom: 'item-pepper-spray',
    },
    {
      id: 'bate-metalico', name: 'Bate metálico', image: `${base}/items/bate-metalico.webp`,
      flavor: '«Creo que voy a llamarte Mr. Aplastacabezas.»',
      text: 'Arma: alcance 0, +1 de daño. Siempre que hagas daño al Asesino con el Bate metálico, puedes descartar inmediatamente un Poder Oscuro Menor, incluidas las fichas de Vida que le queden.',
      hands: 2, range: [0, 0], damage: 1, modifies: 'any', custom: 'item-metal-bat',
    },
    {
      id: 'mapa', name: 'Mapa', image: `${base}/items/mapa.webp`,
      flavor: '«Nada como un buen mapa para llevarte del punto A al punto B.»',
      text: 'Descártalo durante la fase de Acción y, por cada mazo de Objetos: si la carta superior está bocabajo, revélala; si está bocarriba, puedes descartarla y revelar la siguiente.',
      hands: 0, custom: 'item-map',
    },
    {
      id: 'libro-de-oracion', name: 'Libro de oración', image: `${base}/items/libro-de-oracion.webp`,
      flavor: '«Puede que este viejo y polvoriento libro por fin reciba alguna atención de ahí arriba.»',
      text: 'Cuando juegues Expiar, añade 1 éxito a tu tirada. 2 usos.',
      hands: 0, uses: 2, custom: 'item-prayer-book',
    },
    {
      id: 'latigo', name: 'Látigo', image: `${base}/items/latigo.webp`,
      flavor: '«Llámame Indiana.»',
      text: 'Arma: alcance 0, +1 de daño. Si dañas a un Enemigo con el Látigo, puedes moverlo 1 espacio.',
      hands: 1, range: [0, 0], damage: 1, modifies: 'any', custom: 'item-whip',
    },
  ],
  tokens: {
    cerrado: `${base}/tokens/cerrado.webp`,
    'fuego-y-azufre': `${base}/tokens/fuego-y-azufre.webp`,
    'suelo-sagrado': `${base}/tokens/suelo-sagrado.webp`,
    'fuera-de-servicio': `${base}/tokens/fuera-de-servicio.webp`,
  },
  wrath: {
    id: 'divine',
    name: 'Ira Divina',
    image: `${base}/wrath/ira-divina.webp`,
    back: `${base}/wrath/back.webp`,
    start: 2,
    levels: [
      { effects: [time(-1), { kind: 'wrath', which: 'divine', op: 'increase', amount: 1 }], text: '−1 Tiempo ▶ aumenta la Ira Divina en 1.' },
      { effects: [time(-2)], text: '−2 Tiempo.' },
      { effects: [terror(1)], text: '+1 Terror.' },
      { effects: [discard(1)], text: 'Descarta al azar 1 carta de Acción de tu mano.' },
      { effects: [time(-4)], text: '−4 Tiempo.' },
      { effects: [terror(2)], text: '+2 Terror.' },
      { effects: [discard(1), terror(1), time(-2)], text: 'Descarta al azar 1 carta de Acción ▶ +1 Terror ▶ −2 Tiempo.' },
      { effects: [discard(2), time(-5)], text: 'Descarta al azar 2 cartas de Acción ▶ −5 Tiempo.' },
      { effects: [terror(2), time(-4)], text: '+2 Terror ▶ −4 Tiempo.' },
      { effects: [{ kind: 'custom', id: 'divine-purge' }], text: 'Descarta TODAS las cartas de Acción de tu mano excepto Expiar y reduce la Ira Divina tanto como cartas descartes.' },
    ],
  },
  // Track de Sed de Sangre de Sacred Groves: la fila inferior corresponde a la 1.ª subida (decisión del usuario).
  bloodlustTrack: {
    image: `${base}/bloodlust-track.webp`,
    rows: [
      { effects: [divineBySacred], text: 'Aumenta la Ira Divina tanto como Víctimas haya en espacios Sagrados.' },
      { effects: [], text: '' },
      { effects: [unleash], text: 'Desata la Ira Divina.' },
      { effects: [divineBySacred], text: 'Aumenta la Ira Divina tanto como Víctimas haya en espacios Sagrados.' },
      { effects: [], text: '' },
      { effects: [unleash], text: 'Desata la Ira Divina.' },
      { effects: [divineBySacred, unleash], text: 'Aumenta la Ira Divina tanto como Víctimas haya en espacios Sagrados y Desátala.' },
    ],
  },
  finaleToken: {
    image: `${base}/finale-token.webp`,
    effects: [unleash, { kind: 'wrath', which: 'divine', op: 'increase', amount: 1 }],
    text: 'Gran Final: tras la Acción del Asesino, Desata la Ira Divina y auméntala en 1.',
  },
  specialRules:
    'Ira Divina: empieza en 2 (de 1 a 10). Al Desatarla se aplican los efectos de su nivel actual. Al subir la Sed de Sangre se aplica también la línea del track de Sacred Groves. Espacios Sagrados: Cementerio, Santuario Sagrado y Árboles Sagrados.',
};
