import type { FinalGirl, ItemCard } from '../../types';

const base = 'assets/final-girls';

export const LAURIE: FinalGirl = {
  id: 'laurie',
  name: 'Laurie',
  health: 5,
  film: 'happy-trails',
  image: `${base}/laurie.webp`,
  ultimateImage: `${base}/laurie-ultimate.webp`,
  token: `${base}/laurie-token.webp`,
  rescueSlots: [
    { effects: [{ kind: 'terror', amount: -1 }], text: '−1 Terror' },
    { effects: [{ kind: 'time', amount: 2 }], text: '+2 Tiempo' },
    { effects: [{ kind: 'heal', amount: 1 }], text: 'Recupera 1 Vida' },
    { effects: [{ kind: 'time', amount: 2 }], text: '+2 Tiempo' },
    { effects: [{ kind: 'takeActionCard', maxCost: 2 }], text: 'Coge una carta de Acción (coste máx. 2)' },
    { effects: [{ kind: 'move', upTo: 1 }], text: 'Muévete 1 zona' },
  ],
  ultimate: {
    text: 'Siempre que estés en la misma zona que un Enemigo y le hagas daño, haz 1 de daño adicional.',
    custom: 'ult-laurie',
  },
  extraRescueReward: [{ kind: 'time', amount: 1 }],
  bonusItem: 'arco-de-laurie',
};

export const REIKO: FinalGirl = {
  id: 'reiko',
  name: 'Reiko',
  health: 6,
  film: 'happy-trails',
  image: `${base}/reiko.webp`,
  ultimateImage: `${base}/reiko-ultimate.webp`,
  token: `${base}/reiko-token.webp`,
  rescueSlots: [
    { effects: [{ kind: 'time', amount: 2 }], text: '+2 Tiempo' },
    { effects: [{ kind: 'heal', amount: 1 }], text: 'Recupera 1 Vida' },
    { effects: [{ kind: 'takeActionCard', cardId: 'planear' }], text: 'Coge la carta de Acción Planear' },
    { effects: [{ kind: 'move', upTo: 1 }], text: 'Muévete 1 zona' },
    { effects: [{ kind: 'move', upTo: 1 }], text: 'Muévete 1 zona' },
  ],
  ultimate: {
    text: 'Una vez por fase de Acción, si un Enemigo está a 2 zonas o menos, puedes moverte gratis a su zona.',
    custom: 'ult-reiko',
  },
  extraRescueReward: [{ kind: 'time', amount: 1 }],
  bonusItem: 'hacha-de-reiko',
};

/** Objetos bonus: se barajan en el mazo de Objetos del Lugar antes de preparar los montones. */
export const HAPPY_TRAILS_BONUS_ITEMS: ItemCard[] = [
  {
    id: 'arco-de-laurie',
    name: 'Arco de Laurie',
    image: `${base}/bonus-items/arco-de-laurie.webp`,
    flavor: '«Gané los Nacionales con este arco. Nunca perdí y eso no va a cambiar ahora.»',
    text: 'Solo Laurie puede usar este objeto. No puede modificar una carta de Acción y se usa sin ella. Disparar una flecha cuesta 1 Tiempo. Alcance 1-3, +1 de daño, 3 usos.',
    hands: 2,
    range: [1, 3],
    damage: 1,
    uses: 3,
    modifies: 'none',
    onlyFor: 'laurie',
    custom: 'item-bow',
  },
  {
    id: 'hacha-de-reiko',
    name: 'Hacha de Reiko',
    image: `${base}/bonus-items/hacha-de-reiko.webp`,
    flavor: '«Cuanto más grandes, con más fuerza caerán, especialmente con esta joya en mis manos.»',
    text: 'Solo Reiko puede usar este objeto. Arma: alcance 0, +2 de daño. Puedes tirar 1 dado adicional al resolver la carta de Acción Ataque débil.',
    hands: 2,
    range: [0, 0],
    damage: 2,
    modifies: 'any',
    onlyFor: 'reiko',
    custom: 'item-reiko-axe',
  },
];
