const THEME_KEY = "gym:theme";
const PLACE_KEY = "gym:place";
const THEMES = ["auto", "light", "dark"];
const TAGS = { ski: "Ski", posture: "Posture", cycling: "Cycling" };
const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");

let data = null;
let plan = null;
let races = null;

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat(Infinity)) {
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
  const routines = place === "all" ? data.routines : data.routines.filter((r) => anywhere(r) || r.places.includes(place));
  const ordered = place === "all" ? routines : [...routines.filter((r) => !anywhere(r)), ...routines.filter(anywhere)];
  return [...ordered.filter((r) => r.plan), ...ordered.filter((r) => !r.plan)];
}

function planStamp(routine) {
  if (!routine.plan) return null;
  return h("span", { class: "pl stamp" }, plan ? plan.race.name.replace(/ \d+ km$/, "") : "Plan");
}

function placePills(routine) {
  if (anywhere(routine)) return [h("span", { class: "pl pl-any" }, "Anywhere")];
  return routine.places.map((id) => {
    const p = placeById(id);
    return h("span", { class: `pl hue-${p?.hue || "none"}` }, p?.name || id);
  });
}

function videoLink(ex) {
  if (ex.yt === false) return null;
  const q = ex.yt || `${ex.name} exercise`;
  return h("a", {
    class: "yt",
    href: `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
    target: "_blank",
    rel: "noopener noreferrer",
  }, "Watch on YouTube ↗");
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
      (ex.equipment || ex.yt !== false) && h("div", { class: "kit-row" },
        ex.equipment && h("p", { class: "kit" }, ex.equipment),
        videoLink(ex)),
      ex.setup && h("h3", {}, "Setup"), list("ul", ex.setup),
      ex.movement && h("h3", {}, "Movement"), list("ol", ex.movement),
      ex.cues && h("h3", {}, "Key points"), list("ul", ex.cues),
      scale.length ? h("div", { class: "scale" }, scale) : null
    )
  );
}

const KIND = {
  test: "Test", quality: "Quality", torque: "Torque", long: "Long", "long-mtb": "MTB",
  endurance: "Easy", strength: "Strength", outdoor: "Outdoor", race: "Race",
};

function isoDay(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(iso, n) {
  const [y, m, d] = iso.split("-").map(Number);
  return isoDay(new Date(y, m - 1, d + n));
}

function shortDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function weekRange(w) {
  return `${shortDate(w.start)} – ${shortDate(addDays(w.start, 6))}`;
}

function currentWeekIndex() {
  const today = isoDay(new Date());
  const i = plan.weeks.findIndex((w) => today >= w.start && today <= addDays(w.start, 6));
  if (i >= 0) return i;
  return today < plan.weeks[0].start ? 0 : plan.weeks.length - 1;
}

function weekTitle(w) {
  return w.n ? `Week ${w.n} · ${w.phase}` : w.phase;
}

function withWatts(target) {
  const ftp = plan.ftp && plan.ftp.watts;
  const m = ftp && target.match(/(\d+)(?:–(\d+))?%/);
  if (!m || target.includes("→")) return target;
  const lo = Math.round((ftp * m[1]) / 100);
  const hi = m[2] ? Math.round((ftp * m[2]) / 100) : null;
  return `${target} · ${hi ? `${lo}–${hi}` : lo} W`;
}

function reportFor(w) {
  return (plan.reports || []).find((r) => r.week === w.start);
}

function sessionCard(item, index) {
  const ses = plan.sessions[item.s];
  if (!ses) return h("p", { class: "error" }, `Unknown session: ${item.s}`);
  const kind = KIND[ses.kind] || ses.kind;
  return h("details", { class: "card" },
    h("summary", {},
      h("span", { class: "idx" }, String(index).padStart(2, "0")),
      h("span", { class: "name" }, ses.name, h("span", { class: `tag tag-k-${ses.kind}` }, kind)),
      h("span", { class: "dose" }, item.min && ses.kind === "long-mtb" ? `${item.min / 60} h` : ses.dur),
      item.note && h("span", { class: "cue" }, item.note)
    ),
    h("div", { class: "detail" },
      h("p", { class: "kit" }, [ses.where, ses.coros].filter(Boolean).join(" · ")),
      ses.steps && ses.steps.length
        ? h("div", { class: "steps" }, ses.steps.map(([d, t, n]) =>
            h("div", { class: "step" },
              h("span", { class: "step-d" }, d),
              h("span", { class: "step-t" }, withWatts(t)),
              n && h("span", { class: "step-n" }, n))))
        : null,
      list("ul", ses.notes),
      ses.routine && h("a", { class: "yt", href: `#${ses.routine}` }, "Open routine →")
    )
  );
}

