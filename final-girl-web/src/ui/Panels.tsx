import { ACTION_BACK } from '../content';
import { boardDef, eventDef, fgDef, horrorDef, itemDef, killerDef, killerRow, locationDef, type GameState } from '../engine';
import { finalGirlCaption, itemCaption, killerActionText } from './captions';
import { CardImg } from './Zoom';
import type { WrathId } from '../content/types';

/** Medidor de Ira (Ira Asesina o Ira Divina) con la carta y el nivel actual. */
function WrathTrack({ state, id }: { state: GameState; id: WrathId }) {
  const level = state.wrath?.[id];
  const track = id === 'killer' ? killerDef(state).wrath : locationDef(state).wrath;
  if (level === undefined || !track) return null;
  return (
    <div className={`wrath ${id}`}>
      <CardImg src={track.image} alt={track.name} className="wrath-card" caption={`${track.name} · nivel ${level}\nAl Desatarla se aplica la línea de su nivel:\n${track.levels.map((l, i) => `${i + 1}. ${l.text}`).join('\n')}`} />
      <div>
        <div className="track-label">{track.name} <b>{level}</b></div>
        <div className="wrath-track">
          {track.levels.map((l, i) => (
            <span key={i} className={`wr ${i + 1 === level ? 'now' : ''} ${i + 1 < level ? 'past' : ''}`} data-tip={`Nivel ${i + 1}: ${l.text}`}>{i + 1}</span>
          ))}
        </div>
        <small className="muted">Desatar aplica: {track.levels[level - 1]!.text}</small>
      </div>
    </div>
  );
}

function HealthBar({ hp, max, token }: { hp: number; max: number; token: 'black' | 'white' }) {
  return (
    <div className="health" data-tip={`Vida: ${hp} de ${max}. El primer corazón es la ficha de Vida Final (${token === 'black' ? 'negra, aún sin revelar' : 'blanca, ya revelada'}).`}>
      {Array.from({ length: Math.max(max, hp) }, (_, i) => {
        const filled = i < hp;
        const isToken = i === 0;
        return <span key={i} className={`heart ${filled ? 'on' : 'off'} ${isToken ? `final ${token}` : ''}`} />;
      })}
      <span className="health-num">{hp}</span>
    </div>
  );
}

export function KillerPanel({ state }: { state: GameState }) {
  const k = killerDef(state);
  const row = killerRow(state);
  const finale = k.finales.find((f) => f.id === state.killer.finale)!;
  const extraTrack = locationDef(state).bloodlustTrack;
  return (
    <section className="panel killer-panel">
      <h3>{k.name}</h3>
      <HealthBar hp={state.killer.health.hp} max={state.killer.health.max} token={state.killer.health.token} />
      <div className="stats">
        <span className="stat attack" data-tip={`Valor de Ataque: daño de cada ataque de ${k.name}.`}>⚔ {row.attack}</span>
        <span className="stat move" data-tip="Valor de Movimiento: zonas por cada icono de movimiento.">👢 {row.move}</span>
        <span className="stat" data-tip="Sed de Sangre: sube cada vez que muere una Víctima.">🩸 {state.killer.bloodlust}/{k.bloodlust.length - 1}</span>
      </div>
      <div className="bloodlust">
        {k.bloodlust.map((r, i) => (
          <span key={i} className={`bl ${i === state.killer.bloodlust ? 'now' : ''} ${i < state.killer.bloodlust ? 'past' : ''} ${r.revealDarkPower ? 'dp' : ''} ${extraTrack?.rows[i - 1]?.text ? 'extra' : ''}`} data-tip={`Sed de Sangre ${i}: Ataque ${r.attack}, Movimiento ${r.move}${r.effects.length ? '. Al llegar: +1 Terror' : ''}${r.revealDarkPower ? '. Al llegar: se revela el Poder Oscuro' : ''}${extraTrack?.rows[i - 1]?.text ? `. Track de ${locationDef(state).name}: ${extraTrack.rows[i - 1]!.text}` : ''}${i === k.bloodlust.length - 1 ? `. Máximo: cada aumento extra, ${k.bloodlustMaxText ?? `${k.name} se cura 1 y se descarta la siguiente carta de Horror`}` : ''}`}>
            {r.attack}/{r.move}
          </span>
        ))}
      </div>
      <WrathTrack state={state} id="killer" />
      <div className="card-row">
        <div className="slot">
          <small>Gran Final</small>
          <CardImg src={state.killer.finaleRevealed ? finale.image : k.finaleBack} alt={state.killer.finaleRevealed ? finale.name : 'Gran Final (oculto)'} className="wide" caption={state.killer.finaleRevealed ? `Gran Final: ${finale.name}
Acción del Asesino cada turno: ${killerActionText(finale.finalAction)}${finale.text ? `
${finale.text}` : ''}${locationDef(state).finaleToken ? `
${locationDef(state).finaleToken!.text}` : ''}` : `Gran Final (boca abajo hasta que se acabe el mazo de Horror)
Acción del Asesino cada turno: ${killerActionText(k.initialAction)}`} />
        </div>
        {state.killer.darkPowers.map((dp) => {
          const def = k.darkPowers.find((d) => d.id === dp.id)!;
          return (
            <div className="slot" key={dp.id}>
              <small>Poder Oscuro</small>
              <CardImg src={dp.revealed ? def.image : k.darkPowerBack} alt={dp.revealed ? def.name : 'Poder Oscuro (oculto)'} className="wide" caption={dp.revealed ? `Poder Oscuro${def.epic ? ' Épico' : ''}: ${def.name}
${def.text}` : 'Poder Oscuro boca abajo: se revela al llegar a su casilla de Sed de Sangre o en el Gran Final.'} />
            </div>
          );
        })}
      </div>
      {state.killer.minors.length > 0 && (
        <div className="card-row">
          {state.killer.minors.map((m) => (
            <div className="slot" key={m.id}>
              <small>Poder Oscuro Menor · {m.hp} ♥</small>
              <CardImg src={horrorDef(state, m.id).image} alt={horrorDef(state, m.id).name} caption={`${horrorDef(state, m.id).name}
${horrorDef(state, m.id).text}
Tus golpes quitan primero sus Vidas (${m.hp}); al perderlas, se descarta.`} />
            </div>
          ))}
        </div>
      )}
      <div className="decks">
        <span>Mazo de Horror: <b>{state.horrorDeck.length}</b></span>
        <span>Muertas: <b>{state.dead.length}</b></span>
        <span>En la caja: <b>{state.victimPool}</b></span>
      </div>
    </section>
  );
}

