const clamp = (value: number, minimum = 0, maximum = 1) => Math.max(minimum, Math.min(maximum, value));

export function wilsonInterval(successes: number, total: number): [number, number] {
  if (!total) return [0, 1];
  const z = 1.959963984540054;
  const proportion = successes / total;
  const denominator = 1 + z * z / total;
  const centre = (proportion + z * z / (2 * total)) / denominator;
  const spread = z * Math.sqrt(proportion * (1 - proportion) / total + z * z / (4 * total * total)) / denominator;
  return [clamp(centre - spread), clamp(centre + spread)];
}

/** Newcombe's unpaired score interval, built from Wilson limits. */
export function differenceInterval(a: number, n1: number, c: number, n0: number): [number, number] {
  if (!n1 || !n0) return [-1, 1];
  const p1 = a / n1, p0 = c / n0;
  const [l1, u1] = wilsonInterval(a, n1), [l0, u0] = wilsonInterval(c, n0);
  const difference = p1 - p0;
  return [clamp(difference - Math.hypot(p1 - l1, u0 - p0), -1, 1), clamp(difference + Math.hypot(u1 - p1, p0 - l0), -1, 1)];
}

/** Two-sided Fisher exact test; sums tables no more probable than the observed one. */
export function fisherExact(a: number, b: number, c: number, d: number): number {
  const n = a + b + c + d;
  if (!n) return 1;
  const logFactorial = new Float64Array(n + 1);
  for (let i = 2; i <= n; i++) logFactorial[i] = logFactorial[i - 1] + Math.log(i);
  const logChoose = (size: number, count: number) => count < 0 || count > size ? -Infinity : logFactorial[size] - logFactorial[count] - logFactorial[size - count];
  const exposed = a + b, symptomatic = a + c;
  const logProbability = (value: number) => logChoose(symptomatic, value) + logChoose(n - symptomatic, exposed - value) - logChoose(n, exposed);
  const observed = logProbability(a);
  let probability = 0;
  for (let value = Math.max(0, exposed - (n - symptomatic)); value <= Math.min(exposed, symptomatic); value++) {
    const current = logProbability(value);
    if (current <= observed + 1e-10) probability += Math.exp(current);
  }
  return clamp(probability);
}

export function benjaminiHochberg(pValues: number[]): number[] {
  const order = pValues.map((p, index) => ({ p, index })).sort((a, b) => a.p - b.p);
  const result = new Array<number>(pValues.length);
  let previous = 1;
  for (let index = order.length - 1; index >= 0; index--) {
    const item = order[index];
    previous = Math.min(previous, item.p * order.length / (index + 1));
    result[item.index] = clamp(previous);
  }
  return result;
}

/** Ordinal 1–5 comparison. Small samples use an exact label-permutation rank test
 * that includes ties; larger samples use the tie-corrected Mann–Whitney normal
 * approximation with continuity correction. No equal spacing of ratings is
 * assumed for the test. Averages elsewhere are descriptive only. */
export function compareOrdinalRatings(x: number[], y: number[]): { pValue: number; probabilityOfHigher: number } {
  if (![...x, ...y].every(v => Number.isInteger(v) && v >= 1 && v <= 5)) throw new RangeError('Ratings must be integers from 1 to 5.');
  if (!x.length || !y.length) return { pValue: 1, probabilityOfHigher: .5 };
  const cx = [0, 0, 0, 0, 0], cy = [...cx];
  x.forEach(v => cx[v - 1]++); y.forEach(v => cy[v - 1]++);
  const counts = cx.map((v, i) => v + cy[i]), n = x.length + y.length;
  let lowerY = 0, u = 0, lower = 0, rankSum2 = 0;
  const ranks2 = counts.map((count, i) => {
    u += cx[i] * (lowerY + cy[i] / 2); lowerY += cy[i];
    const rank2 = 2 * lower + count + 1; lower += count;
    rankSum2 += cx[i] * rank2;
    return rank2;
  });
  const probabilityOfHigher = u / (x.length * y.length);
  if (counts.some(count => count === n)) return { pValue: 1, probabilityOfHigher };
  if (n <= 30) {
    const choose = (size: number, count: number) => {
      let value = 1;
      for (let i = 1; i <= Math.min(count, size - count); i++) value *= (size - i + 1) / i;
      return value;
    };
    const expected2 = x.length * (n + 1), observedDistance = Math.abs(rankSum2 - expected2);
    let extreme = 0;
    const visit = (level: number, remaining: number, sum2: number, weight: number) => {
      if (level === 5) {
        if (remaining === 0 && Math.abs(sum2 - expected2) >= observedDistance - 1e-9) extreme += weight;
        return;
      }
      const later = counts.slice(level + 1).reduce((a, b) => a + b, 0);
      for (let k = Math.max(0, remaining - later); k <= Math.min(counts[level], remaining); k++) {
        visit(level + 1, remaining - k, sum2 + k * ranks2[level], weight * choose(counts[level], k));
      }
    };
    visit(0, x.length, 0, 1);
    return { pValue: clamp(extreme / choose(n, x.length)), probabilityOfHigher };
  }
  // Avoid an optimistic normal approximation when one group is very small.
  if (Math.min(x.length, y.length) < 6) return { pValue: 1, probabilityOfHigher };
  const ties = counts.reduce((sum, t) => sum + t ** 3 - t, 0);
  const variance = x.length * y.length / 12 * (n + 1 - ties / (n * (n - 1)));
  if (variance <= 0) return { pValue: 1, probabilityOfHigher };
  const z = Math.max(0, Math.abs(u - x.length * y.length / 2) - .5) / Math.sqrt(variance);
  // Abramowitz–Stegun 7.1.26, evaluating erfc directly to avoid cancellation.
  const value = z / Math.SQRT2, t = 1 / (1 + .3275911 * value);
  const pValue = (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - .284496736) * t + .254829592) * t) * Math.exp(-value * value);
  return { pValue: clamp(pValue), probabilityOfHigher };
}
