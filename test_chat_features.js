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

// 8 Modern Features in index.html
assert(indexHtml.includes('id="pinnedMessageBar"'), 'index.html has pinnedMessageBar');
assert(indexHtml.includes('id="unpinBtn"'), 'index.html has unpinBtn');
assert(indexHtml.includes('id="bombToggleBtn"'), 'index.html has bombToggleBtn');
assert(indexHtml.includes('id="micBtn"'), 'index.html has micBtn for voice notes');
assert(indexHtml.includes('id="voiceRecordBar"'), 'index.html has voiceRecordBar');
assert(indexHtml.includes('interactive-widget=resizes-content'), 'index.html viewport has interactive-widget=resizes-content');

// CSS Checks
assert(styleCss.includes('.quoted-card'), 'style.css has .quoted-card styling');
assert(styleCss.includes('.msg-reply-btn'), 'style.css has .msg-reply-btn styling');
assert(styleCss.includes('.new-msg-pill'), 'style.css has .new-msg-pill styling');
assert(styleCss.includes('.skip-grace-bar'), 'style.css has .skip-grace-bar styling');
assert(styleCss.includes('.reply-preview-bar'), 'style.css has .reply-preview-bar styling');
assert(styleCss.includes('msgHighlightPulse'), 'style.css has msgHighlightPulse keyframe animation');
assert(styleCss.includes('.pinned-message-bar'), 'style.css has .pinned-message-bar styling');
assert(styleCss.includes('.msg-copy-btn'), 'style.css has .msg-copy-btn styling');
assert(styleCss.includes('.msg-pin-btn'), 'style.css has .msg-pin-btn styling');
assert(styleCss.includes('.msg-swipe-indicator'), 'style.css has .msg-swipe-indicator styling');
assert(styleCss.includes('.reaction-dock'), 'style.css has .reaction-dock styling');
assert(styleCss.includes('.reaction-badge'), 'style.css has .reaction-badge styling');
assert(styleCss.includes('.tick-single') && styleCss.includes('.tick-double') && styleCss.includes('.tick-seen'), 'style.css has status ticks styling');
assert(styleCss.includes('.bomb-btn.active') || styleCss.includes('bombPulse'), 'style.css has bomb button and pulse animation');
assert(styleCss.includes('smokeDissolve'), 'style.css has smokeDissolve animation for ephemeral bombs');
assert(styleCss.includes('.safe-link-chip'), 'style.css has .safe-link-chip styling');
assert(styleCss.includes('.voice-player'), 'style.css has .voice-player styling');
assert(styleCss.includes('waveAudio'), 'style.css has waveAudio waveform animation');

// Client.js Checks
assert(clientJs.includes('isScrolledNearBottom'), 'client.js has isScrolledNearBottom smart scroll guard');
assert(clientJs.includes('setReply'), 'client.js has setReply handler');
assert(clientJs.includes('triggerNextWithGrace'), 'client.js has 3-second accidental skip protection');
assert(clientJs.includes('triggerHaptic'), 'client.js has mobile haptics via navigator.vibrate');
assert(clientJs.includes('setPinnedMessage'), 'client.js has setPinnedMessage real-time logic');
assert(clientJs.includes('unpinMessage'), 'client.js has unpinMessage handler');
assert(clientJs.includes('openReactionDock'), 'client.js has openReactionDock function');
assert(clientJs.includes('addOrUpdateReactionBadge'), 'client.js has reaction badge manager');
assert(clientJs.includes('isBombActive'), 'client.js tracks ephemeral bomb mode');
assert(clientJs.includes('triggerMessageDestruction'), 'client.js has self-destruct countdown and smoke effect');
assert(clientJs.includes('startVoiceRecording'), 'client.js has startVoiceRecording with MediaRecorder');
assert(clientJs.includes('createVoicePlayer'), 'client.js has custom voice note player');
assert(clientJs.includes('formatMessageTextWithSafeLinks'), 'client.js has safe link chip formatter');
assert(clientJs.includes('message_delivered') && clientJs.includes('message_seen'), 'client.js supports delivery and seen tick relays');
assert(clientJs.includes('document.hidden'), 'client.js checks document.hidden to save battery and throttle rAF');

// Server.js Checks
assert(serverJs.includes('replyTo = {'), 'server.js sanitizes and constructs replyTo object');
assert(serverJs.includes('slice(0, 150)'), 'server.js caps quoted text to 150 chars max');
assert(serverJs.includes('replyTo: replyTo'), 'server.js forwards replyTo in receive_message');
assert(serverJs.includes('message_reaction'), 'server.js relays emoji reactions');
assert(serverJs.includes('pin_message'), 'server.js relays pinned messages');
assert(serverJs.includes('unpin_message'), 'server.js relays unpin events');
assert(serverJs.includes('message_delivered'), 'server.js relays delivery ticks');
assert(serverJs.includes('message_seen'), 'server.js relays seen ticks');
assert(serverJs.includes('message_destruct'), 'server.js relays bomb destruction events');
assert(serverJs.includes('partner_focus'), 'server.js relays partner focus states');

console.log(`\n--- Finished: ${passed} Passed, ${failed} Failed ---`);
process.exit(failed === 0 ? 0 : 1);
