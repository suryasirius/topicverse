// Web Push without dependencies. The push message carries no text: the service worker asks the server
// (with the user's own login cookie) what is new, so nothing private passes through the push service.
"use strict";
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const b64u = b => Buffer.from(b).toString("base64url");

module.exports = function createPush({ sql, dir, subject }) {
  sql.exec("CREATE TABLE IF NOT EXISTS push (endpoint TEXT PRIMARY KEY, uid TEXT NOT NULL, created INTEGER NOT NULL); CREATE INDEX IF NOT EXISTS push_uid ON push (uid); CREATE TABLE IF NOT EXISTS pushoff (uid TEXT PRIMARY KEY, off TEXT NOT NULL);");
  const file = path.join(dir, "vapid.json");
  let priv, pubRaw;
  try {
    const j = JSON.parse(fs.readFileSync(file, "utf8"));
    priv = crypto.createPrivateKey({ key: j.private, format: "jwk" });
    pubRaw = j.public;
  } catch {
    const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const pj = publicKey.export({ format: "jwk" });
    pubRaw = b64u(Buffer.concat([Buffer.from([4]), Buffer.from(pj.x, "base64url"), Buffer.from(pj.y, "base64url")]));
    fs.writeFileSync(file, JSON.stringify({ private: privateKey.export({ format: "jwk" }), public: pubRaw }), { mode: 0o600 });
    priv = privateKey;
  }
  const q = {
    add: sql.prepare("INSERT INTO push (endpoint, uid, created) VALUES (?, ?, ?) ON CONFLICT (endpoint) DO UPDATE SET uid = excluded.uid"),
    del: sql.prepare("DELETE FROM push WHERE endpoint = ?"),
    delMine: sql.prepare("DELETE FROM push WHERE endpoint = ? AND uid = ?"),
    byUid: sql.prepare("SELECT endpoint FROM push WHERE uid = ?"),
    count: sql.prepare("SELECT COUNT(*) AS n FROM push WHERE uid = ?"),
    offGet: sql.prepare("SELECT off FROM pushoff WHERE uid = ?"),
    offSet: sql.prepare("INSERT INTO pushoff (uid, off) VALUES (?, ?) ON CONFLICT (uid) DO UPDATE SET off = excluded.off"),
    offDel: sql.prepare("DELETE FROM pushoff WHERE uid = ?"),
  };
  // Categories a person has switched off. Empty by default: everything is on.
  const offCache = new Map();
  const getOff = uid => { if (!offCache.has(uid)) { const r = q.offGet.get(uid); offCache.set(uid, new Set(r ? r.off.split(",").filter(Boolean) : [])); } return offCache.get(uid); };
  const okEndpoint = e => typeof e === "string" && e.length < 1000 && /^https:\/\/[^\s]+$/.test(e);
  function jwt(aud) {
    const h = b64u(JSON.stringify({ typ: "JWT", alg: "ES256" })), p = b64u(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject }));
    const sig = crypto.sign("sha256", Buffer.from(h + "." + p), { key: priv, dsaEncoding: "ieee-p1363" });
    return h + "." + p + "." + b64u(sig);
  }
  async function ping(endpoint) {
    try {
      const r = await fetch(endpoint, { method: "POST", headers: { Authorization: `vapid t=${jwt(new URL(endpoint).origin)}, k=${pubRaw}`, TTL: "86400", Urgency: "normal" }, signal: AbortSignal.timeout(10000) });
      if (r.status === 404 || r.status === 410) q.del.run(endpoint);
      else if (!r.ok) console.warn("push:", r.status, new URL(endpoint).host);
    } catch (e) { console.warn("push failed:", e.message); }
  }
  return {
    key: () => pubRaw,
    ok: okEndpoint,
    subscribe: (uid, endpoint) => { q.add.run(endpoint, uid, Date.now()); },
    unsubscribe: (uid, endpoint) => { q.delMine.run(endpoint, uid); },
    has: uid => q.count.get(uid).n > 0,
    off: getOff,
    setOff: (uid, arr) => { const a = [...new Set(arr)]; if (a.length) q.offSet.run(uid, a.join(",")); else q.offDel.run(uid); offCache.set(uid, new Set(a)); },
    notify: (uid, cat) => { if (cat && getOff(uid).has(cat)) return; for (const { endpoint } of q.byUid.all(uid)) ping(endpoint); },
  };
};
