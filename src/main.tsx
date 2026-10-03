/**
 * Entry point for the React CardSwapShowcase port.
 *
 * The live AnonChat page is vanilla JS in /public and does not use this file.
 * This exists so the React port can actually be rendered and exercised in a
 * browser instead of sitting as unreachable source.
 *
 * Note: styles are NOT imported here. Tailwind is compiled separately by its
 * own CLI into dist-react/tailwind.css and linked from react/index.html, which
 * keeps CSS out of the JS bundle and lets it hot-reload on its own.
 */
import { createRoot } from 'react-dom/client';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import App from './App';

// Dev-only handle. GSAP is bundled rather than loaded as a global, so without
// this there is no way to inspect triggers from the console or from the
// automated scroll tests. esbuild inlines NODE_ENV, so this branch is dropped
// entirely from a production bundle.
if (process.env.NODE_ENV !== 'production') {
  (window as unknown as Record<string, unknown>).__ST = ScrollTrigger;
}

const container = document.getElementById('root');
if (!container) {
  throw new Error('React mount failed: #root not found in the document.');
}

createRoot(container).render(<App />);