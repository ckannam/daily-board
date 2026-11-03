'use strict';
/* Run: node test/scoring.test.js */
const assert = require('assert');
const { gameBoard, overall, weeklyAwards } = require('../scoring');

let passed = 0;
function ok(name, fn) { fn(); passed++; console.log('  ✓ ' + name); }

function sub(player, game, date, score, t) {
  return { player, game, day: String(score), date, score, submittedAt: t || date + 'T12:00:00Z' };
}

console.log('scoring');

ok('gameBoard ranks higher-is-better desc with gentle points', () => {
  const subs = [
    sub('Sam', 'krillion', '2026-11-02', 241),
    sub('Eitan', 'krillion', '2026-11-02', 225),
    sub('Cole', 'krillion', '2026-11-02', 210),
  ];
  const b = gameBoard(subs, 'krillion', '2026-11-02');
  assert.deepStrictEqual(b.map(r => [r.player, r.rank, r.points]), [
    ['Sam', 1, 10], ['Eitan', 2, 9], ['Cole', 3, 8],
  ]);
});

ok('only that game + that date are included', () => {
  const subs = [
    sub('Sam', 'krillion', '2026-11-02', 241),
    sub('Matt', 'gnarlyq', '2026-11-02', 50),      // other game
    sub('Cole', 'krillion', '2026-11-01', 999),    // other day
  ];
  const b = gameBoard(subs, 'krillion', '2026-11-02');
  assert.strictEqual(b.length, 1);
  assert.strictEqual(b[0].player, 'Sam');
});

ok('ties both take the higher spot; next drops (10,10,8)', () => {
  const subs = [
    sub('Matt', 'krillion', '2026-11-02', 225),
    sub('Sam', 'krillion', '2026-11-02', 225),
    sub('Cole', 'krillion', '2026-11-02', 200),
  ];
  const b = gameBoard(subs, 'krillion', '2026-11-02');
  const pts = b.map(r => r.points).sort((a, z) => z - a);
  assert.deepStrictEqual(pts, [10, 10, 8]);
  assert.deepStrictEqual(b.filter(r => r.rank === 1).map(r => r.player).sort(), ['Matt', 'Sam']);
  assert.strictEqual(b.find(r => r.player === 'Cole').rank, 3);
});

ok('re-submit overwrites (latest wins per player/game/day)', () => {
  const subs = [
    sub('Cole', 'krillion', '2026-11-02', 100, '2026-11-02T10:00:00Z'),
    sub('Cole', 'krillion', '2026-11-02', 260, '2026-11-02T11:00:00Z'), // newer
    sub('Sam', 'krillion', '2026-11-02', 200),
  ];
  const b = gameBoard(subs, 'krillion', '2026-11-02');
  assert.strictEqual(b.length, 2);
  assert.strictEqual(b.find(r => r.player === 'Cole').score, 260);
  assert.strictEqual(b[0].player, 'Cole'); // 260 > 200
});

ok('overall sums placement points across games in the window', () => {
  const subs = [
    // 2026-11-02: Krillion
    sub('Eitan', 'krillion', '2026-11-02', 300), // 10
    sub('Cole', 'krillion', '2026-11-02', 200),  // 9
    // 2026-11-02: GnarlyQ
    sub('Cole', 'gnarlyq', '2026-11-02', 60),    // 10
    sub('Eitan', 'gnarlyq', '2026-11-02', 50),   // 9
  ];
  const o = overall(subs, { from: '2026-11-02', to: '2026-11-02' });
  const byName = Object.fromEntries(o.map(r => [r.player, r.points]));
  assert.strictEqual(byName['Eitan'], 19); // 10 + 9
  assert.strictEqual(byName['Cole'], 19);  // 9 + 10
  assert.strictEqual(o[0].points, 19);
});

ok('overall window excludes out-of-range dates', () => {
  const subs = [
    sub('Cole', 'krillion', '2026-10-01', 300), // outside week
    sub('Sam', 'krillion', '2026-11-02', 100),
  ];
  const o = overall(subs, { from: '2026-10-27', to: '2026-11-02' });
  assert.strictEqual(o.length, 1);
  assert.strictEqual(o[0].player, 'Sam');
});

ok('overall tie-break: more games played ranks higher', () => {
  const subs = [
    sub('A', 'krillion', '2026-11-02', 100), // 10
    sub('B', 'krillion', '2026-11-02', 90),  // 9
    sub('B', 'gnarlyq', '2026-11-02', 100),  // 10 → B total 19, 2 games
    sub('A', 'gnarlyq', '2026-11-02', 90),   // 9  → A total 19, 2 games
    sub('C', 'maptap', '2026-11-02', 100),   // 10 → C total 10, 1 game
  ];
  const o = overall(subs, {});
  assert.strictEqual(o[o.length - 1].player, 'C'); // fewest points last
});

ok('weeklyAwards picks the top points per game and overall champion', () => {
  const subs = [
    sub('Sam', 'krillion', '2026-11-02', 241),  // krill 1st → 10
    sub('Cole', 'krillion', '2026-11-02', 210),  // krill 2nd → 9
    sub('Eitan', 'gnarlyq', '2026-11-02', 50),   // Q 1st → 10
    sub('Sam', 'gnarlyq', '2026-11-02', 40),      // Q 2nd → 9  → Sam overall 19
    sub('Cole', 'maptap', '2026-11-02', 100),     // tapper 1st → 10
    sub('Tomas', 'farflung', '2026-11-02', 100),  // farflung 1st → 10
  ];
  const a = weeklyAwards(subs, {});
  const byGame = {};
  a.games.forEach(g => { byGame[g.gameId] = g.winners; });
  assert.deepStrictEqual(byGame.krillion, ['Sam']);
  assert.deepStrictEqual(byGame.gnarlyq, ['Eitan']);
  assert.deepStrictEqual(byGame.maptap, ['Cole']);
  assert.deepStrictEqual(byGame.farflung, ['Tomas']);
  // Sam (10+9) and Cole (9+10) both total 19 → genuine co-champions.
  assert.deepStrictEqual(a.champion.winners.slice().sort(), ['Cole', 'Sam']);
});

ok('weeklyAwards returns co-winners on a tie and empty for unplayed games', () => {
  const subs = [
    sub('A', 'krillion', '2026-11-02', 100), // tie
    sub('B', 'krillion', '2026-11-02', 100), // tie → both rank 1 → both 10
  ];
  const a = weeklyAwards(subs, {});
  const byGame = {};
  a.games.forEach(g => { byGame[g.gameId] = g.winners; });
  assert.deepStrictEqual(byGame.krillion.sort(), ['A', 'B']);
  assert.deepStrictEqual(byGame.farflung, []); // nobody played
  assert.deepStrictEqual(a.champion.winners.sort(), ['A', 'B']);
});

ok('weeklyAwards respects the date window', () => {
  const subs = [
    sub('Old', 'krillion', '2026-10-01', 999), // outside window
    sub('New', 'krillion', '2026-11-02', 100),
  ];
  const a = weeklyAwards(subs, { from: '2026-10-27', to: '2026-11-02' });
  assert.deepStrictEqual(a.games.find(g => g.gameId === 'krillion').winners, ['New']);
});

console.log(`\n${passed} passed`);
