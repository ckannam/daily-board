# Daily Board — design

**Date:** 2026-11-02
**Owner:** Cole Kannam (ckannam)

## Intent / why

A ~10-15 person friend group (PKA) plays daily trivia games (Krillion, GnarlyQ,
MapTap, Farflung, and more later) and shares scores in a group chat. People
cherry-pick their best results, so the chat isn't an honest record. This app is a
shared **live scoreboard**: paste your result, see who actually did best today,
this week, and all-time — per game and overall.

## Goals

- Dead-simple daily submit: paste a game's share text, it auto-detects the game
  and score, confirm your name, done. Two taps and a paste.
- Honest, complete leaderboard: per-game daily winners plus an overall crown.
- Near-live: the board updates within a few seconds as friends submit.
- Mobile-first (people paste from their phones).

## Non-goals

- No accounts/passwords. Name is picked from a trusted list (friend group, trust-based).
- No anti-cheat. If someone fakes a score, that's a social problem, not a code one.
- No "submit directly from Krillion.io" — those are third-party sites we can't hook
  into. The flow is copy-paste.

## Anti-goals (would make it a failure even if it works)

- Submitting feels slow or fiddly → people won't do it daily.
- The overall ranking feels arbitrary or unfair.

## Scoring model

- **Games (v1):** Krillion, GnarlyQ, MapTap, Farflung. All higher-is-better.
  Daily Nine and Daily Ten added later. Game set is config-driven and extensible.
- **Per game, per day:** rank the players who played that game that day by raw
  score (desc). Placement points on a **gentle ladder**: 1st = 10, 2nd = 9,
  3rd = 8, … (floor at 1). Only players who actually played rank, so small fields
  still earn lots of points (rewards showing up).
- **Ties:** tied players all take the **higher** spot's points (e.g. two tie for
  1st → both get 10, next player is 3rd = 8 — standard competition ranking).
- **Overall (aggregate):** sum of a player's placement points across all games in
  the window. Shown for **Today / This week / All-time**.
- **Windows:** keyed by calendar date (America/New_York). "Today" = today's date,
  "Week" = last 7 days, "All-time" = everything.
- One score per player per game per day; re-submitting overwrites (keeps latest).

## How it gets made (decided)

- **Frontend:** static site on **GitHub Pages**, new repo `github.com/ckannam/daily-board`.
  Vanilla HTML/CSS/JS, no build step (mirrors the Second Brain project). Mobile-first,
  **garnet-and-gold** PKA theme, crest in the header. Layout: game cards up top with
  🥇🥈🥉, big "Paste today's score" button, overall standings below (Option B).
- **Backend:** **Express on Render free tier** (`server.js` + `render.yaml`),
  replicating the Second Brain pattern. Holds `GITHUB_TOKEN` as a secret and commits
  `data/scores.json` to the repo via the GitHub Contents API, so scores persist as
  repo JSON (what Cole wanted). Keeps scores in memory for fast reads; loads from the
  committed JSON on startup to recover after a cold start.
  - `GET /api/scores` → all raw submissions (board computes leaderboards client-side).
  - `POST /api/submit` → `{ player, game, day, score, raw }`, upserts in memory,
    commits to repo in background.
  - Only secret is `GITHUB_TOKEN` (fine-grained PAT, Contents read+write, scoped to
    this repo). No `ANTHROPIC_API_KEY` (no AI).
- **Live-ness:** the board polls `GET /api/scores` every few seconds. Render free tier
  spins down after 15 min idle (~30s cold start on the first submit after a lull);
  accepted tradeoff for reusing the known Render setup and keeping scores in the repo.

## Players (v1)

CVT, Eitan, Gabe, Setji, Setty, Matt, Sam, Tomas, Rou, Cole. Config-driven; easy to add.

## Parsing (the crafty bit)

Each game's share text has a distinct shape. The parser auto-detects the game and
extracts `{ game, day, score }` from a pasted blob. Real examples (v1):

- **Krillion:** `Krillion #110 🦐` / `225` → day `110`, score `225`.
- **GnarlyQ:** `GnarlyQ #111 🕹️` … `45 PTS · 🔥2` → day `111`, score `45` (streak ignored).
- **MapTap:** `www.maptap.gg November 2` … `Final score: 267` → day = date, score `267`.
- **Farflung:** `Farflung #29 · 155/500 km*` → day `29`, score `155` (the number before `/500`).

Each submission is also stamped with the calendar date it was submitted (the
cross-game bucket key). Parsers live in a shared, unit-tested module.

## Left to the builder

- Exact regex per game, hardened against emoji/whitespace variation (unit-tested
  against the real sample blobs).
- Minor: points floor (everyone who plays gets ≥1), overall tie-break (by games
  played, then name), timezone constant (America/New_York), poll interval (~4s).
- Real PKA crest image dropped into `assets/` and referenced in the header.
- Deploy wiring (Cole connects Render + sets `GITHUB_TOKEN`).
