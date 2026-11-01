// Round 2: adds more real places (names only, no reviews, no ratings) directly into the
// database, under an existing account by username. Same approach as seed-places-direct.js -
// no login/password needed, no 5-a-day limit, safe to run more than once (skips anything
// already there, matched by normalized title).
//
// Run on the droplet, from the project root:
//   DATA_DIR=/var/lib/topictalk node server/tools/seed-places-direct-2.js surya
// Then restart the service: systemctl restart topictalk
"use strict";
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const USERNAME = process.argv[2];
if (!USERNAME) { console.error("Usage: node server/tools/seed-places-direct-2.js <username>"); process.exit(1); }

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const AREA = "Arakkonam";
// [title, category, shop types (up to 3, from the app's STYPES list - optional)]
const PLACES = [
  ["Welfare Girls High School", "Education", ["school"]],
  ["Welfare Boys High School", "Education", ["school"]],
  ["Juice Up", "Food", ["cafe"]],
  ["Apollo Pharmacy", "Health", ["pharmacy"]],
  ["Bawa Pharmacy", "Health", ["pharmacy"]],
  ["Golden Steels Private Limited", "Shopping", ["hardware"]],
  ["Mani Hardwares", "Shopping", ["hardware"]],
  ["Mahalakshmi Textiles", "Shopping", ["clothing"]],
  ["Mangalam Kalyana Mandapam AC", "Local", []],
  ["GG Motors", "Bikes", ["bikes"]],
  ["Tea Machi Cafe", "Food", ["cafe"]],
  ["Balaji Party Hall", "Local", []],
  ["BPCL Petrol Bunk", "Services", ["fuel"]],
  ["Tamilnad Mercantile Bank", "Finance", ["bank"]],
  ["Indian Overseas Bank", "Finance", ["bank"]],
  ["Simple City", "Shopping", ["electronics"]],
  ["Poorvika Showroom", "Shopping", ["mobile"]],
  ["Arakkonam Registrar Office", "Services", ["govt"]],
  ["Little Star", "Shopping", ["beauty"]],
  ["Naturals Salon", "Shopping", ["beauty"]],
  ["Axis Bank", "Finance", ["bank"]],
  ["Tariq Hotel", "Food", ["restaurant"]],
  ["Chitra Coffee Bar", "Food", ["cafe"]],
  ["Indian Post Office", "Services", ["govt"]],
  ["Arakkonam Taluk Office", "Services", ["govt"]],
  ["GDN Maligai Stores", "Shopping", ["grocery"]],
];
const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const dbFile = path.join(DATA_DIR, "topictalk.db");
if (!require("fs").existsSync(dbFile)) { console.error("Database not found at " + dbFile + " - check DATA_DIR."); process.exit(1); }
const sql = new DatabaseSync(dbFile);

const user = sql.prepare("SELECT id, username FROM users WHERE username = ?").get(USERNAME);
if (!user) { console.error(`No account found with username "${USERNAME}". Check the exact spelling (case doesn't matter).`); process.exit(1); }
const uid = user.id;
console.log(`Adding places under account "${user.username}" (${uid})`);

const have = new Set();
for (const row of sql.prepare("SELECT data FROM docs WHERE col = 'topics'").all()) {
  const d = JSON.parse(row.data);
  if (d.kind === "place") have.add(norm(d.title));
}

const upsert = sql.prepare("INSERT INTO docs (col, id, data, updated) VALUES ('topics', ?, ?, ?) ON CONFLICT (col, id) DO UPDATE SET data = excluded.data, updated = excluded.updated");

let added = 0, skipped = 0;
for (const [name, cat, types] of PLACES) {
  if (have.has(norm(name))) { skipped++; console.log("skip (already there): " + name); continue; }
  const id = "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const data = { title: name, desc: "", category: cat, kind: "place", tags: ["review"], location: AREA, authorId: uid, tagged: [], taggedGroups: [], parentId: null, originCommentId: null, createdAt: Date.now(), groupId: null };
  if (types && types.length) data.shop = { types };
  upsert.run(id, JSON.stringify(data), Date.now());
  added++; console.log("added: " + name);
}
sql.close();
console.log(`\nDone. Added ${added}, skipped ${skipped}.`);
console.log("Now restart the service so the site picks these up: systemctl restart topictalk");
