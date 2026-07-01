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
function setupVolley()       { /* Task 3 */ }
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
