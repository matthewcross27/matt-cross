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
- **Native CSS / compositor-driven keyframe animation**: all three decorative scroll-scrub
  sections (soccer, basketball, guitar) and the hero's looping idle wave. `@keyframes` are
  generated in JS in `scrub-vignette.js` from `hermiteSpline` + pose data and bound
  either to a `view-timeline` (the scrub sections, via `ScrubVignette.buildScrubStylesheet()`
  - ball `offset-path`/`offset-distance`, trail, parallax, jump/traverse translate, turn
  rotate + scale, joint rotations, gated on `releaseT`) or to a wall clock with
  `animation: … linear infinite` (the hero, via `ScrubVignette.buildLoopStylesheet()`).
  Both paths keep motion off the main thread. This is the settled pattern for
  decorative-accent sections - all three hobby sections now use it.
- **GSAP + ScrollTrigger**: hero entrance, section scroll-reveals, nav dot, and each
  scrub section's one-shot contact accents (`netPulse`/`netSway`, fired by a scrub-free
  ScrollTrigger progress watcher). NOT the scrub itself.
- **anime.js v4** (UMD global `anime.animate`/`anime.stagger`/`anime.utils`/`anime.remove`,
  not v3's single `anime()` call or v4's ESM named exports): sprite-level tweens that must
  land at an exact deterministic target, e.g. the contact-moment ink flourish
  (`impactFlourish()` in `main.js`, used by soccer + basketball).

## `scrub-vignette.js` + thin per-section `setup*` (four figures, one rig)

`#sec-soccer` (a figure kicks into the goal), `#sec-basket` (a figure rises for a jump
shot) and `#sec-guitar` (a guitarist crosses the frame and turns once) are pinned
(`.section--pinned`, CSS `position: sticky`), non-interactive scroll-scrub accents - not
the click/hover minigames PR #1 shipped. The **hero** figure (`.hero__figure`, `setupHero`
in `main.js`) is the same stick-figure rig again, front-facing and driven by a scroll-free
looping wave (see below).

The section-agnostic machinery lives once in **`scrub-vignette.js`** (plain IIFE, one
global `window.ScrubVignette`, loaded before `main.js`): `hermiteSpline`, `easeOutOfRest`,
`easeLaunch` (leave-at-speed-then-coast, the projectile counterpart), `worldPose`/
`FIGURE_JOINTS`, `buildStickFigure` (the humanoid pivot chain + a `fk(t)` forward-kinematics
readout, shared by all four figures), `buildScrubStylesheet` (pose/path data -> `@keyframes`
bound to a `view-timeline`), `buildLoopStylesheet` (the same pose splines -> `@keyframes`
played `linear infinite`, no scroll - the hero idle path), `pinnedScrubFallback` + channel
factories (the JS rAF 1:1 driver for the scrub sections), `svgTransformDriver`/
`svgRotationDriver`, `supportsScrollDrivenAnimation`. `setupSoccer` / `setupBasket` /
`setupGuitar` / `setupHero` in `main.js` are thin: draw/emit a scene, define poses (+ a
projectile path / a traverse+turn for the scrub sections), call the helpers. A new section
plugs in the same way - do not re-inline or fork this code.

**Multi-track per selector:** `buildScrubStylesheet`'s generic `tracks` are collected BY
SELECTOR and emitted as one rule with a comma-joined `animation` / `animation-timeline` /
`animation-range` list. One track per selector (soccer, basketball) emits exactly the
old single-track rule, so their generated stylesheet stays byte-identical - always
diff-check that when you touch this code. Guitar relies on it: `.figure-root` carries
`translate` (traverse) + `rotate` (turn lean) + `scale` (the 2-D pivot) as three
independent-property tracks on the one element, no wrapper `<g>`s (`transform-origin` set
once to mid-torso covers the rotate/scale; `translate` is origin-independent). The
fallback stacks `translateChannel` + two `styleChannel`s on the same element to match.

