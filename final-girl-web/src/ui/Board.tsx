import type { Zone, ZoneId } from '../content/types';
import { fgDef, itemDef, killerDef, killerRow, locationDef, type GameState } from '../engine';
import { asset } from './asset';
import { Meeple } from './Meeple';
import { useHoverCard } from './Zoom';

interface Props {
  state: GameState;
  /** Zonas resaltadas y clicables (destinos de movimiento, empates...). */
  targets: ZoneId[];
  onZone?: (zone: ZoneId) => void;
  selectedVictims?: string[];
  onVictim?: (id: string) => void;
}

const VICTIM_COLOR = { white: '#f2efe6', orange: '#f08a24', blue: '#3d8bd9', green: '#3fae5a' } as const;
const ROLE_TEXT = {
  novio: 'El Novio: si muere en tu zona, empiezas la próxima fase de Acción con 12 de Tiempo.',
  novia: 'La Novia: te sigue incluso a la zona del Asesino y te da +1 dado mientras esté contigo.',
  maldita: 'La Maldita: el Asesino siempre la elige como objetivo. Solo se salva si es la última Víctima.',
  super: 'El Super Turista: el Asesino siempre lo elige como objetivo. Si lo salvas, reduce una Ira en 4; si muere, la Ira Divina sube 4.',
  hombre: 'El Hombre Sagrado: no te sigue y cada Mantenimiento avanza hacia el Asesino. Si se encuentran estando tú allí, reduces una Ira a 4; si no, las Iras suben 10 en total.',
  guia: 'El Guía Turístico: mientras esté contigo, una vez por turno puedes moverte 1 espacio extra. Si muere, la Ira Divina sube 6.',
} as const;

/** Carta asociada a cada ficha del tablero (para la vista ampliada). */
const TOKEN_CARD: Record<string, { kind: 'item' | 'event'; id: string }> = {
  'bote-a-motor': { kind: 'item', id: 'llaves-del-bote-a-motor' },
  'trampa-para-osos': { kind: 'item', id: 'trampa-para-osos' },
  'fuegos-artificiales': { kind: 'item', id: 'fuegos-artificiales' },
  'tunel-secreto': { kind: 'event', id: 'tunel-secreto' },
  'aguas-oscuras': { kind: 'event', id: 'aguas-oscuras' },
  cerrado: { kind: 'event', id: 'cerrado-por-mantenimiento' },
  'fuego-y-azufre': { kind: 'event', id: 'fuego-y-azufre' },
  'suelo-sagrado': { kind: 'event', id: 'suelo-sagrado' },
};

export function Board({ state, targets, onZone, selectedVictims = [], onVictim }: Props) {
  const loc = locationDef(state);
  const zones = loc.zones;
  const ratio = (loc.boardSize.h / loc.boardSize.w) * 100;

  return (
    <div className="board" style={{ ['--ar' as string]: `${100 / ratio}` }}>
      <img className="board-img" src={asset(loc.board)} alt={loc.name} draggable={false} />

      {zones.map((z) => {
        const isTarget = targets.includes(z.id);
        return (
          <button
            key={z.id}
            className={`zone-hit ${isTarget ? 'target' : ''}`}
            style={{ left: `${z.pos.x}%`, top: `${z.pos.y}%` }}
            onClick={() => isTarget && onZone?.(z.id)}
            data-tip={zoneTip(state, z)}
            aria-label={z.label}
            tabIndex={isTarget ? 0 : -1}
          >
            {isTarget && <span className="zone-label">{z.label}</span>}
          </button>
        );
      })}

      {state.tokens.map((t, i) => (
        <BoardToken key={`${t.id}-${i}`} state={state} tokenId={t.id} zone={zones.find((x) => x.id === t.zone)!} />
      ))}

      {(state.blocked ?? []).map(([a, b]) => {
        const za = zones.find((x) => x.id === a)!;
        const zb = zones.find((x) => x.id === b)!;
        const src = loc.tokens['fuera-de-servicio'];
        if (!src) return null;
        return (
          <img
            key={`${a}-${b}`}
            className="token"
            src={asset(src)}
            alt="Fuera de servicio"
            style={{ left: `${(za.pos.x + zb.pos.x) / 2}%`, top: `${(za.pos.y + zb.pos.y) / 2}%` }}
            data-tip={`Fuera de servicio entre ${za.label} y ${zb.label}: las Víctimas no pasan por aquí (salvo si te siguen).`}
          />
        );
      })}

      {zones.map((z) => {
        const vs = state.victims.filter((v) => v.zone === z.id);
        if (!vs.length) return null;
        // Las Víctimas van debajo de las figuras (y de su nombre) para que nunca queden tapadas.
        const figureHere = state.fg.zone === z.id || state.killer.zone === z.id;
        const top0 = figureHere ? 6.4 : 2.2;
        return [
          ...vs.map((v, i) => {
            const col = i % 5;
            const row = Math.floor(i / 5);
            const selectable = !!onVictim && targetsVictim(state, v.id);
            const tip = v.role ? ROLE_TEXT[v.role] : `Víctima en ${z.label}${selectable ? '. Haz clic para elegirla.' : ''}`;
            return (
              <button
                key={v.id}
                className={`victim ${selectedVictims.includes(v.id) ? 'selected' : ''} ${selectable ? 'selectable' : ''}`}
                style={{ left: `calc(${z.pos.x}% + ${(col - 2) * 1.3}%)`, top: `calc(${z.pos.y}% + ${top0 + row * 2.4}%)` }}
                onClick={() => selectable && onVictim?.(v.id)}
                data-tip={tip}
                aria-label={tip}
              >
                <Meeple color={v.special ? VICTIM_COLOR[v.special] : '#f2c230'} />
              </button>
            );
          }),
          <span
            key={`count-${z.id}`}
            className="victim-count"
            style={{ left: `calc(${z.pos.x}% + ${(Math.min(vs.length, 5) - 2) * 1.3 + 0.5}%)`, top: `calc(${z.pos.y}% + ${top0}%)` }}
            data-tip={`${vs.length} ${vs.length === 1 ? 'Víctima' : 'Víctimas'} en ${z.label}`}
          >
            ×{vs.length}
          </span>,
        ];
      })}

      <Figure state={state} kind="killer" onClick={(z) => targets.includes(z) && onZone?.(z)} />
      <Figure state={state} kind="fg" onClick={(z) => targets.includes(z) && onZone?.(z)} />
    </div>
  );
}

