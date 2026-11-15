/**
 * Quantidades para 6 pratos — o padrão da casa: 2 pessoas, 2 pratos no jantar
 * e o resto vira marmita/sobra.
 *
 * Regras:
 * - Só preenche ingrediente SEM quantidade. O que você já tinha informado
 *   (ex.: 350 g de carne, 3 berinjelas) fica como está.
 * - Receitas que estavam sem ingredientes (lasanha, panqueca) ganham a lista.
 * - Semanas a partir da data informada passam a usar as quantidades novas;
 *   semanas passadas ficam como estavam (histórico).
 */
import type { MesaDB } from './db';
import type { Ingredient, Recipe, RecipeItem } from './types';
import { makeSnapshot } from './plan';
import { guessCategory, ingredientIndex } from './recipes';
import { bankLink } from './bank';
import { normalize } from '../lib/text';

export const DEFAULT_SERVINGS = 6;

type Q = [quantity: number, unit: string];
type Table = Record<string, Q>;

/** Por receita: nome do ingrediente → [quantidade, unidade]. */
export const PORTIONS: Record<string, Table> = {
  // ── Exemplo do briefing ──
  'ex-carne-panela': { 'Tomate': [4, 'un'], 'Cebola': [2, 'un'], 'Abobrinha': [2, 'un'] },
  'ex-berinjela-forno': { 'Queijo muçarela': [300, 'g'], 'Molho de tomate': [2, 'sache'], 'Cenoura': [3, 'un'], 'Beterraba': [3, 'un'] },
  'ex-macarrao-oriental': { 'Cebolinha': [1, 'maco'], 'Cenoura': [2, 'un'], 'Brócolis': [1, 'un'], 'Cebola': [1, 'un'], 'Macarrão': [500, 'g'] },
  'ex-estrogonofe': { 'Creme de leite': [2, 'caixa'] },
  'ex-wrap': { 'Massa para wrap': [1, 'pacote'], 'Queijo muçarela': [200, 'g'], 'Molho de tomate': [1, 'sache'] },
  'ex-risoto-gorgonzola': { 'Arroz para risoto': [500, 'g'], 'Queijo gorgonzola': [200, 'g'], 'Caldo de legumes': [2, 'un'], 'Tomate cereja': [1, 'bandeja'] },
  'ex-hamburguer': { 'Carne moída': [1, 'kg'], 'Pão de hambúrguer': [6, 'un'] },
  'ex-misto-quente': { 'Pão de forma ou francês': [1, 'pacote'], 'Queijo muçarela': [300, 'g'], 'Peito de peru': [300, 'g'] },

  // ── Seus cardápios ──
  'loc-macarrao-milho': { 'Macarrão': [500, 'g'], 'Milho': [2, 'lata'], 'Ervilha': [1, 'lata'], 'Tomate cereja': [1, 'bandeja'] },
  'loc-berinjela-milanesa': { 'Arroz': [500, 'g'], 'Feijão': [500, 'g'], 'Ovo': [2, 'un'], 'Farinha de rosca': [200, 'g'] },
  'loc-lanche-natural': { 'Queijo branco': [300, 'g'], 'Tomate cereja': [1, 'bandeja'], 'Atum': [2, 'lata'], 'Cenoura': [2, 'un'], 'Pão de forma ou francês': [1, 'pacote'] },
  'loc-ratatouille': { 'Tomate': [4, 'un'], 'Cebola': [2, 'un'], 'Abobrinha': [2, 'un'] },
  'loc-frango-grelhado': { 'Peito de frango': [1, 'kg'] },
  'loc-bolonhesa': { 'Macarrão': [500, 'g'], 'Carne moída': [600, 'g'], 'Molho de tomate': [2, 'sache'] },
  'loc-risoto-caprese': { 'Arroz para risoto': [500, 'g'], 'Tomate cereja': [1, 'bandeja'], 'Queijo muçarela': [300, 'g'], 'Manjericão': [1, 'maco'] },
  'loc-wrap-carne': { 'Massa para wrap': [1, 'pacote'], 'Carne bovina': [600, 'g'] },
  'loc-panqueca': {
    'Farinha de trigo': [2, 'xicara'], 'Ovo': [2, 'un'], 'Leite': [500, 'ml'], 'Carne moída': [500, 'g'],
    'Molho de tomate': [2, 'sache'], 'Queijo muçarela': [200, 'g'],
  },
  'loc-macarrao-cebola': { 'Macarrão': [500, 'g'], 'Cebola': [4, 'un'] },
  'loc-cachorro-quente': { 'Pão de cachorro-quente': [12, 'un'], 'Salsicha': [12, 'un'], 'Molho de tomate': [1, 'sache'], 'Batata palha': [1, 'pacote'] },
  'loc-carne-oriental': { 'Carne bovina': [800, 'g'], 'Molho shoyu': [1, 'garrafa'] },
  'loc-salada-cenoura-pepino': { 'Cenoura': [3, 'un'], 'Pepino': [2, 'un'] },
  'loc-arroz-frango': { 'Arroz': [500, 'g'], 'Peito de frango': [600, 'g'], 'Tomate cereja': [1, 'bandeja'], 'Cenoura': [2, 'un'], 'Beterraba': [2, 'un'] },
  'loc-macarrao-crocante': { 'Macarrão': [500, 'g'], 'Queijo muçarela': [200, 'g'], 'Queijo ralado': [1, 'pacote'] },
  'loc-rap10': { 'Massa para wrap': [1, 'pacote'], 'Peito de frango': [500, 'g'], 'Queijo muçarela': [200, 'g'] },
  'loc-lasanha': {
    'Massa para lasanha': [500, 'g'], 'Carne moída': [500, 'g'], 'Molho de tomate': [2, 'sache'],
    'Queijo muçarela': [400, 'g'], 'Presunto': [200, 'g'],
  },
  'loc-frango-pure': { 'Peito de frango': [800, 'g'], 'Abóbora cabotiá': [1, 'kg'] },
  'loc-cenoura-beterraba': { 'Cenoura': [3, 'un'], 'Beterraba': [3, 'un'] },
  'loc-macarrao-gorgonzola': { 'Macarrão': [500, 'g'], 'Queijo gorgonzola': [200, 'g'], 'Tomate cereja': [1, 'bandeja'], 'Creme de leite': [1, 'caixa'] },

  // ── Banco de sugestões ──
  'bank-omelete': { 'Ovo': [12, 'un'], 'Tomate': [2, 'un'], 'Cebola': [1, 'un'], 'Cebolinha': [1, 'maco'], 'Queijo muçarela': [150, 'g'] },
  'bank-lasanha-berinjela': { 'Berinjela': [3, 'un'], 'Molho de tomate': [2, 'sache'], 'Queijo muçarela': [400, 'g'], 'Queijo ralado': [1, 'pacote'] },
  'bank-sopa-legumes': { 'Cenoura': [2, 'un'], 'Batata': [4, 'un'], 'Abobrinha': [1, 'un'], 'Chuchu': [2, 'un'], 'Cebola': [1, 'un'], 'Caldo de legumes': [2, 'un'] },
  'bank-alho-oleo': { 'Macarrão': [500, 'g'], 'Alho': [1, 'un'], 'Salsinha': [1, 'maco'], 'Queijo ralado': [1, 'pacote'] },
  'bank-sugo': { 'Macarrão': [500, 'g'], 'Molho de tomate': [2, 'sache'], 'Cebola': [1, 'un'], 'Alho': [1, 'un'], 'Queijo ralado': [1, 'pacote'] },
  'bank-arroz-feijao-ovo': { 'Arroz': [500, 'g'], 'Feijão': [500, 'g'], 'Ovo': [6, 'un'], 'Alface': [1, 'un'], 'Tomate': [3, 'un'] },
  'bank-grao-bico': { 'Grão-de-bico': [500, 'g'], 'Tomate cereja': [1, 'bandeja'], 'Pepino': [2, 'un'], 'Cebola': [1, 'un'], 'Salsinha': [1, 'maco'] },
  'bank-nhoque': { 'Batata': [1.5, 'kg'], 'Farinha de trigo': [2, 'xicara'], 'Ovo': [1, 'un'], 'Molho de tomate': [2, 'sache'], 'Queijo ralado': [1, 'pacote'] },
  'bank-cuscuz': { 'Flocão de milho': [500, 'g'], 'Ovo': [6, 'un'], 'Queijo branco': [300, 'g'] },
  'bank-tapioca': { 'Goma de tapioca': [500, 'g'], 'Queijo muçarela': [300, 'g'], 'Peito de peru': [300, 'g'] },
  'bank-crepioca': { 'Ovo': [6, 'un'], 'Goma de tapioca': [6, 'colher-sopa'], 'Queijo branco': [300, 'g'], 'Tomate': [2, 'un'] },
  'bank-sanduiche-atum': { 'Pão de forma ou francês': [1, 'pacote'], 'Atum': [2, 'lata'], 'Maionese': [1, 'pote'], 'Alface': [1, 'un'], 'Tomate': [2, 'un'] },
  'bank-lentilha': { 'Lentilha': [500, 'g'], 'Arroz': [500, 'g'], 'Cenoura': [2, 'un'], 'Cebola': [1, 'un'], 'Alho': [1, 'un'] },
  'bank-pure-abobora': { 'Abóbora cabotiá': [1.5, 'kg'], 'Ovo': [6, 'un'], 'Cebolinha': [1, 'maco'] },
  'bank-strogonoff-frango': { 'Peito de frango': [1, 'kg'], 'Creme de leite': [2, 'caixa'], 'Molho de tomate': [1, 'sache'], 'Cebola': [1, 'un'], 'Batata palha': [1, 'pacote'], 'Arroz': [500, 'g'] },
  'bank-frango-xadrez': { 'Peito de frango': [1, 'kg'], 'Pimentão': [2, 'un'], 'Cebola': [2, 'un'], 'Molho shoyu': [1, 'garrafa'], 'Arroz': [500, 'g'] },
  'bank-escondidinho': { 'Carne moída': [800, 'g'], 'Mandioca': [1.5, 'kg'], 'Queijo muçarela': [300, 'g'], 'Cebola': [1, 'un'], 'Requeijão': [1, 'pote'] },
  'bank-arroz-forno': { 'Arroz': [500, 'g'], 'Peito de frango': [500, 'g'], 'Milho': [1, 'lata'], 'Ervilha': [1, 'lata'], 'Molho de tomate': [1, 'sache'], 'Queijo muçarela': [300, 'g'] },
  'bank-panqueca-frango': { 'Farinha de trigo': [2, 'xicara'], 'Ovo': [2, 'un'], 'Leite': [500, 'ml'], 'Peito de frango': [600, 'g'], 'Molho de tomate': [2, 'sache'], 'Queijo muçarela': [200, 'g'] },
  'bank-carne-moida-batata': { 'Carne moída': [800, 'g'], 'Batata': [1, 'kg'], 'Cebola': [1, 'un'], 'Tomate': [2, 'un'], 'Arroz': [500, 'g'] },
  'bank-frango-assado': { 'Coxa e sobrecoxa': [1.5, 'kg'], 'Batata': [1, 'kg'], 'Cenoura': [3, 'un'], 'Cebola': [2, 'un'], 'Alho': [1, 'un'] },
  'bank-torta-frango': { 'Farinha de trigo': [2, 'xicara'], 'Ovo': [3, 'un'], 'Leite': [500, 'ml'], 'Peito de frango': [600, 'g'], 'Milho': [1, 'lata'], 'Requeijão': [1, 'pote'] },
  'bank-wrap-frango': { 'Massa para wrap': [1, 'pacote'], 'Peito de frango': [600, 'g'], 'Alface': [1, 'un'], 'Tomate': [2, 'un'], 'Requeijão': [1, 'pote'] },
  'bank-risoto-frango': { 'Arroz para risoto': [500, 'g'], 'Peito de frango': [500, 'g'], 'Caldo de legumes': [2, 'un'], 'Queijo ralado': [1, 'pacote'], 'Cebola': [1, 'un'] },
  'bank-berinjela-recheada': { 'Berinjela': [3, 'un'], 'Carne moída': [600, 'g'], 'Molho de tomate': [1, 'sache'], 'Queijo muçarela': [200, 'g'] },
  'bank-yakisoba': { 'Macarrão': [500, 'g'], 'Peito de frango': [600, 'g'], 'Brócolis': [1, 'un'], 'Cenoura': [2, 'un'], 'Repolho': [1, 'un'], 'Molho shoyu': [1, 'garrafa'] },
  'bank-misto-forno': { 'Pão de forma ou francês': [1, 'pacote'], 'Presunto': [300, 'g'], 'Queijo muçarela': [300, 'g'], 'Requeijão': [1, 'pote'] },
  'bank-pure-frango': { 'Batata': [1.5, 'kg'], 'Leite': [200, 'ml'], 'Peito de frango': [800, 'g'], 'Cebola': [1, 'un'], 'Tomate': [2, 'un'] },
  'bank-bife-acebolado': { 'Carne bovina': [1.2, 'kg'], 'Cebola': [3, 'un'], 'Arroz': [500, 'g'], 'Feijão': [500, 'g'] },
  'bank-tilapia': { 'Filé de tilápia': [1.2, 'kg'], 'Batata': [1, 'kg'], 'Cenoura': [2, 'un'], 'Tomate': [2, 'un'], 'Limão': [2, 'un'] },
  'bank-carne-panela-batata': { 'Carne bovina': [1, 'kg'], 'Batata': [1, 'kg'], 'Cenoura': [3, 'un'], 'Cebola': [2, 'un'], 'Tomate': [2, 'un'] },
  'bank-feijao-tropeiro': { 'Feijão': [500, 'g'], 'Linguiça': [500, 'g'], 'Ovo': [4, 'un'], 'Couve': [1, 'maco'], 'Cebola': [1, 'un'], 'Farinha de mandioca': [500, 'g'] },
};

