import type { FeatureFilm } from '../../types';
import { DR_FRIGHT } from './dr-fright';
import { MAPLE_BONUS_ITEMS, NANCY, SHEILA } from './final-girls';
import { MAPLE_LANE } from './maple-lane';

export const MAPLE: FeatureFilm = {
  id: 'maple',
  name: 'Pesadilla en Maple Lane',
  killer: DR_FRIGHT,
  location: MAPLE_LANE,
  finalGirls: [NANCY, SHEILA],
  bonusItems: MAPLE_BONUS_ITEMS,
};
