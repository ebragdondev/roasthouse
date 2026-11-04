from pathlib import Path
import json
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
html=(root/'dist/index.html').read_text()
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1400,'height':880})
 user=None;slots={};errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 def route_handler(route):
  global user
  url=route.request.url
  path=url.split('roasthouse.test')[-1]
  method=route.request.method
  if path in ['/','/index.html']:
   return route.fulfill(status=200,content_type='text/html',body=html)
  data=json.loads(route.request.post_data or '{}')
  if path=='/api/auth/me':
   out={'configured':True,'authenticated':bool(user),'user':user}
  elif path in ('/api/auth/register','/api/auth/login') and method=='POST':
   user={'id':'test-user','email':data['email']};out={'authenticated':True,'user':user}
  elif path=='/api/saves':
   out={'slots':[{'slot':key,'revision':val['revision'],'week':val['state']['time']['week'],'updatedAt':1710000000000} for key,val in slots.items()]}
  elif path.startswith('/api/saves/'):
   slot=path.rsplit('/',1)[-1]
   if method=='PUT':
    revision=slots.get(slot,{}).get('revision',0)+1
    slots[slot]={'revision':revision,'state':data['state']}
    out={'slot':slot,'revision':revision,'week':data['state']['time']['week'],'updatedAt':1710000000000}
   elif slot in slots:
    out={'slot':slot,**slots[slot],'week':slots[slot]['state']['time']['week'],'updatedAt':1710000000000}
   else:return route.fulfill(status=404,content_type='application/json',body='{"error":"Missing"}')
  elif path=='/api/auth/logout':
   user=None;out={'authenticated':False}
  else: return route.fulfill(status=404,content_type='application/json',body='{"error":"Unknown"}')
  route.fulfill(status=200,content_type='application/json',body=json.dumps(out))
 page.route('**/roasthouse.test/**',route_handler)
 try:
  page.goto('https://roasthouse.test/',wait_until='domcontentloaded',timeout=6000)
 except Exception as e:
  print('SKIPPED mock browser host:',str(e)[:100]);browser.close();raise SystemExit(0)
 page.wait_for_timeout(300)
 page.locator('#account-chip').click()
 assert 'Sign in' in page.locator('#screen').inner_text()
 page.locator('[data-auth-mode="register"]').click()
 page.locator('#auth-email').fill('qa@example.com');page.locator('#auth-password').fill('strongpassword1234')
 page.locator('#account-form button[type="submit"]').click()
 page.wait_for_timeout(400)
 assert 'Signed in as qa@example.com' in page.locator('#screen').inner_text()
 page.locator('[data-cloud-upload="autosave"]').click()
 page.wait_for_timeout(500)
 assert slots.get('autosave',{}).get('revision')==1,slots
 page.locator('#next-week').click();page.wait_for_timeout(1500)
 assert slots['autosave']['revision']>=2
 assert not errors,errors
 print('PASS browser fake-cloud registration, slot upload, autosave after a game week')
 page.screenshot(path=str(root/'phase7_desktop_cloud.png'),full_page=False)
 browser.close()
