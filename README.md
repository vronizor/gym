# tally

Gym routine reference for the phone: routines with exercise how-tos, installable, works offline, with light, dark, and auto themes. Static files served by nginx on joan-pi, reachable on the tailnet only.

## Layout

```
public/
  routines.json        all content: routines + exercise library
  index.html app.js style.css
  sw.js                offline cache
  manifest.webmanifest icon.svg icon-*.png
compose.yaml           nginx, public/ mounted read-only
nginx.conf
```

## Deploy on the Pi

```sh
cd ~ && git clone git@github.com:vronizor/gym.git && cd gym
docker compose up -d
sudo tailscale serve --service=svc:gym --https=443 127.0.0.1:18095
```

Approve the `svc:gym` service in the Tailscale admin console if it asks, then open `https://gym.<tailnet>.ts.net`.

Updates: `git pull`. No rebuild or restart needed, since `public/` is mounted.

To pick up pushed routine changes without SSHing in, add a cron entry (`crontab -e`):

```
*/15 * * * * cd ~/gym && git pull -q --ff-only
```

## Fonts

Inter Tight and JetBrains Mono (variable, Latin subset) are self-hosted in `public/fonts/` under the SIL Open Font License, so they work offline.

## Offline

`sw.js` caches the whole app on first visit.

- `routines.json` is network-first with a 3 s timeout, falling back to the cached copy. A routine edit shows up on the next load while online.
- The rest of the app is served from cache and refreshed in the background, so app changes show up on the second load.

The footer says "Offline" when it is showing the saved copy.

Install it from the browser menu with *Add to Home Screen*. On iOS this matters: Safari can clear storage for sites that aren't installed, but not for installed ones.

## Editing routines

Everything lives in `public/routines.json`.

- `routines[]`: `id`, `name`, `short` (tab label), `equipment` (where and with what), `stats` (three `[value, label]` tiles), `format`, `warmup[]`, `blocks[].items[]` (`ex`, `dose`, optional `label`, `tag`, `note`), `notes[]`.
- `exercises{}`: keyed by id, with `name`, `equipment`, `setup[]`, `movement[]`, `cues[]`, `easier`, `harder`, `alt`.
- Tags: `ski`, `posture`, `cycling`.

Bump `updated` when content changes. Bump `VERSION` in `sw.js` when you change app files (not needed for routine edits).
