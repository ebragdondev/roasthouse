from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
html=(root/'dist/index.html').read_text()
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for w,h,label in [(1440,900,'desktop'),(390,844,'mobile')]:
  page=browser.new_page(viewport={'width':w,'height':h});errors=[]
  page.on('pageerror',lambda err:errors.append(str(err)))
  page.evaluate("""()=>{const mem={};Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>mem[k]??null,setItem:(k,v)=>mem[k]=String(v)}})}""")
  page.set_content(html,wait_until='load')
  page.screenshot(path=str(root/f'phase7_final_{label}_dashboard.png'),full_page=False)
  if label=='desktop':
   page.evaluate("()=>{document.querySelector('[data-department=\"corporate\"]').click();document.querySelector('[data-tab=\"strategy\"]').click()}")
   page.screenshot(path=str(root/'phase7_final_desktop_strategy.png'),full_page=False)
   page.evaluate("()=>{document.querySelector('[data-department=\"finance\"]').click();document.querySelector('[data-tab=\"forecast\"]').click()}")
   page.screenshot(path=str(root/'phase7_final_desktop_forecast.png'),full_page=False)
   page.evaluate("()=>document.querySelector('#account-chip').click()")
   page.screenshot(path=str(root/'phase7_final_desktop_account.png'),full_page=False)
  else:
   page.evaluate("()=>{document.querySelector('[data-department=\"products\"]').click();document.querySelector('[data-tab=\"contracts\"]').click()}")
   page.screenshot(path=str(root/'phase7_final_mobile_deals.png'),full_page=False)
  assert not errors,errors
  print('PASS final render',label,'page width:',page.evaluate('document.documentElement.scrollWidth'))
  page.close()
 browser.close()
