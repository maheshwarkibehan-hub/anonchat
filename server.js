const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

// Maintenance Mode: Disabled by default (Set MAINTENANCE_MODE=true or create .maintenance file to enable)
const MAINTENANCE_FILE = path.join(__dirname, '.maintenance');
function isMaintenanceActive() {
  return process.env.MAINTENANCE_MODE === 'true' || fs.existsSync(MAINTENANCE_FILE);
}

app.use((req, res, next) => {
  if (isMaintenanceActive()) {
    if (req.path.startsWith('/socket.io/')) {
      return res.status(503).json({ error: 'Maintenance mode active' });
    }
    if (req.path === '/' || req.path.endsWith('.html') || !path.extname(req.path)) {
      res.status(503);
      return res.sendFile(path.join(__dirname, 'public', 'maintenance.html'));
    }
  }
  next();
});

// Reject Socket.io connections while maintenance is enabled
io.use((socket, next) => {
  if (isMaintenanceActive()) {
    return next(new Error('MAINTENANCE_MODE'));
  }
  next();
});

// Build version & timestamp tracking for zero-downtime auto-updates
const pkg = require('./package.json');
const BUILD_VERSION = pkg.version || '2.2.0';
const BUILD_ID = `${BUILD_VERSION}-${Date.now().toString(36)}`;

// Force no-cache on frontend assets so code updates are never stale
app.use((req, res, next) => {
  if (req.path.endsWith('.js') || req.path.endsWith('.css') || req.path === '/' || req.path.endsWith('.html')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Clean route for privacy policy page
app.get('/privacy', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'privacy.html'));
});

// Trust proxy for accurate client IP detection behind proxies / cloud hosts
app.set('trust proxy', true);

// In-memory set of IPs that have already seen the What's New modal
const seenWhatsNewIPs = new Set();

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.connection?.remoteAddress || '127.0.0.1';
}

// Live version & what's new check endpoint
app.get('/api/version', (req, res) => {
  const ip = getClientIp(req);
  const shouldShow = !seenWhatsNewIPs.has(ip);
  if (shouldShow) {
    seenWhatsNewIPs.add(ip);
  }
  res.json({
    version: BUILD_VERSION,
    buildId: BUILD_ID,
    timestamp: Date.now(),
    shouldShowWhatsNew: shouldShow
  });
});

// Acknowledge What's New modal seen for this IP
app.post('/api/whats-new/ack', (req, res) => {
  const ip = getClientIp(req);
  seenWhatsNewIPs.add(ip);
  res.json({ ok: true, ipSeen: true });
});

// Matchmaking state (In-Memory / Zero DB)
let waitingQueue = [];
const activeRooms = new Map(); // socket.id -> { partnerId, roomId }

// --- Private Chat Session Logger (Structured for AI Training Datasets) ---
const CHAT_LOG_DIR = path.join(__dirname, 'chat');
const chatSessions = new Map(); // roomId -> session object

