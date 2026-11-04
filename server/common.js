// Cloudflare Pages Functions shared auth/storage primitives. No third-party runtime dependencies.
const encoder = new TextEncoder();
const COOKIE = 'rh_session';
const SESSION_SECONDS = 30 * 24 * 60 * 60;
const ITERATIONS = 230_000;
export const json = (data, status = 200, headers = {}) => Response.json(data, {
  status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers }
});
export const fail = (message, status = 400) => json({ error: message }, status);
export function db(context) { return context.env?.DB; }
export function sameOrigin(request) {
  const origin = request.headers.get('Origin');
  if (origin) return origin === new URL(request.url).origin;
  const site = request.headers.get('Sec-Fetch-Site');
  return site === 'same-origin' || site === 'none';
}
export function mutationGuard(context) {
  if (!db(context)) return fail('Cloud saves are not configured on this deployment.', 503);
  if (!sameOrigin(context.request)) return fail('Cross-origin request denied.', 403);
  return null;
}
export function readCookie(request, name = COOKIE) {
  const cookie = request.headers.get('Cookie') || '';
  const hit = cookie.split(';').map(part => part.trim()).find(part => part.startsWith(`${name}=`));
  return hit ? hit.slice(name.length + 1) : '';
}
function toHex(bytes) { return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join(''); }
function fromHex(value) { return Uint8Array.from(value.match(/../g) || [], byte => Number.parseInt(byte, 16)); }
export function randomHex(length = 32) { return toHex(crypto.getRandomValues(new Uint8Array(length))); }
export async function sha256(value) { return toHex(await crypto.subtle.digest('SHA-256', encoder.encode(value))); }
export async function passwordHash(password, salt) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  return toHex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: fromHex(salt), iterations: ITERATIONS }, material, 256));
}
export function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  let value = a.length ^ b.length;
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i++) value |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return value === 0;
}
export function emailAddress(value) {
  const email = String(value ?? '').trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/.test(email) ? email : '';
}
export async function bodyJSON(request, maxChars = 2048) {
  const length = Number(request.headers.get('Content-Length') || 0);
  if (length > maxChars * 4) throw Error('Request body too large.');
  const text = await request.text();
  if (text.length > maxChars) throw Error('Request body too large.');
  try { return JSON.parse(text); } catch { throw Error('Invalid JSON body.'); }
}
export function cookieHeader(request, token, expire = false) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE}=${expire ? '' : token}; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=${expire ? 0 : SESSION_SECONDS}`;
}
export async function createSession(context, userId) {
  const token = randomHex();
  const hash = await sha256(token);
  const now = Math.floor(Date.now() / 1000);
  await db(context).prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(hash, userId, now + SESSION_SECONDS).run();
  return cookieHeader(context.request, token);
}
export async function authUser(context) {
  if (!db(context)) return null;
  const token = readCookie(context.request);
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  const hash = await sha256(token);
  return await db(context).prepare(`SELECT users.id, users.email, users.created_at AS createdAt
    FROM sessions INNER JOIN users ON users.id=sessions.user_id
    WHERE sessions.token_hash=? AND sessions.expires_at>?`)
    .bind(hash, Math.floor(Date.now()/1000)).first();
}
export async function authOrFail(context) {
  if (!db(context)) return { error: fail('Cloud saves are not configured on this deployment.', 503) };
  const user = await authUser(context);
  return user ? { user } : { error: fail('Sign in to use cloud saves.', 401) };
}
export async function throttle(context, email, failure = false, clear = false) {
  const ip = context.request.headers.get('CF-Connecting-IP') || 'unknown';
  const key = await sha256(`${ip.toLowerCase()}|${email}`);
  const now = Math.floor(Date.now() / 1000);
  if (clear) { await db(context).prepare('DELETE FROM login_attempts WHERE key=?').bind(key).run(); return false; }
  if (failure) {
    await db(context).prepare(`INSERT INTO login_attempts (key, started_at, attempts) VALUES (?, ?, 1)
      ON CONFLICT(key) DO UPDATE SET
      attempts=CASE WHEN started_at<? THEN 1 ELSE attempts+1 END,
      started_at=CASE WHEN started_at<? THEN excluded.started_at ELSE started_at END`)
      .bind(key, now, now-900, now-900).run();
    return false;
  }
  const row = await db(context).prepare('SELECT attempts, started_at FROM login_attempts WHERE key=?').bind(key).first();
  return !!(row && row.started_at > now-900 && row.attempts >= 8);
}
export function slotId(value) { return ['autosave', 'slot1', 'slot2', 'slot3'].includes(value) ? value : ''; }
