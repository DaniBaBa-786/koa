const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;

if (!SENDGRID_API_KEY) {
  throw new Error("Missing required environment variable: SENDGRID_API_KEY");
}

export async function sendReminder(name, date) {
  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${SENDGRID_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ subject: `See you on ${date}, ${name}!` }),
  });
  if (!res.ok) throw new Error(`SendGrid said ${res.status}`);
}
