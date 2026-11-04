// @ts-nocheck
// Phase 7 strategic gameplay additions. Wrapped around the Phase 6 simulation, not a replacement.
const PHASE7_POLICIES = Object.freeze({
  quality:{name:'Craft first', description:'Premium positioning: improves reputation each week; local pricing still matters.', effect:'Reputation +0.22/week'},
  access:{name:'Everyday value', description:'Broad appeal: market awareness expands gradually across the world.', effect:'All-city awareness +0.20/week'},
  community:{name:'Community roots', description:'Local connection: raises reputation and customer reach.', effect:'Reputation +0.10/week · awareness +0.10/week'}
});
const PHASE7_SUSTAINABILITY = Object.freeze([
  {name:'Traditional procurement',investCents:0,weeklyCents:0,description:'Conventional operations; no sustainability benefits.'},
  {name:'Ethical sourcing',investCents:750000,weeklyCents:19000,description:'Traceable purchasing, local partnerships, a modest reputation lift.'},
  {name:'Low-waste operations',investCents:1650000,weeklyCents:42000,description:'Reduced waste, greener packaging, stronger consumer trust.'},
  {name:'Climate-forward network',investCents:3500000,weeklyCents:93000,description:'Company-wide sustainability and improved supplier disruption resilience.'}
]);
const PHASE7_DEALS = Object.freeze({
  catering:{name:'Office catering agreement',target:300,payoutCents:185000,setupCents:270000,weeks:12,description:'Weekly delivery program for corporate offices.'},
  universities:{name:'Campus coffee partnership',target:700,payoutCents:420000,setupCents:650000,weeks:16,description:'Preferred provider on a university campus.'},
  airlines:{name:'Airport hospitality contract',target:1400,payoutCents:920000,setupCents:1450000,weeks:20,description:'Supply beverages to a regional travel operator.'},
  stadiums:{name:'Stadium concession agreement',target:3000,payoutCents:2150000,setupCents:3200000,weeks:24,description:'High-volume concessions across sports events.'}
});
const PHASE7_EVENTS = Object.freeze([
  {id:'viral',label:'A viral customer review',summary:'A frustrated customer posted a video that is spreading locally.',choices:[
    {id:'recover',name:'Publicly respond and fund service recovery',costCents:310000,rep:5,awareness:1,morale:2},
    {id:'ignore',name:'Stay silent and preserve cash',costCents:0,rep:-5,awareness:0,morale:0}]},
  {id:'staff',label:'Employee feedback campaign',summary:'Baristas are asking for better training and a clearer career path.',choices:[
    {id:'train',name:'Fund company-wide training',costCents:440000,rep:2,awareness:0,morale:8},
    {id:'decline',name:'Defer the investment',costCents:0,rep:-1,awareness:0,morale:-6}]},
  {id:'rival',label:'A competitor launches a price war',summary:'A rival is using heavy discounts to capture local market share.',choices:[
    {id:'brand',name:'Run a focused brand campaign',costCents:390000,rep:1,awareness:5,morale:0},
    {id:'protect',name:'Protect margins and accept fewer visits',costCents:0,rep:-1,awareness:-1,morale:0}]},
  {id:'food',label:'Quality assurance audit',summary:'A third-party audit recommends a better inspection program.',choices:[
    {id:'upgrade',name:'Improve food-safety and inspection routines',costCents:280000,rep:4,awareness:0,morale:2},
    {id:'delay',name:'Postpone the audit',costCents:0,rep:-3,awareness:0,morale:0}]},
  {id:'charity',label:'Neighborhood partnership opportunity',summary:'Community organizations want your brand to sponsor an event.',choices:[
    {id:'sponsor',name:'Sponsor the neighborhood project',costCents:370000,rep:4,awareness:3,morale:1},
    {id:'pass',name:'Pass on the opportunity',costCents:0,rep:0,awareness:0,morale:0}]},
  {id:'press',label:'Journalists investigate your supply chain',summary:'A reporter has requested detailed information about coffee provenance.',choices:[
    {id:'publish',name:'Commission and publish an independent report',costCents:450000,rep:5,awareness:1,morale:0},
    {id:'minimal',name:'Provide only the required documents',costCents:0,rep:-2,awareness:0,morale:0}]}
]);
function newPhase7State(){return {policy:'quality',sustainabilityTier:0,pendingExpenseCents:0,
  event:null,eventIndex:0,decisions:[],contracts:[],nextContractId:1,completedContracts:0,
  earnedContractCents:0,missedContractWeeks:0};}
