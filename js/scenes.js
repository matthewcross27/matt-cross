/*
 * scenes.js - the hero doodle and the three interest vignettes.
 * Every scene is the same pattern: draw a pencil world once, build the shared figure,
 * author key poses (see sketch.js for the angle convention), hand the tracks to a Sketch.Scene.
 * Nothing here knows about scrolling - main.js decides how a scene is driven.
 */
(function (global) {
  'use strict';
  var S = global.Sketch;
  var s = S.s, clamp = S.clamp, lerp = S.lerp, smooth = S.smooth;
  var INK = S.INK, BLUE = '#2b5aa8', BLUE_SOFT = '#9bbfe6', RED = S.RED, PAPER = S.PAPER;

  /* key-pose helper: every key starts from a full pose so authoring only states what changes */
  function K(t, o) { return Object.assign({ t: t }, S.STAND, { x: 0, air: 0 }, o); }
  function ramp(p, a, b) { return smooth((p - a) / (b - a)); }

  /* ballistic arc from (x0,y0) that rises H above y0 then ends D above y0 at time T (progress units) */
  function arc(x0, y0, x1, y1, apexRise, T) {
    var D = y0 - y1, H = Math.max(apexRise, D + 8);
    var u = (Math.sqrt(2 * H) + Math.sqrt(2 * (H - D))) / T, g = u * u, vy = -Math.sqrt(2 * g * H);
    return {
      g: g, vy: vy, vx: (x1 - x0) / T, T: T,
      at: function (tau) { return [x0 + (x1 - x0) * tau / T, y0 + vy * tau + 0.5 * g * tau * tau]; }
    };
  }

  function figShadow(scene, layer, ch, ground, w) {
    var el = s('ellipse', { cx: 0, cy: ground + 2, rx: w || 26, ry: 5, fill: INK, opacity: 0 }, layer);
    el.style.transformOrigin = '0px ' + (ground + 2) + 'px';
    scene.track(el, function (p) {
      var e = ch.eval(p), a = clamp(e.ex.air / 90, 0, 1);
      return { x: e.pos.hips[0] + 8, sx: 1 - a * 0.45, sy: 1 - a * 0.45, o: 0.13 * (1 - a * 0.6) };
    });
    return el;
  }

  function ballArt(parent, r, kind) {
    var g = s('g', null, parent);
    s('circle', { r: r, fill: PAPER, stroke: INK, 'stroke-width': 2.4 }, g);
    if (kind === 'soccer') {
      s('path', { d: 'M0 -4.2 L4 -1.3 L2.5 3.4 L-2.5 3.4 L-4 -1.3 Z', fill: INK }, g);
      s('path', { d: 'M0 -4.2 L0 -' + r + ' M4 -1.3 L' + (r * 0.92) + ' -' + (r * 0.3) + ' M2.5 3.4 L' + (r * 0.55) + ' ' + (r * 0.85) +
        ' M-2.5 3.4 L-' + (r * 0.55) + ' ' + (r * 0.85) + ' M-4 -1.3 L-' + (r * 0.92) + ' -' + (r * 0.3), stroke: INK, 'stroke-width': 1.5, fill: 'none', 'stroke-linecap': 'round' }, g);
    } else {
      s('path', { d: 'M-' + r + ' 0 L' + r + ' 0 M0 -' + r + ' L0 ' + r, stroke: INK, 'stroke-width': 1.5, fill: 'none', opacity: 0.8 }, g);
      s('path', { d: 'M-' + (r * 0.72) + ' -' + (r * 0.7) + ' Q-' + (r * 0.2) + ' 0 -' + (r * 0.72) + ' ' + (r * 0.7) +
        ' M' + (r * 0.72) + ' -' + (r * 0.7) + ' Q' + (r * 0.2) + ' 0 ' + (r * 0.72) + ' ' + (r * 0.7), stroke: INK, 'stroke-width': 1.5, fill: 'none', opacity: 0.8 }, g);
    }
    return g;
  }

  function ground(pen, parent, y, x0, x1, seed) {
    var r = S.rng(seed || 5), g = s('g', null, parent);
    pen.line(g, x0, y, x1, y, { w: 2.6, amp: 2.4 });
    for (var x = x0 + 14; x < x1; x += 18 + r() * 26) {
      pen.line(g, x, y + 5 + r() * 3, x - 10 - r() * 8, y + 13 + r() * 6, { w: 1.4, op: 0.35, amp: 0.6, ghost: false });
    }
    return g;
  }


  /* walk / run cycle as a layer: blends over the authored poses between start..end, travelling `travel` units */
  function makeGait(o) {
    var start = o.start, end = o.end, ctl = o.ctl || { x0: 0 };
    return function (p, wa, ex) {
      var u = clamp((p - start) / (end - start), 0, 1);
      var w = ramp(p, start, start + 0.03) * (1 - ramp(p, end - 0.07, end + 0.005));
      if (w <= 0) return;
      var phi = o.phiEnd * smooth(u), sp = clamp(6 * u * (1 - u) / 1.5, 0.3, 1), amp = (0.55 + 0.45 * sp) * (o.amp || 1);
      var a = 2 * Math.PI * phi, sn = Math.sin(a);
      function bend(ph) { return 14 + 66 * Math.pow(0.5 + 0.5 * Math.cos(2 * Math.PI * (ph - 0.03)), 2.2) * amp; }
      var tF = -14 - 40 * amp * sn, tB = -14 + 40 * amp * sn;
      var kF = bend(phi), kB = bend(phi + 0.5);
      var g = {
        thighF: tF, shinF: tF + kF, footF: clamp((tF + kF) * 0.45, -8, 50),
        thighB: tB, shinB: tB + kB, footB: clamp((tB + kB) * 0.45, -8, 50),
        hips: 0
      };
      if (!o.legsOnly) {
        g.uArmF = 8 + 40 * amp * sn; g.uArmB = 8 - 40 * amp * sn; g.chest = o.lean == null ? 11 : o.lean;
        g.fArmF = g.uArmF - 78; g.fArmB = g.uArmB - 78;
      }
      for (var n in g) wa[n] = lerp(wa[n], g[n], w);
      ex.x = lerp(ex.x, ctl.x0 + o.travel * smooth(u), ramp(p, start, start + 0.01) * (1 - ramp(p, end - 0.02, end)));
    };
  }

  /* ============================================================ SOCCER */

  var SOCCER = { ground: 450, ballR: 11, pc: 0.5, pn: 0.585, goalX: 800, netX: 872 };

  function soccer(svg, stage) {
    svg.setAttribute('viewBox', '60 150 880 380');
    var pen = S.Pen(21), G = SOCCER.ground, R = SOCCER.ballR;
    var scene = new S.Scene({ name: 'soccer', stage: stage, range: [0.12, 0.8], staticP: 0.52, steps: 110 });

    /* world */
    var far = s('g', null, svg), mid = s('g', null, svg), fx = s('g', null, svg);
    var crowd = s('g', { opacity: 0.5 }, far), cr = S.rng(9);
    for (var row = 0; row < 3; row++) {
      for (var cx = -40; cx < 1060; cx += 20 + cr() * 8) {
        var cy = 372 + row * 22 + (cr() - 0.5) * 3;
        pen.ellipse(crowd, cx, cy, 5.5, 5.5, { w: 1.5, op: 0.28 + row * 0.06, ghost: false, amp: 0.4 });
        pen.line(crowd, cx, cy + 6, cx, cy + 15, { w: 1.5, op: 0.22, ghost: false, amp: 0.3 });
      }
    }
    pen.line(far, -40, 366, 1040, 366, { w: 1.6, op: 0.35, amp: 2 });
    pen.line(far, -40, 356, 1040, 356, { w: 1.2, op: 0.18, amp: 2 });
    scene.track(far, function (p) { return { x: lerp(18, -18, p) }; });

    ground(pen, mid, G, -20, 1020, 4);
    /* penalty-spot, a chalk arc */
    pen.curve(mid, [[560, G + 34], [650, G + 22], [740, G + 24], [840, G + 38]], { w: 1.6, op: 0.28, ghost: false });

    /* goal, seen from the side: post, crossbar running back, net behind it */
    var goal = s('g', null, mid), gx = SOCCER.goalX, nx = SOCCER.netX, top = G - 238;
    var net = s('g', null, goal);
    pen.hatch(net, gx + 2, top + 8, nx - gx - 2, G - top - 14, 11, 35, { w: 1.1, op: 0.38 });
    pen.hatch(net, gx + 2, top + 8, nx - gx - 2, G - top - 14, 11, -35, { w: 1.1, op: 0.38 });
    pen.line(net, nx, top + 14, nx, G - 4, { w: 2, op: 0.6 });
    pen.line(net, gx, top, nx, top + 14, { w: 2.4 });
    pen.line(net, nx, G - 4, gx + 6, G - 2, { w: 1.6, op: 0.4 });
    pen.line(goal, gx, G, gx, top, { w: 3.4 });
    pen.line(goal, gx - 3, top, gx + 6, top, { w: 3.4, ghost: false });
    net.style.transformOrigin = gx + 'px ' + (G - 120) + 'px';

    /* figure + choreography */
    var shadows = s('g', null, mid), figLayer = s('g', null, mid);
    var fig = S.figure(figLayer, { seed: 11 });

    var travel = 140, gaitStart = 0.05, gaitEnd = 0.355;
    var gaitCtl = { x0: 0 };
    var gait = makeGait({ start: gaitStart, end: gaitEnd, travel: travel, phiEnd: 1.75, ctl: gaitCtl, lean: 11 });

    var keys = [
      K(0.00, { chest: 5, head: 12, uArmF: 6, fArmF: -14, uArmB: -6, fArmB: -16, x: 0 }),
      K(0.05, { chest: 5, head: 12, uArmF: 6, fArmF: -14, uArmB: -6, fArmB: -16, x: 0 }),
      K(0.20, { chest: 11, head: 12, x: travel * 0.5 }),
      /* plant + load: left foot down beside the ball, kicking leg drawn back, arms balancing */
      K(0.37, { chest: 9, head: 16, x: travel, thighB: -14, shinB: 10, footB: 0,
        thighF: 34, shinF: 120, footF: 38, uArmB: -62, fArmB: -92, uArmF: 38, fArmF: 10 }),
      /* anticipation: a beat of extra wind-up */
      K(0.445, { chest: -3, head: 18, x: travel + 4, thighB: -16, shinB: 12, footB: 0,
        thighF: 54, shinF: 148, footF: 46, uArmB: -74, fArmB: -100, uArmF: 52, fArmF: 20, hips: -3 }),
      /* contact */
      K(0.50, { chest: 10, head: 22, x: travel + 14, thighB: -14, shinB: 12, footB: 2,
        thighF: -32, shinF: -30, footF: 56, uArmB: -50, fArmB: -66, uArmF: 62, fArmF: 40, hips: 4 }),
      /* follow-through: leg whips up, body folds over the planted foot */
      K(0.565, { chest: 24, head: 14, x: travel + 24, air: 5, thighB: -6, shinB: 4, footB: 28,
        thighF: -88, shinF: -66, footF: 34, uArmB: -34, fArmB: -50, uArmF: 74, fArmF: 52, hips: 6 }),
      K(0.64, { chest: 14, head: -2, x: travel + 40, thighB: -8, shinB: 6, footB: 8,
        thighF: -46, shinF: -14, footF: 12, uArmB: -20, fArmB: -30, uArmF: 36, fArmF: 20, hips: 0 }),
      /* he watches it go in */
      K(0.72, { chest: 2, head: -10, x: travel + 44, thighB: 4, shinB: 4, thighF: -6, shinF: 6,
        uArmB: 10, fArmB: -12, uArmF: 14, fArmF: -16 }),
      K(0.79, { chest: 10, head: -4, x: travel + 44, thighB: -24, shinB: 38, thighF: -22, shinF: 34,
        uArmB: 30, fArmB: 8, uArmF: 34, fArmF: 12 }),
      /* a small fist-pump hop */
      K(0.87, { chest: -4, head: -14, x: travel + 46, air: 30, thighB: -22, shinB: 28, footB: 20, thighF: -46, shinF: 40, footF: 18,
        uArmF: -168, fArmF: -178, uArmB: -10, fArmB: -30 }),
      K(0.94, { chest: 6, head: -4, x: travel + 46, thighB: -12, shinB: 18, thighF: -10, shinF: 16,
        uArmF: -140, fArmF: -158, uArmB: 6, fArmB: -14 }),
      K(1.00, { chest: 1, head: -6, x: travel + 46, uArmF: -112, fArmF: -132, uArmB: 8, fArmB: -14 })
    ];
    var ch = S.choreo({
      keys: keys, ground: G, layers: [gait],
      lag: { head: 0.006, fArmF: 0.006, fArmB: 0.006, footF: 0.004, footB: 0.004, chest: 0.003 }
    });

    /* lay the figure out so the kicking toe meets the ball at contact */
    var probe = ch.eval(SOCCER.pc), ballX = 470;
    var x0 = ballX - 2 - probe.pos.toeF[0];
    keys.forEach(function (k) { k.x += x0; });
    gaitCtl.x0 = x0;
    ch = S.choreo({
      keys: keys, ground: G, layers: [gait],
      lag: { head: 0.006, fArmF: 0.006, fArmB: 0.006, footF: 0.004, footB: 0.004, chest: 0.003 }
    });
    scene.rig(fig, ch);
    figShadow(scene, shadows, ch, G);

    /* ball: waits, takes the strike, flies, sits in the net, drops */
    var by = G - R, pc = SOCCER.pc, pn = SOCCER.pn;
    var flight = arc(ballX, by, 862, G - 132, 0, pn - pc);
    var drop = arc(862, G - 132, 842, G - R, 0, 0.1);
    var ballShadow = s('ellipse', { cx: 0, cy: G + 3, rx: 13, ry: 3.4, fill: INK, opacity: 0.16 }, mid);
    ballShadow.style.transformOrigin = '0px ' + (G + 3) + 'px';

    var trail = s('path', { d: '', fill: 'none', stroke: BLUE, 'stroke-width': 2.4, 'stroke-linecap': 'round', 'stroke-dasharray': '1 1.3', pathLength: 1 }, mid);
    (function () {
      var d = '';
      for (var i = 0; i <= 24; i++) { var q = flight.at(flight.T * i / 24); d += (i ? 'L' : 'M') + S.f(q[0]) + ' ' + S.f(q[1]); }
      trail.setAttribute('d', d);
    })();
    trail.style.strokeDasharray = '1 3';
    scene.track(trail, function (p) {
      var t = clamp((p - pc) / (pn - pc), 0, 1);
      return { dash: 1 - t, o: p < pc ? 0 : 0.7 * (1 - ramp(p, pn + 0.01, pn + 0.07)) };
    });

    var ball = s('g', null, mid);
    ballArt(ball, R, 'soccer');
    function ballAt(p) {
      var pos, spin;
      if (p <= pc) { pos = [ballX, by]; spin = 0; }
      else if (p <= pn) { pos = flight.at(p - pc); spin = 1500 * (p - pc); }
      else {
        var tau = p - pn;
        if (tau < 0.1) pos = drop.at(tau);
        else { pos = [842 - 14 * smooth((tau - 0.1) / 0.1), G - R - 17 * Math.abs(Math.sin(Math.PI * clamp((tau - 0.1) / 0.06, 0, 1)))]; }
        pos[0] = Math.min(pos[0], 862); spin = 1500 * (pn - pc) + 300 * Math.min(tau, 0.2);
      }
      return { pos: pos, spin: spin };
    }
    scene.track(ball, function (p) {
      var b = ballAt(p);
      return { x: b.pos[0], y: b.pos[1], r: b.spin };
    });
    scene.track(ballShadow, function (p) {
      var b = ballAt(p), h = clamp((G - R - b.pos[1]) / 120, 0, 1);
      var inNet = p > pn;
      return { x: b.pos[0], sx: 1 - h * 0.5, sy: 1 - h * 0.5, o: inNet && b.pos[1] < G - 30 ? 0 : 0.2 * (1 - h * 0.5) };
    });
    ball.style.transformOrigin = '0px 0px';

    /* net takes the hit */
    scene.track(net, function (p) {
      var t = p - pn;
      if (t < 0) return { sx: 1, sy: 1 };
      var k = Math.exp(-t * 34) * Math.sin(t * 190);
      return { sx: 1 + 0.2 * Math.max(0, Math.min(1, 1 - t * 8)) * 0 + k * 0.5 + 0.0, sy: 1 };
    });

    /* contact burst + chalk ticks */
    var burst = S.burst(fx, ballX + 6, G - 24, 22, 44, 5, { from: -75, to: 15, w: 2.6, color: INK });
    burst.style.transformOrigin = (ballX + 6) + 'px ' + (G - 14) + 'px';
    scene.track(burst, function (p) {
      var t = (p - pc) / 0.05;
      if (t < -0.05 || t > 1) return { o: 0, s: 0.7 };
      var up = clamp((p - pc + 0.004) / 0.012, 0, 1), down = 1 - clamp((p - pc - 0.012) / 0.04, 0, 1);
      return { o: up * down, s: 0.7 + 0.5 * clamp((p - pc) / 0.04, 0, 1) };
    });

    return { scene: scene, choreo: ch, fig: fig, viewNarrow: '230 160 660 380' };
  }

  /* ============================================================ BASKETBALL */

  var BASKET = { ground: 450, pr: 0.405, ballR: 12, rimX: 836, rimY: 172 };

  function basket(svg, stage) {
    svg.setAttribute('viewBox', '100 20 840 490');
    var pen = S.Pen(33), G = BASKET.ground, R = BASKET.ballR, pr = BASKET.pr;
    var scene = new S.Scene({ name: 'basket', stage: stage, range: [0.1, 0.78], staticP: 0.48, steps: 110 });

    var far = s('g', null, svg), mid = s('g', null, svg), hoopFront = s('g', null, svg), fx = s('g', null, svg);
    /* back wall: bleachers + a window of light */
    var cr = S.rng(14);
    pen.line(far, -40, 372, 1040, 372, { w: 1.6, op: 0.3, amp: 2 });
    for (var i = 0; i < 9; i++) {
      var bx = 40 + i * 118 + cr() * 14;
      pen.rect(far, bx, 292 + cr() * 8, 70 + cr() * 12, 74, { w: 1.4, op: 0.2, amp: 1.2, ghost: false });
      pen.line(far, bx + 8, 310, bx + 56, 310, { w: 1.1, op: 0.14, amp: 0.8, ghost: false });
    }
    scene.track(far, function (p) { return { x: lerp(14, -14, p) }; });

    ground(pen, mid, G, -20, 1020, 8);
    /* court markings: the key, a free-throw arc */
    pen.curve(mid, [[470, G + 30], [560, G + 22], [650, G + 24], [740, G + 34]], { w: 1.6, op: 0.28, ghost: false });
    pen.line(mid, 640, G + 4, 640, G + 40, { w: 1.4, op: 0.2, ghost: false });

    /* the hoop, in three-quarter view so the ball can drop through it */
    var rx = BASKET.rimX, ry = BASKET.rimY;
    var board = s('g', null, mid);
    pen.line(board, rx + 52, ry - 70, rx + 52, ry + 26, { w: 3.4 });
    pen.line(board, rx + 52, ry - 70, rx + 38, ry - 62, { w: 2, op: 0.7 });
    pen.line(board, rx + 52, ry + 26, rx + 38, ry + 34, { w: 2, op: 0.7 });
    pen.line(board, rx + 38, ry - 62, rx + 38, ry + 34, { w: 2, op: 0.7 });
    pen.rect(board, rx + 40, ry - 18, 11, 24, { w: 1.4, op: 0.5, ghost: false });
    pen.line(board, rx + 54, ry + 8, rx + 72, ry + 8, { w: 3 });
    pen.line(board, rx + 72, ry + 8, rx + 72, G, { w: 3.6 });
    pen.curve(mid, [[rx - 40, ry], [rx - 30, ry - 10], [rx, ry - 14], [rx + 30, ry - 10], [rx + 38, ry]], { w: 2.8 });
    var net = s('g', null, hoopFront);
    var netTop = ry + 2;
    for (var k = 0; k <= 6; k++) {
      var tx = rx - 38 + k * 12.6, bx2 = rx - 22 + k * 7.3;
      pen.line(net, tx, netTop, bx2, netTop + 62, { w: 1.3, op: 0.55, amp: 0.8, ghost: false });
    }
    for (var m = 1; m <= 4; m++) {
      var yy = netTop + m * 14, inset = m * 3.2;
      pen.line(net, rx - 38 + inset, yy, rx + 38 - inset, yy + (m % 2 ? 3 : -2), { w: 1.2, op: 0.45, amp: 1, ghost: false });
    }
    net.style.transformOrigin = rx + 'px ' + netTop + 'px';
    pen.curve(hoopFront, [[rx - 40, ry], [rx - 30, ry + 10], [rx, ry + 15], [rx + 30, ry + 10], [rx + 38, ry]], { w: 3.4 });

    /* figure */
    var shadows = s('g', null, mid), figLayer = s('g', null, mid);
    var fig = S.figure(figLayer, { seed: 17 });
    var legsDip = { thighF: -34, shinF: 56, footF: 8, thighB: -26, shinB: 46, footB: 6 };
    var legsUp = { thighF: -4, shinF: 2, footF: 42, thighB: -2, shinB: 6, footB: 40 };
    var keys = [
      K(0.00, { x: 0, chest: 3, head: -4, uArmF: 16, fArmF: -34, uArmB: 4, fArmB: -22 }),
      /* ready: ball comes up to the chest, both hands on it */
      K(0.12, { x: 2, chest: 5, head: -6, uArmF: -26, fArmF: -112, uArmB: -34, fArmB: -104 }),
      /* gather: sink into the legs, ball drops to the hip, then dips */
      K(0.24, Object.assign({ x: 6, chest: 20, head: -6, uArmF: -4, fArmF: -88, uArmB: -14, fArmB: -92, hips: 0 }, legsDip)),
      /* the drive: legs explode, ball slides up the body into the shot pocket */
      K(0.31, Object.assign({ x: 8, chest: 6, head: -14, uArmF: -78, fArmF: -168, uArmB: -70, fArmB: -150, air: 8 }, legsUp)),
      K(0.365, Object.assign({ x: 8, chest: -2, head: -18, uArmF: -138, fArmF: -176, uArmB: -118, fArmB: -164, air: 40 }, { thighF: -8, shinF: 18, footF: 50, thighB: -6, shinB: 22, footB: 48 })),
      /* release - still rising, arm extending up and out */
      K(0.405, { x: 8, chest: -4, head: -20, uArmF: -158, fArmF: -182, uArmB: -128, fArmB: -170, air: 51, thighF: -10, shinF: 24, footF: 54, thighB: -4, shinB: 26, footB: 50 }),
      /* follow-through: wrist flops forward, "reaching into the cookie jar" */
      K(0.46, { x: 8, chest: 0, head: -18, uArmF: -168, fArmF: -128, uArmB: -90, fArmB: -78, air: 42, thighF: -16, shinF: 26, footF: 40, thighB: -8, shinB: 22, footB: 38 }),
      K(0.52, { x: 8, chest: 8, head: -14, uArmF: -166, fArmF: -122, uArmB: -50, fArmB: -50, air: 0, thighF: -26, shinF: 40, footF: 10, thighB: -18, shinB: 32, footB: 8 }),
      K(0.60, { x: 8, chest: 2, head: -12, uArmF: -160, fArmF: -128, uArmB: -10, fArmB: -22, thighF: -6, shinF: 8, thighB: -4, shinB: 6 }),
      /* arm held, a half-smile and he turns his head to track the ball */
      K(0.72, { x: 8, chest: 1, head: -4, uArmF: -120, fArmF: -110, uArmB: 6, fArmB: -16 }),
      K(0.86, { x: 8, chest: 1, head: 4, uArmF: 6, fArmF: -30, uArmB: 6, fArmB: -16 }),
      K(1.00, { x: 8, chest: 2, head: 6, uArmF: 8, fArmF: -24, uArmB: 4, fArmB: -14 })
    ];
    var lag = { head: 0.008, fArmF: 0.008, fArmB: 0.008, footF: 0.005, footB: 0.005, uArmF: 0.003 };
    var probe = S.choreo({ keys: keys, ground: G, lag: lag }).eval(pr);
    var shooterX = 372;
    var x0 = shooterX - probe.pos.hips[0];
    keys.forEach(function (k) { k.x += x0; });
    var ch = S.choreo({ keys: keys, ground: G, lag: lag });
    scene.rig(fig, ch);
    figShadow(scene, shadows, ch, G);

    /* ball: carried by the near hand (a child of the forearm), then a free ball after release */
    var held = s('g', { transform: 'translate(6,14)' }, fig.bones.fArmF);
    ballArt(held, R, 'basket');
    scene.track(held, function (p) { return { o: p < pr ? 1 : 0 }; });

    var rel = ch.eval(pr).pos.holdF;
    var rimIn = [rx, ry + 4];
    var flight = arc(rel[0], rel[1], rimIn[0], rimIn[1], 128, 0.13);
    var fall = arc(rimIn[0], rimIn[1], rimIn[0] + 4, G - R, 0, 0.1);
    var free = s('g', null, mid);
    var freeArt = ballArt(free, R, 'basket');
    var trail = s('path', { d: '', fill: 'none', stroke: BLUE, 'stroke-width': 2.4, 'stroke-linecap': 'round', pathLength: 1 }, mid);
    (function () {
      var d = '';
      for (var i = 0; i <= 28; i++) { var q = flight.at(flight.T * i / 28); d += (i ? 'L' : 'M') + S.f(q[0]) + ' ' + S.f(q[1]); }
      trail.setAttribute('d', d);
    })();
    trail.style.strokeDasharray = '1 4';
    var pRim = pr + flight.T;
    scene.track(trail, function (p) {
      return { dash: 1 - clamp((p - pr) / flight.T, 0, 1), o: p < pr ? 0 : 0.7 * (1 - ramp(p, pRim + 0.01, pRim + 0.07)) };
    });
    function ballAt(p) {
      if (p < pr) return { pos: rel, spin: 0 };
      if (p <= pRim) return { pos: flight.at(p - pr), spin: -520 * (p - pr) };
      var tau = p - pRim, pos;
      if (tau < 0.1) pos = fall.at(tau);
      else pos = [rimIn[0] + 4 - 30 * smooth((tau - 0.1) / 0.12), G - R - 22 * Math.abs(Math.sin(Math.PI * clamp((tau - 0.1) / 0.07, 0, 1))) * (1 - clamp((tau - 0.17) / 0.1, 0, 1))];
      return { pos: pos, spin: -520 * flight.T - 200 * tau };
    }
    scene.track(free, function (p) {
      var b = ballAt(p);
      return { x: b.pos[0], y: b.pos[1], r: b.spin, o: p < pr ? 0 : 1 };
    });
    free.style.transformOrigin = '0px 0px';
    var bs = s('ellipse', { cx: 0, cy: G + 3, rx: 13, ry: 3.4, fill: INK }, mid);
    bs.style.transformOrigin = '0px ' + (G + 3) + 'px';
    scene.track(bs, function (p) {
      var b = ballAt(p), h = clamp((G - R - b.pos[1]) / 300, 0, 1);
      return { x: b.pos[0], sx: 1 - h * 0.55, sy: 1 - h * 0.55, o: p < pr ? 0 : 0.18 * (1 - h * 0.7) };
    });

    /* the swish: net kicks, a few ticks radiate */
    scene.track(net, function (p) {
      var t = p - pRim;
      if (t < 0) return { sx: 1, sy: 1 };
      var damp = Math.exp(-t * 26), w = Math.sin(t * 150);
      return { sx: 1 - 0.1 * damp * w * 0, sy: 1 + 0.16 * damp * Math.max(0, Math.sin(t * 120)), r: 5 * damp * w };
    });
    var burst = S.burst(fx, rx, ry + 40, 62, 84, 5, { from: 30, to: 150, w: 2.4, color: BLUE });
    burst.style.transformOrigin = rx + 'px ' + (ry + 40) + 'px';
    scene.track(burst, function (p) {
      var t = p - pRim;
      return { o: t < 0 || t > 0.07 ? 0 : clamp(t / 0.01, 0, 1) * (1 - clamp((t - 0.015) / 0.05, 0, 1)), s: 0.8 + clamp(t / 0.05, 0, 1) * 0.4 };
    });

    return { scene: scene, choreo: ch, fig: fig, viewNarrow: '250 20 660 490' };
  }

  /* ============================================================ GUITAR */

  var GUITAR = { ground: 450, beats: 8, x: 470 };

  function guitar(svg, stage) {
    svg.setAttribute('viewBox', '70 110 860 400');
    var pen = S.Pen(47), G = GUITAR.ground;
    var scene = new S.Scene({ name: 'guitar', stage: stage, range: [0.1, 0.82], staticP: 0.5, steps: 120 });
    var far = s('g', null, svg), mid = s('g', null, svg), notesLayer = s('g', null, svg);

    /* a corner of a room: window onto the skyline, an amp, a plant */
    var win = s('g', null, far);
    pen.rect(win, 640, 130, 250, 220, { w: 2.4, op: 0.5 });
    pen.line(win, 765, 130, 765, 350, { w: 2, op: 0.6 });
    pen.line(win, 640, 240, 890, 240, { w: 1.6, op: 0.4 });
    var sk = S.rng(3), sx = 646;
    while (sx < 884) {
      var bw = 14 + sk() * 24, bh = 26 + sk() * 70;
      pen.rect(win, sx, 350 - 6 - bh, Math.min(bw, 884 - sx), bh, { w: 1.3, op: 0.34, ghost: false, amp: 0.8 });
      sx += bw + 3;
    }
    pen.rect(far, 112, G - 116, 112, 116, { w: 2.8 });
    pen.ellipse(far, 168, G - 56, 34, 34, { w: 1.6, op: 0.5, amp: 1.2, ghost: false });
    pen.ellipse(far, 168, G - 56, 7, 7, { w: 1.6, op: 0.6, ghost: false });
    for (var kn = 0; kn < 4; kn++) pen.ellipse(far, 128 + kn * 22, G - 102, 3.4, 3.4, { w: 1.4, op: 0.6, ghost: false, amp: 0.3 });
    pen.curve(far, [[130, G - 116], [128, G - 124], [196, G - 124], [206, G - 116]], { w: 1.4, op: 0.4, ghost: false });
    scene.track(far, function (p) { return { x: lerp(12, -12, p) }; });
    ground(pen, mid, G, -20, 1020, 12);
    pen.curve(mid, [[330, G + 26], [440, G + 38], [580, G + 38], [690, G + 24]], { w: 1.6, op: 0.28, ghost: false });

    var shadows = s('g', null, mid), figLayer = s('g', null, mid);
    var fig = S.figure(figLayer, { seed: 23 });

    /* the guitar rides the chest bone, painted between shirt and strumming arm */
    var gg = s('g', { transform: 'translate(18 -24) rotate(-13)' }, fig.slots.front);
    var body = s('g', null, gg);
    var bodyD = 'M-30 -4 C-33 -22 -14 -27 -6 -20 C-2 -16 3 -15 8 -17 C20 -21 25 -10 18 -1 C26 8 24 25 6 26 C-8 27 -28 24 -31 10 C-32 4 -32 -1 -30 -4 Z';
    s('path', { d: bodyD, fill: '#e9d6b4', stroke: 'none' }, body);
    pen.fillShape(body, bodyD, '#e9d6b4', { w: 2.6 });
    pen.ellipse(body, -8, 3, 8.4, 8.4, { w: 2.2, ghost: false, amp: 0.6 });
    s('ellipse', { cx: -8, cy: 3, rx: 7, ry: 7, fill: INK, opacity: 0.8 }, body);
    pen.line(body, -22, 19, -16, 19, { w: 2.4, ghost: false, amp: 0.2 });
    pen.line(gg, 10, -5, 78, -5, { w: 5, color: INK, ghost: false, amp: 0.3 });
    for (var fr = 0; fr < 5; fr++) pen.line(gg, 22 + fr * 11, -9, 22 + fr * 11, -1, { w: 1.1, op: 0.55, ghost: false, amp: 0.2 });
    s('path', { d: 'M78 -9 L94 -10 L94 0 L78 -1 Z', fill: INK }, gg);
    pen.line(gg, -26, -3, 78, -5, { w: 1, op: 0.55, ghost: false, amp: 0.2 });
    /* strap: tail of the body up over the shoulder, and down to the neck-side bout */
    s('path', { d: 'M-12 -21 Q-17 -38 -3 -50 M1 -50 L18 -39', stroke: BLUE, 'stroke-width': 2.8, fill: 'none', 'stroke-linecap': 'round' }, fig.slots.front);

    /* choreography: he walks in, settles, then a slow authored sway + a procedural strum / foot-tap overlay */
    var x0 = GUITAR.x, B = GUITAR.beats, walkFrom = 150, playFrom = 0.3;
    function groove(p, wa, ex) {
      var q = clamp((p - playFrom) / (0.94 - playFrom), 0, 1), env = ramp(q, 0, 0.08) * (1 - ramp(q, 0.9, 1));
      var a = 2 * Math.PI * B * q, sn = Math.sin(a);
      wa.fArmF += env * 26 * sn;
      wa.uArmF += env * 9 * sn;
      var tap = Math.max(0, Math.sin(Math.PI * B * q)); tap = tap * tap;
      wa.footF -= env * 18 * tap;
      wa.shinF += env * 5 * tap;
      wa.head += env * 5 * Math.sin(2 * Math.PI * (B / 2) * q + 0.7);
      wa.chest += env * 3 * Math.sin(2 * Math.PI * (B / 4) * q);
      wa.fArmB += env * 6 * Math.sin(2 * Math.PI * (B / 4) * q + 1.2);
      wa.uArmB += env * 3 * Math.sin(2 * Math.PI * (B / 4) * q + 1.2);
      var bob = Math.sin(a - 0.6) * env;
      wa.thighF -= bob * 3; wa.shinF += bob * 5; wa.thighB -= bob * 3; wa.shinB += bob * 5;
    }
    var strum = { uArmF: 8, fArmF: -92, uArmB: -80, fArmB: -66 };
    function GK(t0, o) { return K(t0, Object.assign({ x: x0 }, strum, o)); }
    var keys = [
      GK(0.00, { x: x0 - walkFrom, chest: 4, head: 6, uArmF: 4, fArmF: -70, uArmB: -70, fArmB: -60 }),
      GK(0.10, { x: x0 - walkFrom, chest: 4, head: 6, uArmF: 4, fArmF: -70, uArmB: -70, fArmB: -60 }),
      GK(0.30, { chest: 0, head: 6, thighF: -4, shinF: 6, thighB: 4, shinB: 4 }),
      GK(0.46, { x: x0 - 6, chest: 3, head: -2, thighF: -10, shinF: 14, thighB: -4, shinB: 12 }),
      GK(0.62, { x: x0 + 5, chest: -3, head: -9, thighF: -4, shinF: 8, thighB: 6, shinB: 8, uArmB: -86, fArmB: -62 }),
      GK(0.78, { x: x0 - 2, chest: 3, head: 4, thighF: -10, shinF: 14, thighB: -2, shinB: 10 }),
      GK(0.94, { chest: -1, head: -3, thighF: -6, shinF: 10, thighB: 2, shinB: 6 }),
      GK(1.00, { chest: -1, head: -3, thighF: -6, shinF: 10, thighB: 2, shinB: 6 })
    ];
    var walk = makeGait({ start: 0.04, end: 0.3, travel: walkFrom, phiEnd: 2.5, ctl: { x0: x0 - walkFrom }, legsOnly: true, amp: 0.8 });
    var ch = S.choreo({ keys: keys, ground: G, layers: [walk, groove], lag: { head: 0.006, fArmF: 0.003, fArmB: 0.006, footF: 0.003 } });
    scene.rig(fig, ch);
    figShadow(scene, shadows, ch, G, 40);

    /* notes: born at the sound hole, drift up and away in scroll sub-ranges */
    var spawn = [0.36, 0.46, 0.56, 0.66, 0.76, 0.84];
    spawn.forEach(function (ps, i) {
      var g = s('g', { opacity: 0 }, notesLayer);
      S.note(g, i % 2 ? 'pair' : 'single', { color: i % 3 === 2 ? BLUE : INK });
      var e0 = ch.eval(ps), ca = e0.wa.chest, c = e0.pos.chest;
      var hole = [c[0] + (18 - 8 * Math.cos(-13 * Math.PI / 180) + 0) * Math.cos(ca * Math.PI / 180), c[1] - 22];
      var rr = S.rng(77 + i), drift = 120 + rr() * 70, sway = 16 + rr() * 14, life = 0.2;
      g.style.transformOrigin = '0px 0px';
      scene.track(g, function (p) {
        var t = (p - ps) / life;
        if (t < 0 || t > 1) return { o: 0, x: hole[0] + 20, y: hole[1] - 18, s: 0.7 };
        var e = S.smooth(t);
        return {
          x: hole[0] + 30 + drift * t * 0.9 + Math.sin(t * 5 + i) * sway * 0.5,
          y: hole[1] - 26 - 150 * e - Math.sin(t * 4 + i) * 6,
          r: (Math.sin(t * 6 + i) * 10),
          s: 0.65 + 0.45 * e,
          o: clamp(t / 0.15, 0, 1) * (1 - clamp((t - 0.7) / 0.3, 0, 1))
        };
      });
    });

    return { scene: scene, choreo: ch, fig: fig, viewNarrow: '310 130 560 380' };
  }


  /* ============================================================ WAVE (the goodbye at the end of the page) */

  function wave(svg, stage) {
    svg.setAttribute('viewBox', '0 0 300 270');
    var pen = S.Pen(53), G = 244;
    var scene = new S.Scene({ name: 'wave', stage: stage, range: [0.03, 0.4], staticP: 0.8, steps: 80 });
    pen.curve(svg, [[10, G + 2], [90, G - 1], [200, G + 3], [290, G]], { w: 2.4, op: 0.8 });
    for (var i = 0; i < 6; i++) pen.line(svg, 30 + i * 46, G + 7, 24 + i * 46, G + 15, { w: 1.4, op: 0.35, ghost: false, amp: 0.4 });
    var shadows = s('g', null, svg), layer = s('g', null, svg);
    var fig = S.figure(layer, { seed: 59 });
    var idle = { chest: 1, head: -2, uArmB: 6, fArmB: -12, thighF: -4, shinF: 6, thighB: 4, shinB: 4 };
    var up = { uArmF: -122, fArmF: -166 };
    var keys = [
      K(0.00, Object.assign({ x: 112 }, idle, { uArmF: 8, fArmF: -14, head: -6 })),
      K(0.12, Object.assign({ x: 112 }, idle, { uArmF: -60, fArmF: -110, head: -2, chest: -2 })),
      K(0.26, Object.assign({ x: 112 }, idle, up, { head: 2, chest: -3 })),
      K(0.36, Object.assign({ x: 112 }, idle, { uArmF: -126, fArmF: -144, head: 3, chest: -3 })),
      K(0.46, Object.assign({ x: 112 }, idle, { uArmF: -120, fArmF: -188, head: 3, chest: -3 })),
      K(0.56, Object.assign({ x: 112 }, idle, { uArmF: -126, fArmF: -144, head: 3, chest: -3 })),
      K(0.66, Object.assign({ x: 112 }, idle, { uArmF: -120, fArmF: -188, head: 3, chest: -3 })),
      K(0.76, Object.assign({ x: 112 }, idle, { uArmF: -126, fArmF: -146, head: 3, chest: -3 })),
      K(0.88, Object.assign({ x: 112 }, idle, { uArmF: -80, fArmF: -110, head: 2, chest: -2 })),
      K(1.00, Object.assign({ x: 112 }, idle, { uArmF: -50, fArmF: -80, head: 2, chest: -2 }))
    ];
    var ch = S.choreo({ keys: keys, ground: G, lag: { head: 0.02, fArmF: 0.025, fArmB: 0.03 } });
    scene.rig(fig, ch);
    figShadow(scene, shadows, ch, G, 28);
    var bub = s('g', { opacity: 0 }, svg);
    s('text', { x: 232, y: 70, 'font-family': "'Reenie Beanie', cursive", 'font-size': 34, fill: INK, 'text-anchor': 'middle' }, bub).textContent = 'thanks for';
    s('text', { x: 232, y: 100, 'font-family': "'Reenie Beanie', cursive", 'font-size': 34, fill: INK, 'text-anchor': 'middle' }, bub).textContent = 'stopping by';
    scene.track(bub, function (p) { return { o: ramp(p, 0.5, 0.64), y: 8 * (1 - ramp(p, 0.5, 0.64)) }; });
    return { scene: scene, choreo: ch, fig: fig };
  }

  /* ============================================================ HERO sketch Matt */

  /* a seated Matt on the top edge of the taped print: looks out, waves once, settles with an arm on his knee */
  function hero(svg) {
    var scene = new S.Scene({ name: 'hero', stage: svg, steps: 90 });
    var layer = s('g', null, svg);
    var fig = S.figure(layer, { seed: 31 });
    var sit = { chest: 4, head: -2, thighF: -86, shinF: 2, footF: 6, thighB: -94, shinB: 14, footB: 6, uArmB: 18, fArmB: -8 };
    function H(t, o) { return K(t, Object.assign({}, sit, o)); }
    var keys = [
      H(0.00, { head: 4, uArmF: 14, fArmF: -10, chest: 1 }),
      H(0.12, { head: 2, uArmF: -62, fArmF: -122, chest: 0 }),
      H(0.26, { head: -2, uArmF: -122, fArmF: -166, chest: -1 }),
      H(0.36, { head: -4, uArmF: -126, fArmF: -144, chest: -1 }),
      H(0.46, { head: -4, uArmF: -120, fArmF: -188, chest: -1 }),
      H(0.56, { head: -4, uArmF: -126, fArmF: -144, chest: -1 }),
      H(0.66, { head: -4, uArmF: -120, fArmF: -186, chest: -1 }),
      H(0.82, { head: -8, uArmF: -64, fArmF: -92, chest: 5, thighF: -84, shinF: 8 }),
      H(1.00, { head: -10, uArmF: -40, fArmF: -64, chest: 9, thighF: -86, shinF: 12 })
    ];
    var ch = S.choreo({ keys: keys, y: 0, lag: { head: 0.02, fArmF: 0.03, fArmB: 0.03, shinF: 0.04, footF: 0.05, shinB: 0.04, footB: 0.05 } });
    scene.rig(fig, ch);
    return { scene: scene, choreo: ch, fig: fig };
  }

  global.Scenes = { soccer: soccer, basket: basket, guitar: guitar, hero: hero, wave: wave };
})(window);
