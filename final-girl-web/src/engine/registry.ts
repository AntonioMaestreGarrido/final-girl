/**
 * Registros de habilidades únicas por id (efectos, elecciones y tiradas pedidas por cartas).
 * Viven en su propio módulo, sin dependencias, para que cualquier película pueda registrarse
 * sin crear ciclos de importación.
 */
import type { ChoiceHandler, EffectSource, GameState, Task } from './state';

export function choice(title: string, options: { id: string; label: string }[], then: ChoiceHandler): Task {
  return { t: 'choice', title, options, then };
}

type CustomEffect = (s: GameState, arg: string | undefined, src: EffectSource) => void;
export const customEffects = new Map<string, CustomEffect>();
/** Ids con parámetro: "nombre:arg". */
export const registerEffect = (id: string, fn: CustomEffect) => customEffects.set(id, fn);

type CustomChoice = (s: GameState, option: string, data: Record<string, unknown>) => void;
export const customChoices = new Map<string, CustomChoice>();
export const registerChoice = (id: string, fn: CustomChoice) => customChoices.set(id, fn);

type EffectRoll = (s: GameState, successes: number) => void;
export const effectRolls = new Map<string, EffectRoll>();
export const registerEffectRoll = (id: string, fn: EffectRoll) => effectRolls.set(id, fn);
