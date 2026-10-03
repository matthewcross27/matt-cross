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
  /* MediaQueryList.addEventListener is missing on older Safari; fall back to the legacy addListener */
  function onMq(mq, fn) { if (mq.addEventListener) mq.addEventListener('change', fn); else if (mq.addListener) mq.addListener(fn); }

  /* ---------- hero: skyline, scribble, marks on the print, the sketched Matt ---------- */

  var MARKS = {
    land: {
      W: 400, H: 300,
      skyArrow: [[0.52, 0.42], [0.56, 0.45], [0.57, 0.52]],
      sky: [0.33, 0.2]
    },
    port: {
      W: 400, H: 500,
      skyArrow: [[0.62, 0.41], [0.66, 0.46], [0.64, 0.55]],
      sky: [0.4, 0.27]
    }
  };

  function layoutMarks() {
    var m = narrow.matches ? MARKS.port : MARKS.land, photo = $('.hero .print__photo');
    if (!photo) return;
    var svg = $('.print__marks', photo), sky = $('.note--sky', photo);
    if (!svg || !sky) return;
    D.printMarks(svg, m.W, m.H, m);
    sky.style.left = m.sky[0] * 100 + '%'; sky.style.top = m.sky[1] * 100 + '%';
  }

  function setupHero() {
    if ($('.skyline')) D.skyline($('.skyline'));
    if ($('.hero__scribble')) D.scribble($('.hero__scribble'));
    layoutMarks();
    if (!$('.print__sketch')) return;
    var sk = SC.hero($('.print__sketch'));
    built.hero = sk;
    if (reduce.matches) sk.scene.still(1); else sk.scene.timed({ duration: 2600, delay: 1050 });
    onMq(narrow, layoutMarks);
  }

  /* ---------- margin + project doodles ---------- */

  function setupDoodles() {
    if ($('.now__doodle')) D.sprout($('.now__doodle'));
    if ($('.doodle--csa')) D.csa($('.doodle--csa'));
    $$('.doodle--blank').forEach(D.blank);
    var line = $('.contact__underline');
    if (line) D.scribble(line, '#2b5aa8');
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
      onMq(narrow, fit);
      if (reduce.matches) r.scene.still(); else r.scene.scroll({ forceFallback: forceFallback });
    });
  }

  /* ---------- reveals ---------- */

  function setupReveal() {
    var root = document.documentElement, els = $$('.reveal');
    /* Content is only ever hidden by the .js-reveal class below, which is added here, once the observer exists,
       and removed again if anything goes wrong. Without it every .reveal element is plain visible content. */
    if (!els.length || !('IntersectionObserver' in window) || reduce.matches) {
      els.forEach(function (e) { e.classList.add('is-in'); });
      return;
    }
    var fired = false, seen = 0;
    var io = new IntersectionObserver(function (entries) {
      fired = true;
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); seen++; }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    els.forEach(function (e) { io.observe(e); });
    root.classList.add('js-reveal');
    /* belt and braces: if the observer never reports (odd browsers, throttled tabs), show everything */
    function showAll() { io.disconnect(); root.classList.remove('js-reveal'); els.forEach(function (e) { e.classList.add('is-in'); }); }
    setTimeout(function () { if (!fired) showAll(); }, 2500);
    window.addEventListener('error', function () { if (!root.classList.contains('is-ready')) showAll(); });
  }

  /* ---------- nav ---------- */

  function setupNav() {
    var bar = $('#bar'), links = {};
    if (!bar) return;
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
    if (hero) new IntersectionObserver(function (es) {
      if (es[0].isIntersecting) for (var k in links) links[k].removeAttribute('aria-current');
    }, { rootMargin: '-45% 0px -50% 0px' }).observe(hero);
  }

  /* Each step is independent and null-safe: a failure in one (a missing element, a stale cached script
     against newer HTML, an unsupported API) must never stop the page's content from showing. Reveal runs
     first and is the only thing that ever hides content, so it is also the first to be made safe. */
  function step(name, fn) {
    try { fn(); } catch (err) { if (window.console) console.error('[site] ' + name + ' failed:', err); }
  }
  step('reveal', setupReveal);
  step('nav', setupNav);
  step('hero', setupHero);
  step('doodles', setupDoodles);
  step('scenes', setupScenes);
  document.documentElement.classList.add('is-ready');
})();
