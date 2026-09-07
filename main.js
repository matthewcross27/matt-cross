gsap.registerPlugin(ScrollTrigger);

const SV = window.ScrubVignette;

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
    // Hero figure renders in a still resting pose (no loop, no rAF). Soccer
    // stays title + caption only in reduced motion (its scene is never built).
    // Basketball and guitar each draw a single static frame - each has a natural
    // resting composition (ball in the net; a guitarist stood playing) that
    // reads without motion.
    setupHero();
    setupBasket();
    setupGuitar();
    return;
  }
  setupHeroEntrance();
  setupHero();
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

/* ============================================================================
 * Hero - a front-facing looping "hello" wave on the shared stick-figure rig
 * ----------------------------------------------------------------------------
 * Same rig as the soccer + basketball figures (SV.buildStickFigure), so the
 * landing-page character reads as the same person - here seen head-on: two eyes
 * + a smile (opts.face), a symmetric stance, and a raised waving arm that gets a
 * wrist joint (opts.hands) for follow-through. It is NOT scroll-driven: the
 * hermite pose splines are baked into @keyframes by SV.buildLoopStylesheet and
 * played `linear infinite` over HERO_PERIOD - the compositor loops the joint
 * rotate tracks, no rAF, no per-frame JS.
 *
 * The wave is a side-to-side swing of the raised hand: the upper arm (arm2_u)
 * holds up while the forearm (arm2_f) swings left<->right across an arc and the
 * hand (arm2_h) trails a beat behind it (overlap / follow-through). The other
 * arm (arm1) just hangs at the side; a ~1.5deg torso sway reads as breathing.
 * First and last pose (rest / rest2) are identical so the loop wraps clean.
 *
 * Poses are WORLD angles (0 = +x / viewer's right, -90 = straight up), converted
 * with worldPose. arm2 (drawn 2nd) is the waving arm on the viewer's right;
 * armsOverHead paints both arms above the head so the hand can cross the face.
 * ==========================================================================*/
// Everything except the torso sway and the waving arm (arm2_*) is constant
// across the loop - authored once here and spread into every pose.
const HERO_REST = {
  torso: -90,
  arm1_u: 125, arm1_f: 118, arm1_h: 110,   // resting arm, swung clear of the torso
  arm2_u:  55, arm2_f:  62, arm2_h:  70,    // waving arm, down (rest only)
  leg1_t: 100, leg1_s: 99, leg1_f: 122,     // symmetric stance, slight splay
  leg2_t:  80, leg2_s: 81, leg2_f:  58,
};
const HERO_POSES = {
  rest:  HERO_REST,
  lift:  { ...HERO_REST, torso: -89.5, arm2_u: -48, arm2_f:  -66, arm2_h: -44 },
  waveA: { ...HERO_REST, torso: -88.5, arm2_u: -44, arm2_f:  -40, arm2_h: -58 },
  waveB: { ...HERO_REST, torso: -89,   arm2_u: -50, arm2_f: -100, arm2_h: -80 },
  waveC: { ...HERO_REST, torso: -88.5, arm2_u: -44, arm2_f:  -44, arm2_h: -60 },
  waveD: { ...HERO_REST, torso: -89,   arm2_u: -50, arm2_f:  -96, arm2_h: -78 },
  drop:  { ...HERO_REST, torso: -89.5, arm2_u:  34, arm2_f:   52, arm2_h:  30 },
  rest2: HERO_REST,
};
// rest at 0 and rest2 at 1 are identical, with a still hold at each end of the
// cycle (0 -> 0.12 and 0.86 -> 1) so the loop seam sits inside a quiet beat.
const HERO_T = { rest: 0, lift: 0.12, waveA: 0.27, waveB: 0.42, waveC: 0.57, waveD: 0.72, drop: 0.86, rest2: 1 };
const HERO_PERIOD = '4600ms';
const HERO_LENGTHS = { neck: 12, torso: 34, thigh: 27, shin: 25, foot: 12, upperArm: 17, forearm: 16, hand: 7, head: 18 };

function setupHero() {
  const svg = document.querySelector('.hero__figure');
  if (!svg) return;

  const poses = {};
  Object.keys(HERO_POSES).forEach(k => { poses[k] = SV.worldPose(HERO_POSES[k]); });

  const figure = SV.buildStickFigure(svg, {
    anchor: { x: 60, y: 92 },
    lengths: HERO_LENGTHS,
    legWidths: [2.9, 2.4, 2.0],
    armWidths: [2.1, 1.9, 1.7],
    poses,
    times: HERO_T,
    stroke: { roughness: 0.75, bowing: 0.35 },
    rootClass: 'hero-figure',
    hands: true,
    face: true,
    armsOverHead: true,
  });

  // Reduced motion: freeze on a static mid-wave "hand up" hold - front-facing,
  // no loop stylesheet, no rAF.
  if (REDUCED) {
    figure.joints.forEach(k => {
      figure.jointEls[k].style.rotate = figure.jointSplines[k](HERO_T.waveA).toFixed(3) + 'deg';
    });
    return;
  }

  const style = document.createElement('style');
  style.id = 'hero-idle-keyframes';
  style.textContent = SV.buildLoopStylesheet({
    ns: 'hero',
    scene: '.hero__figure',
    period: HERO_PERIOD,
    figure: { jointSplines: figure.jointSplines, joints: figure.joints, idlePose: figure.idlePose, steps: 72 },
  });
  document.head.appendChild(style);
}

/* ============================================================================
 * Soccer - decorative scroll-scrub (a figure kicks a ball into the goal)
 * ----------------------------------------------------------------------------
 * One of two sections built on the shared scrub-vignette.js module. The kicker
 * is a stick figure; the ball waits on the ground until the foot arrives
 * (SOCCER_RELEASE_T) then eases along an offset-path into the goal; the pitch
 * group squashes once on the make.
 *
 * Poses are parent-relative angles (not world-authored - the historical soccer
 * numbers, kept as-is; only the joint keys were renamed to the neutral scheme).
 * ==========================================================================*/
