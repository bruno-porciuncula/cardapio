/**
 * Banco de receitas sugeridas, no estilo dos cardápios da casa:
 * comida caseira simples, que rende almoço + sobra.
 *
 * - Ingredientes pelo nome: se já existir um igual (nome ou apelido), é reaproveitado.
 * - Sem quantidades inventadas: você completa quando quiser.
 * - Ids fixos "bank-…": carregar no Mac e no celular não duplica nada.
 * - Também marca a tag de custo nas receitas que você já tinha (só se ainda não tiverem).
 */
import type { MesaDB } from './db';
import type { Cost, Ingredient, MealType, Recipe, RecipeItem } from './types';
import { normalize } from '../lib/text';
import { guessCategory, ingredientIndex } from './recipes';

type It = string | [name: string, note: string];
interface BankRecipe {
  id: string;
  name: string;
  emoji: string;
  cost: Cost;
  meal?: MealType;
  items: It[];
}

/** Categoria e apelidos dos ingredientes novos que o banco usa. */
const NEW_INGREDIENTS: Record<string, { cat: string; aliases?: string[] }> = {
  'Ovo': { cat: 'hortifruti', aliases: ['Ovos'] },
  'Pimentão': { cat: 'hortifruti' },
  'Molho shoyu': { cat: 'mercearia', aliases: ['Shoyu'] },
  'Mandioca': { cat: 'hortifruti', aliases: ['Aipim', 'Macaxeira'] },
  'Batata': { cat: 'hortifruti' },
  'Farinha de trigo': { cat: 'mercearia' },
  'Leite': { cat: 'frios', aliases: ['Caixinha de leite'] },
  'Alho': { cat: 'hortifruti' },
  'Salsinha': { cat: 'hortifruti', aliases: ['Salsa'] },
  'Coxa e sobrecoxa': { cat: 'acougue', aliases: ['Sobrecoxa'] },
  'Alface': { cat: 'hortifruti' },
  'Maionese': { cat: 'mercearia' },
  'Grão-de-bico': { cat: 'mercearia' },
  'Flocão de milho': { cat: 'mercearia', aliases: ['Cuscuz', 'Farinha de milho flocada'] },
  'Filé de tilápia': { cat: 'acougue', aliases: ['Tilápia', 'Peixe'] },
  'Repolho': { cat: 'hortifruti' },
  'Goma de tapioca': { cat: 'mercearia', aliases: ['Tapioca'] },
  'Abóbora cabotiá': { cat: 'hortifruti', aliases: ['Cabotiá'] },
  'Requeijão': { cat: 'frios' },
  'Presunto': { cat: 'frios' },
  'Lentilha': { cat: 'mercearia' },
  'Linguiça': { cat: 'acougue' },
  'Chuchu': { cat: 'hortifruti' },
  'Couve': { cat: 'hortifruti' },
};

