from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
html=(root/'dist/index.html').read_text()
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1400,'height':880});errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('dialog',lambda d:d.accept())
 page.evaluate("""()=>{
  const storage={};Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>storage[k]??null,setItem:(k,v)=>{storage[k]=String(v)}}});
  window.__mock={user:null,slots:{}};
  window.fetch=async(url,opts={})=>{
   const m=window.__mock,method=opts.method||'GET',body=opts.body?JSON.parse(opts.body):{};
   let out={};let status=200;
   if(url==='/api/auth/me')out={configured:true,authenticated:!!m.user,user:m.user};
   else if(url==='/api/auth/login'||url==='/api/auth/register'){m.user={id:'123',email:body.email};out={authenticated:true,user:m.user};}
   else if(url==='/api/saves')out={slots:Object.entries(m.slots).map(([slot,v])=>({slot,revision:v.revision,week:v.state.time.week,updatedAt:Date.now()}))};
   else if(url.startsWith('/api/saves/')){const slot=url.slice('/api/saves/'.length);if(method==='PUT'){
    const rev=(m.slots[slot]?.revision||0)+1;m.slots[slot]={revision:rev,state:body.state};out={slot,revision:rev,week:body.state.time.week,updatedAt:Date.now()};
   }else if(m.slots[slot])out={slot,revision:m.slots[slot].revision,state:m.slots[slot].state};else{out={error:'missing'};status=404;}}
   else if(url==='/api/auth/logout'){m.user=null;out={authenticated:false};}
   return new Response(JSON.stringify(out),{status,headers:{'Content-Type':'application/json'}});
  };
 }""")
 page.set_content(html,wait_until='domcontentloaded')
 page.wait_for_timeout(150)
 page.locator('#account-chip').click()
 page.locator('[data-auth-mode="register"]').click()
 page.locator('#auth-email').fill('qa@example.com')
 page.locator('#auth-password').fill('strongpassword1234')
 page.locator('#account-form button[type="submit"]').click()
 page.wait_for_timeout(250)
 assert 'Signed in as qa@example.com' in page.locator('#screen').inner_text()
 page.locator('[data-cloud-upload="autosave"]').click()
 page.wait_for_timeout(350)
 assert page.evaluate('window.__mock.slots.autosave.revision')==1
 page.locator('#next-week').click()
 page.wait_for_timeout(1500)
 assert page.evaluate('window.__mock.slots.autosave.revision')>=2
 page.screenshot(path=str(root/'phase7_desktop_cloud.png'),full_page=False)
 assert not errors,errors
 print('PASS browser client account registration, cloud upload, autosave and signed-in UI')
 browser.close()