function upgradePhase7(state){
  if(!state||!state.company)return state;
  state.version=7;
  const defaults=newPhase7State();
  state.company.phase7 ||= defaults;
  for(const [k,v] of Object.entries(defaults))if(state.company.phase7[k]===undefined)state.company.phase7[k]=copy(v);
  return state;
}
function phase7Action(previous,action){
  const state=upgradePhase7(copy(previous));
  const p=state.company.phase7;
  if(action.type==='STRATEGY_POLICY'){
    if(!PHASE7_POLICIES[action.id])return {state:previous,error:'Choose a valid corporate strategy.'};
    if(p.policy===action.id)return {state:previous,error:'That strategy is already active.'};
    const fee=125000;
    if(state.company.cashCents<fee)return {state:previous,error:'Insufficient cash to reorganize brand strategy.'};
    state.company.cashCents-=fee;p.pendingExpenseCents+=fee;p.policy=action.id;
  }else if(action.type==='SUSTAINABILITY_UPGRADE'){
    const next=PHASE7_SUSTAINABILITY[p.sustainabilityTier+1];
    if(!next)return {state:previous,error:'Highest sustainability tier already reached.'};
    if(state.company.cashCents<next.investCents)return {state:previous,error:'Not enough cash for this investment.'};
    state.company.cashCents-=next.investCents;
    state.company.lifetime.capitalExpenditureCents+=next.investCents;
    p.sustainabilityTier++;
  }else if(action.type==='ACCEPT_CONTRACT'){
    const contract=PHASE7_DEALS[action.id];
    if(!contract)return {state:previous,error:'Unknown commercial opportunity.'};
    if(p.contracts.filter(c=>c.status==='active').length>=3)return {state:previous,error:'Maximum of three concurrent agreements.'};
    if(p.contracts.some(c=>c.id===action.id&&c.status==='active'))return {state:previous,error:'You already hold this agreement.'};
    if(state.company.cashCents<contract.setupCents)return {state:previous,error:'Insufficient cash for onboarding.'};
    state.company.cashCents-=contract.setupCents;p.pendingExpenseCents+=contract.setupCents;
    p.contracts.push({key:`contract-${p.nextContractId++}`,id:action.id,status:'active',
      weeksRemaining:contract.weeks,earnedCents:0,fulfilled:0,missed:0});
  }else if(action.type==='BOARD_DECISION'){
    const event=PHASE7_EVENTS.find(e=>e.id===p.event?.id);
    const choice=event?.choices.find(c=>c.id===action.choice);
    if(!choice)return {state:previous,error:'No valid board decision is currently pending.'};
    if(state.company.cashCents<choice.costCents)return {state:previous,error:'Insufficient cash for this decision.'};
    state.company.cashCents-=choice.costCents;p.pendingExpenseCents+=choice.costCents;
    state.company.brand.reputation=clamp(state.company.brand.reputation+choice.rep,5,100);
    for(const cityId of CITY_IDS)state.company.brand.awareness[cityId]=clamp(state.company.brand.awareness[cityId]+choice.awareness,0,100);
    for(const cafe of state.cafes)cafe.team.morale=clamp(cafe.team.morale+choice.morale,0,100);
    p.decisions.unshift({week:state.time.week,event:event.id,choice:choice.id,label:choice.name,costCents:choice.costCents});
    p.decisions=p.decisions.slice(0,24);p.event=null;
    state.notices.unshift(`Board decision: ${choice.name}.`);
  }else return null;
  return {state};
}
function phase7CloseContracts(state,unitCount,closingWeek){
  upgradePhase7(state);
  let earned=0;
  const p=state.company.phase7;
  for(const contract of p.contracts){
    if(contract.status!=='active')continue;
    const def=PHASE7_DEALS[contract.id];
    if(!def)continue;
    if(unitCount>=def.target){
      earned+=def.payoutCents;contract.earnedCents+=def.payoutCents;contract.fulfilled++;
    }else{
      contract.missed++;p.missedContractWeeks++;
      state.company.brand.reputation=clamp(state.company.brand.reputation-.08,5,100);
    }
    contract.weeksRemaining--;
    if(contract.weeksRemaining<=0){contract.status='completed';p.completedContracts++;}
  }
  p.earnedContractCents+=earned;
  if(earned)state.notices.push(`Commercial contracts: ${money(earned)} earned this week.`);
  return earned;
}
function phase7WeeklyStrategy(state,closingWeek){
  const p=upgradePhase7(state).company.phase7;
  if(p.policy==='quality')state.company.brand.reputation=clamp(state.company.brand.reputation+.22,5,100);
  if(p.policy==='community')state.company.brand.reputation=clamp(state.company.brand.reputation+.10,5,100);
  for(const cityId of CITY_IDS){
    const benefit=p.policy==='access'?.20:p.policy==='community'?.10:0;
    if(benefit)state.company.brand.awareness[cityId]=clamp(state.company.brand.awareness[cityId]+benefit,0,100);
  }
  if(p.sustainabilityTier)state.company.brand.reputation=clamp(state.company.brand.reputation+p.sustainabilityTier*.055,5,100);
  if(!p.event && closingWeek>1 && closingWeek%5===0){
    p.event={id:PHASE7_EVENTS[p.eventIndex%PHASE7_EVENTS.length].id,issuedWeek:closingWeek};p.eventIndex++;
    state.notices.unshift('A new strategic decision is waiting in the boardroom.');
  }
}
const PHASE7_ACHIEVEMENTS=Object.freeze([
  {name:'First profitable week',desc:'Close one week with positive net profit.',icon:'◉',check:s=>(s.company.history||[]).some(h=>h.netProfitCents>0)},
  {name:'Five-figure week',desc:'Earn $10,000 in weekly revenue.',icon:'◆',check:s=>s.company.history.some(h=>h.revenueCents>=1000000)},
  {name:'Portfolio builder',desc:'Operate three company-owned stores.',icon:'▦',check:s=>s.cafes.length>=3},
  {name:'Regional powerhouse',desc:'Operate cafes in three markets.',icon:'◎',check:s=>new Set(s.cafes.map(c=>c.cityId)).size>=3},
  {name:'Global operator',desc:'Expand into any non-U.S. city.',icon:'◈',check:s=>s.cafes.some(c=>!['nyc','chi','sea','aus','sf','la'].includes(c.cityId))},
  {name:'Licensed network',desc:'Open your first active franchise.',icon:'✦',check:s=>s.company.empire.franchises.some(f=>f.status==='active')},
  {name:'World-class brand',desc:'Reach 75 brand reputation.',icon:'★',check:s=>s.company.brand.reputation>=75},
  {name:'Supply specialist',desc:'Build any distribution warehouse.',icon:'◇',check:s=>Object.values(s.company.empire.warehouses).some(w=>w.opened)},
  {name:'Public enterprise',desc:'Complete the IPO.',icon:'↗',check:s=>s.company.empire.capital.listed},
  {name:'Corporate dealmaker',desc:'Complete a commercial contract.',icon:'✥',check:s=>s.company.phase7.completedContracts>0},
  {name:'Research leader',desc:'Complete three R&D projects.',icon:'✧',check:s=>s.company.research.completed.length>=3},
  {name:'Long game',desc:'Run the company for 104 weeks.',icon:'⌁',check:s=>s.time.week>=105}
]);
