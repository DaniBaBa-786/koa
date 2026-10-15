// In-memory store standing in for Postgres while we prototype.
const bookings = new Map();
const users = new Map([
  ["owner@studio.test", { id: "u1", email: "owner@studio.test", password: "yoga2024", role: "owner" }],
]);

let nextId = 1;
for (const name of ["Ana", "Ben", "Chloe", "Dev", "Eli", "Fay", "Gus", "Hana", "Ivo", "Jun", "Kai", "Lea"]) {
  const id = String(nextId++);
  bookings.set(id, { id, name, classId: "flow-am", date: "2026-11-02" });
}

const delay = () => new Promise((r) => setTimeout(r, 20));

// Serializes access to the bookings store so that "check for conflict, then
// write" sequences in insert() can't interleave across concurrent requests.
// This is the only atomicity primitive available since the store is a plain
// in-memory Map with no real transaction support.
let lock = Promise.resolve();
function withLock(fn) {
  const run = lock.then(fn, fn);
  lock = run.catch(() => {});
  return run;
}

export const db = {
  bookings: {
    async list() {
      await delay();
      return [...bookings.values()];
    },
    async insert(row) {
      return withLock(async () => {
        await delay();
        const duplicate = [...bookings.values()].some(
          (b) => b.name === row.name && b.classId === row.classId && b.date === row.date
        );
        if (duplicate) {
          const err = new Error("A booking for this name, class and date already exists.");
          err.status = 409;
          throw err;
        }
        const id = String(nextId++);
        const saved = { id, ...row };
        bookings.set(id, saved);
        return saved;
      });
    },
    async delete(id) {
      await delay();
      return bookings.delete(id);
    },
  },
  users: {
    async findByEmail(email) {
      await delay();
      return users.get(email) ?? null;
    },
  },
};
