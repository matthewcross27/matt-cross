/* ============================================================================
 * scrub-vignette.js - shared machinery for the decorative scroll-scrub sections
 * ----------------------------------------------------------------------------
 * Everything here is section-agnostic. setupSoccer(), setupBasket() and
 * setupHero() in main.js all compose these helpers; the per-section code stays
 * thin (draw a scene, define a pose set + a projectile path, list a few parallax
 * tracks). The stick-figure rig (buildStickFigure) is shared by all three - two
 * scroll-scrub figures and the hero's scroll-free looping wave.
 *
 * The go-forward pattern for a decorative scroll section is:
 *   1. a native CSS scroll-driven timeline declared on .section--pinned
 *      (view-timeline in style.css) - the compositor advances every element
 *      1:1 with scroll offset, structurally immune to ScrollTrigger scrub lag;
 *   2. @keyframes generated here from hermiteSpline / pose data and bound to
 *      that timeline (buildScrubStylesheet);
 *   3. pinnedScrubFallback() - a JS rAF 1:1 driver for engines without
 *      CSS-scroll-driven-animation support, driving the identical motion.
 *
 * Exposed as one global, window.ScrubVignette. No build step.
 *
 * Contents:
 *   hermiteSpline(knots)              value+velocity-continuous cubic spline
 *   easeOutOfRest(easeA)              ease-a-value-out-of-rest factory
 *   worldPose(w) / FIGURE_JOINTS      pose authoring helpers
 *   buildStickFigure(svg, opts)       the humanoid joint chain + forward kinematics
 *   buildScrubStylesheet(cfg)         pose/path data -> @keyframes bound to a view-timeline
 *   buildLoopStylesheet(cfg)          same pose splines -> @keyframes played linear infinite
 *                                     (the scroll-free idle path, e.g. the hero wave)
 *   pinnedScrubFallback(cfg)          the rAF 1:1 fallback loop
 *   figureJointsChannel / offsetPathChannel / dashChannel / translateChannel /
 *     fadeChannel / styleChannel      fallback channel factories
 *   svgTransformDriver / svgRotationDriver   proxy-tween helpers for one-shots
 *   supportsScrollDrivenAnimation()
 * ==========================================================================*/

