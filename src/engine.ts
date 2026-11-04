// @ts-nocheck
// Roasthouse game catalog, deterministic weekly engine, reducer, migrations, and saves.
"use strict";

  /* ROASTHOUSE PHASE 5
     Engine (pure data/state transformations) -> reducer -> persistence -> DOM renderer.
     All currency is integer USD cents. Physical inventories use labeled units.
     Each tick is one 7-day period, dated by the Monday that starts it. */
  const SAVE_KEY = "roasthouse-phase7-v1";
  const PHASE6_SAVE_KEY = "roasthouse-phase6-v1";
  const PHASE5_SAVE_KEY = "roasthouse-phase5-v1";
  const PHASE4_SAVE_KEY = "roasthouse-phase4-v1";
  const PHASE3_SAVE_KEY = "roasthouse-phase3-v1";
  const PREVIOUS_SAVE_KEY = "roasthouse-phase2-v1";
  const LEGACY_SAVE_KEY = "roasthouse-phase1-v1";
  const SAVE_VERSION = 7;
  const WEEK_DURATION_MS = 5000;
  const WEEK_MS = 7 * 86400000;
  const MAX_HISTORY = 52;
  const SALARY_CENTS = 50000;
  const GRAMS_PER_LB = 453.59237;
  const ML_PER_GALLON = 3785.411784;
  const START_DATE = "2026-01-05";

  const PRODUCTS = Object.freeze({
    drip:     { name: "Drip Coffee", baseDemand: 450, referencePriceCents: 325, elasticity: 1.75, ideal: { beansGrams: 18, milkMl: 0, sugarGrams: 3 }, season: [1.16,1.13,1.07,1.02,.94,.82,.75,.77,.93,1.05,1.13,1.20] },
    latte:    { name: "Latte", baseDemand: 320, referencePriceCents: 525, elasticity: 1.45, ideal: { beansGrams: 20, milkMl: 180, sugarGrams: 6 }, season: [1.10,1.09,1.04,1.01,.97,.90,.86,.88,.99,1.05,1.10,1.14] },
    espresso: { name: "Espresso", baseDemand: 190, referencePriceCents: 375, elasticity: 1.25, ideal: { beansGrams: 19, milkMl: 0, sugarGrams: 0 }, season: [1.04,1.05,1.03,1.00,.98,.96,.94,.96,.99,1.03,1.05,1.07] },
    coldBrew: { name: "Cold Brew", baseDemand: 230, referencePriceCents: 475, elasticity: 1.45, ideal: { beansGrams: 24, milkMl: 35, sugarGrams: 5 }, season: [.60,.62,.74,.88,1.16,1.48,1.64,1.58,1.22,.92,.70,.59] },
    ...EmpireWorld.newProducts
  });
  const PRODUCT_IDS = Object.keys(PRODUCTS);
  const EQUIPMENT = Object.freeze([
    { name: "Basic Espresso Station", costCents: 0, capacity: 1400, quality: .96, description: "Reliable starter equipment with neighborhood-cafe throughput." },
    { name: "Professional Espresso Bar", costCents: 1200000, capacity: 2100, quality: 1.10, description: "Better extraction, repeatable flavor, and greater output." },
    { name: "Commercial Roasting Line", costCents: 2900000, capacity: 3300, quality: 1.24, description: "Premium coffee quality and industrial-scale output." }
  ]);
  const INGREDIENTS = Object.freeze({
    beansLbs: { name: "Coffee beans", unit: "lbs", packQuantity: 10, packCostCents: 14500, decimals: 1 },
    milkGal: { name: "Milk", unit: "gal", packQuantity: 10, packCostCents: 4800, decimals: 1 },
    sugarLbs: { name: "Sugar", unit: "lbs", packQuantity: 5, packCostCents: 1600, decimals: 1 },
    cups: { name: "Cups", unit: "cups", packQuantity: 500, packCostCents: 7500, decimals: 0 },
    pastries: { name:"Bakery case items",unit:"pieces",packQuantity:50,packCostCents:8200,decimals:0 }
  });
  const INGREDIENT_KEYS = Object.keys(INGREDIENTS);
  const DEFAULT_THRESHOLDS = Object.freeze({ beansLbs: 25, milkGal: 10, sugarLbs: 5, cups: 600, pastries:20 });
  const DEFAULT_TARGETS = Object.freeze({ beansLbs: 95, milkGal: 45, sugarLbs: 20, cups: 3000, pastries:200 });
  const STARTER_INVENTORY = Object.freeze({ beansLbs: 60, milkGal: 30, sugarLbs: 10, cups: 2000, pastries:0 });
  const STARTER_STOCK_COST = INGREDIENT_KEYS.reduce((sum, k) => sum +
    (STARTER_INVENTORY[k] / INGREDIENTS[k].packQuantity) * INGREDIENTS[k].packCostCents, 0);

  /* City demand multipliers and competitor activity are game-design parameters,
     not claims about real-world traffic, prices, or actual businesses. */
  const CITIES = Object.freeze({
    nyc: { name: "New York", state: "NY", tagline: "Fast-paced, competitive, premium ticket sizes", demand: 1.00, priceIndex: 1.00, competitionBase: 1.02, preferences: { drip: 1.00, latte: 1.00, espresso: 1.00, coldBrew: 1.02 }, rivals: ["Borough Brew", "Metro Roasters", "Daybreak Coffee"] },
    chi: { name: "Chicago", state: "IL", tagline: "Loyal neighborhoods and strong seasonal swings", demand: .94, priceIndex: .96, competitionBase: .94, preferences: { drip: 1.15, latte: .96, espresso: .92, coldBrew: .98 }, rivals: ["Lakefront Coffee", "Loop Espresso", "Windy City Roasters"] },
    sea: { name: "Seattle", state: "WA", tagline: "Coffee-savvy customers and quality expectations", demand: 1.08, priceIndex: 1.10, competitionBase: 1.18, preferences: { drip: 1.04, latte: 1.17, espresso: 1.18, coldBrew: 1.15 }, rivals: ["Cascade Craft", "North Pier Coffee", "Steam & Stone"] },
    aus: { name: "Austin", state: "TX", tagline: "Growing neighborhoods and a social cafe culture", demand: 1.03, priceIndex: .95, competitionBase: .88, preferences: { drip: .82, latte: 1.20, espresso: .98, coldBrew: 1.25 }, rivals: ["Lone Oak Coffee", "Southside Brew", "Capital Cup"] },
    sfo: { name: "San Francisco", state: "CA", tagline: "High-income customers and expensive real estate", demand: 1.06, priceIndex: 1.25, competitionBase: 1.20, preferences: { drip: .93, latte: 1.16, espresso: 1.15, coldBrew: 1.18 }, rivals: ["Fogline Coffee", "Mission Roast", "Golden Gate Espresso"] },
    lax: { name: "Los Angeles", state: "CA", tagline: "Trend-led districts with strong latte demand", demand: 1.10, priceIndex: 1.14, competitionBase: 1.08, preferences: { drip: .82, latte: 1.28, espresso: .97, coldBrew: 1.30 }, rivals: ["Sunbeam Roasters", "Studio Bean", "Canyon Coffee"] },
    ...EmpireWorld.internationalCities
  });
  const CITY_IDS = Object.keys(CITIES);
  const LISTINGS = Object.freeze([
    { id: "nyc-astoria", cityId: "nyc", district: "Astoria, Queens", type: "Neighborhood corner", rentCents: 78000, buildoutCents: 2600000, footfall: .97, staff: 3 },
    { id: "nyc-williamsburg", cityId: "nyc", district: "Williamsburg, Brooklyn", type: "Creative district", rentCents: 126000, buildoutCents: 3900000, footfall: 1.23, staff: 4 },
    { id: "chi-river", cityId: "chi", district: "River North", type: "Downtown storefront", rentCents: 89000, buildoutCents: 2100000, footfall: 1.13, staff: 3 },
    { id: "chi-logan", cityId: "chi", district: "Logan Square", type: "Neighborhood corner", rentCents: 58000, buildoutCents: 1600000, footfall: .98, staff: 3 },
    { id: "sea-capitol", cityId: "sea", district: "Capitol Hill", type: "Lifestyle district", rentCents: 99000, buildoutCents: 2400000, footfall: 1.18, staff: 3 },
    { id: "sea-slu", cityId: "sea", district: "South Lake Union", type: "Office district", rentCents: 128000, buildoutCents: 3100000, footfall: 1.25, staff: 4 },
    { id: "aus-congress", cityId: "aus", district: "South Congress", type: "Entertainment district", rentCents: 80000, buildoutCents: 1800000, footfall: 1.20, staff: 3 },
    { id: "aus-east", cityId: "aus", district: "East Austin", type: "Neighborhood corner", rentCents: 53000, buildoutCents: 1300000, footfall: 1.02, staff: 3 },
    { id: "sfo-mission", cityId: "sfo", district: "Mission District", type: "Urban high street", rentCents: 133000, buildoutCents: 3300000, footfall: 1.20, staff: 3 },
    { id: "sfo-soma", cityId: "sfo", district: "SoMa", type: "Financial district", rentCents: 172000, buildoutCents: 4400000, footfall: 1.32, staff: 4 },
    { id: "lax-silver", cityId: "lax", district: "Silver Lake", type: "Lifestyle district", rentCents: 100000, buildoutCents: 2300000, footfall: 1.14, staff: 3 },
    { id: "lax-arts", cityId: "lax", district: "Arts District", type: "Creative district", rentCents: 122000, buildoutCents: 2800000, footfall: 1.25, staff: 4 },
    ...EmpireWorld.internationalListings
  ]);
  const LISTING_BY_ID = Object.fromEntries(LISTINGS.map(item => [item.id, item]));

  // All financial values are integer cents. Strategy values are game balance constants.
  const HQ_TIERS = Object.freeze([
    { name: "Founder workspace", upgradeCents: 0, weeklyCents: 0, procurementDiscount: 0, brandBonus: 0, creditLimitCents: 3500000, description: "Keep overhead low with founder-led administration." },
    { name: "Regional headquarters", upgradeCents: 1500000, weeklyCents: 18000, procurementDiscount: .04, brandBonus: .025, creditLimitCents: 6500000, description: "Centralized procurement and stronger regional brand coordination." },
    { name: "Corporate operations center", upgradeCents: 4000000, weeklyCents: 55000, procurementDiscount: .08, brandBonus: .05, creditLimitCents: 12000000, description: "Professionalized leadership, supplier contracts and national marketing." },
    { name: "National flagship HQ", upgradeCents: 9500000, weeklyCents: 130000, procurementDiscount: .13, brandBonus: .085, creditLimitCents: 22000000, description: "An established corporate platform with exceptional bargaining power." }
  ]);
  const LOAN_AMOUNTS = Object.freeze([1000000, 2500000, 5000000, 10000000]);
  const LOAN_TERMS = Object.freeze({ 26: .11, 52: .145 });
  const EQUITY_OFFERS = Object.freeze([2500000, 6000000, 12000000]);
  const WAGE_PREMIUMS = Object.freeze([0, 5000, 10000, 15000]);
  const DIVIDEND_RATES = Object.freeze([0, .10, .25]);
  const MARKETING_CHANNELS = Object.freeze({
    social: { name: "Social & search", costCents: 150000, weeks: 4, lift: .10, awareness: 10, description: "Digital targeting boosts demand in one city." },
    neighborhood: { name: "Neighborhood launch", costCents: 300000, weeks: 6, lift: .16, awareness: 17, description: "Local partnerships drive customers into nearby cafes." },
    national: { name: "National brand push", costCents: 950000, weeks: 6, lift: .07, awareness: 8, description: "A national campaign reaches every city, including future ones." }
  });
  const STAFF_TRAINING_MAX = 3;
  const MANAGER_WEEKLY_CENTS = 85000;
  const MANAGER_RECRUITING_CENTS = 35000;
  const INVESTOR_NAMES = ["Northline Ventures", "Bean Capital Partners", "Atlas Growth Fund", "Harbor Street Equity", "Summit Consumer Ventures"];

  /* Phase 4: fictional, tunable model parameters. Maps are abstract strategy diagrams,
     NOT geospatial data. Costs and populations are invented for gameplay. */
  const SEGMENTS = Object.freeze({
    commuters: { name: "Commuters", description: "Quick service and consistent prices", priceSensitivity: 1.12, preferences: { drip: 1.20, latte: .89, espresso: 1.10, coldBrew: .88 } },
    students: { name: "Students", description: "Value-conscious and seasonal", priceSensitivity: 1.30, preferences: { drip: .96, latte: 1.11, espresso: .80, coldBrew: 1.24 } },
    enthusiasts: { name: "Coffee enthusiasts", description: "Flavor-first premium buyers", priceSensitivity: .70, preferences: { drip: .94, latte: 1.07, espresso: 1.28, coldBrew: 1.10 } },
    locals: { name: "Neighborhood locals", description: "Convenience and familiarity", priceSensitivity: .94, preferences: { drip: 1.14, latte: 1.04, espresso: .84, coldBrew: .97 } }
  });
  const SEGMENT_KEYS = Object.keys(SEGMENTS);
  const CITY_DEMOGRAPHICS = Object.freeze({
    nyc: { commuters:.40, students:.16, enthusiasts:.25, locals:.19 },
    chi: { commuters:.33, students:.23, enthusiasts:.17, locals:.27 },
    sea: { commuters:.24, students:.20, enthusiasts:.39, locals:.17 },
    aus: { commuters:.20, students:.36, enthusiasts:.21, locals:.23 },
    sfo: { commuters:.29, students:.16, enthusiasts:.41, locals:.14 },
    lax: { commuters:.23, students:.24, enthusiasts:.29, locals:.24 },
    ...EmpireWorld.demographicMix
  });
  const SUPPLIERS = Object.freeze({
    wholesale: { name:"Metro Wholesale", costFactor:1, quality:1, disruptionRisk:.06, description:"Balanced pricing and broad distribution." },
    cooperative: { name:"Direct Trade Cooperative", costFactor:1.14, quality:1.09, disruptionRisk:.027, description:"Higher-grade beans and steadier deliveries." },
    reserve: { name:"Single-Origin Reserve", costFactor:1.27, quality:1.16, disruptionRisk:.085, description:"Premium flavor; expensive and less predictable supply." }
  });
  const SUPPLIER_SWITCH_CENTS = 45000;
  const DELIVERY_INSURANCE_CENTS = 11000;
  const SPECIALTIES = Object.freeze({
    none: { name:"Generalist team", weeklyCents:0, trainCents:0, description:"No dedicated specialist or recurring premium." },
    service: { name:"Service lead", weeklyCents:15000, trainCents:65000, description:"Increases weekly barista throughput by 17%." },
    quality: { name:"Head barista", weeklyCents:18000, trainCents:80000, description:"Improves beverage quality and customer demand." },
    community: { name:"Community host", weeklyCents:14000, trainCents:60000, description:"Strengthens local customer engagement and sales." },
    logistics: { name:"Stock coordinator", weeklyCents:16000, trainCents:70000, description:"Lowers local ingredient procurement costs by 6%." }
  });
  const STORE_LAYOUTS = Object.freeze({
    balanced: { name:"Balanced cafe", remodelCents:0, throughput:1, dineInShare:.35, seatingScale:1, comfort:1, demandFactor:1,
      description:"Balanced counter and table service, moderate dwell times and steady throughput." },
    express: { name:"Express counter", remodelCents:220000, throughput:1.16, dineInShare:.16, seatingScale:.72, comfort:.86, demandFactor:1.05,
      description:"Faster orders and strong commuter appeal, but less comfortable for lingering customers." },
    lounge: { name:"Neighborhood lounge", remodelCents:350000, throughput:.86, dineInShare:.60, seatingScale:1.20, comfort:1.22, demandFactor:1.07,
      description:"Premium seating and better retention at the cost of service speed." }
  });
  const SEATING_TIERS = Object.freeze([
    { name:"Classic seating", seats:24, upgradeCents:0 },
    { name:"Expanded floorplan", seats:42, upgradeCents:950000 },
    { name:"Full-service seating", seats:70, upgradeCents:2100000 }
  ]);
  const CLEANING_POLICIES = Object.freeze({
    lean: { name:"Lean", weeklyCents:6000, quality:.82, description:"Lower costs, more noticeable wear and less favorable customer feedback." },
    standard: { name:"Standard", weeklyCents:14000, quality:1, description:"Reliable daily cleaning, stable customer satisfaction." },
    premium: { name:"Premium", weeklyCents:35000, quality:1.19, description:"Higher standards increase satisfaction but add weekly overhead." }
  });
  const LOYALTY_POLICIES = Object.freeze({
    none: { name:"No rewards", weeklyCents:0, retentionBonus:0, description:"No loyalty-program overhead." },
    stamps: { name:"Digital stamps", weeklyCents:14000, retentionBonus:.045, description:"Low-cost repeat-visit program." },
    rewards: { name:"Member rewards", weeklyCents:36000, retentionBonus:.09, description:"Strong retention incentives with greater weekly overhead." }
  });
  const defaultOperations = () => ({ layoutId:"balanced", seatingTier:0, cleanliness:"standard", loyalty:"none" });
  const storeWeeklyOverhead = cafe => CLEANING_POLICIES[cafe.operations.cleanliness].weeklyCents +
    LOYALTY_POLICIES[cafe.operations.loyalty].weeklyCents;
  const seatCapacity = cafe => {
    const layout=STORE_LAYOUTS[cafe.operations.layoutId];
    return Math.floor(SEATING_TIERS[cafe.operations.seatingTier].seats * layout.seatingScale * 46 / layout.dineInShare);
  };

  const RESEARCH = Object.freeze({
    extraction: { name:"Precision Extraction", costCents:650000, weeks:6, description:"Permanent +7% quality multiplier for every cafe." },
    coldBrew: { name:"Cold Brew Development", costCents:850000, weeks:7, description:"Unlock a fourth product: Cold Brew, strongest in summer." },
    forecasting: { name:"Customer Forecasting", costCents:750000, weeks:6, description:"Permanent +6% base demand and better demographic targeting." },
    procurement: { name:"Sourcing Analytics", costCents:700000, weeks:6, description:"Permanent 6% ingredient procurement discount." },
    loyalty: { name:"Digital Loyalty", costCents:1050000, weeks:9, description:"Permanent 8% brand demand multiplier." }
  });
  const MAP_COORDS = Object.freeze({
    flagship:[49,43], "nyc-astoria":[64,26], "nyc-williamsburg":[76,57],
    "chi-river":[48,38], "chi-logan":[31,65],
    "sea-capitol":[60,36], "sea-slu":[43,59],
    "aus-congress":[45,61], "aus-east":[68,41],
    "sfo-mission":[38,61], "sfo-soma":[62,34],
    "lax-silver":[45,35], "lax-arts":[68,62],
    ...Object.fromEntries(EmpireWorld.internationalListings.map((l,i)=>[l.id,i%2?[69,58]:[32,37]]))
  });
  const defaultResearch = () => ({ activeId:null, remainingWeeks:0, completed:[], pendingExpenseCents:0, totalInvestedCents:0 });
  const defaultSourcing = () => ({ supplierId:"wholesale", insured:false, pendingContractCents:0, lastSwitchWeek:-100, disruptionCount:0 });
  const defaultEstate = () => ({ lots:Object.fromEntries(LISTINGS.map(l => [l.id, {status:"available",auction:null,rivalId:null,closedWeek:null}])), totalBidWins:0, totalBidLosses:0 });
  const defaultDemographics = () => Object.fromEntries(CITY_IDS.map(id=>[id,{...CITY_DEMOGRAPHICS[id]}]));
  const specialtyBoost = cafe => cafe.team?.specialty === "quality" ? 1.075 : 1;
  const hasResearch = (state, id) => !!state.company.research?.completed?.includes(id);
  const listingState = (state,id) => state.estate.lots[id];
  const reserveBid = listing => Math.round(listing.buildoutCents * .76);
  const buyNowPrice = listing => Math.round(listing.buildoutCents * 1.22) + STARTER_STOCK_COST;
  function weightedDemographicFactor(mix, productId, priceCents, referencePriceCents) {
    if (!mix) return 1;
    const priceRatio = clamp(priceCents / Math.max(1,referencePriceCents),.3,4);
    return clamp(SEGMENT_KEYS.reduce((sum,key) => sum + mix[key] * (SEGMENTS[key].preferences[productId] || 1) *
      Math.pow(priceRatio, -(SEGMENTS[key].priceSensitivity-1)*.50), 0),.70,1.35);
  }
  function stepDemographics(state, random, week) {
    if (week % 13 !== 0) return;
    for (const cityId of CITY_IDS) {
      const mix = state.demographics[cityId];
      const drifting = SEGMENT_KEYS.map(key=>Math.max(.04,mix[key] + (random()-.5)*.026));
      const total=drifting.reduce((s,v)=>s+v,0);
      SEGMENT_KEYS.forEach((key,i)=>{mix[key]=drifting[i]/total;});
    }
  }
  function weeklyResearch(state, week) {
    const research = state.company.research;
    if (!research.activeId) return [];
    research.remainingWeeks--;
    if (research.remainingWeeks>0) return [];
    const id=research.activeId;
    research.completed.push(id);
    research.activeId=null;
    research.remainingWeeks=0;
    return [`R&D completed: ${RESEARCH[id].name}. New benefits now active.`];
  }
  function acquisitionPrice(rival) {
    return Math.round(rival.stores * 2100000 * rival.strength * clamp(rival.momentum,.8,1.3) + 600000);
  }
  function resolveAuctions(state, random, week) {
    const events=[];
    let refundedCents=0, awardedCents=0;
    for (const listing of LISTINGS) {
      const lot = listingState(state,listing.id), auction=lot.auction;
      if (lot.status!=="bidding" || !auction || week<auction.closeWeek) continue;
      const active=state.rivals[listing.cityId].filter(r=>r.stores>0);
      const bidder=active[Math.floor(random()*active.length)] || null;
      const rivalBid=bidder ? Math.round(listing.buildoutCents * (.76 + random()*.35) *
        (bidder.strategy==="aggressive"?1.10:bidder.strategy==="value"?.93:1)) : 0;
      if (auction.bidCents>=Math.max(reserveBid(listing),rivalBid)) {
        const id=`cafe-${state.nextCafeNumber++}`;
        const cafe=starterCafe(listing,id,week+1);
        state.cafes.push(cafe);
        state.company.portfolioInvestedCents+=auction.bidCents;
        state.company.lifetime.capitalExpenditureCents+=auction.bidCents;
        state.estate.totalBidWins++;
        lot.status="owned";lot.rivalId=null;
        awardedCents+=auction.bidCents;
        events.push(`Won the ${listing.district} auction for ${money(auction.bidCents)}; opening next week.`);
      } else {
        refundedCents+=auction.escrowCents;
        state.company.cashCents+=auction.escrowCents;
        lot.status="rival";lot.rivalId=bidder.id;
        bidder.stores++;
        bidder.warChestCents=Math.max(0,bidder.warChestCents-rivalBid);
        bidder.latestEvent=`Won ${listing.district} at auction`;
        state.estate.totalBidLosses++;
        events.push(`${bidder.name} outbid you for ${listing.district} (${money(rivalBid)}). Your ${money(auction.escrowCents)} escrow was returned.`);
      }
      lot.closedWeek=week;
      lot.auction=null;
    }
    return {events,refundedCents,awardedCents};
  }

  const defaultTeam = () => ({ morale: 76, trainingLevel: 0, wagePremiumCents: 0, managerHired: false, attritionCount: 0, specialty: "none" });
  const defaultRivals = () => Object.fromEntries(CITY_IDS.map(cityId => [cityId,
    CITIES[cityId].rivals.map((name, index) => ({ id: `${cityId}-rival-${index}`, name,
      stores: index === 0 ? 2 : 1, strength: [1.10, .97, 1.04][index], momentum: 1,
      strategy: ["aggressive", "premium", "value"][index], priceIndex: 1,
      warChestCents: 5500000 + index * 1500000, latestEvent: "Operating" }))]));
  const defaultBrand = () => ({ reputation: 58, awareness: Object.fromEntries(CITY_IDS.map((id,i) => [id, i === 0 ? 24 : 12])), campaigns: [], nextCampaignId: 1 });
  const defaultFinance = () => ({ loans: [], nextLoanId: 1, founderOwnership: 1, investors: [], nextInvestorId: 1,
    lastRaiseWeek: -100, dividendRate: 0, dividendsPaidCents: 0, externalCapitalRaisedCents: 0,
    principalRepaidCents: 0, interestPaidCents: 0, boardConfidence: 72 });
  const outstandingDebt = state => (state.company.finance?.loans || []).reduce((sum, loan) => sum + loan.balanceCents, 0);
  const procurementPackPrice = (state, key, cafe = null) => Math.max(1, Math.round(INGREDIENTS[key].packCostCents *
    (1 - HQ_TIERS[state.company.hqTier || 0].procurementDiscount) *
    (key === "beansLbs" ? (SUPPLIERS[state.company.sourcing?.supplierId || "wholesale"].costFactor) : 1) *
    (state.company.research?.completed?.includes("procurement") ? .94 : 1) *
    (cafe?.team?.specialty === "logistics" ? .94 : 1)));
  const totalWeeklyPayroll = cafe => cafe.staff * (SALARY_CENTS + (cafe.team?.wagePremiumCents || 0)) +
    (cafe.team?.managerHired ? MANAGER_WEEKLY_CENTS : 0) +
    (cafe.team?.specialty && cafe.team.specialty !== "none" ? SPECIALTIES[cafe.team.specialty].weeklyCents : 0);
  const teamCapacity = cafe => Math.max(1, Math.floor(cafe.staff * 345 *
    clamp(.79 + (cafe.team?.morale ?? 76) / 365, .75, 1.10) *
    (1 + .065 * (cafe.team?.trainingLevel || 0)) * (cafe.team?.managerHired ? 1.08 : 1) *
    (cafe.team?.specialty === "service" ? 1.17 : 1)));
  function loanCreditLimit(state) {
    return HQ_TIERS[state.company.hqTier].creditLimitCents + (state.cafes.length - 1) * 650000;
  }
  function estimatedEquityValuation(state) {
    const recent = state.company.history.slice(-8);
    const averageRevenue = recent.length ? Math.round(sumField(recent, "revenueCents") / recent.length) : 0;
    return Math.max(12000000, Math.round(10000000 + state.company.portfolioInvestedCents * .7 +
      averageRevenue * 14 + state.company.brand.reputation * 55000 + (state.cafes.length-1)*1800000));
  }
  function loanPayment(principalCents, termWeeks, apr) {
    const r = apr / 52;
    return Math.ceil(principalCents * r / (1 - Math.pow(1 + r, -termWeeks)));
  }
  function creditTerms(termWeeks) { return LOAN_TERMS[termWeeks]; }
  function marketingDemandFactor(state, cityId) {
    const brand = state.company.brand;
    const activeLift = brand.campaigns.reduce((sum, c) => sum +
      ((c.cityId === "all" || c.cityId === cityId) ? c.lift : 0), 0);
    return clamp((.86 + brand.reputation / 350) * (.93 + brand.awareness[cityId] / 500) *
      (1 + HQ_TIERS[state.company.hqTier].brandBonus) * (1 + Math.min(.45, activeLift)), .72, 1.85);
  }
  function localMarketShare(state, cityId) {
    const ours = state.cafes.filter(c => c.cityId === cityId);
    const ourPower = ours.reduce((s,c) => s + c.footfall * (.8 + (c.team?.trainingLevel || 0) * .06), 0) *
      marketingDemandFactor(state, cityId);
    const rivals = state.rivals[cityId].reduce((s,r) => s + r.stores * r.strength * r.momentum, 0);
    return ourPower / (ourPower + rivals + 2.5);
  }
  function relativeRivalPressure(state, cityId) {
    const local = state.rivals[cityId];
    const power = local.reduce((s,r) => s + r.stores * r.strength * r.momentum *
      (1 + (1 - (r.priceIndex || 1)) * .5), 0);
    const baseline = [1.10 * 2, .97, 1.04].reduce((s,v) => s + v, 0);
    return clamp(Math.pow(power / baseline, .45), .72, 1.52);
  }
  function evolveRivals(state, random, week) {
    const events=[];
    for (const cityId of CITY_IDS) {
      const ourStores=state.cafes.filter(c=>c.cityId===cityId).length;
      const awareness=state.company.brand.awareness[cityId];
      for (const rival of state.rivals[cityId]) {
        if (!rival.stores) continue;  // Acquired chains don't reappear.
        const aggression = rival.strategy==="aggressive" ? 1.22 : rival.strategy==="value" ? 1.05 : .87;
        const threat=clamp(ourStores*.018 + awareness*.0005,.005,.19);
        rival.momentum=clamp(.84*rival.momentum+.16 + (random()-.5)*.065 - threat*.028,.76,1.28);
        rival.warChestCents=Math.max(0,rival.warChestCents + Math.round(rival.stores*120000*rival.momentum));
        if (week%4===0) {
          const target=rival.strategy==="value" ? .84 : rival.strategy==="premium" ? 1.16 : .97;
          rival.priceIndex=clamp(.68*rival.priceIndex+.32*target+(random()-.5)*.075,.77,1.28);
          if (ourStores && random()<(threat*aggression)) {
            rival.momentum=clamp(rival.momentum+.035,.76,1.28);
            rival.latestEvent=`Competitive pricing response, week ${week}`;
            events.push(`${rival.name} adjusted prices to challenge your ${CITIES[cityId].name} cafes.`);
          }
        }
        if (week%13!==0) continue;
        const chance=random();
        if (chance<.29*aggression && rival.stores<9 && rival.warChestCents>1850000) {
          rival.stores++;
          rival.warChestCents-=1850000;
          rival.latestEvent=`New cafe launched in week ${week}`;
          events.push(`${rival.name} opened a new branch in ${CITIES[cityId].name}.`);
        } else if (chance>.95 && rival.stores>1) {
          rival.stores--;
          rival.latestEvent=`Underperforming cafe closed, week ${week}`;
          events.push(`${rival.name} closed a branch in ${CITIES[cityId].name}.`);
        }
      }
    }
    return events;
  }
  function settleLoans(finance) {
    let interestCents = 0, principalCents = 0;
    for (const loan of finance.loans) {
      if (loan.balanceCents <= 0) continue;
      const interest = Math.round(loan.balanceCents * loan.apr / 52);
      const due = loan.weeksRemaining <= 1 ? loan.balanceCents + interest :
        Math.min(loan.balanceCents + interest, loan.weeklyPaymentCents);
      const principal = due - interest;
      loan.balanceCents -= principal;
      loan.weeksRemaining = Math.max(0, loan.weeksRemaining - 1);
      interestCents += interest;
      principalCents += principal;
    }
    finance.interestPaidCents += interestCents;
    finance.principalRepaidCents += principalCents;
    return { interestCents, principalCents };
  }
  function updateStaffAndReputation(state, results) {
    const revenue = sumField(results, "revenueCents");
    let weightedQuality = 0, weightedMorale = 0, weightedFulfilled = 0, sold = 0;
    for (const cafe of state.cafes) {
      const result = cafe.lastWeek;
      const fulfilled = result.demand ? result.unitsSold / result.demand : 1;
      const moraleTarget = 76 + cafe.team.wagePremiumCents / 1000 * .30 +
        cafe.team.trainingLevel * 3.2 + (cafe.team.managerHired ? 5 : 0) -
        19 * (result.demand ? result.lostStock / result.demand : 0) -
        15 * (result.demand ? result.lostCapacity / result.demand : 0);
      cafe.team.morale = clamp(Math.round((.8 * cafe.team.morale + .2 * moraleTarget) * 10) / 10, 22, 100);
      const qualitySum = PRODUCT_IDS.reduce((s,id) => s + result.products[id].sold * result.products[id].quality, 0);
      weightedQuality += qualitySum;
      weightedFulfilled += result.unitsSold * fulfilled;
      weightedMorale += result.unitsSold * cafe.team.morale;
      sold += result.unitsSold;
      if (cafe.team.morale < 36 && state.time.week % 4 === 0 && cafe.staff > 1) {
        cafe.staff--;
        cafe.team.attritionCount++;
        state.notices.push(`${cafe.district}: one employee resigned due to poor morale.`);
      }
    }
    if (sold > 0) {
      const quality = weightedQuality / sold;
      const morale = weightedMorale / sold;
      const fulfillment = weightedFulfilled / sold;
      const target = clamp(9 + quality * 35 + morale * .27 + fulfillment * 28, 20, 97);
      state.company.brand.reputation = clamp(Math.round((.91 * state.company.brand.reputation + .09 * target) * 10) / 10, 5, 100);
    } else if (revenue === 0) {
      state.company.brand.reputation = clamp(state.company.brand.reputation - .2, 5, 100);
    }
    for (const cityId of CITY_IDS) {
      const active = state.company.brand.campaigns.filter(c => c.cityId === "all" || c.cityId === cityId);
      state.company.brand.awareness[cityId] = clamp(Math.round((state.company.brand.awareness[cityId] * .965 +
        active.reduce((s,c) => s + (c.cityId === "all" ? .45 : .7), 0)) * 10) / 10, 0, 100);
    }
    state.company.brand.campaigns = state.company.brand.campaigns.map(c => ({ ...c, remainingWeeks: c.remainingWeeks - 1 }))
      .filter(c => c.remainingWeeks > 0);
  }
  function updateInvestorBoard(state, aggregate) {
    if (!state.company.finance.investors.length || state.time.week % 13 !== 0) return;
    const last13 = state.company.history.slice(0, -1).slice(-12);
    const recentProfit = aggregate.netProfitCents + sumField(last13, "netProfitCents");
    const result = (recentProfit > 0 ? 4 : -6) + (state.company.brand.reputation >= 65 ? 2 : -2) +
      (state.company.finance.dividendRate > 0 ? 1 : 0);
    state.company.finance.boardConfidence = clamp(state.company.finance.boardConfidence + result, 0, 100);
    if (state.company.finance.boardConfidence < 35) state.notices.push("Investor board confidence is low. Improve profitability and customer satisfaction.");
  }


  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const copy = value => structuredClone(value);
  const cents = dollars => Math.round(dollars * 100);
  const money = amount => `${amount < 0 ? "−" : ""}$${(Math.abs(amount) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const compactMoney = amount => `${amount < 0 ? "−" : ""}$${(Math.abs(amount) / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  const whole = number => Number(number).toLocaleString("en-US", { maximumFractionDigits: 0 });
  const roundQty = number => Math.max(0, Math.round((number + Number.EPSILON) * 1e6) / 1e6);
  const qty = (number, decimals = 1) => Number(number).toLocaleString("en-US", { maximumFractionDigits: decimals });
  const toDate = iso => new Date(iso + "T00:00:00Z");
  const dateDisplay = iso => toDate(iso).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
  const monthName = month => new Date(Date.UTC(2026, month - 1, 1)).toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });
  const addWeek = iso => new Date(toDate(iso).getTime() + WEEK_MS).toISOString().slice(0, 10);
  const parts = iso => ({ month: toDate(iso).getUTCMonth() + 1, year: toDate(iso).getUTCFullYear() });
  const percentage = value => `${(value * 100).toFixed(1)}%`;
  const escaped = input => String(input).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const ZERO = () => ({ revenueCents: 0, operatingExpenseCents: 0, netProfitCents: 0, unitsSold: 0, lostStock: 0, lostCapacity: 0, weeks: 0, capitalExpenditureCents: 0 });

  function randomStep(seed) {
    const next = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return { seed: next, value: next / 4294967296 };
  }
  const defaultMenu = () => Object.fromEntries(PRODUCT_IDS.map(id => [id, {
    priceCents: PRODUCTS[id].referencePriceCents, demandWeight: 1,
    recipe: { ...PRODUCTS[id].ideal, cups: PRODUCTS[id].ideal.cups ?? 1 }
  }]));
  const defaultSupply = () => ({ autoRestock: true, thresholds: { ...DEFAULT_THRESHOLDS }, targets: { ...DEFAULT_TARGETS } });
  const starterCafe = (listing, id, openedWeek) => ({
    id, listingId: listing.id, cityId: listing.cityId, district: listing.district, type: listing.type,
    rentCents: listing.rentCents, footfall: listing.footfall, staff: listing.staff, team: defaultTeam(), operations:defaultOperations(), customers:CustomerEconomy.initialCustomers(),
    equipmentTier: 0, openedWeek, menu: defaultMenu(), inventory: { ...STARTER_INVENTORY },
    supply: defaultSupply(), pendingManualExpenseCents: STARTER_STOCK_COST, pendingStaffExpenseCents: 0,
    lifetime: ZERO(), lastWeek: null
  });
  function initialState() {
    const market = Object.fromEntries(CITY_IDS.map(id => [id, { level: 1, competitorPressure: CITIES[id].competitionBase, lastChange: 0 }]));
    return {
      version: SAVE_VERSION, seed: 1092026,
      time: { week: 1, isoDate: START_DATE, month: 1, year: 2026 },
      company: {
        name: "Northstar Coffee Co.", cashCents: 5800000, lifetime: ZERO(), history: [], lastWeek: null,
        phase7:newPhase7State(),
        empire:EmpireWorld.initial(),
        portfolioInvestedCents: 0, hqTier: 0, pendingMarketingCents: 0, pendingAuctionFeesCents:0,
        brand: defaultBrand(), finance: defaultFinance(), research:defaultResearch(), sourcing:defaultSourcing()
      },
      cafes: [{
        id: "cafe-1", listingId: "flagship", cityId: "nyc", district: "Manhattan · Flatiron",
        type: "Flagship location", rentCents: 120000, footfall: 1, staff: 3, team: defaultTeam(), operations:defaultOperations(), customers:CustomerEconomy.initialCustomers(), pendingStaffExpenseCents: 0, equipmentTier: 0,
        openedWeek: 1, menu: defaultMenu(),
        inventory: { beansLbs: 85, milkGal: 35, sugarLbs: 18, cups: 2600, pastries:0 },
        supply: defaultSupply(), pendingManualExpenseCents: 0, lifetime: ZERO(), lastWeek: null
      }],
      selectedCafeId: "cafe-1", nextCafeNumber: 2, market, notices: [], rivals: defaultRivals(), news: [],
      estate:defaultEstate(), demographics:defaultDemographics()
    };
  }
  function migratePhase1(legacy) {
    if (legacy?.version !== 1 || !legacy?.cafe?.menu || !legacy?.company?.lifetime || !legacy?.inventory || !legacy?.time?.isoDate) return null;
    if (!Number.isFinite(legacy.company.cashCents) || !Number.isInteger(legacy.time.week) || legacy.time.week < 1) return null;
    const s = initialState();
    s.seed = (legacy.seed >>> 0) || s.seed;
    s.time = copy(legacy.time);
    s.company.cashCents = legacy.company.cashCents;
    s.company.lifetime = { ...ZERO(), ...copy(legacy.company.lifetime) };
    s.company.history = copy(legacy.company.history || []).slice(-MAX_HISTORY);
    s.company.lastWeek = legacy.company.lastWeek ? { ...copy(legacy.company.lastWeek), cafeResults: { "cafe-1": copy(legacy.company.lastWeek) } } : null;
    s.cafes[0] = {
      ...s.cafes[0], district: legacy.cafe.district || s.cafes[0].district,
      rentCents: legacy.cafe.rentCents, staff: legacy.cafe.staff,
      equipmentTier: legacy.cafe.equipmentTier, menu: copy(legacy.cafe.menu),
      inventory: copy(legacy.inventory), supply: copy(legacy.supply),
      pendingManualExpenseCents: legacy.company.pendingManualExpenseCents || 0,
      lastWeek: legacy.company.lastWeek ? copy(legacy.company.lastWeek) : null,
      lifetime: { ...ZERO(), ...copy(legacy.company.lifetime) }
    };
    s.market.nyc = { level: legacy.market?.level || 1, competitorPressure: CITIES.nyc.competitionBase, lastChange: legacy.market?.lastChange || 0 };
    s.notices = ["Your Phase 1 flagship and financial records were imported successfully."];
    return s;
  }

  function migratePhase2(legacy) {
    if (legacy?.version !== 2 || !Array.isArray(legacy.cafes) || !legacy.company || !legacy.market ||
      !Number.isInteger(legacy.time?.week) || !Number.isFinite(legacy.company.cashCents)) return null;
    if (!legacy.cafes.length || !legacy.cafes.every(c => CITIES[c.cityId] && c.menu && c.inventory && c.supply)) return null;
    const s = copy(legacy);
    s.version = SAVE_VERSION;
    s.company.hqTier = 0;
    s.company.pendingMarketingCents = 0;
    s.company.brand = defaultBrand();
    s.company.finance = defaultFinance();
    s.rivals = defaultRivals();
    s.news = [];
    for (const cafe of s.cafes) {
      cafe.team = defaultTeam();
      cafe.pendingStaffExpenseCents = 0;
    }
    s.notices = ["Your Phase 2 company, locations, inventories, and financial history were upgraded to Phase 3."];
    return s;
  }


  function migratePhase3(legacy) {
    if (legacy?.version!==3 || !Array.isArray(legacy.cafes) || !legacy.cafes.length ||
      !Number.isInteger(legacy.time?.week) || !Number.isFinite(legacy.company?.cashCents)) return null;
    return upgradePhase4(copy(legacy));
  }
  function upgradePhase4(state) {
    state.version=SAVE_VERSION;
    state.company.pendingAuctionFeesCents ||= 0;
    state.company.research ||= defaultResearch();
    state.company.sourcing ||= defaultSourcing();
    state.demographics ||= defaultDemographics();
    state.estate ||= defaultEstate();
    state.rivals ||= defaultRivals();
    for (const cityId of CITY_IDS) {
      state.demographics[cityId] ||= {...CITY_DEMOGRAPHICS[cityId]};
      state.rivals[cityId] ||= defaultRivals()[cityId];
      for (const [index,rival] of state.rivals[cityId].entries()) {
        rival.strategy ||= ["aggressive","premium","value"][index % 3];
        rival.priceIndex ||= 1;
        rival.warChestCents ??= 5000000;
      }
    }
    for (const cafe of state.cafes) {
      cafe.team ||= defaultTeam();
      cafe.team.specialty ||= "none";
      cafe.menu.coldBrew ||= {priceCents:PRODUCTS.coldBrew.referencePriceCents,demandWeight:1,recipe:{...PRODUCTS.coldBrew.ideal,cups:1}};
    }
    for (const cafe of state.cafes) {
      if (LISTING_BY_ID[cafe.listingId]) state.estate.lots[cafe.listingId].status="owned";
    }
    return state;
  }

  function migratePhase4(legacy) {
    if (legacy?.version!==4 || !Array.isArray(legacy.cafes) || !legacy.cafes.length ||
      !Number.isInteger(legacy.time?.week) || !Number.isFinite(legacy.company?.cashCents)) return null;
    return upgradePhase5(copy(legacy));
  }
  function upgradePhase5(state) {
    state.version=SAVE_VERSION;
    for (const cafe of state.cafes) {
      cafe.operations ||= defaultOperations();
      cafe.operations.layoutId ||= "balanced";
      cafe.operations.seatingTier ??= 0;
      cafe.operations.cleanliness ||= "standard";
      cafe.operations.loyalty ||= "none";
      cafe.customers ||= CustomerEconomy.initialCustomers();
      cafe.customers.lifetimeVisits ??= 0;
      cafe.customers.lifetimeRepeatVisits ??= 0;
      cafe.customers.returningPool ??= 120;
      cafe.customers.lastWeek ??= null;
    }
    state.company.lifetime.facilityCents ??= 0;
    return state;
  }

  // Non-destructive Phase 5 -> Phase 6 migration; add new markets, menus and global ledgers.
  function upgradePhase6(state) {
    state.version=SAVE_VERSION;
    state.company.empire ||= EmpireWorld.initial();
    const defaults=EmpireWorld.initial();
    for(const [key,val] of Object.entries(defaults))
      if(state.company.empire[key]===undefined)state.company.empire[key]=copy(val);
    state.company.empire.capital ||= EmpireWorld.initialCapital();
    state.estate ||= defaultEstate(); state.demographics ||= {};
    state.market ||= {}; state.rivals ||= {}; state.company.brand ||= defaultBrand();
    state.company.brand.awareness ||= {};
    for(const cityId of CITY_IDS){
      state.estate.lots ||= {};
      state.demographics[cityId] ||= {...CITY_DEMOGRAPHICS[cityId]};
      state.market[cityId] ||= {level:1,competitorPressure:CITIES[cityId].competitionBase,lastChange:0};
      state.rivals[cityId] ||= defaultRivals()[cityId];
      state.company.brand.awareness[cityId] ??= 12;
    }
    for(const l of LISTINGS)state.estate.lots[l.id] ||= {status:'available',auction:null,rivalId:null,closedWeek:null};
    for(const cafe of state.cafes){
      cafe.menu ||= defaultMenu();cafe.inventory ||= {...STARTER_INVENTORY};
      cafe.supply ||= defaultSupply();
      cafe.supply.thresholds ||= {...DEFAULT_THRESHOLDS};
      cafe.supply.targets ||= {...DEFAULT_TARGETS};
      for(const id of PRODUCT_IDS)cafe.menu[id] ||= {
        priceCents:PRODUCTS[id].referencePriceCents,demandWeight:1,
        recipe:{...PRODUCTS[id].ideal,cups:PRODUCTS[id].ideal.cups??1}};
      for(const key of INGREDIENT_KEYS){
        cafe.inventory[key] ??= 0;
        cafe.supply.thresholds[key] ??= DEFAULT_THRESHOLDS[key];
        cafe.supply.targets[key] ??= DEFAULT_TARGETS[key];
      }
      cafe.team ||= defaultTeam();cafe.operations ||= defaultOperations();
      cafe.customers ||= CustomerEconomy.initialCustomers();
    }
    return state;
  }
  function migratePhase5(legacy){
    if(legacy?.version!==5||!Array.isArray(legacy.cafes)||!legacy.cafes.length||
      !Number.isSafeInteger(legacy.company?.cashCents))return null;
    return upgradePhase6(copy(legacy));
  }

  function recipeRequirements(recipe) {
    return {
      beansLbs: recipe.beansGrams / GRAMS_PER_LB,
      milkGal: recipe.milkMl / ML_PER_GALLON,
      sugarLbs: recipe.sugarGrams / GRAMS_PER_LB,
      cups:recipe.cups ?? 1,
      pastries:recipe.pastryUnits || 0
    };
  }
  function recipeQuality(recipe, ideal, equipmentQuality) {
    const bd = ideal.beansGrams===0 ? Math.min(2,(recipe.beansGrams||0)/20) : Math.abs(recipe.beansGrams - ideal.beansGrams) / ideal.beansGrams;
    const md = ideal.milkMl === 0 ? recipe.milkMl / 180 : Math.abs(recipe.milkMl - ideal.milkMl) / ideal.milkMl;
    const sd = ideal.sugarGrams === 0 ? recipe.sugarGrams / 8 : Math.abs(recipe.sugarGrams - ideal.sugarGrams) / ideal.sugarGrams;
    return clamp(clamp(1 - .34 * bd - .17 * md - .05 * sd, .55, 1) * equipmentQuality, .5, 1.3);
  }
  /* Demand = round(base × city traffic × district footfall × local product preference
       × seasonality × city trend × recipe/equipment quality × price elasticity
       × local competitive pressure × own-store overlap × bounded weekly noise)
     A local nominal price reference is adjusted by cost-of-living and quality.
     Overlap simulates partial cannibalization when several company stores share a city. */
  function demandForProduct(id, menuItem, equipment, city, market, footfall, sameCityCafeCount, month, noise) {
    const item = PRODUCTS[id];
    const quality = recipeQuality(menuItem.recipe, item.ideal, equipment.quality);
    const referencePriceCents = item.referencePriceCents * city.priceIndex * (.72 + .28 * quality);
    const priceFactor = clamp(Math.pow(referencePriceCents / menuItem.priceCents, item.elasticity), .25, 2.5);
    const tasteFactor = .76 + .24 * quality;
    const competitorFactor = clamp(1.05 - .5 * (market.competitorPressure - .90), .70, 1.18);
    const overlapFactor = 1 / (1 + .18 * (sameCityCafeCount - 1));
    const demographicFactor = weightedDemographicFactor(market.demographics, id, menuItem.priceCents, referencePriceCents);
    const units = Math.max(0, Math.round(item.baseDemand * city.demand * footfall * (city.preferences[id] || 1)
      * menuItem.demandWeight * item.season[month - 1] * market.level * tasteFactor
      * priceFactor * competitorFactor * overlapFactor * demographicFactor * (market.brandFactor || 1)
      * (market.researchDemand || 1) * (market.communityBoost || 1) *
      (market.customerMultiplier || 1) * (market.storeComfortMultiplier || 1) *
      (market.globalDemandFactor || 1) * noise));
    return { units, quality, priceFactor, seasonFactor: item.season[month - 1],
      competitorFactor, overlapFactor, demographicFactor, referencePriceCents };
  }
  function allocateCapacity(demand, capacity) {
    const total = PRODUCT_IDS.reduce((sum, id) => sum + demand[id], 0);
    const result = Object.fromEntries(PRODUCT_IDS.map(id => [id, 0]));
    if (total <= capacity) return { ...demand };
    if (total === 0) return result;
    const remainders = PRODUCT_IDS.map(id => {
      const exact = demand[id] * capacity / total;
      result[id] = Math.floor(exact);
      return { id, remainder: exact - result[id] };
    }).sort((a, b) => b.remainder - a.remainder);
    let remaining = capacity - PRODUCT_IDS.reduce((sum, id) => sum + result[id], 0);
    for (const item of remainders) if (remaining > 0) { result[item.id] += 1; remaining -= 1; }
    return result;
  }
  function maxFeasibleUnits(inventory, requirement, requested) {
    let feasible = requested;
    for (const key of INGREDIENT_KEYS) if (requirement[key] > 0) {
      feasible = Math.min(feasible, Math.floor((inventory[key] + 1e-8) / requirement[key]));
    }
    return Math.max(0, feasible);
  }
  const sumField = (rows, field) => rows.reduce((sum, row) => sum + row[field], 0);
  const unitCost = recipe => {
    const requirement = recipeRequirements(recipe);
    return INGREDIENT_KEYS.reduce((sum, key) => sum +
      requirement[key] / INGREDIENTS[key].packQuantity * INGREDIENTS[key].packCostCents, 0);
  };
  function simulateCafeSales(cafe, city, market, sameCityCount, time, nextNoise) {
    const layout=STORE_LAYOUTS[cafe.operations.layoutId];
    const capacity = Math.max(1, Math.min(Math.floor(teamCapacity(cafe)*layout.throughput),
      Math.floor(EQUIPMENT[cafe.equipmentTier].capacity * (market.advancedForecasting ? 1.05 : 1)),
      seatCapacity(cafe)));
    const optimizedEquipment = {...EQUIPMENT[cafe.equipmentTier],
      quality:EQUIPMENT[cafe.equipmentTier].quality * (market.sourceQuality || 1) *
        (market.extractionBonus || 1) * specialtyBoost(cafe)};
    const requested = {}, forecasts = {};
    for (const id of PRODUCT_IDS) {
      forecasts[id] = ((id==="coldBrew" && !market.coldBrewUnlocked) ||
        (id!=="coldBrew" && !["drip","latte","espresso"].includes(id) && !(market.unlockedProducts||[]).includes(id)))
        ? {units:0,quality:0,priceFactor:0,seasonFactor:0,competitorFactor:1}
        : demandForProduct(id, cafe.menu[id], optimizedEquipment, city,
          {...market,communityBoost:cafe.team?.specialty==="community" ? 1.10 : 1,
            customerMultiplier:CustomerEconomy.demandMultiplier(cafe.customers),
            storeComfortMultiplier:layout.demandFactor},
          cafe.footfall, sameCityCount, time.month, nextNoise());
      requested[id] = forecasts[id].units;
    }
    const allocation = allocateCapacity(requested, capacity);
    const salePriority = [...PRODUCT_IDS].sort((a, b) =>
      (cafe.menu[b].priceCents - unitCost(cafe.menu[b].recipe)) -
      (cafe.menu[a].priceCents - unitCost(cafe.menu[a].recipe)));
    const products = {};
    let revenueCents = 0, unitsSold = 0, lostStock = 0, lostCapacity = 0;
    for (const id of salePriority) {
      const needs = recipeRequirements(cafe.menu[id].recipe);
      const sold = maxFeasibleUnits(cafe.inventory, needs, allocation[id]);
      for (const key of INGREDIENT_KEYS) cafe.inventory[key] = roundQty(cafe.inventory[key] - sold * needs[key]);
      const productRevenue = sold * cafe.menu[id].priceCents;
      const stockLoss = allocation[id] - sold, capacityLoss = requested[id] - allocation[id];
      const ratio = cafe.menu[id].priceCents / Math.max(1,forecasts[id].referencePriceCents || PRODUCTS[id].referencePriceCents);
      const cohortDemand=CustomerEconomy.forecastCohorts(requested[id],market.demographics,id,ratio,SEGMENTS);
      const cohortSold=CustomerEconomy.forecastCohorts(sold,market.demographics,id,ratio,SEGMENTS);
      products[id] = { demand: requested[id], allocated: allocation[id], sold, cohortDemand, cohortSold,
        estimatedCogsCents:Math.round(sold*unitCost(cafe.menu[id].recipe)),
        lostStock: stockLoss, lostCapacity: capacityLoss, revenueCents: productRevenue,
        quality: forecasts[id].quality, priceFactor: forecasts[id].priceFactor,
        seasonFactor: forecasts[id].seasonFactor, competitorFactor: forecasts[id].competitorFactor };
      revenueCents += productRevenue;
      unitsSold += sold;
      lostStock += stockLoss;
      lostCapacity += capacityLoss;
    }
    const cohortVisits=Object.fromEntries(SEGMENT_KEYS.map(key=>
      [key,PRODUCT_IDS.reduce((total,id)=>total+(products[id].cohortSold[key]||0),0)]));
    return { products, revenueCents, unitsSold, lostStock, lostCapacity, capacity, cohortVisits,
      facilityCents:storeWeeklyOverhead(cafe),
      demand: sumField(Object.values(products), "demand"), rentCents: cafe.rentCents,
      salaryCents: totalWeeklyPayroll(cafe), staffDevelopmentCents: cafe.pendingStaffExpenseCents || 0,
      manualStockCents: cafe.pendingManualExpenseCents,
      autoStockCents: 0, autoPurchasedPacks: {}, unfilledRestock: [],
      marketLevel: market.level, competitorPressure: market.competitorPressure };
  }
  function processWeek(previous) {
    const state = copy(previous);
    let seed = state.seed;
    const nextRandom = () => { const result = randomStep(seed); seed = result.seed; return result.value; };
    const closingWeek = state.time.week, closingDate = state.time.isoDate;
    EmpireWorld.startWeek(state,nextRandom,closingWeek);
    stepDemographics(state,nextRandom,closingWeek);
    const rivalEvents = evolveRivals(state, nextRandom, closingWeek);
    const supplier = SUPPLIERS[state.company.sourcing.supplierId];
    const disruptionChance=supplier.disruptionRisk * (hasResearch(state,"procurement")?.75:1) *
      (state.company.sourcing.insured?.18:1) * (1-.08*(state.company.phase7?.sustainabilityTier||0));
    const disrupted=nextRandom()<disruptionChance;
    if(disrupted) state.company.sourcing.disruptionCount++;
    const cityCounts = Object.fromEntries(CITY_IDS.map(id => [id,
      state.cafes.filter(c => c.cityId === id).length +
      .16*state.company.empire.franchises.filter(f=>f.cityId===id && f.status==="active").length]));
    for (const id of CITY_IDS) {
      const data = CITIES[id], prev = state.market[id];
      const nextLevel = clamp(.86 * prev.level + .14 + (nextRandom() - .5) * .095, .76, 1.30);
      const nextPressure = clamp(.80 * prev.competitorPressure + .20 * data.competitionBase * relativeRivalPressure(state, id)
        + (nextRandom() - .5) * .105, .60, 1.80);
      state.market[id] = { level: nextLevel, competitorPressure: nextPressure,
        brandFactor: marketingDemandFactor(state, id) * (hasResearch(state,"loyalty") ? 1.08 : 1) *
          (state.company.empire.executives.cmo ? 1.08 : 1),
        globalDemandFactor:state.company.empire.event ? EmpireWorld.events[state.company.empire.event.id].factor : 1,
        fxMultiplier:EmpireWorld.fxMultiplier(state.company.empire,CITIES[id].currency || "USD"),
        unlockedProducts:state.company.empire.portfolio.unlocked,
        demographics:state.demographics[id], cityId:id,
        extractionBonus:hasResearch(state,"extraction")?1.07:1,
        sourceQuality:supplier.quality, coldBrewUnlocked:hasResearch(state,"coldBrew"),
        advancedForecasting:hasResearch(state,"forecasting"), researchDemand:hasResearch(state,"forecasting")?1.06:1,
        lastChange: nextLevel - prev.level };
    }
    const cafeResults = {};
    for (const cafe of state.cafes) {
      cafeResults[cafe.id] = simulateCafeSales(cafe, CITIES[cafe.cityId], state.market[cafe.cityId],
        cityCounts[cafe.cityId], state.time, () => .96 + nextRandom() * .08);
    }
    // Local sticker-price economics translated into reporting USD at current modeled FX.
    for(const cafe of state.cafes){
      const result=cafeResults[cafe.id];
      const multiplier=state.market[cafe.cityId].fxMultiplier;
      if(multiplier===1)continue;
      for(const row of Object.values(result.products))row.revenueCents=Math.round(row.revenueCents*multiplier);
      result.revenueCents=Object.values(result.products).reduce((s,row)=>s+row.revenueCents,0);
      for(const key of ['rentCents','salaryCents','facilityCents'])result[key]=Math.round(result[key]*multiplier);
    }
    const resultList = Object.values(cafeResults);
    const cafeRevenueCents = sumField(resultList, "revenueCents");
    const rentCents = sumField(resultList, "rentCents");
    const salaryCents = sumField(resultList, "salaryCents");
    const facilityCents = sumField(resultList, "facilityCents");
    const manualStockCents = sumField(resultList, "manualStockCents");
    // Collect all weekly sales, then pay ALL locations' fixed costs before
    // shared-cash restocking. Manual orders were paid earlier; avoid double-debit.
    state.company.cashCents += cafeRevenueCents - rentCents - salaryCents - facilityCents;
    const hqExpenseCents = Math.round(HQ_TIERS[state.company.hqTier].weeklyCents*
      (state.company.empire.executives.cfo?.90:1));
    const debtService = settleLoans(state.company.finance);
    // Interest is a financing expense; principal is a balance-sheet cash flow.
    // Both are paid before discretionary restock orders.
    const supplierWeeklyFeeCents=state.company.sourcing.insured ? DELIVERY_INSURANCE_CENTS : 0;
    const supplierExpenseCents=supplierWeeklyFeeCents + state.company.sourcing.pendingContractCents;
    const researchExpenseCents=state.company.research.pendingExpenseCents;
    const auctionFeeExpenseCents=state.company.pendingAuctionFeesCents;
    state.company.cashCents -= hqExpenseCents + debtService.interestCents + debtService.principalCents + supplierWeeklyFeeCents;

    const empireWeek=EmpireWorld.settleEmpire(state,nextRandom,closingWeek);
    const contractRevenueCents=phase7CloseContracts(state,sumField(resultList,"unitsSold"),closingWeek);
    state.company.cashCents+=contractRevenueCents;
    const revenueCents=cafeRevenueCents+empireWeek.royaltyCents+contractRevenueCents;
    // Weighted-fair procurement: one pack per (location, ingredient) per pass.
    // All orders draw from the shared company treasury; deficit prevents purchases.
    // Targets are checked once the stock is below threshold at this weekly close.
    const pending = [];
    for (const cafe of state.cafes) {
      if (!cafe.supply.autoRestock ||
        state.company.empire.warehouses[EmpireWorld.regionForCity(cafe.cityId)]?.opened) continue;
      for (const key of INGREDIENT_KEYS) {
        if(key==="pastries" && !["croissant","muffin"].some(id=>state.company.empire.portfolio.unlocked.includes(id)))continue;
        const definition = INGREDIENTS[key];
        if (cafe.inventory[key] >= cafe.supply.thresholds[key]) continue;
        const target = cafe.supply.targets[key];
        const packs = Math.max(0, Math.ceil((target - cafe.inventory[key] - 1e-8) / definition.packQuantity));
        if (packs > 0) pending.push({ cafe, key, remaining: packs });
      }
    }
    // At most 12 * 4 * 1000 iterations at legal policy limits; priority rotates
    // across locations so a large first store cannot consume the entire budget.
    let buying = true;
    while (buying) {
      buying = false;
      for (const order of pending) {
        if (order.remaining <= 0) continue;
        if(disrupted && order.key==="beansLbs") continue;
        const definition = INGREDIENTS[order.key];
        const purchaseCents = procurementPackPrice(state, order.key, order.cafe);
        if (state.company.cashCents < purchaseCents) continue;
        state.company.cashCents -= purchaseCents;
        order.cafe.inventory[order.key] = roundQty(order.cafe.inventory[order.key] + definition.packQuantity);
        const local = cafeResults[order.cafe.id];
        local.autoStockCents += purchaseCents;
        local.autoPurchasedPacks[order.key] = (local.autoPurchasedPacks[order.key] || 0) + 1;
        order.remaining--;
        buying = true;
      }
    }
    const shipmentsWeek=EmpireWorld.queueShipments(state,closingWeek,INGREDIENT_KEYS);
    for (const order of pending) if (order.remaining > 0) {
      cafeResults[order.cafe.id].unfilledRestock.push(INGREDIENTS[order.key].name);
    }

    state.notices = [...rivalEvents];
    if(disrupted) state.notices.push(`Bean deliveries delayed by ${supplier.name}; inventory must cover this week.`);
    state.news = [...rivalEvents.map(description => ({ week: closingWeek, description })), ...(state.news || [])].slice(0, 18);
    for (const cafe of state.cafes) {
      const result = cafeResults[cafe.id];
      result.procurementCents = result.manualStockCents + result.autoStockCents;
      result.operatingExpenseCents = result.rentCents + result.salaryCents + result.facilityCents + result.procurementCents + result.staffDevelopmentCents;
      const avgQuality=result.unitsSold ? PRODUCT_IDS.reduce((total,id)=>total+result.products[id].sold*result.products[id].quality,0)/result.unitsSold : 0.85;
      cafe.customers=CustomerEconomy.evaluateWeek(cafe.customers,{
        demand:result.demand,sold:result.unitsSold,lostStock:result.lostStock,lostCapacity:result.lostCapacity,
        capacity:result.capacity,averageQuality:avgQuality,
        cleanlinessQuality:CLEANING_POLICIES[cafe.operations.cleanliness].quality,
        comfort:STORE_LAYOUTS[cafe.operations.layoutId].comfort,
        retentionBonus:LOYALTY_POLICIES[cafe.operations.loyalty].retentionBonus,
        cohortVisits:result.cohortVisits
      });
      result.customerMetrics=cafe.customers.lastWeek;
      result.netProfitCents = result.revenueCents - result.operatingExpenseCents;
      Object.assign(result, { week: closingWeek, date: closingDate, month: state.time.month,
        year: state.time.year, cafeId: cafe.id });
      cafe.lastWeek = result;
      cafe.pendingManualExpenseCents = 0;
      cafe.pendingStaffExpenseCents = 0;
      for (const key of ["revenueCents", "operatingExpenseCents", "netProfitCents", "unitsSold", "lostStock", "lostCapacity"])
        cafe.lifetime[key] += result[key];
      cafe.lifetime.weeks++;
      if (result.lostStock > 0) state.notices.push(`${cafe.district}: ${whole(result.lostStock)} orders lost to stockouts.`);
      if (result.lostCapacity > 0) state.notices.push(`${cafe.district}: ${whole(result.lostCapacity)} orders lost to capacity.`);
      if (result.unfilledRestock.length) state.notices.push(`${cafe.district}: ${disrupted && result.unfilledRestock.includes("Coffee beans") ? "supplier delay or inadequate cash prevented" : "insufficient cash prevented"} restocking ${result.unfilledRestock.join(", ")}.`);
    }
    const aggregate = {
      week: closingWeek, date: closingDate, month: state.time.month, year: state.time.year,
      revenueCents, rentCents, salaryCents, manualStockCents,
      autoStockCents: sumField(resultList, "autoStockCents"),
      facilityCents, unitsSold: sumField(resultList, "unitsSold"), lostStock: sumField(resultList, "lostStock"),
      lostCapacity: sumField(resultList, "lostCapacity"),
      demand: sumField(resultList, "demand"), capacity: sumField(resultList, "capacity"), cafeResults,
      staffDevelopmentCents: sumField(resultList, "staffDevelopmentCents"),
      marketingExpenseCents: state.company.pendingMarketingCents, hqExpenseCents,
      ...empireWeek, shippingCents:shipmentsWeek.shippingCents, shipmentsScheduled:shipmentsWeek.scheduled,
      financeExpenseCents: debtService.interestCents, principalPaidCents: debtService.principalCents,
      supplierExpenseCents, researchExpenseCents, auctionFeeExpenseCents, deliveryDisrupted:disrupted
    };
    aggregate.contractRevenueCents=contractRevenueCents;
    aggregate.strategyExpenseCents=state.company.phase7.pendingExpenseCents;
    aggregate.sustainabilityCents=PHASE7_SUSTAINABILITY[state.company.phase7.sustainabilityTier].weeklyCents;
    state.company.cashCents-=aggregate.sustainabilityCents;
    aggregate.procurementCents = aggregate.manualStockCents + aggregate.autoStockCents + aggregate.warehousePurchasesCents;
    aggregate.operatingExpenseCents = aggregate.rentCents + aggregate.salaryCents + aggregate.facilityCents + aggregate.procurementCents +
      aggregate.staffDevelopmentCents + aggregate.marketingExpenseCents + aggregate.hqExpenseCents +
      aggregate.supplierExpenseCents + aggregate.researchExpenseCents + aggregate.auctionFeeExpenseCents +
      aggregate.franchiseSupportCents + aggregate.executiveCents + aggregate.warehouseOverheadCents +
      aggregate.setupCents + aggregate.devCents + aggregate.recruitmentCents + aggregate.shippingCents +
      aggregate.strategyExpenseCents + aggregate.sustainabilityCents;
    aggregate.operatingProfitCents = aggregate.revenueCents - aggregate.operatingExpenseCents;
    aggregate.netProfitCents = aggregate.operatingProfitCents - aggregate.financeExpenseCents;
    state.company.pendingMarketingCents = 0;
    state.company.sourcing.pendingContractCents=0;
    state.company.research.pendingExpenseCents=0;
    state.company.pendingAuctionFeesCents=0;
    state.company.phase7.pendingExpenseCents=0;
    // Dividends distribute post-profit cash to all shareholders. Not an expense.
    const dividends = aggregate.netProfitCents > 0 ? Math.min(
      Math.round(aggregate.netProfitCents * state.company.finance.dividendRate),
      Math.max(0, state.company.cashCents - 300000)) : 0;
    state.company.cashCents -= dividends;
    // Founder receives only their fraction of declared shareholder distributions.
    const founderShare=Math.round(dividends*state.company.finance.founderOwnership);
    state.company.empire.capital.founder.cashCents+=founderShare;
    state.company.empire.capital.founder.dividendIncomeCents+=founderShare;
    state.company.finance.dividendsPaidCents += dividends;
    aggregate.dividendsCents = dividends;
    state.company.lastWeek = aggregate;
    for (const key of ["revenueCents", "operatingExpenseCents", "netProfitCents", "unitsSold", "lostStock", "lostCapacity"])
      state.company.lifetime[key] += aggregate[key];
    state.company.lifetime.weeks++;
    state.company.lifetime.facilityCents=(state.company.lifetime.facilityCents||0)+facilityCents;
    state.company.history = [...state.company.history, {
      week: closingWeek, date: closingDate, revenueCents, operatingExpenseCents: aggregate.operatingExpenseCents,
      netProfitCents: aggregate.netProfitCents, unitsSold: aggregate.unitsSold,
      lostStock: aggregate.lostStock, lostCapacity: aggregate.lostCapacity,
      marketingExpenseCents: aggregate.marketingExpenseCents,
      hqExpenseCents: aggregate.hqExpenseCents, financeExpenseCents: aggregate.financeExpenseCents,
      principalPaidCents: aggregate.principalPaidCents, dividendsCents: aggregate.dividendsCents,
      supplierExpenseCents:aggregate.supplierExpenseCents, researchExpenseCents:aggregate.researchExpenseCents,
      facilityCents:aggregate.facilityCents,
      auctionFeeExpenseCents:aggregate.auctionFeeExpenseCents,
      royaltiesCents:aggregate.royaltyCents,franchiseUnits:aggregate.franchiseUnits,
      shippingCents:aggregate.shippingCents,executiveCents:aggregate.executiveCents,
      warehouseOverheadCents:aggregate.warehouseOverheadCents,
      franchiseSupportCents:aggregate.franchiseSupportCents,
      warehousePurchasesCents:aggregate.warehousePurchasesCents,
      contractRevenueCents:aggregate.contractRevenueCents, strategyExpenseCents:aggregate.strategyExpenseCents,
      sustainabilityCents:aggregate.sustainabilityCents,
      productDevelopmentCents:aggregate.devCents
    }].slice(-MAX_HISTORY);
    updateInvestorBoard(state, aggregate);
    updateStaffAndReputation(state, resultList);
    const innovationEvents=weeklyResearch(state,closingWeek);
    const auctionResults=resolveAuctions(state,nextRandom,closingWeek);
    state.notices.push(...innovationEvents,...auctionResults.events);
    state.news=[...[...innovationEvents,...auctionResults.events].map(description=>({week:closingWeek,description})),...state.news].slice(0,24);
    aggregate.auctionRefundCents=auctionResults.refundedCents;
    aggregate.auctionCapitalizedCents=auctionResults.awardedCents;
    if (state.company.cashCents < 0) state.notices.push("Company cash is negative. Reduce fixed costs or improve sales before expanding.");
    state.company.empire.lastWeek={...empireWeek,shippingCents:shipmentsWeek.shippingCents,
      shipmentsScheduled:shipmentsWeek.scheduled,franchisesActive:state.company.empire.franchises.filter(f=>f.status==='active').length};
    state.company.empire.netWorthHistory=[...state.company.empire.netWorthHistory,{
      week:closingWeek,cashCents:state.company.cashCents,debtCents:outstandingDebt(state),
      franchiseRoyaltyCents:empireWeek.royaltyCents,shippingCents:shipmentsWeek.shippingCents
    }].slice(-MAX_HISTORY);
    if(state.company.empire.event){
      state.company.empire.event.weeksRemaining--;
      if(state.company.empire.event.weeksRemaining<=0)state.company.empire.event=null;
    }
    phase7WeeklyStrategy(state,closingWeek);
    state.seed = seed;
    state.time.week++;
    state.time.isoDate = addWeek(closingDate);
    Object.assign(state.time, parts(state.time.isoDate));
    return state;
  }

  const getCafe = state => state.cafes.find(cafe => cafe.id === state.selectedCafeId) || state.cafes[0];
  const cafeName = cafe => `${CITIES[cafe.cityId].name} · ${cafe.district}`;
  const listingPrice = listing => listing.buildoutCents + STARTER_STOCK_COST;
  function reduce(previous, action) {
    if (action.type === "WEEK_TICK") return { state: processWeek(previous) };
    if (action.type === "NEW_GAME") return { state: initialState() };
    if(['STRATEGY_POLICY','SUSTAINABILITY_UPGRADE','ACCEPT_CONTRACT','BOARD_DECISION'].includes(action.type))
      return phase7Action(previous,action);
    const state = copy(previous);
    if(['HIRE_EXECUTIVE','FIRE_EXECUTIVE','OPEN_WAREHOUSE','STOCK_WAREHOUSE',
       'DEVELOP_PRODUCT','LICENSE_FRANCHISE','FRANCHISE_ROYALTY',
       'GO_PUBLIC','SECONDARY_OFFERING','PERSONAL_TRADE'].includes(action.type)){
      const err=EmpireWorld.reduceAction(state,action,{ingredients:INGREDIENTS,ingredientKeys:INGREDIENT_KEYS,valuation:estimatedEquityValuation});
      return err?{state:previous,error:err}:{state};
    }

    if (action.type==="BID_PROPERTY") {
      const listing=LISTING_BY_ID[action.listingId];
      if(!listing) return {state:previous,error:"Property not found."};
      const lot=listingState(state,listing.id);
      if(lot.status!=="available") return {state:previous,error:"This property is no longer available for a new bid."};
      const bid=Math.round(Number(action.bidCents));
      if(!Number.isSafeInteger(bid)||bid<reserveBid(listing)||bid>listing.buildoutCents*2.5)
        return {state:previous,error:`Bid must be between ${money(reserveBid(listing))} and ${money(listing.buildoutCents*2.5)}.`};
      const escrowCents=bid+STARTER_STOCK_COST;
      if(state.company.cashCents<escrowCents) return {state:previous,error:"Insufficient cash for bid plus opening stock escrow."};
      state.company.cashCents-=escrowCents;
      lot.status="bidding";
      lot.auction={bidCents:bid,escrowCents,closeWeek:state.time.week+1,placedWeek:state.time.week};
      return {state};
    }
    if (action.type==="CANCEL_BID") {
      const lot=state.estate.lots[action.listingId];
      if(!lot||lot.status!=="bidding") return {state:previous,error:"There is no active offer to withdraw."};
      if(state.time.week>=lot.auction.closeWeek) return {state:previous,error:"Auction is already closing."};
      const penalty=Math.round(lot.auction.bidCents*.02);
      state.company.cashCents+=lot.auction.escrowCents-penalty;
      state.company.pendingAuctionFeesCents+=penalty; // Early bid withdrawal fee, expensed at next close.
      lot.status="available";lot.auction=null;
      return {state};
    }
    if (action.type==="START_RESEARCH") {
      const project=RESEARCH[action.id], research=state.company.research;
      if(!project) return {state:previous,error:"Research project not found."};
      if(research.activeId) return {state:previous,error:"Finish the active project before starting another."};
      if(research.completed.includes(action.id)) return {state:previous,error:"Project already completed."};
      if(state.company.cashCents<project.costCents) return {state:previous,error:"Not enough cash to fund research."};
      state.company.cashCents-=project.costCents;
      research.activeId=action.id;research.remainingWeeks=project.weeks;
      research.pendingExpenseCents+=project.costCents;
      research.totalInvestedCents+=project.costCents;
      return {state};
    }
    if (action.type==="SUPPLIER") {
      if(!SUPPLIERS[action.id]) return {state:previous,error:"Unknown coffee supplier."};
      const sourcing=state.company.sourcing;
      if(sourcing.supplierId===action.id) return {state:previous,error:"That supplier is already contracted."};
      if(state.time.week-sourcing.lastSwitchWeek<4) return {state:previous,error:"Supplier changes require a 4-week cooldown."};
      if(state.company.cashCents<SUPPLIER_SWITCH_CENTS) return {state:previous,error:"Insufficient cash for supplier onboarding."};
      state.company.cashCents-=SUPPLIER_SWITCH_CENTS;
      sourcing.pendingContractCents+=SUPPLIER_SWITCH_CENTS;
      sourcing.supplierId=action.id;sourcing.lastSwitchWeek=state.time.week;
      return {state};
    }
    if (action.type==="DELIVERY_INSURANCE") {
      state.company.sourcing.insured=Boolean(action.value);
      return {state};
    }
    if (action.type==="ACQUIRE_RIVAL") {
      const [cityId,rivalId]=[action.cityId,action.rivalId];
      const rival=state.rivals[cityId]?.find(r=>r.id===rivalId);
      if(!rival||!rival.stores) return {state:previous,error:"That chain is not available for acquisition."};
      if(state.company.finance.founderOwnership<.51) return {state:previous,error:"A founder majority is required for this acquisition."};
      if(state.cafes.length+rival.stores>45) return {state:previous,error:"Maximum corporate network size is 45 cafes."};
      const price=acquisitionPrice(rival);
      if(state.company.cashCents<price) return {state:previous,error:"Not enough corporate cash for this acquisition."};
      state.company.cashCents-=price;
      state.company.lifetime.capitalExpenditureCents+=price;
      state.company.portfolioInvestedCents+=price;
      const toTake=rival.stores;
      for(let i=0;i<toTake;i++) {
        const lot=LISTINGS.find(l=>l.cityId===cityId && state.estate.lots[l.id].rivalId===rivalId);
        if(lot) {state.estate.lots[lot.id].status="owned";state.estate.lots[lot.id].rivalId=null;}
        const synthesized=lot||{id:`acquired-${rivalId}-${i}`,cityId,district:`${rival.name} · Branch ${i+1}`,type:"Acquired café",rentCents:Math.round(90000*CITIES[cityId].priceIndex),buildoutCents:0,footfall:clamp(.84+rival.strength*.11,.85,1.18),staff:3};
        const cafe=starterCafe(synthesized,`cafe-${state.nextCafeNumber++}`,state.time.week);
        // A purchased ongoing business includes its existing inventory in enterprise value,
        // so the starter inventory is not charged as a separate procurement expense.
        cafe.pendingManualExpenseCents=0;
        state.cafes.push(cafe);
      }
      rival.stores=0;rival.warChestCents=0;rival.latestEvent=`Acquired by ${state.company.name} in week ${state.time.week}`;
      state.news=[{week:state.time.week,description:`${state.company.name} acquired ${rival.name} (${toTake} stores) for ${money(price)}.`},...state.news].slice(0,24);
      return {state};
    }

    if (action.type === "COMPANY_NAME") {
      const name = String(action.value || "").trim().replace(/\s+/g, " ");
      if (name.length < 3 || name.length > 44) return { state: previous, error: "Company name must have 3–44 characters." };
      state.company.name = name;
      return { state };
    }
    if (action.type === "HQ_UPGRADE") {
      const next = HQ_TIERS[state.company.hqTier + 1];
      if (!next) return { state: previous, error: "Headquarters is fully upgraded." };
      if (state.company.cashCents < next.upgradeCents) return { state: previous, error: "Not enough cash for the headquarters upgrade." };
      state.company.cashCents -= next.upgradeCents;
      state.company.lifetime.capitalExpenditureCents += next.upgradeCents;
      state.company.hqTier++;
      return { state };
    }
    if (action.type === "BORROW") {
      const amount = Number(action.amountCents), termWeeks = Number(action.termWeeks);
      if (!LOAN_AMOUNTS.includes(amount) || !creditTerms(termWeeks)) return { state: previous, error: "Invalid loan offer." };
      if (outstandingDebt(state) + amount > loanCreditLimit(state)) return { state: previous, error: "Loan exceeds your available credit facility." };
      const apr = creditTerms(termWeeks);
      state.company.finance.loans.push({ id: `loan-${state.company.finance.nextLoanId++}`,
        originalCents: amount, balanceCents: amount, apr, termWeeks, weeksRemaining: termWeeks,
        weeklyPaymentCents: loanPayment(amount, termWeeks, apr), borrowedWeek: state.time.week });
      state.company.cashCents += amount;
      return { state };
    }
    if (action.type === "REPAY_LOAN") {
      const loan = state.company.finance.loans.find(l => l.id === action.id && l.balanceCents > 0);
      if (!loan) return { state: previous, error: "Active loan not found." };
      const amount = Math.min(loan.balanceCents, Math.max(0, state.company.cashCents));
      if (amount < loan.balanceCents) return { state: previous, error: "Full early repayment requires enough cash to cover outstanding principal." };
      state.company.cashCents -= loan.balanceCents;
      state.company.finance.principalRepaidCents += loan.balanceCents;
      loan.balanceCents = 0;
      loan.weeksRemaining = 0;
      return { state };
    }
    if (action.type === "RAISE_EQUITY") {
      const amount = Number(action.amountCents), finance = state.company.finance;
      if (!EQUITY_OFFERS.includes(amount)) return { state: previous, error: "Invalid investment round." };
      if (state.time.week - finance.lastRaiseWeek < 12) return { state: previous, error: "Wait 12 weeks between investment rounds." };
      if (finance.investors.length >= 5) return { state: previous, error: "All investor partnership slots are filled." };
      const valuation = estimatedEquityValuation(state), preShare = valuation / (valuation + amount);
      if (finance.founderOwnership * preShare < .51 - 1e-9) return { state: previous, error: "This deal would dilute the founder below 51%. Choose a smaller round or grow your valuation." };
      finance.founderOwnership *= preShare;
      for (const investor of finance.investors) investor.stake *= preShare;
      finance.investors.push({ id: `investor-${finance.nextInvestorId++}`,
        name: INVESTOR_NAMES[finance.investors.length], investedCents: amount,
        stake: 1 - preShare, valuationCents: valuation, week: state.time.week });
      finance.lastRaiseWeek = state.time.week;
      finance.externalCapitalRaisedCents += amount;
      finance.boardConfidence = clamp(finance.boardConfidence + 4, 0, 100);
      state.company.cashCents += amount;
      return { state };
    }
    if (action.type === "DIVIDEND_POLICY") {
      const rate = Number(action.value);
      if (!DIVIDEND_RATES.includes(rate)) return { state: previous, error: "Invalid dividend policy." };
      state.company.finance.dividendRate = rate;
      return { state };
    }
    if (action.type === "LAUNCH_CAMPAIGN") {
      const channel = MARKETING_CHANNELS[action.channel], cityId = action.cityId;
      if (!channel || (action.channel === "national" ? cityId !== "all" : !CITIES[cityId])) return { state: previous, error: "Choose a valid campaign and target city." };
      if (state.company.brand.campaigns.length >= 6) return { state: previous, error: "Maximum six concurrent campaigns." };
      if (state.company.cashCents < channel.costCents) return { state: previous, error: "Not enough cash to launch this campaign." };
      state.company.cashCents -= channel.costCents;
      state.company.pendingMarketingCents += channel.costCents;
      state.company.brand.campaigns.push({ id: state.company.brand.nextCampaignId++, channelId: action.channel,
        cityId, lift: channel.lift, originalWeeks: channel.weeks,
        remainingWeeks: channel.weeks, launchedWeek: state.time.week, costCents: channel.costCents });
      for (const id of (cityId === "all" ? CITY_IDS : [cityId]))
        state.company.brand.awareness[id] = clamp(state.company.brand.awareness[id] + channel.awareness, 0, 100);
      return { state };
    }
    if (action.type === "SELECT_CAFE") {
      if (!state.cafes.some(cafe => cafe.id === action.id)) return { state: previous, error: "Location not found." };
      state.selectedCafeId = action.id;
      return { state };
    }
    if (action.type === "OPEN_CAFE") {
      const listing = LISTING_BY_ID[action.listingId];
      if (!listing) return { state: previous, error: "Property not found." };
      if (listingState(state,listing.id).status!=="available") return {state:previous,error:"The location is owned, under auction, or controlled by a rival."};
      if (state.company.cashCents < buyNowPrice(listing)) return {state:previous,error:"Not enough cash for the buy-now premium and opening inventory."};
      if (state.cafes.length >= 45) return {state:previous,error:"Maximum network size is 45 cafes."};
      const id = `cafe-${state.nextCafeNumber++}`;
      state.company.cashCents -= buyNowPrice(listing);
      const acquiredBuildout=buyNowPrice(listing)-STARTER_STOCK_COST;
      state.company.portfolioInvestedCents += acquiredBuildout;
      state.company.lifetime.capitalExpenditureCents += acquiredBuildout;
      listingState(state,listing.id).status="owned";
      state.cafes.push(starterCafe(listing, id, state.time.week));
      state.selectedCafeId = id;
      return { state };
    }
    const cafe = getCafe(state);
    switch (action.type) {
      case "STORE_LAYOUT": {
        const option=STORE_LAYOUTS[action.id];
        if(!option) return {state:previous,error:"Unknown floorplan."};
        if(cafe.operations.layoutId===action.id) return {state:previous,error:"Floorplan already active."};
        if(state.company.cashCents<option.remodelCents) return {state:previous,error:"Not enough cash for remodeling."};
        cafe.operations.layoutId=action.id;
        state.company.cashCents-=option.remodelCents;
        state.company.lifetime.capitalExpenditureCents+=option.remodelCents;
        cafe.lifetime.capitalExpenditureCents+=option.remodelCents;
        break;
      }
      case "SEATING_UPGRADE": {
        const next=SEATING_TIERS[cafe.operations.seatingTier+1];
        if(!next) return {state:previous,error:"Seating is fully upgraded."};
        if(state.company.cashCents<next.upgradeCents) return {state:previous,error:"Not enough cash to expand seating."};
        cafe.operations.seatingTier++;
        state.company.cashCents-=next.upgradeCents;
        state.company.lifetime.capitalExpenditureCents+=next.upgradeCents;
        cafe.lifetime.capitalExpenditureCents+=next.upgradeCents;
        break;
      }
      case "CLEAN_POLICY": {
        if(!CLEANING_POLICIES[action.id]) return {state:previous,error:"Unknown cleaning policy."};
        cafe.operations.cleanliness=action.id;
        break;
      }
      case "LOYALTY_PROGRAM": {
        if(!LOYALTY_POLICIES[action.id]) return {state:previous,error:"Unknown loyalty policy."};
        cafe.operations.loyalty=action.id;
        break;
      }
      case "SPECIALIZE": {
        const specialty=SPECIALTIES[action.id];
        if(!specialty) return {state:previous,error:"Unknown staff specialization."};
        if(cafe.team.specialty===action.id) return {state:previous,error:"This specialty is already active."};
        const cost=specialty.trainCents;
        if(state.company.cashCents<cost) return {state:previous,error:"Not enough cash for specialist training."};
        state.company.cashCents-=cost;
        cafe.pendingStaffExpenseCents+=cost;
        cafe.team.specialty=action.id;
        cafe.team.morale=clamp(cafe.team.morale+2,0,100);
        break;
      }

      case "HIRE":
        if (cafe.staff >= 25) return { state: previous, error: "Staff limit is 25 per location." };
        cafe.staff++;
        cafe.team.morale = clamp(cafe.team.morale + 1, 0, 100);
        break;
      case "FIRE":
        if (cafe.staff <= 1) return { state: previous, error: "Keep at least one employee per location." };
        cafe.staff--;
        cafe.team.morale = clamp(cafe.team.morale - 3, 0, 100);
        break;
      case "WAGE_POLICY": {
        const premium = Number(action.value);
        if (!WAGE_PREMIUMS.includes(premium)) return { state: previous, error: "Invalid hourly-pay premium." };
        cafe.team.wagePremiumCents = premium;
        break;
      }
      case "TRAIN_STAFF": {
        if (cafe.team.trainingLevel >= STAFF_TRAINING_MAX) return { state: previous, error: "This team has completed all training levels." };
        const charge = cafe.staff * 55000 * (cafe.team.trainingLevel + 1);
        if (state.company.cashCents < charge) return { state: previous, error: "Not enough cash for team training." };
        state.company.cashCents -= charge;
        cafe.pendingStaffExpenseCents += charge;
        cafe.team.trainingLevel++;
        cafe.team.morale = clamp(cafe.team.morale + 5, 0, 100);
        break;
      }
      case "MANAGER": {
        if (cafe.team.managerHired) return { state: previous, error: "A manager is already assigned to this cafe." };
        if (state.company.cashCents < MANAGER_RECRUITING_CENTS) return { state: previous, error: "Not enough cash for manager recruitment." };
        state.company.cashCents -= MANAGER_RECRUITING_CENTS;
        cafe.pendingStaffExpenseCents += MANAGER_RECRUITING_CENTS;
        cafe.team.managerHired = true;
        cafe.team.morale = clamp(cafe.team.morale + 4, 0, 100);
        break;
      }
      case "REMOVE_MANAGER": {
        if (!cafe.team.managerHired) return { state: previous, error: "No manager assigned to this cafe." };
        cafe.team.managerHired = false;
        cafe.team.morale = clamp(cafe.team.morale - 3, 0, 100);
        break;
      }
      case "UPGRADE": {
        const next = EQUIPMENT[cafe.equipmentTier + 1];
        if (!next) return { state: previous, error: "Already at the highest equipment tier." };
        if (state.company.cashCents < next.costCents) return { state: previous, error: "Not enough company cash to upgrade." };
        state.company.cashCents -= next.costCents;
        state.company.lifetime.capitalExpenditureCents += next.costCents;
        cafe.lifetime.capitalExpenditureCents += next.costCents;
        cafe.equipmentTier++;
        break;
      }
      case "PRICE": {
        if (!cafe.menu[action.id]) return { state: previous, error: "Product not found." };
        const dollars = Number(action.value);
        if (!Number.isFinite(dollars) || dollars < .5 || dollars > 25) return { state: previous, error: "Price must be between $0.50 and $25.00." };
        cafe.menu[action.id].priceCents = cents(dollars);
        break;
      }
      case "WEIGHT": {
        if (!cafe.menu[action.id]) return { state: previous, error: "Product not found." };
        const value = Number(action.value);
        if (!Number.isFinite(value) || value < .5 || value > 2) return { state: previous, error: "Demand weight must be between 0.50 and 2.00." };
        cafe.menu[action.id].demandWeight = Math.round(value * 100) / 100;
        break;
      }
      case "RECIPE": {
        if (!cafe.menu[action.id]) return { state: previous, error: "Product not found." };
        const limits = { beansGrams: [5, 40], milkMl: [0, 400], sugarGrams: [0, 25] };
        const range = limits[action.field];
        const value = Number(action.value);
        if (!range || !Number.isFinite(value) || value < range[0] || value > range[1]) return { state: previous, error: "Recipe value outside valid limits." };
        cafe.menu[action.id].recipe[action.field] = value;
        break;
      }
      case "COPY_MENU": {
        const source = state.cafes.find(item => item.id === action.fromId);
        if (!source || source.id === cafe.id) return { state: previous, error: "Select a different source location." };
        for (const id of PRODUCT_IDS) {
          cafe.menu[id].priceCents = source.menu[id].priceCents;
          cafe.menu[id].recipe = copy(source.menu[id].recipe);
        }
        // Local demand weights intentionally remain local rather than being copied.
        break;
      }
      case "BUY": {
        const ingredient = INGREDIENTS[action.key];
        if (!ingredient) return { state: previous, error: "Ingredient not found." };
        const purchaseCents = procurementPackPrice(state, action.key, cafe);
        if (state.company.cashCents < purchaseCents) return { state: previous, error: "Not enough cash for this ingredient pack." };
        cafe.inventory[action.key] = roundQty(cafe.inventory[action.key] + ingredient.packQuantity);
        cafe.pendingManualExpenseCents += purchaseCents;
        state.company.cashCents -= purchaseCents;
        break;
      }
      case "AUTO_RESTOCK":
        cafe.supply.autoRestock = Boolean(action.value);
        break;
      case "SUPPLY_SETTING": {
        if (!INGREDIENTS[action.key] || !["thresholds", "targets"].includes(action.field)) return { state: previous, error: "Invalid supply setting." };
        const value = Number(action.value), other = action.field === "thresholds" ? "targets" : "thresholds";
        if (!Number.isFinite(value) || value < 0 || value > 10000) return { state: previous, error: "Stock settings must be between 0 and 10,000." };
        if (action.field === "thresholds" && value > cafe.supply.targets[action.key]) return { state: previous, error: "Threshold must not exceed target." };
        if (action.field === "targets" && value < cafe.supply.thresholds[action.key]) return { state: previous, error: "Target must not be below threshold." };
        cafe.supply[action.field][action.key] = value;
        break;
      }
      default: return { state: previous, error: `Unknown action: ${action.type}` };
    }
    return { state };
  }

  function isValidSave(saved) {
    return saved?.version === SAVE_VERSION && !!saved.company?.empire &&
      !!saved.company?.research && !!saved.company?.sourcing &&
      !!saved.estate?.lots && !!saved.demographics && Number.isInteger(saved?.time?.week) &&
      Number.isFinite(saved?.company?.cashCents) && Array.isArray(saved?.cafes) &&
      saved.cafes.length > 0 && Number.isInteger(saved.company.hqTier) &&
      !!HQ_TIERS[saved.company.hqTier] && !!saved.company.brand?.awareness &&
      !!saved.company.finance?.loans && Array.isArray(saved.company.finance.investors) &&
      saved.cafes.every(c => CITIES[c.cityId] && c.menu && c.inventory && c.supply && c.team && c.operations && c.customers) &&
      saved?.market && CITY_IDS.every(id => saved.market[id] && Array.isArray(saved.rivals?.[id]));
  }
  function loadState() {
    // Non-destructive upgrades: old keys remain available to the prior game.
    try {
      const modern = localStorage.getItem(SAVE_KEY);
      if (modern) {
        const parsed = JSON.parse(modern);
        if (isValidSave(parsed)) return { game: parsed, imported: false };
      }
    } catch (error) { console.warn("Phase 5 save could not be read:", error); }
    try {
      const phase6 = localStorage.getItem(PHASE6_SAVE_KEY);
      if (phase6) {
        const raw = JSON.parse(phase6);
        if (raw?.version === 6 && Array.isArray(raw.cafes) && raw.cafes.length && Number.isFinite(raw.company?.cashCents))
          return { game: upgradePhase7(copy(raw)), imported: true };
      }
    } catch(error) { console.warn('Phase 6 import failed:', error); }
    try {
      const phase5=localStorage.getItem(PHASE5_SAVE_KEY);
      if(phase5){const migrated=migratePhase5(JSON.parse(phase5));if(migrated)return {game:migrated,imported:true};}
    }catch(error){console.warn('Phase 5 save could not be imported:',error);}
    try {
      const phase4 = localStorage.getItem(PHASE4_SAVE_KEY);
      if (phase4) {
        const migrated = migratePhase4(JSON.parse(phase4));
        if (migrated) return {game:upgradePhase6(migrated),imported:true};
      }
    } catch (error) { console.warn("Phase 4 save could not be imported:", error); }
    try {
      const phase3 = localStorage.getItem(PHASE3_SAVE_KEY);
      if (phase3) {
        const migrated = migratePhase3(JSON.parse(phase3));
        if (migrated) return {game:upgradePhase6(upgradePhase5(migrated)),imported:true};
      }
    } catch (error) { console.warn("Phase 3 save could not be imported:", error); }
    try {
      const phase2 = localStorage.getItem(PREVIOUS_SAVE_KEY);
      if (phase2) {
        const migrated = migratePhase2(JSON.parse(phase2));
        if (migrated) return { game: upgradePhase6(upgradePhase5(upgradePhase4(migrated))), imported: true };
      }
    } catch (error) { console.warn("Phase 2 save could not be imported:", error); }
    try {
      const phase1 = localStorage.getItem(LEGACY_SAVE_KEY);
      if (phase1) {
        const migrated = migratePhase1(JSON.parse(phase1));
        if (migrated) return { game: upgradePhase6(upgradePhase5(upgradePhase4(migrated))), imported: true };
      }
    } catch (error) { console.warn("Phase 1 save could not be imported:", error); }
    return { game: initialState(), imported: false };
  }

