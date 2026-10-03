/* Temporary verification harness: drives headless Chrome over CDP to capture the
   landing page at specific scroll depths, so scroll-driven state can actually be
   inspected instead of guessed at. Uses the `ws` devDependency already in
   package.json. Not part of the shipped site. */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT = process.argv[2] || path.join(__dirname, '..', 'tmp-chrome', 'verify');
// "reduced" emulates OS-level reduce-motion (the fallback path a real visitor
// gets); "full" forces the animated path.
const MODE = process.argv[3] === 'reduced' ? 'reduced' : 'full';
const PREFIX = process.argv[3] === 'reduced' ? 'rm-' : '';
const PORT = 9333;
const URL = 'http://localhost:3000';

fs.mkdirSync(OUT, { recursive: true });

const chrome = spawn(CHROME, [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  '--remote-debugging-port=' + PORT,
  '--window-size=1440,900',
  'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getWsUrl() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await res.json();
      const page = list.find((t) => t.type === 'page');
      if (page && page.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch (_) { /* chrome not up yet */ }
    await sleep(250);
  }
  throw new Error('Chrome DevTools endpoint never came up');
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, { maxPayload: 256 * 1024 * 1024 });
    let id = 0;
    const pending = new Map();
    ws.on('open', () => resolve({
      send(method, params) {
        const msgId = ++id;
        return new Promise((res, rej) => {
          pending.set(msgId, { res, rej });
          ws.send(JSON.stringify({ id: msgId, method, params: params || {} }));
        });
      },
      close: () => ws.close(),
    }));
    ws.on('error', reject);
    ws.on('message', (raw) => {
      const msg = JSON.parse(raw);
      if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
      }
    });
  });
}

async function evaluate(cdp, expression) {
  const r = await cdp.send('Runtime.evaluate', {
    expression, awaitPromise: true, returnByValue: true,
  });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' :: ' + expression.slice(0, 80));
  return r.result.value;
}

async function shot(cdp, name) {
  const r = await cdp.send('Page.captureScreenshot', { format: 'png' });
  const file = path.join(OUT, name + '.png');
  fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
  console.log('  saved', path.basename(file), (fs.statSync(file).size / 1024).toFixed(0) + 'kb');
}