(function () {
'use strict';

var NS = 'http://www.w3.org/2000/svg';
var DEG = Math.PI / 180;

/* ---- pure math: clamped cubic Hermite spline through every knot ------------
 * `knots` is `[{t, v}, ...]` sorted by t. Returns a function of scroll
 * fraction that evaluates a clamped cubic Hermite spline with matched value
 * AND velocity at every interior knot (each interior tangent is shared by both
 * adjoining segments, so the rendered motion has no velocity "kink" at a
 * pose - the stop-motion fix, see AGENTS.md). Endpoints are clamped to zero
 * velocity (a first/last pose is a rest state). Sampling this into ~48
 * @keyframes preserves the guarantee. */
function hermiteSpline(knots) {
  var n = knots.length;
  var tangents = knots.map(function (k, i) {
    if (i === 0 || i === n - 1) return 0;
    var prev = knots[i - 1], next = knots[i + 1];
    return (next.v - prev.v) / (next.t - prev.t);
  });
  return function (t) {
    if (t <= knots[0].t) return knots[0].v;
    if (t >= knots[n - 1].t) return knots[n - 1].v;
    var i = 0;
    while (i < n - 2 && t > knots[i + 1].t) i++;
    var t0 = knots[i].t, t1 = knots[i + 1].t;
    var v0 = knots[i].v, v1 = knots[i + 1].v;
    var m0 = tangents[i], m1 = tangents[i + 1];
    var dt = t1 - t0;
    var s = (t - t0) / dt;
    var s2 = s * s, s3 = s2 * s;
    var h00 = 2 * s3 - 3 * s2 + 1;
    var h10 = s3 - 2 * s2 + s;
    var h01 = -2 * s3 + 3 * s2;
    var h11 = s3 - s2;
    return h00 * v0 + h10 * dt * m0 + h01 * v1 + h11 * dt * m1;
  };
}

/* Ease a value out of rest over the first `easeA` of its travel so a fast
 * flick (or the keyframe sampling) can't snap it in one frame. Quadratic
 * ease-in, C1-continuous with the linear remainder, renormalised so f=1 -> 1.
 * The happy path samples this into keyframes; the fallback evaluates it live -
 * pass the same instance to both so they match. */
function easeOutOfRest(easeA) {
  easeA = easeA || 0.035;
  var norm = 1 - easeA / 2;
  return function (f) {
    return (f < easeA ? (f * f) / (2 * easeA) : f - easeA / 2) / norm;
  };
}

/* ---- the humanoid joint chain -------------------------------------------
 * 11 pivots, neutral names. Each limb is a static translate anchor (the joint)
 * wrapping a rotated pivot at local (0,0), with the child limb's anchor nested
 * inside that pivot - nesting is what makes a child's rotation compose
 * relative to its parent's current angle (a real kinematic chain). */
var FIGURE_JOINTS = [
  'torso',
  'arm1_u', 'arm1_f', 'arm2_u', 'arm2_f',
  'leg1_t', 'leg1_s', 'leg1_f', 'leg2_t', 'leg2_s', 'leg2_f',
];

var FIGURE_LENGTHS = {
  torso: 30, neck: 10, thigh: 24, shin: 22, foot: 11,
  upperArm: 15, forearm: 13, head: 17,
};

/* Author poses in WORLD angles (0 = +x / toward the target, -90 = straight up,
 * 90 = straight down) and convert once with this - far easier to reason about
 * than nested parent-relative angles. `w` has the 11 FIGURE_JOINTS keys; the
 * torso and both thighs are absolute, everything else is relative to its
 * parent. buildStickFigure() takes the converted (parent-relative) form. */
function worldPose(w) {
  return {
    torso: w.torso,
    arm1_u: w.arm1_u - w.torso, arm1_f: w.arm1_f - w.arm1_u,
    arm2_u: w.arm2_u - w.torso, arm2_f: w.arm2_f - w.arm2_u,
    leg1_t: w.leg1_t, leg1_s: w.leg1_s - w.leg1_t, leg1_f: w.leg1_f - w.leg1_s,
    leg2_t: w.leg2_t, leg2_s: w.leg2_s - w.leg2_t, leg2_f: w.leg2_f - w.leg2_s,
  };
}

/* buildStickFigure(svg, {
 *   anchor:        {x, y}                 hip position in the scene viewBox
 *   poses:         { name: {joint: deg} } >=2 named poses, parent-relative
 *   times:         { name: scrollFrac }   when each pose lands (0..1)
 *   lengths?:      partial FIGURE_LENGTHS override
 *   stroke?:       rough.js stroke opts   ({stroke, roughness, bowing})
 *   rootClass?:    string                 default 'figure-root'
 *   insertBefore?: node                   paint-order anchor
 *   rootTranslate?: (t) => [dx, dy]       px offset of the whole figure vs
 *                                         scroll fraction (a jump arc); needed
 *                                         for fk() to be scene-accurate
 * }) -> {
 *   root, jointEls, jointSplines, idlePose,
 *   fk(t) -> forward-kinematics joint points in scene viewBox coords
 * }
 */
function buildStickFigure(svg, opts) {
  var rc = rough.svg(svg);
  var L = Object.assign({}, FIGURE_LENGTHS, opts.lengths || {});
  var STROKE = Object.assign(
    { stroke: '#2b2b2b', roughness: 1.3, bowing: 0.7 }, opts.stroke || {});
  var rootTranslate = opts.rootTranslate || function () { return [0, 0]; };
  var legW = opts.legWidths || [2.6, 2.2, 1.9];   // thigh / shin / foot stroke
  var armW = opts.armWidths || [1.9, 1.7];        // upper / fore stroke

  var poseNames = Object.keys(opts.times).sort(function (a, b) {
    return opts.times[a] - opts.times[b];
  });

  var root = document.createElementNS(NS, 'g');
  root.setAttribute('class', opts.rootClass || 'figure-root');
  root.setAttribute('transform', 'translate(' + opts.anchor.x + ',' + opts.anchor.y + ')');
  if (opts.insertBefore) svg.insertBefore(root, opts.insertBefore);
  else svg.appendChild(root);

  function seg(parent, length, width) {
    var pivot = document.createElementNS(NS, 'g');
    parent.appendChild(pivot);
    pivot.appendChild(rc.line(0, 0, length, 0, Object.assign({}, STROKE, { strokeWidth: width })));
    return pivot;
  }
  function anchorAt(parent, x, y) {
    var a = document.createElementNS(NS, 'g');
    a.setAttribute('transform', 'translate(' + x + ',' + y + ')');
    parent.appendChild(a);
    return a;
  }
  function limb3(w0, w1, w2) {
    var a = seg(root, L.thigh, w0);
    var b = seg(anchorAt(a, L.thigh, 0), L.shin, w1);
    var c = seg(anchorAt(b, L.shin, 0), L.foot, w2);
    return [a, b, c];
  }
  function arm(shoulder) {
    var u = seg(shoulder, L.upperArm, armW[0]);
    var f = seg(anchorAt(u, L.upperArm, 0), L.forearm, armW[1]);
    return [u, f];
  }

  var torso = seg(root, L.torso, 2.4);
  var shoulder = anchorAt(torso, L.torso * 0.86, 0);
  var a1 = arm(shoulder);
  var a2 = arm(shoulder);
  var l1 = limb3(legW[0], legW[1], legW[2]);
  var l2 = limb3(legW[0], legW[1], legW[2]);
  // Head after the arms in document order so it paints above them, and beyond
  // the torso tip by a neck gap (a captain-review fix from the soccer kicker).
  var head = anchorAt(torso, L.torso + L.neck, 0);
  head.appendChild(rc.circle(0, 0, L.head, Object.assign({}, STROKE, { fill: 'none', strokeWidth: 1.7 })));

  var jointEls = {
    torso: torso,
    arm1_u: a1[0], arm1_f: a1[1], arm2_u: a2[0], arm2_f: a2[1],
    leg1_t: l1[0], leg1_s: l1[1], leg1_f: l1[2],
    leg2_t: l2[0], leg2_s: l2[1], leg2_f: l2[2],
  };
  var jointSplines = {};
  FIGURE_JOINTS.forEach(function (k) {
    // The pivot's line is drawn from local (0,0), so transform-origin '0 0'
    // pins rotation (CSS `rotate` from the keyframes, or `transform` from the
    // fallback channel) to the actual joint, not the SVG viewBox origin.
    jointEls[k].style.transformOrigin = '0 0';
    jointEls[k].classList.add('j-' + k);
    jointSplines[k] = hermiteSpline(poseNames.map(function (p) {
      return { t: opts.times[p], v: opts.poses[p][k] };
    }));
  });

  // Forward kinematics: where each joint sits in scene viewBox coords at
  // scroll fraction t. The pre-release projectile position is read straight
  // off this so the ball tracks the actual hand transform, not a hand-authored
  // approximation that can drift (captain refinement, basketball).
  function fk(t) {
    var rt = rootTranslate(t);
    var hip = { x: opts.anchor.x + rt[0], y: opts.anchor.y + rt[1] };
    var aTorso = jointSplines.torso(t) * DEG;
    var shoulderPt = {
      x: hip.x + Math.cos(aTorso) * L.torso * 0.86,
      y: hip.y + Math.sin(aTorso) * L.torso * 0.86,
    };
    var headPt = {
      x: hip.x + Math.cos(aTorso) * (L.torso + L.neck),
      y: hip.y + Math.sin(aTorso) * (L.torso + L.neck),
    };
    function armChain(uKey, fKey) {
      var aU = aTorso + jointSplines[uKey](t) * DEG;
      var elbow = {
        x: shoulderPt.x + Math.cos(aU) * L.upperArm,
        y: shoulderPt.y + Math.sin(aU) * L.upperArm,
      };
      var aF = aU + jointSplines[fKey](t) * DEG;
      var hand = {
        x: elbow.x + Math.cos(aF) * L.forearm,
        y: elbow.y + Math.sin(aF) * L.forearm,
      };
      return { elbow: elbow, hand: hand };
    }
    function legChain(tKey, sKey, fKey) {
      var aTh = jointSplines[tKey](t) * DEG;
      var knee = {
        x: hip.x + Math.cos(aTh) * L.thigh,
        y: hip.y + Math.sin(aTh) * L.thigh,
      };
      var aSh = aTh + jointSplines[sKey](t) * DEG;
      var ankle = {
        x: knee.x + Math.cos(aSh) * L.shin,
        y: knee.y + Math.sin(aSh) * L.shin,
      };
      var aFt = aSh + jointSplines[fKey](t) * DEG;
      var toe = {
        x: ankle.x + Math.cos(aFt) * L.foot,
        y: ankle.y + Math.sin(aFt) * L.foot,
      };
      return { knee: knee, ankle: ankle, toe: toe };
    }
    var arm1 = armChain('arm1_u', 'arm1_f');
    var arm2 = armChain('arm2_u', 'arm2_f');
    return {
      hip: hip, shoulder: shoulderPt, head: headPt,
      arm1: arm1, arm2: arm2, hand1: arm1.hand, hand2: arm2.hand,
      leg1: legChain('leg1_t', 'leg1_s', 'leg1_f'),
      leg2: legChain('leg2_t', 'leg2_s', 'leg2_f'),
    };
  }

  return {
    root: root, jointEls: jointEls, jointSplines: jointSplines,
    idlePose: opts.poses[poseNames[0]], fk: fk,
  };
}

/* ---- buildScrubStylesheet(cfg) : pose/path data -> stylesheet text ---------
 * cfg = {
 *   ns:        'soccer'              keyframe-name namespace
 *   timeline:  '--soccer-tl'         the view-timeline name
 *   scene:     '.soccer-scene'       selector every rule is scoped under
 *   range?:    'contain 0% contain 100%'
 *   figure?:   { jointSplines, idlePose, endT, steps=48 }
 *   ball?:     { selector, offsetPath, releaseT, ease, steps=40 }
 *   trail?:    { selector, length, releaseT, ease, steps=40 }
 *   carry?:    { selector, translateFn:(t)=>[dx,dy], untilT, steps=44 }
 *              a translate track on a wrapper <g> that holds the projectile to
 *              the figure until `untilT`, then holds its end value. translateFn
 *              is (hand(t) - releasePoint), so translateFn(untilT) ~= [0, 0]
 *              and the ball hands off onto offset-distance 0% with no jump.
 *   tracks?:   [ Track ]             one @keyframes + one rule each:
 *                { selector, property, keyframes: [[pct, value], ...] }
 *                { selector, property, spline: fn, from?, to, steps? }
 *                { selector, property:'opacity', fade: { holdUntilT, endT } }
 * }
 */
function buildScrubStylesheet(cfg) {
  var TL = cfg.timeline;
  var RANGE = cfg.range || 'contain 0% contain 100%';
  var BIND = 'animation-timeline:' + TL + ';animation-range:' + RANGE;
  var scene = cfg.scene;
  var ns = cfg.ns;
  var kf = [];      // @keyframes blocks
  var rules = [];   // the binding rules

  // `animation` shorthand resets animation-timeline to auto, so the timeline +
  // range longhands must come after it.
  function rule(selector, name, extra) {
    return selector + '{' + (extra || '') + 'animation:' + name + ' linear both;' + BIND + '}';
  }

  // --- ball: waits at offset-distance 0% until releaseT, then eases along the
  //     path. Pre-release position (if any) is supplied by the carry wrapper. ---
  if (cfg.ball) {
    var b = cfg.ball;
    var bEase = b.ease || easeOutOfRest();
    var bSteps = b.steps || 40;
    var relPct = +(+b.releaseT * 100).toFixed(3);
    var ballKf = '0%,' + relPct + '%{offset-distance:0%}';
    for (var bi = 1; bi <= bSteps; bi++) {
      var bf = bi / bSteps;
      var bpct = ((b.releaseT + bf * (1 - b.releaseT)) * 100).toFixed(3);
      ballKf += bpct + '%{offset-distance:' + (bEase(bf) * 100).toFixed(3) + '%}';
    }
    kf.push('@keyframes ' + ns + '-ball{' + ballKf + '100%{offset-distance:100%}}');
    rules.push(rule(scene + ' ' + b.selector, ns + '-ball',
      'offset-path:path("' + b.offsetPath + '");offset-rotate:0deg;offset-distance:0%;'));
  }

  // --- trail: stroke-dashoffset unwinds in lockstep with the ball's flight ---
  if (cfg.trail) {
    var t = cfg.trail;
    var tEase = t.ease || easeOutOfRest();
    var tSteps = t.steps || 40;
    var tRelPct = +(+t.releaseT * 100).toFixed(3);
    var trailKf = '0%,' + tRelPct + '%{stroke-dashoffset:' + t.length.toFixed(2) + '}';
    for (var ti = 1; ti <= tSteps; ti++) {
      var tf = ti / tSteps;
      var tpct = ((t.releaseT + tf * (1 - t.releaseT)) * 100).toFixed(3);
      trailKf += tpct + '%{stroke-dashoffset:' + (t.length * (1 - tEase(tf))).toFixed(2) + '}';
    }
    kf.push('@keyframes ' + ns + '-trail{' + trailKf + '100%{stroke-dashoffset:0}}');
    rules.push(rule(scene + ' ' + t.selector, ns + '-trail'));
  }

  // --- carry: the wrapper <g> that keeps the projectile locked to the hand ---
  if (cfg.carry) {
    var c = cfg.carry;
    var cSteps = c.steps || 44;
    var carryKf = '';
    for (var ci = 0; ci <= cSteps; ci++) {
      var cprog = (ci / cSteps) * c.untilT;
      var cv = c.translateFn(cprog);
      carryKf += (cprog * 100).toFixed(4) + '%{translate:' + cv[0].toFixed(2) + 'px ' + cv[1].toFixed(2) + 'px}';
    }
    var cEnd = c.translateFn(c.untilT);
    carryKf += '100%{translate:' + cEnd[0].toFixed(2) + 'px ' + cEnd[1].toFixed(2) + 'px}';
    kf.push('@keyframes ' + ns + '-carry{' + carryKf + '}');
    rules.push(rule(scene + ' ' + c.selector, ns + '-carry'));
  }

  // --- generic tracks ---------------------------------------------------------
  (cfg.tracks || []).forEach(function (tr, idx) {
    var name = ns + '-t' + idx;
    var frames = '';
    if (tr.keyframes) {
      // Collapse runs of identical values into `p1%,p2%{...}` - keeps the
      // output compact and matches hand-written @keyframes.
      for (var ki = 0; ki < tr.keyframes.length; ) {
        var val = tr.keyframes[ki][1];
        var stops = [tr.keyframes[ki][0]];
        while (ki + stops.length < tr.keyframes.length &&
               tr.keyframes[ki + stops.length][1] === val) {
          stops.push(tr.keyframes[ki + stops.length][0]);
        }
        frames += stops.map(function (s) { return s + '%'; }).join(',') +
          '{' + tr.property + ':' + val + '}';
        ki += stops.length;
      }
    } else if (tr.spline) {
      var sSteps = tr.steps || 40;
      var from = tr.from || 0;
      for (var si = 0; si <= sSteps; si++) {
        var sprog = from + (si / sSteps) * (tr.to - from);
        frames += (sprog * 100).toFixed(3) + '%{' + tr.property + ':' + tr.spline(sprog) + '}';
      }
      frames += '100%{' + tr.property + ':' + tr.spline(tr.to) + '}';
    } else if (tr.fade) {
      var hp = +(+tr.fade.holdUntilT * 100).toFixed(3);
      var ep = +(+tr.fade.endT * 100).toFixed(3);
      frames = '0%,' + hp + '%{opacity:1}' + ep + '%,100%{opacity:0}';
    }
    kf.push('@keyframes ' + name + '{' + frames + '}');
    rules.push(rule(scene + ' ' + tr.selector, name));
  });

  // --- figure joints: one rotate spline per joint, sampled, then held flat.
  //     Emitted last (keyframe + rule interleaved) - matches the pre-module
  //     soccer stylesheet layout. ---
  if (cfg.figure) {
    var fig = cfg.figure;
    var jSteps = fig.steps || 48;
    FIGURE_JOINTS.forEach(function (k) {
      var jframes = '';
      for (var i = 0; i <= jSteps; i++) {
        var prog = (i / jSteps) * fig.endT;
        jframes += (prog * 100).toFixed(4) + '%{rotate:' + fig.jointSplines[k](prog).toFixed(3) + 'deg}';
      }
      jframes += '100%{rotate:' + fig.jointSplines[k](fig.endT).toFixed(3) + 'deg}';
      kf.push('@keyframes ' + ns + '-j-' + k + '{' + jframes + '}');
      rules.push(scene + ' .j-' + k + '{rotate:' + (+fig.idlePose[k]).toFixed(3) + 'deg;' +
        'animation:' + ns + '-j-' + k + ' linear both;' + BIND + '}');
    });
  }

  return kf.concat(rules).join('\n');
}

/* ---- buildLoopStylesheet(cfg) : the same rig, driven by a wall clock ------
 * The scrub path binds generated @keyframes to a view-timeline so the compositor
 * advances them 1:1 with scroll. A decorative idle (the hero figure's wave) is
 * the same shape minus the scroll: bake the identical hermite pose splines into
 * @keyframes, then play them `linear infinite` over a fixed period. No
 * view-timeline, no rAF, no main-thread work per frame - the compositor loops
 * the transform track on its own.
 *
 * For a seamless loop the first and last authored pose must be identical (the
 * spline then has matched value AND zero velocity at 0% / 100%, so the wrap has
 * no jump and no kink - same guarantee hermiteSpline gives every interior knot).
 *
 * cfg = {
 *   ns:       'hero'                  keyframe-name namespace
 *   scene:    '.hero__figure'         selector every rule is scoped under
 *   period:   '4600ms'               one loop's duration
 *   figure?:  { jointSplines, idlePose?, steps=64 }
 *   tracks?:  [ { selector, property, spline:(prog)=>value, steps=48 } ]
 *             prog runs 0..1 over one period; spline(0) must equal spline(1).
 * }
 */
function buildLoopStylesheet(cfg) {
  var ns = cfg.ns;
  var scene = cfg.scene;
  var period = cfg.period || '4600ms';
  var play = ' ' + period + ' linear infinite';
  var kf = [];
  var rules = [];

  (cfg.tracks || []).forEach(function (tr, idx) {
    var name = ns + '-loop-t' + idx;
    var steps = tr.steps || 48;
    var frames = '';
    for (var i = 0; i <= steps; i++) {
      var prog = i / steps;
      frames += (prog * 100).toFixed(3) + '%{' + tr.property + ':' + tr.spline(prog) + '}';
    }
    kf.push('@keyframes ' + name + '{' + frames + '}');
    rules.push(scene + ' ' + tr.selector + '{animation:' + name + play + '}');
  });

  if (cfg.figure) {
    var fig = cfg.figure;
    var jSteps = fig.steps || 64;
    FIGURE_JOINTS.forEach(function (k) {
      var jframes = '';
      for (var i = 0; i <= jSteps; i++) {
        var prog = i / jSteps;
        jframes += (prog * 100).toFixed(4) + '%{rotate:' + fig.jointSplines[k](prog).toFixed(3) + 'deg}';
      }
      kf.push('@keyframes ' + ns + '-loop-j-' + k + '{' + jframes + '}');
      rules.push(scene + ' .j-' + k + '{' +
        (fig.idlePose ? 'rotate:' + (+fig.idlePose[k]).toFixed(3) + 'deg;' : '') +
        'animation:' + ns + '-loop-j-' + k + play + '}');
    });
  }

  return kf.concat(rules).join('\n');
}

/* ---- pinnedScrubFallback(cfg) : the JS rAF 1:1 driver --------------------
 * For engines without CSS scroll-driven animation (older Safari / Firefox).
 * Reads scroll position directly each frame (no smoothing), gated on-screen by
 * an IntersectionObserver. The loop scaffolding lives here once; the caller
 * passes channels (use the factories below, or a bare (p) => void).
 *
 * cfg = { section, channels: [ { setup?(), update(p) } | (p)=>void ] }
 */
function pinnedScrubFallback(cfg) {
  var channels = cfg.channels.map(function (c) {
    return typeof c === 'function' ? { update: c } : c;
  });
  channels.forEach(function (c) { if (c.setup) c.setup(); });

  var running = false;
  function tick() {
    var r = cfg.section.getBoundingClientRect();
    var total = r.height - window.innerHeight;
    var p = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 0;
    channels.forEach(function (c) { c.update(p); });
    if (running) requestAnimationFrame(tick);
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting && !running) { running = true; requestAnimationFrame(tick); }
      else if (!e.isIntersecting) { running = false; }
    });
  });
  io.observe(cfg.section);
}

