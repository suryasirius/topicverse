// Turns the prototype page into the self-hosted page: swaps claude.ai wording for
// this server's login, and adds shim.js, which provides window.claude.use("db" | "user" | "downloads").
"use strict";
const fs = require("node:fs");
const path = require("node:path");

const SRC = process.env.PAGE_SRC || path.join(__dirname, "..", "prototype", "topictalk.html");
const LOGIN_BTN = `'<button class="btn pri" data-act="ttLogin">Log in or sign up</button>'`;

const PATCHES = [
  ['emptyBox("Sign in to see notifications","Open this page in claude.ai while signed in.")',
   `emptyBox("Log in to see notifications","Replies, mentions, battles and group posts show up here.",${LOGIN_BTN})`],
  ['emptyBox("Sign in to see your profile","Open this page in claude.ai while signed in.")',
   `emptyBox("Log in to see your profile","Your topics, debates and reputation live here.",${LOGIN_BTN})`],
  ['msg="This is the TopicTalk prototype. Open it in claude.ai while signed in to read and post.";',
   'msg="Can’t reach the TopicTalk server right now. Check your connection and refresh the page.";'],
  ['if(!db||!S.me){ toast("Open this page in claude.ai while signed in to post."); return false; }',
   'if(!db||!S.me){ if(window.ttLogin) window.ttLogin(); else toast("Log in to post."); return false; }'],
  ['err.textContent="Sign in to claude.ai first."', 'err.textContent="Log in first."'],
  ['    else if(e&&e.code==="quota_exceeded")',
   '    else if(e&&(e.code==="permission_denied"||e.code==="bad_request"||e.code==="unauthenticated")&&e.message) toast(e.message);\n    else if(e&&e.code==="quota_exceeded")'],
  // private groups: the server checks invite codes, members never see other groups' codes
  ['      const g=[...S.groups.values()].find(x=>(x.invite||"").toUpperCase()===code);',
   '      if(window.ttJoin){ if(!code){ err.textContent="Enter the code your friend sent."; break; } if(!(await gate())) break; el.disabled=true; try{ const gid=await window.ttJoin(code); toast("You joined the group"); location.hash="g-"+gid; }catch(ex){ err.textContent=ex.message||"No group has that code."; } el.disabled=false; break; }\n      const g=[...S.groups.values()].find(x=>(x.invite||"").toUpperCase()===code);'],
  ['data-act="editHandle">Edit profile</button>`:""}',
   'data-act="editHandle">Edit profile</button>`:""}${isMe&&window.ttLogout?`<button class="btn sm" data-act="ttLogout">Log out</button>`:""}'],
  ['Open TopicTalk, go to Groups and enter the code ${g.invite}.', 'Open ${location.origin}/#groups and enter the code ${g.invite}.'],
  ['  const txt=kind==="battle"?', '  let txt=kind==="battle"?'],
  ['  openModal(`<h2>${L("Share card")}</h2>', '  txt+=" "+location.origin+"/#t-"+(kind==="battle"?S.battles.get(id).topicId:id);\n  openModal(`<h2>${L("Share card")}</h2>'],
  ['TopicTalk prototype ·', 'TopicTalk ·'],
];

function buildPage() {
  let page = fs.readFileSync(SRC, "utf8");
  const missed = [];
  for (const [from, to] of PATCHES) {
    if (!page.includes(from)) { missed.push(from.slice(0, 60)); continue; }
    page = page.split(from).join(to);
  }
  if (missed.length) console.warn("build: these page patches did not apply:\n  " + missed.join("\n  "));
  const shim = fs.readFileSync(path.join(__dirname, "shim.js"), "utf8");
  // the claude.ai skeleton, reproduced: charset, viewport, small reset
  const head = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="description" content="TopicTalk: review anything, talk about it, and turn any comment into a new topic.">
<meta name="theme-color" content="#1F9D63">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cpath d='M6 5h20a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H14l-6 5v-5H6a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3z' fill='%231F9D63'/%3E%3C/svg%3E">
<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif;background:#f8f8f6}img{max-width:100%}[hidden]{display:none!important}</style>
<script>${shim}</script></head><body>`;
  return head + page + "</body></html>";
}
module.exports = { buildPage };
if (require.main === module) { fs.writeFileSync(path.join(__dirname, "index.built.html"), buildPage()); console.log("wrote index.built.html"); }
