from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
html=(root/'dist/index.html').read_text()
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':390,'height':844})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('dialog',lambda d:d.accept())
 page.evaluate("""()=>{const data={};Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>data[k]??null,setItem:(k,v)=>{data[k]=String(v)},removeItem:k=>{delete data[k]},clear:()=>{for(const k in data)delete data[k]}}})}""")
 page.set_content(html,wait_until='domcontentloaded')
 print('loaded',page.evaluate('!!window.RoasthouseEngine'),flush=True)
 page.screenshot(path=str(root/'phase7_mobile_dashboard.png'),full_page=False,timeout=15000)
 print('dashboard',flush=True)
 for dept in ['overview','stores','expansion','products','corporate','finance']:
  page.evaluate('(dept)=>document.querySelector(`[data-department="${dept}"]`).click()',dept)
  print('department',dept,page.locator('#department-tabs .subnav-btn').count(),flush=True)
 for tab,dept in [('boardroom','overview'),('operations','stores'),('global','expansion'),('contracts','products'),('strategy','corporate'),('forecast','finance')]:
  page.evaluate('(dept)=>document.querySelector(`[data-department="${dept}"]`).click()',dept)
  page.evaluate('(tab)=>document.querySelector(`[data-tab="${tab}"]`).click()',tab)
  assert len(page.locator('#screen').inner_text())>100,(tab,errors)
  print('screen',tab,flush=True)
 page.screenshot(path=str(root/'phase7_mobile_forecast.png'),full_page=False,timeout=15000)
 page.locator('#account-chip').evaluate('(e)=>e.click()')
 page.screenshot(path=str(root/'phase7_mobile_account.png'),full_page=False,timeout=15000)
 print('account',flush=True)
 assert not errors,errors
 print('PASS mobile, rendered width',page.evaluate('document.documentElement.scrollWidth'),flush=True)
 browser.close()
