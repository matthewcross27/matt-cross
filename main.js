gsap.registerPlugin(ScrollTrigger);

const ACCENTS  = ['#6f8f5e', '#cf8542', '#7d5f86'];
const DOT_Y    = [9, 61, 113];
const SECTIONS = ['soccer', 'basket', 'guitar'];
const REDUCED  = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

document.addEventListener('DOMContentLoaded', () => {
  if (!REDUCED) {
    requestAnimationFrame(() => {
      document.querySelector('.hero').classList.add('is-loaded');
    });
  }
  init();
  document.fonts.ready.then(() => ScrollTrigger.refresh());
});

function init() {
  setupNavDot();
  if (REDUCED) {
    document.querySelectorAll('.project-card').forEach(el => { el.style.clipPath = 'none'; });
    document.querySelectorAll('.hero__eyebrow, .hero__h1, .hero__sub').forEach(el => { el.style.clipPath = 'none'; });
    document.querySelectorAll('.section__num, .section__title, .section__caption').forEach(el => { el.style.clipPath = 'none'; });
    document.querySelectorAll('.hero__char').forEach(el => {
      el.style.opacity = '1';
      el.style.transform = 'none';
    });
    document.querySelector('.hero').classList.add('is-loaded');
    return;
  }
  setupHeroEntrance();
  setupSoccer();
  setupBasket();
  setupGuitar();
  setupSectionReveal();
  setupProjectReveal();
}

function setupNavDot() {
  const dot = document.getElementById('nav-dot');
  SECTIONS.forEach((key, i) => {
    const activate = () => {
      dot.style.transform = `translateY(${DOT_Y[i]}px)`;
      dot.style.background = ACCENTS[i];
    };
    ScrollTrigger.create({
      trigger: `#sec-${key}`,
      start: 'top 55%',
      end: 'bottom 55%',
      onEnter: activate,
      onEnterBack: activate,
    });
  });
}

function setupHeroEntrance() {
  const chars = document.querySelectorAll('.hero__char');

  gsap.set(chars, { y: -55, opacity: 0 });

  // Shorter period (0.32) = snaps in fast (lighter feel).
  // Longer period (0.62) = slow oscillation, more bounce cycles (heavier feel).
  const periods = [0.48, 0.36, 0.58, 0.42, 0.32, 0.50, 0.62, 0.44, 0.38, 0.46];

  chars.forEach((char, i) => {
    const period = periods[i] ?? 0.44;
    gsap.to(char, {
      y: 0,
      opacity: 1,
      ease: `elastic.out(1, ${period})`,
      duration: 1.4,
      delay: 0.06 + i * 0.045,
    });
  });
}
// Each limb is a static translate anchor (the joint) wrapping a GSAP-rotated
// pivot at local (0,0), with the child limb's anchor nested inside that
// pivot. Nesting is what makes a child's rotation compose relative to its
// parent's *current* angle (shin relative to thigh, forearm relative to
// upper arm) - a real kinematic chain, not swapped full-body poses.
const KICK_POSES = {
  idle:    { torso: -92, armB_u: 100, armB_f: 12,  armF_u: 96,  armF_f: 10,  legP_t: 98,  legP_s: -8,  legP_f: -58, legK_t: 96,  legK_s: -6,  legK_f: -58 },
  windup:  { torso:-108, armB_u: 40,  armB_f:-20,  armF_u:130,  armF_f: 40,  legP_t:105,  legP_s:-14,  legP_f: -58, legK_t:150,  legK_s: 95,  legK_f: -20 },
  contact: { torso: -72, armB_u:110,  armB_f: 20,  armF_u: 60,  armF_f:-10,  legP_t:100,  legP_s:-18,  legP_f: -58, legK_t: 34,  legK_s: -6,  legK_f: -70 },
  follow:  { torso:-100, armB_u: 90,  armB_f: 15,  armF_u: 90,  armF_f: 10,  legP_t:100,  legP_s:-10,  legP_f: -58, legK_t:-25,  legK_s: 10,  legK_f: -40 },
};
// Scroll-fraction position of each named pose along the kick. Shared with
// the ball's CONTACT_T gate below (KICK_T.contact) so both stay in lockstep
// if the kick's timing is ever retuned.
const KICK_T = { idle: 0, windup: 0.10, contact: 0.14, follow: 0.20 };

