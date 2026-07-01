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
function setupBasket() {
  const { Engine, Bodies, Body, World } = Matter;
  const section = document.getElementById('sec-basket');
  const canvas  = section.querySelector('canvas.anim-canvas');
  const ball    = document.getElementById('bball');
  const shadow  = document.getElementById('bball-shadow');

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

  const groundY    = H * 0.72;
  const hoopRight  = W * 0.96;
  const rimCenterX = W * 0.80;
  const rimCenterY = H * 0.30;
  const rimW       = W * 0.08;

  rc.line(0, groundY, W, groundY, {
    stroke: '#cf8542', strokeWidth: 1.5, roughness: 0.7,
  });
  rc.line(hoopRight, H * 0.10, hoopRight, H * 0.42, {
    stroke: '#2b2b2b', strokeWidth: 2.5, roughness: 0.9, bowing: 0,
  });
  rc.rectangle(hoopRight - W * 0.04, H * 0.14, W * 0.033, H * 0.065, {
    stroke: '#2b2b2b', strokeWidth: 1.2, roughness: 0.8, fill: 'none',
  });
  rc.line(hoopRight - W * 0.02, rimCenterY, rimCenterX + rimW / 2, rimCenterY, {
    stroke: '#2b2b2b', strokeWidth: 2.5, roughness: 0.8, bowing: 0,
  });
  rc.ellipse(rimCenterX, rimCenterY, rimW, rimW * 0.32, {
    stroke: '#2b2b2b', strokeWidth: 2.5, roughness: 1.0,
  });
  const netBase = rimCenterY + H * 0.09;
  const netOpts = { stroke: '#2b2b2b', strokeWidth: 0.9, roughness: 0.7 };
  for (let i = 0; i <= 4; i++) {
    const fromX  = (rimCenterX - rimW / 2) + (rimW / 4) * i;
    const drape  = i === 2 ? 0 : i < 2 ? -3 : 3;
    rc.line(fromX, rimCenterY + 4, fromX + drape, netBase, netOpts);
  }
  rc.line(rimCenterX - rimW / 2 + 3, rimCenterY + H * 0.040, rimCenterX + rimW / 2 - 3, rimCenterY + H * 0.040, netOpts);
  rc.line(rimCenterX - rimW / 2 + 6, rimCenterY + H * 0.065, rimCenterX + rimW / 2 - 6, rimCenterY + H * 0.065, netOpts);

  // ── Matter.js physics ─────────────────────────────────────
  const engine = Engine.create({ gravity: { y: 1.5 } });

  // Ball CSS: top: 22%, left: 8% → center
  const startX = W * 0.08 + 17;
  const startY = H * 0.22 + 17;

  const ballBody  = Bodies.circle(startX, startY, 17, {
    isStatic: true, restitution: 0.55, friction: 0.3, frictionAir: 0.01,
  });
  const floorBody = Bodies.rectangle(W / 2, groundY + 5, W * 2, 10, { isStatic: true });
  World.add(engine.world, [ballBody, floorBody]);

  let rafId    = null;
  let launched = false;

  function updateShadow(bodyY) {
    const dist = Math.max(0, groundY - bodyY);
    const maxD = groundY - startY;
    const t    = 1 - dist / maxD;
    gsap.set(shadow, { scaleX: 0.25 + t * 1.2, opacity: 0.04 + t * 0.18 });
  }

  function tick() {
    Engine.update(engine, 1000 / 60);
    const p = ballBody.position;
    gsap.set(ball, { x: p.x - startX, y: p.y - startY });
    updateShadow(p.y);
    if (p.x > W + 80 || p.y > H + 80) {
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
    // Slight rightward drift; gravity does the drop; bounce sends it toward hoop
    // Tune x to control how far right ball travels after bounce
    Body.setVelocity(ballBody, { x: W / 240, y: 1 });
    tick();
  }

  function reset() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    Body.setStatic(ballBody, true);
    Body.setPosition(ballBody, { x: startX, y: startY });
    Body.setVelocity(ballBody, { x: 0, y: 0 });
    gsap.set(ball,   { x: 0, y: 0 });
    gsap.set(shadow, { scaleX: 0.3, opacity: 0.04 });
    launched = false;
  }

  ScrollTrigger.create({
    trigger: section,
    start: 'top 70%',
    onEnter:     launch,
    onLeaveBack: reset,
  });
}
function setupGuitar() {
  const section = document.getElementById('sec-guitar');
  const canvas  = section.querySelector('canvas.anim-canvas');

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

  // Bridge (where strings anchor at bottom-center)
  const bridgeW = W * 0.10;
  rc.rectangle(W / 2 - bridgeW / 2, H * 0.925, bridgeW, H * 0.022, {
    stroke: '#7d5f86', strokeWidth: 1.2, roughness: 1.4,
    fill: 'rgba(125, 95, 134, 0.06)', fillStyle: 'solid',
  });

  // Nut (thin bar at far left where strings begin)
  rc.rectangle(W * 0.01, H * 0.68, W * 0.005, H * 0.25, {
    stroke: '#7d5f86', strokeWidth: 1.0, roughness: 1.3,
    fill: 'rgba(125, 95, 134, 0.08)', fillStyle: 'solid',
  });

  // Fret position dots — three frets visible
  [0.22, 0.42, 0.60].forEach(pct => {
    rc.circle(W * pct, H * 0.815, 9, {
      stroke: '#7d5f86', strokeWidth: 1.0, roughness: 1.0,
      fill: 'rgba(125, 95, 134, 0.10)', fillStyle: 'solid',
    });
  });

  // ── GSAP string vibration ────────────────────────────────
  const tl = gsap.timeline();

  const strings = [
    { id: 'gstr-1', y: 30,  amp: 20 },
    { id: 'gstr-2', y: 66,  amp: 26 },
    { id: 'gstr-3', y: 102, amp: 32 },
    { id: 'gstr-4', y: 138, amp: 24 },
    { id: 'gstr-5', y: 170, amp: 16 },
  ];

  strings.forEach(({ id, y, amp }, i) => {
    const el     = document.getElementById(id);
    const offset = i * 0.045;

    // All four path states use identical M C command count — required for GSAP d-interpolation
    const flat    = `M 0 ${y} C 333 ${y}             667 ${y}             1000 ${y}`;
    const peak    = `M 0 ${y} C 333 ${y - amp}       667 ${y + amp}       1000 ${y}`;
    const rebound = `M 0 ${y} C 333 ${y + amp * 0.4} 667 ${y - amp * 0.4} 1000 ${y}`;
    const settle  = `M 0 ${y} C 333 ${y - amp * 0.1} 667 ${y + amp * 0.1} 1000 ${y}`;

    tl.to(el, { attr: { d: peak    }, ease: 'power3.out',   duration: 0.08 }, offset);
    tl.to(el, { attr: { d: rebound }, ease: 'power3.inOut', duration: 0.12 }, offset + 0.08);
    tl.to(el, { attr: { d: settle  }, ease: 'power3.inOut', duration: 0.10 }, offset + 0.20);
    tl.to(el, { attr: { d: flat    }, ease: 'power3.in',    duration: 0.14 }, offset + 0.30);
  });

  tl.fromTo('#gnote-1', { opacity: 0, y: 0 }, { opacity: 0.72, y: -120, ease: 'power1.out', duration: 0.7 }, 0);
  tl.fromTo('#gnote-2', { opacity: 0, y: 0 }, { opacity: 0.52, y: -140, ease: 'power1.out', duration: 0.7 }, 0.06);
  tl.fromTo('#gnote-3', { opacity: 0, y: 0 }, { opacity: 0.38, y: -130, ease: 'power1.out', duration: 0.7 }, 0.12);

  ScrollTrigger.create({
    trigger: section,
    start: 'top bottom',
    end: 'bottom top',
    scrub: 0.4,
    animation: tl,
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
