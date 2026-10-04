import type { FeatureFilm } from '../../types';
import { ADELAIDE, BARBARA, GROOVES_BONUS_ITEMS } from './final-girls';
import { INKANYAMBA } from './inkanyamba';
import { SACRED_GROVES } from './sacred-groves';

export const GROOVES: FeatureFilm = {
  id: 'grooves',
  name: 'Matanza en las Arboledas',
  killer: INKANYAMBA,
  location: SACRED_GROVES,
  finalGirls: [ADELAIDE, BARBARA],
  bonusItems: GROOVES_BONUS_ITEMS,
};