// Captain review (follow-up 3): the kicker's joints previously animated via
// 3 chained GSAP tweens (idle->windup->contact->follow), each with its own
// ease. Values were already continuous (a tween always starts from the
// current value), but *velocity* wasn't - power3.in accelerates hard into
// the end of the contact tween, then power2.out restarts its own, much
// slower deceleration curve for follow, producing a real motion "kink"
// right at KICK_T.contact (measured: adjacent-sample jump of ~5.7deg per
// 0.0005 progress step, versus ~0 elsewhere). A clamped cubic Hermite
// spline through all 4 poses - the same "evaluate a continuous formula of
// the current scroll fraction" standard the ball's offset-path flight already
// meets - fixes this by construction: each interior knot's tangent is
// shared by both adjoining segments, so velocity matches on both sides of
// every pose, not just position. `knots` is `[{t, v}, ...]` sorted by t;
// endpoints are clamped to zero velocity (idle is a rest state, follow is
// held while the figure fades out, so both are physically at rest).
function hermiteSpline(knots) {
  const n = knots.length;
  const tangents = knots.map((k, i) => {
    if (i === 0 || i === n - 1) return 0;
    const prev = knots[i - 1], next = knots[i + 1];
    return (next.v - prev.v) / (next.t - prev.t);
  });
  return function (t) {
    if (t <= knots[0].t) return knots[0].v;
    if (t >= knots[n - 1].t) return knots[n - 1].v;
    let i = 0;
    while (i < n - 2 && t > knots[i + 1].t) i++;
    const t0 = knots[i].t, t1 = knots[i + 1].t;
    const v0 = knots[i].v, v1 = knots[i + 1].v;
    const m0 = tangents[i], m1 = tangents[i + 1];
    const dt = t1 - t0;
    const s = (t - t0) / dt;
    const s2 = s * s, s3 = s2 * s;
    const h00 = 2 * s3 - 3 * s2 + 1;
    const h10 = s3 - 2 * s2 + s;
    const h01 = -2 * s3 + 3 * s2;
    const h11 = s3 - s2;
    return h00 * v0 + h10 * dt * m0 + h01 * v1 + h11 * dt * m1;
  };
}

function buildKicker(svg, restPt) {
  const NS = 'http://www.w3.org/2000/svg';
  const rc = rough.svg(svg);
  const STROKE = { stroke: '#2b2b2b', roughness: 1.3, bowing: 0.7 };
  const LEN = { torso: 30, neck: 10, thigh: 24, shin: 22, foot: 11, upperArm: 15, forearm: 13 };
  const hip = { x: restPt.x - 30, y: restPt.y - 24 };

  const root = document.createElementNS(NS, 'g');
  root.setAttribute('class', 'kicker-figure');
  root.setAttribute('transform', 'translate(' + hip.x + ',' + hip.y + ')');
  svg.insertBefore(root, svg.querySelector('.shot-path'));

  function seg(parent, length, opts) {
    const pivot = document.createElementNS(NS, 'g');
    parent.appendChild(pivot);
    pivot.appendChild(rc.line(0, 0, length, 0, Object.assign({}, STROKE, opts)));
    return pivot;
  }
  function anchorAt(parent, x, y) {
    const a = document.createElementNS(NS, 'g');
    a.setAttribute('transform', 'translate(' + x + ',' + y + ')');
    parent.appendChild(a);
    return a;
  }
  function leg() {
    const thigh = seg(root, LEN.thigh, { strokeWidth: 2.6 });
    const shin = seg(anchorAt(thigh, LEN.thigh, 0), LEN.shin, { strokeWidth: 2.2 });
    const foot = seg(anchorAt(shin, LEN.shin, 0), LEN.foot, { strokeWidth: 1.9 });
    return { thigh: thigh, shin: shin, foot: foot };
  }
  function arm(shoulder) {
    const upper = seg(shoulder, LEN.upperArm, { strokeWidth: 1.9 });
    const fore = seg(anchorAt(upper, LEN.upperArm, 0), LEN.forearm, { strokeWidth: 1.7 });
    return { upper: upper, fore: fore };
  }

  const torso = seg(root, LEN.torso, { strokeWidth: 2.4 });
  const shoulder = anchorAt(torso, LEN.torso * 0.86, 0);
  const armBack = arm(shoulder);
  const armFront = arm(shoulder);
  const legPlant = leg();
  const legKick = leg();
  // Head anchored beyond the torso tip (torso length + a neck gap, not at
  // the tip itself) and appended after the shoulder/arms - previously it sat
  // almost exactly at the shoulder point and, being appended first, painted
  // *behind* the arms (SVG paints in document order). Captain review: head
  // must read as clearly above the shoulders/arms, at rest and through the
  // kick.
  const headAnchor = anchorAt(torso, LEN.torso + LEN.neck, 0);
  headAnchor.appendChild(rc.circle(0, 0, 17, Object.assign({}, STROKE, { fill: 'none', strokeWidth: 1.7 })));

  const jointEls = {
    torso: torso,
    armB_u: armBack.upper, armB_f: armBack.fore,
    armF_u: armFront.upper, armF_f: armFront.fore,
    legP_t: legPlant.thigh, legP_s: legPlant.shin, legP_f: legPlant.foot,
    legK_t: legKick.thigh, legK_s: legKick.shin, legK_f: legKick.foot,
  };
  const jointSplines = {};
  Object.keys(jointEls).forEach(function (k) {
    // Each pivot's rough.js line is drawn from local (0,0), so a CSS
    // transform-origin of '0 0' pins rotation (CSS `rotate` from the generated
    // keyframes, or `transform` from svgRotationDriver in the JS fallback) to
    // the actual joint rather than the SVG viewBox origin.
    jointEls[k].style.transformOrigin = '0 0';
    jointEls[k].classList.add('j-' + k);
    jointSplines[k] = hermiteSpline([
      { t: KICK_T.idle, v: KICK_POSES.idle[k] },
      { t: KICK_T.windup, v: KICK_POSES.windup[k] },
      { t: KICK_T.contact, v: KICK_POSES.contact[k] },
      { t: KICK_T.follow, v: KICK_POSES.follow[k] },
    ]);
  });

  return { root: root, jointEls: jointEls, jointSplines: jointSplines };
}

