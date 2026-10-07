import { ACTION_BACK } from '../content';
import { boardDef, brVisible, eventDef, fgDef, horrorDef, itemDef, killerDef, killerRow, locationDef, zoneName, type GameState } from '../engine';
import { asset } from './asset';
import { Meeple } from './Meeple';
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

/** Sala de Calderas (Dr. Fright): las zonas ya reveladas de cada carta, tal como quedan al deslizar el mazo. */
function BoilerRoom({ state }: { state: GameState }) {
  const m = state.maple;
  if (!m || killerDef(state).id !== 'dr-fright') return null;
  const base = 'assets/killers/dr-fright/boiler';
  const W = 76;
  const H = 106;
  const xs = m.br.placed.map((c) => c.x);
  const ys = m.br.placed.map((c) => c.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const width = ((Math.max(...xs) - minX) + 2) * (W / 2);
  const height = ((Math.max(...ys) - minY) + 2) * (H / 2);
  return (
    <div className={`boiler ${m.asleep ? 'asleep' : 'awake'}`}>
      <div className="track-label">
        {m.asleep ? 'Dormida · Sala de Calderas' : 'Despierta'}
        {m.asleep && <small className="muted"> · quedan {m.br.deck.length} de 4 cartas por revelar</small>}
      </div>
      {m.asleep ? (
        <div className="boiler-stack" style={{ width, height }} data-tip="Las zonas visibles de las cartas de la Sala de Calderas. El Dr. Fright aparece una sola vez en cada una; si sale en la zona recién revelada, te ataca.">
          {m.br.placed.map((c, i) => {
            const z = m.br.placed.length - i;
            if (c.id === 'dd') {
              return <img key="dd" className="boiler-dd" src={asset(`${base}/asleep.webp`)} alt="Dormida" style={{ left: (c.x - minX) * (W / 2), top: (c.y - minY) * (H / 2), width: W, height: H, zIndex: z }} />;
            }
            return brVisible(m.br.placed, i).map((v) => (
              <div
                key={`${c.id}-${v.qx}-${v.qy}`}
                className="boiler-quad"
                style={{
                  left: (c.x - minX + v.qx) * (W / 2),
                  top: (c.y - minY + v.qy) * (H / 2),
                  width: W / 2,
                  height: H / 2,
                  backgroundImage: `url(${asset(`${base}/${c.id}.webp`)})`,
                  backgroundSize: `${W}px ${H}px`,
                  backgroundPosition: `-${v.qx * (W / 2)}px -${v.qy * (H / 2)}px`,
                  zIndex: z,
                }}
              />
            ));
          })}
        </div>
      ) : (
        <img className="boiler-awake" src={asset(`${base}/awake.webp`)} alt="Despierta" style={{ width: W }} />
      )}
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

const has2 = (state: GameState, custom: string) =>
  state.killer.darkPowers.some((dp) => dp.revealed && killerDef(state).darkPowers.find((d) => d.id === dp.id)?.custom === custom);

const BIRD_ROWS = ['Inicio', 'Evento', '+1 Terror', 'Poder Oscuro', '+1 Terror'];

/** Terror from Above: resumen de los Pájaros y de las Víctimas Especiales (lo que hay que salvar). */
function BirdsStatus({ state }: { state: GameState }) {
  const b = state.birds;
  const k = killerDef(state);
  if (!b || !k.minion) return null;
  const inPlay = state.victims.filter((v) => v.bsp).length;
  const wall = state.activeHorror.includes('muro-de-aves');
  return (
    <div className="minions-panel">
      <CardImg src={k.minion.reference} alt="Carta de Generar Pájaros" className="minion-ref" caption={`Generar Pájaros
Tira 2 dados: uno es el número de Pájaros y el otro decide dónde van.
1 distribuidos en cualquier espacio · 2 cualquier espacio individual · 3 más cerca de Búsqueda · 4 más cerca de Salida · 5 espacio de la Víctima más cercana · 6 tu espacio
${k.minion.text}`} />
      <div>
        <div className="track-label">Pájaros</div>
        <div className="minion-tokens" data-tip="Pájaros en el tablero. Pierdes si hay 3 en cada espacio.">
          <span>En el tablero <b>{state.minions.length}</b></span>
          {wall && <span data-tip="Muro de aves: fichas sobre la carta (con 5 se retira)">Muro <b>{b.wall}/5</b></span>}
        </div>
        <div className="minion-tokens" data-tip="Para ganar tienes que salvar a TODAS las Víctimas Especiales. Salen de su escondite al desbloquear tu Habilidad Definitiva o cuando no quedan Víctimas normales; nunca pueden ser atacadas ni asesinadas.">
          <span>Especiales salvadas <b>{b.saved}/{b.total}</b></span>
          <span>En juego <b>{inPlay}</b></span>
          <span>Escondidas <b>{b.hidden}</b></span>
        </div>
      </div>
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
      {k.birds ? null : k.invulnerable ? (
        <p className="muted" data-tip="No tiene Vida y no se le puede atacar, dañar ni eliminar. La única forma de ganar es llevar a Carolyn a una zona de Salida.">Sin Vida: no se le puede atacar.</p>
      ) : (
        <HealthBar hp={state.killer.health.hp} max={state.killer.health.max} token={state.killer.health.token} />
      )}
      {k.birds && <CardImg src={k.board} alt="Carta de Sed de Sangre" className="wide" caption={`Sed de Sangre
Casillas de abajo a arriba: Inicio, Evento, +1 Terror, Poder Oscuro, +1 Terror.
Máximo: ${k.bloodlustMaxText}.`} />}
      <div className="stats" hidden={!!k.birds}>
        <span className="stat attack" data-tip={`Valor de Ataque: daño de cada ataque de ${k.name}.`}>⚔ {row.attack}</span>
        <span className="stat move" data-tip="Valor de Movimiento: zonas por cada icono de movimiento.">👢 {row.move}</span>
        <span className="stat" data-tip="Sed de Sangre: sube cada vez que muere una Víctima.">🩸 {state.killer.bloodlust}/{k.bloodlust.length - 1}</span>
      </div>
      <div className="bloodlust">
        {k.bloodlust.map((r, i) => (
          <span key={i} className={`bl ${i === state.killer.bloodlust ? 'now' : ''} ${i < state.killer.bloodlust ? 'past' : ''} ${r.revealDarkPower ? 'dp' : ''} ${extraTrack?.rows[i - 1]?.text ? 'extra' : ''}`} data-tip={`Sed de Sangre ${i}: ${k.birds ? BIRD_ROWS[i] : `Ataque ${r.attack}, Movimiento ${r.move}`}${r.effects.length ? '. Al llegar: +1 Terror' : ''}${r.revealDarkPower ? '. Al llegar: se revela el Poder Oscuro' : ''}${extraTrack?.rows[i - 1]?.text ? `. Track de ${locationDef(state).name}: ${extraTrack.rows[i - 1]!.text}` : ''}${i === k.bloodlust.length - 1 ? `. Máximo: cada aumento extra, ${k.bloodlustMaxText ?? `${k.name} se cura 1 y se descarta la siguiente carta de Horror`}` : ''}`}>
            {k.birds ? BIRD_ROWS[i] : `${r.attack}/${r.move}`}
          </span>
        ))}
      </div>
      <WrathTrack state={state} id="killer" />
      <div className="art-stack">
        <div className="slot art-slot">
          <small className="art-label">Gran Final</small>
          <CardImg src={state.killer.finaleRevealed ? finale.image : k.finaleBack} alt={state.killer.finaleRevealed ? finale.name : 'Gran Final (oculto)'} className="wide" caption={state.killer.finaleRevealed ? `Gran Final: ${finale.name}
${finale.minionAction ? `Acción de Esbirro (primero): ${killerActionText(finale.minionAction)}
` : ''}Acción del Asesino cada turno: ${killerActionText(finale.finalAction)}${finale.text ? `
${finale.text}` : ''}${locationDef(state).finaleToken ? `
${locationDef(state).finaleToken!.text}` : ''}` : `Gran Final (boca abajo hasta que se acabe el mazo de Horror)
${k.initialMinionAction ? `Acción de Esbirro (primero): ${killerActionText(k.initialMinionAction)}
` : ''}Acción del Asesino cada turno: ${killerActionText(k.initialAction)}`} />
        </div>
        {state.killer.darkPowers.map((dp) => {
          const def = k.darkPowers.find((d) => d.id === dp.id)!;
          return (
            <div className="slot art-slot" key={dp.id}>
              <small className="art-label">Poder Oscuro</small>
              <CardImg src={dp.revealed ? def.image : k.darkPowerBack} alt={dp.revealed ? def.name : 'Poder Oscuro (oculto)'} className="wide" caption={dp.revealed ? `Poder Oscuro${def.epic ? ' Épico' : ''}: ${def.name}
${def.text}` : 'Poder Oscuro boca abajo: se revela al llegar a su casilla de Sed de Sangre o en el Gran Final.'} />
            </div>
          );
        })}
      </div>
      <BoilerRoom state={state} />
      <BirdsStatus state={state} />
      {k.minion && !k.birds && (
        <div className="minions-panel">
          <CardImg src={k.minion.reference} alt={`Carta de ${k.minion.plural}`} className="minion-ref" caption={`${k.minion.plural}
${k.minion.text}`} />
          <div>
            <div className="track-label">{k.minion.plural}</div>
            <div className="minion-tokens" data-tip={`Listas: aparecen una por fase del Asesino hasta el Gran Final. Agotadas: destruidas; vuelven a Listo al aparecer la siguiente. En el tablero: ${state.minions.length}.`}>
              <span>Listas <b>{state.minionPool.ready.length}</b></span>
              <span>En el tablero <b>{state.minions.length}</b></span>
              <span>Agotadas <b>{state.minionPool.exhausted.length}</b></span>
            </div>
            <small className="muted">1 Vida · Ataque {k.minion.attack}{has2(state, 'dp-weapon-graft') ? '+1' : ''} · Movimiento {row.move} · terminan a ≤2 de {k.name}</small>
          </div>
        </div>
      )}
      {state.killer.minors.length > 0 && (
        <div className="card-row">
          {state.killer.minors.map((m) => (
            <div className="slot" key={m.id}>
              <small>Poder Oscuro Menor{k.invulnerable ? '' : ` · ${m.hp} ♥`}</small>
              <CardImg src={horrorDef(state, m.id).image} alt={horrorDef(state, m.id).name} caption={`${horrorDef(state, m.id).name}
${horrorDef(state, m.id).text}
${k.invulnerable ? 'Se retira del juego cuando Carolyn se une a ti.' : `Tus golpes quitan primero sus Vidas (${m.hp}); al perderlas, se descarta.`}`} />
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

/** Centro de cada hueco de Víctima Salvada en la carta (fracciones del ancho y alto), según cuántos huecos tiene. */
function rescueSlotPos(i: number, n: number): { x: number; y: number } {
  const cols = [0.11, 0.3, 0.48];
  const offset = [0.21, 0.39];
  const row1 = n === 4 ? 2 : 3;
  const y = i < row1 ? 0.4 : 0.78;
  if (i < row1) return { x: cols[i]!, y };
  const j = i - row1;
  if (n === 4) return { x: cols[j]!, y };
  return { x: n === 5 ? offset[j]! : cols[j]!, y };
}

export function FinalGirlPanel({ state }: { state: GameState }) {
  const fg = fgDef(state);
  const board = boardDef(state);
  return (
    <section className="panel fg-panel">
      <h3>{fg.name}</h3>
      <HealthBar hp={state.fg.health.hp} max={state.fg.health.max} token={state.fg.health.token} />
      {(state.fg.legTrap || state.fg.cobra) && (
        <div className="fg-status">
          {state.fg.legTrap && <span className="status bad" data-tip="Trampa para osos en la pierna: no puedes moverte hasta que gastes 2 Tiempo en quitártela (botón de la fase de Acción).">⛓ Trampa en la pierna</span>}
          {state.fg.cobra && <span className="status bad" data-tip="Cobra oculta: pierdes 1 Vida en cada Mantenimiento. La próxima vez que recuperes Vida, se descarta en su lugar.">🐍 Cobra oculta</span>}
        </div>
      )}

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
        <div className="fg-card-wrap">
          <CardImg src={state.fg.ultimate ? fg.ultimateImage : fg.image} alt={fg.name} className="wide fg-card" caption={finalGirlCaption(fg, state.fg.ultimate)} />
          {!state.fg.ultimate && state.fg.rescueSlots.map((used, i) => {
            if (!used) return null;
            const p = rescueSlotPos(i, fg.rescueSlots.length);
            return (
              <span key={i} className="rescued-token" style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }} data-tip={`Víctima salvada: ${fg.rescueSlots[i]!.text}`}>
                <Meeple color="#f2c230" />
              </span>
            );
          })}
        </div>
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
          const name = zoneName(state, zone);
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