/* Channel factories - each neutralises its element's inert CSS animation in
 * setup() and writes only compositor-friendly properties in update(). */
function figureJointsChannel(jointEls, jointSplines, endT) {
  return {
    setup: function () {
      FIGURE_JOINTS.forEach(function (k) {
        jointEls[k].style.animation = 'none';
        jointEls[k].style.rotate = '0deg';           // CSS `rotate` off; transform owns it
        jointEls[k].style.willChange = 'transform';
        jointEls[k].style.transformOrigin = '0 0';
      });
    },
    update: function (p) {
      var kp = Math.min(p, endT);
      FIGURE_JOINTS.forEach(function (k) {
        jointEls[k].style.transform = 'rotate(' + jointSplines[k](kp) + 'deg)';
      });
    },
  };
}
function offsetPathChannel(ballEl, pathEl, pathLen, ease, releaseT) {
  var flightD = 1 - releaseT;
  return {
    setup: function () {
      ballEl.style.animation = 'none';
      ballEl.style.offsetPath = 'none';
      ballEl.style.willChange = 'transform';
    },
    update: function (p) {
      var f = p <= releaseT ? 0 : Math.min(1, (p - releaseT) / flightD);
      var pt = pathEl.getPointAtLength(ease(f) * pathLen);
      ballEl.style.transform = 'translate(' + pt.x + 'px,' + pt.y + 'px)';
    },
  };
}
function dashChannel(trailEl, length, ease, releaseT) {
  var flightD = 1 - releaseT;
  return {
    setup: function () { trailEl.style.animation = 'none'; },
    update: function (p) {
      var f = Math.min(1, Math.max(0, (p - releaseT) / flightD));
      trailEl.style.strokeDashoffset = length * (1 - ease(f));
    },
  };
}
function translateChannel(el, fn) {                    // fn: p -> "Xpx Ypx"
  return {
    setup: function () { el.style.animation = 'none'; },
    update: function (p) { el.style.translate = fn(p); },
  };
}
function fadeChannel(el, holdUntilT, endT) {
  return {
    setup: function () { el.style.animation = 'none'; },
    update: function (p) {
      el.style.opacity = p <= holdUntilT ? '1'
        : String(Math.max(0, 1 - (p - holdUntilT) / (endT - holdUntilT)));
    },
  };
}
function styleChannel(el, prop, fn) {                  // fn: p -> value string
  return {
    setup: function () { el.style.animation = 'none'; },
    update: function (p) { el.style[prop] = fn(p); },
  };
}