// Build the stylesheet that drives the whole soccer scroll-scrub off the
// native CSS scroll-driven timeline declared on .section--pinned (see
// style.css). Every value is a plain @keyframes bound to `--soc-tl`, so the
// compositor advances motion 1:1 with scroll offset - no ScrollTrigger scrub
// (a *numeric* scrub is a time-based catch-up smoother, not a 1:1 link: on a
// fast trackpad flick it renders up to ~15% of the timeline behind scroll and
// keeps animating 150-350ms after input stops, and its rendered per-frame
// velocity over/undershoots ~+-50% even on smooth input - the laggy-scroll /
// stop-motion-ball root cause, see AGENTS.md).
//
// The keyframes are generated (not hand-written) from the same KICK_POSES /
// hermiteSpline / KICK_T the kicker has always used, so:
//  - the ball / trail / shadow flight stays gated to KICK_T.contact (the
//    captain-review scroll fraction the kicker's contact pose resolves at) -
//    scrub to any earlier point and only the windup shows, never the ball;
//  - retiming KICK_POSES / KICK_T and regenerating reproduces the round-3
//    joint value+velocity continuity guarantee automatically (hermiteSpline
//    gives it by construction; sampling into ~48 keyframes/joint preserves it).
function buildSoccerScrubCSS(opts) {
  const jointSplines = opts.jointSplines;
  const pathLen = opts.pathLen;
  const offsetPath = opts.offsetPath;
  const FOLLOW_T = KICK_T.follow;
  const contactPct = +(CONTACT_T * 100).toFixed(3);
  const followPct = +(FOLLOW_T * 100).toFixed(3);
  const fadeEndPct = +((FOLLOW_T + 0.08) * 100).toFixed(3);
  const shadowEndPct = +(SHADOW_END_T * 100).toFixed(3);

  // Ball flight is eased out of rest (ballFlightEase) so a fast flick or the
  // keyframe sampling can't snap it onto the path in one frame (the ~25px
  // CONTACT_T pop). Sampled into keyframes here; the JS fallback evaluates the
  // same function directly.
  const BALL_STEPS = 40;
  let ballKf = '0%,' + contactPct + '%{offset-distance:0%}';
  let trailKf = '0%,' + contactPct + '%{stroke-dashoffset:' + pathLen.toFixed(2) + '}';
  for (let i = 1; i <= BALL_STEPS; i++) {
    const f = i / BALL_STEPS;
    const pct = ((CONTACT_T + f * (1 - CONTACT_T)) * 100).toFixed(3);
    const d = ballFlightEase(f);
    ballKf += pct + '%{offset-distance:' + (d * 100).toFixed(3) + '%}';
    trailKf += pct + '%{stroke-dashoffset:' + (pathLen * (1 - d)).toFixed(2) + '}';
  }

  const JOINT_STEPS = 48;
  let jointCss = '';
  Object.keys(jointSplines).forEach(function (k) {
    let frames = '';
    for (let i = 0; i <= JOINT_STEPS; i++) {
      const prog = (i / JOINT_STEPS) * FOLLOW_T;      // scroll fraction 0..FOLLOW_T
      frames += (prog * 100).toFixed(4) + '%{rotate:' + jointSplines[k](prog).toFixed(3) + 'deg}';
    }
    // Held flat from FOLLOW_T to the end of the scroll range.
    frames += '100%{rotate:' + jointSplines[k](FOLLOW_T).toFixed(3) + 'deg}';
    jointCss +=
      '@keyframes soc-j-' + k + '{' + frames + '}' +
      '.soccer-scene .j-' + k + '{rotate:' + KICK_POSES.idle[k].toFixed(3) + 'deg;' +
      'animation:soc-j-' + k + ' linear both;animation-timeline:--soc-tl;' +
      'animation-range:contain 0% contain 100%}';
  });

  const R = 'animation-timeline:--soc-tl;animation-range:contain 0% contain 100%';
  return [
    '@keyframes soc-ball{' + ballKf + '100%{offset-distance:100%}}',
    '@keyframes soc-trail{' + trailKf + '100%{stroke-dashoffset:0}}',
    '@keyframes soc-shadow{0%,' + contactPct + '%{opacity:1}' + shadowEndPct + '%,100%{opacity:.05}}',
    '@keyframes soc-crowd{from{translate:0 0}to{translate:-22px 0}}',
    '@keyframes soc-pitch{from{translate:0 0}to{translate:-8px 0}}',
    '@keyframes soc-kicker-fade{0%,' + followPct + '%{opacity:1}' + fadeEndPct + '%,100%{opacity:0}}',
    '.soccer-scene .ball-group{offset-path:path("' + offsetPath + '");offset-rotate:0deg;' +
      'offset-distance:0%;animation:soc-ball linear both;' + R + '}',
    '.soccer-scene .chalk-trail{animation:soc-trail linear both;' + R + '}',
    '.soccer-scene .ball-shadow{animation:soc-shadow linear both;' + R + '}',
    '.soccer-scene .layer-crowd{animation:soc-crowd linear both;' + R + '}',
    '.soccer-scene .layer-pitch{animation:soc-pitch linear both;' + R + '}',
    '.soccer-scene .kicker-figure{animation:soc-kicker-fade linear both;' + R + '}',
    jointCss,
  ].join('\n');
}

