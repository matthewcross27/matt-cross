# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- Add durable project-specific notes here as they are discovered through real work.

## Real-browser testing in this sandbox

`chrome-devtools-axi` (and the underlying `chrome-devtools-mcp`) do not work in this
worktree environment: no Chrome/Chromium is installed, and `open`/`newpage` report
"0 pages open" even after returning a page object. Workaround that does work (network
access to jsdelivr/npm/Google's Chrome-for-Testing CDN is available):

```sh
npx -y @puppeteer/browsers install chrome@stable --path /tmp/chrome-install
npm install puppeteer-core   # in a scratch dir
```
Then drive it with `puppeteer-core`'s `puppeteer.launch({ executablePath: <the
downloaded "Google Chrome for Testing" binary>, headless: true, args: ['--no-sandbox'] })`.
This gives real screenshots, click/tap/keyboard events, and console/pageerror capture -
serve the site first with a plain static server (e.g. `python3 -m http.server`).

## Animation library boundary (GSAP vs anime.js)

Matter.js was removed (soccer's click-to-shoot minigame it existed for was replaced by a
decorative scroll-scrub accent); don't reintroduce a physics engine without a real
collision-response need. Two libraries remain, each with a fixed job:
- **GSAP + ScrollTrigger**: hero entrance, section scroll-reveals, nav dot, each
  minigame's scroll-triggered roll-in/roll-out, and soccer's continuous `scrub` timeline
  (ball motion path, chalk trail, parallax, and the joint-based kicker figure - see
  `setupSoccer()` in `main.js`).
- **anime.js v4** (UMD global `anime.animate`/`anime.stagger`/`anime.utils`/`anime.remove`,
  not v3's single `anime()` call or v4's ESM named exports): sprite-level tweens that must
  land at an exact deterministic target, e.g. soccer's contact-moment ink flourish
  (`impactFlourish()` in `main.js`).

## Soccer section: decorative scroll-scrub, not a minigame

`#sec-soccer` is a pinned (`.section--pinned`, CSS `position: sticky`), non-interactive
scroll-scrub accent (`setupSoccer()` in `main.js`) - not a click-to-shoot minigame; that
was PR #1's shipped version, later replaced. Two sharp edges if you touch this section:
- The single `.section__pin` wrapper (child of `.section--pinned`, parent of
  `.section__anim`/`.section__content`) carries the `position: sticky`, so the two overlay
  each other exactly like they do in every unpinned `.section`. Making `.section__anim`
  and `.section__content` independently sticky siblings instead breaks this - each then
  reserves its own static-flow box, so the header doesn't overlay until the scroll has
  advanced roughly a full viewport height into the section. `position: sticky` also
  breaks silently if any ancestor between `.section__pin` and the page's real scrolling
  container gets an `overflow` other than `visible` - `.section--pinned` explicitly
  overrides the base `.section`'s `overflow: hidden` for this reason. Don't reintroduce
  `overflow: hidden` there without rechecking the pin still holds visually across the full
  scroll range.
- The ball's flight must never start before the kicker figure's `contact` pose resolves
  (`CONTACT_T` in `setupSoccer()`) - a captain-review-caught regression class. If you
  retime the kick poses, keep every ball/trail/shadow tween's start gated to that same
  constant rather than to timeline `0`.
- Basketball and guitar are intentionally still the older click/hover minigame pattern;
  this decorative-accent direction is not yet extended to them, but should reuse the
  performance patterns below when it is.

## Scroll-scrub performance: GSAP + SVG attribute transforms are expensive per-frame

Verified directly (a minimal isolated repro, not just this codebase, and independent of
any specific measurement): GSAP always writes SVG `<g>`/`<path>` transforms via the
`transform` *attribute*, never CSS `transform` *style* - unaffected by `transformOrigin`.
Each attribute write triggers Blink's SVG-specific layout invalidation; fine for a one-off
tween, but a real, reproducible cost for anything transformed on every scrub frame across
a whole scroll range, as soccer's captain-reported laggy-scroll fix found. The specific
frame-drop/stall percentages recorded while diagnosing that fix (Chrome tracing, ~50%
dropped frames before / none after) were measured in this project's headless, GPU-less
sandbox and should be read as evidence *of this sandbox*, not a portable benchmark - a
later independent verification pass in the same kind of sandbox couldn't reproduce the
exact numbers, though it did directly confirm the underlying attribute-vs-style mechanism
switch by inspecting the DOM before/after. Trust the mechanism, not the exact percentages,
when judging whether a similar fix is warranted elsewhere. Three reusable helpers in
`main.js` exist for the next scroll-scrub section to build on rather than re-discovering
this:
- `svgTransformDriver(el)` - tween a plain proxy object and apply the result via the
  element's CSS `transform` style in `onUpdate`, instead of letting GSAP set `x`/`y` on
  the element directly. Used for soccer's ball/crowd/pitch groups (translate and, for the
  pitch's net-pulse, `scaleY`).
