// sends mail through resend (https://resend.com/docs/api-reference/emails/send-email).
// with no RESEND_API_KEY (local dev) it just logs the message instead.

export interface Mail { to: string; subject: string; text: string; html: string }

export async function sendMail(env: Env, mail: Mail) {
  if (!env.RESEND_API_KEY) {
    console.log(`[email, not sent — no RESEND_API_KEY]\nto: ${mail.to}\nsubject: ${mail.subject}\n\n${mail.text}`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.MAIL_FROM, to: [mail.to], subject: mail.subject, text: mail.text, html: mail.html }),
  });
  if (!res.ok) throw new Error(`resend ${res.status}: ${await res.text()}`);
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

export function resetMail(username: string, link: string): Omit<Mail, "to"> {
  return {
    subject: "reset your megaWAN password",
    text: `hey ${username},\n\nsomeone (hopefully you) asked to reset your megaWAN password. this link works once, for an hour:\n\n${link}\n\nif that wasn't you, ignore this and nothing changes.`,
    html: `<p>hey ${esc(username)},</p><p>someone (hopefully you) asked to reset your megaWAN password. this link works once, for an hour:</p><p><a href="${esc(link)}">reset my password</a></p><p>if that wasn't you, ignore this and nothing changes.</p>`,
  };
}
