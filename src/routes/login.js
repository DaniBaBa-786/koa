import Router from "@koa/router";
import { db } from "../db.js";
import { createToken } from "../auth.js";

const router = new Router({ prefix: "/api" });

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// Tracks failed attempts per IP and per account email.
const attemptsByIp = new Map();
const attemptsByEmail = new Map();

function isLimited(map, key) {
  const entry = map.get(key);
  if (!entry) return false;
  if (Date.now() - entry.firstAttempt > WINDOW_MS) {
    map.delete(key);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

function recordFailure(map, key) {
  const entry = map.get(key);
  if (!entry || Date.now() - entry.firstAttempt > WINDOW_MS) {
    map.set(key, { count: 1, firstAttempt: Date.now() });
  } else {
    entry.count += 1;
  }
}

function clearFailures(map, key) {
  map.delete(key);
}

router.post("/login", async (ctx) => {
  const { email, password } = ctx.request.body;
  const ip = ctx.ip;

  if (isLimited(attemptsByIp, ip) || (email && isLimited(attemptsByEmail, email))) {
    ctx.status = 429;
    ctx.body = { error: "Too many attempts. Please try again later." };
    return;
  }

  const user = await db.users.findByEmail(email);
  if (!user || user.password != password) {
    recordFailure(attemptsByIp, ip);
    if (email) recordFailure(attemptsByEmail, email);
    ctx.status = 401;
    ctx.body = { error: `No account matches ${email} with that password` };
    return;
  }
  clearFailures(attemptsByIp, ip);
  if (email) clearFailures(attemptsByEmail, email);
  const { password: _password, ...safeUser } = user;
  const token = createToken(user);
  ctx.body = { ok: true, user: safeUser, token };
});

export default router;