function getLocalDateFolder() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getLocalTimePrefix() {
  const d = new Date();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${hours}-${minutes}-${seconds}`;
}

function initChatSession(roomId, socketAId, socketBId, vibeLabel) {
  const dateFolder = getLocalDateFolder();
  const timePrefix = getLocalTimePrefix();
  const dayDir = path.join(CHAT_LOG_DIR, dateFolder);
  const fileName = `chat_${timePrefix}_${roomId}.json`;
  const filePath = path.join(dayDir, fileName);

  chatSessions.set(roomId, {
    roomId,
    vibe: vibeLabel || 'Any Bench 🎒',
    dayFolder,
    fileName,
    filePath,
    dayDir,
    startTime: new Date().toISOString(),
    endTime: null,
    durationSeconds: 0,
    userAliases: {
      [socketAId]: 'Student_1',
      [socketBId]: 'Student_2'
    },
    messages: [],
    openai_format: [],
    sharegpt_format: [],
    writeTimer: null
  });
}

async function flushSessionToFile(session) {
  if (!session || !session.filePath) return;
  try {
    if (!fs.existsSync(session.dayDir)) {
      fs.mkdirSync(session.dayDir, { recursive: true });
    }

    const payload = {
      metadata: {
        roomId: session.roomId,
        vibe: session.vibe,
        date: session.dayFolder,
        startTime: session.startTime,
        endTime: session.endTime,
        durationSeconds: session.durationSeconds,
        totalMessages: session.messages.length,
        aiTrainingReady: session.openai_format.length >= 2
      },
      messages: session.messages,
      ai_dataset: {
        openai_format: session.openai_format,
        sharegpt_format: session.sharegpt_format
      }
    };

    await fs.promises.writeFile(session.filePath, JSON.stringify(payload, null, 2), 'utf8');
  } catch (err) {
    // Non-blocking error containment so real-time socket delivery is never disrupted
  }
}

function scheduleSessionFlush(session) {
  if (!session) return;
  if (session.writeTimer) clearTimeout(session.writeTimer);
  session.writeTimer = setTimeout(() => {
    flushSessionToFile(session);
  }, 100);
}

function recordChatMessage(roomId, socketId, msgData) {
  const session = chatSessions.get(roomId);
  if (!session) return;

  const sender = session.userAliases[socketId] || 'Student_1';
  const role = sender === 'Student_1' ? 'user' : 'assistant';
  const shareGptRole = sender === 'Student_1' ? 'human' : 'gpt';

  const text = typeof msgData.text === 'string' ? msgData.text.trim() : '';

  let msgType = 'text';
  if (msgData.audio) msgType = 'voice_note';
  else if (msgData.image) msgType = 'image';

  const entry = {
    turn: session.messages.length + 1,
    msgId: msgData.msgId || `msg_${Date.now()}`,
    sender,
    role,
    timestamp: Date.now(),
    isoTime: new Date().toISOString(),
    type: msgType,
    text: text,
    ephemeral: !!msgData.ephemeral,
    replyTo: msgData.replyTo ? { text: msgData.replyTo.text, author: msgData.replyTo.author } : null
  };

  session.messages.push(entry);

  if (text) {
    session.openai_format.push({
      role,
      content: text
    });
    session.sharegpt_format.push({
      from: shareGptRole,
      value: text
    });
  }

  scheduleSessionFlush(session);
}

function recordChatSystemEvent(roomId, eventType, text) {
  const session = chatSessions.get(roomId);
  if (!session) return;

  const entry = {
    turn: session.messages.length + 1,
    msgId: `event_${Date.now()}`,
    sender: 'System',
    role: 'system',
    timestamp: Date.now(),
    isoTime: new Date().toISOString(),
    type: eventType,
    text: text
  };

  session.messages.push(entry);
  scheduleSessionFlush(session);
}

// GitHub Auto-Upload Sync Queue (Supports GitHub REST API on Render + Local Git CLI)
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GITHUB_REPO = process.env.GITHUB_REPO || 'maheshwarkibehan-hub/anonchat';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';

let isGitSyncRunning = false;
const gitSyncQueue = [];

async function triggerAutoUpload(filePath) {
  if (!fs.existsSync(filePath)) return;

  // 1. If GITHUB_TOKEN is provided (Recommended for Render cloud hosting)
  if (GITHUB_TOKEN) {
    try {
      const fileContent = await fs.promises.readFile(filePath, 'utf8');
      const relativePath = path.relative(__dirname, filePath).replace(/\\/g, '/');
      const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${relativePath}`;

      let sha = undefined;
      try {
        const getRes = await fetch(`${url}?ref=${GITHUB_BRANCH}`, {
          headers: {
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github+json',
            'User-Agent': 'AnonChat-AutoSync'
          }
        });
        if (getRes.ok) {
          const resData = await getRes.json();
          sha = resData.sha;
        }
      } catch (e) {}

      const body = {
        message: `archive: sync ${path.basename(filePath)} [skip ci] [skip render]`,
        content: Buffer.from(fileContent, 'utf8').toString('base64'),
        branch: GITHUB_BRANCH
      };
      if (sha) body.sha = sha;

      const putRes = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'User-Agent': 'AnonChat-AutoSync'
        },
        body: JSON.stringify(body)
      });

      if (putRes.ok) {
        console.log(`[GitHub Sync] Uploaded ${relativePath} directly via API [skip ci]`);
        return;
      }
    } catch (err) {
      console.error('[GitHub API Upload Error]', err.message);
    }
  }

  // 2. Fallback: Local Git CLI auto-commit & push (when running locally with .git directory)
  if (fs.existsSync(path.join(__dirname, '.git'))) {
    gitSyncQueue.push(filePath);
    processNextGitSync();
  }
}

function processNextGitSync() {
  if (isGitSyncRunning || gitSyncQueue.length === 0) return;
  isGitSyncRunning = true;
  const targetFile = gitSyncQueue.shift();

  // Commit and push with [skip ci] [skip render] to prevent auto-deploy loop on Render
  const cmd = `git add "chat" && git commit -m "archive: auto-save chat session [skip ci] [skip render]" && git push origin ${GITHUB_BRANCH}`;

  exec(cmd, { cwd: __dirname }, (error, stdout, stderr) => {
    isGitSyncRunning = false;
    if (error) {
      if (!error.message.includes('nothing to commit')) {
        console.error('[Git Auto-Push]', error.message.split('\n')[0]);
      }
    } else {
      console.log('[Git Auto-Push] Successfully pushed chat archive to GitHub [skip ci]');
    }

    if (gitSyncQueue.length > 0) {
      setTimeout(processNextGitSync, 1500);
    }
  });
}

function finishChatSession(roomId) {
  const session = chatSessions.get(roomId);
  if (!session) return;

  if (session.writeTimer) clearTimeout(session.writeTimer);
  session.endTime = new Date().toISOString();
  session.durationSeconds = Math.max(0, Math.round((Date.now() - new Date(session.startTime).getTime()) / 1000));

  // Only keep conversation logs that have at least 1 user message
  if (session.messages.length > 0) {
    flushSessionToFile(session).then(() => {
      // Trigger automatic GitHub upload
      triggerAutoUpload(session.filePath);
    });
  } else {
    try {
      if (fs.existsSync(session.filePath)) {
        fs.unlinkSync(session.filePath);
      }
    } catch (e) {}
  }

  chatSessions.delete(roomId);
}

// Joby Sir Discipline Easter Egg State
const roomJobyCooldown = new Map(); // roomId -> timestamp of last intervention
const JOBY_PHOTO = 'https://www.sjskaushambi.org/Images/teaching_staff/2025AUG/JOBY%20JACOB.JPG';
const JOBY_MESSAGE_TEXT = 'i told you beta gali nahi dene ka meet tommarow';

