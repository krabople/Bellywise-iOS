/** Bounded Damerau–Levenshtein: catches adjacent transpositions without unbounded work. */
export function spellingDistance(a: string, b: string, limit = 2): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i), beforePrevious = previous;
  for (let i = 1; i <= a.length; i++) {
    const row = Array(b.length + 1).fill(limit + 1); row[0] = i;
    for (let j = Math.max(1, i - limit); j <= Math.min(b.length, i + limit); j++) {
      row[j] = Math.min(row[j - 1] + 1, previous[j] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) row[j] = Math.min(row[j], beforePrevious[j - 2] + 1);
    }
    beforePrevious = previous; previous = row;
  }
  return previous[b.length];
}

export const foodQualifierKey = (text: string) => ['gluten free', 'lactose free', 'dairy free', 'vegan', 'vegetarian', 'decaf', 'alcohol free', 'sugar free'].filter(term => text.includes(term)).join('|');
