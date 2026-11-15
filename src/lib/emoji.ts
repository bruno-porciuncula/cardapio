import { normalize } from './text';

/** Ícone do prato deduzido do nome, quando a receita não tem um definido. */
const RULES: Array<[RegExp, string]> = [
  [/pizza/, '🍕'],
  [/hamburg|burger/, '🍔'],
  [/macarr|massa|espaguete|penne|lasanha|nhoque/, '🍝'],
  [/risoto/, '🍚'],
  [/estrogon|strogon|panela|ensopad|cozid/, '🥘'],
  [/berinjela/, '🍆'],
  [/wrap|burrito|taco/, '🌯'],
  [/misto|sanduich|pao|torrada/, '🥪'],
  [/frango|galinha/, '🍗'],
  [/peixe|salmao|tilapia/, '🐟'],
  [/camarao/, '🍤'],
  [/sopa|caldo/, '🍲'],
  [/salada/, '🥗'],
  [/ovo|omelete/, '🍳'],
  [/carne|bife|picanha/, '🥩'],
  [/arroz|feijao/, '🍛'],
];

export function dishEmoji(name: string, emoji?: string): string {
  if (emoji) return emoji;
  const n = normalize(name);
  for (const [re, icon] of RULES) if (re.test(n)) return icon;
  return '🍽️';
}
