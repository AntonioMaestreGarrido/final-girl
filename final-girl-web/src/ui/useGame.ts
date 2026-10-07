import { useCallback, useEffect, useRef, useState } from 'react';
import { fxDuration } from './moveFx';
import { canUndo, deserialize, newGame, play, serialize, undo, type Game, type GameConfig, type Input } from '../engine';

const SAVE_KEY = 'final-girl:partida';
const SETTINGS_KEY = 'final-girl:ajustes';

export type Pacing = 'auto' | 'step';

export interface Settings {
  pacing: Pacing;
  /** Milisegundos entre pasos en modo automático. */
  speed: number;
  /** Resaltar en el tablero los movimientos y muertes automáticos (recorrido, pulso y aviso). */
  highlight: boolean;
}

const DEFAULT_SETTINGS: Settings = { pacing: 'auto', speed: 550, highlight: true };

function readJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function hasSavedGame(): boolean {
  try {
    return !!localStorage.getItem(SAVE_KEY);
  } catch {
    return false;
  }
}

export function loadSavedGame(): Game | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? deserialize(raw) : null;
  } catch {
    return null;
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(() => ({ ...DEFAULT_SETTINGS, ...readJSON<Settings>(SETTINGS_KEY) }));
  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      /* sin almacenamiento: los ajustes duran la sesión */
    }
  }, [settings]);
  return [settings, setSettings] as const;
}

/** Estado de la partida + revelado progresivo del registro (ritmo de la fase del Asesino). */
export function useGame(initial: Game, settings: Settings, hold = false) {
  const [game, setGame] = useState<Game>(initial);
  const [shown, setShown] = useState(initial.state.log.length);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  /** Duración del resalte de la última entrada revelada: el siguiente paso espera a que termine. */
  const fxWait = useRef(0);

  // Autoguardado.
  useEffect(() => {
    try {
      if (game.state.outcome) localStorage.removeItem(SAVE_KEY);
      else localStorage.setItem(SAVE_KEY, serialize(game));
    } catch {
      /* sin almacenamiento disponible */
    }
  }, [game]);

  const total = game.state.log.length;
  const revealing = shown < total;

  // Modo automático: revela una entrada cada `speed` ms.
  useEffect(() => {
    if (!revealing || settings.pacing !== 'auto' || hold) return;
    const delay = Math.max(settings.speed, settings.highlight ? fxWait.current : 0);
    timer.current = window.setTimeout(() => {
      fxWait.current = fxDuration(game.state.log[shown]?.anim);
      setShown((n) => Math.min(total, n + 1));
    }, delay);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealing, shown, total, settings.pacing, settings.speed, settings.highlight, hold]);

  const send = useCallback((input: Input) => {
    setError(null);
    fxWait.current = 0;
    setGame((g) => {
      try {
        return play(g, input);
      } catch (e) {
        setError((e as Error).message);
        return g;
      }
    });
  }, []);

  const doUndo = useCallback(() => {
    setGame((g) => {
      const prev = undo(g);
      setShown(prev.state.log.length);
      return prev;
    });
  }, []);

  return {
    game,
    state: game.state,
    send,
    undo: doUndo,
    canUndo: canUndo(game) && !revealing,
    error,
    clearError: () => setError(null),
    shown: Math.min(shown, total),
    revealing,
    next: () => setShown((n) => Math.min(total, n + 1)),
    skip: () => setShown(total),
  };
}

export const startGame = (config: GameConfig) => newGame(config);
