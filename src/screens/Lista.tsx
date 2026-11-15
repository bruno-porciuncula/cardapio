import { db } from '../db/db';
import type { Category, Staple } from '../db/types';
import { mondayOf, formatWeekRange } from '../lib/dates';
import { useLive } from '../lib/hooks';
import { formatQuantity } from '../lib/units';
import { Icon } from '../ui/Icon';

export function Lista() {
  const weekId = mondayOf();
  const data = useLive(async () => {
    const week = await db.weeks.get(weekId);
    const dishes = week && !week.deleted ? Object.values(week.slots).flatMap((d) => d ?? []) : [];
    const cooked = dishes.filter((d) => !d.leftover);
    const ingredientIds = new Set(cooked.flatMap((d) => d.snapshot.items.map((i) => i.ingredientId)));
    const categories = (await db.categories.toArray()).filter((c) => !c.deleted).sort((a, b) => a.order - b.order);
    const staples = (await db.staples.toArray()).filter((s) => !s.deleted);
    return { dishes: dishes.length, leftovers: dishes.length - cooked.length, ingredients: ingredientIds.size, categories, staples };
  }, [weekId]);

  return (
    <section class="screen">
      <header class="screen-head">
        <p class="eyebrow">{formatWeekRange(weekId)}</p>
        <h1>Lista de compras</h1>
      </header>

      {data && (
        <div class="summary-card">
          <div class="summary-stats">
            <div><strong>{data.dishes}</strong><span>pratos</span></div>
            <div><strong>{data.ingredients}</strong><span>ingredientes diferentes</span></div>
            <div><strong>{data.staples.length}</strong><span>itens de sempre</span></div>
          </div>
          <p class="muted">
            {data.dishes === 0
              ? 'O cardápio desta semana está vazio.'
              : 'A geração automática da lista (somar, agrupar e organizar por categoria) é a Etapa 5.'}
            {data.leftovers > 0 && ` ${data.leftovers} sobra${data.leftovers === 1 ? '' : 's'} não entra${data.leftovers === 1 ? '' : 'm'} na conta.`}
          </p>
        </div>
      )}

      {data && data.staples.length > 0 && (
        <>
          <h2 class="section-title"><Icon name="repeat" size={18} /> Itens de sempre</h2>
          <StaplesByCategory staples={data.staples} categories={data.categories} />
        </>
      )}
    </section>
  );
}

function StaplesByCategory({ staples, categories }: { staples: Staple[]; categories: Category[] }) {
  return (
    <div class="cat-groups">
      {categories.map((cat) => {
        const items = staples.filter((s) => s.categoryId === cat.id);
        if (!items.length) return null;
        return (
          <div class="cat-group" key={cat.id}>
            <h3 class="cat-title"><span class="dot" style={{ background: cat.color }} />{cat.name}</h3>
            <ul class="plain-list">
              {items.map((s) => {
                const qty = formatQuantity(s.quantity, s.unit);
                return (
                  <li key={s.id}>
                    <span>{s.name}</span>
                    <span class={qty ? 'ing-qty' : 'ing-qty ing-qty-empty'}>{qty || 'sem quantidade'}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
