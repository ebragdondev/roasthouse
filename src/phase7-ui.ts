// @ts-nocheck
// Navigation, boardroom, commercial deals and Cloudflare D1 account/save UI.
const DEPARTMENTS = Object.freeze([
  {id:'overview',title:'Overview',icon:'◉',tabs:[['dashboard','Command center'],['boardroom','CEO briefing'],['achievements','Milestones'],['worldnews','News']]},
  {id:'stores',title:'My Cafes',icon:'▦',tabs:[['operations','Store operations'],['storedesign','Design & service'],['customers','Customers'],['people','Team'],['marketing','Marketing'],['supply','Inventory'],['insights','Unit economics']]},
  {id:'expansion',title:'Expansion',icon:'◎',tabs:[['global','Global markets'],['map','City atlas'],['locations','Real estate'],['franchises','Franchises'],['markets','Market research'],['rivals','Rivals'],['acquisitions','Acquisitions']]},
  {id:'products',title:'Products',icon:'☕',tabs:[['productstudio','Product studio'],['research','R&D'],['sourcing','Sourcing'],['distribution','Warehouses'],['contracts','Commercial deals']]},
  {id:'corporate',title:'Corporate',icon:'⌘',tabs:[['strategy','Strategy'],['headquarters','Headquarters'],['leadership','Executive team']]},
  {id:'finance',title:'Finance',icon:'↗',tabs:[['statements','Statements'],['forecast','Forecasting'],['finance','Banking'],['capital','Public markets'],['founder','Founder wealth']]}
]);
const ROUTE_TO_DEPT = Object.fromEntries(DEPARTMENTS.flatMap(dept=>dept.tabs.map(([key])=>[key,dept.id])));
const NAV_LABELS = Object.fromEntries(DEPARTMENTS.flatMap(dept=>dept.tabs));
function switchDepartment(dept){
  const section=DEPARTMENTS.find(d=>d.id===dept);
  if(!section)return;
  // Preserve the most recently used subtab per department.
  currentTab=lastDepartmentTab[dept]||section.tabs[0][0];render();
}
const lastDepartmentTab={};
function renderSubnavigation(){
  const deptId=ROUTE_TO_DEPT[currentTab];
  if(deptId)lastDepartmentTab[deptId]=currentTab;
  document.querySelectorAll('[data-department]').forEach(btn=>{
    const active=btn.dataset.department===deptId;
    btn.classList.toggle('active',active);btn.setAttribute('aria-current',active?'page':'false');
  });
  const region=document.getElementById('department-tabs');
  const dept=DEPARTMENTS.find(d=>d.id===deptId);
  if(!region)return;
  region.hidden=!dept;
  region.innerHTML=dept?`<div class="department-label"><span>${dept.icon}</span> ${dept.title}<span class="dept-count">${dept.tabs.length} views</span></div><div class="subnav-list" role="navigation" aria-label="${dept.title} sections">${dept.tabs.map(([id,label])=>`<button type="button" class="subnav-btn ${currentTab===id?'active':''}" data-tab="${id}" ${currentTab===id?'aria-current="page"':''}>${escaped(label)}</button>`).join('')}</div>`:'';
  document.getElementById('mobile-dept-label').textContent=dept?dept.title:'Account';
}
function renderDashboard7(){
  const p=game.company.phase7, active=p.contracts.filter(c=>c.status==='active');
  const awaiting=!!p.event;
  const teaser=`<div class="phase7-quickbar">
    <div><span class="quick-icon">✦</span><div><strong>CEO intelligence</strong><small>${awaiting?'Board decision requires your attention':'Your leadership decisions shape long-term growth'}</small></div></div>
    <div class="quick-actions"><button class="btn ${awaiting?'primary':''}" data-go="boardroom">${awaiting?'Review decision':'Boardroom'} →</button><button class="btn" data-go="contracts">${active.length} active deals</button></div></div>`;
  return teaser+renderDashboard4();
}
function renderBoardroom(){
  const p=game.company.phase7;
  const event=PHASE7_EVENTS.find(e=>e.id===p.event?.id);
  const choices=event?event.choices.map(c=>`<article class="choice-card"><div class="small-caps">LEADERSHIP OPTION</div><h3>${escaped(c.name)}</h3><div class="details-list">${stat('Immediate cost',money(c.costCents))}${stat('Reputation',`${c.rep>=0?'+':''}${c.rep} pts`)}${stat('Global awareness',`${c.awareness>=0?'+':''}${c.awareness} pts`)}${stat('Team morale',`${c.morale>=0?'+':''}${c.morale} pts`)}</div><button class="btn ${c.costCents?'primary':''}" data-ceo-choice="${c.id}" ${c.costCents>game.company.cashCents?'disabled':''}>Choose this response</button></article>`).join(''):'';
  const recent=p.decisions.slice(0,8).map(d=>`<div class="milestone-row"><span>Week ${d.week}</span><div><strong>${escaped(d.label)}</strong><small>${money(d.costCents)} committed</small></div></div>`).join('')||'<p class="help">Your first board decision will appear around week 5.</p>';
  return `<section class="p7-feature-hero"><span class="eyebrow">EXECUTIVE OFFICE / LIVE BRIEFING</span><h2>${event?escaped(event.label):'Your desk is clear.'}</h2><p>${event?escaped(event.summary):'Every fifth simulated week, major leadership decisions arise. Each choice has consequences for cash, brand trust, local demand or employee morale.'}</p><div class="p7-ministats"><span>Brand reputation <b>${game.company.brand.reputation.toFixed(1)}/100</b></span><span>Board confidence <b>${game.company.finance.boardConfidence.toFixed(0)}/100</b></span><span>Decisions taken <b>${p.decisions.length}</b></span></div></section>
  ${event?`<div class="p7-columns">${choices}</div>`:`<div class="notice">No active decision. Advance the simulation to encounter new strategic events.</div>`}
  <section class="panel"><div class="panel-head"><div><h2>Decision history</h2><p>Permanent record of your last 24 board responses.</p></div></div>${recent}</section>`;
}
function renderContracts(){
  const p=game.company.phase7;
  const active=p.contracts.filter(c=>c.status==='active');
  const sold=game.company.lastWeek?.unitsSold||0;
  const choices=Object.entries(PHASE7_DEALS).map(([key,d])=>{
    const isActive=active.some(c=>c.id===key);
    return `<article class="panel contract-card"><div class="small-caps">COMMERCIAL GROWTH</div><h3>${d.name}</h3><p class="help">${d.description}</p><div class="details-list">${stat('Minimum weekly sales',whole(d.target)+' cups')}${stat('Payment when fulfilled',money(d.payoutCents)+'/wk')}${stat('Onboarding charge',money(d.setupCents))}${stat('Agreement term',d.weeks+' weeks')}${stat('Current company sales',whole(sold)+' cups')}</div><button class="btn primary" data-contract="${key}" ${isActive||active.length>=3||game.company.cashCents<d.setupCents?'disabled':''}>${isActive?'Active agreement':'Accept agreement'}</button></article>`;
  }).join('');
  const rows=p.contracts.slice().reverse().map(c=>{const d=PHASE7_DEALS[c.id];return `<tr><td>${escaped(d.name)}</td><td>${c.status==='active'?'In force':'Completed'}</td><td>${c.weeksRemaining}</td><td>${c.fulfilled}</td><td>${c.missed}</td><td>${money(c.earnedCents)}</td></tr>`;}).join('');
  return `<div class="p7-feature-hero"><span class="eyebrow">B2B REVENUE / WHOLESALE OPPORTUNITIES</span><h2>Make your network work harder.</h2><p>Commercial agreements pay real weekly revenue when your owned cafes collectively sell enough units. Missing commitments damages brand trust. Onboarding costs hit the P&L at weekly close.</p><div class="p7-ministats"><span>Active <b>${active.length}/3</b></span><span>Lifetime contract earnings <b>${money(p.earnedContractCents)}</b></span><span>Missed delivery weeks <b>${p.missedContractWeeks}</b></span></div></div>
  <div class="p7-card-grid">${choices}</div><section class="panel"><div class="panel-head"><div><h2>Agreement ledger</h2><p>Contracts settle at the end of every week.</p></div></div><div class="table-wrap"><table><thead><tr><th>Agreement</th><th>Status</th><th>Weeks left</th><th>Fulfilled</th><th>Missed</th><th>Revenue</th></tr></thead><tbody>${rows||'<tr><td colspan="6">No agreements signed yet.</td></tr>'}</tbody></table></div></section>`;
}
function renderStrategy(){
  const p=game.company.phase7;
  return `<section class="p7-feature-hero"><span class="eyebrow">CORPORATE STRATEGY</span><h2>Choose what your brand stands for.</h2><p>Strategy changes propagate through the weekly demand engine using reputation and local brand awareness. Build a differentiated business—don't treat every market identically.</p><div class="p7-ministats"><span>Strategy <b>${PHASE7_POLICIES[p.policy].name}</b></span><span>Sustainability <b>Tier ${p.sustainabilityTier}</b></span><span>Brand trust <b>${game.company.brand.reputation.toFixed(1)}</b></span></div></section>
  <div class="section-heading"><h2>Positioning</h2><span class="section-note">Switching strategy costs $1,250</span></div><div class="p7-card-grid">${Object.entries(PHASE7_POLICIES).map(([id,d])=>`<article class="panel"><span class="pill ${p.policy===id?'':'neutral'}">${p.policy===id?'ACTIVE STRATEGY':'ALTERNATIVE'}</span><h3 style="margin:15px 0 9px">${d.name}</h3><p class="help">${d.description}</p><div class="notice">${d.effect}</div><button class="btn ${p.policy===id?'':'primary'}" data-policy="${id}" ${p.policy===id||game.company.cashCents<125000?'disabled':''}>${p.policy===id?'Current strategy':'Adopt this strategy'}</button></article>`).join('')}</div>
  <div class="section-heading"><h2>Sustainability program</h2></div><div class="p7-card-grid">${PHASE7_SUSTAINABILITY.map((d,i)=>`<article class="panel"><span class="pill ${i<=p.sustainabilityTier?'':'neutral'}">TIER ${i}</span><h3 style="margin:15px 0 8px">${d.name}</h3><p class="help">${d.description}</p><div class="details-list">${stat('Investment',money(d.investCents))}${stat('Weekly overhead',money(d.weeklyCents))}</div><button class="btn ${i===p.sustainabilityTier+1?'primary':''}" data-green-upgrade ${i!==p.sustainabilityTier+1||game.company.cashCents<d.investCents?'disabled':''}>${i<=p.sustainabilityTier?'Achieved':i===p.sustainabilityTier+1?'Upgrade program':'Requires previous tier'}</button></article>`).join('')}</div>`;
}
function renderAchievements(){
  const passed=PHASE7_ACHIEVEMENTS.filter(a=>a.check(game)).length;
  return `<section class="p7-feature-hero"><span class="eyebrow">CAREER PROGRESS / MILESTONES</span><h2>${passed} of ${PHASE7_ACHIEVEMENTS.length} milestones achieved.</h2><p>Track your journey from opening a single flagship to running a global public company. These achievements reflect live simulation results.</p><div class="p7-meter"><div style="width:${passed/PHASE7_ACHIEVEMENTS.length*100}%"></div></div></section><div class="p7-card-grid">${PHASE7_ACHIEVEMENTS.map(a=>`<article class="panel achievement ${a.check(game)?'earned':'locked'}"><div class="achievement-emblem">${a.icon}</div><div><h3>${a.name}</h3><p class="help">${a.desc}</p><span class="pill ${a.check(game)?'':'neutral'}">${a.check(game)?'Completed':'Not yet unlocked'}</span></div></article>`).join('')}</div>`;
}

