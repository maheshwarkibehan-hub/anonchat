const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const crypto = require('crypto');

// Load local .env variables if file exists (Zero dependencies)
const ENV_FILE = path.join(__dirname, '.env');
if (fs.existsSync(ENV_FILE)) {
  try {
    const envLines = fs.readFileSync(ENV_FILE, 'utf8').split('\n');
    for (const rawLine of envLines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eqIdx = line.indexOf('=');
      if (eqIdx !== -1) {
        const key = line.slice(0, eqIdx).trim();
        const val = line.slice(eqIdx + 1).trim().replace(/^['"](.*)['"]$/, '$1');
        if (!process.env[key]) process.env[key] = val;
      }
    }
  } catch (e) {}
}

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

// Optional Render AI Worker Webhook (Wakes up the separate 10 AI Agents service on Render)
const AI_WORKER_URL = process.env.AI_WORKER_URL || '';
let lastWorkerPing = 0;
function wakeUpAiWorker() {
  if (!AI_WORKER_URL) return;
  const now = Date.now();
  if (now - lastWorkerPing < 60000) return; // Throttled to at most once per minute
  lastWorkerPing = now;

  try {
    const isHttps = AI_WORKER_URL.startsWith('https');
    const client = isHttps ? require('https') : require('http');
    const targetUrl = new URL('/api/wakeup', AI_WORKER_URL);
    const req = client.request(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      timeout: 5000
    });
    req.on('error', () => {});
    req.write(JSON.stringify({ timestamp: now }));
    req.end();
  } catch (err) {}
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

// Parse incoming JSON and form payloads for REST APIs (up to 50mb for note photo uploads)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Route root to main chat app
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'app-chat.html'));
});

// School Work & Class Notes page (modular v2.0 directory)
app.get('/school-work', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'school-work', 'index.html'));
});

// Admin Live Wiretap & Prank Studio Dashboard
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Clean route for privacy policy page
app.get('/privacy', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'privacy.html'));
});

// Clean route for Synapse Design System showcase
app.get('/synapse', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'synapse.html'));
});

// Clean route for Shutdown notice page
app.get('/shutdown', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'shutdown.html'));
});