function zoneTip(state: GameState, z: Zone): string {
  const parts = [z.label];
  if (z.search) parts.push(`Zona de Búsqueda (${state.itemDecks[z.id]?.length ?? 0} Objetos)`);
  if (z.exit) parts.push('Zona de Salida: aquí puedes salvar Víctimas');
  if (z.sacred) parts.push('Espacio Sagrado');
  const n = state.victims.filter((v) => v.zone === z.id).length;
  if (n) parts.push(`${n} ${n === 1 ? 'Víctima' : 'Víctimas'}`);
  if (state.tunnel.includes(z.id)) parts.push('Túnel secreto');
  return parts.join(' · ');
}

function targetsVictim(state: GameState, id: string): boolean {
  const p = state.prompt;
  return (p?.type === 'move' && p.followers.includes(id)) || (p?.type === 'rescue' && p.victims.includes(id));
}

function BoardToken({ state, tokenId, zone }: { state: GameState; tokenId: string; zone: Zone }) {
  const loc = locationDef(state);
  const card = TOKEN_CARD[tokenId];
  const def = card ? (card.kind === 'item' ? itemDef(state, card.id) : loc.events.find((e) => e.id === card.id)) : undefined;
  const hover = useHoverCard(def?.image, def ? `Ficha de ${def.name} en ${zone.label}
${def.text}` : undefined);
  const src = loc.tokens[tokenId];
  if (!src) return null;
  return (
    <img
      className="token"
      src={asset(src)}
      alt={tokenId}
      style={{ left: `calc(${zone.pos.x}% + 2.2%)`, top: `calc(${zone.pos.y}% - 3.5%)` }}
      {...hover}
    />
  );
}

function Figure({ state, kind, onClick }: { state: GameState; kind: 'fg' | 'killer'; onClick: (zone: ZoneId) => void }) {
  const loc = locationDef(state);
  const zone = kind === 'fg' ? state.fg.zone : state.killer.zone;
  const z = loc.zones.find((x) => x.id === zone)!;
  const same = state.fg.zone === state.killer.zone;
  const dx = same ? (kind === 'fg' ? -3.2 : 3.2) : 0;
  const fg = fgDef(state);
  const k = killerDef(state);
  const row = killerRow(state);
  const label = kind === 'fg' ? fg.name : k.name;
  const token = kind === 'fg' ? fg.token : k.token;
  const card = kind === 'fg' ? (state.fg.ultimate ? fg.ultimateImage : fg.image) : k.board;
  const caption =
    kind === 'fg'
      ? `${fg.name} · Vida ${state.fg.health.hp}/${state.fg.health.max} · Tiempo ${state.fg.time} · ${z.label}`
      : `${k.name} · Vida ${state.killer.health.hp} · Ataque ${row.attack} · Movimiento ${row.move} · ${z.label}`;
  const hover = useHoverCard(card, caption);
  return (
    <div className={`figure ${kind}`} style={{ left: `calc(${z.pos.x}% + ${dx}%)`, top: `${z.pos.y}%` }} {...hover} onClick={() => onClick(zone)}>
      <img className="figure-token" src={asset(token)} alt={label} draggable={false} />
      <span className="figure-name">{label.split(' ')[0]}</span>
    </div>
  );
}
