/* Home page behaviour: headline, avatar, journey, skills radar, reads carousel, section tracking and the contact form. */
(function () {
"use strict";
/* A hash never reaches the server, so a wrong one cannot answer 404 by itself.
   Anchors that existed before the redesign keep landing on the section that
   replaced them; anything else is a wrong address. */
const LEGACY = {about:"me", approach:"me", experience:"journey", work:"projects"};
(function checkHash(){
  let id = "";
  try { id = decodeURIComponent(location.hash.slice(1)); } catch (e) { id = location.hash.slice(1); }
  if (!id || document.getElementById(id)) return;
  if (LEGACY[id]) { location.replace("#" + LEGACY[id]); return; }
  location.replace("404.html");
})();

/* A portfolio opens at the top; a shared address that names a section is the one case that still wins. */
if ("scrollRestoration" in history){
  history.scrollRestoration = "manual";
  if (!location.hash) addEventListener("load", () => window.scrollTo(0, 0));
}
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- home: name and headline ---------- */
const nameEl = document.getElementById("name");
if (!reduce){
  let i = 0;
  const split = (node) => [...node.childNodes].forEach(n => {
    if (n.nodeType === 3){
      const frag = document.createDocumentFragment();
      [...n.textContent].forEach(ch => {
        const s = document.createElement("span");
        if (ch === " "){ s.className = "sp"; s.textContent = " "; }
        else { s.className = "ch"; s.textContent = ch; s.style.animationDelay = (120 + i++ * 38) + "ms"; }
        s.setAttribute("aria-hidden","true");
        frag.appendChild(s);
      });
      n.replaceWith(frag);
    } else split(n);
  });
  split(nameEl);
}
const hl = document.getElementById("headline");
const esc = s => s.replace(/&/g,"&amp;").replace(/</g,"&lt;");
const parts = hl.textContent.split("|").map(s => s.trim());
/* the role stands on its own line; the specialisms follow it, separated by bullets */
const piece = (p,i) => `<span class="${i===0?"first":""}" data-delay="${700 + i*90}">${esc(p)}</span>`;
hl.innerHTML = piece(parts[0], 0) + '<br>' + parts.slice(1).map((p,i) => piece(p, i + 1)).join(' <span class="sep" aria-hidden="true">•</span> ');
hl.querySelectorAll("[data-delay]").forEach(s => s.style.animationDelay = s.dataset.delay + "ms");
hl.querySelectorAll(".sep").forEach((s,i) => s.style.animationDelay = (740 + i*90) + "ms");

/* tap or Enter switches between the treated portrait and the original photo */


/* ---------- data ---------- */
const JOBS = [
  {co:"BTC Embedded Systems", mark:"BTC", role:"Senior QA Engineer", when:"12/2022 – present", current:true,
   text:"Own the test automation strategy for safety critical automotive and HIL products. Led the Cypress to Playwright and TypeScript migration, built visual regression from scratch, added GraphQL coverage inside the CI/CD quality gates, and moved onto Claude Code and Playwright MCP.",
   tags:["Playwright","TypeScript","Cypress","GraphQL","Visual regression","CI/CD gates",{t:"Claude Code",ai:1},{t:"Playwright MCP",ai:1}]},
  {co:"Endava", mark:"En", role:"Senior QA Engineer", when:"06/2021 – 12/2022",
   text:"Built regression suites in WebdriverIO and Jest across two enterprise platforms, maritime and insurance, then removed their dependency on live third party systems through Docker, Mountebank stubbing and Pega orchestration.",
   tags:["WebdriverIO","Jest","Docker","Mountebank","Pega"]},
  {co:"Variston", mark:"Va", role:"Senior QA Engineer", when:"09/2019 – 09/2020",
   text:"Wrote a Java and Selenium framework from scratch on Jenkins and Kubernetes, and self studied penetration testing to take on security QA of a command and control red teaming platform.",
   tags:["Java","Selenium","Jenkins","Kubernetes","Security QA"]},
  {co:"Ness Digital Engineering", mark:"Ne", role:"Senior QA Engineer", when:"01/2019 – 08/2019",
   text:"Engineered the first structured automation layer for Universal Music Group London's global platform in C#, Selenium, SpecFlow and NUnit, then extended it into the API layer and cross browser suites on BrowserStack.",
   tags:["C#","Selenium","SpecFlow","NUnit","API testing","BrowserStack"]},
  {co:"IT Vizion", mark:"IV", role:"Lead QA Engineer", when:"04/2018 – 01/2019", extra:true,
   text:"Promoted from Senior QA Engineer to lead the team's day to day work, mentor testers and sign off releases. Rolled out codeless, keyword driven scripting so that non technical testers could contribute coverage.",
   tags:["Team lead","Mentoring","Release sign-off","Keyword driven"]},
  {co:"Plan.Net Group", mark:"PN", role:"Software QA Engineer", when:"01/2013 – 04/2018", extra:true,
   text:"Built a requirement based library of 300+ test scenarios in TestLink and sustained coverage across iOS, Android via Appium, and five browser engines, with crash triage on physical devices.",
   tags:["TestLink","Appium","iOS","Android","Cross browser"]},
  {co:"12snap", mark:"12", role:"Software QA Engineer", when:"09/2010 – 01/2013", extra:true,
   text:"Launched the company's first test case library, establishing functional, regression and acceptance coverage for airline and native mobile applications where no QA process existed.",
   tags:["Test design","Mobile","Acceptance testing"]},
  {co:"Earlier roles", mark:"··", role:"Software, database and infrastructure", when:"08/2000 – 09/2010", extra:true,
   text:"Software and database roles at Toluna and First Emergency Hospital, and infrastructure engineering at Iprotim and Halcrow, before moving into QA in 2010.",
   tags:[]}
];

/* where and when each skill was used, taken from the roles above; ring 0 = now, 1 = 2021 to 2025, 2 = before 2021 */
const GROUPS = [
  {id:"auto", name:"Test automation", c:"var(--pri)"},
  {id:"ai", name:"AI and agentic", c:"var(--gold-fill)"},
  {id:"infra", name:"CI and infrastructure", c:"var(--slate)"},
  {id:"craft", name:"Languages and practice", c:"var(--faint)"}
];
const SKILLS = [
  {n:"Playwright", g:"auto", r:0, where:[["BTC Embedded Systems","using it since 2025"],["Agentic Playwright Suite","own project"]]},
  {n:"Visual regression", g:"auto", r:0, where:[["BTC Embedded Systems","using it since 2025"],["Agentic Playwright Suite","own project"]]},
  {n:"GraphQL testing", g:"auto", r:0, where:[["BTC Embedded Systems","using it since 2025"]]},
  {n:"API testing", g:"auto", r:0, where:[["Agentic Playwright Suite","REST, own project"],["Ness Digital Engineering","2019"]]},
  {n:"Allure", g:"auto", r:0, where:[["Agentic Playwright Suite","own project"]]},
  {n:"Cypress", g:"auto", r:1, where:[["BTC Embedded Systems","2022 – 2025, then Playwright"]]},
  {n:"WebdriverIO", g:"auto", r:1, where:[["Endava","2021 – 2022"]]},
  {n:"Jest", g:"auto", r:1, where:[["Endava","2021 – 2022"]]},
  {n:"Selenium", g:"auto", r:2, where:[["Variston","2019 – 2020, Java"],["Ness Digital Engineering","2019, C#"]]},
  {n:"SpecFlow and NUnit", g:"auto", r:2, where:[["Ness Digital Engineering","2019"]]},
  {n:"Appium", g:"auto", r:2, where:[["Plan.Net Group","2013 – 2018"]]},
  {n:"Claude Code", g:"ai", r:0, where:[["BTC Embedded Systems","using it since 2025"],["Agentic Playwright Suite","own project"]]},
  {n:"Playwright MCP", g:"ai", r:0, where:[["BTC Embedded Systems","using it since 2025"],["Agentic Playwright Suite","own project"]]},
  {n:"Agents and subagents", g:"ai", r:0, where:[["BTC Embedded Systems","using it since 2025"]]},
  {n:"Agent Skills", g:"ai", r:0, where:[["BTC Embedded Systems","using it since 2025"]]},
  {n:"MCP", g:"ai", r:0, where:[["BTC Embedded Systems","using it since 2025"]]},
  {n:"GitHub Copilot", g:"ai", r:0, where:[["BTC Embedded Systems","using it since 2025"]]},
  {n:"GitHub Actions", g:"infra", r:0, where:[["Agentic Playwright Suite","own project"],["This portfolio","own project"]]},
  {n:"CI/CD quality gates", g:"infra", r:0, where:[["BTC Embedded Systems","using it since 2025"]]},
  {n:"Docker", g:"infra", r:0, where:[["Agentic Playwright Suite","own project"],["Endava","2021 – 2022"]]},
  {n:"Mountebank", g:"infra", r:1, where:[["Endava","2021 – 2022"]]},
  {n:"Jenkins", g:"infra", r:2, where:[["Variston","2019 – 2020"]]},
  {n:"Kubernetes", g:"infra", r:2, where:[["Variston","2019 – 2020"]]},
  {n:"BrowserStack", g:"infra", r:2, where:[["Ness Digital Engineering","2019"]]},
  {n:"TypeScript", g:"craft", r:0, where:[["BTC Embedded Systems","using it since 2022"],["Agentic Playwright Suite","own project"]]},
  {n:"Test strategy", g:"craft", r:0, where:[["BTC Embedded Systems","owned since 2022"],["Variston","built, 2019 – 2020"],["Ness Digital Engineering","built, 2019"]]},
  {n:"JavaScript", g:"craft", r:1, where:[["Endava","2021 – 2022"]]},
  {n:"Java", g:"craft", r:2, where:[["Variston","2019 – 2020"]]},
  {n:"C#", g:"craft", r:2, where:[["Ness Digital Engineering","2019"]]},
  {n:"Security QA", g:"craft", r:2, where:[["Variston","2019 – 2020"]]},
  {n:"Team lead, mentoring", g:"craft", r:2, where:[["IT Vizion","2018 – 2019"]]},
  {n:"Test design", g:"craft", r:2, where:[["Plan.Net Group","2013 – 2018, TestLink"],["12snap","2010 – 2013"]]}
];

/* LinkedIn articles, newest first */
const READS = [
  {title:"Why I Stopped Prompting AI and Started Building Skills for It", date:"2026-08-11", mins:4,
   img:"assets/img/article-cover.jpg",
   excerpt:"Ad-hoc prompting gives two different answers to the same request. How our Playwright suite moved to Claude Code agents and skills that share one set of conventions.",
   url:"https://www.linkedin.com/pulse/why-i-stopped-prompting-ai-started-building-skills-emanuela-telescu-tmc0f/"}
];

/* ---------- journey ---------- */
const chev = '<svg class="chev" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
const tl = document.getElementById("timeline");
tl.insertAdjacentHTML("beforeend", JOBS.map((j,i) => `
  <article class="job${j.current?" current":""}${j.extra?" extra":""} rv ${i%2?"l":"r"}">
    <div class="job-card">
      <button class="job-head" type="button" aria-expanded="false" aria-controls="job-${i}" id="jobh-${i}">
        <span class="logo" aria-hidden="true">${j.mark}</span>
        <span><span class="job-co">${j.co}</span><span class="job-role">${j.role}</span><span class="job-when">${j.when}</span></span>
        ${chev}
      </button>
      <div class="job-body" id="job-${i}" role="region" aria-labelledby="jobh-${i}">
        <div>
          <p>${j.text}</p>
          ${j.tags.length ? `<ul class="tags">${j.tags.map(t => typeof t==="string" ? `<li>${t}</li>` : `<li class="ai">${t.t}</li>`).join("")}</ul>` : `<div class="tags-spacer"></div>`}
        </div>
      </div>
    </div>
  </article>`).join(""));
tl.addEventListener("click", e => {
  const b = e.target.closest(".job-head"); if (!b) return;
  b.setAttribute("aria-expanded", b.getAttribute("aria-expanded")==="true" ? "false" : "true");
});
const moreJobs = document.getElementById("moreJobs");
moreJobs.addEventListener("click", () => {
  const open = tl.classList.toggle("show-all");
  moreJobs.setAttribute("aria-expanded", open);
  moreJobs.textContent = open ? "Show fewer roles" : "Show earlier roles";
  tl.querySelectorAll(".job.extra").forEach(j => j.classList.remove("pre"));
});
const fill = tl.querySelector(".fill");

/* ---------- skills: radar ---------- */
const radar = document.getElementById("radar");
const legend = document.getElementById("legend");
const skDetail = document.getElementById("skDetail");
const skList = document.getElementById("skList");
const gById = Object.fromEntries(GROUPS.map(g => [g.id, g]));
const QUART = {auto:[0,90], ai:[90,180], infra:[180,270], craft:[270,360]};   /* degrees clockwise from 12 o'clock */
const BAND = [[.09,.46],[.50,.72],[.76,.96]];                               /* fraction of the radius, per ring */
const SWEEP_S = 7;
legend.innerHTML = GROUPS.map(g => `<button type="button" data-g="${g.id}" aria-pressed="false"><span class="sw g-${g.id}"></span>${g.name}</button>`).join("");
const nodes = SKILLS.map((s,k) => {
  const g = gById[s.g];
  const el = document.createElement("button");
  el.type = "button"; el.className = "rl" + (s.r === 0 ? " now" : "");
  el.style.setProperty("--c", g.c); el.style.setProperty("--ring", s.r); el.style.setProperty("--k", k % 8);
  el.innerHTML = `<span class="dot" aria-hidden="true"></span><span class="txt">${s.n}</span>`;
  el.setAttribute("aria-label", s.n);
  radar.appendChild(el);
  return {s, k, el, x:0, y:0, w:0, h:0, lft:false};
});
skList.innerHTML = SKILLS.map((s,k) => `<button type="button" data-k="${k}" aria-pressed="false" class="g-${s.g}"><span class="d" aria-hidden="true"></span>${s.n}</button>`).join("");
const listBtns = [...skList.querySelectorAll("button")];

function layoutRadar(){
  const S = radar.clientWidth, R = S / 2, small = S < 520;
  radar.classList.toggle("dots", small); radar.parentElement.classList.toggle("dots", small);
  const buckets = {};
  nodes.forEach(n => (buckets[n.s.g + n.s.r] ||= []).push(n));
  Object.values(buckets).forEach(list => {
    const [a0, a1] = QUART[list[0].s.g], [r0, r1] = BAND[list[0].s.r];
    const pad = 9, span = (a1 - a0 - 2 * pad);
    list.forEach((n, i) => {
      n.a = a0 + pad + span * (list.length === 1 ? .5 : i / (list.length - 1));
      n.rf = list.length === 1 ? (r0 + r1) / 2 : r0 + (r1 - r0) * (i % 2 ? .78 : .28);
    });
  });
  const place = n => {
    const rad = (n.a - 90) * Math.PI / 180;
    n.x = R + Math.cos(rad) * n.rf * R; n.y = R + Math.sin(rad) * n.rf * R;
    n.lft = !small && n.a > 180;
  };
  nodes.forEach(n => { place(n); n.el.classList.toggle("lft", n.lft); });
  {
    nodes.forEach(n => { n.w = small ? 20 : n.el.offsetWidth; n.h = small ? 20 : n.el.offsetHeight; });
    const rect = n => small ? [n.x - 10, n.y - 10, n.x + 10, n.y + 10] : n.lft ? [n.x + 9 - n.w, n.y - n.h/2, n.x + 9, n.y + n.h/2] : [n.x - 9, n.y - n.h/2, n.x - 9 + n.w, n.y + n.h/2];
    /* push overlapping labels apart along the shorter overlap, then keep each one inside its own quarter and ring */
    for (let it = 0; it < 400; it++){
      let moved = false;
      for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++){
        const P = nodes[i], Q = nodes[j], A = rect(P), B = rect(Q);
        const ox = Math.min(A[2], B[2]) - Math.max(A[0], B[0]) + 6, oy = Math.min(A[3], B[3]) - Math.max(A[1], B[1]) + 4;
        if (ox <= 0 || oy <= 0) continue;
        moved = true;
        if (oy < ox){
          const d = (A[1] + A[3]) < (B[1] + B[3]) ? -1 : 1, m = Math.min(oy, 12) / 2 + .5;
          P.y += d * m; Q.y -= d * m;
        } else {
          const d = (A[0] + A[2]) < (B[0] + B[2]) ? -1 : 1, m = Math.min(ox, 12) / 2 + .5;
          P.x += d * m; Q.x -= d * m;
        }
      }
      nodes.forEach(n => {
        let ang = Math.atan2(n.y - R, n.x - R) * 180 / Math.PI + 90; if (ang < 0) ang += 360;
        let rf = Math.hypot(n.x - R, n.y - R) / R;
        if (n.s.g === "craft" && ang < 90) ang += 360;
        if (n.s.g === "auto" && ang > 270) ang -= 360;
        const [a0, a1] = QUART[n.s.g], [r0, r1] = BAND[n.s.r];
        n.a = Math.min(Math.max(ang, a0 + 3), a1 - 3); n.rf = Math.min(Math.max(rf, r0), r1);
        place(n);
      });
      if (!moved) break;
    }
  }
  nodes.forEach(n => {
    n.el.style.left = n.x + "px"; n.el.style.top = n.y + "px";
    /* each dot pings exactly when the sweep passes over it */
    n.el.querySelector(".dot").style.setProperty("--dl", (n.a / 360 * SWEEP_S - SWEEP_S).toFixed(2) + "s");
  });
}
radar.style.setProperty("--D", SWEEP_S + "s");

function showSkill(k){
  queueMicrotask(() => skDetail.querySelectorAll("[data-delay]").forEach(li => li.style.animationDelay = li.dataset.delay + "ms"));
  const s = SKILLS[k], g = gById[s.g];
  nodes.forEach(n => n.el.classList.toggle("sel", n.k === k));
  listBtns.forEach(b => b.setAttribute("aria-pressed", +b.dataset.k === k ? "true" : "false"));
  const when = ["Now", "2021 to 2025", "Before 2021"][s.r];
  skDetail.innerHTML = `
    <span class="lbl">${g.name} · ${when}</span>
    <h3 class="g-${s.g}"><span class="d" aria-hidden="true"></span>${s.n}</h3>
    <ul class="where">${s.where.map(([w,t],i) => `<li data-delay="${i*60}">${w}<span>${t}</span></li>`).join("")}</ul>
    ${s.where.some(w => w[0] === "BTC Embedded Systems") ? '<p class="grp">I have worked at BTC Embedded Systems since December 2022.</p>' : ""}`;
}
nodes.forEach(n => {
  n.el.addEventListener("mouseenter", () => showSkill(n.k));
  n.el.addEventListener("focus", () => showSkill(n.k));
  n.el.addEventListener("click", () => showSkill(n.k));
});
skList.addEventListener("click", e => { const b = e.target.closest("button"); if (b) showSkill(+b.dataset.k); });
legend.addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  const on = b.getAttribute("aria-pressed") !== "true";
  legend.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b && on ? "true" : "false"));
  const g = on ? b.dataset.g : null;
  nodes.forEach(n => n.el.classList.toggle("off", !!g && n.s.g !== g));
  listBtns.forEach(x => x.classList.toggle("off", !!g && SKILLS[x.dataset.k].g !== g));
  if (g){ const first = nodes.find(n => n.s.g === g); if (first) showSkill(first.k); }
});
(document.fonts ? document.fonts.ready : Promise.resolve()).then(layoutRadar);
let radarW = radar.clientWidth;
addEventListener("resize", () => { if (Math.abs(radar.clientWidth - radarW) > 8){ radarW = radar.clientWidth; layoutRadar(); } });
showSkill(0);

