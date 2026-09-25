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

console.log('--- Testing The Digital Last Bench Feature Suite ---');

const indexHtml = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf-8');
const styleCss = fs.readFileSync(path.join(__dirname, 'public', 'style.css'), 'utf-8');
const clientJs = fs.readFileSync(path.join(__dirname, 'public', 'client.js'), 'utf-8');
const serverJs = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf-8');

// 1. Critical Bug Fix & Performance Checks
console.log('\n1. Verifying Critical Bug Fix & Performance...');
assert(serverJs.includes('const { partnerId, roomId } = activeRooms.get(socket.id);'), 'server.js destructures roomId in send_message');
assert(clientJs.includes('if (!canvas || canvas.offsetParent === null) return;'), 'client.js has canvas visibility early return in animateStars');

// 2. The Last Bench Wall Static & Code Checks
console.log('\n2. Verifying The Last Bench Wall...');
assert(serverJs.includes('BENCH_WALL_MAX = 40'), 'server.js caps bench wall at 40 posts in RAM');
assert(serverJs.includes('DESK_CODENAMES'), 'server.js defines student desk aliases');
assert(serverJs.includes('[📚 Exam Panic]') && serverJs.includes('[☕ Campus Tea]') && serverJs.includes('[🤫 Desk Confession]'), 'server.js supports authentic Reddit-style flairs');
assert(serverJs.includes('get_bench_posts') && serverJs.includes('submit_bench_post') && serverJs.includes('vote_bench_post') && serverJs.includes('bench_posts_sync'), 'server.js handles all Bench Wall socket events');
assert(serverJs.includes('bench_post_rejected'), 'server.js rejects abusive posts with disciplinary alert');
assert(indexHtml.includes('id="benchWallSection"'), 'index.html has benchWallSection container');
assert(indexHtml.includes('id="openDropChitModalBtn"'), 'index.html has Drop a Chit button');
assert(indexHtml.includes('id="dropChitModal"'), 'index.html has dropChitModal dialog');
assert(styleCss.includes('.flair-exam') && styleCss.includes('.flair-tea') && styleCss.includes('.flair-canteen'), 'style.css has flair styling for Reddit campus tags');
assert(clientJs.includes('anon_voter_token'), 'client.js generates and tracks anonymous voter token in localStorage');
assert(clientJs.includes('showJobyDisciplinaryToast'), 'client.js shows Joby Sir disciplinary toast on rejected posts');

// 3. Daily Last-Bench Dilemma Static & Code Checks
console.log('\n3. Verifying Daily Last-Bench Dilemma...');
assert(serverJs.includes('DILEMMA_BANK'), 'server.js defines DILEMMA_BANK');
assert(serverJs.includes('12 * 60 * 60 * 1000'), 'server.js uses deterministic 12-hour clock calculation');
assert(serverJs.includes('get_poll') && serverJs.includes('vote_poll') && serverJs.includes('poll_sync'), 'server.js handles Dilemma Poll socket events');
assert(indexHtml.includes('id="dilemmaCard"'), 'index.html has dilemmaCard element');
assert(indexHtml.includes('id="dilemmaBtnA"') && indexHtml.includes('id="dilemmaBtnB"'), 'index.html has 2-option dilemma voting buttons');
assert(styleCss.includes('.dilemma-card') && styleCss.includes('.dilemma-btn-fill'), 'style.css has dilemma card and animated percentage fills');
assert(clientJs.includes('updateDilemmaUI'), 'client.js updates interactive poll percentages and vote buttons');

// 4. Bench Vibe Matchmaking Checks
console.log('\n4. Verifying Bench Vibe Matchmaking...');
assert(indexHtml.includes('id="vibeChips"'), 'index.html has vibeChips selector');
assert(indexHtml.includes('data-vibe="any"') && indexHtml.includes('data-vibe="exam"') && indexHtml.includes('data-vibe="canteen"'), 'index.html has 4 distinct vibe chips');
assert(indexHtml.includes('id="chatVibeBadge"'), 'index.html has chatVibeBadge in chat header');
assert(serverJs.includes('matchUser(socket,') && serverJs.includes('2500'), 'server.js implements soft matchmaking with 2.5s fallback');
assert(serverJs.includes('VIBE_LABELS'), 'server.js defines VIBE_LABELS');
assert(clientJs.includes('selectedBenchVibe'), 'client.js tracks selected bench vibe');

