import { useEffect, useMemo, useRef, useState } from 'react';
import { fgDef, killerDef, locationDef, serialize, type Game, type GameState, type LogEntry } from '../engine';
import { asset } from './asset';
import { Board } from './Board';
import { FinalGirlPanel, KillerPanel, LocationPanel } from './Panels';
import { Inventory } from './Inventory';
import { PromptPanel } from './PromptPanel';
import { useGame, type Settings } from './useGame';
import { ZoomProvider } from './Zoom';

const PHASES: Record<string, string> = {
  setup: 'Preparación',
  action: 'Acción',
  planning: 'Planificación',
  killer: 'Asesino',
  panic: 'Huida',
  upkeep: 'Mantenimiento',
};

interface Props {
  initial: Game;
  settings: Settings;
  onSettings: (s: Settings) => void;
  onExit: () => void;
}

export function GameView({ initial, settings, onSettings, onExit }: Props) {
  const g = useGame(initial, settings);
  const { state } = g;
  const [selectedVictims, setSelectedVictims] = useState<string[]>([]);
  const [showSettings, setShowSettings] = useState(false);

  // La selección de Víctimas se reinicia con cada pregunta nueva.
  const promptKey = JSON.stringify(state.prompt);
  // Al moverte, por defecto te siguen todas las Víctimas posibles (puedes desmarcarlas).
  useEffect(() => {
    const p = state.prompt;
    setSelectedVictims(p?.type === 'move' ? p.followers.slice(0, p.followLimit) : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promptKey]);

  const targets = useMemo(() => zoneTargets(state), [state]);
  const followLimit = state.prompt?.type === 'move' ? state.prompt.followLimit : 0;

  const onZone = (zone: string) => {
    const p = state.prompt;
    if (g.revealing || !p) return;
    if (p.type === 'move') g.send({ type: 'moveTo', zone, bring: selectedVictims });
    else if (p.type === 'choice' && p.options.some((o) => o.id === zone)) g.send({ type: 'choose', option: zone });
  };
  const onVictim = (id: string) => {
    if (state.prompt?.type === 'rescue') return;
    setSelectedVictims((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id].slice(-followLimit)));
  };

  const saveFile = () => {
    const blob = new Blob([serialize(g.game)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `final-girl-${fgDef(state).id}-turno-${state.turn}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const visibleLog = state.log.slice(0, g.shown);
  const lastDice = [...visibleLog].reverse().find((l) => l.anim?.kind === 'dice');

  return (
    <ZoomProvider>
      <div className="game">
        <header className="topbar">
          <span className="logo">Final Girl</span>
          <span className="matchup">
            {fgDef(state).name} vs {killerDef(state).name} · {locationDef(state).name}
          </span>
          <span className="phase-badge">Turno {state.turn} · {PHASES[state.phase]}</span>
          <div className="topbar-actions">
            <button className="btn small" disabled={!g.canUndo} onClick={g.undo} title="Deshace decisiones; no tiradas ni robos">↶ Deshacer</button>
            <button className="btn small" onClick={saveFile}>Guardar archivo</button>
            <button className="btn small" onClick={() => setShowSettings((v) => !v)}>Ajustes</button>
            <button className="btn small ghost" onClick={onExit}>Menú</button>
          </div>
          {showSettings && (
            <div className="settings">
              <label>
                <input type="radio" checked={settings.pacing === 'auto'} onChange={() => onSettings({ ...settings, pacing: 'auto' })} /> Automático
              </label>
              <label>
                <input type="radio" checked={settings.pacing === 'step'} onChange={() => onSettings({ ...settings, pacing: 'step' })} /> Paso a paso (botón Continuar)
              </label>
              <label>
                Velocidad
                <input type="range" min={100} max={1500} step={50} value={1600 - settings.speed} onChange={(e) => onSettings({ ...settings, speed: 1600 - Number(e.target.value) })} />
              </label>
            </div>
          )}
        </header>

        <main className="layout">
          <aside className="side-col left">
            <KillerPanel state={state} />
            <LocationPanel state={state} />
          </aside>
          <section className="board-col">
            <Board state={state} targets={g.revealing ? [] : targets} onZone={onZone} selectedVictims={selectedVictims} onVictim={onVictim} />
            {lastDice?.anim?.kind === 'dice' && <DiceTray key={g.shown} faces={lastDice.anim.faces} />}
          </section>
          <aside className="side-col right">
            <FinalGirlPanel state={state} />
            <section className="log-col">
              <Log entries={visibleLog} />
              {g.revealing && (
                <div className="reveal-controls">
                  {settings.pacing === 'step' && <button className="btn primary" onClick={g.next}>Continuar ▸</button>}
                  <button className="btn ghost" onClick={g.skip}>Saltar</button>
                </div>
              )}
            </section>
          </aside>
        </main>

        <footer className="bottom">
          {g.error && (
            <div className="toast" onClick={g.clearError}>
              {g.error}
            </div>
          )}
          {g.revealing && (
            <div className="waiting">
              {settings.pacing === 'step' ? 'Pulsa Continuar para ver lo siguiente que ocurre.' : 'Resolviendo…'}
              {settings.pacing === 'step' && <button className="btn primary" onClick={g.next}>Continuar ▸</button>}
              <button className="btn ghost" onClick={g.skip}>Saltar al final</button>
            </div>
          )}
          <div className="bottom-grid">
            <div className="bottom-main">
              <PromptPanel state={state} send={g.send} disabled={g.revealing} selectedVictims={selectedVictims} setSelectedVictims={setSelectedVictims} />
            </div>
            <Inventory state={state} {...(g.revealing ? {} : { onUse: (uid: string, action: string) => g.send({ type: 'useItem', uid, action }) })} />
          </div>
        </footer>

        {state.outcome && !g.revealing && <Outcome state={state} onExit={onExit} />}
      </div>
    </ZoomProvider>
  );
}

/** Zonas clicables según la pregunta actual. */
function zoneTargets(state: GameState): string[] {
  const p = state.prompt;
  if (p?.type === 'move') return p.to;
  if (p?.type === 'choice') {
    const zones = new Set(locationDef(state).zones.map((z) => z.id));
    return p.options.map((o) => o.id).filter((id) => zones.has(id));
  }
  return [];
}

function Log({ entries }: { entries: LogEntry[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: 'smooth' });
  }, [entries.length]);
  return (
    <div className="log" ref={ref}>
      {entries.map((e, i) => (
        <p key={i} className={`log-line ${e.tone ?? 'info'}`}>
          {e.text}
        </p>
      ))}
    </div>
  );
}

function DiceTray({ faces }: { faces: number[] }) {
  const [rolling, setRolling] = useState(true);
  useEffect(() => {
    const t = window.setTimeout(() => setRolling(false), 600);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <div className="dice-tray">
      {faces.map((f, i) => (
        <img key={i} className={`die ${rolling ? 'rolling' : ''}`} style={{ animationDelay: `${i * 60}ms` }} src={asset(`assets/core/dice/face-${rolling ? ((f + i) % 6) + 1 : f}.webp`)} alt={String(f)} />
      ))}
    </div>
  );
}

function Outcome({ state, onExit }: { state: GameState; onExit: () => void }) {
  const win = state.outcome!.winner === 'finalGirl';
  return (
    <div className="outcome-overlay">
      <div className={`outcome ${win ? 'win' : 'lose'}`}>
        <h2>{win ? '¡Sobrevives!' : 'Fin'}</h2>
        <p>{state.outcome!.text}</p>
        <p className="muted">
          Turno {state.turn} · Víctimas salvadas: {state.fg.saved} · Víctimas muertas: {state.dead.length}
        </p>
        <button className="btn primary" onClick={onExit}>Volver al menú</button>
      </div>
    </div>
  );
}
