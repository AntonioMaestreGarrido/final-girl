/** Textos claros para mostrar bajo la carta ampliada (traducen los iconos de las cartas). */
import type { ActionCard, Effect, FinalGirl, ItemCard, KillerAction } from '../content/types';

const TARGET: Record<KillerAction['target'], string> = {
  victim: 'la Víctima más cercana',
  finalGirl: 'la Chica Final',
  nearest: 'lo más cercano (Víctima o Chica Final)',
  farthestVictim: 'la Víctima más lejana',
  victimElseFG: 'la Víctima más cercana (o la Chica Final si no hay Víctimas)',
};

export function killerActionText(effects: Effect[]): string {
  return effects
    .map((e) => {
      if (e.kind === 'bloodlust') return `+${e.amount} Sed de Sangre`;
      if (e.kind === 'unleash') return `Desata la ${e.which === 'killer' ? 'Ira Asesina' : 'Ira Divina'}`;
      if (e.kind === 'wrath' && e.op === 'increase' && e.amount) return `aumenta la ${e.which === 'divine' ? 'Ira Divina' : 'Ira Asesina'} en ${e.amount}`;
      if (e.kind === 'custom' && e.id === 'inka-initial-wrath') return 'si la Ira Asesina está en 1-2, auméntala en 1';
      if (e.kind === 'custom' && e.id === 'minion-spawn') return 'aparece 1 Marioneta (las agotadas vuelven a Listo)';
      if (e.kind !== 'killerAction') return '';
      const a = e.action;
      const parts = [`${a.actor === 'minions' ? 'Esbirros' : a.actor === 'killer' ? 'Asesino' : 'Enemigos'} · Objetivo: ${TARGET[a.target]}`];
      const steps = [
        a.moves ? (a.moves === 1 ? 'se mueve' : `se mueve ${a.moves} veces`) : '',
        a.attacks ? (a.attacks === 1 ? 'ataca' : `ataca ${a.attacks} veces`) : '',
      ].filter(Boolean);
      if (a.attackFirst) steps.reverse();
      parts.push(...steps);
      return parts.join(' → ');
    })
    .filter(Boolean)
    .join('. ');
}

export function actionCaption(card: ActionCard): string {
  const header = `${card.name} · coste ${card.cost}${card.timing === 'reaction' ? ' · Reacción (solo contra un ataque)' : ''}`;
  // El texto de reglas viene como "2 éxitos: … 1 éxito: … Fracaso: …": una línea por resultado.
  const body = card.text
    .replace(/^Reacción\.\s*/, '')
    .replace(/\s*(1 éxito:|Fracaso:)/g, '\n$1')
    .replace(/^2 éxitos:/, '2 éxitos:');
  return `${header}\n${body}`;
}

export function itemCaption(item: ItemCard): string {
  const stats: string[] = [];
  if (item.hands) stats.push(item.hands === 1 ? 'una mano' : 'dos manos');
  else stats.push('se usa desde la mochila');
  if (item.range) stats.push(`alcance ${item.range[0] === item.range[1] ? item.range[0] : `${item.range[0]}-${item.range[1]}`}`);
  if (item.damage) stats.push(`+${item.damage} de daño`);
  if (item.uses) stats.push(`${item.uses} usos`);
  return `${item.name} · ${stats.join(' · ')}\n${item.text}`;
}

export function finalGirlCaption(fg: FinalGirl, ultimate: boolean): string {
  if (ultimate) return `${fg.name} · Habilidad Definitiva\n${fg.ultimate.text}\nCada Víctima salvada de más: ${fg.extraRescueText ?? '+1 Tiempo'}.`;
  const slots = fg.rescueSlots.map((s, i) => `${i + 1}. ${s.text}`).join('\n');
  return `${fg.name} · ${fg.health} de Vida\nRecompensas por salvar Víctimas:\n${slots}\nAl llenar todos los espacios: ${fg.ultimate.text}`;
}
