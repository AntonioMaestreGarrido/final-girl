import type { ActionCard } from '../types';

const img = (id: string) => `assets/core/actions/${id}.webp`;

export const ACTION_BACK = img('back');

/**
 * Cartas de Acción de la Caja Básica (23 en total).
 * Costes y efectos según las cartas impresas (versión corregida v1.2).
 * Copias: la mano inicial viene del reglamento (pág. 18); el resto es una
 * reconstrucción acordada con el usuario porque no hay fuente oficial.
 */
export const ACTION_CARDS: ActionCard[] = [
  // ---------------------------------------------- Coste cero (mano inicial)
  {
    id: 'caminar',
    name: 'Caminar',
    cost: 0,
    copies: 2,
    timing: 'action',
    image: img('caminar'),
    flavor: '«Un pie tras otro. Sin prisa pero sin pausa. Un asesino despiadado me persigue, pero esa no es razón para perder los nervios… ¿verdad?»',
    text: '2 éxitos: muévete hasta 2 zonas, −1 Tiempo. 1 éxito: muévete hasta 1 zona, −1 Tiempo. Fracaso: muévete hasta 1 zona, pierde 1 Vida, −2 Tiempo; o bien −2 Tiempo.',
    results: {
      double: [[{ kind: 'move', upTo: 2 }, { kind: 'time', amount: -1 }]],
      single: [[{ kind: 'move', upTo: 1 }, { kind: 'time', amount: -1 }]],
      fail: [
        [{ kind: 'move', upTo: 1 }, { kind: 'loseHealth', amount: 1 }, { kind: 'time', amount: -2 }],
        [{ kind: 'time', amount: -2 }],
      ],
    },
  },
  {
    id: 'concentrarse',
    name: 'Concentrarse',
    cost: 0,
    copies: 2,
    timing: 'action',
    image: img('concentrarse'),
    flavor: '«Venga, ¡piensa! Sé lo que tengo que hacer. Es aterrador, pero tengo que superar el miedo y concentrarme en el próximo paso.»',
    text: '2 éxitos: −1 Terror, +2 Tiempo. 1 éxito: −1 Terror, −1 Tiempo. Fracaso: −2 Tiempo.',
    results: {
      double: [[{ kind: 'terror', amount: -1 }, { kind: 'time', amount: 2 }]],
      single: [[{ kind: 'terror', amount: -1 }, { kind: 'time', amount: -1 }]],
      fail: [[{ kind: 'time', amount: -2 }]],
    },
  },
  {
    id: 'ataque-debil',
    name: 'Ataque débil',
    cost: 0,
    copies: 1,
    timing: 'action',
    image: img('ataque-debil'),
    flavor: '«Esto no va a funcionar… esto no va a funcionar…»',
    text: '2 éxitos: 1 de daño. 1 éxito: 1 de daño, pierde 1 Vida. Fracaso: pierde 1 Vida y termina la fase de Acción.',
    results: {
      double: [[{ kind: 'damage', amount: 1 }]],
      single: [[{ kind: 'damage', amount: 1 }, { kind: 'loseHealth', amount: 1 }]],
      fail: [[{ kind: 'loseHealth', amount: 1 }, { kind: 'endActionPhase' }]],
    },
  },
  {
    id: 'descanso-corto',
    name: 'Descanso corto',
    cost: 0,
    copies: 1,
    timing: 'action',
    image: img('descanso-corto'),
    flavor: '«Estoy sin aliento… y las heridas me duelen. Necesito un descanso aunque sea… ¿Qué estoy diciendo? Vale, ¡ya es suficiente!»',
    text: '2 éxitos: recupera 2 Vida. 1 éxito: recupera 1 Vida, −1 Tiempo. Fracaso: recupera 1 Vida, +1 Terror, −1 Tiempo y termina la fase de Acción.',
    results: {
      double: [[{ kind: 'heal', amount: 2 }]],
      single: [[{ kind: 'heal', amount: 1 }, { kind: 'time', amount: -1 }]],
      fail: [[{ kind: 'heal', amount: 1 }, { kind: 'terror', amount: 1 }, { kind: 'time', amount: -1 }, { kind: 'endActionPhase' }]],
    },
  },

  // ---------------------------------------------- Tabla de Acciones
  {
    id: 'por-los-pelos',
    name: 'Por los pelos',
    cost: 1,
    copies: 2,
    timing: 'afterRoll',
    image: img('por-los-pelos'),
    flavor: '«Uf, por los pelos. Menos mal que evité ese desastre… ¿verdad?»',
    text: 'Juégala después de una Tirada de Terror para volver a tirar 1 dado cualquiera, o bien volver a tirar TODOS los dados por −2 Tiempo.',
    custom: 'por-los-pelos',
  },
  {
    id: 'buscar',
    name: 'Buscar',
    cost: 2,
    copies: 2,
    timing: 'action',
    image: img('buscar'),
    flavor: '«Tiene que haber algo útil por aquí, un arma o algo que me ayude a sobrevivir. ¿Por qué me pasa esto a mí?»',
    // La carta corregida perdió el texto de la primera línea de fracaso; se usa el de la versión original.
    text: '2 éxitos: roba los 2 Objetos superiores del mazo de tu zona y elige 1; deja el otro encima bocarriba o debajo bocabajo; −1 Tiempo. 1 éxito: roba el Objeto superior del mazo de tu zona, −1 Tiempo. Fracaso: roba el Objeto superior del mazo de tu zona, +2 Terror, −2 Tiempo; o bien +1 Terror, −2 Tiempo.',
    results: {
      double: [[{ kind: 'search', draw: 2 }, { kind: 'time', amount: -1 }]],
      single: [[{ kind: 'search', draw: 1 }, { kind: 'time', amount: -1 }]],
      fail: [
        [{ kind: 'search', draw: 1 }, { kind: 'terror', amount: 2 }, { kind: 'time', amount: -2 }],
        [{ kind: 'terror', amount: 1 }, { kind: 'time', amount: -2 }],
      ],
    },
  },
  {
    id: 'correr',
    name: 'Correr',
    cost: 2,
    copies: 2,
    timing: 'action',
    image: img('correr'),
    flavor: '«¡Corre! ¿A dónde? ¡A DONDE SEA!»',
    text: '2 éxitos: muévete hasta 3 zonas, −1 Tiempo. 1 éxito: muévete hasta 2 zonas, −1 Tiempo. Fracaso: muévete hasta 1 zona, pierde 1 Vida, −2 Tiempo y termina la fase de Acción; o bien pierde 1 Vida, −2 Tiempo.',
    results: {
      double: [[{ kind: 'move', upTo: 3 }, { kind: 'time', amount: -1 }]],
      single: [[{ kind: 'move', upTo: 2 }, { kind: 'time', amount: -1 }]],
      fail: [
        [{ kind: 'move', upTo: 1 }, { kind: 'loseHealth', amount: 1 }, { kind: 'time', amount: -2 }, { kind: 'endActionPhase' }],
        [{ kind: 'loseHealth', amount: 1 }, { kind: 'time', amount: -2 }],
      ],
    },
  },
  {
    id: 'guardia',
    name: 'Guardia',
    cost: 2,
    copies: 2,
    timing: 'reaction',
    image: img('guardia'),
    flavor: '«Mierda, va a atacar. Esquiva, desvía, haz lo que haga falta para seguir con vida.»',
    text: 'Reacción. 2 éxitos: ignora TODO el daño del ataque. 1 éxito: reduce el daño 2 puntos. Fracaso: reduce el daño 1 punto (hasta un mínimo de 1).',
    results: {
      double: [[{ kind: 'ignoreAttack' }]],
      single: [[{ kind: 'reduceAttack', amount: 2 }]],
      fail: [[{ kind: 'reduceAttack', amount: 1, min: 1 }]],
    },
  },
  {
    id: 'distraccion',
    name: 'Distracción',
    cost: 3,
    copies: 2,
    timing: 'action',
    image: img('distraccion'),
    flavor: '«Necesito algún tipo de distracción para ganar tiempo.»',
    text: '2 éxitos: −2 Terror, +2 Tiempo. 1 éxito: −1 Terror, +1 Tiempo. Fracaso: −1 Terror, −4 Tiempo; o bien +1 Terror, −2 Tiempo.',
    results: {
      double: [[{ kind: 'terror', amount: -2 }, { kind: 'time', amount: 2 }]],
      single: [[{ kind: 'terror', amount: -1 }, { kind: 'time', amount: 1 }]],
      fail: [
        [{ kind: 'terror', amount: -1 }, { kind: 'time', amount: -4 }],
        [{ kind: 'terror', amount: 1 }, { kind: 'time', amount: -2 }],
      ],
    },
  },
  {
    id: 'improvisar',
    name: 'Improvisar',
    cost: 3,
    copies: 1,
    timing: 'action',
    image: img('improvisar'),
    flavor: '«Es hora de improvisar, de ser original. Seguro que no se lo espera…»',
    text: '2 éxitos: hasta que termine esta fase de Acción, todos los 3 y 4 son éxitos. 1 éxito: en la próxima Tirada de Terror, todos los 3 y 4 son éxitos. Fracaso: +1 Terror, −1 Tiempo.',
    results: {
      double: [[{ kind: 'partialsAreSuccesses', scope: 'actionPhase' }]],
      single: [[{ kind: 'partialsAreSuccesses', scope: 'nextRoll' }]],
      fail: [[{ kind: 'terror', amount: 1 }, { kind: 'time', amount: -1 }]],
    },
  },
  {
    id: 'planear',
    name: 'Planear',
    cost: 4,
    copies: 1,
    timing: 'action',
    image: img('planear'),
    flavor: '«Necesito un plan… Ah, sí… hago esto… y luego esto otro… y por último… ¡Sí! Eso podría funcionar, ¡tiene que hacerlo!»',
    text: '2 éxitos: +3 dados en la próxima Tirada de Terror. 1 éxito: +2 dados en la próxima Tirada de Terror, −1 Tiempo. Fracaso: +1 dado en la próxima Tirada de Terror, +1 Terror, −2 Tiempo.',
    results: {
      double: [[{ kind: 'bonusDiceNextRoll', amount: 3 }]],
      single: [[{ kind: 'bonusDiceNextRoll', amount: 2 }, { kind: 'time', amount: -1 }]],
      fail: [[{ kind: 'bonusDiceNextRoll', amount: 1 }, { kind: 'terror', amount: 1 }, { kind: 'time', amount: -2 }]],
    },
  },
  {
    id: 'contraataque',
    name: 'Contraataque',
    cost: 4,
    copies: 1,
    timing: 'reaction',
    image: img('contraataque'),
    flavor: '«Ya no tengo miedo. La próxima vez que ataque estaré preparada. Voy a matar a esa alimaña.»',
    text: 'Reacción. 2 éxitos: ignora TODO el daño del ataque y haz 2 de daño. 1 éxito: reduce el daño del ataque 2 puntos y haz 1 de daño. Fracaso: sin efecto.',
    results: {
      double: [[{ kind: 'ignoreAttack' }, { kind: 'damage', amount: 2 }]],
      single: [[{ kind: 'reduceAttack', amount: 2 }, { kind: 'damage', amount: 1 }]],
      fail: [[]],
    },
  },
  {
    id: 'golpe-furioso',
    name: 'Golpe furioso',
    cost: 4,
    copies: 2,
    timing: 'action',
    image: img('golpe-furioso'),
    flavor: '«¿Zorra? ¿A quién llamas zorra? ¿Quieres una zorra? Tú te lo has buscado.»',
    text: '2 éxitos: 2 de daño, −1 Terror. 1 éxito: 1 de daño, −1 Terror y termina la fase de Acción. Fracaso: pierde 1 Vida, +1 Terror y termina la fase de Acción.',
    results: {
      double: [[{ kind: 'damage', amount: 2 }, { kind: 'terror', amount: -1 }]],
      single: [[{ kind: 'damage', amount: 1 }, { kind: 'terror', amount: -1 }, { kind: 'endActionPhase' }]],
      fail: [[{ kind: 'loseHealth', amount: 1 }, { kind: 'terror', amount: 1 }, { kind: 'endActionPhase' }]],
    },
  },
  {
    id: 'descanso-largo',
    name: 'Descanso largo',
    cost: 5,
    copies: 1,
    timing: 'action',
    image: img('descanso-largo'),
    flavor: '«¿Estoy a salvo? Tengo que parar y recuperarme. Si no detengo la hemorragia me quedaré sin energía para terminar esto.»',
    text: '2 éxitos: recupera 4 Vida, −1 Tiempo. 1 éxito: recupera 3 Vida, −2 Tiempo. Fracaso: recupera 2 Vida, +1 Terror, −2 Tiempo y termina la fase de Acción.',
    results: {
      double: [[{ kind: 'heal', amount: 4 }, { kind: 'time', amount: -1 }]],
      single: [[{ kind: 'heal', amount: 3 }, { kind: 'time', amount: -2 }]],
      fail: [[{ kind: 'heal', amount: 2 }, { kind: 'terror', amount: 1 }, { kind: 'time', amount: -2 }, { kind: 'endActionPhase' }]],
    },
  },
  {
    id: 'golpe-critico',
    name: 'Golpe crítico',
    cost: 6,
    copies: 1,
    timing: 'action',
    image: img('golpe-critico'),
    flavor: '«Si acierto podría ser el golpe de gracia. No metas la pata ahora.»',
    text: '2 éxitos: 3 de daño, −1 Terror. 1 éxito: 2 de daño, −1 Terror y termina la fase de Acción. Fracaso: 2 de daño, pierde 2 Vida, +1 Terror y termina la fase de Acción.',
    results: {
      double: [[{ kind: 'damage', amount: 3 }, { kind: 'terror', amount: -1 }]],
      single: [[{ kind: 'damage', amount: 2 }, { kind: 'terror', amount: -1 }, { kind: 'endActionPhase' }]],
      fail: [[{ kind: 'damage', amount: 2 }, { kind: 'loseHealth', amount: 2 }, { kind: 'terror', amount: 1 }, { kind: 'endActionPhase' }]],
    },
  },
  // ---------------------------------------------- Slaughter in the Groves
  {
    id: 'expiar',
    name: 'Expiar',
    cost: 2,
    copies: 2,
    timing: 'action',
    image: img('expiar'),
    flavor: '«Puede que esto apacigüe a estos malditos dioses de una vez por todas.»',
    text: '3 éxitos: reduce la Ira Asesina o la Ira Divina a 1. 2 éxitos: reduce la Ira Asesina o la Ira Divina a la mitad (redondeando al alza). 1 éxito: reduce la Ira Asesina o la Ira Divina en 1. Fracaso: +1 Terror, −2 Tiempo.',
    onlyWith: ['inkanyamba', 'sacred-groves'],
    results: {
      triple: [[{ kind: 'wrath', which: 'choose', op: 'set', amount: 1 }]],
      double: [[{ kind: 'wrath', which: 'choose', op: 'halve' }]],
      single: [[{ kind: 'wrath', which: 'choose', op: 'reduce', amount: 1 }]],
      fail: [[{ kind: 'terror', amount: 1 }, { kind: 'time', amount: -2 }]],
    },
  },
  // ---------------------------------------------- Frightmare on Maple Lane
  {
    id: 'convencer',
    name: 'Convencer',
    cost: 1,
    copies: 2,
    timing: 'action',
    image: img('convencer'),
    flavor: '«¡Por favor! ¡Déjame entrar! ¡No quiero morir aquí fuera!»',
    text: '3 éxitos: entra en una Casa adyacente, puedes coger el Objeto superior (si lo haces, pon una X en la Casa). 2 éxitos: entra en una Casa adyacente. 1 éxito: entra en una Casa adyacente, −1 Tiempo. Fracaso: entra en una Casa adyacente, pierde 1 Vida y termina la fase de Acción; o devuelve esta carta al tablero de Acciones y −1 Tiempo. Solo sirve para entrar en una Casa ocupada.',
    onlyWith: ['maple-lane'],
    results: {
      triple: [[{ kind: 'custom', id: 'ml-enter:take' }]],
      double: [[{ kind: 'custom', id: 'ml-enter' }]],
      single: [[{ kind: 'custom', id: 'ml-enter' }, { kind: 'time', amount: -1 }]],
      fail: [
        [{ kind: 'custom', id: 'ml-enter' }, { kind: 'loseHealth', amount: 1 }, { kind: 'endActionPhase' }],
        [{ kind: 'custom', id: 'ml-return-card' }, { kind: 'time', amount: -1 }],
      ],
    },
  },
];