// Account + persistence. Local saves remain available in file:// and offline mode.
const CLOUD={configured:false,user:null,slots:[],activeSlot:null,revision:0,enabled:false,busy:false,dirty:false,
  status:'Browser save only',authMode:'login',lastSavedAt:null,conflict:false};
let cloudTimer=null;
async function cloudRequest(path,method='GET',body){
  const options={method,credentials:'same-origin',headers:{'Accept':'application/json'}};
  if(body!==undefined){options.headers['Content-Type']='application/json';options.body=JSON.stringify(body);}
  const result=await fetch(`/api/${path}`,options);
  let parsed;try{parsed=await result.json();}catch{throw new Error('The cloud account service is unavailable on this deployment.');}
  if(!result.ok){const e=new Error(parsed.error||'Cloud service error.');e.code=result.status;e.payload=parsed;throw e;}
  return parsed;
}
async function initializeCloud(){
  if(location.protocol==='file:'){CLOUD.status='Offline: account backend requires deployment';updateAccountChip();return;}
  try{
    const response=await cloudRequest('auth/me');
    CLOUD.configured=!!response.configured;
    CLOUD.user=response.user||null;
    CLOUD.status=CLOUD.configured?(CLOUD.user?'Signed in · select a cloud slot':'Cloud accounts available'):'Backend not configured';
    if(CLOUD.user)await refreshCloudSlots(false);
  }catch{CLOUD.status='Cloud accounts unavailable (local saves work)';}
  updateAccountChip();if(currentTab==='account')render();
}
async function refreshCloudSlots(redraw=true){
  if(!CLOUD.user)return;
  const result=await cloudRequest('saves');
  CLOUD.slots=result.slots||[];
  if(redraw&&currentTab==='account')render();
}
function updateAccountChip(){
  const button=document.getElementById('account-chip');if(!button)return;
  button.innerHTML=CLOUD.user?`<span class="profile-avatar">${escaped(CLOUD.user.email[0].toUpperCase())}</span><span class="profile-text">${escaped(CLOUD.user.email.split('@')[0])}<small>${CLOUD.enabled?'Cloud sync on':'Choose save slot'}</small></span>`:`<span class="profile-avatar">◎</span><span class="profile-text">Account<small>${CLOUD.configured?'Cloud saves available':'Local play'}</small></span>`;
}
function scheduleCloudSave(){
  if(!CLOUD.enabled||!CLOUD.user||CLOUD.conflict)return;
  CLOUD.dirty=true;
  clearTimeout(cloudTimer);
  cloudTimer=setTimeout(()=>performCloudSave(),900);
}
async function performCloudSave(){
  if(!CLOUD.enabled||!CLOUD.user||CLOUD.conflict||!CLOUD.activeSlot)return;
  if(CLOUD.busy){CLOUD.dirty=true;return;}
  if(!CLOUD.dirty)return;
  CLOUD.busy=true;CLOUD.dirty=false;CLOUD.status='Saving to cloud…';
  const snapshot=copy(game),slot=CLOUD.activeSlot,rev=CLOUD.revision;
  try{
    const result=await cloudRequest(`saves/${slot}`,'PUT',{state:snapshot,expectedRevision:rev});
    CLOUD.revision=result.revision;CLOUD.lastSavedAt=result.updatedAt;CLOUD.status='Cloud saved';
    await refreshCloudSlots(false);
  }catch(e){
    CLOUD.status=e.code===409?'Conflict: cloud version changed':`Save failed: ${e.message}`;
    CLOUD.conflict=e.code===409;CLOUD.enabled=false;
    if(CLOUD.conflict)try{await refreshCloudSlots(false);}catch{}
    showToast(CLOUD.status,true);
  }finally{
    CLOUD.busy=false;
    if(CLOUD.enabled&&CLOUD.dirty)scheduleCloudSave();
    if(currentTab==='account')render();updateAccountChip();
  }
}
async function cloudSignIn(mode){
  const email=document.getElementById('auth-email')?.value;
  const password=document.getElementById('auth-password')?.value;
  if(!email||!password){showToast('Enter an email and password.',true);return;}
  CLOUD.status='Authenticating…';
  try{
    const result=await cloudRequest(`auth/${mode}`,'POST',{email,password});
    CLOUD.user=result.user;CLOUD.activeSlot=null;CLOUD.revision=0;CLOUD.enabled=false;CLOUD.conflict=false;
    CLOUD.status='Signed in. Choose whether to upload or restore a save.';
    await refreshCloudSlots(false);render();showToast('Signed in. Your local game has not been overwritten.');
  }catch(e){CLOUD.status=e.message;showToast(e.message,true);}
  updateAccountChip();
}
async function cloudSignOut(){
  if(CLOUD.busy)return showToast('Finish saving before signing out.',true);
  try{await cloudRequest('auth/logout','POST',{});}catch(e){showToast(e.message,true);return;}
  CLOUD.user=null;CLOUD.slots=[];CLOUD.activeSlot=null;CLOUD.revision=0;CLOUD.enabled=false;CLOUD.conflict=false;
  CLOUD.status='Signed out (local progress preserved)';render();showToast('Signed out. Browser save remains on this device.');
}
async function cloudRestore(slot){
  try{
    const record=await cloudRequest(`saves/${slot}`);
    const restored=upgradePhase7(record.state);
    if(!isValidSave(restored))throw Error('Cloud save is incompatible or damaged.');
    paused=true;game=restored;CLOUD.activeSlot=slot;CLOUD.revision=record.revision;CLOUD.enabled=true;CLOUD.conflict=false;CLOUD.dirty=false;
    CLOUD.status=`Restored ${slot} · cloud sync active`;
    localStorage.setItem(SAVE_KEY,JSON.stringify(game));render();showToast('Cloud save restored. Automatic cloud saves are active.');
  }catch(e){showToast(e.message,true);}
}
async function cloudUpload(slot){
  const existing=CLOUD.slots.find(s=>s.slot===slot);
  if(existing&&!confirm(`Replace the cloud save in ${slot} (week ${existing.week}) with this browser game (week ${game.time.week})?`))return;
  CLOUD.activeSlot=slot;CLOUD.revision=existing?.revision||0;CLOUD.enabled=true;CLOUD.conflict=false;CLOUD.dirty=true;
  await performCloudSave();
  if(CLOUD.enabled)showToast('Cloud slot selected. Future game changes sync automatically.');
}
function downloadSave(){
  const blob=new Blob([JSON.stringify({format:'roasthouse-save-v7',exportedAt:new Date().toISOString(),state:game},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;
  anchor.download=`roasthouse-week-${game.time.week}-${new Date().toISOString().slice(0,10)}.json`;
  document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
}
async function importSave(file){
  if(!file)return;
  if(file.size>2500000)return showToast('Save file exceeds 2.5 MB.',true);
  try{
    const parsed=JSON.parse(await file.text());const raw=parsed.state||parsed;let state=null;
    if(raw.version===7)state=upgradePhase7(raw);
    else if(raw.version===6)state=upgradePhase7(raw);
    else if(raw.version===5)state=upgradePhase7(migratePhase5(raw));
    else if(raw.version===4)state=upgradePhase7(migratePhase4(raw));
    else if(raw.version===3)state=upgradePhase7(migratePhase3(raw));
    else if(raw.version===2)state=upgradePhase7(upgradePhase6(upgradePhase5(upgradePhase4(migratePhase2(raw)))));
    else if(raw.version===1)state=upgradePhase7(upgradePhase6(upgradePhase5(upgradePhase4(migratePhase1(raw)))));
    if(!isValidSave(state))throw Error('This file is not a valid supported Roasthouse save.');
    if(!confirm(`Import week ${state.time.week} from this file? It will replace the current browser game. Export a backup first if needed.`))return;
    paused=true;game=state;CLOUD.enabled=false;CLOUD.activeSlot=null;CLOUD.status='Imported game (cloud syncing paused)';
    localStorage.setItem(SAVE_KEY,JSON.stringify(game));render();showToast('Save imported. Cloud syncing is off until you choose a slot.');
  }catch(e){showToast(e.message||'Could not import this save.',true);}
}
function renderAccount(){
  const status=`<div class="account-status"><span class="status-indicator ${CLOUD.enabled?'online':''}"></span>${escaped(CLOUD.status)}</div>`;
  const offline=`<section class="panel"><h2>Browser saves and backups</h2><p class="help">Your current game autosaves on this device. Export a portable JSON file to safeguard progress or move between computers.</p><div class="btn-row"><button class="btn primary" data-save-export>Download save file</button><label class="btn account-upload">Import save file<input id="import-save" type="file" accept=".json,application/json" style="display:none"></label></div></section>`;
  const authForm=`<section class="panel"><div class="panel-head"><div><h2>${CLOUD.authMode==='register'?'Create an account':'Sign in to Roasthouse'}</h2><p>Use an email and a secure password (minimum 10 characters).</p></div></div><form id="account-form" class="account-form"><label>Email address<input type="email" id="auth-email" autocomplete="email" required placeholder="you@example.com"></label><label>Password<input type="password" id="auth-password" autocomplete="${CLOUD.authMode==='register'?'new-password':'current-password'}" minlength="10" maxlength="200" required placeholder="10+ characters"></label><button class="btn primary" type="submit">${CLOUD.authMode==='register'?'Create account':'Sign in'}</button></form><button class="text-button" data-auth-mode="${CLOUD.authMode==='login'?'register':'login'}">${CLOUD.authMode==='login'?'New here? Create an account':'Already registered? Sign in'}</button><p class="help" style="margin-top:16px">Cloud accounts require Cloudflare Pages Functions and a configured D1 database. Passwords are never stored in the browser or in plaintext on the server. Email verification and password recovery are not included in this release.</p></section>`;
  const cloudSlots=['autosave','slot1','slot2','slot3'].map(slot=>{
    const item=CLOUD.slots.find(s=>s.slot===slot);
    const active=CLOUD.enabled&&CLOUD.activeSlot===slot;
    return `<article class="save-slot"><div class="slot-symbol">${slot==='autosave'?'↻':'▣'}</div><div class="slot-summary"><strong>${slot==='autosave'?'Autosave':`Manual slot ${slot.slice(-1)}`}</strong><small>${item?`Week ${item.week} · ${new Date(item.updatedAt).toLocaleString()}`:'Empty slot'}</small></div>${active?'<span class="pill">SYNCING</span>':''}<div class="slot-actions">${item?`<button class="btn" data-cloud-restore="${slot}">Restore</button>`:''}<button class="btn ${!item?'primary':''}" data-cloud-upload="${slot}">${item?'Overwrite':'Save here'}</button></div></article>`;
  }).join('');
  const cloudPanel=CLOUD.user?`<section class="panel"><div class="panel-head"><div><h2>Signed in as ${escaped(CLOUD.user.email)}</h2><p>Cloud saves are separate from browser saves until you explicitly choose Upload or Restore.</p></div><button class="btn" data-cloud-logout>Sign out</button></div><div class="save-slots">${cloudSlots}</div><div class="btn-row"><button class="btn" data-cloud-refresh>Refresh slots</button>${CLOUD.enabled?'<button class="btn primary" data-cloud-sync>Save now</button>':''}</div>${CLOUD.conflict?'<div class="notice warning">This save changed elsewhere. Reload the latest cloud copy, or select Overwrite to intentionally replace it.</div>':''}</section>`:(CLOUD.configured?authForm:`<div class="notice warning"><strong>Cloud accounts unavailable here.</strong> To enable them, deploy this project to Cloudflare Pages with Functions and a D1 database binding named DB. You can still play, autosave locally, and export progress.</div>`);
  return `<section class="p7-feature-hero"><span class="eyebrow">PROFILE / DATA PROTECTION</span><h2>Your empire, your saves.</h2><p>Move between devices with authenticated cloud slots, or keep a portable offline copy. Sign-in never silently replaces your current game.</p>${status}</section><div class="p7-account-grid">${cloudPanel}${offline}</div>`;
}
function renderCommandResults(query=''){
  const box=document.getElementById('command-results');if(!box)return;
  const rows=DEPARTMENTS.flatMap(d=>d.tabs.map(([id,name])=>({id,name,dept:d.title})));
  const filtered=rows.filter(r=>`${r.name} ${r.dept}`.toLowerCase().includes(query.toLowerCase())).slice(0,14);
  box.innerHTML=filtered.map(r=>`<button data-command-tab="${r.id}"><span>${r.name}</span><small>${r.dept}</small></button>`).join('')||'<p class="help">No matching screen.</p>';
}
function openCommand(){const box=document.getElementById('command-dialog');box.hidden=false;renderCommandResults('');document.getElementById('command-input')?.focus();}
function closeCommand(){document.getElementById('command-dialog').hidden=true;}
