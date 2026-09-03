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

## Animation library boundary (GSAP vs anime.js vs Matter.js)

This site intentionally runs three animation/physics libraries side by side, each with a
fixed job - don't consolidate them:
- **GSAP + ScrollTrigger**: hero entrance, section scroll-reveals, nav dot, and each
  minigame's scroll-triggered roll-in/roll-out (see `rollIn`/`rollBack` in each `setup*()`
  in `main.js`).
- **anime.js v4** (UMD global `anime.animate`/`anime.stagger`/`anime.utils`/`anime.remove`,
  not v3's single `anime()` call or v4's ESM named exports): sprite-level tweens that must
  land at an exact deterministic target (e.g. the soccer goalie's dive, a direct-tween goal
  shot) and hand-rolled DOM confetti.
- **Matter.js**: only for motion that needs real collision response (e.g. the soccer ball's
  save-bounce off the goalie). It renders outcomes decided elsewhere; it never decides them
  - see `setupSoccer()` in `main.js` for the pattern (zone comparison decides save/goal
  first, then Matter.js or anime.js is chosen to animate that already-decided outcome).

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
