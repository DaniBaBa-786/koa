import crypto from "node:crypto";

const AUTH_SECRET = process.env.AUTH_SECRET;

if (!AUTH_SECRET) {
  throw new Error("Missing required environment variable: AUTH_SECRET");
}

const TOKEN_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

function sign(payload) {
  return crypto.createHmac("sha256", AUTH_SECRET).update(payload).digest("base64url");
}

// Issues a signed, time-limited token binding a user id/email/role together.
export function createToken(user) {
  const body = JSON.stringify({
    sub: user.id,
    email: user.email,
    role: user.role,
    exp: Date.now() + TOKEN_TTL_MS,
  });
  const encodedBody = Buffer.from(body).toString("base64url");
  const signature = sign(encodedBody);
  return `${encodedBody}.${signature}`;
}

// Verifies a token's signature and expiry, returning its payload or null.
export function verifyToken(token) {
  if (!token || typeof token !== "string") return null;
  const [encodedBody, signature] = token.split(".");
  if (!encodedBody || !signature) return null;

  const expected = sign(encodedBody);
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(encodedBody, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (!payload.exp || Date.now() > payload.exp) return null;
  return payload;
}

// Koa middleware: requires a valid Bearer token, attaches it to ctx.state.user.
export async function requireAuth(ctx, next) {
  const header = ctx.get("Authorization") || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    ctx.status = 401;
    ctx.body = { error: "Authentication required" };
    return;
  }
  const payload = verifyToken(token);
  if (!payload) {
    ctx.status = 401;
    ctx.body = { error: "Invalid or expired token" };
    return;
  }
  ctx.state.user = payload;
  await next();
}