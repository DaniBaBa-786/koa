import Router from "@koa/router";
import { db } from "../db.js";
import { sendReminder } from "../mailer.js";
import { requireAuth } from "../auth.js";

const router = new Router({ prefix: "/api" });
const CLASS_IDS = new Set(["flow-am", "flow-pm", "hiit", "pilates"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(value) {
  if (!DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime());
}

// GET /api/bookings?page=1&size=5
router.get("/bookings", async (ctx) => {
  const page = Number(ctx.query.page) || 1;
  const size = Number(ctx.query.size) || 5;
  const all = await db.bookings.list();
  ctx.body = {
    page,
    total: all.length,
    items: all.slice(page * size, page * size + size),
  };
});

router.post("/bookings", requireAuth, async (ctx) => {
  const { name, classId, date } = ctx.request.body ?? {};

  if (typeof name !== "string" || name.trim().length < 1 || name.trim().length > 100) {
    ctx.status = 400;
    ctx.body = { error: "name is required and must be 1-100 characters" };
    return;
  }
  if (typeof classId !== "string" || !CLASS_IDS.has(classId)) {
    ctx.status = 400;
    ctx.body = { error: `classId is required and must be one of: ${[...CLASS_IDS].join(", ")}` };
    return;
  }
  if (typeof date !== "string" || !isValidDate(date)) {
    ctx.status = 400;
    ctx.body = { error: "date is required and must be a valid YYYY-MM-DD date" };
    return;
  }

  // Studios are closed at the weekend
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  if (day === 0 || day === 6) {
    ctx.status = 400;
    ctx.body = { error: "We're closed at the weekend." };
    return;
  }

  try {
    const booking = await db.bookings.insert({ name: name.trim(), classId, date });
    sendReminder(name.trim(), date);
    ctx.status = 201;
    ctx.body = booking;
  } catch (err) {
    ctx.status = err.status || 500;
    ctx.body = { error: err.message };
  }
});

router.delete("/bookings/:id", requireAuth, async (ctx) => {
  await db.bookings.delete(ctx.params.id);
  ctx.body = { ok: true };
});

export default router;
