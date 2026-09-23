const fs = require('fs');
const path = require('path');

const indexHtml = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf-8');
const styleCss = fs.readFileSync(path.join(__dirname, 'public', 'style.css'), 'utf-8');
const clientJs = fs.readFileSync(path.join(__dirname, 'public', 'client.js'), 'utf-8');
const userHome = process.env.USERPROFILE || process.env.HOME || '';
let previewHtml = '';
const candidatePaths = [
  path.join(userHome, '.gemini', 'antigravity', 'brain', 'c8a04669-7f36-4352-8da0-49f55be181e0', 'ui_preview.html'),
  path.join(__dirname, '..', '..', 'brain', 'c8a04669-7f36-4352-8da0-49f55be181e0', 'ui_preview.html')
];
for (const p of candidatePaths) {
  if (fs.existsSync(p)) {
    previewHtml = fs.readFileSync(p, 'utf-8');
    break;
  }
}

let passed = 0;
let failed = 0;
function check(cond, msg) {
  if (cond) {
    console.log('[PASS] ' + msg);
    passed++;
  } else {
    console.error('[FAIL] ' + msg);
    failed++;
  }
}

console.log('--- Verifying Comprehensive Human UI/UX Audit Fixes ---');

// 1. Header flaws
check(!indexHtml.includes('d="M2 12s3-7 10-7'), 'index.html: Removed generic eye logo');
check(styleCss.includes('radar-ping'), 'style.css: Contains custom radar-ping animation for live pulse');
check(styleCss.includes('transform: translate(-50%, -50%) scale('), 'style.css: radar-ping uses GPU-accelerated scale transform');
check(styleCss.includes('display: inline-flex') && styleCss.includes('line-height: 1'), 'style.css: Status pill vertically centered with line-height: 1');
check(styleCss.includes('height: 32px; /* Equal height with .nav-icon-btn'), 'style.css: Status pill has 32px height matching nav icon button');
check(styleCss.includes('rgba(24, 24, 27, 0.4)'), 'style.css: Navbar uses bg-zinc-900/40 constraint');
check(styleCss.includes('backdrop-filter: blur(12px)'), 'style.css: Navbar uses backdrop-blur-md (12px)');

// 2. Buttons & Accents
check(styleCss.includes('background: var(--accent-indigo);'), 'style.css: Primary button uses solid dark-indigo');
check(styleCss.includes('--accent-indigo: #4f46e5;'), 'style.css: Accent indigo is #4f46e5 (bg-indigo-600)');
check(styleCss.includes('--accent-indigo-hover: #6366f1;'), 'style.css: Accent indigo hover is #6366f1 (hover:bg-indigo-500)');
check(styleCss.includes('scale(1.02)'), 'style.css: Button has hover:scale-[1.02]');
check(styleCss.includes('padding: 12px 32px; /* Strict 8px grid'), 'style.css: Button padding follows 8px grid (12px 32px)');
check(styleCss.includes('margin-bottom: 24px; /* gap-y-6 strictly 24px */'), 'style.css: Button has gap-y-6 (24px) spacing to feature grid');
check(styleCss.includes('translateX(3px)'), 'style.css: Button arrow has refined optical motion on hover');
check(styleCss.includes('.send-action {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  width: 34px;\n  height: 34px;\n  border-radius: var(--radius-xs);\n  background: var(--accent-indigo);'), 'style.css: Send action button updated to solid dark-indigo');

// 3. Contrast & Accessibility
check(styleCss.includes('--text-slate-400: #94a3b8;'), 'style.css: Defines slate-400 (#94a3b8) for WCAG compliance');
check(styleCss.includes('--text-muted: #94a3b8;'), 'style.css: --text-muted upgraded to #94a3b8 (7.19:1) for WCAG AA compliance');
check(styleCss.includes('color: var(--text-slate-400);'), 'style.css: Feature subtext uses slate-400');
check(styleCss.includes('font-weight: 700;'), 'style.css: Hero headline uses refined font-weight 700');
check(styleCss.includes('letter-spacing: -0.03em;'), 'style.css: Hero headline uses tracking-tight');
check(styleCss.includes('font-weight: 500;'), 'style.css: Hero subtext uses font-medium');
check(styleCss.includes('max-width: 520px;'), 'style.css: Hero subtext constrained to max 2 lines');
check(indexHtml.includes('Ephemeral WebSockets.<br />') && indexHtml.includes('Connect with peers across the web in 1-click.'), 'index.html: Subtitle cleanly formatted into 2 lines');

// 4. Layout & 8px Grid System
check(styleCss.includes('--bg-base: #0B0C10;'), 'style.css: Modern dark base depth #0B0C10');
check(styleCss.includes('--bg-card: #12131C;'), 'style.css: Modern card surface depth #12131C');
check(styleCss.includes('--border-slate-800: rgba(30, 41, 59, 0.6);'), 'style.css: Soft border-slate-800/60');
check(styleCss.includes('padding: 48px 40px; /* Strict 8px grid'), 'style.css: Landing card follows strict 8px grid (48px 40px)');
check(styleCss.includes('padding: 32px 16px; /* Strict 8px grid'), 'style.css: Mobile landing card follows strict 8px grid (32px 16px)');
check(styleCss.includes('padding: 16px 12px;'), 'style.css: Feature card follows 8px grid padding (16px 12px)');

// 5. Feature Card Alignment
check(styleCss.includes('.feature-text {\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  justify-content: center;\n  text-align: center;'), 'style.css: Feature text blocks are vertically and horizontally center-aligned');
check(styleCss.includes('.feature-card {\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  justify-content: center;\n  text-align: center;'), 'style.css: Feature cards are vertically and horizontally center-aligned');

// 6. Viewport Resilience & Footer
check(indexHtml.includes('app-footer'), 'index.html: Contains app-footer');
check(indexHtml.includes('Terms of Service'), 'index.html: Contains Terms of Service');
check(indexHtml.includes('Privacy Policy'), 'index.html: Contains Privacy Policy');
check(indexHtml.includes('GitHub'), 'index.html: Contains GitHub link');
check(styleCss.includes('.app-footer'), 'style.css: Contains .app-footer styles');
check(styleCss.includes('color: var(--text-slate-400); /* 7.19:1 WCAG contrast */'), 'style.css: Footer links use WCAG AA compliant text-slate-400');
check(styleCss.includes('padding-bottom: 40px; /* Reserves space so absolute footer never overlaps card */'), 'style.css: App shell reserves spacing for footer');
check(styleCss.includes('@media (max-height: 740px)'), 'style.css: Viewport height resilience enables smooth scrolling for small screens');

// 7. Client & UI Preview
check(clientJs.includes('onlineCountText.textContent = `${data.count} online`') && clientJs.includes('pill.style.borderColor'), 'client.js: Contains live WebSocket visual pulse reaction');
check(previewHtml.includes('Terms of Service'), 'ui_preview.html: Contains Terms of Service');
check(previewHtml.includes('radar-ping'), 'ui_preview.html: Contains radar-ping pulse');
check(previewHtml.includes('--accent-indigo: #4f46e5;'), 'ui_preview.html: Contains solid dark-indigo accent');
check(previewHtml.includes('color: var(--text-slate-400)'), 'ui_preview.html: Footer has WCAG AA compliant text-slate-400');

console.log('--- Finished: ' + passed + ' Passed, ' + failed + ' Failed ---');
process.exit(failed === 0 ? 0 : 1);
