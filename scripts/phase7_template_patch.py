from pathlib import Path
p=Path(__file__).resolve().parent.parent/'template.html'
s=p.read_text()
s=s.replace('<title>Roasthouse — Coffee Empire (Phase 5)</title>','<title>Roasthouse — The Next Chapter | Phase 7</title>')
s=s.replace('content="#08141a"','content="#151613"')
start=s.index('      <div class="side-label">MANAGEMENT</div>')
end=s.index('      <div class="side-bottom">',start)
nav='''      <div class="side-label">YOUR COMPANY</div>
      <nav class="department-nav" aria-label="Main departments">
        <button class="nav-btn active" data-department="overview"><span class="nav-icon">◉</span><span>Overview</span><span class="nav-arrow">›</span></button>
        <button class="nav-btn" data-department="stores"><span class="nav-icon">▦</span><span>My Cafes</span><span class="nav-arrow">›</span></button>
        <button class="nav-btn" data-department="expansion"><span class="nav-icon">◎</span><span>Expansion</span><span class="nav-arrow">›</span></button>
        <button class="nav-btn" data-department="products"><span class="nav-icon">☕</span><span>Products</span><span class="nav-arrow">›</span></button>
        <button class="nav-btn" data-department="corporate"><span class="nav-icon">⌘</span><span>Corporate</span><span class="nav-arrow">›</span></button>
        <button class="nav-btn" data-department="finance"><span class="nav-icon">↗</span><span>Finance</span><span class="nav-arrow">›</span></button>
      </nav>
      <button class="sidebar-search" data-command-open><span>⌕</span> Search any feature <kbd>⌘K</kbd></button>
'''
s=s[:start]+nav+s[end:]
s=s.replace('PHASE 06 · GLOBAL EMPIRE<br>Progress automatically saves in this browser.','PHASE 07 · THE NEXT CHAPTER<br>Autosave locally · Optional cloud sync')
s=s.replace('<main>\n      <div class="top">','<main>\n      <div class="main-utility"><div class="utility-path">ROASTHOUSE <span> / </span> <b id="mobile-dept-label">Overview</b></div><div class="utility-actions"><button class="utility-search" data-command-open title="Find a management screen">⌕ <span>Quick find</span></button><button id="account-chip" class="account-chip" data-tab="account"><span class="profile-avatar">◎</span><span class="profile-text">Account<small>Local play</small></span></button></div></div>\n      <div class="top">')
s=s.replace('      <div id="screen" aria-live="off"></div>','      <div class="department-tabs" id="department-tabs" aria-label="Department navigation"></div>\n      <div id="screen" aria-live="off"></div>')
s=s.replace('  <div id="toast-slot" role="status" aria-live="polite"></div>','''  <div id="toast-slot" role="status" aria-live="polite"></div>
  <div id="command-dialog" class="command-dialog" hidden>
    <div class="command-backdrop" data-command-close></div>
    <div class="command-panel" role="dialog" aria-modal="true" aria-label="Navigate to a game screen">
      <div class="command-top"><span>⌕</span><input id="command-input" placeholder="Where do you want to go?" autocomplete="off" aria-label="Find a screen"><button class="btn" data-command-close>ESC</button></div>
      <div id="command-results" class="command-results"></div>
      <div class="command-footer">Search any feature from the six main departments</div>
    </div>
  </div>''')