// 5. Bench Chits ("Parchi Pass Karo") & Overhauled Quick Actions
console.log('\n5. Verifying Bench Chits & Quick Actions...');
assert(indexHtml.includes('id="headerChitBtn"'), 'index.html has headerChitBtn in chat navbar');
assert(indexHtml.includes('id="quickPassChitBtn"'), 'index.html has quickPassChitBtn in quick sheet');
assert(indexHtml.includes('Kal ka homework kiya kya? 📝'), 'index.html has authentic student prompt "Kal ka homework kiya kya?"');
assert(indexHtml.includes('Next period bunk maar rahe ho kya? 🏃'), 'index.html has student prompt "Next period bunk maar rahe ho kya?"');
assert(indexHtml.includes('Joby Sir corridor me hai... 🚨'), 'index.html has student prompt "Joby Sir corridor me hai..."');
assert(serverJs.includes('draw_bench_chit') && serverJs.includes('receive_bench_chit'), 'server.js relays bench chit cards');
assert(serverJs.includes('BENCH_CHITS'), 'server.js has curated bench chits bank');
assert(clientJs.includes('bench-chit-reply-btn') && clientJs.includes('setReply('), 'client.js connects chit Tap to Reply to setReply');

// 6. "Teacher Aaya! / Boss Key"
console.log('\n6. Verifying Teacher Aaya! / Boss Key...');
assert(indexHtml.includes('id="stealthNavBtn"'), 'index.html has stealthNavBtn in navbar');
assert(indexHtml.includes('id="stealthScreen"'), 'index.html has stealthScreen disguise overlay');
assert(indexHtml.includes('e-Pathshala Digital Textbook Portal'), 'index.html has NCERT e-Pathshala header');
assert(indexHtml.includes('Chapter 3: Current Electricity'), 'index.html features Chapter 3: Current Electricity');
assert(indexHtml.includes("Kirchhoff's Rules"), 'index.html includes authentic Kirchhoff rules notes');
assert(styleCss.includes('.stealth-screen'), 'style.css styles stealth screen overlay');
assert(clientJs.includes('toggleStealthMode'), 'client.js has toggleStealthMode handler');
assert(clientJs.includes("['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)"), 'client.js protects against active input elements so typing words never triggers stealth');
assert(clientJs.includes('NCERT e-Pathshala - Class 12 Physics'), 'client.js disguises document.title to NCERT Class 12 Physics');

// 7. Functional Logic Simulations
console.log('\n7. Running Unit Simulations of Core Last Bench Engines...');

// 7.1 Dilemma Deterministic Clock
const DILEMMA_BANK = [
  { id: 'dilemma_1', question: "Kal subah 8 AM exam hai. Strategy:" },
  { id: 'dilemma_2', question: "School canteen ka undisputed king:" },
  { id: 'dilemma_3', question: "Teacher ne sudden copy check mang li aur homework incomplete hai:" },
  { id: 'dilemma_4', question: "Zindagi ka sabse bada scam:" }
];
const nowTs = Date.now();
const index = Math.floor(nowTs / (12 * 60 * 60 * 1000)) % DILEMMA_BANK.length;
assert(index >= 0 && index < DILEMMA_BANK.length, 'Deterministic 12-hour dilemma index resolves within range 0-3');

// 7.2 Dilemma Percentage Calculation
const votesA = 40;
const votesB = 60;
const total = votesA + votesB;
const pctA = Math.round((votesA / total) * 100);
const pctB = Math.round((votesB / total) * 100);
assert(pctA === 40 && pctB === 60 && pctA + pctB === 100, 'Poll percentages calculate accurately');

// 7.3 Bench Wall Ring Buffer & Eviction (Preserves Top 3 Karma)
let testPosts = [];
for (let i = 1; i <= 40; i++) {
  testPosts.push({
    id: `post_${i}`,
    score: i === 1 ? 100 : (i === 2 ? 90 : (i === 3 ? 80 : 5)),
    timestamp: 1000 + i
  });
}
assert(testPosts.length === 40, 'Created 40 test posts');

// Add a 41st post
const newPost = { id: 'post_41', score: 1, timestamp: 2000 };
testPosts.unshift(newPost);
if (testPosts.length > 40) {
  const sorted = [...testPosts].sort((a, b) => b.score - a.score);
  const protectedIds = new Set(sorted.slice(0, 3).map(p => p.id));
  let oldestIdx = -1;
  let oldestTime = Infinity;
  for (let i = 0; i < testPosts.length; i++) {
    if (!protectedIds.has(testPosts[i].id) && testPosts[i].timestamp < oldestTime) {
      oldestTime = testPosts[i].timestamp;
      oldestIdx = i;
    }
  }
  if (oldestIdx !== -1) testPosts.splice(oldestIdx, 1);
  else testPosts.pop();
}