const SOCCER_POSES = {
  idle:    { torso: -92, arm1_u: 100, arm1_f: 12,  arm2_u: 96,  arm2_f: 10,  leg1_t: 98,  leg1_s: -8,  leg1_f: -58, leg2_t: 96,  leg2_s: -6,  leg2_f: -58 },
  windup:  { torso:-108, arm1_u: 40,  arm1_f:-20,  arm2_u:130,  arm2_f: 40,  leg1_t:105,  leg1_s:-14,  leg1_f: -58, leg2_t:150,  leg2_s: 95,  leg2_f: -20 },
  contact: { torso: -72, arm1_u:110,  arm1_f: 20,  arm2_u: 60,  arm2_f:-10,  leg1_t:100,  leg1_s:-18,  leg1_f: -58, leg2_t: 34,  leg2_s: -6,  leg2_f: -70 },
  follow:  { torso:-100, arm1_u: 90,  arm1_f: 15,  arm2_u: 90,  arm2_f: 10,  leg1_t:100,  leg1_s:-10,  leg1_f: -58, leg2_t:-25,  leg2_s: 10,  leg2_f: -40 },
};
// Scroll-fraction position of each pose. SOCCER_RELEASE_T (= contact) gates the
// ball: scrub to any earlier point and only the wind-up shows, never the ball.
const SOCCER_T = { idle: 0, windup: 0.10, contact: 0.14, follow: 0.20 };
const SOCCER_RELEASE_T   = SOCCER_T.contact;
// Shadow fades over the first 75% of the flight (matches the pre-module tween's
// duration). Derived so a SOCCER_T retime carries it, like every other value.
const SOCCER_SHADOW_END_T = SOCCER_RELEASE_T + (1 - SOCCER_RELEASE_T) * 0.75;

// Static hand-drawn scene, drawn exactly once. The sketch character comes from
// rough.js roughness/bowing on the elements - no live SVG wobble filter (a real
// per-frame GPU re-raster cost on a scrub, see AGENTS.md) and no mid-scroll
// rough.js redraw.
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

  const figure = SV.buildStickFigure(svg, {
    anchor: { x: restPt.x - 30, y: restPt.y - 24 },
    poses: SOCCER_POSES,
    times: SOCCER_T,
    rootClass: 'kicker-figure',
    insertBefore: path,
  });

  const flightEase = SV.easeOutOfRest(0.035);
  const shadowEndPct = +(SOCCER_SHADOW_END_T * 100).toFixed(3);
  const releasePct   = +(SOCCER_RELEASE_T * 100).toFixed(3);

  const style = document.createElement('style');
  style.id = 'soccer-scrub-keyframes';
  style.textContent = SV.buildScrubStylesheet({
    ns: 'soccer',
    timeline: '--soccer-tl',
    scene: '.soccer-scene',
    figure: { jointSplines: figure.jointSplines, idlePose: figure.idlePose, endT: SOCCER_T.follow },
    ball:  { selector: '.ball-group', offsetPath: path.getAttribute('d'), releaseT: SOCCER_RELEASE_T, ease: flightEase },
    trail: { selector: '.chalk-trail', length: len, releaseT: SOCCER_RELEASE_T, ease: flightEase },
    tracks: [
      { selector: '.ball-shadow', property: 'opacity', keyframes: [
        [0, '1'], [releasePct, '1'], [shadowEndPct, '.05'], [100, '.05'] ] },
      { selector: '.layer-crowd', property: 'translate', keyframes: [[0, '0 0'], [100, '-22px 0']] },
      { selector: '.layer-pitch', property: 'translate', keyframes: [[0, '0 0'], [100, '-8px 0']] },
      { selector: '.kicker-figure', property: 'opacity', fade: { holdUntilT: SOCCER_T.follow, endT: SOCCER_T.follow + 0.08 } },
    ],
  });
  document.head.appendChild(style);

  // netPulse uses the CSS `transform` property (scaleY); the parallax keyframes
  // use the independent `translate` property - no conflict.
  const pitchDrv = SV.svgTransformDriver(pitch);
  pitch.style.transformBox = 'fill-box';
  pitch.style.transformOrigin = '92% 55%';

  svg.dataset.driver = SV.supportsScrollDrivenAnimation() ? 'native' : 'fallback';
  if (svg.dataset.driver === 'fallback') {
    SV.pinnedScrubFallback({
      section,
      channels: [
        SV.figureJointsChannel(figure.jointEls, figure.jointSplines, SOCCER_T.follow),
        SV.offsetPathChannel(svg.querySelector('.ball-group'), path, len, flightEase, SOCCER_RELEASE_T),
        SV.dashChannel(trail, len, flightEase, SOCCER_RELEASE_T),
        SV.styleChannel(svg.querySelector('.ball-shadow'), 'opacity', p => {
          const sf = Math.max(0, Math.min(1, (p - SOCCER_RELEASE_T) / (SOCCER_SHADOW_END_T - SOCCER_RELEASE_T)));
          return String(1 - 0.95 * sf);
        }),
        SV.translateChannel(svg.querySelector('.layer-crowd'), p => (-22 * p) + 'px 0'),
        SV.translateChannel(pitch, p => (-8 * p) + 'px 0'),
        SV.fadeChannel(figure.root, SOCCER_T.follow, SOCCER_T.follow + 0.08),
      ],
    });
  }

  // A scrub-free progress watcher - no timeline attached, so it cannot
  // reintroduce catch-up lag - purely to fire the one-shot contact accents once
  // at the end of the flight.
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

/* ============================================================================
 * Basketball - decorative scroll-scrub (a figure rises for a jump shot)
 * ----------------------------------------------------------------------------
 * The second section on the shared module. Choreography:
 *   stand -> gather (deep dip) -> rise -> drive/release -> follow-through -> land -> watch
 * The whole figure leaves the ground on a jump arc baked from two hermite
 * splines (BASKET_JX / BASKET_JY, a translate track on .figure-root). Through
 * stand -> gather -> rise the ball is locked to the shooting hand: the
 * .ball-carry wrapper carries a translate of (hand(t) - releasePoint) read
 * straight off the figure's forward kinematics, and the inner .ball-group sits
 * at offset-distance 0% (the first point of the arc = the release point). At
 * BASKET_RELEASE_T the carry translate is exactly [0,0], so the ball hands off
 * onto the offset-path with no positional jump and arcs into the rim; the net
 * drape sways once on the make.
 *
 * Poses are authored in WORLD angles (0 = toward the hoop, -90 = straight up)
 * and converted with SV.worldPose().
 * ==========================================================================*/
