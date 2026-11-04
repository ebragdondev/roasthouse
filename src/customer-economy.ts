/**
 * Roasthouse Phase 5 — pure, deterministic customer economy.
 * Zero dependencies. All inputs are explicit; no DOM, randomness, or mutations.
 */
type CohortId = 'commuters' | 'students' | 'enthusiasts' | 'locals';
type CohortCounts = Record<CohortId, number>;
type CohortMix = Record<CohortId, number>;
type CohortProfile = { priceSensitivity: number; preferences: Record<string, number> };
type CustomerStateV5 = {
  satisfaction: number;
  loyalty: number;
  returningPool: number;
  reviewStars: number;
  lifetimeVisits: number;
  lifetimeRepeatVisits: number;
  lastWeek: CustomerWeekV5 | null;
};
type CustomerWeekV5 = {
  demand: number;
  visits: number;
  newVisits: number;
  returningVisits: number;
  lostStock: number;
  lostCapacity: number;
  waitMinutes: number;
  satisfaction: number;
  retentionRate: number;
  fulfillmentRate: number;
  reviewStars: number;
  cohortVisits: CohortCounts;
};
type CustomerWeekInput = {
  demand: number;
  sold: number;
  lostStock: number;
  lostCapacity: number;
  capacity: number;
  averageQuality: number;
  cleanlinessQuality: number;
  comfort: number;
  retentionBonus: number;
  cohortVisits: CohortCounts;
};

const CustomerEconomy = (() => {
  const cohortKeys: CohortId[] = ['commuters', 'students', 'enthusiasts', 'locals'];
  const bound = (value: number, lo: number, hi: number): number =>
    Math.max(lo, Math.min(hi, value));
  const round1 = (value: number): number => Math.round(value * 10) / 10;
  const empty = (): CohortCounts => ({ commuters: 0, students: 0, enthusiasts: 0, locals: 0 });

  function initialCustomers(): CustomerStateV5 {
    return { satisfaction: 72, loyalty: 34, returningPool: 120,
      reviewStars: 3.9, lifetimeVisits: 0, lifetimeRepeatVisits: 0, lastWeek: null };
  }

  // Largest-remainder apportionment guarantees exact integer totals in every cohort.
  function distribute(total: number, weights: CohortMix): CohortCounts {
    const result = empty();
    const n = Math.max(0, Math.floor(total));
    const positive = cohortKeys.map(key => ({ key, weight: Math.max(0, weights[key] || 0) }));
    const sum = positive.reduce((acc, item) => acc + item.weight, 0);
    if (!sum || !n) { if (n) result.locals = n; return result; }
    const remainders = positive.map(item => {
      const exact = n * item.weight / sum;
      result[item.key] = Math.floor(exact);
      return { key: item.key, fractional: exact - result[item.key] };
    }).sort((a, b) => b.fractional - a.fractional || cohortKeys.indexOf(a.key) - cohortKeys.indexOf(b.key));
    let remaining = n - cohortKeys.reduce((acc, key) => acc + result[key], 0);
    for (const item of remainders) if (remaining > 0) { result[item.key]++; remaining--; }
    return result;
  }

  function forecastCohorts(
    units: number, mix: CohortMix, productId: string, priceRatio: number,
    segments: Record<CohortId, CohortProfile>
  ): CohortCounts {
    const weights = {} as CohortMix;
    for (const id of cohortKeys) {
      // Fixed product reference price; individual cohorts are more or less price sensitive.
      weights[id] = mix[id] * (segments[id].preferences[productId] ?? 1) *
        Math.pow(bound(priceRatio, .3, 4), -(segments[id].priceSensitivity - 1) * .5);
    }
    return distribute(units, weights);
  }

  function demandMultiplier(customers: CustomerStateV5): number {
    // Bounded, gradual effect. No snowballing customer counts or exponential growth.
    return bound(.86 + .0016 * customers.loyalty + .0012 * customers.satisfaction, .84, 1.15);
  }

  function evaluateWeek(previous: CustomerStateV5, input: CustomerWeekInput): CustomerStateV5 {
    const demand = Math.max(0, Math.floor(input.demand));
    const sold = Math.max(0, Math.min(demand, Math.floor(input.sold)));
    const fulfillmentRate = demand ? sold / demand : 1;
    const util = demand / Math.max(1, input.capacity);
    const waitMinutes = round1(bound(2.5 + 17 * Math.max(0, util - .66), 2.5, 30));
    const stockoutRate = demand ? input.lostStock / demand : 0;
    const capacityLossRate = demand ? input.lostCapacity / demand : 0;
    const satisfactionTarget = bound(
      18 + 39 * bound(input.averageQuality, .4, 1.35) + 15 * fulfillmentRate +
      9 * bound(input.cleanlinessQuality, .5, 1.3) +
      5 * bound(input.comfort, .65, 1.35) - 1.15 * waitMinutes -
      12 * stockoutRate - 8 * capacityLossRate, 4, 99
    );
    const satisfaction = round1(bound(previous.satisfaction * .55 + satisfactionTarget * .45, 5, 100));
    const retentionRate = bound(.12 + .0053 * satisfaction + .0014 * previous.loyalty +
      bound(input.retentionBonus, 0, .16) - .001 * waitMinutes, .08, .88);
    const returningVisits = Math.min(sold, Math.round(previous.returningPool * fulfillmentRate));
    const newVisits = sold - returningVisits;
    const loyaltyTarget = bound(13 + satisfaction * .74 + 45 * input.retentionBonus, 5, 97);
    const loyalty = round1(bound(previous.loyalty * .84 + loyaltyTarget * .16, 0, 100));
    const reviewStars = round1(bound(.8 + satisfaction / 24, 1, 5));
    const returningPool = Math.max(0, Math.round(previous.returningPool * .34 + sold * retentionRate));
    const lastWeek: CustomerWeekV5 = {
      demand, visits: sold, newVisits, returningVisits,
      lostStock: Math.max(0, input.lostStock), lostCapacity: Math.max(0, input.lostCapacity),
      waitMinutes, satisfaction, retentionRate: round1(retentionRate * 100) / 100,
      fulfillmentRate: round1(fulfillmentRate * 1000) / 1000,
      reviewStars, cohortVisits: { ...input.cohortVisits }
    };
    return {
      satisfaction, loyalty, returningPool, reviewStars,
      lifetimeVisits: previous.lifetimeVisits + sold,
      lifetimeRepeatVisits: previous.lifetimeRepeatVisits + returningVisits,
      lastWeek
    };
  }

  return Object.freeze({ cohortKeys, empty, distribute, initialCustomers,
    forecastCohorts, demandMultiplier, evaluateWeek });
})();
