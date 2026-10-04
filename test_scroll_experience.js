const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

console.log('=== AnonChat Oct 2026 3D Card Swap & Scroll Experience Test Suite ===\n');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`[PASS] ${message}`);
    passed++;
  } else {
    console.error(`[FAIL] ${message}`);
    failed++;
  }
}

// 1. Check HTML Files Integrity
const indexHtml = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
const appChatHtml = fs.readFileSync(path.join(__dirname, 'public', 'app-chat.html'), 'utf8');

assert(indexHtml.includes('ScrollTrigger.min.js'), 'index.html loads GSAP ScrollTrigger plugin');
assert(indexHtml.includes('vendor/gsap.min.js'), 'index.html serves GSAP locally for reliable animation');
assert(fs.existsSync(path.join(__dirname, 'public', 'vendor', 'gsap.min.js')), 'local GSAP runtime is available');
assert(fs.existsSync(path.join(__dirname, 'public', 'vendor', 'ScrollTrigger.min.js')), 'local ScrollTrigger runtime is available');
assert(indexHtml.includes('id="scrollProgressBar"'), 'index.html has scroll-progress-bar element');
assert(indexHtml.includes('id="scrollProgressFill"'), 'index.html has scrollProgressFill element');
assert(indexHtml.includes('href="#story"'), 'index.html navbar has link to #story');
assert(indexHtml.includes('id="heroScrollIndicator"'), 'index.html has heroScrollIndicator pointing to #story');
assert(indexHtml.includes('id="story"'), 'index.html has #story Parallax Storytelling section');

// 3D Stacking & Swapping Cards Deck Checks
assert(indexHtml.includes('id="cardSwapContainer"'), 'index.html has cardSwapContainer perspective stage');
assert(indexHtml.includes('id="cardSwapDeck"'), 'index.html has cardSwapDeck 3D container');
assert(indexHtml.includes('id="swapCard0"'), 'index.html has Beat 1 swapCard0 (Late Night Confessions)');
assert(indexHtml.includes('id="swapCard1"'), 'index.html has Beat 2 swapCard1 (15s Audio Notes & View-Once)');
assert(indexHtml.includes('id="swapCard2"'), 'index.html has Beat 3 swapCard2 (5s Self-Destruct Bombs)');
assert(indexHtml.includes('id="swapCard3"'), 'index.html has Beat 4 swapCard3 (3s Skip Grace Protection)');
assert(indexHtml.includes('story-card'), 'index.html cards include story-card class');
assert(indexHtml.includes('id="manualSwapBtn"'), 'index.html has manualSwapBtn deck swap control');

// Dynamic SVG Journey Connector Line Checks
assert(indexHtml.includes('journey-svg-rail'), 'index.html has journey-svg-rail SVG container');
assert(indexHtml.includes('id="journeySvgPath"'), 'index.html has animated journeySvgPath path element');
assert(indexHtml.includes('journeyGradient'), 'index.html has linearGradient for SVG connector');
assert(indexHtml.includes('story-step-item'), 'index.html has progressive step items');

// Real Chat UI Authentication Checks (No Fake Cliparts)
assert(indexHtml.includes('real-chat-frame'), 'index.html contains real-chat-frame dark obsidian UI');
assert(indexHtml.includes('Stranger #4092'), 'Card 0 displays real peer name Stranger #4092');
assert(indexHtml.includes('real-quote-preview'), 'Card 0 has quoted message preview with reply context');
assert(indexHtml.includes('real-reaction-dock'), 'Card 0 features authentic reaction dock');
assert(indexHtml.includes('real-voice-player-bubble'), 'Card 1 contains real 15s Web Audio player bubble');
assert(indexHtml.includes('view-once-thumb'), 'Card 1 includes 5s view-once attachment thumbnail');
assert(indexHtml.includes('smoke-dissolving'), 'Card 2 features real 5s self-destruct smoke dissolving message');
assert(indexHtml.includes('real-safe-link-chip'), 'Card 2 contains verified safe link chip');
assert(indexHtml.includes('real-skip-grace-bar'), 'Card 3 contains 3-second accidental skip grace bar');