/** Link de busca do modo de preparo (sempre funciona; dá para trocar por um link específico em Editar). */
export function searchLink(name: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(`receita ${name}`)}`;
}

/** Página de receita escolhida para cada sugestão (conferida). Sem entrada = link de busca. */
export const RECIPE_LINKS: Record<string, string> = {
  'bank-omelete': 'https://www.tudogostoso.com.br/receita/404-omelete-de-legumes.html',
  'bank-lasanha-berinjela': 'https://panelinha.com.br/receita/lasanha-de-berinjela-com-molho-de-tomate-caseiro',
  'bank-sopa-legumes': 'https://panelinha.com.br/receita/sopa-de-legumes',
  'bank-alho-oleo': 'https://panelinha.com.br/receita/espaguete-ao-alho-e-oleo',
  'bank-sugo': 'https://panelinha.com.br/receita/macarrao-com-molho-de-tomate-rapido',
  'bank-arroz-feijao-ovo': 'https://panelinha.com.br/receita/feijao-caseiro',
  'bank-grao-bico': 'https://panelinha.com.br/receita/salada-rapida-de-grao-de-bico',
  'bank-nhoque': 'https://panelinha.com.br/receita/nhoque-batata',
  'bank-cuscuz': 'https://panelinha.com.br/receita/cuscuz-milho-com-ovo-poche',
  'bank-tapioca': 'https://panelinha.com.br/receita/tapioca-para-um',
  'bank-crepioca': 'https://www.tudogostoso.com.br/receita/172128-crepioca.html',
  'bank-sanduiche-atum': 'https://panelinha.com.br/receita/sanduiche-de-atum',
  'bank-lentilha': 'https://panelinha.com.br/receita/arroz-com-lentilhas',
  'bank-pure-abobora': 'https://panelinha.com.br/receita/pure-rustico-de-abobora',
  'bank-strogonoff-frango': 'https://panelinha.com.br/receita/estrogonofe-de-frango',
  'bank-frango-xadrez': 'https://panelinha.com.br/receita/frango-xadrez',
  'bank-escondidinho': 'https://www.tudogostoso.com.br/receita/115772-escondidinho-de-aipim-com-carne-moida.html',
  'bank-arroz-forno': 'https://www.tudogostoso.com.br/receita/13293-arroz-de-forno-com-frango-da-elu.html',
  'bank-panqueca-frango': 'https://www.tudogostoso.com.br/receita/296953-panqueca-de-frango.html',
  'bank-carne-moida-batata': 'https://www.tudogostoso.com.br/receita/131598-carne-moida-com-batata.html',
  'bank-frango-assado': 'https://www.tudogostoso.com.br/receita/299759-coxa-e-sobrecoxa-de-frango-ao-forno-com-limao-e-batata.html',
  'bank-torta-frango': 'https://www.tudogostoso.com.br/receita/158819-torta-de-frango-de-liquidificador.html',
  'bank-wrap-frango': 'https://www.receiteria.com.br/receita/wrap-de-frango/',
  'bank-risoto-frango': 'https://www.tudogostoso.com.br/receita/147209-risoto-de-frango.html',
  'bank-berinjela-recheada': 'https://www.tudogostoso.com.br/receita/6896-berinjela-recheada-com-carne-moida-e-tomate-seco.html',
  'bank-yakisoba': 'https://www.tudogostoso.com.br/receita/62849-yakissoba-de-frango.html',
  'bank-misto-forno': 'https://www.tudogostoso.com.br/receita/318779-misto-quente-de-forno.html',
  'bank-pure-frango': 'https://www.tudogostoso.com.br/receita/113426-frango-desfiado-com-pure-de-batatas.html',
  'bank-bife-acebolado': 'https://www.tudogostoso.com.br/receita/166659-bife-acebolado.html',
  'bank-tilapia': 'https://www.tudogostoso.com.br/receita/121953-file-de-tilapia-assada-com-legumes.html',
  'bank-carne-panela-batata': 'https://www.tudogostoso.com.br/receita/303407-carne-de-panela-com-batata-e-cenoura.html',
  'bank-feijao-tropeiro': 'https://www.receiteria.com.br/receita/feijao-tropeiro-com-couve/',
};

export function bankLink(id: string, name: string): string {
  return RECIPE_LINKS[id] ?? searchLink(name);
}

/**
 * Troca o link de busca pela página escolhida nas sugestões que ainda usam a busca.
 * Link que você colou na receita não é alterado.
 */
export async function applyBankLinks(db: MesaDB): Promise<number> {
  const now = Date.now();
  let n = 0;
  await db.transaction('rw', db.recipes, async () => {
    for (const r of await db.recipes.where('id').startsWith('bank-').toArray()) {
      const target = RECIPE_LINKS[r.id];
      if (!target || r.deleted) continue;
      if (r.link && r.link !== searchLink(r.name)) continue;
      if (r.link === target) continue;
      await db.recipes.put({ ...r, link: target, updatedAt: now });
      n++;
    }
  });
  return n;
}

export const BANK: BankRecipe[] = [
  // ── Econômicas ($) ──
  { id: 'bank-omelete', name: 'Omelete de legumes', emoji: '🍳', cost: 'baixo', items: ['Ovo', 'Tomate', 'Cebola', 'Cebolinha', 'Queijo muçarela'] },
  { id: 'bank-lasanha-berinjela', name: 'Lasanha de berinjela', emoji: '🍆', cost: 'baixo', items: ['Berinjela', 'Molho de tomate', 'Queijo muçarela', 'Queijo ralado'] },
  { id: 'bank-sopa-legumes', name: 'Sopa de legumes', emoji: '🍲', cost: 'baixo', meal: 'jantar', items: ['Cenoura', 'Batata', 'Abobrinha', 'Chuchu', 'Cebola', 'Caldo de legumes'] },
  { id: 'bank-alho-oleo', name: 'Macarrão alho e óleo', emoji: '🍝', cost: 'baixo', items: ['Macarrão', 'Alho', 'Salsinha', 'Queijo ralado'] },
  { id: 'bank-sugo', name: 'Macarrão ao sugo', emoji: '🍝', cost: 'baixo', items: ['Macarrão', 'Molho de tomate', 'Cebola', 'Alho', 'Queijo ralado'] },
  { id: 'bank-arroz-feijao-ovo', name: 'Arroz, feijão e ovo frito + salada', emoji: '🍳', cost: 'baixo', meal: 'almoco', items: ['Arroz', 'Feijão', 'Ovo', 'Alface', 'Tomate'] },
  { id: 'bank-grao-bico', name: 'Salada de grão-de-bico', emoji: '🥗', cost: 'baixo', items: ['Grão-de-bico', 'Tomate cereja', 'Pepino', 'Cebola', 'Salsinha'] },
  { id: 'bank-nhoque', name: 'Nhoque de batata ao sugo', emoji: '🥔', cost: 'baixo', items: ['Batata', 'Farinha de trigo', 'Ovo', 'Molho de tomate', 'Queijo ralado'] },
  { id: 'bank-cuscuz', name: 'Cuscuz com ovo', emoji: '🌽', cost: 'baixo', meal: 'jantar', items: ['Flocão de milho', 'Ovo', 'Queijo branco'] },
  { id: 'bank-tapioca', name: 'Tapioca de queijo e peito de peru', emoji: '🫓', cost: 'baixo', meal: 'jantar', items: ['Goma de tapioca', 'Queijo muçarela', 'Peito de peru'] },
  { id: 'bank-crepioca', name: 'Crepioca', emoji: '🥞', cost: 'baixo', meal: 'jantar', items: ['Ovo', 'Goma de tapioca', 'Queijo branco', 'Tomate'] },
  { id: 'bank-sanduiche-atum', name: 'Sanduíche de atum', emoji: '🥪', cost: 'baixo', meal: 'jantar', items: [['Pão de forma ou francês', 'de forma'], 'Atum', 'Maionese', 'Alface', 'Tomate'] },
  { id: 'bank-lentilha', name: 'Lentilha com arroz e legumes', emoji: '🍛', cost: 'baixo', items: ['Lentilha', 'Arroz', 'Cenoura', 'Cebola', 'Alho'] },
  { id: 'bank-pure-abobora', name: 'Purê de abóbora com ovo cozido', emoji: '🎃', cost: 'baixo', items: ['Abóbora cabotiá', 'Ovo', 'Cebolinha'] },

  // ── Médias ($$) ──
  { id: 'bank-strogonoff-frango', name: 'Strogonoff de frango', emoji: '🍗', cost: 'medio', items: ['Peito de frango', 'Creme de leite', 'Molho de tomate', 'Cebola', 'Batata palha', 'Arroz'] },
  { id: 'bank-frango-xadrez', name: 'Frango xadrez', emoji: '🥢', cost: 'medio', items: [['Peito de frango', 'em cubos'], 'Pimentão', 'Cebola', 'Molho shoyu', 'Arroz'] },
  { id: 'bank-escondidinho', name: 'Escondidinho de carne moída', emoji: '🥘', cost: 'medio', items: ['Carne moída', 'Mandioca', 'Queijo muçarela', 'Cebola', 'Requeijão'] },
  { id: 'bank-arroz-forno', name: 'Arroz de forno', emoji: '🍛', cost: 'medio', items: ['Arroz', ['Peito de frango', 'desfiado'], 'Milho', 'Ervilha', 'Molho de tomate', 'Queijo muçarela'] },
  { id: 'bank-panqueca-frango', name: 'Panqueca de frango', emoji: '🥞', cost: 'medio', items: ['Farinha de trigo', 'Ovo', 'Leite', ['Peito de frango', 'desfiado'], 'Molho de tomate', 'Queijo muçarela'] },
  { id: 'bank-carne-moida-batata', name: 'Carne moída com batata', emoji: '🥔', cost: 'medio', items: ['Carne moída', 'Batata', 'Cebola', 'Tomate', 'Arroz'] },
  { id: 'bank-frango-assado', name: 'Frango assado com legumes', emoji: '🍗', cost: 'medio', items: ['Coxa e sobrecoxa', 'Batata', 'Cenoura', 'Cebola', 'Alho'] },
  { id: 'bank-torta-frango', name: 'Torta de frango de liquidificador', emoji: '🥧', cost: 'medio', items: ['Farinha de trigo', 'Ovo', 'Leite', ['Peito de frango', 'desfiado'], 'Milho', 'Requeijão'] },
  { id: 'bank-wrap-frango', name: 'Wrap de frango', emoji: '🌯', cost: 'medio', meal: 'jantar', items: ['Massa para wrap', ['Peito de frango', 'desfiado'], 'Alface', 'Tomate', 'Requeijão'] },
  { id: 'bank-risoto-frango', name: 'Risoto de frango', emoji: '🍚', cost: 'medio', items: ['Arroz para risoto', 'Peito de frango', 'Caldo de legumes', 'Queijo ralado', 'Cebola'] },
  { id: 'bank-berinjela-recheada', name: 'Berinjela recheada com carne moída', emoji: '🍆', cost: 'medio', items: ['Berinjela', 'Carne moída', 'Molho de tomate', 'Queijo muçarela'] },
  { id: 'bank-yakisoba', name: 'Yakisoba de frango', emoji: '🥢', cost: 'medio', items: [['Macarrão', 'para yakisoba'], 'Peito de frango', 'Brócolis', 'Cenoura', 'Repolho', 'Molho shoyu'] },
  { id: 'bank-misto-forno', name: 'Misto quente de forno', emoji: '🥪', cost: 'medio', meal: 'jantar', items: [['Pão de forma ou francês', 'de forma'], 'Presunto', 'Queijo muçarela', 'Requeijão'] },
  { id: 'bank-pure-frango', name: 'Purê de batata com frango desfiado', emoji: '🥔', cost: 'medio', items: ['Batata', 'Leite', ['Peito de frango', 'desfiado'], 'Cebola', 'Tomate'] },

  // ── Mais caras ($$$) ──
  { id: 'bank-bife-acebolado', name: 'Bife acebolado com arroz e feijão', emoji: '🥩', cost: 'alto', items: [['Carne bovina', 'bife'], 'Cebola', 'Arroz', 'Feijão'] },
  { id: 'bank-tilapia', name: 'Tilápia assada com legumes', emoji: '🐟', cost: 'alto', items: ['Filé de tilápia', 'Batata', 'Cenoura', 'Tomate', 'Limão'] },
  { id: 'bank-carne-panela-batata', name: 'Carne de panela com batata e cenoura', emoji: '🥘', cost: 'alto', items: [['Carne bovina', 'em cubos'], 'Batata', 'Cenoura', 'Cebola', 'Tomate'] },
  { id: 'bank-feijao-tropeiro', name: 'Feijão tropeiro com couve', emoji: '🫘', cost: 'alto', items: ['Feijão', 'Linguiça', 'Ovo', 'Couve', 'Cebola', 'Farinha de mandioca'] },
];

/** Tag de custo para as receitas que você já tinha (exemplo + seus cardápios). */
export const EXISTING_COST: Record<string, Cost> = {
  'ex-carne-panela': 'alto', 'ex-berinjela-forno': 'baixo', 'ex-macarrao-oriental': 'baixo', 'ex-estrogonofe': 'alto',
  'ex-wrap': 'medio', 'ex-risoto-gorgonzola': 'alto', 'ex-hamburguer': 'medio', 'ex-misto-quente': 'baixo',
  'loc-macarrao-milho': 'baixo', 'loc-berinjela-milanesa': 'baixo', 'loc-pizza': 'alto', 'loc-lanche-natural': 'baixo',
  'loc-ratatouille': 'baixo', 'loc-frango-grelhado': 'medio', 'loc-bolonhesa': 'medio', 'loc-risoto-caprese': 'medio',
  'loc-wrap-carne': 'medio', 'loc-panqueca': 'medio', 'loc-macarrao-cebola': 'baixo', 'loc-cachorro-quente': 'baixo',
  'loc-carne-oriental': 'alto', 'loc-salada-cenoura-pepino': 'baixo', 'loc-arroz-frango': 'medio',
  'loc-macarrao-crocante': 'baixo', 'loc-rap10': 'medio', 'loc-lasanha': 'medio', 'loc-frango-pure': 'medio',
  'loc-cenoura-beterraba': 'baixo', 'loc-macarrao-gorgonzola': 'alto',
};

export interface BankResult {
  recipesAdded: number;
  ingredientsAdded: number;
  costsTagged: number;
}

export async function bankPending(db: MesaDB): Promise<number> {
  const names = new Set((await db.recipes.toArray()).filter((r) => !r.deleted).map((r) => normalize(r.name)));
  const ids = new Set((await db.recipes.toArray()).map((r) => r.id));
  return BANK.filter((b) => !ids.has(b.id) && !names.has(normalize(b.name))).length;
}

export async function loadBank(db: MesaDB): Promise<BankResult> {
  const now = Date.now();
  const result: BankResult = { recipesAdded: 0, ingredientsAdded: 0, costsTagged: 0 };
  await db.transaction('rw', [db.recipes, db.ingredients], async () => {
    const index = await ingredientIndex(db);
    const ingredientId = async (name: string): Promise<string> => {
      const found = index.get(normalize(name));
      if (found) return found.id;
      const def = NEW_INGREDIENTS[name];
      const ing: Ingredient = {
        id: `bank-ing-${normalize(name).replace(/[^a-z0-9]+/g, '-')}`,
        name,
        aliases: def?.aliases ?? [],
        categoryId: def?.cat ?? guessCategory(name),
        updatedAt: now,
      };
      await db.ingredients.put(ing);
      index.set(normalize(name), ing);
      for (const a of ing.aliases) index.set(normalize(a), ing);
      result.ingredientsAdded++;
      return ing.id;
    };

    const all = await db.recipes.toArray();
    const ids = new Set(all.map((r) => r.id));
    const names = new Set(all.filter((r) => !r.deleted).map((r) => normalize(r.name)));

    for (const b of BANK) {
      if (ids.has(b.id) || names.has(normalize(b.name))) continue;
      const items: RecipeItem[] = [];
      for (const it of b.items) {
        const [name, note] = typeof it === 'string' ? [it, undefined] : it;
        const item: RecipeItem = { ingredientId: await ingredientId(name), quantity: null, unit: null };
        if (note) item.note = note;
        items.push(item);
      }
      const recipe: Recipe = { id: b.id, name: b.name, emoji: b.emoji, cost: b.cost, mealType: b.meal ?? 'ambos', items, link: bankLink(b.id, b.name), updatedAt: now };
      await db.recipes.put(recipe);
      result.recipesAdded++;
    }

    for (const r of all) {
      const cost = EXISTING_COST[r.id];
      if (cost && !r.cost && !r.deleted) {
        await db.recipes.put({ ...r, cost, updatedAt: now });
        result.costsTagged++;
      }
    }
  });
  return result;
}
