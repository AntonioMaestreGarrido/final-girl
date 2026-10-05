import type { FinalGirl, ItemCard } from '../../types';

const base = 'assets/final-girls';

export const ASAMI: FinalGirl = {
  id: 'asami',
  name: 'Asami',
  health: 5,
  film: 'carnival',
  image: `${base}/asami.webp`,
  ultimateImage: `${base}/asami-ultimate.webp`,
  token: `${base}/asami-token.webp`,
  rescueSlots: [
    { effects: [{ kind: 'takeActionCard', cardId: 'buscar' }], text: 'Coge una carta de Acción Buscar' },
    { effects: [{ kind: 'heal', amount: 1 }], text: 'Recupera 1 Vida' },
    { effects: [{ kind: 'move', upTo: 1 }], text: 'Muévete 1 zona' },
    { effects: [{ kind: 'terror', amount: -2 }], text: '−2 Terror' },
  ],
  ultimate: {
    text: 'Cada vez que robas al menos una carta de Objeto, roba una adicional y escoge una. Eres inmune a las cartas de Objeto Trampa.',
    custom: 'ult-asami',
  },
  extraRescueReward: [{ kind: 'heal', amount: 1 }],
  extraRescueText: 'Recupera 1 Vida',
  bonusItem: 'cinturon-de-cuchillos-de-asami',
};

export const CHARLIE: FinalGirl = {
  id: 'charlie',
  name: 'Charlie',
  health: 7,
  film: 'carnival',
  image: `${base}/charlie.webp`,
  ultimateImage: `${base}/charlie-ultimate.webp`,
  token: `${base}/charlie-token.webp`,
  rescueSlots: [
    { effects: [{ kind: 'terror', amount: -1 }], text: '−1 Terror' },
    { effects: [{ kind: 'move', upTo: 1 }], text: 'Muévete 1 zona' },
    { effects: [{ kind: 'move', upTo: 1 }], text: 'Muévete 1 zona' },
    { effects: [{ kind: 'time', amount: 2 }], text: '+2 Tiempo' },
    { effects: [{ kind: 'terror', amount: -1 }], text: '−1 Terror' },
    { effects: [{ kind: 'terror', amount: -1 }], text: '−1 Terror' },
  ],
  ultimate: {
    text: 'Durante la fase de Acción, puedes perder 3 Vida para poner la carta de Acción Golpe crítico directamente en tu mano.',
    custom: 'ult-charlie',
  },
  extraRescueReward: [{ kind: 'time', amount: 1 }],
  extraRescueText: '+1 Tiempo',
  bonusItem: 'martillo-gigante-de-charlie',
};

/** Objetos bonus: se barajan en el mazo de Objetos del Lugar antes de preparar los montones. */
export const CARNIVAL_BONUS_ITEMS: ItemCard[] = [
  {
    id: 'cinturon-de-cuchillos-de-asami',
    name: 'Cinturón de cuchillos de Asami',
    image: `${base}/bonus-items/cinturon-de-cuchillos-de-asami.webp`,
    flavor: '«Me siento como un puercoespín con todo esto.»',
    text: 'Solo Asami puede usar este objeto. Arma: alcance 0-1, +1 de daño. Cuando lo uses, puedes dividir el daño como prefieras entre cualquier Enemigo dentro de su alcance.',
    hands: 1,
    range: [0, 1],
    damage: 1,
    modifies: 'any',
    onlyFor: 'asami',
    custom: 'item-knife-belt',
  },
  {
    id: 'martillo-gigante-de-charlie',
    name: 'Martillo gigante de Charlie',
    image: `${base}/bonus-items/martillo-gigante-de-charlie.webp`,
    flavor: '«Justo como practicaba en cross fit, pero con un neumático en movimiento.»',
    text: 'Solo Charlie puede usar este objeto. Arma: alcance 0, +3 de daño. Debes tener 2 o más de Vida para atacar con él. Después de resolver un ataque con este arma: pierdes 1 Vida y termina tu fase de Acción.',
    hands: 2,
    range: [0, 0],
    damage: 3,
    modifies: 'any',
    onlyFor: 'charlie',
    custom: 'item-hammer-charlie',
  },
];
