'use strict';
/* Submission validation — self-add roster behavior.
   Run: node test/server.test.js */
const assert = require('assert');
const { validateSubmission, normalizePlayer } = require('../server');

let passed = 0;
function ok(name, fn) { fn(); passed++; console.log('  ✓ ' + name); }

const ROSTER = ['Cole', 'Sam'];               // pretend seed ∪ existing players
const good = (over) => Object.assign({ player: 'Cole', game: 'krillion', score: 10 }, over);

console.log('server validation');

ok('accepts a brand-new name not on the roster', () => {
  const v = validateSubmission(good({ player: 'Tomas' }), ROSTER);
  assert.strictEqual(v.ok, true);
  assert.strictEqual(v.record.player, 'Tomas');
});

ok('trims surrounding whitespace', () => {
  const v = validateSubmission(good({ player: '  Zed  ' }), ROSTER);
  assert.strictEqual(v.ok, true);
  assert.strictEqual(v.record.player, 'Zed');
});

ok('folds case onto an existing player (cole → Cole)', () => {
  const v = validateSubmission(good({ player: 'cOLe' }), ROSTER);
  assert.strictEqual(v.ok, true);
  assert.strictEqual(v.record.player, 'Cole');   // canonical seed spelling wins
});

ok('rejects an empty / whitespace-only name', () => {
  assert.strictEqual(validateSubmission(good({ player: '   ' }), ROSTER).ok, false);
  assert.strictEqual(validateSubmission(good({ player: '' }), ROSTER).ok, false);
  assert.strictEqual(validateSubmission(good({ player: 42 }), ROSTER).ok, false);
});

ok('rejects a name longer than 24 characters', () => {
  const v = validateSubmission(good({ player: 'x'.repeat(25) }), ROSTER);
  assert.strictEqual(v.ok, false);
});

ok('still rejects an unknown game', () => {
  assert.strictEqual(validateSubmission(good({ game: 'nope' }), ROSTER).error, 'unknown game');
});

ok('still rejects a non-number score', () => {
  assert.strictEqual(validateSubmission(good({ score: 'ten' }), ROSTER).error, 'score must be a number');
});

ok('normalizePlayer returns null for junk, canonical for a case match', () => {
  assert.strictEqual(normalizePlayer('  ', ROSTER), null);
  assert.strictEqual(normalizePlayer('SAM', ROSTER), 'Sam');
  assert.strictEqual(normalizePlayer('Brand New', ROSTER), 'Brand New');
});

console.log(`\n${passed} passed`);
