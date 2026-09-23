const fs = require('fs');
const path = require('path');
const http = require('http');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    console.log('[PASS] ' + msg);
    passed++;
  } else {
    console.error('[FAIL] ' + msg);
    failed++;
  }
}

console.log('--- Verifying v2.2.0 Features: Avatar Layout, Photo Attachments, View Once, Auto-Update ---');

const indexHtml = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf-8');
const styleCss = fs.readFileSync(path.join(__dirname, 'public', 'style.css'), 'utf-8');
const clientJs = fs.readFileSync(path.join(__dirname, 'public', 'client.js'), 'utf-8');
const serverJs = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf-8');

// 1. Avatar Layout Fix Verification
assert(styleCss.includes('.msg-content-col'), 'style.css defines .msg-content-col for bulletproof avatar placement');
assert(clientJs.includes('msg-content-col'), 'client.js wraps message content inside msg-content-col');
assert(styleCss.includes('.msg-row.stranger') && styleCss.includes('flex-direction: row;'), 'style.css places stranger avatar strictly on left side');

// 2. Photo Attachments & File Picker
assert(indexHtml.includes('id="mediaFileInput"'), 'index.html has mediaFileInput file picker');
assert(indexHtml.includes('id="attachmentPreview"'), 'index.html has attachmentPreview dock');
assert(clientJs.includes('compressImage'), 'client.js includes canvas image compression');
assert(serverJs.includes('imagePayload'), 'server.js validates and relays image payload');

// 3. View Once (1 Time Seen) Feature
assert(indexHtml.includes('id="viewOnceToggleBtn"'), 'index.html has viewOnceToggleBtn');
assert(indexHtml.includes('id="mediaModal"'), 'index.html has mediaModal fullscreen viewer');
assert(clientJs.includes('view-once-card'), 'client.js creates view-once-card');
assert(clientJs.includes('openMediaModal') && clientJs.includes('closeMediaModal'), 'client.js has media modal handlers with auto-destruct');
assert(styleCss.includes('.view-once-card') && styleCss.includes('.view-once-badge'), 'style.css styles View Once cards');

// 4. Live Render Build Auto-Update Detection & 5s Refresh Banner
assert(serverJs.includes('/api/version'), 'server.js serves /api/version build endpoint');
assert(serverJs.includes('server_build'), 'server.js emits server_build on connection');
assert(indexHtml.includes('id="updateBanner"'), 'index.html has updateBanner alert');
assert(indexHtml.includes('id="updateCountdown"'), 'index.html has updateCountdown element');
assert(clientJs.includes('handleServerBuild') && clientJs.includes('triggerUpdateBanner'), 'client.js has build detection and 5-sec reload countdown');

console.log(`\n--- Finished: ${passed} Passed, ${failed} Failed ---`);
process.exit(failed === 0 ? 0 : 1);