// GSAP always writes SVG <g>/<path> transforms via the `transform` *attribute*
// (confirmed directly against this GSAP version - unaffected by transformOrigin),
// which triggers Blink's SVG-specific layout invalidation on every write. That's
// cheap for a one-off tween but measurably costly for something transformed on
// every frame throughout a scroll (profiled while diagnosing scroll jank here -
// see AGENTS.md). Tweening a plain proxy object instead and applying the result
// through the element's CSS `transform` *style* keeps continuous per-frame
// position updates on the compositor-only transform path. The soccer happy path
// no longer needs this (its scrub is native CSS scroll-driven animation), but
// it stays for the JS fallback (setupSoccerFallback) and for basketball/guitar.
function svgTransformDriver(el) {
  const state = { x: 0, y: 0, scaleY: 1 };
  function apply() {
    el.style.transform = 'translate(' + state.x + 'px,' + state.y + 'px) scaleY(' + state.scaleY + ')';
  }
  apply();
  return { state: state, apply: apply };
}

// Same rationale as svgTransformDriver, for a single joint's rotation: each
// pivot is rotated every frame during the kick window, which otherwise hits the
// same SVG-attribute layout-invalidation path. Used by the JS fallback for the
// kicker figure (the happy path rotates the joints via generated CSS keyframes).
function svgRotationDriver(el, initialDeg) {
  const state = { rotation: initialDeg || 0 };
  el.style.transformOrigin = '0 0';
  function apply() {
    el.style.transform = 'rotate(' + state.rotation + 'deg)';
  }
  apply();
  return { state: state, apply: apply };
}

// Static hand-drawn scene, drawn exactly once. The sketch character comes from
// rough.js roughness/bowing on the elements themselves - no live SVG wobble
// filter (feTurbulence/feDisplacementMap on a scrub-driven or parallax group is
// a real per-frame GPU re-raster cost, see AGENTS.md) and no mid-scroll
// rough.js redraw (settleRedraw, removed: it regenerated a filtered group as a
// synchronous main-thread task at scroll fraction ~0.616, mid-arc).
function buildSoccerScene(svg) {
  const rc = rough.svg(svg);
  const geo = {
    W: 640, H: 400, groundY: 400 * 0.72,
    goalLeft: 640 * 0.86, goalRight: 640 * 0.97,
    goalTop: 400 * 0.38, goalBottom: 400 * 0.72,
  };
  geo.gW = geo.goalRight - geo.goalLeft;
  geo.gH = geo.goalBottom - geo.goalTop;

  function replace(className, node) {
    const host = svg.querySelector('.' + className);
    host.innerHTML = '';
    host.appendChild(node);
  }

  function drawCrowd() {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('opacity', '0.16');
    for (let x = -10; x < geo.W + 30; x += 34) {
      g.appendChild(rc.arc(x, 46, 22, 16, Math.PI, Math.PI * 2, false, {
        stroke: '#2b2b2b', strokeWidth: 1, roughness: 1.7,
      }));
    }
    replace('layer-crowd', g);
  }

  function drawPitch() {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.appendChild(rc.line(0, geo.groundY, geo.W, geo.groundY, {
      stroke: '#6f8f5e', strokeWidth: 1.7, roughness: 0.8,
    }));
    g.appendChild(rc.line(geo.goalLeft, geo.goalTop, geo.goalLeft, geo.goalBottom, {
      stroke: '#2b2b2b', strokeWidth: 2.6, roughness: 1.1, bowing: 0,
    }));
    g.appendChild(rc.line(geo.goalLeft, geo.goalTop, geo.goalRight, geo.goalTop, {
      stroke: '#2b2b2b', strokeWidth: 2.6, roughness: 1.1, bowing: 0,
    }));
    g.appendChild(rc.line(geo.goalRight, geo.goalTop, geo.goalRight, geo.goalBottom, {
      stroke: '#2b2b2b', strokeWidth: 2.2, roughness: 1.1, bowing: 0,
    }));
    const netOpts = { stroke: '#2b2b2b', strokeWidth: 0.9, roughness: 0.5 };
    for (let i = 1; i <= 2; i++) {
      g.appendChild(rc.line(geo.goalLeft, geo.goalTop + geo.gH * i / 3, geo.goalRight, geo.goalTop + geo.gH * i / 3, netOpts));
      g.appendChild(rc.line(geo.goalLeft + geo.gW * i / 3, geo.goalTop, geo.goalLeft + geo.gW * i / 3, geo.goalBottom, netOpts));
    }
    replace('layer-pitch', g);
  }

  drawCrowd();
  drawPitch();
}