/** Ingredientes que só aparecem aqui (categoria e apelidos). */
const NEW: Record<string, { cat: string; aliases?: string[] }> = {
  'Massa para lasanha': { cat: 'mercearia', aliases: ['Massa de lasanha'] },
  'Farinha de rosca': { cat: 'mercearia', aliases: ['Farinha de pão'] },
  'Leite': { cat: 'frios', aliases: ['Caixinha de leite'] },
  'Ovo': { cat: 'hortifruti', aliases: ['Ovos'] },
  'Farinha de trigo': { cat: 'mercearia' },
  'Presunto': { cat: 'frios' },
  'Molho shoyu': { cat: 'mercearia', aliases: ['Shoyu'] },
};

export interface PortionResult {
  recipesUpdated: number;
  itemsFilled: number;
  itemsAdded: number;
  dishesRefreshed: number;
}

/**
 * Preenche as quantidades para 6 pratos e atualiza os pratos das semanas a
 * partir de `fromDate` (normalmente o início da semana atual).
 */
export async function applyPortions(db: MesaDB, fromDate: string): Promise<PortionResult> {
  const now = Date.now();
  const result: PortionResult = { recipesUpdated: 0, itemsFilled: 0, itemsAdded: 0, dishesRefreshed: 0 };

  await db.transaction('rw', [db.recipes, db.ingredients, db.days], async () => {
    const index = await ingredientIndex(db);
    const byId = new Map((await db.ingredients.toArray()).map((i) => [i.id, i]));
    const ensure = async (name: string): Promise<Ingredient> => {
      const found = index.get(normalize(name));
      if (found) return found;
      const def = NEW[name];
      const ing: Ingredient = {
        id: `bank-ing-${normalize(name).replace(/[^a-z0-9]+/g, '-')}`,
        name, aliases: def?.aliases ?? [], categoryId: def?.cat ?? guessCategory(name), updatedAt: now,
      };
      await db.ingredients.put(ing);
      index.set(normalize(name), ing);
      for (const a of ing.aliases) index.set(normalize(a), ing);
      byId.set(ing.id, ing);
      return ing;
    };

    const updated = new Map<string, Recipe>();
    for (const recipe of await db.recipes.toArray()) {
      if (recipe.deleted) continue;
      const table = PORTIONS[recipe.id];
      let changed = false;
      const items: RecipeItem[] = recipe.items.map((it) => ({ ...it }));

      if (table) {
        // Mapa nome normalizado → [qtd, unidade], também pelos apelidos do ingrediente.
        const wanted = new Map(Object.entries(table).map(([n, q]) => [normalize(n), { name: n, q }]));
        const used = new Set<string>();
        for (const it of items) {
          const ing = byId.get(it.ingredientId);
          if (!ing) continue;
          const keys = [ing.name, ...ing.aliases].map(normalize);
          const hit = keys.map((k) => [k, wanted.get(k)] as const).find(([, w]) => w);
          if (!hit) continue;
          used.add(hit[0]);
          if (it.quantity == null) {
            it.quantity = hit[1]!.q[0];
            it.unit = hit[1]!.q[1];
            result.itemsFilled++;
            changed = true;
          }
        }
        // Ingredientes da tabela que a receita ainda não tinha (ex.: lasanha sem lista).
        for (const [key, w] of wanted) {
          if (used.has(key)) continue;
          const ing = await ensure(w.name);
          if (items.some((it) => it.ingredientId === ing.id)) continue;
          items.push({ ingredientId: ing.id, quantity: w.q[0], unit: w.q[1] });
          byId.set(ing.id, ing);
          result.itemsAdded++;
          changed = true;
        }
      }

      if (recipe.servings == null) changed = true;
      const link = recipe.link ?? (recipe.id.startsWith('bank-') ? bankLink(recipe.id, recipe.name) : undefined);
      if (link !== recipe.link) changed = true;
      if (!changed) continue;
      const next: Recipe = { ...recipe, items, servings: recipe.servings ?? DEFAULT_SERVINGS, updatedAt: now };
      if (link) next.link = link;
      await db.recipes.put(next);
      updated.set(next.id, next);
      result.recipesUpdated++;
    }

    // Semanas atuais e futuras passam a usar as quantidades novas.
    if (updated.size) {
      for (const day of await db.days.where('id').aboveOrEqual(fromDate).toArray()) {
        if (day.deleted) continue;
        let touched = false;
        for (const meal of ['almoco', 'jantar'] as const) {
          day.slots[meal] = (day.slots[meal] ?? []).map((dish) => {
            const r = updated.get(dish.recipeId);
            if (!r) return dish;
            touched = true;
            result.dishesRefreshed++;
            const snap = makeSnapshot(r, byId);
            if (dish.snapshot.imageId && !snap.imageId) snap.imageId = dish.snapshot.imageId;
            return { ...dish, snapshot: snap };
          });
          if (!day.slots[meal]!.length) delete day.slots[meal];
        }
        if (touched) await db.days.put({ ...day, updatedAt: now });
      }
    }
  });
  return result;
}
