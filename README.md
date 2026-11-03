# Daily Board

A live scoreboard for the group's daily trivia games (Krillion, GnarlyQ, MapTap,
Farflung). Paste a game's share text, it auto-detects the game and your score,
pick your name, and the board shows who's winning **today**, **this week**, and
**all-time** — per game and overall.

Overall ranking uses placement points: each day, for each game, 1st earns 10
points, 2nd 9, 3rd 8, and so on (ties take the higher spot). "Overall" sums those
across every game you played.

## Architecture

- **Frontend** — static site (`index.html`, `style.css`, `app.js`), hosted on
  GitHub Pages. No build step.
- **Backend** — Express (`server.js`) on Render's free tier. Keeps scores in
  memory for fast reads and persists them as `data/scores.json` in this repo via
  the GitHub API. Only secret: `GITHUB_TOKEN`.
- **Shared logic** — `config.js` (players + games), `parsers.js` (score
  detection), `scoring.js` (placement + aggregation). All three are unit-tested
  and run in both the browser and Node.

## Run locally

```bash
npm install
node server.js          # serves the whole app at http://localhost:3000
```

Without a `GITHUB_TOKEN`, scores persist to the local `data/scores.json` only.

## Test

```bash
npm test                # parsers + scoring suites
```

## Deploy

### 1. Create the GitHub repo

```bash
# from this folder, after `git init` + first commit:
git branch -M main
git remote add origin https://github.com/colekannam/daily-board.git
git push -u origin main
```

Then in the repo settings: **Pages → Deploy from branch → `main` / root**. The
site goes live at `https://colekannam.github.io/daily-board/`.

### 2. Make a GitHub token

Create a **fine-grained personal access token** with **Contents: read & write**,
scoped to the `daily-board` repo. Copy it.

### 3. Deploy the backend on Render

- New → Web Service → connect this repo. Render reads `render.yaml`.
- Set the env var `GITHUB_TOKEN` to the token from step 2.
- Deploy. Note the service URL (e.g. `https://daily-board.onrender.com`).

### 4. Point the frontend at the backend

In `app.js`, set `RENDER_URL` to your actual Render URL, commit, and push.
(It's already `https://daily-board.onrender.com` — update only if yours differs.)

> Render free tier spins down after 15 min idle, so the first submit after a lull
> waits ~30s for the server to wake. After that it's snappy.

## Adding players or games

- **Players:** add a name to `PLAYERS` in `config.js`.
- **Games:** add an entry to `GAMES` in `config.js` and a detector in
  `parsers.js` (with a test in `test/parsers.test.js`).

## The crest

The header looks for `assets/crest.png`; drop the real PKA crest there. Until
then it falls back to a `ΠΚΑ` badge automatically.
