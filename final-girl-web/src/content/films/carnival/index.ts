import type { FeatureFilm } from '../../types';
import { CARNIVAL_OF_BLOOD } from './carnival-of-blood';
import { ASAMI, CARNIVAL_BONUS_ITEMS, CHARLIE } from './final-girls';
import { GEPPETTO } from './geppetto';

export const CARNIVAL: FeatureFilm = {
  id: 'carnival',
  name: 'Matanza en la Feria',
  killer: GEPPETTO,
  location: CARNIVAL_OF_BLOOD,
  finalGirls: [ASAMI, CHARLIE],
  bonusItems: CARNIVAL_BONUS_ITEMS,
};