/* ---- proxy-tween helpers for one-shot accents --------------------------
 * GSAP writes SVG <g>/<path> transforms via the `transform` *attribute*, which
 * triggers Blink's SVG layout invalidation on every write - fine for a one-off
 * tween, costly per-frame across a scroll range. These tween a plain proxy
 * object and apply via the CSS `transform` *style* instead. The scroll-scrub
 * happy path sidesteps this entirely (CSS keyframes); kept for the one-shot
 * net reactions and for basketball/guitar. */
function svgTransformDriver(el) {
  var state = { x: 0, y: 0, scaleY: 1 };
  function apply() {
    el.style.transform = 'translate(' + state.x + 'px,' + state.y + 'px) scaleY(' + state.scaleY + ')';
  }
  apply();
  return { state: state, apply: apply };
}
function svgRotationDriver(el, initialDeg) {
  var state = { rotation: initialDeg || 0 };
  el.style.transformOrigin = '0 0';
  function apply() { el.style.transform = 'rotate(' + state.rotation + 'deg)'; }
  apply();
  return { state: state, apply: apply };
}

function supportsScrollDrivenAnimation() {
  return CSS.supports('animation-timeline', 'scroll()') &&
         CSS.supports('view-timeline-name', '--x');
}

window.ScrubVignette = {
  hermiteSpline: hermiteSpline,
  easeOutOfRest: easeOutOfRest,
  worldPose: worldPose,
  FIGURE_JOINTS: FIGURE_JOINTS,
  FIGURE_LENGTHS: FIGURE_LENGTHS,
  buildStickFigure: buildStickFigure,
  buildScrubStylesheet: buildScrubStylesheet,
  buildLoopStylesheet: buildLoopStylesheet,
  pinnedScrubFallback: pinnedScrubFallback,
  figureJointsChannel: figureJointsChannel,
  offsetPathChannel: offsetPathChannel,
  dashChannel: dashChannel,
  translateChannel: translateChannel,
  fadeChannel: fadeChannel,
  styleChannel: styleChannel,
  svgTransformDriver: svgTransformDriver,
  svgRotationDriver: svgRotationDriver,
  supportsScrollDrivenAnimation: supportsScrollDrivenAnimation,
};
})();
