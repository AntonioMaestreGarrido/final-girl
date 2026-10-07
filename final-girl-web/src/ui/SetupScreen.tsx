import { useRef, useState } from 'react';
import { FILMS, FINAL_GIRLS, KILLERS, LOCATIONS, TERROR_FROM_ABOVE } from '../content';
import { deserialize, type Game, type GameConfig } from '../engine';
import { asset } from './asset';
import { hasSavedGame, loadSavedGame, startGame } from './useGame';

export function SetupScreen({ onStart }: { onStart: (g: Game) => void }) {
  const [filmId, setFilmId] = useState(FILMS[0]!.id);
  const [mix, setMix] = useState(false);
  const [expansion, setExpansion] = useState(false);
  const [config, setConfig] = useState<Omit<GameConfig, 'seed'>>({
    killerId: FILMS[0]!.killer.id,
    locationId: FILMS[0]!.location.id,
    finalGirlId: FILMS[0]!.finalGirls[0]!.id,
    board: 'normal',
    epicDarkPower: false,
    bonusItems: true,
    birdsSpecials: 2,
  });
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof typeof config>(k: K, v: (typeof config)[K]) => setConfig((c) => ({ ...c, [k]: v }));
  const film = FILMS.find((f) => f.id === filmId)!;
  const pickFilm = (id: string) => {
    const f = FILMS.find((x) => x.id === id)!;
    setFilmId(id);
    setExpansion(false);
    setConfig((c) => ({ ...c, killerId: f.killer.id, locationId: f.location.id, finalGirlId: f.finalGirls[0]!.id }));
  };
  const birds = config.killerId === TERROR_FROM_ABOVE.killer.id;
  const fgPool = mix || expansion ? FINAL_GIRLS : film.finalGirls;
  const pickExpansion = () => {
    setMix(false);
    setExpansion(true);
    setConfig((c) => ({ ...c, killerId: TERROR_FROM_ABOVE.killer.id, finalGirlId: TERROR_FROM_ABOVE.finalGirls[0]!.id }));
  };
  const randomFG = () => set('finalGirlId', fgPool[Math.floor(Math.random() * fgPool.length)]!.id);
  const toggleMix = (on: boolean) => {
    setMix(on);
    setExpansion(false);
    if (!on) pickFilm(filmId);
  };

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
        <h2>Película</h2>
        <div className="choice-row">
          {FILMS.map((f) => (
            <button key={f.id} className={`pick-cover ${!mix && !expansion && filmId === f.id ? 'selected' : ''}`} onClick={() => { setMix(false); pickFilm(f.id); }}>
              <img src={asset(f.killer.select)} alt={f.name} />
              <span>{f.name}</span>
            </button>
          ))}
          <button className={`pick-cover ${expansion ? 'selected' : ''}`} onClick={pickExpansion}>
            <img src={asset(TERROR_FROM_ABOVE.killer.select)} alt={TERROR_FROM_ABOVE.name} />
            <span>{TERROR_FROM_ABOVE.name}</span>
          </button>
        </div>
        {expansion && <p className="muted">Mini-expansión: sin Asesino, solo Pájaros. Se juega sobre el Lugar y con la Chica Final que elijas.</p>}
        <label>
          <input type="checkbox" checked={mix} onChange={(e) => toggleMix(e.target.checked)} /> Mezclar (elegir Asesino, Lugar y Chica Final por separado)
        </label>
      </section>

      <section className="setup-section">
        <h2>Chica Final</h2>
        <div className="choice-row">
          {fgPool.map((fg) => (
            <button key={fg.id} className={`pick-card ${config.finalGirlId === fg.id ? 'selected' : ''}`} onClick={() => set('finalGirlId', fg.id)}>
              <img src={asset(fg.image)} alt={fg.name} />
            </button>
          ))}
        </div>
        <button className="btn small" onClick={randomFG}>Al azar</button>
        {(() => {
          const chosen = FINAL_GIRLS.find((f) => f.id === config.finalGirlId);
          return chosen ? (
            <div className="setup-ultimate">
              <div className="track-label">Habilidad Definitiva de {chosen.name} (se desbloquea al salvar a todas las Víctimas de su carta)</div>
              <img src={asset(chosen.ultimateImage)} alt={`Habilidad Definitiva de ${chosen.name}`} />
            </div>
          ) : null;
        })()}
      </section>

      {(mix || expansion) && <section className="setup-section two-col">
        {mix && <div>
          <h2>Asesino</h2>
          <div className="choice-row">
            {KILLERS.map((k) => (
              <button key={k.id} className={`pick-cover ${config.killerId === k.id ? 'selected' : ''}`} onClick={() => set('killerId', k.id)}>
                <img src={asset(k.select)} alt={k.name} />
                <span>{k.name}</span>
              </button>
            ))}
          </div>
        </div>}
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
      </section>}

      <section className="setup-section options">
        <h2>Opciones</h2>
        {birds && (
          <>
            <label>
              <input type="radio" checked={config.birdsSpecials === 1} onChange={() => set('birdsSpecials', 1)} /> Pájaros fácil (1 Víctima Especial)
            </label>
            <label>
              <input type="radio" checked={(config.birdsSpecials ?? 2) === 2} onChange={() => set('birdsSpecials', 2)} /> Pájaros normal (2 Víctimas Especiales)
            </label>
            <label>
              <input type="radio" checked={config.birdsSpecials === 3} onChange={() => set('birdsSpecials', 3)} /> Pájaros difícil (3 Víctimas Especiales)
            </label>
          </>
        )}
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
