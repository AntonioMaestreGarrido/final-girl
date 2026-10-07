import type { FinalGirl } from '../../types';

const base = 'assets/final-girls';

export const PAULA: FinalGirl = {
  id: 'paula',
  name: 'Paula',
  health: 5,
  film: 'terror',
  image: `${base}/paula.webp`,
  ultimateImage: `${base}/paula-ultimate.webp`,
  token: `${base}/paula-token.webp`,
  rescueSlots: [
    { effects: [{ kind: 'drawItemAnyDeck' }], text: 'Coge la carta superior de cualquier mazo de Objetos' },
    { effects: [{ kind: 'terror', amount: -1 }], text: '−1 Terror' },
    { effects: [{ kind: 'time', amount: 2 }], text: '+2 Tiempo' },
    { effects: [{ kind: 'heal', amount: 1 }], text: 'Recupera 1 Vida' },
    { effects: [{ kind: 'move', upTo: 2 }], text: 'Muévete hasta 2 zonas' },
  ],
  ultimate: {
    text: 'Las cosas se están poniendo arriesgadas. Cada vez que tires 1 dado, lanza 2 en su lugar. Si hace falta un resultado concreto, tú eliges qué dado usar.',
    custom: 'ult-paula',
  },
  extraRescueReward: [{ kind: 'time', amount: 2 }],
  extraRescueText: '+2 Tiempo',
};

export const MELANIE: FinalGirl = {
  id: 'melanie',
  name: 'Melanie',
  health: 5,
  film: 'terror',
  image: `${base}/melanie.webp`,
  ultimateImage: `${base}/melanie-ultimate.webp`,
  token: `${base}/melanie-token.webp`,
  rescueSlots: [
    { effects: [{ kind: 'heal', amount: 1 }], text: 'Recupera 1 Vida' },
    { effects: [{ kind: 'heal', amount: 1 }], text: 'Recupera 1 Vida' },
    { effects: [{ kind: 'terror', amount: -1 }], text: '−1 Terror' },
    { effects: [{ kind: 'move', upTo: 2 }], text: 'Muévete hasta 2 zonas' },
    { effects: [{ kind: 'move', upTo: 1 }], text: 'Muévete 1 zona' },
    { effects: [{ kind: 'takeActionCard', cardId: 'guardia' }], text: 'Coge una carta de Reacción de protección (Guardia)' },
  ],
  ultimate: {
    text: 'Una vez por fase de Acción, puedes perder 1 Vida (inevitable) para repartir 2 de daño, dividido a tu elección, entre los Enemigos de tu espacio.',
    custom: 'ult-melanie',
  },
  extraRescueReward: [{ kind: 'heal', amount: 1 }],
  extraRescueText: 'Restaura 1 Vida',
};
