import type { CSSProperties } from 'react';
import type { Zone, ZoneId } from '../content/types';
import { fgDef, itemDef, killerDef, killerRow, locationDef, type GameState } from '../engine';
import { asset } from './asset';
import { Meeple } from './Meeple';
import { fxSide, isMoveAnim, type Fx } from './moveFx';
import { useHoverCard } from './Zoom';

interface Props {
  state: GameState;
  /** Zonas resaltadas y clicables (destinos de movimiento, empates...). */
  targets: ZoneId[];
  onZone?: (zone: ZoneId) => void;
  selectedVictims?: string[];
  onVictim?: (id: string) => void;
  /** Espacio en el que se dibuja una pieza que aún no ha llegado a su posición real ('fg', 'killer', 'm:<id>', 'v:<id>'). */
  zones?: ReadonlyMap<string, ZoneId>;
  /** Movimiento o muerte que se está resaltando. */
  fx?: Fx | null;
}

const VICTIM_COLOR = { white: '#f2efe6', orange: '#f08a24', blue: '#3d8bd9', green: '#3fae5a' } as const;
const ROLE_TEXT = {
  novio: 'El Novio: si muere en tu zona, empiezas la próxima fase de Acción con 12 de Tiempo.',
  novia: 'La Novia: te sigue incluso a la zona del Asesino y te da +1 dado mientras esté contigo.',
  maldita: 'La Maldita: el Asesino siempre la elige como objetivo. Solo se salva si es la última Víctima.',
  super: 'El Super Turista: el Asesino siempre lo elige como objetivo. Si lo salvas, reduce una Ira en 4; si muere, la Ira Divina sube 4.',
  hombre: 'El Hombre Sagrado: no te sigue y cada Mantenimiento avanza hacia el Asesino. Si se encuentran estando tú allí, reduces una Ira a 4; si no, las Iras suben 10 en total.',
  guia: 'El Guía Turístico: mientras esté contigo, una vez por turno puedes moverte 1 espacio extra. Si muere, la Ira Divina sube 6.',
  prometido: 'Tu Prometido: si un Enemigo quisiera entrar en tu espacio mientras él está allí, muere en tu lugar y el Enemigo se queda donde está. Si muere por una trampa, +5 Terror.',
  hermana: 'Tu Hermana: mientras esté en tu espacio puedes gastar 2 Tiempo para volver a lanzar un dado. Si muere, +2 Sed de Sangre.',
  'novio-ml': 'Tu Novio: si el Asesino va a por ti, va a por él. En el Mantenimiento se mueve 2 espacios hacia ti y, si llega a tu espacio, ganas 2 de Tiempo.',
  smalley: 'Uno de los Smalleys: cada vez que muera, +1 Sed de Sangre.',
  cazador: 'Víctima Especial (Cazadores de fantasmas): no te sigue hasta que una de ellas muera; cada muerte suma +1 Sed de Sangre.',
  lobo: 'El Hombre Lobo: no te sigue y no puede ser apuntado, salvado ni asesinado. En el Mantenimiento entra en pánico y hace 2 de daño a un objetivo de su espacio (Víctima ▶ tú ▶ Esbirro ▶ Asesino).',
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
  'carro-de-golf': { kind: 'event', id: 'transporte-de-empleados' },
  calavera: { kind: 'event', id: 'no-es-real' },
};

