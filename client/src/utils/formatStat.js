/** Format a count for hero stats (e.g. 12000 → { animateTo: 12, suffix: 'K+' }). */
export function formatStatNumber(num) {
  const n = Math.max(0, Number(num) || 0);

  if (n >= 1_000_000) {
    const m = Math.floor(n / 1_000_000);
    return { animateTo: m, suffix: 'M+', raw: n };
  }
  if (n >= 10_000) {
    const k = Math.floor(n / 1_000);
    return { animateTo: k, suffix: 'K+', raw: n };
  }
  if (n >= 1_000) {
    return { animateTo: n, suffix: '+', raw: n };
  }
  return { animateTo: n, suffix: '', raw: n };
}
