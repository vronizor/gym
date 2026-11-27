# Gym

Reference-only routine page for Vincent's phone, plus a training Plan page (`#plan`) for the MB Race and a race calendar (`#races`). No logging and no backend, by choice.

- Places live in `places[]` (`id`, `name`, `hue`, `equipment[]`): the kit Vincent has said is there, in his words. `hue` is one of blue, orange, red, teal, green, pink (unused ones first) and colours that place's pill everywhere. That list is the source of truth when writing a routine for a place: use only what's on it. When he mentions new kit or a new place, update or add the entry. Never invent kit for a place he hasn't described.
- Each routine has `places: [ids]`; omit it for routines that work anywhere (mobility). The page filters by place.
- `plan: true` stamps a routine as part of the training plan: it gets an MB Race pill and sorts first. Keep the stamp on the strength sessions the plan's `S` points to.
- Place-specific variants are separate routines, not a toggle. Name a routine for what it is ("Home strength", "Water-jug circuit"), never by place: the place pill shows where. Keep the squat, hinge, pull and core intent when substituting exercises, and say in `notes` when the kit can't cover one of them.
- The home screen is a grid of routine tiles with a place filter; a tile shows the name, the first two `stats` values and the place pills. Every routine needs `equipment` (what this routine uses) and three `stats` tiles. Put per-item cues that change the exercise (single-leg version, tempo, which dumbbell) in the item's `note`: it shows without opening the card.
- Each exercise card links to a YouTube search for `"<name> exercise"`. Set `yt` on an exercise to a better query when the name is ambiguous, or `yt: false` to hide the link (rides).
- Content changes go in `public/routines.json` only. Reuse existing exercise ids before adding new ones. Every `ex` in a routine must exist in `exercises`.
- Bump `updated` on any content change. Bump `VERSION` in `public/sw.js` on any change to app files.
- Keep it static and dependency-free: no build step, no external fonts or CDNs. It must work fully offline.
- Validate before pushing: `node -e "const d=require('./public/routines.json');for(const r of d.routines)for(const b of r.blocks)for(const i of b.items)if(!d.exercises[i.ex])throw i.ex"`
- Deploy is `git pull` on joan-pi (~/gym); nginx serves `public/` mounted read-only.

## Training plan

- `public/plan.json` holds the plan: `race`, `ftp`, `rules[]`, `sessions{}` (library; targets in %FTP, the page adds watts), `weeks[]` (Monday `start`, `phase`, `type` flex/build/recovery/taper/race, `focus`, `hours`, `sessions[]` of `{s, note?, min?}`, optional `adjusted`), `reports[]`.
- A scheduled task reviews the week every Monday and edits `plan.json` following `docs/weekly-review.md`. When Vincent asks for a plan change in chat, keep the same rules: change the coming weeks, never the taper or race week unless he asks, and name the reason in `adjusted`.
- Bump `updated` in `plan.json` on any change. Validate with the command in `docs/weekly-review.md`.
- Releases: tag `vX.Y` after pushing so joan-pi's auto-deploy picks it up.

## Race calendar

- `public/races.json` is a multi-year reference of races Vincent might do, so he can pick each year's set and spot clashes. `events[]` are the recurring races; each year lives in `editions{"YYYY": {...}}`.
- Event fields: `id`, `name`, `place`, `country`, `discipline` (mtb, gravel, road), `format` (marathon, ultra, self-supported, endurance, stage, gran-fondo), `vibe` (small or classic), `usual` (when it usually happens, in words), `month` (usual month, for sorting when a year has no date), `distances[]`, `url`, `notes[]`, optional `alpine_cup`.
- Edition fields: `date` (ISO, first day), optional `end`, `approx: true` when estimated from past editions, `status` (idea, maybe, planned, registered, done, skipped), optional `distance` (the one he picked) and `registration` (when it opens, sell-out, deadlines).
- Clashes are computed on the page: overlapping dates, or a start sooner than `gaps[format]` days after the previous race. Only planned, registered and maybe races are checked against others.
- When he names a race, add the event and look up the date and distances on the web; never invent a URL (use `null`). It's a catalogue for seeing roughly when each race happens: when a year's date isn't announced, estimate it from past editions (same weekday, same weekend of the month) and set `approx: true` rather than leaving the year empty. Confirmed dates replace estimates: drop `approx`. Never change a `status` he didn't ask to change.
- Bump `updated` in `races.json` on any change. Validate: `node -e "const r=require('./public/races.json');for(const e of r.events){if(!r.gaps[e.format])throw e.id;for(const d of Object.values(e.editions))if(!['idea','maybe','planned','registered','done','skipped'].includes(d.status))throw e.id}"`