function weekBody(w) {
  const rep = reportFor(w);
  return [
    w.quote && h("blockquote", { class: "quote" }, w.quote),
    w.adjusted && h("p", { class: "adjusted" }, h("b", {}, "Adjusted: "), w.adjusted.reason),
    w.sessions.map((it, i) => sessionCard(it, i + 1)),
    w.notes && w.notes.length ? h("ul", { class: "notes week-notes" }, w.notes.map((t) => h("li", {}, t))) : null,
    rep && reportCard(rep, false),
  ];
}

function statusPill(status) {
  return status ? h("span", { class: `st st-${status}` }, status) : null;
}

function reportCard(r, open) {
  return h("details", { class: "card report", open: open || null },
    h("summary", {},
      h("span", { class: "name" }, `Review of ${shortDate(r.week)}`),
      h("span", { class: "dose" }, statusPill(r.status))),
    h("div", { class: "detail" },
      r.summary && h("p", {}, r.summary),
      r.done && r.done.length ? [h("h3", {}, "Done"), list("ul", r.done)] : null,
      r.changes && r.changes.length ? [h("h3", {}, "Changes to the plan"), list("ul", r.changes)] : null,
      r.rules && r.rules.length ? h("p", { class: "kit" }, `Rules applied: ${r.rules.join(", ")}`) : null));
}

function weekCard(w, current) {
  const rep = reportFor(w);
  return h("details", { class: `card week${current ? " week-now" : ""}`, open: current || null },
    h("summary", {},
      h("span", { class: "idx" }, w.n ? String(w.n).padStart(2, "0") : "··"),
      h("span", { class: "name" }, w.focus),
      h("span", { class: "dose" }, rep ? statusPill(rep.status) : w.hours),
      h("span", { class: "cue" }, `${weekRange(w)} · ${w.phase}${w.type === "recovery" ? " · recovery" : ""}`)),
    h("div", { class: "detail" }, weekBody(w)));
}

