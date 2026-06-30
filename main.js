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
    document.querySelectorAll('.section__scene').forEach(el => {
      el.style.opacity = '1';
      el.style.transform = 'none';
    });
    document.querySelectorAll('.project-card').forEach(el => {
      el.style.clipPath = 'none';
    });
    document.querySelectorAll('.hero__eyebrow, .hero__h1, .hero__sub').forEach(el => {
      el.style.clipPath = 'none';
    });
    document.querySelector('.hero').classList.add('is-loaded');
    return;
  }

  setupSceneReveal();
  setupSoccer();
  setupVolley();
  setupBasket();
  setupGuitar();
  setupProjectReveal();
}

function setupNavDot() {
  const dot = document.getElementById('nav-dot');
  SECTIONS.forEach((key, i) => {
    ScrollTrigger.create({
      trigger: `#sec-${key}`,
      start: 'top 55%',
      end: 'bottom 55%',
      onEnter()     { dot.style.transform = `translateY(${DOT_Y[i]}px)`; dot.style.background = ACCENTS[i]; },
      onEnterBack() { dot.style.transform = `translateY(${DOT_Y[i]}px)`; dot.style.background = ACCENTS[i]; },
    });
  });
}

function setupSceneReveal() {
  SECTIONS.forEach(key => {
    const section = document.getElementById(`sec-${key}`);
    const num     = section.querySelector('.section__num');
    const title   = section.querySelector('.section__title');
    const caption = section.querySelector('.section__caption');
    const scene   = section.querySelector('.section__scene');

    ScrollTrigger.create({
      trigger: section,
      start: 'top 60%',
      once: true,
      onEnter() {
        scene.classList.add('is-visible');
        gsap.to([num, title], { clipPath: 'inset(0 0 0% 0)', ease: 'power3.out', duration: 0.7, stagger: 0.08 });
        gsap.to(caption, { clipPath: 'inset(0 0 0% 0)', ease: 'power3.out', duration: 0.6, delay: 0.2 });
      },
    });
  });
}
function setupSoccer() {
  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
  tl.to('#soc-leg-r', { duration: 0.35, attr: { x2: 424, y2: 438 } });
  tl.to('#soc-leg-r', { duration: 0.15, attr: { x2: 538, y2: 400 }, ease: 'expo.out' });
  tl.to('#soc-leg-r', { duration: 0.15, attr: { x2: 552, y2: 452 } });
  tl.to('#soc-arm-r', { duration: 0.2, attr: { x2: 528, y2: 218 } }, 0.35);
  tl.to('#soc-arm-l', { duration: 0.2, attr: { x2: 392, y2: 240 } }, 0.35);
  tl.to('#bsoc', { duration: 0.55, x: 313, ease: 'power1.inOut' }, 0.45);
  tl.to('#bsoc', { duration: 0.275, y: -60, ease: 'power2.out' }, 0.45);
  tl.to('#bsoc', { duration: 0.275, y: -14, ease: 'power2.in'  }, 0.725);
  ScrollTrigger.create({ trigger: '#sec-soccer', start: 'top top', end: 'bottom bottom', scrub: 0.5, animation: tl });
}
function setupVolley() {
  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
  tl.to('#vol-figure', { duration: 0.25, y: 14, ease: 'power2.in' });
  tl.to('#vol-figure', { duration: 0.35, y: -80, ease: 'back.out(1.4)' });
  tl.to('#vol-arm-r', { duration: 0.25, attr: { x2: 360, y2: 78 }, ease: 'power2.out' }, 0.35);
  tl.to('#bvol', { duration: 0.2, y: -30, ease: 'power2.out' }, 0.35);
  tl.to('#bvol', { duration: 0.35, x: 510, ease: 'expo.out'  }, 0.5);
  tl.to('#bvol', { duration: 0.35, y: 310, ease: 'power2.in' }, 0.5);
  tl.to('#vol-arm-r', { duration: 0.2, attr: { x2: 372, y2: 292 }, ease: 'power2.in' }, 0.6);
  tl.to('#vol-figure', { duration: 0.3, y: 0, ease: 'power2.in' }, 0.65);
  ScrollTrigger.create({ trigger: '#sec-volley', start: 'top top', end: 'bottom bottom', scrub: 0.5, animation: tl });
}
function setupBasket() {
  const tl = gsap.timeline();

  function bounce(startT) {
    tl.to('#bball',     { duration: 0.16, y: 162, ease: 'power2.in'  }, startT);
    tl.to('#bball',     { duration: 0.16, y: 0,   ease: 'power2.out' }, startT + 0.16);
    tl.to('#bas-arm-r', { duration: 0.16, attr: { x2: 556, y2: 462 }, ease: 'power2.in'  }, startT);
    tl.to('#bas-arm-r', { duration: 0.16, attr: { x2: 550, y2: 300 }, ease: 'power2.out' }, startT + 0.16);
  }

  bounce(0);
  bounce(0.34);
  bounce(0.68);

  ScrollTrigger.create({ trigger: '#sec-basket', start: 'top top', end: 'bottom bottom', scrub: 0.6, animation: tl });
}
function setupGuitar() {
  const tl = gsap.timeline();
  const armUp   = { x2: 540, y2: 312 };
  const armDown = { x2: 566, y2: 422 };

  for (let i = 0; i < 5; i++) {
    const t = i * 0.2;
    tl.to('#guit-arm-r', { duration: 0.08, attr: armDown, ease: 'power3.in'  }, t);
    tl.to('#guit-arm-r', { duration: 0.12, attr: armUp,   ease: 'power3.out' }, t + 0.08);
  }

  tl.fromTo('#gnote-1', { opacity: 0, y: 0 }, { duration: 1, opacity: 0.75, y: -140, ease: 'power1.out' }, 0);
  tl.fromTo('#gnote-2', { opacity: 0, y: 0 }, { duration: 1, opacity: 0.55, y: -148, ease: 'power1.out' }, 0.08);
  tl.fromTo('#gnote-3', { opacity: 0, y: 0 }, { duration: 1, opacity: 0.35, y: -142, ease: 'power1.out' }, 0.16);

  ScrollTrigger.create({ trigger: '#sec-guitar', start: 'top top', end: 'bottom bottom', scrub: 0.4, animation: tl });
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
