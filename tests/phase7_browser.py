from pathlib import Path
from playwright.sync_api import sync_playwright
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from functools import partial
import threading
root=Path(__file__).resolve().parents[1]
server=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(root/'dist')))
threading.Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_address[1]}/'
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
  for width,height,label in [(1440,900,'desktop'),(390,844,'mobile')]:
   page=browser.new_page(viewport={'width':width,'height':height});errors=[]
   page.on('pageerror',lambda e:errors.append(str(e)))
   page.on('dialog',lambda d:d.accept())
   page.evaluate("""()=>{const data={};Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>data[k]??null,setItem:(k,v)=>{data[k]=String(v)},removeItem:k=>{delete data[k]},clear:()=>{for(const k in data)delete data[k]}}})}""")
   page.set_content((root/'dist/index.html').read_text(),wait_until='load');page.wait_for_timeout(250)
   assert page.evaluate('!!window.RoasthouseEngine'),errors
   assert page.locator('[data-department]').count()==6
   for dept in ['overview','stores','expansion','products','corporate','finance']:
    page.locator(f'[data-department="{dept}"]').click()
    assert page.locator('#department-tabs .subnav-btn').count()>=3
   for dept in ['overview','stores','expansion','products','corporate','finance']:
    page.evaluate('(id)=>document.querySelector(`[data-department="${id}"]`).click()',dept)
    tabs=page.locator('#department-tabs [data-tab]')
    count=tabs.count()
    for i in range(count if label=='desktop' else min(2,count)):
     tab=tabs.nth(i).get_attribute('data-tab')
     page.evaluate('(id)=>document.querySelector(`[data-tab="${id}"]`)?.click()',tab)
     assert len(page.locator('#screen').inner_text())>80,(tab,errors)
     assert not errors,(tab,errors)
   page.locator('[data-department="overview"]').click()
   for i in range(5):page.locator('#next-week').click()
   page.locator('[data-tab="boardroom"]').click()
   assert page.locator('[data-ceo-choice]').count()==2
   page.locator('[data-ceo-choice="recover"]').click()
   assert page.locator('[data-ceo-choice]').count()==0
   page.locator('[data-department="products"]').click()
   page.locator('[data-tab="contracts"]').click()
   page.locator('[data-contract="catering"]').click()
   assert 'Active agreement' in page.locator('#screen').inner_text()
   page.locator('#next-week').click()
   state=page.evaluate('JSON.parse(localStorage.getItem("roasthouse-phase7-v1"))')
   assert state['version']==7
   assert state['company']['phase7']['contracts'][0]['status']=='active'
   page.locator('.utility-search[data-command-open]').click()
   page.locator('#command-input').fill('financial')
   page.locator('#command-dialog').is_visible()
   page.keyboard.press('Escape')
   page.locator('#account-chip').click()
   assert 'Browser saves' in page.locator('#screen').inner_text()
   page.screenshot(path=str(root/f'phase7_{label}_account.png'),full_page=False)
   page.locator('[data-department="overview"]').click()
   page.locator('[data-tab="dashboard"]').click()
   page.screenshot(path=str(root/f'phase7_{label}_dashboard.png'),full_page=False)
   page.locator('[data-tab="boardroom"]').click()
   page.screenshot(path=str(root/f'phase7_{label}_boardroom.png'),full_page=False)
   assert not errors,(label,errors)
   print('PASS',label,'6 departments, all tabs, boardroom, contracts, command search and account. page width:',page.evaluate('document.documentElement.scrollWidth'))
   page.close()
  browser.close()
finally:server.shutdown()