// WORLD angles: 0 = toward the hoop (right), -90 = straight up, +90 = straight
// down. leg1 = front leg, leg2 = trail leg. Legs keep a visible knee bend
// through the jump so the figure reads as a body, not a pole.
// arm1 = shooting arm (its hand is the release point, see figure.fk below).
// Through `rise -> apex` it DRIVES up and forward toward the hoop - the elbow
// straightens and the wrist snaps over ("goose-neck" follow-through), so the arm
// is still extending as the ball leaves at BASKET_RELEASE_T and keeps reaching
// after. arm2 = guide / off hand: it holds its raised attitude from `rise`
// through `land` (well past BASKET_RELEASE_T) and only lowers on the way to
// `watch` - a real jump shot, not a hand that just opens at the top.
const BASKET_POSES = {
  stand:  { torso: -85, arm1_u: 60,  arm1_f: 22,  arm2_u: 72,  arm2_f: 28,  leg1_t: 83,  leg1_s: 92,  leg1_f: 6,   leg2_t: 97,  leg2_s: 89,  leg2_f: 6 },
  gather: { torso: -66, arm1_u: 76,  arm1_f: 44,  arm2_u: 90,  arm2_f: 48,  leg1_t: 70,  leg1_s: 116, leg1_f: 20,  leg2_t: 62,  leg2_s: 120, leg2_f: 18 },
  rise:   { torso: -86, arm1_u: -6,  arm1_f: -66, arm2_u: -4,  arm2_f: -48, leg1_t: 84,  leg1_s: 104, leg1_f: 52,  leg2_t: 92,  leg2_s: 108, leg2_f: 54 },
  apex:   { torso: -90, arm1_u: -52, arm1_f: -24, arm2_u: -22, arm2_f: 16,  leg1_t: 72,  leg1_s: 122, leg1_f: 60,  leg2_t: 104, leg2_s: 96,  leg2_f: 64 },
  land:   { torso: -82, arm1_u: -40, arm1_f: -14, arm2_u: -20, arm2_f: 18,  leg1_t: 66,  leg1_s: 118, leg1_f: 8,   leg2_t: 94,  leg2_s: 114, leg2_f: 12 },
  watch:  { torso: -89, arm1_u: -30, arm1_f: -26, arm2_u: 70,  arm2_f: 24,  leg1_t: 84,  leg1_s: 91,  leg1_f: 6,   leg2_t: 96,  leg2_s: 89,  leg2_f: 6 },
};
// Timing: the shot motion (gather -> rise -> apex) spans ~18% of the scroll so
// the arm drive has room to read; the figure settles by ~watch and then holds
// while the ball completes its flight. BASKET_RELEASE_T sits a touch before the
// `apex` pose so the body is still rising into the shot as the ball leaves - and
// it is the one constant every gated tween (ball, trail, carry, flourish) keys
// off, so retiming here carries them all.
const BASKET_T = { stand: 0, gather: 0.12, rise: 0.22, apex: 0.30, land: 0.44, watch: 0.56 };
// A touch before the `apex` pose: the shooting arm is still driving up-and-out
// and the body is still rising, so the ball leaves with the hand's own pace (no
// velocity step at the handoff) rather than trailing off it at the top.
const BASKET_RELEASE_T = 0.26;

// The jump arc: px offset of the whole figure vs scroll fraction (lift peaks at
// the apex/release, back on the ground by ~land).
const BASKET_JX = [
  { t: 0, v: 0 }, { t: 0.15, v: 0 }, { t: 0.30, v: 5 }, { t: 0.44, v: 11 }, { t: 1, v: 11 },
];
const BASKET_JY = [
  { t: 0, v: 0 }, { t: 0.12, v: 7 }, { t: 0.22, v: -16 }, { t: 0.30, v: -52 },
  { t: 0.38, v: -16 }, { t: 0.44, v: 3 }, { t: 0.52, v: 0 }, { t: 1, v: 0 },
];
// figure-shadow opacity vs timeline %: full at rest, faint while airborne
// (gather -> land), back once the feet are down. One source for the CSS track
// and the JS fallback so they can't drift.
const BASKET_SHADOW_KF = [[0, 0.30], [9, 0.30], [20, 0.10], [34, 0.10], [46, 0.30], [100, 0.30]];

function lerpKeyframes(kf, p) {
  const x = p * 100;
  if (x <= kf[0][0]) return kf[0][1];
  for (let i = 1; i < kf.length; i++) {
    if (x <= kf[i][0]) {
      const [x0, v0] = kf[i - 1], [x1, v1] = kf[i];
      return v0 + (v1 - v0) * (x - x0) / (x1 - x0);
    }
  }
  return kf[kf.length - 1][1];
}

function buildBasketScene(svg) {
  const rc = rough.svg(svg);
  const NS = 'http://www.w3.org/2000/svg';
  const INK = '#2b2b2b';
  const BASKET = '#cf8542';
  const rim = { x: 545, y: 128, rx: 30 };
  const poleX = 622;
  const floorY = 300;

  function replace(className, node) {
    const host = svg.querySelector('.' + className);
    host.innerHTML = '';
    host.appendChild(node);
  }
  const g = () => document.createElementNS(NS, 'g');

  // Clerestory window band across the top (parallax-fast) - the crowd analogue.
  const crowd = g();
  crowd.setAttribute('opacity', '0.1');
  for (let x = 20; x < 660; x += 96) {
    crowd.appendChild(rc.rectangle(x, 12, 62, 34, { stroke: INK, strokeWidth: 0.8, roughness: 1.6, fill: 'none' }));
    crowd.appendChild(rc.line(x + 31, 12, x + 31, 46, { stroke: INK, strokeWidth: 0.4, roughness: 1.6 }));
  }
  replace('layer-crowd', crowd);

  // One flat floor line (parallax-slow) - the soccer pitch-line analogue,
  // kept deliberately minimal.
  const court = g();
  court.appendChild(rc.line(-40, floorY, 700, floorY, { stroke: BASKET, strokeWidth: 1.7, roughness: 0.8 }));
  replace('layer-court', court);

  // Front-3/4 hoop: bracket + pole, backboard, shooter's square, rim ellipse,
  // net drape (its own class so the make can sway it).
  const hoop = g();
  hoop.appendChild(rc.line(rim.x + rim.rx, rim.y - 6, poleX, rim.y - 16, { stroke: INK, strokeWidth: 2, roughness: 0.9, bowing: 0 }));
  hoop.appendChild(rc.line(poleX, rim.y - 22, poleX, floorY, { stroke: INK, strokeWidth: 2.4, roughness: 0.8, bowing: 0 }));
  hoop.appendChild(rc.rectangle(rim.x - 23, rim.y - 58, 46, 52, { stroke: INK, strokeWidth: 1.8, roughness: 0.9, bowing: 0.3, fill: 'none' }));
  hoop.appendChild(rc.rectangle(rim.x - 9, rim.y - 26, 18, 13, { stroke: INK, strokeWidth: 1.1, roughness: 1.0, fill: 'none' }));
  hoop.appendChild(rc.ellipse(rim.x, rim.y, rim.rx * 2, 9, { stroke: BASKET, strokeWidth: 2.6, roughness: 1.0 }));

  const net = g();
  net.setAttribute('class', 'net-drape');
  const rungs = 4, netH = 30;
  for (let i = 0; i <= rungs; i++) {
    const fromX = rim.x - rim.rx + (rim.rx * 2 / rungs) * i;
    const mid = (i - rungs / 2) / (rungs / 2);
    const toX = rim.x + mid * rim.rx * 0.42;
    net.appendChild(rc.line(fromX, rim.y + 3, toX, rim.y + netH, { stroke: INK, strokeWidth: 0.9, roughness: 0.8 }));
  }
  net.appendChild(rc.line(rim.x - rim.rx * 0.66, rim.y + 15, rim.x + rim.rx * 0.66, rim.y + 15, { stroke: INK, strokeWidth: 0.8, roughness: 0.9 }));
  hoop.appendChild(net);
  replace('layer-hoop', hoop);

  return { rim, floorY };
}