function impactFlourish(svg, point, color) {
  const NS = 'http://www.w3.org/2000/svg';
  const layer = svg.querySelector('.layer-flourish');
  layer.innerHTML = '';
  const lines = [];
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const line = document.createElementNS(NS, 'line');
    const x1 = point.x + Math.cos(angle) * 5, y1 = point.y + Math.sin(angle) * 5;
    line.setAttribute('x1', x1); line.setAttribute('y1', y1);
    line.setAttribute('x2', x1); line.setAttribute('y2', y1);
    line.setAttribute('stroke', color);
    line.setAttribute('stroke-width', '1.5');
    line.setAttribute('stroke-linecap', 'round');
    line.setAttribute('opacity', '0');
    layer.appendChild(line);
    lines.push({ el: line, x2: point.x + Math.cos(angle) * 15, y2: point.y + Math.sin(angle) * 15 });
  }
  anime.animate(lines.map(l => l.el), {
    x2: (_, i) => lines[i].x2,
    y2: (_, i) => lines[i].y2,
    opacity: [0, 0.8, 0],
    duration: 420,
    delay: anime.stagger(12),
    ease: 'outCubic',
  });
}

function netPulse(pitchDrv) {
  gsap.fromTo(pitchDrv.state, { scaleY: 1 }, {
    scaleY: 0.965, duration: 0.1, yoyo: true, repeat: 1,
    ease: 'power1.inOut', onUpdate: pitchDrv.apply,
  });
}

// The scroll fraction the kicker's spline reaches its contact pose at (and, by
// construction, the point the generated ball/trail/shadow keyframes hold flat
// until). Single source, shared with the JS fallback.
const CONTACT_T = KICK_T.contact;
// Scroll fraction the ball shadow finishes fading at: the flight starts at
// CONTACT_T and the shadow fades over its first 75% (matches the pre-refactor
// GSAP tween's `duration: FLIGHT_D * 0.75`). Kept derived so a KICK_T retime
// carries it, like every other timing value in buildSoccerScrubCSS.
const SHADOW_END_T = CONTACT_T + (1 - CONTACT_T) * 0.75;

function setupSoccer() {
  const section = document.getElementById('sec-soccer');
  const svg     = section.querySelector('.soccer-scene');
  const pitch   = svg.querySelector('.layer-pitch');
  const path    = svg.querySelector('.shot-path');
  const trail   = svg.querySelector('.chalk-trail');
  const impactPoint = { x: 592, y: 178 };

  buildSoccerScene(svg);
  const len = path.getTotalLength();
  const restPt = path.getPointAtLength(0);
  trail.style.strokeDasharray = len;
  trail.style.strokeDashoffset = len;

  const kicker = buildKicker(svg, restPt);

  // Drive the whole scrub off a native CSS scroll-driven timeline: the
  // compositor advances every element 1:1 with scroll offset, no ScrollTrigger
  // scrub. Keyframes are generated from KICK_POSES / hermiteSpline / CONTACT_T
  // (see buildSoccerScrubCSS).
  const style = document.createElement('style');
  style.id = 'soccer-scrub-keyframes';
  style.textContent = buildSoccerScrubCSS({
    jointSplines: kicker.jointSplines,
    pathLen: len,
    offsetPath: path.getAttribute('d'),
  });
  document.head.appendChild(style);

  // netPulse uses the CSS `transform` property (scaleY); the parallax keyframes
  // use the independent `translate` property - no conflict.
  const pitchDrv = svgTransformDriver(pitch);
  pitch.style.transformBox = 'fill-box';
  pitch.style.transformOrigin = '92% 55%';

  const hasSDA = CSS.supports('animation-timeline', 'scroll()') &&
                 CSS.supports('view-timeline-name', '--x');
  if (!hasSDA) {
    setupSoccerFallback({ section: section, svg: svg, kicker: kicker, path: path, pathLen: len });
  }

  // A scrub-free progress watcher - no timeline attached to it, so it cannot
  // reintroduce catch-up lag - purely to fire the one-shot contact-moment
  // accents once at the end of the flight. Same trigger geometry as the CSS
  // view-timeline's `contain` range.
  let flourished = false;
  ScrollTrigger.create({
    trigger: section.querySelector('.section__anim'), start: 'top top',
    endTrigger: section, end: 'bottom bottom',
    onUpdate(self) {
      if (!flourished && self.progress > 0.97) {
        flourished = true;
        impactFlourish(svg, impactPoint, '#6f8f5e');
        netPulse(pitchDrv);
      }
      if (self.progress < 0.9) { flourished = false; }
    },
  });
}

