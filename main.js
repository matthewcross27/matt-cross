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
function setupSoccer() {
  const section      = document.getElementById('sec-soccer');
  const canvas       = section.querySelector('canvas.anim-canvas');
  const ball         = document.getElementById('bsoc');
  const goalie       = document.getElementById('soc-goalie');
  const caption      = document.getElementById('soc-caption');
  const confettiLayer = document.getElementById('soc-confetti');
  const statusEl     = document.getElementById('soc-status');
  const zoneBtns     = Array.from(section.querySelectorAll('.zone-btn'));

  const dpr = window.devicePixelRatio || 1;
  canvas.width  = canvas.clientWidth  * dpr;
  canvas.height = canvas.clientHeight * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const W = canvas.clientWidth;
  const H = canvas.clientHeight;

  const rc = rough.canvas(canvas);

  rc.line(0, H * 0.72, W, H * 0.72, {
    stroke: '#6f8f5e', strokeWidth: 1.5, roughness: 0.7,
  });

  const goalRight  = W * 0.97;
  const goalLeft   = W * 0.86;
  const goalTop    = H * 0.38;
  const goalBottom = H * 0.72;

  rc.line(goalLeft, goalTop, goalLeft, goalBottom, { stroke: '#2b2b2b', strokeWidth: 2.5, roughness: 1.1, bowing: 0 });
  rc.line(goalLeft, goalTop, goalRight, goalTop,   { stroke: '#2b2b2b', strokeWidth: 2.5, roughness: 1.1, bowing: 0 });

  const netOpts = { stroke: '#2b2b2b', strokeWidth: 0.9, roughness: 0.4 };
  const gW = goalRight - goalLeft;
  const gH = goalBottom - goalTop;
  rc.line(goalLeft,             goalTop + gH * 0.33, goalRight, goalTop + gH * 0.33, netOpts);
  rc.line(goalLeft,             goalTop + gH * 0.66, goalRight, goalTop + gH * 0.66, netOpts);
  rc.line(goalLeft + gW * 0.33, goalTop,             goalLeft + gW * 0.33, goalBottom, netOpts);
  rc.line(goalLeft + gW * 0.66, goalTop,             goalLeft + gW * 0.66, goalBottom, netOpts);

  // The 6 shot zones are the net's own cross-hatch panes, not a bolted-on
  // overlay grid (design.html section 04). Numbering is reading order,
  // top-left to bottom-right, and doubles as the goalie's target index.
  const ZONES = {};
  [1, 2, 3].forEach((zone, i) => {
    ZONES[zone] = { x: goalLeft + gW * (i + 0.5) / 3, y: goalTop + gH * 0.25 };
  });
  [4, 5, 6].forEach((zone, i) => {
    ZONES[zone] = { x: goalLeft + gW * (i + 0.5) / 3, y: goalTop + gH * 0.75 };
  });

  // CSS: ball is 32px, left:20%, top:calc(72% - 32px) -> its center at rest.
  const BALL_START  = { x: W * 0.20 + 16, y: H * 0.72 - 16 };
  // CSS: .soccer-goalie sits centered on the goal box (calc(91.5% - 21px) etc).
  const GOALIE_REST = { x: goalLeft + gW * 0.5, y: goalTop + gH * 0.5 };

  // ---- Matter.js world ----
  // Physics renders the outcome, it never decides it: save vs. goal is
  // settled by comparing the two zone picks the instant the shot commits
  // (see commitShot below). Matter.js only owns the save-bounce, since
  // that's the one motion that needs real collision response - a goal has
  // nothing to collide with, so its flight is a direct tween further down
  // (design.html section 06, "Revised after review"; a free-flight physics
  // goal path was tried, found to fly through the goal with nothing to stop
  // it, and replaced with the direct tween for exactly that reason).
  const { Engine, Bodies, Body, World } = Matter;
  const physicsScale = W / 640; // gravity/speed tuned against a 640px reference stage
  const engine = Engine.create({ gravity: { x: 0, y: 0.55 * physicsScale } });
  const ballBody = Bodies.circle(BALL_START.x, BALL_START.y, 16, {
    restitution: 0.55, friction: 0.05, frictionAir: 0, label: 'ball',
  });
  Body.setStatic(ballBody, true);
  World.add(engine.world, ballBody);
  const goalieBody = Bodies.rectangle(GOALIE_REST.x, GOALIE_REST.y, 42, 78, {
    isStatic: true, label: 'goalie',
  });
  World.add(engine.world, goalieBody);

  const setBallX = gsap.quickSetter(ball, 'x', 'px');
  const setBallY = gsap.quickSetter(ball, 'y', 'px');

  gsap.set(ball, { x: -(W * 0.20 + 36), y: 0, rotation: 0, scale: 1, opacity: 1 });

  let ready    = false;
  let shooting = false;
  let rafId       = null;
  let ballTween   = null;
  let resolveTimer = null;
  let resetTimer   = null;

  function setGridEnabled(enabled) {
    zoneBtns.forEach(btn => { btn.disabled = !enabled; });
  }
  setGridEnabled(false);

  function diveGoalie(zone) {
    const t = ZONES[zone];
    const topRow = zone <= 3;
    anime.animate(goalie, {
      translateX: t.x - GOALIE_REST.x,
      translateY: t.y - GOALIE_REST.y,
      rotate: topRow ? -10 : 10,
      scaleY: topRow ? 1.06 : 0.9,
      duration: 380,
      ease: 'outQuad',
    });
  }

  function resetGoalie() {
    anime.remove(goalie);
    anime.animate(goalie, {
      translateX: 0, translateY: 0, rotate: 0, scaleY: 1,
      duration: 280, ease: 'outQuad',
    });
  }

  function burstConfetti(atZone) {
    confettiLayer.innerHTML = '';
    const colors = [...ACCENTS, '#2b2b2b'];
    const origin = ZONES[atZone];
    const pieces = [];
    for (let i = 0; i < 28; i++) {
      const el = document.createElement('div');
      el.className = 'confetti-piece';
      el.style.left = origin.x + 'px';
      el.style.top  = origin.y + 'px';
      el.style.background = colors[i % colors.length];
      confettiLayer.appendChild(el);
      pieces.push(el);
    }
    anime.animate(pieces, {
      translateX: () => anime.utils.random(-90, 90),
      translateY: () => anime.utils.random(50, 150),
      rotate: () => anime.utils.random(-180, 180),
      opacity: [1, 0],
      duration: () => anime.utils.random(650, 950),
      delay: anime.stagger(6),
      ease: 'outCubic',
    });
  }

  function physicsLoop() {
    Engine.update(engine, 1000 / 60);
    setBallX(ballBody.position.x - BALL_START.x);
    setBallY(ballBody.position.y - BALL_START.y);
    rafId = requestAnimationFrame(physicsLoop);
  }

  function stopAllMotion() {
    clearTimeout(resolveTimer);
    clearTimeout(resetTimer);
    cancelAnimationFrame(rafId);
    if (ballTween && ballTween.pause) ballTween.pause();
    anime.remove(goalie);
    goalie.style.transform = '';
  }

  function rollIn() {
    if (ready || shooting) return;
    gsap.to(ball, {
      x: 0, rotation: -180,
      ease: 'power2.out', duration: 0.6,
      onComplete: () => { ready = true; setGridEnabled(true); },
    });
  }

  function rollBack() {
    ready = false; shooting = false;
    setGridEnabled(false);
    stopAllMotion();
    Body.setStatic(ballBody, true);
    Body.setPosition(ballBody, BALL_START);
    Body.setVelocity(ballBody, { x: 0, y: 0 });
    caption.className = 'soccer-caption';
    caption.textContent = '';
    statusEl.textContent = '';
    gsap.killTweensOf(ball);
    gsap.set(ball, { x: -(W * 0.20 + 36), y: 0, scale: 1, opacity: 1, rotation: 0 });
  }

  ScrollTrigger.create({
    trigger: section, start: 'top 70%',
    onEnter: rollIn, onLeaveBack: rollBack,
  });

  function scheduleReset() {
    resetTimer = setTimeout(() => {
      cancelAnimationFrame(rafId);
      if (ballTween && ballTween.pause) ballTween.pause();
      Body.setStatic(ballBody, false);
      Body.setPosition(ballBody, BALL_START);
      Body.setVelocity(ballBody, { x: 0, y: 0 });
      Body.setStatic(ballBody, true);
      gsap.set(ball, { x: 0, y: 0, rotation: 0, scale: 1, opacity: 1 });
      resetGoalie();
      caption.className = 'soccer-caption';
      caption.textContent = '';
      statusEl.textContent = '';
      shooting = false;
      ready = true;
      setGridEnabled(true);
    }, 550);
  }

  function commitShot(playerZone) {
    if (!ready || shooting) return;
    shooting = true;
    ready = false;
    setGridEnabled(false);
    section.querySelector('.section__hint')?.classList.add('is-hidden');

    const goalieZone = 1 + Math.floor(Math.random() * 6);
    const isSave = goalieZone === playerZone;

    diveGoalie(goalieZone);
    Body.setPosition(goalieBody, ZONES[goalieZone]);

    const aim = ZONES[playerZone];

    if (isSave) {
      // Real Matter.js flight + collision: the ball's actual bounce off the
      // goalie is the point here, so physics owns the whole motion.
      Body.setStatic(ballBody, false);
      Body.setPosition(ballBody, BALL_START);
      const dx = aim.x - BALL_START.x, dy = aim.y - BALL_START.y;
      const dist = Math.hypot(dx, dy);
      const speed = 15 * physicsScale;
      Body.setVelocity(ballBody, { x: dx / dist * speed, y: dy / dist * speed - 3.5 * physicsScale });
      cancelAnimationFrame(rafId);
      physicsLoop();
    } else {
      // A goal has nothing to collide with, so drive the ball straight to
      // the chosen zone: it lands exactly where aimed, every time, by
      // construction rather than by tuning gravity/speed to arrive there.
      if (ballTween && ballTween.pause) ballTween.pause();
      ballTween = anime.animate(ball, {
        translateX: aim.x - BALL_START.x,
        translateY: aim.y - BALL_START.y,
        duration: 460,
        ease: 'outQuad',
      });
    }

    resolveTimer = setTimeout(() => {
      if (isSave) {
        caption.className = 'soccer-caption is-save';
        caption.textContent = 'SAVED';
        statusEl.textContent = 'Saved - the keeper dove the right way.';
        resetTimer = setTimeout(scheduleReset, 700);
      } else {
        caption.className = 'soccer-caption is-goal';
        caption.textContent = 'GOAL!';
        statusEl.textContent = 'Goal!';
        burstConfetti(playerZone);
        resetTimer = setTimeout(() => {
          ball.style.opacity = '0';
          scheduleReset();
        }, 250);
      }
    }, 500);
  }

  zoneBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      commitShot(parseInt(btn.getAttribute('data-zone'), 10));
    });
  });
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
