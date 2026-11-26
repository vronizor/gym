# Weekly training review

Runs every Monday early morning as a scheduled task. It reads Vincent's Strava, reviews the week that just ended against `public/plan.json`, applies the plan's rules to the coming week, and publishes a short report on the tally Plan page.

## Inputs

- `public/plan.json`: `weeks[]` (each has `start`, a Monday), `sessions{}` (the session library), `rules[]`, `reports[]`, `ftp`.
- Strava (connector): activities from the reviewed week's Monday 00:00 to Sunday 23:59, local time. Use `list_activities` with `include_tags` and `use_preferred_units`. For trainer sessions that look like quality sessions, use `get_activity_performance` or laps to check whether the intervals were done at target. Read every activity description: that is where Vincent notes RPE, sleep, sickness, fatigue, in English, French, Spanish or Catalan.

## Steps

1. Find the reviewed week (the one whose `start` is last Monday) and the coming week (today's Monday).
2. Match activities to planned sessions. Trainer rides (`is_trainer`, VirtualRide, or no GPS) are T/AT/B/C/E by duration and structure; outdoor rides follow rule R8. Strength or workout activities count as S.
3. Classify the week with R3: `done`, `partial` or `missed`.
4. Check the quality session against R4 when power data allows. If it doesn't (no power stream), say so and don't apply R4.
5. Apply the rules to the coming week, and only the coming week. Later weeks change only through R5, R6 or R13, which shift whole weeks. Respect R10, R11 and the never-move rule for taper and race week.
6. If a new FTP shows up (a Strava ride named or described as an FTP test with a result, or Vincent wrote the number), set `ftp.watts` and `ftp.tested`.
7. Write the report into `reports[]`:
   ```json
   {
     "week": "<reviewed week start>",
     "date": "<today>",
     "status": "done | partial | missed",
     "summary": "2–3 plain sentences: what happened and what changes.",
     "done": ["Tue · Threshold 2×15 · 61′, blocks at 262 and 259 W", "Sat · MTB 3h10, 1,050 m"],
     "changes": ["Week 6: T2 kept, B2 dropped (bad night noted Thu)"],
     "rules": ["R4", "R7"]
   }
   ```
   No report for weeks before 2026-11-30. Pre-season and holiday weeks (`type: "flex"`) get a report but are never judged harshly: classify them, note what was done, change nothing unless a rule clearly applies.
8. If the coming week changed, set its `adjusted` to `{ "date": "<today>", "reason": "<one sentence naming the rule>" }` and edit its `sessions` (or `hours`, `notes`). Never invent a session id: only ids in `sessions{}`. An item can carry a `note` (shown on the card) and `min` (planned minutes).
9. Bump `updated` in `plan.json` to today.
10. Validate (command below), commit as `Weekly review: week of <date>`, push to `main`, then create and push the next release tag (`vX.Y`, increment minor from the latest tag) so joan-pi deploys it.

## Guardrails

- Facts only from Strava and Vincent's own words. Don't guess how a session felt.
- If Strava can't be read, add a report with `status` omitted, a summary saying the review couldn't run, change nothing else, and still commit and tag.
- Keep the tone flat and useful. No cheerleading, no guilt.
- Don't touch `routines.json` or app files.

## Validate

```sh
node -e "const p=require('./public/plan.json');for(const w of p.weeks)for(const i of w.sessions)if(!p.sessions[i.s])throw i.s;for(const r of p.reports)if(!p.weeks.find(w=>w.start===r.week))throw r.week"
```
