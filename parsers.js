/* Score-blob parsers — shared between the browser and Node tests.
   parseScore(text) → { game, day, score } for a recognized paste, else null. */
(function (root) {
  'use strict';

  // Each detector gets the raw text, returns { game, day, score } or null.
  // Ordered most-specific first; first match wins.
  var DETECTORS = [
    function krillion(t) {
      // "Krillion #110 🦐" then the score on its own ("225").
      var m = t.match(/Krilli[oa]n\s*#(\d+)[^\d]*?(\d+)/i);
      if (!m) return null;
      return { game: 'krillion', day: m[1], score: parseInt(m[2], 10) };
    },
    function gnarlyq(t) {
      // "GnarlyQ #111" ... "45 PTS · 🔥2" (streak ignored).
      var day = t.match(/GnarlyQ\s*#(\d+)/i);
      var pts = t.match(/(\d+)\s*PTS/i);
      if (!day || !pts) return null;
      return { game: 'gnarlyq', day: day[1], score: parseInt(pts[1], 10) };
    },
    function maptap(t) {
      // "www.maptap.gg November 2" ... "Final score: 267"
      if (!/maptap/i.test(t)) return null;
      var day = t.match(/maptap\.gg\s+([A-Za-z]+\.?\s+\d+)/i);
      var sc  = t.match(/Final score:\s*(\d+)/i);
      if (!sc) return null;
      return { game: 'maptap', day: day ? day[1].trim() : '', score: parseInt(sc[1], 10) };
    },
    function farflung(t) {
      // "Farflung #29 · 155/500 km*" — the number before /500 is the score.
      var day = t.match(/Farflung\s*#(\d+)/i);
      var sc  = t.match(/(\d+)\s*\/\s*\d+\s*km/i);
      if (!day || !sc) return null;
      return { game: 'farflung', day: day[1], score: parseInt(sc[1], 10) };
    }
  ];

  function parseScore(text) {
    if (!text || typeof text !== 'string') return null;
    var t = text.trim();
    if (!t) return null;
    for (var i = 0; i < DETECTORS.length; i++) {
      var r = DETECTORS[i](t);
      if (r && !isNaN(r.score)) return r;
    }
    return null;
  }

  var API = { parseScore: parseScore };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.parseScore = parseScore;
})(typeof self !== 'undefined' ? self : this);
