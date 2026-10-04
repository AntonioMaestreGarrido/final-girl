import type { FeatureFilm } from '../../types';
import { CAMP_HAPPY_TRAILS } from './camp';
import { HAPPY_TRAILS_BONUS_ITEMS, LAURIE, REIKO } from './final-girls';
import { HANS } from './hans';

export const HAPPY_TRAILS: FeatureFilm = {
  id: 'happy-trails',
  name: 'Terror en Camp Happy Trails',
  killer: HANS,
  location: CAMP_HAPPY_TRAILS,
  finalGirls: [LAURIE, REIKO],
  bonusItems: HAPPY_TRAILS_BONUS_ITEMS,
};
