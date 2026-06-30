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
function setupSoccer()        { /* Task 3 */ }
function setupVolley()        { /* Task 4 */ }
function setupBasket()        { /* Task 5 */ }
function setupGuitar()        { /* Task 6 */ }
function setupProjectReveal() { /* Task 7 */ }