export function Board({ state, targets, onZone, selectedVictims = [], onVictim, zones: shownZones, fx }: Props) {
  const loc = locationDef(state);
  const zones = loc.zones;
  const ratio = (loc.boardSize.h / loc.boardSize.w) * 100;
  const zoneOf = (key: string, real: ZoneId): ZoneId => shownZones?.get(key) ?? real;
  const victimZone = (v: { id: string; zone: ZoneId }) => zoneOf(`v:${v.id}`, v.zone);
  const fgZone = zoneOf('fg', state.fg.zone);
  const killerAbsent = !!killerDef(state).birds;
  const killerZone = zoneOf('killer', state.killer.zone);

  return (
    <div className="board" style={{ ['--ar' as string]: `${100 / ratio}` }}>
      <img className="board-img" src={asset(loc.board)} alt={loc.name} draggable={false} />

      {zones.map((z) => {
        const isTarget = targets.includes(z.id);
        if (z.hidden && !isTarget && !state.tokens.some((t) => t.zone === z.id)) return null;
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
        const vs = state.victims.filter((v) => victimZone(v) === z.id);
        if (!vs.length) return null;
        // Las Víctimas van debajo de las figuras (y de su nombre) para que nunca queden tapadas.
        const figureHere = fgZone === z.id || (!killerAbsent && killerZone === z.id);
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

      <Minions state={state} zoneOf={zoneOf} />
      <Birds state={state} />
      {!killerAbsent && <Figure state={state} kind="killer" zone={killerZone} otherZone={fgZone} onClick={(z) => targets.includes(z) && onZone?.(z)} />}
      <Figure state={state} kind="fg" zone={fgZone} otherZone={killerZone} onClick={(z) => targets.includes(z) && onZone?.(z)} />
      {fx && <FxOverlay key={fx.key} fx={fx} zones={zones} />}
    </div>
  );
}

function zoneTip(state: GameState, z: Zone): string {
  const parts = [z.label];
  if (z.search) parts.push(`Zona de Búsqueda (${state.itemDecks[z.deck ?? z.id]?.length ?? 0} Objetos)${state.tokens.some((t) => t.id === 'x' && t.zone === z.id) ? ' · ya buscada' : ''}`);
  if (z.house) parts.push('Casa: no puedes entrar andando si está ocupada por una Víctima (usa Convencer)');
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
  const info = loc.tokenInfo?.[tokenId];
  const hover = useHoverCard(info?.image ?? def?.image, info ? `${info.text}
(${zone.label})` : def ? `Ficha de ${def.name} en ${zone.label}
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

/** Esbirros (Marionetas) en el tablero, junto a la figura del Asesino de su zona. */
function Minions({ state, zoneOf }: { state: GameState; zoneOf: (key: string, real: ZoneId) => ZoneId }) {
  const k = killerDef(state);
  const def = k.minion;
  const loc = locationDef(state);
  if (!def || k.birds) return null;
  return (
    <>
      {state.minions.map((m, i) => {
        const zid = zoneOf(`m:${m.id}`, m.zone);
        const z = loc.zones.find((x) => x.id === zid)!;
        const idx = state.minions.filter((x, j) => j < i && zoneOf(`m:${x.id}`, x.zone) === zid).length;
        const slot = Number(m.id.slice(1)) - 1;
        return (
          <MinionPiece
            key={m.id}
            def={def}
            token={def.tokens[slot] ?? def.tokens[0]!}
            style={{ left: `calc(${z.pos.x}% - ${3.4 + idx * 2.4}%)`, top: `calc(${z.pos.y}% - 2.6%)` }}
            caption={`${def.name} en ${z.label} · Vida ${m.hp} · Ataque ${def.attack} · Movimiento ${killerRow(state).move} (el de ${k.name})
${def.text}`}
          />
        );
      })}
    </>
  );
}

/** Terror from Above: una ficha por espacio (1 o 2 pájaros sueltos, o la de 3 pájaros) con el contador. */
function Birds({ state }: { state: GameState }) {
  const k = killerDef(state);
  const loc = locationDef(state);
  if (!k.birds || !k.minion) return null;
  const counts = new Map<ZoneId, number>();
  for (const m of state.minions) counts.set(m.zone, (counts.get(m.zone) ?? 0) + 1);
  return (
    <>
      {[...counts].map(([zone, n]) => {
        const z = loc.zones.find((x) => x.id === zone);
        if (!z || z.hidden) return null;
        return <BirdPiece key={zone} n={n} def={k.minion!} left={z.pos.x} top={z.pos.y} label={z.label} />;
      })}
    </>
  );
}

function BirdPiece({ n, def, left, top, label }: { n: number; def: NonNullable<ReturnType<typeof killerDef>['minion']>; left: number; top: number; label: string }) {
  const hover = useHoverCard(def.reference, `${n} ${n === 1 ? 'Pájaro' : 'Pájaros'} en ${label}${n >= 3 ? ' (espacio lleno: atacan siempre)' : ''}
${def.text}`);
  const base = 'assets/killers/birds/tokens';
  return (
    <div className="bird-piece" style={{ left: `calc(${left}% - 3.6%)`, top: `calc(${top}% - 2.6%)` }} {...hover}>
      {n >= 3 ? <img src={asset(`${base}/bird-3.webp`)} alt="3 Pájaros" draggable={false} /> : Array.from({ length: n }, (_, i) => <img key={i} src={asset(`${base}/bird-1.webp`)} alt="Pájaro" draggable={false} />)}
      <span className="bird-count">×{n}</span>
    </div>
  );
}

function MinionPiece({ def, token, style, caption }: { def: NonNullable<ReturnType<typeof killerDef>['minion']>; token: string; style: CSSProperties; caption: string }) {
  const hover = useHoverCard(def.reference, caption);
  return <img className="minion" src={asset(token)} alt={def.name} draggable={false} style={style} {...hover} />;
}

function Figure({ state, kind, zone, otherZone, onClick }: { state: GameState; kind: 'fg' | 'killer'; zone: ZoneId; otherZone: ZoneId; onClick: (zone: ZoneId) => void }) {
  const loc = locationDef(state);
  const z = loc.zones.find((x) => x.id === zone)!;
  const same = zone === otherZone;
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
      : `${k.name} · ${k.invulnerable ? 'sin Vida (invulnerable)' : `Vida ${state.killer.health.hp}`} · Ataque ${row.attack} · Movimiento ${row.move} · ${z.label}`;
  const hover = useHoverCard(card, caption);
  return (
    <div className={`figure ${kind}`} style={{ left: `calc(${z.pos.x}% + ${dx}%)`, top: `${z.pos.y}%` }} {...hover} onClick={() => onClick(zone)}>
      <img className="figure-token" src={asset(token)} alt={label} draggable={false} />
      <span className="figure-name">{label.split(' ')[0]}</span>
    </div>
  );
}

/** Resalte del movimiento o muerte que se acaba de revelar: estela, anillo de origen y destino, o cruz flotante. */
function FxOverlay({ fx, zones }: { fx: Fx; zones: Zone[] }) {
  const a = fx.entry.anim;
  if (!a) return null;
  const pos = (id: ZoneId) => zones.find((x) => x.id === id)?.pos;
  if (a.kind === 'victimDie') {
    const p = pos(a.zone);
    if (!p) return null;
    return (
      <span className="fx-die" style={{ left: `${p.x}%`, top: `${p.y}%` }} aria-hidden="true">
        ✝ −1
      </span>
    );
  }
  if (!isMoveAnim(a)) return null;
  const side = fxSide(a);
  const pts = a.path.map(pos).filter((p): p is NonNullable<typeof p> => !!p);
  if (!pts.length) return null;
  const to = pts[pts.length - 1]!;
  const from = pts[0]!;
  return (
    <>
      {pts.length > 1 && (
        <svg className={`fx-trail ${side}`} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <polyline points={pts.map((p) => `${p.x},${p.y}`).join(' ')} vectorEffect="non-scaling-stroke" />
        </svg>
      )}
      {pts.length > 1 && <span className={`fx-ring from ${side}`} style={{ left: `${from.x}%`, top: `${from.y}%` }} aria-hidden="true" />}
      <span className={`fx-ring to ${side}`} style={{ left: `${to.x}%`, top: `${to.y}%` }} aria-hidden="true" />
    </>
  );
}
