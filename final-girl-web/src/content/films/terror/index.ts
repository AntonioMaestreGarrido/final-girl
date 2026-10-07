import type { FinalGirl, Killer } from '../../types';
import { BIRDS } from './birds';
import { MELANIE, PAULA } from './final-girls';

/**
 * Terror from Above: mini-expansión sin Lugar propio ni Asesino. Se juega sobre el Lugar de cualquier otra película
 * con cualquier Chica Final, así que no es una `FeatureFilm`.
 */
export const TERROR_FROM_ABOVE: { id: string; name: string; killer: Killer; finalGirls: FinalGirl[] } = {
  id: 'terror',
  name: 'Terror from Above',
  killer: BIRDS,
  finalGirls: [PAULA, MELANIE],
};
