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

Verified directly (a minimal isolated repro, not just this codebase): GSAP always writes
SVG `<g>`/`<path>` transforms via the `transform` *attribute*, never CSS `transform`
*style* - unaffected by `transformOrigin`. Each attribute write triggers Blink's
SVG-specific layout invalidation; fine for a one-off tween, measurably costly (profiled
with Chrome tracing: ~50% dropped frames) for anything transformed on every scrub frame
across a whole scroll range, as soccer's captain-reported laggy-scroll fix found. Three
reusable helpers in `main.js` exist for the next scroll-scrub section to build on rather
than re-discovering this:
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

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
