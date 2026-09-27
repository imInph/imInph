"use strict";

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
const root = document.documentElement;
const started = Date.now();

const store = {
  get(k) { try { return JSON.parse(sessionStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const DAYS = "Sun Mon Tue Wed Thu Fri Sat".split(" ");
const MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
const pad = n => String(n).padStart(2, "0");
function stamp(d = new Date()) {
  return `${DAYS[d.getDay()]} ${MONTHS[d.getMonth()]} ${String(d.getDate()).padStart(2)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function ago(iso) {
  const s = (Date.now() - new Date(iso)) / 1000;
  for (const [n, u] of [[31536000, "y"], [2592000, "mo"], [86400, "d"], [3600, "h"], [60, "m"]]) if (s >= n) return `${Math.floor(s / n)}${u} ago`;
  return "just now";
}

$("#lastlogin").textContent = stamp(new Date(Date.now() - 1000 * 60 * 47));
$(".since").textContent = stamp(new Date(Date.now() - 1000 * 60 * 3));

/* ---------- typing ---------- */

function cursor() {
  const c = document.createElement("span");
  c.className = "cur";
  return c;
}

async function typeLine(line, speed) {
  const cmd = $(".c", line);
  if (!cmd || calm) { line.classList.remove("hide"); return; }
  const text = cmd.textContent;
  const tail = [...line.childNodes].slice([...line.childNodes].indexOf(cmd) + 1);
  tail.forEach(n => n.remove());
  cmd.textContent = "";
  const cur = cursor();
  cmd.after(cur);
  line.classList.remove("hide");
  await sleep(speed * 6);
  for (const ch of text) {
    cmd.textContent += ch;
    await sleep(speed + Math.random() * speed);
  }
  await sleep(speed * 4);
  cur.remove();
  cmd.after(...tail);
}

async function play(lines, speed = 38) {
  lines.forEach(l => l.classList.add("hide"));
  for (const line of lines) {
    if (line.hasAttribute("data-cmd")) await typeLine(line, speed);
    else { line.classList.remove("hide"); if (!calm) await sleep(22); }
  }
}

const own = win => $$(":scope > pre > .l", win);

async function show(win) {
  if (win.dataset.played) return;
  win.dataset.played = 1;
  if (calm) { win.classList.add("shown"); return; }
  [...own(win), ...$$(".proj .l", win)].forEach(l => l.classList.add("hide"));
  win.classList.add("shown");
  await play(own(win));
  if (win.id === "projects") {
    const on = $(".proj.on");
    if (on) await play($$(".l", on));
  }
  if (win.id === "hello") {
    const last = own(win).at(-2);
    last.append(cursor());
  }
}

/* ---------- boot ---------- */

const BOOT = [
  ["inphex boot 1.0   rv32i @ 25.2 MHz   80x30 console", 0],
  ["", 60],
  ["sd: spi init .............. ok", 130],
  ["sd: card 7.4 GiB, fat32 ... ok", 110],
  ["fat: /PROG.BIN ............ 18432 bytes", 90],
  ["copy to 0x00000000 ........ ok", 160],
  ["", 40],
  ["jump 0x00000000", 220],
];

async function boot() {
  const box = $("#boot"), pre = $("pre", box);
  let skip = false;
  const stop = () => { skip = true; };
  addEventListener("keydown", stop, { once: true });
  addEventListener("pointerdown", stop, { once: true });
  root.classList.add("booting");
  for (const [text, wait] of BOOT) {
    if (skip) break;
    await sleep(wait);
    pre.textContent += text + "\n";
  }
  if (!skip) await sleep(260);
  box.classList.add("off");
  await sleep(skip ? 0 : 300);
  root.classList.remove("booting");
  box.remove();
  store.set("booted", 1);
}

/* ---------- projects ---------- */

const rows = $$(".ls .row");
function pick(name, animate) {
  const proj = $(`#p-${name}`);
  if (!proj) return;
  rows.forEach(r => r.classList.toggle("on", r.dataset.p === name));
  $$(".proj").forEach(p => p.classList.toggle("on", p === proj));
  if (animate && $("#projects").classList.contains("shown")) play($$(".l", proj), 22);
}
rows.forEach(r => r.addEventListener("click", e => {
  e.preventDefault();
  pick(r.dataset.p, true);
  history.replaceState(null, "", `#${r.dataset.p}`);
}));
$("#projects").addEventListener("keydown", e => {
  if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
  const i = rows.findIndex(r => r.classList.contains("on"));
  const next = rows[(i + (e.key === "ArrowDown" ? 1 : rows.length - 1)) % rows.length];
  e.preventDefault();
  next.focus();
  next.click();
});
const fromHash = location.hash.slice(1).replace(/^p-/, "");
pick(rows.some(r => r.dataset.p === fromHash) ? fromHash : "inphub", false);

/* ---------- live data from github ---------- */

const USER = "imInph";
const COLORS = {
  TypeScript: "#3178C6", JavaScript: "#F7DF1E", "C#": "#9B6BFF", Python: "#4B8BBE", Shell: "#4EAA25",
  Rust: "#DEA584", C: "#A8B9CC", Verilog: "#E8475F", Java: "#E76F00", PHP: "#8892BF", CSS: "#663399",
  HTML: "#E34F26", Makefile: "#6E7681", TSQL: "#E38C00", Assembly: "#6E4C13",
};

async function gh(path) {
  const key = `gh:${path}`, hit = store.get(key);
  if (hit && Date.now() - hit.t < 10 * 60 * 1000) return hit.v;
  const res = await fetch(`https://api.github.com/${path}`, { headers: { Accept: "application/vnd.github+json" } });
  if (!res.ok) throw new Error(res.status);
  const v = await res.json();
  store.set(key, { t: Date.now(), v });
  return v;
}

let events = [];

async function live() {
  try {
    const repos = (await gh(`users/${USER}/repos?per_page=100`)).filter(r => !r.fork);
    $("#repocount").textContent = repos.length;
    for (const r of repos) {
      const row = rows.find(x => x.dataset.p === r.name);
      if (row) $(".date", row).textContent = r.pushed_at.slice(0, 10);
    }
    const langs = {};
    await Promise.all(repos.filter(r => r.name !== USER).map(async r => {
      for (const [k, v] of Object.entries(await gh(`repos/${USER}/${r.name}/languages`))) langs[k] = (langs[k] || 0) + v;
    }));
    bars(langs);
  } catch {
    bars({ Rust: 58, TypeScript: 21, "C#": 9, Verilog: 5, C: 3, Shell: 2, CSS: 2 }, true);
  }
  try {
    // push events no longer list their commits, so ask the most recently pushed repos
    const recent = (await gh(`users/${USER}/repos?sort=pushed&per_page=5`)).filter(r => !r.fork);
    events = (await Promise.all(recent.map(async r =>
      (await gh(`repos/${USER}/${r.name}/commits?per_page=6`)).map(c => ({
        sha: c.sha, msg: c.commit.message.split("\n")[0], repo: r.name, at: c.commit.committer.date,
      }))
    ))).flat().sort((a, b) => b.at.localeCompare(a.at));
    gitlog($("#gitlog"), 8);
  } catch {
    $("#gitlog").innerHTML = `<span class="note">github didn't answer. <a href="https://github.com/${USER}">see it there →</a></span>`;
  }
}

function bars(langs, offline) {
  const total = Object.values(langs).reduce((a, b) => a + b, 0);
  const list = Object.entries(langs).sort((a, b) => b[1] - a[1]).slice(0, 7);
  const width = innerWidth < 720 ? 14 : 34;
  const name = Math.max(...list.map(([k]) => k.length));
  $("#bars").innerHTML = list.map(([k, v]) => {
    const share = v / total, n = Math.max(1, Math.round(share * width));
    const c = COLORS[k] || "#6E7681";
    return `<span class="l">${esc(k.padEnd(name))}  <span style="color:${c}">${"█".repeat(n)}</span><span class="note">${"░".repeat(width - n)}</span> ${(share * 100).toFixed(1).padStart(4)}%</span>`;
  }).join("") + (offline ? `<span class="l note">(offline guess, github didn't answer)</span>` : "");
}

function gitlog(el, n) {
  if (!events.length) { el.innerHTML = `<span class="note">nothing public lately.</span>`; return; }
  const repo = Math.max(...events.slice(0, n).map(e => e.repo.length));
  el.innerHTML = events.slice(0, n).map(e =>
    `<span class="l log"><a class="h" href="https://github.com/${USER}/${e.repo}/commit/${e.sha}">${e.sha.slice(0, 7)}</a> <span class="b">${esc(e.repo.padEnd(repo))}</span> ${esc(e.msg)} <span class="note">${ago(e.at)}</span></span>`
  ).join("");
}

/* ---------- the shell ---------- */

const out = $("#out"), input = $("#cmd"), prompt = $(".prompt");
const caret = document.createElement("span");
caret.className = "caret";
prompt.append(caret);
const history_ = [];
let hi = 0, cwd = "~", game = null;

const PROJECTS = rows.map(r => r.dataset.p);
const LINKS = {
  github: `https://github.com/${USER}`,
  inphub: "https://github.com/imInph/inphub",
  "inphub-lite": "https://iminph.github.io/inphub-lite/",
  inphner: "https://iminph.github.io/inphner/",
  inphish: "https://github.com/imInph/inphish/releases/latest",
  inphiso: "https://github.com/imInph/inphiso",
  "inphex-monolyth": "https://github.com/imInph/inphex-monolyth",
};

function print(html = " ", cls = "") {
  const l = document.createElement("span");
  l.className = `l wrap ${cls}`;
  l.innerHTML = html;
  out.append(l);
  out.scrollTop = out.scrollHeight;
  return l;
}

function place() {
  const n = asking ? 0 : input.selectionStart ?? input.value.length;
  caret.style.left = `calc(${input.offsetLeft}px + ${n - input.scrollLeft / caret.offsetWidth}ch)`;
}
["input", "keyup", "click", "focus", "select"].forEach(e => input.addEventListener(e, place));
addEventListener("resize", place);
$("#shell").addEventListener("click", e => { if (!e.target.closest("a")) input.focus({ preventScroll: true }); });

const COMMANDS = {
  help() {
    [
      ["whoami", "who you are"], ["about", "who I am"], ["ls [dir]", "look around"], ["cat <file>", "read something"],
      ["open <name>", "open a project or github"], ["neofetch", "this machine"], ["snake", "play snake"],
      ["git log", "what I pushed lately"], ["crt", "scanlines on / off"], ["clear", "clear the screen"], ["exit", "log out"],
    ].forEach(([c, d]) => print(`  <span class="c">${esc(c.padEnd(12))}</span><span class="note">${d}</span>`));
    print(`<span class="note">tab completes, ↑ ↓ go through history.</span>`);
  },
  whoami() { print("guest. you're just visiting. I'm inph, try <span class=\"c\">about</span>."); },
  about() {
    print(`<span class="b">Arda.</span> Student from Turkey. I build my own tools.`);
    print("Into Linux and self-hosted stuff. I mostly build tools for myself, then keep rebuilding them until I understand how every part works.");
  },
  pwd() { print(cwd === "~" ? "/home/inph" : "/home/inph/projects"); },
  cd([d = "~"]) {
    // resolve against the current directory, then see where that lands
    const parts = (d.startsWith("/") || d.startsWith("~") ? [] : cwd.split("/").slice(1));
    for (const part of d.replace(/^~\/?/, "").split("/")) {
      if (!part || part === ".") continue;
      if (part === "..") parts.pop();
      else parts.push(part);
    }
    const path = parts.join("/");
    if (d.startsWith("/")) return print("nothing up there worth seeing.");
    if (path === "") cwd = "~";
    else if (path === "projects") cwd = "~/projects";
    else if (path === "secrets" || path.startsWith("secrets/")) return print(`bash: cd: ${esc(d)}: Permission denied`);
    else if (/^projects\/[^/]+$/.test(path) && PROJECTS.includes(parts[1])) return print(`it's all in the README. try <span class="c">cat ${esc(path.replace(cwd === "~" ? "" : "projects/", ""))}/README</span>`);
    else if (["README", "languages.txt"].includes(path)) return print(`bash: cd: ${esc(d)}: Not a directory`);
    else return print(`bash: cd: ${esc(d)}: No such file or directory`);
    $("#cwd").textContent = cwd;
  },
  ls([d]) {
    let where = (d || ".").replace(/^~\/?/, "").replace(/\/$/, "");
    if (!d || !d.startsWith("~")) where = [cwd === "~" ? "" : "projects", where].filter(Boolean).join("/");
    where = where.replace(/(^|\/)\.(?=\/|$)/g, "").replace(/[^/]+\/\.\.(\/|$)/, "").replace(/^\/|\/$/g, "");
    if (where === "" ) return print(`<span class="c">README</span>  <span class="c">languages.txt</span>  <span class="b">projects/</span>  <span class="b">secrets/</span>`);
    if (where === "projects") return print(PROJECTS.map(p => `<span class="${p === "inphiso" ? "p" : "b"}">${p}${p === "inphiso" ? "*" : "/"}</span>`).join("  "));
    if (where === "secrets") return print(`ls: cannot open directory 'secrets/': Permission denied`);
    print(`ls: cannot access '${esc(d)}': No such file or directory`);
  },
  cat(args) {
    if (!args.length) return print("cat: missing file");
    let f = args[0].replace(/^~\//, "");
    if (cwd !== "~" && !f.startsWith("projects/")) f = `projects/${f}`;
    if (f === "README" || f === "about.txt") return COMMANDS.about();
    if (f === "languages.txt") return print("TypeScript  JavaScript  C#  Python  Bash");
    if (f.startsWith("secrets")) return print(`cat: ${esc(f)}: Permission denied`);
    const m = f.match(/^projects\/([^/]+)(\/README)?\/?$/);
    if (m && PROJECTS.includes(m[1])) {
      pick(m[1], true);
      const first = $(`#p-${m[1]} .wrap`).textContent;
      print(first);
      print(`<span class="note">full README is up in <a href="#p-${m[1]}" data-jump>projects</a>.</span>`);
      return;
    }
    print(`cat: ${esc(args[0])}: No such file or directory`);
  },
  open([what]) {
    const url = LINKS[(what || "").replace(/\/$/, "")];
    if (!url) return print(`open: try one of: ${Object.keys(LINKS).join(", ")}`);
    window.open(url, "_blank", "noopener");
    print(`opening <a href="${url}" target="_blank" rel="noopener">${url}</a>`);
  },
  neofetch() {
    const ua = navigator.userAgent;
    const browser = /Firefox\//.test(ua) ? "Firefox" : /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "something";
    const up = Math.floor((Date.now() - started) / 1000);
    const logo = $(".banner").textContent.split("\n").concat("");
    const info = [
      `<span class="p">inph</span>@<span class="p">inphserver</span>`,
      "<span class=\"note\">───────────────</span>",
      `<span class="b">OS</span>       Linux`,
      `<span class="b">Shell</span>    bash`,
      `<span class="b">Font</span>     inphex 8x16`,
      `<span class="b">Repos</span>    ${$("#repocount").textContent} public`,
      `<span class="b">Uptime</span>   ${Math.floor(up / 60)}m ${up % 60}s <span class="note">(this tab)</span>`,
      `<span class="b">You</span>      ${browser}, ${screen.width}x${screen.height}`,
    ];
    logo.forEach((l, i) => print(`<span class="b">${l.padEnd(34)}</span>${info[i] || ""}`));
    print(["#F85149", "#D29922", "#3FB950", "#58A6FF", "#BC8CFF", "#E6EDF3"].map(c => `<span style="color:${c}">███</span>`).join(""));
  },
  git([sub]) {
    if (sub !== "log") return print(`usage: <span class="c">git log</span>`);
    gitlog(print(), 12);
  },
  date() { print(stamp() + " " + new Date().getFullYear()); },
  echo(args) { print(esc(args.join(" "))); },
  history() { history_.forEach((h, i) => print(`${String(i + 1).padStart(4)}  ${esc(h)}`)); },
  clear() { out.innerHTML = ""; },
  crt() {
    root.classList.toggle("nocrt");
    print(`scanlines ${root.classList.contains("nocrt") ? "off" : "on"}.`);
  },
  uname() { print("Linux inphserver 6.8.0 x86_64 GNU/Linux"); },
  sudo([what]) {
    if (what === "su") return su();
    print("guest is not in the sudoers file. This incident will be reported.");
  },
  rm() { print("nice try."); },
  vim() { print("you'd never get out. no."); },
  exit() {
    print("logout");
    print(`Connection to 192.168.1.111 closed.`);
    setTimeout(() => $("#hello").scrollIntoView(), calm ? 0 : 500);
  },
  snake() { startGame(); },
  su() { su(); },
};
COMMANDS.logout = COMMANDS.exit;
COMMANDS.ll = COMMANDS.ls;
COMMANDS.nano = COMMANDS.emacs = COMMANDS.vi = COMMANDS.vim;
COMMANDS["cat"].files = () => ["README", "languages.txt", ...PROJECTS.map(p => `projects/${p}/README`)];

function run(line) {
  print(`<span class="p">guest@inphserver</span>:<span class="b">${cwd}</span>$ ${esc(line)}`);
  const [name, ...args] = line.trim().split(/\s+/);
  if (!name) return;
  history_.push(line);
  hi = history_.length;
  const fn = Object.hasOwn(COMMANDS, name) && COMMANDS[name];
  if (fn) fn(args);
  else print(`bash: ${esc(name)}: command not found`);
}

function complete() {
  const v = input.value;
  const parts = v.split(" ");
  let pool;
  if (parts.length === 1) pool = Object.keys(COMMANDS);
  else if (parts[0] === "open") pool = Object.keys(LINKS);
  else if (parts[0] === "cat") pool = COMMANDS.cat.files();
  else if (parts[0] === "ls" || parts[0] === "cd") pool = ["projects/", "secrets/", ...PROJECTS];
  else return;
  const word = parts.at(-1);
  const hits = pool.filter(p => p.startsWith(word));
  if (hits.length === 1) parts[parts.length - 1] = hits[0] + (parts.length === 1 ? " " : "");
  else if (hits.length > 1) {
    let common = hits[0];
    for (const h of hits) while (!h.startsWith(common)) common = common.slice(0, -1);
    if (common.length > word.length) parts[parts.length - 1] = common;
    else { print(`<span class="p">guest@inphserver</span>:<span class="b">${cwd}</span>$ ${esc(v)}`); print(hits.join("  ")); }
  }
  input.value = parts.join(" ");
}

input.addEventListener("keydown", e => {
  if (game || busy) { if (busy) e.preventDefault(); return; }
  if (asking) {
    if (e.key === "Enter") { e.preventDefault(); meltdown(); }
    else if (e.key === "Escape" || e.key === "c" && e.ctrlKey) { e.preventDefault(); unask(); print("Password: ^C"); }
    return;
  }
  if (e.key === "Enter") { run(input.value); input.value = ""; }
  else if (e.key === "Tab") { e.preventDefault(); complete(); }
  else if (e.key === "ArrowUp") { e.preventDefault(); if (hi > 0) input.value = history_[--hi]; }
  else if (e.key === "ArrowDown") { e.preventDefault(); hi = Math.min(history_.length, hi + 1); input.value = history_[hi] ?? ""; }
  else if (e.key === "l" && e.ctrlKey) { e.preventDefault(); COMMANDS.clear(); }
  else return;
  requestAnimationFrame(place);
});
out.addEventListener("click", e => {
  const a = e.target.closest("[data-jump]");
  if (a) { e.preventDefault(); $("#projects").scrollIntoView(); }
});

/* ---------- su: any password works, which is the problem ---------- */

const ps = $(".ps"), guestPs = ps.innerHTML;
let asking = false, busy = false;

function su() {
  asking = true;
  ps.textContent = "Password: ";
  input.type = "password";
  input.classList.add("secret");
  requestAnimationFrame(place);
}

function unask() {
  asking = false;
  input.type = "text";
  input.classList.remove("secret");
  input.value = "";
  ps.innerHTML = guestPs;
  requestAnimationFrame(place);
}

const OOPS = [
  "audit: uid=1001 (guest) became uid=0 (root). that should not be possible",
  "inphfs: secrets/ opened by someone who is not inph",
  "BUG: unable to handle trust at 0000000000000000",
  "Oops: 0002 [#1] PREEMPT SMP NOPTI",
];

async function meltdown() {
  unask();
  busy = true;
  prompt.style.visibility = "hidden";
  print("Password: ");
  await sleep(1100);
  print(`welcome back, <span class="b">inph</span>.`);
  await sleep(800);
  const line = print(`<span class="r">root@inphserver</span>:<span class="b">~</span># `);
  const cur = cursor();
  line.append(cur);
  for (const ch of "cat secrets/*") {
    cur.before(ch);
    await sleep(calm ? 0 : 70 + Math.random() * 60);
  }
  await sleep(calm ? 0 : 500);
  cur.remove();
  if (!calm) root.classList.add("glitch");
  let t = performance.now() / 1000;
  for (const o of OOPS) {
    print(`<span class="r">[${t.toFixed(6).padStart(12)}] ${o}</span>`);
    t += Math.random() * 0.002;
    await sleep(calm ? 0 : 220);
  }
  await sleep(calm ? 0 : 1100);
  panic(t);
}

async function panic(t) {
  root.classList.remove("glitch");
  const box = document.createElement("div"), pre = document.createElement("pre");
  box.id = "panic";
  box.append(pre);
  document.body.append(box);
  const now = new Date(), why = "guest tried to be root";
  const lines = [
    `Kernel panic - not syncing: ${why}`,
    "CPU: 0 PID: 1337 Comm: su Tainted: G      D            6.8.0-inph #1",
    `Hardware name: inphserver/inphserver, BIOS 1.0 ${pad(now.getMonth() + 1)}/${pad(now.getDate())}/${now.getFullYear()}`,
    "Call Trace:",
    " <TASK>",
    " dump_stack_lvl+0x48/0x70",
    " panic+0x33c/0x370",
    " do_exit+0x9b1/0xb20",
    " make_task_dead+0x81/0x170",
    " su_trust_stranger+0x42/0x42",
    " secrets_open+0x1f/0x90",
    " do_sys_openat2+0x97/0xe0",
    " entry_SYSCALL_64_after_hwframe+0x78/0xe2",
    " </TASK>",
    "Kernel Offset: disabled",
    "Rebooting in 3 seconds..",
    `---[ end Kernel panic - not syncing: ${why} ]---`,
  ];
  for (const l of lines) {
    pre.textContent += `[${t.toFixed(6).padStart(12)}] ${l}\n`;
    t += Math.random() * 0.0004;
    await sleep(calm ? 0 : 35);
  }
  await sleep(3000);
  store.set("booted", null);
  store.set("panicked", 1);
  box.classList.add("off");
  await sleep(calm ? 0 : 300);
  history.scrollRestoration = "manual";
  scrollTo({ top: 0, behavior: "instant" });
  location.reload();
}

/* ---------- snake, in the terminal ---------- */

function startGame() {
  const avail = Math.floor(out.clientWidth / caret.offsetWidth);
  const W = Math.max(10, Math.min(24, Math.floor((avail - 2) / 2))), H = 11;
  const screen = print("", "game");
  const status = print("");
  const g = game = {
    snake: [[4, 5], [3, 5], [2, 5]], dir: [1, 0], queue: [], food: null, score: 0, over: false, timer: 0,
  };
  const free = () => {
    let p;
    do p = [Math.floor(Math.random() * W), Math.floor(Math.random() * H)];
    while (g.snake.some(([x, y]) => x === p[0] && y === p[1]));
    return p;
  };
  g.food = free();

  const draw = () => {
    const cells = Array.from({ length: H }, () => Array(W).fill("  "));
    cells[g.food[1]][g.food[0]] = `<span class="r">■ </span>`;
    g.snake.forEach(([x, y], i) => { cells[y][x] = `<span class="${i ? "p" : "b"}">██</span>`; });
    const bar = "─".repeat(W * 2);
    screen.innerHTML = [`<span class="note">┌${bar}┐</span>`, ...cells.map(r => `<span class="note">│</span>${r.join("")}<span class="note">│</span>`), `<span class="note">└${bar}┘</span>`].join("\n");
    status.innerHTML = g.over
      ? `<span class="r">game over.</span> score ${g.score}. <span class="c">r</span> to retry, <span class="c">q</span> to quit.`
      : `score <span class="y">${g.score}</span>   <span class="note">arrows / wasd / swipe · q quits</span>`;
    out.scrollTop = out.scrollHeight;
  };

  const step = () => {
    if (g.queue.length) g.dir = g.queue.shift();
    const [hx, hy] = g.snake[0];
    const head = [hx + g.dir[0], hy + g.dir[1]];
    const hit = head[0] < 0 || head[1] < 0 || head[0] >= W || head[1] >= H ||
      g.snake.slice(0, -1).some(([x, y]) => x === head[0] && y === head[1]);
    if (hit) { g.over = true; clearInterval(g.timer); draw(); return; }
    g.snake.unshift(head);
    if (head[0] === g.food[0] && head[1] === g.food[1]) {
      g.score++;
      g.food = free();
      clearInterval(g.timer);
      g.timer = setInterval(step, Math.max(60, 130 - g.score * 4));
    } else g.snake.pop();
    draw();
  };

  const turn = d => {
    const last = g.queue.at(-1) || g.dir;
    if (d[0] === -last[0] && d[1] === -last[1] || d[0] === last[0] && d[1] === last[1]) return;
    if (g.queue.length < 3) g.queue.push(d);
  };
  const KEYS = { ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1], ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0] };

  const quit = () => {
    clearInterval(g.timer);
    removeEventListener("keydown", onKey, true);
    screen.removeEventListener("touchstart", onTouch);
    game = null;
    prompt.style.visibility = "";
    print(`<span class="note">snake exited. best this time: ${g.score}.</span>`);
    input.focus({ preventScroll: true });
  };
  const onKey = e => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (KEYS[k]) { e.preventDefault(); turn(KEYS[k]); }
    else if (k === "q" || k === "Escape") { e.preventDefault(); quit(); }
    else if (k === "r" && g.over) { e.preventDefault(); quit(); startGame(); }
  };
  let t0 = null;
  const onTouch = e => {
    t0 = e.touches[0];
    screen.addEventListener("touchend", ev => {
      const t = ev.changedTouches[0], dx = t.clientX - t0.clientX, dy = t.clientY - t0.clientY;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 12) { if (g.over) { quit(); startGame(); } return; }
      turn(Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)]);
    }, { once: true });
  };
  addEventListener("keydown", onKey, true);
  prompt.style.visibility = "hidden";
  screen.addEventListener("touchstart", onTouch, { passive: true });
  screen.style.touchAction = "none";
  draw();
  g.timer = setInterval(step, 130);
  $("#shell").scrollIntoView({ block: "nearest" });
}

/* ---------- start ---------- */

async function start() {
  if (store.get("panicked")) {
    store.set("panicked", null);
    scrollTo({ top: 0, behavior: "instant" });
    history.scrollRestoration = "auto";
    print(`<span class="note">last boot ended in a kernel panic. let's not do that again.</span>`);
  }
  if (!calm && !store.get("booted")) await boot();
  const wins = $$(".win");
  if (calm) { wins.forEach(show); return; }
  await show($("#hello"));
  const seen = new IntersectionObserver(entries => {
    for (const e of entries) if (e.isIntersecting) { seen.unobserve(e.target); show(e.target); }
  }, { threshold: 0.2 });
  wins.slice(1).forEach(w => seen.observe(w));
}

live();
document.fonts.ready.then(place);
document.fonts.load(`16px inphex`).finally(start);
