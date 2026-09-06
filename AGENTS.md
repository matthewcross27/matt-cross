# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- Add durable project-specific notes here as they are discovered through real work.

## Real-browser testing in this sandbox

`chrome-devtools-axi` (and the underlying `chrome-devtools-mcp`) do not work in this
worktree environment: no Chrome/Chromium is installed. Both of these DO work (network
access to jsdelivr/npm/Google's Chrome-for-Testing CDN is available); install into an
explicit scratch path because the default caches get wiped between calls:

```sh
# option A (verified current): Playwright + its Chromium
npm install playwright --no-save
PLAYWRIGHT_BROWSERS_PATH=<scratch>/pw-browsers npx playwright install chromium
# option B: puppeteer-core + Chrome-for-Testing
npx -y @puppeteer/browsers install chrome@stable --path /tmp/chrome-install
```
Serve the site first with a plain static server (`python3 -m http.server`). Playwright's
default Chromium (`headless: true`) does support CSS scroll-driven animation and
compositing, so it can exercise soccer's `view-timeline` path. It still has **no real
GPU** (software raster) - it cannot reproduce the captain's compositing / fill-rate /
ProMotion cost; use it for JS/main-thread behaviour and 1:1-tracking checks, not final
smoothness sign-off. Drive real `page.mouse.wheel()` / rAF `scrollBy` momentum bursts,
never `scrollTo` jumps, when measuring scroll feel.

## Animation library boundary (GSAP vs anime.js)

Matter.js was removed (soccer's click-to-shoot minigame it existed for was replaced by a
decorative scroll-scrub accent); don't reintroduce a physics engine without a real
collision-response need. MotionPathPlugin was removed when soccer's ball moved to CSS
`offset-path`; nothing else used it. Libraries in play, each with a fixed job:
- **Native CSS scroll-driven animation** (`view-timeline` + `animation-timeline`): the
  soccer scroll-scrub - ball `offset-path`/`offset-distance`, chalk trail, parallax, and
  the kicker figure's joint rotations. `@keyframes` are generated in JS from
  `hermiteSpline` / `KICK_POSES` / `CONTACT_T` (`buildSoccerScrubCSS()` in `main.js`).
  This is the go-forward pattern for decorative-accent scroll sections (basketball/guitar
  when they get there).
- **GSAP + ScrollTrigger**: hero entrance, section scroll-reveals, nav dot, each
  minigame's scroll-triggered roll-in/roll-out, and soccer's one-shot contact accents
  (`netPulse`, fired by a scrub-free ScrollTrigger progress watcher). NOT soccer's scrub
  itself anymore.
- **anime.js v4** (UMD global `anime.animate`/`anime.stagger`/`anime.utils`/`anime.remove`,
  not v3's single `anime()` call or v4's ESM named exports): sprite-level tweens that must
  land at an exact deterministic target, e.g. soccer's contact-moment ink flourish
  (`impactFlourish()` in `main.js`).

## Soccer section: decorative scroll-scrub, not a minigame

`#sec-soccer` is a pinned (`.section--pinned`, CSS `position: sticky`), non-interactive
scroll-scrub accent (`setupSoccer()` in `main.js`) - not a click-to-shoot minigame; that
was PR #1's shipped version, later replaced. Sharp edges if you touch this section:
- The section's motion is driven by a native CSS `view-timeline` declared on
  `.section--pinned` (see `style.css`); `buildSoccerScrubCSS()` generates the
  `@keyframes` + `animation-timeline: --soc-tl` rules bound to it. `setupSoccerFallback()`
  is a JS rAF 1:1 driver for engines without support (gated on
  `CSS.supports('animation-timeline','scroll()')`) - keep it working; it neutralises the
  CSS animations with inline `animation: none` and reuses
  `svgTransformDriver`/`svgRotationDriver`.
- The timeline's `contain` range is *exactly* the CSS-sticky pin window, so the pin
  geometry still matters. The single `.section__pin` wrapper (child of `.section--pinned`,
  parent of `.section__anim`/`.section__content`) carries the `position: sticky`, so the
  two overlay each other like in every unpinned `.section`. Making them independently
  sticky siblings breaks this - each reserves its own static-flow box. `position: sticky`
  breaks silently if any ancestor between `.section__pin` and the scrolling container gets
  `overflow` other than `visible` (`.section--pinned` overrides the base `.section`'s
  `overflow: hidden` for this); a `view-timeline` NAME lookup is not broken by ancestor
  overflow, so `.section__anim`'s `overflow: hidden` is fine. Don't reintroduce
  `overflow: hidden` on `.section--pinned` without rechecking the pin holds across the
  full scroll range.
- The ball's flight must never start before the kicker figure's `contact` pose resolves
  (`CONTACT_T` = `KICK_T.contact` in `setupSoccer()`) - a captain-review-caught regression
  class. The generated ball/trail/shadow keyframes hold flat until `CONTACT_T`; keep it
  that way (and gated to the same constant) if you retime the kick.
- Basketball and guitar are intentionally still the older click/hover minigame pattern;
  the decorative-accent direction is not yet extended to them, but should reuse the CSS
  scroll-driven pattern and the notes below when it is.

## Scroll-scrub performance

### A numeric ScrollTrigger `scrub` is a catch-up smoother, NOT a 1:1 scroll link

`scrub: 0.35` (etc.) eases the timeline toward the scroll position over ~N seconds
instead of tracking it. On a fast trackpad flick that means the scene renders up to ~15%
of the timeline behind scroll and keeps animating 150-350ms after input stops (the
"lag"), and rendered per-frame velocity over/undershoots ~±50% even on perfectly smooth
input (the "stop-motion" look). This was the root cause of soccer's laggy-scroll /
jumpy-ball reports through PRs #1-2 and three follow-up rounds - none of which touched the
`scrub` mechanism. **For a decorative scrub, never use a raw numeric `scrub`.** Prefer
native CSS scroll-driven animation (what soccer now does), else `scrub: true` (strict
1:1), else a *capped* rAF lerp if a deliberate glide-to-stop is wanted.

### Soccer now uses native CSS scroll-driven animation (the go-forward pattern)

`view-timeline` on `.section--pinned` + JS-generated `@keyframes` bound to it
(`buildSoccerScrubCSS()`); the compositor advances motion 1:1 with scroll, structurally
immune to scrub lag. `setupSoccerFallback()` is the tested JS rAF 1:1 driver for engines
without support. Ball = `offset-path`/`offset-distance`; kicker joints = generated
`rotate` keyframes; parallax = `translate` keyframes. Extend this to basketball/guitar
rather than reviving the old GSAP `createPinnedScrub` helper (deleted with this change).

### `hermiteSpline(knots)` - keep using it for multi-pose scrub values

Given `[{t, v}, ...]` sorted by `t`, returns a function of scroll fraction evaluating a
clamped cubic Hermite spline through every knot, with matched value *and* velocity at
each interior knot by construction. Round 3 found the kicker's old 3-tween chain
(`windup`/`contact`/`follow`, each its own ease) was value-continuous but not
velocity-continuous - a ~5.7deg jump per 0.0005-progress step right at the contact moment,
read as stop-motion. `hermiteSpline` fixes it by construction; sampling it into ~48
`@keyframes`/joint preserves the guarantee (max residual velocity kink ~0.5deg/0.0005,
spread evenly, not spiked at contact - re-verified when the keyframes were introduced).
Retiming `KICK_POSES`/`KICK_T` and regenerating reproduces it automatically.

### SVG `transform` *attribute* writes are expensive per-frame; live wobble filters cost GPU

GSAP always writes SVG `<g>`/`<path>` transforms via the `transform` *attribute* (not CSS
`transform` *style*, unaffected by `transformOrigin`), triggering Blink's SVG layout
invalidation on every write - a real per-frame cost across a scroll range.
`svgTransformDriver(el)` / `svgRotationDriver(el, deg)` in `main.js` tween a proxy object
and apply via the CSS `transform` *style* instead; kept for the JS fallback and for
basketball/guitar. The CSS scroll-driven happy path sidesteps this entirely (no per-frame
JS transform write). Also: don't animate `stroke-dashoffset` on a *filtered* path, and
never run a rough.js regen (`settleRedraw` was removed) while a scroll may be active - it
fired mid-arc as a synchronous main-thread task. The three `feTurbulence`/
`feDisplacementMap` wobble filters were removed with this change (real per-frame GPU
re-raster on the captain's hardware); the hand-drawn look is now a static rough.js pass
drawn once.

### This sandbox cannot validate GPU/compositing cost

Headless Chromium here is software-rendered - no real GPU, no ProMotion timing, no macOS
momentum cadence. It repeatedly showed a clean main-thread trace while the captain's
choppiness complaint persisted through rounds 2-3. It CAN verify: 1:1 tracking (ball
per-frame move / accel / velocity CV), the `CONTACT_T` gate, keyframe continuity, the
fallback path, no dropped frames, no console errors. It CANNOT sign off scroll *feel* -
that's the captain's test on their Mac. Also: setting `.progress()` directly bypasses the
scroll driver's update cycle, so it tests the position *function* but not scroll feel -
use real wheel/`scrollBy`-momentum gestures for the latter.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
