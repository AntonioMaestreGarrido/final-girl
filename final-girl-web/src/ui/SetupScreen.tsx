import { useRef, useState } from 'react';
import { FINAL_GIRLS, KILLERS, LOCATIONS } from '../content';
import { deserialize, type Game, type GameConfig } from '../engine';
import { asset } from './asset';
import { hasSavedGame, loadSavedGame, startGame } from './useGame';

export function SetupScreen({ onStart }: { onStart: (g: Game) => void }) {
  const [config, setConfig] = useState<Omit<GameConfig, 'seed'>>({
    killerId: KILLERS[0]!.id,
    locationId: LOCATIONS[0]!.id,
    finalGirlId: FINAL_GIRLS[0]!.id,
    board: 'normal',
    epicDarkPower: false,
    bonusItems: true,
  });
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof typeof config>(k: K, v: (typeof config)[K]) => setConfig((c) => ({ ...c, [k]: v }));
  const randomFG = () => set('finalGirlId', FINAL_GIRLS[Math.floor(Math.random() * FINAL_GIRLS.length)]!.id);

  const loadFile = async (file: File) => {
    try {
      onStart(deserialize(await file.text()));
    } catch (e) {
      setError(`No se pudo cargar la partida: ${(e as Error).message}`);
    }
  };

  return (
    <div className="setup">
      <h1 className="title">Final Girl</h1>
      <p className="subtitle">Matar o morir.</p>

      <div className="setup-actions">
        {hasSavedGame() && (
          <button className="btn primary" onClick={() => { const g = loadSavedGame(); if (g) onStart(g); }}>
            Continuar partida
          </button>
        )}
        <button className="btn" onClick={() => fileRef.current?.click()}>Cargar archivo…</button>
        <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => e.target.files?.[0] && loadFile(e.target.files[0])} />
      </div>
      {error && <p className="error">{error}</p>}

      <section className="setup-section">
        <h2>Chica Final</h2>
        <div className="choice-row">
          {FINAL_GIRLS.map((fg) => (
            <button key={fg.id} className={`pick-card ${config.finalGirlId === fg.id ? 'selected' : ''}`} onClick={() => set('finalGirlId', fg.id)}>
              <img src={asset(fg.image)} alt={fg.name} />
            </button>
          ))}
        </div>
        <button className="btn small" onClick={randomFG}>Al azar</button>
      </section>

      <section className="setup-section two-col">
        <div>
          <h2>Asesino</h2>
          <div className="choice-row">
            {KILLERS.map((k) => (
              <button key={k.id} className={`pick-cover ${config.killerId === k.id ? 'selected' : ''}`} onClick={() => set('killerId', k.id)}>
                <img src={asset(k.select)} alt={k.name} />
                <span>{k.name}</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <h2>Lugar</h2>
          <div className="choice-row">
            {LOCATIONS.map((l) => (
              <button key={l.id} className={`pick-cover ${config.locationId === l.id ? 'selected' : ''}`} onClick={() => set('locationId', l.id)}>
                <img src={asset(l.select)} alt={l.name} />
                <span>{l.name}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="setup-section options">
        <h2>Opciones</h2>
        <label>
          <input type="radio" checked={config.board === 'normal'} onChange={() => set('board', 'normal')} /> Dificultad normal
        </label>
        <label>
          <input type="radio" checked={config.board === 'extreme'} onChange={() => set('board', 'extreme')} /> Terror Extremo (medidor más duro, 5 de Tiempo)
        </label>
        <label>
          <input type="checkbox" checked={config.epicDarkPower} onChange={(e) => set('epicDarkPower', e.target.checked)} /> Poder Oscuro Épico
        </label>
        <label>
          <input type="checkbox" checked={config.bonusItems} onChange={(e) => set('bonusItems', e.target.checked)} /> Objeto bonus de la Chica Final
        </label>
      </section>

      <button className="btn primary big" onClick={() => onStart(startGame({ ...config, seed: Math.floor(Math.random() * 2 ** 31) }))}>
        Empezar la película
      </button>
    </div>
  );
}
