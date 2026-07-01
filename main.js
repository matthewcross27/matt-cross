gsap.registerPlugin(ScrollTrigger);

const ACCENTS  = ['#6f8f5e', '#4f8a91', '#cf8542', '#7d5f86'];
const DOT_Y    = [9, 61, 113, 165];
const SECTIONS = ['soccer', 'volley', 'basket', 'guitar'];
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
    document.querySelectorAll('.hero__char').forEach(el => {
      el.style.opacity = '1';
      el.style.transform = 'none';
    });
    document.querySelector('.hero').classList.add('is-loaded');
    return;
  }
  setupHeroEntrance();
  setupSoccer();
  setupVolley();
  setupBasket();
  setupGuitar();
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

function setupHeroEntrance() { /* Task 6 */ }
function setupSoccer() {
  const section = document.getElementById('sec-soccer');
  const canvas  = section.querySelector('canvas.anim-canvas');
  const ball    = document.getElementById('bsoc');

  // ── Size canvas for device pixel ratio ──────────────────
  const dpr = window.devicePixelRatio || 1;
  canvas.width  = canvas.clientWidth  * dpr;
  canvas.height = canvas.clientHeight * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const W = canvas.clientWidth;
  const H = canvas.clientHeight;

  // ── Rough.js decorations (drawn once) ───────────────────
  const rc = rough.canvas(canvas);

  rc.line(0, H * 0.72, W, H * 0.72, {
    stroke: '#6f8f5e', strokeWidth: 1.5, roughness: 0.7,
  });

  const goalRight  = W * 0.97;
  const goalLeft   = W * 0.86;
  const goalTop    = H * 0.38;
  const goalBottom = H * 0.72;

  rc.line(goalLeft, goalTop, goalLeft, goalBottom, {
    stroke: '#2b2b2b', strokeWidth: 2.5, roughness: 1.1, bowing: 0,
  });
  rc.line(goalLeft, goalTop, goalRight, goalTop, {
    stroke: '#2b2b2b', strokeWidth: 2.5, roughness: 1.1, bowing: 0,
  });

  const netOpts = { stroke: '#2b2b2b', strokeWidth: 0.9, roughness: 0.4 };
  const gW = goalRight - goalLeft;
  const gH = goalBottom - goalTop;
  rc.line(goalLeft,          goalTop + gH * 0.33, goalRight, goalTop + gH * 0.33, netOpts);
  rc.line(goalLeft,          goalTop + gH * 0.66, goalRight, goalTop + gH * 0.66, netOpts);
  rc.line(goalLeft + gW * 0.33, goalTop,          goalLeft + gW * 0.33, goalBottom, netOpts);
  rc.line(goalLeft + gW * 0.66, goalTop,          goalLeft + gW * 0.66, goalBottom, netOpts);

  // ── GSAP scroll-scrub ───────────────────────────────────
  const tl = gsap.timeline();
  tl.to(ball, { x: () => window.innerWidth + 72, ease: 'power2.out', duration: 1 }, 0);
  tl.to(ball, { y: -80, ease: 'power2.out', duration: 0.44 }, 0);
  tl.to(ball, { y:   0, ease: 'power2.in',  duration: 0.56 }, 0.44);
  tl.to(ball, { rotation: 540, ease: 'none', duration: 1 }, 0);

  ScrollTrigger.create({
    trigger: section,
    start: 'top bottom',
    end: 'bottom top',
    scrub: 0.9,
    animation: tl,
    invalidateOnRefresh: true,
  });
}
function setupVolley() {
  const { Engine, Bodies, Body, World } = Matter;
  const section = document.getElementById('sec-volley');
  const canvas  = section.querySelector('canvas.anim-canvas');
  const ball    = document.getElementById('bvol');

  // ── Size canvas ──────────────────────────────────────────
  const dpr = window.devicePixelRatio || 1;
  canvas.width  = canvas.clientWidth  * dpr;
  canvas.height = canvas.clientHeight * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const W = canvas.clientWidth;
  const H = canvas.clientHeight;

  // ── Rough.js decorations ─────────────────────────────────
  const rc = rough.canvas(canvas);

  const groundY = H * 0.72;
  const netX    = W * 0.5;
  const netTop  = H * 0.42;

  rc.line(0, groundY, W, groundY, {
    stroke: '#4f8a91', strokeWidth: 1.5, roughness: 0.7,
  });
  rc.line(netX, netTop, netX, groundY, {
    stroke: '#2b2b2b', strokeWidth: 3, roughness: 1.0,
  });
  rc.line(netX - 8, netTop,     netX + 8, netTop,     { stroke: '#4f8a91', strokeWidth: 3.5, roughness: 0.8 });
  rc.line(netX - 8, netTop + 9, netX + 8, netTop + 9, { stroke: '#4f8a91', strokeWidth: 1.4, roughness: 0.7 });

  const meshOpts = { stroke: '#2b2b2b', strokeWidth: 0.7, roughness: 0.35 };
  for (let i = 1; i <= 3; i++) {
    rc.line(netX - 32, netTop + (groundY - netTop) * (i / 4),
            netX + 32, netTop + (groundY - netTop) * (i / 4), meshOpts);
  }
  for (let x = netX - 24; x <= netX + 24; x += 12) {
    rc.line(x, netTop, x, groundY, meshOpts);
  }

  // ── Matter.js physics ─────────────────────────────────────
  const engine = Engine.create({ gravity: { y: 1 } });

  // Ball CSS: bottom: 28%, left: 14% → center pixel coords
  const startX = W * 0.14 + 15;
  const startY = H * 0.72 - 15;

  const ballBody = Bodies.circle(startX, startY, 15, {
    isStatic: true,
    frictionAir: 0.008,
  });
  World.add(engine.world, [ballBody]);

  let rafId    = null;
  let launched = false;

  function tick() {
    Engine.update(engine, 1000 / 60);
    const p = ballBody.position;
    gsap.set(ball, {
      x: p.x - startX,
      y: p.y - startY,
      rotation: ballBody.angle * (180 / Math.PI),
    });
    if (p.x > W + 60 || p.y > H + 60) {
      cancelAnimationFrame(rafId);
      rafId = null;
      return;
    }
    rafId = requestAnimationFrame(tick);
  }

  function launch() {
    if (launched) return;
    launched = true;
    Body.setStatic(ballBody, false);
    // Tune if arc doesn't clear the net:
    //   Higher arc: make y more negative (e.g. -(H / 70))
    //   Faster crossing: increase x (e.g. W / 110)
    Body.setVelocity(ballBody, { x: W / 130, y: -(H / 85) });
    tick();
  }

  function reset() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    Body.setStatic(ballBody, true);
    Body.setPosition(ballBody, { x: startX, y: startY });
    Body.setVelocity(ballBody, { x: 0, y: 0 });
    Body.setAngle(ballBody, 0);
    gsap.set(ball, { x: 0, y: 0, rotation: 0 });
    launched = false;
  }

  ScrollTrigger.create({
    trigger: section,
    start: 'top 70%',
    onEnter:     launch,
    onLeaveBack: reset,
  });
}
function setupBasket()       { /* Task 4 */ }
function setupGuitar()       { /* Task 5 */ }

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
