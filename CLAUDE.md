# Gym

Reference-only routine page for Vincent's phone. No logging and no backend, by choice.

- Places live in `places[]` (`id`, `name`, `hue`, `equipment[]`): the kit Vincent has said is there, in his words. `hue` is one of blue, orange, red, teal, green, pink (unused ones first) and colours that place's pill everywhere. That list is the source of truth when writing a routine for a place: use only what's on it. When he mentions new kit or a new place, update or add the entry. Never invent kit for a place he hasn't described.
- Each routine has `places: [ids]`; omit it for routines that work anywhere (mobility). The page filters by place.
- Place-specific variants are separate routines, not a toggle. Name a routine for what it is ("Home strength", "Water-jug circuit"), never by place: the place pill shows where. Keep the squat, hinge, pull and core intent when substituting exercises, and say in `notes` when the kit can't cover one of them.
- The home screen is a grid of routine tiles with a place filter; a tile shows the name, the first two `stats` values and the place pills. Every routine needs `equipment` (what this routine uses) and three `stats` tiles. Put per-item cues that change the exercise (single-leg version, tempo, which dumbbell) in the item's `note`: it shows without opening the card.
- Content changes go in `public/routines.json` only. Reuse existing exercise ids before adding new ones. Every `ex` in a routine must exist in `exercises`.
- Bump `updated` on any content change. Bump `VERSION` in `public/sw.js` on any change to app files.
- Keep it static and dependency-free: no build step, no external fonts or CDNs. It must work fully offline.
- Validate before pushing: `node -e "const d=require('./public/routines.json');for(const r of d.routines)for(const b of r.blocks)for(const i of b.items)if(!d.exercises[i.ex])throw i.ex"`
- Deploy is `git pull` on joan-pi (~/gym); nginx serves `public/` mounted read-only.