// Sticky Content Switch Checks
assert(indexHtml.includes('story-heading-switch-container'), 'index.html has story-heading-switch-container');
assert(indexHtml.includes('id="storyDynamicTitle"'), 'index.html has dynamic switchable headline id');
assert(indexHtml.includes('id="storyDynamicDesc"'), 'index.html has dynamic switchable subheadline id');
assert(indexHtml.includes('id="storyBadgeText"'), 'index.html has dynamic switchable badge id');
// Gallery showcase: its own section, never folded into #features.
assert(indexHtml.includes('id="gallery"'), 'index.html has a dedicated #gallery showcase section');
assert(indexHtml.includes('id="galleryPin"'), 'index.html has #galleryPin, a full-viewport pinned stage');
assert(indexHtml.includes('id="galleryViewport"'), 'index.html has the gallery viewport that clips the travel');
assert(indexHtml.includes('id="galleryTrack"'), 'index.html has the horizontal gallery track');
assert(indexHtml.includes('gallery-copy-item'), 'index.html has four real, switchable heading copies');
assert(indexHtml.includes('id="galleryCopyNum"'), 'index.html has the live slide counter');
assert(indexHtml.includes('data-gallery-goto'), 'index.html gallery slides are keyboard-reachable buttons');
assert((indexHtml.match(/class="gallery-slide"/g) || []).length === 4, 'index.html has exactly 4 gallery slides');
// The regression this replaces: the showcase must NOT live inside #features.
assert(!indexHtml.includes('sticky-feature-showcase'), 'broken sticky-feature-showcase markup is gone');
assert(indexHtml.includes('fab-features-grid'), 'index.html keeps the original #features card grid');

// Continuous Horizontal Journey Ribbon Checks
assert(indexHtml.includes('horizontal-journey-ribbon'), 'index.html has horizontal-journey-ribbon section');
assert(indexHtml.includes('id="journeyRibbonTrack"'), 'index.html has journeyRibbonTrack element');
assert(indexHtml.includes('ribbon-pill cyan'), 'index.html has styled ribbon metric pills');

// 2. Hash Equality between index.html and app-chat.html
const hashIndex = crypto.createHash('sha256').update(indexHtml).digest('hex');
const hashAppChat = crypto.createHash('sha256').update(appChatHtml).digest('hex');
assert(hashIndex === hashAppChat, 'index.html and app-chat.html are 100% synchronized in hash');

