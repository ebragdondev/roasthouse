const assert=require('node:assert/strict');
const fs=require('node:fs');
const {DatabaseSync}=require('node:sqlite');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const db=new DatabaseSync(':memory:');db.exec(fs.readFileSync(path.join(root,'migrations/0001_auth_saves.sql'),'utf8'));
const wrap={prepare(sql){const stmt=db.prepare(sql);return {bind(...args){this.args=args;return this},
  async run(){return {meta:{changes:Number(stmt.run(...(this.args||[])).changes)}}},
  async first(){return stmt.get(...(this.args||[]))||null},
  async all(){return {results:stmt.all(...(this.args||[]))}}
}}};
const origin='https://coffee.local';
const modules={};
(async()=>{
 for(const name of ['register','login','logout','me'])modules[name]=await import(path.join(root,'functions/api/auth',name+'.js'));
 for(const name of ['index','[slot]'])modules[name]=await import(path.join(root,'functions/api/saves',name+'.js'));
 let checks=0;
 async function call(name,method,body,token='',slot='autosave',requestOrigin=origin){
  const headers={'Origin':requestOrigin,'Accept':'application/json'};
  if(body!==undefined)headers['Content-Type']='application/json';
  if(token)headers.Cookie=`rh_session=${token}`;
  const request=new Request(`${origin}/api/${name}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
  const context={request,env:{DB:wrap},params:{slot}};
  let handler=modules[name==='slot'?'[slot]':name==='slots'?'index':name]?.[`onRequest${method[0]+method.slice(1).toLowerCase()}`];
  assert(handler,`missing ${name} ${method}`);
  const response=await handler(context);
  const payload=await response.json();checks++;
  return {status:response.status,payload,cookie:response.headers.get('Set-Cookie')};
 }
 const email='someone@example.com',password='really-good-password-8672';
 let r=await call('register','POST',{email,password});assert.equal(r.status,201);const cookie=r.cookie.match(/rh_session=([0-9a-f]{64})/)[1];
 assert(r.cookie.includes('HttpOnly')&&r.cookie.includes('Secure')&&r.cookie.includes('SameSite=Lax'));checks++;
 assert.equal((await call('me','GET',undefined,cookie)).payload.authenticated,true);checks++;
 assert.equal((await call('register','POST',{email,password})).status,409);checks++;
 assert.equal((await call('login','POST',{email,password:'wrong-password'})).status,401);checks++;
 assert.equal((await call('login','POST',{email,password},'', 'autosave','https://attacker.example')).status,403);checks++;
 const login=await call('login','POST',{email,password});assert.equal(login.status,200);checks++;
 const game={version:7,time:{week:3},company:{cashCents:1000000},cafes:[{id:'test'}]};
 const original=await call('slot','PUT',{state:game,expectedRevision:0},cookie);assert.equal(original.status,200);assert.equal(original.payload.revision,1);checks+=2;
 const wrong=await call('slot','PUT',{state:game,expectedRevision:0},cookie);assert.equal(wrong.status,409);assert.equal(wrong.payload.remote.revision,1);checks+=2;
 game.time.week=4;
 const next=await call('slot','PUT',{state:game,expectedRevision:1},cookie);assert.equal(next.status,200);assert.equal(next.payload.revision,2);checks+=2;
 const listing=await call('slots','GET',undefined,cookie);assert.equal(listing.payload.slots.length,1);checks++;
 const restore=await call('slot','GET',undefined,cookie);assert.equal(restore.payload.week,4);checks++;
 const other=await call('register','POST',{email:'other@example.com',password});assert.equal(other.status,201);const otherCookie=other.cookie.match(/rh_session=([0-9a-f]{64})/)[1];
 assert.equal((await call('slot','GET',undefined,otherCookie)).status,404);checks++;
 assert.equal((await call('slot','PUT',{state:game,expectedRevision:2},otherCookie)).status,409);checks++;
 assert.equal((await call('slot','DELETE',undefined,cookie)).status,200);checks++;
 assert.equal((await call('slot','GET',undefined,cookie)).status,404);checks++;
 assert.equal((await call('logout','POST',{},cookie)).status,200);checks++;
 assert.equal((await call('me','GET',undefined,cookie)).payload.authenticated,false);checks++;
 console.log('Cloud API PASS:',checks,'request/authorization checks (D1-compatible in-memory SQLite)');
})().catch(e=>{console.error(e);process.exitCode=1});
