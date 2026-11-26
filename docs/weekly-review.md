# Weekly training review

Runs every Monday early morning as a scheduled task. It reads Vincent's Strava, reviews the week that just ended against `public/plan.json`, applies the plan's rules to the coming week, and publishes a short report on the tally Plan page.

## Inputs

- `public/plan.json`: `weeks[]` (each has `start`, a Monday), `sessions{}` (the session library), `rules[]`, `reports[]`, `ftp`.
- Strava (connector): activities from the reviewed week's Monday 00:00 to Sunday 23:59, local time. Use `list_activities` with `include_tags` and `use_preferred_units`. For trainer sessions that look like quality sessions, use `get_activity_performance` or laps to check whether the intervals were done at target. Call `get_activity_performance` on every activity of the week: its `perceived_exertion` (1–10, from Strava's Perceived Exertion slider; missing if he didn't set it) is the RPE the rules use, and it also gives average power, heart rate and laps. Read every activity description too: that is where Vincent notes sleep, sickness or fatigue, in English, French, Spanish or Catalan.

- COROS (connector): the source of truth for trainer sessions, because it has lap-by-lap power for each workout step. `querySportRecords` with cycling codes (200–205, 299; 201 is indoor bike) for the reviewed week, then `queryActivityLapData` on trainer rides to read each step's average power and HR against its %FTP target. Outdoor rides usually show no power (no power meter on the road bike or MTB); use Strava for those. If the same ride appears in both, it's one ride.

## Steps

1. Find the reviewed week (the one whose `start` is last Monday) and the coming week (today's Monday).
2. Match activities to planned sessions. Trainer rides (`is_trainer`, VirtualRide, or no GPS) are T/AT/B/C/E by duration and structure; outdoor rides follow rule R8. Strength or workout activities count as S.
3. Classify the week with R3: `done`, `partial` or `missed`.
4. Check the quality session against R4 with the COROS lap data (target watts = %FTP × the FTP shown on the Dura; if that FTP isn't known, compare laps with each other and with the plan's watts on the page). If no power data exists, say so and don't apply R4.
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
   If the reviewed week isn't in `weeks[]` (before 2026-11-30, or after the race), change nothing and don't commit. Pre-season and holiday weeks (`type: "flex"`) get a report but are never judged harshly: classify them, note what was done, change nothing unless a rule clearly applies.
8. If the coming week changed, set its `adjusted` to `{ "date": "<today>", "reason": "<one sentence naming the rule>" }` and edit its `sessions` (or `hours`, `notes`). Never invent a session id: only ids in `sessions{}`. An item can carry a `note` (shown on the card) and `min` (planned minutes).
9. Write the coming week's `quote` (see below). Bump `updated` in `plan.json` to today.
10. Put the coming week on the COROS calendar (see below). Do this even when step 1 found no reviewed week to report on, as long as the coming week is in the plan.
11. Validate (command below), commit as `Weekly review: week of <date>`, and push to `main`. Then push the next release tag (`vX.Y`, increment the minor version from the latest tag) so joan-pi deploys it. If the tag push is refused, don't retry or work around it: the commit on `main` is enough.

## COROS calendar

The trainer workouts live in Vincent's COROS library, named with the session code first ("T1 Threshold 2×15", "B1 Torque 5×6", "C1 Tempo 90′", "E Easy spin"). They use %FTP targets, which the COROS connector can't read or edit: never create, copy or update them, only schedule them.

- `queryWorkoutLibrary` (cycling, custom), match each trainer session of the coming week by its code prefix, then `scheduleWorkout` on its day. Only T, AT, B, C, E and OPEN sessions; never FTP (built into the Dura), S, O, L, RECON or RACE.
- Default days: quality session (T/AT) Tuesday, torque (B) or easy spin (E) Thursday, long tempo (C) Saturday. A second B/E in the same week goes on Friday. In a week with a long MTB ride (L), nothing on the weekend.
- `queryTrainingSchedule` for the coming week first: if a session is already there (scheduled by hand or by an earlier run), leave it. Scheduled workouts can't be moved or removed through the connector, so schedule only once the week's adjustments are final, and only the coming week.
- If a session's code isn't in the library yet (later workouts get built as they come up), don't schedule it: add a `changes` line to the report saying "Build <code> <name> in COROS before <day>", so it shows on the plan page.

## The weekly quote

One original line, written fresh each week and tied to what actually happened or what's coming: the session that went well, the one that got skipped, the weather, the fixie on the trainer, Paris, a baby who doesn't care about FTP. Under 25 words.

- Tone: dry, self-deprecating, a bit punk. Every few weeks lean into bike-messenger spirit: fixies, no brakes, red lights as suggestions, chain grease as a personality, riding in the rain because that's just Tuesday. Not too serious, but it should still make him want to get on the bike.
- Never guilt, never "no excuses" gym-bro lines, never mock a missed week. A missed week gets a line about getting back on, not about failing.
- Write your own lines. No quotes from real people, no song lyrics, no famous slogans.
- Don't repeat an earlier week's joke: read the previous `quote` values first.

Example: "Pros have soigneurs. You have a bottle warmer and a 2×20. Same energy."

## Guardrails

- Facts only from Strava and Vincent's own words. Don't guess how a session felt.
- Short, interrupted nights are his baseline for now. Expect perceived exertion to run about a point higher than the session alone would explain, and don't treat that as a warning sign. R7 is for nights or weeks worse than that baseline, which he'll flag in a description.
- The repo may be public: keep health notes general ("noted feeling unwell", "bad sleep") and never copy his descriptions word for word, name people he rode with, or give start locations.
- If Strava can't be read, add a report with `status` omitted, a summary saying the review couldn't run, change nothing else, and still commit and tag.
- Keep the tone flat and useful. No cheerleading, no guilt.
- Don't touch `routines.json` or app files.

## Validate

```sh
node -e "const p=require('./public/plan.json');for(const w of p.weeks)for(const i of w.sessions)if(!p.sessions[i.s])throw i.s;for(const r of p.reports)if(!p.weeks.find(w=>w.start===r.week))throw r.week"
```
