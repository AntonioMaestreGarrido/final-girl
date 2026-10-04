import { itemDef, type GameState } from '../engine';
import { itemCaption } from './captions';
import { CardImg } from './Zoom';

interface Props {
  state: GameState;
  /** Usa un objeto activable (solo en la fase de Acción). */
  onUse?: (uid: string, action: string) => void;
}

/** "Tu equipo": manos y mochila de la Chica Final, siempre a la vista en la barra inferior. */
export function Inventory({ state, onUse }: Props) {
  const inHands = state.fg.items.filter((i) => i.inHands);
  const backpack = state.fg.items.filter((i) => !i.inHands);
  const twoHanded = inHands.find((i) => itemDef(state, i.id).hands === 2);
  const handSlots = twoHanded ? [twoHanded] : [inHands[0], inHands[1]];

  return (
    <section className="inventory" aria-label="Tu equipo">
      <h4>Tu equipo</h4>
      <div className="inv-group">
        <small className="inv-label" data-tip="Los objetos con icono de mano solo se pueden usar si están en las manos. Puedes reorganizar al conseguir un objeto y en la fase de Mantenimiento.">
          Manos
        </small>
        <div className="inv-row">
          {handSlots.map((it, i) =>
            it ? <ItemSlot key={it.uid} state={state} uid={it.uid} where={twoHanded ? 'las dos manos' : 'una mano'} onUse={onUse} /> : <div key={i} className="inv-empty">Mano libre</div>,
          )}
        </div>
      </div>
      <div className="inv-group">
        <small className="inv-label" data-tip="En la mochila caben objetos sin límite. Los que no llevan icono de mano se usan desde aquí.">
          Mochila
        </small>
        <div className="inv-row">
          {backpack.map((it) => (
            <ItemSlot key={it.uid} state={state} uid={it.uid} where="la mochila" onUse={onUse} />
          ))}
          {!backpack.length && <div className="inv-empty">Vacía</div>}
        </div>
      </div>
    </section>
  );
}

function ItemSlot({ state, uid, where, onUse }: { state: GameState; uid: string; where: string; onUse?: Props['onUse'] }) {
  const it = state.fg.items.find((i) => i.uid === uid)!;
  const def = itemDef(state, it.id);
  const action = state.prompt?.type === 'main' ? state.prompt.itemActions.find((a) => a.uid === uid) : undefined;
  const usable = !!action && !!onUse;
  const needsHands = def.hands > 0 && !it.inHands;
  const status = usable
    ? `▶ Haz clic para usarlo: ${action!.label}`
    : needsHands
      ? 'Está en la mochila: pásalo a las manos (al conseguir un objeto o en el Mantenimiento) para poder usarlo.'
      : def.range
        ? 'Arma: se suma al jugar una carta de ataque (eliges el arma al jugarla).'
        : 'Se usa en el momento que indica la carta.';
  const caption = `Lo llevas en ${where}${it.uses !== undefined ? ` · quedan ${it.uses} usos` : ''}\n${itemCaption(def)}\n\n${status}`;
  return (
    <div className={`inv-item ${usable ? 'usable' : ''} ${needsHands ? 'stowed' : ''}`}>
      <CardImg src={def.image} alt={def.name} caption={caption} {...(usable ? { onClick: () => onUse!(uid, action!.action) } : {})} />
      <small className="inv-name">{def.name}</small>
      {it.uses !== undefined && <small className="inv-uses">{it.uses} usos</small>}
      {usable && <small className="use-hint">Clic para usar</small>}
    </div>
  );
}
