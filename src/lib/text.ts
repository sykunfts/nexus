/* Copy helpers shared by the storefront. */

/** A percentage change with its sign: "+140%", "-12%", "0%". Trend deltas can be negative once real data flows. */
export const signedPct = (n: number): string => `${n > 0 ? '+' : ''}${n}%`
