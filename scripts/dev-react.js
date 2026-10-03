/**
 * Dev server for the React CardSwapShowcase port.
 *
 * The shipped AnonChat page is vanilla HTML/CSS/JS served by server.js on port
 * 3000 and is left completely untouched by this file. This only exists so the
 * React port under /src can be rendered, debugged and scroll-tested for real.
 *
 * It runs two independent watchers:
 *   1. Tailwind CLI  -> dist-react/tailwind.css   (stylesheet layer)
 *   2. esbuild       -> dist-react/app.js         (JS bundle, incl. GSAP)
 *
 * and then serves three directories so image and vendor paths resolve exactly
 * as they do in production:
 *   react/       the dev shell (react/index.html)
 *   dist-react/  the compiled output
 *   public/      the real chat captures and vendored assets
 *
 * Usage:  npm run react        (watch mode, port 5173)
 *         npm run react:build  (one-shot production bundle)
 */
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const express = require('express');
const esbuild = require('esbuild');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'dist-react');
const PUBLIC = path.join(ROOT, 'public');
const SHELL = path.join(ROOT, 'react');

const PORT = Number(process.env.REACT_DEV_PORT || 5173);
const WATCH = process.argv.includes('--watch');

fs.mkdirSync(OUT, { recursive: true });

/** esbuild options shared by the watcher and the one-shot build. */
const esbuildOptions = {
  entryPoints: [path.join(SRC, 'main.tsx')],
  bundle: true,
  outfile: path.join(OUT, 'app.js'),
  format: 'iife',
  platform: 'browser',
  target: ['chrome100', 'edge100', 'firefox100', 'safari15'],
  jsx: 'automatic',
  minify: !WATCH,
  sourcemap: WATCH ? 'inline' : false,
  legalComments: 'none',
  logLevel: 'info',
  define: { 'process.env.NODE_ENV': WATCH ? '"development"' : '"production"' }
};

/**
 * Compile Tailwind once, or keep watching it.
 *
 * Two non-obvious details, both found the hard way:
 *
 * 1. stdin MUST be a readable pipe. Tailwind v3's CLI in --watch mode exits
 *    silently with code 0 and produces no stylesheet at all when stdin is
 *    'ignore' or 'inherit'. A dead watcher that reports success is the worst
 *    possible failure mode: the page keeps loading and the CSS rules silently
 *    stop applying. Piping stdin is what keeps it alive.
 *
 * 2. stdout/stderr are piped and re-emitted by hand rather than inherited,
 *    so output still reaches the terminal when this process was itself
 *    launched with Start-Process -RedirectStandardOutput.
 */
function buildCss() {
  const cli = require.resolve('tailwindcss/lib/cli.js');
  const target = path.join(OUT, 'tailwind.css');

  // Remove the previous output first, so waitForCss() cannot be satisfied by a
  // stale stylesheet and the startup check actually means something.
  fs.rmSync(target, { force: true });

  const args = [
    cli,
    '-c', path.join(ROOT, 'tailwind.config.js'),
    '-i', path.join(SRC, 'tailwind.css'),
    '-o', target
  ];
  if (WATCH) args.push('--watch');

  const child = spawn(process.execPath, args, {
    cwd: ROOT,
    stdio: ['pipe', 'pipe', 'pipe']
  });

  child.stdout.on('data', d => process.stdout.write(d));
  child.stderr.on('data', d => process.stderr.write(d));
  child.on('error', err => console.error('[react] tailwind failed to start:', err.message));
  child.on('exit', (code, signal) => {
    if (signal) console.error('[react] tailwind was killed by ' + signal);
    else if (code !== 0) console.error('[react] tailwind exited with code ' + code);
    else console.error('[react] tailwind stopped - stylesheet is now stale');
  });

  return child;
}

/**
 * Blocks until the stylesheet exists, so the dev server never serves a CSS file
 * that predates the source it was built from.
 */
async function waitForCss(timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      if (fs.statSync(path.join(OUT, 'tailwind.css')).size > 0) return true;
    } catch (_) {}
    await new Promise(r => setTimeout(r, 200));
  }
  return false;
}

async function main() {
  console.log('');
  console.log('  AnonChat - React CardSwapShowcase (dev port)');
  console.log('  ' + '-'.repeat(56));
  console.log('  Live vanilla app : http://localhost:3000   (server.js, untouched)');
  console.log('  React showcase   : http://localhost:' + PORT);
  console.log('  ' + '-'.repeat(56));
  console.log('');

  const css = buildCss();

  if (WATCH) {
    // Never start serving before the stylesheet has actually been written.
    if (!(await waitForCss())) {
      console.error('[react] tailwind produced no stylesheet - aborting rather than serving stale CSS');
      css.kill();
      process.exit(1);
    }

    // Rebuild the JS bundle on every save.
    const ctx = await esbuild.context(esbuildOptions);
    await ctx.watch();
    console.log('[react] esbuild watching src/**');

    const app = express();
    app.use(noCache);
    // Shell first, so "/" resolves to react/index.html rather than the
    // vanilla page in public/.
    app.use(express.static(SHELL));
    app.use(express.static(OUT));
    app.use(express.static(PUBLIC));

    const server = app.listen(PORT, () => {
      console.log('[react] listening on http://localhost:' + PORT + '\n');
    });

    const shutdown = async () => {
      server.close();
      css.kill();
      await ctx.dispose();
      process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    return;
  }

  // One-shot production bundle.
  await esbuild.build(esbuildOptions);
  fs.copyFileSync(path.join(SHELL, 'index.html'), path.join(OUT, 'index.html'));
  console.log('\n[react] production bundle written to dist-react/');
}

function noCache(_req, res, next) {
  res.set('Cache-Control', 'no-store');
  next();
}

main().catch((err) => {
  console.error('[react] build failed:', err);
  process.exit(1);
});