function renderPlan() {
  document.title = "Plan · tally";
  const i = currentWeekIndex();
  const w = plan.weeks[i];
  const race = plan.race;
  const raceWeek = plan.weeks.findIndex((x) => x.type === "race");
  const toGo = Math.max(0, raceWeek - i);
  const latest = (plan.reports || []).slice(-1)[0];
  let n = 0;

  document.getElementById("main").replaceChildren(...[
    h("a", { class: "back", href: "#" }, "← All routines"),
    h("h1", {}, race.name),
    h("div", { class: "stats" },
      h("div", { class: "stat" }, h("b", {}, String(toGo)), h("span", {}, toGo === 1 ? "week to go" : "weeks to go")),
      h("div", { class: "stat" }, h("b", {}, race.climb_m.toLocaleString("en-GB")), h("span", {}, `m up · ${race.km} km`)),
      h("div", { class: "stat" }, h("b", {}, `${plan.ftp.watts} W`), h("span", {}, plan.ftp.tested ? `FTP · ${shortDate(plan.ftp.tested)}` : "FTP · untested"))),
    h("p", { class: "format" }, `${shortDate(race.date)} ${race.date.slice(0, 4)}, ${race.place}. ${race.date_note || ""}`),
    h("details", { class: "card warmup" },
      h("summary", {}, h("span", { class: "name" }, "Course"), h("span", { class: "dose" }, "4 climbs")),
      h("div", { class: "detail" }, h("p", {}, race.profile))),

    latest && latest.week !== w.start && h("section", { class: "block" },
      h("h2", { class: "block-title" }, "Latest review"),
      reportCard(latest, latest.date >= w.start)),

    h("section", { class: "block" },
      h("h2", { class: "block-title" }, `This week · ${weekRange(w)}`),
      h("div", { class: "week-head" },
        h("span", { class: "week-focus" }, w.focus),
        h("span", { class: "week-meta" }, `${weekTitle(w)} · ${w.hours}`)),
      weekBody(w)),

    h("section", { class: "block" },
      h("h2", { class: "block-title" }, "Coming up"),
      plan.weeks.slice(i + 1).map((x) => weekCard(x, false))),

    i > 0 && h("section", { class: "block" },
      h("h2", { class: "block-title" }, "Done"),
      plan.weeks.slice(0, i).reverse().map((x) => weekCard(x, false))),

    corosCard(),

    h("details", { class: "card kit-card" },
      h("summary", {}, h("span", { class: "name" }, "How the plan adjusts"), h("span", { class: "dose" }, `${plan.rules.length} rules`)),
      h("div", { class: "detail" },
        h("p", { class: "kit" }, "Every Monday morning a review reads Strava, applies these rules to the coming week and writes a report here. Set Perceived Exertion on each Strava activity, and write “bad night” or “sick” in the description when it matters."),
        h("ul", { class: "rules" }, plan.rules.map((r) => h("li", {}, h("b", {}, `${r.id} `), r.text))))),
  ].flat().filter(Boolean));
}

const NOT_SAVED = new Set(["S", "O", "L", "RECON", "RACE", "FTP"]);

function corosCard() {
  const first = {};
  plan.weeks.forEach((w) => w.sessions.forEach((it) => {
    if (!NOT_SAVED.has(it.s) && !(it.s in first)) first[it.s] = w;
  }));
  const ids = Object.keys(first);
  return h("details", { class: "card kit-card" },
    h("summary", {}, h("span", { class: "name" }, "Workouts to save in COROS"), h("span", { class: "dose" }, `${ids.length} workouts`)),
    h("div", { class: "detail" },
      h("ul", { class: "rules" }, ids.map((id) => {
        const ses = plan.sessions[id];
        return h("li", {}, h("b", {}, `${id} `), `${ses.name} · first ${shortDate(first[id].start)}`,
          h("br"), h("span", { class: "kit" }, ses.coros));
      })),
      h("h3", {}, "Setting them up"),
      list("ul", [
        "Name each one with its code first (“T1 Threshold 2×15”) so it's easy to match here and in Strava.",
        "Intensity type %FTP on every step, never Power: %FTP follows the FTP on the Dura, watts don't.",
        "Narrow ranges, about 5% wide: ERG holds a single value inside the range.",
        "Step types: Warm Up, Training, Rest, Cool Down; use Repeat for interval sets.",
        "Torque steps: %FTP target, and put the cadence in the step name (“60 rpm”).",
        "Sprints and open steps: target Not set.",
        "After every FTP test, check the Dura shows the new value before the next session.",
      ])));
}

function planTile() {
  if (!plan) return null;
  const w = plan.weeks[currentWeekIndex()];
  return h("a", { class: "tile plan-tile", href: "#plan" },
    h("span", { class: "tile-kicker" }, `This week · ${w.n ? `wk ${w.n}` : w.phase}`),
    h("span", { class: "tile-name" }, w.focus),
    h("span", { class: "tile-meta" }, `${w.sessions.length} sessions · ${w.hours}`),
    w.quote && h("span", { class: "tile-quote" }, w.quote),
    h("span", { class: "pills" }, h("span", { class: "pl hue-green" }, plan.race.name)));
}

