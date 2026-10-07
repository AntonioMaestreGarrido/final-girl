import type { FeatureFilm, FinalGirl, ItemCard, Killer, Location } from './types';
import { HAPPY_TRAILS } from './films/happy-trails';
import { GROOVES } from './films/grooves';
import { CARNIVAL } from './films/carnival';
import { CREECH } from './films/creech';
import { MAPLE } from './films/maple';
import { TERROR_FROM_ABOVE } from './films/terror';

/** Películas disponibles. Para añadir una nueva, crea su carpeta en films/ y regístrala aquí. */
export const FILMS: FeatureFilm[] = [HAPPY_TRAILS, GROOVES, CARNIVAL, CREECH, MAPLE];

/** Cualquier Asesino puede jugarse en cualquier Lugar y con cualquier Chica Final. */
export { TERROR_FROM_ABOVE };
export const KILLERS: Killer[] = [...FILMS.map((f) => f.killer), TERROR_FROM_ABOVE.killer];
export const LOCATIONS: Location[] = FILMS.map((f) => f.location);
export const FINAL_GIRLS: FinalGirl[] = [...FILMS.flatMap((f) => f.finalGirls), ...TERROR_FROM_ABOVE.finalGirls];
export const BONUS_ITEMS: ItemCard[] = FILMS.flatMap((f) => f.bonusItems);

export * from './core/actions';
export * from './core/boards';
export type * from './types';
