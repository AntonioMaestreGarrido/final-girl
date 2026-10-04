import type { FinalGirl, ItemCard } from '../../types';

const base = 'assets/final-girls';

export const ADELAIDE: FinalGirl = {
  id: 'adelaide',
  name: 'Adelaide',
  health: 6,
  film: 'grooves',
  image: `${base}/adelaide.webp`,
  ultimateImage: `${base}/adelaide-ultimate.webp`,
  token: `${base}/adelaide-token.webp`,
  rescueSlots: [
    { effects: [{ kind: 'time', amount: 2 }], text: '+2 Tiempo' },
    { effects: [{ kind: 'terror', amount: -1 }], text: '−1 Terror' },
    { effects: [{ kind: 'terror', amount: -1 }], text: '−1 Terror' },
    { effects: [{ kind: 'time', amount: 2 }], text: '+2 Tiempo' },
    { effects: [{ kind: 'move', upTo: 1 }], text: 'Muévete 1 zona' },
  ],
  ultimate: {
    text: 'Al desbloquearla, elige uno de estos efectos inmediatos: reduce una Ira (Asesina o Divina) a 1, recupera toda tu Vida o coge cartas de Acción a tu mano por un coste total de hasta 6.',
    custom: 'ult-adelaide',
  },
  extraRescueReward: [{ kind: 'terror', amount: -1 }],
  extraRescueText: '−1 Terror',
  bonusItem: 'bate-y-escudo-de-adelaide',
};

export const BARBARA: FinalGirl = {
  id: 'barbara',
  name: 'Barbara',
  health: 7,
  film: 'grooves',
  image: `${base}/barbara.webp`,
  ultimateImage: `${base}/barbara-ultimate.webp`,
  token: `${base}/barbara-token.webp`,
  rescueSlots: [
    { effects: [{ kind: 'terror', amount: -1 }], text: '−1 Terror' },
    { effects: [{ kind: 'time', amount: 2 }], text: '+2 Tiempo' },
    { effects: [{ kind: 'heal', amount: 1 }], text: 'Recupera 1 Vida' },
    { effects: [{ kind: 'drawItemAnyDeck' }], text: 'Coge la carta superior de cualquier mazo de Objetos' },
    { effects: [{ kind: 'move', upTo: 1 }], text: 'Muévete 1 zona' },
  ],
  ultimate: {
    text: 'Las Víctimas te siguen también a la zona del Asesino. Cuando hagas daño a un Enemigo en tu zona, puedes hacer 1 de daño adicional por cada Víctima presente; por cada punto adicional muere una Víctima (sin aumentar la Sed de Sangre).',
    custom: 'ult-barbara',
  },
  extraRescueReward: [{ kind: 'time', amount: 1 }],
  extraRescueText: '+1 Tiempo',
  bonusItem: 'rifle-de-barbara',
};

/** Objetos bonus: se barajan en el mazo de Objetos del Lugar antes de preparar los montones. */
export const GROOVES_BONUS_ITEMS: ItemCard[] = [
  {
    id: 'bate-y-escudo-de-adelaide',
    name: 'Bate y escudo de Adelaide',
    image: `${base}/bonus-items/bate-y-escudo-de-adelaide.webp`,
    flavor: '«A este le llamo Wham y a este otro Bam.»',
    text: 'Solo Adelaide puede usar este objeto. Arma: alcance 0, +2 de daño. Cada vez que saques al menos 1 éxito con la carta de Acción Guardia, haz 1 de daño al Enemigo que te atacó.',
    hands: 2,
    range: [0, 0],
    damage: 2,
    modifies: 'any',
    onlyFor: 'adelaide',
    custom: 'item-adelaide-bat',
  },
  {
    id: 'rifle-de-barbara',
    name: 'Rifle de Barbara',
    image: `${base}/bonus-items/rifle-de-barbara.webp`,
    flavor: '«Será una delicia volarle la cabeza a ese maníaco con la Vieja Betsy.»',
    text: 'Solo Barbara puede usar este objeto. Arma: alcance 1-4, +1 de daño, 4 usos. Solo puede modificar la carta de Acción Ataque débil.',
    hands: 2,
    range: [1, 4],
    damage: 1,
    uses: 4,
    modifies: ['ataque-debil'],
    onlyFor: 'barbara',
  },
];
