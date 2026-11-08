'use strict';

/* Daily Board backend — Express on Render free tier.
   Holds scores in memory for fast reads; persists them as repo JSON
   (data/scores.json) via the GitHub Contents API, replicating the
   Second Brain project's pattern. Only secret: GITHUB_TOKEN. */

const express = require('express');
const path    = require('path');
const fs      = require('fs');

const CONFIG  = require('./config');

const app = express();
app.use(express.json());

// ── CORS (GitHub Pages origin + localhost) ────────────────────────────────────
app.use((req, res, next) => {
  const origin  = req.headers.origin || '';
  const allowed = /^https:\/\/ckannam\.github\.io$|^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
  if (allowed.test(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  next();
});

// ── GitHub persistence ────────────────────────────────────────────────────────
const REPO_OWNER = 'ckannam';
const REPO_NAME  = 'daily-board';
const SCORES_PATH = 'data/scores.json';
const SCORES_API  = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${SCORES_PATH}`;
const LOCAL_FILE  = path.join(__dirname, 'data', 'scores.json');

function ghHeaders() {
  return {
    Authorization:  `Bearer ${process.env.GITHUB_TOKEN}`,
    'Content-Type': 'application/json',
    'User-Agent':   'daily-board',
    Accept:         'application/vnd.github+json',
  };
}

let SCORES = [];       // in-memory source of truth for reads
let SCORES_SHA = null; // current blob sha for commits
let DIAG = { tokenPresent: false, load: null, lastPersist: null }; // debug surface

async function loadScores() {
  DIAG.tokenPresent = !!process.env.GITHUB_TOKEN;
  if (process.env.GITHUB_TOKEN) {
    try {
      const res = await fetch(SCORES_API, { headers: ghHeaders() });
      DIAG.load = { status: res.status, ok: res.ok };
      if (res.ok) {
        const { sha, content } = await res.json();
        SCORES_SHA = sha;
        SCORES = JSON.parse(Buffer.from(content, 'base64').toString('utf8'));
        console.log(`loaded ${SCORES.length} scores from GitHub`);
        return;
      }
      console.warn(`GitHub GET scores.json → ${res.status}; starting empty`);
    } catch (e) { DIAG.load = { error: e.message }; console.warn('GitHub load failed:', e.message); }
  }
  // Local fallback (dev without a token)
  try { SCORES = JSON.parse(fs.readFileSync(LOCAL_FILE, 'utf8')); }
  catch { SCORES = []; }
  console.log(`loaded ${SCORES.length} scores locally`);
}

async function persistScores(message) {
  // Always keep a local copy (dev + a safety net).
  try { fs.writeFileSync(LOCAL_FILE, JSON.stringify(SCORES, null, 2)); } catch {}
  if (!process.env.GITHUB_TOKEN) return;
  const put = (sha) => fetch(SCORES_API, {
    method: 'PUT', headers: ghHeaders(),
    body: JSON.stringify({
      message, branch: 'main', sha,
      content: Buffer.from(JSON.stringify(SCORES, null, 2)).toString('base64'),
    }),
  });
  try {
    let res = await put(SCORES_SHA);
    if (res.status === 409 || res.status === 422) { // stale/missing sha — refetch once
      const fresh = await fetch(SCORES_API, { headers: ghHeaders() });
      if (fresh.ok) { SCORES_SHA = (await fresh.json()).sha; res = await put(SCORES_SHA); }
    }
    if (res.ok) {
      SCORES_SHA = (await res.json()).content.sha;
      DIAG.lastPersist = { ok: true, status: res.status, at: new Date().toISOString() };
    } else {
      const body = await res.text();
      DIAG.lastPersist = { ok: false, status: res.status, detail: body.slice(0, 300), at: new Date().toISOString() };
      console.error('GitHub PUT scores.json failed:', res.status, body);
    }
  } catch (e) { DIAG.lastPersist = { ok: false, error: e.message, at: new Date().toISOString() }; console.error('persist failed:', e.message); }
}

// ── Validation + helpers ──────────────────────────────────────────────────────
function todayKey() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: CONFIG.TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

// Roster = seed list (config) ∪ anyone who has ever submitted a score, deduped
// case-insensitively so the board grows itself as new people join.
function knownPlayers() {
  const seen = {}, out = [];
  const add = (n) => {
    if (typeof n !== 'string' || !n) return;
    const k = n.toLowerCase();
    if (!seen[k]) { seen[k] = true; out.push(n); } // first spelling wins (seeds first)
  };
  CONFIG.PLAYERS.forEach(add);
  SCORES.forEach((s) => add(s.player));
  return out;
}

// Trim + length-check a submitted name, and fold it onto an existing player
// when it only differs by case ("cole" → "Cole"). Returns the canonical name,
// or null if it isn't a usable name.
function normalizePlayer(name, known) {
  if (typeof name !== 'string') return null;
  const t = name.trim();
  if (t.length < 1 || t.length > 24) return null;
  const hit = known.find((p) => p.toLowerCase() === t.toLowerCase());
  return hit || t;
}

function validateSubmission(body, known) {
  const b = body || {};
  const roster = known || knownPlayers();
  const player = normalizePlayer(b.player, roster);
  if (!player)                               return { ok: false, error: 'name must be 1–24 characters' };
  if (!CONFIG.GAME_BY_ID[b.game])            return { ok: false, error: 'unknown game' };
  if (typeof b.score !== 'number' || isNaN(b.score)) return { ok: false, error: 'score must be a number' };
  return { ok: true, record: {
    player: player,                     // normalized (trimmed, canonical casing)
    game:   b.game,
    day:    String(b.day == null ? '' : b.day),
    score:  b.score,
    raw:    typeof b.raw === 'string' ? b.raw.slice(0, 2000) : '',
    date:   todayKey(),                 // server-stamped bucket key
    submittedAt: new Date().toISOString(),
  }};
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/scores → { scores: [...] }  (board computes leaderboards client-side)
app.get('/api/scores', (req, res) => res.json({ scores: SCORES }));

// GET /api/health → persistence diagnostics (no secrets; booleans + GitHub status codes)
app.get('/api/health', (req, res) => res.json(Object.assign({ scoresInMemory: SCORES.length }, DIAG)));

// POST /api/submit  Body: { player, game, day, score, raw }
app.post('/api/submit', async (req, res) => {
  const v = validateSubmission(req.body);
  if (!v.ok) return res.status(400).json({ error: v.error });

  const r = v.record;
  // Upsert on (player, game, date): re-submit overwrites today's score.
  const i = SCORES.findIndex(s => s.player === r.player && s.game === r.game && s.date === r.date);
  if (i >= 0) SCORES[i] = r; else SCORES.push(r);

  res.json({ ok: true, record: r });                     // respond fast
  persistScores(`score: ${r.player} ${r.game} ${r.score} (${r.date})`); // commit in background
});

// Serve the static frontend too, so `node server.js` runs the whole app locally.
app.use(express.static(__dirname));

// ── Start ─────────────────────────────────────────────────────────────────────
// Only boot the HTTP server when run directly (`node server.js`); when this file
// is require()'d by a test we just want the exported helpers, not a live port.
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  loadScores().then(() => {
    app.listen(PORT, () => console.log(`Daily Board on port ${PORT}`));
  });
}

if (typeof module !== 'undefined' && module.exports) module.exports = { validateSubmission, normalizePlayer, knownPlayers, todayKey };
