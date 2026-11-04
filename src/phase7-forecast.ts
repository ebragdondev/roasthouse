// @ts-nocheck
// Isolated, forward-only scenario simulation; mutates clones, never live game state.
let forecastMode='base';
const FORECAST_MODES={base:{name:'Current strategy',description:'No changes to the current company settings.'},
  upside:{name:'Marketing upside',description:'10% more awareness and a moderate 4% menu discount.'},
  downside:{name:'Demand recession',description:'Weaker market demand, stronger rivalry, and a 5% higher price.'}};
function computeForecast(source,mode){
  let projected=upgradePhase7(copy(source));
  const points=[];
  if(mode==='upside'){
    for(const city of CITY_IDS)projected.company.brand.awareness[city]=clamp(projected.company.brand.awareness[city]+10,0,100);
    for(const cafe of projected.cafes)for(const product of Object.values(cafe.menu))product.priceCents=Math.round(product.priceCents*.96);
  }
  if(mode==='downside'){
    for(const cafe of projected.cafes)for(const product of Object.values(cafe.menu))product.priceCents=Math.round(product.priceCents*1.05);
  }
  for(let i=0;i<13;i++){
    if(mode==='downside')for(const market of Object.values(projected.market)){
      market.level=clamp(market.level*.85,.6,1.3);
      market.competitorPressure=clamp(market.competitorPressure*1.07,.7,1.9);
    }
    projected=processWeek(projected);
    points.push({week:projected.time.week-1,cash:projected.company.cashCents,
      revenue:projected.company.lastWeek.revenueCents,profit:projected.company.lastWeek.netProfitCents,
      stockouts:projected.company.lastWeek.lostStock,units:projected.company.lastWeek.unitsSold});
  }
  return {points,finish:projected,totalRevenue:points.reduce((s,p)=>s+p.revenue,0),
    totalProfit:points.reduce((s,p)=>s+p.profit,0),totalStockouts:points.reduce((s,p)=>s+p.stockouts,0)};
}
function forecastSparkline(points){
  const coords=points.map((p,i)=>({x:30+i*(640/(points.length-1)),y:p.cash}));
  const low=Math.min(...coords.map(p=>p.y),0),high=Math.max(...coords.map(p=>p.y));
  const rng=Math.max(1,high-low);
  const d=coords.map((p,i)=>`${i?'L':'M'}${p.x.toFixed(1)},${(180-(p.y-low)/rng*130).toFixed(1)}`).join(' ');
  const positive=points.at(-1).cash>=game.company.cashCents;
  return `<svg viewBox="0 0 700 225" style="width:100%;max-height:300px" role="img" aria-label="13-week projected company cash"><line x1="30" y1="180" x2="670" y2="180" stroke="#576b49" stroke-dasharray="5 7"/><path d="${d}" fill="none" stroke="${positive?'#d1ea95':'#f3ac90'}" stroke-width="4" stroke-linecap="round"/><text x="30" y="208" fill="#b0c4a5" font-size="12">Now</text><text x="670" y="208" text-anchor="end" fill="#b0c4a5" font-size="12">Week +13</text><text x="670" y="20" text-anchor="end" fill="#e8f3cf" font-size="13">${money(points.at(-1).cash)}</text></svg>`;
}
function renderForecast(){
  const computed=computeForecast(game,forecastMode),last=computed.points.at(-1);
  const baseline=forecastMode==='base'?null:computeForecast(game,'base');
  const delta=baseline?last.cash-baseline.points.at(-1).cash:0;
  return `<section class="p7-feature-hero"><span class="eyebrow">PLANNING / 13-WEEK OUTLOOK</span><h2>Know the numbers before you grow.</h2><p>Run a simulated 13-week scenario using your current cafes, debt, contracts, inventory, and competitor behavior. Forecasts are illustrative, not guaranteed outcomes. The scenario never changes your live save.</p><div class="p7-ministats"><span>Current cash <b>${money(game.company.cashCents)}</b></span><span>Projection horizon <b>13 weeks</b></span><span>Scenario <b>${FORECAST_MODES[forecastMode].name}</b></span></div></section>
    <section class="panel"><div class="panel-head"><div><h2>Economic scenario</h2><p>Choose a projection. This calculation runs entirely in your browser.</p></div></div><div class="scenario-controls">${Object.entries(FORECAST_MODES).map(([key,val])=>`<button class="scenario-option ${forecastMode===key?'active':''}" data-forecast="${key}"><strong>${val.name}</strong><small>${val.description}</small></button>`).join('')}</div></section>
    <div class="kpis" style="margin-top:20px">${kpi('Projected closing cash',money(last.cash),'Week '+last.week,'◉',last.cash>=0?'positive':'negative')}${kpi('13-week revenue',money(computed.totalRevenue),'All cafes + franchises + B2B','▦')}${kpi('13-week net earnings',money(computed.totalProfit),'After weekly overhead and interest','↗',computed.totalProfit>=0?'positive':'negative')}${kpi('Lost to stockouts',whole(computed.totalStockouts),'Units not served','◇')}</div>
    <section class="panel"><div class="panel-head"><div><h2>Cash runway projection</h2><p>Real weekly simulation with the selected scenario applied.</p></div>${baseline?`<span class="pill ${delta>=0?'':'warning'}">${delta>=0?'+':''}${money(delta)} vs baseline</span>`:''}</div>${forecastSparkline(computed.points)}</section>
    <section class="panel" style="margin-top:20px"><div class="panel-head"><div><h2>Thirteen weekly results</h2><p>Cash is after purchases, debt payments, investments, and dividend policy. Net profit excludes capital expenditures.</p></div></div><div class="table-wrap"><table><thead><tr><th>Week</th><th>Units sold</th><th>Revenue</th><th>Net profit</th><th>Closing cash</th></tr></thead><tbody>${computed.points.map(p=>`<tr><td>${p.week}</td><td>${whole(p.units)}</td><td>${money(p.revenue)}</td><td class="${p.profit>=0?'positive':'negative'}">${money(p.profit)}</td><td>${money(p.cash)}</td></tr>`).join('')}</tbody></table></div></section>`;
}