- `svgRotationDriver(el, initialDeg)` - same rationale, for a single joint's rotation
  instead of a translate/scale; drives every pivot of soccer's kicker figure.
- `createPinnedScrub(section, stage, vars)` - the shared ScrollTrigger
  trigger/endTrigger/`pin:false` wiring for a CSS-`position:sticky`-pinned section (CSS
  does the pinning; GSAP only scrubs the timeline against the scroll range the section's
  extra height provides).
Also avoid animating non-transform/opacity properties (e.g. `stroke-dashoffset`) or doing
non-trivial DOM writes (e.g. a rough.js redraw) on every scrub frame or on a timer that
can overlap active scrolling - `settleRedraw()` was cut from 3 passes to 1 for exactly
this reason.

### This sandbox cannot validate GPU/compositing cost - don't over-trust a clean trace here

A second captain follow-up reported real scrolling still choppy after the fix above. A
fresh investigation (real `page.mouse.wheel()` gestures, not scrollTo jumps; Chrome
tracing; a MutationObserver-based check for >1 write/frame; stripping every SVG filter)
found **no remaining main-thread JS cause**: zero `getBoundingClientRect` calls during
scroll (ScrollTrigger caches its measurements, doesn't re-measure per frame), roughly one
style write per continuously-animated element per frame (not multiple), the single
`settleRedraw` pass landing as an ~8ms task exactly where expected rather than a stall,
and removing every wobble filter changing nothing measurable. A synthetic-40ms-per-frame
sanity check confirmed this test harness *can* detect real per-frame cost when it's
present - so the ~16.6ms average measured for the actual scene is a genuine light-cost
reading in this environment, not a broken metric masking something worse.

That combination - clean main-thread trace, harness proven trustworthy, captain still
sees real choppiness - points at GPU/compositing cost on real hardware (SVG filter
rasterization, or compositor layer/fill-rate pressure from several always-promoted
layers), which headless, software-rendered Chrome has no real GPU to exercise the same
way. Two independently-justified complexity reductions were made as a reasonable hedge
(`feTurbulence numOctaves` 2->1 on all three wobble filters - halves the noise-computation
work per pixel with negligible visual difference at these small displacement scales; and
`will-change: transform` narrowed from four scrub-driven groups down to just the ball and
kicker, since crowd/pitch only ever shift a few px for parallax and each always-promoted
layer has its own GPU memory/compositing cost) - but neither is a *verified* fix the way
the attribute-vs-style switch was. If a future report says still-choppy after this, don't
re-run more headless trace comparisons expecting them to settle it - this sandbox has now
twice shown a clean trace while the real complaint persisted, so get a trace or profile
from an actual device/browser instead, or ask what device/browser the captain is on.

### Update: the real cause of "choppy" was a velocity discontinuity, not dropped frames

A third follow-up gave a different, correct hypothesis: not raw frame drops, but the
kicker figure's motion looking like stop-motion rather than a smooth arc. Investigated by
directly setting the scrub timeline's `.progress()` (bypasses ScrollTrigger's own update
cycle and scrub-smoothing lag entirely, testing the raw position function) and sampling at
0.0005-fraction resolution. The **ball** was confirmed genuinely continuous (GSAP
`motionPath` sampling the real quadratic-Bezier `path` every tick, max adjacent-sample
jump ~0.28px - not the problem). The **kicker's joints** had a real, different bug: value
was continuous (a GSAP tween always starts from the current value) but *velocity* wasn't -
the 3-segment tween chain (`windup`/`contact`/`follow`, each its own `.to()` with its own
ease) let each segment's easing curve dictate its own boundary velocity independently, so
`power3.in` accelerating into the end of `contact` handed off to `power2.out` restarting a
slower deceleration for `follow`, producing a measurable ~5.7deg jump per 0.0005-progress
step right at the contact moment - the single most dramatic instant in the whole sequence.
Fixed by replacing the tween chain with `hermiteSpline()`: a clamped cubic Hermite spline
through all 4 poses (idle/windup/contact/follow), evaluated as one continuous formula of
scroll progress directly in the scrub's `onUpdate` (same "compute the exact value from the
current fraction" standard `svgTransformDriver`'s motionPath already met) rather than
GSAP tweening between named poses. Each interior knot's tangent is shared by both
adjoining segments by construction, so value *and* velocity match on both sides of every
pose - verified both by a standalone unit test of the spline function (finite-difference
velocity estimates from both sides converge to the same value as epsilon shrinks) and by
re-sampling the live page. If you retime `KICK_POSES`/`KICK_T`, this guarantee holds
automatically - no per-segment easing to hand-tune for a smooth handoff. Applies only to
the kicker; the ball's motionPath approach was never part of this bug.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
