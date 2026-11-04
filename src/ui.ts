// @ts-nocheck
// Framework-free browser adapter. All game mutations go through reduce().
  const loaded = loadState();
  let game = upgradePhase7(loaded.game);
  let currentTab = "dashboard";
  let listingFilter = "all";
  let paused = true, speed = 1, clockAccumulator = 0, lastFrame = null, toastTimeout = null;
  function saveState() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(game)); scheduleCloudSave(); }
    catch { showToast("Browser storage unavailable; progress may not save.", true); }
  }
  function showToast(message, error = false) {
    const slot = document.getElementById("toast-slot");
    slot.innerHTML = `<div class="toast ${error ? "error" : ""}">${escaped(message)}</div>`;
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => { slot.innerHTML = ""; }, 3600);
  }
  function dispatch(action, successMessage = "") {
    const response = reduce(game, action);
    if (response.error) { showToast(response.error, true); render(); return false; }
    game = response.state;
    saveState();
    render();
    if (successMessage) showToast(successMessage);
    return true;
  }

  function kpi(label, value, footnote, icon, tone = "") {
    return `<article class="card kpi"><div class="kpi-head"><span>${label}</span><span class="kpi-icon">${icon}</span></div><div class="kpi-value ${tone}">${value}</div><div class="kpi-foot">${footnote}</div></article>`;
  }
  const stat = (label, value, cls = "") => `<div class="stat-row"><span>${label}</span><strong class="${cls}">${value}</strong></div>`;
  const getCitiesOwned = () => new Set(game.cafes.map(c => c.cityId)).size;
  const sameCityCount = id => game.cafes.filter(c => c.cityId === id).length;
  const branchSelect = () => `<label class="select-label"><span>ACTIVE LOCATION</span><select id="active-cafe" aria-label="Active cafe">${game.cafes.map(c => `<option value="${c.id}" ${c.id === game.selectedCafeId ? "selected" : ""}>${escaped(cafeName(c))}</option>`).join("")}</select></label>`;
  function chartSvg(history) {
    const values = history.slice(-16), width = 740, height = 240, left = 7, right = 733, top = 17, bottom = 204;
    const highest = Math.max(100000, ...values.flatMap(p => [p.revenueCents, p.operatingExpenseCents]));
    const grid = [0,.25,.5,.75,1].map(f => {
      const y = bottom - f * (bottom - top);
      return `<line x1="${left}" y1="${y}" x2="${right}" y2="${y}" stroke="#2a4145" stroke-dasharray="4 6"/><text x="${right}" y="${y - 5}" fill="#7c9998" font-size="10" text-anchor="end">${compactMoney(highest * f)}</text>`;
    }).join("");
    if (!values.length) return `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="No financial history yet">${grid}<text x="370" y="115" fill="#9fb4ac" text-anchor="middle" font-size="14">Advance one week to begin your financial history</text></svg>`;
    const x = i => left + (values.length === 1 ? .5 : i / (values.length - 1)) * (right - left);
    const y = v => bottom - v / highest * (bottom - top);
    const path = key => values.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(2)} ${y(p[key]).toFixed(2)}`).join(" ");
    const revenue = path("revenueCents"), expense = path("operatingExpenseCents");
    return `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Revenue and expenses for the last ${values.length} weeks"><defs><linearGradient id="revenue-gradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#b5edb3" stop-opacity=".23"/><stop offset="100%" stop-color="#b5edb3" stop-opacity="0"/></linearGradient></defs>${grid}<path d="${revenue} L${x(values.length - 1)} ${bottom} L${x(0)} ${bottom} Z" fill="url(#revenue-gradient)"/><path d="${expense}" fill="none" stroke="#8abce2" stroke-width="2.7" stroke-linecap="round"/><path d="${revenue}" fill="none" stroke="#b5edb3" stroke-width="3.2" stroke-linecap="round"/>${values.map((p,i) => `<circle cx="${x(i)}" cy="${y(p.revenueCents)}" r="3.2" fill="#b5edb3"/>`).join("")}<text x="${left}" y="228" fill="#829b99" font-size="11">${dateDisplay(values[0].date)}</text><text x="${right}" y="228" fill="#829b99" font-size="11" text-anchor="end">${dateDisplay(values.at(-1).date)}</text></svg>`;
  }
  function cafeRow(cafe, showButton = true) {
    const last = cafe.lastWeek;
    const profit = last?.netProfitCents || 0;
    return `<tr><td><div class="name-cell"><strong>${escaped(cafe.district)}</strong><small>${escaped(CITIES[cafe.cityId].name)}, ${CITIES[cafe.cityId].state} ${cafe.id === "cafe-1" ? "· Flagship" : ""}</small></div></td>
      <td>${cafe.staff}</td><td>${money(cafe.rentCents)}</td><td>${whole(last?.unitsSold || 0)}</td>
      <td>${money(last?.revenueCents || 0)}</td><td class="${profit < 0 ? "negative" : profit > 0 ? "positive" : ""}">${money(profit)}</td>
      <td>${showButton ? `<button class="btn subtle" data-manage="${cafe.id}">Manage →</button>` : "—"}</td></tr>`;
  }
  function renderDashboard() {
    const last = game.company.lastWeek, life = game.company.lifetime;
    const revenue = last?.revenueCents || 0, expenses = last?.operatingExpenseCents || 0, profit = last?.netProfitCents || 0;
    const alertHtml = game.notices.length ? `<div class="notice warning"><strong>Operational alerts</strong><div>${game.notices.slice(0,6).map(escaped).join("<br>")}${game.notices.length > 6 ? `<br>+ ${game.notices.length - 6} more location alerts` : ""}</div></div>` : "";
    const sales = PRODUCT_IDS.map(id => {
      const sold = game.cafes.reduce((sum,c) => sum + (c.lastWeek?.products?.[id]?.sold || 0), 0);
      const max = Math.max(1, ...PRODUCT_IDS.map(pid => game.cafes.reduce((sum,c) => sum + (c.lastWeek?.products?.[pid]?.sold || 0),0)));
      return `<div class="product-row"><div><div class="product-name">${PRODUCTS[id].name}</div><div class="bar"><div style="width:${sold/max*100}%"></div></div></div><div class="value">${whole(sold)} <span class="muted">sold</span></div></div>`;
    }).join("");
    return `
      <div class="kpis">
        ${kpi("Corporate cash", money(game.company.cashCents), "Shared treasury across all stores", "＄", game.company.cashCents < 0 ? "negative" : "")}
        ${kpi("Weekly revenue", money(revenue), `${whole(last?.unitsSold || 0)} cups sold · ${game.cafes.length} locations`, "↗")}
        ${kpi("Operating expenses", money(expenses), `Including HQ, HR and promotion`, "▤")}
        ${kpi("Net weekly profit", money(profit), revenue ? `${percentage(profit / revenue)} net margin` : "No settled week yet", "✦", profit > 0 ? "positive" : profit < 0 ? "negative" : "")}
      </div>${alertHtml}
      <div class="metrics-strip"><div><small>STORES OPEN</small><strong>${game.cafes.length}</strong></div><div><small>ACTIVE CITIES</small><strong>${getCitiesOwned()} / ${CITY_IDS.length}</strong></div><div><small>TOTAL STAFF</small><strong>${whole(game.cafes.reduce((sum,c) => sum + c.staff,0))}</strong></div><div><small>LIFETIME REVENUE</small><strong>${compactMoney(life.revenueCents)}</strong></div></div>
      <div class="corporate-strip">
       <button data-go="headquarters" class="corporate-tile"><span>HEADQUARTERS</span><strong>${escaped(HQ_TIERS[game.company.hqTier].name)}</strong><small>Review strategy →</small></button>
       <button data-go="marketing" class="corporate-tile"><span>BRAND REPUTATION</span><strong>${game.company.brand.reputation.toFixed(1)} / 100</strong><small>${game.company.brand.campaigns.length} active campaigns →</small></button>
       <button data-go="finance" class="corporate-tile"><span>OUTSTANDING DEBT</span><strong>${compactMoney(outstandingDebt(game))}</strong><small>${percentage(game.company.finance.founderOwnership)} founder ownership →</small></button>
       <button data-go="people" class="corporate-tile"><span>AVG TEAM MORALE</span><strong>${(game.cafes.reduce((s,c) => s+c.team.morale,0)/game.cafes.length).toFixed(1)} / 100</strong><small>View workforce →</small></button>
      </div>
      <div class="grid-main"><section class="panel"><div class="panel-head"><div><h2>Company financial performance</h2><p>Consolidated revenue and expenses · most recent 16 weeks</p></div><span class="pill neutral">${life.weeks} weeks</span></div>${chartSvg(game.company.history)}<div class="legend"><span><span class="dot"></span>Revenue</span><span><span class="dot blue"></span>Expenses</span></div></section>
      <section class="panel"><div class="panel-head"><div><h2>Corporate ledger</h2><p>All cafes, combined</p></div><span class="pill">${game.cafes.length} stores</span></div><div class="stat-list">
        ${stat("This week's rent", money(last?.rentCents || 0))}
        ${stat("This week's payroll", money(last?.salaryCents || 0))}
        ${stat("Cleaning & loyalty programs", money(last?.facilityCents || 0))}
        ${stat("This week's procurement", money(last?.procurementCents || 0))}
        ${stat("Marketing and HQ", money((last?.marketingExpenseCents || 0)+(last?.hqExpenseCents || 0)))}
        ${stat("Staff development", money(last?.staffDevelopmentCents || 0))}
        ${stat("Sourcing + delivery protection", money(last?.supplierExpenseCents || 0))}
        ${stat("Research & development", money(last?.researchExpenseCents || 0))}
        ${stat("Auction withdrawal fees", money(last?.auctionFeeExpenseCents || 0))}
        ${stat("Open property-bid escrow", money(Object.values(game.estate.lots).reduce((total,lot)=>total+(lot.auction?.escrowCents||0),0)))}
        ${stat("Loan interest (financing)", money(last?.financeExpenseCents || 0))}
        ${stat("Loan principal paid (cash flow)", money(last?.principalPaidCents || 0))}
        ${stat("Unfilled demand · stock", whole(last?.lostStock || 0))}
        ${stat("Unfilled demand · capacity", whole(last?.lostCapacity || 0))}
        ${stat("Lifetime net profit", money(life.netProfitCents), life.netProfitCents < 0 ? "negative" : "positive")}
        ${stat("Total capital invested", money(life.capitalExpenditureCents))}
      </div></section></div>
      <section class="panel" style="margin-bottom:18px"><div class="panel-head"><div><h2>Your cafe portfolio</h2><p>Compare all locations using their most recently settled week</p></div><button class="btn primary" data-go="locations">+ Expand portfolio</button></div>
        <div class="table-wrap"><table class="portfolio-table"><thead><tr><th>Location</th><th>Staff</th><th>Weekly rent</th><th>Cups sold</th><th>Revenue</th><th>Net profit</th><th></th></tr></thead><tbody>${game.cafes.map(c => cafeRow(c)).join("")}</tbody></table></div></section>
      <div class="bottom-grid"><section class="panel"><div class="panel-head"><div><h2>Sales mix</h2><p>Cups sold across all cafes last week</p></div></div>${sales}</section><section class="panel"><div class="panel-head"><div><h2>Growth snapshot</h2><p>Invest in profitable markets while protecting cash flow</p></div></div>
        <div class="stat-list">${stat("Lifetime cups served", whole(life.unitsSold))}${stat("Cumulative sales", money(life.revenueCents))}${stat("Cumulative operating expenses", money(life.operatingExpenseCents))}${stat("Total capital spending", money(life.capitalExpenditureCents))}${stat("Founder's share", percentage(game.company.finance.founderOwnership))}</div>
        <button class="btn" data-go="markets" style="margin-top:17px">Explore market intelligence →</button></section></div>`;
  }
  function renderLocations() {
    const inCity = listing => listingFilter === "all" || listing.cityId === listingFilter;
    const cityFilter = `<label class="select-label"><span>CITY FILTER</span><select id="listing-city"><option value="all">All markets</option>${CITY_IDS.map(id => `<option value="${id}" ${listingFilter === id ? "selected" : ""}>${CITIES[id].name}, ${CITIES[id].state}</option>`).join("")}</select></label>`;
    const cityIntro = listingFilter === "all" ? "Acquire the property, fund your opening inventory, and begin trading next week." : CITIES[listingFilter].tagline;
    const cards = LISTINGS.filter(inCity).map(l => {
      const owned = game.cafes.some(c => c.listingId === l.id), city = CITIES[l.cityId];
      const total = listingPrice(l), market = game.market[l.cityId];
      return `<article class="property-card ${owned ? "owned" : ""}"><div class="property-top"><span class="small-caps">${escaped(l.type)}</span><span class="pill ${owned ? "" : "neutral"}">${owned ? "OPERATING" : `${city.name}, ${city.state}`}</span></div>
      <div class="property-icon" aria-hidden="true">⌂</div><h3>${escaped(l.district)}</h3><p>${escaped(city.tagline)}</p>
      <div class="property-stats"><div><span>Foot traffic</span><strong>${l.footfall.toFixed(2)}×</strong></div><div><span>Rent / week</span><strong>${money(l.rentCents)}</strong></div><div><span>Starting staff</span><strong>${l.staff} people</strong></div><div><span>Rival pressure</span><strong>${percentage(market.competitorPressure)}</strong></div></div>
      <div class="property-financial"><span>Total opening cash</span><strong>${money(total)}</strong><small>${money(l.buildoutCents)} buildout + ${money(STARTER_STOCK_COST)} opening stock</small></div>
      <button class="btn ${owned ? "subtle" : "primary"} property-action" ${owned ? `data-open-owned="${l.id}"` : `data-acquire="${l.id}" ${game.company.cashCents < total ? "disabled" : ""}`}>${owned ? "Manage this cafe →" : game.company.cashCents < total ? "Insufficient cash" : "Open this location →"}</button></article>`;
    }).join("");
    return `<div class="section-heading market-list-heading"><div><h2>Operating portfolio</h2><span class="section-note">${game.cafes.length} active locations in ${getCitiesOwned()} cities</span></div></div>
      <div class="location-summary">${game.cafes.map(cafe => `<button class="location-tile ${game.selectedCafeId === cafe.id ? "selected" : ""}" data-manage="${cafe.id}"><span class="small-caps">${escaped(CITIES[cafe.cityId].name)}${cafe.id === "cafe-1" ? " · FLAGSHIP" : ""}</span><strong>${escaped(cafe.district)}</strong><span class="tile-footer">${money(cafe.lastWeek?.netProfitCents || 0)} last profit <span>Manage →</span></span></button>`).join("")}</div>
      <div class="section-heading market-list-heading" style="margin-top:29px"><div><h2>Property marketplace</h2><span class="section-note">${cityIntro} Each listed storefront can open only once.</span></div>${cityFilter}</div>
      <div class="notice"><strong>Acquisition economics:</strong> Buildout is a capital investment. Opening inventory is charged immediately to company cash and recorded as a procurement expense in the new cafe's first settled week. Each new location gets its own staff, menu, equipment and stock, but shares the corporate treasury. Competition and nearby company cafes affect local demand.</div>
      <div class="property-grid">${cards}</div>`;
  }
  function renderOperations() {
    const cafe = getCafe(game), equipment = EQUIPMENT[cafe.equipmentTier], next = EQUIPMENT[cafe.equipmentTier + 1];
    const last = cafe.lastWeek, market = game.market[cafe.cityId];
    const products = PRODUCT_IDS.map(id => {
      const item = cafe.menu[id], p = PRODUCTS[id];
      const locked = id==='coldBrew' ? !hasResearch(game,'coldBrew') :
        !['drip','latte','espresso'].includes(id) && !game.company.empire.portfolio.unlocked.includes(id);
      return `<tr><td class="name-cell"><strong>${p.name}</strong><small>${locked?"Locked · Develop in product studio":`Last week: ${whole(last?.products?.[id]?.sold || 0)} sold`}</small></td>
        <td><input aria-label="${p.name} price" type="number" min="0.50" max="25" step="0.05" class="num" ${locked?"disabled":""} data-price="${id}" value="${(item.priceCents/100).toFixed(2)}"></td>
        <td><input aria-label="${p.name} demand weight" type="number" min="0.5" max="2" step="0.05" class="num narrow" ${locked?"disabled":""} data-weight="${id}" value="${item.demandWeight}"></td>
        <td><input aria-label="${p.name} coffee beans grams" type="number" min="5" max="40" step="1" class="num narrow" ${locked?"disabled":""} data-recipe="${id}" data-field="beansGrams" value="${item.recipe.beansGrams}"></td>
        <td><input aria-label="${p.name} milk ml" type="number" min="0" max="400" step="5" class="num narrow" ${locked?"disabled":""} data-recipe="${id}" data-field="milkMl" value="${item.recipe.milkMl}"></td>
        <td><input aria-label="${p.name} sugar grams" type="number" min="0" max="25" step="1" class="num narrow" ${locked?"disabled":""} data-recipe="${id}" data-field="sugarGrams" value="${item.recipe.sugarGrams}"></td></tr>`;
    }).join("");
    const sources = game.cafes.filter(c => c.id !== cafe.id);
    return `<div class="branch-banner"><div><div class="eyebrow">OPERATING LOCATION</div><h2>${escaped(cafe.district)} <span class="muted">/ ${escaped(CITIES[cafe.cityId].name)}</span></h2><p>Local market ${percentage(market.level)} · ${sameCityCount(cafe.cityId)} company cafes in city · ${cafe.id === "cafe-1" ? "Flagship" : `Opened in week ${cafe.openedWeek}`}</p></div>${branchSelect()}</div>
    <div class="panel-grid"><section class="panel"><div class="panel-head"><div><h2>Staffing & payroll</h2><p>Base wage ${money(SALARY_CENTS)} per employee; team policies and managers may add costs.</p></div><span class="pill neutral">${cafe.staff} employees</span></div>
      <div class="metric-large">${money(totalWeeklyPayroll(cafe))}<span class="muted" style="font-size:13px;font-weight:500"> / week</span></div>
      <div class="details-list"><div><span>Staff service capacity</span><strong>${whole(teamCapacity(cafe))} cups</strong></div><div><span>Combined bottleneck capacity</span><strong>${whole(Math.min(teamCapacity(cafe),equipment.capacity))} cups</strong></div><div><span>Weekly rent</span><strong>${money(cafe.rentCents)}</strong></div><div><span>Last week's sales</span><strong>${whole(last?.unitsSold || 0)} cups</strong></div></div>
      <div class="btn-row"><button class="btn primary" data-staff="hire" ${cafe.staff >= 25 ? "disabled" : ""}>+ Hire employee</button><button class="btn" data-staff="fire" ${cafe.staff <= 1 ? "disabled" : ""}>− Fire employee</button></div></section>
    <section class="panel"><div class="panel-head"><div><h2>Brewing equipment</h2><p>Upgrades improve drink quality and maximum production.</p></div><span class="pill neutral">Tier ${cafe.equipmentTier + 1} / ${EQUIPMENT.length}</span></div>
      <div class="subheading" style="font-size:20px">${equipment.name}</div><p class="help">${equipment.description}</p><div class="details-list"><div><span>Equipment throughput</span><strong>${whole(equipment.capacity)} cups / week</strong></div><div><span>Quality multiplier</span><strong>${equipment.quality.toFixed(2)}×</strong></div></div>
      ${next ? `<div class="notice"><strong>Next: ${next.name}</strong><br>Capacity: ${whole(next.capacity)} cups · Quality: ${next.quality.toFixed(2)}×</div><button class="btn primary" data-upgrade ${game.company.cashCents < next.costCents ? "disabled" : ""}>Upgrade · ${money(next.costCents)}</button>` : `<div class="notice"><strong>Top tier unlocked.</strong> This location has reached the highest brewing tier.</div>`}</section></div>
    <section class="panel"><div class="panel-head"><div><h2>Location menu & recipe lab</h2><p>Changes apply to this cafe next week. Each sale consumes one cup and the configured ingredients.</p></div><span class="pill neutral">${PRODUCT_IDS.filter(id=>id!=="coldBrew"||hasResearch(game,"coldBrew")).filter(id=>["drip","latte","espresso","coldBrew"].includes(id)||game.company.empire.portfolio.unlocked.includes(id)).length} products</span></div>
      <div class="table-wrap"><table><thead><tr><th>Product</th><th>Price ($)</th><th>Local demand ×</th><th>Beans (g)</th><th>Milk (mL)</th><th>Sugar (g)</th></tr></thead><tbody>${products}</tbody></table></div>
      ${sources.length ? `<div class="inline-tools"><p class="help">Corporate menu template: copy prices and recipes from another location, preserving this cafe's local demand weights.</p><div class="controls"><select id="menu-source" aria-label="Source location for menu copy">${sources.map(c => `<option value="${c.id}">${escaped(cafeName(c))}</option>`).join("")}</select><button class="btn" data-copy-menu>Copy menu settings</button></div></div>` : ""}
      <p class="help" style="margin:15px 0 0">Menu prices respond to city purchasing power, localized preferences and competition. Better recipes and machines increase effective willingness to pay.</p>
    </section>`;
  }
  function renderSupply() {
    const cafe = getCafe(game);
    const cards = INGREDIENT_KEYS.map(key => {
      const item = INGREDIENTS[key], stock = cafe.inventory[key];
      const threshold = cafe.supply.thresholds[key], target = cafe.supply.targets[key], low = stock < threshold;
      return `<article class="panel"><div class="supply-item-head"><div><div class="small-caps">LOCAL INVENTORY</div><h2 style="font-size:17px;margin:9px 0 0">${item.name}</h2></div><span class="pill ${low ? "warning" : "neutral"}">${low ? "Low stock" : "In stock"}</span></div>
      <div class="inventory-number">${qty(stock,item.decimals)}</div><div class="inventory-unit">${item.unit} available · target ${qty(target,item.decimals)} ${item.unit}</div>
      <div class="bar" style="margin-top:17px;height:8px"><div style="width:${Math.min(100,stock/Math.max(target,stock,1)*100)}%;background:${low ? "var(--amber)" : "var(--accent)"}"></div></div>
      <div class="supply-inputs"><label class="input-field">RESTOCK BELOW<input class="num" type="number" min="0" max="10000" step="${key === "cups" ? 1 : .5}" data-supply-setting="thresholds" data-key="${key}" value="${threshold}"></label>
      <label class="input-field">RESTOCK TO<input class="num" type="number" min="0" max="10000" step="${key === "cups" ? 1 : .5}" data-supply-setting="targets" data-key="${key}" value="${target}"></label></div>
      <div class="btn-row" style="justify-content:space-between;align-items:center"><span class="help">Pack: +${item.packQuantity} ${item.unit}</span><button class="btn primary" data-buy="${key}" ${game.company.cashCents < procurementPackPrice(game,key,cafe) ? "disabled" : ""}>Buy · ${money(procurementPackPrice(game,key,cafe))}</button></div></article>`;
    }).join("");
    const pendingAll = sumField(game.cafes,"pendingManualExpenseCents");
    return `<div class="branch-banner"><div><div class="eyebrow">LOCATION SUPPLY CHAIN</div><h2>${escaped(cafe.district)} <span class="muted">/ ${escaped(CITIES[cafe.cityId].name)}</span></h2><p>Supply is held per cafe. Every location draws procurement money from the shared treasury.</p></div>${branchSelect()}</div>
      <section class="panel" style="margin-bottom:18px"><div class="switch-row"><div><h2 style="font-size:17px;margin-bottom:8px">Automatic restocking</h2><p class="help" style="margin:0;max-width:650px">At weekly close, refill only ingredients below their threshold. Full packs are purchased toward targets using a fair, alternating allocation across all locations, subject to cash availability.</p></div><label class="switch" aria-label="Enable automatic restocking for this cafe"><input id="auto-restock" type="checkbox" ${cafe.supply.autoRestock ? "checked" : ""}><span class="switch-track"></span></label></div></section>
      <div class="supply-grid">${cards}</div>
      <section class="panel"><div class="panel-head"><div><h2>Procurement accounting</h2><p>Purchases withdraw corporate cash immediately, then appear in that store's next weekly cash-basis P&L.</p></div></div><div class="stat-list">
      ${stat("Corporate cash", money(game.company.cashCents))}${stat("This store's pending purchases", money(cafe.pendingManualExpenseCents))}${stat("All stores' pending purchases", money(pendingAll))}${stat("This store's last auto orders", money(cafe.lastWeek?.autoStockCents || 0))}${stat("All stores' last procurement", money(game.company.lastWeek?.procurementCents || 0))}</div></section>`;
  }
  function marketFactorDescription(market, city) {
    const pressure = market.competitorPressure;
    return pressure >= city.competitionBase + .09 ? "Intense" : pressure <= city.competitionBase - .09 ? "Calm" : "Balanced";
  }
  function renderMarkets() {
    const marketCards = CITY_IDS.map(id => {
      const city = CITIES[id], m = game.market[id], own = game.cafes.filter(c => c.cityId === id);
      const weekSales = sumField(own.map(c => c.lastWeek || { revenueCents:0 }),"revenueCents");
      const demandLabels = PRODUCT_IDS.map(pid => `<div class="market-tendency"><span>${PRODUCTS[pid].name}</span><div class="bar"><div style="width:${clamp((city.preferences[pid] ?? 1) / 1.4 * 100,0,100)}%"></div></div><strong>${(city.preferences[pid] ?? 1).toFixed(2)}×</strong></div>`).join("");
      return `<article class="panel market-card"><div class="market-card-header"><div><span class="small-caps">${city.state} · REGIONAL MARKET</span><h2>${city.name}</h2></div><span class="pill ${own.length ? "" : "neutral"}">${own.length ? `${own.length} ${own.length===1?"cafe":"cafes"}` : "Not entered"}</span></div><p class="help">${escaped(city.tagline)}</p>
      <div class="market-numbers"><div><span>Consumer demand</span><strong>${percentage(m.level)}</strong></div><div><span>Rival pressure</span><strong>${percentage(m.competitorPressure)}</strong></div><div><span>Local price index</span><strong>${city.priceIndex.toFixed(2)}×</strong></div><div><span>Competition</span><strong>${marketFactorDescription(m,city)}</strong></div></div>
      <div class="market-divider"></div><div class="small-caps">LOCAL MENU PREFERENCES</div>${demandLabels}
      <div class="market-divider"></div><div class="small-caps">SIMULATED COMPETITORS</div><div class="rival-tags">${game.rivals[id].map(rival => `<span>${escaped(rival.name)} · ${rival.stores} stores</span>`).join("")}</div>
      <p class="help">Your modeled market share: <strong class="positive">${percentage(localMarketShare(game,id))}</strong> · City brand awareness: ${game.company.brand.awareness[id].toFixed(1)} / 100</p>
      <div class="market-bottom"><span>${own.length ? `${money(weekSales)} in last week's revenue` : "Ready for expansion"}</span><button class="btn subtle" data-filter-city="${id}">${own.length ? "View properties" : "Enter market"} →</button></div>
      </article>`;
    }).join("");
    return `<div class="notice"><strong>Regional intelligence:</strong> Every city has its own fluctuating consumer demand and competitive pressure, plus different price tolerance and drink preferences. Rival chains expand or contract quarterly; brands and numbers are entirely fictional. Your nearby cafes partially cannibalize demand; this prevents unlimited free growth from opening next door.</div>
      <div class="market-grid">${marketCards}</div><div class="notice" style="margin-top:18px"><strong>Demand model transparency:</strong> Units depend on base product demand × city traffic × district footfall × local preferences × seasonality × city demand × quality × price elasticity × competitor response × same-city overlap × small random variation. Staffing, equipment and available ingredients cap actual sales.</div>`;
  }
  const levelDot = (value, low=35, high=70) => `<span class="pill ${value < low ? "warning" : value >= high ? "" : "neutral"}">${value >= high ? "Strong" : value < low ? "At risk" : "Developing"}</span>`;
  const progressMeter = (value, max=100) => `<div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${clamp(value,0,max)}" style="height:9px;margin-top:8px"><div style="width:${clamp(value/max*100,0,100)}%"></div></div>`;
  function renderHeadquarters() {
    const hq = HQ_TIERS[game.company.hqTier];
    const next = HQ_TIERS[game.company.hqTier + 1];
    const latest = game.company.lastWeek;
    const yearly = hq.weeklyCents * 52;
    const news = game.news.slice(0,5).map(item => `<div class="feed-item"><span>W${item.week}</span><strong>${escaped(item.description)}</strong></div>`).join("") || `<p class="help">No major market moves yet. Rivals reconsider their networks every 13 weeks.</p>`;
    return `<div class="branch-banner"><div><div class="eyebrow">CORPORATE OFFICE</div><h2>${escaped(game.company.name)}</h2><p>Company strategy, leadership, purchasing power, brand health and capital allocation.</p></div><span class="pill">TIER ${game.company.hqTier + 1} / ${HQ_TIERS.length}</span></div>
      <div class="strategy-grid"><section class="panel"><div class="panel-head"><div><h2>Corporate identity</h2><p>A unique company identity across the entire network</p></div></div><label class="input-field wide-field">COMPANY NAME<input id="company-name" aria-label="Company name" class="num text-input" maxlength="44" value="${escaped(game.company.name)}" /></label><p class="help">Renaming is free and affects your dashboard and headquarters.</p>
      <div class="details-list">${stat("Operating locations", String(game.cafes.length))}${stat("Cities entered", `${getCitiesOwned()} of ${CITY_IDS.length}`)}${stat("Founder equity", percentage(game.company.finance.founderOwnership))}${stat("Corporate cash", money(game.company.cashCents))}</div></section>
      <section class="panel"><div class="panel-head"><div><h2>Current headquarters</h2><p>${escaped(hq.description)}</p></div></div><h3 class="big-tier">${escaped(hq.name)}</h3><div class="details-list">${stat("Administration / week", money(hq.weeklyCents))}${stat("Estimated annual overhead", money(yearly))}${stat("Ingredient purchasing discount", percentage(hq.procurementDiscount))}${stat("Additional brand multiplier", `+${percentage(hq.brandBonus)}`)}${stat("Base credit limit", money(hq.creditLimitCents))}</div></section></div>
      <section class="panel" style="margin-bottom:18px"><div class="panel-head"><div><h2>Office expansion</h2><p>A capital improvement—purchase price is not an operating expense; weekly overhead is.</p></div><span class="pill neutral">Capital allocation</span></div>${next ? `<div class="upgrade-row"><div><h3>${escaped(next.name)}</h3><p class="help">${escaped(next.description)}</p><div class="rival-tags"><span>Procurement −${percentage(next.procurementDiscount)}</span><span>Brand +${percentage(next.brandBonus)}</span><span>Overhead ${money(next.weeklyCents)} / week</span><span>Credit ${money(next.creditLimitCents)}</span></div></div><button class="btn primary" data-hq-upgrade ${game.company.cashCents < next.upgradeCents ? "disabled" : ""}>Upgrade · ${money(next.upgradeCents)}</button></div>` : `<div class="notice"><strong>Maximum headquarters tier reached.</strong> Your group has the strongest corporate infrastructure currently available.</div>`}</section>
      <div class="strategy-grid"><section class="panel"><div class="panel-head"><div><h2>Brand pulse</h2><p>Customer experience creates long-term value</p></div><button class="btn subtle" data-go="marketing">Marketing →</button></div><div class="metric-large">${game.company.brand.reputation.toFixed(1)} <small class="muted">/ 100</small></div>${progressMeter(game.company.brand.reputation)}<div class="details-list">${stat("Network-wide promotions", String(game.company.brand.campaigns.length))}${stat("HQ awareness boost", `+${percentage(hq.brandBonus)}`)}${stat("Last week's cups", whole(latest?.unitsSold || 0))}</div></section>
      <section class="panel"><div class="panel-head"><div><h2>Industry newswire</h2><p>Quarterly rival openings and closures</p></div><button class="btn subtle" data-go="rivals">Competitors →</button></div><div class="feed">${news}</div></section></div>`;
  }
  function renderFinance() {
    const finance = game.company.finance, debt = outstandingDebt(game), credit = loanCreditLimit(game), valuation = estimatedEquityValuation(game);
    const remaining = credit - debt, term26 = loanPayment(2500000, 26, LOAN_TERMS[26]);
    const loans = finance.loans.filter(l => l.balanceCents > 0);
    const loanRows = loans.map(loan => `<tr><td><div class="name-cell"><strong>${escaped(loan.id)}</strong><small>${loan.termWeeks}-week term · borrowed W${loan.borrowedWeek}</small></div></td><td>${money(loan.originalCents)}</td><td>${money(loan.balanceCents)}</td><td>${percentage(loan.apr)}</td><td>${money(loan.weeklyPaymentCents)}</td><td>${loan.weeksRemaining}</td><td><button class="btn subtle" data-payoff="${loan.id}" ${game.company.cashCents < loan.balanceCents ? "disabled" : ""}>Pay off</button></td></tr>`).join("");
    const investorRows = finance.investors.map(inv => `<tr><td><strong>${escaped(inv.name)}</strong></td><td>${money(inv.investedCents)}</td><td>${percentage(inv.stake)}</td><td>${money(inv.valuationCents)}</td><td>W${inv.week}</td></tr>`).join("");
    const equityCards = EQUITY_OFFERS.map(amount => {
      const resulting = finance.founderOwnership * valuation / (valuation + amount), allowed = resulting >= .51 - 1e-9 &&
        game.time.week - finance.lastRaiseWeek >= 12 && finance.investors.length < 5;
      return `<article class="offer-card"><span class="small-caps">PRIVATE EQUITY ROUND</span><strong>${compactMoney(amount)}</strong><small>Implied new stake: ${percentage(1-valuation/(valuation+amount))}</small><small>Founder afterward: ${percentage(resulting)}</small><button class="btn primary" data-equity="${amount}" ${allowed ? "" : "disabled"}>Accept investment</button></article>`;
    }).join("");
    return `<div class="kpis">${kpi("Corporate cash", money(game.company.cashCents), "Available treasury", "＄")}${kpi("Bank debt", money(debt), `${loans.length} outstanding loans`, "▤")}${kpi("Business valuation", compactMoney(valuation), "Game-defined pre-money estimate", "◇")}${kpi("Founder ownership", percentage(finance.founderOwnership), "Fully diluted cap table", "◎")}</div>
      <div class="strategy-grid"><section class="panel"><div class="panel-head"><div><h2>Business banking</h2><p>Borrow on fixed amortizing terms; no borrowing counts as revenue.</p></div><span class="pill neutral">${money(remaining)} capacity</span></div><div class="details-list">${stat("Current borrowing limit", money(credit))}${stat("Outstanding principal", money(debt))}${stat("Remaining credit", money(remaining))}${stat("Interest paid to date", money(finance.interestPaidCents))}${stat("Principal paid to date", money(finance.principalRepaidCents))}</div>
      <label class="input-field">LOAN TERM<select id="loan-term" aria-label="Loan term"><option value="26">26 weeks · 11.0% APR</option><option value="52">52 weeks · 14.5% APR</option></select></label>
      <div class="btn-row">${LOAN_AMOUNTS.map(amount => `<button class="btn ${amount<=remaining ? "primary" : ""}" data-borrow="${amount}" ${amount > remaining ? "disabled" : ""}>Borrow ${compactMoney(amount)}</button>`).join("")}</div><p class="help">For example, a ${money(2500000)} loan over 26 weeks repays roughly ${money(term26)} per week, including declining interest. Payments settle before inventory restocking.</p></section>
      <section class="panel"><div class="panel-head"><div><h2>Ownership & board</h2><p>Equity funding is permanent ownership dilution, not debt or profit.</p></div>${levelDot(finance.boardConfidence,35,70)}</div><div class="metric-large">${percentage(finance.founderOwnership)}</div>${progressMeter(finance.founderOwnership*100)}<div class="details-list">${stat("External shareholder ownership", percentage(1-finance.founderOwnership))}${stat("Equity raised", money(finance.externalCapitalRaisedCents))}${stat("Board confidence", `${finance.boardConfidence.toFixed(0)} / 100`)}${stat("Cumulative distributions", money(finance.dividendsPaidCents))}</div><label class="input-field">PROFIT DISTRIBUTION POLICY<select id="dividend-rate" aria-label="Profit distribution policy">${DIVIDEND_RATES.map(rate => `<option value="${rate}" ${finance.dividendRate===rate?"selected":""}>${Math.round(rate*100)}% of positive weekly net profit</option>`).join("")}</select></label><p class="help">Distributions are capped by available cash above a $3,000 reserve. They reduce cash, not accounting profit, and are shared among shareholders.</p></section></div>
      <section class="panel" style="margin-bottom:18px"><div class="panel-head"><div><h2>Outstanding loans</h2><p>Amortizing balance, fixed scheduled payment and remaining term</p></div></div>${loans.length ? `<div class="table-wrap"><table class="portfolio-table"><thead><tr><th>Loan</th><th>Original</th><th>Principal left</th><th>APR</th><th>Weekly payment</th><th>Weeks left</th><th></th></tr></thead><tbody>${loanRows}</tbody></table></div>` : `<div class="notice">You have no outstanding bank loans.</div>`}</section>
      <section class="panel" style="margin-bottom:18px"><div class="panel-head"><div><h2>Private investment offers</h2><p>New funds issue shares at the displayed game valuation. Existing holders dilute proportionally.</p></div></div><div class="offer-grid">${equityCards}</div>${game.time.week - finance.lastRaiseWeek < 12 ? `<p class="help">Next eligible investment round: week ${finance.lastRaiseWeek+12}.</p>` : ""}<p class="help">Founder ownership must remain at least 51%; new equity does not require repayment. This is a fictional valuation model, not investment advice.</p></section>
      <section class="panel"><div class="panel-head"><div><h2>Capitalization table</h2><p>Ownership interests include subsequent-round dilution</p></div></div><div class="table-wrap"><table class="portfolio-table"><thead><tr><th>Shareholder</th><th>Cash invested</th><th>Ownership</th><th>Entry pre-money</th><th>Entry week</th></tr></thead><tbody><tr><td><strong>Founder</strong></td><td>—</td><td>${percentage(finance.founderOwnership)}</td><td>—</td><td>1</td></tr>${investorRows}</tbody></table></div></section>
      <section class="notice" style="margin-top:18px"><strong>Accounting:</strong> Loans and equity sales add cash but never revenue. Loan principal repayments and dividend distributions reduce cash but are not expenses. Interest reduces net profit; marketing, payroll, office overhead and training reduce operating profit. Purchases of equipment and properties are capitalized as investments.</section>`;
  }
  function renderPeople() {
    const cafe = getCafe(game), team = cafe.team, trainingCost = cafe.staff * 55000 * (team.trainingLevel + 1);
    const weekly = totalWeeklyPayroll(cafe);
    const rows = game.cafes.map(c => `<tr><td><div class="name-cell"><strong>${escaped(c.district)}</strong><small>${escaped(CITIES[c.cityId].name)}</small></div></td><td>${c.staff}${c.team.managerHired ? " + manager" : ""}</td><td>${money(totalWeeklyPayroll(c))}</td><td>${c.team.morale.toFixed(1)} / 100</td><td>Level ${c.team.trainingLevel}</td><td><button data-manage-people="${c.id}" class="btn subtle">Manage</button></td></tr>`).join("");
    return `<div class="branch-banner"><div><div class="eyebrow">HUMAN RESOURCES</div><h2>${escaped(cafe.district)} <span class="muted">/ ${escaped(CITIES[cafe.cityId].name)}</span></h2><p>Manage baristas, compensation, training, morale and local management.</p></div>${branchSelect()}</div>
      <div class="kpis">${kpi("Team morale", `${team.morale.toFixed(1)} / 100`, "Changes with workload, service and policies", "♡")}${kpi("Weekly payroll", money(weekly), "Includes baristas and managers", "＄")}${kpi("Service capacity", whole(Math.min(teamCapacity(cafe),EQUIPMENT[cafe.equipmentTier].capacity)), "Cups per week", "◷")}${kpi("Training level", `${team.trainingLevel} / ${STAFF_TRAINING_MAX}`, "Permanent location-wide productivity boost", "✦")}</div>
      <div class="strategy-grid"><section class="panel"><div class="panel-head"><div><h2>Barista workforce</h2><p>${cafe.staff} employees · base salary ${money(SALARY_CENTS)} per person, per week</p></div>${levelDot(team.morale)}</div>${progressMeter(team.morale)}<div class="details-list">${stat("Scheduled barista payroll", money(cafe.staff*(SALARY_CENTS+team.wagePremiumCents)))}${stat("Manager payroll", money(team.managerHired?MANAGER_WEEKLY_CENTS:0))}${stat("Historical resignations", String(team.attritionCount))}${stat("Last week's lost capacity", whole(cafe.lastWeek?.lostCapacity||0))}</div><div class="btn-row"><button class="btn primary" data-staff="hire" ${cafe.staff>=25?"disabled":""}>+ Hire barista</button><button class="btn" data-staff="fire" ${cafe.staff<=1?"disabled":""}>− Fire barista</button></div></section>
      <section class="panel"><div class="panel-head"><div><h2>Compensation & retention</h2><p>Pay premiums can support morale without guaranteeing higher demand.</p></div></div><label class="input-field">WEEKLY PREMIUM PER BARISTA<select id="wage-premium" aria-label="Barista pay premium">${WAGE_PREMIUMS.map(v => `<option value="${v}" ${team.wagePremiumCents===v?"selected":""}>${money(v)} / employee per week</option>`).join("")}</select></label><div class="details-list">${stat("Base wage per barista", money(SALARY_CENTS))}${stat("Total salary per barista", money(SALARY_CENTS+team.wagePremiumCents))}${stat("Average network morale", `${(game.cafes.reduce((s,c)=>s+c.team.morale,0)/game.cafes.length).toFixed(1)} / 100`)}</div><p class="help">Employees can leave when morale stays severely low. Hiring and firing also slightly affect team morale.</p></section></div>
      <div class="strategy-grid"><section class="panel"><div class="panel-head"><div><h2>Professional development</h2><p>Train every current team member to increase throughput and morale.</p></div><span class="pill neutral">Level ${team.trainingLevel}</span></div><div class="details-list">${stat("Training productivity lift", `+${percentage(team.trainingLevel*.065)}`)}${stat("Next program cost", team.trainingLevel < STAFF_TRAINING_MAX ? money(trainingCost) : "Completed")}${stat("Pending training expense", money(cafe.pendingStaffExpenseCents))}</div><button class="btn primary" data-train ${team.trainingLevel>=STAFF_TRAINING_MAX||game.company.cashCents<trainingCost?"disabled":""}>${team.trainingLevel>=STAFF_TRAINING_MAX?"Training completed":"Train team · "+money(trainingCost)}</button><p class="help">Training is charged to cash immediately and recognized as a staff-development expense at the next weekly close.</p></section>
      <section class="panel"><div class="panel-head"><div><h2>Store manager</h2><p>An experienced manager increases team productivity and morale.</p></div><span class="pill ${team.managerHired?"":"neutral"}">${team.managerHired?"Assigned":"Unfilled"}</span></div><div class="details-list">${stat("One-time recruitment",money(MANAGER_RECRUITING_CENTS))}${stat("Manager salary / week",money(MANAGER_WEEKLY_CENTS))}${stat("Barista productivity",team.managerHired?"+8%":"No boost")}</div><button class="btn ${team.managerHired?"subtle":"primary"}" ${team.managerHired?"data-remove-manager":"data-manager"} ${!team.managerHired&&game.company.cashCents<MANAGER_RECRUITING_CENTS?"disabled":""}>${team.managerHired?"Remove manager":"Hire manager · "+money(MANAGER_RECRUITING_CENTS)}</button></section></div>
      <section class="panel"><div class="panel-head"><div><h2>Network workforce</h2><p>Select a branch to manage its human resources</p></div></div><div class="table-wrap"><table class="portfolio-table"><thead><tr><th>Location</th><th>Employees</th><th>Weekly payroll</th><th>Morale</th><th>Training</th><th></th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
  }
  function renderMarketing() {
    const brand = game.company.brand, campaigns = brand.campaigns;
    const cityChoices = CITY_IDS.map(id=>`<option value="${id}">${CITIES[id].name}</option>`).join("");
    const channels = Object.entries(MARKETING_CHANNELS).map(([id,ch])=>`<article class="offer-card"><span class="small-caps">${id==="national"?"MULTI-MARKET":"CITY CAMPAIGN"}</span><h3>${escaped(ch.name)}</h3><strong>${compactMoney(ch.costCents)}</strong><p class="help">${escaped(ch.description)}</p><small>${ch.weeks} weeks · +${percentage(ch.lift)} active demand lift</small><small>Immediate awareness +${ch.awareness} points</small><button data-campaign="${id}" class="btn primary" ${game.company.cashCents<ch.costCents||campaigns.length>=6?"disabled":""}>Launch campaign</button></article>`).join("");
    const campaignList = campaigns.map(c => `<article class="active-campaign"><div class="market-card-header"><div><strong>${escaped(MARKETING_CHANNELS[c.channelId].name)}</strong><p class="help">${c.cityId==="all"?"All cities":CITIES[c.cityId].name} · Started W${c.launchedWeek}</p></div><span class="pill">${c.remainingWeeks} weeks left</span></div>${progressMeter(c.remainingWeeks,c.originalWeeks)}<div class="detail-inline">Lift +${percentage(c.lift)} · Spent ${money(c.costCents)}</div></article>`).join("") || `<p class="help">No active campaigns. Invest in a targeted campaign to boost local awareness and near-term sales.</p>`;
    return `<div class="kpis">${kpi("Brand reputation", `${brand.reputation.toFixed(1)} / 100`, "Built through quality, morale and fulfillment", "✦")}${kpi("Active campaigns", String(campaigns.length), "Up to 6 campaigns at once", "◈")}${kpi("Pending ad expense", money(game.company.pendingMarketingCents), "Already paid; next week's P&L", "＄")}${kpi("Average awareness", `${(CITY_IDS.reduce((s,id)=>s+brand.awareness[id],0)/CITY_IDS.length).toFixed(1)} / 100`, "Brand recognition across six cities", "◎")}</div>
      <div class="panel" style="margin-bottom:18px"><div class="panel-head"><div><h2>Launch marketing</h2><p>Campaigns increase awareness immediately and provide a demand lift for their stated duration.</p></div></div><label class="input-field" style="max-width:260px">CITY TARGET<select id="campaign-city" aria-label="Campaign target city">${cityChoices}</select></label><p class="help">City campaigns target the selected city. National campaigns target all six cities automatically.</p><div class="offer-grid">${channels}</div></div>
      <div class="strategy-grid"><section class="panel"><div class="panel-head"><div><h2>Running promotions</h2><p>Demand boosts are applied before each weekly close</p></div><span class="pill neutral">${campaigns.length} / 6 slots</span></div><div class="campaign-list">${campaignList}</div></section>
      <section class="panel"><div class="panel-head"><div><h2>Regional brand awareness</h2><p>Awareness gradually fades without continued promotion</p></div></div>${CITY_IDS.map(id=>`<div class="awareness-row"><div><strong>${CITIES[id].name}</strong><span>${brand.awareness[id].toFixed(1)} / 100</span></div>${progressMeter(brand.awareness[id])}</div>`).join("")}</section></div>
      <div class="notice"><strong>Brand economics:</strong> Marketing spend leaves cash at launch and is recognized once at the next weekly close. Active campaigns multiply demand in their target markets. Quality, in-stock fulfillment and workforce morale influence reputation; reputation and awareness influence future demand.</div>`;
  }
  function renderRivals() {
    const cards = CITY_IDS.map(id=>{
      const m=game.market[id], competitors=game.rivals[id], own=game.cafes.filter(c=>c.cityId===id), share=localMarketShare(game,id);
      return `<section class="panel market-card"><div class="market-card-header"><div><span class="small-caps">${CITIES[id].state} · INDUSTRY WATCH</span><h2>${escaped(CITIES[id].name)}</h2></div><span class="pill ${own.length?"":"neutral"}">${own.length} owned</span></div><div class="mini-stats"><div><span>Est. your share</span><strong>${percentage(share)}</strong></div><div><span>Rival stores</span><strong>${competitors.reduce((s,r)=>s+r.stores,0)}</strong></div><div><span>Rival pressure</span><strong>${percentage(m.competitorPressure)}</strong></div></div>${progressMeter(share*100)}<div class="market-divider"></div><div class="rival-stack">${competitors.map(r=>`<div class="rival-row"><div><strong>${escaped(r.name)}</strong><small>${escaped(r.latestEvent)}</small></div><div><b>${r.stores} stores</b><span>${r.momentum.toFixed(2)}× momentum</span></div></div>`).join("")}</div><div class="market-bottom"><span>${own.length?"Competing with your operating cafes":"Your company has not entered this city"}</span><button class="btn subtle" data-filter-city="${id}">Properties →</button></div></section>`;
    }).join("");
    const news = game.news.slice(0,15).map(x=>`<div class="feed-item"><span>W${x.week}</span><strong>${escaped(x.description)}</strong></div>`).join("") || `<p class="help">No quarterly network expansion or contraction has been reported yet.</p>`;
    return `<div class="notice"><strong>Competitive simulation:</strong> Each fictional rival has an independent store count and business momentum. Every 13 weeks a rival may open or close a branch; its footprint feeds market pressure and changes your potential volume. Market share is a comparative game estimate, not audited real-world data.</div><div class="market-grid">${cards}</div><section class="panel" style="margin-top:18px"><div class="panel-head"><div><h2>Industry activity</h2><p>Market events generated by the weekly simulation</p></div></div><div class="feed">${news}</div></section>`;
  }

  /* Phase 4 views. Phase 3 views remain callable and are composed below. */
  let mapCityId="nyc", focusedMapPropertyId="nyc-astoria";
  const marketStatus = lot => lot.status==="owned"?"Operating":lot.status==="rival"?"Rival-controlled":lot.status==="bidding"?"Your offer pending":"Open listing";
  function worldStats() {
    return `<div class="world-strip">
      <div class="world-stat"><small>Research completed</small><strong>${game.company.research.completed.length} / ${Object.keys(RESEARCH).length}</strong><span>${game.company.research.activeId?`Studying ${RESEARCH[game.company.research.activeId].name}`:"Ready for the next project"}</span></div>
      <div class="world-stat"><small>Property auctions</small><strong>${Object.values(game.estate.lots).filter(l=>l.status==="bidding").length}</strong><span>${game.estate.totalBidWins} won · ${game.estate.totalBidLosses} lost</span></div>
      <div class="world-stat"><small>Supplier contract</small><strong style="font-size:17px">${escaped(SUPPLIERS[game.company.sourcing.supplierId].name)}</strong><span>${game.company.sourcing.insured?"Delivery protection enabled":"Standard delivery risk"}</span></div>
      <div class="world-stat"><small>Rival networks</small><strong>${CITY_IDS.reduce((sum,id)=>sum+game.rivals[id].reduce((s,r)=>s+(r.stores>0),0),0)}</strong><span>${game.cafes.length} company cafes · ${getCitiesOwned()} regions</span></div>
    </div>`;
  }
  function renderDashboard4() {
    return worldStats()+renderDashboard()+`<div class="panel" style="margin-top:18px"><div class="panel-head"><div><h2>Plan your next move</h2><p>Every investment affects the weekly simulation and the company treasury.</p></div></div><div class="btn-row"><button data-go="customers" class="btn primary">Understand your customers →</button><button data-go="insights" class="btn">Analyze unit margins →</button><button data-go="storedesign" class="btn">Redesign a cafe →</button><button data-go="map" class="btn">Explore city maps →</button><button data-go="research" class="btn">Invest in R&D →</button><button data-go="acquisitions" class="btn">Review takeover targets →</button><button data-go="sourcing" class="btn">Negotiate suppliers →</button></div></div>`;
  }
  function renderRealEstate() {
    const inCity=l=>listingFilter==="all"||l.cityId===listingFilter;
    const filter = `<label class="select-label"><span>CITY FILTER</span><select id="listing-city"><option value="all">All cities</option>${CITY_IDS.map(id=>`<option value="${id}" ${listingFilter===id?"selected":""}>${CITIES[id].name}</option>`).join("")}</select></label>`;
    const cards=LISTINGS.filter(inCity).map(l=>{
      const lot=listingState(game,l.id), owned=game.cafes.find(c=>c.listingId===l.id);
      const now=buyNowPrice(l), min=reserveBid(l), bidding=lot.status==="bidding";
      return `<article id="property-${l.id}" class="property-card ${owned?"owned":""}"><div class="property-top"><span class="small-caps">${escaped(l.type)}</span><span class="pill ${lot.status==="rival"?"warning":lot.status==="owned"?"":"neutral"}">${marketStatus(lot)}</span></div><div class="property-icon" aria-hidden="true">⌂</div><h3>${escaped(l.district)}</h3><p>${escaped(CITIES[l.cityId].name)} · ${escaped(CITIES[l.cityId].state)} · Simulated property market</p>
        <div class="property-stats"><div><span>Foot traffic</span><strong>${l.footfall.toFixed(2)}×</strong></div><div><span>Weekly rent</span><strong>${money(l.rentCents)}</strong></div><div><span>Initial team</span><strong>${l.staff}</strong></div><div><span>Competition</span><strong>${percentage(game.market[l.cityId].competitorPressure)}</strong></div></div>
        <div class="property-financial"><span>Buy-now cash commitment</span><strong>${money(now)}</strong><small>Premium buildout ${money(now-STARTER_STOCK_COST)} + ${money(STARTER_STOCK_COST)} inventory</small></div>
        ${lot.status==="available"?`<button class="btn primary property-action" data-acquire="${l.id}" ${game.company.cashCents<now?"disabled":""}>Buy now · ${money(now)}</button><div class="field-box"><label class="small-currency" for="bid-${l.id}">Auction bid ($)<input type="number" id="bid-${l.id}" class="num" min="${min/100}" max="${l.buildoutCents*2.5/100}" step="100" value="${Math.ceil(min/10000)*100}"></label><button class="btn" data-offer-bid="${l.id}">Submit sealed bid</button></div><p class="small-currency">Minimum ${money(min)} + ${money(STARTER_STOCK_COST)} stock escrow. Resolution after 2 weekly closes; you can lose to a competing chain.</p>`:
        bidding?`<div class="auction-status"><strong>Offer pending</strong><div>Bid ${money(lot.auction.bidCents)} · ${Math.max(0,lot.auction.closeWeek-game.time.week+1)} week(s) to closing</div><div>Escrow committed: ${money(lot.auction.escrowCents)}</div></div><button class="btn subtle property-action" data-withdraw-bid="${l.id}">Withdraw offer (2% fee)</button>`:
        owned?`<button class="btn property-action" data-open-owned="${l.id}">Manage cafe →</button>`:
        `<div class="auction-status">Controlled by ${escaped(game.rivals[l.cityId].find(r=>r.id===lot.rivalId)?.name || "a competing chain")}. Acquire its parent chain to obtain the property.</div><button class="btn subtle property-action" data-go="acquisitions">View acquisition targets →</button>`}
      </article>`;
    }).join("");
    return `<div class="section-heading market-list-heading"><div><h2>Operating network</h2><span class="section-note">${game.cafes.length} cafes operating across ${getCitiesOwned()} cities</span></div><button class="btn" data-go="map">Explore interactive atlas →</button></div><div class="location-summary">${game.cafes.map(c=>`<button class="location-tile ${c.id===game.selectedCafeId?"selected":""}" data-manage="${c.id}"><span class="small-caps">${CITIES[c.cityId].name}</span><strong>${escaped(c.district)}</strong><span class="tile-footer">${money(c.lastWeek?.netProfitCents||0)} last week's net <span>Manage →</span></span></button>`).join("")}</div>
      <div class="section-heading market-list-heading" style="margin-top:30px"><div><h2>Property exchange</h2><span class="section-note">Buy instantly at a premium or bid against rival chains at a lower entry price.</span></div>${filter}</div>
      <div class="notice"><strong>Auctions:</strong> bids plus opening stock are held in escrow immediately. A competing chain submits a hidden rival bid at the close, two weekly settlements after your offer. Winning creates your cafe for the following week; losing returns escrow. Buying now skips the auction but costs more. Property costs are capital investments, not operating profit deductions.</div>
      <div class="property-grid">${cards}</div>`;
  }
  function atlasMapSvg() {
    return `<svg viewBox="0 0 1000 640" preserveAspectRatio="none" aria-hidden="true">
      <defs><linearGradient id="atlas-water" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#173f47"/><stop offset="1" stop-color="#20494a"/></linearGradient><pattern id="atlas-block" width="92" height="68" patternUnits="userSpaceOnUse" patternTransform="rotate(-12)"><path d="M 0 0 L 92 0 M 0 0 L 0 68" stroke="#476a68" stroke-opacity=".38" stroke-width="6" fill="none"/></pattern></defs>
      <rect width="1000" height="640" fill="#173339"/><path d="M0 0H1000V640H0Z" fill="url(#atlas-block)"/>
      <path d="M-60,115 C205,10 260,240 430,184 S760,80 1060,215" fill="none" stroke="url(#atlas-water)" stroke-width="85" stroke-linecap="round" opacity=".95"/>
      <path d="M85,695 Q310,385 1140,365" fill="none" stroke="#2d5251" stroke-width="68" opacity=".55"/><path d="M0 520 Q540 80 1075 520" fill="none" stroke="#4d7770" stroke-width="18" opacity=".44"/>
      <g stroke="#7b9c89" stroke-opacity=".34" stroke-width="3" fill="none"><path d="M110 0L320 640M390 0L620 640M720 0L910 640M0 360L1000 185M0 475L1000 300"/></g>
      <g fill="#bde6c4" opacity=".13"><rect x="200" y="345" width="125" height="80" rx="15"/><rect x="708" y="430" width="162" height="102" rx="17"/><rect x="590" y="65" width="120" height="96" rx="18"/></g>
      <text x="39" y="53" fill="#c0dfd4" opacity=".72" font-size="20" letter-spacing="6">DISTRICT ATLAS</text>
    </svg>`;
  }
  function renderCityMap() {
    const owned=game.cafes.filter(c=>c.cityId===mapCityId), listings=LISTINGS.filter(l=>l.cityId===mapCityId);
    const lot=LISTING_BY_ID[focusedMapPropertyId]?.cityId===mapCityId ? LISTING_BY_ID[focusedMapPropertyId] : listings[0];
    const status=listingState(game,lot.id);
    const points=listings.map((l,i)=>{
      const [x,y]=MAP_COORDS[l.id], st=listingState(game,l.id);
      return `<button class="map-lot ${st.status} ${lot.id===l.id?"selected":""}" style="left:${x}%;top:${y}%" aria-label="${escaped(l.district)}: ${marketStatus(st)}" title="${escaped(l.district)}" data-map-property="${l.id}">${i+1}</button>`;
    }).join("");
    const flag=mapCityId==="nyc"?`<button class="map-lot flagship owned" style="left:${MAP_COORDS.flagship[0]}%;top:${MAP_COORDS.flagship[1]}%" aria-label="Flatiron flagship, owned" title="Manhattan flagship" data-select-flagship="1">★</button>`:"";
    return `<div class="section-heading"><div><h2>City operations atlas</h2><span class="section-note">An abstract neighborhood map for decisions—not real street geography.</span></div><label class="select-label"><span>SELECT CITY</span><select id="map-city">${CITY_IDS.map(id=>`<option value="${id}" ${mapCityId===id?"selected":""}>${CITIES[id].name}</option>`).join("")}</select></label></div>
      <div class="map-layout"><section class="panel"><div class="panel-head"><div><h2>${CITIES[mapCityId].name} · ${CITIES[mapCityId].state}</h2><p>${escaped(CITIES[mapCityId].tagline)}</p></div><span class="pill neutral">${owned.length} company cafes</span></div><div class="city-map">${atlasMapSvg()}${flag}${points}<span class="map-caption">ILLUSTRATIVE MARKET ZONES · SELECT A MARKER</span></div><div class="map-legend"><span><i class="dot"></i> Your cafe</span><span><i class="dot available"></i> Available</span><span><i class="dot bidding"></i> Under bid</span><span><i class="dot rival"></i> Rival-owned</span></div></section>
      <div class="map-side"><section class="panel"><div class="eyebrow">SELECTED PROPERTY</div><h2>${escaped(lot.district)}</h2><span class="pill ${status.status==="rival"?"warning":"neutral"}">${marketStatus(status)}</span><div class="details-list">${stat("Foot traffic",lot.footfall.toFixed(2)+"×")}${stat("Rent per week",money(lot.rentCents))}${stat("Opening staff",String(lot.staff))}${stat("Buy-now total",money(buyNowPrice(lot)))}${stat("Minimum auction bid",money(reserveBid(lot)))}</div><button class="btn primary" data-map-list="${lot.id}">View full listing →</button></section>
      <section class="panel"><div class="eyebrow">LOCAL MARKET</div><h2>${CITIES[mapCityId].name} intelligence</h2><div class="details-list">${stat("Demand index",percentage(game.market[mapCityId].level))}${stat("Your market share",percentage(localMarketShare(game,mapCityId)))}${stat("Rival stores",String(game.rivals[mapCityId].reduce((s,r)=>s+r.stores,0)))}${stat("Brand awareness",game.company.brand.awareness[mapCityId].toFixed(1)+" / 100")}</div><button class="btn" data-go="markets">See customer demographics →</button></section></div></div>`;
  }
  function renderResearch() {
    const research=game.company.research, current=research.activeId&&RESEARCH[research.activeId];
    return `${worldStats()}<div class="strategy-grid"><section class="panel"><div class="panel-head"><div><h2>Innovation pipeline</h2><p>Fund one project at a time; each weekly close advances development.</p></div>${current?"<span class=\"pill\">IN PROGRESS</span>":"<span class=\"pill neutral\">AVAILABLE</span>"}</div><h3 class="big-tier">${current?escaped(current.name):"Research lab is ready"}</h3><p class="help">${current?escaped(current.description):"Choose a project below. Completed effects are permanent across every cafe in your network."}</p>${current?`<div class="details-list">${stat("Weeks until complete",String(research.remainingWeeks))}${stat("Total project weeks",String(current.weeks))}</div>${progressMeter(current.weeks-research.remainingWeeks,current.weeks)}`:""}</section><section class="panel"><div class="panel-head"><div><h2>R&D financials</h2><p>Expenditure is paid at project start and recognized at the first weekly close.</p></div></div><div class="details-list">${stat("Lifetime R&D funded",money(research.totalInvestedCents))}${stat("Pending R&D expense",money(research.pendingExpenseCents))}${stat("Completed innovations",`${research.completed.length} of ${Object.keys(RESEARCH).length}`)}${stat("Unlocked menu",hasResearch(game,"coldBrew")?"Drip · Latte · Espresso · Cold Brew":"Drip · Latte · Espresso")}</div></section></div>
    <div class="section-heading"><h2>Development programs</h2><span class="section-note">Permanent, company-wide advantages</span></div><div class="research-cards">${Object.entries(RESEARCH).map(([id,p])=>{
      const done=research.completed.includes(id),active=research.activeId===id;
      return `<article class="panel research-card"><div class="research-status"><span class="small-caps">${p.weeks}-WEEK DEVELOPMENT</span><span class="pill ${done?"":active?"warning":"neutral"}">${done?"COMPLETE":active?"IN PROGRESS":"READY"}</span></div><h3>${p.name}</h3><p class="help">${p.description}</p><div class="details-list">${stat("Project funding",money(p.costCents))}${stat("Duration",`${p.weeks} weeks`)}</div><button class="btn ${done||active?"subtle":"primary"}" data-start-research="${id}" ${done||research.activeId||game.company.cashCents<p.costCents?"disabled":""}>${done?"Research completed":active?"In development":"Fund research · "+money(p.costCents)}</button></article>`;
    }).join("")}</div>`;
  }
  function renderSourcing() {
    const sourcing=game.company.sourcing,supplier=SUPPLIERS[sourcing.supplierId];
    return `<div class="kpis">${kpi("Current supplier",escaped(supplier.name),"Coffee beans purchasing contract","◈")}${kpi("Cost per 10 lb",money(procurementPackPrice(game,"beansLbs")),"Includes headquarters / research discounts","＄")}${kpi("Bean quality",`${percentage(supplier.quality)}`,"Multiplies recipe and equipment quality","✦")}${kpi("Delayed deliveries",String(sourcing.disruptionCount),"Disruptions recorded to date","◷")}</div>
      <section class="panel" style="margin-bottom:18px"><div class="panel-head"><div><h2>Supply policy</h2><p>Ingredient orders stay on the Supply Chain tab; select bean quality and reliability here.</p></div></div><label class="check-row"><input type="checkbox" id="delivery-insurance" ${sourcing.insured?"checked":""}><span>Delivery risk protection — ${money(DELIVERY_INSURANCE_CENTS)} every week</span></label><p class="help">Coverage reduces the supplier delivery disruption chance by 82%. Without coverage, a disrupted week prevents automatic bean replenishment, which can cause stockouts the following week. Manual purchasing remains available outside deliveries.</p><div class="details-list">${stat("Next supplier switch",game.time.week-sourcing.lastSwitchWeek>=4?"Available":`${4-(game.time.week-sourcing.lastSwitchWeek)} weeks`)}${stat("Onboarding fee per switch",money(SUPPLIER_SWITCH_CENTS))}${stat("Pending contract expense",money(sourcing.pendingContractCents))}</div></section>
      <div class="section-heading"><h2>Bean sourcing contracts</h2><span class="section-note">All numbers are fictional balancing values</span></div><div class="offer-grid">${Object.entries(SUPPLIERS).map(([id,s])=>`<article class="offer-card"><div class="research-status"><span class="small-caps">COFFEE PROCUREMENT</span><span class="pill ${id===sourcing.supplierId?"":"neutral"}">${id===sourcing.supplierId?"ACTIVE":"OPTION"}</span></div><h3>${escaped(s.name)}</h3><p class="help">${escaped(s.description)}</p><div class="details-list">${stat("Bean cost modifier",percentage(s.costFactor))}${stat("Quality multiplier",percentage(s.quality))}${stat("Weekly delay chance",percentage(s.disruptionRisk))}${stat("10 lb pack",money(Math.round(INGREDIENTS.beansLbs.packCostCents*s.costFactor)))}</div><button class="btn ${id===sourcing.supplierId?"subtle":"primary"}" data-pick-supplier="${id}" ${id===sourcing.supplierId||game.time.week-sourcing.lastSwitchWeek<4||game.company.cashCents<SUPPLIER_SWITCH_CENTS?"disabled":""}>${id===sourcing.supplierId?"Contract active":"Switch supplier · "+money(SUPPLIER_SWITCH_CENTS)}</button></article>`).join("")}</div>`;
  }
  function renderPeople4() {
    const cafe=getCafe(game), specialty=cafe.team.specialty||"none";
    return renderPeople()+`<section class="panel" style="margin-top:18px"><div class="panel-head"><div><h2>Employee specialization · ${escaped(cafe.district)}</h2><p>Assign a location-specific expert. Training is paid immediately and counted in the next week's operating expenses. Each active specialist receives a weekly premium.</p></div><span class="pill">${escaped(SPECIALTIES[specialty].name)}</span></div><div class="offer-grid">${Object.entries(SPECIALTIES).map(([id,s])=>`<article class="offer-card"><h3>${escaped(s.name)}</h3><p class="help">${escaped(s.description)}</p><div class="details-list">${stat("Training",money(s.trainCents))}${stat("Weekly salary premium",money(s.weeklyCents))}</div><button class="btn ${specialty===id?"subtle":"primary"}" data-specialize="${id}" ${specialty===id||game.company.cashCents<s.trainCents?"disabled":""}>${specialty===id?"Current specialization":id==="none"?"Return to generalists":"Assign specialist"}</button></article>`).join("")}</div></section>`;
  }
  function renderMarkets4() {
    return renderMarkets()+`<div class="section-heading" style="margin-top:26px"><h2>Customer demographics</h2><span class="section-note">Segment demand influences sales each week. Mix drifts slightly each quarter.</span></div><div class="market-grid">${CITY_IDS.map(id=>`<section class="panel"><div class="panel-head"><div><h2>${CITIES[id].name}</h2><p>Simulated customer mix; market dynamics evolve every 13 weeks</p></div><button class="btn subtle" data-open-map="${id}">Open map →</button></div>${SEGMENT_KEYS.map(key=>`<div class="demographic-row"><span>${escaped(SEGMENTS[key].name)}</span>${progressMeter(game.demographics[id][key]*100)}<strong>${percentage(game.demographics[id][key])}</strong></div>`).join("")}</section>`).join("")}</div>`;
  }
  function renderAcquisitions() {
    const rivals=CITY_IDS.flatMap(cityId=>game.rivals[cityId].map(r=>({cityId,...r}))).filter(r=>r.stores>0);
    const acquired=CITY_IDS.flatMap(cityId=>game.rivals[cityId].filter(r=>r.stores===0).map(r=>r.name));
    return `<div class="notice"><strong>Corporate M&A:</strong> Buy a whole operating competitor, including its cafes, people, and opening inventory. The purchase price is capitalized rather than counted as an operating expense. All acquired locations become independently manageable. Acquired rivals stop competing. Maximum 45 company cafes.</div><div class="kpis">${kpi("Takeover targets",String(rivals.length),"Active fictional competitor companies","♜")}${kpi("Your total stores",String(game.cafes.length),"All wholly owned locations","⌂")}${kpi("Chains acquired",String(acquired.length),"Purchased company networks","✦")}${kpi("Corporate cash",money(game.company.cashCents),"Unrestricted funds; auctions hold escrow","＄")}</div><div class="section-heading"><h2>Acquisition candidates</h2><span class="section-note">Each rival has a dynamic valuation based on its footprint and momentum.</span></div><div class="research-cards">${rivals.map(r=>{
      const price=acquisitionPrice(r), affordable=game.company.cashCents>=price&&game.cafes.length+r.stores<=45;
      return `<section class="panel research-card"><div class="research-status"><span class="small-caps">${CITIES[r.cityId].name} · ${r.strategy.toUpperCase()} STRATEGY</span><span class="pill neutral">${r.stores} stores</span></div><h3>${escaped(r.name)}</h3><div class="details-list">${stat("Acquisition valuation",money(price))}${stat("Store count",String(r.stores))}${stat("Market momentum",r.momentum.toFixed(2)+"×")}${stat("Competing price index",percentage(r.priceIndex))}${stat("Cash reserve",money(r.warChestCents))}</div><button class="btn primary" data-takeover="${r.id}" data-city="${r.cityId}" ${!affordable?"disabled":""}>${affordable?"Acquire chain · "+money(price):"Insufficient cash / capacity"}</button></section>`;
    }).join("")}</div>${acquired.length?`<section class="panel" style="margin-top:19px"><h2>Completed acquisitions</h2><p class="help">${acquired.map(escaped).join(" · ")}</p></section>`:""}`;
  }

  function renderCustomers() {
    const cafe=getCafe(game), customers=cafe.customers, last=customers.lastWeek;
    const demand=last?.demand||0, visits=last?.visits||0;
    const totalCustomers=game.cafes.reduce((sum,c)=>sum+(c.customers.lastWeek?.visits||0),0);
    const repeat=game.cafes.reduce((sum,c)=>sum+(c.customers.lastWeek?.returningVisits||0),0);
    const cards=SEGMENT_KEYS.map(key=>{
      const segment=SEGMENTS[key];
      const count=last?.cohortVisits?.[key]||0;
      const share=visits?count/visits:game.demographics[cafe.cityId][key];
      return `<article class="cohort-card"><h3>${segment.name}</h3><strong>${whole(count)}</strong><small>Visits in last settled week · ${percentage(share)} of store traffic</small><div class="data-meter"><div style="width:${(share*100).toFixed(2)}%"></div></div><p class="help">${segment.description}</p></article>`;
    }).join("");
    return `${branchSelect()}<div class="kpis">
      ${kpi("Store satisfaction",customers.satisfaction.toFixed(1)+" / 100","Updated after each week's experience","♡")}
      ${kpi("Customer loyalty",customers.loyalty.toFixed(1)+" / 100","Affects next week's organic demand","✦")}
      ${kpi("Returning visits",whole(last?.returningVisits||0),`${whole(last?.newVisits||0)} new visits this week`,"↺")}
      ${kpi("Customer reviews",customers.reviewStars.toFixed(1)+" / 5","Simulated weekly review score","★")}
    </div><div class="panel-grid"><section class="panel"><div class="panel-head"><div><h2>Purchase journey</h2><p>Week ${game.company.lastWeek?.week||0} · ${escaped(cafe.district)}</p></div><span class="pill">${whole(visits)} visits</span></div>
      <div class="stat-list">${stat("Customers seeking a purchase",whole(demand))}
      ${stat("Successful visits",whole(visits))}${stat("Returning visits",whole(last?.returningVisits||0))}
      ${stat("First-time visitors",whole(last?.newVisits||0))}${stat("Lost to insufficient stock",whole(last?.lostStock||0))}
      ${stat("Lost to store capacity",whole(last?.lostCapacity||0))}${stat("Average estimated queue wait",`${(last?.waitMinutes||0).toFixed(1)} min`)}
      ${stat("Purchase fulfillment",percentage(last?.fulfillmentRate??0))}
      ${stat("Estimated future retention",percentage(last?.retentionRate??0))}
      ${stat("Lifetime customer visits",whole(customers.lifetimeVisits))}
      </div></section><section class="panel"><div class="panel-head"><div><h2>Your customer base</h2><p>Four demographic cohorts interact with prices, product taste and regional preferences.</p></div></div>
      <p class="help">The game tracks visits, not personally identifiable people. Cohort sales are apportioned to match actual item sales exactly. Loyalty reflects satisfaction, fulfilled orders, incentives and queue times.</p>
      ${stat("Company visits this week",whole(totalCustomers))}${stat("Company returning visits",whole(repeat))}
      ${stat("Store returning-customer pool",whole(customers.returningPool))}
      <div class="btn-row"><button data-go="storedesign" class="btn primary">Improve store experience →</button><button data-go="insights" class="btn">View product economics →</button></div>
      </section></div><section class="panel"><div class="panel-head"><div><h2>Who is buying?</h2><p>Sales mix reflects actual product prices, city preferences, and cohort sensitivity.</p></div></div>
      <div class="cohort-grid">${cards}</div></section>`;
  }

  function renderStoreDesign() {
    const cafe=getCafe(game),ops=cafe.operations, current=STORE_LAYOUTS[ops.layoutId];
    const seat=SEATING_TIERS[ops.seatingTier], next=SEATING_TIERS[ops.seatingTier+1];
    const layouts=Object.entries(STORE_LAYOUTS).map(([id,d])=>`<article class="experience-choice ${ops.layoutId===id?'selected':''}"><h3>${d.name}</h3><p>${d.description}</p>
      ${stat("Throughput",percentage(d.throughput))}${stat("Seating character",percentage(d.seatingScale))}${stat("Remodeling",money(d.remodelCents))}
      <button class="btn ${ops.layoutId===id?'subtle':'primary'}" data-remodel="${id}" ${ops.layoutId===id?'disabled':''}>${ops.layoutId===id?'Current layout':'Remodel'}</button></article>`).join("");
    const cleaning=Object.entries(CLEANING_POLICIES).map(([id,d])=>`<article class="experience-choice ${ops.cleanliness===id?'selected':''}"><h3>${d.name}</h3><p>${d.description}</p>
      ${stat("Weekly cost",money(d.weeklyCents))}<button data-clean-policy="${id}" class="btn ${ops.cleanliness===id?'subtle':'primary'}" ${ops.cleanliness===id?'disabled':''}>${ops.cleanliness===id?'Active':'Apply policy'}</button></article>`).join("");
    const rewards=Object.entries(LOYALTY_POLICIES).map(([id,d])=>`<article class="experience-choice ${ops.loyalty===id?'selected':''}"><h3>${d.name}</h3><p>${d.description}</p>
      ${stat("Weekly cost",money(d.weeklyCents))}${stat("Retention lift",percentage(d.retentionBonus))}
      <button data-loyalty-policy="${id}" class="btn ${ops.loyalty===id?'subtle':'primary'}" ${ops.loyalty===id?'disabled':''}>${ops.loyalty===id?'Active':'Set rewards'}</button></article>`).join("");
    return `${branchSelect()}<div class="kpis">
      ${kpi("Current floorplan",escaped(current.name),"Service speed vs. customer comfort","▥")}
      ${kpi("Seating capacity",whole(seat.seats)+" seats",`${whole(seatCapacity(cafe))} weekly seat-limited orders`,"⌂")}
      ${kpi("Customer satisfaction",cafe.customers.satisfaction.toFixed(1)+" / 100","Responds to waits, quality and upkeep","♡")}
      ${kpi("Weekly facilities",money(storeWeeklyOverhead(cafe)),"Cleaning and loyalty program","＄")}
      </div><div class="panel" style="margin-bottom:18px"><div class="panel-head"><div><h2>Floorplan strategy</h2><p>Each choice changes throughput, the dine-in seating limit, comfort, and customer demand. Changes require cash investments.</p></div></div><div class="experience-grid">${layouts}</div></div>
      <div class="panel" style="margin-bottom:18px"><div class="panel-head"><div><h2>Guest seating</h2><p>Seating is a capital purchase; each seat can handle approximately 46 dine-in visits per week, subject to floorplan constraints.</p></div></div>
      <div class="upgrade-row"><div><h3>${seat.name} · ${seat.seats} seats</h3><p class="help">Current effective weekly seating throughput: ${whole(seatCapacity(cafe))} potential drink orders.</p></div>
      <button class="btn primary" data-seating-upgrade ${!next?'disabled':''}>${next?`Expand to ${next.seats} seats · ${money(next.upgradeCents)}`:'Maximum seating tier'}</button></div></div>
      <div class="panel" style="margin-bottom:18px"><div class="panel-head"><div><h2>Cleaning standards</h2><p>Weekly facilities expense is paid at each settlement; better upkeep raises satisfaction.</p></div></div><div class="experience-grid">${cleaning}</div></div>
      <div class="panel"><div class="panel-head"><div><h2>Customer loyalty program</h2><p>Repeat-customer incentives increase future returning visitors and are charged every week.</p></div></div><div class="experience-grid">${rewards}</div></div>`;
  }

  function estimatedCost(state,cafe,recipe){
    const req=recipeRequirements(recipe);
    return INGREDIENT_KEYS.reduce((sum,key)=>sum+(req[key]/INGREDIENTS[key].packQuantity)*procurementPackPrice(state,key,cafe),0);
  }
  function renderUnitEconomics(){
    const cafe=getCafe(game),last=cafe.lastWeek;
    const rows=PRODUCT_IDS.map(id=>{
      const product=PRODUCTS[id], menu=cafe.menu[id],report=last?.products?.[id];
      const sold=report?.sold||0, variable=estimatedCost(game,cafe,menu.recipe);
      const contributionCents=Math.round(sold*(menu.priceCents-variable));
      const margin=menu.priceCents ? (menu.priceCents-variable)/menu.priceCents:0;
      return `<tr><td><strong>${product.name}</strong></td><td>${whole(sold)}</td>
       <td>${money(menu.priceCents)}</td><td>${money(Math.round(variable))}</td><td class="${contributionCents<0?'negative':'positive'}">${money(contributionCents)}</td>
       <td>${percentage(margin)}</td><td>${money((report?.lostStock||0)*menu.priceCents)}</td></tr>`;
    }).join("");
    const grossContribution=PRODUCT_IDS.reduce((sum,id)=>sum+Math.round((last?.products[id]?.sold||0)*
      (cafe.menu[id].priceCents-estimatedCost(game,cafe,cafe.menu[id].recipe))),0);
    return `${branchSelect()}<div class="kpis">
     ${kpi("Weekly revenue",money(last?.revenueCents||0),"Local location revenue","＄")}
     ${kpi("Est. product contribution",money(grossContribution),"Revenue less modeled usage cost","↗",grossContribution<0?'negative':'')}
     ${kpi("Weekly procurement cash",money(last?.procurementCents||0),"Actual cash paid for ingredient packs","◈")}
     ${kpi("Weekly booked profit",money(last?.netProfitCents||0),"After payroll, rent, facilities and purchases","✦",(last?.netProfitCents||0)<0?'negative':'')}
     </div><section class="panel" style="margin-bottom:18px"><div class="panel-head"><div><h2>Product contribution analysis</h2><p>Estimated cost to make one cup at the current supplier and corporate discount rates.</p></div></div>
     <div class="table-wrap"><table><thead><tr><th>Product</th><th>Units</th><th>Price</th><th>Est. cost / cup</th><th>Estimated contribution</th><th>Unit margin</th><th>Stockout opportunity</th></tr></thead><tbody>${rows}</tbody></table></div>
     <p class="insight-lead" style="margin-top:16px">Contribution is a decision-support estimate, not an additional accounting expense. The ledger continues to recognize actual ingredient purchases when cash is spent, so the estimate is never subtracted from reported profit a second time.</p></section>
     <div class="panel-grid"><section class="panel"><div class="panel-head"><div><h2>Store P&L · cash basis</h2><p>Last complete settlement.</p></div></div>
     ${stat("Sales revenue",money(last?.revenueCents||0))}${stat("Rent",money(last?.rentCents||0))}
     ${stat("Payroll",money(last?.salaryCents||0))}${stat("Facilities & loyalty",money(last?.facilityCents||0))}
     ${stat("Ingredient purchases",money(last?.procurementCents||0))}${stat("Employee development",money(last?.staffDevelopmentCents||0))}
     ${stat("Reported store profit",money(last?.netProfitCents||0), (last?.netProfitCents||0)<0?'negative':'positive')}
     </section><section class="panel"><div class="panel-head"><div><h2>Operational bottlenecks</h2><p>Where demand is being lost.</p></div></div>
     ${stat("Weekly purchase intent",whole(last?.demand||0))}${stat("Completed purchases",whole(last?.unitsSold||0))}
     ${stat("Ingredient shortages",whole(last?.lostStock||0))}${stat("Capacity-limited orders",whole(last?.lostCapacity||0))}
     ${stat("Maximum physical throughput",whole(last?.capacity||0))}${stat("Customer satisfaction",cafe.customers.satisfaction.toFixed(1)+" / 100")}
     <div class="btn-row"><button data-go="supply" class="btn">Improve supply →</button><button data-go="storedesign" class="btn primary">Improve service capacity →</button></div>
     </section></div>`;
  }

  let globalRegion='all';
  const safeCity=id=>CITIES[id]?.name||id;
  const regionLabel=id=>EmpireWorld.regionNames?.[id]||({americas:'Americas',europe:'Europe',asia:'Asia–Pacific'}[id]||id);
  const cafeCurrency=cafe=>CITIES[cafe.cityId].currency||'USD';
  const activeFranchises=()=>game.company.empire.franchises.filter(f=>f.status==='active');
  const companyCurrencies=()=>[...new Set(CITY_IDS.map(id=>CITIES[id].currency||'USD'))];
  const franchiseTotal=()=>game.company.empire.lifetimeRoyaltiesCents;
  const globalStatBar=(label,value)=>`<div class="gl-stat"><span>${label}</span><strong>${value}</strong></div>`;
  function renderGlobalEmpire(){
    const e=game.company.empire;
    const countries=new Set(CITY_IDS.map(id=>CITIES[id].country||'United States'));
    const regionButtons=['all','americas','europe','asia'].map(id=>`<button class="btn ${id===globalRegion?'primary':''}" data-global-region="${id}">${id==='all'?'All markets':regionLabel(id)}</button>`).join('');
    const cards=CITY_IDS.filter(id=>globalRegion==='all'||EmpireWorld.regionForCity(id)===globalRegion).map(id=>{
      const city=CITIES[id],currency=city.currency||'USD',owned=game.cafes.filter(c=>c.cityId===id).length;
      const franchises=e.franchises.filter(f=>f.cityId===id&&f.status!=='closed').length;
      const market=game.market[id],price=EmpireWorld.priceLabel(PRODUCTS.latte.referencePriceCents*city.priceIndex,currency,e);
      return `<article class="panel gl-city"><div class="gl-city-top"><span class="small-caps">${escaped(city.country||'United States')} · ${regionLabel(EmpireWorld.regionForCity(id))}</span><span class="pill neutral">${currency}</span></div>
        <h3>${escaped(city.name)}</h3><p class="help">${escaped(city.tagline)}</p>
        <div class="details-list">${stat('Demand index',percentage(market.level))}${stat('Competition',percentage(market.competitorPressure))}${stat('Indicative local latte price',price)}${stat('Owned · Franchised',`${owned} / ${franchises}`)}</div>
        <div class="btn-row"><button class="btn primary" data-global-city="${id}">Property listings →</button><button class="btn" data-global-franchise="${id}">Franchise market →</button></div></article>`;
    }).join('');
    const rateRows=companyCurrencies().map(code=>`<tr><td><strong>${code}</strong><small>${EmpireWorld.currencies[code].name}</small></td><td>${(1/e.fx[code]).toLocaleString('en-US',{maximumFractionDigits:2})} ${code} / USD</td><td>${(e.fx[code]/EmpireWorld.currencies[code].base*100).toFixed(1)}% of baseline</td></tr>`).join('');
    return `<div class="gl-hero"><div class="eyebrow">PHASE SIX · GLOBAL ECONOMY</div><h2>Your coffee empire, worldwide.</h2><p>Expand into ${CITY_IDS.length} simulated international markets in ${countries.size} countries. Each has local competition, spending power, demographic preferences, and modeled currency exposure.</p><div class="gl-highlights">${globalStatBar('Operating cities',getCitiesOwned())}${globalStatBar('Available markets',CITY_IDS.length)}${globalStatBar('Supported currencies',companyCurrencies().length)}${globalStatBar('Total properties',LISTINGS.length)}</div></div>
      <div class="section-heading"><h2>Explore markets</h2><div class="btn-row">${regionButtons}</div></div><div class="gl-grid">${cards}</div>
      <section class="panel"><div class="panel-head"><div><h2>Foreign exchange desk</h2><p>Rates are simulated, mean-reverting and not live market quotes. Company accounts are kept in reporting USD.</p></div><span class="pill neutral">UPDATED WEEKLY</span></div><div class="table-wrap"><table><thead><tr><th>Currency</th><th>Modeled conversion</th><th>Relative to scenario baseline</th></tr></thead><tbody>${rateRows}</tbody></table></div></section>`;
  }
  function renderFranchises(){
    const e=game.company.empire,live=activeFranchises();
    const last=e.lastWeek||{},rates=[.06,.07,.08,.09,.10];
    const cities=CITY_IDS.map(id=>{
      const count=e.franchises.filter(f=>f.cityId===id&&f.status!=='closed').length;
      const active=e.franchises.filter(f=>f.cityId===id&&f.status==='active').length;
      const royalty=e.franchises.filter(f=>f.cityId===id).reduce((s,f)=>s+f.lastRoyaltyCents,0);
      const fee=160000+count*30000;
      return `<tr><td><strong>${escaped(CITIES[id].name)}</strong><small>${escaped(CITIES[id].country||'United States')}</small></td><td>${active} active / ${count} total</td><td>${money(royalty)}</td><td>${money(fee)}</td><td><button class="btn ${count<12?'primary':''}" data-license-city="${id}" ${count>=12||game.company.cashCents<fee?'disabled':''}>+ License partner</button></td></tr>`;
    }).join('');
    return `<div class="gl-hero"><div class="eyebrow">ASSET-LIGHT EXPANSION</div><h2>Build a franchise business.</h2><p>Recruit independent operators. You fund onboarding and brand support, while franchisees own their inventory, payroll, and stores. Corporate revenue includes **only royalties**, never franchise store sales.</p><div class="gl-highlights">${globalStatBar('Active partners',live.length)}${globalStatBar('Last week royalty',money(last.royaltyCents||0))}${globalStatBar('Lifetime royalties',money(franchiseTotal()))}${globalStatBar('Weekly support',money((last.franchiseSupportCents||0)))}</div></div>
      <section class="panel"><div class="panel-head"><div><h2>Franchise agreements</h2><p>New agreements undergo 2 weekly settlements of training before producing royalties. Higher royalty rates increase partner closure risk.</p></div></div><div class="controls"><label class="input-field">Royalty on partner gross sales<select id="franchise-rate">${rates.map(rate=>`<option value="${rate}" ${e.royaltyRate===rate?'selected':''}>${Math.round(rate*100)}%</option>`).join('')}</select></label><span class="help">Partner onboarding: ${money(160000)} base, +${money(30000)} for each additional licensed store in the same city.</span></div></section>
      <section class="panel"><div class="panel-head"><div><h2>Territory exchange</h2><p>Franchise up to 12 partners per market. Regional demand determines each partner's gross sales and your royalties.</p></div></div><div class="table-wrap"><table><thead><tr><th>Market</th><th>Network</th><th>Weekly royalty</th><th>Next onboarding</th><th>Action</th></tr></thead><tbody>${cities}</tbody></table></div></section>`;
  }
  function renderDistribution(){
    const e=game.company.empire,lines=[];
    const blocks=Object.entries(EmpireWorld.regions).map(([id,def])=>{
      const hub=e.warehouses[id],used=EmpireWorld.stockUsed(hub),ratio=used/def.capacity;
      const stock=INGREDIENT_KEYS.map(key=>{
        const d=INGREDIENTS[key],q=hub.inventory[key]||0;
        return `<div class="gl-stock"><span>${escaped(d.name)}</span><strong>${qty(q,0)} ${d.unit}</strong>${hub.opened?`<button data-warehouse-buy="${id}" data-ingredient="${key}" class="btn" ${game.company.cashCents<Math.round(d.packCostCents*.92)?'disabled':''}>+ Pack ${money(Math.round(d.packCostCents*.92))}</button>`:''}</div>`;
      }).join('');
      return `<article class="panel gl-hub"><div class="gl-city-top"><span class="pill ${hub.opened?'':'neutral'}">${hub.opened?'OPEN & OPERATIONAL':'NOT BUILT'}</span><span class="small-caps">${def.leadWeeks}-WEEK DELIVERY</span></div><h3>${def.name}</h3><p class="help">${regionLabel(id)} service area · fixed ${money(def.weeklyCents)} / week · max ${whole(def.capacity)} inventory units.</p>
        ${hub.opened?`${progressMeter(Math.round(ratio*100))}<div class="help">${whole(used)} / ${whole(def.capacity)} capacity consumed</div><div class="gl-stock-list">${stock}</div>`:
        `<div class="notice">Startup investment ${money(def.costCents)} (capital) with ongoing weekly overhead. The hub changes automatic orders in its region to scheduled distribution shipments.</div><button class="btn primary" data-build-hub="${id}" ${game.company.cashCents<def.costCents?'disabled':''}>Build hub · ${money(def.costCents)}</button>`}</article>`;
    }).join('');
    const transit=e.shipments.slice(0,60).map(t=>`<tr><td>${escaped(game.cafes.find(c=>c.id===t.cafeId)?.district||'Unknown')}</td><td>${escaped(INGREDIENTS[t.key]?.name||t.key)}</td><td>${qty(t.quantity,1)}</td><td>Week ${t.arrivalWeek}</td><td>${money(t.freightCents)}</td></tr>`).join('')||'<tr><td colspan="5">No inbound shipments. Build a hub, purchase stock, and set automatic store thresholds.</td></tr>';
    return `<div class="gl-hero"><div class="eyebrow">REGIONAL OPERATIONS</div><h2>Own the distribution network.</h2><p>Central warehouses purchase inventory in bulk. Store replenishment uses physical shipments with lead times—so running out of stock can cost you sales. You can keep direct supplier restocking in regions without a hub.</p><div class="gl-highlights">${globalStatBar('Hubs open',Object.values(e.warehouses).filter(w=>w.opened).length+' / 3')}${globalStatBar('Shipments in transit',e.shipments.length)}${globalStatBar('Last shipping cost',money(e.lastWeek?.shippingCents||0))}${globalStatBar('Lifetime freight',money(e.lifetimeShippingCents))}</div></div>
      <div class="gl-hub-grid">${blocks}</div><section class="panel"><div class="panel-head"><div><h2>Inbound delivery manifest</h2><p>Orders dispatch after the weekly sales close and arrive before sales in their scheduled week.</p></div></div><div class="table-wrap"><table><thead><tr><th>Destination</th><th>Ingredient</th><th>Quantity</th><th>Arrival</th><th>Freight paid</th></tr></thead><tbody>${transit}</tbody></table></div></section>`;
  }
  function renderProductStudio(){
    const e=game.company.empire,port=e.portfolio,cafe=getCafe(game);
    const tiles=PRODUCT_IDS.map(id=>{
      const prod=PRODUCTS[id],ready=id==='coldBrew'?hasResearch(game,'coldBrew'):port.unlocked.includes(id);
      const building=port.active===id,project=EmpireWorld.devProjects[id],report=cafe.lastWeek?.products?.[id];
      const item=cafe.menu[id];
      return `<article class="panel gl-product"><div class="gl-city-top"><span class="small-caps">${['croissant','muffin'].includes(id)?'BAKERY':id==='coldBrew'?'RESEARCH LAB':'BEVERAGES'}</span><span class="pill ${ready?'':'neutral'}">${ready?'SELLING':building?'DEVELOPING':'LOCKED'}</span></div><h3>${prod.name}</h3><p class="help">${project?.description||'Core signature beverage · available from the beginning.'}</p>
        <div class="details-list">${stat('Reference price',money(prod.referencePriceCents))}${stat('Sold last week',whole(report?.sold||0))}${stat('Est. sales contribution',money((report?.revenueCents||0)-(report?.estimatedCogsCents||0)))}</div>
        ${ready?`<div class="controls"><label class="input-field">Local price (USD equivalent)<input class="num" aria-label="${prod.name} local price" type="number" min=".50" max="25" step=".05" data-studio-price="${id}" value="${(item.priceCents/100).toFixed(2)}"></label><span class="help">${EmpireWorld.priceLabel(item.priceCents,cafeCurrency(cafe),e)} local</span></div>`:
        id==='coldBrew'?`<button class="btn" data-go="research">Unlock in research lab →</button>`:
        `<div class="details-list">${stat('Development funding',money(project.costCents))}${stat('Research weeks',String(project.weeks))}</div><button class="btn primary" data-product-develop="${id}" ${port.active||game.company.cashCents<project.costCents?'disabled':''}>${building?`Ready in ${port.remainingWeeks} week(s)`:'Start development'}</button>`}</article>`;
    }).join('');
    return `<div class="gl-hero"><div class="eyebrow">MENU R&D</div><h2>Build an iconic product portfolio.</h2><p>Launch classic espresso drinks, premium iced coffee, and bakery items. Each new product changes inventory usage, demand, revenue, and the contribution margin across your cafes.</p><div class="gl-highlights">${globalStatBar('Unlocked drinks & food',port.unlocked.length+(hasResearch(game,'coldBrew')?1:0)+' / '+PRODUCT_IDS.length)}${globalStatBar('Active project',port.active?escaped(PRODUCTS[port.active].name):'None')}${globalStatBar('Development costs',money(port.developedCents))}${globalStatBar('Active cafe',escaped(cafe.district))}</div></div>
      <div class="branch-banner"><div><div class="eyebrow">STORE PRICING CONTROLS</div><h2>${escaped(cafeName(cafe))}</h2><p>Local prices are stored in USD-equivalent cents; modeled currency conversion is shown beside each price.</p></div>${branchSelect()}</div><div class="gl-grid">${tiles}</div>`;
  }
  function renderLeadership(){
    const e=game.company.empire,active=Object.entries(e.executives).filter(([id,yes])=>yes);
    const weekly=active.reduce((sum,[id])=>sum+EmpireWorld.executives[id].salaryCents,0);
    const tiles=Object.entries(EmpireWorld.executives).map(([id,p])=>{
      const hired=e.executives[id];
      return `<article class="panel gl-exec"><div class="gl-city-top"><span class="small-caps">${id.toUpperCase()} · CORPORATE</span><span class="pill ${hired?'':'neutral'}">${hired?'APPOINTED':'VACANT'}</span></div><h3>${p.title}</h3><p class="help">${p.effect}. Executive bonuses apply directly inside the game engine.</p><div class="details-list">${stat('Compensation / week',money(p.salaryCents))}${stat('Signing package',money(p.signingCents))}</div><button class="btn ${hired?'':'primary'}" data-executive="${id}" ${!hired&&game.company.cashCents<p.signingCents?'disabled':''}>${hired?'Remove executive':'Appoint · '+money(p.signingCents)}</button></article>`;
    }).join('');
    return `<div class="gl-hero"><div class="eyebrow">CORPORATE GOVERNANCE</div><h2>Build your executive team.</h2><p>Hiring specialists can improve operations, product development, marketing, and franchising—but their compensation adds to corporate overhead every week.</p><div class="gl-highlights">${globalStatBar('Executive positions filled',active.length+' / 6')}${globalStatBar('Weekly payroll',money(weekly))}${globalStatBar('Last executive expense',money(e.lastWeek?.executiveCents||0))}${globalStatBar('Headquarters tier',HQ_TIERS[game.company.hqTier].name)}</div></div><div class="gl-grid">${tiles}</div>`;
  }
  function renderStatements(){
    const a=game.company.lastWeek||{},e=game.company.empire,finance=game.company.finance;
    const revenue=a.revenueCents||0,expenses=a.operatingExpenseCents||0;
    const detailed=[
      ['Owned cafe sales',revenue-(a.royaltyCents||0)-(a.contractRevenueCents||0)],['Franchise royalties',a.royaltyCents||0],
      ['Commercial contract revenue',a.contractRevenueCents||0],
      ['Rent',-(a.rentCents||0)],['Store payroll',-(a.salaryCents||0)],
      ['Facilities & loyalty',-(a.facilityCents||0)],['Ingredients & distribution stock',-(a.procurementCents||0)],
      ['Marketing',-(a.marketingExpenseCents||0)],['HQ operations',-(a.hqExpenseCents||0)],
      ['Executive payroll',-(a.executiveCents||0)],['Executive recruitment',-(a.recruitmentCents||0)],
      ['Warehouse overhead',-(a.warehouseOverheadCents||0)],['Freight',-(a.shippingCents||0)],
      ['Franchise support & onboarding',-((a.franchiseSupportCents||0)+(a.setupCents||0))],
      ['Product development',-(a.devCents||0)],['Strategy & board decisions',-(a.strategyExpenseCents||0)],
      ['Sustainable operations',-(a.sustainabilityCents||0)],['Research / staff / suppliers / auctions',-
        ((a.researchExpenseCents||0)+(a.staffDevelopmentCents||0)+(a.supplierExpenseCents||0)+(a.auctionFeeExpenseCents||0))]
    ];
    const debt=outstandingDebt(game);
    const cafeAssets=game.company.portfolioInvestedCents||0;
    const warehouseAssets=Object.values(e.warehouses).reduce((sum,w)=>sum+w.capitalCents,0);
    const inventoryAssets=game.cafes.reduce((sum,c)=>sum+INGREDIENT_KEYS.reduce((t,key)=>t+(c.inventory[key]||0)/INGREDIENTS[key].packQuantity*INGREDIENTS[key].packCostCents,0),0)+
      Object.values(e.warehouses).reduce((sum,w)=>sum+INGREDIENT_KEYS.reduce((t,key)=>t+(w.inventory[key]||0)/INGREDIENTS[key].packQuantity*INGREDIENTS[key].packCostCents,0),0);
    const assets=game.company.cashCents+cafeAssets+warehouseAssets+Math.round(inventoryAssets),net=assets-debt;
    const cashFlow=(a.revenueCents||0)-(a.rentCents||0)-(a.salaryCents||0)-(a.facilityCents||0)-(a.hqExpenseCents||0)-
      (a.autoStockCents||0)-(a.financeExpenseCents||0)-(a.principalPaidCents||0)-(a.dividendsCents||0)-
      (a.executiveCents||0)-(a.warehouseOverheadCents||0)-(a.franchiseSupportCents||0)-(a.shippingCents||0)-(a.sustainabilityCents||0);
    return `<div class="gl-hero"><div class="eyebrow">CORPORATE ACCOUNTS · USD</div><h2>Understand the real economics.</h2><p>Company revenue includes cafe sales, earned franchise royalties, and fulfilled commercial supply agreements. All figures are shown in reporting USD, with inventories recognized on purchase and capital investments kept separate from operating profit.</p><div class="gl-highlights">${globalStatBar('Weekly revenue',money(revenue))}${globalStatBar('Operating expenses',money(expenses))}${globalStatBar('Net profit',money(a.netProfitCents||0))}${globalStatBar('Cash balance',money(game.company.cashCents))}</div></div>
    <div class="panel-grid"><section class="panel"><div class="panel-head"><div><h2>Income statement</h2><p>Last closed week · cash-basis procurement and project expenses</p></div></div><div class="gl-statement">${detailed.map(([name,amount])=>globalStatBar(name,money(amount))).join('')}<hr/>${globalStatBar('Operating profit',money((a.operatingProfitCents||0)))}${globalStatBar('Loan interest',money(-(a.financeExpenseCents||0)))}${globalStatBar('Net profit',money(a.netProfitCents||0))}</div></section>
    <section class="panel"><div class="panel-head"><div><h2>Indicative balance sheet</h2><p>Management valuation, not GAAP. No depreciation, taxes, goodwill adjustments, or inventory LIFO.</p></div></div><div class="gl-statement">${globalStatBar('Cash & equivalents',money(game.company.cashCents))}${globalStatBar('Store / acquisition capital (cost)',money(cafeAssets))}${globalStatBar('Warehouse capital (cost)',money(warehouseAssets))}${globalStatBar('Inventory (replacement estimate)',money(Math.round(inventoryAssets)))}<hr/>${globalStatBar('Total indicative assets',money(assets))}${globalStatBar('Outstanding loan principal',money(-debt))}${globalStatBar('Indicative net assets',money(net))}</div>
    <div class="notice">Founder ownership ${(finance.founderOwnership*100).toFixed(1)}% · Shareholder dividends are financing distributions, not operating expenses.</div></section></div>
    <section class="panel"><div class="panel-head"><div><h2>Cash movement · settlement view</h2><p>Selected cash movements from the last weekly close. Manual purchases, executive signings, development starts, warehouse purchases, and acquisitions are paid immediately when clicked; they do not appear a second time here.</p></div></div>
      <div class="gl-statement">${globalStatBar('Store, franchise & contract receipts',money(revenue))}${globalStatBar('Scheduled operating cash outflows',money(-(a.rentCents||0)-(a.salaryCents||0)-(a.facilityCents||0)-(a.hqExpenseCents||0)-(a.executiveCents||0)-(a.warehouseOverheadCents||0)-(a.franchiseSupportCents||0)-(a.sustainabilityCents||0)))}${globalStatBar('Auto ingredient purchases & freight',money(-(a.autoStockCents||0)-(a.shippingCents||0)))}${globalStatBar('Interest and principal',money(-(a.financeExpenseCents||0)-(a.principalPaidCents||0)))}${globalStatBar('Shareholder distributions',money(-(a.dividendsCents||0)))}<hr/>${globalStatBar('Selected settlement cash movement',money(cashFlow))}</div></section>`;
  }
  function renderWorldNews(){
    const e=game.company.empire,active=e.event&&EmpireWorld.events[e.event.id];
    const headlines=(game.news||[]).slice(0,36).map(item=>`<article class="gl-news"><span class="small-caps">WEEK ${item.week}</span><p>${escaped(item.description)}</p></article>`).join('')||'<p class="help">No major events yet. Advance several weeks to see the world economy unfold.</p>';
    const eventCatalog=Object.values(EmpireWorld.events).map(v=>`<div class="gl-stock"><strong>${v.title}</strong><span>${v.description}</span></div>`).join('');
    return `<div class="gl-hero"><div class="eyebrow">LIVE SIMULATED WORLD</div><h2>Markets never stand still.</h2><p>Economic events are generated by the seeded simulation, altering demand and selected expenses. Competing chains react to your growth and prices as the weeks pass.</p><div class="gl-highlights">${globalStatBar('Current environment',active?active.title:'Normal conditions')}${globalStatBar('Event weeks remaining',e.event?.weeksRemaining||'—')}${globalStatBar('Historical shocks',e.eventHistory.length)}${globalStatBar('News items',game.news.length)}</div></div>
      <div class="panel-grid"><section class="panel"><div class="panel-head"><div><h2>Business journal</h2><p>Latest simulated market, rival, and company developments.</p></div></div>${headlines}</section>
      <section class="panel"><div class="panel-head"><div><h2>Economic cycle indicators</h2><p>The modeled world can experience several different event types.</p></div></div><div class="gl-stock-list">${eventCatalog}</div></section></div>`;
  }

  function renderCapitalMarkets(){
    const c=game.company.empire.capital,fin=game.company.finance;
    const marketValue=c.listed?c.sharePriceCents*c.sharesOutstanding:estimatedEquityValuation(game);
    const canIPO=game.cafes.length>=3&&game.company.hqTier>=2&&game.company.lifetime.weeks>=26&&fin.boardConfidence>=45;
    const ipoPrice=Math.max(50,Math.round(estimatedEquityValuation(game)/1000000));
    const floatGross=ipoPrice*250000;
    const history=c.history.slice(-12).reverse().map(pt=>`<div class="gl-stock"><span>Week ${pt.week}</span><strong>${money(pt.priceCents)} / share</strong><span>${money(pt.marketCapCents)} market cap</span></div>`).join('')||'<p class="help">Price history begins after the public offering.</p>';
    return `<div class="gl-hero"><div class="eyebrow">EQUITY CAPITAL & STOCK MARKET</div><h2>From coffee startup to public company.</h2><p>The IPO mechanic raises real corporate capital by issuing new shares, dilutes existing holders, and opens a fluctuating fictional share market. Share offerings are financing transactions—not operating revenue.</p><div class="gl-highlights">${globalStatBar('Company status',c.listed?'PUBLIC · '+c.ticker:'PRIVATE')}${globalStatBar('Equity valuation',money(marketValue))}${globalStatBar('Founder ownership',percentage(fin.founderOwnership))}${globalStatBar('Share price',c.listed?money(c.sharePriceCents):'Not listed')}</div></div>
      <div class="panel-grid"><section class="panel"><div class="panel-head"><div><h2>${c.listed?'Listed equity offering':'Initial public offering'}</h2><p>${c.listed?'Issue additional shares to fund expansion.':'Meet company milestones to access institutional capital.'}</p></div></div>
      ${c.listed?`<div class="details-list">${stat('Ticker',c.ticker)}${stat('Total shares',whole(c.sharesOutstanding))}${stat('Public float',whole(c.publicFloatShares))}${stat('Weekly reference price',money(c.sharePriceCents))}${stat('8% new share offering proceeds (gross)',money(Math.floor(c.sharesOutstanding*.08)*c.sharePriceCents))}${stat('Underwriting fee', '3% of proceeds')}</div><button class="btn primary" data-secondary-offering>Issue 8% new shares</button>`:
      `<div class="details-list">${stat('At least 3 company cafes',game.cafes.length>=3?'Ready':'Need '+(3-game.cafes.length)+' more')}${stat('Corporate operations center',game.company.hqTier>=2?'Ready':'HQ Tier 3 required')}${stat('26 settled weeks',Math.min(game.company.lifetime.weeks,26)+' / 26')}${stat('Board confidence ≥45',fin.boardConfidence.toFixed(0)+' / 100')}${stat('Prospective issue price',money(ipoPrice))}${stat('Gross IPO proceeds',money(floatGross))}${stat('Underwriting fees',money(Math.round(floatGross*.05)))}</div><button class="btn primary" data-launch-ipo ${canIPO?'':'disabled'}>Launch IPO · 250,000 new shares</button>`}</section>
      <section class="panel"><div class="panel-head"><div><h2>Capitalization and governance</h2><p>Management estimates; no actual securities or financial trading.</p></div></div>
      <div class="details-list">${stat('Founder ownership',percentage(fin.founderOwnership))}${stat('Other shareholders',percentage(1-fin.founderOwnership))}${stat('Board confidence',fin.boardConfidence.toFixed(1)+' / 100')}${stat('Outstanding corporate debt',money(outstandingDebt(game)))}${stat('Outside capital raised',money(fin.externalCapitalRaisedCents))}${stat('IPO / issuance fees paid',money(c.underwritingCents))}${stat('Dividend distribution policy',percentage(fin.dividendRate))}</div><button data-go="finance" class="btn">Banking & shareholder policies →</button></section></div>
      <section class="panel"><div class="panel-head"><div><h2>Public share price history</h2><p>Fictional weekly pricing moves with modeled market sentiment and company performance. No external quotes.</p></div></div>${history}</section>`;
  }
  function renderFounderOffice(){
    const cap=game.company.empire.capital,founder=cap.founder;
    const equityValue=(cap.listed?cap.sharePriceCents*cap.sharesOutstanding:estimatedEquityValuation(game))*game.company.finance.founderOwnership;
    const securities=Object.entries(cap.securities).map(([id,p])=>{
      const owned=founder.holdings[id]||0;
      return `<article class="panel gl-exec"><div class="gl-city-top"><span class="small-caps">${p.sector.toUpperCase()}</span><span class="pill neutral">${id}</span></div><h3>${p.name}</h3><p class="help">Fictional publicly traded security. Prices change at the weekly close and are separate from your coffee company's finances.</p><div class="details-list">${stat('Current market price',money(p.priceCents))}${stat('Shares held',whole(owned))}${stat('Personal market value',money(owned*p.priceCents))}</div><div class="btn-row"><button class="btn primary" data-personal-trade="${id}" data-side="buy" ${founder.cashCents<p.priceCents?'disabled':''}>Buy shares</button><button class="btn" data-personal-trade="${id}" data-side="sell" ${!owned?'disabled':''}>Sell shares</button></div></article>`;
    }).join('');
    const trades=founder.trades.slice(0,20).map(trade=>`<tr><td>Week ${trade.week}</td><td>${trade.side==='buy'?'BUY':'SELL'} ${trade.id}</td><td>${whole(trade.count)} shares</td><td>${money(trade.priceCents)} ea.</td><td>${money(trade.brokerCents)}</td></tr>`).join('')||'<tr><td colspan="5">No personal investment activity yet.</td></tr>';
    return `<div class="gl-hero"><div class="eyebrow">PERSONAL WEALTH · FOUNDER PROFILE</div><h2>You're not the company.</h2><p>Your personal wallet, investment holdings, and dividend income are entirely separate from corporate cash. Issuing shares, purchasing stores, and taking loans affect the corporation—not your personal bank account.</p><div class="gl-highlights">${globalStatBar('Personal cash',money(founder.cashCents))}${globalStatBar('Personal investments',money(EmpireWorld.founderPortfolioValue(cap)))}${globalStatBar('Founder equity value',money(Math.round(equityValue)))}${globalStatBar('Estimated net worth',money(Math.round(founder.cashCents+EmpireWorld.founderPortfolioValue(cap)+equityValue)))}</div></div>
    <section class="panel"><div class="panel-head"><div><h2>Founder income</h2><p>Corporate dividends are distributed pro-rata across shareholders; only your fractional share enters personal cash.</p></div></div><div class="details-list">${stat('Ownership fraction',percentage(game.company.finance.founderOwnership))}${stat('Lifetime personal dividend income',money(founder.dividendIncomeCents))}${stat('Corporate dividend policy',percentage(game.company.finance.dividendRate))}${stat('Corporate cash (not personal)',money(game.company.cashCents))}</div><button class="btn" data-go="finance">Change shareholder dividend policy →</button></section>
    <div class="section-heading"><h2>Fictional stock exchange</h2><span class="section-note">Trades use your personal account only · 0.1% brokerage per trade</span></div><div class="gl-grid">${securities}</div>
    <section class="panel"><div class="panel-head"><div><h2>Personal trade journal</h2><p>Last 20 trades.</p></div></div><div class="table-wrap"><table><thead><tr><th>Week</th><th>Action</th><th>Quantity</th><th>Trade price</th><th>Broker fee</th></tr></thead><tbody>${trades}</tbody></table></div></section>`;
  }

  function render() {
    const routes = {
      global: ['Global expansion','Explore 22 world markets, exchange rates, and international expansion opportunities.'],
      franchises: ['Franchise network','Grow through licensed partners without owning every storefront.'],
      distribution: ['Regional logistics','Build warehouses, buy stock in bulk, and dispatch supplies to your stores.'],
      productstudio: ['Product development','Research, unlock, price, and launch new coffee and bakery products.'],
      leadership: ['Executive leadership','Appoint a C-suite that influences operations, marketing, and corporate overhead.'],
      capital: ['Capital markets','Take your company public, monitor the fictional share price, and issue shares for growth.'],
      founder: ['Founder office','Keep personal money, dividends, and investments separate from corporate cash.'],
      statements: ['Financial statements','Review detailed income, cash flow, and an indicative corporate balance sheet.'],
      worldnews: ['World business news','Economic cycles, currency movements, rival expansion, and corporate events.'],
      dashboard: ["Command center", "Your growing coffee company, at a glance."],
      boardroom: ["CEO briefing", "High-stakes strategic decisions and leadership history."],
      achievements: ["Company milestones", "Track your journey from local cafe to global enterprise."],
      contracts: ["Commercial deals", "Sign B2B supply contracts and earn recurring revenue."],
      strategy: ["Corporate strategy", "Shape your brand's positioning and sustainable growth."],
      account: ["Your account & saves", "Online slots, automatic cloud syncing, and offline backups."],
      forecast: ["Scenario forecasting", "Model the next 13 weeks before committing capital."],
      locations: ["Property exchange", "Buy storefronts outright or place competing auction bids."],
      map: ["Interactive city atlas", "Explore simulated city districts, storefronts, and rival-controlled properties."],
      operations: ["Cafe operations", "Staff, equipment, local pricing, and recipes—location by location."],
      customers: ["Customer intelligence", "Understand demand, satisfaction, loyalty, and buyer groups at every cafe."],
      storedesign: ["Store experience", "Balance seating, service speed, cleanliness, and customer rewards."],
      insights: ["Unit economics", "Price-versus-cost contribution and store-level profit analysis."],
      supply: ["Supply chain", "Local inventory, corporate purchasing, and automatic restocking."],
      sourcing: ["Coffee sourcing", "Choose bean quality, supplier costs, and delivery reliability."],
      research: ["Research & development", "Fund innovations and unlock an expanded product menu."],
      markets: ["Market intelligence", "Regional demand, customer preferences, and simulated competition."],
      headquarters: ["Company headquarters", "Corporate leadership, strategy and office investments."],
      finance: ["Banking & investors", "Capital structure, bank lending, ownership, and cash distributions."],
      people: ["People & talent", "Build exceptional teams through training, leadership and compensation."],
      marketing: ["Brand & marketing", "Launch promotions, grow awareness and protect your reputation."],
      rivals: ["Competitive intelligence", "Track rival strategies, momentum, and regional market share."],
      acquisitions: ["Mergers & acquisitions", "Buy competing coffee companies and integrate their store networks."]
    };
    const route = routes[currentTab] || routes.dashboard;
    document.getElementById("page-title").textContent = route[0];
    document.getElementById("page-subtitle").textContent = route[1];
    document.getElementById("date-chip").textContent = `Week ${game.time.week} · ${monthName(game.time.month)} ${game.time.year}`;
    document.getElementById("play-toggle").textContent = paused ? "▶ Run" : "Ⅱ Pause";
    document.getElementById("play-toggle").setAttribute("aria-pressed", String(!paused));
    document.getElementById("side-count").textContent = `${game.cafes.length} company stores · ${game.company.empire.franchises.filter(f=>f.status==='active').length} franchise stores · ${getCitiesOwned()} owned-store cities`;
    document.getElementById("side-company").textContent = `◉ ${game.company.name}`;
    document.getElementById("corporate-eyebrow").textContent = `${game.company.name.toUpperCase()} / CORPORATE OFFICE`;
    document.querySelectorAll("[data-tab]").forEach(button => {
      const isActive = button.dataset.tab === currentTab;
      button.classList.toggle("active", isActive);
      if (isActive) button.setAttribute("aria-current", "page"); else button.removeAttribute("aria-current");
    });
    renderSubnavigation(); updateAccountChip();
    document.getElementById("screen").innerHTML = ({
      global: renderGlobalEmpire,franchises:renderFranchises,distribution:renderDistribution,
      productstudio:renderProductStudio,leadership:renderLeadership,statements:renderStatements,
      capital:renderCapitalMarkets,founder:renderFounderOffice,
      worldnews:renderWorldNews, dashboard: renderDashboard7,
      boardroom:renderBoardroom,achievements:renderAchievements,contracts:renderContracts,
      strategy:renderStrategy,account:renderAccount,forecast:renderForecast,locations: renderRealEstate,
      map:renderCityMap, operations: renderOperations, customers:renderCustomers, storedesign:renderStoreDesign,
      insights:renderUnitEconomics, supply: renderSupply, sourcing:renderSourcing,
      research:renderResearch, markets:renderMarkets4,
      headquarters: renderHeadquarters, finance: renderFinance, people: renderPeople4,
      marketing: renderMarketing, rivals: renderRivals, acquisitions:renderAcquisitions })[currentTab]();
    updateClockVisual();
  }
  function updateClockVisual() {
    const bar = document.getElementById("clock-progress");
    if (bar) bar.style.width = `${clamp(clockAccumulator / WEEK_DURATION_MS * 100, 0, 100)}%`;
    const label = document.getElementById("clock-text");
    if (label) label.textContent = paused ? "Paused" : `${Math.ceil((WEEK_DURATION_MS - clockAccumulator) / (1000 * speed))}s to next week`;
  }
  function frame(now) {
    if (lastFrame === null) lastFrame = now;
    const dt = Math.min(Math.max(0, now - lastFrame), 250);
    lastFrame = now;
    if (!paused && !document.hidden) {
      clockAccumulator += dt * speed;
      while (clockAccumulator >= WEEK_DURATION_MS) {
        clockAccumulator -= WEEK_DURATION_MS;
        dispatch({ type: "WEEK_TICK" });
      }
    }
    updateClockVisual();
    requestAnimationFrame(frame);
  }
  document.addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button) return;
    if(button.hasAttribute('data-launch-ipo')){
      if(window.confirm('Take your company public by issuing 250,000 new shares? Existing shareholder ownership will be diluted. Underwriting fees are 5% of proceeds.'))
        dispatch({type:'GO_PUBLIC'},'Initial public offering completed. Shares are now trading.');return;}
    if(button.hasAttribute('data-secondary-offering')){
      if(window.confirm('Issue additional shares equal to 8% of current shares outstanding? Existing shareholders will be diluted.'))
        dispatch({type:'SECONDARY_OFFERING'},'New corporate shares issued and funds received.');return;}
    if(button.dataset.personalTrade){
      const id=button.dataset.personalTrade,side=button.dataset.side;
      const shares=Number(window.prompt(`How many shares of ${id} do you want to ${side}? (1–2,000)`,'5'));
      if(!Number.isFinite(shares))return;
      dispatch({type:'PERSONAL_TRADE',id,side,shares},'Personal investment trade executed.');return;}
    if(button.dataset.globalRegion){globalRegion=button.dataset.globalRegion;render();return;}
    if(button.dataset.globalCity){listingFilter=button.dataset.globalCity;currentTab='locations';render();return;}
    if(button.dataset.globalFranchise){currentTab='franchises';render();return;}
    if(button.dataset.licenseCity){
      const city=CITIES[button.dataset.licenseCity],count=game.company.empire.franchises.filter(f=>f.cityId===button.dataset.licenseCity&&f.status!=='closed').length;
      const fee=160000+count*30000;
      if(window.confirm(`License a new ${city.name} franchise partner for ${money(fee)} upfront onboarding?\nTraining: 2 weeks. Royalties begin after the opening.`))
        dispatch({type:'LICENSE_FRANCHISE',cityId:button.dataset.licenseCity},'Franchise partner recruited and in training.');return;
    }
    if(button.dataset.buildHub){const def=EmpireWorld.regions[button.dataset.buildHub];
      if(window.confirm(`Build ${def.name} for ${money(def.costCents)}?\nWeekly overhead ${money(def.weeklyCents)}. Orders will now use warehouse shipping in this region.`))
        dispatch({type:'OPEN_WAREHOUSE',region:button.dataset.buildHub},'Regional distribution hub opened.');return;}
    if(button.dataset.warehouseBuy){
      const key=button.dataset.ingredient,region=button.dataset.warehouseBuy;
      const packs=Number(window.prompt(`How many packs of ${INGREDIENTS[key].name} should the ${regionLabel(region)} warehouse buy? (1–100)`, '5'));
      if(!Number.isFinite(packs))return;
      dispatch({type:'STOCK_WAREHOUSE',region,key,packs},'Warehouse inventory purchased.');return;
    }
    if(button.dataset.productDevelop){const p=EmpireWorld.devProjects[button.dataset.productDevelop];
      if(window.confirm(`Fund ${PRODUCTS[button.dataset.productDevelop].name} development for ${money(p.costCents)}?\nExpected development: ${p.weeks} week(s).`))
        dispatch({type:'DEVELOP_PRODUCT',id:button.dataset.productDevelop},'New product development started.');return;}
    if(button.dataset.executive){
      const id=button.dataset.executive,def=EmpireWorld.executives[id],hired=game.company.empire.executives[id];
      if(window.confirm(`${hired?'Dismiss':'Hire'} ${def.title}?${hired?'':`\nSigning: ${money(def.signingCents)}\nWeekly salary: ${money(def.salaryCents)}`}`))
        dispatch({type:hired?'FIRE_EXECUTIVE':'HIRE_EXECUTIVE',id},'Executive management updated.');return;}
    if (button.dataset.department) { switchDepartment(button.dataset.department); return; }
    if(button.dataset.forecast){forecastMode=button.dataset.forecast;render();return;}
    if (button.dataset.commandOpen!==undefined) { openCommand();return; }
    if (button.dataset.commandClose!==undefined) { closeCommand();return; }
    if (button.dataset.commandTab) { currentTab=button.dataset.commandTab;closeCommand();render();return; }
    if (button.dataset.ceoChoice) {
      const event=PHASE7_EVENTS.find(e=>e.id===game.company.phase7.event?.id);
      const choice=event?.choices.find(c=>c.id===button.dataset.ceoChoice);
      if(choice&&confirm(`Choose "${choice.name}" for ${money(choice.costCents)}?`))dispatch({type:'BOARD_DECISION',choice:choice.id},'Board decision recorded.');return;
    }
    if (button.dataset.contract) {
      const deal=PHASE7_DEALS[button.dataset.contract];
      if(deal&&confirm(`Sign ${deal.name}? Onboarding ${money(deal.setupCents)}, weekly target ${deal.target} cups, payout ${money(deal.payoutCents)} for ${deal.weeks} weeks.`))
        dispatch({type:'ACCEPT_CONTRACT',id:button.dataset.contract},'Commercial agreement activated.');return;
    }
    if (button.dataset.policy) {dispatch({type:'STRATEGY_POLICY',id:button.dataset.policy},'Corporate strategy updated.');return;}
    if (button.hasAttribute('data-green-upgrade')){dispatch({type:'SUSTAINABILITY_UPGRADE'},'Sustainability program upgraded.');return;}
    if (button.dataset.authMode){CLOUD.authMode=button.dataset.authMode;render();return;}
    if (button.dataset.cloudUpload){cloudUpload(button.dataset.cloudUpload);return;}
    if (button.dataset.cloudRestore){if(confirm('Restore this cloud game to this device? Your current browser game will be replaced.'))cloudRestore(button.dataset.cloudRestore);return;}
    if (button.hasAttribute('data-cloud-refresh')){refreshCloudSlots().catch(e=>showToast(e.message,true));return;}
    if (button.hasAttribute('data-cloud-sync')){CLOUD.dirty=true;performCloudSave();return;}
    if (button.hasAttribute('data-cloud-logout')){cloudSignOut();return;}
    if (button.hasAttribute('data-save-export')){downloadSave();return;}
    if (button.dataset.tab) { currentTab = button.dataset.tab; render(); return; }
    if (button.dataset.go) { currentTab = button.dataset.go; render(); return; }
    if (button.dataset.manage) { dispatch({ type: "SELECT_CAFE", id: button.dataset.manage }); currentTab = "operations"; render(); return; }
    if (button.dataset.openOwned) {
      const target = game.cafes.find(c => c.listingId === button.dataset.openOwned);
      if (target) { dispatch({ type: "SELECT_CAFE", id: target.id }); currentTab = "operations"; render(); }
      return;
    }
    if (button.dataset.filterCity) { listingFilter = button.dataset.filterCity; currentTab = "locations"; render(); return; }
    if (button.dataset.acquire) {
      const listing = LISTING_BY_ID[button.dataset.acquire];
      if (listing && window.confirm(`Buy ${listing.district}, ${CITIES[listing.cityId].name} now?\n\nPremium buildout: ${money(buyNowPrice(listing)-STARTER_STOCK_COST)}\nOpening inventory: ${money(STARTER_STOCK_COST)}\nTotal cash: ${money(buyNowPrice(listing))}\nWeekly rent: ${money(listing.rentCents)}\nInitial payroll: ${money(listing.staff * SALARY_CENTS)}`)) {
        dispatch({ type: "OPEN_CAFE", listingId: listing.id }, `${listing.district} is now open. Manage staffing and supply before the next week.`);
      }
      return;
    }
    if (button.id === "play-toggle") { paused = !paused; lastFrame = null; render(); return; }
    if (button.id === "next-week") { clockAccumulator = 0; dispatch({ type: "WEEK_TICK" }, `Week ${game.time.week - 1} settled across ${game.cafes.length} locations.`); return; }
    if (button.id === "new-game" || button.id === "new-game-mobile") {
      if (window.confirm("Start a new company? Your Phase 5 save will be replaced. Phase 1–4 saves remain untouched.")) {
        paused = true; clockAccumulator = 0;
        dispatch({ type: "NEW_GAME" }, "New company started.");
      }
      return;
    }
    if (button.dataset.hqUpgrade !== undefined) {
      const next = HQ_TIERS[game.company.hqTier+1];
      if (next && window.confirm(`Upgrade to ${next.name}?\n\nCapital cost: ${money(next.upgradeCents)}\nNew weekly overhead: ${money(next.weeklyCents)}`))
        dispatch({type:"HQ_UPGRADE"}, "Headquarters expanded. Corporate benefits are active.");
      return;
    }
    if (button.dataset.borrow) {
      const amountCents = Number(button.dataset.borrow), termWeeks = Number(document.getElementById("loan-term")?.value || 26);
      const payment = loanPayment(amountCents, termWeeks, creditTerms(termWeeks));
      if (window.confirm(`Borrow ${money(amountCents)} at ${percentage(creditTerms(termWeeks))} APR?\n\n${termWeeks} scheduled weekly payments of approximately ${money(payment)}.`))
        dispatch({type:"BORROW", amountCents, termWeeks}, "Bank financing completed. Cash increased, and debt is outstanding.");
      return;
    }
    if (button.dataset.payoff) {
      const loan = game.company.finance.loans.find(l => l.id === button.dataset.payoff);
      if (loan && window.confirm(`Pay off all ${money(loan.balanceCents)} of outstanding principal now?`))
        dispatch({type:"REPAY_LOAN", id: loan.id}, "Loan principal repaid in full.");
      return;
    }
    if (button.dataset.equity) {
      const amountCents = Number(button.dataset.equity), valuation = estimatedEquityValuation(game);
      const result = game.company.finance.founderOwnership * valuation / (valuation+amountCents);
      if (window.confirm(`Issue new shares for ${money(amountCents)}?\n\nPre-money value: ${money(valuation)}\nFounder stake after: ${percentage(result)}\nEquity dilution is permanent.`))
        dispatch({type:"RAISE_EQUITY",amountCents}, "Investment completed. The capitalization table has been updated.");
      return;
    }
    if (button.dataset.campaign) {
      const channel = button.dataset.campaign, cityId = channel === "national" ? "all" : (document.getElementById("campaign-city")?.value || "nyc");
      const campaign = MARKETING_CHANNELS[channel];
      if (campaign && window.confirm(`Launch ${campaign.name} in ${cityId==="all"?"all cities":CITIES[cityId].name}?\n\nCampaign cost: ${money(campaign.costCents)}\nDuration: ${campaign.weeks} weeks.`))
        dispatch({type:"LAUNCH_CAMPAIGN",channel,cityId}, "Campaign launched. Demand lift begins with the next settlement.");
      return;
    }
    if (button.dataset.managePeople) { dispatch({type:"SELECT_CAFE",id:button.dataset.managePeople});currentTab="people";render();return; }
    if (button.hasAttribute("data-train")) { dispatch({type:"TRAIN_STAFF"},"Team training completed and morale improved.");return; }
    if (button.hasAttribute("data-manager")) { dispatch({type:"MANAGER"},"Store manager hired.");return; }
    if (button.hasAttribute("data-remove-manager")) { dispatch({type:"REMOVE_MANAGER"},"Store manager removed.");return; }
    if (button.dataset.staff) { dispatch({ type: button.dataset.staff === "hire" ? "HIRE" : "FIRE" }, "Staffing updated for this location."); return; }
    if (button.hasAttribute("data-upgrade")) { dispatch({ type: "UPGRADE" }, "Equipment upgraded at the selected cafe."); return; }
    if (button.dataset.buy) { const item = INGREDIENTS[button.dataset.buy]; dispatch({ type: "BUY", key: button.dataset.buy }, `Purchased ${item.packQuantity} ${item.unit} of ${item.name.toLowerCase()}.`); return; }
    if (button.hasAttribute("data-copy-menu")) {
      const source = document.getElementById("menu-source");
      if (source) dispatch({ type: "COPY_MENU", fromId: source.value }, "Corporate menu prices and recipes copied.");
    }
  });
  document.addEventListener("change", event => {
    const input = event.target;
    if(input.id==='franchise-rate'){dispatch({type:'FRANCHISE_ROYALTY',rate:Number(input.value)},'Franchise royalty policy updated.');return;}
    if(input.dataset.studioPrice){dispatch({type:'PRICE',id:input.dataset.studioPrice,value:input.value},'Product price updated for selected cafe.');return;}
    if (input.id === "company-name") {dispatch({type:"COMPANY_NAME",value:input.value},"Corporate name updated.");return;}
    if (input.id === "wage-premium") {dispatch({type:"WAGE_POLICY",value:input.value},"Barista pay policy updated.");return;}
    if (input.id === "dividend-rate") {dispatch({type:"DIVIDEND_POLICY",value:input.value},"Profit distribution policy updated.");return;}
    if (input.id === "speed-select") { speed = Number(input.value); updateClockVisual(); return; }
    if (input.id === "active-cafe") { dispatch({ type: "SELECT_CAFE", id: input.value }); return; }
    if (input.id === "listing-city") { listingFilter = input.value; render(); return; }
    if (input.id === "auto-restock") { dispatch({ type: "AUTO_RESTOCK", value: input.checked }, "Local restock policy updated."); return; }
    if (input.dataset.price) { dispatch({ type: "PRICE", id: input.dataset.price, value: input.value }, "Local menu price updated."); return; }
    if (input.dataset.weight) { dispatch({ type: "WEIGHT", id: input.dataset.weight, value: input.value }, "Local demand weight updated."); return; }
    if (input.dataset.recipe) { dispatch({ type: "RECIPE", id: input.dataset.recipe, field: input.dataset.field, value: input.value }, "Location recipe updated."); return; }
    if (input.dataset.supplySetting) { dispatch({ type: "SUPPLY_SETTING", field: input.dataset.supplySetting, key: input.dataset.key, value: input.value }, "Local stock settings updated."); }
  });


  document.addEventListener("click",event=>{
    const button=event.target.closest("button");
    if(!button) return;
    if(button.dataset.mapProperty) {focusedMapPropertyId=button.dataset.mapProperty;render();return;}
    if(button.dataset.selectFlagship) {dispatch({type:"SELECT_CAFE",id:"cafe-1"});currentTab="operations";render();return;}
    if(button.dataset.mapList) {listingFilter=mapCityId;currentTab="locations";render();document.getElementById(`property-${button.dataset.mapList}`)?.scrollIntoView({behavior:"smooth",block:"center"});return;}
    if(button.dataset.openMap) {mapCityId=button.dataset.openMap;focusedMapPropertyId=LISTINGS.find(l=>l.cityId===mapCityId)?.id||"nyc-astoria";currentTab="map";render();return;}
    if(button.dataset.offerBid) {
      const listing=LISTING_BY_ID[button.dataset.offerBid], input=document.getElementById(`bid-${listing?.id}`);
      if(!listing||!input) return;
      const bidCents=cents(Number(input.value));
      if(!Number.isFinite(bidCents)) return showToast("Enter a valid cash bid.",true);
      if(window.confirm(`Submit sealed bid of ${money(bidCents)} on ${listing.district}?\n\nA total of ${money(bidCents+STARTER_STOCK_COST)} will be held in escrow for two weeks. A competing coffee chain could outbid you.`))
        dispatch({type:"BID_PROPERTY",listingId:listing.id,bidCents},"Sealed bid submitted and escrow reserved.");
      return;
    }
    if(button.dataset.withdrawBid) { if(window.confirm("Withdraw this bid? A 2% bid cancellation fee is nonrefundable.")) dispatch({type:"CANCEL_BID",listingId:button.dataset.withdrawBid},"Bid withdrawn and remaining escrow refunded.");return;}
    if(button.dataset.startResearch) {const project=RESEARCH[button.dataset.startResearch];if(project&&window.confirm(`Fund ${project.name} for ${money(project.costCents)}?\nResearch duration: ${project.weeks} weekly settlements.`))dispatch({type:"START_RESEARCH",id:button.dataset.startResearch},"R&D project funded. Development has started.");return;}
    if(button.dataset.pickSupplier) {const s=SUPPLIERS[button.dataset.pickSupplier];if(s&&window.confirm(`Switch to ${s.name}?\nOne-time onboarding: ${money(SUPPLIER_SWITCH_CENTS)}. New pricing and quality apply next week.`))dispatch({type:"SUPPLIER",id:button.dataset.pickSupplier},"Coffee sourcing contract updated.");return;}
    if(button.dataset.remodel) {
      const layout=STORE_LAYOUTS[button.dataset.remodel];
      if(layout && window.confirm(`Remodel this cafe for ${money(layout.remodelCents)}?\n${layout.description}`))
        dispatch({type:"STORE_LAYOUT",id:button.dataset.remodel},"Floorplan remodeled. New service capacity applies next week.");
      return;
    }
    if(button.hasAttribute("data-seating-upgrade")) {
      const next=SEATING_TIERS[getCafe(game).operations.seatingTier+1];
      if(next && window.confirm(`Expand seating to ${next.seats} seats for ${money(next.upgradeCents)}?`))
        dispatch({type:"SEATING_UPGRADE"},"Expanded seating is open.");
      return;
    }
    if(button.dataset.cleanPolicy) {dispatch({type:"CLEAN_POLICY",id:button.dataset.cleanPolicy},"Cleaning standards updated.");return;}
    if(button.dataset.loyaltyPolicy) {dispatch({type:"LOYALTY_PROGRAM",id:button.dataset.loyaltyPolicy},"Customer rewards program updated.");return;}
    if(button.dataset.specialize) {const s=SPECIALTIES[button.dataset.specialize];if(s&&window.confirm(`Assign ${s.name} to ${getCafe(game).district}?\nTraining cost: ${money(s.trainCents)}\nWeekly premium: ${money(s.weeklyCents)}`))dispatch({type:"SPECIALIZE",id:button.dataset.specialize},"Team specialization updated.");return;}
    if(button.dataset.takeover) {const r=game.rivals[button.dataset.city]?.find(r=>r.id===button.dataset.takeover);if(r&&window.confirm(`Acquire ${r.name} and all ${r.stores} cafes for ${money(acquisitionPrice(r))}?\nThis is a capital investment; the rival ceases independent operations.`))dispatch({type:"ACQUIRE_RIVAL",cityId:button.dataset.city,rivalId:r.id},`${r.name} has joined your company.`);return;}
  });
  document.addEventListener("change",event=>{
    if(event.target.id==="map-city") {mapCityId=event.target.value;focusedMapPropertyId=LISTINGS.find(l=>l.cityId===mapCityId).id;render();return;}
    if(event.target.id==="delivery-insurance") {dispatch({type:"DELIVERY_INSURANCE",value:event.target.checked},"Delivery protection policy updated.");return;}
  });

  document.addEventListener('submit',event=>{
    if(event.target?.id==='account-form') { event.preventDefault();cloudSignIn(CLOUD.authMode); }
  });
  document.addEventListener('input',event=>{
    if(event.target?.id==='command-input')renderCommandResults(event.target.value);
  });
  document.addEventListener('change',event=>{
    if(event.target?.id==='import-save'){importSave(event.target.files?.[0]);event.target.value='';}
  });
  document.addEventListener('keydown',event=>{
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){
      event.preventDefault();document.getElementById('command-dialog').hidden?openCommand():closeCommand();
    }
    if(event.key==='Escape')closeCommand();
  });
  document.getElementById('command-dialog').addEventListener('click',event=>{
    if(event.target.closest('[data-command-close]'))closeCommand();
  });

  // Stable API for testing and future modules; no gameplay mutation outside the reducer.
  window.RoasthouseEngine = Object.freeze({ initialState, migratePhase1, migratePhase2, migratePhase3, migratePhase4, upgradePhase4, upgradePhase5, upgradePhase6, upgradePhase7, migratePhase5, EmpireWorld,
    processWeek, reduce, weightedDemographicFactor, acquisitionPrice, reserveBid, buyNowPrice, resolveAuctions,
    recipeQuality, recipeRequirements, demandForProduct, allocateCapacity, loanPayment,
    CustomerEconomy, estimatedCost, storeWeeklyOverhead, seatCapacity,
    outstandingDebt, estimatedEquityValuation, marketingDemandFactor, localMarketShare,
    totalWeeklyPayroll, teamCapacity, procurementPackPrice, settleLoans,
    constants: Object.freeze({ EmpireWorld, PRODUCTS, INGREDIENTS, EQUIPMENT, CITIES, LISTINGS, HQ_TIERS,
      SEGMENTS, CITY_DEMOGRAPHICS, SUPPLIERS, SPECIALTIES, RESEARCH, MAP_COORDS,
      STORE_LAYOUTS, SEATING_TIERS, CLEANING_POLICIES, LOYALTY_POLICIES,
      MARKETING_CHANNELS, LOAN_TERMS, LOAN_AMOUNTS, EQUITY_OFFERS,
      STARTER_INVENTORY, STARTER_STOCK_COST }) });
  if (loaded.imported) saveState();
  render();
  initializeCloud();
  requestAnimationFrame(frame);
