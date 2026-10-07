import type { FinalGirl, ItemCard } from '../../types';

const base = 'assets/final-girls';

export const NANCY: FinalGirl = {
  id: 'nancy',
  name: 'Nancy',
  health: 4,
  film: 'maple',
  image: `${base}/nancy.webp`,
  ultimateImage: `${base}/nancy-ultimate.webp`,
  token: `${base}/nancy-token.webp`,
  rescueSlots: [
    { effects: [{ kind: 'heal', amount: 2 }], text: 'Recupera 2 Vida' },
    { effects: [{ kind: 'move', upTo: 2 }], text: 'Muévete hasta 2 zonas' },
    { effects: [{ kind: 'time', amount: 2 }], text: '+2 Tiempo' },
    { effects: [{ kind: 'takeActionCard', cardId: 'descanso-largo' }], text: 'Coge una carta de Acción Descanso largo' },
    { effects: [{ kind: 'takeActionCard', cardId: 'planear' }], text: 'Coge una carta de Acción Planear' },
  ],
  ultimate: {
    text: 'Cada vez que pierdas Vida normal, puedes revelar una ficha de Vida Final negra de la reserva general y cambiarla por tu ficha de Vida Final negra; si no, retírala del juego. No puedes hacerlo con una ficha blanca.',
    custom: 'ult-nancy',
  },
  extraRescueReward: [{ kind: 'heal', amount: 1 }],
  extraRescueText: 'Recupera 1 Vida',
  bonusItem: 'machetes-de-nancy',
};

export const SHEILA: FinalGirl = {
  id: 'sheila',
  name: 'Sheila',
  health: 6,
  film: 'maple',
  image: `${base}/sheila.webp`,
  ultimateImage: `${base}/sheila-ultimate.webp`,
  token: `${base}/sheila-token.webp`,
  rescueSlots: [
    { effects: [{ kind: 'takeActionCard', cardId: 'improvisar' }], text: 'Coge una carta de Acción Improvisar' },
    { effects: [{ kind: 'takeActionCard', cardId: 'descanso-largo' }], text: 'Coge una carta de Acción Descanso largo' },
    { effects: [{ kind: 'terror', amount: -1 }], text: '−1 Terror' },
    { effects: [{ kind: 'time', amount: 2 }], text: '+2 Tiempo' },
    { effects: [{ kind: 'move', upTo: 1 }], text: 'Muévete 1 zona' },
    { effects: [{ kind: 'heal', amount: 2 }], text: 'Recupera 2 Vida' },
  ],
  ultimate: {
    text: 'Ganas 2 de Tiempo (en vez de 1) por cada carta de Acción que descartes para cambiarla por Tiempo.',
    custom: 'ult-sheila',
  },
  extraRescueReward: [{ kind: 'terror', amount: -1 }],
  extraRescueText: '−1 Terror',
  bonusItem: 'cuchillo-de-sheila',
};

/** Objetos bonus: se barajan con los Objetos del Lugar antes de preparar los mazos. */
export const MAPLE_BONUS_ITEMS: ItemCard[] = [
  {
    id: 'machetes-de-nancy',
    name: 'Machetes de Nancy',
    image: `${base}/bonus-items/machetes-de-nancy.webp`,
    flavor: '«Si no puedes ganarles, únete a ellos y luego… gánales.»',
    text: 'Solo Nancy puede usar este objeto. Arma: alcance 0, +3 de daño. Las Víctimas no te seguirán. Cada vez que entres en el espacio del Asesino, +1 Sed de Sangre.',
    hands: 2,
    range: [0, 0],
    damage: 3,
    modifies: 'any',
    onlyFor: 'nancy',
    custom: 'item-nancy-machetes',
  },
  {
    id: 'cuchillo-de-sheila',
    name: 'Cuchillo de Sheila',
    image: `${base}/bonus-items/cuchillo-de-sheila.webp`,
    flavor: '«No parece gran cosa, pero créeme… lo es.»',
    text: 'Solo Sheila puede usar este objeto. Arma: alcance 0, +1 de daño. Tira +1 dado cuando ataques con el Cuchillo de Sheila.',
    hands: 1,
    range: [0, 0],
    damage: 1,
    modifies: 'any',
    onlyFor: 'sheila',
    custom: 'item-sheila-knife',
  },
];
