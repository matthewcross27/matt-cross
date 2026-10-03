/*
 * main.js - wiring only. Drawing lives in sketch.js / scenes.js / doodles.js, motion rules in style.css.
 *   - build the hero doodles and the three interest scenes
 *   - drive each scene: native scroll timeline (CSS) with a rAF fallback, or a still frame for reduced motion
 *   - reveal-on-scroll, nav state, header state
 */
(function () {
  'use strict';

  var S = window.Sketch, D = window.Doodles, SC = window.Scenes;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var narrow = window.matchMedia('(max-width: 700px)');
  var forceFallback = /[?&]driver=js/.test(location.search);
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var built = window.__scenes = {};

  /* ---------- hero: skyline, scribble, marks on the print, the sketched Matt ---------- */

  var MARKS = {
    land: {
      W: 400, H: 300, ring: [0.215, 0.665], ringR: [0.05, 0.085],
      skyArrow: [[0.52, 0.42], [0.56, 0.45], [0.57, 0.52]],
      sky: [0.33, 0.2]
    },
    port: {
      W: 400, H: 500, ring: [0.2525, 0.665], ringR: [0.072, 0.052],
      skyArrow: [[0.62, 0.41], [0.66, 0.46], [0.64, 0.55]],
      sky: [0.4, 0.27]
    }
  };

  function layoutMarks() {
    var m = narrow.matches ? MARKS.port : MARKS.land, photo = $('.hero .print__photo');
    if (!photo) return;
    var svg = $('.print__marks', photo), sky = $('.note--sky', photo);
    D.printMarks(svg, m.W, m.H, m);
    sky.style.left = m.sky[0] * 100 + '%'; sky.style.top = m.sky[1] * 100 + '%';
  }

  function setupHero() {
    D.skyline($('.skyline'));
    D.scribble($('.hero__scribble'));
    layoutMarks();
    var sk = SC.hero($('.print__sketch'));
    built.hero = sk;
    if (reduce.matches) sk.scene.still(1); else sk.scene.timed({ duration: 2600, delay: 1050 });
    narrow.addEventListener('change', layoutMarks);
  }

  /* ---------- margin + project doodles ---------- */

  function setupDoodles() {
    D.sprout($('.now__doodle'));
    D.csa($('.doodle--csa'));
    $$('.doodle--blank').forEach(D.blank);
    var line = $('.contact__underline');
    if (line) D.scribble(line, '#2b5aa8');
    $('.now__doodle').classList.add('reveal');
  }

  /* ---------- the interest scenes ---------- */

  function setupScenes() {
    $$('svg[data-scene]').forEach(function (svg) {
      var name = svg.getAttribute('data-scene'), stage = svg.parentNode;
      var r = SC[name](svg, stage);
      built[name] = r;
      var wide = svg.getAttribute('viewBox');
      function fit() { svg.setAttribute('viewBox', narrow.matches && r.viewNarrow ? r.viewNarrow : wide); }
      fit();
      narrow.addEventListener('change', fit);
      if (reduce.matches) r.scene.still(); else r.scene.scroll({ forceFallback: forceFallback });
    });
  }

  /* ---------- reveals ---------- */

  function setupReveal() {
    var els = $$('.reveal');
    if (!('IntersectionObserver' in window) || reduce.matches) {
      els.forEach(function (e) { e.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    els.forEach(function (e) { io.observe(e); });
  }

  /* ---------- nav ---------- */

  function setupNav() {
    var bar = $('#bar'), links = {};
    $$('[data-spy]').forEach(function (a) { links[a.getAttribute('data-spy')] = a; });
    var ticking = false;
    function onScroll() {
      ticking = false;
      bar.classList.toggle('is-stuck', window.scrollY > 24);
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
    }, { passive: true });
    onScroll();
    if (!('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        for (var k in links) {
          if (k === en.target.id) links[k].setAttribute('aria-current', 'true');
          else links[k].removeAttribute('aria-current');
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    ['now', 'work', 'about', 'contact'].forEach(function (id) { var el = document.getElementById(id); if (el) io.observe(el); });
    var hero = $('#top');
    new IntersectionObserver(function (es) {
      if (es[0].isIntersecting) for (var k in links) links[k].removeAttribute('aria-current');
    }, { rootMargin: '-45% 0px -50% 0px' }).observe(hero);
  }

  setupHero();
  setupDoodles();
  setupScenes();
  setupReveal();
  setupNav();
  document.documentElement.classList.add('is-ready');
})();
