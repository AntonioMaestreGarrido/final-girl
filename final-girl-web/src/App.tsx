import { useState } from 'react';
import type { Game } from './engine';
import { GameView } from './ui/GameView';
import { SetupScreen } from './ui/SetupScreen';
import { useSettings } from './ui/useGame';

export function App() {
  const [game, setGame] = useState<Game | null>(null);
  const [settings, setSettings] = useSettings();
  // `key` reinicia el estado interno de la vista al empezar otra partida.
  const [gameKey, setGameKey] = useState(0);

  if (!game) {
    return (
      <SetupScreen
        onStart={(g) => {
          setGame(g);
          setGameKey((k) => k + 1);
        }}
      />
    );
  }
  return <GameView key={gameKey} initial={game} settings={settings} onSettings={setSettings} onExit={() => setGame(null)} />;
}
