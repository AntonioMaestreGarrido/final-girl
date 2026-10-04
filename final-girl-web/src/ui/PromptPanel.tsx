import { useState } from 'react';
import type { CardId } from '../content/types';
import { actionDef, fgDef, itemDef, killerDef, locationDef, type GameState, type Input, type Prompt } from '../engine';
import { asset } from './asset';
import { actionCaption, itemCaption } from './captions';
import { CardImg } from './Zoom';

interface Props {
  state: GameState;
  send: (input: Input) => void;
  disabled: boolean;
  /** Selección compartida con el tablero (Víctimas que te siguen / se salvan). */
  selectedVictims: string[];
  setSelectedVictims: (ids: string[]) => void;
}

const roleName = (role?: string) => (role === 'novio' ? 'Novio' : role === 'novia' ? 'Novia' : role === 'maldita' ? 'La Maldita' : 'Víctima');

export function PromptPanel(props: Props) {
  const { state } = props;
  const p = state.prompt;
  if (state.outcome) return null;
  if (!p) return <div className="prompt"><Hand state={state} /></div>;
  return (
    <div className={`prompt ${props.disabled ? 'disabled' : ''}`}>
      <PromptBody {...props} prompt={p} />
    </div>
  );
}

function PromptBody({ state, send, prompt: p, selectedVictims, setSelectedVictims }: Props & { prompt: Prompt }) {
  switch (p.type) {
    case 'main':
      return <MainPrompt state={state} send={send} prompt={p} />;
    case 'roll':
      return <RollPrompt state={state} send={send} prompt={p} />;
    case 'choice':
      return (
        <div className="prompt-block">
          <h4>{p.title}</h4>
          <div className="buttons">
            {p.options.map((o) => (
              <button key={o.id} className="btn" disabled={!!o.disabled} onClick={() => send({ type: 'choose', option: o.id })}>{o.label}</button>
            ))}
          </div>
          <Hand state={state} />
        </div>
      );
    case 'move': {
      const followers = state.victims.filter((v) => p.followers.includes(v.id));
      return (
        <div className="prompt-block">
          <h4>{p.mode === 'boat' ? 'Viaje en bote: elige destino en el mapa' : p.mode === 'free' ? 'Muévete a la zona del Asesino' : `Muévete: te quedan ${p.remaining} ${p.remaining === 1 ? 'zona' : 'zonas'}. Haz clic en una zona resaltada.`}</h4>
          {followers.length > 0 && (
            <p>
              Te siguen las Víctimas marcadas (máx. {p.followLimit}; desmarca las que quieras dejar). Llévalas a una <b>Zona de Salida</b> para salvarlas:{' '}
              {followers.map((v) => (
                <label key={v.id} className="chip">
                  <input
                    type="checkbox"
                    checked={selectedVictims.includes(v.id)}
                    onChange={(e) => setSelectedVictims(e.target.checked ? [...selectedVictims, v.id].slice(-p.followLimit) : selectedVictims.filter((x) => x !== v.id))}
                  />
                  {roleName(v.role)}
                </label>
              ))}
            </p>
          )}
          <div className="buttons actions">
            {p.to.map((z) => (
              <button key={z} className="btn" onClick={() => send({ type: 'moveTo', zone: z, bring: selectedVictims })}>{locationDef(state).zones.find((x) => x.id === z)!.label}</button>
            ))}
            {p.mode === 'walk' && <button className="btn ghost" onClick={() => send({ type: 'stopMoving' })}>Dejar de moverme</button>}
          </div>
        </div>
      );
    }
    case 'rescue':
      return <RescuePrompt state={state} send={send} prompt={p} />;
    case 'react':
      return (
        <div className="prompt-block danger">
          <h4>¡{killerDef(state).name} te ataca! {p.damage} de daño.</h4>
          <div className="buttons actions">
            {p.cards.map((c) => (
              <button key={c} className="btn" onClick={() => send({ type: 'react', cardId: c })}>Reaccionar: {actionDef(c).name}</button>
            ))}
            {p.lid && <button className="btn" onClick={() => send({ type: 'useLid' })}>Tapadera (−1 daño)</button>}
            {p.spray && <button className="btn" onClick={() => send({ type: 'pepperSpray' })}>Spray de pimienta (termina la fase)</button>}
            <button className="btn primary" onClick={() => send({ type: 'takeHit' })}>Recibir el golpe</button>
          </div>
          <Hand state={state} />
        </div>
      );
    case 'search':
      return <SearchPrompt state={state} send={send} prompt={p} />;
    case 'arrange':
      return <ArrangePrompt state={state} send={send} prompt={p} />;
    case 'planning':
      return <PlanningPrompt state={state} send={send} prompt={p} />;
    case 'discardDown':
      return <SelectCards state={state} count={p.excess} title={`Tienes más de 10 cartas: descarta ${p.excess}.`} onConfirm={(cards) => send({ type: 'discardDown', cardIds: cards })} />;
  }
}

