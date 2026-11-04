// @ts-nocheck
/* Phase 6: deterministic global-market catalog and pure-ish state transitions.
   All internal money is integer USD cents. Exchange rates are modeled, not live FX.
   No copyrighted art, names, or source code from other games is used. */
const EmpireWorld = (() => {
  const currencies = Object.freeze({
    USD:{symbol:'$',base:1,name:'US Dollar'}, EUR:{symbol:'€',base:1.08,name:'Euro'},
    GBP:{symbol:'£',base:1.27,name:'British Pound'}, JPY:{symbol:'¥',base:.0067,name:'Japanese Yen'},
    AUD:{symbol:'A$',base:.66,name:'Australian Dollar'}, CAD:{symbol:'C$',base:.73,name:'Canadian Dollar'},
    KRW:{symbol:'₩',base:.00074,name:'South Korean Won'}, SGD:{symbol:'S$',base:.75,name:'Singapore Dollar'},
    AED:{symbol:'د.إ',base:.2723,name:'UAE Dirham'}, MXN:{symbol:'MX$',base:.053,name:'Mexican Peso'},
    BRL:{symbol:'R$',base:.19,name:'Brazilian Real'}
  });
  const regionNames={americas:'Americas',europe:'Europe',asia:'Asia–Pacific'};
  const internationalData = [
    ['tok','Tokyo','Japan','JPY','asia',1.14,1.18,1.19,1.22,'Shibuya','Shinjuku'],
    ['osa','Osaka','Japan','JPY','asia',1.04,1.06,1.02,1.08,'Namba','Umeda'],
    ['lon','London','United Kingdom','GBP','europe',1.17,1.27,1.23,1.30,'Shoreditch','Soho'],
    ['par','Paris','France','EUR','europe',1.16,1.21,1.18,1.24,'Le Marais','Saint-Germain'],
    ['ber','Berlin','Germany','EUR','europe',1.01,1.03,.98,1.11,'Kreuzberg','Mitte'],
    ['ams','Amsterdam','Netherlands','EUR','europe',1.05,1.14,1.05,1.14,'De Pijp','Jordaan'],
    ['rom','Rome','Italy','EUR','europe',1.09,1.04,1.14,1.06,'Trastevere','Prati'],
    ['mad','Madrid','Spain','EUR','europe',.99,.99,.93,1.04,'Malasaña','Salamanca'],
    ['syd','Sydney','Australia','AUD','asia',1.12,1.19,1.18,1.18,'Surry Hills','Newtown'],
    ['tor','Toronto','Canada','CAD','americas',1.08,1.09,1.11,1.12,'Queen West','Yorkville'],
    ['van','Vancouver','Canada','CAD','americas',1.10,1.17,1.12,1.19,'Gastown','Kitsilano'],
    ['seo','Seoul','South Korea','KRW','asia',1.12,1.12,1.20,1.21,'Hongdae','Gangnam'],
    ['sin','Singapore','Singapore','SGD','asia',1.19,1.33,1.25,1.25,'Tiong Bahru','Marina Bay'],
    ['dxb','Dubai','UAE','AED','asia',1.15,1.30,1.24,1.30,'Downtown','Jumeirah'],
    ['mex','Mexico City','Mexico','MXN','americas',1.02,.87,.93,.99,'Roma Norte','Condesa'],
    ['sao','São Paulo','Brazil','BRL','americas',1.07,.94,1.01,1.04,'Pinheiros','Jardins']
  ];
  const internationalCities = Object.fromEntries(internationalData.map((r,i)=>[r[0],{
    name:r[1], state:r[2], country:r[2],currency:r[3],region:r[4],
    demand:r[5],priceIndex:r[6],competitionBase:1.01+(i%4)*.046,
    tagline:`${r[1]} international expansion market · modeled economics`,
    preferences:{drip:.94+(i%4)*.035,latte:1.06+(i%3)*.05,espresso:r[7],coldBrew:r[8]},
    rivals:[`${r[1]} Bean Co.`,`${r[1]} Daily Roast`,`${r[1]} Café Collective`]
  }]));
  const internationalListings=internationalData.flatMap((r,i)=>[0,1].map(j=>({
    id:`${r[0]}-${j===0?'central':'quarter'}`,cityId:r[0],district:r[9+j],
    type:j===0?'Prime international high street':'Neighborhood coffee hub',
    rentCents:Math.round((j===0?112000:76000)*r[6]),
    buildoutCents:Math.round((j===0?3400000:2150000)*r[6]),
    footfall:j===0?1.23:1.06,staff:j===0?4:3
  })));
  const demographicMix=Object.fromEntries(internationalData.map((r,i)=>[r[0],{
    commuters:.25+(i%4)*.025,students:.17+(i%3)*.025,
    enthusiasts:.32-(i%3)*.015,locals:0
  }]).map(([k,m])=>{m.locals=+(1-m.commuters-m.students-m.enthusiasts).toFixed(6);return [k,m];}));
  const regions={
    americas:{name:'Americas distribution hub',costCents:3400000,weeklyCents:16000,leadWeeks:1,capacity:32000},
    europe:{name:'European distribution hub',costCents:4100000,weeklyCents:22000,leadWeeks:2,capacity:32000},
    asia:{name:'Asia–Pacific distribution hub',costCents:4800000,weeklyCents:27000,leadWeeks:2,capacity:32000}
  };
  const executives={
    coo:{title:'Chief Operating Officer',salaryCents:125000,signingCents:250000,effect:'Store throughput +9%'},
    cfo:{title:'Chief Financial Officer',salaryCents:115000,signingCents:230000,effect:'Headquarters overhead −10%'},
    cmo:{title:'Chief Marketing Officer',salaryCents:105000,signingCents:210000,effect:'Customer demand +8%'},
    cto:{title:'Chief Technology Officer',salaryCents:120000,signingCents:240000,effect:'Research projects progress faster'},
    cso:{title:'Chief Supply Officer',salaryCents:98000,signingCents:195000,effect:'Distribution costs −18%'},
    cgo:{title:'Chief Growth Officer',salaryCents:110000,signingCents:220000,effect:'Franchise royalty performance +12%'}
  };
  const newProducts = {
    americano:{name:'Americano',baseDemand:185,referencePriceCents:350,elasticity:1.24,ideal:{beansGrams:20,milkMl:0,sugarGrams:2},season:[1.12,1.1,1.06,1,.97,.87,.81,.84,1,1.08,1.11,1.16]},
    cappuccino:{name:'Cappuccino',baseDemand:200,referencePriceCents:460,elasticity:1.35,ideal:{beansGrams:19,milkMl:115,sugarGrams:2},season:[1.15,1.13,1.04,1,.95,.87,.82,.85,1.02,1.11,1.16,1.19]},
    mocha:{name:'Mocha',baseDemand:178,referencePriceCents:575,elasticity:1.55,ideal:{beansGrams:20,milkMl:190,sugarGrams:12},season:[1.18,1.15,1.1,1.05,.94,.79,.77,.85,1,1.11,1.18,1.25]},
    icedLatte:{name:'Iced Latte',baseDemand:260,referencePriceCents:550,elasticity:1.50,ideal:{beansGrams:20,milkMl:200,sugarGrams:5},season:[.55,.61,.79,.98,1.21,1.46,1.63,1.54,1.30,1.08,.76,.62]},
    croissant:{name:'Butter Croissant',baseDemand:205,referencePriceCents:390,elasticity:1.45,ideal:{beansGrams:0,milkMl:0,sugarGrams:0,pastryUnits:1,cups:0},season:[1.04,1.04,1.06,1.07,1.04,1,1,.98,1.03,1.09,1.12,1.13]},
    muffin:{name:'Blueberry Muffin',baseDemand:145,referencePriceCents:345,elasticity:1.58,ideal:{beansGrams:0,milkMl:0,sugarGrams:0,pastryUnits:1,cups:0},season:[1,1,1.03,1.06,1.09,1.10,1.08,1.04,1.05,1.03,1,1.01]}
  };
  const devProjects={
    americano:{costCents:120000,weeks:2,description:'Espresso-based drink · quick launch'},
    cappuccino:{costCents:180000,weeks:3,description:'Steamed milk and rich espresso foam'},
    mocha:{costCents:265000,weeks:4,description:'Chocolate-style sweet coffee drink'},
    icedLatte:{costCents:290000,weeks:4,description:'Warm-weather specialty drink'},
    croissant:{costCents:370000,weeks:5,description:'Add a bakery supply category and breakfast attachments'},
    muffin:{costCents:210000,weeks:3,description:'Expand your breakfast food offering'}
  };
  const events={
    optimism:{title:'Consumer confidence rising',description:'Consumers have more discretionary spending.',factor:1.11,costFactor:1.00,weeks:5},
    recession:{title:'Regional spending slowdown',description:'Consumers are trading down to budget options.',factor:.87,costFactor:1.00,weeks:6},
    inflation:{title:'Inflation accelerates',description:'Operating overhead increases before pricing catches up.',factor:.98,costFactor:1.13,weeks:5},
    freight:{title:'Global shipping congestion',description:'Warehouse freight becomes more expensive.',factor:1,costFactor:1.24,weeks:4},
    tourism:{title:'International travel boom',description:'High-traffic coffee districts draw visitors.',factor:1.09,costFactor:1,weeks:4}
  };
  // Fictional public markets for gameplay; valuations and prices are not real data.
  const listedSecurities = {
    AUR:{name:'Aurora Systems',baseCents:6800,sector:'Technology'},
    BNC:{name:'Bancroft Consumer',baseCents:4900,sector:'Consumer goods'},
    HBR:{name:'Harbor Infrastructure',baseCents:8250,sector:'Infrastructure'}
  };
  const initialCapital=()=>({listed:false,ticker:'NSTR',sharesOutstanding:1000000,
    sharePriceCents:0,ipoWeek:null,publicFloatShares:0,underwritingCents:0,history:[],
    founder:{cashCents:900000,holdings:Object.fromEntries(Object.keys(listedSecurities).map(id=>[id,0])),
      dividendIncomeCents:0,trades:[]},
    securities:Object.fromEntries(Object.entries(listedSecurities).map(([id,p])=>[id,{...p,priceCents:p.baseCents}]))
  });
  const initial = () => ({
    fx:Object.fromEntries(Object.entries(currencies).map(([code,cur])=>[code,cur.base])),
    warehouses:Object.fromEntries(Object.keys(regions).map(id=>[id,{opened:false,inventory:{},capitalCents:0}])),
    shipments:[],nextShipmentId:1,pendingWarehousePurchaseCents:0,
    franchises:[],nextFranchiseId:1,royaltyRate:.07,pendingFranchiseSetupCents:0,
    executives:Object.fromEntries(Object.keys(executives).map(id=>[id,false])),pendingRecruitmentCents:0,
    portfolio:{unlocked:['drip','latte','espresso'],active:null,remainingWeeks:0,pendingDevelopmentCents:0,developedCents:0},
    event:null,eventHistory:[],lastWeek:null,lifetimeRoyaltiesCents:0,lifetimeShippingCents:0,
    netWorthHistory:[],weeklyFXReturns:{},financialSnapshot:null,capital:initialCapital()
  });
  const regionFor = city => city.region || (city.currency && city.currency !== 'USD' ? 'europe':'americas');
  const fxMultiplier=(empire,currency)=> currency==='USD'||!currency ? 1 :
    Math.max(.7,Math.min(1.3, (empire.fx[currency]||currencies[currency]?.base||1)/(currencies[currency]?.base||1)));
  const localPrice=(usdCents,currency,empire)=>Math.round(usdCents/(empire.fx[currency]||1));
  const priceLabel=(usdCents,currency,empire)=>{
    const rate=empire.fx[currency]||1, val=usdCents/100/rate;
    const digits=['JPY','KRW'].includes(currency)?0:2;
    return new Intl.NumberFormat('en-US',{style:'currency',currency:currency||'USD',minimumFractionDigits:digits,maximumFractionDigits:digits}).format(val);
  };
  // Simulated, mean-reverting weekly exchange rates; NOT real exchange rates.
  function evolveFX(empire,random){
    for(const [code,cur] of Object.entries(currencies)){
      if(code==='USD')continue;
      const prev=empire.fx[code]||cur.base;
      const next=Math.max(cur.base*.74,Math.min(cur.base*1.28,prev*.93+cur.base*.07+cur.base*(random()-.5)*.038));
      empire.fx[code]=Math.round(next*1e8)/1e8;
      empire.weeklyFXReturns[code]=next/prev-1;
    }
  }
  function startWeek(state,random,closingWeek){
    const empire=state.company.empire;
    evolveFX(empire,random);
    if(!empire.event && closingWeek>2 && random()<.057){
      const keys=Object.keys(events),id=keys[Math.floor(random()*keys.length)];
      empire.event={id,weeksRemaining:events[id].weeks};
      empire.eventHistory.unshift({week:closingWeek,id,title:events[id].title});
      empire.eventHistory=empire.eventHistory.slice(0,24);
      state.news.unshift({week:closingWeek,description:`World economy: ${events[id].title}. ${events[id].description}`});
    }
    const delivered=[];
    empire.shipments=empire.shipments.filter(shipment=>{
      if(shipment.arrivalWeek>closingWeek)return true;
      const cafe=state.cafes.find(c=>c.id===shipment.cafeId);
      if(cafe){cafe.inventory[shipment.key]=Math.round(((cafe.inventory[shipment.key]||0)+shipment.quantity)*1e6)/1e6;delivered.push(shipment);}
      return false;
    });
    if(delivered.length)state.notices=[...state.notices,`${delivered.length} warehouse shipment(s) delivered to cafes.`];
    if(empire.portfolio.active){
      let pace=empire.executives.cto?2:1;
      empire.portfolio.remainingWeeks=Math.max(0,empire.portfolio.remainingWeeks-pace);
      if(empire.portfolio.remainingWeeks===0){
        const id=empire.portfolio.active;
        empire.portfolio.unlocked.push(id);
        empire.portfolio.active=null;
        state.news.unshift({week:closingWeek,description:`Product launched: ${newProducts[id].name} is now available company-wide.`});
        state.notices.push(`${newProducts[id].name} product development completed.`);
      }
    }
  }
  function marketWeek(state,random,week){
    const capital=state.company.empire.capital;
    for(const security of Object.values(capital.securities)){
      const shock=(random()-.5)*.075;
      const cycle=state.company.empire.event?.id==='recession' ? -.025 : 0;
      security.priceCents=Math.max(50,Math.round(security.priceCents*(1+shock+cycle)));
    }
    if(capital.listed){
      const prior=capital.sharePriceCents;
      const net=state.company.lastWeek?.netProfitCents || 0;
      const profitability=Math.max(-.028,Math.min(.029,net/Math.max(10000000,state.company.portfolioInvestedCents+25000000)*.06));
      const fluctuation=(random()-.5)*.085;
      capital.sharePriceCents=Math.max(10,Math.round(prior*(1+profitability+fluctuation)));
      capital.history.push({week,priceCents:capital.sharePriceCents,marketCapCents:capital.sharePriceCents*capital.sharesOutstanding});
      capital.history=capital.history.slice(-104);
    }
  }
  function founderPortfolioValue(capital){
    return Object.entries(capital.founder.holdings).reduce((v,[id,n])=>v+(capital.securities[id]?.priceCents||0)*n,0);
  }
  function founderWealth(state){
    const cap=state.company.empire.capital;
    return cap.founder.cashCents+founderPortfolioValue(cap)+
      (cap.listed?Math.round(cap.sharesOutstanding*cap.sharePriceCents*state.company.finance.founderOwnership):0);
  }
  function settleEmpire(state,random,closingWeek){
    const empire=state.company.empire;
    marketWeek(state,random,closingWeek);
    const factor=empire.event?events[empire.event.id].factor:1;
    let royaltyCents=0, franchiseSupportCents=0, franchiseUnits=0, ended=0;
    for(const f of empire.franchises){
      if(f.status==='training' && closingWeek>=f.openWeek){f.status='active';}
      if(f.status!=='active')continue;
      const city=state.market[f.cityId],base=Math.max(40,Math.round(680*city.level*factor/(city.competitorPressure||1)));
      const brand=(state.company.brand.awareness[f.cityId]||16)/100;
      const units=Math.round(base*(.67+.5*brand)*(.92+random()*.16));
      const price=Math.round(410*(state.company.empire.fx[currenciesForCity(f.cityId)]||1)/ (currencies[currenciesForCity(f.cityId)]?.base||1));
      const sales=units*price;
      const royalty=Math.round(sales*empire.royaltyRate*(empire.executives.cgo?1.12:1));
      f.lastRoyaltyCents=royalty;f.lifetimeRoyaltyCents+=royalty;f.lastUnits=units;
      royaltyCents+=royalty;franchiseUnits+=units;franchiseSupportCents+=6000;
      if(closingWeek%52===0 && random()<.025+(empire.royaltyRate-.07)*2){f.status='closed';ended++;}
    }
    const executiveCents=Object.entries(executives).reduce((sum,[id,p])=>sum+(empire.executives[id]?p.salaryCents:0),0);
    const warehouseOverheadCents=Object.entries(regions).reduce((sum,[id,p])=>sum+(empire.warehouses[id].opened?p.weeklyCents:0),0);
    const setupCents=empire.pendingFranchiseSetupCents,devCents=empire.portfolio.pendingDevelopmentCents,
      warehousePurchasesCents=empire.pendingWarehousePurchaseCents,recruitmentCents=empire.pendingRecruitmentCents;
    empire.pendingFranchiseSetupCents=0;empire.portfolio.pendingDevelopmentCents=0;
    empire.pendingWarehousePurchaseCents=0;empire.pendingRecruitmentCents=0;
    // Income is royalties only; franchise partners' gross sales are NOT our revenue.
    state.company.cashCents+=royaltyCents-executiveCents-warehouseOverheadCents-franchiseSupportCents;
    if(ended)state.notices.push(`${ended} franchise partner(s) closed underperforming stores.`);
    empire.lifetimeRoyaltiesCents+=royaltyCents;
    return {royaltyCents,franchiseUnits,franchiseSupportCents,executiveCents,
      warehouseOverheadCents,setupCents,devCents,warehousePurchasesCents,recruitmentCents};
  }
  function currenciesForCity(cityId){return internationalCities[cityId]?.currency || (['nyc','chi','sea','aus','sfo','lax'].includes(cityId)?'USD':'USD');}
  function queueShipments(state,closingWeek,ingredientKeys){
    const empire=state.company.empire;
    let shippingCents=0,deliveredQuantity=0,scheduled=0;
    for(const cafe of state.cafes){
      const region=regionForCity(cafe.cityId),warehouse=empire.warehouses[region];
      if(!warehouse?.opened||!cafe.supply.autoRestock)continue;
      for(const key of ingredientKeys){
        if(key==="pastries"&&!(["croissant","muffin"].some(id=>empire.portfolio.unlocked.includes(id))))continue;
        const alreadyInbound=empire.shipments.filter(x=>x.cafeId===cafe.id&&x.key===key).reduce((s,x)=>s+x.quantity,0);
        const available=cafe.inventory[key]+alreadyInbound;
        if(available>=cafe.supply.thresholds[key])continue;
        const toSend=Math.max(0,Math.min(warehouse.inventory[key]||0,cafe.supply.targets[key]-available));
        if(toSend<=.000001)continue;
        const freightRate={beansLbs:140,milkGal:70,sugarLbs:65,cups:8,pastries:14}[key]||20;
        const globalInflation=empire.event?events[empire.event.id].costFactor:1;
        const freight=Math.round((350+freightRate*toSend)*(empire.executives.cso?.82:1)*globalInflation);
        if(state.company.cashCents<freight)continue;
        warehouse.inventory[key]=Math.round(((warehouse.inventory[key]||0)-toSend)*1e6)/1e6;
        empire.shipments.push({id:empire.nextShipmentId++,cafeId:cafe.id,key,quantity:toSend,
          region,arrivalWeek:closingWeek+regions[region].leadWeeks,freightCents:freight});
        state.company.cashCents-=freight;shippingCents+=freight;deliveredQuantity+=toSend;scheduled++;
      }
    }
    empire.lifetimeShippingCents+=shippingCents;
    return {shippingCents,scheduled,unitsInTransit:deliveredQuantity};
  }
  function regionForCity(cityId){return internationalCities[cityId]?.region || 'americas';}
  function stockUsed(warehouse){return Object.values(warehouse.inventory).reduce((s,v)=>s+(Number(v)||0),0);}
  function reduceAction(state,action,definitions){
    const empire=state.company.empire;
    if(action.type==='GO_PUBLIC'){
      const cap=empire.capital;
      if(cap.listed)return 'Your company is already publicly listed.';
      if(state.cafes.length<3||state.company.hqTier<2||state.company.lifetime.weeks<26)
        return 'IPO requires three owned cafes, a corporate operations center, and 26 completed weeks.';
      if(state.company.finance.boardConfidence<45)return 'The board must have at least 45 confidence to approve an IPO.';
      const valuation=definitions.valuation(state);
      const basePrice=Math.max(50,Math.round(valuation/cap.sharesOutstanding));
      const newShares=250000;
      const gross=basePrice*newShares;
      const fee=Math.round(gross*.05),net=gross-fee;
      cap.listed=true;cap.ipoWeek=state.time.week;
      cap.publicFloatShares+=newShares;
      cap.sharesOutstanding+=newShares;
      cap.sharePriceCents=basePrice;
      cap.underwritingCents+=fee;
      state.company.finance.founderOwnership*=1000000/1250000;
      for(const investor of state.company.finance.investors)investor.stake*=1000000/1250000;
      state.company.finance.externalCapitalRaisedCents+=net;
      state.company.cashCents+=net;
      cap.history.push({week:state.time.week,priceCents:basePrice,marketCapCents:basePrice*cap.sharesOutstanding});
      return null;
    }
    if(action.type==='SECONDARY_OFFERING'){
      const cap=empire.capital;
      if(!cap.listed)return 'An IPO is required before another share offering.';
      const newShares=Math.floor(cap.sharesOutstanding*.08);
      const gross=newShares*cap.sharePriceCents,fee=Math.round(gross*.03);
      if(newShares<1||gross<1)return 'Current market price is too low to raise capital.';
      const before=cap.sharesOutstanding;
      cap.sharesOutstanding+=newShares;cap.publicFloatShares+=newShares;
      state.company.finance.founderOwnership*=before/cap.sharesOutstanding;
      for(const investor of state.company.finance.investors)investor.stake*=before/cap.sharesOutstanding;
      state.company.finance.externalCapitalRaisedCents+=gross-fee;
      state.company.cashCents+=gross-fee;cap.underwritingCents+=fee;
      return null;
    }
    if(action.type==='PERSONAL_TRADE'){
      const cap=empire.capital,sec=cap.securities[action.id];
      if(!sec)return 'Select a listed fictional company.';
      const count=Math.round(Number(action.shares));
      if(!Number.isSafeInteger(count)||count<1||count>2000)return 'Trade between 1 and 2,000 whole shares.';
      const buy=action.side==='buy';
      if(!buy&&action.side!=='sell')return 'Invalid trade direction.';
      const gross=sec.priceCents*count,broker=Math.max(1,Math.round(gross*.001));
      if(buy){
        if(cap.founder.cashCents<gross+broker)return 'Not enough personal cash for this purchase.';
        cap.founder.cashCents-=gross+broker;cap.founder.holdings[action.id]+=count;
      }else{
        if(cap.founder.holdings[action.id]<count)return 'You do not own enough shares.';
        cap.founder.holdings[action.id]-=count;cap.founder.cashCents+=gross-broker;
      }
      cap.founder.trades.unshift({week:state.time.week,id:action.id,side:action.side,count,priceCents:sec.priceCents,brokerCents:broker});
      cap.founder.trades=cap.founder.trades.slice(0,80);
      return null;
    }
    if(action.type==='HIRE_EXECUTIVE'||action.type==='FIRE_EXECUTIVE'){
      const def=executives[action.id];if(!def)return 'Unknown executive position.';
      if(action.type==='HIRE_EXECUTIVE'){
        if(empire.executives[action.id])return 'This executive is already employed.';
        if(state.company.cashCents<def.signingCents)return 'Not enough cash for the signing package.';
        state.company.cashCents-=def.signingCents;empire.pendingRecruitmentCents+=def.signingCents;empire.executives[action.id]=true;
      }else{if(!empire.executives[action.id])return 'This executive position is vacant.';empire.executives[action.id]=false;}
      return null;
    }
    if(action.type==='OPEN_WAREHOUSE'){
      const p=regions[action.region];if(!p)return 'Unknown distribution region.';
      const w=empire.warehouses[action.region];if(w.opened)return 'Distribution hub already open.';
      if(state.company.cashCents<p.costCents)return 'Not enough cash to open the distribution hub.';
      state.company.cashCents-=p.costCents;state.company.lifetime.capitalExpenditureCents+=p.costCents;
      w.capitalCents+=p.costCents;w.opened=true;
      for(const key of definitions.ingredientKeys)w.inventory[key] ||= 0;
      return null;
    }
    if(action.type==='STOCK_WAREHOUSE'){
      const {region,key}=action;
      const w=empire.warehouses[region],p=definitions.ingredients[key];
      if(!w?.opened||!p)return 'Open the hub and select a valid ingredient.';
      const packs=Math.round(Number(action.packs));
      if(!Number.isSafeInteger(packs)||packs<1||packs>100)return 'Order 1–100 wholesale packs at a time.';
      const amount=p.packQuantity*packs;
      if(stockUsed(w)+amount>regions[region].capacity)return 'Warehouse capacity exceeded.';
      const unitCost=Math.round(p.packCostCents*.92),total=unitCost*packs;
      if(state.company.cashCents<total)return 'Not enough cash for wholesale inventory.';
      state.company.cashCents-=total;w.inventory[key]=(w.inventory[key]||0)+amount;
      empire.pendingWarehousePurchaseCents+=total;
      return null;
    }
    if(action.type==='DEVELOP_PRODUCT'){
      const p=devProjects[action.id];if(!p)return 'Unknown menu development.';
      if(empire.portfolio.unlocked.includes(action.id))return 'That product is already released.';
      if(empire.portfolio.active)return 'Finish the active product development first.';
      if(state.company.cashCents<p.costCents)return 'Insufficient cash to fund development.';
      state.company.cashCents-=p.costCents;empire.portfolio.pendingDevelopmentCents+=p.costCents;
      empire.portfolio.developedCents+=p.costCents;empire.portfolio.active=action.id;
      empire.portfolio.remainingWeeks=p.weeks;return null;
    }
    if(action.type==='LICENSE_FRANCHISE'){
      if(!state.market[action.cityId])return 'Invalid international territory.';
      const count=empire.franchises.filter(f=>f.cityId===action.cityId&&f.status!=='closed').length;
      if(count>=12)return 'The territory is at its maximum franchise density.';
      const fee=160000+count*30000;
      if(state.company.cashCents<fee)return 'Not enough cash for partner onboarding.';
      state.company.cashCents-=fee;empire.pendingFranchiseSetupCents+=fee;
      empire.franchises.push({id:empire.nextFranchiseId++,cityId:action.cityId,
        status:'training',openWeek:state.time.week+2,lastRoyaltyCents:0,lifetimeRoyaltyCents:0,lastUnits:0});
      return null;
    }
    if(action.type==='FRANCHISE_ROYALTY'){
      const rate=Number(action.rate);
      if(![.06,.07,.08,.09,.10].includes(rate))return 'Royalty rate must be between 6% and 10%.';
      empire.royaltyRate=rate;return null;
    }
    return 'Unsupported international action.';
  }
  return Object.freeze({currencies,internationalCities,internationalListings,demographicMix,
    listedSecurities,initialCapital,marketWeek,founderPortfolioValue,founderWealth,
    regions,executives,newProducts,devProjects,events,initial,fxMultiplier,localPrice,priceLabel,
    evolveFX,startWeek,settleEmpire,queueShipments,regionForCity,stockUsed,reduceAction});
})();
