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
compositing, so it can exercise the `view-timeline` scrub path. It still has **no real
GPU** (software raster) - it cannot reproduce the captain's compositing / fill-rate /
ProMotion cost; use it for JS/main-thread behaviour and 1:1-tracking checks, not final
smoothness sign-off. Drive real `page.mouse.wheel()` / rAF `scrollBy` momentum bursts,
never `scrollTo` jumps, when measuring scroll feel.

## Animation library boundary (GSAP vs anime.js)

Matter.js was removed (soccer's click-to-shoot minigame it existed for was replaced by a
decorative scroll-scrub accent); don't reintroduce a physics engine without a real
collision-response need. MotionPathPlugin was removed when soccer's ball moved to CSS
`offset-path`; nothing else used it. Libraries in play, each with a fixed job:
- **Native CSS scroll-driven animation** (`view-timeline` + `animation-timeline`): both
  decorative scroll-scrub sections (soccer, basketball) - ball `offset-path`/
  `offset-distance`, chalk trail, parallax, the whole-figure jump translate, and the stick
  figure's joint rotations. `@keyframes` are generated in JS by
  `ScrubVignette.buildScrubStylesheet()` in `scrub-vignette.js` from `hermiteSpline` +
  per-section pose data + `releaseT`. This is the go-forward pattern for decorative-accent
  scroll sections (guitar when/if it gets there).
- **GSAP + ScrollTrigger**: hero entrance, section scroll-reveals, nav dot, and each
  scrub section's one-shot contact accents (`netPulse`/`netSway`, fired by a scrub-free
  ScrollTrigger progress watcher). NOT the scrub itself.
- **anime.js v4** (UMD global `anime.animate`/`anime.stagger`/`anime.utils`/`anime.remove`,
  not v3's single `anime()` call or v4's ESM named exports): sprite-level tweens that must
  land at an exact deterministic target, e.g. the contact-moment ink flourish
  (`impactFlourish()` in `main.js`, used by both scrub sections).

## Scroll-scrub sections: `scrub-vignette.js` + thin per-section `setup*`

`#sec-soccer` (a figure kicks into the goal) and `#sec-basket` (a figure rises for a jump
shot) are pinned (`.section--pinned`, CSS `position: sticky`), non-interactive scroll-scrub
accents - not the click/hover minigames PR #1 shipped. Guitar is still the hover-pluck
minigame and reuses only the low-level helpers if it ever becomes scroll-linked.

The section-agnostic machinery lives once in **`scrub-vignette.js`** (plain IIFE, one
global `window.ScrubVignette`, loaded before `main.js`): `hermiteSpline`, `easeOutOfRest`,
`worldPose`/`FIGURE_JOINTS`, `buildStickFigure` (the 11-pivot humanoid + a `fk(t)` forward-
kinematics readout), `buildScrubStylesheet` (pose/path data -> `@keyframes` text),
`pinnedScrubFallback` + channel factories (the JS rAF 1:1 driver), `svgTransformDriver`/
`svgRotationDriver`, `supportsScrollDrivenAnimation`. `setupSoccer` / `setupBasket` in
`main.js` are thin: draw a scene, define poses + a projectile path, call the helpers. A new
scroll section plugs in the same way - do not re-inline or fork this code.

