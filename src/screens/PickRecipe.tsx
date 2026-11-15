import { useState } from 'preact/hooks';
import { db } from '../db/db';
import { MEAL_LABEL, addDish, leftoverOptions, replaceDish } from '../db/plan';
import type { Meal } from '../db/types';
import { formatDayMonth, weekdayName } from '../lib/dates';
import { useLive } from '../lib/hooks';
import { collator, normalize } from '../lib/text';
import { Icon } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';
import { Thumb } from '../ui/Thumb';

/** Escolher um prato para um espaço do cardápio (adicionar ou trocar). */
export function PickRecipe({ date, meal, replaceUid, onClose }: {
  date: string;
  meal: Meal;
  replaceUid?: string;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);

  const data = useLive(async () => {
    const recipes = (await db.recipes.toArray())
      .filter((r) => !r.deleted)
      .sort((a, b) => collator.compare(a.name, b.name));
    const leftovers = replaceUid ? [] : await leftoverOptions(db, date, meal);
    return { recipes, leftovers };
  }, [date, meal, replaceUid]);

  const q = normalize(query);
  const recipes = (data?.recipes ?? []).filter((r) => !q || normalize(r.name).includes(q));
  // Receitas próprias desta refeição primeiro.
  recipes.sort((a, b) => Number(b.mealType === meal) - Number(a.mealType === meal));

  async function pick(recipeId: string, leftover = false) {
    if (busy) return;
    setBusy(true);
    try {
      if (replaceUid) await replaceDish(db, date, meal, replaceUid, recipeId);
      else await addDish(db, date, meal, recipeId, leftover);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  const title = `${replaceUid ? 'Trocar' : MEAL_LABEL[meal]} · ${weekdayName(date).toLowerCase()} ${formatDayMonth(date)}`;

  return (
    <Sheet title={title} onClose={onClose}>
      <div class="picker">
        {data && data.leftovers.length > 0 && !q && (
          <section>
            <h3 class="picker-title"><Icon name="repeat" size={16} /> Usar sobra</h3>
            <div class="picker-list">
              {data.leftovers.map(({ dish, from }) => (
                <button class="pick-row pick-leftover" key={dish.uid} onClick={() => pick(dish.recipeId, true)}>
                  <Thumb name={dish.snapshot.name} emoji={dish.snapshot.emoji} imageId={dish.snapshot.imageId} size="md" />
                  <span class="pick-text">
                    <strong>{dish.snapshot.name}</strong>
                    <span class="muted">
                      sobra do {MEAL_LABEL[from.meal].toLowerCase()} de {from.date === date ? 'hoje' : weekdayName(from.date).toLowerCase()} · não entra na lista
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        <label class="search">
          <Icon name="search" size={18} />
          <input
            type="search"
            placeholder="Buscar receita"
            value={query}
            onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
          />
        </label>

        <div class="picker-list">
          {recipes.map((r) => (
            <button class="pick-row" key={r.id} onClick={() => pick(r.id)} disabled={busy}>
              <Thumb name={r.name} emoji={r.emoji} imageId={r.imageId} size="md" />
              <span class="pick-text">
                <strong>{r.name}</strong>
                <span class="muted">{r.items.length ? `${r.items.length} ingredientes` : 'sem ingredientes ainda'}</span>
              </span>
              <Icon name="plus" size={20} class="pick-plus" />
            </button>
          ))}
          {data && recipes.length === 0 && (
            <p class="muted center pad">{q ? `Nada encontrado para “${query}”.` : 'Nenhuma receita na biblioteca ainda.'}</p>
          )}
        </div>
        <p class="fine center">Cadastrar receita nova direto daqui chega com a Etapa 3.</p>
      </div>
    </Sheet>
  );
}