const YEAR_KEY = "gym:race-year";
const DISC_KEY = "gym:race-disc";
const DISCIPLINES = { mtb: "MTB", gravel: "Gravel", road: "Road" };
const FORMATS = {
  marathon: "Marathon", ultra: "Ultra", "self-supported": "Self-supported",
  endurance: "Endurance", stage: "Stage race", "gran-fondo": "Gran fondo",
};
const STATUS = ["registered", "planned", "maybe", "idea", "done", "skipped"];
const IN = new Set(["planned", "registered", "maybe"]);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function dayNum(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

function raceYears() {
  const ys = new Set();
  races.events.forEach((e) => Object.keys(e.editions || {}).forEach((y) => ys.add(y)));
  ys.add(String(new Date().getFullYear() + 1));
  return [...ys].sort();
}

function currentYear() {
  const ys = raceYears();
  const saved = read(YEAR_KEY);
  if (ys.includes(saved)) return saved;
  const today = isoDay(new Date());
  const upcoming = ys.find((y) => races.events.some((e) => {
    const ed = e.editions && e.editions[y];
    return ed && ed.date && ed.date >= today;
  }));
  return upcoming || ys[ys.length - 1];
}

function raceEntries(year) {
  return races.events.map((e) => {
    const ed = (e.editions && e.editions[year]) || null;
    const start = ed && ed.date;
    return { e, ed, start, end: ed && (ed.end || ed.date), status: (ed && ed.status) || "idea" };
  });
}

function gapAfter(entry) {
  return (races.gaps && races.gaps[entry.e.format]) || 14;
}

function clash(a, b) {
  if (!a.start || !b.start) return null;
  const [first, second] = a.start <= b.start ? [a, b] : [b, a];
  const days = dayNum(second.start) - dayNum(first.end);
  if (days <= 0) return { kind: "overlap", days: 0, first, second };
  if (days < gapAfter(first)) return { kind: "tight", days, first, second };
  return null;
}

function clashText(c, self) {
  const other = c.first === self ? c.second : c.first;
  const approx = (c.first.ed.approx || c.second.ed.approx) ? "~" : "";
  if (c.kind === "overlap") return `Same dates as ${other.e.name}`;
  const weeks = c.days >= 14 ? `${approx}${Math.round(c.days / 7)} wks` : `${approx}${c.days} days`;
  return c.first === self ? `${other.e.name} ${weeks} later` : `${weeks} after ${other.e.name}`;
}

function raceDate(entry) {
  if (!entry.start) return entry.e.month ? `${MONTHS[entry.e.month - 1].toUpperCase()}?` : "TBC";
  const [, m, d] = entry.start.split("-").map(Number);
  return `${entry.ed.approx ? "~" : ""}${d} ${MONTHS[m - 1].toUpperCase()}`;
}

function sortKey(entry, year) {
  if (entry.start) return entry.start;
  if (entry.e.month) return `${year}-${String(entry.e.month).padStart(2, "0")}-32`;
  return "zzzz";
}

function monthOf(entry) {
  if (entry.start) return Number(entry.start.split("-")[1]);
  return entry.e.month || null;
}

function raceCard(entry, conflicts) {
  const { e, ed, status } = entry;
  const mine = conflicts.filter((c) => c.first === entry || c.second === entry);
  const cue = [e.place, ...mine.map((c) => clashText(c, entry))].join(" · ");
  return h("details", { class: `card race st-card-${status}` },
    h("summary", {},
      h("span", { class: "idx race-date" }, raceDate(entry)),
      h("span", { class: "name" }, e.name, h("span", { class: `tag tag-f-${e.format}` }, FORMATS[e.format] || e.format)),
      h("span", { class: "dose" }, h("span", { class: `st st-${status}` }, status)),
      h("span", { class: `cue${mine.some((c) => c.kind === "overlap") ? " cue-clash" : mine.length ? " cue-tight" : ""}` }, cue)),
    h("div", { class: "detail" },
      h("div", { class: "pills race-pills" },
        h("span", { class: "pl" }, DISCIPLINES[e.discipline] || e.discipline),
        h("span", { class: "pl pl-any" }, e.vibe === "small" ? "Small & fun" : "Big classic"),
        e.alpine_cup && h("span", { class: "pl hue-teal" }, "Alpine Cup")),
      h("p", { class: "kit" }, [e.usual, ed && ed.approx ? "date estimated from past editions" : null].filter(Boolean).join(" · ")),
      e.distances && e.distances.length ? [h("h3", {}, "Distances"), list("ul", e.distances)] : null,
      ed && ed.distance && h("p", {}, h("b", {}, "Picked: "), ed.distance),
      ed && ed.registration && [h("h3", {}, "Registration"), h("p", {}, ed.registration)],
      e.notes && e.notes.length ? [h("h3", {}, "Notes"), list("ul", e.notes)] : null,
      e.url && h("a", { class: "yt", href: e.url, target: "_blank", rel: "noopener noreferrer" }, "Website ↗")));
}

function renderRaces() {
  document.title = "Races · tally";
  const years = raceYears();
  const year = currentYear();
  const disc = DISCIPLINES[read(DISC_KEY)] ? read(DISC_KEY) : "all";
  const pickYear = (y) => () => { save(YEAR_KEY, y); renderRaces(); };
  const pickDisc = (d) => () => { save(DISC_KEY, d); renderRaces(); };

  const all = raceEntries(year);
  const ins = all.filter((x) => IN.has(x.status));
  const conflicts = [];
  for (const x of all) for (const y of ins) {
    if (x === y || (IN.has(x.status) && all.indexOf(x) > all.indexOf(y))) continue;
    const c = clash(x, y);
    if (c) conflicts.push(c);
  }
  const between = conflicts.filter((c) => IN.has(c.first.status) && IN.has(c.second.status));
  const shown = all.filter((x) => disc === "all" || x.e.discipline === disc).sort((a, b) => sortKey(a, year).localeCompare(sortKey(b, year)));
  const counts = STATUS.map((s) => [s, all.filter((x) => x.status === s).length]).filter(([, n]) => n);

  const groups = [];
  for (const x of shown) {
    const m = monthOf(x);
    const label = m ? MONTHS[m - 1] : "Date unknown";
    if (!groups.length || groups[groups.length - 1].label !== label) groups.push({ label, items: [] });
    groups[groups.length - 1].items.push(x);
  }

  document.getElementById("main").replaceChildren(...[
    h("a", { class: "back", href: "#" }, "← All routines"),
    h("h1", {}, "Races"),
    h("p", { class: "format" }, counts.map(([s, n]) => `${n} ${s}`).join(" · ")),
    h("div", { class: "filter race-filter", role: "group", "aria-label": "Year" },
      years.map((y) => h("button", { type: "button", class: "chip", "aria-pressed": String(y === year), onclick: pickYear(y) }, y))),
    h("div", { class: "filter race-filter", role: "group", "aria-label": "Discipline" },
      h("button", { type: "button", class: "chip", "aria-pressed": String(disc === "all"), onclick: pickDisc("all") }, "All"),
      Object.entries(DISCIPLINES).map(([k, v]) =>
        h("button", { type: "button", class: "chip", "aria-pressed": String(disc === k), onclick: pickDisc(k) }, v))),

    between.length
      ? h("section", { class: "block" },
          h("h2", { class: "block-title" }, "Clashes in your plan"),
          h("ul", { class: "clashes" }, between.map((c) =>
            h("li", { class: c.kind === "overlap" ? "cue-clash" : "cue-tight" },
              `${c.first.e.name} → ${c.second.e.name}: `,
              c.kind === "overlap" ? "same dates" : `${c.days} days apart (wants ${gapAfter(c.first)})`))))
      : ins.length > 1 && h("p", { class: "adjusted ok" }, `No clashes between your ${ins.length} planned and maybe races.`),

    groups.map((g) => h("section", { class: "block" },
      h("h2", { class: "block-title" }, g.label),
      g.items.map((x) => raceCard(x, conflicts)))),

    h("details", { class: "card kit-card" },
      h("summary", {}, h("span", { class: "name" }, "How clashes are checked"), h("span", { class: "dose" }, "rule of thumb")),
      h("div", { class: "detail" },
        h("p", {}, "Races marked planned, registered or maybe are checked against every race that year. A race clashes when the dates overlap, and is tight when it starts sooner after the previous one than that one's recovery gap."),
        h("ul", { class: "rules" }, Object.entries(races.gaps || {}).map(([f, d]) =>
          h("li", {}, h("b", {}, `${d} days `), `after ${FORMATS[f] || f}`))),
        h("p", { class: "kit" }, "A ~ marks dates estimated from past editions. Ask Claude to add a race, change a status or fill in a confirmed date."))),
  ].flat().filter(Boolean));
}

function racesTile() {
  if (!races) return null;
  const today = isoDay(new Date());
  const next = races.events
    .flatMap((e) => Object.values(e.editions || {}).map((ed) => ({ e, ed })))
    .filter(({ ed }) => ed.date && ed.date >= today && (ed.status === "planned" || ed.status === "registered"))
    .sort((a, b) => a.ed.date.localeCompare(b.ed.date))[0];
  const weeks = next ? Math.ceil((dayNum(next.ed.date) - dayNum(today)) / 7) : null;
  return h("a", { class: "tile races-tile", href: "#races" },
    h("span", { class: "tile-kicker" }, "Race calendar"),
    h("span", { class: "tile-name" }, next ? next.e.name : "Races"),
    h("span", { class: "tile-meta" }, next ? `${shortDate(next.ed.date)} · ${weeks} wks` : `${races.events.length} races`),
    h("span", { class: "pills" }, h("span", { class: "pl hue-teal" }, `${races.events.length} races`)));
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
      planTile(),
      racesTile(),
      routinesFor(place).map((r) =>
        h("a", { class: "tile", href: `#${r.id}` },
          h("span", { class: "tile-name" }, r.name),
          r.stats && r.stats[0] && h("span", { class: "tile-meta" }, r.stats.slice(0, 2).map(([v]) => v).join(" · ")),
          h("span", { class: "pills" }, planStamp(r), placePills(r))
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
    h("div", { class: "pills hero-pills" }, planStamp(routine), placePills(routine)),
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
  if (location.hash === "#plan" && plan) {
    renderPlan();
    window.scrollTo(0, 0);
    return;
  }
  if (location.hash === "#races" && races) {
    renderRaces();
    window.scrollTo(0, 0);
    return;
  }
  const routine = data.routines.find((r) => r.id === location.hash.slice(1));
  if (routine) renderRoutine(routine);
  else renderHome();
  window.scrollTo(0, 0);
}

function setStatus(fromCache) {
  const offline = fromCache || !navigator.onLine;
  document.getElementById("status").replaceChildren(
    offline ? h("span", { class: "offline" }, "OFFLINE · ") : "",
    `routines updated ${data.updated}`,
    plan ? ` · plan updated ${plan.updated}` : "",
    races ? ` · races updated ${races.updated}` : ""
  );
}

async function loadPlan() {
  try {
    const res = await fetch("plan.json", { cache: "no-cache" });
    if (res.ok) plan = await res.json();
  } catch {}
}

async function loadRaces() {
  try {
    const res = await fetch("races.json", { cache: "no-cache" });
    if (res.ok) races = await res.json();
  } catch {}
}

async function load() {
  try {
    const [res] = await Promise.all([fetch("routines.json", { cache: "no-cache" }), loadPlan(), loadRaces()]);
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
