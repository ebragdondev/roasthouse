import {authOrFail,bodyJSON,fail,json,mutationGuard,slotId} from '../../../server/common.js';
export async function onRequestGet(context){
  const slot=slotId(context.params.slot);if(!slot)return fail('Unknown save slot.',404);
  const {user,error}=await authOrFail(context);if(error)return error;
  const row=await context.env.DB.prepare('SELECT state,revision,week,updated_at AS updatedAt FROM saves WHERE user_id=? AND slot=?').bind(user.id,slot).first();
  return row?json({slot,revision:row.revision,week:row.week,updatedAt:row.updatedAt,state:JSON.parse(row.state)}):fail('No cloud save in that slot.',404);
}
export async function onRequestPut(context){
  const guard=mutationGuard(context);if(guard)return guard;
  const slot=slotId(context.params.slot);if(!slot)return fail('Unknown save slot.',404);
  const {user,error}=await authOrFail(context);if(error)return error;
  let body;try{body=await bodyJSON(context.request,2500000);}catch(e){return fail(e.message,413);}
  const state=body?.state,expected=body?.expectedRevision;
  if(!state||state.version!==7||!Number.isInteger(state.time?.week)||!Number.isSafeInteger(state.company?.cashCents)||!Array.isArray(state.cafes)||!state.cafes.length||!Number.isSafeInteger(expected)||expected<0)
    return fail('Invalid save data or revision.',422);
  const serialized=JSON.stringify(state);
  if(serialized.length>2500000)return fail('Save exceeds 2.5 MB.',413);
  const now=Date.now();
  let result;
  if(expected===0){
    result=await context.env.DB.prepare(`INSERT INTO saves (user_id,slot,state,revision,week,updated_at) VALUES (?,?,?,1,?,?)
      ON CONFLICT(user_id,slot) DO NOTHING`).bind(user.id,slot,serialized,state.time.week,now).run();
  }else{
    result=await context.env.DB.prepare(`UPDATE saves SET state=?,revision=revision+1,week=?,updated_at=?
      WHERE user_id=? AND slot=? AND revision=?`).bind(serialized,state.time.week,now,user.id,slot,expected).run();
  }
  if(!result.meta?.changes){
    const latest=await context.env.DB.prepare('SELECT revision,week,updated_at AS updatedAt FROM saves WHERE user_id=? AND slot=?').bind(user.id,slot).first();
    return json({error:'Cloud save changed elsewhere. Choose which version to keep.',conflict:true,remote:latest},409);
  }
  return json({slot,revision:expected+1,week:state.time.week,updatedAt:now});
}
export async function onRequestDelete(context){
  const guard=mutationGuard(context);if(guard)return guard;
  const slot=slotId(context.params.slot);if(!slot)return fail('Unknown save slot.',404);
  const {user,error}=await authOrFail(context);if(error)return error;
  await context.env.DB.prepare('DELETE FROM saves WHERE user_id=? AND slot=?').bind(user.id,slot).run();
  return json({deleted:true,slot});
}