function setupBasket() {
  const section  = document.getElementById('sec-basket');
  const svg      = section.querySelector('.basket-scene');
  const path     = svg.querySelector('.shot-path');
  const trail    = svg.querySelector('.arc-trail');
  const carry    = svg.querySelector('.ball-carry');
  const ball     = svg.querySelector('.ball-group');
  const shadow   = svg.querySelector('.figure-shadow');

  const scene = buildBasketScene(svg);

  const jx = SV.hermiteSpline(BASKET_JX);
  const jy = SV.hermiteSpline(BASKET_JY);
  const rootTranslate = t => [jx(t), jy(t)];

  const poses = {};
  Object.keys(BASKET_POSES).forEach(k => { poses[k] = SV.worldPose(BASKET_POSES[k]); });

  const figure = SV.buildStickFigure(svg, {
    anchor: { x: 236, y: 236 },
    lengths: { neck: 13, torso: 32, thigh: 29, shin: 27, foot: 9, upperArm: 17, forearm: 15 },
    legWidths: [3.8, 3.2, 2.5],
    armWidths: [2.5, 2.2],
    poses,
    times: BASKET_T,
    stroke: { roughness: 1.1, bowing: 0.5 },
    rootClass: 'figure-root',
    insertBefore: path,
    rootTranslate,
  });

  // Release point = the actual shooting-hand transform at BASKET_RELEASE_T
  // (with the jump offset baked in via fk). The ball path starts here exactly.
  const rp  = figure.fk(BASKET_RELEASE_T).hand1;
  const rim = scene.rim;
  const netRest = { x: rim.x + 2, y: rim.y + 36 };

  // Flight arc. The ball leaves the way a real shot does: along the shooting
  // hand's own velocity at release (so the hand -> arc handoff has no kink),
  // carrying clearly forward toward the hoop before gravity bends it down. The
  // chalk trail stops at the rim; the ball path then drops through the net.
  const f1 = n => n.toFixed(1);
  const relStep = 0.006;
  const rpAhead = figure.fk(BASKET_RELEASE_T + relStep).hand1;
  const vRel = { x: (rpAhead.x - rp.x) / relStep, y: (rpAhead.y - rp.y) / relStep };
  const vRelLen = Math.hypot(vRel.x, vRel.y) || 1;
  const reach = Math.hypot(rim.x - rp.x, rim.y - rp.y);
  // c1: shove out along the release heading (~38% of the way to the rim reads as
  // a genuine push); c2: pull the arc over its peak and down into the rim.
  const c1 = {
    x: rp.x + (vRel.x / vRelLen) * reach * 0.38,
    y: rp.y + (vRel.y / vRelLen) * reach * 0.38,
  };
  const c2 = { x: rim.x - reach * 0.24, y: Math.min(rp.y, rim.y, c1.y) - 34 };
  const arcD =
    `M${f1(rp.x)},${f1(rp.y)} ` +
    `C ${f1(c1.x)},${f1(c1.y)} ${f1(c2.x)},${f1(c2.y)} ${f1(rim.x)},${f1(rim.y)}`;
  const ballD = arcD +
    ` C ${f1(rim.x + 11)},${f1(rim.y + 15)} ${f1(netRest.x + 3)},${f1(netRest.y - 10)} ${f1(netRest.x)},${f1(netRest.y)}`;

  path.setAttribute('d', ballD);
  trail.setAttribute('d', arcD);
  const trailLen = trail.getTotalLength();
  trail.style.strokeDasharray = trailLen;
  trail.style.strokeDashoffset = trailLen;

  shadow.setAttribute('cx', f1(figure.fk(0).hip.x + 4));
  shadow.setAttribute('cy', f1(scene.floorY + 2));

  // Ball leaves at the hand's release speed (not eased up from rest) so the
  // handoff has no velocity step. a = (hand speed) / (mean path speed), both in
  // viewBox units per unit scroll-fraction; easeLaunch clamps it to [1, 1.95].
  const flightEase = SV.easeLaunch(vRelLen / (path.getTotalLength() / (1 - BASKET_RELEASE_T)));
  // (hand(t) - releasePoint): the carry wrapper's translate. Clamped at
  // BASKET_RELEASE_T so it is exactly [0,0] at (and after) the handoff.
  const carryFn = t => {
    const h = figure.fk(Math.min(t, BASKET_RELEASE_T)).hand1;
    return [h.x - rp.x, h.y - rp.y];
  };

  const netDrape = svg.querySelector('.net-drape');
  netDrape.style.transformBox = 'fill-box';
  netDrape.style.transformOrigin = '50% 0';
  const netDrv = SV.svgTransformDriver(netDrape);

  // ---- reduced motion: one static "made shot" frame, no rAF, no scrub CSS ---
  if (REDUCED) {
    SV.FIGURE_JOINTS.forEach(k => {
      figure.jointEls[k].style.rotate = figure.jointSplines[k](BASKET_T.watch) + 'deg';
    });
    figure.root.style.translate = '0px 0px';
    ball.style.offsetPath = 'none';
    ball.style.transform = `translate(${f1(netRest.x)}px, ${f1(netRest.y)}px)`;
    shadow.style.opacity = '0.3';
    trail.style.strokeDashoffset = '0';
    trail.style.opacity = '0.26';
    return;
  }

  const releasePct = +(BASKET_RELEASE_T * 100).toFixed(3);
  const style = document.createElement('style');
  style.id = 'basket-scrub-keyframes';
  style.textContent = SV.buildScrubStylesheet({
    ns: 'basket',
    timeline: '--basket-tl',
    scene: '.basket-scene',
    figure: { jointSplines: figure.jointSplines, idlePose: figure.idlePose, endT: BASKET_T.watch },
    ball:  { selector: '.ball-group', offsetPath: ballD, releaseT: BASKET_RELEASE_T, ease: flightEase },
    trail: { selector: '.arc-trail', length: trailLen, releaseT: BASKET_RELEASE_T, ease: flightEase },
    carry: { selector: '.ball-carry', translateFn: carryFn, untilT: BASKET_RELEASE_T, steps: 80 },
    tracks: [
      { selector: '.figure-shadow', property: 'opacity',
        keyframes: BASKET_SHADOW_KF.map(([pct, v]) => [pct, String(v)]) },
      { selector: '.figure-root', property: 'translate',
        spline: p => `${jx(p).toFixed(2)}px ${jy(p).toFixed(2)}px`, from: 0, to: 1, steps: 52 },
      { selector: '.layer-court', property: 'translate', keyframes: [[0, '0 0'], [100, '-8px 0']] },
      { selector: '.layer-crowd', property: 'translate', keyframes: [[0, '0 0'], [100, '-24px 0']] },
    ],
  });
  document.head.appendChild(style);

  svg.dataset.driver = SV.supportsScrollDrivenAnimation() ? 'native' : 'fallback';
  if (svg.dataset.driver === 'fallback') {
    SV.pinnedScrubFallback({
      section,
      channels: [
        SV.figureJointsChannel(figure.jointEls, figure.jointSplines, BASKET_T.watch),
        SV.translateChannel(figure.root, p => `${jx(p).toFixed(2)}px ${jy(p).toFixed(2)}px`),
        SV.translateChannel(carry, p => {
          const c = carryFn(Math.min(p, BASKET_RELEASE_T));
          return `${c[0].toFixed(2)}px ${c[1].toFixed(2)}px`;
        }),
        SV.offsetPathChannel(ball, path, path.getTotalLength(), flightEase, BASKET_RELEASE_T),
        SV.dashChannel(trail, trailLen, flightEase, BASKET_RELEASE_T),
        SV.styleChannel(shadow, 'opacity', p => String(lerpKeyframes(BASKET_SHADOW_KF, p))),
        SV.translateChannel(svg.querySelector('.layer-court'), p => (-8 * p) + 'px 0'),
        SV.translateChannel(svg.querySelector('.layer-crowd'), p => (-24 * p) + 'px 0'),
      ],
    });
  }

  // Scrub-free one-shot accents: the ink flourish at the release point, and the
  // net drape sway when the ball reaches the rim. Same pattern as soccer's
  // netPulse - no timeline attached, so no catch-up lag.
  const makeP = BASKET_RELEASE_T + (1 - BASKET_RELEASE_T) * 0.9;
  let flourished = false, made = false;
  ScrollTrigger.create({
    trigger: section.querySelector('.section__anim'), start: 'top top',
    endTrigger: section, end: 'bottom bottom',
    onUpdate(self) {
      const p = self.progress;
      if (!flourished && p > BASKET_RELEASE_T) {
        flourished = true;
        impactFlourish(svg, rp, '#cf8542');
      }
      if (flourished && p < BASKET_RELEASE_T - 0.03) { flourished = false; }
      if (!made && p > makeP) { made = true; netSway(netDrv); }
      if (made && p < makeP - 0.03) { made = false; }
    },
  });
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

function netSway(netDrv) {
  gsap.fromTo(netDrv.state, { scaleY: 1 }, {
    scaleY: 1.13, duration: 0.11, yoyo: true, repeat: 1,
    ease: 'power1.inOut', onUpdate: netDrv.apply,
  });
}

/* ============================================================================
 * Guitar - decorative scroll-scrub (a guitarist crosses the frame, turns once)
 * ----------------------------------------------------------------------------
 * The third and last section on the shared scrub-vignette.js module - direction
 * B from the guitar-decorative scout. A stick-figure guitarist (the same rig as
 * soccer / basketball / the hero, here in profile with `hands` for the strum
 * follow-through) crosses the whole frame left -> right while a camera function
 * pans the room the opposite way to partly follow. At the mid-beat the player
 * plants and executes ONE dance-turn: a 2-D pivot (scaleX eased through 0 twice
 * = a 360), limbs tuck to hug the guitar, a small hop, a slight lean in and out.
 * Then the stride and strum resume and the player walks out of frame.
 *
 * Strict 1:1 native CSS scroll-driven animation (no numeric scrub, no wall-clock
 * loop) - the traverse (translate), the turn lean (rotate) and the pivot (scale)
 * are three independent-property tracks on .figure-root, emitted as one
 * comma-joined `animation:` rule by buildScrubStylesheet's per-selector track
 * collection. SV.pinnedScrubFallback drives the identical motion where CSS
 * scroll-driven animation is unsupported. Reduced motion: one static
 * "standing and playing" frame, no rAF, no scrub stylesheet (basketball's
 * pattern). Everything is scroll-linked; nothing moves when the section is
 * parked - including the drifting music notes.
 *
 * The walk / strum / turn-tuck are a PROCEDURAL joint-angle cycle (guitarPoseAt,
 * WORLD degrees) sampled into a dense pose set the rig's hermiteSpline path
 * consumes normally. Poses that read at rest are authored in GUITAR_REST.
 * ==========================================================================*/
const GUITAR_ANCHOR    = { x: 300, y: 246 };
const GUITAR_FLOOR_Y   = 300;
const GUITAR_LENGTHS   = { neck: 9, torso: 41, thigh: 32, shin: 30, foot: 12, upperArm: 19, forearm: 16, hand: 8, head: 16 };
const GUITAR_LEG_W     = [3.4, 2.9, 2.4];
const GUITAR_ARM_W     = [2.3, 2.0, 1.7];
const GUITAR_TORSO_LEAN = -83;
const GUITAR_GAIT      = { strides: 5.0, reach: 25, knee: 24, bob: 6, hip: 1.4 };
const GUITAR_STRUM     = { beats: 6.0 };
const GUITAR_PIVOT_AT  = 0.50;
const GUITAR_PIVOT_SPAN = 0.17;
const GUITAR_STEPS     = 96;
// full-width traverse: off-left -> off-right, eased, with a brief plant at the
// pivot so the turn reads as deliberate (not mid-stride).
const GUITAR_CROSS_KNOTS = [
  { t: 0, v: -430 }, { t: 0.16, v: -250 }, { t: 0.38, v: -70 },
  { t: 0.50, v: 0 }, { t: 0.62, v: 74 }, { t: 0.84, v: 300 }, { t: 1, v: 470 },
];
// a relaxed standing-and-playing world pose - the reduced-motion freeze frame.
const GUITAR_REST = {
  torso: -87,
  arm1_u: 52, arm1_f: 96, arm1_h: 100,
  arm2_u: -166, arm2_f: -184, arm2_h: -196,
  leg1_t: 84, leg1_s: 94, leg1_f: 4,
  leg2_t: 104, leg2_s: 90, leg2_f: 8,
};

// 0..1 across the turn window, ease-in-out (slow prep, quick spin, slow settle).
function guitarPivotU(p) {
  const s0 = GUITAR_PIVOT_AT - GUITAR_PIVOT_SPAN / 2;
  const s1 = GUITAR_PIVOT_AT + GUITAR_PIVOT_SPAN / 2;
  const raw = p <= s0 ? 0 : p >= s1 ? 1 : (p - s0) / (s1 - s0);
  return raw < 0.5 ? 2 * raw * raw : 1 - Math.pow(-2 * raw + 2, 2) / 2;
}

// Procedural motion cycle -> a joint->WORLD-deg object for a given scroll
// fraction. The player never settles in direction B (they walk clean across and
// out), so the gait envelope is a constant 1; the turn window pulls the limbs
// into a tight "hug the guitar" spot pose so the figure reads as a dancer
// turning, not a shape being squashed.
function guitarPoseAt(p) {
  const g = GUITAR_GAIT;
  const stride = 2 * Math.PI * (g.strides * p + 0.15);
  const swing  = Math.sin(stride);
  const swing2 = Math.sin(stride + Math.PI);
  const lift   = Math.max(0, Math.sin(stride * 2));
  const lift2  = Math.max(0, Math.sin(stride * 2 + Math.PI));
  const bob    = -Math.abs(Math.cos(stride)) * g.bob;

  const beat = 2 * Math.PI * (GUITAR_STRUM.beats * p);
  const strumPhase = Math.sin(beat);
  const strumFast  = Math.sin(beat * 2);

  const pose = {
    torso: GUITAR_TORSO_LEAN + strumPhase * 2.2 + swing * g.hip,
    // front strum arm: elbow over the lower bout, forearm + wrist sweep an arc
    // across the strings at the sound hole (down-stroke low, up-stroke high).
    arm1_u: 52 + strumPhase * 5,
    arm1_f: 96 + strumPhase * 24 + strumFast * 5,
    arm1_h: 100 + strumPhase * 18,
    // back fret arm: reaches out to the left with a slight elbow bend and a
    // curled wrist, hand landing mid-neck (the guitar holds the neck up at
    // ~24deg) - well clear of the head. A small drift with the beat.
    arm2_u: -166 + Math.sin(beat) * 2,
    arm2_f: -184 + Math.sin(beat + 1) * 3,
    arm2_h: -196,
    // legs: enveloped walk swing / knee-lift.
    leg1_t: 96 + swing * g.reach,
    leg1_s: 92 + lift * g.knee,
    leg1_f: 4 + lift * 10,
    leg2_t: 96 + swing2 * g.reach,
    leg2_s: 92 + lift2 * g.knee,
    leg2_f: 4 + lift2 * 10,
  };

  const s0 = GUITAR_PIVOT_AT - GUITAR_PIVOT_SPAN / 2;
  const s1 = GUITAR_PIVOT_AT + GUITAR_PIVOT_SPAN / 2;
  if (p > s0 && p < s1) {
    const tuck = Math.sin(((p - s0) / (s1 - s0)) * Math.PI);   // 0 -> 1 -> 0
    const tw = (a, target) => a + tuck * (target - a);
    // stop strumming and HUG the guitar in tight to turn with it - both hands
    // onto the body / neck, torso vertical, trailing foot lifts to a small passe.
    pose.arm1_u = tw(pose.arm1_u, 86);
    pose.arm1_f = tw(pose.arm1_f, 150);
    pose.arm1_h = tw(pose.arm1_h, 172);
    pose.arm2_u = tw(pose.arm2_u, 40);
    pose.arm2_f = tw(pose.arm2_f, -120);
    pose.arm2_h = tw(pose.arm2_h, -142);
    pose.leg1_t = tw(pose.leg1_t, 95);
    pose.leg1_s = tw(pose.leg1_s, 95);
    pose.leg2_t = tw(pose.leg2_t, 110);
    pose.leg2_s = tw(pose.leg2_s, 146);
    pose.leg2_f = tw(pose.leg2_f, 24);
    pose.torso  = tw(pose.torso, -89);
  }
  pose._bob = bob;
  return pose;
}

// The room: drawn once, static rough.js (no live filters). Sparse interior -
// "what you play when no one's around": a framed picture (parallax-fast / far),
// a window with a soft light slab on the floor (parallax-medium), a low stool
// (parallax-medium), one floor line + a few boards (parallax-slow).
function buildGuitarScene(svg) {
  const rc = rough.svg(svg);
  const NS = 'http://www.w3.org/2000/svg';
  const INK = '#2b2b2b';
  const GUITAR = '#7d5f86';
  const floorY = GUITAR_FLOOR_Y;
  const g = () => document.createElementNS(NS, 'g');

  function replace(cls, node) {
    const host = svg.querySelector('.' + cls);
    if (!host) return;
    host.innerHTML = '';
    host.appendChild(node);
  }

  const wall = g();
  wall.setAttribute('opacity', '0.34');
  wall.appendChild(rc.rectangle(28, 150, 62, 46, { stroke: INK, strokeWidth: 1.1, roughness: 1.6, fill: 'none' }));
  wall.appendChild(rc.line(38, 184, 66, 162, { stroke: INK, strokeWidth: 0.7, roughness: 1.8 }));
  wall.appendChild(rc.line(66, 162, 74, 184, { stroke: INK, strokeWidth: 0.7, roughness: 1.8 }));
  replace('layer-wall', wall);

  const win = g();
  win.setAttribute('opacity', '0.72');
  win.appendChild(rc.polygon([[402, floorY], [500, floorY], [540, floorY + 46], [356, floorY + 46]], {
    stroke: 'none', fill: 'rgba(125,95,134,0.10)', fillStyle: 'solid',
  }));
  win.appendChild(rc.rectangle(392, 84, 116, 118, { stroke: INK, strokeWidth: 1.3, roughness: 1.0, bowing: 0.4, fill: 'none' }));
  win.appendChild(rc.line(450, 84, 450, 202, { stroke: INK, strokeWidth: 1.0, roughness: 1.0 }));
  win.appendChild(rc.line(392, 143, 508, 143, { stroke: INK, strokeWidth: 1.0, roughness: 1.0 }));
  replace('layer-window', win);

  const props = g();
  props.setAttribute('opacity', '0.8');
  props.appendChild(rc.line(96, floorY - 28, 90, floorY, { stroke: INK, strokeWidth: 1.5, roughness: 1.1 }));
  props.appendChild(rc.line(124, floorY - 28, 130, floorY, { stroke: INK, strokeWidth: 1.5, roughness: 1.1 }));
  props.appendChild(rc.line(90, floorY - 28, 130, floorY - 28, { stroke: INK, strokeWidth: 1.8, roughness: 1.0 }));
  replace('layer-props', props);

  const floor = g();
  floor.appendChild(rc.line(-160, floorY, 940, floorY, { stroke: INK, strokeWidth: 1.6, roughness: 0.8 }));
  for (let i = -1; i < 8; i++) {
    const x = i * 132 + 30;
    floor.appendChild(rc.line(x, floorY, x - 30, floorY + 64, { stroke: 'rgba(43,43,43,0.45)', strokeWidth: 0.7, roughness: 1.3, bowing: 0.3 }));
  }
  replace('layer-floor', floor);
  void GUITAR;
}

// The held guitar - a rough.js acoustic drawn once and parented to the figure
// root (first child, so it travels + turns + tucks with the player and paints
// behind both hands). Waisted figure-eight body, a neck to a small headstock, a
// round sound hole, a few string lines - it must read as a guitar at this scale
// and while moving (captain refinement).
function buildGuitar(svg, hostEl) {
  const NS = 'http://www.w3.org/2000/svg';
  const INK = '#2b2b2b';
  const GUITAR = '#7d5f86';
  const rc = rough.svg(svg);
  const gg = document.createElementNS(NS, 'g');
  gg.setAttribute('class', 'guitar-prop');
  // Authored with the long axis roughly horizontal (neck to the left, body to
  // the right at the strumming hand), then held up at ~25deg against the body.
  gg.setAttribute('transform', 'translate(4,-12) rotate(24) scale(1.08)');

  // waisted figure-eight body: smaller upper bout (left, at the neck joint),
  // pinched waist, bigger lower bout (right, under the strumming hand).
  gg.appendChild(rc.path(
    'M -18 0 C -18 -10 -12 -16 -2 -15.5 C 3 -15 5 -10 7 -6 ' +
    'C 10 -14 17 -17 24 -16 C 31 -15 32 -6 32 0 ' +
    'C 32 6 31 15 24 16 C 17 17 10 14 7 6 ' +
    'C 5 10 3 15 -2 15.5 C -12 16 -18 10 -18 0 Z',
    { stroke: GUITAR, strokeWidth: 2, roughness: 1.0, bowing: 0.7, fill: 'rgba(125,95,134,0.10)', fillStyle: 'solid' }));
  // round sound hole in the lower bout
  gg.appendChild(rc.circle(15, 0, 13, { stroke: INK, strokeWidth: 1.2, roughness: 0.85, fill: 'none' }));
  // bridge
  gg.appendChild(rc.line(24, -5, 24, 5, { stroke: INK, strokeWidth: 2.6, roughness: 0.7 }));
  // neck (slim, tapering) + nut + headstock, to the left
  gg.appendChild(rc.path('M -18 -5 L -52 -3.4 L -52 3.4 L -18 5 Z',
    { stroke: GUITAR, strokeWidth: 1.6, roughness: 0.8, bowing: 0.3, fill: 'rgba(125,95,134,0.06)', fillStyle: 'solid' }));
  gg.appendChild(rc.line(-52, -3.6, -52, 3.6, { stroke: INK, strokeWidth: 1.4, roughness: 0.7 }));
  gg.appendChild(rc.path('M -52 -4.4 L -66 -8 L -67 3 L -52 4.4 Z',
    { stroke: GUITAR, strokeWidth: 1.6, roughness: 0.85, fill: 'rgba(125,95,134,0.09)', fillStyle: 'solid' }));
  // tuning pegs
  [-56, -61].forEach(x => {
    gg.appendChild(rc.line(x, -8, x, -12, { stroke: INK, strokeWidth: 1.1, roughness: 0.8 }));
    gg.appendChild(rc.line(x, 4, x, 8, { stroke: INK, strokeWidth: 1.1, roughness: 0.8 }));
  });
  // frets
  [-26, -34, -42].forEach(x => {
    gg.appendChild(rc.line(x, -4.4, x, 4.4, { stroke: INK, strokeWidth: 0.7, roughness: 0.8 }));
  });
  // strings: bridge -> over the sound hole -> down the neck to the nut
  [-2.3, 0, 2.3].forEach(o => {
    gg.appendChild(rc.line(24, o, -52, o * 0.65, {
      stroke: 'rgba(43,43,43,0.5)', strokeWidth: 0.5, roughness: 0.5, bowing: 0.15,
    }));
  });

  hostEl.insertBefore(gg, hostEl.firstChild);   // behind the arms so both hands read
  return gg;
}

// One drifting music-note glyph (eighth note, or a beamed pair) - rough.js, in
// the --guitar accent. Small; drawn once, positioned by a scroll-linked track.
function buildGuitarNote(svg, kind) {
  const NS = 'http://www.w3.org/2000/svg';
  const GUITAR = '#7d5f86';
  const rc = rough.svg(svg);
  const ng = document.createElementNS(NS, 'g');
  ng.setAttribute('class', 'note');
  const head = (x, y) => rc.ellipse(x, y, 7, 5.4, {
    stroke: GUITAR, strokeWidth: 1, roughness: 0.8, fill: GUITAR, fillStyle: 'solid',
  });
  if (kind === 'pair') {
    ng.appendChild(head(0, 1));
    ng.appendChild(head(10, 0));
    ng.appendChild(rc.line(3.2, 1, 3.2, -13, { stroke: GUITAR, strokeWidth: 1.1, roughness: 0.7 }));
    ng.appendChild(rc.line(13.2, 0, 13.2, -14, { stroke: GUITAR, strokeWidth: 1.1, roughness: 0.7 }));
    ng.appendChild(rc.line(2.7, -13, 13.7, -14, { stroke: GUITAR, strokeWidth: 2.2, roughness: 0.6 }));
  } else {
    ng.appendChild(head(0, 1));
    ng.appendChild(rc.line(3.2, 1, 3.2, -14, { stroke: GUITAR, strokeWidth: 1.1, roughness: 0.7 }));
    ng.appendChild(rc.path('M 3.2 -14 Q 9 -12 7 -6', { stroke: GUITAR, strokeWidth: 1.1, roughness: 0.7, fill: 'none' }));
  }
  return ng;
}

function setupGuitar() {
  const section = document.getElementById('sec-guitar');
  const svg     = section.querySelector('.guitar-scene');

  buildGuitarScene(svg);

  // dense procedural pose set -> the rig's stock hermiteSpline path
  const poses = {}, times = {}, bobs = [];
  for (let i = 0; i <= GUITAR_STEPS; i++) {
    const t = i / GUITAR_STEPS;
    const wp = guitarPoseAt(t);
    bobs.push(wp._bob); delete wp._bob;
    poses['k' + i] = SV.worldPose(wp);
    times['k' + i] = t;
  }

  const figure = SV.buildStickFigure(svg, {
    anchor: GUITAR_ANCHOR,
    lengths: GUITAR_LENGTHS,
    legWidths: GUITAR_LEG_W,
    armWidths: GUITAR_ARM_W,
    poses,
    times,
    stroke: { roughness: 1.15, bowing: 0.6 },
    rootClass: 'figure-root',
    hands: true,
    insertBefore: svg.querySelector('.layer-notes'),
  });
  buildGuitar(svg, figure.root);

  // rotate / scale pivot about mid-torso; translate is origin-independent. Both
  // the CSS-animation path and the rAF fallback read this.
  const origin = `${GUITAR_ANCHOR.x}px ${GUITAR_ANCHOR.y - 16}px`;
  figure.root.style.transformOrigin = origin;

  // --- traverse + camera pan --------------------------------------------------
  const cross = SV.hermiteSpline(GUITAR_CROSS_KNOTS);
  const bobSpline = SV.hermiteSpline(bobs.map((v, k) => ({ t: k / GUITAR_STEPS, v })));
  const S0 = GUITAR_PIVOT_AT - GUITAR_PIVOT_SPAN / 2;
  const S1 = GUITAR_PIVOT_AT + GUITAR_PIVOT_SPAN / 2;
  const hop = SV.hermiteSpline([
    { t: S0, v: 0 }, { t: GUITAR_PIVOT_AT, v: -14 }, { t: S1, v: 0 }, { t: 1, v: 0 },
  ]);
  const turnLean = SV.hermiteSpline([
    { t: S0, v: 0 }, { t: GUITAR_PIVOT_AT - 0.04, v: -8 },
    { t: GUITAR_PIVOT_AT + 0.04, v: 8 }, { t: S1, v: 0 }, { t: 1, v: 0 },
  ]);
  // camera pans to partly follow: the whole scene shifts by -cam(p); the figure
  // additionally carries its own cross(p), so it drifts across ~half the frame
  // while the room streams past behind.
  const cam = p => cross(p) * 0.46;
  const scaleX = p => Math.cos(guitarPivotU(p) * 2 * Math.PI);   // 1 -> 0 -> -1 -> 0 -> 1

  const translateFn = p =>
    `${(cross(p) - cam(p)).toFixed(2)}px ${(hop(p) + bobSpline(p)).toFixed(2)}px`;
  const rotateFn = p => `${turnLean(p).toFixed(2)}deg`;
  const scaleFn  = p => `${scaleX(p).toFixed(3)} 1`;

  const PARALLAX = [
    ['.layer-wall',   0.35],
    ['.layer-window', 0.62],
    ['.layer-props',  0.90],
    ['.layer-floor',  1.00],
  ];
  const parallaxFn = mul => p => `${(-cam(p) * mul).toFixed(2)}px 0`;

  // --- drifting music notes: sparse, calm, scroll-linked (gone when parked) ----
  // A handful across the traverse, at most a couple visible at once, none during
  // the dance-turn window. Each note fades in / drifts up + outward / fades out
  // within its own scroll sub-range.
  const NOTES = [
    { kind: 'pair',   c0: 0.14, c1: 0.28, dx: 4,  rise: 34 },
    { kind: 'eighth', c0: 0.30, c1: 0.42, dx: 10, rise: 40 },
    { kind: 'eighth', c0: 0.60, c1: 0.72, dx: 6,  rise: 36 },
    { kind: 'pair',   c0: 0.76, c1: 0.90, dx: 12, rise: 42 },
  ];
  // .layer-notes paints after the figure (inserted above) so notes read over the
  // guitar, not hidden behind it
  const noteLayer = svg.querySelector('.layer-notes');
  const noteEls = NOTES.map(n => {
    const el = buildGuitarNote(svg, n.kind);
    noteLayer.appendChild(el);
    return el;
  });
  const noteU = (n, p) => Math.max(0, Math.min(1, (p - n.c0) / (n.c1 - n.c0)));
  const noteTranslateFn = n => p => {
    const u = noteU(n, p);
    // leave the sound hole, drift up and outward (the direction the player moves)
    const x = GUITAR_ANCHOR.x + (cross(p) - cam(p)) + 20 + u * (18 + n.dx);
    const y = GUITAR_ANCHOR.y + hop(p) - 6 - u * n.rise;
    return `${x.toFixed(1)}px ${y.toFixed(1)}px`;
  };
  const noteOpacityFn = n => p => {
    if (p <= n.c0 || p >= n.c1) return '0';
    const span = n.c1 - n.c0;
    const inT = n.c0 + span * 0.28, outT = n.c1 - span * 0.30;
    if (p < inT)  return (0.5 * (p - n.c0) / (inT - n.c0)).toFixed(3);
    if (p > outT) return (0.42 * (1 - (p - outT) / (n.c1 - outT))).toFixed(3);
    return '0.42';
  };

  // ---- reduced motion: one static "standing and playing" frame ---------------
  if (REDUCED) {
    const rp = SV.worldPose(GUITAR_REST);
    figure.joints.forEach(k => {
      if (rp[k] != null) figure.jointEls[k].style.rotate = rp[k].toFixed(3) + 'deg';
    });
    figure.root.style.translate = '0px 0px';
    figure.root.style.rotate = '0deg';
    figure.root.style.scale = '1 1';
    // a couple of calm static notes drifting off the sound hole
    noteEls.forEach((el, i) => {
      if (i > 1) { el.remove(); return; }
      el.style.opacity = '0.32';
      el.style.translate = `${GUITAR_ANCHOR.x + 20 + i * 15}px ${GUITAR_ANCHOR.y - 14 - i * 18}px`;
    });
    svg.dataset.driver = 'reduced';
    return;
  }

  const tracks = [
    { selector: '.figure-root', property: 'translate', spline: translateFn, from: 0, to: 1, steps: 64 },
    { selector: '.figure-root', property: 'rotate',    spline: rotateFn,    from: 0, to: 1, steps: 72 },
    { selector: '.figure-root', property: 'scale',     spline: scaleFn,     from: 0, to: 1, steps: 72 },
  ];
  PARALLAX.forEach(([sel, mul]) => {
    tracks.push({ selector: sel, property: 'translate', spline: parallaxFn(mul), from: 0, to: 1, steps: 48 });
  });
  NOTES.forEach((n, i) => {
    const cls = `.note:nth-of-type(${i + 1})`;
    tracks.push({ selector: cls, property: 'opacity', spline: noteOpacityFn(n), from: 0, to: 1, steps: 44 });
    tracks.push({ selector: cls, property: 'translate', spline: noteTranslateFn(n), from: 0, to: 1, steps: 44 });
  });

  const style = document.createElement('style');
  style.id = 'guitar-scrub-keyframes';
  style.textContent = SV.buildScrubStylesheet({
    ns: 'guitar',
    timeline: '--guitar-tl',
    scene: '.guitar-scene',
    figure: { jointSplines: figure.jointSplines, idlePose: figure.idlePose, endT: 1, joints: figure.joints },
    tracks,
  });
  document.head.appendChild(style);

  svg.dataset.driver = SV.supportsScrollDrivenAnimation() ? 'native' : 'fallback';
  if (svg.dataset.driver === 'fallback') {
    const channels = [
      SV.figureJointsChannel(figure.jointEls, figure.jointSplines, 1, figure.joints),
      SV.translateChannel(figure.root, translateFn),
      SV.styleChannel(figure.root, 'rotate', rotateFn),
      SV.styleChannel(figure.root, 'scale', scaleFn),
    ];
    PARALLAX.forEach(([sel, mul]) => {
      channels.push(SV.translateChannel(svg.querySelector(sel), parallaxFn(mul)));
    });
    NOTES.forEach((n, i) => {
      channels.push(SV.styleChannel(noteEls[i], 'opacity', noteOpacityFn(n)));
      channels.push(SV.translateChannel(noteEls[i], noteTranslateFn(n)));
    });
    SV.pinnedScrubFallback({ section, channels });
  }
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
