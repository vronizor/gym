const STORE_KEY = "gym:last-routine";
const TAGS = { ski: "Ski", posture: "Posture", cycling: "Cycling" };

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

function store(get, value) {
  try {
    return get ? localStorage.getItem(STORE_KEY) : localStorage.setItem(STORE_KEY, value);
  } catch {
    return null;
  }
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
      h("span", { class: "num" }, item.label || String(index)),
      h("span", {}, h("span", { class: "name" }, ex.name), tag, h("span", { class: "dose" }, item.dose)),
      h("span", { class: "chev", "aria-hidden": "true" })
    ),
    h("div", { class: "detail" },
      ex.equipment && h("p", { class: "equip" }, ex.equipment),
      ex.setup && h("h3", {}, "Setup"), list("ul", ex.setup),
      ex.movement && h("h3", {}, "Movement"), list("ol", ex.movement),
      ex.cues && h("h3", {}, "Key points"), list("ul", ex.cues),
      item.note && h("p", {}, item.note),
      scale.length ? h("div", { class: "scale" }, scale) : null
    )
  );
}

function renderRoutine(id) {
  const routine = data.routines.find((r) => r.id === id) || data.routines[0];
  store(false, routine.id);
  document.title = `${routine.name} · Gym`;

  for (const tab of document.querySelectorAll(".tab")) {
    const on = tab.dataset.id === routine.id;
    tab.setAttribute("aria-current", on ? "true" : "false");
    if (on) tab.scrollIntoView({ block: "nearest", inline: "center" });
  }

  let n = 0;
  const main = document.getElementById("main");
  main.replaceChildren(...[
    h("section", { class: "hero" },
      h("h1", {}, routine.name),
      h("div", { class: "meta" }, h("span", { class: "duration" }, routine.duration)),
      routine.format && h("p", { class: "format" }, routine.format)
    ),
    routine.warmup && routine.warmup.length
      ? h("details", { class: "card warmup" },
          h("summary", {}, h("span", { class: "name" }, "Warm-up"), h("span", { class: "chev", "aria-hidden": "true" })),
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
  document.getElementById("tabs").replaceChildren(
    ...data.routines.map((r) =>
      h("button", {
        class: "tab",
        type: "button",
        "data-id": r.id,
        onclick: () => { location.hash = r.id; },
      }, r.name)
    )
  );
}

function setStatus(fromCache) {
  const el = document.getElementById("status");
  const offline = fromCache || !navigator.onLine;
  el.replaceChildren(
    offline ? h("span", { class: "offline" }, "Offline · ") : "",
    `Routines updated ${data.updated}`
  );
}

async function load() {
  try {
    const res = await fetch("routines.json", { cache: "no-cache" });
    if (!res.ok) throw new Error(res.status);
    data = await res.json();
    renderTabs();
    renderRoutine(location.hash.slice(1) || store(true));
    setStatus(res.headers.get("x-gym-cache") === "1");
  } catch (err) {
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
  btn.addEventListener("click", async () => {
    if (wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    } else {
      try {
        wakeLock = await navigator.wakeLock.request("screen");
        wakeLock.addEventListener("release", () => { if (document.visibilityState === "visible") { wakeLock = null; sync(); } });
      } catch {
        wakeLock = null;
      }
    }
    sync();
  });
  document.addEventListener("visibilitychange", async () => {
    if (wakeLock && document.visibilityState === "visible") {
      try { wakeLock = await navigator.wakeLock.request("screen"); } catch { wakeLock = null; }
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

setupWake();
load();
