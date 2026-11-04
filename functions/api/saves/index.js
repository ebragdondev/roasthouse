import {authOrFail,json} from '../../../server/common.js';
export async function onRequestGet(context){
  const {user,error}=await authOrFail(context);if(error)return error;
  const rows=await context.env.DB.prepare('SELECT slot,revision,week,updated_at AS updatedAt FROM saves WHERE user_id=? ORDER BY updated_at DESC').bind(user.id).all();
  return json({slots:rows.results||[]});
}
