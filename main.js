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

function setupNavDot()        { /* Task 2 */ }
function setupSceneReveal()   { /* Task 2 */ }
function setupSoccer()        { /* Task 3 */ }
function setupVolley()        { /* Task 4 */ }
function setupBasket()        { /* Task 5 */ }
function setupGuitar()        { /* Task 6 */ }
function setupProjectReveal() { /* Task 7 */ }