/* ---------- reads: carousel ---------- */
const track = document.getElementById("readTrack");
const prevRead = document.getElementById("prevRead"), nextRead = document.getElementById("nextRead");
const fmtDate = d => new Date(d + "T00:00:00").toLocaleDateString("en-GB", {day:"numeric", month:"short", year:"numeric"});
track.innerHTML = READS.map(r => `
  <a class="art" href="${r.url}">
    <img src="${r.img}" alt="" width="1018" height="530" loading="lazy">
    <div class="art-body">
      <h3>${r.title}</h3>
      <p>${r.excerpt}</p>
      <div class="art-meta"><span>${fmtDate(r.date)} · ${r.mins} min</span><b>Read ↗</b></div>
    </div>
  </a>`).join("");
function syncCarousel(){
  const max = track.scrollWidth - track.clientWidth;
  prevRead.disabled = track.scrollLeft <= 2;
  nextRead.disabled = track.scrollLeft >= max - 2;
}
const cardStep = () => (track.querySelector(".art")?.offsetWidth || 260) + 20;
prevRead.addEventListener("click", () => track.scrollBy({left: -cardStep(), behavior: reduce ? "auto" : "smooth"}));
nextRead.addEventListener("click", () => track.scrollBy({left: cardStep(), behavior: reduce ? "auto" : "smooth"}));
track.addEventListener("scroll", syncCarousel, {passive:true});
addEventListener("resize", syncCarousel);
syncCarousel();