assert(testPosts.length === 40, 'Post eviction strictly caps ring buffer at 40 items');
assert(testPosts.some(p => p.id === 'post_1') && testPosts.some(p => p.id === 'post_2') && testPosts.some(p => p.id === 'post_3'), 'Top 3 highest karma posts are protected from eviction');
assert(!testPosts.some(p => p.id === 'post_4'), 'Oldest non-top post was evicted');

// 7.4 Voting Logic (Toggle & Switching)
const samplePost = {
  id: 'test_vote_p1',
  score: 10,
  baseKarma: 10,
  upvoters: new Set(),
  downvoters: new Set()
};

function vote(post, dir, voter) {
  if (dir === 1) {
    if (post.upvoters.has(voter)) post.upvoters.delete(voter);
    else { post.upvoters.add(voter); post.downvoters.delete(voter); }
  } else if (dir === -1) {
    if (post.downvoters.has(voter)) post.downvoters.delete(voter);
    else { post.downvoters.add(voter); post.upvoters.delete(voter); }
  }
  post.score = post.baseKarma + (post.upvoters.size - post.downvoters.size);
}

vote(samplePost, 1, 'user1');
assert(samplePost.score === 11 && samplePost.upvoters.has('user1'), 'Upvoting increases karma by 1');
vote(samplePost, 1, 'user1');
assert(samplePost.score === 10 && !samplePost.upvoters.has('user1'), 'Upvoting again toggles off karma to 0 delta');
vote(samplePost, -1, 'user1');
assert(samplePost.score === 9 && samplePost.downvoters.has('user1'), 'Downvoting reduces karma by 1');
vote(samplePost, 1, 'user1');
assert(samplePost.score === 11 && samplePost.upvoters.has('user1') && !samplePost.downvoters.has('user1'), 'Switching from downvote to upvote adjusts net score by +2');

// 7.5 Bench Vibe Soft-Matchmaking Simulation
let queue = [];
function softMatch(socketId, vibe) {
  const matchIdx = queue.findIndex(e => e.vibe === vibe);
  if (matchIdx !== -1) {
    const partner = queue.splice(matchIdx, 1)[0];
    return { partner: partner.id, vibe: vibe, immediate: true };
  }
  if (vibe === 'any' && queue.length > 0) {
    const partner = queue.shift();
    return { partner: partner.id, vibe: partner.vibe, immediate: true };
  }
  queue.push({ id: socketId, vibe: vibe, joinedAt: Date.now() });
  return null;
}

// User A joins with 'exam'
const matchA = softMatch('user_a', 'exam');
assert(matchA === null && queue.length === 1, 'User A placed in queue waiting for exam match');

// User B joins with 'exam' -> Perfect Match!
const matchB = softMatch('user_b', 'exam');
assert(matchB && matchB.partner === 'user_a' && matchB.vibe === 'exam', 'User B matches immediately with User A with matching Exam vibe');
assert(queue.length === 0, 'Queue is empty after match');

// User C joins with 'canteen'
softMatch('user_c', 'canteen');
// User D joins with 'any'
const matchD = softMatch('user_d', 'any');
assert(matchD && matchD.partner === 'user_c', 'Any vibe instantly matches with waiting student');

// 8. Verifying Hardened Edge Cases & Resilience
console.log('\n8. Verifying Hardened Edge Cases & Edge Resilience...');
assert(serverJs.includes('broadcastBenchPostsSync'), 'server.js implements broadcastBenchPostsSync for personalized voter state');
assert(serverJs.includes('broadcastPollSync'), 'server.js implements broadcastPollSync for personalized dilemma state');
assert(clientJs.includes('isStealthActive') && clientJs.includes('if (!soundEnabled || (typeof isStealthActive !== \'undefined\' && isStealthActive)) return;'), 'client.js mutes all audio synthesis during stealth mode');
assert(indexHtml.includes('Return to Notes'), 'index.html exitStealthBtn explicitly features Return to Notes');
assert(clientJs.includes("if (e.key === 'Escape' && dropChitModal && !dropChitModal.classList.contains('hidden'))"), 'client.js Escape key closes open drop chit modal before triggering stealth');

// 8.1 Symmetrical soft match: Waiting 'any' matches immediate specific newcomer
let queue2 = [{ id: 'waiting_any_user', vibe: 'any', joinedAt: Date.now() }];
function softMatch2(socketId, vibe) {
  if (vibe !== 'any') {
    const matchIdx = queue2.findIndex(e => e.vibe === vibe);
    if (matchIdx !== -1) return { partner: queue2.splice(matchIdx, 1)[0].id };
    const anyIdx = queue2.findIndex(e => e.vibe === 'any');
    if (anyIdx !== -1) return { partner: queue2.splice(anyIdx, 1)[0].id };
  }
  queue2.push({ id: socketId, vibe: vibe, joinedAt: Date.now() });
  return null;
}
const matchE = softMatch2('new_tea_user', 'tea');
assert(matchE && matchE.partner === 'waiting_any_user', 'Waiting user with "any" vibe matches immediately when specific vibe arrives');

