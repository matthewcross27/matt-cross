/*
 * sketch.js - the hand-drawn engine behind every doodle on the page.
 *
 * One global, window.Sketch. Four jobs:
 *   1. pencil primitives (wobbly lines, loops, ellipses) drawn once, statically - no live filters
 *   2. the stick-figure rig (one character, used by the hero and all three interests)
 *   3. choreography: key poses -> monotone splines -> forward kinematics + foot-on-ground solve
 *   4. drivers: the same choreography feeds either native CSS scroll-driven @keyframes
 *      (compositor, 1:1 with scroll) or a rAF fallback, or a one-shot timed entrance.
 *
 * Angle convention: degrees, CSS-clockwise, WORLD (not parent-relative). Figure faces right.
 *   chest/head: 0 = upright, + leans forward.   limbs: 0 = hanging straight down,
 *   NEGATIVE swings forward (-90 = pointing forward, +-180 = straight up).
 *   foot: 0 = flat, + = toes down.
 * Poses are authored in world angles and converted to parent-relative CSS `rotate` values.
 */
(function (global) {
  'use strict';

  var SVGNS = 'http://www.w3.org/2000/svg';
  var INK = '#26272b';
  var INK_SOFT = '#5a5b63';
  var PAPER = '#fbf8ef';
  var NAVY = '#1f3a6b';
  var RED = '#c8372d';

  /* ---------- tiny helpers ---------- */

  function s(tag, attrs, parent) {
    var e = document.createElementNS(SVGNS, tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function f(n) { return Math.round(n * 100) / 100; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function rng(seed) {
    var st = (seed >>> 0) || 1;
    return function () {
      st = (Math.imul(st, 1664525) + 1013904223) >>> 0;
      return st / 4294967296;
    };
  }

  /* ---------- pencil primitives ---------- */

  function lineD(x1, y1, x2, y2, rand, amp) {
    amp = amp == null ? 1.4 : amp;
    var dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
    var nx = -dy / len, ny = dx / len;
    var bow = (rand() * 2 - 1) * amp * Math.min(1, len / 70 + 0.25);
    function j() { return (rand() * 2 - 1) * amp * 0.3; }
    return 'M' + f(x1 + j()) + ' ' + f(y1 + j()) +
      ' Q' + f((x1 + x2) / 2 + nx * bow) + ' ' + f((y1 + y2) / 2 + ny * bow) +
      ' ' + f(x2 + j()) + ' ' + f(y2 + j());
  }

  /* Catmull-Rom through points -> cubic bezier path string */
  function smoothD(pts, closed) {
    var n = pts.length, d = 'M' + f(pts[0][0]) + ' ' + f(pts[0][1]);
    var last = closed ? n : n - 1;
    for (var i = 0; i < last; i++) {
      var p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      if (!closed) { if (i === 0) p0 = p1; if (i === n - 2) p3 = p2; }
      d += ' C' + f(p1[0] + (p2[0] - p0[0]) / 6) + ' ' + f(p1[1] + (p2[1] - p0[1]) / 6) +
        ' ' + f(p2[0] - (p3[0] - p1[0]) / 6) + ' ' + f(p2[1] - (p3[1] - p1[1]) / 6) +
        ' ' + f(p2[0]) + ' ' + f(p2[1]);
    }
    return d;
  }

  function ellipseD(cx, cy, rx, ry, rand, amp, overshoot) {
    amp = amp == null ? 1.2 : amp;
    var n = 14, pts = [], a0 = rand() * 6.28, i;
    var total = 6.283 + (overshoot ? 0.5 : 0);
    var count = overshoot ? n + 2 : n;
    for (i = 0; i < count; i++) {
      var a = a0 + (i / n) * total * (n / count) * (overshoot ? 1 : 1);
      var k = 1 + (rand() * 2 - 1) * amp * 0.03 * (overshoot ? i / count * 2 + 0.2 : 1);
      pts.push([cx + Math.cos(a) * rx * k + (rand() * 2 - 1) * amp * 0.4,
                cy + Math.sin(a) * ry * k + (rand() * 2 - 1) * amp * 0.4]);
    }
    return smoothD(pts, !overshoot);
  }

  /* pencil: a main pass plus a fainter second pass with fresh jitter */
  function pencil(parent, dFn, o) {
    o = o || {};
    var w = o.w || 2.2, color = o.color || INK, op = o.op == null ? 1 : o.op;
    var common = { fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
    var g = s('g', o.cls ? { 'class': o.cls } : null, parent);
    s('path', Object.assign({ d: dFn(), stroke: color, 'stroke-width': w, opacity: op }, common), g);
    if (o.ghost !== false) {
      s('path', Object.assign({ d: dFn(), stroke: color, 'stroke-width': Math.max(0.8, w * 0.45),
        opacity: op * 0.4 }, common), g);
    }
    return g;
  }

  function Pen(seed) {
    var rand = rng(seed || 7);
    var api = {
      rand: rand,
      line: function (p, x1, y1, x2, y2, o) {
        o = o || {};
        return pencil(p, function () { return lineD(x1, y1, x2, y2, rand, o.amp); }, o);
      },
      poly: function (p, pts, o) {
        o = o || {};
        var g = s('g', null, p);
        for (var i = 0; i < pts.length - 1; i++) api.line(g, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], o);
        if (o.closed) api.line(g, pts[pts.length - 1][0], pts[pts.length - 1][1], pts[0][0], pts[0][1], o);
        return g;
      },
      rect: function (p, x, y, w, h, o) {
        return api.poly(p, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], Object.assign({ closed: true }, o));
      },
      ellipse: function (p, cx, cy, rx, ry, o) {
        o = o || {};
        return pencil(p, function () { return ellipseD(cx, cy, rx, ry, rand, o.amp, o.overshoot !== false); }, o);
      },
      curve: function (p, pts, o) {
        o = o || {};
        return pencil(p, function () {
          var j = pts.map(function (q) { return [q[0] + (rand() * 2 - 1) * (o.amp || 1) * 0.6, q[1] + (rand() * 2 - 1) * (o.amp || 1) * 0.6]; });
          return smoothD(j, false);
        }, o);
      },
      /* filled shape with a pencil outline */
      fillShape: function (p, d, fill, o) {
        o = o || {};
        s('path', { d: d, fill: fill, stroke: 'none' }, p);
        return pencil(p, function () { return d; }, Object.assign({ ghost: false }, o));
      },
      hatch: function (p, x, y, w, h, gap, angle, o) {
        o = o || {};
        var g = s('g', null, p), t = Math.tan((angle || 45) * Math.PI / 180);
        for (var d = -h * t; d < w; d += gap) {
          var x1 = Math.max(0, d), y1 = x1 - d > h ? h : (x1 - d) / (t || 1);
          var x2 = Math.min(w, d + h * t), y2 = (x2 - d) / (t || 1);
          if (x2 <= x1) continue;
          api.line(g, x + x1, y + y1, x + x2, y + y2, Object.assign({ amp: 0.8, ghost: false }, o));
        }
        return g;
      }
    };
    return api;
  }

  /* ---------- monotone cubic through [t, v] knots ---------- */

  function mono(knots) {
    var n = knots.length, t = [], v = [], d = [], m = [], i;
    for (i = 0; i < n; i++) { t.push(knots[i][0]); v.push(knots[i][1]); }
    if (n === 1) return function () { return v[0]; };
    for (i = 0; i < n - 1; i++) d.push((v[i + 1] - v[i]) / Math.max(1e-6, t[i + 1] - t[i]));
    m[0] = d[0]; m[n - 1] = d[n - 2];
    for (i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : 2 * d[i - 1] * d[i] / (d[i - 1] + d[i]);
    return function (x) {
      if (x <= t[0]) return v[0];
      if (x >= t[n - 1]) return v[n - 1];
      var k = 0;
      while (x > t[k + 1]) k++;
      var h = t[k + 1] - t[k], u = (x - t[k]) / h, u2 = u * u, u3 = u2 * u;
      return (2 * u3 - 3 * u2 + 1) * v[k] + (u3 - 2 * u2 + u) * h * m[k] +
        (-2 * u3 + 3 * u2) * v[k + 1] + (u3 - u2) * h * m[k + 1];
    };
  }

  /* ---------- the rig ---------- */

  /* [name, parent, rest pivot x, y] - parents always listed first */
  var BONES = [
    ['hips', null, 0, 0],
    ['chest', 'hips', 0, -4],
    ['head', 'chest', 1, -54],
    ['uArmB', 'chest', -1, -48],
    ['fArmB', 'uArmB', -1, -19],
    ['uArmF', 'chest', 1, -48],
    ['fArmF', 'uArmF', 1, -19],
    ['thighB', 'hips', -1, 1],
    ['shinB', 'thighB', -1, 43],
    ['footB', 'shinB', -1, 83],
    ['thighF', 'hips', 1, 1],
    ['shinF', 'thighF', 1, 43],
    ['footF', 'shinF', 1, 83]
  ];
  var BONE = {}, BONE_NAMES = [];
  BONES.forEach(function (b) {
    BONE[b[0]] = { name: b[0], parent: b[1], px: b[2], py: b[3] };
    BONE_NAMES.push(b[0]);
  });
  /* rest-pose points riding a bone: [bone, x, y] */
  var TIPS = {
    toeF: ['footF', 18, 89], heelF: ['footF', -4, 89],
    toeB: ['footB', 17, 89], heelB: ['footB', -5, 89],
    handF: ['fArmF', 1, 10], handB: ['fArmB', -1, 10],
    holdF: ['fArmF', 6, 14],
    headC: ['head', 2, -71],
    shoulderF: ['chest', 1, -48]
  };
  var REST_GROUND = 89;

  function rot(a, x, y) {
    var r = a * Math.PI / 180, c = Math.cos(r), sn = Math.sin(r);
    return [x * c - y * sn, x * sn + y * c];
  }

  /* world angles -> positions (hips pivot at 0,0), plus named tips */
  function fk(wa) {
    var pos = {}, i, b, p, v;
    for (i = 0; i < BONES.length; i++) {
      b = BONE[BONES[i][0]];
      if (!b.parent) { pos[b.name] = [0, 0]; continue; }
      p = BONE[b.parent];
      v = rot(wa[p.name] || 0, b.px - p.px, b.py - p.py);
      pos[b.name] = [pos[p.name][0] + v[0], pos[p.name][1] + v[1]];
    }
    for (var k in TIPS) {
      var t = TIPS[k], bb = BONE[t[0]];
      v = rot(wa[bb.name] || 0, t[1] - bb.px, t[2] - bb.py);
      pos[k] = [pos[bb.name][0] + v[0], pos[bb.name][1] + v[1]];
    }
    return pos;
  }

  var STAND = {
    hips: 0, chest: 0, head: 0,
    uArmF: 4, fArmF: -6, uArmB: -3, fArmB: -8,
    thighF: 0, shinF: 0, footF: 0, thighB: 0, shinB: 0, footB: 0
  };

  /*
   * choreo({ keys, lag, ground, y, layers })
   *   keys   [{t, <bone>: worldDeg, x, air, ...extra numeric channels}] - missing channels hold
   *   lag    {bone: progressDelay} - child follows later: free follow-through / overlap
   *   ground scene y of the floor: hips y is solved so the lowest foot point touches it (minus `air`)
   *   layers [(p, wa, ex) => void] - procedural overlays (gait) applied after the splines
   */
  function choreo(cfg) {
    var keys = cfg.keys.slice().sort(function (a, b) { return a.t - b.t; });
    var chanNames = {};
    keys.forEach(function (k) { for (var n in k) if (n !== 't') chanNames[n] = 1; });
    var ch = {};
    Object.keys(chanNames).forEach(function (n) {
      var knots = [], last, i;
      for (i = 0; i < keys.length; i++) {
        if (keys[i][n] != null) { last = keys[i][n]; }
        else if (last == null) { // back-fill from the first defined
          for (var j = i; j < keys.length; j++) if (keys[j][n] != null) { last = keys[j][n]; break; }
        }
        knots.push([keys[i].t, last]);
      }
      ch[n] = mono(knots);
    });
    var lag = cfg.lag || {};
    var cache = { p: null, v: null };

    function evalAt(p) {
      if (cache.p === p) return cache.v;
      var wa = {}, i, n;
      for (i = 0; i < BONE_NAMES.length; i++) {
        n = BONE_NAMES[i];
        wa[n] = ch[n](p - (lag[n] || 0));
      }
      var ex = { x: ch.x ? ch.x(p) : 0, air: ch.air ? ch.air(p) : 0, extra: {} };
      for (n in ch) if (!(n in BONE) && n !== 'x' && n !== 'air') ex.extra[n] = ch[n](p);
      if (cfg.layers) for (i = 0; i < cfg.layers.length; i++) cfg.layers[i](p, wa, ex);
      var rel = {};
      for (i = 0; i < BONE_NAMES.length; i++) {
        n = BONE_NAMES[i];
        rel[n] = wa[n] - (BONE[n].parent ? wa[BONE[n].parent] : 0);
      }
      var pos = fk(wa), ty;
      if (cfg.ground != null) {
        var bottom = Math.max(pos.toeF[1], pos.heelF[1], pos.toeB[1], pos.heelB[1]);
        ty = cfg.ground - bottom - ex.air;
      } else {
        ty = (cfg.y || 0) - ex.air;
      }
      var tx = ex.x;
      var world = {};
      for (n in pos) world[n] = [pos[n][0] + tx, pos[n][1] + ty];
      var out = { wa: wa, rel: rel, tx: tx, ty: ty, pos: world, ex: ex };
      cache.p = p; cache.v = out;
      return out;
    }
    return { eval: evalAt, keys: keys, cfg: cfg };
  }

  /* ---------- the figure ---------- */

  function limb(pen, parent, x1, y1, x2, y2, w, color) {
    return pen.line(parent, x1, y1, x2, y2, { w: w, color: color, amp: 1.6 });
  }

  function figure(parent, opts) {
    opts = opts || {};
    var pen = Pen(opts.seed || 11);
    var root = s('g', { 'class': 'fig' }, parent);
    var els = {}, slots = {};

    function bone(name, host) {
      var b = BONE[name];
      var g = s('g', { 'data-bone': name,
        style: 'transform-origin:' + b.px + 'px ' + b.py + 'px' }, host);
      els[name] = g;
      return g;
    }
    function leg(side, host, ink, w) {
      var th = bone('thigh' + side, host);
      limb(pen, th, 0, 1, 0, 43, w + 1, ink);
      var sh = bone('shin' + side, th);
      limb(pen, sh, 0, 43, 0, 83, w + 0.4, ink);
      var ft = bone('foot' + side, sh);
      var shoe = 'M-4 81 L3.5 81 Q9 84.5 16.5 86.5 Q19.5 88 16.5 89.4 L-4.6 89.4 Q-6.4 85 -4 81 Z';
      s('path', { d: shoe, fill: PAPER, stroke: ink, 'stroke-width': 2.4, 'stroke-linejoin': 'round' }, ft);
      s('path', { d: 'M-4.4 87 L17 87', stroke: ink, 'stroke-width': 1.1, fill: 'none', opacity: 0.55 }, ft);
      return th;
    }
    function arm(side, host, ink, w) {
      var ua = bone('uArm' + side, host);
      limb(pen, ua, 0, -48, 0, -19, w, ink);
      /* sleeve + navy cuff, the way the shirt in the photo has them */
      s('rect', { x: -4.8, y: -49.5, width: 9.6, height: 14, rx: 3.2, fill: PAPER, stroke: ink, 'stroke-width': 2.2 }, ua);
      s('path', { d: 'M-4.8 -37.2 L4.8 -37.2', stroke: NAVY, 'stroke-width': 2.6, fill: 'none', 'stroke-linecap': 'round' }, ua);
      var fa = bone('fArm' + side, ua);
      limb(pen, fa, 0, -19, 0, 6, w - 0.4, ink);
      s('circle', { cx: 0, cy: 10, r: 3.7, fill: PAPER, stroke: ink, 'stroke-width': 2.2 }, fa);
      return ua;
    }

    var hips = bone('hips', root);
    s('ellipse', { cx: 0, cy: -1, rx: 7, ry: 4.5, fill: INK_SOFT, stroke: 'none', opacity: 0.0 }, hips);
    leg('B', hips, INK_SOFT, 4.6);
    var chest = bone('chest', hips);
    arm('B', chest, INK_SOFT, 4.2);
    slots.back = s('g', null, chest);
    /* shirt */
    var shirt = 'M-8.8 -4 Q-11.2 -26 -9.8 -44.5 Q-9.2 -50 -3 -51.6 Q1.4 -52.6 5.4 -51.6 Q10.8 -50 10.4 -44.5 Q11.6 -26 8.8 -4 Q0 -1 -8.8 -4 Z';
    s('path', { d: shirt, fill: PAPER, stroke: INK, 'stroke-width': 2.8, 'stroke-linejoin': 'round' }, chest);
    s('path', { d: 'M-6.6 -9 Q0 -6.6 6.6 -9', stroke: INK, 'stroke-width': 1.2, fill: 'none', opacity: 0.35, 'stroke-linecap': 'round' }, chest);
    /* a small red "10" on the shirt */
    s('path', { d: 'M-3.6 -33 L-2.2 -34.2 L-2.2 -24.5 M1 -33.3 Q3.6 -35 4.4 -31 L4.4 -27 Q3.6 -23.4 1 -25 Q-0.2 -26 -0.2 -29 Q-0.2 -32 1 -33.3 Z',
      stroke: RED, 'stroke-width': 1.5, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0.9 }, chest);
    /* neck */
    pen.line(chest, 1, -50, 1.4, -58, { w: 3.6, amp: 0.4, ghost: false });
    s('path', { d: 'M-3.2 -51.6 L1.6 -46 L6 -51.6', stroke: NAVY, 'stroke-width': 2.2, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, chest);

    /* head: circle, a messy fringe, one eye, a nose nub */
    var head = bone('head', chest);
    s('circle', { cx: 2, cy: -71, r: 12.4, fill: PAPER, stroke: INK, 'stroke-width': 2.8 }, head);
    s('path', { d: 'M-10.8 -65 C-16 -76 -9 -87 -0.4 -86.4 C3 -89.6 10 -88.4 13.4 -84 C18.2 -81.4 18.4 -76 15.8 -73.2 C13.6 -77.4 10.6 -76.6 9 -78.4 C7.6 -75 5 -75.8 3.6 -77.8 C2 -74.4 -1 -75.2 -3 -73.2 C-5.4 -72.6 -7.6 -70.4 -8.4 -66.4 C-9.2 -64.8 -10 -64.4 -10.8 -65 Z',
      fill: INK, stroke: INK, 'stroke-width': 1.4, 'stroke-linejoin': 'round' }, head);
    s('path', { d: 'M-12 -73 q-3 -3 -1 -6.6', stroke: INK, 'stroke-width': 2, fill: 'none', 'stroke-linecap': 'round' }, head);
    s('circle', { cx: 8.6, cy: -70.6, r: 1.45, fill: INK }, head);
    s('path', { d: 'M14 -71.4 Q17 -68.8 14.2 -66.6', stroke: INK, 'stroke-width': 1.6, fill: 'none', 'stroke-linecap': 'round' }, head);
    s('path', { d: 'M8 -63.6 Q10.4 -62.6 12.4 -63.8', stroke: INK, 'stroke-width': 1.2, fill: 'none', 'stroke-linecap': 'round', opacity: 0.75 }, head);

    slots.front = s('g', null, chest);
    arm('F', chest, INK, 4.6);
    leg('F', hips, INK, 5);

    return { root: root, bones: els, slots: slots, pen: pen };
  }

  /* ---------- scenes: tracks + drivers ---------- */

  var supportsNative = (function () {
    try { return !!(global.CSS && CSS.supports && CSS.supports('animation-timeline: view()')); }
    catch (e) { return false; }
  })();
  var styleEl = null, uid = 0;
  function sheet(css) {
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.setAttribute('data-sketch', '');
      document.head.appendChild(styleEl);
    }
    styleEl.appendChild(document.createTextNode(css));
  }

  /* a track animates one element; fn(p, ctx) -> {r, x, y, sx, sy, o, dash} (all optional) */
  function Scene(cfg) {
    var self = this;
    this.name = cfg.name;
    this.stage = cfg.stage;
    this.range = cfg.range || [0.1, 0.8];
    this.tracks = [];
    this.staticP = cfg.staticP == null ? 0.5 : cfg.staticP;
    this.steps = cfg.steps || 96;
    this.driver = 'none';
    this._last = -1;
    this.choreos = [];
  }
  Scene.prototype.track = function (el, fn, origin) {
    if (origin) el.style.transformOrigin = origin;
    this.tracks.push({ el: el, fn: fn, key: this.name + '-t' + (uid++), last: '' });
    return this;
  };
  Scene.prototype.rig = function (fig, ch, pre) {
    var self = this;
    this.choreos.push(ch);
    Object.keys(fig.bones).forEach(function (name) {
      var el = fig.bones[name];
      if (name === 'hips') {
        self.track(el, function (p) {
          var e = ch.eval(p);
          return { x: e.tx, y: e.ty, r: e.rel.hips };
        });
      } else {
        self.track(el, function (p) { return { r: ch.eval(p).rel[name] }; });
      }
    });
    return this;
  };

  function fmt(t, v) {
    var o = [];
    if (v.x != null || v.y != null) o.push('translate:' + f(v.x || 0) + 'px ' + f(v.y || 0) + 'px');
    if (v.r != null) o.push('rotate:' + f(v.r) + 'deg');
    if (v.sx != null || v.sy != null || v.s != null) {
      var sx = v.sx != null ? v.sx : v.s, sy = v.sy != null ? v.sy : v.s;
      o.push('scale:' + (Math.round(sx * 1000) / 1000) + ' ' + (Math.round(sy * 1000) / 1000));
    }
    if (v.o != null) o.push('opacity:' + (Math.round(v.o * 1000) / 1000));
    if (v.dash != null) o.push('stroke-dashoffset:' + (Math.round(v.dash * 1000) / 1000));
    return o.join(';');
  }

  Scene.prototype.apply = function (p) {
    for (var i = 0; i < this.tracks.length; i++) {
      var t = this.tracks[i], css = fmt(t, t.fn(p));
      if (css !== t.last) { t.el.style.cssText = (t.el.getAttribute('data-style') || '') + css; t.last = css; }
    }
  };
  Scene.prototype.prepare = function () {
    this.tracks.forEach(function (t) {
      var base = t.el.style.cssText || '';
      t.el.setAttribute('data-style', base && !/;$/.test(base) ? base + ';' : base);
    });
  };

  /* sample every track at N+1 points, return {key: {css frames} | static} */
  Scene.prototype._keyframes = function () {
    var N = this.steps, i, j, tr = this.tracks, vals = tr.map(function () { return []; });
    for (i = 0; i <= N; i++) {
      var p = i / N;
      for (j = 0; j < tr.length; j++) vals[j].push(fmt(tr[j], tr[j].fn(p)));
    }
    var css = '', statics = [];
    for (j = 0; j < tr.length; j++) {
      var first = vals[j][0], flat = true;
      for (i = 1; i <= N; i++) if (vals[j][i] !== first) { flat = false; break; }
      if (flat) { statics.push([tr[j], first]); continue; }
      css += '@keyframes ' + tr[j].key + '{';
      for (i = 0; i <= N; i++) {
        if (i > 0 && i < N && vals[j][i] === vals[j][i - 1] && vals[j][i] === vals[j][i + 1]) continue;
        css += f(i / N * 100) + '%{' + vals[j][i] + '}';
      }
      css += '}';
      tr[j].animated = true;
    }
    return { css: css, statics: statics };
  };

  /* scroll-linked: native CSS timeline when supported, else rAF with identical maths */
  Scene.prototype.scroll = function (opts) {
    opts = opts || {};
    var self = this, stage = this.stage;
    this.prepare();
    var kf = this._keyframes();
    kf.statics.forEach(function (st) { st[0].el.style.cssText = (st[0].el.getAttribute('data-style') || '') + st[1]; });
    var tl = '--' + this.name + '-tl';
    var a = this.range[0] * 100, b = this.range[1] * 100;
    if (supportsNative && !opts.forceFallback) {
      /* inset 0 so the native range matches the rAF fallback exactly (auto would honour scroll-padding) */
      stage.style.setProperty('view-timeline-name', tl);
      stage.style.setProperty('view-timeline-axis', 'block');
      stage.style.setProperty('view-timeline-inset', '0px');
      var rules = '';
      this.tracks.forEach(function (t) {
        if (!t.animated) return;
        t.el.setAttribute('data-trk', t.key);
        rules += '[data-trk="' + t.key + '"]{animation:' + t.key + ' linear both;animation-timeline:' + tl +
          ';animation-range:cover ' + a + '% cover ' + b + '%}';
      });
      sheet(kf.css + rules);
      this.driver = 'native';
      return this;
    }
    this.driver = 'fallback';
    var ticking = false, visible = true;
    function progress() {
      var r = stage.getBoundingClientRect(), vh = global.innerHeight;
      var cover = (vh - r.top) / (vh + r.height);
      return clamp((cover - self.range[0]) / (self.range[1] - self.range[0]), 0, 1);
    }
    function frame() {
      ticking = false;
      if (!visible) return;
      var p = progress();
      if (p !== self._last) { self._last = p; self.apply(p); }
    }
    function req() { if (!ticking) { ticking = true; global.requestAnimationFrame(frame); } }
    global.addEventListener('scroll', req, { passive: true });
    global.addEventListener('resize', req);
    if ('IntersectionObserver' in global) {
      new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) req(); }, { rootMargin: '10% 0px' }).observe(stage);
    }
    this.apply(progress());
    return this;
  };

  /* wall-clock one-shot (entrances) */
  Scene.prototype.timed = function (opts) {
    opts = opts || {};
    this.prepare();
    var kf = this._keyframes();
    kf.statics.forEach(function (st) { st[0].el.style.cssText = (st[0].el.getAttribute('data-style') || '') + st[1]; });
    var rules = '', dur = opts.duration || 1000, delay = opts.delay || 0;
    var easing = opts.easing || 'linear';
    this.tracks.forEach(function (t) {
      if (!t.animated) return;
      t.el.setAttribute('data-trk', t.key);
      rules += '[data-trk="' + t.key + '"]{animation:' + t.key + ' ' + dur + 'ms ' + easing + ' ' + delay + 'ms both}';
    });
    sheet(kf.css + rules);
    this.driver = 'timed';
    return this;
  };

  Scene.prototype.still = function (p) {
    this.prepare();
    this.apply(p == null ? this.staticP : p);
    this.driver = 'still';
    return this;
  };

  /* ---------- small reusable bits ---------- */

  function note(parent, kind, o) {
    o = o || {};
    var g = s('g', null, parent), c = o.color || INK;
    var common = { fill: 'none', stroke: c, 'stroke-width': 2.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
    if (kind === 'pair') {
      s('path', { d: 'M0 0 L0 -26 L18 -31 L18 -5', stroke: c, 'stroke-width': 2.4, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
      s('path', { d: 'M0 -26 L18 -31', stroke: c, 'stroke-width': 5, fill: 'none', 'stroke-linecap': 'butt' }, g);
      s('ellipse', { cx: -4, cy: 0, rx: 5.6, ry: 4, fill: c, transform: 'rotate(-18 -4 0)' }, g);
      s('ellipse', { cx: 14, cy: -5, rx: 5.6, ry: 4, fill: c, transform: 'rotate(-18 14 -5)' }, g);
    } else {
      s('path', { d: 'M0 0 L0 -28 Q2 -22 9 -19', stroke: c, 'stroke-width': 2.4, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
      s('ellipse', { cx: -4, cy: 0, rx: 5.6, ry: 4, fill: c, transform: 'rotate(-18 -4 0)' }, g);
    }
    return g;
  }

  /* little radiating ink ticks - the "contact" accent */
  function burst(parent, cx, cy, r0, r1, n, o) {
    o = o || {};
    var pen = Pen(o.seed || 3), g = s('g', null, parent);
    var a0 = (o.from == null ? -80 : o.from) * Math.PI / 180, a1 = (o.to == null ? 80 : o.to) * Math.PI / 180;
    for (var i = 0; i < n; i++) {
      var a = lerp(a0, a1, n === 1 ? 0.5 : i / (n - 1)), jr = 1 + (pen.rand() - 0.5) * 0.3;
      pen.line(g, cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, cx + Math.cos(a) * r1 * jr, cy + Math.sin(a) * r1 * jr,
        { w: o.w || 2.4, color: o.color || INK, amp: 0.6, ghost: false });
    }
    return g;
  }

  global.Sketch = {
    INK: INK, INK_SOFT: INK_SOFT, PAPER: PAPER, NAVY: NAVY, RED: RED,
    s: s, f: f, clamp: clamp, lerp: lerp, smooth: smooth, rng: rng,
    Pen: Pen, mono: mono, choreo: choreo, figure: figure, fk: fk, STAND: STAND,
    BONES: BONES, REST_GROUND: REST_GROUND,
    Scene: Scene, note: note, burst: burst,
    supportsNative: supportsNative,
    smoothD: smoothD
  };
})(window);