(async () => {
  const cdp = await connect(await getWsUrl());
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  // Surface page errors instead of silently screenshotting a broken page.
  await cdp.send('Log.enable').catch(() => {});
  const errors = [];
  cdp.send('Runtime.evaluate', {
    expression: `window.__errs=[];addEventListener('error',e=>window.__errs.push(String(e.message)));`,
  });

  console.log('navigating...  mode=' + MODE);
  // Headless Chrome reports prefers-reduced-motion: reduce by default, which
  // sends every scroll effect down its static fallback. Default to forcing the
  // animated path so the scrubbed states can be inspected.
  await cdp.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: MODE === 'reduced' ? 'reduce' : 'no-preference' }],
  });
  await cdp.send('Page.navigate', { url: URL });
  await sleep(6000); // fonts, video, GSAP + Lenis boot

  const rm = await evaluate(cdp, `matchMedia('(prefers-reduced-motion: reduce)').matches`);
  console.log('  reduced-motion in page: ' + rm);
  const storyClass = await evaluate(cdp, `(document.getElementById('story') || {}).className || 'NOT-FOUND'`);
  console.log('  #story classes: ' + storyClass);

  // Scroll helper. Driving native window.scrollTo while Lenis is alive desyncs
  // Lenis' cached scroll position from the real one, which leaves ScrollTrigger's
  // pin inactive (the pinned stage then just scrolls away at -scrollY). Going
  // through Lenis keeps every listener in agreement.
  async function scrollTo(cdp2, y) {
    await evaluate(cdp2, `(() => {
      const t = ${y};
      if (window._lenis) window._lenis.scrollTo(t, { immediate: true, force: true });
      else window.scrollTo(0, t);
      return true;
    })()`);
    await sleep(800);
  }

  await scrollTo(cdp, 0);

  console.log('capturing:');
  await shot(cdp, PREFIX + '01-hero');

  // --- #story pinned stack: capture the pile at several beats ---------------
  const storyInfo = await evaluate(cdp, `(() => {
    const s = document.getElementById('story');
    const t = window._storyTrigger;
    return { top: s.offsetTop, start: t ? t.start : null, end: t ? t.end : null };
  })()`);
  console.log('  story top=' + storyInfo.top + ' pin ' + storyInfo.start + '->' + storyInfo.end);

  if (storyInfo.start != null) {
    const span = storyInfo.end - storyInfo.start;
    for (const [name, p] of [['02-story-beat0', 0.02], ['03-story-beat1', 0.3], ['04-story-beat3', 0.95]]) {
      const y = Math.round(storyInfo.start + span * p);
      await scrollTo(cdp, y);
      const vis = await evaluate(cdp, `(() => {
        const r = document.getElementById('storyStage').getBoundingClientRect();
        const card = document.getElementById('swapCard3').getBoundingClientRect();
        return {
          scrollY: window.scrollY,
          stageTop: Math.round(r.top),
          pinned: Math.abs(r.top) < 4,
          cardTop: Math.round(card.top), cardW: Math.round(card.width)
        };
      })()`);
      console.log('  ' + name + ' y=' + y + ' -> ' + JSON.stringify(vis));
      await shot(cdp, PREFIX + name);
    }
  }

  // In the static fallback there is no pin, so walk the section in document
  // flow instead - that is the layout a reduce-motion visitor actually gets.
  if (storyInfo.start == null) {
    for (const [name, frac] of [['02-story-static-a', 0.02], ['03-story-static-b', 0.42]]) {
      await scrollTo(cdp, Math.round(storyInfo.top + 1500 * frac));
      await shot(cdp, PREFIX + name);
    }
  }

  // Report the live pile state at the deepest beat.
  const pile = await evaluate(cdp, `(() => {
    return Array.from(document.querySelectorAll('#cardSwapDeck .swap-card')).map(c => {
      const cs = getComputedStyle(c);
      return {
        id: c.id,
        depth: c.getAttribute('data-stack-depth'),
        opacity: cs.opacity,
        transform: cs.transform.slice(0, 70)
      };
    });
  })()`);
  console.log('  pile state:');
  pile.forEach((c) => console.log('    ' + c.id + ' depth=' + c.depth + ' op=' + c.opacity + ' ' + c.transform));

  // --- #how-it-works timeline: mid-draw and fully drawn --------------------
  const tlInfo = await evaluate(cdp, `(() => {
    const s = document.getElementById('how-it-works');
    return { top: s.offsetTop, h: s.offsetHeight };
  })()`);
  console.log('  how-it-works top=' + tlInfo.top + ' h=' + tlInfo.h);

  await scrollTo(cdp, Math.round(tlInfo.top - 200));
  await shot(cdp, PREFIX + '05-timeline-start');

  await scrollTo(cdp, Math.round(tlInfo.top + tlInfo.h * 0.45));
  await shot(cdp, PREFIX + '06-timeline-mid');

  const tlState = await evaluate(cdp, `(() => {
    const f = document.getElementById('howTimelineFill');
    return {
      fill: f ? f.style.transform : 'MISSING',
      steps: Array.from(document.querySelectorAll('.ed-tl-step')).map(s =>
        s.getAttribute('data-ed-step') + ':' + (s.classList.contains('is-live') ? 'live' : '-') +
        '/' + (s.classList.contains('is-done') ? 'done' : '-'))
    };
  })()`);
  console.log('  timeline fill=' + tlState.fill);
  tlState.steps.forEach((s) => console.log('    step ' + s));

  await scrollTo(cdp, Math.round(tlInfo.top + tlInfo.h));
  await shot(cdp, PREFIX + '07-timeline-end');

  const errs = await evaluate(cdp, 'window.__errs || []');
  console.log('page errors: ' + (errs.length ? JSON.stringify(errs) : 'none'));

  cdp.close();
  chrome.kill();
  process.exit(0);
})().catch((e) => {
  console.error('FAILED:', e.message);
  chrome.kill();
  process.exit(1);
});
