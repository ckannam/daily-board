'use strict';
/* Daily Board frontend glue. */

// Backend: same origin in local dev, Render in production. Update if the
// Render service URL differs.
var RENDER_URL = 'https://daily-board-l49e.onrender.com';
var API_BASE = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? '' : RENDER_URL;

var POLL_MS = 4000;
var state = { scores: [], win: 'today', parsed: null, name: localStorage.getItem('db_name') || '' };

// ── Date helpers (keyed to the configured timezone) ───────────────────────────
function dayKey(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: CONFIG.TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}
function todayKey() { return dayKey(new Date()); }
function daysAgoKey(n) {
  var parts = todayKey().split('-').map(Number);
  var ms = Date.UTC(parts[0], parts[1] - 1, parts[2]) - n * 86400000;
  return dayKey(new Date(ms));
}
function windowRange(win) {
  if (win === 'today') return { from: todayKey(), to: todayKey() };
  if (win === 'week')  return { from: daysAgoKey(6), to: todayKey() };
  return {}; // all-time
}

// ── Data ──────────────────────────────────────────────────────────────────────
function fetchScores() {
  return fetch(API_BASE + '/api/scores', { cache: 'no-store' })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      state.scores = (d && d.scores) || [];
      setLive(true);
      render();
    })
    .catch(function () { setLive(false); });
}

function setLive(ok) {
  var el = document.getElementById('liveText');
  if (!ok) { el.textContent = 'reconnecting…'; return; }
  var playingToday = new Set(state.scores.filter(function (s) { return s.date === todayKey(); }).map(function (s) { return s.player; }));
  el.textContent = 'live · ' + playingToday.size + ' playing today';
}

// ── Render ──────────────────────────────────────────────────────────────────
var medals = ['🥇', '🥈', '🥉'];

function render() {
  renderGames();
  renderOverall();
}

function renderGames() {
  var host = document.getElementById('games');
  var range = windowRange(state.win);
  host.innerHTML = CONFIG.GAMES.map(function (g) {
    var rows, played;
    if (state.win === 'today') {
      rows = SCORING.gameBoard(state.scores, g.id, todayKey());
      played = rows.length;
      rows = rows.map(function (r, i) { return boardRow(r, i, r.score); });
    } else {
      var only = state.scores.filter(function (s) { return s.game === g.id; });
      var tally = SCORING.overall(only, range); // per-player points for this game
      played = tally.length;
      rows = tally.map(function (r, i) { return boardRow({ player: r.player, points: r.points }, i, r.points + ' pts', r.gamesPlayed + 'd'); });
    }
    var body = played
      ? rows.join('')
      : '<div class="empty">No scores yet</div>';
    var subtitle = state.win === 'today'
      ? played + ' played'
      : played + ' competing';
    return '<div class="game" data-game="' + g.id + '"><div class="gh"><b>' + g.emoji + ' ' + g.label + '</b>' +
           '<span>' + subtitle + '</span></div>' + body + '</div>';
  }).join('');
}

function boardRow(r, i, scoreText, extra) {
  var pos = i < 3 ? medals[i] : (i + 1);
  var cls = i === 0 ? 'row top' : 'row';
  var pts = (state.win === 'today' && r.points != null)
    ? '<span class="pts">+' + r.points + '</span>' : '';
  return '<div class="' + cls + '"><div class="pos">' + pos + '</div>' +
         '<div class="nm">' + esc(r.player) + pts + '</div>' +
         '<div class="sc">' + esc(scoreText) + '</div></div>';
}

