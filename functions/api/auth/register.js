import {db, json, fail, bodyJSON, mutationGuard, emailAddress, passwordHash, randomHex, createSession, throttle} from '../../../server/common.js';
export async function onRequestPost(context) {
  const guard = mutationGuard(context); if (guard) return guard;
  let payload; try { payload = await bodyJSON(context.request); } catch (e) { return fail(e.message); }
  const email = emailAddress(payload?.email), password = payload?.password;
  if (!email) return fail('Enter a valid email address.');
  if (typeof password !== 'string' || password.length < 10 || password.length > 200) return fail('Password must be 10–200 characters.');
  if (await throttle(context,email)) return fail('Too many attempts. Try again in 15 minutes.',429);
  const id = crypto.randomUUID(), salt = randomHex(24), hash = await passwordHash(password,salt);
  try { await db(context).prepare('INSERT INTO users (id,email,salt,hash,created_at) VALUES (?,?,?,?,?)')
    .bind(id,email,salt,hash,Date.now()).run(); }
  catch (error) { if (/unique|constraint/i.test(String(error))) return fail('An account with this email already exists.',409); throw error; }
  const cookie = await createSession(context,id);
  return json({ user:{id,email}, authenticated:true },201,{'Set-Cookie':cookie});
}