// ---------------------------------------------------------------- mano

function Hand({ state, playable = [], selected = [], onCard }: { state: GameState; playable?: CardId[]; selected?: number[]; onCard?: (i: number) => void }) {
  return (
    <div className="hand">
      {state.fg.hand.map((c, i) => {
        const def = actionDef(c);
        const can = playable.includes(c);
        return (
          <div key={i} className={`hand-card ${can ? 'playable' : ''} ${selected.includes(i) ? 'selected' : ''}`}>
            <CardImg src={def.image} alt={def.name} caption={actionCaption(def)} onClick={onCard ? () => onCard(i) : undefined} />
          </div>
        );
      })}
      {!state.fg.hand.length && <p className="muted">Sin cartas en la mano.</p>}
    </div>
  );
}

function MainPrompt({ state, send, prompt: p }: { state: GameState; send: Props['send']; prompt: Extract<Prompt, { type: 'main' }> }) {
  const [mode, setMode] = useState<'play' | 'discard'>('play');
  const [selected, setSelected] = useState<number[]>([]);
  const [weaponFor, setWeaponFor] = useState<CardId | null>(null);
  const playable = p.playable.map((x) => x.cardId);
  const sameZone = state.fg.zone === state.killer.zone;

  const onCard = (i: number) => {
    const c = state.fg.hand[i]!;
    if (mode === 'discard') return setSelected((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]));
    const entry = p.playable.find((x) => x.cardId === c);
    if (!entry) return;
    if (entry.weapons.length) return setWeaponFor(c);
    send({ type: 'playCard', cardId: c });
  };

  const weapons = weaponFor ? p.playable.find((x) => x.cardId === weaponFor)!.weapons : [];
  return (
    <div className="prompt-block">
      <h4>
        {mode === 'play' ? 'Fase de Acción: juega una carta, usa un objeto o termina la fase.' : 'Elige las cartas que descartas (+1 Tiempo cada una).'}
        <span className="time-badge">Tiempo: {state.fg.time < 0 ? 'bajo cero' : state.fg.time}</span>
      </h4>
      {weaponFor && (
        <div className="popover">
          <span>¿Con qué arma juegas {actionDef(weaponFor).name}?</span>
          {weapons.map((u) => {
            const def = itemDef(state, state.fg.items.find((i) => i.uid === u)!.id);
            return <button key={u} className="btn" onClick={() => { send({ type: 'playCard', cardId: weaponFor, weaponUid: u }); setWeaponFor(null); }}>{def.name} (+{def.damage})</button>;
          })}
          {sameZone && <button className="btn" onClick={() => { send({ type: 'playCard', cardId: weaponFor }); setWeaponFor(null); }}>Sin arma</button>}
          <button className="btn ghost" onClick={() => setWeaponFor(null)}>Cancelar</button>
        </div>
      )}
      <Hand state={state} playable={mode === 'play' ? playable : state.fg.hand} selected={selected} onCard={onCard} />
      <div className="buttons actions">
        {mode === 'play' ? (
          <>
            {p.canRescue && <button className="btn good" onClick={() => send({ type: 'startRescue' })}>Salvar Víctimas</button>}
            {p.itemActions.map((a) => (
              <button key={`${a.uid}-${a.action}`} className="btn" onClick={() => send({ type: 'useItem', uid: a.uid, action: a.action })}>{a.label}</button>
            ))}
            {p.ultimate && <button className="btn good" onClick={() => send({ type: 'ultimate' })}>Habilidad Definitiva: ir a por el Asesino</button>}
            {state.fg.hand.length > 0 && <button className="btn ghost" onClick={() => setMode('discard')}>Descartar por Tiempo…</button>}
            <button className="btn primary" onClick={() => send({ type: 'endActionPhase' })}>Terminar fase de Acción</button>
          </>
        ) : (
          <>
            <button className="btn primary" disabled={!selected.length} onClick={() => { send({ type: 'discardForTime', cardIds: selected.map((i) => state.fg.hand[i]!) }); setSelected([]); setMode('play'); }}>
              Descartar {selected.length} (+{selected.length} Tiempo)
            </button>
            <button className="btn ghost" onClick={() => { setSelected([]); setMode('play'); }}>Cancelar</button>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- tiradas

function RollPrompt({ state, send, prompt: p }: { state: GameState; send: Props['send']; prompt: Extract<Prompt, { type: 'roll' }> }) {
  const [mode, setMode] = useState<'none' | 'convert' | 'closeCall' | 'lucky'>('none');
  const [die, setDie] = useState<number | null>(null);
  const [cards, setCards] = useState<number[]>([]);
  const [luckySel, setLuckySel] = useState<number[]>([]);
  const partial = (f: number, i: number) => (f === 3 || f === 4) && !p.converted.includes(i) && !p.auto34;
  const successes = p.dice.reduce((n, f, i) => n + (f >= 5 || p.converted.includes(i) || (p.auto34 && (f === 3 || f === 4)) ? 1 : 0), 0);
  const label = successes >= 2 ? 'éxito doble' : successes === 1 ? 'éxito' : 'fracaso';
  const what = p.purpose.kind === 'item' ? 'Pata de conejo' : p.purpose.kind === 'effect' ? p.purpose.label : actionDef(p.purpose.cardId).name;

  const clickDie = (i: number) => {
    if (mode === 'closeCall') {
      send({ type: 'closeCall', die: i });
      setMode('none');
    } else if (mode === 'lucky') setLuckySel((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]));
    else if (partial(p.dice[i]!, i) && state.fg.hand.length >= 2) {
      setMode('convert');
      setDie(i);
      setCards([]);
    }
  };

  return (
    <div className="prompt-block">
      <h4>Tirada de Terror · {what}: {successes} {successes === 1 ? 'éxito' : 'éxitos'} ({label})</h4>
      <div className="dice-row">
        {p.dice.map((f, i) => (
          <button key={i} className={`die-btn ${p.converted.includes(i) ? 'converted' : ''} ${partial(f, i) ? 'partial' : ''} ${die === i || luckySel.includes(i) ? 'selected' : ''}`} onClick={() => clickDie(i)}>
            <img src={asset(`assets/core/dice/face-${f}.webp`)} alt={String(f)} />
          </button>
        ))}
      </div>
      {mode === 'none' && p.dice.some(partial) && state.fg.hand.length >= 2 && <p className="hint">Haz clic en un 3 o un 4 para convertirlo en éxito descartando 2 cartas.</p>}
      {mode === 'convert' && (
        <>
          <p className="hint">Elige 2 cartas para descartar.</p>
          <Hand state={state} playable={state.fg.hand} selected={cards} onCard={(i) => setCards((c) => (c.includes(i) ? c.filter((x) => x !== i) : [...c, i].slice(-2)))} />
        </>
      )}
      {mode === 'closeCall' && <p className="hint">Haz clic en el dado que quieres repetir.</p>}
      {mode === 'lucky' && <p className="hint">Elige los dados que repites con los Dados de la suerte.</p>}
      <div className="buttons actions">
        {mode === 'convert' && (
          <button className="btn primary" disabled={cards.length !== 2} onClick={() => { send({ type: 'convertPartial', die: die!, discard: [state.fg.hand[cards[0]!]!, state.fg.hand[cards[1]!]!] }); setMode('none'); setDie(null); }}>Convertir</button>
        )}
        {mode === 'lucky' && <button className="btn primary" disabled={!luckySel.length} onClick={() => { send({ type: 'luckyDice', dice: luckySel }); setMode('none'); setLuckySel([]); }}>Repetir {luckySel.length}</button>}
        {mode === 'none' && p.canCloseCall && (
          <>
            <button className="btn" onClick={() => setMode('closeCall')}>Por los pelos: repetir 1 dado</button>
            <button className="btn" onClick={() => send({ type: 'closeCall' })}>Por los pelos: repetir todos (−2 Tiempo)</button>
          </>
        )}
        {mode === 'none' && p.canLuckyDice && <button className="btn" onClick={() => setMode('lucky')}>Dados de la suerte</button>}
        {mode !== 'none' && <button className="btn ghost" onClick={() => { setMode('none'); setDie(null); setLuckySel([]); }}>Cancelar</button>}
        {mode === 'none' && <button className="btn primary" onClick={() => send({ type: 'confirmRoll' })}>Aceptar resultado</button>}
      </div>
      {mode !== 'convert' && <Hand state={state} />}
    </div>
  );
}

// ---------------------------------------------------------------- rescate, búsqueda, inventario, compra

function RescuePrompt({ state, send, prompt: p }: { state: GameState; send: Props['send']; prompt: Extract<Prompt, { type: 'rescue' }> }) {
  const fg = fgDef(state);
  const [victim, setVictim] = useState<string | null>(p.victims[0] ?? null);
  const v = state.victims.find((x) => x.id === victim);
  return (
    <div className="prompt-block good">
      <h4>Zona de Salida: ¿a quién salvas?</h4>
      <div className="buttons">
        {p.victims.map((id) => {
          const vic = state.victims.find((x) => x.id === id)!;
          return <button key={id} className={`btn ${victim === id ? 'selected' : ''}`} onClick={() => setVictim(id)}>{roleName(vic.role)}</button>;
        })}
      </div>
      {v && (
        <>
          <p>{p.ultimate ? `Recompensa tras la Habilidad Definitiva.` : 'Elige el espacio de Víctima Salvada (su recompensa):'}</p>
          <div className="buttons">
            {p.ultimate ? (
              <button className="btn primary" onClick={() => send({ type: 'rescueOne', victimId: v.id, slot: 0 })}>Salvar</button>
            ) : (
              p.slots.map((i) => (
                <button key={i} className="btn primary" onClick={() => send({ type: 'rescueOne', victimId: v.id, slot: i })}>{fg.rescueSlots[i]!.text}</button>
              ))
            )}
          </div>
        </>
      )}
      <div className="buttons actions">
        <button className="btn ghost" onClick={() => send({ type: 'rescueDone' })}>No salvar más</button>
      </div>
    </div>
  );
}

function SearchPrompt({ state, send, prompt: p }: { state: GameState; send: Props['send']; prompt: Extract<Prompt, { type: 'search' }> }) {
  const [keep, setKeep] = useState(0);
  return (
    <div className="prompt-block">
      <h4>Buscar: quédate con uno de los dos Objetos.</h4>
      <div className="card-row">
        {p.drawn.map((id, i) => (
          <div key={i} className={`slot pickable ${keep === i ? 'selected' : ''}`}>
            <CardImg src={itemDef(state, id).image} alt={itemDef(state, id).name} caption={itemCaption(itemDef(state, id))} onClick={() => setKeep(i)} />
          </div>
        ))}
      </div>
      <div className="buttons actions">
        <button className="btn primary" onClick={() => send({ type: 'searchPick', keep, otherTo: 'top' })}>Quedármelo; el otro encima bocarriba</button>
        <button className="btn primary" onClick={() => send({ type: 'searchPick', keep, otherTo: 'bottom' })}>Quedármelo; el otro debajo bocabajo</button>
      </div>
    </div>
  );
}

function ArrangePrompt({ state, send, prompt: p }: { state: GameState; send: Props['send']; prompt: Extract<Prompt, { type: 'arrange' }> }) {
  const handed = state.fg.items.filter((i) => itemDef(state, i.id).hands > 0);
  const [inHands, setInHands] = useState<string[]>(state.fg.items.filter((i) => i.inHands).map((i) => i.uid));
  const used = handed.filter((i) => inHands.includes(i.uid)).reduce((n, i) => n + itemDef(state, i.id).hands, 0);
  return (
    <div className="prompt-block">
      <h4>{p.optional ? 'Mantenimiento: puedes reorganizar tus objetos.' : 'Reorganiza tus objetos: ¿qué llevas en las manos?'} ({used}/2 manos)</h4>
      <div className="card-row">
        {handed.map((it) => {
          const def = itemDef(state, it.id);
          const on = inHands.includes(it.uid);
          return (
            <div key={it.uid} className={`slot pickable ${on ? 'selected' : ''}`}>
              <CardImg src={def.image} alt={def.name} caption={itemCaption(def)} onClick={() => setInHands((s) => (on ? s.filter((x) => x !== it.uid) : [...s, it.uid]))} />
              <small>{on ? 'En las manos' : 'En la mochila'} · {def.hands} {def.hands === 1 ? 'mano' : 'manos'}</small>
            </div>
          );
        })}
      </div>
      <div className="buttons actions">
        <button className="btn primary" disabled={used > 2} onClick={() => send({ type: 'arrange', inHands })}>Confirmar</button>
      </div>
    </div>
  );
}

function PlanningPrompt({ state, send, prompt: p }: { state: GameState; send: Props['send']; prompt: Extract<Prompt, { type: 'planning' }> }) {
  const table = Object.entries(state.actionTable);
  return (
    <div className="prompt-block">
      <h4>
        Planificación: compra cartas con tu Tiempo ({state.fg.time}). Mano: {state.fg.hand.length}/10.
      </h4>
      <div className="table-grid">
        {table.filter(([id]) => actionDef(id).cost > 0).map(([id, n]) => {
          const def = actionDef(id);
          const can = p.buyable.includes(id);
          return (
            <div key={id} className={`table-card ${can ? 'buyable' : ''} ${n === 0 ? 'empty' : ''}`}>
              <CardImg src={def.image} alt={def.name} caption={actionCaption(def)} onClick={can ? () => send({ type: 'buy', cardId: id }) : undefined} />
              <small>×{n} · coste {def.cost}</small>
            </div>
          );
        })}
      </div>
      <div className="buttons actions">
        <button className="btn primary" onClick={() => send({ type: 'endPlanning' })}>Terminar Planificación</button>
      </div>
    </div>
  );
}

function SelectCards({ state, count, title, onConfirm }: { state: GameState; count: number; title: string; onConfirm: (cards: CardId[]) => void }) {
  const [sel, setSel] = useState<number[]>([]);
  return (
    <div className="prompt-block">
      <h4>{title}</h4>
      <Hand state={state} playable={state.fg.hand} selected={sel} onCard={(i) => setSel((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i].slice(-count)))} />
      <div className="buttons actions">
        <button className="btn primary" disabled={sel.length !== count} onClick={() => onConfirm(sel.map((i) => state.fg.hand[i]!))}>Descartar</button>
      </div>
    </div>
  );
}