function renderOverall() {
  var host = document.getElementById('overall');
  var range = windowRange(state.win);
  var standings = SCORING.overall(state.scores, range);
  var label = { today: 'today', week: 'this week', all: 'all-time' }[state.win];
  var rows = standings.length
    ? standings.map(function (r, i) {
        var pos = i < 3 ? medals[i] : (i + 1);
        var cls = i === 0 ? 'row top' : 'row';
        return '<div class="' + cls + '"><div class="pos">' + pos + '</div>' +
               '<div class="nm">' + esc(r.player) + '</div>' +
               '<div class="pts-big">' + r.points + '</div></div>';
      }).join('')
    : '<div class="empty">No scores yet — be the first</div>';
  host.innerHTML = '<div class="ttl">Overall standings · ' + label + '</div>' + rows;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
Array.prototype.forEach.call(document.querySelectorAll('.tabs button'), function (b) {
  b.addEventListener('click', function () {
    document.querySelectorAll('.tabs button').forEach(function (x) { x.classList.remove('on'); });
    b.classList.add('on');
    state.win = b.dataset.win;
    render();
  });
});

// ── Submit modal ──────────────────────────────────────────────────────────────
var modalBg   = document.getElementById('modalBg');
var pasteBox  = document.getElementById('pasteBox');
var preview   = document.getElementById('preview');
var nameSec   = document.getElementById('nameSection');
var nameInput = document.getElementById('nameInput');
var suggest   = document.getElementById('suggest');
var submitBtn = document.getElementById('submitBtn');

function openModal() {
  pasteBox.value = '';
  preview.className = 'preview';
  preview.textContent = '';
  nameSec.style.display = 'none';
  state.parsed = null;
  nameInput.value = state.name;
  renderSuggest(state.name);
  updateSubmitEnabled();
  modalBg.classList.add('show');
  setTimeout(function () { pasteBox.focus(); }, 50);
}
function closeModal() { modalBg.classList.remove('show'); }

document.getElementById('openSubmit').addEventListener('click', openModal);
document.getElementById('cancelBtn').addEventListener('click', closeModal);
modalBg.addEventListener('click', function (e) { if (e.target === modalBg) closeModal(); });

pasteBox.addEventListener('input', function () {
  var r = parseScore(pasteBox.value);
  state.parsed = r;
  if (r) {
    var g = CONFIG.GAME_BY_ID[r.game];
    var dayTxt = r.day ? ' ' + (/^\d+$/.test(r.day) ? '#' + r.day : r.day) : '';
    preview.className = 'preview ok';
    preview.innerHTML = '<div class="big">' + g.emoji + ' ' + g.label + dayTxt + '</div>Score: <b>' + r.score + '</b>';
    nameSec.style.display = 'block';
  } else {
    preview.className = pasteBox.value.trim() ? 'preview err' : 'preview';
    preview.textContent = pasteBox.value.trim() ? "Couldn't recognize that game — paste the full share text." : '';
    nameSec.style.display = 'none';
  }
  updateSubmitEnabled();
});

function renderSuggest(filter) {
  var f = (filter || '').toLowerCase().trim();
  var matches = CONFIG.PLAYERS.filter(function (p) { return !f || p.toLowerCase().indexOf(f) === 0 || p.toLowerCase().indexOf(f) >= 0; });
  suggest.innerHTML = matches.map(function (p) {
    return '<button data-name="' + esc(p) + '"' + (p === state.name ? ' class="sel"' : '') + '>' + esc(p) + '</button>';
  }).join('');
  Array.prototype.forEach.call(suggest.querySelectorAll('button'), function (b) {
    b.addEventListener('click', function () {
      state.name = b.dataset.name;
      nameInput.value = state.name;
      renderSuggest(state.name);
      updateSubmitEnabled();
    });
  });
}

nameInput.addEventListener('input', function () {
  state.name = CONFIG.PLAYERS.indexOf(nameInput.value) >= 0 ? nameInput.value : '';
  // auto-select an exact single match while typing
  var f = nameInput.value.toLowerCase().trim();
  var exact = CONFIG.PLAYERS.filter(function (p) { return p.toLowerCase() === f; });
  if (exact.length) state.name = exact[0];
  renderSuggest(nameInput.value);
  updateSubmitEnabled();
});

function updateSubmitEnabled() {
  submitBtn.disabled = !(state.parsed && state.name);
}

submitBtn.addEventListener('click', function () {
  if (!state.parsed || !state.name) return;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Adding…';
  localStorage.setItem('db_name', state.name);
  fetch(API_BASE + '/api/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      player: state.name, game: state.parsed.game,
      day: state.parsed.day, score: state.parsed.score, raw: pasteBox.value,
    }),
  })
    .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
    .then(function (res) {
      submitBtn.textContent = 'Add it';
      if (!res.ok) { toast(res.d.error || 'Something went wrong'); submitBtn.disabled = false; return; }
      closeModal();
      toast('Score added 🎉');
      fetchScores();
    })
    .catch(function () {
      submitBtn.textContent = 'Add it';
      submitBtn.disabled = false;
      toast('Server waking up — try again in ~30s');
    });
});

// ── Toast ─────────────────────────────────────────────────────────────────────
var toastEl = document.getElementById('toast');
var toastTimer;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2600);
}

// ── Go ─────────────────────────────────────────────────────────────────────────
fetchScores();
setInterval(fetchScores, POLL_MS);
