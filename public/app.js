const ROUTINE_KEY = "gym:last-routine";
const THEME_KEY = "gym:theme";
const PLACE_KEY = "gym:place";
const THEMES = ["auto", "light", "dark"];
const TAGS = { ski: "Ski", posture: "Posture", cycling: "Cycling" };
const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");

let data = null;

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(c));
  }
  return el;
}

function list(tag, items) {
  return items && items.length ? h(tag, {}, items.map((t) => h("li", {}, t))) : null;
}

function load_(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function save(key, value) {
  try { localStorage.setItem(key, value); } catch {}
}

function currentTheme() {
  const t = load_(THEME_KEY);
  return THEMES.includes(t) ? t : "auto";
}

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === "auto") delete root.dataset.theme;
  else root.dataset.theme = theme;
  const dark = theme === "dark" || (theme === "auto" && darkQuery.matches);
  document.querySelector('meta[name="theme-color"]').content = dark ? "#0F1110" : "#F4F4EF";
  const btn = document.getElementById("theme");
  btn.textContent = theme;
  btn.setAttribute("aria-label", `Colour theme: ${theme}. Tap to change.`);
}

function setupTheme() {
  applyTheme(currentTheme());
  document.getElementById("theme").addEventListener("click", () => {
    const next = THEMES[(THEMES.indexOf(currentTheme()) + 1) % THEMES.length];
    save(THEME_KEY, next);
    applyTheme(next);
  });
  darkQuery.addEventListener("change", () => applyTheme(currentTheme()));
}

function exerciseCard(item, index) {
  const ex = data.exercises[item.ex];
  if (!ex) return h("p", { class: "error" }, `Unknown exercise: ${item.ex}`);
  const tag = item.tag && TAGS[item.tag] ? h("span", { class: `tag tag-${item.tag}` }, TAGS[item.tag]) : null;
  const scale = [
    ex.easier && h("p", {}, h("b", {}, "Easier: "), ex.easier),
    ex.harder && h("p", {}, h("b", {}, "Harder: "), ex.harder),
    ex.alt && h("p", {}, h("b", {}, "Alternative: "), ex.alt),
  ].filter(Boolean);

  return h("details", { class: "card" },
    h("summary", {},
      h("span", { class: "idx" }, item.label || String(index).padStart(2, "0")),
      h("span", { class: "name" }, ex.name, tag),
      h("span", { class: "dose" }, item.dose),
      item.note && h("span", { class: "cue" }, item.note)
    ),
    h("div", { class: "detail" },
      ex.equipment && h("p", { class: "kit" }, ex.equipment),
      ex.setup && h("h3", {}, "Setup"), list("ul", ex.setup),
      ex.movement && h("h3", {}, "Movement"), list("ol", ex.movement),
      ex.cues && h("h3", {}, "Key points"), list("ul", ex.cues),
      scale.length ? h("div", { class: "scale" }, scale) : null
    )
  );
}

function currentPlace() {
  const p = load_(PLACE_KEY);
  return p && (data.places || []).some((x) => x.id === p) ? p : "all";
}

function availableAt(routine, place) {
  return place === "all" || !routine.places || !routine.places.length || routine.places.includes(place);
}

function visibleRoutines() {
  const place = currentPlace();
  const routines = data.routines.filter((r) => availableAt(r, place));
  if (place === "all") return routines;
  const anywhere = (r) => !r.places || !r.places.length;
  return [...routines.filter((r) => !anywhere(r)), ...routines.filter(anywhere)];
}

function renderKit() {
  const place = (data.places || []).find((p) => p.id === currentPlace());
  const el = document.getElementById("kit");
  el.hidden = !place;
  if (!place) return;
  el.replaceChildren(
    h("summary", {}, h("span", { class: "name" }, `What's at ${place.name}`), h("span", { class: "dose" }, `${place.equipment.length} items`)),
    h("div", { class: "detail" }, list("ul", place.equipment))
  );
}

