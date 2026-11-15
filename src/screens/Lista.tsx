import { db, getWeekStart } from '../db/db';
import type { Category } from '../db/types';
import { MEAL_LABEL } from '../db/plan';
import { formatWeekRange, startOfWeek, weekDates, weekdayShort } from '../lib/dates';
import { useLive } from '../lib/hooks';
import { formatQuantity } from '../lib/units';
import { Icon } from '../ui/Icon';

interface Row {
  key: string;
  name: string;
  categoryId: string;
  /** Quantidade quando há uma só origem; "+" quando ainda falta somar (Etapa 5). */
  detail: string;
  sources: string[];
}

export function Lista() {
  const data = useLive(async () => {
    const ws = await getWeekStart();
    const start = startOfWeek(new Date(), ws);
    const days = (await db.days.bulkGet(weekDates(start))).filter((d) => d && !d.deleted);
    const week = await db.weeks.get(start);
    const categories = (await db.categories.toArray()).filter((c) => !c.deleted).sort((a, b) => a.order - b.order);

    // Prévia: um item por ingrediente, com de onde ele vem. A soma das quantidades é a Etapa 5.
    const rows = new Map<string, Row & { parts: string[] }>();
    let cooked = 0;
    let leftovers = 0;
    for (const day of days) {
      for (const meal of ['almoco', 'jantar'] as const) {
        for (const dish of day!.slots[meal] ?? []) {
          if (dish.leftover) { leftovers++; continue; }
          cooked++;
          for (const item of dish.snapshot.items) {
            const row = rows.get(item.ingredientId) ?? {
              key: item.ingredientId, name: item.ingredientName, categoryId: item.categoryId, detail: '', sources: [], parts: [],
            };
            const qty = formatQuantity(item.quantity, item.unit);
            if (qty) row.parts.push(qty);
            row.sources.push(`${qty ? qty + ' · ' : ''}${dish.snapshot.name} (${weekdayShort(day!.id)}, ${MEAL_LABEL[meal].toLowerCase()})`);
            rows.set(item.ingredientId, row);
          }
        }
      }
    }
    const fromMenu: Row[] = [...rows.values()].map(({ parts, ...r }) => ({ ...r, detail: parts.join(' + ') }));
    const extras: Row[] = (week && !week.deleted ? week.extras : []).map((e) => ({
      key: e.id, name: e.name, categoryId: e.categoryId,
      detail: formatQuantity(e.quantity, e.unit), sources: e.note ? [e.note] : [],
    }));
    return { start, cooked, leftovers, fromMenu, extras, categories };
  });

  if (!data) return <section class="screen" />;
  const total = data.fromMenu.length + data.extras.length;

  return (
    <section class="screen">
      <header class="screen-head">
        <p class="eyebrow">{formatWeekRange(data.start)}</p>
        <h1>Lista de compras</h1>
      </header>

      <div class="summary-card">
        <div class="summary-stats">
          <div><strong>{data.cooked}</strong><span>pratos para cozinhar</span></div>
          <div><strong>{data.fromMenu.length}</strong><span>ingredientes do cardápio</span></div>
          <div><strong>{data.extras.length}</strong><span>extras da semana</span></div>
        </div>
        <p class="note-box">
          <strong>Prévia.</strong> Cada ingrediente aparece uma vez, mostrando de onde vem. A soma das quantidades, o checklist
          e o progresso chegam nas Etapas 5 e 6.
          {data.leftovers > 0 && ` ${data.leftovers} sobra${data.leftovers === 1 ? '' : 's'} fora da conta.`}
        </p>
      </div>

      {total === 0 && <p class="muted center pad">Nada no cardápio desta semana ainda.</p>}

      <Groups title="Do cardápio" icon="🥕" rows={data.fromMenu} categories={data.categories} />
      <Groups title="Extras da semana" icon="🛒" rows={data.extras} categories={data.categories} />
    </section>
  );
}

function Groups({ title, icon, rows, categories }: { title: string; icon: string; rows: Row[]; categories: Category[] }) {
  if (!rows.length) return null;
  return (
    <>
      <h2 class="section-title"><span>{icon}</span> {title}</h2>
      <div class="cat-groups">
        {categories.map((cat) => {
          const items = rows.filter((r) => r.categoryId === cat.id);
          if (!items.length) return null;
          return (
            <div class="cat-group" key={cat.id} style={{ '--cat': cat.color }}>
              <h3 class="cat-title"><span class="dot" style={{ background: cat.color }} />{cat.name}<span class="cat-count">{items.length}</span></h3>
              <ul class="plain-list">
                {items.map((r) => (
                  <li key={r.key}>
                    <details class="row-details">
                      <summary>
                        <span class="row-name">{r.name}</span>
                        <span class={r.detail ? 'ing-qty' : 'ing-qty ing-qty-empty'}>{r.detail || 'sem qtd.'}</span>
                        {r.sources.length > 0 && <Icon name="down" size={16} class="row-caret" />}
                      </summary>
                      {r.sources.length > 0 && (
                        <ul class="sources">{r.sources.map((s, i) => <li key={i}>{s}</li>)}</ul>
                      )}
                    </details>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </>
  );
}