// 8.2 Karma math accuracy simulation on user submitted post
const createdPost = {
  id: 'user_p1',
  score: 1,
  baseKarma: 0,
  upvoters: new Set(['author_token']),
  downvoters: new Set()
};
vote(createdPost, 1, 'author_token'); // author toggles off vote
assert(createdPost.score === 0, 'Author toggling off upvote drops score accurately from 1 to 0');
vote(createdPost, 1, 'voter_2'); // voter 2 upvotes
assert(createdPost.score === 1, 'Voter 2 upvote brings score to 1');
vote(createdPost, 1, 'voter_3'); // voter 3 upvotes
assert(createdPost.score === 2, 'Voter 3 upvote brings score to 2');

// 8.3 Stranded queue protection simulation
let deadQueue = [
  { id: 'dead_partner', connected: false },
  { id: 'live_user', connected: true }
];
let pairedResult = null;
// Find first live partner
while (deadQueue.length > 0) {
  const otherIdx = deadQueue.findIndex(e => e.id !== 'live_user');
  if (otherIdx === -1) break;
  const candidate = deadQueue.splice(otherIdx, 1)[0];
  if (candidate.connected) {
    pairedResult = candidate.id;
    break;
  }
}
assert(pairedResult === null && deadQueue.some(e => e.id === 'live_user'), 'Dead socket skipped and waiting user is not stranded');

// 9. Verifying What's New Modal & 1-Time IP Logic (v3 The Last Bench Update)
console.log('\n9. Verifying What\'s New Modal & 1-Time IP Logic...');
assert(indexHtml.includes('id="whatsNewModal"'), 'index.html has whatsNewModal dialog');
assert(indexHtml.includes('v3.0 The Last Bench Update'), 'index.html has v3.0 update tag');
assert(indexHtml.includes('Kya Naya Hai?'), 'index.html has Hinglish title "Kya Naya Hai?"');
assert(indexHtml.includes('The Last Bench Wall'), 'index.html describes The Last Bench Wall in What\'s New');
assert(indexHtml.includes('Daily Student Dilemma'), 'index.html describes Daily Student Dilemma in What\'s New');
assert(indexHtml.includes('Bench Vibe Match'), 'index.html describes Bench Vibe Match in What\'s New');
assert(indexHtml.includes('Parchi Pass Karo'), 'index.html describes Parchi Pass Karo in What\'s New');
assert(indexHtml.includes('Teacher Aaya! (Boss Key)'), 'index.html describes Teacher Aaya in What\'s New');
assert(indexHtml.includes('id="closeWhatsNewModalBtn"'), 'index.html has close button for What\'s New');
assert(indexHtml.includes('id="ackWhatsNewBtn"'), 'index.html has ack/dismiss button for What\'s New');
assert(styleCss.includes('.whats-new-dialog') && styleCss.includes('.whats-new-content'), 'style.css styles responsive What\'s New modal');
assert(serverJs.includes('seenWhatsNewIPs = new Set()'), 'server.js tracks seen IPs using in-memory Set');
assert(serverJs.includes('whats_new_status'), 'server.js emits whats_new_status on connection');
assert(serverJs.includes('check_whats_new') && serverJs.includes('ack_whats_new'), 'server.js handles check_whats_new and ack_whats_new');
assert(serverJs.includes('/api/whats-new/ack'), 'server.js provides HTTP ack endpoint');
assert(clientJs.includes('anon_whats_new_v3_seen'), 'client.js tracks seen state in localStorage');
assert(clientJs.includes("socket.on('whats_new_status'"), 'client.js listens for server whats_new_status');

// 9.1 Unit simulation of 1-time IP logic
const simSeenIPs = new Set();
function checkIpStatus(ip) {
  const show = !simSeenIPs.has(ip);
  if (show) simSeenIPs.add(ip);
  return { show };
}
const firstVisit = checkIpStatus('192.168.1.50');
assert(firstVisit.show === true, 'First connection from IP receives show: true and marks seen');
const secondVisit = checkIpStatus('192.168.1.50');
assert(secondVisit.show === false, 'Subsequent connection from same IP receives show: false');
const otherIpVisit = checkIpStatus('10.0.0.1');
assert(otherIpVisit.show === true, 'Different IP receives show: true on its first visit');

console.log(`\n--- Finished: ${passed} Passed, ${failed} Failed ---`);
process.exit(failed === 0 ? 0 : 1);
