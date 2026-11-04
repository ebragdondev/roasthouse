const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm');
const path=require('node:path'),root=path.resolve(__dirname,'..');
const compile=file=>ts.transpileModule(fs.readFileSync(path.join(root,'src',file),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
const sandbox={structuredClone,console,Intl};
const names=['customer-economy.ts','empire-world.ts','engine.ts','phase7.ts'];
const E=vm.runInNewContext(`(()=>{'use strict';${names.map(compile).join('\n')};return {initialState,processWeek,reduce,migratePhase3,migratePhase4,migratePhase5,upgradePhase5,upgradePhase6,upgradePhase7,CITY_IDS,LISTINGS,PRODUCT_IDS,PRODUCTS,INGREDIENTS,INGREDIENT_KEYS,CITIES,EmpireWorld};})()`,sandbox);
let assertions=0;const check=(v,msg)=>{assert.ok(v,msg);assertions++;},eq=(a,b,msg)=>{assert.equal(a,b,msg);assertions++;};
const sum=(rows,field)=>rows.reduce((n,r)=>n+(r[field]||0),0);
const dispatch=(s,action)=>{const result=E.reduce(s,action);check(!result.error,`${action.type}: ${result.error}`);return result.state};
const rec=state=>{
 const w=state.company.lastWeek, e=state.company.empire;
 eq(w.revenueCents, sum(Object.values(w.cafeResults),'revenueCents')+w.royaltyCents+(w.contractRevenueCents||0),'company revenue reconciled');
 eq(w.procurementCents,w.autoStockCents+w.manualStockCents+w.warehousePurchasesCents,'procurement reconciled');
 eq(w.operatingExpenseCents,w.rentCents+w.salaryCents+w.facilityCents+w.procurementCents+w.staffDevelopmentCents+w.marketingExpenseCents+w.hqExpenseCents+w.supplierExpenseCents+w.researchExpenseCents+w.auctionFeeExpenseCents+w.franchiseSupportCents+w.executiveCents+w.warehouseOverheadCents+w.setupCents+w.devCents+w.recruitmentCents+w.shippingCents+(w.strategyExpenseCents||0)+(w.sustainabilityCents||0),'all corporate expenses accounted');
 eq(w.netProfitCents,w.revenueCents-w.operatingExpenseCents-w.financeExpenseCents,'profit reconciled');
 eq(w.unitsSold,sum(Object.values(w.cafeResults),'unitsSold'),'owned cafe sales');
 eq(w.unitsSold+w.lostStock+w.lostCapacity,w.demand,'demand reconciled');
 check(Number.isSafeInteger(state.company.cashCents),'cash always safe integer');
 check(Number.isSafeInteger(w.netProfitCents),'profit always safe integer');
 for(const c of state.cafes){
  for(const k of E.INGREDIENT_KEYS)check(Number.isFinite(c.inventory[k])&&c.inventory[k]>=0,`inventory ${k} non-negative`);
  eq(c.lastWeek.unitsSold,Object.values(c.lastWeek.products).reduce((n,p)=>n+p.sold,0),'products sold sum');
  eq(c.lastWeek.unitsSold,Object.values(c.lastWeek.cohortVisits).reduce((a,b)=>a+b,0),'cohort visits sum');
 }
 for(const w of Object.values(e.warehouses))for(const k of Object.keys(w.inventory))check(w.inventory[k]>=-1e-5,'warehouse inventory nonnegative');
};
let s=E.initialState();eq(s.version,7);eq(E.CITY_IDS.length,22);eq(E.LISTINGS.length,44);eq(E.PRODUCT_IDS.length,10);
check(!s.company.empire.portfolio.unlocked.includes('croissant'),'bakery starts locked');
check(E.CITIES.tok.currency==='JPY','Tokyo JPY');
check(E.CITIES.par.currency==='EUR','Paris EUR');
const original=structuredClone(s);s=E.processWeek(s);rec(s);
const initialWeek=s.company.lastWeek;
check(initialWeek.netProfitCents>0,'initial week can make profit');
// Ensure the product pipeline doesn't silently sell locked products.
for(const id of Object.keys(E.EmpireWorld.newProducts))eq(s.cafes[0].lastWeek.products[id].sold,0,'locked new product not sold');
// Expand to Japan, UK, France, Australia; currency variation affects USD revenue.
let global=E.initialState();global.company.cashCents=1_000_000_000;
for(const id of ['tok-central','lon-central','par-central','syd-central','seo-central'])global=dispatch(global,{type:'OPEN_CAFE',listingId:id});
eq(global.cafes.length,6);const globalWeek=E.processWeek(global);rec(globalWeek);
check(globalWeek.cafes.filter(c=>c.cityId!=='nyc').every(c=>c.lastWeek.revenueCents>0),'international cafes actually sell');
check(globalWeek.company.empire.fx.JPY!==E.EmpireWorld.currencies.JPY.base,'foreign exchange evolves');
// Product development checks.
let prod=E.initialState();prod=dispatch(prod,{type:'DEVELOP_PRODUCT',id:'americano'});
check(prod.company.empire.portfolio.active==='americano','development started');
const funds=prod.company.cashCents;prod=E.processWeek(prod);rec(prod);
eq(prod.company.empire.portfolio.remainingWeeks,1);
prod=E.processWeek(prod);rec(prod);
check(prod.company.empire.portfolio.unlocked.includes('americano'),'development completes');
check(prod.cafes[0].lastWeek.products.americano.sold>0,'new beverage generates sales');
// Pastry stock and zero-bean recipes must be valid.
prod=dispatch(prod,{type:'DEVELOP_PRODUCT',id:'croissant'});
for(let i=0;i<5;i++)prod=E.processWeek(prod);
check(prod.company.empire.portfolio.unlocked.includes('croissant'),'bakery launch');
prod=dispatch(prod,{type:'BUY',key:'pastries'});
prod=E.processWeek(prod);rec(prod);
check(prod.cafes[0].lastWeek.products.croissant.sold>=0,'bakery products calculate safely');
// Franchise onboarding cost expensed only once, then recurring royalties.
let franch=E.initialState();franch=dispatch(franch,{type:'LICENSE_FRANCHISE',cityId:'lon'});
const preCash=franch.company.cashCents;
franch=E.processWeek(franch);rec(franch);
eq(franch.company.lastWeek.setupCents,160000);
franch=E.processWeek(franch);rec(franch);
franch=E.processWeek(franch);rec(franch);
check(franch.company.lastWeek.royaltyCents>0,'franchise royalty recognized');
check(franch.company.lastWeek.franchiseUnits>0,'franchise units reported separately');
eq(franch.company.lastWeek.unitsSold,franch.cafes.reduce((sum,c)=>sum+c.lastWeek.unitsSold,0),'franchise units not counted as owned cafe units');
const royalties=franch.company.empire.lifetimeRoyaltiesCents;
check(royalties>0,'lifetime franchise royalty tracked');
// Staffing executives costs and benefits.
let exec=E.initialState();exec=dispatch(exec,{type:'HIRE_EXECUTIVE',id:'cmo'});
exec=E.processWeek(exec);rec(exec);
eq(exec.company.lastWeek.executiveCents,105000);
eq(exec.company.lastWeek.recruitmentCents,210000);
check(exec.company.lastWeek.netProfitCents<initialWeek.netProfitCents,'executive expenses lower profit');
// Warehousing and delivery lead times with realistic escrow & no double charge.
let wh=E.initialState();wh.company.cashCents=100_000_000;
wh=dispatch(wh,{type:'OPEN_WAREHOUSE',region:'americas'});
wh=dispatch(wh,{type:'STOCK_WAREHOUSE',region:'americas',key:'cups',packs:6});
wh=dispatch(wh,{type:'STOCK_WAREHOUSE',region:'americas',key:'beansLbs',packs:15});
wh.cafes[0].inventory.cups=20;wh.cafes[0].inventory.beansLbs=1;
const stockBefore=wh.company.empire.warehouses.americas.inventory.cups;
wh=E.processWeek(wh);rec(wh);
check(wh.company.lastWeek.shippingCents>0,'freight charged');
check(wh.company.empire.shipments.length>0,'shipment scheduled');
check(wh.company.empire.warehouses.americas.inventory.cups<stockBefore,'stock removed from warehouse when dispatched');
check(wh.company.lastWeek.procurementCents>=6*7500*.92,'warehouse purchases in cost ledger');
wh=E.processWeek(wh);rec(wh);
check(wh.cafes[0].lastWeek.unitsSold>0,'delivery arrives in next week before sales');
// Phase 5 migration, no mutation to original.
const prev=structuredClone(original);prev.version=5;delete prev.company.empire;
for(const c of prev.cafes){for(const k of Object.keys(E.EmpireWorld.newProducts))delete c.menu[k];delete c.inventory.pastries;delete c.supply.thresholds.pastries;delete c.supply.targets.pastries;}
for(const city of Object.keys(E.EmpireWorld.internationalCities)){delete prev.market[city];delete prev.rivals[city];delete prev.demographics[city];delete prev.company.brand.awareness[city];}
for(const l of E.EmpireWorld.internationalListings)delete prev.estate.lots[l.id];
const migrated=E.migratePhase5(prev);
check(migrated?.version===7,'migrated version 7');check(migrated.cafes[0].menu.icedLatte,'menu backfilled');
check(migrated.market.tok&&migrated.estate.lots['tok-central'],'world backfilled');
eq(prev.version,5,'prior save untouched');
rec(E.processWeek(migrated));
// Earlier-generation saves must migrate through the whole chain without losing cafes.
const old4=structuredClone(original);
old4.version=4;delete old4.company.empire;
for(const c of old4.cafes){delete c.customers;delete c.operations;}
const migrated4=E.upgradePhase6(E.migratePhase4(old4));
eq(migrated4.version,7,'Phase 4 save upgrades to Phase 7');
check(migrated4.cafes[0].customers&&migrated4.company.empire.capital,'Phase 4 gains customers and capital');
const old3=structuredClone(old4);old3.version=3;
delete old3.estate;delete old3.demographics;delete old3.company.research;delete old3.company.sourcing;
for(const c of old3.cafes){for(const k of Object.keys(E.EmpireWorld.newProducts))delete c.menu[k];}
for(const city of Object.keys(E.EmpireWorld.internationalCities)){
 delete old3.market[city];delete old3.rivals[city];delete old3.company.brand.awareness[city];
}
const migrated3=E.upgradePhase6(E.upgradePhase5(E.migratePhase3(old3)));
check(migrated3?.version===7,'Phase 3 save upgrades without missing-city rivals');
check(migrated3.market.lon&&migrated3.rivals.tok?.length,'Phase 3 gains global markets');
rec(E.processWeek(migrated3));

// Public equity, personal investing, and dividends use separate cash ledgers.
let capital=E.initialState();capital.company.cashCents=350_000_000;
capital=dispatch(capital,{type:'OPEN_CAFE',listingId:'nyc-astoria'});
capital=dispatch(capital,{type:'OPEN_CAFE',listingId:'chi-logan'});
capital=dispatch(capital,{type:'HQ_UPGRADE'});
capital=dispatch(capital,{type:'HQ_UPGRADE'});
for(let i=0;i<26;i++)capital=E.processWeek(capital);
check(!capital.company.empire.capital.listed,'company begins private');
const beforeIPO=capital.company.cashCents;
capital=dispatch(capital,{type:'GO_PUBLIC'});
const issued=capital.company.empire.capital;
check(issued.listed,'IPO listed company');
eq(issued.sharesOutstanding,1250000,'IPO share count');
check(Math.abs(capital.company.finance.founderOwnership-.8)<1e-8,'IPO dilutes founder ownership');
check(capital.company.cashCents>beforeIPO,'IPO raises company cash, not profit');
const beforeIssue=capital.company.cashCents,oldStake=capital.company.finance.founderOwnership;
capital=dispatch(capital,{type:'SECONDARY_OFFERING'});
check(capital.company.cashCents>beforeIssue,'secondary shares raise cash');
check(capital.company.finance.founderOwnership<oldStake,'second share issuance dilutes founder');
const privateBank=capital.company.empire.capital.founder.cashCents,corporate=capital.company.cashCents;
capital=dispatch(capital,{type:'PERSONAL_TRADE',id:'AUR',side:'buy',shares:4});
check(capital.company.empire.capital.founder.cashCents<privateBank,'personal stock purchase uses founder wallet');
eq(capital.company.cashCents,corporate,'personal investment does not affect company cash');
eq(capital.company.empire.capital.founder.holdings.AUR,4);
capital=dispatch(capital,{type:'PERSONAL_TRADE',id:'AUR',side:'sell',shares:2});
eq(capital.company.empire.capital.founder.holdings.AUR,2);
capital=dispatch(capital,{type:'DIVIDEND_POLICY',value:.1});
const founderPrior=capital.company.empire.capital.founder.cashCents;
capital=E.processWeek(capital);rec(capital);
const d=capital.company.lastWeek.dividendsCents;
eq(capital.company.empire.capital.founder.cashCents-founderPrior,
  Math.round(d*capital.company.finance.founderOwnership),'personal dividend pro-rata');
// older Phase 3 saves need additional city rivals before phase 4 migration proceeds.
// 104-week, 44-store stress, all cities + franchise chains + regional logistics.
let long=E.initialState();long.company.cashCents=3_000_000_000;
for(const listing of E.LISTINGS)long=dispatch(long,{type:'OPEN_CAFE',listingId:listing.id});
eq(long.cafes.length,45);
for(const region of Object.keys(E.EmpireWorld.regions)){
 long=dispatch(long,{type:'OPEN_WAREHOUSE',region});
 for(const key of ['beansLbs','cups','milkGal'])long=dispatch(long,{type:'STOCK_WAREHOUSE',region,key,packs:60});
}
for(const city of ['nyc','tok','lon','par','syd','sin','mex','sao','chi'])long=dispatch(long,{type:'LICENSE_FRANCHISE',cityId:city});
for(const id of ['coo','cfo','cmo','cto','cso','cgo'])long=dispatch(long,{type:'HIRE_EXECUTIVE',id});
for(let i=0;i<104;i++){
 const prior=long.company.cashCents;
 long=E.processWeek(long);rec(long);
 const w=long.company.lastWeek;
 // Cash paid during settlement only; no deferred action double-debit or synthetic revenue.
 const expected=w.revenueCents-w.rentCents-w.salaryCents-w.facilityCents-w.hqExpenseCents-w.financeExpenseCents-w.principalPaidCents-
 (long.company.sourcing.insured?11000:0)-w.autoStockCents-w.dividendsCents-w.executiveCents-w.warehouseOverheadCents-w.franchiseSupportCents-w.shippingCents;
 eq(long.company.cashCents-prior,expected,`cash reconciliation week ${i}`);
}
eq(long.company.lifetime.weeks,104);


// Phase 7 decisions: expenditures are paid immediately and recognized once.
let decisions=E.initialState();
check(!!decisions.company.phase7,'initial Phase 7 strategy exists');
for(let i=0;i<5;i++){decisions=E.processWeek(decisions);rec(decisions);}
check(!!decisions.company.phase7.event,'fifth week triggers strategic event');
const repBefore=decisions.company.brand.reputation;
const cashBefore=decisions.company.cashCents;
decisions=dispatch(decisions,{type:'BOARD_DECISION',choice:'recover'});
eq(decisions.company.cashCents,cashBefore-310000,'decision cash commitment immediately paid');
check(decisions.company.brand.reputation>=repBefore+4,'good board response improves reputation');
eq(decisions.company.phase7.pendingExpenseCents,310000,'pending strategic charge');
decisions=E.processWeek(decisions);rec(decisions);
eq(decisions.company.lastWeek.strategyExpenseCents,310000,'decision recognized once in weekly profit');
decisions=E.processWeek(decisions);rec(decisions);
eq(decisions.company.lastWeek.strategyExpenseCents,0,'one-time decision not double charged');
// Contracts: weekly payouts occur only when company-wide deliveries are fulfilled.
let contracts=E.initialState();
contracts.company.cashCents=500_000_000;
contracts=dispatch(contracts,{type:'ACCEPT_CONTRACT',id:'catering'});
contracts=E.processWeek(contracts);rec(contracts);
eq(contracts.company.lastWeek.strategyExpenseCents,270000,'contract onboarding expensed at close');
const contractRow=contracts.company.phase7.contracts[0];
check(contractRow.status==='active','contract starts immediately');
check(contracts.company.lastWeek.contractRevenueCents>=0,'contract revenue explicit');
// Sustainabilty tier investment is capitalized, with recurring overhead expensed.
const prevCapital=contracts.company.lifetime.capitalExpenditureCents;
contracts=dispatch(contracts,{type:'SUSTAINABILITY_UPGRADE'});
check(contracts.company.lifetime.capitalExpenditureCents>prevCapital,'sustainability investment is capitalized');
contracts=E.processWeek(contracts);rec(contracts);
eq(contracts.company.lastWeek.sustainabilityCents,19000,'sustainability expenses weekly');
const oldStrategy=contracts.company.phase7.policy;
contracts=dispatch(contracts,{type:'STRATEGY_POLICY',id:'access'});
check(contracts.company.phase7.policy!==oldStrategy,'corporate policy changes');
contracts=E.processWeek(contracts);rec(contracts);
eq(contracts.company.lastWeek.strategyExpenseCents,125000,'policy switch cost recognized');
// Old Phase 6 states must upgrade non-destructively.
const phase6Original=E.initialState();phase6Original.version=6;delete phase6Original.company.phase7;
const restored=E.upgradePhase7(structuredClone(phase6Original));
eq(restored.version,7,'upgrade Phase6 version to 7');
check(restored.company.phase7.contracts.length===0,'new strategy field backfilled');
eq(phase6Original.version,6,'original Phase6 source remains unchanged');

console.log(`PASS Phase 7 simulation: ${assertions.toLocaleString()} assertions over 104+ weeks, 45 stores, contracts, decisions, sustainability and migration`);
