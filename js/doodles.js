/*
 * doodles.js - the static pencil drawings (skyline, project sketch, margin marks).
 * Drawn once with the Sketch pen. Draw-on is plain CSS (stroke-dashoffset), triggered by a
 * class from main.js - see .doodle / .skyline in style.css.
 */
(function (global) {
  'use strict';
  var S = global.Sketch, s = S.s;
  var INK = S.INK, BLUE = '#2b5aa8', NAVY = '#1b2d52', LEAF = '#5f8a4f', RED = S.RED, PAPER = S.PAPER, WARM = '#d9a441';

  function clear(svg) { while (svg.firstChild) svg.removeChild(svg.firstChild); }

  /* give every stroke a normalised length + a stagger index so CSS can draw it on */
  function drawOn(svg, byX) {
    var i = 0, n = svg.querySelectorAll('path').length || 1;
    svg.querySelectorAll('path').forEach(function (p) {
      if (p.getAttribute('fill') && p.getAttribute('fill') !== 'none') return;
      p.setAttribute('pathLength', '1'); p.classList.add('dr');
      p.style.setProperty('--i', byX ? (p.getAttribute('data-x') || 0) : (i / n).toFixed(3));
      i++;
    });
  }

  /* ---------- the sketched skyline that continues from the photo's window ---------- */
  function skyline(svg) {
    clear(svg);
    var pen = S.Pen(61), r = S.rng(8), base = 226, g = s('g', null, svg);
    var x = -10;
    function seg(x1, y1, x2, y2, w, op) {
      var gr = pen.line(g, x1, y1, x2, y2, { w: w || 2, op: op == null ? 0.7 : op, amp: 1.2, ghost: true });
      gr.querySelectorAll('path').forEach(function (p) { p.setAttribute('data-x', (Math.max(0, x1) / 1600).toFixed(3)); });
    }
    var landmarks = [[470, 'tank'], [840, 'empire'], [1010, 'tank'], [1250, 'spire'], [1470, 'tank']], li = 0, prevTop = base;
    while (x < 1620) {
      /* low-rise on the left so the headline and buttons stay clear; the city rises toward the photo */
      var w = 34 + r() * 56, h = x < 760 ? 22 + r() * 36 : 36 + r() * 78;
      var kind = '';
      if (li < landmarks.length && x >= landmarks[li][0]) { kind = landmarks[li][1]; li++; }
      if (kind === 'spire') { w = 58; h = 186; }
      if (kind === 'empire') { w = 74; h = 142; }
      var top = base - h;
      /* wall up from the previous roof line, roof across */
      seg(x, prevTop, x, top, 2);
      seg(x, top, x + w, top, 2);
      if (kind === 'spire') {
        seg(x + 14, top, x + 14, top - 22, 1.8); seg(x + 14, top - 22, x + 29, top - 52, 1.8); seg(x + 29, top - 52, x + 44, top - 22, 1.8);
        seg(x + 44, top - 22, x + 44, top, 1.8); seg(x + 29, top - 52, x + 29, top - 92, 1.6);
        seg(x + 29, top, x + 29, base, 1.2, 0.35);
      } else if (kind === 'empire') {
        seg(x + 10, top, x + 10, top - 16, 1.8); seg(x + 10, top - 16, x + 64, top - 16, 1.8); seg(x + 64, top - 16, x + 64, top, 1.8);
        seg(x + 22, top - 16, x + 22, top - 32, 1.8); seg(x + 22, top - 32, x + 52, top - 32, 1.8); seg(x + 52, top - 32, x + 52, top - 16, 1.8);
        seg(x + 37, top - 32, x + 37, top - 64, 1.6);
      } else if (kind === 'tank') {
        var tx = x + w * 0.35;
        seg(tx, top, tx, top - 22, 1.4); seg(tx + 22, top, tx + 22, top - 22, 1.4);
        seg(tx - 2, top - 22, tx + 24, top - 22, 1.6); seg(tx - 2, top - 22, tx + 11, top - 34, 1.6); seg(tx + 24, top - 22, tx + 11, top - 34, 1.6);
        seg(tx + 4, top - 8, tx + 18, top - 8, 1.0, 0.45);
      }
      /* a few window ticks */
      var rows = Math.floor(h / 22);
      for (var rr = 1; rr < rows && w > 36; rr++) {
        if (r() < 0.55) seg(x + 8, top + rr * 22, x + w - 8 - r() * 14, top + rr * 22, 1, 0.22);
      }
      prevTop = top;
      x += w;
    }
    seg(x, prevTop, x, base, 2);
    seg(-10, base, 1620, base, 2.4, 0.8);
    drawOn(svg, true);
  }

  /* ---------- little marks on the print ---------- */
  function printMarks(svg, W, H, map) {
    clear(svg);
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    var pen = S.Pen(19);
    var g = s('g', { 'class': 'marks' }, svg);
    /* arrow: sky note -> skyline */
    var b = map.skyArrow, bp = b.map(function (q) { return [q[0] * W, q[1] * H]; });
    pen.curve(g, bp, { w: 2.4, color: NAVY, amp: 1, ghost: false });
    var be = bp[bp.length - 1], bd = bp[bp.length - 2], ba = Math.atan2(be[1] - bd[1], be[0] - bd[0]);
    pen.line(g, be[0], be[1], be[0] - Math.cos(ba - 0.5) * 12, be[1] - Math.sin(ba - 0.5) * 12, { w: 2.4, color: NAVY, ghost: false, amp: 0.2 });
    pen.line(g, be[0], be[1], be[0] - Math.cos(ba + 0.5) * 12, be[1] - Math.sin(ba + 0.5) * 12, { w: 2.4, color: NAVY, ghost: false, amp: 0.2 });
    svg.querySelectorAll('path').forEach(function (p, i) { p.setAttribute('pathLength', '1'); p.classList.add('dr'); p.style.setProperty('--i', (i / 6).toFixed(2)); });
  }

  function scribble(svg, color) {
    clear(svg);
    var pen = S.Pen(5);
    pen.curve(svg, [[4, 24], [70, 12], [130, 30], [200, 16], [270, 28], [330, 14], [396, 24]], { w: 5, color: color || BLUE, amp: 1.2, ghost: false });
    svg.querySelectorAll('path').forEach(function (p) { p.setAttribute('pathLength', '1'); p.classList.add('dr'); p.setAttribute('vector-effect', 'non-scaling-stroke'); });
  }

  /* ---------- Now: a seedling ---------- */
  function sprout(svg) {
    clear(svg);
    var pen = S.Pen(27), g = s('g', null, svg);
    pen.curve(g, [[22, 176], [60, 172], [100, 177], [140, 174]], { w: 2.4, op: 0.8 });
    for (var i = 0; i < 7; i++) pen.line(g, 34 + i * 16, 180, 28 + i * 16, 190, { w: 1.4, op: 0.4, ghost: false, amp: 0.4 });
    pen.curve(g, [[82, 174], [80, 150], [84, 126], [80, 98]], { w: 3, color: LEAF, amp: 0.8 });
    var leaf1 = 'M80 130 C54 128 38 110 38 88 C62 88 82 104 80 130 Z';
    var leaf2 = 'M82 112 C106 108 124 90 124 66 C100 66 80 86 82 112 Z';
    var leaf3 = 'M80 98 C70 82 74 62 88 50 C98 66 94 86 80 98 Z';
    [leaf1, leaf2, leaf3].forEach(function (d, i) {
      s('path', { d: d, fill: LEAF, opacity: 0.16, stroke: 'none' }, g);
      pen.fillShape(g, d, 'none', { w: 2.4, color: LEAF, ghost: true });
    });
    pen.curve(g, [[78, 126], [62, 112], [48, 96]], { w: 1.4, color: LEAF, op: 0.7, ghost: false });
    pen.curve(g, [[84, 108], [100, 96], [116, 76]], { w: 1.4, color: LEAF, op: 0.7, ghost: false });
    drawOn(svg);
  }

  /* ---------- empty project frame ---------- */
  function blank(svg) {
    clear(svg);
    var pen = S.Pen(41);
    pen.rect(svg, 10, 10, 180, 110, { w: 1.8, op: 0.55, amp: 1.2 });
    pen.line(svg, 82, 66, 118, 66, { w: 1.8, op: 0.5, ghost: false });
    pen.line(svg, 100, 48, 100, 84, { w: 1.8, op: 0.5, ghost: false });
  }

  /* ---------- BountifulCSAs sketchnote ---------- */
  function csa(svg) {
    clear(svg);
    var pen = S.Pen(73), g = s('g', null, svg);
    function label(x, y, str, size, color, anchor, rot) {
      var t = s('text', { x: x, y: y, 'font-family': "'Reenie Beanie', cursive", 'font-size': size || 28, fill: color || INK, 'text-anchor': anchor || 'start' }, g);
      if (rot) t.setAttribute('transform', 'rotate(' + rot + ' ' + x + ' ' + y + ')');
      t.textContent = str; return t;
    }
    /* A: buyers sign up + recurring payment */
    label(34, 62, 'buyers sign up', 30, NAVY, 'start', -2);
    pen.ellipse(g, 66, 112, 15, 15, { w: 2.4 });
    pen.line(g, 66, 127, 66, 176, { w: 2.6 });
    pen.poly(g, [[66, 142], [46, 164]], { w: 2.4 }); pen.poly(g, [[66, 142], [88, 160]], { w: 2.4 });
    pen.poly(g, [[66, 176], [52, 212]], { w: 2.6 }); pen.poly(g, [[66, 176], [82, 212]], { w: 2.6 });
    pen.rect(g, 108, 130, 74, 46, { w: 2.4 });
    pen.line(g, 108, 146, 182, 146, { w: 5, color: INK, ghost: false, amp: 0.3 });
    pen.line(g, 118, 162, 150, 162, { w: 2, op: 0.6, ghost: false });
    pen.curve(g, [[138, 106], [158, 90], [182, 98], [190, 116]], { w: 2.4, color: BLUE, ghost: false });
    pen.line(g, 190, 116, 181, 110, { w: 2.4, color: BLUE, ghost: false, amp: 0.1 }); pen.line(g, 190, 116, 196, 107, { w: 2.4, color: BLUE, ghost: false, amp: 0.1 });
    label(146, 80, 'every week', 24, BLUE, 'middle', -4);

    /* B: demand per crop */
    label(262, 50, 'demand, per crop', 30, NAVY, 'start', 1.5);
    pen.line(g, 262, 196, 262, 76, { w: 2.2 }); pen.line(g, 262, 196, 440, 196, { w: 2.2 });
    var bars = [[282, 84, 'carrots', WARM], [334, 118, 'kale', LEAF], [386, 100, 'tomatoes', RED]];
    bars.forEach(function (b) {
      var h = 196 - b[1] + 0;
      var hh = b[1] === 84 ? 60 : b[1] === 118 ? 90 : 76;
      pen.rect(g, b[0], 196 - hh, 34, hh, { w: 2.2, amp: 0.8 });
      s('rect', { x: b[0] + 1, y: 196 - hh + 1, width: 32, height: hh - 2, fill: b[3], opacity: 0.2 }, g);
      pen.hatch(g, b[0] + 3, 196 - hh + 4, 28, hh - 8, 7, 55, { w: 1, op: 0.28, color: b[3] });
      label(b[0] + 17, 222, b[2], 22, INK, 'middle');
    });
    pen.curve(g, [[274, 150], [330, 138], [372, 104], [436, 84]], { w: 2.8, color: BLUE, amp: 0.8, ghost: false }).setAttribute('class', 'forecast');
    s('path', { d: 'M436 84 l-12 1 M436 84 l-6 10', stroke: BLUE, 'stroke-width': 2.8, fill: 'none', 'stroke-linecap': 'round' }, g);
    label(446, 72, 'forecast', 24, BLUE, 'end', -3);

    /* C: the box goes out */
    label(488, 62, 'boxes go out', 30, NAVY, 'start', 2);
    pen.poly(g, [[486, 132], [582, 132], [572, 206], [496, 206]], { w: 2.6, closed: true });
    pen.line(g, 486, 132, 482, 118, { w: 2.2 }); pen.line(g, 582, 132, 590, 118, { w: 2.2 });
    pen.line(g, 482, 118, 590, 118, { w: 2.2 });
    var c;
    for (c = 0; c < 3; c++) { /* carrots */
      pen.poly(g, [[498 + c * 14, 130], [506 + c * 14, 130], [503 + c * 14, 96]], { w: 2, color: WARM, closed: true, ghost: false });
      pen.curve(g, [[502 + c * 14, 96], [498 + c * 14, 84]], { w: 2, color: LEAF, ghost: false }); pen.curve(g, [[503 + c * 14, 96], [508 + c * 14, 86]], { w: 2, color: LEAF, ghost: false });
    }
    pen.ellipse(g, 556, 112, 14, 13, { w: 2.4, color: RED, ghost: false }); pen.curve(g, [[550, 100], [556, 96], [562, 100]], { w: 2, color: LEAF, ghost: false });
    pen.ellipse(g, 532, 120, 13, 11, { w: 2.2, color: LEAF, ghost: false });
    label(534, 238, 'fresh, local', 24, INK, 'middle', -2);

    /* arrows between the three beats */
    function arrow(pts, col) {
      pen.curve(g, pts, { w: 2.4, color: col || BLUE, ghost: false, amp: 0.8 });
      var e = pts[pts.length - 1], d = pts[pts.length - 2], a = Math.atan2(e[1] - d[1], e[0] - d[0]);
      pen.line(g, e[0], e[1], e[0] - Math.cos(a - 0.5) * 12, e[1] - Math.sin(a - 0.5) * 12, { w: 2.4, color: col || BLUE, ghost: false, amp: 0.1 });
      pen.line(g, e[0], e[1], e[0] - Math.cos(a + 0.5) * 12, e[1] - Math.sin(a + 0.5) * 12, { w: 2.4, color: col || BLUE, ghost: false, amp: 0.1 });
    }
    arrow([[198, 186], [220, 200], [244, 196]]);
    arrow([[446, 150], [462, 166], [480, 168]]);

    /* before / after strip */
    pen.curve(g, [[30, 272], [200, 280], [420, 270], [610, 276]], { w: 1.6, op: 0.4, ghost: false });
    label(34, 318, 'before', 26, INK, 'start', -2);
    pen.rect(g, 36, 334, 54, 38, { w: 2.2 }); pen.poly(g, [[36, 334], [63, 354], [90, 334]], { w: 2 });
    pen.poly(g, [[112, 332], [170, 332], [170, 366], [136, 366], [122, 380], [124, 366], [112, 366]], { w: 2.2, closed: true });
    pen.line(g, 22, 326, 182, 384, { w: 3.4, color: RED, ghost: false, amp: 1.4 });
    pen.line(g, 182, 326, 22, 384, { w: 3.4, color: RED, ghost: false, amp: 1.4 });
    label(104, 408, 'email + text threads', 24, INK, 'middle', -1);
    arrow([[196, 356], [226, 346], [262, 352]]);
    label(286, 318, 'after', 26, BLUE, 'start', -2);
    pen.rect(g, 288, 330, 316, 72, { w: 2.4 });
    pen.line(g, 288, 348, 604, 348, { w: 1.8 });
    [304, 316, 328].forEach(function (cx) { pen.ellipse(g, cx, 339, 3, 3, { w: 1.4, ghost: false, amp: 0.2 }); });
    pen.rect(g, 304, 358, 82, 32, { w: 1.6, op: 0.7, ghost: false }); pen.rect(g, 398, 358, 82, 32, { w: 1.6, op: 0.7, ghost: false }); pen.rect(g, 492, 358, 98, 32, { w: 1.6, op: 0.7, ghost: false });
    label(345, 380, 'buyers', 20, INK, 'middle'); label(439, 380, 'crops', 20, INK, 'middle'); label(541, 380, 'messages', 20, INK, 'middle');
    drawOn(svg);
  }

  global.Doodles = { skyline: skyline, printMarks: printMarks, scribble: scribble, sprout: sprout, blank: blank, csa: csa, drawOn: drawOn };
})(window);
