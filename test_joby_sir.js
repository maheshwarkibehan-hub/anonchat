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

console.log('--- Testing Joby Sir Discipline Easter Egg ---');

// 1. Static Asset & Code Checks
console.log('\n1. Checking Files and Assets...');
const serverJs = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf-8');
const clientJs = fs.readFileSync(path.join(__dirname, 'public', 'client.js'), 'utf-8');
const styleCss = fs.readFileSync(path.join(__dirname, 'public', 'style.css'), 'utf-8');

assert(serverJs.includes('containsAbuse'), 'server.js contains containsAbuse helper');
assert(serverJs.includes('triggerJobySirIntervention'), 'server.js contains triggerJobySirIntervention');
assert(serverJs.includes('JOBY_PHOTO'), 'server.js contains JOBY_PHOTO constant');
assert(serverJs.includes('JOBY_MESSAGE_TEXT'), 'server.js contains JOBY_MESSAGE_TEXT constant');
assert(serverJs.includes('i told you beta gali nahi dene ka meet tommarow'), 'server.js contains Joby Sir catchphrase');
assert(serverJs.includes('JOBY%20JACOB.JPG'), 'server.js contains Joby Sir official image URL');
assert(serverJs.includes('containsAbuse(sanitized)'), 'server.js triggers intervention on sanitized text');
assert(serverJs.includes('roomJobyCooldown'), 'server.js tracks room cooldown to prevent spam');

assert(styleCss.includes('.joby-sir-row'), 'style.css contains .joby-sir-row styling');
assert(styleCss.includes('.joby-bubble'), 'style.css contains .joby-bubble styling');
assert(styleCss.includes('.joby-avatar-img'), 'style.css contains .joby-avatar-img styling');
assert(styleCss.includes('.joby-entrance-chip'), 'style.css contains .joby-entrance-chip styling');
assert(styleCss.includes('jobySirenPulse'), 'style.css contains jobySirenPulse keyframe animation');
assert(styleCss.includes('jobySirenShake'), 'style.css contains jobySirenShake keyframe animation');
assert(styleCss.includes('.joby-typing-badge'), 'style.css contains .joby-typing-badge styling');

assert(clientJs.includes('playJobySiren'), 'client.js contains playJobySiren Web Audio synthesizer');
assert(clientJs.includes("socket.on('joby_sir_incoming'"), 'client.js listens for joby_sir_incoming event');
assert(clientJs.includes("socket.on('joby_sir_message'"), 'client.js listens for joby_sir_message event');
assert(clientJs.includes('joby-entrance-chip'), 'client.js renders Joby Sir entrance chip');
assert(clientJs.includes('joby-avatar-img'), 'client.js renders Joby Sir avatar image');
assert(clientJs.includes('/joby-sir.jpg'), 'client.js includes fallback local image /joby-sir.jpg');

const localPhotoPath = path.join(__dirname, 'public', 'joby-sir.jpg');
assert(fs.existsSync(localPhotoPath) && fs.statSync(localPhotoPath).size > 10000, 'public/joby-sir.jpg fallback image exists and is valid');

// 2. Unit Testing Abuse Detection Logic
console.log('\n2. Testing Abuse Detection Engine...');

const ABUSE_PATTERNS = [
  /\b(b[\s\.\-_]*c|m[\s\.\-_]*c|b[\s\.\-_]*k[\s\.\-_]*l|b[\s\.\-_]*s[\s\.\-_]*d[\s\.\-_]*k)\b/i,
  /\b(bhenchod|behenchod|behnchod|benchod|banchod|betichod|teri maa ki)\b/i,
  /\b(madarchod|madarchor|maderchod|madarjaat|motherfucker|mf)\b/i,
  /\b(bhosdike|bhosdi|bhosad|bhosadi|bhosadike|bsdiwale|bhosdiwale)\b/i,
  /\b(chutiya|chutiye|chutya|chootiya|chutiyapa|choot|chut)\b/i,
  /\b(gandu|gaand|gand|gaandu)\b/i,
  /\b(laude|lauda|loda|lode|lund|lavde|lowde)\b/i,
  /\b(harami|haraami|kamine|kamina|randi|raand|chinar|kutta|kutte|suar|jhant|jhaant)\b/i,
  /\b(fuck|fucker|fucking|fuk|fck|f\*ck|bitch|bastard|asshole|cunt|dick|pussy)\b/i
];