function renderRoutine(id) {
  let routine = data.routines.find((r) => r.id === id);
  if (routine && !availableAt(routine, currentPlace())) {
    save(PLACE_KEY, routine.places[0]);
    renderTabs();
  }
  routine = routine || visibleRoutines().find((r) => r.id === load_(ROUTINE_KEY)) || visibleRoutines()[0] || data.routines[0];
  save(ROUTINE_KEY, routine.id);
  document.title = `${routine.name} · tally`;

  for (const tab of document.querySelectorAll(".tab")) {
    const on = tab.dataset.id === routine.id;
    tab.setAttribute("aria-current", on ? "true" : "false");
    if (on) tab.scrollIntoView({ block: "nearest", inline: "center" });
  }

  let n = 0;
  document.getElementById("main").replaceChildren(...[
    h("h1", {}, routine.name),
    routine.equipment && h("p", { class: "equip" }, routine.equipment),
    routine.stats && routine.stats.length
      ? h("div", { class: "stats" }, routine.stats.map(([v, l]) => h("div", { class: "stat" }, h("b", {}, v), h("span", {}, l))))
      : null,
    routine.format && h("p", { class: "format" }, routine.format),
    routine.warmup && routine.warmup.length
      ? h("details", { class: "card warmup" },
          h("summary", {}, h("span", { class: "name" }, "Warm-up"), h("span", { class: "dose" }, `${routine.warmup.length} moves`)),
          h("div", { class: "detail" }, list("ul", routine.warmup)))
      : null,
    routine.blocks.map((block) =>
      h("section", { class: "block" },
        h("h2", { class: "block-title" }, block.title),
        block.items.map((item) => exerciseCard(item, ++n)))
    ),
    routine.notes && routine.notes.length ? h("ul", { class: "notes" }, routine.notes.map((t) => h("li", {}, t))) : null,
  ].flat().filter(Boolean));
  window.scrollTo(0, 0);
}

function renderTabs() {
  const place = currentPlace();
  const select = h("select", {
    class: "place",
    "aria-label": "Place",
    onchange: (e) => {
      save(PLACE_KEY, e.target.value);
      renderTabs();
      const current = data.routines.find((r) => r.id === location.hash.slice(1));
      if (current && availableAt(current, e.target.value)) renderRoutine(current.id);
      else location.hash = visibleRoutines()[0].id;
    },
  },
    h("option", { value: "all" }, "All places"),
    (data.places || []).map((p) => h("option", { value: p.id }, p.name))
  );
  select.value = place;

  document.getElementById("tabs").replaceChildren(
    select,
    ...visibleRoutines().map((r) =>
      h("button", {
        class: "tab",
        type: "button",
        "data-id": r.id,
        "aria-current": r.id === location.hash.slice(1) ? "true" : "false",
        onclick: () => { location.hash = r.id; },
      }, r.short || r.name)
    )
  );
  renderKit();
}

function setStatus(fromCache) {
  const offline = fromCache || !navigator.onLine;
  document.getElementById("status").replaceChildren(
    offline ? h("span", { class: "offline" }, "OFFLINE · ") : "",
    `routines updated ${data.updated}`
  );
}

async function load() {
  try {
    const res = await fetch("routines.json", { cache: "no-cache" });
    if (!res.ok) throw new Error(res.status);
    data = await res.json();
    renderTabs();
    renderRoutine(location.hash.slice(1) || load_(ROUTINE_KEY));
    setStatus(res.headers.get("x-gym-cache") === "1");
  } catch {
    document.getElementById("main").replaceChildren(
      h("p", { class: "error" }, "Couldn't load routines. Open the page once while connected so it can save an offline copy.")
    );
  }
}

let wakeLock = null;
function setupWake() {
  if (!("wakeLock" in navigator)) return;
  const btn = document.getElementById("wake");
  btn.hidden = false;
  const sync = () => btn.setAttribute("aria-pressed", wakeLock ? "true" : "false");
  const acquire = async () => {
    try {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => {
        if (document.visibilityState === "visible") { wakeLock = null; sync(); }
      });
    } catch {
      wakeLock = null;
    }
  };
  btn.addEventListener("click", async () => {
    if (wakeLock) {
      const lock = wakeLock;
      wakeLock = null;
      await lock.release();
    } else {
      await acquire();
    }
    sync();
  });
  document.addEventListener("visibilitychange", async () => {
    if (wakeLock && document.visibilityState === "visible") {
      await acquire();
      sync();
    }
  });
}

window.addEventListener("hashchange", () => data && renderRoutine(location.hash.slice(1)));
window.addEventListener("online", () => data && setStatus(false));
window.addEventListener("offline", () => data && setStatus(true));

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

setupTheme();
setupWake();
load();
