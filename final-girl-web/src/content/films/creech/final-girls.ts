import type { FinalGirl, ItemCard } from '../../types';

const base = 'assets/final-girls';

export const ALICE: FinalGirl = {
  id: 'alice',
  name: 'Alice',
  health: 4,
  film: 'creech',
  image: `${base}/alice.webp`,
  ultimateImage: `${base}/alice-ultimate.webp`,
  token: `${base}/alice-token.webp`,
  rescueSlots: [
    { effects: [{ kind: 'time', amount: 2 }], text: '+2 Tiempo' },
    { effects: [{ kind: 'heal', amount: 1 }], text: 'Recupera 1 Vida' },
    { effects: [{ kind: 'heal', amount: 1 }], text: 'Recupera 1 Vida' },
    { effects: [{ kind: 'takeActionCard', maxCost: 2 }], text: 'Coge una carta de Acción de coste 2 o menos' },
    { effects: [{ kind: 'move', upTo: 2 }], text: 'Muévete hasta 2 zonas' },
    { effects: [{ kind: 'move', upTo: 1 }], text: 'Muévete 1 zona' },
  ],
  ultimate: {
    text: 'Escoge un tipo de carta de Acción. El resto de la partida, cada vez que juegues ese tipo de carta, tira siempre exactamente 5 dados, sin importar el nivel de Horror ni ningún otro modificador.',
    custom: 'ult-alice',
  },
  extraRescueReward: [{ kind: 'heal', amount: 1 }],
  extraRescueText: 'Recupera 1 Vida',
  bonusItem: 'rifle-de-alice',
};

export const SELENA: FinalGirl = {
  id: 'selena',
  name: 'Selena',
  health: 6,
  film: 'creech',
  image: `${base}/selena.webp`,
  ultimateImage: `${base}/selena-ultimate.webp`,
  token: `${base}/selena-token.webp`,
  rescueSlots: [
    { effects: [{ kind: 'time', amount: 2 }], text: '+2 Tiempo' },
    { effects: [{ kind: 'move', upTo: 1 }], text: 'Muévete 1 zona' },
    { effects: [{ kind: 'takeActionCard', cardId: 'buscar' }], text: 'Coge una carta de Acción Buscar' },
    { effects: [{ kind: 'terror', amount: -2 }], text: '−2 Terror' },
  ],
  ultimate: {
    text: 'Cuando resuelvas una carta de Acción de Buscar, tira 2 dados adicionales.',
    custom: 'ult-selena',
  },
  extraRescueReward: [{ kind: 'time', amount: 2 }],
  extraRescueText: '+2 Tiempo',
  bonusItem: 'linterna-de-selena',
};

/** Objetos bonus: se barajan con los Objetos del Lugar antes de preparar los mazos. */
export const CREECH_BONUS_ITEMS: ItemCard[] = [
  {
    id: 'linterna-de-selena',
    name: 'Linterna de Selena',
    image: `${base}/bonus-items/linterna-de-selena.webp`,
    flavor: '«Dicen que la ignorancia es una dicha, pero yo mantendré la luz, muchas gracias.»',
    text: 'Solo Selena puede usar este objeto. Una vez cada fase de Acción, puedes mirar la carta superior del mazo de Terror y dejarla arriba o ponerla al fondo. Puedes descartarla mientras estés en una zona de Búsqueda para coger la carta superior de su mazo de Objetos.',
    hands: 0,
    onlyFor: 'selena',
    custom: 'item-selena-flashlight',
  },
  {
    id: 'rifle-de-alice',
    name: 'Rifle de Alice',
    image: `${base}/bonus-items/rifle-de-alice.webp`,
    flavor: '«¡Clic, clic, bang!»',
    text: 'Solo Alice puede usar este objeto. No puede modificar una carta de Acción y se usa sin ella. Una vez por turno puedes descartar 1 carta de tu mano y tirar 6 dados: haz 1 de daño a cada Enemigo de tu espacio por cada éxito. Si al menos la mitad de los dados salen en blanco, pierdes el Rifle de Alice.',
    hands: 2,
    onlyFor: 'alice',
    custom: 'item-alice-rifle',
  },
];