`buildStickFigure` is 11 pivots by default; opt-in flags generalise it without touching the
two projectile figures (soccer/basket pass none, so their generated `<style>` + scene SVG
are byte-identical - diff both old vs new when you touch the rig): `hands:true` adds a wrist
segment per arm (`arm1_h`/`arm2_h`; soccer/basket omit it, guitar + hero use it),
`face:true` draws two eyes + a smile counter-rotated to read head-on, `armsOverHead:true`
paints the arms above the head. It returns its own ordered `joints` list - pass
`figure.joints` to `buildScrubStylesheet`/`buildLoopStylesheet`/`figureJointsChannel` so
they drive the right set.

The hero (`setupHero`, `HERO_POSES`/`HERO_T`) is that rig **front-facing**: `hands` + `face`
+ `armsOverHead`, torso pinned near vertical, a symmetric stance, and a raised arm doing a
side-to-side "hello" wave - `arm2_f` swings left<->right while `arm2_h` (the wrist) trails a
beat behind it. No scroll timeline, no rAF: `buildLoopStylesheet` bakes the hermite pose
splines into per-joint `@keyframes` and the compositor loops them over `HERO_PERIOD`. First
and last pose (`rest`/`rest2`) are identical (spline value *and* velocity match at 0%/100%)
so the loop wraps clean. Under `prefers-reduced-motion` `setupHero` skips the stylesheet and
freezes one static mid-wave "hand up" pose (`HERO_T.waveA`). The hero dropped its old
`#r-hero` `feTurbulence` filter and one-hinge SMIL `<animateTransform>`; like the other two
its hand-drawn look is a single static rough.js pass.

The guitar (`setupGuitar`, `GUITAR_*` consts + `guitarPoseAt`) is that rig **in profile**:
`hands`, no `face`. It is a *procedural* cycle, not hand-keyed poses - `guitarPoseAt(p)`
composes a walk (leg swing / knee-lift), a strum oscillation on the front arm, a fret hand
along the neck, and a mid-beat "hug the guitar" turn-tuck, all in WORLD degrees, sampled
into a dense (`GUITAR_STEPS`) pose set the stock `buildStickFigure` path consumes. The
held guitar is a rough.js acoustic (`buildGuitar`, waisted figure-eight body + sound hole
+ neck/headstock/frets/strings, `--guitar` accent) inserted as first child of `figure.root`
so it travels / turns / tucks with the player and paints behind both hands. Sparse
scroll-linked music-note glyphs (`buildGuitarNote`, eighth notes / beamed pairs) fade in
and drift off the sound hole within scroll sub-ranges (`NOTES[]`) - never a wall clock,
none during the turn window. Reduced motion freezes a centre-frame "standing and playing"
pose (`GUITAR_REST`) + two static notes, no scrub stylesheet, `driver='reduced'` -
basketball's pattern.

Sharp edges:
- Each pinned section declares its own `view-timeline-name` (`--soccer-tl` / `--basket-tl` /
  `--guitar-tl`) in `style.css`; `.section--pinned` only carries the shared
  `view-timeline-axis`. The
  timeline's `contain` range is *exactly* the CSS-sticky pin window, so pin geometry still
  matters. The single `.section__pin` wrapper (child of `.section--pinned`, parent of
  `.section__anim`/`.section__content`) carries `position: sticky` so the two overlay.
  Making them independently sticky siblings breaks this. `position: sticky` breaks silently
  if any ancestor between `.section__pin` and the scroller gets `overflow` other than
  `visible` (`.section--pinned` overrides the base `.section`'s `overflow: hidden`); a
  `view-timeline` NAME lookup is *not* broken by ancestor overflow, so `.section__anim`'s
  `overflow: hidden` is fine. Don't reintroduce `overflow: hidden` on `.section--pinned`.
- Guitar's dance-turn is `GUITAR_PIVOT_AT` / `GUITAR_PIVOT_SPAN`: `scale` X = `cos(pivotU·2π)`
  (through 0 twice = a 360), `rotate` = a ±8° lean spline, `hop` lifts the feet, and
  `guitarPoseAt`'s tuck window pulls the limbs in over the same span. Retiming those two
  consts carries all of it. The turn is a 2-D pivot, deliberately *not* a literal figure
  rotation (that reads as a cartwheel - see the scout report) - keep it that way.
- **The projectile's flight must never start before the figure's release pose resolves** -
  a captain-review-caught regression class. `SOCCER_RELEASE_T` = `SOCCER_T.contact`.
  `BASKET_RELEASE_T` is `0.26`, deliberately a touch *before* the `apex` pose (0.30) so the
  shooting arm is still driving up-and-forward and the body still rising as the ball leaves -
  it reads as a shot, not a hand opening at the top. It is the single constant every gated
  tween keys off (ball, trail, `.ball-carry`, the flourish `ScrollTrigger`); retiming it
  carries them all. The generated ball/trail keyframes hold flat until `releaseT`.
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
point). At `releaseT` the carry translate is exactly `[0,0]`, so the handoff has no
positional jump - on both the native and fallback paths. Soccer is the degenerate case
(no carry: the ball just waits at offset-distance 0%). Reuse this shape for any future
"figure holds X then releases it" scroll vignette.