// Ease the ball out of rest over the first `EASE_A` of its flight so a fast
// flick (or the CSS keyframe sampling) can't snap it onto the path in one
// frame. Quadratic ease-in, C1-continuous with the linear remainder, then
// renormalised so flight fraction 1 maps to path distance 1. Mirrors the
// ballEase in buildSoccerScrubCSS so the happy path and the fallback match.
const EASE_A = 0.035;
function ballFlightEase(f) {
  const norm = 1 - EASE_A / 2;
  return (f < EASE_A ? (f * f) / (2 * EASE_A) : f - EASE_A / 2) / norm;
}

// JS rAF 1:1 driver for engines without CSS scroll-driven animation (older
// Safari / Firefox). Not the primary path (Chromium composites the CSS
// timeline) - correctness insurance that keeps those engines smooth. Reads
// scroll position directly each frame (no smoothing), gated to on-screen by an
// IntersectionObserver so it never runs while the section is away.
function setupSoccerFallback(ctx) {
  const section = ctx.section;
  const svg = ctx.svg;
  const kicker = ctx.kicker;
  const path = ctx.path;
  const pathLen = ctx.pathLen;
  const ball = svg.querySelector('.ball-group');
  const trail = svg.querySelector('.chalk-trail');
  const shadow = svg.querySelector('.ball-shadow');
  const crowd = svg.querySelector('.layer-crowd');
  const pitch = svg.querySelector('.layer-pitch');

  // Hand every animated property to JS: neutralise the CSS scroll-driven
  // animations (on an engine without support the shorthand's default 0s
  // duration would otherwise snap each element to its end state) and any base
  // rotate / offset-path so only the JS writes take effect.
  [ball, trail, shadow, crowd, pitch, kicker.root].forEach((el) => { el.style.animation = 'none'; });
  ball.style.offsetPath = 'none';
  ball.style.willChange = 'transform';

  const ballDrv = svgTransformDriver(ball);
  ballDrv.state.x = path.getPointAtLength(0).x;
  ballDrv.state.y = path.getPointAtLength(0).y;
  ballDrv.apply();

  const jointKeys = Object.keys(kicker.jointEls);
  const jointDrv = {};
  jointKeys.forEach((k) => {
    kicker.jointEls[k].style.animation = 'none';
    kicker.jointEls[k].style.rotate = '0deg';       // CSS-property rotation off; transform owns it
    kicker.jointEls[k].style.willChange = 'transform';
    jointDrv[k] = svgRotationDriver(kicker.jointEls[k], KICK_POSES.idle[k]);
  });

  const FOLLOW_T = KICK_T.follow;
  const FLIGHT_D = 1 - CONTACT_T;

  let running = false;
  function tick() {
    const r = section.getBoundingClientRect();
    const total = r.height - window.innerHeight;
    const p = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 0;   // 1:1, no smoothing

    // Margin past FOLLOW_T so a fast frame that overshoots still lands the
    // joints on the follow pose before the figure is fully faded (opacity 0 at
    // FOLLOW_T + 0.08); beyond that it's invisible so freezing is fine.
    if (p < FOLLOW_T + 0.09) {
      const kp = Math.min(p, FOLLOW_T);
      jointKeys.forEach((k) => {
        jointDrv[k].state.rotation = kicker.jointSplines[k](kp);
        jointDrv[k].apply();
      });
    }
    kicker.root.style.opacity = p > FOLLOW_T
      ? String(Math.max(0, 1 - (p - FOLLOW_T) / 0.08))
      : '1';

    const f = Math.min(1, Math.max(0, (p - CONTACT_T) / FLIGHT_D));
    const d = ballFlightEase(f);
    const pt = path.getPointAtLength(d * pathLen);
    ballDrv.state.x = pt.x;
    ballDrv.state.y = pt.y;
    ballDrv.apply();
    trail.style.strokeDashoffset = pathLen * (1 - d);
    const sf = Math.max(0, Math.min(1, (p - CONTACT_T) / (SHADOW_END_T - CONTACT_T)));
    shadow.style.opacity = String(1 - 0.95 * sf);
    crowd.style.translate = (-22 * p) + 'px 0';
    pitch.style.translate = (-8 * p) + 'px 0';

    if (running) { requestAnimationFrame(tick); }
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting && !running) { running = true; requestAnimationFrame(tick); }
      else if (!e.isIntersecting) { running = false; }
    });
  });
  io.observe(section);
}

