import { useEffect, useState } from 'react';
import { eventDef, horrorDef, itemDef, killerDef, locationDef, type GameState, type LogEntry } from '../engine';
import { asset } from './asset';

type RevealedCard = NonNullable<LogEntry['card']>;

interface Face {
  label: string;
  name: string;
  text: string;
  image: string;
  /** Reverso con imagen; las cartas de Horror no tienen y llevan uno generado. */
  back?: string;
}

/** Quita símbolos e iconos (♥ ▶ emojis...) del texto de reglas. */
export const stripIcons = (text: string) =>
  text.replace(/[←-⯿\u{1F000}-\u{1FAFF}️]/gu, '').replace(/[ \t]+/g, ' ').replace(/ +([.,;:])/g, '$1').trim();

function faceOf(state: GameState, c: RevealedCard): Face {
  const k = killerDef(state);
  switch (c.kind) {
    case 'horror': {
      const d = horrorDef(state, c.id);
      return { label: 'Carta de Horror', name: d.name, text: d.text, image: d.image };
    }
    case 'event': {
      const d = eventDef(state, c.id);
      return { label: 'Evento', name: d.name, text: d.text, image: d.image, back: locationDef(state).eventBack };
    }
    case 'finale': {
      const d = k.finales.find((f) => f.id === c.id)!;
      return { label: 'Gran Final', name: d.name, text: d.text ?? '', image: d.image, back: k.finaleBack };
    }
    case 'darkPower': {
      const d = k.darkPowers.find((p) => p.id === c.id)!;
      return { label: 'Poder Oscuro', name: d.name, text: d.text, image: d.image, back: k.darkPowerBack };
    }
    case 'item': {
      const d = itemDef(state, c.id);
      return { label: 'Objeto', name: d.name, text: d.text, image: d.image, back: d.image.replace(/[^/]+$/, 'back.webp') };
    }
  }
}

/** Duración del reverso antes de girar la carta; después espera a que el jugador haga clic. */
const FLIP_AT = 700;

/** Carta revelada en el centro de la pantalla: primero el reverso, luego gira y muestra el texto debajo. */
export function CardReveal({ state, card, onClose }: { state: GameState; card: RevealedCard; onClose: () => void }) {
  const [flipped, setFlipped] = useState(false);
  const face = faceOf(state, card);

  useEffect(() => {
    const t = window.setTimeout(() => setFlipped(true), FLIP_AT);
    return () => window.clearTimeout(t);
  }, []);

  const text = stripIcons(face.text);
  return (
    <div className="card-reveal" onClick={onClose} role="dialog" aria-label={`${face.label}: ${face.name}`}>
      <div className="card-reveal-box">
        <small className="card-reveal-kind">{face.label}</small>
        <div className={`card-flip ${flipped ? 'flipped' : ''}`}>
          <div className="card-side card-back">
            {face.back ? (
              <img src={asset(face.back)} alt="" draggable={false} />
            ) : (
              <div className="card-back-horror">
                <span>HORROR</span>
                <small>{killerDef(state).name}</small>
              </div>
            )}
          </div>
          <div className="card-side card-front">
            <img src={asset(face.image)} alt={face.name} draggable={false} />
          </div>
        </div>
        <div className={`card-reveal-text ${flipped ? 'visible' : ''}`}>
          <b>{face.name}</b>
          {text && <p>{text}</p>}
        </div>
        <small className={`card-reveal-hint ${flipped ? 'visible' : ''}`}>Haz clic para continuar</small>
      </div>
    </div>
  );
}