/* ---------- reveal: only hide what is still below the fold, so nothing is hidden at rest or without JS ---------- */
if (!reduce && "IntersectionObserver" in window){
  const io = new IntersectionObserver(es => es.forEach(en => {
    if (!en.isIntersecting) return;
    en.target.classList.add("in"); en.target.classList.remove("pre"); io.unobserve(en.target);
  }), {rootMargin:"0px 0px -8% 0px"});
  document.querySelectorAll(".rv").forEach(el => {
    if (el.getBoundingClientRect().top > innerHeight){ el.classList.add("pre"); io.observe(el); }
  });
  /* the radar draws its rings and pops the skills in, the first time it scrolls into view */
  if (radar.getBoundingClientRect().top > innerHeight * .8){
    radar.classList.add("wait");
    const rio = new IntersectionObserver(([en]) => {
      if (!en.isIntersecting) return;
      radar.classList.remove("wait"); radar.classList.add("go"); rio.disconnect();
    }, {rootMargin:"0px 0px -20% 0px"});
    rio.observe(radar);
  }
}

/* ---------- header state, active section, timeline progress ---------- */
const bar = document.getElementById("bar");
const nav = document.getElementById("nav");
const links = [...nav.querySelectorAll("a")];
const sections = links.map(a => document.querySelector(a.hash));
let lastActive = "";
function setActive(id){
  if (id === lastActive) return; lastActive = id;
  links.forEach(a => a.setAttribute("aria-current", a.hash === "#" + id ? "true" : "false"));
  const cur = links.find(a => a.hash === "#" + id);
  /* scroll only the nav strip sideways; scrollIntoView here would cancel the page's smooth scroll */
  if (cur && nav.scrollWidth > nav.clientWidth){
    nav.scrollTo({left: cur.offsetLeft - (nav.clientWidth - cur.offsetWidth) / 2, behavior: reduce ? "auto" : "smooth"});
  }
}
let ticking = false;
function onScroll(){
  ticking = false;
  bar.classList.toggle("scrolled", scrollY > 8);
  const probe = scrollY + innerHeight * .35;
  let id = "home";
  sections.forEach(s => { if (s && s.offsetTop <= probe) id = s.id; });
  if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) id = "contact";
  setActive(id);
  const r = tl.getBoundingClientRect();
  const p = Math.min(Math.max((innerHeight * .6 - r.top) / r.height, 0), 1);
  fill.style.setProperty("--p", (p * 100).toFixed(1) + "%");
}
addEventListener("scroll", () => { if (!ticking){ ticking = true; requestAnimationFrame(onScroll); } }, {passive:true});
addEventListener("resize", onScroll);
links.forEach(a => a.addEventListener("click", () => setActive(a.hash.slice(1))));
onScroll();

