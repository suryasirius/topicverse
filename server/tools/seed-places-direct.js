// Adds real places (names only, no reviews, no ratings - those come from real people using
// the app) directly into the database file, under an existing account by username.
// No login/password needed (it doesn't talk to the running server over HTTP at all), and no
// 5-a-day limit (that limit lives in the website's write handler, which this bypasses by
// writing straight to the same SQLite file the server reads from).
// Safe to run more than once: places that already exist (matched by normalized title) are
// skipped automatically.
//
// Run on the droplet, from the project root:
//   node server/tools/seed-places-direct.js surya
// (replace "surya" with the TopicTalk username to add the places under)
//
// Then restart the service so the already-running server picks up the new rows
// (it keeps its own copy of the data in memory and won't see the new rows until it reloads):
//   systemctl restart topictalk
"use strict";
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const USERNAME = process.argv[2];
if (!USERNAME) { console.error("Usage: node server/tools/seed-places-direct.js <username>"); process.exit(1); }

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const AREA = "Arakkonam";
// [title, category, shop types (up to 3, from the app's STYPES list - optional)]
const PLACES = [
  ["Arul Kumaran Textiles", "Shopping", ["clothing"]],
  ["Nethra Multi-Speciality Hospital", "Health", ["hospital"]],
  ["Mahalaxmi Multi-Speciality Hospital", "Health", ["hospital"]],
  ["Lal Thanga Maaligai", "Shopping", ["jewellery"]],
  ["Step In Multi Cuisine Family Restaurant", "Food", ["restaurant"]],
  ["Shalini Nursing Home", "Health", ["hospital"]],
  ["Ortho Lux Health Care", "Health", ["hospital"]],
  ["Varshi Hondas", "Bikes", ["bikes"]],
  ["Sacred Heart Church", "Local", ["worship"]],
  ["Anbu Stores", "Shopping", ["grocery"]],
  ["St. Andrew's School", "Education", ["school"]],
  ["Bharathidasan School", "Education", ["school"]],
  ["SMS Vimal Matriculation Higher Secondary School", "Education", ["school"]],
  ["GG International School", "Education", ["school"]],
  ["Sri Krishna College of Engineering and Technology", "Education", ["school"]],
  ["Ashraf Chicken", "Food", []],
  ["St. Antony's Church", "Local", ["worship"]],
  ["CSI Silver Memorial Church", "Local", ["worship"]],
  ["Darling Showroom", "Shopping", ["electronics"]],
  ["Dr. VGN Matric Higher Secondary School", "Education", ["school"]],
  ["TRS Global Public School", "Education", ["school"]],
  ["Parampara Academy CBSE Higher Secondary School", "Education", ["school"]],
  ["Ambari Vidya Mandir", "Education", ["school"]],
  ["Selvam Matric Higher Secondary School", "Education", ["school"]],
  ["Sri Devi Theatre", "Entertainment", []],
  ["T.N. Narayanasamy Kalyana Mandapam", "Local", []],
  ["Sri Saravana Bhavan", "Food", ["restaurant"]],
  ["Annapoorna Hotel", "Food", ["restaurant"]],
  ["GRT Jewels", "Shopping", ["jewellery"]],
  ["Sri Ramanas Restaurant and Party Hall (AC)", "Food", ["restaurant"]],
  ["ICICI Bank", "Finance", ["bank"]],
  ["Classic Fitness Gym and Health", "Sports", ["sports"]],
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