export function FinalGirlPanel({ state }: { state: GameState }) {
  const fg = fgDef(state);
  const board = boardDef(state);
  return (
    <section className="panel fg-panel">
      <h3>{fg.name}</h3>
      <HealthBar hp={state.fg.health.hp} max={state.fg.health.max} token={state.fg.health.token} />

      <div className="track-label">Terror</div>
      <div className="terror-track">
        {board.terrorTrack.map((p, i) => (
          <span key={i} className={`terror-pos ${i === state.fg.terror ? 'now' : ''} ${i === 0 ? 'green' : i === board.terrorTrack.length - 1 ? 'red' : ''}`} data-tip={`${p.label === null ? (i === 0 ? 'Mínimo' : 'Máximo') : `Terror ${p.label}`}: tiras ${p.dice} ${p.dice === 1 ? 'dado' : 'dados'}.${i === 0 ? ' Si baja más: +1 Tiempo.' : i === board.terrorTrack.length - 1 ? ' Si sube más: +1 Sed de Sangre.' : ''}`}>
            {p.label ?? (i === 0 ? '⌛' : '🩸')}
            <small>{'●'.repeat(p.dice)}</small>
          </span>
        ))}
      </div>

      <div className="track-label">Tiempo</div>
      <div className="time-track">
        {[-1, ...Array.from({ length: board.maxTime + 1 }, (_, i) => i)].map((t) => (
          <span key={t} data-tip={t < 0 ? 'Bajo cero: la fase de Acción termina y no puedes recuperar Tiempo.' : t === board.startTime ? `Tiempo inicial de cada turno (${t}).` : `Tiempo ${t}`} className={`time-pos ${t === state.fg.time ? 'now' : ''} ${t < 0 ? 'neg' : ''} ${t === board.startTime ? 'start' : ''}`}>{t < 0 ? '✕' : t}</span>
        ))}
      </div>

      <div className="card-row">
        <CardImg src={state.fg.ultimate ? fg.ultimateImage : fg.image} alt={fg.name} className="wide fg-card" caption={finalGirlCaption(fg, state.fg.ultimate)} />
      </div>
      <div className="rescue-slots">
        {fg.rescueSlots.map((slot, i) => (
          <span key={i} className={`rescue ${state.fg.rescueSlots[i] ? 'filled' : ''}`} data-tip={state.fg.rescueSlots[i] ? 'Espacio ocupado' : `Al salvar una Víctima en este espacio: ${slot.text}`}>{slot.text}</span>
        ))}
      </div>
      {state.fg.ultimate && <p className="ultimate">★ {fg.ultimate.text}</p>}

    </section>
  );
}

/** Mazos de Objeto del Lugar y Eventos activos. */
export function LocationPanel({ state }: { state: GameState }) {
  const loc = locationDef(state);
  return (
    <section className="panel location-panel">
      <WrathTrack state={state} id="divine" />
      <h4 className="panel-sub">Objetos por encontrar · juega <b>Buscar</b> en la zona para coger la carta de arriba</h4>
      <div className="card-row">
        {loc.itemDecks.map((zone) => {
          const deck = state.itemDecks[zone] ?? [];
          const top = deck[0];
          const name = loc.zones.find((z) => z.id === zone)!.label;
          return (
            <div className="slot" key={zone}>
              <small>Mazo de {name} ({deck.length})</small>
              {top ? (
                <CardImg src={top.faceUp ? itemDef(state, top.id).image : loc.items[0] ? itemBack(loc.items[0].image) : ACTION_BACK} alt={top.faceUp ? itemDef(state, top.id).name : `Mazo de ${name}`} caption={top.faceUp ? `Aún no es tuyo: está encima del mazo de ${name}.
Ve a ${name} y juega Buscar para cogerlo.

${itemCaption(itemDef(state, top.id))}` : `Mazo de Objetos de ${name}: ${deck.length} cartas, la de arriba boca abajo.
Ve a ${name} y juega Buscar para robarla.`} />
              ) : (
                <div className="empty-slot">Vacío</div>
              )}
            </div>
          );
        })}
        {(state.activeHorror ?? []).map((id) => (
          <div className="slot" key={id}>
            <small>En juego</small>
            <CardImg src={horrorDef(state, id).image} alt={horrorDef(state, id).name} caption={`${horrorDef(state, id).name}
${horrorDef(state, id).text}`} />
          </div>
        ))}
        {state.activeEvents.map((id) => (
          <div className="slot event" key={id}>
            <small>Evento</small>
            <CardImg src={eventDef(state, id).image} alt={eventDef(state, id).name} caption={`Evento: ${eventDef(state, id).name}
${eventDef(state, id).text}`} className="wide" />
          </div>
        ))}
      </div>
    </section>
  );
}

const itemBack = (anyItemImage: string) => anyItemImage.replace(/[^/]+\.webp$/, 'back.webp');