Sharp edges:
- Each pinned section declares its own `view-timeline-name` (`--soccer-tl` / `--basket-tl`)
  in `style.css`; `.section--pinned` only carries the shared `view-timeline-axis`. The
  timeline's `contain` range is *exactly* the CSS-sticky pin window, so pin geometry still
  matters. The single `.section__pin` wrapper (child of `.section--pinned`, parent of
  `.section__anim`/`.section__content`) carries `position: sticky` so the two overlay.
  Making them independently sticky siblings breaks this. `position: sticky` breaks silently
  if any ancestor between `.section__pin` and the scroller gets `overflow` other than
  `visible` (`.section--pinned` overrides the base `.section`'s `overflow: hidden`); a
  `view-timeline` NAME lookup is *not* broken by ancestor overflow, so `.section__anim`'s
  `overflow: hidden` is fine. Don't reintroduce `overflow: hidden` on `.section--pinned`.
- **The projectile's flight must never start before the figure's release pose resolves**
  (`SOCCER_RELEASE_T` = `SOCCER_T.contact`; `BASKET_RELEASE_T` = `BASKET_T.apex`) - a
  captain-review-caught regression class. The generated ball/trail keyframes hold flat
  until `releaseT`; keep it gated to the same constant if you retime.
- `pinnedScrubFallback` (gated on `supportsScrollDrivenAnimation()`) must keep driving the
  identical motion - it neutralises the inert CSS animations with `animation: none` and
  writes only compositor properties. `svg.dataset.driver` is `'native'` or `'fallback'`.
- Verify a `setup*` refactor is behaviour-preserving by diffing the generated `<style>`
  text and the scene SVG structure old vs new, then re-running a real wheel-momentum scroll
  check (scout harness pattern; shipped soccer native ball-accel p90 ~2-5px).

### "figure holds then throws a projectile" - the ball-follows-hand pattern

Basketball's ball stays locked to the shooting hand through `stand -> gather -> rise`, then
detaches at `BASKET_RELEASE_T` and arcs on `offset-path`. Mechanism (captain refinement -
the ball must be *the same point* as the hand, not a separately-authored carry path that
drifts): a `.ball-carry` wrapper `<g>` gets a `translate` track of `fk(t).hand1 -
releasePoint` (read straight off `buildStickFigure`'s forward kinematics), while the inner
`.ball-group` sits at `offset-distance: 0%` (= the first point of the arc = the release
point). At `releaseT` the carry translate is exactly `[0,0]`, so the handoff onto the arc
has no positional jump - on both the native and fallback paths. Soccer is the degenerate
case (no carry: the ball just waits at offset-distance 0%). Reuse this shape for any future
"figure holds X then releases it" scroll vignette.

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

### Both scrub sections use native CSS scroll-driven animation (the go-forward pattern)

Per-section `view-timeline` + JS-generated `@keyframes` bound to it
(`ScrubVignette.buildScrubStylesheet()` in `scrub-vignette.js`); the compositor advances
motion 1:1 with scroll, structurally immune to scrub lag. `ScrubVignette.pinnedScrubFallback`
is the tested JS rAF 1:1 driver for engines without support. Ball = `offset-path`/
`offset-distance` (+ a `.ball-carry` translate wrapper for basketball's hold); figure
joints = generated `rotate` keyframes; parallax / jump = `translate` keyframes. Extend this
module to guitar rather than reviving any bespoke inline scrub helper.

### `hermiteSpline(knots)` (in `scrub-vignette.js`) - keep using it for multi-pose scrub values

Given `[{t, v}, ...]` sorted by `t`, returns a function of scroll fraction evaluating a
clamped cubic Hermite spline through every knot, with matched value *and* velocity at
each interior knot by construction. Round 3 found the kicker's old 3-tween chain
(`windup`/`contact`/`follow`, each its own ease) was value-continuous but not
velocity-continuous - a ~5.7deg jump per 0.0005-progress step right at the contact moment,
read as stop-motion. `hermiteSpline` fixes it by construction; sampling it into ~48
`@keyframes`/joint preserves the guarantee. Retiming a section's `*_POSES`/`*_T` and
regenerating reproduces it automatically. Poses can be authored parent-relative (soccer,
`SOCCER_POSES`, historical numbers) or in world angles via `ScrubVignette.worldPose`
(basketball, `BASKET_POSES`; also what makes `fk` reason about world angles cleanly).

### SVG `transform` *attribute* writes are expensive per-frame; live wobble filters cost GPU

GSAP always writes SVG `<g>`/`<path>` transforms via the `transform` *attribute* (not CSS
`transform` *style*, unaffected by `transformOrigin`), triggering Blink's SVG layout
invalidation on every write - a real per-frame cost across a scroll range.
`ScrubVignette.svgTransformDriver(el)` / `svgRotationDriver(el, deg)` tween a proxy object
and apply via the CSS `transform` *style* instead; used by the one-shot `netPulse`/
`netSway`, kept available for guitar. The CSS scroll-driven happy path and the fallback
channels sidestep this entirely (CSS `rotate`/`translate`/`transform` *style*, never the
attribute). Also: don't animate `stroke-dashoffset` on a *filtered* path, and
never run a rough.js regen (`settleRedraw` was removed) while a scroll may be active - it
fired mid-arc as a synchronous main-thread task. The three `feTurbulence`/
`feDisplacementMap` wobble filters were removed with this change (real per-frame GPU
re-raster on the captain's hardware); the hand-drawn look is now a static rough.js pass
drawn once.

### This sandbox cannot validate GPU/compositing cost

Headless Chromium here is software-rendered - no real GPU, no ProMotion timing, no macOS
momentum cadence. It repeatedly showed a clean main-thread trace while the captain's
choppiness complaint persisted through rounds 2-3. It CAN verify: 1:1 tracking (ball
per-frame move / accel / velocity CV), the `releaseT` gate, ball-follows-hand coincidence
(sample `.j-arm1_f` `getScreenCTM()` vs the ball bbox), keyframe continuity, the fallback
path, no dropped frames, no console errors. It CANNOT sign off scroll *feel* - that's the
captain's test on their Mac. Also: setting `.progress()` directly bypasses the scroll
driver's update cycle - use real wheel/`scrollBy`-momentum gestures.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
