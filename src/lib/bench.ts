/*
  Independent tests: what the maker claims against what reviewers measured, per product.
  Every row links to the review that measured it. Rows nobody measured are left out, not invented.
  Replaced by NEXUS bench results once a unit has been through the Sydney bench.
  The first three rows of a product are the ones its page shows as tiles; the rest sit behind "All n measurements".
*/
export interface BenchRow { metric: string; claimed: string; measured: string; by: string; url: string; verdict: 'pass' | 'check' }

const WILLEN = 'https://www.laurentwillen.com/en/test-reviews/projectors-tests-reviews/xgimi-mogo-4-laser-test-review/'

export const BENCH: Record<string, BenchRow[]> = {
  'xgimi-mogo-4-laser': [
    { metric: 'Brightness, standard mode', claimed: '550 ISO lm', measured: '370 to 390 ANSI lm', by: 'laurentwillen.com', url: WILLEN, verdict: 'check' },
    { metric: 'Battery, standard mode', claimed: '2.5 h in Eco', measured: '1 h 53 min', by: 'expertreviews.co.uk', url: 'https://www.expertreviews.co.uk/technology/tvs-home-cinema/xgimi-mogo-4-laser-review', verdict: 'check' },
    { metric: 'Input lag', claimed: '', measured: '40 ms', by: 'laurentwillen.com', url: WILLEN, verdict: 'pass' },
    { metric: 'Battery, full brightness', claimed: '', measured: '92 min', by: 'gamerevolution.com', url: 'https://www.gamerevolution.com/review/981910-xgimi-mogo-4-laser-review-projector-worth-buying', verdict: 'check' },
    { metric: 'Boot to home screen', claimed: '', measured: '51 s', by: 'newedgetimes.com', url: 'https://www.newedgetimes.com/xgimi-mogo-4-laser-review/', verdict: 'check' },
    { metric: 'Fan noise, close up', claimed: '≤ 28 dB at 1 m', measured: 'under 40 dB', by: 'laurentwillen.com', url: WILLEN, verdict: 'check' },
  ],
}

export const benchFor = (productId: string): BenchRow[] => BENCH[productId] ?? []

export const verdictText = (r: BenchRow): string => {
  if (r.verdict === 'check') return r.claimed ? 'Short of the claim' : 'A weak spot, no maker claim'
  return r.claimed ? 'Matches the claim' : 'No maker claim to check'
}