The handoff is also **velocity-continuous** (captain: the ball must look *shot*, not
dropped). Two pieces, both in `setupBasket`: (1) the arc's first control point is set along
the shooting hand's actual velocity at release (`fk(releaseT+dt).hand1 - fk(releaseT)`), so
the ball leaves on the hand's heading - no direction kink, and it carries clearly forward
toward the hoop before the parabola bends it down. (2) the ball's `offset-distance` ease is
`easeLaunch(handSpeed / meanPathSpeed)` instead of `easeOutOfRest` - it departs at the
hand's speed and coasts, rather than easing up from a standstill (which read as "let go").
The shooting arm keeps extending through and past `releaseT` (`apex` pose is a goose-neck
follow-through toward the rim, not straight up); the guide hand holds its raised attitude
past `releaseT` and only drops on the way to `watch`.

## Scroll-scrub performance

### A numeric ScrollTrigger `scrub` is a catch-up smoother, NOT a 1:1 scroll link

`scrub: 0.35` (etc.) eases the timeline toward the scroll position over ~N seconds
instead of tracking it. On a fast trackpad flick that means the scene renders up to ~15%
of the timeline behind scroll and keeps animating 150-350ms after input stops (the
"lag"), and rendered per-frame velocity over/undershoots ~±50% even on perfectly smooth
input (the "stop-motion" look). This was the root cause of soccer's laggy-scroll /
jumpy-ball reports through PRs #1-2 and three follow-up rounds - none of which touched the
`scrub` mechanism. **For a decorative scrub, never use a raw numeric `scrub`.** Prefer
native CSS scroll-driven animation (what all three hobby sections do), else `scrub: true`
(strict 1:1), else a *capped* rAF lerp if a deliberate glide-to-stop is wanted.

### All three scrub sections use native CSS scroll-driven animation (the go-forward pattern)

Per-section `view-timeline` + JS-generated `@keyframes` bound to it
(`ScrubVignette.buildScrubStylesheet()` in `scrub-vignette.js`); the compositor advances
motion 1:1 with scroll, structurally immune to scrub lag. `ScrubVignette.pinnedScrubFallback`
is the tested JS rAF 1:1 driver for engines without support. Ball = `offset-path`/
`offset-distance` (+ a `.ball-carry` translate wrapper for basketball's hold); figure
joints = generated `rotate` keyframes; parallax / jump / traverse = `translate` keyframes;
guitar's turn = `rotate` + `scale` keyframes on `.figure-root` itself. Any new decorative
scroll section plugs into this module - do not revive a bespoke inline scrub helper.
Verified in the sandbox: traverse-only per-frame accel p90 ~2.5-3px native / fallback,
0 dropped frames, native and forced-JS-fallback within 1px of each other.

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
`netSway`. The CSS scroll-driven happy path and the fallback channels sidestep this
entirely (CSS `rotate`/`translate`/`scale`/`transform` *style*, never the attribute).
Also: don't animate `stroke-dashoffset` on a *filtered* path, and never run a rough.js
regen (`settleRedraw` was removed) while a scroll may be active - it fired mid-arc as a
synchronous main-thread task. Every animated `feTurbulence`/`feDisplacementMap` wobble
filter has been removed (the scrub scenes', then the hero's `#r-hero`) - real per-frame
GPU re-raster on the captain's hardware; the hand-drawn look on all four figures (and the
held guitar) is a static rough.js pass drawn once. (The still `project-card__border`
filters remain - they never animate.)

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
