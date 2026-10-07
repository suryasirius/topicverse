// Minimal SMTP sender, no npm packages. Port 465 = implicit TLS, any other port (587, 2525) = STARTTLS.
// Env: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM (sender address shown to people; defaults to SMTP_USER).
"use strict";
const tls = require("node:tls");
const net = require("node:net");

const cfg = () => ({
  host: process.env.SMTP_HOST || "", port: +process.env.SMTP_PORT || 465,
  user: process.env.SMTP_USER || "", pass: (process.env.SMTP_PASS || "").replace(/\s+/g, ""),
  from: process.env.SMTP_FROM || process.env.SMTP_USER || "",
});
// HTTPS mail APIs (work where the host blocks SMTP ports, e.g. DigitalOcean): Brevo or Resend
const api = () => {
  const from = process.env.MAIL_FROM || process.env.SMTP_FROM || "";
  if (process.env.BREVO_API_KEY) return { kind: "brevo", key: process.env.BREVO_API_KEY.trim(), from };
  if (process.env.RESEND_API_KEY) return { kind: "resend", key: process.env.RESEND_API_KEY.trim(), from };
  return null;
};
const enabled = () => { const a = api(); if (a) return a.from.includes("@"); const c = cfg(); return !!(c.host && c.user && c.pass && c.from.includes("@")); };
const clean = s => String(s).replace(/[\r\n]+/g, " ").trim();

async function sendApi(a, to, subject, text) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 20000);
  try {
    const r = a.kind === "brevo"
      ? await fetch("https://api.brevo.com/v3/smtp/email", { method: "POST", signal: ctl.signal, headers: { "api-key": a.key, "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({ sender: { name: "TopicTalk", email: clean(a.from) }, to: [{ email: clean(to) }], subject: clean(subject), textContent: text }) })
      : await fetch("https://api.resend.com/emails", { method: "POST", signal: ctl.signal, headers: { authorization: "Bearer " + a.key, "content-type": "application/json" },
          body: JSON.stringify({ from: a.from.includes("<") ? a.from : `TopicTalk <${clean(a.from)}>`, to: [clean(to)], subject: clean(subject), text }) });
    if (!r.ok) throw new Error(`Mail API ${r.status}: ${(await r.text().catch(() => "")).slice(0, 160)}`);
  } finally { clearTimeout(t); }
}

function send(to, subject, text) {
  const a = api(); if (a) return sendApi(a, to, subject, text);
  const c = cfg();
  return new Promise((resolve, reject) => {
    let sock = c.port === 465 ? tls.connect({ host: c.host, port: c.port, servername: c.host }) : net.connect({ host: c.host, port: c.port });
    let buf = "", step = 0, finished = false, upgrading = false;
    const done = err => { if (finished) return; finished = true; try { sock.destroy(); } catch { } err ? reject(err) : resolve(); };
    const arm = s => { s.setTimeout(20000, () => done(new Error("Mail server timed out."))); s.on("error", done); s.on("data", onData); };
    const w = s => sock.write(s + "\r\n");
    const msg = [
      `From: TopicTalk <${clean(c.from)}>`, `To: ${clean(to)}`, `Subject: ${clean(subject)}`,
      `Date: ${new Date().toUTCString()}`, "MIME-Version: 1.0", "Content-Type: text/plain; charset=utf-8", "Content-Transfer-Encoding: base64", "",
      Buffer.from(text, "utf8").toString("base64").replace(/(.{76})/g, "$1\r\n"),
    ].join("\r\n");
    const starttls = c.port !== 465;
    const script = [
      [220, () => w("EHLO topictalk")],
      ...(starttls ? [[250, () => w("STARTTLS")], [220, () => {
        upgrading = true; sock.removeListener("data", onData);
        const plain = sock; sock = tls.connect({ socket: plain, servername: c.host }, () => { upgrading = false; w("EHLO topictalk"); });
        arm(sock);
      }]] : []),
      [250, () => w("AUTH LOGIN")],
      [334, () => w(Buffer.from(c.user).toString("base64"))],
      [334, () => w(Buffer.from(c.pass).toString("base64"))],
      [235, () => w(`MAIL FROM:<${clean(c.from)}>`)],
      [250, () => w(`RCPT TO:<${clean(to)}>`)],
      [250, () => w("DATA")],
      [354, () => { sock.write(msg.replace(/\r\n\./g, "\r\n..") + "\r\n.\r\n"); }],
      [250, () => w("QUIT")],
    ];
    function onData(d) {
      buf += d.toString("utf8");
      const lines = buf.split(/\r?\n/); if (lines[lines.length - 1] === "") lines.pop(); else return;
      const last = lines[lines.length - 1];
      if (!/^\d{3}( |$)/.test(last)) return;   // multi-line reply not finished yet
      buf = "";
      const code = +last.slice(0, 3);
      if (step >= script.length) return done();
      if (code !== script[step][0]) return done(new Error("Mail server said: " + last.slice(0, 120)));
      script[step++][1]();
    }
    arm(sock);
    sock.on("close", () => { if (!upgrading) done(step >= script.length ? undefined : new Error("Mail server closed the connection.")); });
  });
}
module.exports = { send, enabled };
