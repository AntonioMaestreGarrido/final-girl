import type { FeatureFilm } from '../../types';
import { CREECH_MANOR } from './creech-manor';
import { ALICE, CREECH_BONUS_ITEMS, SELENA } from './final-girls';
import { POLTERGEIST } from './poltergeist';

export const CREECH: FeatureFilm = {
  id: 'creech',
  name: 'La Casa Creech',
  killer: POLTERGEIST,
  location: CREECH_MANOR,
  finalGirls: [ALICE, SELENA],
  bonusItems: CREECH_BONUS_ITEMS,
};
