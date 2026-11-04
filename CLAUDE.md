# Gym

Reference-only routine page for Vincent's phone. No logging and no backend, by choice.

- Equipment variants (home, travel, another gym) are separate routines, not a toggle. Name them by place ("Home · Ski prep", short "Home ski"), set `equipment` to exactly what Vincent said he has there, and substitute exercises that fit that kit while keeping the same squat, hinge, pull, and core intent.
- Every routine needs `short`, `equipment` and three `stats` tiles.
- Content changes go in `public/routines.json` only. Reuse existing exercise ids before adding new ones. Every `ex` in a routine must exist in `exercises`.
- Bump `updated` on any content change. Bump `VERSION` in `public/sw.js` on any change to app files.
- Keep it static and dependency-free: no build step, no external fonts or CDNs. It must work fully offline.
- Validate before pushing: `node -e "const d=require('./public/routines.json');for(const r of d.routines)for(const b of r.blocks)for(const i of b.items)if(!d.exercises[i.ex])throw i.ex"`
- Deploy is `git pull` on joan-pi (~/gym); nginx serves `public/` mounted read-only.