function setupBasket() {
  const section = document.getElementById('sec-basket');
  const canvas  = section.querySelector('canvas.anim-canvas');
  const ball    = document.getElementById('bball');
  const shadow  = document.getElementById('bball-shadow');

  const dpr = window.devicePixelRatio || 1;
  canvas.width  = canvas.clientWidth  * dpr;
  canvas.height = canvas.clientHeight * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const W = canvas.clientWidth;
  const H = canvas.clientHeight;

  const rc = rough.canvas(canvas);

  const groundY    = H * 0.72;
  const hoopRight  = W * 0.96;
  const rimCenterX = W * 0.80;
  const rimCenterY = H * 0.30;
  const rimW       = W * 0.08;

  rc.line(0, groundY, W, groundY, { stroke: '#cf8542', strokeWidth: 1.5, roughness: 0.7 });
  rc.line(hoopRight, H * 0.10, hoopRight, H * 0.42, { stroke: '#2b2b2b', strokeWidth: 2.5, roughness: 0.9, bowing: 0 });
  rc.rectangle(hoopRight - W * 0.04, H * 0.14, W * 0.033, H * 0.065, { stroke: '#2b2b2b', strokeWidth: 1.2, roughness: 0.8, fill: 'none' });
  rc.line(hoopRight - W * 0.02, rimCenterY, rimCenterX + rimW / 2, rimCenterY, { stroke: '#2b2b2b', strokeWidth: 2.5, roughness: 0.8, bowing: 0 });
  rc.ellipse(rimCenterX, rimCenterY, rimW, rimW * 0.32, { stroke: '#2b2b2b', strokeWidth: 2.5, roughness: 1.0 });
  const netBase = rimCenterY + H * 0.09;
  const netOpts = { stroke: '#2b2b2b', strokeWidth: 0.9, roughness: 0.7 };
  for (let i = 0; i <= 4; i++) {
    const fromX = (rimCenterX - rimW / 2) + (rimW / 4) * i;
    const drape = i === 2 ? 0 : i < 2 ? -3 : 3;
    rc.line(fromX, rimCenterY + 4, fromX + drape, netBase, netOpts);
  }
  rc.line(rimCenterX - rimW / 2 + 3, rimCenterY + H * 0.040, rimCenterX + rimW / 2 - 3, rimCenterY + H * 0.040, netOpts);
  rc.line(rimCenterX - rimW / 2 + 6, rimCenterY + H * 0.065, rimCenterX + rimW / 2 - 6, rimCenterY + H * 0.065, netOpts);

  // Ball CSS: top:calc(72%-34px), left:8% — center at (W*0.08+17, H*0.72-17)
  // Drop-in starts above section; GSAP y:0 lands at CSS position.
  gsap.set(ball,   { y: -H * 0.65, opacity: 0, x: 0, scale: 1, rotation: 0 });
  gsap.set(shadow, { scaleX: 0.3, opacity: 0 });

  let ready    = false;
  let shooting = false;

  section.style.cursor = 'crosshair';

  function dropIn() {
    if (ready || shooting) return;
    gsap.to(ball, {
      y: 0, opacity: 1,
      ease: 'bounce.out', duration: 0.9,
      onComplete: () => {
        ready = true;
        gsap.set(shadow, { scaleX: 0.3, opacity: 0.18 });
      },
    });
  }

  function dropBack() {
    ready = false; shooting = false;
    gsap.killTweensOf(ball);
    gsap.set(ball,   { x: 0, y: -H * 0.65, scale: 1, opacity: 0, rotation: 0 });
    gsap.set(shadow, { scaleX: 0.3, opacity: 0 });
  }

  ScrollTrigger.create({
    trigger: section, start: 'top 70%',
    onEnter: dropIn, onLeaveBack: dropBack,
  });

  section.addEventListener('click', () => {
    if (!ready || shooting) return;
    shooting = true;
    ready = false;
    section.querySelector('.section__hint')?.classList.add('is-hidden');

    gsap.set(shadow, { opacity: 0 });

    // Ball center at rest: (W*0.08+17, H*0.72-17). Hoop: (W*0.80, H*0.30).
    const destX = rimCenterX - (W * 0.08 + 17);
    const destY = rimCenterY - (H * 0.72 - 17);
    const peakY = destY - H * 0.22;

    const tl = gsap.timeline({
      onComplete() {
        gsap.to(ball, {
          scale: 0.45, opacity: 0, duration: 0.22,
          onComplete() {
            setTimeout(() => {
              gsap.set(ball,   { x: 0, y: -H * 0.65, scale: 1, opacity: 0, rotation: 0 });
              gsap.set(shadow, { scaleX: 0.3, opacity: 0 });
              shooting = false;
              dropIn();
            }, 400);
          },
        });
      },
    });
    tl.to(ball, { x: destX,      ease: 'power1.inOut', duration: 0.65 }, 0);
    tl.to(ball, { y: peakY,      ease: 'power2.out',   duration: 0.30 }, 0);
    tl.to(ball, { y: destY,      ease: 'power2.in',    duration: 0.35 }, 0.30);
    tl.to(ball, { rotation: 360, ease: 'none',         duration: 0.65 }, 0);
  });
}

