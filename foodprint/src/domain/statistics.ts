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