// Clearly labeled fictional AI agent showcase
app.get('/girl-agent', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'girl-agent.html'));
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
const aiAgentSockets = new Set(); // socket.id of connected AI agents
const adminSockets = new Set(); // socket.id of connected Admin Mission Control dashboards

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
  const dayFolder = getLocalDateFolder();
  const timePrefix = getLocalTimePrefix();
  const dayDir = path.join(CHAT_LOG_DIR, dayFolder);
  const fileName = `chat_${timePrefix}_${roomId}.json`;
  const filePath = path.join(dayDir, fileName);

  chatSessions.set(roomId, {
    roomId,
    vibe: vibeLabel || 'Direct',
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

// --- Admin Live Wiretap & Prank Studio Helpers ---
function getAdminRoomsSummary() {
  const roomMap = new Map();
  for (const [socketId, info] of activeRooms.entries()) {
    if (!roomMap.has(info.roomId)) {
      const session = chatSessions.get(info.roomId);
      const partnerSocketId = info.partnerId;
      roomMap.set(info.roomId, {
        roomId: info.roomId,
        vibe: session ? session.vibe : 'Direct',
        startTime: session ? session.startTime : new Date().toISOString(),
        durationSeconds: session ? Math.max(0, Math.round((Date.now() - new Date(session.startTime).getTime()) / 1000)) : 0,
        messageCount: session ? session.messages.length : 0,
        participants: [
          { socketId, alias: session?.userAliases?.[socketId] || 'Student_1' },
          { socketId: partnerSocketId, alias: session?.userAliases?.[partnerSocketId] || 'Student_2' }
        ],
        lastMessage: session && session.messages.length ? session.messages[session.messages.length - 1] : null
      });
    }
  }
  return Array.from(roomMap.values());
}

function broadcastToAdmins(event, data) {
  if (adminSockets.size === 0) return;
  for (const adminId of adminSockets) {
    const s = io.sockets.sockets.get(adminId);
    if (s && s.connected) {
      s.emit(event, data);
    }
  }
}

function broadcastAdminStats() {
  const distinctRooms = new Set();
  for (const info of activeRooms.values()) {
    distinctRooms.add(info.roomId);
  }
  broadcastToAdmins('admin_stats', {
    onlineCount: io.engine.clientsCount,
    activeRoomsCount: distinctRooms.size,
    waitingCount: waitingQueue.length,
    monitoredSessionsCount: chatSessions.size
  });
}

function notifyAdminRoomCreated(roomId, vibe, participants) {
  broadcastToAdmins('admin_room_created', {
    roomId,
    vibe,
    startTime: new Date().toISOString(),
    participants,
    messageCount: 0
  });
  broadcastAdminStats();
}

function notifyAdminRoomClosed(roomId) {
  broadcastToAdmins('admin_room_closed', { roomId });
  broadcastAdminStats();
}

function notifyAdminNewMessage(roomId, senderSocketId, text, audio, image, replyTo, ephemeral, extra = null) {
  const session = chatSessions.get(roomId);
  let senderAlias = 'Student_1';
  if (session && session.userAliases && session.userAliases[senderSocketId]) {
    senderAlias = session.userAliases[senderSocketId];
  } else if (senderSocketId === 'SYSTEM') {
    senderAlias = extra?.name ? extra.name : 'System';
  }

  broadcastToAdmins('admin_message_feed', {
    roomId,
    msgId: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    senderSocketId,
    senderAlias,
    text: text || '',
    audio: !!audio,
    image: !!image,
    replyTo: replyTo || null,
    ephemeral: !!ephemeral,
    timestamp: Date.now(),
    extra: extra || null
  });
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
    notifyAdminNewMessage(roomId, 'SYSTEM', JOBY_MESSAGE_TEXT, null, null, null, false, {
      isPrank: true,
      name: 'Joby Jacob Sir',
      role: 'Discipline Incharge',
      photo: JOBY_PHOTO
    });
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

function pairUsers(socketA, socketB, vibeLabel = 'Direct') {
  const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  socketA.join(roomId);
  socketB.join(roomId);

  activeRooms.set(socketA.id, { partnerId: socketB.id, roomId });
  activeRooms.set(socketB.id, { partnerId: socketA.id, roomId });

  // Initialize private structured chat logger safely
  try {
    initChatSession(roomId, socketA.id, socketB.id, vibeLabel);
  } catch (err) {
    console.error('[Chat Logger Init Error]', err.message);
  }

  const crypto = require('crypto');
  const getAnonHash = (sock) => {
    const ip = (sock.handshake.headers && sock.handshake.headers['x-forwarded-for']
      ? sock.handshake.headers['x-forwarded-for'].split(',')[0].trim()
      : sock.handshake.address) || '127.0.0.1';
    return crypto.createHash('sha256').update(ip + '_salt_anon').digest('hex').slice(0, 16);
  };

  const hashA = getAnonHash(socketA);
  const hashB = getAnonHash(socketB);

  socketA.emit('chat_start', { roomId, partnerHash: hashB });
  socketB.emit('chat_start', { roomId, partnerHash: hashA });

  // Real-time broadcast to Admin wiretap
  notifyAdminRoomCreated(roomId, vibeLabel, [
    { socketId: socketA.id, hash: hashA, alias: 'Student_1' },
    { socketId: socketB.id, hash: hashB, alias: 'Student_2' }
  ]);
}

function removeFromQueue(socketId) {
  waitingQueue = waitingQueue.filter((id) => id !== socketId);
}

function cleanupUser(socketId, notifyPartner = true) {
  // Remove from waiting queue if present
  removeFromQueue(socketId);

  // Check if user was in an active room
  if (activeRooms.has(socketId)) {
    const { partnerId, roomId } = activeRooms.get(socketId);

    // Finalize chat session & flush AI training dataset safely
    try {
      finishChatSession(roomId);
    } catch (err) {
      console.error('[Chat Logger Finish Error]', err.message);
    }

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

    // Notify live Admin dashboards
    notifyAdminRoomClosed(roomId);
  }
}

function matchUser(socket) {
  // First clean up any existing room or queue status
  cleanupUser(socket.id, true);

  const isCurrentSocketAi = aiAgentSockets.has(socket.id);

  // Purge any stale disconnected sockets from waitingQueue
  waitingQueue = waitingQueue.filter((id) => {
    const s = io.sockets.sockets.get(id);
    return s && s.connected && id !== socket.id;
  });

  if (isCurrentSocketAi) {
    // If the requester is an AI agent, find an idle REAL HUMAN in waitingQueue
    const humanPartnerIdx = waitingQueue.findIndex((id) => !aiAgentSockets.has(id));
    if (humanPartnerIdx !== -1) {
      const humanPartnerId = waitingQueue.splice(humanPartnerIdx, 1)[0];
      const humanPartnerSocket = io.sockets.sockets.get(humanPartnerId);
      if (humanPartnerSocket && humanPartnerSocket.connected) {
        pairUsers(socket, humanPartnerSocket);
        return;
      }
    }
    // No real human waiting right now; AI agent waits silently (NEVER PAIR AI WITH AI!)
    waitingQueue.push(socket.id);
    socket.emit('waiting_for_partner');
    return;
  }

  // --- Requester is a REAL HUMAN ---
  // 1. First priority: Match with another waiting REAL HUMAN
  const humanPartnerIdx = waitingQueue.findIndex((id) => !aiAgentSockets.has(id));
  if (humanPartnerIdx !== -1) {
    const partnerId = waitingQueue.splice(humanPartnerIdx, 1)[0];
    const partnerSocket = io.sockets.sockets.get(partnerId);
    if (partnerSocket && partnerSocket.connected) {
      pairUsers(socket, partnerSocket);
      return;
    }
  }

  // 2. Second priority: If no human is waiting, match with an idle AI AGENT!
  const aiPartnerIdx = waitingQueue.findIndex((id) => aiAgentSockets.has(id));
  if (aiPartnerIdx !== -1) {
    const aiPartnerId = waitingQueue.splice(aiPartnerIdx, 1)[0];
    const aiPartnerSocket = io.sockets.sockets.get(aiPartnerId);
    if (aiPartnerSocket && aiPartnerSocket.connected) {
      pairUsers(socket, aiPartnerSocket);
      return;
    }
  }

  // 3. Otherwise add human to waiting queue
  waitingQueue.push(socket.id);
  socket.emit('waiting_for_partner');
}

io.on('connection', (socket) => {
  socket.data = { msgTimestamps: [], lastAction: 0 };
  broadcastOnlineCount();
  wakeUpAiWorker();

  // Register autonomous AI agents into AI pool so they never match with each other
  socket.on('register_ai_agent', () => {
    aiAgentSockets.add(socket.id);
  });

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
  socket.on('find_partner', () => {
    if (isActionThrottled(socket, 400)) return;
    if (!aiAgentSockets.has(socket.id)) {
      wakeUpAiWorker();
    }
    matchUser(socket);
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

        // Broadcast to Admin live wiretap
        notifyAdminNewMessage(roomId, socket.id, sanitized, audioPayload, imagePayload, replyTo, ephemeral);

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
  socket.on('next_partner', () => {
    if (isActionThrottled(socket, 400)) return;
    matchUser(socket);
  });

  // Disconnect / Leave chat
  socket.on('leave_chat', () => {
    cleanupUser(socket.id, true);
    socket.emit('chat_ended');
  });

  // ==========================================
  // Admin Mission Control & Prank Studio Hub
  // ==========================================
  socket.on('admin_init', () => {
    adminSockets.add(socket.id);
    const distinctRooms = new Set();
    for (const info of activeRooms.values()) {
      distinctRooms.add(info.roomId);
    }
    socket.emit('admin_init_data', {
      stats: {
        onlineCount: io.engine.clientsCount,
        activeRoomsCount: distinctRooms.size,
        waitingCount: waitingQueue.length,
        monitoredSessionsCount: chatSessions.size
      },
      rooms: getAdminRoomsSummary()
    });
  });

  socket.on('admin_get_room_history', (payload) => {
    const roomId = payload && payload.roomId ? payload.roomId : null;
    if (!roomId) return;
    const session = chatSessions.get(roomId);
    socket.emit('admin_room_history', {
      roomId,
      session: session ? {
        roomId: session.roomId,
        vibe: session.vibe,
        startTime: session.startTime,
        messages: session.messages,
        userAliases: session.userAliases
      } : null
    });
  });

  socket.on('admin_send_prank', (data) => {
    if (!data) return;
    const targetRoomId = data.targetRoomId;
    const name = (data.name || 'Joby Jacob Sir').trim().slice(0, 50);
    const role = (data.role || 'Discipline Incharge').trim().slice(0, 50);
    const text = (data.text || 'i told you beta gali nahi dene ka meet tommarow').trim().slice(0, 1000);
    const photo = data.photo || JOBY_PHOTO;
    const fallbackPhoto = data.fallbackPhoto || '/joby-sir.jpg';
    const withSiren = data.siren !== false;
    const withTyping = !!data.typingBefore;
    const prankType = data.prankType || 'joby_card';
    const footer = data.footer || 'Staff Room / Discipline Alert • SJS Kaushambi';

    const targetRooms = [];
    if (targetRoomId === 'ALL') {
      const distinct = new Set();
      for (const info of activeRooms.values()) {
        distinct.add(info.roomId);
      }
      targetRooms.push(...Array.from(distinct));
    } else if (targetRoomId) {
      targetRooms.push(targetRoomId);
    }

    if (targetRooms.length === 0) {
      socket.emit('admin_prank_ack', {
        success: false,
        message: 'No active rooms currently selected or found'
      });
      return;
    }

    for (const rId of targetRooms) {
      if (prankType === 'joby_card') {
        const incomingPayload = {
          name,
          role,
          forced: true,
          siren: withSiren
        };

        const messagePayload = {
          id: `prank_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          name,
          role,
          photo,
          fallbackPhoto,
          text,
          footer,
          timestamp: Date.now(),
          forced: true,
          siren: withSiren
        };

        if (withTyping) {
          io.to(rId).emit('joby_sir_incoming', incomingPayload);
          setTimeout(() => {
            io.to(rId).emit('joby_sir_message', messagePayload);
            recordChatSystemEvent(rId, 'teacher_intervention', `${name} (${role}): ${text}`);
            notifyAdminNewMessage(rId, 'SYSTEM', text, null, null, null, false, {
              isPrank: true,
              name,
              role,
              photo
            });
          }, 1300);
        } else {
          io.to(rId).emit('joby_sir_message', messagePayload);
          recordChatSystemEvent(rId, 'teacher_intervention', `${name} (${role}): ${text}`);
          notifyAdminNewMessage(rId, 'SYSTEM', text, null, null, null, false, {
            isPrank: true,
            name,
            role,
            photo
          });
        }
      } else if (prankType === 'normal_msg') {
        const fakeMsg = {
          msgId: `ghost_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          text: `[${name}]: ${text}`,
          timestamp: Date.now()
        };
        io.to(rId).emit('receive_message', fakeMsg);
        recordChatSystemEvent(rId, 'ghost_message', `[${name}]: ${text}`);
        notifyAdminNewMessage(rId, 'SYSTEM', `[${name}]: ${text}`, null, null, null, false, {
          isPrank: true,
          name,
          role: 'Ghost',
          photo
        });
      }
    }

    socket.emit('admin_prank_ack', {
      success: true,
      roomsCount: targetRooms.length,
      message: `Prank message sent to ${targetRooms.length} room(s)!`
    });
  });

  socket.on('admin_disconnect_room', ({ roomId }) => {
    if (!roomId) return;
    for (const [sId, info] of activeRooms.entries()) {
      if (info.roomId === roomId) {
        const sock = io.sockets.sockets.get(sId);
        if (sock) {
          sock.emit('partner_disconnected', { message: 'Chat terminated by Administrator.' });
        }
        cleanupUser(sId, false);
      }
    }
    socket.emit('admin_room_closed', { roomId });
  });

  // Socket disconnected
  socket.on('disconnect', () => {
    adminSockets.delete(socket.id);
    aiAgentSockets.delete(socket.id);
    cleanupUser(socket.id, true);
    broadcastOnlineCount();
    broadcastAdminStats();
  });
});

// --- Master Admin Authentication Engine ---
const ADMIN_AUTH_FILE = path.join(__dirname, 'data', 'admin_auth.json');
const adminSessions = new Map(); // token -> { username, createdAt, lastActive }

function getAdminAuthData() {
  try {
    if (fs.existsSync(ADMIN_AUTH_FILE)) {
      const raw = fs.readFileSync(ADMIN_AUTH_FILE, 'utf8');
      const data = JSON.parse(raw);
      if (data && data.initialized && data.username && data.hash && data.salt) {
        return data;
      }
    }
  } catch (err) {
    console.error('[AdminAuth] Read error:', err.message);
  }
  return null;
}

function saveAdminAuthData(data) {
  try {
    fs.mkdirSync(path.dirname(ADMIN_AUTH_FILE), { recursive: true });
    fs.writeFileSync(ADMIN_AUTH_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('[AdminAuth] Write error:', err.message);
    return false;
  }
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

function verifyPassword(password, salt, storedHash) {
  try {
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'));
  } catch (e) {
    return false;
  }
}

function getSessionFromRequest(req) {
  const token = req.headers['x-admin-token'] || 
                (req.headers.authorization && req.headers.authorization.replace(/^Bearer\s+/i, ''));
  if (token && adminSessions.has(token)) {
    const session = adminSessions.get(token);
    session.lastActive = Date.now();
    return { token, session };
  }
  return null;
}

// Auth status check
app.get('/api/admin/auth/status', (req, res) => {
  const authData = getAdminAuthData();
  const sessionInfo = getSessionFromRequest(req);

  res.json({
    success: true,
    initialized: !!authData,
    authenticated: !!sessionInfo,
    username: sessionInfo ? sessionInfo.session.username : (authData ? authData.username : null)
  });
});

// Initial Setup (First time only)
app.post('/api/admin/auth/setup', (req, res) => {
  const existing = getAdminAuthData();
  if (existing && existing.initialized) {
    return res.status(400).json({ success: false, error: 'Admin account has already been set up. Please log in.' });
  }

  const { username, password } = req.body || {};
  const cleanUsername = (username || '').trim();
  const cleanPassword = (password || '').trim();

  if (!cleanUsername || cleanUsername.length < 3) {
    return res.status(400).json({ success: false, error: 'Username must be at least 3 characters long.' });
  }
  if (!cleanPassword || cleanPassword.length < 5) {
    return res.status(400).json({ success: false, error: 'Password must be at least 5 characters long.' });
  }

  const { salt, hash } = hashPassword(cleanPassword);
  const authRecord = {
    initialized: true,
    username: cleanUsername,
    salt,
    hash,
    createdAt: new Date().toISOString()
  };

  if (!saveAdminAuthData(authRecord)) {
    return res.status(500).json({ success: false, error: 'Failed to persist credentials to disk.' });
  }

  // Issue session token
  const token = crypto.randomBytes(32).toString('hex');
  adminSessions.set(token, {
    username: cleanUsername,
    createdAt: Date.now(),
    lastActive: Date.now()
  });

  res.json({
    success: true,
    token,
    username: cleanUsername,
    message: 'Master admin credentials created successfully!'
  });
});

// Sign In
app.post('/api/admin/auth/login', (req, res) => {
  const authData = getAdminAuthData();
  if (!authData || !authData.initialized) {
    return res.status(400).json({ success: false, error: 'No admin account configured yet. Please complete initial setup first.' });
  }

  const { username, password } = req.body || {};
  const cleanUsername = (username || '').trim();
  const cleanPassword = (password || '').trim();

  if (cleanUsername !== authData.username || !verifyPassword(cleanPassword, authData.salt, authData.hash)) {
    return res.status(401).json({ success: false, error: 'Invalid username or password.' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  adminSessions.set(token, {
    username: cleanUsername,
    createdAt: Date.now(),
    lastActive: Date.now()
  });

  res.json({
    success: true,
    token,
    username: cleanUsername,
    message: 'Signed in successfully!'
  });
});

// Logout
app.post('/api/admin/auth/logout', (req, res) => {
  const sessionInfo = getSessionFromRequest(req);
  if (sessionInfo) {
    adminSessions.delete(sessionInfo.token);
  }
  res.json({ success: true, message: 'Signed out successfully.' });
});

// --- Admin REST API Endpoints ---
app.get('/api/admin/rooms', (req, res) => {
  const distinctRooms = new Set();
  for (const info of activeRooms.values()) {
    distinctRooms.add(info.roomId);
  }
  res.json({
    stats: {
      onlineCount: io.engine.clientsCount,
      activeRoomsCount: distinctRooms.size,
      waitingCount: waitingQueue.length,
      monitoredSessionsCount: chatSessions.size
    },
    rooms: getAdminRoomsSummary()
  });
});

app.get('/api/admin/room/:roomId', (req, res) => {
  const session = chatSessions.get(req.params.roomId);
  if (!session) return res.status(404).json({ error: 'Room not found or ended' });
  res.json({
    roomId: session.roomId,
    vibe: session.vibe,
    startTime: session.startTime,
    messages: session.messages,
    userAliases: session.userAliases
  });
});

app.post('/api/admin/prank', (req, res) => {
  const data = req.body || {};
  const targetRoomId = data.targetRoomId;
  const name = (data.name || 'Joby Jacob Sir').trim().slice(0, 50);
  const role = (data.role || 'Discipline Incharge').trim().slice(0, 50);
  const text = (data.text || 'i told you beta gali nahi dene ka meet tommarow').trim().slice(0, 1000);
  const photo = data.photo || JOBY_PHOTO;
  const fallbackPhoto = data.fallbackPhoto || '/joby-sir.jpg';
  const withSiren = data.siren !== false;
  const withTyping = !!data.typingBefore;
  const prankType = data.prankType || 'joby_card';
  const footer = data.footer || 'Staff Room / Discipline Alert • SJS Kaushambi';

  const targetRooms = [];
  if (targetRoomId === 'ALL') {
    const distinct = new Set();
    for (const info of activeRooms.values()) {
      distinct.add(info.roomId);
    }
    targetRooms.push(...Array.from(distinct));
  } else if (targetRoomId) {
    targetRooms.push(targetRoomId);
  }

  if (targetRooms.length === 0) {
    return res.status(400).json({ success: false, message: 'No active rooms found' });
  }

  for (const rId of targetRooms) {
    if (prankType === 'joby_card') {
      const incomingPayload = { name, role, forced: true, siren: withSiren };
      const messagePayload = {
        id: `prank_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name,
        role,
        photo,
        fallbackPhoto,
        text,
        footer,
        timestamp: Date.now(),
        forced: true,
        siren: withSiren
      };

      if (withTyping) {
        io.to(rId).emit('joby_sir_incoming', incomingPayload);
        setTimeout(() => {
          io.to(rId).emit('joby_sir_message', messagePayload);
          recordChatSystemEvent(rId, 'teacher_intervention', `${name} (${role}): ${text}`);
          notifyAdminNewMessage(rId, 'SYSTEM', text, null, null, null, false, { isPrank: true, name, role, photo });
        }, 1300);
      } else {
        io.to(rId).emit('joby_sir_message', messagePayload);
        recordChatSystemEvent(rId, 'teacher_intervention', `${name} (${role}): ${text}`);
        notifyAdminNewMessage(rId, 'SYSTEM', text, null, null, null, false, { isPrank: true, name, role, photo });
      }
    } else {
      const fakeMsg = {
        msgId: `ghost_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        text: `[${name}]: ${text}`,
        timestamp: Date.now()
      };
      io.to(rId).emit('receive_message', fakeMsg);
      recordChatSystemEvent(rId, 'ghost_message', `[${name}]: ${text}`);
      notifyAdminNewMessage(rId, 'SYSTEM', `[${name}]: ${text}`, null, null, null, false, { isPrank: true, name, role: 'Ghost', photo });
    }
  }

  res.json({ success: true, count: targetRooms.length, message: `Dispatched to ${targetRooms.length} rooms` });
});

// --- School Work & Class Notes Persistence Engine ---
const SCHOOL_WORK_FILE = path.join(__dirname, 'data', 'school_work.json');
const SCHOOL_WORK_UPLOADS_DIR = path.join(__dirname, 'public', 'uploads', 'school-work');

const DEFAULT_SUBJECTS = [
  { id: 'physics', name: 'Physics', code: 'PHY', category: 'Science', description: 'Optics, Electricity, Magnetism & Energy Sources (NCERT Class 10)', chapters: [] },
  { id: 'chemistry', name: 'Chemistry', code: 'CHE', category: 'Science', description: 'Chemical Reactions, Acids, Bases, Metals & Carbon (NCERT Class 10)', chapters: [] },
  { id: 'biology', name: 'Biology', code: 'BIO', category: 'Science', description: 'Life Processes, Control, Reproduction, Heredity & Environment (NCERT Class 10)', chapters: [] },
  { id: 'mathematics', name: 'Mathematics', code: 'MAT', category: 'Core', description: 'Real Numbers, Polynomials, Linear Equations, Triangles, Trig, Stats & Probability', chapters: [] },
  { id: 'social-science', name: 'Social Science', code: 'SOC', category: 'Humanities', description: 'History, Contemporary Geography, Democratic Politics & Economic Development', chapters: [] },
  { id: 'english', name: 'English', code: 'ENG', category: 'Languages', description: 'First Flight (Prose & Poems) and Footprints Without Feet Supplementary Reader', chapters: [] },
  { id: 'hindi', name: 'Hindi', code: 'HIN', category: 'Languages', description: 'Kshitij Part-2 (Kavya & Gadya) and Kritika Part-2 (NCERT Class 10)', chapters: [] },
  { id: 'computer', name: 'Computer Applications', code: 'COM', category: 'Technology', description: 'Networking, HTML, Cyber Ethics & Digital Tools (CBSE/NCERT Class 10)', chapters: [] }
];

function readSchoolWorkData() {
  try {
    if (fs.existsSync(SCHOOL_WORK_FILE)) {
      const raw = fs.readFileSync(SCHOOL_WORK_FILE, 'utf8');
      const data = JSON.parse(raw);
      if (Array.isArray(data.subjects) && data.subjects.length > 0) {
        return data;
      }
    }
  } catch (err) {
    console.error('[SchoolWork] Read error:', err.message);
  }
  const initial = { subjects: DEFAULT_SUBJECTS };
  try {
    fs.mkdirSync(path.dirname(SCHOOL_WORK_FILE), { recursive: true });
    fs.writeFileSync(SCHOOL_WORK_FILE, JSON.stringify(initial, null, 2), 'utf8');
  } catch (e) {}
  return initial;
}

function writeSchoolWorkData(data) {
  try {
    fs.mkdirSync(path.dirname(SCHOOL_WORK_FILE), { recursive: true });
    fs.writeFileSync(SCHOOL_WORK_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('[SchoolWork] Write error:', err.message);
    return false;
  }
}

// Git auto-persistence engine for School Work uploads
let isSchoolWorkGitSyncing = false;
let schoolWorkGitSyncPending = false;

function triggerSchoolWorkGitSync(desc = 'update school work') {
  if (isSchoolWorkGitSyncing) {
    schoolWorkGitSyncPending = true;
    return;
  }
  isSchoolWorkGitSyncing = true;
  const safeDesc = desc.replace(/["`$]/g, '').slice(0, 80);
  const cmd = `git add "public/uploads/school-work" "data/school_work.json" && git commit -m "feat(school-work): ${safeDesc} [skip ci]" && git push origin ${GITHUB_BRANCH}`;
  
  exec(cmd, { cwd: __dirname }, (error, stdout, stderr) => {
    isSchoolWorkGitSyncing = false;
    if (error) {
      if (!error.message.includes('nothing to commit')) {
        console.warn('[SchoolWork GitSync]', error.message.split('\n')[0]);
      }
    } else {
      console.log(`[SchoolWork GitSync] Successfully pushed school work updates to GitHub (${safeDesc}).`);
    }

    if (schoolWorkGitSyncPending) {
      schoolWorkGitSyncPending = false;
      setTimeout(() => triggerSchoolWorkGitSync('batch school work updates'), 2000);
    }
  });
}

// 1. Get all subjects summary
app.get('/api/school-work/subjects', (req, res) => {
  const data = readSchoolWorkData();
  const subjects = data.subjects.map(s => ({
    id: s.id,
    name: s.name,
    code: s.code,
    category: s.category,
    description: s.description,
    chaptersCount: (s.chapters || []).length,
    totalPagesCount: (s.chapters || []).reduce((acc, ch) => acc + (ch.photos || []).length, 0)
  }));
  res.json({ success: true, subjects });
});

// 2. Get specific subject details & chapters
app.get('/api/school-work/subject/:subjectId', (req, res) => {
  const data = readSchoolWorkData();
  const subject = data.subjects.find(s => s.id === req.params.subjectId);
  if (!subject) return res.status(404).json({ success: false, error: 'Subject not found' });
  res.json({
    success: true,
    subject: {
      id: subject.id,
      name: subject.name,
      code: subject.code,
      category: subject.category,
      description: subject.description,
      chapters: (subject.chapters || []).map(ch => ({
        id: ch.id,
        chapterNumber: ch.chapterNumber,
        title: ch.title,
        createdAt: ch.createdAt,
        pagesCount: (ch.photos || []).length
      }))
    }
  });
});

// 3. Get specific chapter details with all photo notes
app.get('/api/school-work/chapter/:subjectId/:chapterId', (req, res) => {
  const data = readSchoolWorkData();
  const subject = data.subjects.find(s => s.id === req.params.subjectId);
  if (!subject) return res.status(404).json({ success: false, error: 'Subject not found' });
  const chapter = (subject.chapters || []).find(ch => ch.id === req.params.chapterId);
  if (!chapter) return res.status(404).json({ success: false, error: 'Chapter not found' });

  res.json({
    success: true,
    subject: { id: subject.id, name: subject.name, code: subject.code },
    chapter
  });
});

// 4. Admin: Create a new chapter folder inside a subject
app.post('/api/admin/school-work/chapter', (req, res) => {
  const { subjectId, chapterNumber, title } = req.body || {};
  if (!subjectId || !chapterNumber || !title) {
    return res.status(400).json({ success: false, error: 'Missing subjectId, chapterNumber, or title' });
  }

  const data = readSchoolWorkData();
  const subject = data.subjects.find(s => s.id === subjectId);
  if (!subject) return res.status(404).json({ success: false, error: 'Subject not found' });

  if (!subject.chapters) subject.chapters = [];
  const parsedNum = parseInt(chapterNumber, 10) || (subject.chapters.length + 1);
  const chapterId = `ch-${parsedNum}-${Date.now().toString(36)}`;

  const newChapter = {
    id: chapterId,
    chapterNumber: parsedNum,
    title: title.trim().slice(0, 120),
    createdAt: new Date().toISOString(),
    photos: []
  };

  subject.chapters.push(newChapter);
  subject.chapters.sort((a, b) => a.chapterNumber - b.chapterNumber);

  const chapterDir = path.join(SCHOOL_WORK_UPLOADS_DIR, subjectId, chapterId);
  fs.mkdirSync(chapterDir, { recursive: true });

  writeSchoolWorkData(data);
  triggerSchoolWorkGitSync(`create chapter ${parsedNum} in ${subject.name}`);
  res.json({ success: true, chapter: newChapter });
});

// 5. Admin: Upload note photos to a chapter
app.post('/api/admin/school-work/upload', (req, res) => {
  const { subjectId, chapterId, photos } = req.body || {};
  if (!subjectId || !chapterId || !Array.isArray(photos) || photos.length === 0) {
    return res.status(400).json({ success: false, error: 'Missing subjectId, chapterId, or photos payload' });
  }

  const data = readSchoolWorkData();
  const subject = data.subjects.find(s => s.id === subjectId);
  if (!subject) return res.status(404).json({ success: false, error: 'Subject not found' });

  const chapter = (subject.chapters || []).find(ch => ch.id === chapterId);
  if (!chapter) return res.status(404).json({ success: false, error: 'Chapter not found' });

  if (!chapter.photos) chapter.photos = [];

  const chapterDir = path.join(SCHOOL_WORK_UPLOADS_DIR, subjectId, chapterId);
  fs.mkdirSync(chapterDir, { recursive: true });

  const uploadedEntries = [];

  for (let i = 0; i < photos.length; i++) {
    const item = photos[i];
    if (!item.base64) continue;

    const matches = item.base64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    let buffer;
    let ext = 'jpg';

    if (matches && matches.length === 3) {
      const mime = matches[1].toLowerCase();
      if (mime.includes('png')) ext = 'png';
      else if (mime.includes('webp')) ext = 'webp';
      else if (mime.includes('gif')) ext = 'gif';
      buffer = Buffer.from(matches[2], 'base64');
    } else {
      buffer = Buffer.from(item.base64, 'base64');
    }

    const pageNum = chapter.photos.length + 1;
    const safeTitle = (item.title || `Page ${pageNum}`).trim().slice(0, 80);
    const filename = `page_${pageNum}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
    const filePath = path.join(chapterDir, filename);

    fs.writeFileSync(filePath, buffer);

    const photoEntry = {
      id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      pageNumber: pageNum,
      title: safeTitle,
      filename,
      url: `/uploads/school-work/${subjectId}/${chapterId}/${filename}`,
      uploadedAt: new Date().toISOString()
    };

    chapter.photos.push(photoEntry);
    uploadedEntries.push(photoEntry);
  }

  writeSchoolWorkData(data);
  triggerSchoolWorkGitSync(`upload ${uploadedEntries.length} notes to ${subject.name} ch ${chapter.chapterNumber}`);
  res.json({ success: true, count: uploadedEntries.length, photos: uploadedEntries });
});

// 6. Admin: Delete an entire chapter
app.delete('/api/admin/school-work/chapter/:subjectId/:chapterId', (req, res) => {
  const { subjectId, chapterId } = req.params;
  const data = readSchoolWorkData();
  const subject = data.subjects.find(s => s.id === subjectId);
  if (!subject) return res.status(404).json({ success: false, error: 'Subject not found' });

  const idx = (subject.chapters || []).findIndex(ch => ch.id === chapterId);
  if (idx === -1) return res.status(404).json({ success: false, error: 'Chapter not found' });

  subject.chapters.splice(idx, 1);

  try {
    const chapterDir = path.join(SCHOOL_WORK_UPLOADS_DIR, subjectId, chapterId);
    if (fs.existsSync(chapterDir)) {
      fs.rmSync(chapterDir, { recursive: true, force: true });
    }
  } catch (e) {}

  writeSchoolWorkData(data);
  triggerSchoolWorkGitSync(`delete chapter ${chapterId} from ${subject.name}`);
  res.json({ success: true, message: 'Chapter deleted successfully' });
});

// 7. Admin: Delete a single note photo
app.delete('/api/admin/school-work/photo/:subjectId/:chapterId/:photoId', (req, res) => {
  const { subjectId, chapterId, photoId } = req.params;
  const data = readSchoolWorkData();
  const subject = data.subjects.find(s => s.id === subjectId);
  if (!subject) return res.status(404).json({ success: false, error: 'Subject not found' });

  const chapter = (subject.chapters || []).find(ch => ch.id === chapterId);
  if (!chapter) return res.status(404).json({ success: false, error: 'Chapter not found' });

  const pIdx = (chapter.photos || []).findIndex(p => p.id === photoId);
  if (pIdx === -1) return res.status(404).json({ success: false, error: 'Photo not found' });

  const photo = chapter.photos[pIdx];
  chapter.photos.splice(pIdx, 1);

  chapter.photos.forEach((p, index) => {
    p.pageNumber = index + 1;
  });

  try {
    const filePath = path.join(SCHOOL_WORK_UPLOADS_DIR, subjectId, chapterId, photo.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (e) {}

  writeSchoolWorkData(data);
  triggerSchoolWorkGitSync(`delete note photo in ${subject.name}`);
  res.json({ success: true, message: 'Photo deleted successfully' });
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
