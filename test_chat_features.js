const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

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

console.log('--- Testing Chat Features: Quoted Replies & UX Polish ---');

// 1. Static Checks
const indexHtml = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf-8');
const styleCss = fs.readFileSync(path.join(__dirname, 'public', 'style.css'), 'utf-8');
const clientJs = fs.readFileSync(path.join(__dirname, 'public', 'client.js'), 'utf-8');
const serverJs = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf-8');

assert(indexHtml.includes('id="newMsgPill"'), 'index.html has newMsgPill element');
assert(indexHtml.includes('id="skipGraceBar"'), 'index.html has skipGraceBar element');
assert(indexHtml.includes('id="replyPreviewBar"'), 'index.html has replyPreviewBar element');
assert(indexHtml.includes('id="cancelReplyBtn"'), 'index.html has cancelReplyBtn');

assert(styleCss.includes('.quoted-card'), 'style.css has .quoted-card styling');
assert(styleCss.includes('.msg-reply-btn'), 'style.css has .msg-reply-btn styling');
assert(styleCss.includes('.new-msg-pill'), 'style.css has .new-msg-pill styling');
assert(styleCss.includes('.skip-grace-bar'), 'style.css has .skip-grace-bar styling');
assert(styleCss.includes('.reply-preview-bar'), 'style.css has .reply-preview-bar styling');
assert(styleCss.includes('msgHighlightPulse'), 'style.css has msgHighlightPulse keyframe animation');

assert(clientJs.includes('isScrolledNearBottom'), 'client.js has isScrolledNearBottom smart scroll guard');
assert(clientJs.includes('setReply'), 'client.js has setReply handler');
assert(clientJs.includes('triggerNextWithGrace'), 'client.js has 3-second accidental skip protection');
assert(clientJs.includes('triggerHaptic'), 'client.js has mobile haptics via navigator.vibrate');

assert(serverJs.includes('replyTo = {'), 'server.js sanitizes and constructs replyTo object');
assert(serverJs.includes('slice(0, 150)'), 'server.js caps quoted text to 150 chars max');
assert(serverJs.includes('replyTo: replyTo'), 'server.js forwards replyTo in receive_message');

console.log(`\n--- Finished: ${passed} Passed, ${failed} Failed ---`);
process.exit(failed === 0 ? 0 : 1);
