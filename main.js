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
    // Basketball draws a single static "made shot" frame - it has a natural
    // resting composition (ball in the net) that reads without motion.
    setupHero();
    setupBasket();
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
