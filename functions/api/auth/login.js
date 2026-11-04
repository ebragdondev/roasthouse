import {db,json,fail,bodyJSON,mutationGuard,emailAddress,passwordHash,constantTimeEqual,createSession,throttle} from '../../../server/common.js';
export async function onRequestPost(context) {
  const guard=mutationGuard(context); if(guard)return guard;
  let input;try{input=await bodyJSON(context.request);}catch(e){return fail(e.message);}
  const email=emailAddress(input?.email),password=input?.password;
  if(!email||typeof password!=='string'||password.length>200)return fail('Invalid email or password.',401);
  if(await throttle(context,email))return fail('Too many attempts. Try again in 15 minutes.',429);
  const record=await db(context).prepare('SELECT id,email,salt,hash FROM users WHERE email=?').bind(email).first();
  // Still perform a slow hash if the account does not exist.
  const actual=await passwordHash(password,record?.salt||'00'.repeat(24));
  if(!record||!constantTimeEqual(actual,record.hash)){
    await throttle(context,email,true);return fail('Invalid email or password.',401);
  }
  await throttle(context,email,false,true);
  const cookie=await createSession(context,record.id);
  return json({authenticated:true,user:{id:record.id,email:record.email}},200,{'Set-Cookie':cookie});
}
