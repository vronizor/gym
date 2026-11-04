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

function read(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function save(key, value) {
  try { localStorage.setItem(key, value); } catch {}
}

function currentTheme() {
  const t = read(THEME_KEY);
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

const places = () => data.places || [];
const placeById = (id) => places().find((p) => p.id === id);
const anywhere = (r) => !r.places || !r.places.length;

function currentPlace() {
  const p = read(PLACE_KEY);
  return placeById(p) ? p : "all";
}

function routinesFor(place) {
  if (place === "all") return data.routines;
  const routines = data.routines.filter((r) => anywhere(r) || r.places.includes(place));
  return [...routines.filter((r) => !anywhere(r)), ...routines.filter(anywhere)];
}

function placePills(routine) {
  if (anywhere(routine)) return [h("span", { class: "pl pl-any" }, "Anywhere")];
  return routine.places.map((id) => {
    const p = placeById(id);
    return h("span", { class: `pl hue-${p?.hue || "none"}` }, p?.name || id);
  });
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

function renderHome() {
  document.title = "tally";
  const place = currentPlace();
  const kit = placeById(place);
  const pick = (id) => () => { save(PLACE_KEY, id); renderHome(); };

  document.getElementById("main").replaceChildren(...[
    h("div", { class: "filter", role: "group", "aria-label": "Place" },
      h("button", { type: "button", class: "chip", "aria-pressed": String(place === "all"), onclick: pick("all") }, "All"),
      places().map((p) =>
        h("button", { type: "button", class: `chip hue-${p.hue || "none"}`, "aria-pressed": String(place === p.id), onclick: pick(p.id) }, p.name))
    ),
    h("div", { class: "grid" },
      routinesFor(place).map((r) =>
        h("a", { class: "tile", href: `#${r.id}` },
          h("span", { class: "tile-name" }, r.name),
          r.stats && r.stats[0] && h("span", { class: "tile-meta" }, r.stats.slice(0, 2).map(([v]) => v).join(" · ")),
          h("span", { class: "pills" }, placePills(r))
        ))
    ),
    kit && h("details", { class: "card kit-card" },
      h("summary", {}, h("span", { class: "name" }, `What's at ${kit.name}`), h("span", { class: "dose" }, `${kit.equipment.length} item${kit.equipment.length === 1 ? "" : "s"}`)),
      h("div", { class: "detail" }, list("ul", kit.equipment))),
  ].flat().filter(Boolean));
}

function renderRoutine(routine) {
  document.title = `${routine.name} · tally`;
  let n = 0;
  document.getElementById("main").replaceChildren(...[
    h("a", { class: "back", href: "#" }, "← All routines"),
    h("h1", {}, routine.name),
    h("div", { class: "pills hero-pills" }, placePills(routine)),
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
}

function route() {
  if (!data) return;
  const routine = data.routines.find((r) => r.id === location.hash.slice(1));
  if (routine) renderRoutine(routine);
  else renderHome();
  window.scrollTo(0, 0);
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
    route();
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

window.addEventListener("hashchange", route);
window.addEventListener("online", () => data && setStatus(false));
window.addEventListener("offline", () => data && setStatus(true));

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

setupTheme();
setupWake();
load();