function setupGuitar() {
  const section   = document.getElementById('sec-guitar');
  const canvas    = section.querySelector('canvas.anim-canvas');
  const stringsEl = section.querySelector('.guitar-strings');

  const dpr = window.devicePixelRatio || 1;
  canvas.width  = canvas.clientWidth  * dpr;
  canvas.height = canvas.clientHeight * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const W = canvas.clientWidth;
  const H = canvas.clientHeight;

  const rc = rough.canvas(canvas);

  const bridgeW = W * 0.10;
  rc.rectangle(W / 2 - bridgeW / 2, H * 0.925, bridgeW, H * 0.022, {
    stroke: '#7d5f86', strokeWidth: 1.2, roughness: 1.4,
    fill: 'rgba(125, 95, 134, 0.06)', fillStyle: 'solid',
  });
  rc.rectangle(W * 0.01, H * 0.68, W * 0.005, H * 0.25, {
    stroke: '#7d5f86', strokeWidth: 1.0, roughness: 1.3,
    fill: 'rgba(125, 95, 134, 0.08)', fillStyle: 'solid',
  });
  [0.22, 0.42, 0.60].forEach(pct => {
    rc.circle(W * pct, H * 0.815, 9, {
      stroke: '#7d5f86', strokeWidth: 1.0, roughness: 1.0,
      fill: 'rgba(125, 95, 134, 0.10)', fillStyle: 'solid',
    });
  });

  const strings = [
    { id: 'gstr-1', y: 30,  amp: 20, noteId: '#gnote-1' },
    { id: 'gstr-2', y: 66,  amp: 26, noteId: '#gnote-2' },
    { id: 'gstr-3', y: 102, amp: 32, noteId: '#gnote-3' },
    { id: 'gstr-4', y: 138, amp: 24, noteId: null },
    { id: 'gstr-5', y: 170, amp: 16, noteId: null },
  ];

  const cooldowns = {};

  function pluck(s) {
    if (cooldowns[s.id]) return;
    cooldowns[s.id] = true;

    const el  = document.getElementById(s.id);
    const { y, amp } = s;
    const flat    = `M 0 ${y} C 333 ${y}             667 ${y}             1000 ${y}`;
    const peak    = `M 0 ${y} C 333 ${y - amp}       667 ${y + amp}       1000 ${y}`;
    const rebound = `M 0 ${y} C 333 ${y + amp * 0.4} 667 ${y - amp * 0.4} 1000 ${y}`;
    const settle  = `M 0 ${y} C 333 ${y - amp * 0.1} 667 ${y + amp * 0.1} 1000 ${y}`;

    const tl = gsap.timeline();
    tl.to(el, { attr: { d: peak    }, ease: 'power3.out',   duration: 0.08 });
    tl.to(el, { attr: { d: rebound }, ease: 'power3.inOut', duration: 0.12 });
    tl.to(el, { attr: { d: settle  }, ease: 'power3.inOut', duration: 0.10 });
    tl.to(el, { attr: { d: flat    }, ease: 'power3.in',    duration: 0.14 });

    if (s.noteId) {
      gsap.fromTo(s.noteId,
        { opacity: 0, y: 0 },
        { opacity: 0.65, y: -80, ease: 'power1.out', duration: 0.5 },
      );
      gsap.to(s.noteId, { opacity: 0, duration: 0.25, delay: 0.35 });
    }

    setTimeout(() => { cooldowns[s.id] = false; }, 350);
  }

  let lastSvgY = null;
  let hinted   = false;

  function onCursorY(svgY) {
    if (lastSvgY === null) { lastSvgY = svgY; return; }
    strings.forEach(s => {
      if ((lastSvgY < s.y && svgY >= s.y) || (lastSvgY > s.y && svgY <= s.y)) {
        pluck(s);
        if (!hinted) {
          hinted = true;
          section.querySelector('.section__hint')?.classList.add('is-hidden');
        }
      }
    });
    lastSvgY = svgY;
  }

  stringsEl.addEventListener('mousemove', e => {
    const rect = stringsEl.getBoundingClientRect();
    onCursorY(((e.clientY - rect.top) / rect.height) * 200);
  });
  stringsEl.addEventListener('mouseleave', () => { lastSvgY = null; });

  stringsEl.addEventListener('touchmove', e => {
    e.preventDefault();
    const rect  = stringsEl.getBoundingClientRect();
    const touch = e.touches[0];
    onCursorY(((touch.clientY - rect.top) / rect.height) * 200);
  }, { passive: false });
  stringsEl.addEventListener('touchend', () => { lastSvgY = null; });
}

function setupSectionReveal() {
  ['sec-soccer', 'sec-basket', 'sec-guitar'].forEach(id => {
    const section = document.getElementById(id);
    const els = section.querySelectorAll('.section__num, .section__title, .section__caption');
    ScrollTrigger.create({
      trigger: section,
      start: 'top 75%',
      once: true,
      onEnter() {
        gsap.to(els, { clipPath: 'inset(0 0 0% 0)', ease: 'power2.out', duration: 0.5, stagger: 0.08 });
      },
    });
  });
}

function setupProjectReveal() {
  const cards = document.querySelectorAll('.project-card');
  ScrollTrigger.create({
    trigger: '.projects',
    start: 'top 65%',
    once: true,
    onEnter() {
      gsap.to(cards, { clipPath: 'inset(0 0 0% 0)', ease: 'power3.out', duration: 0.65, stagger: 0.07 });
    },
  });
}
