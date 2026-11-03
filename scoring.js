/* Scoring — shared between the browser and Node tests.
   Raw submissions in → ranked boards + overall standings out. Pure functions. */
(function (root) {
  'use strict';

  var CONFIG = (typeof module !== 'undefined' && module.exports)
    ? require('./config')
    : root.CONFIG;

  // Keep one score per (player, game, day) — the latest submission wins.
  function dedupe(subs) {
    var byKey = {};
    subs.forEach(function (s) {
      var k = s.player + '|' + s.game + '|' + s.date;
      var cur = byKey[k];
      if (!cur || (s.submittedAt || '') >= (cur.submittedAt || '')) byKey[k] = s;
    });
    return Object.keys(byKey).map(function (k) { return byKey[k]; });
  }

  // Competition ranking ("1,1,3"): ties share the higher rank, next player drops.
  // Returns [{ player, score, rank, points }], best first.
  function rankEntries(entries, higher) {
    var sorted = entries.slice().sort(function (a, b) {
      return higher === false ? a.score - b.score : b.score - a.score;
    });
    var out = [];
    for (var i = 0; i < sorted.length; i++) {
      var rank = (i > 0 && sorted[i].score === sorted[i - 1].score) ? out[i - 1].rank : i + 1;
      out.push({
        player: sorted[i].player,
        score:  sorted[i].score,
        rank:   rank,
        points: CONFIG.placementPoints(rank)
      });
    }
    return out;
  }

  // Ranked board for one game on one date.
  function gameBoard(subs, gameId, dateKey) {
    var game = CONFIG.GAME_BY_ID[gameId] || { higher: true };
    var rows = dedupe(subs).filter(function (s) {
      return s.game === gameId && s.date === dateKey;
    });
    return rankEntries(rows, game.higher);
  }

  // Overall standings across all games within an inclusive date window.
  // window = { from?, to? } as 'YYYY-MM-DD' strings (lexicographic compare).
  // Returns [{ player, points, gamesPlayed }], best first.
  function overall(subs, window) {
    window = window || {};
    var rows = dedupe(subs).filter(function (s) {
      if (window.from && s.date < window.from) return false;
      if (window.to && s.date > window.to) return false;
      return true;
    });

    // Group by game+date, rank each group, accumulate per player.
    var groups = {};
    rows.forEach(function (s) {
      var k = s.game + '|' + s.date;
      (groups[k] = groups[k] || []).push(s);
    });

    var tally = {}; // player → { points, gamesPlayed }
    Object.keys(groups).forEach(function (k) {
      var gameId = k.split('|')[0];
      var game = CONFIG.GAME_BY_ID[gameId] || { higher: true };
      rankEntries(groups[k], game.higher).forEach(function (r) {
        var t = tally[r.player] = tally[r.player] || { points: 0, gamesPlayed: 0 };
        t.points += r.points;
        t.gamesPlayed += 1;
      });
    });

    return Object.keys(tally).map(function (p) {
      return { player: p, points: tally[p].points, gamesPlayed: tally[p].gamesPlayed };
    }).sort(function (a, b) {
      return b.points - a.points
        || b.gamesPlayed - a.gamesPlayed
        || a.player.localeCompare(b.player);
    });
  }

  // Weekly awards: one winner (or co-winners on a tie) per game plus an overall
  // champion, computed over a date window. "Winner" = most placement points.
  // Games (or the champion slot) with nobody in-window return winners: [].
  function winnersOf(standings) {
    if (!standings.length) return { winners: [], points: 0 };
    var top = standings[0].points;
    return {
      winners: standings.filter(function (r) { return r.points === top; })
                        .map(function (r) { return r.player; }),
      points: top
    };
  }

  function weeklyAwards(subs, window) {
    var games = CONFIG.GAMES.map(function (g) {
      var only = subs.filter(function (s) { return s.game === g.id; });
      var w = winnersOf(overall(only, window));
      return { gameId: g.id, winners: w.winners, points: w.points };
    });
    return { games: games, champion: winnersOf(overall(subs, window)) };
  }

  var API = { dedupe: dedupe, rankEntries: rankEntries, gameBoard: gameBoard, overall: overall, weeklyAwards: weeklyAwards };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.SCORING = API;
})(typeof self !== 'undefined' ? self : this);