const ABUSE_PATTERNS = [
  /\b(b[\s\.\-_]*c|m[\s\.\-_]*c|b[\s\.\-_]*k[\s\.\-_]*l|b[\s\.\-_]*s[\s\.\-_]*d[\s\.\-_]*k[a-z]*)\b/i,
  /\b(bhenchod|behenchod|behnchod|benchod|banchod|betichod|teri maa ki)\b/i,
  /\b(madarchod|madarchor|maderchod|madarjaat|motherfucker|mf)\b/i,
  /\b(bhosdike|bhosadike|bhosdika|bhosad|bhosdi|bhosadi|bsdiwale|bhosdiwale|bsdk)\b/i,
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

function triggerJobySirIntervention(roomId, senderSocket = null, partnerSocket = null) {
  if (!roomId) return;
  const now = Date.now();
  const lastIntervention = roomJobyCooldown.get(roomId) || 0;
  if (now - lastIntervention < 8000) return; // 8s cooldown per room
  roomJobyCooldown.set(roomId, now);

  const incomingPayload = {
    name: 'Joby Sir',
    role: 'Discipline Incharge'
  };

  const messagePayload = {
    id: `joby_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: 'Joby Jacob Sir',
    role: 'Discipline Incharge',
    photo: JOBY_PHOTO,
    fallbackPhoto: '/joby-sir.jpg',
    text: JOBY_MESSAGE_TEXT,
    timestamp: Date.now()
  };

  // 1. Alert typing indicator
  setTimeout(() => {
    io.to(roomId).emit('joby_sir_incoming', incomingPayload);
    if (senderSocket && senderSocket.connected) senderSocket.emit('joby_sir_incoming', incomingPayload);
    if (partnerSocket && partnerSocket.connected) partnerSocket.emit('joby_sir_incoming', incomingPayload);
  }, 250);

  // 2. Deliver Joby Sir's reprimand message
  setTimeout(() => {
    io.to(roomId).emit('joby_sir_message', messagePayload);
    if (senderSocket && senderSocket.connected) senderSocket.emit('joby_sir_message', messagePayload);
    if (partnerSocket && partnerSocket.connected) partnerSocket.emit('joby_sir_message', messagePayload);
    recordChatSystemEvent(roomId, 'teacher_intervention', `Joby Sir: ${JOBY_MESSAGE_TEXT}`);
  }, 1200);
}


// Rate limiting & DoS guards (Sliding window on socket.data, 0 extra deps)
function isRateLimited(socket, limit = 20, windowMs = 2000, key = 'msgTimestamps') {
  const now = Date.now();
  if (!socket.data) socket.data = {};
  if (!socket.data[key]) socket.data[key] = [];
  socket.data[key] = socket.data[key].filter((t) => now - t < windowMs);
  if (socket.data[key].length >= limit) return true;
  socket.data[key].push(now);
  return false;
}

function isActionThrottled(socket, minIntervalMs = 500) {
  const now = Date.now();
  if (socket.data.lastAction && now - socket.data.lastAction < minIntervalMs) return true;
  socket.data.lastAction = now;
  return false;
}

let onlineBroadcastTimer = null;
function broadcastOnlineCount(delay = 1500) {
  if (onlineBroadcastTimer) return;
  onlineBroadcastTimer = setTimeout(() => {
    onlineBroadcastTimer = null;
    io.emit('online_count', { count: io.engine.clientsCount });
  }, delay);
}

// ==========================================================================
// The Digital Last Bench: Real Student Life & Reddit-Inspired Architecture
// Pure RAM / Zero DB state
// ==========================================================================

// 1. The Last Bench Wall (Ephemeral Reddit-style Campus Feed in RAM, Max 40)
const BENCH_WALL_MAX = 40;
const DESK_CODENAMES = [
  'Backbencher #42', 'Physics Sufferer #09', 'Canteen Samosa King', 'Proxy Master #17',
  'Notes Beggar #03', 'Joby Sir Radar #88', 'Section D Rebel #12', 'Viva Survivor #21',
  'Sleep Deprived #01', 'Front Bencher Traitor #99', 'Formula Sheet Ninja #33',
  'Corridor Wanderer #07', 'Defaulter List #05', 'Tiffin Box Raider #14'
];

function getRandomDeskCodename() {
  const base = DESK_CODENAMES[Math.floor(Math.random() * DESK_CODENAMES.length)];
  const num = Math.floor(10 + Math.random() * 90);
  return base.includes('#') ? base.replace(/#\d+/, `#${num}`) : `${base} #${num}`;
}

const VALID_FLAIRS = [
  '[📚 Exam Panic]',
  '[☕ Campus Tea]',
  '[🤫 Desk Confession]',
  '[🔥 Hot Take]',
  '[🥪 Canteen & Bunk]',
  '[🆘 Notes SOS]'
];

let benchWallPosts = [
  {
    id: 'bench_seed_1',
    deskCodename: 'Backbencher #42',
    flair: '[📚 Exam Panic]',
    content: "Physics practical viva me examiner ne pucha galvanometer ka use, maine bola 'sir Joby Sir ki entry detect karne ke liye' 😭",
    timestamp: Date.now() - 3600000,
    score: 18,
    baseKarma: 18,
    upvoters: new Set(),
    downvoters: new Set()
  },
  {
    id: 'bench_seed_2',
    deskCodename: 'Section D Rebel #12',
    flair: '[☕ Campus Tea]',
    content: "Corridor me Joby Sir ka round chal raha hai, washroom bunk karne wale sabhi legends alert ho jao! 🚨",
    timestamp: Date.now() - 7200000,
    score: 24,
    baseKarma: 24,
    upvoters: new Set(),
    downvoters: new Set()
  },
  {
    id: 'bench_seed_3',
    deskCodename: 'Canteen Samosa King #09',
    flair: '[🥪 Canteen & Bunk]',
    content: "3rd period English bunk karke garam samosa + red chutney khane ka ghamand hai 🥟🔥",
    timestamp: Date.now() - 10800000,
    score: 31,
    baseKarma: 31,
    upvoters: new Set(),
    downvoters: new Set()
  },
  {
    id: 'bench_seed_4',
    deskCodename: 'Notes Beggar #03',
    flair: '[🆘 Notes SOS]',
    content: "Class 12 Current Electricity ke short formula sheet de do koi, kal test me pass hona hai bhai! 🆘",
    timestamp: Date.now() - 14400000,
    score: 12,
    baseKarma: 12,
    upvoters: new Set(),
    downvoters: new Set()
  }
];

function sanitizeBenchPostForClient(post, voterToken) {
  return {
    id: post.id,
    deskCodename: post.deskCodename,
    flair: post.flair,
    content: post.content,
    timestamp: post.timestamp,
    score: post.score,
    userVote: voterToken && post.upvoters.has(voterToken) ? 1 : (voterToken && post.downvoters.has(voterToken) ? -1 : 0)
  };
}

function getBenchPostsPayload(voterToken = null) {
  return benchWallPosts
    .slice()
    .sort((a, b) => b.score - a.score || b.timestamp - a.timestamp)
    .map((p) => sanitizeBenchPostForClient(p, voterToken));
}

function broadcastBenchPostsSync() {
  for (const [id, s] of io.sockets.sockets) {
    s.emit('bench_posts_sync', getBenchPostsPayload(s.data?.voterToken));
  }
}

function addBenchPost(post) {
  benchWallPosts.unshift(post);
  if (benchWallPosts.length > BENCH_WALL_MAX) {
    // Preserve top 3 highest karma posts, evict oldest of the rest
    const sorted = [...benchWallPosts].sort((a, b) => b.score - a.score);
    const protectedIds = new Set(sorted.slice(0, 3).map((p) => p.id));
    let oldestIdx = -1;
    let oldestTime = Infinity;
    for (let i = 0; i < benchWallPosts.length; i++) {
      if (!protectedIds.has(benchWallPosts[i].id) && benchWallPosts[i].timestamp < oldestTime) {
        oldestTime = benchWallPosts[i].timestamp;
        oldestIdx = i;
      }
    }
    if (oldestIdx !== -1) {
      benchWallPosts.splice(oldestIdx, 1);
    } else {
      benchWallPosts.pop();
    }
  }
}

function handleBenchVote(postId, dir, voterToken) {
  if (!voterToken || (dir !== 1 && dir !== -1)) return false;
  const post = benchWallPosts.find((p) => p.id === postId);
  if (!post) return false;

  const hasUpvoted = post.upvoters.has(voterToken);
  const hasDownvoted = post.downvoters.has(voterToken);

  if (dir === 1) {
    if (hasUpvoted) {
      post.upvoters.delete(voterToken);
    } else {
      post.upvoters.add(voterToken);
      post.downvoters.delete(voterToken);
    }
  } else if (dir === -1) {
    if (hasDownvoted) {
      post.downvoters.delete(voterToken);
    } else {
      post.downvoters.add(voterToken);
      post.upvoters.delete(voterToken);
    }
  }

  post.score = (post.baseKarma || 0) + (post.upvoters.size - post.downvoters.size);
  return true;
}

// 2. Daily Last-Bench Dilemma (Deterministic 12-Hour Reddit-style Poll)
const DILEMMA_BANK = [
  {
    id: 'dilemma_1',
    question: "Kal subah 8 AM exam hai. Strategy:",
    optionA: "Raat bhar one-shot video (Hero banenge) ⚡",
    optionB: "So jao, jo hoga kal dekha jayega 😴"
  },
  {
    id: 'dilemma_2',
    question: "School canteen ka undisputed king:",
    optionA: "Garam Samosa + Red Chutney 🥟",
    optionB: "Crispy Cheese Patties 🥐"
  },
  {
    id: 'dilemma_3',
    question: "Teacher ne sudden copy check mang li aur homework incomplete hai:",
    optionA: "'Copy ghar pe bhul gaya' acting 🎭",
    optionB: "Washroom jane ka emergency excuse 🏃"
  },
  {
    id: 'dilemma_4',
    question: "Zindagi ka sabse bada scam:",
    optionA: "'10th ke baad aish hi aish hai' 🤡",
    optionB: "'College me attendance koi nahi dekhta' 💀"
  }
];

const dilemmaVotes = new Map();

function getActiveDilemma() {
  const index = Math.floor(Date.now() / (12 * 60 * 60 * 1000)) % DILEMMA_BANK.length;
  const dilemma = DILEMMA_BANK[index];
  if (!dilemmaVotes.has(dilemma.id)) {
    dilemmaVotes.set(dilemma.id, {
      optionA: new Set(),
      optionB: new Set(),
      baseA: 38 + (index * 7) % 20,
      baseB: 29 + (index * 11) % 20
    });
  }
  return dilemma;
}

function getPollPayload(voterToken = null) {
  const dilemma = getActiveDilemma();
  const votes = dilemmaVotes.get(dilemma.id);
  const countA = votes.baseA + votes.optionA.size;
  const countB = votes.baseB + votes.optionB.size;
  const total = countA + countB;
  let userChoice = null;
  if (voterToken) {
    if (votes.optionA.has(voterToken)) userChoice = 'optionA';
    else if (votes.optionB.has(voterToken)) userChoice = 'optionB';
  }
  return {
    id: dilemma.id,
    question: dilemma.question,
    optionA: dilemma.optionA,
    optionB: dilemma.optionB,
    votesA: countA,
    votesB: countB,
    totalVotes: total,
    percentA: Math.round((countA / (total || 1)) * 100),
    percentB: Math.round((countB / (total || 1)) * 100),
    userChoice: userChoice
  };
}

function broadcastPollSync() {
  for (const [id, s] of io.sockets.sockets) {
    s.emit('poll_sync', getPollPayload(s.data?.voterToken));
  }
}

// 3. Bench Chits ("Parchi Pass Karo") Bank
const BENCH_CHITS = [
  "Agar Joby Sir ne corridor me bina pass ke pakad liya, toh pehla bahana kya hoga? 🚨",
  "Kal ka homework kiya kya sach batao? 📝",
  "Next period bunk maar rahe ho kya? 🏃",
  "Joby Sir ka chakkar lag raha hai corridor me... 🚨",
  "Notes bhej do yaar practical ke! 🆘",
  "Canteen me kya khayein aaj? 🥪",
  "Last bench pe baith ke lunch box kis period me khate ho? 🍱",
  "Practical viva me sabse bekaar answer kya diya tha? 💀",
  "Class test me cheat code pass karne ka best tareeka? 📄",
  "Coaching vs School: Sabse bada scam kaunsa laga? 🤡"
];

const VIBE_LABELS = {
  any: 'Any Bench 🎒',
  exam: 'Exam Panic 📚',
  tea: 'School Tea ☕',
  canteen: 'Canteen & Bakchodi 🥪'
};

function pairUsers(socketA, socketB, vibeLabel = 'Any Bench 🎒') {
  const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  socketA.join(roomId);
  socketB.join(roomId);

  activeRooms.set(socketA.id, { partnerId: socketB.id, roomId, vibe: vibeLabel });
  activeRooms.set(socketB.id, { partnerId: socketA.id, roomId, vibe: vibeLabel });

  // Initialize private structured chat logger
  initChatSession(roomId, socketA.id, socketB.id, vibeLabel);

  socketA.emit('chat_start', { roomId, vibe: vibeLabel });
  socketB.emit('chat_start', { roomId, vibe: vibeLabel });
}

function removeFromQueue(socketId) {
  const item = waitingQueue.find((entry) => (typeof entry === 'object' ? entry.socketId === socketId : entry === socketId));
  if (item && item.timer) clearTimeout(item.timer);
  waitingQueue = waitingQueue.filter((entry) => (typeof entry === 'object' ? entry.socketId !== socketId : entry !== socketId));
}

function cleanupUser(socketId, notifyPartner = true) {
  // Remove from waiting queue if present
  removeFromQueue(socketId);

  // Check if user was in an active room
  if (activeRooms.has(socketId)) {
    const { partnerId, roomId } = activeRooms.get(socketId);

    // Finalize chat session & flush AI training dataset
    finishChatSession(roomId);

    // Remove current user
    activeRooms.delete(socketId);
    roomJobyCooldown.delete(roomId);

    // FIX: Leave room for initiating socket (eliminates ghost room leak)
    const currentSocket = io.sockets.sockets.get(socketId);
    if (currentSocket) currentSocket.leave(roomId);

    // Notify & cleanup partner
    if (activeRooms.has(partnerId)) {
      activeRooms.delete(partnerId);
      const partnerSocket = io.sockets.sockets.get(partnerId);
      if (partnerSocket) {
        partnerSocket.leave(roomId);
        if (notifyPartner) {
          partnerSocket.emit('partner_disconnected', {
            message: 'Stranger has disconnected.'
          });
        }
      }
    }
  }
}

function matchUser(socket, requestedVibe = 'any') {
  // First clean up any existing room or queue status
  cleanupUser(socket.id, true);

  const vibe = ['exam', 'tea', 'canteen'].includes(requestedVibe) ? requestedVibe : 'any';

  // Purge any stale disconnected sockets from waitingQueue
  waitingQueue = waitingQueue.filter((entry) => {
    const sId = typeof entry === 'object' ? entry.socketId : entry;
    const s = io.sockets.sockets.get(sId);
    const valid = s && s.connected && sId !== socket.id;
    if (!valid && typeof entry === 'object' && entry.timer) clearTimeout(entry.timer);
    return valid;
  });

  // Soft-matching algorithm:
  // 1. If newcomer requested a specific vibe, look for a matching vibe first
  if (vibe !== 'any') {
    const matchIndex = waitingQueue.findIndex((entry) => (typeof entry === 'object' ? entry.vibe === vibe : false));
    if (matchIndex !== -1) {
      const matched = waitingQueue.splice(matchIndex, 1)[0];
      if (matched.timer) clearTimeout(matched.timer);
      const partnerSocket = io.sockets.sockets.get(typeof matched === 'object' ? matched.socketId : matched);
      if (partnerSocket && partnerSocket.connected) {
        pairUsers(socket, partnerSocket, VIBE_LABELS[vibe]);
        return;
      }
    }

    // 1b. If no exact vibe match, check if someone waiting chose 'any'
    const anyIndex = waitingQueue.findIndex((entry) => (typeof entry === 'object' ? entry.vibe === 'any' : true));
    if (anyIndex !== -1) {
      const matched = waitingQueue.splice(anyIndex, 1)[0];
      if (matched.timer) clearTimeout(matched.timer);
      const partnerSocket = io.sockets.sockets.get(typeof matched === 'object' ? matched.socketId : matched);
      if (partnerSocket && partnerSocket.connected) {
        pairUsers(socket, partnerSocket, VIBE_LABELS[vibe]);
        return;
      }
    }
  }

  // 2. If newcomer requested 'any', or if queue has someone waiting >= 2.5s
  if (vibe === 'any' && waitingQueue.length > 0) {
    const matched = waitingQueue.shift();
    if (typeof matched === 'object' && matched.timer) clearTimeout(matched.timer);
    const sId = typeof matched === 'object' ? matched.socketId : matched;
    const partnerSocket = io.sockets.sockets.get(sId);
    if (partnerSocket && partnerSocket.connected) {
      const pairedVibe = (typeof matched === 'object' && matched.vibe && matched.vibe !== 'any')
        ? VIBE_LABELS[matched.vibe]
        : VIBE_LABELS.any;
      pairUsers(socket, partnerSocket, pairedVibe);
      return;
    }
  }

  // 3. If queue has someone who has been waiting >= 2500ms, pair with them regardless of vibe
  const expiredIdx = waitingQueue.findIndex((entry) => typeof entry === 'object' && (Date.now() - entry.joinedAt >= 2500));
  if (expiredIdx !== -1) {
    const matched = waitingQueue.splice(expiredIdx, 1)[0];
    if (matched.timer) clearTimeout(matched.timer);
    const partnerSocket = io.sockets.sockets.get(matched.socketId);
    if (partnerSocket && partnerSocket.connected) {
      const pairedVibe = VIBE_LABELS[vibe] || VIBE_LABELS.any;
      pairUsers(socket, partnerSocket, pairedVibe);
      return;
    }
  }

  // 4. Otherwise, place user into waitingQueue with 2.5s soft-match timer
  const queueEntry = {
    socketId: socket.id,
    vibe: vibe,
    joinedAt: Date.now(),
    timer: null
  };

  // If not matched within 2.5s, pair with the next available waiting student so liquidity is never fragmented
  queueEntry.timer = setTimeout(() => {
    const selfIdx = waitingQueue.findIndex((entry) => (typeof entry === 'object' ? entry.socketId === socket.id : entry === socket.id));
    if (selfIdx === -1) return;

    // Find any other valid connected waiting student
    let partnerSocket = null;
    while (waitingQueue.length > 0) {
      const otherIdx = waitingQueue.findIndex((entry) => (typeof entry === 'object' ? entry.socketId !== socket.id : entry !== socket.id));
      if (otherIdx === -1) break;
      const partnerEntry = waitingQueue.splice(otherIdx, 1)[0];
      if (typeof partnerEntry === 'object' && partnerEntry.timer) clearTimeout(partnerEntry.timer);
      const pId = typeof partnerEntry === 'object' ? partnerEntry.socketId : partnerEntry;
      const ps = io.sockets.sockets.get(pId);
      if (ps && ps.connected) {
        partnerSocket = ps;
        break;
      }
    }

    if (partnerSocket && socket.connected) {
      const curSelfIdx = waitingQueue.findIndex((entry) => (typeof entry === 'object' ? entry.socketId === socket.id : entry === socket.id));
      if (curSelfIdx !== -1) waitingQueue.splice(curSelfIdx, 1);
      const pairedVibe = VIBE_LABELS[queueEntry.vibe] || VIBE_LABELS.any;
      pairUsers(socket, partnerSocket, pairedVibe);
    }
  }, 2500);

  waitingQueue.push(queueEntry);
  socket.emit('waiting_for_partner');
}

io.on('connection', (socket) => {
  socket.data = { msgTimestamps: [], lastAction: 0 };
  broadcastOnlineCount();

  const clientIp = (socket.handshake.headers && socket.handshake.headers['x-forwarded-for']
    ? socket.handshake.headers['x-forwarded-for'].split(',')[0].trim()
    : socket.handshake.address) || '127.0.0.1';

  // Check What's New v3 modal eligibility (1-time per IP)
  const shouldShowWhatsNew = !seenWhatsNewIPs.has(clientIp);
  if (shouldShowWhatsNew) {
    seenWhatsNewIPs.add(clientIp);
  }
  socket.emit('whats_new_status', { show: shouldShowWhatsNew });

  socket.on('check_whats_new', () => {
    const show = !seenWhatsNewIPs.has(clientIp);
    if (show) {
      seenWhatsNewIPs.add(clientIp);
    }
    socket.emit('whats_new_status', { show });
  });

  socket.on('ack_whats_new', () => {
    seenWhatsNewIPs.add(clientIp);
  });

  // Send current online count and server build info to newly connected client
  socket.emit('server_build', { buildId: BUILD_ID, version: BUILD_VERSION });
  socket.emit('online_count', { count: io.engine.clientsCount });

  // Start searching for a partner (throttled to prevent click spam)
  socket.on('find_partner', (data) => {
    if (isActionThrottled(socket, 400)) return;
    matchUser(socket, data && data.vibe);
  });

  // Cancel search
  socket.on('cancel_search', () => {
    removeFromQueue(socket.id);
    socket.emit('search_cancelled');
  });

  // Sending a message with rate limiting and newline normalization
  socket.on('send_message', (data) => {
    if (isRateLimited(socket, 20, 2000, 'msgTimestamps')) return; // Generous 20 msgs/2s limit
    if (!data) return;

    const msgId = typeof data.msgId === 'string' && data.msgId.trim()
      ? data.msgId.trim().slice(0, 64)
      : `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const textRaw = typeof data.text === 'string' ? data.text : '';
    const sanitized = textRaw.trim().replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').slice(0, 1500);

    // Audio voice note validation (ephemeral Base64 WebM/Opus, max 400KB, max 15s)
    let audioPayload = null;
    if (data.audio && typeof data.audio.data === 'string' && data.audio.data.startsWith('data:audio/')) {
      if (data.audio.data.length <= 400000) {
        audioPayload = {
          data: data.audio.data,
          duration: typeof data.audio.duration === 'number' ? Math.min(Math.max(1, data.audio.duration), 15) : 5
        };
      }
    }

    // Image attachment validation (ephemeral Base64 JPEG/PNG/WebP, max 950KB)
    let imagePayload = null;
    if (data.image && typeof data.image === 'string' && (data.image.startsWith('data:image/') || data.image.startsWith('https://'))) {
      if (data.image.length <= 950000) {
        imagePayload = data.image;
      }
    }

    const viewOnce = !!data.viewOnce;

    if (!sanitized && !audioPayload && !imagePayload) return;

    let replyTo = null;
    if (data.replyTo && typeof data.replyTo.text === 'string') {
      const trimmedQuote = data.replyTo.text.trim().slice(0, 150);
      if (trimmedQuote) {
        replyTo = {
          id: typeof data.replyTo.id === 'string' ? data.replyTo.id.slice(0, 64) : null,
          text: trimmedQuote,
          author: data.replyTo.author === 'self' ? 'self' : 'partner'
        };
      }
    }

    const ephemeral = !!data.ephemeral;

    // Verify active room connection
    if (activeRooms.has(socket.id)) {
      const { partnerId, roomId } = activeRooms.get(socket.id);
      const partnerSocket = io.sockets.sockets.get(partnerId);
      if (partnerSocket) {
        // Acknowledge back to sender
        socket.emit('message_sent_ack', { msgId });

        partnerSocket.emit('receive_message', {
          msgId,
          text: sanitized,
          audio: audioPayload,
          image: imagePayload,
          viewOnce: viewOnce,
          replyTo: replyTo,
          ephemeral: ephemeral,
          timestamp: Date.now()
        });

        // Record message in private AI dataset JSON
        recordChatMessage(roomId, socket.id, {
          msgId,
          text: sanitized,
          audio: audioPayload,
          image: imagePayload,
          replyTo: replyTo,
          ephemeral: ephemeral
        });

        // Trigger Joby Sir Discipline Easter Egg if bad words / gali detected
        if (sanitized && containsAbuse(sanitized)) {
          triggerJobySirIntervention(roomId, socket, partnerSocket);
        }
      } else {
        cleanupUser(socket.id, false);
        socket.emit('partner_disconnected', { message: 'Stranger has disconnected.' });
      }
    } else {
      socket.emit('partner_disconnected', { message: 'Stranger has disconnected.' });
    }
  });

  // Relay Emoji Reactions (Rate limited)
  socket.on('message_reaction', (data) => {
    if (isRateLimited(socket, 15, 2000, 'relayTimestamps')) return;
    if (!data || typeof data.msgId !== 'string' || typeof data.reaction !== 'string') return;
    if (activeRooms.has(socket.id)) {
      const { partnerId } = activeRooms.get(socket.id);
      const partnerSocket = io.sockets.sockets.get(partnerId);
      if (partnerSocket) {
        partnerSocket.emit('message_reaction', {
          msgId: data.msgId.slice(0, 64),
          reaction: data.reaction.slice(0, 8)
        });
      }
    }
  });

  // Relay Pinned Messages (Rate limited)
  socket.on('pin_message', (data) => {
    if (isRateLimited(socket, 10, 2000, 'relayTimestamps')) return;
    if (!data || typeof data.msgId !== 'string') return;
    if (activeRooms.has(socket.id)) {
      const { partnerId } = activeRooms.get(socket.id);
      const partnerSocket = io.sockets.sockets.get(partnerId);
      if (partnerSocket) {
        partnerSocket.emit('pin_message', {
          msgId: data.msgId.slice(0, 64),
          text: typeof data.text === 'string' ? data.text.slice(0, 200) : ''
        });
      }
    }
  });

  socket.on('unpin_message', () => {
    if (isRateLimited(socket, 10, 2000, 'relayTimestamps')) return;
    if (activeRooms.has(socket.id)) {
      const { partnerId } = activeRooms.get(socket.id);
      const partnerSocket = io.sockets.sockets.get(partnerId);
      if (partnerSocket) {
        partnerSocket.emit('unpin_message');
      }
    }
  });

  // Relay Delivery & Seen Ticks (Rate limited)
  socket.on('message_delivered', (data) => {
    if (isRateLimited(socket, 20, 2000, 'tickTimestamps')) return;
    if (!data || typeof data.msgId !== 'string') return;
    if (activeRooms.has(socket.id)) {
      const { partnerId } = activeRooms.get(socket.id);
      const partnerSocket = io.sockets.sockets.get(partnerId);
      if (partnerSocket) {
        partnerSocket.emit('message_delivered', { msgId: data.msgId.slice(0, 64) });
      }
    }
  });

  socket.on('message_seen', (data) => {
    if (isRateLimited(socket, 20, 2000, 'tickTimestamps')) return;
    if (!data || typeof data.msgId !== 'string') return;
    if (activeRooms.has(socket.id)) {
      const { partnerId } = activeRooms.get(socket.id);
      const partnerSocket = io.sockets.sockets.get(partnerId);
      if (partnerSocket) {
        partnerSocket.emit('message_seen', { msgId: data.msgId.slice(0, 64) });
      }
    }
  });

  // Relay Ephemeral Bomb Destruct Event (Rate limited)
  socket.on('message_destruct', (data) => {
    if (isRateLimited(socket, 10, 2000, 'relayTimestamps')) return;
    if (!data || typeof data.msgId !== 'string') return;
    if (activeRooms.has(socket.id)) {
      const { partnerId } = activeRooms.get(socket.id);
      const partnerSocket = io.sockets.sockets.get(partnerId);
      if (partnerSocket) {
        partnerSocket.emit('message_destruct', { msgId: data.msgId.slice(0, 64) });
      }
    }
  });

  // Relay Tab Focus State (for real-time seen indicators)
  socket.on('partner_focus', (data) => {
    if (isRateLimited(socket, 10, 2000, 'relayTimestamps')) return;
    if (!data) return;
    if (activeRooms.has(socket.id)) {
      const { partnerId } = activeRooms.get(socket.id);
      const partnerSocket = io.sockets.sockets.get(partnerId);
      if (partnerSocket) {
        partnerSocket.emit('partner_focus', { focused: !!data.focused });
      }
    }
  });

  // Typing indicators
  socket.on('typing', () => {
    if (isRateLimited(socket, 25, 2000, 'typingTimestamps')) return;
    if (activeRooms.has(socket.id)) {
      const { partnerId } = activeRooms.get(socket.id);
      const partnerSocket = io.sockets.sockets.get(partnerId);
      if (partnerSocket) {
        partnerSocket.emit('partner_typing');
      }
    }
  });

  socket.on('stop_typing', () => {
    if (activeRooms.has(socket.id)) {
      const { partnerId } = activeRooms.get(socket.id);
      const partnerSocket = io.sockets.sockets.get(partnerId);
      if (partnerSocket) {
        partnerSocket.emit('partner_stop_typing');
      }
    }
  });

  // Next / Skip partner (throttled)
  socket.on('next_partner', (data) => {
    if (isActionThrottled(socket, 400)) return;
    matchUser(socket, data && data.vibe);
  });

  // --- The Last Bench Wall Socket Events ---
  socket.on('get_bench_posts', (data) => {
    const voterToken = data && typeof data.voterToken === 'string' ? data.voterToken.slice(0, 64) : null;
    if (voterToken) socket.data.voterToken = voterToken;
    socket.emit('bench_posts_sync', getBenchPostsPayload(voterToken));
  });

  socket.on('submit_bench_post', (data) => {
    if (isRateLimited(socket, 6, 4000, 'postTimestamps')) return;
    if (!data || typeof data.content !== 'string') return;
    const rawContent = data.content.trim().slice(0, 280);
    if (!rawContent) return;

    if (containsAbuse(rawContent)) {
      socket.emit('bench_post_rejected', {
        reason: 'Joby Sir Disciplinary Alert: i told you beta gali nahi dene ka meet tommarow'
      });
      return;
    }

    const voterToken = typeof data.voterToken === 'string' ? data.voterToken.slice(0, 64) : `anon_${Date.now()}`;
    socket.data.voterToken = voterToken;
    const flair = VALID_FLAIRS.includes(data.flair) ? data.flair : '[📚 Exam Panic]';

    const newPost = {
      id: `post_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      deskCodename: getRandomDeskCodename(),
      flair: flair,
      content: rawContent,
      timestamp: Date.now(),
      score: 1,
      baseKarma: 0,
      upvoters: new Set([voterToken]),
      downvoters: new Set()
    };

    addBenchPost(newPost);
    broadcastBenchPostsSync();
  });

  socket.on('vote_bench_post', (data) => {
    if (isRateLimited(socket, 20, 2000, 'voteTimestamps')) return;
    if (!data || typeof data.postId !== 'string' || typeof data.dir !== 'number') return;
    const voterToken = typeof data.voterToken === 'string' ? data.voterToken.slice(0, 64) : null;
    if (!voterToken) return;
    socket.data.voterToken = voterToken;

    const success = handleBenchVote(data.postId, data.dir, voterToken);
    if (success) {
      broadcastBenchPostsSync();
    }
  });

  // --- Daily Last-Bench Dilemma Socket Events ---
  socket.on('get_poll', (data) => {
    const voterToken = data && typeof data.voterToken === 'string' ? data.voterToken.slice(0, 64) : null;
    if (voterToken) socket.data.voterToken = voterToken;
    socket.emit('poll_sync', getPollPayload(voterToken));
  });

  socket.on('vote_poll', (data) => {
    if (isRateLimited(socket, 10, 2000, 'pollVoteTimestamps')) return;
    if (!data || typeof data.voterToken !== 'string' || !['optionA', 'optionB'].includes(data.choice)) return;
    const voterToken = data.voterToken.slice(0, 64);
    socket.data.voterToken = voterToken;
    const dilemma = getActiveDilemma();
    const votes = dilemmaVotes.get(dilemma.id);
    if (data.choice === 'optionA') {
      votes.optionA.add(voterToken);
      votes.optionB.delete(voterToken);
    } else {
      votes.optionB.add(voterToken);
      votes.optionA.delete(voterToken);
    }
    broadcastPollSync();
  });

  // --- Bench Chits ("Parchi Pass Karo") Socket Event ---
  socket.on('draw_bench_chit', () => {
    if (isRateLimited(socket, 8, 2000, 'relayTimestamps')) return;
    if (activeRooms.has(socket.id)) {
      const { partnerId } = activeRooms.get(socket.id);
      const partnerSocket = io.sockets.sockets.get(partnerId);
      if (partnerSocket && partnerSocket.connected) {
        const chitText = BENCH_CHITS[Math.floor(Math.random() * BENCH_CHITS.length)];
        const chitId = `chit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const payload = {
          id: chitId,
          text: chitText,
          timestamp: Date.now()
        };
        socket.emit('receive_bench_chit', { ...payload, fromSelf: true });
        partnerSocket.emit('receive_bench_chit', { ...payload, fromSelf: false });
        recordChatSystemEvent(roomId, 'bench_chit', `Parchi Pass: ${chitText}`);
      } else {
        cleanupUser(socket.id, false);
        socket.emit('partner_disconnected', { message: 'Stranger has disconnected.' });
      }
    }
  });

  // Disconnect / Leave chat
  socket.on('leave_chat', () => {
    cleanupUser(socket.id, true);
    socket.emit('chat_ended');
  });

  // Socket disconnected
  socket.on('disconnect', () => {
    cleanupUser(socket.id, true);
    broadcastOnlineCount();
  });
});

// Process crash resilience guards
process.on('uncaughtException', (err) => {
  console.error('[AnonChat Exception]', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('[AnonChat Rejection]', reason);
});

server.listen(PORT, () => {
  console.log(`[AnonChat] Server running smoothly on http://localhost:${PORT}`);
});

module.exports = server;
