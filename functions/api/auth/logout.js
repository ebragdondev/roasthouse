import {db,json,mutationGuard,readCookie,sha256,cookieHeader} from '../../../server/common.js';
export async function onRequestPost(context){
  const guard=mutationGuard(context);if(guard)return guard;
  const token=readCookie(context.request);
  if(/^[a-f0-9]{64}$/.test(token)){
    await db(context).prepare('DELETE FROM sessions WHERE token_hash=?').bind(await sha256(token)).run();
  }
  return json({authenticated:false},200,{'Set-Cookie':cookieHeader(context.request,'',true)});
}