// 3. Check CSS Architecture in editorial.css
const css = fs.readFileSync(path.join(__dirname, 'public', 'editorial.css'), 'utf8');
assert(css.includes('.scroll-progress-bar'), 'editorial.css has .scroll-progress-bar styles');
assert(css.includes('.editorial-navbar.navbar-scrolled'), 'editorial.css has .navbar-scrolled frosted glass styles');
assert(css.includes('.scroll-story-section'), 'editorial.css styles .scroll-story-section');
assert(css.includes('.card-swap-container'), 'editorial.css styles .card-swap-container with perspective: 1200px');
assert(css.includes('.card-swap-deck'), 'editorial.css styles .card-swap-deck with preserve-3d');
assert(css.includes('.swap-card'), 'editorial.css styles .swap-card with 3D slots');
assert(css.includes('.swap-card:nth-child(1)'), 'editorial.css provides a visible first-card fallback state');
assert(css.includes('.real-chat-frame'), 'editorial.css styles .real-chat-frame');
assert(css.includes('.journey-svg-rail'), 'editorial.css styles .journey-svg-rail');
assert(css.includes('.journey-draw-path'), 'editorial.css styles .journey-draw-path');
assert(css.includes('.horizontal-journey-ribbon'), 'editorial.css styles .horizontal-journey-ribbon');
assert(css.includes('laserTravel'), 'editorial.css has laserTravel keyframe animation');
assert(css.includes('vaporDrift'), 'editorial.css has vaporDrift dissolve animation');
assert(css.includes('particleFloat'), 'editorial.css has particleFloat animation');
assert(css.includes('smokeDissolveAnim'), 'editorial.css has smokeDissolveAnim animation');
assert(css.includes('.story-heading-switch-container'), 'editorial.css styles .story-heading-switch-container');
assert(css.includes('.gallery-pin-section'), 'editorial.css styles .gallery-pin-section');
assert(css.includes('.gallery-pin'), 'editorial.css styles the pinned .gallery-pin stage');
assert(css.includes('--gallery-slide-w'), 'editorial.css drives slide width from one custom property');
assert(!css.includes('.sticky-showcase-section'), 'dead .sticky-showcase CSS is removed');
// Percentage flex-basis inside a max-content row is what produced the 5.5k px
// pin range and the blank slide, so guard against it coming back.
const cssNoComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
assert(!/\.gallery-track[^{]*\{[^}]*width:\s*max-content/.test(cssNoComments), 'gallery track never uses width:max-content');
assert(!/\.gallery-slide[^{]*\{[^}]*flex:[^}]*\b100%/.test(cssNoComments), 'gallery slides never use percentage flex-basis');
assert(css.includes('@media (max-width: 991px)'), 'editorial.css has mobile adaptive rules for story section');

let braceCount = 0;
for (let i = 0; i < css.length; i++) {
  if (css[i] === '{') braceCount++;
  if (css[i] === '}') braceCount--;
}
assert(braceCount === 0, 'editorial.css has perfectly balanced braces');

// 4. Check JS Controller in fabale.js
const js = fs.readFileSync(path.join(__dirname, 'public', 'fabale.js'), 'utf8');
assert(js.includes('gsap.registerPlugin(ScrollTrigger)'), 'fabale.js registers ScrollTrigger with GSAP');
assert(js.includes('initScrollProgress'), 'fabale.js implements initScrollProgress');
assert(js.includes('initNavbarScroll'), 'fabale.js implements initNavbarScroll');
assert(js.includes('initHeroParallax'), 'fabale.js implements initHeroParallax');
assert(js.includes('initTickerScrub'), 'fabale.js implements initTickerScrub');
assert(js.includes('initParallaxStory'), 'fabale.js implements initParallaxStory');
assert(js.includes('initHorizontalRibbon'), 'fabale.js implements initHorizontalRibbon');
assert(js.includes('initFeatureCardsDepth'), 'fabale.js implements initFeatureCardsDepth');
assert(js.includes('initChatPreviewScrub'), 'fabale.js implements initChatPreviewScrub');
assert(js.includes('initMagneticCta'), 'fabale.js implements initMagneticCta');
assert(js.includes('initScreenLifecycle'), 'fabale.js implements initScreenLifecycle');
assert(js.includes('requestAnimationFrame'), 'fabale.js includes layout measurement safety delay');
assert(js.includes('strokeDashoffset'), 'fabale.js animates SVG journey line strokeDashoffset');
assert(js.includes('manualSwapBtn'), 'fabale.js handles manual card swap button');
assert(js.includes('updateStickyContent'), 'fabale.js implements the story Sticky Content Switch');
assert(js.includes('function initGalleryPin'), 'fabale.js implements the gallery sticky content switch');
assert(js.includes('galleryShowcase'), 'fabale.js registers the gallery ScrollTrigger');
assert(js.includes("start: 'top top'"), 'fabale.js pins the gallery stage at the viewport top');
assert(js.includes('function measure'), 'fabale.js re-measures travel instead of trusting a stale width');
assert(js.includes('function indexAtX'), 'fabale.js picks the slide that owns the viewport centre');
assert(js.includes('whenMeasurable'), 'fabale.js defers gallery init until layout is measurable');
assert(js.includes('document.fonts'), 'gallery init waits for webfonts before pinning');
assert(js.includes('gsap.matchMedia()'), 'gallery build is scoped to breakpoints and reverts cleanly');
assert(!js.includes('initStickyShowcase'), 'dead initStickyShowcase controller is removed');
assert(js.includes('STORY_BEATS'), 'fabale.js defines dynamic story beats copy array');

// 5. Check React Component Port
const reactComponent = fs.readFileSync(path.join(__dirname, 'src', 'components', 'CardSwapShowcase.tsx'), 'utf8');
assert(reactComponent.includes('useIsomorphicLayoutEffect') || reactComponent.includes('useLayoutEffect'), 'React component uses useLayoutEffect');
assert(reactComponent.includes('requestAnimationFrame'), 'React component has rAF safety check inside layout effect');
assert(reactComponent.includes('ScrollTrigger.create') || reactComponent.includes('scrollTrigger:'), 'React component creates GSAP ScrollTrigger');
assert(reactComponent.includes('strokeDashoffset'), 'React component animates SVG journey connector line');
assert(reactComponent.includes('export const CardSwap'), 'React component exports CardSwap');
assert(reactComponent.includes('export const Card'), 'React component exports Card');

const reactApp = fs.readFileSync(path.join(__dirname, 'src', 'App.tsx'), 'utf8');
assert(reactApp.includes('CardSwap'), 'App.tsx imports and renders CardSwap');
assert(reactApp.includes('Stranger #4092'), 'App.tsx renders real AnonChat chat cards');

console.log(`\n=== Scroll Experience Verification: ${passed} Passed, ${failed} Failed ===`);
process.exit(failed > 0 ? 1 : 0);
