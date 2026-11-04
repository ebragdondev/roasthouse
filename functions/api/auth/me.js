import {db,json,authUser} from '../../../server/common.js';
export async function onRequestGet(context) {
  if(!db(context))return json({authenticated:false,configured:false});
  const user=await authUser(context);
  return json({authenticated:!!user,configured:true,user:user?{id:user.id,email:user.email}:null});
}