/* ---------- contact: copy and form ---------- */
document.querySelectorAll("[data-copy]").forEach(btn => btn.addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(btn.dataset.copy); btn.textContent = "Copied"; }
  catch (e) { const r = document.createRange(); r.selectNodeContents(document.getElementById("mail")); const s = getSelection(); s.removeAllRanges(); s.addRange(r); btn.textContent = "Selected"; }
  setTimeout(() => btn.textContent = "Copy", 1800);
}));

const FORM_ENDPOINT = "https://formspree.io/f/mqpkyrbk";
const form = document.getElementById("contactForm");
const statusEl = document.getElementById("formStatus");
const sendBtn = document.getElementById("sendBtn");
const checks = {
  "name-f": v => v.trim().length > 1,
  "email-f": v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()),
  "subject-f": v => v !== "",
  "message-f": v => v.trim().length > 9
};
Object.keys(checks).forEach(id => document.getElementById(id).addEventListener("input", e => {
  if (checks[id](e.target.value)){ e.target.closest(".f").classList.remove("bad"); e.target.setAttribute("aria-invalid","false"); }
}));
form.addEventListener("submit", async e => {
  e.preventDefault();
  let first = null;
  Object.entries(checks).forEach(([id,fn]) => {
    const el = document.getElementById(id), ok = fn(el.value);
    el.closest(".f").classList.toggle("bad", !ok);
    el.setAttribute("aria-invalid", ok ? "false" : "true");
    if (!ok && !first) first = el;
  });
  if (first){ first.focus(); return; }
  sendBtn.disabled = true; sendBtn.textContent = "Sending…"; statusEl.className = "status";
  try {
    const res = await fetch(FORM_ENDPOINT, {method:"POST", headers:{"Accept":"application/json"}, body:new FormData(form)});
    if (!res.ok) throw new Error(res.status);
    form.reset();
    statusEl.className = "status ok";
    statusEl.textContent = "Thanks, your message is on its way. I usually reply within a day.";
  } catch (err) {
    statusEl.className = "status no";
    statusEl.textContent = "The message did not send. Please email me directly at emanuela.telescu@yahoo.com.";
  } finally {
    sendBtn.disabled = false; sendBtn.textContent = "Send message";
  }
});

})();