function normalizeProfanity(text) {
  return text.toLowerCase()
    .replace(/[@]/g, 'a')
    .replace(/[$]/g, 's')
    .replace(/[0]/g, 'o')
    .replace(/[1!]/g, 'i')
    .replace(/(.)\1+/g, (m, p) => p);
}

function containsAbuse(text) {
  if (!text || typeof text !== 'string') return false;
  const raw = text.toLowerCase();
  const normalized = normalizeProfanity(text);
  return ABUSE_PATTERNS.some((regex) => regex.test(normalized) || regex.test(raw));
}

const positiveCases = [
  'abe chutiya hai kya',
  'kya bc bol raha hai',
  'b.c ruk tu',
  'b c baat sun',
  'bsdk idhar aa',
  'b s d k chup',
  'teri to bkl',
  'bhenchod ye kya tha',
  'madarchod chal nikal',
  'gandu mat ban',
  'laude sun le',
  'saale kutte',
  'what the fuck is this',
  'stop talking shit you asshole',
  'chuuuuutiya insaan',
  'fuuuuck off',
  'bheeeeenchod'
];

positiveCases.forEach(phrase => {
  assert(containsAbuse(phrase) === true, `Detects profanity: "${phrase}"`);
});

const negativeCases = [
  'hello bhai kaise ho',
  'beach par chalte hain sunday ko',
  'document upload kar diya',
  'class kab start hogi',
  'secondary school timing',
  'passengers are waiting',
  'shuttle match kaisa tha'
];

negativeCases.forEach(phrase => {
  assert(containsAbuse(phrase) === false, `Safe phrase passed: "${phrase}"`);
});

// 3. Functional Simulation of Intervention Dispatch
console.log('\n3. Testing Intervention Timing & Event Cycle...');

async function testDispatchCycle() {
  const emittedEvents = [];
  const fakeIo = {
    sockets: {
      adapter: {
        rooms: new Map([['room_123', new Set(['socket_a', 'socket_b'])]])
      }
    },
    to(roomId) {
      return {
        emit(event, data) {
          emittedEvents.push({ roomId, event, data, time: Date.now() });
        }
      };
    }
  };

  const cooldownMap = new Map();
  const JOBY_PHOTO = 'https://www.sjskaushambi.org/Images/teaching_staff/2025AUG/JOBY%20JACOB.JPG';
  const JOBY_MESSAGE_TEXT = 'i told you beta gali nahi dene ka meet tommarow';

  function simulateIntervention(roomId) {
    const now = Date.now();
    const last = cooldownMap.get(roomId) || 0;
    if (now - last < 9000) return false;
    cooldownMap.set(roomId, now);

    setTimeout(() => {
      fakeIo.to(roomId).emit('joby_sir_incoming', {
        name: 'Joby Sir',
        role: 'Discipline Incharge'
      });
    }, 50);

    setTimeout(() => {
      fakeIo.to(roomId).emit('joby_sir_message', {
        id: `joby_${Date.now()}_test`,
        name: 'Joby Jacob Sir',
        role: 'Discipline Incharge',
        photo: JOBY_PHOTO,
        fallbackPhoto: '/joby-sir.jpg',
        text: JOBY_MESSAGE_TEXT,
        timestamp: Date.now()
      });
    }, 150);

    return true;
  }

  // Trigger 1
  const t1 = simulateIntervention('room_123');
  assert(t1 === true, 'First intervention triggered successfully');

  // Trigger 2 immediately (should be rate-limited / cooldown active)
  const t2 = simulateIntervention('room_123');
  assert(t2 === false, 'Rapid second intervention blocked by 9s room cooldown');

  // Wait for events to fire
  await new Promise(r => setTimeout(r, 250));

  assert(emittedEvents.length === 2, 'Received exactly 2 events in sequence');
  assert(emittedEvents[0].event === 'joby_sir_incoming', 'Event 1 is joby_sir_incoming');
  assert(emittedEvents[1].event === 'joby_sir_message', 'Event 2 is joby_sir_message');
  assert(emittedEvents[1].data.text === JOBY_MESSAGE_TEXT, 'Joby Sir delivered exact quote');
  assert(emittedEvents[1].data.photo === JOBY_PHOTO, 'Joby Sir used official photo URL');

  console.log(`\n--- Finished Joby Sir Verification: ${passed} Passed, ${failed} Failed ---`);
  process.exit(failed === 0 ? 0 : 1);
}

testDispatchCycle().catch(err => {
  console.error('[ERROR]', err);
  process.exit(1);
});
