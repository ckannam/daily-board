/* Shared config — loaded in the browser via <script> and require()'d in Node tests.
   Classic script + module.exports guard (same dual pattern as the Second Brain repo). */
(function (root) {
  'use strict';

  // The friend group. Add names here; the typeahead picks them up automatically.
  var PLAYERS = [
    'CVT', 'Eitan', 'Gabe', 'Setji', 'Setty', 'Matt', 'Sam', 'Tomas', 'Rou', 'Cole'
  ];

  // Game metadata. `emoji` + `label` drive the UI; `higher` = higher score wins.
  // Order here is the order the cards render on the board.
  var GAMES = [
    { id: 'krillion', label: 'Krillion', emoji: '🦐', higher: true },
    { id: 'gnarlyq',  label: 'GnarlyQ',  emoji: '🕹️', higher: true },
    { id: 'maptap',   label: 'MapTap',   emoji: '🌐', higher: true },
    { id: 'farflung', label: 'Farflung', emoji: '🧭', higher: true }
  ];

  var GAME_BY_ID = GAMES.reduce(function (m, g) { m[g.id] = g; return m; }, {});

  // Placement ladder: 1st = 10, 2nd = 9, ... floored at 1.
  function placementPoints(rank /* 1-based */) {
    return Math.max(1, 11 - rank);
  }

  // Timezone the "day" buckets are keyed to (East-coast college crew).
  var TIMEZONE = 'America/New_York';

  var CONFIG = { PLAYERS: PLAYERS, GAMES: GAMES, GAME_BY_ID: GAME_BY_ID, placementPoints: placementPoints, TIMEZONE: TIMEZONE };

  if (typeof module !== 'undefined' && module.exports) module.exports = CONFIG;
  else root.CONFIG = CONFIG;
})(typeof self !== 'undefined' ? self : this);
