import { useState } from 'preact/hooks';
import { db } from '../db/db';
import { MEAL_LABEL, removeDish, setLeftover } from '../db/plan';
import type { Dish, Meal } from '../db/types';
import { formatDayMonth, weekdayName } from '../lib/dates';
import { Icon } from '../ui/Icon';
import { CostTag } from '../ui/CostTag';
import { RecipeDetail } from './RecipeDetail';

/** Prato que já está no cardápio: ver ingredientes, marcar sobra, trocar ou remover. */
export function DishSheet({ date, meal, dish, onClose, onReplace }: {
  date: string;
  meal: Meal;
  dish: Dish;
  onClose: () => void;
  onReplace: () => void;
}) {
  const [confirmRemove, setConfirmRemove] = useState(false);
  return (
    <RecipeDetail
      snapshot={dish.snapshot}
      onClose={onClose}
      badge={
        <>
          <span class={`meal-pill meal-pill-${meal}`}>
            {MEAL_LABEL[meal]} · {weekdayName(date).toLowerCase()} {formatDayMonth(date)}
          </span>
          <CostTag cost={dish.snapshot.cost} />
        </>
      }
      actions={
        <>
          <label class="toggle-row">
            <span>
              <strong>É sobra</strong>
              <small class="muted">Sobra aparece no cardápio, mas não entra na lista de compras.</small>
            </span>
            <input
              type="checkbox"
              class="switch"
              checked={!!dish.leftover}
              onChange={(e) => setLeftover(db, date, meal, dish.uid, (e.target as HTMLInputElement).checked)}
            />
          </label>
          <div class="action-row">
            <button class="btn" onClick={onReplace}><Icon name="swap" size={18} /> Trocar</button>
            {confirmRemove ? (
              <button class="btn btn-danger" onClick={async () => { await removeDish(db, date, meal, dish.uid); onClose(); }}>
                Confirmar
              </button>
            ) : (
              <button class="btn btn-ghost-danger" onClick={() => setConfirmRemove(true)}><Icon name="trash" size={18} /> Tirar do dia</button>
            )}
          </div>
        </>
      }
    />
  );
}