css='''
/* ===============================================================
   PHASE 7 — ORIGINAL COMPLETE VISUAL SYSTEM (ESPRESSO / LIME / SAND)
   =============================================================== */
:root{--bg:#111410;--sidebar:#141914;--surface:#1e251d;--surface-2:#272f25;--surface-3:#313c2f;
 --stroke:#394337;--muted:#aab5a5;--white:#f5f2e6;--accent:#d1e78d;--accent-dark:#202c15;
 --blue:#98c8dd;--amber:#f1c17a;--red:#f29e98;--shadow:0 16px 44px #04080548;
 font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
body{background:radial-gradient(ellipse 55% 45% at 98% 2%,#323d2280,transparent 90%),#111410;color:var(--white)}
.app{grid-template-columns:242px minmax(0,1fr)}
aside{background:linear-gradient(180deg,#1b2119 0%,#10150f 100%);border-right:1px solid #3d4834;padding:23px 14px 17px;box-shadow:8px 0 30px #00000024;z-index:4}
.brand{margin:2px 11px 32px;gap:12px}.brand-icon{border-radius:14px;background:linear-gradient(150deg,#f3cda1,#c9eaa5);box-shadow:0 8px 25px #d1e78d22;width:45px;height:45px;color:#1c2815;font-size:25px}
.brand-name{font-size:19px;letter-spacing:-1px}.brand-sub{letter-spacing:2.1px;font-size:8px;color:#9cae8f}.brand-name span{color:#d4ea9d!important}
.side-label{font-size:9px;color:#93a485;letter-spacing:2px;margin-bottom:15px}
.department-nav{display:grid;gap:8px;overflow:visible}
.department-nav .nav-btn{width:100%;border:1px solid transparent;border-radius:12px;font-size:13px;padding:14px 13px;color:#b8c1ae;transition:background .15s,border-color .15s}
.department-nav .nav-btn .nav-icon{background:#2c3529;border-radius:9px;width:29px;height:29px;display:grid;place-items:center;color:#c6d3b4;font-size:18px}
.department-nav .nav-btn.active{background:linear-gradient(110deg,#414b2c,#29391f);border-color:#697847;color:#eff6d3;box-shadow:inset 3px 0 #cde28e}
.department-nav .nav-btn.active .nav-icon{color:#1f2a17;background:#d4e795}
.department-nav .nav-btn:hover{background:#2a3425;border-color:#465640;color:#f6f8ed}
.nav-arrow{margin-left:auto;color:#b8c2a7;font-size:20px}
.sidebar-search{background:#252d22;color:#abb99e;border:1px solid #3e4c37;width:100%;border-radius:11px;text-align:left;font-size:11px;padding:13px 11px;margin-top:24px;display:flex;align-items:center;gap:8px}
.sidebar-search span{font-size:18px}.sidebar-search kbd{margin-left:auto;border:1px solid #43523d;border-radius:5px;padding:3px 6px;color:#cdd6bd;font-size:9px}
.location-card{background:linear-gradient(130deg,#2b3824,#1b271d);border:1px solid #47533f;border-radius:13px}
.location-card .tiny{color:#a2b29a}.location-card strong{font-size:13px}.location-card small{line-height:1.6}
.side-footer{color:#909e8a;font-size:10px}.side-bottom{margin-top:auto}
main{padding:22px clamp(18px,3.2vw,58px) 65px;max-width:1680px}
.main-utility{display:flex;justify-content:space-between;align-items:center;gap:12px;padding-bottom:22px;border-bottom:1px solid #3b4236;margin-bottom:30px}
.utility-path{font-size:10px;font-weight:800;letter-spacing:1.6px;color:#abb8a4}.utility-path span{color:#71846d;margin:0 7px}.utility-path b{color:#d2e8a0}
.utility-actions{display:flex;align-items:center;gap:13px}.utility-search{color:#c4d3b8;background:transparent;border:0;font-size:12px;padding:8px;display:flex;align-items:center;gap:8px}
.account-chip{min-width:140px;display:flex;align-items:center;gap:10px;background:#2a3325;border:1px solid #43533c;border-radius:12px;color:#f1f6e7;padding:7px 12px;text-align:left}
.profile-avatar{width:31px;height:31px;border-radius:10px;display:grid;place-items:center;background:#d9eaa5;color:#23321b;font-weight:900}
.profile-text{font-size:11px;font-weight:800;display:flex;flex-direction:column;gap:3px;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.profile-text small{color:#aebfa5;font-size:9px;font-weight:500}
.top{gap:15px;margin-bottom:22px}h1{font-size:clamp(28px,3vw,44px);letter-spacing:-2px;font-weight:760}.eyebrow{color:#d1e78d}.subtitle{color:#b8c6b2}
.date-chip{background:#242f20;border-color:#506045;color:#e4efd5}.btn{background:#323d2d;border-color:#4d5a45;color:#f5f2e6;border-radius:10px}
.btn.primary{background:#d6e994;border-color:#d6e994;color:#1e2a18}.btn.subtle{color:#dde4d5}
.btn:hover:not(:disabled){filter:brightness(1.13)}
.department-tabs{display:block;border-bottom:1px solid #44503c;margin:0 0 26px}.department-tabs[hidden]{display:none!important}
.department-label{font-size:11px;color:#c9d8be;font-weight:850;letter-spacing:.4px;margin-bottom:15px;display:flex;align-items:center;gap:9px}
.department-label>span:first-child{background:#3a4b2d;color:#dce7b2;border-radius:7px;display:inline-grid;place-items:center;width:25px;height:25px;font-size:16px}
.dept-count{font-size:9px;color:#b0bea7;letter-spacing:0;font-weight:600}
.subnav-list{display:flex;gap:5px;overflow-x:auto;scrollbar-width:thin;scrollbar-color:#5b7044 transparent}
.subnav-btn{color:#aebcaa;font-size:12px;font-weight:650;padding:12px 16px 14px;background:transparent;border:0;border-bottom:3px solid transparent;white-space:nowrap}
.subnav-btn:hover{color:white}.subnav-btn.active{color:#e0f3b0;border-color:#d4ed94}
.card,.panel{border:1px solid #3e4a39;background:linear-gradient(145deg,#222c20,#1c241b);border-radius:18px;box-shadow:0 9px 28px #0003}
.panel{padding:24px}.kpi{padding:22px}.kpi-head{color:#b8c8b1}.kpi-icon{background:#3a4c2d;color:#d5eda0}.kpi-value{color:#f9f7ea}
.chart text{opacity:.84}.bar{background:#3b4b35}.bar>div{background:#d0e891}.dot{background:#d0e891}.dot.blue{background:var(--blue)}
.stat-row{border-color:#3b4936}.stat-row span,.help{color:#afbdab}.pill{background:#3a4e2a;color:#d4ec98}.pill.neutral{background:#364137;color:#d1ddc9}
.notice{background:#2d3c2b;border-color:#536646;color:#dce7d5}.notice.warning{background:#423327;border-color:#7e5f3f}
.property-card,.location-tile,.offer-card,.corporate-tile,.active-campaign{background:linear-gradient(130deg,#283225,#1c281e);border-color:#43533c}
.location-tile.selected{background:#34462b;border-color:#a5c77b}
.gl-hero,.p7-feature-hero{background:linear-gradient(120deg,#323b2b,#1b2720 72%);border:1px solid #526a42;border-radius:19px;box-shadow:0 18px 55px #080c082a}
.gl-stat,.gl-exec{background:#263126;border-color:#526041}.gl-statement .gl-stat{background:transparent}
input.num,select,.text-input,input[type="email"],input[type="password"]{background:#161f17;border:1px solid #51614b;color:#f6f6e9}
input:focus,select:focus{border-color:#bddb80}
td{border-color:#3e493b}.gl-stat strong{color:#f3f3e5}
.phase7-quickbar{display:flex;justify-content:space-between;align-items:center;gap:15px;background:linear-gradient(110deg,#424a2b,#253428);border:1px solid #71814a;border-radius:16px;padding:18px 21px;margin-bottom:22px;flex-wrap:wrap}
.phase7-quickbar>div:first-child{display:flex;align-items:center;gap:13px}.quick-icon{font-size:25px;color:#deeba2}.phase7-quickbar strong{display:block;font-size:14px}.phase7-quickbar small{display:block;font-size:11px;color:#c4cfb4;margin-top:5px}.quick-actions{display:flex;gap:10px;flex-wrap:wrap}
.p7-feature-hero{padding:clamp(22px,3.5vw,36px);margin-bottom:23px;position:relative;overflow:hidden}
.p7-feature-hero:after{content:'◉';position:absolute;right:30px;top:-100px;font-size:270px;line-height:1;color:#cce88b08;pointer-events:none}
.p7-feature-hero h2{font-size:clamp(26px,3vw,40px);letter-spacing:-1.3px;margin:10px 0 12px;max-width:750px}.p7-feature-hero p{color:#c1d0b8;line-height:1.7;max-width:830px;font-size:13px}
.p7-ministats{display:flex;gap:12px;flex-wrap:wrap;margin-top:24px}.p7-ministats>span{border:1px solid #63704d;border-radius:10px;padding:10px 12px;color:#c0cfb6;font-size:11px;background:#111c1240}.p7-ministats b{color:#eff4cb;margin-left:7px}
.p7-card-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(255px,1fr));gap:16px;margin-bottom:24px}.p7-card-grid>.panel{display:flex;flex-direction:column;align-items:flex-start;gap:8px}.p7-card-grid>.panel .btn{margin-top:auto}
.p7-columns{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-bottom:24px}
.choice-card{background:linear-gradient(140deg,#2a3727,#1d251b);border:1px solid #596b4a;border-radius:17px;padding:24px}.choice-card h3{font-size:19px;line-height:1.4;margin:12px 0}.choice-card .btn{width:100%;margin-top:12px}
.milestone-row{display:grid;grid-template-columns:90px 1fr;gap:10px;padding:14px 5px;border-top:1px solid #3c4b39}.milestone-row>span{color:#a5bd94;font-size:11px}.milestone-row strong{display:block;font-size:12px}.milestone-row small{display:block;margin-top:6px;color:#aab9a2;font-size:10px}
.contract-card h3{font-size:18px;line-height:1.3;margin:12px 0 0}.contract-card .help{min-height:45px}.contract-card .details-list{width:100%}
.achievement{display:flex!important;flex-direction:row!important;gap:17px!important}.achievement-emblem{border-radius:13px;flex:0 0 48px;height:48px;display:grid;place-items:center;background:#37492e;color:#d8efa5;font-size:25px}.achievement.locked{opacity:.67}.achievement h3{font-size:15px;margin:0 0 8px}.achievement .help{min-height:35px}
.p7-meter{height:9px;background:#40523c;border-radius:30px;max-width:640px;overflow:hidden;margin-top:22px}.p7-meter div{height:100%;background:linear-gradient(90deg,#a2c86c,#e2f2ae);border-radius:30px}
.p7-account-grid{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(270px,.75fr);gap:18px}.account-status{display:inline-flex;align-items:center;gap:10px;background:#1a281c;border:1px solid #496447;color:#e4f1db;padding:11px 15px;border-radius:11px;font-size:12px;font-weight:650}.status-indicator{width:8px;height:8px;background:#eeb175;border-radius:100%}.status-indicator.online{background:#d0ef9a}
.account-form{max-width:450px;display:grid;gap:13px}.account-form label{font-size:12px;color:#d0dec8;display:grid;gap:8px}.account-form input{border-radius:10px;padding:14px;font-size:13px;width:100%}.account-form button{width:max-content;margin-top:6px}
.text-button{border:0;background:transparent;color:#d6eaa1;padding:12px 0;text-decoration:underline;font-size:12px}.account-upload{cursor:pointer;display:inline-flex;align-items:center}
.save-slots{display:grid;gap:10px}.save-slot{padding:13px;border:1px solid #465640;border-radius:12px;background:#222e20;display:flex;align-items:center;gap:13px;flex-wrap:wrap}.slot-symbol{width:36px;height:36px;border-radius:10px;background:#394c31;display:grid;place-items:center;font-size:19px}.slot-summary{flex:1;min-width:140px}.slot-summary strong,.slot-summary small{display:block}.slot-summary strong{font-size:12px}.slot-summary small{color:#aabda4;font-size:10px;margin-top:5px}.slot-actions{display:flex;gap:8px}.slot-actions .btn{padding:8px 11px;font-size:11px}
.command-dialog[hidden]{display:none}.command-dialog{position:fixed;inset:0;z-index:9999;display:flex;justify-content:center;align-items:flex-start;padding:12vh 20px 20px}.command-backdrop{position:absolute;inset:0;background:#070b07dd;backdrop-filter:blur(9px)}.command-panel{width:min(650px,100%);position:relative;background:#222c20;border:1px solid #687c57;border-radius:18px;box-shadow:0 35px 110px #0009;overflow:hidden}.command-top{display:flex;align-items:center;gap:13px;padding:17px;border-bottom:1px solid #4a5743}.command-top>span{font-size:25px;color:#d5ec9b}.command-top input{flex:1;color:#f3f9e9;background:transparent;border:0;outline:none;font-size:17px;min-width:0}.command-results{max-height:55vh;overflow:auto;padding:9px}.command-results button{border:0;border-radius:10px;background:transparent;color:#f2f4e7;display:flex;width:100%;padding:14px 15px;justify-content:space-between;gap:10px;text-align:left;font-size:13px}.command-results button:hover{background:#384b2e}.command-results small{color:#b6caa4}.command-footer{font-size:10px;color:#9eb293;padding:12px 18px;border-top:1px solid #414d3c}
@media(max-width:1100px){.p7-account-grid{grid-template-columns:1fr}}
@media(max-width:820px){.app{display:block}aside{position:relative;height:auto;padding:15px 14px 0;overflow:visible;border-right:0;border-bottom:1px solid #45553b}.brand{margin:0 0 14px}.side-label,.sidebar-search,.side-bottom{display:none}.department-nav{display:flex;overflow-x:auto;gap:6px;scrollbar-width:none;padding:0 0 10px}.department-nav .nav-btn{flex:0 0 auto;width:auto;font-size:11px;padding:8px 11px}.department-nav .nav-btn .nav-icon{width:27px;height:27px;font-size:15px}.department-nav .nav-arrow{display:none}main{padding:20px 17px 55px}.main-utility{margin-bottom:22px;padding-bottom:14px}.utility-search span{display:none}.top{margin-bottom:12px}.department-label{margin-bottom:8px}.subnav-btn{padding:11px 13px 13px;font-size:11px}.p7-columns{grid-template-columns:1fr}}
@media(max-width:600px){.utility-actions{gap:5px}.account-chip{min-width:0;padding:6px}.profile-text{display:none}.utility-path{font-size:9px}.p7-feature-hero{padding:23px}.p7-feature-hero h2{font-size:27px}.p7-card-grid{grid-template-columns:1fr}.choice-card{padding:18px}.save-slot{align-items:flex-start}.slot-actions{width:100%}.slot-actions .btn{flex:1}.phase7-quickbar{padding:15px}.phase7-quickbar .quick-actions{width:100%}.command-dialog{padding:8vh 10px 10px}}
'''
s=s.replace('</style>',css+'</style>',1)
p.write_text(s)
